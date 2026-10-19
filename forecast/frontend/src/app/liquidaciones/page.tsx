'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  BarChart3, 
  Table, 
  TrendingUp, 
  Wallet, 
  Calendar, 
  Globe, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  DollarSign,
  Percent,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  Cell 
} from 'recharts';
import { getRateToUSD, formatMoney } from '@/lib/exchangeRates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface MonthMeta {
  key: string;           // "2026-03"
  periodoDate: string;   // "2026-03-01"
  label: string;         // "Marzo 2026"
  shortLabel: string;    // "Mar 26"
  isProjected: boolean;
}

interface CountryMeta {
  code: string;
  name: string;
  flag: string;
  currency: string;
  symbol: string;
  isBaja?: boolean;
}

function MetasFacturacionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Pestaña activa sincronizada con la URL (?view=subtotales o ?view=detallado)
  const viewParam = searchParams.get('view');
  const countryParam = searchParams.get('country');
  const activeTab = viewParam === 'detallado' ? 'detallado' : 'subtotales';

  // Filtro de país / moneda activo (inicializado desde URL o 'AR' por defecto)
  const [selectedCountry, setSelectedCountry] = useState<string>(countryParam || 'AR');

  // Si cambia el query param country en la URL, sincronizar estado local
  useEffect(() => {
    if (countryParam && countryParam !== selectedCountry) {
      setSelectedCountry(countryParam);
    }
  }, [countryParam]);

  const handleTabChange = (tab: 'subtotales' | 'detallado') => {
    router.replace(`/liquidaciones?view=${tab}&country=${selectedCountry}`);
  };

  // Cliente seleccionado en la tabla para dinamizar el gráfico y cards (null = todos)
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  
  // Modo de variación porcentual: 'mensual' (MoM), 'diaria' (Run-rate diario), 'none' (ocultar)
  const [variationMode, setVariationMode] = useState<'mensual' | 'diaria' | 'none'>('mensual');

  // Filtro temporal: "LAST_12" (6 reales + 6 proyectados), "2026", "REAL_ONLY", "ALL"
  const [timelineFilter, setTimelineFilter] = useState<'LAST_12' | '2026' | 'REAL_ONLY' | 'ALL'>('LAST_12');
  
  // Búsqueda de cliente
  const [searchTerm, setSearchTerm] = useState('');

  // Si cambia el país, sincronizar con URL y resetear cliente seleccionado
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedSellerId(null);
    router.replace(`/liquidaciones?view=${activeTab}&country=${countryCode}`);
  };

  // Función para obtener la cantidad de días del mes
  const getDaysInMonth = (monthKey: string) => {
    if (!monthKey) return 30;
    const parts = monthKey.split('-');
    const year = Number(parts[0]) || 2026;
    const month = Number(parts[1]) || 1;
    return new Date(year, month, 0).getDate();
  };

  // Función para calcular la variación porcentual entre dos valores según el modo seleccionado
  const calculateVariation = (
    currentVal: number,
    prevVal: number,
    currentMonthKey: string,
    prevMonthKey: string,
    mode: 'mensual' | 'diaria' | 'none'
  ): number | null => {
    if (mode === 'none') return null;
    if (!prevVal || prevVal <= 0 || !currentVal || currentVal <= 0) return null;

    if (mode === 'mensual') {
      return (currentVal - prevVal) / prevVal;
    }

    // Variación diaria: normalizada por días en cada mes
    const currentDays = getDaysInMonth(currentMonthKey);
    const prevDays = getDaysInMonth(prevMonthKey);
    const currentDaily = currentVal / currentDays;
    const prevDaily = prevVal / prevDays;

    if (prevDaily <= 0) return null;
    return (currentDaily - prevDaily) / prevDaily;
  };

  const [loading, setLoading] = useState(true);
  const [rawLiquidaciones, setRawLiquidaciones] = useState<any[]>([]);
  const [sellersMap, setSellersMap] = useState<Record<string, any>>({});
  const [monthsList, setMonthsList] = useState<MonthMeta[]>([]);
  const [newsanSubAccounts, setNewsanSubAccounts] = useState<Record<string, Record<string, number>>>({});
  const [newsanMetricas, setNewsanMetricas] = useState<Record<string, { sesiones: number; horas: number }>>({});
  const [newsanChileExpanded, setNewsanChileExpanded] = useState<boolean>(true);

  // 1. Cargar datos de Supabase
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [liqsRes, sellersRes, metricasRes, facturacionSubRes] = await Promise.all([
        supabase
          .from('liquidaciones')
          .select('*')
          .order('periodo', { ascending: true })
          .order('nombre_seller', { ascending: true }),
        supabase
          .from('dim_sellers')
          .select('id_seller, nombre_seller, pais, moneda, estado'),
        supabase
          .from('fact_metricas_operativas')
          .select('*')
          .eq('seller_id', 989595440),
        supabase
          .from('facturacion')
          .select('*')
          .in('seller_id', [308973138, 256324891, 942368053, 977559914, 962651791, 919428720, 978106559, 936492429])
      ]);

      if (liqsRes.error) {
        console.error('Error fetching liquidaciones:', liqsRes.error);
        setLoading(false);
        return;
      }

      // Parsear métricas de Tienda Web (Sesiones y Horas Extras)
      const metMap: Record<string, { sesiones: number; horas: number }> = {};
      if (metricasRes.data) {
        metricasRes.data.forEach((m: any) => {
          const d = new Date(m.periodo + 'T12:00:00');
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const key = `${yyyy}-${mm}`;
          if (!metMap[key]) metMap[key] = { sesiones: 0, horas: 0 };
          if (m.tipo_metrica === 'SESIONES') metMap[key].sesiones = Number(m.cantidad) || 0;
          if (m.tipo_metrica === 'HORAS_EXTRAS') metMap[key].horas = Number(m.cantidad) || 0;
        });
      }
      setNewsanMetricas(metMap);

      // Parsear facturación individual de subcuentas ML (Motorola y Pilisar)
      const subMap: Record<string, Record<string, number>> = {};
      if (facturacionSubRes.data) {
        facturacionSubRes.data.forEach((f: any) => {
          const sid = String(f.seller_id);
          const d = new Date(f.periodo + 'T12:00:00');
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const key = `${yyyy}-${mm}`;
          if (!subMap[sid]) subMap[sid] = {};
          subMap[sid][key] = Number(f.valor_facturado) || 0;
        });
      }
      setNewsanSubAccounts(subMap);

      const sellersMeta: Record<string, CountryMeta> = {};
      if (sellersRes.data) {
        sellersRes.data.forEach((s: any) => {
          const p = (s.pais || '').toUpperCase();
          const m = (s.moneda || '').toUpperCase();
          
          let countryCode = 'AR';
          let countryName = 'Argentina';
          let flag = '🇦🇷';
          let currency = 'ARS';
          let symbol = '$';

          if (p === 'MEX' || p === 'MX' || m === 'MXN') {
            countryCode = 'MX';
            countryName = 'México';
            flag = '🇲🇽';
            currency = 'USD';
            symbol = 'US$';
          } else if (p === 'CL' || m === 'CLP') {
            countryCode = 'CL';
            countryName = 'Chile';
            flag = '🇨🇱';
            currency = 'USD';
            symbol = 'US$';
          } else if (p === 'CO' || m === 'COP') {
            countryCode = 'CO';
            countryName = 'Colombia';
            flag = '🇨🇴';
            currency = 'COP';
            symbol = '$';
          } else if (p === 'US' || m === 'USD') {
            countryCode = 'US';
            countryName = 'Estados Unidos';
            flag = '🇺🇸';
            currency = 'USD';
            symbol = 'US$';
          }

          const isTrademedical = String(s.id_seller) === '983474076' || s.nombre_seller?.toLowerCase().includes('trademedical');
          const isBaja = s.estado === false || isTrademedical;

          sellersMeta[s.id_seller] = {
            code: countryCode,
            name: countryName,
            flag,
            currency,
            symbol,
            isBaja
          };
        });
      }
      setSellersMap(sellersMeta);

      const liqsData = liqsRes.data || [];
      setRawLiquidaciones(liqsData);

      // Extraer y ordenar meses cronológicamente
      const monthMap = new Map<string, MonthMeta>();
      liqsData.forEach((row: any) => {
        if (!row.periodo) return;
        const d = new Date(row.periodo + 'T12:00:00');
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;

        if (!monthMap.has(key)) {
          let label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
          label = label.charAt(0).toUpperCase() + label.slice(1);
          
          let shortLabel = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
          shortLabel = shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1).replace('.', '');

          monthMap.set(key, {
            key,
            periodoDate: row.periodo,
            label,
            shortLabel,
            isProjected: row.estado === 'PROYECTADO'
          });
        } else {
          // Si encontramos al menos una fila REAL, podemos verificar
          const current = monthMap.get(key)!;
          if (row.estado === 'REAL') {
            current.isProjected = false;
          }
        }
      });

      const sortedMonths = Array.from(monthMap.values()).sort((a, b) => 
        a.key.localeCompare(b.key)
      );

      setMonthsList(sortedMonths);
      setLoading(false);
    }

    fetchData();
  }, []);

  // Función para obtener tarifas históricas de Tienda Newsan Web
  const getNewsanWebTarifas = (monthKey: string) => {
    if (monthKey >= '2026-09') {
      return { valorSesion: 846.49, minGarantizado: 6506954.09, valorHora: 14270.86 };
    }
    if (monthKey >= '2026-07') {
      return { valorSesion: 846.49, minGarantizado: 5567742.83, valorHora: 14270.86 };
    }
    if (monthKey >= '2026-04') {
      return { valorSesion: 793.00, minGarantizado: 5567742.83, valorHora: 13369.12 };
    }
    if (monthKey >= '2026-01') {
      return { valorSesion: 0, minGarantizado: 5165193.00, valorHora: 12211.01 };
    }
    return { valorSesion: 846.49, minGarantizado: 6506954.09, valorHora: 14270.86 };
  };

  // Formateadores de moneda
  const formatCurrency = (val: number, currency = 'ARS') => {
    if (val === 0 || !val) return '$ 0';
    try {
      if (currency === 'MXN') {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
      }
      if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
      }
      if (currency === 'COP') {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
      }
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
    } catch {
      return `$ ${Math.round(val).toLocaleString()}`;
    }
  };

  const formatShortCurrency = (val: number, currency = 'ARS') => {
    if (!val || val === 0) return '0';
    if (Math.abs(val) >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `$${(val / 1_000).toFixed(0)}K`;
    }
    return `$${Math.round(val)}`;
  };

  const formatPercent = (val: number | string | null) => {
    if (val === 'MÍNIMO') return 'MÍNIMO';
    return val !== null && typeof val === 'number' 
      ? new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 2 }).format(val) 
      : '-';
  };

  // Filtrado de meses según selector de temporalidad
  const filteredMonths = useMemo(() => {
    if (timelineFilter === 'REAL_ONLY') {
      return monthsList.filter(m => !m.isProjected);
    }
    if (timelineFilter === '2026') {
      return monthsList.filter(m => m.key.startsWith('2026'));
    }
    if (timelineFilter === 'LAST_12') {
      // 6 meses reales hacia atrás + 6 meses proyectados hacia adelante
      const realMonths = monthsList.filter(m => !m.isProjected);
      const projMonths = monthsList.filter(m => m.isProjected);
      const recentReal = realMonths.slice(-6);
      const nextProj = projMonths.slice(0, 6);
      const combined = [...recentReal, ...nextProj];
      return combined.length > 0 ? combined : monthsList;
    }
    return monthsList;
  }, [monthsList, timelineFilter]);

  // Lista de países únicos detectados
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    rawLiquidaciones.forEach(row => {
      const meta = sellersMap[row.seller_id];
      const code = meta?.code || 'AR';
      set.add(code);
    });
    const countryLabels: Record<string, { label: string; flag: string; currency: string }> = {
      'AR': { label: 'Argentina (ARS)', flag: '🇦🇷', currency: 'ARS' },
      'MX': { label: 'México (MXN)', flag: '🇲🇽', currency: 'MXN' },
      'CL': { label: 'Chile (USD)', flag: '🇨🇱', currency: 'USD' },
      'CO': { label: 'Colombia (COP)', flag: '🇨🇴', currency: 'COP' },
      'US': { label: 'USA (USD)', flag: '🇺🇸', currency: 'USD' }
    };
    return Array.from(set).map(c => ({
      code: c,
      label: countryLabels[c]?.label || c,
      flag: countryLabels[c]?.flag || '🌐',
      currency: countryLabels[c]?.currency || 'ARS'
    }));
  }, [rawLiquidaciones, sellersMap]);

  // Agrupamiento estructurado por País -> Clientes -> Meses (Subtotales)
  const groupedData = useMemo(() => {
    const countriesMap: Record<string, {
      country: CountryMeta;
      sellersMap: Record<string, {
        id: string;
        name: string;
        isBaja?: boolean;
        months: Record<string, {
          subtotal: number;
          isProjected: boolean;
          estado: string;
          moneda?: string;
          facturacion: number;
          fee: any;
          botmaker: number;
          montoServicio: number;
          iva: number;
          total: number;
        }>;
        totalRow: number;
      }>;
      monthlyTotals: Record<string, number>;
      grandTotal: number;
    }> = {};

    rawLiquidaciones.forEach((row: any) => {
      const sId = String(row.seller_id);
      const sName = row.nombre_seller;
      const meta = sellersMap[sId] || {
        code: 'AR',
        name: 'Argentina',
        flag: '🇦🇷',
        currency: 'ARS',
        symbol: '$'
      };

      const cCode = meta.code;
      if (!countriesMap[cCode]) {
        let countryCur = meta.currency;
        let countrySym = meta.symbol;
        if (cCode === 'MX') { countryCur = 'MXN'; countrySym = '$'; }
        else if (cCode === 'CO') { countryCur = 'COP'; countrySym = '$'; }
        else if (cCode === 'US') { countryCur = 'USD'; countrySym = 'US$'; }
        else if (cCode === 'CL') { countryCur = 'USD'; countrySym = 'US$'; }
        else if (cCode === 'AR') { countryCur = 'ARS'; countrySym = '$'; }

        countriesMap[cCode] = {
          country: {
            ...meta,
            currency: countryCur,
            symbol: countrySym
          },
          sellersMap: {},
          monthlyTotals: {},
          grandTotal: 0
        };
      }

      if (!countriesMap[cCode].sellersMap[sId]) {
        countriesMap[cCode].sellersMap[sId] = {
          id: sId,
          name: sName,
          isBaja: meta.isBaja || false,
          months: {},
          totalRow: 0
        };
      }

      const d = new Date(row.periodo + 'T12:00:00');
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const mKey = `${yyyy}-${mm}`;

      let subtotalVal = Number(row.subtotal) || 0;
      let montoServicio = Number(row.subtotal_mercado_libre) || 0;
      let ivaVal = Number(row.iva) || 0;
      let totalVal = Number(row.total_factura) || 0;
      let feeVal = row.tipo_cargo_aplicado === 'MINIMO' ? 'MÍNIMO' : row.alicuota_aplicada;
      let factVal = Number(row.valor_facturado) || 0;
      let rowCurrency = row.moneda || meta.currency;

      // Soporte para cuentas de Chile (Newsan Chile) - Cobro en USD sin IVA
      if (meta.code === 'CL' || cCode === 'CL') {
        rowCurrency = 'USD';
        ivaVal = 0;
      }

      // Soporte para cuentas de México (Evacol México) - Cobro en USD sin IVA
      if (meta.code === 'MX' || cCode === 'MX') {
        rowCurrency = 'USD';
        ivaVal = 0;
      }

      // Soporte para cuentas con escala en USD (Natura Colombia - seller_id 941943480)
      if (sId === '941943480') {
        rowCurrency = 'USD';
        ivaVal = 0;
        // Cruce exacto: Facturación COP / TC oficial COP -> Facturación USD -> Escala USD
        const naturaFeeMap: Record<string, { fee: number; alicuota: any }> = {
          '2026-02': { fee: 1200.00, alicuota: 'MÍNIMO' },
          '2026-03': { fee: 1217.47, alicuota: 0.0293 },
          '2026-04': { fee: 1200.00, alicuota: 'MÍNIMO' },
          '2026-05': { fee: 1365.38, alicuota: 0.0276 },
          '2026-06': { fee: 1374.38, alicuota: 0.0276 },
          '2026-07': { fee: 1868.56, alicuota: 0.0276 },
          '2026-08': { fee: 1716.24, alicuota: 0.0244 },
          '2026-09': { fee: 2108.48, alicuota: 0.0228 },
          // 12 Meses Proyectados (cruce Facturación COP proyectada / TC proyectado -> Escala USD)
          '2026-10': { fee: 1742.23, alicuota: 0.0244 },
          '2026-11': { fee: 2170.76, alicuota: 0.0228 },
          '2026-12': { fee: 2588.12, alicuota: 0.0228 },
          '2027-01': { fee: 1617.70, alicuota: 0.0276 },
          '2027-02': { fee: 1749.13, alicuota: 0.0276 },
          '2027-03': { fee: 1856.25, alicuota: 0.0244 },
          '2027-04': { fee: 1923.73, alicuota: 0.0244 },
          '2027-05': { fee: 2314.34, alicuota: 0.0228 },
          '2027-06': { fee: 2025.41, alicuota: 0.0244 },
          '2027-07': { fee: 2095.52, alicuota: 0.0244 },
          '2027-08': { fee: 2166.62, alicuota: 0.0244 },
          '2027-09': { fee: 2282.10, alicuota: 0.0228 },
        };
        if (naturaFeeMap[mKey]) {
          montoServicio = naturaFeeMap[mKey].fee;
          subtotalVal = naturaFeeMap[mKey].fee;
          totalVal = naturaFeeMap[mKey].fee;
          feeVal = naturaFeeMap[mKey].alicuota;
        }
      }

      // Soporte para cuentas con escala en USD (Disuiza Colombia - seller_id 964690754)
      if (sId === '964690754') {
        rowCurrency = 'USD';
        ivaVal = 0;
        // Facturación en COP / TC COP -> Facturación USD -> Comisión = USD * 0.02 -> Fee = MAX(1500, Comisión)
        const tcCopMap: Record<string, number> = {
          '2024-04': 3897.0, '2024-05': 3897.0, '2024-06': 3897.0, '2024-07': 3897.0,
          '2024-08': 3897.0, '2024-09': 3897.0, '2024-10': 3897.0, '2024-11': 3897.0, '2024-12': 3897.0,
          '2025-01': 3950.0, '2025-02': 3970.0, '2025-03': 3990.0, '2025-04': 4305.02,
          '2025-05': 4107.0, '2025-06': 3974.37, '2025-07': 4097.38, '2025-08': 4016.0,
          '2025-09': 3897.0, '2025-10': 3800.0, '2025-11': 3784.0, '2025-12': 3790.77,
          '2026-01': 3622.0, '2026-02': 3769.0, '2026-03': 3660.0, '2026-04': 3660.0,
          '2026-05': 3562.0, '2026-06': 3440.83, '2026-07': 3205.80, '2026-08': 3213.97,
          '2026-09': 3312.84, '2026-10': 3325.00, '2026-11': 3340.00, '2026-12': 3360.00,
          '2027-01': 3375.00, '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
          '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00, '2027-08': 3485.00,
          '2027-09': 3500.00
        };
        const currentTc = tcCopMap[mKey] || 3350.0;
        const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
        const comision2pct = factUsd * 0.02;
        const feeFinal = Math.max(1500.0, comision2pct);
        
        montoServicio = Math.round(feeFinal * 100) / 100;
        subtotalVal = montoServicio;
        totalVal = montoServicio;
        feeVal = feeFinal === 1500.0 ? 'MÍNIMO' : 0.02;
      }

      // Soporte para Evacol Colombia ML (seller_id 928666257)
      // Escala en USD (Mínimo $1.000 USD o 4% a 2%) -> Reconversión y cobro en COP
      if (sId === '928666257') {
        rowCurrency = 'COP'; // Se factura y cobra en COP
        ivaVal = 0;
        const tcCopMap: Record<string, number> = {
          '2026-02': 3769.00, '2026-03': 3660.00, '2026-04': 3660.00,
          '2026-05': 3562.00, '2026-06': 3440.83, '2026-07': 3205.80,
          '2026-08': 3213.97, '2026-09': 3312.84, '2026-10': 3325.00,
          '2026-11': 3340.00, '2026-12': 3360.00, '2027-01': 3375.00,
          '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
          '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00,
          '2027-08': 3485.00, '2027-09': 3500.00
        };
        const currentTc = tcCopMap[mKey] || 3350.0;
        const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
        
        let feeUsd = 1000.0;
        let alicuotaVal: any = 'MÍNIMO';
        if (factUsd >= 150000) {
          feeUsd = factUsd * 0.02;
          alicuotaVal = 0.02;
        } else if (factUsd >= 110000) {
          feeUsd = factUsd * 0.025;
          alicuotaVal = 0.025;
        } else if (factUsd >= 80000) {
          feeUsd = factUsd * 0.03;
          alicuotaVal = 0.03;
        } else if (factUsd >= 60000) {
          feeUsd = factUsd * 0.035;
          alicuotaVal = 0.035;
        } else if (factUsd >= 50000) {
          feeUsd = factUsd * 0.04;
          alicuotaVal = 0.04;
        } else {
          feeUsd = 1000.0;
          alicuotaVal = 'MÍNIMO';
        }

        // Reconversión a COP multiplicando por TC Oficial:
        const feeCop = Math.round(feeUsd * currentTc);
        montoServicio = feeCop;
        subtotalVal = feeCop;
        totalVal = feeCop;
        feeVal = alicuotaVal;
      }

      // Soporte para Evacol Colombia ADDI (seller_id 928424062)
      // Flat fee: 1.000 USD fijos todos los meses independientemente de su facturación
      if (sId === '928424062') {
        rowCurrency = 'USD';
        ivaVal = 0;
        montoServicio = 1000.00;
        subtotalVal = 1000.00;
        totalVal = 1000.00;
        feeVal = 'FIJO';
      }

      // Soporte para Formex Colombia (seller_id 127711636)
      // Facturación bruta en COP -> Convertir a USD -> Cruce con Escala USD (Mínimo $1.000 USD o 2,93% a 1,30%) -> Cobro en USD
      if (sId === '127711636') {
        rowCurrency = 'USD';
        ivaVal = 0;
        const tcCopMap: Record<string, number> = {
          '2026-05': 3562.00, '2026-06': 3440.83, '2026-07': 3205.80,
          '2026-08': 3213.97, '2026-09': 3312.84, '2026-10': 3325.00,
          '2026-11': 3340.00, '2026-12': 3360.00, '2027-01': 3375.00,
          '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
          '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00,
          '2027-08': 3485.00, '2027-09': 3500.00
        };
        const currentTc = tcCopMap[mKey] || 3350.0;
        const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
        
        let feeUsd = 1000.0;
        let alicuotaVal: any = 'MÍNIMO';
        if (factUsd >= 230000) {
          feeUsd = factUsd * 0.0130;
          alicuotaVal = 0.0130;
        } else if (factUsd >= 170000) {
          feeUsd = factUsd * 0.0163;
          alicuotaVal = 0.0163;
        } else if (factUsd >= 125000) {
          feeUsd = factUsd * 0.0195;
          alicuotaVal = 0.0195;
        } else if (factUsd >= 90000) {
          feeUsd = factUsd * 0.0228;
          alicuotaVal = 0.0228;
        } else if (factUsd >= 70000) {
          feeUsd = factUsd * 0.0244;
          alicuotaVal = 0.0244;
        } else if (factUsd >= 45000) {
          feeUsd = factUsd * 0.0276;
          alicuotaVal = 0.0276;
        } else if (factUsd >= 35000) {
          feeUsd = factUsd * 0.0293;
          alicuotaVal = 0.0293;
        } else {
          feeUsd = 1000.0;
          alicuotaVal = 'MÍNIMO';
        }

        montoServicio = Math.round(feeUsd * 100) / 100;
        subtotalVal = montoServicio;
        totalVal = montoServicio;
        feeVal = alicuotaVal;
      }

      // Soporte para Evacol Amazon USA (seller_id 918210724)
      // Facturación en USD -> Cruce con Escala USD (Mínimo $1.000 USD o 2,93% a 1,30%) -> Cobro en USD sin IVA
      if (sId === '918210724') {
        rowCurrency = 'USD';
        ivaVal = 0;
        const factUsd = factVal; // Ya está expresado en USD
        
        let feeUsd = 1000.0;
        let alicuotaVal: any = 'MÍNIMO';
        if (factUsd >= 230000) {
          feeUsd = factUsd * 0.0130;
          alicuotaVal = 0.0130;
        } else if (factUsd >= 170000) {
          feeUsd = factUsd * 0.0163;
          alicuotaVal = 0.0163;
        } else if (factUsd >= 125000) {
          feeUsd = factUsd * 0.0195;
          alicuotaVal = 0.0195;
        } else if (factUsd >= 90000) {
          feeUsd = factUsd * 0.0228;
          alicuotaVal = 0.0228;
        } else if (factUsd >= 70000) {
          feeUsd = factUsd * 0.0244;
          alicuotaVal = 0.0244;
        } else if (factUsd >= 45000) {
          feeUsd = factUsd * 0.0276;
          alicuotaVal = 0.0276;
        } else if (factUsd >= 35000) {
          feeUsd = factUsd * 0.0293;
          alicuotaVal = 0.0293;
        } else {
          feeUsd = 1000.0;
          alicuotaVal = 'MÍNIMO';
        }

        montoServicio = Math.round(feeUsd * 100) / 100;
        subtotalVal = montoServicio;
        totalVal = montoServicio;
        feeVal = alicuotaVal;
      }

      // Soporte para Evacol México ML (seller_id 807100133)
      // Facturación registrada en MXN. Se pasa a USD mediante el tipo de cambio del mes.
      // Se cruza el saldo en USD con la escala en USD sin IVA.
      // Si el saldo en USD no llega al mínimo de $35.000 USD, se aplica el fee mínimo de $1.000 USD.
      // Reply factura y cobra siempre en DÓLARES (USD), no se reconvierte a pesos mexicanos.
      // Cuentas de México: sin IVA (IVA = 0).
      if (sId === '807100133') {
        rowCurrency = 'USD';
        const tcMxnMap: Record<string, number> = {
          '2026-05': 16.70, '2026-06': 17.50, '2026-07': 17.80,
          '2026-08': 16.97, '2026-09': 18.07, '2026-10': 18.12,
          '2026-11': 18.18, '2026-12': 18.25, '2027-01': 18.32,
          '2027-02': 18.38, '2027-03': 18.45, '2027-04': 18.52,
          '2027-05': 18.58, '2027-06': 18.65, '2027-07': 18.72,
          '2027-08': 18.80, '2027-09': 18.90
        };
        const currentTc = tcMxnMap[mKey] || 18.12;
        // Facturación en MXN convertida a USD
        const gmvUsd = factVal / currentTc;

        let feeUsd = 1000.0;
        let alicuotaVal: any = 'MÍNIMO';
        if (gmvUsd >= 230000) {
          feeUsd = gmvUsd * 0.0130;
          alicuotaVal = 0.0130;
        } else if (gmvUsd >= 170000) {
          feeUsd = gmvUsd * 0.0163;
          alicuotaVal = 0.0163;
        } else if (gmvUsd >= 125000) {
          feeUsd = gmvUsd * 0.0195;
          alicuotaVal = 0.0195;
        } else if (gmvUsd >= 90000) {
          feeUsd = gmvUsd * 0.0228;
          alicuotaVal = 0.0228;
        } else if (gmvUsd >= 70000) {
          feeUsd = gmvUsd * 0.0244;
          alicuotaVal = 0.0244;
        } else if (gmvUsd >= 45000) {
          feeUsd = gmvUsd * 0.0276;
          alicuotaVal = 0.0276;
        } else if (gmvUsd >= 35000) {
          feeUsd = gmvUsd * 0.0293;
          alicuotaVal = 0.0293;
        } else {
          feeUsd = 1000.0;
          alicuotaVal = 'MÍNIMO';
        }

        // Reply factura y cobra en USD directamente
        const feeUsdFinal = Math.round(feeUsd * 100) / 100;
        montoServicio = feeUsdFinal;
        subtotalVal = feeUsdFinal;
        ivaVal = 0; // Cero IVA para cuentas de México
        totalVal = feeUsdFinal;
        feeVal = alicuotaVal;
      }

      const isProj = row.estado === 'PROYECTADO';

      countriesMap[cCode].sellersMap[sId].months[mKey] = {
        subtotal: subtotalVal,
        isProjected: isProj,
        estado: row.estado || 'REAL',
        moneda: rowCurrency,
        facturacion: factVal,
        fee: feeVal,
        botmaker: Number(row.botmaker) || 0,
        montoServicio: montoServicio,
        iva: ivaVal,
        total: totalVal
      };

      countriesMap[cCode].sellersMap[sId].totalRow += subtotalVal;
      countriesMap[cCode].monthlyTotals[mKey] = (countriesMap[cCode].monthlyTotals[mKey] || 0) + subtotalVal;
      countriesMap[cCode].grandTotal += subtotalVal;
    });

    return countriesMap;
  }, [rawLiquidaciones, sellersMap]);

  // Obtener el cliente seleccionado si existe
  const selectedSellerObj = useMemo(() => {
    if (!selectedSellerId) return null;
    return groupedData[selectedCountry]?.sellersMap[selectedSellerId] || null;
  }, [groupedData, selectedCountry, selectedSellerId]);

  // Datos para el Gráfico de Barras superior (según país o cliente seleccionado)
  const chartData = useMemo(() => {
    const activeCountryData = groupedData[selectedCountry];
    if (!activeCountryData) return [];

    return filteredMonths.map(m => {
      // Si hay un cliente seleccionado, usamos su subtotal; si no, el total del país
      const subtotal = selectedSellerObj 
        ? (selectedSellerObj.months[m.key]?.subtotal || 0)
        : (activeCountryData.monthlyTotals[m.key] || 0);
      
      // Top 3 clientes contribuyentes en este mes (solo si no hay un cliente individual)
      const sellerContributions = !selectedSellerObj 
        ? Object.values(activeCountryData.sellersMap)
            .map(s => ({
              name: s.name,
              amount: s.months[m.key]?.subtotal || 0
            }))
            .filter(s => s.amount > 0)
            .sort((a, b) => b.amount - a.amount)
        : [];

      return {
        key: m.key,
        label: m.shortLabel,
        fullLabel: m.label,
        isProjected: m.isProjected,
        subtotal: subtotal,
        isSellerSelected: !!selectedSellerObj,
        sellerName: selectedSellerObj?.name || null,
        activeSellersCount: sellerContributions.length,
        topSellers: sellerContributions.slice(0, 3)
      };
    });
  }, [groupedData, selectedCountry, filteredMonths, selectedSellerObj]);

  // Métricas ejecutivas en cards (dinámicas: cliente seleccionado o total país)
  const executiveKPIs = useMemo(() => {
    const activeCountryData = groupedData[selectedCountry];
    if (!activeCountryData) return null;

    // Último mes real
    const realMonths = monthsList.filter(m => !m.isProjected);
    const lastRealMonth = realMonths[realMonths.length - 1];
    const prevRealMonth = realMonths[realMonths.length - 2];

    const lastRealSubtotal = selectedSellerObj
      ? (selectedSellerObj.months[lastRealMonth?.key]?.subtotal || 0)
      : (lastRealMonth ? (activeCountryData.monthlyTotals[lastRealMonth.key] || 0) : 0);

    const prevRealSubtotal = selectedSellerObj
      ? (selectedSellerObj.months[prevRealMonth?.key]?.subtotal || 0)
      : (prevRealMonth ? (activeCountryData.monthlyTotals[prevRealMonth.key] || 0) : 0);

    let momGrowth = 0;
    if (prevRealSubtotal > 0 && lastRealMonth && prevRealMonth) {
      if (variationMode === 'diaria') {
        const curD = getDaysInMonth(lastRealMonth.key);
        const preD = getDaysInMonth(prevRealMonth.key);
        momGrowth = (((lastRealSubtotal / curD) - (prevRealSubtotal / preD)) / (prevRealSubtotal / preD)) * 100;
      } else {
        momGrowth = ((lastRealSubtotal - prevRealSubtotal) / prevRealSubtotal) * 100;
      }
    }

    // Mes en curso / primer mes proyectado
    const projMonths = monthsList.filter(m => m.isProjected);
    const firstProjMonth = projMonths[0];
    const firstProjSubtotal = selectedSellerObj
      ? (selectedSellerObj.months[firstProjMonth?.key]?.subtotal || 0)
      : (firstProjMonth ? (activeCountryData.monthlyTotals[firstProjMonth.key] || 0) : 0);

    // Promedio de meses reales
    let sumReal = 0;
    realMonths.forEach(m => {
      const val = selectedSellerObj 
        ? (selectedSellerObj.months[m.key]?.subtotal || 0)
        : (activeCountryData.monthlyTotals[m.key] || 0);
      sumReal += val;
    });
    const avgReal = realMonths.length > 0 ? sumReal / realMonths.length : 0;

    return {
      isSellerSelected: !!selectedSellerObj,
      sellerName: selectedSellerObj?.name || null,
      sellerTotalAccumulated: selectedSellerObj?.totalRow || 0,
      lastRealMonthName: lastRealMonth?.label || 'Último Real',
      lastRealSubtotal,
      momGrowth,
      variationMode,
      firstProjMonthName: firstProjMonth?.label || 'Proyección Octubre',
      firstProjSubtotal,
      avgReal,
      activeClientsCount: Object.keys(activeCountryData.sellersMap).length,
      currency: activeCountryData.country.currency
    };
  }, [groupedData, selectedCountry, monthsList, selectedSellerObj, variationMode]);

  // Tooltip personalizado para el gráfico de barras
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 min-w-[220px] text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-bold text-sm text-slate-100">{data.fullLabel}</span>
            {data.isProjected ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-[#ff5100] border border-orange-500/40">
                PROYECTADO
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-[#4981fb] border border-blue-500/40">
                REAL (CERRADO)
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                {data.isSellerSelected ? `Subtotal ${data.sellerName}:` : 'Ingreso Neto Reply:'}
              </span>
              <span className="font-extrabold text-sm text-emerald-400">
                {formatCurrency(data.subtotal, executiveKPIs?.currency)}
              </span>
            </div>
            {!data.isSellerSelected && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Clientes activos:</span>
                <span className="font-medium text-slate-200">{data.activeSellersCount}</span>
              </div>
            )}
          </div>
          {data.topSellers && data.topSellers.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Top Contribuyentes:</p>
              {data.topSellers.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-[11px] py-0.5 text-slate-300">
                  <span className="truncate max-w-[130px]">{item.name}</span>
                  <span className="font-semibold text-slate-100">{formatShortCurrency(item.amount, executiveKPIs?.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Lista ordenada de sellers para el país y filtro de búsqueda seleccionado
  const allSellers = useMemo(() => {
    return Object.values(groupedData[selectedCountry]?.sellersMap || {})
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groupedData, selectedCountry, searchTerm]);

  // Totales consolidados detallados por concepto para el país seleccionado
  const detailedCountryTotals = useMemo(() => {
    const result: Record<string, {
      gmv: number;
      montoServicio: number;
      botmaker: number;
      subtotal: number;
      iva: number;
      total: number;
    }> = {};

    filteredMonths.forEach(m => {
      let gmv = 0;
      let montoServicio = 0;
      let botmaker = 0;
      let subtotal = 0;
      let iva = 0;
      let total = 0;

      const sellers = Object.values(groupedData[selectedCountry]?.sellersMap || {});

      if (selectedCountry === 'CL') {
        const CHILE_CHANNEL_IDS = ['977559914', '942368053', '978106559', '919428720', '962651791', '936492429'];
        const totalCLP = CHILE_CHANNEL_IDS.reduce((sum, id) => sum + (newsanSubAccounts[id]?.[m.key] || 0), 0);
        const tc = getRateToUSD('CLP', m.key) || 950.0;
        const totalUSD = totalCLP / tc;
        const feeConsolidado = Math.max(4000.0, totalUSD * 0.01);

        gmv += totalUSD;
        montoServicio += feeConsolidado;
        subtotal += feeConsolidado;
        total += feeConsolidado;

        sellers.forEach(s => {
          if (!s.name.toLowerCase().includes('newsan')) {
            const mData = s.months[m.key];
            if (mData) {
              gmv += (mData.facturacion || 0) / tc;
              montoServicio += mData.montoServicio || 0;
              botmaker += mData.botmaker || 0;
              subtotal += mData.subtotal || 0;
              iva += mData.iva || 0;
              total += mData.total || 0;
            }
          }
        });
      } else if (selectedCountry === 'AR') {
        let hasNewsanARCalculated = false;
        sellers.forEach(s => {
          const isNewsan = s.name.toLowerCase().includes('newsan');
          if (isNewsan) {
            if (!hasNewsanARCalculated) {
              hasNewsanARCalculated = true;
              const mlSeller = sellers.find(x => x.name.toLowerCase().includes('mercado libre') || x.id === '256189964');
              const montoML = mlSeller?.months[m.key]?.montoServicio || 0;
              const factML = mlSeller?.months[m.key]?.facturacion || 0;
              const q = newsanMetricas[m.key]?.sesiones || 0;
              const hs = newsanMetricas[m.key]?.horas || 0;
              const tar = getNewsanWebTarifas(m.key);
              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
              const montoHs = hs * tar.valorHora;
              const subtotalNewsan = montoML + montoSes + montoHs;
              const totalConIVA = subtotalNewsan * 1.21;
              const ivaNewsan = subtotalNewsan * 0.21;

              gmv += factML;
              montoServicio += subtotalNewsan;
              subtotal += subtotalNewsan;
              iva += ivaNewsan;
              total += totalConIVA;
            }
          } else {
            const mData = s.months[m.key];
            if (mData) {
              gmv += mData.facturacion || 0;
              montoServicio += mData.montoServicio || 0;
              botmaker += mData.botmaker || 0;
              subtotal += mData.subtotal || 0;
              iva += mData.iva || 0;
              total += mData.total || 0;
            }
          }
        });
      } else {
        sellers.forEach(s => {
          const mData = s.months[m.key];
          if (mData) {
            gmv += mData.facturacion || 0;
            montoServicio += mData.montoServicio || 0;
            botmaker += mData.botmaker || 0;
            subtotal += mData.subtotal || 0;
            iva += mData.iva || 0;
            total += mData.total || 0;
          }
        });
      }

      result[m.key] = { gmv, montoServicio, botmaker, subtotal, iva, total };
    });

    return result;
  }, [filteredMonths, selectedCountry, groupedData, newsanSubAccounts, newsanMetricas]);

  return (
    <div className="space-y-6 pb-12 w-full h-full flex flex-col">
      {/* 1. Header con Títulos y Tabs de Navegación */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-[#4981fb] border border-blue-100">
                <Wallet size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Metas de Facturación & Liquidaciones</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Ingreso Efectivo Reply
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoreo y liquidación de honorarios de servicio (Subtotal neto sin IVA) por Seller y País
                </p>
              </div>
            </div>
          </div>

          {/* Selector de Vistas / Subsecciones */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 self-start md:self-auto">
            <button
              onClick={() => handleTabChange('subtotales')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'subtotales'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={15} className={activeTab === 'subtotales' ? 'text-[#ff5100]' : 'text-slate-400'} />
              <span>Resumen de Ingresos (Subtotales)</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-orange-100 text-[#ff5100] font-black">NUEVO</span>
            </button>
            <button
              onClick={() => handleTabChange('detallado')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'detallado'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table size={15} className={activeTab === 'detallado' ? 'text-[#4981fb]' : 'text-slate-400'} />
              <span>Detalle de Liquidación por Concepto</span>
            </button>
          </div>
        </div>

        {/* Banner Informativo Contable */}
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-orange-50/40 border border-blue-100/80 p-4 rounded-xl shadow-2xs text-xs text-slate-700 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-md bg-blue-500 text-white mt-0.5">
              <Sparkles size={14} />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Criterio Contable de Facturación Reply (Alineado con Finanzas)
              </p>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                El <span className="font-bold text-slate-900">Subtotal</span> refleja el ingreso genuino de Reply (Fee de Mercado Libre + Botmaker). El <span className="font-bold text-slate-900">IVA</span> constituye un débito fiscal que se transfiere íntegramente a las autoridades impositivas (ARCA / SAT) y no forma parte del revenue propio. Las columnas <span className="text-[#ff5100] font-bold">naranjas</span> representan meses proyectados con ajuste inflacionario (REM).
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-semibold text-slate-700">Calculando matriz de liquidaciones y proyecciones...</p>
          <p className="text-xs text-slate-400 mt-1">Consolidando escalas y registros históricos</p>
        </div>
      ) : (
        <div className="space-y-6 flex-1 flex flex-col">
          {/* ========================================================================= */}
          {/* BARRA DE CONTROLES: SEGMENTACIÓN POR MERCADO / PAÍS Y FILTROS TEMPORALES  */}
          {/* Disponible globalmente en ambas pestañas (Subtotales y Detallado)          */}
          {/* ========================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            {/* Segmentación por País / Moneda */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Globe size={13} />
                Mercado:
              </span>
              {availableCountries.map(c => {
                const isSelected = selectedCountry === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => handleCountryChange(c.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtros Temporales & Buscador */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Buscador de seller */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
                />
              </div>

              {/* Selector Temporal */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs">
                <button
                  onClick={() => setTimelineFilter('LAST_12')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    timelineFilter === 'LAST_12' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="6 meses reales hacia atrás + 6 meses proyectados hacia adelante"
                >
                  12 Meses (6+6)
                </button>
                <button
                  onClick={() => setTimelineFilter('2026')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    timelineFilter === '2026' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Año 2026
                </button>
                <button
                  onClick={() => setTimelineFilter('REAL_ONLY')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    timelineFilter === 'REAL_ONLY' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Solo Reales
                </button>
                <button
                  onClick={() => setTimelineFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    timelineFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todo
                </button>
              </div>

              {/* Selector de Variación % (solo para la pestaña subtotales) */}
              {activeTab === 'subtotales' && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs">
                  <span className="text-[11px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
                    <Percent size={11} className="text-blue-600" />
                    Variación:
                  </span>
                  <button
                    onClick={() => setVariationMode('mensual')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      variationMode === 'mensual' 
                        ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Variación Porcentual Mensual (MoM)"
                  >
                    % Mensual
                  </button>
                  <button
                    onClick={() => setVariationMode('diaria')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      variationMode === 'diaria' 
                        ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Variación diaria ponderada por cantidad de días en cada mes (Ritmo diario)"
                  >
                    % Diaria
                  </button>
                  <button
                    onClick={() => setVariationMode('none')}
                    className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      variationMode === 'none' 
                        ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Ocultar porcentajes de variación en la tabla"
                  >
                    Ocultar
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'subtotales' ? (
            /* ========================================================================= */
            /* PESTAÑA 1: NUEVA SUBSECCIÓN DE RESUMEN DE INGRESOS (SUBTOTALES)           */
            /* ========================================================================= */
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Banner de Cliente Seleccionado (Filtro Dinámico Interactivo) */}
              {selectedSellerObj && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-200/90 px-4 py-3 rounded-xl text-xs text-blue-900 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
                <span className="text-slate-600 font-medium">Filtrando por cliente seleccionado:</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-extrabold text-xs shadow-xs">
                  {selectedSellerObj.name}
                </span>
                <span className="text-blue-700 text-[11px] hidden md:inline">
                  (El gráfico de barras y las 4 tarjetas de KPI muestran exclusivamente los datos de esta cuenta)
                </span>
              </div>
              <button
                onClick={() => setSelectedSellerId(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/70 px-3 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
              >
                ✕ Deseleccionar / Ver Cartera General
              </button>
            </div>
          )}

          {/* Cards KPI Ejecutivas (Dinamizadas según cliente o cartera general) */}
          {executiveKPIs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Último Mes Real */}
              <div className={`p-4 rounded-xl border shadow-xs transition-all ${
                executiveKPIs.isSellerSelected ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Último Mes Real ({executiveKPIs.lastRealMonthName})
                  </span>
                  {executiveKPIs.isSellerSelected && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 uppercase">
                      Cuenta
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-extrabold text-slate-900">
                    {formatCurrency(executiveKPIs.lastRealSubtotal, executiveKPIs.currency)}
                  </span>
                  {executiveKPIs.momGrowth !== 0 && variationMode !== 'none' && (
                    <span className={`flex items-center text-xs font-bold ${
                      executiveKPIs.momGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {executiveKPIs.momGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {Math.abs(executiveKPIs.momGrowth).toFixed(1)}% {variationMode === 'diaria' ? 'Diario' : 'MoM'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block truncate">
                  {executiveKPIs.isSellerSelected 
                    ? `Honorario facturado a ${executiveKPIs.sellerName}`
                    : 'Ingreso de servicio efectivamente facturado'
                  }
                </span>
              </div>

              {/* Card 2: Forecast Proyectado */}
              <div className="bg-gradient-to-br from-orange-50/80 to-white p-4 rounded-xl border border-orange-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-orange-950 uppercase tracking-wider block">
                    Forecast {executiveKPIs.firstProjMonthName}
                  </span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-[#ff5100]">
                    PROYECTADO
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-orange-900">
                    {formatCurrency(executiveKPIs.firstProjSubtotal, executiveKPIs.currency)}
                  </span>
                </div>
                <span className="text-[10px] text-orange-800 mt-1 block truncate">
                  {executiveKPIs.isSellerSelected 
                    ? `Proyección estimada para ${executiveKPIs.sellerName}`
                    : 'Estimado en base a ritmo diario y REM'
                  }
                </span>
              </div>

              {/* Card 3: Promedio Mensual Real */}
              <div className={`p-4 rounded-xl border shadow-xs transition-all ${
                executiveKPIs.isSellerSelected ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200'
              }`}>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Promedio Mensual Real (YTD)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-extrabold text-blue-900">
                    {formatCurrency(executiveKPIs.avgReal, executiveKPIs.currency)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block truncate">
                  {executiveKPIs.isSellerSelected 
                    ? `Media mensual de ${executiveKPIs.sellerName}`
                    : 'Media de ingreso mensual cerrado'
                  }
                </span>
              </div>

              {/* Card 4: Dinámica (Total del Cliente o Clientes Activos) */}
              <div className={`p-4 rounded-xl border shadow-xs transition-all ${
                executiveKPIs.isSellerSelected ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200'
              }`}>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {executiveKPIs.isSellerSelected 
                    ? 'Total Acumulado en el Período'
                    : `Cuentas Activas (${groupedData[selectedCountry]?.country.name})`
                  }
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-extrabold text-slate-800">
                    {executiveKPIs.isSellerSelected
                      ? formatCurrency(executiveKPIs.sellerTotalAccumulated, executiveKPIs.currency)
                      : `${executiveKPIs.activeClientsCount} Clientes`
                    }
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block truncate">
                  {executiveKPIs.isSellerSelected 
                    ? `Suma total de honorarios de ${executiveKPIs.sellerName}`
                    : 'Generando honorarios en el mercado'
                  }
                </span>
              </div>
            </div>
          )}

          {/* Gráfico de Barras: Evolución del Subtotal Mes a Mes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#4981fb]" />
                  {executiveKPIs?.isSellerSelected ? (
                    <span>
                      Evolución Mensual de Ingresos — <span className="text-blue-600 font-extrabold">{executiveKPIs.sellerName}</span> ({groupedData[selectedCountry]?.country.currency})
                    </span>
                  ) : (
                    <span>
                      Evolución Mensual de Ingresos Reply (Subtotal Neto) — {groupedData[selectedCountry]?.country.flag} {groupedData[selectedCountry]?.country.name}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  {executiveKPIs?.isSellerSelected 
                    ? `Curva de honorarios netos históricos y proyectados exclusivos para la cuenta ${executiveKPIs.sellerName}`
                    : 'Comparativa de facturación real cerrada vs. meses proyectados futuros de la cartera'
                  }
                </p>
              </div>

              {/* Leyenda Gráfico */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#4981fb]"></span>
                  <span className="text-slate-600 font-medium">Real (Cerrado)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#ff5100]"></span>
                  <span className="text-orange-700 font-medium">Proyectado (Forecast)</span>
                </div>
              </div>
            </div>

            <div className="w-full h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => formatShortCurrency(val, executiveKPIs?.currency)}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="subtotal" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isProjected ? '#ff5100' : '#4981fb'} 
                        fillOpacity={entry.isProjected ? 0.9 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla de Clientes con Meses, Subtotales y Totales */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Matriz de Ingresos Netos por Cliente (Subtotales en {groupedData[selectedCountry]?.country.currency})
                    {selectedSellerObj && (
                      <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        Filtrando por {selectedSellerObj.name}
                      </span>
                    )}
                  </h3>
                  {variationMode !== 'none' && (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      Variación en celdas: <strong className="text-blue-600">{variationMode === 'diaria' ? '% Diaria (Ritmo)' : '% Mensual (MoM)'}</strong>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {selectedSellerObj 
                    ? `Fila resaltada. Haz clic en la fila o en el botón superior para volver a la vista general de la cartera.`
                    : `💡 Tip: Haz clic en cualquier cliente para filtrar dinámicamente el gráfico de barras y las tarjetas de arriba.`
                  }
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium self-start sm:self-auto">
                {Object.keys(groupedData[selectedCountry]?.sellersMap || {}).length} cuentas listadas
              </span>
            </div>

            {/* Banner comercial exclusivo para Chile */}
            {selectedCountry === 'CL' && (
              <div className="mx-4 my-3 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-800/60 rounded-xl text-2xl flex items-center justify-center shadow-inner">🇨🇱</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black tracking-wide text-white">Newsan Chile • Facturación Consolidada Multi-Canal</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                        6 Canales (Falabella, ML, Paris, Walmart, Ripley, Kitchen Center)
                      </span>
                    </div>
                    <p className="text-xs text-blue-200/90 mt-1 leading-relaxed max-w-3xl">
                      <strong>Criterio Comercial Contractual:</strong> Se suman las ventas brutas en Pesos Chilenos (CLP) de las 6 cuentas, se pasan a USD con el Tipo de Cambio oficial mensual y se cruza con la escala: si el 1% es menor a USD 4.000 se aplica el cargo mínimo garantizado de <strong>US$ 4.000</strong>; si da más, se cobra el 1%. Se factura y cobra en <strong>USD sin IVA</strong> (exportación de servicios a Chile).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-xs shrink-0">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold block">Mínimo Mensual</span>
                    <span className="text-sm font-black text-white">US$ 4.000,00</span>
                  </div>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold block">Moneda de Cobro</span>
                    <span className="text-sm font-black text-emerald-400">USD</span>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-xs">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-bold sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[220px]">
                      Cliente / Seller
                    </th>
                    {filteredMonths.map(m => (
                      <th 
                        key={m.key} 
                        scope="col" 
                        className={`px-3 py-3 font-bold text-right min-w-[115px] border-l ${
                          m.isProjected 
                            ? 'bg-orange-50/90 text-orange-950 border-orange-200/80' 
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-col items-end">
                          <span className="leading-tight">{m.shortLabel}</span>
                          <span className={`text-[9px] font-medium tracking-tight ${m.isProjected ? 'text-[#ff5100]' : 'text-slate-400'}`}>
                            {m.isProjected ? 'PROYECTADO' : 'REAL'}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3.5 font-bold text-right min-w-[130px] bg-slate-100/80 text-slate-800 border-l border-slate-200">
                      Total Acumulado
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Filas de Sellers del país seleccionado */}
                  {(() => {
                    if (selectedCountry === 'CL') {
                      const allCLSellers = Object.values(groupedData[selectedCountry]?.sellersMap || {})
                        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
                      
                      const newsanCLSellers = allCLSellers.filter(s => s.name.toLowerCase().includes('newsan'));
                      const otherCLSellers = allCLSellers.filter(s => !s.name.toLowerCase().includes('newsan'));

                      // Totales consolidados de Newsan Chile por mes
                      const newsanMonthlyTotals: Record<string, number> = {};
                      filteredMonths.forEach(m => {
                        newsanMonthlyTotals[m.key] = newsanCLSellers.reduce((sum, s) => sum + (s.months[m.key]?.subtotal || 0), 0);
                      });
                      const newsanGrandTotal = Object.values(newsanMonthlyTotals).reduce((sum, v) => sum + v, 0);

                      return (
                        <>
                          {/* FILA CONSOLIDADA NEWSAN CHILE */}
                          {newsanCLSellers.length > 0 && (
                            <tr 
                              className="bg-blue-50/70 hover:bg-blue-100/60 font-bold transition-all border-b-2 border-blue-200 cursor-pointer"
                              onClick={() => setNewsanChileExpanded(prev => !prev)}
                              title="Haz clic para colapsar o expandir el desglose por canal de Newsan Chile"
                            >
                              <td className="px-5 py-3 font-extrabold sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r bg-blue-50 text-blue-950 border-blue-200 whitespace-nowrap">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {newsanChileExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-blue-700 transition-transform" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-blue-700 transition-transform" />
                                    )}
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                    <span className="font-extrabold text-blue-950">Newsan Chile (Consolidado 6 Canales)</span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                                    OFICIAL • US$ 4.000/mes
                                  </span>
                                </div>
                              </td>

                              {filteredMonths.map(m => {
                                const val = newsanMonthlyTotals[m.key] || 0;
                                return (
                                  <td key={m.key} className="px-3 py-2 text-right whitespace-nowrap border-l border-blue-150 font-black text-blue-950">
                                    {val > 0 ? formatCurrency(val, 'USD') : '-'}
                                  </td>
                                );
                              })}

                              <td className="px-5 py-3 text-right font-black border-l whitespace-nowrap bg-blue-100/90 text-blue-950 border-blue-250">
                                {formatCurrency(newsanGrandTotal, 'USD')}
                              </td>
                            </tr>
                          )}

                          {/* SUB-FILAS INDIVIDUALES DE CANALES NEWSAN CHILE (SI EXPANDIDO) */}
                          {newsanChileExpanded && newsanCLSellers
                            .sort((a, b) => b.totalRow - a.totalRow)
                            .map(seller => {
                              const isRowSelected = selectedSellerId === seller.id;
                              return (
                                <tr 
                                  key={seller.id}
                                  onClick={() => setSelectedSellerId(prev => prev === seller.id ? null : seller.id)}
                                  className={`cursor-pointer transition-all ${
                                    isRowSelected 
                                      ? 'bg-blue-50/90 font-bold border-l-4 border-l-blue-600 shadow-xs' 
                                      : 'hover:bg-slate-50/80 transition-colors'
                                  }`}
                                >
                                  <td className={`px-5 py-2 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r whitespace-nowrap pl-9 transition-colors ${
                                    isRowSelected ? 'bg-blue-50 text-blue-950 border-blue-200 font-bold' : 'bg-white text-slate-700 border-slate-100'
                                  }`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        <span className="truncate max-w-[190px]">{seller.name}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-normal">Prorrateo</span>
                                    </div>
                                  </td>

                                  {filteredMonths.map(m => {
                                    const val = seller.months[m.key]?.subtotal || 0;
                                    return (
                                      <td key={m.key} className="px-3 py-2 text-right whitespace-nowrap border-l border-slate-100 text-slate-700 font-mono text-[11px]">
                                        {val > 0 ? formatCurrency(val, 'USD') : '-'}
                                      </td>
                                    );
                                  })}

                                  <td className="px-5 py-2 text-right font-semibold border-l whitespace-nowrap text-slate-800 bg-slate-50/40 border-slate-200 font-mono text-[11px]">
                                    {formatCurrency(seller.totalRow, 'USD')}
                                  </td>
                                </tr>
                              );
                            })}

                          {/* OTROS SELLERS DE CHILE (EJ. TRADEMEDICAL) */}
                          {otherCLSellers.map(seller => {
                            const isRowSelected = selectedSellerId === seller.id;
                            return (
                              <tr 
                                key={seller.id}
                                onClick={() => setSelectedSellerId(prev => prev === seller.id ? null : seller.id)}
                                className={`cursor-pointer transition-all ${
                                  isRowSelected 
                                    ? 'bg-blue-50/80 font-bold border-l-4 border-l-blue-600 shadow-xs' 
                                    : 'hover:bg-blue-50/40 transition-colors'
                                }`}
                              >
                                <td className={`px-5 py-3 font-semibold sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r whitespace-nowrap transition-colors ${
                                  isRowSelected 
                                    ? 'bg-blue-50 text-blue-950 border-blue-200' 
                                    : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-100'
                                }`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2.5 h-2.5 rounded-full ${seller.isBaja ? 'bg-rose-500' : 'bg-blue-400'}`}></span>
                                      <span className={`truncate max-w-[180px] ${seller.isBaja ? 'text-slate-500 line-through decoration-slate-300' : ''}`}>{seller.name}</span>
                                      {seller.isBaja && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                          BAJA
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {filteredMonths.map(m => {
                                  const val = seller.months[m.key]?.subtotal || 0;
                                  return (
                                    <td key={m.key} className="px-3 py-2 text-right whitespace-nowrap border-l border-slate-100 text-slate-800">
                                      {val > 0 ? formatCurrency(val, 'USD') : '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-5 py-3 text-right font-bold border-l whitespace-nowrap text-slate-900 bg-slate-50/50 border-slate-200">
                                  {formatCurrency(seller.totalRow, 'USD')}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    }

                    return Object.values(groupedData[selectedCountry]?.sellersMap || {})
                      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((seller) => {
                        const isRowSelected = selectedSellerId === seller.id;

                        return (
                          <tr 
                            key={seller.id} 
                            onClick={() => setSelectedSellerId(prev => prev === seller.id ? null : seller.id)}
                            title={`Haz clic para ${isRowSelected ? 'deseleccionar' : 'ver gráfico y métricas exclusivas de'} ${seller.name}`}
                            className={`cursor-pointer transition-all ${
                              isRowSelected 
                                ? 'bg-blue-50/80 font-bold border-l-4 border-l-blue-600 shadow-xs' 
                                : 'hover:bg-blue-50/40 transition-colors'
                            }`}
                          >
                            <td className={`px-5 py-3 font-semibold sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r whitespace-nowrap transition-colors ${
                              isRowSelected 
                                ? 'bg-blue-50 text-blue-950 border-blue-200' 
                                : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-100'
                            }`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                                    seller.isBaja
                                      ? 'bg-rose-500'
                                      : isRowSelected 
                                      ? 'bg-blue-600 ring-4 ring-blue-200 scale-110' 
                                      : 'bg-blue-400 group-hover:bg-blue-600'
                                  }`}></span>
                                  <span className={`truncate max-w-[180px] ${seller.isBaja ? 'text-slate-500 line-through decoration-slate-300' : ''}`}>{seller.name}</span>
                                  {seller.isBaja && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                      BAJA
                                    </span>
                                  )}
                                </div>
                                {isRowSelected && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white tracking-wider">
                                    ACTIVO
                                  </span>
                                )}
                              </div>
                            </td>

                            {filteredMonths.map(m => {
                              const monthData = seller.months[m.key];
                              const val = monthData?.subtotal || 0;
                              const isProj = m.isProjected;

                              // Mes cronológico anterior en monthsList para calcular variación
                              const curIdx = monthsList.findIndex(x => x.key === m.key);
                              const prevMonth = curIdx > 0 ? monthsList[curIdx - 1] : null;
                              const prevVal = prevMonth ? (seller.months[prevMonth.key]?.subtotal || 0) : 0;
                              const variation = calculateVariation(
                                val,
                                prevVal,
                                m.key,
                                prevMonth?.key || '',
                                variationMode
                              );

                              return (
                                <td 
                                  key={m.key} 
                                  className={`px-3 py-2 text-right whitespace-nowrap border-l ${
                                    isRowSelected
                                      ? isProj
                                        ? 'bg-orange-100/50 text-orange-950 border-orange-200/80 font-bold'
                                        : 'bg-blue-50/80 text-blue-950 border-blue-150 font-bold'
                                      : isProj 
                                        ? 'bg-orange-50/30 text-orange-950 border-orange-100 font-medium' 
                                        : 'border-slate-100 text-slate-800'
                                  }`}
                                >
                                  <div className="flex flex-col items-end justify-center">
                                    <span className="leading-tight">
                                      {val > 0 ? formatCurrency(val, monthData?.moneda || executiveKPIs?.currency) : '-'}
                                    </span>
                                    {variationMode !== 'none' && variation !== null && (
                                      <span 
                                        className={`text-[9.5px] font-bold leading-none mt-0.5 inline-flex items-center gap-0.5 ${
                                          variation >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        }`}
                                        title={`Variación ${variationMode === 'diaria' ? 'diaria ponderada' : 'mensual MoM'}: ${(variation * 100).toFixed(1)}%`}
                                      >
                                        <span>{variation >= 0 ? '▲' : '▼'}</span>
                                        <span>{Math.abs(variation * 100).toFixed(1)}%</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Total Acumulado del Seller */}
                            <td className={`px-5 py-3 text-right font-bold border-l whitespace-nowrap ${
                              isRowSelected 
                                ? 'bg-blue-100/80 text-blue-950 border-blue-250 font-black' 
                                : 'text-slate-900 bg-slate-50/50 border-slate-200'
                            }`}>
                              {formatCurrency(seller.totalRow, (seller.name.includes('Natura Colombia') || seller.name.includes('Disuiza') || seller.name.includes('ADDI') || seller.name.includes('Formex') || seller.name.includes('USA') || seller.name.includes('Amazon') || seller.name.includes('Newsan Chile') || selectedCountry === 'CL') ? 'USD' : executiveKPIs?.currency)}
                            </td>
                          </tr>
                        );
                      });
                  })()}

                  {/* Fila de SUBTOTAL DEL PAÍS */}
                  <tr className="bg-blue-50/90 border-t-2 border-b-2 border-blue-200 text-blue-950 font-bold sticky bottom-0 z-20 shadow-xs">
                    <td className="px-5 py-3.5 sticky left-0 bg-blue-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-blue-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{groupedData[selectedCountry]?.country.flag}</span>
                        <span className="text-xs uppercase tracking-wider font-extrabold">
                          Subtotal {groupedData[selectedCountry]?.country.name} ({groupedData[selectedCountry]?.country.currency})
                        </span>
                      </div>
                    </td>

                    {filteredMonths.map(m => {
                      const totalMonth = groupedData[selectedCountry]?.monthlyTotals[m.key] || 0;

                      // Mes cronológico anterior en monthsList para variación del subtotal de cartera
                      const curIdx = monthsList.findIndex(x => x.key === m.key);
                      const prevMonth = curIdx > 0 ? monthsList[curIdx - 1] : null;
                      const prevTotalMonth = prevMonth ? (groupedData[selectedCountry]?.monthlyTotals[prevMonth.key] || 0) : 0;
                      const subtotalVariation = calculateVariation(
                        totalMonth,
                        prevTotalMonth,
                        m.key,
                        prevMonth?.key || '',
                        variationMode
                      );

                      return (
                        <td 
                          key={m.key} 
                          className="px-3 py-2.5 text-right font-black border-l border-blue-200 whitespace-nowrap"
                        >
                          <div className="flex flex-col items-end justify-center">
                            <span className="leading-tight">
                              {formatCurrency(totalMonth, executiveKPIs?.currency)}
                            </span>
                            {variationMode !== 'none' && subtotalVariation !== null && (
                              <span 
                                className={`text-[9.5px] font-black leading-none mt-0.5 inline-flex items-center gap-0.5 ${
                                  subtotalVariation >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                                title={`Variación ${variationMode === 'diaria' ? 'diaria ponderada' : 'mensual MoM'} de cartera: ${(subtotalVariation * 100).toFixed(1)}%`}
                              >
                                <span>{subtotalVariation >= 0 ? '▲' : '▼'}</span>
                                <span>{Math.abs(subtotalVariation * 100).toFixed(1)}%</span>
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-5 py-3.5 text-right font-black text-sm bg-blue-100/90 text-blue-950 border-l border-blue-300 whitespace-nowrap">
                      {formatCurrency(groupedData[selectedCountry]?.grandTotal || 0, executiveKPIs?.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
            /* ========================================================================= */
            /* PESTAÑA 2: DETALLE COMPLETO POR CONCEPTO (VISTA DETALLADA ORIGINAL)       */
            /* ========================================================================= */
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Banner comercial exclusivo para Chile en Vista Detallada */}
              {selectedCountry === 'CL' && (
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-800/60 rounded-xl text-2xl flex items-center justify-center shadow-inner">🇨🇱</div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black tracking-wide text-white">Newsan Chile • Facturación Consolidada Multi-Canal</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                          6 Canales (Falabella, ML, Paris, Walmart, Ripley, Kitchen Center)
                        </span>
                      </div>
                      <p className="text-xs text-blue-200/90 mt-1 leading-relaxed max-w-3xl">
                        <strong>Criterio Comercial Contractual:</strong> Se suman las ventas brutas en Pesos Chilenos (CLP) de las 6 cuentas, se pasan a USD con el Tipo de Cambio oficial mensual y se cruza con la escala: si el 1% es menor a USD 4.000 se aplica el cargo mínimo garantizado de <strong>US$ 4.000</strong>; si da más, se cobra el 1%. Se factura y cobra en <strong>USD sin IVA</strong> (exportación de servicios a Chile).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-xs shrink-0">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold block">Mínimo Mensual</span>
                      <span className="text-sm font-black text-white">US$ 4.000,00</span>
                    </div>
                    <div className="h-8 w-px bg-white/20"></div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold block">Moneda de Cobro</span>
                      <span className="text-sm font-black text-emerald-400">USD</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Desglose Detallado por Cliente — {groupedData[selectedCountry]?.country.flag} {groupedData[selectedCountry]?.country.name} ({groupedData[selectedCountry]?.country.currency})</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Matriz vertical granular por cuenta para validación tributaria y contable
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium self-start sm:self-auto">
                    {allSellers.length} cuentas listadas en {groupedData[selectedCountry]?.country.name}
                  </span>
                </div>

            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-semibold sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">
                      Concepto
                    </th>
                    {filteredMonths.map(m => (
                      <th key={m.key} scope="col" className="px-6 py-4 font-semibold text-right min-w-[140px] uppercase border-l border-slate-100">
                        {m.shortLabel}
                      </th>
                    ))}
                  </tr>
                </thead>

                {(() => {
                  let hasRenderedNewsan = false;
                  let hasRenderedNewsanChile = false;
                  const allSellers = Object.values(groupedData[selectedCountry]?.sellersMap || {})
                    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name));

                  return allSellers.map((seller, sIdx) => {
                    const isNewsan = seller.name.toLowerCase().includes('newsan');
                    const isNewsanAR = isNewsan && (selectedCountry === 'AR' || seller.name.toLowerCase().includes('argentina') || seller.id === '256189964' || seller.id === '989595440');
                    const isNewsanCL = isNewsan && (selectedCountry === 'CL' || seller.name.toLowerCase().includes('chile'));

                    // =====================================================================
                    // A. BLOQUE MULTICANAL CONSOLIDADO NEWSAN CHILE (6 CUENTAS)
                    // =====================================================================
                    if (isNewsanCL) {
                      if (hasRenderedNewsanChile) return null;
                      hasRenderedNewsanChile = true;

                      const CHILE_CHANNELS = [
                        { id: '977559914', name: 'Newsan Falabella', platform: 'Falabella', color: 'bg-orange-500' },
                        { id: '942368053', name: 'Newsan Mercado Libre', platform: 'Mercado Libre', color: 'bg-yellow-500' },
                        { id: '978106559', name: 'Newsan Paris', platform: 'Paris (Cencosud)', color: 'bg-blue-500' },
                        { id: '919428720', name: 'Newsan Walmart', platform: 'Walmart / Lider', color: 'bg-sky-500' },
                        { id: '962651791', name: 'Newsan Ripley', platform: 'Ripley', color: 'bg-purple-500' },
                        { id: '936492429', name: 'Newsan Kitchen Center', platform: 'Kitchen Center', color: 'bg-emerald-500' },
                      ];

                      return (
                        <tbody key="newsan_chile_consolidado_group" className={`${sIdx > 0 ? 'border-t-8 border-slate-100' : ''}`}>
                          {/* 1. CABECERA GENERAL DE NEWSAN CHILE */}
                          <tr className="bg-blue-100/80 border-b border-blue-200">
                            <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-blue-100/95 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-extrabold text-blue-950 border-r border-blue-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                  <span className="text-xs uppercase tracking-wide font-black">Newsan Total (Chile)</span>
                                </div>
                                <span className="text-[10px] bg-blue-800 text-white font-bold px-2 py-0.5 rounded shadow-xs">
                                  Consolidado Oficial • 6 Canales
                                </span>
                              </div>
                            </td>
                            {filteredMonths.map(m => (
                              <td key={m.key} className="px-6 py-3 whitespace-nowrap text-right font-black text-blue-950 border-l border-blue-200/80 bg-blue-100/60">
                                Newsan Chile Total
                              </td>
                            ))}
                          </tr>

                          {/* 2. SECCIÓN VENTAS BRUTAS (GMV) POR CANAL EN CLP */}
                          <tr className="bg-slate-100/90 border-b border-slate-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 sticky left-0 bg-slate-100/95 z-10">
                              <div className="flex items-center justify-between">
                                <span>Facturación Bruta (GMV) por Canal — Pesos Chilenos (CLP)</span>
                                <span className="text-[9px] font-medium text-slate-500 lowercase">ventas brutas extraídas de canales</span>
                              </div>
                            </td>
                          </tr>

                          {CHILE_CHANNELS.map(ch => (
                            <tr key={ch.id} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                              <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${ch.color}`}></span>
                                  <span>{ch.name}</span>
                                </div>
                              </td>
                              {filteredMonths.map(m => {
                                const valCLP = newsanSubAccounts[ch.id]?.[m.key] || 0;
                                return (
                                  <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800 font-mono text-[11px]">
                                    {valCLP > 0 ? `$ ${Math.round(valCLP).toLocaleString('es-CL')} CLP` : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Facturación Total en CLP */}
                          <tr className="bg-slate-50 hover:bg-slate-100/60 transition-colors border-b-2 border-slate-300 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-900 font-bold">
                              Total Facturación Bruta (CLP)
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-slate-200 font-bold text-slate-900 font-mono text-[11px]">
                                  {totalCLP > 0 ? `$ ${Math.round(totalCLP).toLocaleString('es-CL')} CLP` : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* 3. SECCIÓN CONVERSIÓN A USD & TIPO DE CAMBIO */}
                          <tr className="bg-indigo-50/70 border-b border-indigo-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-2 font-bold text-[10px] uppercase tracking-wider text-indigo-950 sticky left-0 bg-indigo-50/95 z-10">
                              <div className="flex items-center justify-between">
                                <span>Conversión Multimoneda & Tipo de Cambio Oficial (CLP / USD)</span>
                                <span className="text-[9px] font-medium text-indigo-700 lowercase">cotización oficial mensual pactada</span>
                              </div>
                            </td>
                          </tr>

                          {/* Tipo de Cambio Oficial */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-indigo-900 font-semibold pl-9">
                              Tipo de Cambio Oficial (CLP / USD)
                            </td>
                            {filteredMonths.map(m => {
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-indigo-900 font-mono text-[11px] font-bold">
                                  {tc.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Desglose por canal en USD */}
                          {CHILE_CHANNELS.map(ch => (
                            <tr key={`usd_${ch.id}`} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                              <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                                <span>{ch.name} (USD)</span>
                              </td>
                              {filteredMonths.map(m => {
                                const valCLP = newsanSubAccounts[ch.id]?.[m.key] || 0;
                                const tc = getRateToUSD('CLP', m.key) || 950.0;
                                const valUSD = valCLP / tc;
                                const totalCLP = CHILE_CHANNELS.reduce((sum, c) => sum + (newsanSubAccounts[c.id]?.[m.key] || 0), 0);
                                const totalUSD = totalCLP / tc;
                                const share = totalUSD > 0 ? (valUSD / totalUSD) * 100 : 0;
                                return (
                                  <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                    <div className="flex flex-col items-end">
                                      <span className="font-mono text-[11px]">{valUSD > 0 ? `US$ ${valUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span>
                                      {valUSD > 0 && <span className="text-[9px] text-slate-400">({share.toFixed(1)}%)</span>}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Facturación Total en USD */}
                          <tr className="bg-indigo-50/40 hover:bg-indigo-50/60 transition-colors border-b-2 border-indigo-300 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-indigo-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-indigo-950 font-bold">
                              Facturación Total Consolidada (USD)
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              const totalUSD = totalCLP / tc;
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-indigo-200 font-black text-indigo-950 font-mono text-[11px]">
                                  {totalUSD > 0 ? `US$ ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* 4. SECCIÓN ESCALA COMERCIAL & FEE A COBRAR (USD) */}
                          <tr className="bg-emerald-50/80 border-b border-emerald-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-2 font-bold text-[10px] uppercase tracking-wider text-emerald-950 sticky left-0 bg-emerald-50/95 z-10">
                              <div className="flex items-center justify-between">
                                <span>Liquidación Comercial & Honorarios Reply (USD)</span>
                                <span className="text-[9px] font-medium text-emerald-700 lowercase">mínimo contractual US$ 4.000 o 1% s/ GMV en USD</span>
                              </div>
                            </td>
                          </tr>

                          {/* Cálculo 1% s/ GMV USD */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Cálculo Alícuota 1% s/ GMV en USD
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              const totalUSD = totalCLP / tc;
                              const fee1pct = totalUSD * 0.01;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-mono text-[11px] text-slate-700">
                                  {totalUSD > 0 ? `US$ ${fee1pct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Mínimo Contractual */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Mínimo Comercial Contractual
                            </td>
                            {filteredMonths.map(m => (
                              <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-mono text-[11px] text-slate-700">
                                US$ 4.000,00
                              </td>
                            ))}
                          </tr>

                          {/* Regla / Alícuota Aplicada */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-semibold pl-9">
                              Alícuota / Concepto Aplicado
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              const totalUSD = totalCLP / tc;
                              const fee1pct = totalUSD * 0.01;
                              const esMinimo = fee1pct < 4000.0;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-bold text-[11px]">
                                  <span className={`px-2 py-0.5 rounded text-[10px] ${esMinimo ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                                    {esMinimo ? 'MÍNIMO' : '1,00%'}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>

                          {/* Desglose de Fee Prorrateado por Canal */}
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-1.5 font-bold text-[9.5px] uppercase tracking-wider text-slate-600 sticky left-0 bg-slate-50/95 z-10 pl-9">
                              Prorrateo de Fee por Canal (según % de ventas brutas)
                            </td>
                          </tr>

                          {CHILE_CHANNELS.map(ch => (
                            <tr key={`fee_${ch.id}`} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                              <td className="px-6 py-1.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 text-xs pl-12">
                                <span>Fee {ch.name}</span>
                              </td>
                              {filteredMonths.map(m => {
                                const totalCLP = CHILE_CHANNELS.reduce((sum, c) => sum + (newsanSubAccounts[c.id]?.[m.key] || 0), 0);
                                const tc = getRateToUSD('CLP', m.key) || 950.0;
                                const totalUSD = totalCLP / tc;
                                const feeConsolidado = Math.max(4000.0, totalUSD * 0.01);
                                const valCLP = newsanSubAccounts[ch.id]?.[m.key] || 0;
                                const valUSD = valCLP / tc;
                                const feeShare = totalUSD > 0 ? (valUSD / totalUSD) * feeConsolidado : 0;
                                return (
                                  <td key={m.key} className="px-6 py-1.5 whitespace-nowrap text-right border-l border-slate-100 font-mono text-[11px] text-slate-700">
                                    {feeShare > 0 ? `US$ ${feeShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Subtotal Honorarios Reply */}
                          <tr className="bg-blue-100/70 hover:bg-blue-100 transition-colors border-b border-blue-200 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-blue-100/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-blue-950 text-xs font-black">
                              Subtotal Honorarios Reply (USD)
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              const totalUSD = totalCLP / tc;
                              const feeConsolidado = Math.max(4000.0, totalUSD * 0.01);
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-blue-200 font-black text-blue-950 font-mono text-[11px]">
                                  US$ {feeConsolidado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                          </tr>

                          {/* IVA Exportación (0%) */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-500 text-xs">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] font-medium">
                              IVA (0% Exento - Exportación de Servicios a Chile)
                            </td>
                            {filteredMonths.map(m => (
                              <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-mono text-[11px] text-slate-400">
                                US$ 0,00
                              </td>
                            ))}
                          </tr>

                          {/* Total Factura en USD */}
                          <tr className="bg-emerald-100/80 hover:bg-emerald-100 transition-colors border-b-2 border-emerald-300 font-black">
                            <td className="px-6 py-3.5 whitespace-nowrap sticky left-0 bg-emerald-100/95 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-emerald-950 font-black text-xs">
                              Total Factura a Cobrar (USD)
                            </td>
                            {filteredMonths.map(m => {
                              const totalCLP = CHILE_CHANNELS.reduce((sum, ch) => sum + (newsanSubAccounts[ch.id]?.[m.key] || 0), 0);
                              const tc = getRateToUSD('CLP', m.key) || 950.0;
                              const totalUSD = totalCLP / tc;
                              const feeConsolidado = Math.max(4000.0, totalUSD * 0.01);
                              return (
                                <td key={m.key} className="px-6 py-3.5 whitespace-nowrap text-right border-l border-emerald-300 font-black text-emerald-950 font-mono text-xs">
                                  US$ {feeConsolidado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      );
                    }

                    // =====================================================================
                    // B. BLOQUE NEWSAN ARGENTINA (ML + TIENDA WEB)
                    // =====================================================================
                    if (isNewsanAR) {
                      if (hasRenderedNewsan) return null;
                      hasRenderedNewsan = true;

                      const mlSeller = allSellers.find(s => s.name.toLowerCase().includes('mercado libre') || s.id === '256189964');
                      const webSeller = allSellers.find(s => s.name.toLowerCase().includes('tienda web') || s.id === '989595440');

                      return (
                        <tbody key="newsan_consolidado_group" className={`${sIdx > 0 ? 'border-t-8 border-slate-100' : ''}`}>
                          {/* ========================================================= */}
                          {/* 1. CABECERA GENERAL DE NEWSAN ARGENTINA                   */}
                          {/* ========================================================= */}
                          <tr className="bg-emerald-100/70 border-b border-emerald-200">
                            <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-emerald-100/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-extrabold text-emerald-950 border-r border-emerald-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                  <span className="text-xs uppercase tracking-wide font-black">Newsan Total (Argentina)</span>
                                </div>
                                <span className="text-[10px] bg-emerald-700 text-white font-bold px-2 py-0.5 rounded shadow-xs">
                                  Consolidado Oficial
                                </span>
                              </div>
                            </td>
                            {filteredMonths.map(m => (
                              <td key={m.key} className="px-6 py-3 whitespace-nowrap text-right font-black text-emerald-950 border-l border-emerald-200/80 bg-emerald-100/60">
                                Newsan Total
                              </td>
                            ))}
                          </tr>

                          {/* ========================================================= */}
                          {/* 2. SECCIÓN MERCADO LIBRE                                  */}
                          {/* ========================================================= */}
                          <tr className="bg-slate-100/80 border-b border-slate-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-700 sticky left-0 bg-slate-100/95 z-10">
                              Mercado Libre (Facturación por Cuentas)
                            </td>
                          </tr>

                          {/* Cuenta Newsan Propia */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                              Newsan
                            </td>
                            {filteredMonths.map(m => {
                              const mDataML = mlSeller?.months[m.key];
                              const totalML = mDataML?.facturacion || 0;
                              const motoML = newsanSubAccounts['308973138']?.[m.key] || 0;
                              const piliML = newsanSubAccounts['256324891']?.[m.key] || 0;
                              const newsanPropio = Math.max(0, totalML - motoML - piliML);
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {newsanPropio > 0 ? formatCurrency(newsanPropio, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Cuenta Newsan Motorola */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                              Newsan Motorola
                            </td>
                            {filteredMonths.map(m => {
                              const motoML = newsanSubAccounts['308973138']?.[m.key] || 0;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {motoML > 0 ? formatCurrency(motoML, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Cuenta Pilisar */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                              Pilisar
                            </td>
                            {filteredMonths.map(m => {
                              const piliML = newsanSubAccounts['256324891']?.[m.key] || 0;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {piliML > 0 ? formatCurrency(piliML, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Facturación Total ML */}
                          <tr className="bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors border-b border-slate-200 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-emerald-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-900 font-bold">
                              Facturación total (Mercado Libre)
                            </td>
                            {filteredMonths.map(m => {
                              const totalML = mlSeller?.months[m.key]?.facturacion || 0;
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-slate-100 font-bold text-slate-900">
                                  {totalML > 0 ? formatCurrency(totalML, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Fee ML Aplicado */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium">
                              Fee Aplicado ML
                            </td>
                            {filteredMonths.map(m => {
                              const feeML = mlSeller?.months[m.key]?.fee;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-semibold text-blue-600">
                                  {feeML ? formatPercent(feeML) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Monto Servicio ML */}
                          <tr className="bg-blue-50/40 hover:bg-blue-50/60 transition-colors border-b border-blue-200 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-blue-50/80 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-blue-950 font-bold">
                              Monto Servicio ML
                            </td>
                            {filteredMonths.map(m => {
                              const montoML = mlSeller?.months[m.key]?.montoServicio || 0;
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-blue-100 font-bold text-blue-900">
                                  {montoML > 0 ? formatCurrency(montoML, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* ========================================================= */}
                          {/* 3. SECCIÓN TIENDA NEWSAN (WEB)                             */}
                          {/* ========================================================= */}
                          <tr className="bg-slate-100/80 border-b border-slate-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-700 sticky left-0 bg-slate-100/95 z-10">
                              Tienda Newsan (Soporte Operativo Web)
                            </td>
                          </tr>

                          {/* Cantidad Sesiones */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Cantidad Sesiones
                            </td>
                            {filteredMonths.map(m => {
                              const q = newsanMetricas[m.key]?.sesiones;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800 font-medium">
                                  {q ? q.toLocaleString('es-AR') : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Valor x Sesión */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Valor x Sesión
                            </td>
                            {filteredMonths.map(m => {
                              const tar = getNewsanWebTarifas(m.key);
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {tar.valorSesion > 0 ? formatCurrency(tar.valorSesion, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Total Sesiones */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                              Total Sesiones (Cantidad × Tarifa)
                            </td>
                            {filteredMonths.map(m => {
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const tot = q * tar.valorSesion;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {tot > 0 ? formatCurrency(tot, executiveKPIs?.currency) : '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Minimo Garantizado */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-semibold pl-9">
                              Mínimo Garantizado Mensual
                            </td>
                            {filteredMonths.map(m => {
                              const tar = getNewsanWebTarifas(m.key);
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800 font-semibold">
                                  {formatCurrency(tar.minGarantizado, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* ========================================================= */}
                          {/* 4. SECCIÓN HORAS EXTRAS                                   */}
                          {/* ========================================================= */}
                          <tr className="bg-slate-100/80 border-b border-slate-200">
                            <td colSpan={filteredMonths.length + 1} className="px-6 py-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-700 sticky left-0 bg-slate-100/95 z-10">
                              Horas Extras
                            </td>
                          </tr>

                          {/* Cantidad de horas */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Cantidad de horas extras
                            </td>
                            {filteredMonths.map(m => {
                              const hs = newsanMetricas[m.key]?.horas ?? 0;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800 font-medium">
                                  {hs > 0 ? `${hs} hs` : '0,00 hs'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Valor Hora */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium pl-9">
                              Valor Hora
                            </td>
                            {filteredMonths.map(m => {
                              const tar = getNewsanWebTarifas(m.key);
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {formatCurrency(tar.valorHora, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Total Horas Extra */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-700 font-medium pl-9">
                              Total Horas Extra (Horas × Tarifa)
                            </td>
                            {filteredMonths.map(m => {
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const totHs = hs * tar.valorHora;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800">
                                  {totHs > 0 ? formatCurrency(totHs, executiveKPIs?.currency) : '$ 0'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* ========================================================= */}
                          {/* 5. LIQUIDACIÓN TIENDA WEB                                  */}
                          {/* ========================================================= */}
                          <tr className="bg-slate-50/70 border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-slate-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-800 font-semibold pl-9">
                              Newsan - Sesiones (Aplica Mínimo)
                            </td>
                            {filteredMonths.map(m => {
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-900 font-semibold">
                                  {formatCurrency(montoSes, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-slate-50/70 border-b border-slate-100">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-slate-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-800 font-medium pl-9">
                              Monto Horas Extra
                            </td>
                            {filteredMonths.map(m => {
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const totHs = hs * tar.valorHora;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 text-slate-800 font-medium">
                                  {totHs > 0 ? formatCurrency(totHs, executiveKPIs?.currency) : '$ 0'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Monto Factura Tienda */}
                          <tr className="bg-blue-50/50 hover:bg-blue-50/70 transition-colors border-b border-blue-200 font-bold">
                            <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-blue-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-blue-950 font-bold">
                              Monto factura - Tienda Web
                            </td>
                            {filteredMonths.map(m => {
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
                              const montoHs = hs * tar.valorHora;
                              const montoTienda = montoSes + montoHs;
                              return (
                                <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-blue-100 font-bold text-blue-900">
                                  {formatCurrency(montoTienda, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* ========================================================= */}
                          {/* 6. CONSOLIDADO FINAL REPLY                                 */}
                          {/* ========================================================= */}
                          {/* Subtotal Reply */}
                          <tr className="bg-blue-100/80 hover:bg-blue-100 transition-colors border-b border-blue-200 font-black">
                            <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-blue-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-blue-950 text-xs">
                              Total (Subtotal Ingreso Reply)
                            </td>
                            {filteredMonths.map(m => {
                              const montoML = mlSeller?.months[m.key]?.montoServicio || 0;
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
                              const montoHs = hs * tar.valorHora;
                              const subtotalNewsan = montoML + montoSes + montoHs;
                              return (
                                <td key={m.key} className="px-6 py-3 whitespace-nowrap text-right border-l border-blue-200 font-black text-blue-950 text-xs">
                                  {formatCurrency(subtotalNewsan, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* IVA (21%) */}
                          <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-600">
                            <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] font-medium">
                              IVA (21% Débito Fiscal)
                            </td>
                            {filteredMonths.map(m => {
                              const montoML = mlSeller?.months[m.key]?.montoServicio || 0;
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
                              const montoHs = hs * tar.valorHora;
                              const subtotalNewsan = montoML + montoSes + montoHs;
                              const ivaNewsan = subtotalNewsan * 0.21;
                              return (
                                <td key={m.key} className="px-6 py-2 whitespace-nowrap text-right border-l border-slate-100 font-medium text-slate-700">
                                  {formatCurrency(ivaNewsan, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Total Factura + IVA */}
                          <tr className="bg-emerald-50/60 hover:bg-emerald-50/80 transition-colors border-b-2 border-emerald-300 font-black">
                            <td className="px-6 py-3.5 whitespace-nowrap sticky left-0 bg-emerald-50/95 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-emerald-950 font-black text-xs">
                              Total Factura + IVA
                            </td>
                            {filteredMonths.map(m => {
                              const montoML = mlSeller?.months[m.key]?.montoServicio || 0;
                              const q = newsanMetricas[m.key]?.sesiones || 0;
                              const hs = newsanMetricas[m.key]?.horas || 0;
                              const tar = getNewsanWebTarifas(m.key);
                              const montoSes = Math.max(q * tar.valorSesion, tar.minGarantizado);
                              const montoHs = hs * tar.valorHora;
                              const subtotalNewsan = montoML + montoSes + montoHs;
                              const totalConIVA = subtotalNewsan * 1.21;
                              return (
                                <td key={m.key} className="px-6 py-3.5 whitespace-nowrap text-right border-l border-emerald-200 font-black text-emerald-950 text-xs">
                                  {formatCurrency(totalConIVA, executiveKPIs?.currency)}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      );
                    }

                    // Renderizado estándar para los demás sellers (Pinturas Online, etc.)
                    return (
                      <tbody key={seller.id} className={`${sIdx > 0 ? 'border-t-8 border-slate-100' : ''}`}>
                        {/* Fila Cliente */}
                        <tr className="bg-orange-50/60">
                          <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-orange-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-slate-900 border-r border-orange-100">
                            {seller.name}
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            return (
                              <td key={m.key} className={`px-6 py-3 whitespace-nowrap text-right font-bold border-l ${isProj ? 'bg-orange-100/50 text-orange-950 border-orange-200' : 'bg-orange-50/40 text-slate-900 border-orange-100'}`}>
                                {seller.name}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Facturación Cliente (GMV) */}
                        <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium">
                            Ventas del Cliente (GMV)
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            const isMex = seller.name.includes('México') || selectedCountry === 'MX';
                            const isChl = seller.name.includes('Chile') || selectedCountry === 'CL';
                            const isCol = !isMex && (seller.name.includes('Colombia') || seller.name.includes('Disuiza') || seller.name.includes('Formex') || seller.name.includes('Natura') || (seller.name.includes('Evacol') && !seller.name.includes('USA')));
                            const gmvCurrency = isMex ? 'MXN' : (isCol ? 'COP' : (isChl ? 'CLP' : executiveKPIs?.currency));
                            return (
                              <td key={m.key} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProj ? 'bg-orange-50/30 border-orange-100 text-orange-950' : 'border-slate-100 text-slate-800'}`}>
                                {mData ? (isChl ? `$ ${Math.round(mData.facturacion).toLocaleString('es-CL')} CLP` : formatCurrency(mData.facturacion, gmvCurrency)) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Fee */}
                        <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-slate-600 font-medium">
                            Fee Aplicado
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            return (
                              <td key={m.key} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProj ? 'bg-orange-50/30 border-orange-100 text-orange-950' : 'border-slate-100 text-slate-800'}`}>
                                {mData ? formatPercent(mData.fee) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Monto Servicio */}
                        <tr className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors border-b border-slate-100">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-slate-800 font-bold">
                            Monto Servicio
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            const cur = mData?.moneda || executiveKPIs?.currency;
                            return (
                              <td key={m.key} className={`px-6 py-2.5 whitespace-nowrap text-right font-semibold border-l ${isProj ? 'bg-orange-100/40 border-orange-100 text-orange-950' : 'border-slate-100 text-slate-900'}`}>
                                {mData ? formatCurrency(mData.montoServicio, cur) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Botmaker */}
                        <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-slate-600 font-medium">
                            Botmaker
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            const cur = mData?.moneda || executiveKPIs?.currency;
                            return (
                              <td key={m.key} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProj ? 'bg-orange-50/30 border-orange-100 text-orange-950' : 'border-slate-100 text-slate-600'}`}>
                                {mData && mData.botmaker > 0 ? formatCurrency(mData.botmaker, cur) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Subtotal (Ingreso Reply) */}
                        <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-b border-blue-100 font-bold">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-blue-50/80 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-blue-950">
                            Subtotal (Ingreso Reply)
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            const cur = mData?.moneda || executiveKPIs?.currency;
                            return (
                              <td key={m.key} className={`px-6 py-2.5 whitespace-nowrap text-right font-bold border-l ${isProj ? 'bg-orange-100/50 border-orange-200 text-orange-950' : 'border-blue-100 text-blue-900'}`}>
                                {mData ? formatCurrency(mData.subtotal, cur) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila IVA */}
                        <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-500">
                          <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            IVA (Débito Fiscal)
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const cur = mData?.moneda || executiveKPIs?.currency;
                            return (
                              <td key={m.key} className="px-6 py-2.5 whitespace-nowrap text-right border-l border-slate-100">
                                {mData ? formatCurrency(mData.iva, cur) : '-'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Fila Total Factura */}
                        <tr className="bg-emerald-50/40 hover:bg-emerald-50/60 transition-colors">
                          <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-emerald-50/80 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-emerald-950 font-bold border-r border-emerald-100">
                            Total Factura
                          </td>
                          {filteredMonths.map(m => {
                            const mData = seller.months[m.key];
                            const isProj = mData?.isProjected;
                            const cur = mData?.moneda || executiveKPIs?.currency;
                            return (
                              <td key={m.key} className={`px-6 py-3 whitespace-nowrap text-right font-black border-l ${isProj ? 'bg-orange-100/50 text-orange-950 border-orange-200' : 'border-emerald-100 text-emerald-900'}`}>
                                {mData ? formatCurrency(mData.total, cur) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    );
                  });
                })()}

                {/* ========================================================= */}
                {/* PIE DE TABLA CONSOLIDADO: DESGLOSE DE LIQUIDACIÓN COMPLETO */}
                {/* ========================================================= */}
                <tfoot className="sticky bottom-0 z-20 shadow-xl border-t-2 border-slate-300">
                  {/* Fila Total GMV */}
                  <tr className="bg-slate-100 text-slate-700 font-bold text-xs border-b border-slate-200">
                    <td className="px-6 py-2.5 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      TOTAL VENTAS DE LA CARTERA (GMV {selectedCountry === 'CL' ? 'USD' : groupedData[selectedCountry]?.country.currency})
                    </td>
                    {filteredMonths.map(m => (
                      <td key={m.key} className="px-6 py-2.5 text-right font-mono border-l border-slate-200 whitespace-nowrap">
                        {formatCurrency(detailedCountryTotals[m.key]?.gmv || 0, executiveKPIs?.currency)}
                      </td>
                    ))}
                  </tr>

                  {/* Fila Total Monto Servicio */}
                  <tr className="bg-slate-50 text-slate-800 font-bold text-xs border-b border-slate-200">
                    <td className="px-6 py-2.5 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      TOTAL MONTO SERVICIO (FEE DE GESTIÓN)
                    </td>
                    {filteredMonths.map(m => (
                      <td key={m.key} className="px-6 py-2.5 text-right font-mono border-l border-slate-200 whitespace-nowrap text-blue-900">
                        {formatCurrency(detailedCountryTotals[m.key]?.montoServicio || 0, executiveKPIs?.currency)}
                      </td>
                    ))}
                  </tr>

                  {/* Fila Total Botmaker (si hay en el país) */}
                  {Object.values(detailedCountryTotals).some(t => t.botmaker > 0) && (
                    <tr className="bg-white text-slate-700 font-medium text-xs border-b border-slate-200">
                      <td className="px-6 py-2 sticky left-0 bg-white z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        TOTAL BOTMAKER (LICENCIAS)
                      </td>
                      {filteredMonths.map(m => (
                        <td key={m.key} className="px-6 py-2 text-right font-mono border-l border-slate-200 whitespace-nowrap">
                          {detailedCountryTotals[m.key]?.botmaker > 0 ? formatCurrency(detailedCountryTotals[m.key]?.botmaker, executiveKPIs?.currency) : '-'}
                        </td>
                      ))}
                    </tr>
                  )}

                  {/* Fila Total Subtotal (Ingreso Genuino Reply) */}
                  <tr className="bg-blue-900 text-white font-black text-xs shadow-md">
                    <td className="px-6 py-3.5 sticky left-0 bg-blue-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>TOTAL INGRESO NETO REPLY (SUBTOTAL)</span>
                      </div>
                    </td>
                    {filteredMonths.map(m => (
                      <td key={m.key} className="px-6 py-3.5 text-right font-mono font-black border-l border-blue-800 whitespace-nowrap text-emerald-400 text-xs">
                        {formatCurrency(detailedCountryTotals[m.key]?.subtotal || 0, executiveKPIs?.currency)}
                      </td>
                    ))}
                  </tr>

                  {/* Fila Total IVA */}
                  <tr className="bg-slate-100 text-slate-600 font-semibold text-xs border-b border-slate-200">
                    <td className="px-6 py-2.5 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      TOTAL IVA (DÉBITO FISCAL)
                    </td>
                    {filteredMonths.map(m => (
                      <td key={m.key} className="px-6 py-2.5 text-right font-mono border-l border-slate-200 whitespace-nowrap text-slate-500">
                        {formatCurrency(detailedCountryTotals[m.key]?.iva || 0, executiveKPIs?.currency)}
                      </td>
                    ))}
                  </tr>

                  {/* Fila Total Factura Final */}
                  <tr className="bg-slate-900 text-white font-extrabold text-xs">
                    <td className="px-6 py-3.5 sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                      TOTAL GENERAL FACTURACIÓN A COBRAR
                    </td>
                    {filteredMonths.map(m => (
                      <td key={m.key} className="px-6 py-3.5 text-right font-mono font-black border-l border-slate-800 whitespace-nowrap text-white text-xs">
                        {formatCurrency(detailedCountryTotals[m.key]?.total || 0, executiveKPIs?.currency)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</div>
);
}

export default function MetasFacturacionPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex-1 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-700">Cargando Metas de Facturación...</p>
      </div>
    }>
      <MetasFacturacionContent />
    </Suspense>
  );
}

