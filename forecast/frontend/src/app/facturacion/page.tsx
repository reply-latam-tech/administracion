'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart as LucideBarChart, 
  Globe, 
  DollarSign, 
  Coins, 
  Filter, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  Building2, 
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell, 
  ReferenceLine 
} from 'recharts';
import { convertCurrency, formatMoney, getRateToUSD } from '@/lib/exchangeRates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuración de metadatos por país
interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  defaultCurrency: string;
}

const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'AR': { code: 'AR', name: 'Argentina', flag: '🇦🇷', defaultCurrency: 'ARS' },
  'CO': { code: 'CO', name: 'Colombia', flag: '🇨🇴', defaultCurrency: 'COP' },
  'CL': { code: 'CL', name: 'Chile', flag: '🇨🇱', defaultCurrency: 'CLP' },
  'MX': { code: 'MX', name: 'México', flag: '🇲🇽', defaultCurrency: 'MXN' },
  'US': { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', defaultCurrency: 'USD' },
};

function getCountryCode(seller: any): string {
  const p = (seller.codigo_pais || seller.pais || '').toUpperCase().trim();
  if (p === 'CO' || p.includes('COLOMBIA')) return 'CO';
  if (p === 'CL' || p.includes('CHILE')) return 'CL';
  if (p === 'MX' || p.includes('MEXICO') || p.includes('MÉXICO')) return 'MX';
  if (p === 'US' || p === 'USA' || p.includes('ESTADOS UNIDOS')) return 'US';
  return 'AR';
}

function getDefaultCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CONFIG[countryCode]?.defaultCurrency || 'ARS';
}

export default function FacturacionPage() {
  // Datos crudos de Supabase
  const [rawSellers, setRawSellers] = useState<any[]>([]);
  const [rawFacturacion, setRawFacturacion] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de control y visualización
  // 'USD' = Unificado en Dólares (estándar para comparar sin distorsión)
  // 'ORIGINAL' = Moneda local original de cada cuenta (ARS, COP, CLP, MXN, USD)
  // 'ARS' = Unificado en Pesos Argentinos
  const [currencyView, setCurrencyView] = useState<'USD' | 'ORIGINAL' | 'ARS'>('USD');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('ALL');
  const [variationType, setVariationType] = useState<'monthly' | 'yearly'>('monthly');
  const [valueType, setValueType] = useState<'absolute' | 'relative'>('absolute');
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCountries, setCollapsedCountries] = useState<Record<string, boolean>>({});

  // Estacionalidad
  const [estMensual, setEstMensual] = useState<any[]>([]);
  const [estDiaria, setEstDiaria] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: sellersData, error: errSellers } = await supabase
          .from('dim_sellers')
          .select('*');

        if (errSellers) console.error('Error sellers:', errSellers);

        const { data: factData, error: errFact } = await supabase
          .from('facturacion')
          .select('*')
          .order('periodo', { ascending: true });

        if (errFact) console.error('Error facturacion:', errFact);

        const { data: estMensualData } = await supabase.from('estacionalidad_mensual').select('*');
        const { data: estDiariaData } = await supabase.from('estacionalidad_diaria').select('*');

        setRawSellers(sellersData || []);
        setRawFacturacion(factData || []);
        setEstMensual(estMensualData || []);
        setEstDiaria(estDiariaData || []);
      } catch (err) {
        console.error('Error global cargando datos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Formato de nombre de mes para columnas y tooltips
  const formatMonthStr = (p: string) => {
    const d = new Date(p + "T12:00:00");
    let mStr = d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
    return mStr.charAt(0).toUpperCase() + mStr.slice(1);
  };

  // Mapeo de sellers y cálculo multimoneda reactivo
  const processedData = useMemo(() => {
    const sellersMap: Record<string, any> = {};
    rawSellers.forEach((s: any) => {
      const cCode = getCountryCode(s);
      const moneda = s.moneda || getDefaultCurrencyForCountry(cCode);
      sellersMap[s.id_seller] = {
        id: s.id_seller,
        name: s.nombre_seller,
        pais: cCode,
        moneda: moneda,
        estado: s.estado
      };
    });

    const periodosSet = new Set<string>();
    const rawMap: Record<string, Record<string, number>> = {};
    const rawStateMap: Record<string, Record<string, string>> = {};

    rawFacturacion.forEach((row: any) => {
      periodosSet.add(row.periodo);
      const sId = String(row.seller_id);
      if (!rawMap[sId]) rawMap[sId] = {};
      if (!rawStateMap[sId]) rawStateMap[sId] = {};
      rawMap[sId][row.periodo] = Number(row.valor_facturado) || 0;
      rawStateMap[sId][row.periodo] = row.estado || 'REAL';
    });

    const sortedPeriodos = Array.from(periodosSet).sort();

    // Determinar moneda de salida para un seller
    const getTargetCurrency = (sellerMoneda: string) => {
      if (currencyView === 'ORIGINAL') return sellerMoneda;
      return currencyView; // 'USD' o 'ARS'
    };

    // Estructurar sellers con sus valores convertidos
    const sellersGroups: Record<string, any> = {};

    Object.keys(sellersMap).forEach(sId => {
      const sInfo = sellersMap[sId];
      const targetCur = getTargetCurrency(sInfo.moneda);

      const sObj = {
        sellerId: sId,
        sellerName: sInfo.name,
        countryCode: sInfo.pais,
        countryName: COUNTRY_CONFIG[sInfo.pais]?.name || sInfo.pais,
        countryFlag: COUNTRY_CONFIG[sInfo.pais]?.flag || '🏳️',
        monedaOrigen: sInfo.moneda,
        monedaDisplay: targetCur,
        months: {} as Record<string, any>,
        maxVal: 1,
        totalPeriodos: 0
      };

      let prevVal = 0;
      let maxVal = 0;

      sortedPeriodos.forEach(p => {
        const rawVal = rawMap[sId]?.[p];
        if (rawVal !== undefined && rawVal !== null) {
          // Conversión de moneda
          const displayVal = convertCurrency(rawVal, sInfo.moneda, targetCur, p);
          if (displayVal > maxVal) maxVal = displayVal;
          sObj.totalPeriodos += displayVal;

          // Variación mensual
          const varM = prevVal > 0 ? (displayVal - prevVal) / prevVal : 0;

          // Variación anual (YoY)
          const date = new Date(p + "T12:00:00");
          date.setFullYear(date.getFullYear() - 1);
          const prevYearP = date.toISOString().split('T')[0];
          const rawPrevYearVal = rawMap[sId]?.[prevYearP];
          let varA = 0;
          if (rawPrevYearVal && rawPrevYearVal > 0) {
            const displayPrevYearVal = convertCurrency(rawPrevYearVal, sInfo.moneda, targetCur, prevYearP);
            varA = displayPrevYearVal > 0 ? (displayVal - displayPrevYearVal) / displayPrevYearVal : 0;
          }

          sObj.months[p] = {
            rawValor: rawVal,
            valor: displayVal,
            variacion_mensual: varM,
            variacion_anual: varA,
            estado: rawStateMap[sId]?.[p] || 'REAL',
            moneda: targetCur
          };

          prevVal = displayVal;
        } else {
          prevVal = 0;
        }
      });

      sObj.maxVal = Math.max(maxVal, 1);
      sellersGroups[sId] = sObj;
    });

    // Agrupar por país
    const countriesData: Record<string, {
      country: CountryConfig;
      sellers: any[];
      monthlyTotals: Record<string, number>;
      monthlyVarM: Record<string, number>;
      grandTotal: number;
    }> = {};

    Object.values(COUNTRY_CONFIG).forEach(c => {
      countriesData[c.code] = {
        country: c,
        sellers: [],
        monthlyTotals: {},
        monthlyVarM: {},
        grandTotal: 0
      };
    });

    Object.values(sellersGroups).forEach(seller => {
      if (countriesData[seller.countryCode]) {
        countriesData[seller.countryCode].sellers.push(seller);
      }
    });

    // Calcular subtotales por país
    Object.keys(countriesData).forEach(cCode => {
      const cData = countriesData[cCode];
      cData.sellers.sort((a, b) => a.sellerName.localeCompare(b.sellerName));

      let prevSubtotal = 0;
      sortedPeriodos.forEach(p => {
        let monthSubtotal = 0;
        cData.sellers.forEach(s => {
          const mCell = s.months[p];
          if (mCell && mCell.valor) {
            monthSubtotal += mCell.valor;
          }
        });
        cData.monthlyTotals[p] = monthSubtotal;
        cData.grandTotal += monthSubtotal;

        if (prevSubtotal > 0 && monthSubtotal > 0) {
          cData.monthlyVarM[p] = (monthSubtotal - prevSubtotal) / prevSubtotal;
        } else {
          cData.monthlyVarM[p] = 0;
        }
        prevSubtotal = monthSubtotal;
      });
    });

    // Totales Globales Consolidados (en la moneda seleccionada, o forzada a USD si es ORIGINAL)
    const globalCurrency = currencyView === 'ORIGINAL' ? 'USD' : currencyView;
    const globalMonthlyTotals: Record<string, number> = {};
    const globalMonthlyVarM: Record<string, number> = {};
    let globalGrandTotal = 0;

    let prevGlobalTotal = 0;
    sortedPeriodos.forEach(p => {
      let mTotal = 0;
      Object.values(sellersGroups).forEach(s => {
        const rawVal = rawMap[s.sellerId]?.[p];
        if (rawVal) {
          const valInGlobal = convertCurrency(rawVal, s.monedaOrigen, globalCurrency, p);
          mTotal += valInGlobal;
        }
      });
      globalMonthlyTotals[p] = mTotal;
      globalGrandTotal += mTotal;

      if (prevGlobalTotal > 0 && mTotal > 0) {
        globalMonthlyVarM[p] = (mTotal - prevGlobalTotal) / prevGlobalTotal;
      } else {
        globalMonthlyVarM[p] = 0;
      }
      prevGlobalTotal = mTotal;
    });

    // Construir dataset para el gráfico apilado
    // Si hay un país seleccionado en el filtro rápido, graficamos los sellers de ese país; sino todos
    const chartSellersList = Object.values(sellersGroups).filter(s => {
      if (selectedCountryFilter !== 'ALL' && s.countryCode !== selectedCountryFilter) return false;
      if (searchTerm.trim() && !s.sellerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });

    const chartDataset: any[] = [];
    const chartSellerNames = new Set<string>();

    sortedPeriodos.forEach(p => {
      const mStr = formatMonthStr(p);
      const rowItem: any = { name: mStr, periodo: p, total: 0 };

      chartSellersList.forEach(s => {
        chartSellerNames.add(s.sellerName);
        const cell = s.months[p];
        const val = cell ? cell.valor : 0;
        rowItem[s.sellerName] = val;
        rowItem.total += val;
        rowItem[`${s.sellerName}_varM`] = cell ? cell.variacion_mensual : 0;
        rowItem[`${s.sellerName}_varA`] = cell ? cell.variacion_anual : 0;
        rowItem[`${s.sellerName}_estado`] = cell ? cell.estado : 'REAL';
        rowItem[`${s.sellerName}_moneda`] = s.monedaDisplay;
      });

      chartDataset.push(rowItem);
    });

    // Calcular variaciones en chartData
    for (let i = 0; i < chartDataset.length; i++) {
      if (i > 0) {
        const prevT = chartDataset[i - 1].total;
        chartDataset[i].total_varM = prevT ? (chartDataset[i].total - prevT) / prevT : 0;
      } else {
        chartDataset[i].total_varM = 0;
      }

      const d = new Date(chartDataset[i].periodo + "T12:00:00");
      d.setFullYear(d.getFullYear() - 1);
      const prevYearStr = d.toISOString().split('T')[0];
      const prevYearRow = chartDataset.find(c => c.periodo === prevYearStr);
      if (prevYearRow && prevYearRow.total) {
        chartDataset[i].total_varA = (chartDataset[i].total - prevYearRow.total) / prevYearRow.total;
      } else {
        chartDataset[i].total_varA = 0;
      }
    }

    return {
      sortedPeriodos,
      sellersGroups,
      countriesData,
      globalMonthlyTotals,
      globalMonthlyVarM,
      globalGrandTotal,
      globalCurrency,
      chartDataset,
      chartSellerNames: Array.from(chartSellerNames)
    };
  }, [rawSellers, rawFacturacion, currencyView, selectedCountryFilter, searchTerm]);

  // Alternar colapsado de país
  const toggleCountryCollapse = (countryCode: string) => {
    setCollapsedCountries(prev => ({
      ...prev,
      [countryCode]: !prev[countryCode]
    }));
  };

  // KPIs superiores consolidados
  const kpiHighlights = useMemo(() => {
    const { chartDataset, countriesData, globalCurrency } = processedData;
    if (!chartDataset || chartDataset.length === 0) return null;

    // Buscar último mes con facturación real
    const realMonths = chartDataset.filter(r => r.periodo <= '2026-09-01');
    const latestMonth = realMonths.length > 0 ? realMonths[realMonths.length - 1] : chartDataset[chartDataset.length - 1];

    // País con mayor facturación acumulada
    let topCountry = { name: 'Argentina', flag: '🇦🇷', total: 0 };
    Object.values(countriesData).forEach(c => {
      if (c.grandTotal > topCountry.total) {
        topCountry = { name: c.country.name, flag: c.country.flag, total: c.grandTotal };
      }
    });

    // Seller con mayor facturación en el último mes
    let topSeller = { name: '-', valor: 0 };
    if (latestMonth) {
      Object.keys(latestMonth).forEach(k => {
        if (!['name', 'periodo', 'total', 'total_varM', 'total_varA'].includes(k) && !k.includes('_')) {
          const v = latestMonth[k];
          if (v > topSeller.valor) {
            topSeller = { name: k, valor: v };
          }
        }
      });
    }

    return {
      latestMonthName: latestMonth?.name || '-',
      latestMonthTotal: latestMonth?.total || 0,
      latestMonthVar: latestMonth?.total_varM || 0,
      topCountry,
      topSeller,
      currency: currencyView === 'ORIGINAL' && selectedCountryFilter !== 'ALL' 
        ? (COUNTRY_CONFIG[selectedCountryFilter]?.defaultCurrency || 'USD')
        : globalCurrency
    };
  }, [processedData, currencyView, selectedCountryFilter]);

  // Tooltip personalizado para el gráfico
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rowData = payload[0].payload;
      const total = rowData.total;
      const totalVar = variationType === 'monthly' ? rowData.total_varM : rowData.total_varA;

      const activeEntries = payload
        .filter((entry: any) => entry.value && entry.value > 0)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

      const TOP_LIMIT = 8;
      const hasOthers = activeEntries.length > TOP_LIMIT;
      const displayedEntries = hasOthers ? activeEntries.slice(0, TOP_LIMIT) : activeEntries;
      const remainingEntries = hasOthers ? activeEntries.slice(TOP_LIMIT) : [];

      const othersTotalValue = remainingEntries.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
      const othersPercentage = total > 0 ? (othersTotalValue / total) * 100 : 0;

      const tooltipCurrency = currencyView === 'ORIGINAL' && selectedCountryFilter !== 'ALL'
        ? (COUNTRY_CONFIG[selectedCountryFilter]?.defaultCurrency || 'USD')
        : (currencyView === 'ORIGINAL' ? 'USD' : currencyView);

      return (
        <div className="bg-white/98 backdrop-blur-md p-4 rounded-xl shadow-[0_12px_32px_-5px_rgba(0,0,0,0.18)] border border-slate-200 text-xs min-w-[300px] max-w-[360px] z-50 pointer-events-none">
          <div className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900">{label}</span>
              <span className="text-[11px] font-normal text-slate-400">
                ({activeEntries.length} {activeEntries.length === 1 ? 'cliente' : 'clientes'})
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {tooltipCurrency} Unificado
            </span>
          </div>

          <div className="space-y-1.5 mb-2.5 max-h-[280px] overflow-y-auto pr-1">
            {displayedEntries.map((entry: any, index: number) => {
              const varValue = rowData[`${entry.name}_var${variationType === 'monthly' ? 'M' : 'A'}`];
              const percentage = total > 0 ? (entry.value / total) * 100 : 0;
              return (
                <div key={index} className="flex justify-between items-center gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-700 font-medium truncate text-xs" title={entry.name}>
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="font-bold text-slate-900 leading-tight block text-xs">
                        {formatMoney(entry.value, tooltipCurrency)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium leading-none block">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-12 text-right">
                      {varValue !== 0 && varValue != null ? (
                        <span className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                          varValue > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                        }`}>
                          {varValue > 0 ? '+' : ''}{(varValue * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-mono">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasOthers && (
              <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-dashed border-slate-200">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                  <span className="text-slate-500 font-semibold italic truncate text-xs">
                    Otros ({remainingEntries.length} clientes)
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-bold text-slate-700 leading-tight block text-xs">
                      {formatMoney(othersTotalValue, tooltipCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-none block">
                      {othersPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-12 text-right">
                    <span className="text-[10px] text-slate-400 font-mono">—</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-2 flex justify-between items-center bg-slate-50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl">
            <span className="font-bold text-slate-800 text-xs">Total Consolidado</span>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-xs sm:text-sm">
                {formatMoney(total, tooltipCurrency)}
              </span>
              {totalVar !== 0 && totalVar != null ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  totalVar > 0 ? 'text-emerald-700 bg-emerald-100/80' : 'text-rose-600 bg-rose-100/80'
                }`}>
                  {totalVar > 0 ? '+' : ''}{(totalVar * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] text-slate-300 font-mono">—</span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Gráficos de estacionalidad calculados
  const { chartMensual, chartDOW, chartDOM } = useMemo(() => {
    let mData: any[] = [];
    let dowData: any[] = [];
    let domData: any[] = [];

    const dows = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    let selectedId: any = null;
    if (selectedSeller) {
      const sObj = Object.values(processedData.sellersGroups).find((r: any) => r.sellerName === selectedSeller);
      if (sObj) selectedId = sObj.sellerId;
    }

    for (let i = 1; i <= 12; i++) {
      let val = 1.0;
      const arr = estMensual.filter(e => e.mes === i && (!selectedId || String(e.seller_id) === String(selectedId)));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      mData.push({ name: meses[i - 1], value: val });
    }

    for (let i = 1; i <= 7; i++) {
      let val = 1.0;
      const arr = estDiaria.filter(e => e.tipo === 'DIA_SEMANA' && e.llave === i && (!selectedId || String(e.seller_id) === String(selectedId)));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      dowData.push({ name: dows[i - 1], value: val });
    }

    for (let i = 1; i <= 31; i++) {
      let val = 1.0;
      const arr = estDiaria.filter(e => e.tipo === 'DIA_MES' && e.llave === i && (!selectedId || String(e.seller_id) === String(selectedId)));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      domData.push({ name: String(i), value: val });
    }

    return { chartMensual: mData, chartDOW: dowData, chartDOM: domData };
  }, [estMensual, estDiaria, selectedSeller, processedData.sellersGroups]);

  const avgDOW = chartDOW.length ? chartDOW.reduce((a, b) => a + b.value, 0) / chartDOW.length : 1;
  const avgDOM = chartDOM.length ? chartDOM.reduce((a, b) => a + b.value, 0) / chartDOM.length : 1;
  const avgMensual = chartMensual.length ? chartMensual.reduce((a, b) => a + b.value, 0) / chartMensual.length : 1;

  // Lista de países a mostrar según el filtro rápido
  const countriesToDisplay = useMemo(() => {
    const list = Object.keys(processedData.countriesData).filter(cCode => {
      if (selectedCountryFilter !== 'ALL' && cCode !== selectedCountryFilter) return false;
      const cObj = processedData.countriesData[cCode];
      // Si hay término de búsqueda, filtrar si tiene sellers coincidentes
      if (searchTerm.trim()) {
        const matches = cObj.sellers.some(s => s.sellerName.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matches) return false;
      }
      return cObj.sellers.length > 0;
    });
    return list;
  }, [processedData.countriesData, selectedCountryFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12 w-full h-full overflow-y-auto flex flex-col pr-2">
      {/* 1. Header con Controles de Moneda y Variación */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row justify-between lg:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Ventas del Cliente (GMV)</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 border border-blue-200/60 flex items-center gap-1">
              <Globe size={12} /> Multimoneda & Segmentado
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Historial de facturación bruta mensual con opción de unificación cambiaria y segmentación por país.
          </p>
        </div>

        {/* Controles Principales */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Moneda Unificada */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <Coins size={13} className="text-blue-500" /> Moneda:
            </span>
            <button
              onClick={() => setCurrencyView('USD')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                currencyView === 'USD'
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-100 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Unificar todas las cuentas a dólares estadounidenses según el tipo de cambio oficial de cada mes"
            >
              <span>💵 USD (Unificado)</span>
            </button>
            <button
              onClick={() => setCurrencyView('ORIGINAL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                currencyView === 'ORIGINAL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visualizar cada cliente en su moneda nativa (ARS, COP, CLP, MXN, USD)"
            >
              <span>🪙 Moneda Origen</span>
            </button>
            <button
              onClick={() => setCurrencyView('ARS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                currencyView === 'ARS'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Unificar todas las cuentas a pesos argentinos"
            >
              <span>🇦🇷 ARS</span>
            </button>
          </div>

          {/* Selector de Tipo de Valor (Absoluto / Relativo) */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setValueType('absolute')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                valueType === 'absolute' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Absoluto ($)
            </button>
            <button
              onClick={() => setValueType('relative')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                valueType === 'relative' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Relativo (%)
            </button>
          </div>

          {/* Selector de Variación (Mensual / Anual) */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setVariationType('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                variationType === 'monthly' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Var. Mensual
            </button>
            <button
              onClick={() => setVariationType('yearly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                variationType === 'yearly' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Var. Anual
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards de Resumen */}
      {kpiHighlights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                GMV Último Mes Real ({kpiHighlights.latestMonthName})
              </p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {formatMoney(kpiHighlights.latestMonthTotal, kpiHighlights.currency, true)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {kpiHighlights.latestMonthVar !== 0 ? (
                  <span className={`text-[11px] font-bold flex items-center ${kpiHighlights.latestMonthVar > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {kpiHighlights.latestMonthVar > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {kpiHighlights.latestMonthVar > 0 ? '+' : ''}{(kpiHighlights.latestMonthVar * 100).toFixed(1)}% MoM
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Estable</span>
                )}
                <span className="text-[10px] text-slate-400">vs mes anterior</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                País Líder en Ventas
              </p>
              <p className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                <span>{kpiHighlights.topCountry.flag}</span>
                <span>{kpiHighlights.topCountry.name}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Volumen acumulado: <strong className="text-slate-800">{formatMoney(kpiHighlights.topCountry.total, kpiHighlights.currency, true)}</strong>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Globe size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Seller Top Volúmen
              </p>
              <p className="text-xl font-black text-slate-900 mt-0.5 truncate max-w-[180px]" title={kpiHighlights.topSeller.name}>
                {kpiHighlights.topSeller.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Último mes: <strong className="text-slate-800">{formatMoney(kpiHighlights.topSeller.valor, kpiHighlights.currency, true)}</strong>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Cuentas Activas Con Facturación
              </p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {Object.keys(processedData.sellersGroups).length} Sellers
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Segmentados en <strong>5 países</strong>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Layers size={20} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Filtro Rápido de País y Búsqueda */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Pills de Países */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCountryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedCountryFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>🌐 Todos los Países ({Object.keys(processedData.sellersGroups).length})</span>
          </button>
          {Object.values(COUNTRY_CONFIG).map(c => {
            const count = processedData.countriesData[c.code]?.sellers.length || 0;
            const isSelected = selectedCountryFilter === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setSelectedCountryFilter(c.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200/70 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input de Búsqueda */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente o seller..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Gráfico: Evolución de Facturación por Seller (Moneda Unificada) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Evolución de Facturación por Seller</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                {currencyView === 'ORIGINAL' && selectedCountryFilter !== 'ALL'
                  ? `Moneda: ${COUNTRY_CONFIG[selectedCountryFilter]?.defaultCurrency}`
                  : `Unificado en: ${processedData.globalCurrency}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedSeller 
                ? `Visualizando únicamente: ${selectedSeller}`
                : `Composición mensual con valores convertidos a escala unificada para análisis real.`}
            </p>
          </div>
          {selectedSeller && (
            <button
              onClick={() => setSelectedSeller(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>✕ Ver todos los clientes</span>
            </button>
          )}
        </div>

        <div className="h-[380px] w-full">
          {loading ? (
             <div className="animate-pulse w-full h-full bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 text-xs">
               Cargando gráfico...
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={processedData.chartDataset} 
                margin={{ top: 10, right: 15, left: 10, bottom: 25 }} 
                stackOffset={valueType === 'relative' ? 'expand' : 'none'}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  tickFormatter={(value) => {
                    if (valueType === 'relative') return `${(value * 100).toFixed(0)}%`;
                    const cur = currencyView === 'ORIGINAL' && selectedCountryFilter !== 'ALL'
                      ? (COUNTRY_CONFIG[selectedCountryFilter]?.defaultCurrency || 'USD')
                      : processedData.globalCurrency;
                    return formatMoney(value, cur, true);
                  }} 
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'rgba(73, 129, 251, 0.05)' }} 
                  wrapperStyle={{ zIndex: 50 }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '16px', color: '#64748B' }} 
                />
                {processedData.chartSellerNames.filter(name => !selectedSeller || name === selectedSeller).map((name, index) => {
                  const colors = [
                    '#4981FB', '#FF5100', '#10B981', '#F59E0B', '#8B5CF6', 
                    '#06B6D4', '#EC4899', '#14B8A6', '#6366F1', '#F97316', 
                    '#84CC16', '#A855F7', '#3B82F6', '#E11D48', '#0EA5E9', '#D97706'
                  ];
                  const color = colors[index % colors.length];
                  return (
                    <Bar key={name} dataKey={name} stackId="a" fill={color}>
                      {processedData.chartDataset.map((entry, idx) => {
                         const isProjected = entry[`${name}_estado`] === 'PROYECTADO';
                         return (
                           <Cell 
                             key={`cell-${idx}`} 
                             fill={isProjected ? 'transparent' : color} 
                             stroke={color} 
                             strokeDasharray={isProjected ? "4 4" : undefined}
                             strokeWidth={isProjected ? 2 : 0} 
                           />
                         );
                      })}
                    </Bar>
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 5. Tabla de Facturación Segmentada por País */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex-1 flex flex-col min-h-[460px] shrink-0">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              Detalle Segmentado por País
            </h3>
            <p className="text-xs text-slate-500">
              {currencyView === 'USD' 
                ? 'Moneda de visualización: USD (Unificada con tipos de cambio mensuales oficiales).'
                : currencyView === 'ORIGINAL'
                ? 'Moneda de visualización: Moneda local nativa de cada cliente.'
                : 'Moneda de visualización: ARS (Unificada en Pesos Argentinos).'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">
              Mostrando {countriesToDisplay.length} {countriesToDisplay.length === 1 ? 'país' : 'países'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold min-w-[240px] sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200">
                  Seller / Cliente
                </th>
                {processedData.sortedPeriodos.map((p) => (
                  <th key={p} scope="col" className="px-4 py-3 font-medium text-right whitespace-nowrap min-w-[140px] border-l border-slate-100">
                    {formatMonthStr(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={processedData.sortedPeriodos.length + 1} className="px-6 py-16 text-center text-slate-400">
                    <div className="animate-pulse flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Cargando matriz de facturación segmentada...</span>
                    </div>
                  </td>
                </tr>
              ) : countriesToDisplay.length === 0 ? (
                <tr>
                  <td colSpan={processedData.sortedPeriodos.length + 1} className="px-6 py-12 text-center text-slate-400 text-xs">
                    No se encontraron clientes para el filtro o término de búsqueda ingresado.
                  </td>
                </tr>
              ) : (
                countriesToDisplay.map((cCode) => {
                  const countryGroup = processedData.countriesData[cCode];
                  const isCollapsed = !!collapsedCountries[cCode];
                  const sellersList = countryGroup.sellers.filter(s => {
                    if (searchTerm.trim() && !s.sellerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                    return true;
                  });

                  return (
                    <tbody key={cCode} className="border-b-4 border-slate-100/90">
                      {/* Fila Encabezado de País (Colapsable) */}
                      <tr 
                        onClick={() => toggleCountryCollapse(cCode)}
                        className="bg-slate-100/80 hover:bg-slate-200/70 cursor-pointer transition-colors border-y border-slate-200 select-none"
                      >
                        <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200 font-bold text-slate-900">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                              <span className="text-base">{countryGroup.country.flag}</span>
                              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                                {countryGroup.country.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                                {sellersList.length} {sellersList.length === 1 ? 'seller' : 'sellers'}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              Moneda: {currencyView === 'ORIGINAL' ? countryGroup.country.defaultCurrency : currencyView}
                            </span>
                          </div>
                        </td>

                        {/* Totales Mensuales del País en el Encabezado */}
                        {processedData.sortedPeriodos.map(p => {
                          const subtotalVal = countryGroup.monthlyTotals[p] || 0;
                          const varM = countryGroup.monthlyVarM[p] || 0;
                          const cCur = currencyView === 'ORIGINAL' ? countryGroup.country.defaultCurrency : currencyView;
                          return (
                            <td key={p} className="px-4 py-2.5 text-right font-extrabold text-slate-900 border-l border-slate-200/80 whitespace-nowrap bg-slate-100/50">
                              <div className="text-xs">
                                {subtotalVal > 0 ? formatMoney(subtotalVal, cCur) : '-'}
                              </div>
                              {varM !== 0 && subtotalVal > 0 && (
                                <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${varM > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {varM > 0 ? '+' : ''}{(varM * 100).toFixed(1)}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Filas de Sellers del País */}
                      {!isCollapsed && sellersList.map((row: any) => {
                        const isSelected = selectedSeller === row.sellerName;
                        return (
                          <tr 
                            key={row.sellerId} 
                            onClick={() => setSelectedSeller(isSelected ? null : row.sellerName)}
                            className={`border-b border-slate-100 transition-colors group cursor-pointer ${
                              isSelected ? 'bg-blue-50/90' : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            <td className={`px-4 py-3 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-100 ${
                              isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-slate-50'
                            }`}>
                              <div className="flex items-center gap-2 pl-4">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 text-[13px] group-hover:text-blue-700 transition-colors">
                                    {row.sellerName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                                    <span>ID: {row.sellerId}</span>
                                    <span>•</span>
                                    <span>Origen: {row.monedaOrigen}</span>
                                    {currencyView !== 'ORIGINAL' && (
                                      <span className="text-blue-600 font-bold">→ Mostrado en {currencyView}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            {processedData.sortedPeriodos.map((p) => {
                              const cellData = row.months[p];
                              
                              if (!cellData || !cellData.valor) {
                                return (
                                  <td key={p} className="px-4 py-3 text-right border-l border-slate-100">
                                    <span className="text-slate-300 font-mono">-</span>
                                  </td>
                                );
                              }

                              const val = cellData.valor;
                              const variation = variationType === 'monthly' ? cellData.variacion_mensual : cellData.variacion_anual;
                              const barWidth = Math.min((val / row.maxVal) * 100, 100);
                              const isProjected = cellData.estado === 'PROYECTADO';

                              return (
                                <td key={p} className={`px-4 py-3 text-right border-l border-slate-100 relative ${isProjected ? 'bg-orange-50/25' : ''}`}>
                                  {isProjected && (
                                     <div className="absolute top-0 right-0 mt-1 mr-1 flex">
                                       <span className="relative flex h-1.5 w-1.5">
                                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                         <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                                       </span>
                                     </div>
                                  )}
                                  <div className={`font-semibold text-[13px] mb-0.5 ${isProjected ? 'text-orange-950 font-bold' : 'text-slate-800'}`}>
                                     {formatMoney(val, row.monedaDisplay)}
                                     {isProjected && <span className="ml-1 text-[8px] text-orange-600 font-bold uppercase" title="Dato proyectado">*PROY</span>}
                                  </div>
                                  
                                  <div className="h-3 flex items-center justify-end">
                                    {variation !== null && variation !== 0 ? (
                                      <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${variation > 0 ? (isProjected ? 'text-orange-600' : 'text-emerald-600') : 'text-rose-500'}`}>
                                        {variation > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                        {(Math.abs(variation) * 100).toFixed(1)}%
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 font-mono">-</span>
                                    )}
                                  </div>
                                  
                                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden flex justify-end">
                                    <div 
                                      className={`${isProjected ? 'bg-orange-400' : 'bg-blue-500'} h-1 rounded-full transition-all duration-500`} 
                                      style={{ width: `${barWidth}%` }}
                                    ></div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })
              )}

              {/* Fila de TOTAL GLOBAL CONSOLIDADO */}
              {!loading && countriesToDisplay.length > 0 && (
                <tr className="bg-blue-50/90 border-t-2 border-b-2 border-blue-200 text-blue-950 font-black sticky bottom-0 z-20 shadow-xs">
                  <td className="px-5 py-3.5 sticky left-0 bg-blue-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-blue-200 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Globe size={18} className="text-blue-700" />
                      <span className="text-xs uppercase tracking-wider font-black text-blue-950">
                        TOTAL GLOBAL CONSOLIDADO ({processedData.globalCurrency})
                      </span>
                    </div>
                  </td>

                  {processedData.sortedPeriodos.map(p => {
                    const totalMonth = processedData.globalMonthlyTotals[p] || 0;
                    const varM = processedData.globalMonthlyVarM[p] || 0;
                    return (
                      <td key={p} className="px-4 py-3 text-right font-black border-l border-blue-200 whitespace-nowrap text-blue-950">
                        <div className="text-sm">
                          {totalMonth > 0 ? formatMoney(totalMonth, processedData.globalCurrency) : '-'}
                        </div>
                        {varM !== 0 && totalMonth > 0 && (
                          <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${varM > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {varM > 0 ? '+' : ''}{(varM * 100).toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Estacionalidad Inferior (DOW, DOM, Mensual) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        {/* Gráfico Día de la Semana */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-3 text-slate-800">
            <LucideBarChart size={18} className="text-blue-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Estacionalidad: Día de la Semana</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDOW} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: any) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgDOW} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Día del Mes */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-3 text-slate-800">
            <LucideBarChart size={18} className="text-emerald-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Estacionalidad: Día del Mes</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDOM} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} interval="preserveStartEnd" minTickGap={20} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: any) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgDOM} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Mensual */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-3 text-slate-800">
            <LucideBarChart size={18} className="text-purple-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Estacionalidad: Mensual (12 Meses)</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMensual} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: any) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgMensual} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
