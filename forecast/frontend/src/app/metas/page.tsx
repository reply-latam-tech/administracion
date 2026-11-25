"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ReactECharts from "echarts-for-react";
import { 
  Target, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  RotateCcw, 
  Search, 
  Info, 
  Sparkles,
  ChevronRight,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Globe,
  DollarSign
} from "lucide-react";
import TableExportButton from "@/components/TableExportButton";
import { convertCurrency } from "@/lib/exchangeRates";
import { useExchangeRates } from "@/context/ExchangeRateContext";
import { ExportData } from "@/lib/exportUtils";
import PeriodFilterSelector from "@/components/PeriodFilterSelector";
import { PeriodFilterOption, getRolling24MonthsRange, filterPeriodosList } from "@/lib/periodFilterUtils";


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

const COUNTRIES = [
  { code: 'ALL', name: 'Todos los Países', flag: '🌐' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', defaultCurrency: 'ARS' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', defaultCurrency: 'CLP' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', defaultCurrency: 'COP' },
  { code: 'MX', name: 'México', flag: '🇲🇽', defaultCurrency: 'MXN' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', defaultCurrency: 'USD' },
];

function getCountryCode(seller: any): string {
  const p = (seller.codigo_pais || seller.pais || '').toUpperCase().trim();
  const name = (seller.nombre_seller || '').toUpperCase();
  if (p === 'CO' || p.includes('COLOMBIA') || name.includes('COLOMBIA')) return 'CO';
  if (p === 'CL' || p.includes('CHILE') || name.includes('CHILE')) return 'CL';
  if (p === 'MX' || p.includes('MEXICO') || p.includes('MÉXICO') || name.includes('MEXICO') || name.includes('MÉXICO')) return 'MX';
  if (p === 'US' || p === 'USA' || p.includes('ESTADOS UNIDOS') || name.includes('USA')) return 'US';
  return 'AR';
}

interface EscalaRow {
  id: number;
  seller_id: number | string;
  periodo: string;
  tipo_cargo: "MINIMO" | "PORCENTUAL" | "SESIONES" | string;
  monto_objetivo: number;
  alicuota: number;
  moneda?: string;
  pais?: string;
}

interface InverseOption {
  tramoIndex: number;
  ventaBruta: number;
  alicuota: number;
  alicuotaStr: string;
  rangoMin: number;
  rangoMax: number | null;
  variacionVsAnterior: number | null;
  esfuerzo: "menor_volumen" | "mayor_volumen";
  metricaTipo?: "MONTO" | "SESIONES";
  metricaLabel?: string;
  formulaExplicativa?: string;
}

interface InverseResult {
  status: "OK" | "MINIMO" | "BELOW_MINIMUM" | "NO_ESCALAS";
  solutions: InverseOption[];
  minimoValor: number;
  primerUmbral: number;
  mensaje?: string;
}

export default function MetasPage() {
  const { rates } = useExchangeRates();
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<any[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<EscalaRow[]>([]);
  const [facturacionReal, setFacturacionReal] = useState<any[]>([]);
  const [sodaMetricas, setSodaMetricas] = useState<Record<string, number>>({});
  
  // Mapa de fees simulados por el usuario: { "sellerId_periodo": number }
  const [simulatedFees, setSimulatedFees] = useState<Record<string, number>>({});
  
  // Celda seleccionada para inspección cartesiana profunda
  const [selectedCell, setSelectedCell] = useState<{
    sellerId: string;
    periodo: string;
    sellerName: string;
    monthStr: string;
  } | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterOption>('24M');
  const range24M = useMemo(() => getRolling24MonthsRange(), []);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>("ALL");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("ALL");
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<string>("ALL");
  const [currencyView, setCurrencyView] = useState<"ORIGINAL" | "USD" | "ARS">("ORIGINAL");

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 1. Sellers
      const { data: sellersData } = await supabase.from("dim_sellers").select("*").order("nombre_seller");
      
      // 2. Liquidaciones completas paginadas
      let allLiqs: any[] = [];
      let pageLiq = 0;
      let hasMoreLiq = true;
      while (hasMoreLiq) {
        const { data: liqPage } = await supabase
          .from("liquidaciones")
          .select("*")
          .order("periodo", { ascending: true })
          .range(pageLiq * 1000, (pageLiq + 1) * 1000 - 1);
        if (liqPage && liqPage.length > 0) {
          allLiqs = allLiqs.concat(liqPage);
          if (liqPage.length < 1000) hasMoreLiq = false;
          else pageLiq++;
        } else {
          hasMoreLiq = false;
        }
      }

      // 3. Escalas completas paginadas
      let allEscalas: EscalaRow[] = [];
      let pageEsc = 0;
      let hasMoreEsc = true;
      while (hasMoreEsc) {
        const { data: escPage } = await supabase
          .from("dim_escalas")
          .select("*")
          .range(pageEsc * 1000, (pageEsc + 1) * 1000 - 1);
        if (escPage && escPage.length > 0) {
          allEscalas = allEscalas.concat(escPage);
          if (escPage.length < 1000) hasMoreEsc = false;
          else pageEsc++;
        } else {
          hasMoreEsc = false;
        }
      }

      // 4. Facturación histórica de ventas brutas completa paginada
      let allFacts: any[] = [];
      let pageFact = 0;
      let hasMoreFact = true;
      while (hasMoreFact) {
        const { data: factPage } = await supabase
          .from("facturacion")
          .select("*")
          .range(pageFact * 1000, (pageFact + 1) * 1000 - 1);
        if (factPage && factPage.length > 0) {
          allFacts = allFacts.concat(factPage);
          if (factPage.length < 1000) hasMoreFact = false;
          else pageFact++;
        } else {
          hasMoreFact = false;
        }
      }

      // 5. Métricas operativas de Soda Stream Web (sesiones)
      const { data: sodaMetricasData } = await supabase
        .from("fact_metricas_operativas")
        .select("*")
        .eq("seller_id", 978681369)
        .eq("tipo_metrica", "SESIONES");
      
      const sodaMetMap: Record<string, number> = {};
      if (sodaMetricasData) {
        sodaMetricasData.forEach((m: any) => {
          sodaMetMap[m.periodo] = Number(m.cantidad) || 0;
        });
        setSodaMetricas(sodaMetMap);
      }

      if (sellersData) setSellers(sellersData);
      setLiquidaciones(allLiqs);
      setEscalas(allEscalas);
      setFacturacionReal(allFacts);

      setLoading(false);
    }

    loadData();
  }, []);

  const formatCurrency = (val: number, currency: string = "ARS", decimals: number = 2) => {
    if (val === 0 || !val) return currency === "USD" ? "US$ 0,00" : "$ 0,00";
    const cur = currency === "ORIGINAL" ? "ARS" : currency;
    try {
      if (cur === "MXN") {
        return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
      }
      if (cur === "USD") {
        return `US$ ${val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
      }
      if (cur === "COP") {
        return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
      }
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
    } catch {
      return `$ ${val.toFixed(decimals)}`;
    }
  };

  const formatCurrency2 = (val: number, cur: string = "ARS") => formatCurrency(val, cur, 2);

  const formatMonthStr = (p: string) => {
    const d = new Date(p + "T12:00:00");
    let mStr = d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
    return mStr.charAt(0).toUpperCase() + mStr.slice(1);
  };

  // Tooltip flotante al pasar el mouse por las franjas de la celda
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    x: number;
    y: number;
    sellerName: string;
    monthStr: string;
    targetFee: number;
    previousVenta: number;
    inverseResult: InverseResult;
  } | null>(null);

  // Extraer todos los periodos ordenados y clasificar su estado global
  const { allPeriodos, periodosMap, sellersMatrix } = useMemo(() => {
    if (!liquidaciones.length || !sellers.length) {
      return { allPeriodos: [], periodosMap: {}, sellersMatrix: [] };
    }

    const pSet = new Set<string>();
    const pStatusMap: Record<string, string> = {};

    liquidaciones.forEach((l) => {
      pSet.add(l.periodo);
      if (l.estado) {
        pStatusMap[l.periodo] = l.estado;
      }
    });

    const sortedP = Array.from(pSet).sort();

    // Map de facturación bruta por seller y periodo: { [sellerId_periodo]: valor_facturado }
    const ventaBrutaMap: Record<string, number> = {};
    facturacionReal.forEach((f) => {
      ventaBrutaMap[`${f.seller_id}_${f.periodo}`] = Number(f.valor_facturado) || 0;
    });

    // Mapear matriz por seller
    const matrix = sellers.map((s) => {
      const sId = String(s.id_seller);
      const liqsOfSeller = liquidaciones.filter((l) => String(l.seller_id) === sId);
      
      const monthsData: Record<string, {
        estado: "REAL" | "PROYECTADO";
        originalFee: number;
        originalVentaBruta: number;
        previousVentaBruta: number;
      }> = {};

      sortedP.forEach((p, idx) => {
        const found = liqsOfSeller.find((l) => l.periodo === p);
        const isProjectedPeriod = p >= "2026-11-01";
        const estado = (found?.estado as any) || (isProjectedPeriod ? "PROYECTADO" : "REAL");
        
        let originalFee = 0;
        let currentVenta = 0;

        if (sId === "430009374") {
          // Soda Stream ML: Reply factura el 50% de atención al cliente sobre el fee de Mercado Libre
          originalFee = found?.subtotal_mercado_libre
            ? Number((Number(found.subtotal_mercado_libre) / 2).toFixed(2))
            : 0;
          currentVenta = ventaBrutaMap[`${sId}_${p}`] || found?.valor_facturado || 0;
        } else if (sId === "978681369") {
          // Soda Stream Web: Honorario según sesiones web
          const sesPeriodo = sodaMetricas[p] || 0;
          currentVenta = sesPeriodo;

          if (found?.subtotal_mercado_libre && Number(found.subtotal_mercado_libre) > 0) {
            originalFee = Number(Number(found.subtotal_mercado_libre).toFixed(2));
          } else {
            // Calcular según escala de sesiones web
            const webEscalas = escalas
              .filter((e) => String(e.seller_id) === "978681369" && e.periodo === p)
              .sort((a, b) => Number(a.alicuota) - Number(b.alicuota));
            
            const minEsc = webEscalas.find((e) => e.tipo_cargo === "MINIMO");
            const sesTiers = webEscalas.filter((e) => e.tipo_cargo === "SESIONES");
            let applied = minEsc;
            for (let i = sesTiers.length - 1; i >= 0; i--) {
              if (sesPeriodo >= Number(sesTiers[i].alicuota)) {
                applied = sesTiers[i];
                break;
              }
            }
            originalFee = applied ? Number(Number(applied.monto_objetivo).toFixed(2)) : 0;
          }
        } else {
          originalFee = found?.subtotal_mercado_libre 
            ? Number(Number(found.subtotal_mercado_libre).toFixed(2)) 
            : 0;
          currentVenta = ventaBrutaMap[`${sId}_${p}`] || found?.valor_facturado || 0;
        }
        
        // Venta / Métrica del mes anterior
        const prevPeriodo = idx > 0 ? sortedP[idx - 1] : null;
        let previousVentaBruta = 0;
        if (prevPeriodo) {
          if (sId === "978681369") {
            previousVentaBruta = sodaMetricas[prevPeriodo] || 0;
          } else {
            previousVentaBruta = ventaBrutaMap[`${sId}_${prevPeriodo}`] || 0;
          }
        }

        monthsData[p] = {
          estado,
          originalFee,
          originalVentaBruta: currentVenta,
          previousVentaBruta
        };
      });

      const countryCode = getCountryCode(s);
      const moneda = (s.moneda || COUNTRY_CONFIG[countryCode]?.defaultCurrency || "ARS").toUpperCase();

      return {
        sellerId: sId,
        sellerName: s.nombre_seller,
        pais: s.pais || countryCode,
        countryCode,
        moneda,
        monthsData
      };
    });

    return {
      allPeriodos: sortedP,
      periodosMap: pStatusMap,
      sellersMatrix: matrix
    };
  }, [liquidaciones, sellers, facturacionReal, sodaMetricas, escalas]);

  const visiblePeriodos = useMemo(() => {
    return filterPeriodosList(allPeriodos, periodFilter, range24M);
  }, [allPeriodos, periodFilter, range24M]);

  

  // Función matemática de resolución inversa con soporte de 2 decimales y escalas compuestas
  const solveInverseEscala = (
    sellerId: string,
    periodo: string,
    targetFeeRaw: number,
    previousVenta: number
  ): InverseResult => {
    const isSodaML = String(sellerId) === "430009374";
    const isSodaWeb = String(sellerId) === "978681369";

    // Para Soda Stream ML, Reply factura el 50% de atención al cliente sobre el fee de Mercado Libre.
    // Por ende, la escala comercial de ML debe generar el doble del fee de Reply:
    const targetFee = Number(Number(isSodaML ? targetFeeRaw * 2 : targetFeeRaw).toFixed(2));

    // Filtrar escalas de ese seller y período
    const sellerEscalas = escalas.filter(
      (e) => String(e.seller_id) === String(sellerId) && e.periodo === periodo
    );

    if (sellerEscalas.length === 0) {
      return { status: "NO_ESCALAS", solutions: [], minimoValor: 0, primerUmbral: 0 };
    }

    const minimoRow = sellerEscalas.find((e) => e.tipo_cargo === "MINIMO");
    const minimoValorOriginal = minimoRow ? Number(Number(minimoRow.monto_objetivo).toFixed(2)) : 0;
    const minimoValor = isSodaML ? Number((minimoValorOriginal / 2).toFixed(2)) : minimoValorOriginal;

    // Caso de Soda Stream Web (escalas basadas en volumen de sesiones web):
    const sessionEscalas = sellerEscalas
      .filter((e) => e.tipo_cargo === "SESIONES")
      .sort((a, b) => Number(a.alicuota) - Number(b.alicuota));

    if (sessionEscalas.length > 0) {
      const primerUmbralSesiones = Number(sessionEscalas[0].alicuota);
      const minFeeWeb = minimoValorOriginal;

      if (targetFeeRaw < minFeeWeb - 0.5) {
        return {
          status: "BELOW_MINIMUM",
          solutions: [],
          minimoValor: minFeeWeb,
          primerUmbral: primerUmbralSesiones,
          mensaje: `El fee deseado (${formatCurrency2(targetFeeRaw)}) es inferior al piso contractual mínimo (${formatCurrency2(minFeeWeb)}).`
        };
      }

      if (Math.abs(targetFeeRaw - minFeeWeb) < 1 || targetFeeRaw <= sessionEscalas[0].monto_objetivo) {
        return {
          status: "MINIMO",
          solutions: [{
            tramoIndex: 0,
            ventaBruta: Math.round(primerUmbralSesiones * 0.5),
            alicuota: 0,
            alicuotaStr: "MÍNIMO",
            rangoMin: 0,
            rangoMax: primerUmbralSesiones,
            variacionVsAnterior: previousVenta > 0 ? (((primerUmbralSesiones * 0.5) - previousVenta) / previousVenta) * 100 : null,
            esfuerzo: "menor_volumen",
            metricaTipo: "SESIONES",
            metricaLabel: "Sesiones Web",
            formulaExplicativa: `Tarifa mínima de ${formatCurrency2(minFeeWeb)} para hasta ${primerUmbralSesiones.toLocaleString("es-AR")} sesiones web.`
          }],
          minimoValor: minFeeWeb,
          primerUmbral: primerUmbralSesiones,
          mensaje: `Cualquier volumen entre 0 y ${primerUmbralSesiones.toLocaleString("es-AR")} sesiones web abona el cargo mínimo de ${formatCurrency2(minFeeWeb)}.`
        };
      }

      const validSolutions: InverseOption[] = [];
      for (let i = 0; i < sessionEscalas.length; i++) {
        const cur = sessionEscalas[i];
        const next = i < sessionEscalas.length - 1 ? sessionEscalas[i + 1] : null;
        const sesMin = Number(cur.alicuota);
        const sesMax = next ? Number(next.alicuota) - 1 : null;
        const feeTier = Number(cur.monto_objetivo);

        if (targetFeeRaw >= feeTier * 0.95 && (next ? targetFeeRaw < Number(next.monto_objetivo) * 1.05 : true)) {
          const variacion = previousVenta > 0 ? ((sesMin - previousVenta) / previousVenta) * 100 : null;
          validSolutions.push({
            tramoIndex: i + 1,
            ventaBruta: sesMin,
            alicuota: 0,
            alicuotaStr: `Tramo ${sesMin.toLocaleString("es-AR")} sesiones`,
            rangoMin: sesMin,
            rangoMax: sesMax,
            variacionVsAnterior: variacion,
            esfuerzo: validSolutions.length === 0 ? "menor_volumen" : "mayor_volumen",
            metricaTipo: "SESIONES",
            metricaLabel: "Sesiones Web",
            formulaExplicativa: `Tramo de ${sesMin.toLocaleString("es-AR")} ${sesMax ? `a ${sesMax.toLocaleString("es-AR")}` : "en adelante"} sesiones web genera un fee de ${formatCurrency2(feeTier)}.`
          });
        }
      }

      if (validSolutions.length === 0) {
        for (let i = 0; i < sessionEscalas.length; i++) {
          const cur = sessionEscalas[i];
          const next = i < sessionEscalas.length - 1 ? sessionEscalas[i + 1] : null;
          const feeTier = Number(cur.monto_objetivo);
          if (feeTier >= targetFeeRaw) {
            const sesMin = Number(cur.alicuota);
            const sesMax = next ? Number(next.alicuota) - 1 : null;
            const variacion = previousVenta > 0 ? ((sesMin - previousVenta) / previousVenta) * 100 : null;
            validSolutions.push({
              tramoIndex: i + 1,
              ventaBruta: sesMin,
              alicuota: 0,
              alicuotaStr: `Tramo ${sesMin.toLocaleString("es-AR")} sesiones`,
              rangoMin: sesMin,
              rangoMax: sesMax,
              variacionVsAnterior: variacion,
              esfuerzo: "menor_volumen",
              metricaTipo: "SESIONES",
              metricaLabel: "Sesiones Web",
              formulaExplicativa: `Para alcanzar ${formatCurrency2(targetFeeRaw)}, se requiere el tramo de ${sesMin.toLocaleString("es-AR")} sesiones (${formatCurrency2(feeTier)}).`
            });
            break;
          }
        }
      }

      return {
        status: validSolutions.length > 0 ? "OK" : "NO_ESCALAS",
        solutions: validSolutions,
        minimoValor: minFeeWeb,
        primerUmbral: primerUmbralSesiones
      };
    }

    // Caso Escalas Porcentuales estándar sobre GMV:
    const porcentuales = sellerEscalas
      .filter((e) => e.tipo_cargo === "PORCENTUAL")
      .sort((a, b) => Number(a.monto_objetivo) - Number(b.monto_objetivo));

    const primerUmbral = porcentuales.length > 0 ? Number(Number(porcentuales[0].monto_objetivo).toFixed(2)) : 0;

    // Caso A: Menor al mínimo contractual
    if (targetFee < minimoValorOriginal - 0.5) {
      return {
        status: "BELOW_MINIMUM",
        solutions: [],
        minimoValor,
        primerUmbral,
        mensaje: `El fee deseado (${formatCurrency2(targetFeeRaw)}) es inferior al piso contractual mínimo (${formatCurrency2(minimoValor)}).`
      };
    }

    // Caso B: Igual al mínimo (o dentro del rango mínimo)
    if (Math.abs(targetFee - minimoValorOriginal) < 1) {
      return {
        status: "MINIMO",
        solutions: [{
          tramoIndex: 0,
          ventaBruta: Number((primerUmbral * 0.5).toFixed(2)),
          alicuota: 0,
          alicuotaStr: "MÍNIMO",
          rangoMin: 0,
          rangoMax: primerUmbral,
          variacionVsAnterior: previousVenta > 0 ? ((primerUmbral * 0.5 - previousVenta) / previousVenta) * 100 : null,
          esfuerzo: "menor_volumen",
          metricaTipo: "MONTO",
          metricaLabel: "Facturación Bruta ML",
          formulaExplicativa: isSodaML
            ? `Aplica mínimo contractual de ${formatCurrency2(minimoValorOriginal)} en ML ÷ 2 = ${formatCurrency2(minimoValor)} atención Reply.`
            : `Cualquier venta bruta entre $0,00 y ${formatCurrency2(primerUmbral)} pagará el mínimo contractual de ${formatCurrency2(minimoValor)}.`
        }],
        minimoValor,
        primerUmbral,
        mensaje: `Cualquier venta bruta entre $0,00 y ${formatCurrency2(primerUmbral)} pagará el mínimo contractual de ${formatCurrency2(minimoValor)}.`
      };
    }

    // Caso C: Tiers Porcentuales
    const validSolutions: InverseOption[] = [];

    for (let i = 0; i < porcentuales.length; i++) {
      const current = porcentuales[i];
      const next = i < porcentuales.length - 1 ? porcentuales[i + 1] : null;

      const V_min = Number(current.monto_objetivo);
      const V_max = next ? Number(next.monto_objetivo) : null;
      const rate = Number(current.alicuota);

      if (rate <= 0) continue;

      // Venta teórica necesaria en este tier
      const V_calc = targetFee / rate;

      // Validar si cae dentro del rango de aplicabilidad de este tramo
      const isAboveMin = V_calc >= V_min - 1;
      const isBelowMax = V_max === null || V_calc < V_max;

      if (isAboveMin && isBelowMax) {
        const ventaCon2Dec = Number(V_calc.toFixed(2));
        const variacion = previousVenta > 0 
          ? ((ventaCon2Dec - previousVenta) / previousVenta) * 100 
          : null;

        const formulaText = isSodaML
          ? `${formatCurrency2(ventaCon2Dec)} × ${(rate * 100).toFixed(2)}% = ${formatCurrency2(targetFee)} (Fee ML) ÷ 2 = ${formatCurrency2(targetFeeRaw)}`
          : `${formatCurrency2(ventaCon2Dec)} × ${(rate * 100).toFixed(2)}%`;

        validSolutions.push({
          tramoIndex: i + 1,
          ventaBruta: ventaCon2Dec,
          alicuota: rate,
          alicuotaStr: `${(rate * 100).toFixed(2)}%`,
          rangoMin: V_min,
          rangoMax: V_max,
          variacionVsAnterior: variacion,
          esfuerzo: validSolutions.length === 0 ? "menor_volumen" : "mayor_volumen",
          metricaTipo: "MONTO",
          metricaLabel: "Facturación Bruta ML",
          formulaExplicativa: formulaText
        });
      }
    }

    // Ordenar de menor a mayor venta bruta necesaria
    validSolutions.sort((a, b) => a.ventaBruta - b.ventaBruta);

    return {
      status: validSolutions.length > 0 ? "OK" : "NO_ESCALAS",
      solutions: validSolutions,
      minimoValor,
      primerUmbral
    };
  };

  // Manejo de edición interactiva asegurando 2 decimales
  const handleFeeChange = (sellerId: string, periodo: string, value: number) => {
    setSimulatedFees((prev) => ({
      ...prev,
      [`${sellerId}_${periodo}`]: Math.max(0, Number(Number(value).toFixed(2)))
    }));
  };

  const handleResetSellerMonth = (sellerId: string, periodo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSimulatedFees((prev) => {
      const copy = { ...prev };
      delete copy[`${sellerId}_${periodo}`];
      return copy;
    });
  };

  const handleResetAll = () => {
    setSimulatedFees({});
  };


  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: sellersMatrix.length };
    sellersMatrix.forEach((s) => {
      const code = s.countryCode || "AR";
      counts[code] = (counts[code] || 0) + 1;
    });
    return counts;
  }, [sellersMatrix]);

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    sellersMatrix.forEach((s) => {
      if (s.moneda) set.add(s.moneda);
    });
    return Array.from(set).sort();
  }, [sellersMatrix]);

  const handleSelectSellerRow = (sellerId: string, sellerName: string) => {
    const currentPeriodo = selectedCell?.periodo || allPeriodos.find((p) => p >= "2026-11-01") || allPeriodos[allPeriodos.length - 1];
    setSelectedCell({
      sellerId,
      periodo: currentPeriodo,
      sellerName,
      monthStr: formatMonthStr(currentPeriodo)
    });
  };

  // Filtrado de Sellers para la tabla
  const filteredMatrix = useMemo(() => {
    return sellersMatrix.filter((row) => {
      const matchesSearch = row.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeller = selectedSellerFilter === "ALL" || row.sellerId === selectedSellerFilter;
      const matchesCountry = selectedCountryFilter === "ALL" || row.countryCode === selectedCountryFilter;
      const matchesCurrency = selectedCurrencyFilter === "ALL" || row.moneda === selectedCurrencyFilter;
      return matchesSearch && matchesSeller && matchesCountry && matchesCurrency;
    });
  }, [sellersMatrix, searchQuery, selectedSellerFilter, selectedCountryFilter, selectedCurrencyFilter]);

  // Selección automática de celda por defecto si no hay ninguna seleccionada
  useEffect(() => {
    if (!selectedCell && filteredMatrix.length > 0) {
      // Buscar el primer mes proyectado (2026-11-01)
      const firstProy = allPeriodos.find((p) => p >= "2026-11-01") || allPeriodos[allPeriodos.length - 1];
      if (firstProy) {
        setSelectedCell({
          sellerId: filteredMatrix[0].sellerId,
          periodo: firstProy,
          sellerName: filteredMatrix[0].sellerName,
          monthStr: formatMonthStr(firstProy)
        });
      }
    }
  }, [filteredMatrix, allPeriodos, selectedCell]);

  // Datos para el gráfico cartesiano de la celda activa
  const inspectionData = useMemo(() => {
    if (!selectedCell) return null;

    const { sellerId, periodo, sellerName, monthStr } = selectedCell;
    const sellerRow = sellersMatrix.find((s) => s.sellerId === sellerId);
    if (!sellerRow) return null;

    const cellData = sellerRow.monthsData[periodo];
    const key = `${sellerId}_${periodo}`;
    const targetFee = simulatedFees[key] !== undefined ? simulatedFees[key] : (cellData?.originalFee || 0);

    const inverse = solveInverseEscala(sellerId, periodo, targetFee, cellData?.previousVentaBruta || 0);

    // Escalas de ese mes para armar la curva cartesiana (dientes de sierra)
    const sellerEscalas = escalas
      .filter((e) => String(e.seller_id) === String(sellerId) && e.periodo === periodo)
      .sort((a, b) => Number(a.monto_objetivo) - Number(b.monto_objetivo));

    const minimoRow = sellerEscalas.find((e) => e.tipo_cargo === "MINIMO");
    const minimo = minimoRow ? Number(minimoRow.monto_objetivo) : 0;
    const porcentuales = sellerEscalas.filter((e) => e.tipo_cargo === "PORCENTUAL");

    // Construcción de serie de puntos del gráfico cartesiano
    let chartPoints: { x: number; y: number; label?: string }[] = [];
    let maxVenta = 500000000;

    if (porcentuales.length > 0) {
      const lastTier = porcentuales[porcentuales.length - 1];
      maxVenta = Number(lastTier.monto_objetivo) * 1.35;

      // Tramo de Mínimo
      const primerUmbral = Number(porcentuales[0].monto_objetivo);
      chartPoints.push({ x: 0, y: minimo, label: "Mínimo" });
      chartPoints.push({ x: primerUmbral, y: minimo, label: "Tope Mínimo" });

      // Tiers Porcentuales con saltos
      for (let i = 0; i < porcentuales.length; i++) {
        const cur = porcentuales[i];
        const next = i < porcentuales.length - 1 ? porcentuales[i + 1] : null;
        const vMin = Number(cur.monto_objetivo);
        const vMax = next ? Number(next.monto_objetivo) : maxVenta;
        const rate = Number(cur.alicuota);

        // Salto vertical hacia el inicio del tramo
        chartPoints.push({ x: vMin, y: vMin * rate, label: `Inicio ${ (rate * 100).toFixed(1) }%` });
        chartPoints.push({ x: vMax, y: vMax * rate, label: `Fin ${ (rate * 100).toFixed(1) }%` });
      }
    }

    // 1. Obtener períodos reales cerrados previos al período proyectado
    const realPeriodsBefore = allPeriodos.filter((p) => {
      const isProj = periodosMap[p] === "PROYECTADO" || p >= "2026-11-01";
      return !isProj && p < periodo;
    });

    // 2. Último mes real cerrado con datos para este seller
    let lastRealPeriod: string | null = null;
    let lastRealFee = 0;
    let lastRealVenta = 0;

    for (let i = realPeriodsBefore.length - 1; i >= 0; i--) {
      const p = realPeriodsBefore[i];
      const fee = sellerRow.monthsData[p]?.originalFee || 0;
      if (fee > 0) {
        lastRealPeriod = p;
        lastRealFee = fee;
        lastRealVenta = sellerRow.monthsData[p]?.originalVentaBruta || 0;
        break;
      }
    }

    if (!lastRealPeriod && realPeriodsBefore.length > 0) {
      lastRealPeriod = realPeriodsBefore[realPeriodsBefore.length - 1];
      lastRealFee = sellerRow.monthsData[lastRealPeriod]?.originalFee || 0;
      lastRealVenta = sellerRow.monthsData[lastRealPeriod]?.originalVentaBruta || 0;
    }

    const lastRealMonthStr = lastRealPeriod ? formatMonthStr(lastRealPeriod) : "Último Mes";

    // 3. Promedio de los últimos 6 meses reales
    const last6Periods = realPeriodsBefore.slice(-6);
    const last6Fees = last6Periods
      .map((p) => sellerRow.monthsData[p]?.originalFee || 0)
      .filter((f) => f > 0);

    const avg6MonthsFee = last6Fees.length > 0
      ? Number((last6Fees.reduce((a, b) => a + b, 0) / last6Fees.length).toFixed(2))
      : 0;

    const last6Ventas = last6Periods
      .map((p) => sellerRow.monthsData[p]?.originalVentaBruta || 0)
      .filter((v) => v > 0);

    const avg6MonthsVenta = last6Ventas.length > 0
      ? Number((last6Ventas.reduce((a, b) => a + b, 0) / last6Ventas.length).toFixed(2))
      : 0;

    const cur = currencyView === "ORIGINAL" ? (sellerRow.moneda || "ARS") : currencyView;
    let displayTargetFee = targetFee;
    let displayLastRealFee = lastRealFee;
    let displayAvg6MonthsFee = avg6MonthsFee;
    let displayChartPoints = chartPoints;

    if (currencyView === "USD" && sellerRow.moneda !== "USD") {
      displayTargetFee = convertCurrency(targetFee, sellerRow.moneda, "USD", periodo);
      displayLastRealFee = lastRealPeriod ? convertCurrency(lastRealFee, sellerRow.moneda, "USD", lastRealPeriod) : convertCurrency(lastRealFee, sellerRow.moneda, "USD", periodo);
      displayAvg6MonthsFee = convertCurrency(avg6MonthsFee, sellerRow.moneda, "USD", periodo);
      displayChartPoints = chartPoints.map(p => ({
        ...p,
        x: convertCurrency(p.x, sellerRow.moneda, "USD", periodo),
        y: convertCurrency(p.y, sellerRow.moneda, "USD", periodo)
      }));
    } else if (currencyView === "ARS" && sellerRow.moneda !== "ARS") {
      displayTargetFee = convertCurrency(targetFee, sellerRow.moneda, "ARS", periodo);
      displayLastRealFee = lastRealPeriod ? convertCurrency(lastRealFee, sellerRow.moneda, "ARS", lastRealPeriod) : convertCurrency(lastRealFee, sellerRow.moneda, "ARS", periodo);
      displayAvg6MonthsFee = convertCurrency(avg6MonthsFee, sellerRow.moneda, "ARS", periodo);
      displayChartPoints = chartPoints.map(p => ({
        ...p,
        x: convertCurrency(p.x, sellerRow.moneda, "ARS", periodo),
        y: convertCurrency(p.y, sellerRow.moneda, "ARS", periodo)
      }));
    }

    return {
      sellerId,
      periodo,
      sellerName,
      monthStr,
      currency: cur,
      targetFee: displayTargetFee,
      rawTargetFee: targetFee,
      isSimulated: simulatedFees[key] !== undefined,
      originalFee: cellData?.originalFee || 0,
      previousVenta: cellData?.previousVentaBruta || 0,
      lastRealPeriod,
      lastRealMonthStr,
      lastRealFee: displayLastRealFee,
      lastRealVenta,
      avg6MonthsFee: displayAvg6MonthsFee,
      avg6MonthsVenta,
      inverse,
      chartPoints: displayChartPoints,
      maxVenta
    };
  }, [selectedCell, simulatedFees, sellersMatrix, escalas, allPeriodos, periodosMap, currencyView]);

  // Configuración de ECharts para el gráfico de escala cartesiana
  const getCartesianChartOption = () => {
    if (!inspectionData) return {};

    const { 
      chartPoints, 
      targetFee, 
      inverse, 
      sellerName, 
      monthStr,
      lastRealFee,
      lastRealMonthStr,
      avg6MonthsFee,
      currency 
    } = inspectionData;

    const scatterData = inverse.solutions.map((sol, idx) => ({
      name: `Alternativa ${idx + 1}`,
      value: [sol.ventaBruta, targetFee],
      alicuota: sol.alicuotaStr,
      variacion: sol.variacionVsAnterior
    }));

    return {
      title: {
        text: `Curva de Escala & Puntos de Intersección — ${sellerName} (${monthStr}) [${currency}]`,
        textStyle: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
        left: "center",
        top: 8
      },
      legend: {
        show: true,
        bottom: 0,
        data: ["Curva de Escala", "Intersecciones Válidas"],
        textStyle: { fontSize: 11, color: "#64748b" }
      },
      tooltip: {
        trigger: "item",
        formatter: function (param: any) {
          if (param.seriesType === "scatter") {
            const data = param.data;
            const varStr = data.variacion !== null 
              ? `<span style="color:${data.variacion >= 0 ? '#10b981' : '#f43f5e'};font-weight:bold;">${data.variacion >= 0 ? '+' : ''}${data.variacion.toFixed(1)}%</span> vs mes anterior` 
              : "";
            return `
              <div style="font-weight:bold;margin-bottom:4px;color:#0f172a;">${data.name} (${data.alicuota})</div>
              <div>Venta Bruta ML: <b>${formatCurrency(data.value[0], currency)}</b></div>
              <div>Fee Reply: <b>${formatCurrency(data.value[1], currency)}</b></div>
              <div style="margin-top:4px;font-size:11px;">${varStr}</div>
            `;
          }
          return `Venta: <b>${formatCurrency(param.value[0], currency)}</b><br/>Fee: <b>${formatCurrency(param.value[1], currency)}</b>`;
        },
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        textStyle: { color: "#0f172a", fontSize: 12 }
      },
      grid: {
        left: "4%",
        right: "5%",
        bottom: 50,
        top: 60,
        containLabel: true
      },
      xAxis: {
        type: "value",
        name: `Facturación Bruta Mercado Libre (${currency})`,
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: 600 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (v: number) => `${Math.round(v / 1000000)}M`
        }
      },
      yAxis: {
        type: "value",
        name: `Fee de Servicio Reply (${currency})`,
        nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: 600 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (v: number) => `${(v / 1000000).toFixed(2)}M`
        }
      },
      series: [
        {
          name: "Curva de Escala",
          type: "line",
          data: chartPoints.map((p) => [p.x, p.y]),
          step: false,
          smooth: false,
          lineStyle: { width: 3, color: "#4981fb" },
          itemStyle: { color: "#4981fb" },
          showSymbol: false,
          markLine: {
            silent: false,
            symbol: ["none", "none"],
            data: [
              // 1. Línea Meta Objetivo (Naranja punteada)
              {
                yAxis: targetFee,
                name: "Meta Objetivo",
                lineStyle: {
                  type: "dashed",
                  color: "#ff5100",
                  width: 2.5
                },
                label: {
                  formatter: `🎯 Meta Objetivo: ${formatCurrency(targetFee, currency)}`,
                  position: "insideEndTop",
                  color: "#ea580c",
                  fontWeight: "bold",
                  fontSize: 10,
                  backgroundColor: "#fff7ed",
                  borderColor: "#fdba74",
                  borderWidth: 1,
                  padding: [3, 6],
                  borderRadius: 4
                }
              },
              // 2. Línea Último Mes Real (Azul punteada)
              ...(lastRealFee > 0 ? [{
                yAxis: lastRealFee,
                name: "Último Mes Real",
                lineStyle: {
                  type: "dashed",
                  color: "#2563eb",
                  width: 2
                },
                label: {
                  formatter: `📅 Último Mes Real (${lastRealMonthStr}): ${formatCurrency(lastRealFee, currency)}`,
                  position: "insideEndBottom",
                  color: "#1d4ed8",
                  fontWeight: "bold",
                  fontSize: 10,
                  backgroundColor: "#eff6ff",
                  borderColor: "#bfdbfe",
                  borderWidth: 1,
                  padding: [3, 6],
                  borderRadius: 4
                }
              }] : []),
              // 3. Línea Promedio Últimos 6 Meses Reales (Violeta punteada)
              ...(avg6MonthsFee > 0 ? [{
                yAxis: avg6MonthsFee,
                name: "Promedio 6 Meses",
                lineStyle: {
                  type: "dashed",
                  color: "#8b5cf6",
                  width: 2
                },
                label: {
                  formatter: `📊 Promedio 6M Reales: ${formatCurrency(avg6MonthsFee, currency)}`,
                  position: "insideStartTop",
                  color: "#6d28d9",
                  fontWeight: "bold",
                  fontSize: 10,
                  backgroundColor: "#f5f3ff",
                  borderColor: "#ddd6fe",
                  borderWidth: 1,
                  padding: [3, 6],
                  borderRadius: 4
                }
              }] : [])
            ]
          }
        },
        {
          name: "Intersecciones Válidas",
          type: "scatter",
          data: scatterData,
          symbolSize: 14,
          itemStyle: {
            color: "#10b981",
            borderColor: "#ffffff",
            borderWidth: 2,
            shadowColor: "rgba(0,0,0,0.25)",
            shadowBlur: 6
          },
          z: 10
        }
      ]
    };
  };

  // KPIs globales consolidados
  const globalKpis = useMemo(() => {
    let originalTotal = 0;
    let simulatedTotal = 0;
    let modifiedCount = 0;

    const targetPeriodo = selectedCell?.periodo || allPeriodos.find((p) => p >= "2026-11-01") || "2026-11-01";

    sellersMatrix.forEach((s) => {
      if (selectedCountryFilter !== "ALL" && s.countryCode !== selectedCountryFilter) return;
      if (selectedCurrencyFilter !== "ALL" && s.moneda !== selectedCurrencyFilter) return;

      const cell = s.monthsData[targetPeriodo];
      if (cell) {
        let orig = cell.originalFee || 0;
        const key = `${s.sellerId}_${targetPeriodo}`;
        let sim = simulatedFees[key] !== undefined ? simulatedFees[key] : orig;

        if (currencyView === "USD") {
          orig = convertCurrency(orig, s.moneda || "ARS", "USD", targetPeriodo);
          sim = convertCurrency(sim, s.moneda || "ARS", "USD", targetPeriodo);
        } else if (currencyView === "ARS") {
          orig = convertCurrency(orig, s.moneda || "ARS", "ARS", targetPeriodo);
          sim = convertCurrency(sim, s.moneda || "ARS", "ARS", targetPeriodo);
        }

        originalTotal += orig;
        simulatedTotal += sim;
        if (simulatedFees[key] !== undefined) modifiedCount++;
      }
    });

    const diff = simulatedTotal - originalTotal;
    const diffPct = originalTotal > 0 ? (diff / originalTotal) * 100 : 0;
    const displayCur = currencyView === "ORIGINAL" ? "ARS" : currencyView;

    return {
      targetPeriodo,
      targetMonthStr: formatMonthStr(targetPeriodo),
      originalTotal,
      simulatedTotal,
      diff,
      diffPct,
      modifiedCount,
      displayCur
    };
  }, [sellersMatrix, simulatedFees, selectedCell, selectedCountryFilter, selectedCurrencyFilter, currencyView]);

  // Handler para disparar el Tooltip flotante interactivo de franjas
  const handleTriggerTooltip = (
    e: React.MouseEvent,
    sellerName: string,
    periodo: string,
    targetFee: number,
    previousVenta: number,
    inverseResult: InverseResult
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      sellerName,
      monthStr: formatMonthStr(periodo),
      targetFee: Number(targetFee.toFixed(2)),
      previousVenta,
      inverseResult
    });
  };

  // Exportar datos de la matriz interactiva de metas
  const getMetasExportData = (): ExportData => {
    const headers = [
      'Seller',
      'ID Seller',
      'País',
      'Moneda',
      ...visiblePeriodos.map(p => `${formatMonthStr(p)} (${p >= '2026-11-01' ? 'PROY' : 'REAL'})`)
    ];

    const rows = filteredMatrix.map(row => [
      row.sellerName,
      row.sellerId,
      row.pais || '',
      row.moneda || 'ARS',
      ...visiblePeriodos.map(p => {
        const cell = row.monthsData[p];
        const key = `${row.sellerId}_${p}`;
        const fee = simulatedFees[key] !== undefined ? simulatedFees[key] : (cell?.originalFee || 0);
        return fee || '';
      })
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      filename: `metas_cobro_${dateStr}`,
      sheetName: 'Metas',
      headers,
      rows
    };
  };

  return (
    <div className="space-y-6 pb-16 w-full h-full flex flex-col">
      {/* 1. Header y KPIs Consolidados */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-orange-50 text-[#ff5100] border border-orange-200/60">
              <Target size={20} />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Calculadora & Simulador Inverso de Metas
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Ingresá el monto neto que deseás cobrar en los meses proyectados. El motor resolverá automáticamente la función inversa de las escalas para indicarte <strong>cuánto debe facturar la cuenta en Mercado Libre</strong> y qué <strong>variación %</strong> se necesita respecto al mes anterior.
          </p>
        </div>

        {/* Tarjetas KPI de Metas */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 min-w-[170px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fee Base Proyectado ({globalKpis.targetMonthStr})
            </p>
            <p className="text-base font-bold text-slate-700 mt-0.5">
              {formatCurrency(globalKpis.originalTotal, globalKpis.displayCur)}
            </p>
          </div>

          <div className="bg-[#eff5ff] border border-[#daebfe] rounded-xl p-3 min-w-[170px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#275ec9]">
              Meta Simulada Reply
            </p>
            <p className="text-base font-extrabold text-[#4981fb] mt-0.5">
              {formatCurrency(globalKpis.simulatedTotal, globalKpis.displayCur)}
            </p>
          </div>

          <div className={`rounded-xl p-3 min-w-[140px] border ${
            globalKpis.diff >= 0 ? "bg-emerald-50 border-emerald-200/70" : "bg-rose-50 border-rose-200/70"
          }`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${
              globalKpis.diff >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              Impacto Neto
            </p>
            <p className={`text-base font-extrabold mt-0.5 ${
              globalKpis.diff >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              {globalKpis.diff >= 0 ? "+" : ""}{formatCurrency(globalKpis.diff, globalKpis.displayCur)}
              <span className="text-xs font-semibold ml-1">
                ({globalKpis.diffPct >= 0 ? "+" : ""}{globalKpis.diffPct.toFixed(1)}%)
              </span>
            </p>
          </div>

          {globalKpis.modifiedCount > 0 && (
            <button
              onClick={handleResetAll}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-1.5 shadow-2xs self-stretch sm:self-auto justify-center"
              title="Restablecer todos los valores al proyectado base"
            >
              <RotateCcw size={14} className="text-[#ff5100]" />
              <span>Restablecer ({globalKpis.modifiedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Barra de Segmentación por Mercado, Moneda y Buscador */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Fila Superior: Segmentación por País y Selector de Moneda */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Segmentación por País / Mercado */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Globe size={14} className="text-blue-600" />
              Mercado:
            </span>
            {COUNTRIES.map((c) => {
              const count = countryCounts[c.code] || 0;
              const isSelected = selectedCountryFilter === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCountryFilter(c.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-blue-700 text-white" : "bg-slate-200/80 text-slate-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selector de Moneda de Visualización */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs self-start md:self-auto">
            <span className="text-[11px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <DollarSign size={11} className="text-blue-600" />
              Moneda:
            </span>
            <button
              onClick={() => setCurrencyView("ORIGINAL")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                currencyView === "ORIGINAL"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Visualizar cada cliente en su moneda nativa contractual"
            >
              <span>🪙 Moneda Origen</span>
            </button>
            <button
              onClick={() => setCurrencyView("USD")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                currencyView === "USD"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Unificar a dólares estadounidenses (USD) usando cotizaciones oficiales"
            >
              <span>💵 USD (Unificado)</span>
            </button>
            <button
              onClick={() => setCurrencyView("ARS")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                currencyView === "ARS"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Unificar a pesos argentinos (ARS)"
            >
              <span>🇦🇷 ARS (Unificado)</span>
            </button>
          </div>
        </div>

        {/* Fila Inferior: Buscador, Selectores Específicos, Leyenda y Exportar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
            {/* Buscador de Cliente */}
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Selector Directo de Cliente */}
            <select
              value={selectedSellerFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSellerFilter(val);
                if (val !== "ALL") {
                  const targetSeller = sellersMatrix.find((s) => s.sellerId === val);
                  if (targetSeller) {
                    handleSelectSellerRow(targetSeller.sellerId, targetSeller.sellerName);
                  }
                }
              }}
              className="text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-700 outline-hidden"
            >
              <option value="ALL">Todos los clientes ({sellersMatrix.length})</option>
              {sellersMatrix.map((s) => (
                <option key={s.sellerId} value={s.sellerId}>
                  {s.sellerName} ({COUNTRY_CONFIG[s.countryCode]?.flag || ""} {s.moneda})
                </option>
              ))}
            </select>

            {/* Selector de Período 24M */}
            <PeriodFilterSelector
              selectedFilter={periodFilter}
              onChangeFilter={setPeriodFilter}
              range24M={range24M}
            />

            {/* Filtro por Moneda Contractual */}
            <select
              value={selectedCurrencyFilter}
              onChange={(e) => setSelectedCurrencyFilter(e.target.value)}
              className="text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-700 outline-hidden"
            >
              <option value="ALL">Todas las monedas</option>
              {availableCurrencies.map((cur) => (
                <option key={cur} value={cur}>
                  Moneda: {cur}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-500 self-end sm:self-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
              <span>Mes Cerrado (Real)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-[#ff5100]"></span>
              <span className="font-semibold text-slate-700">Mes Proyectado (Editable)</span>
            </div>
            <TableExportButton getData={getMetasExportData} label="Exportar" variant="compact" />
          </div>
        </div>
      </div>

      {/* 3. Tabla Matricial Interactiva de Metas */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[380px]">
        <div className="overflow-x-auto overflow-y-auto max-h-[680px] flex-1 relative border-t border-slate-100">
          <table className="w-full text-xs text-left text-slate-600 border-separate border-spacing-0">
            <thead className="text-[11px] uppercase tracking-wider sticky top-0 z-20 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
              <tr className="bg-slate-100">
                <th scope="col" className="px-5 py-3.5 font-bold text-slate-700 sticky left-0 top-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[210px] border-r border-b border-slate-200">
                  Seller / Cliente
                </th>
                {visiblePeriodos.map((p) => {
                  const isProjected = p >= "2026-11-01";
                  return (
                    <th 
                      key={p} 
                      scope="col" 
                      className={`px-3 py-3 font-bold text-center min-w-[170px] border-l border-b border-slate-200 sticky top-0 z-20 ${
                        isProjected ? "bg-orange-50/95 text-[#ff5100]" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{formatMonthStr(p)}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          isProjected 
                            ? "bg-[#ff5100]/10 text-[#ff5100] border border-[#ff5100]/20" 
                            : "bg-slate-200/80 text-slate-500"
                        }`}>
                          {isProjected ? "PROYECTADO" : "REAL"}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visiblePeriodos.length + 1} className="px-6 py-16 text-center text-slate-400">
                    <div className="animate-pulse">Cargando matrices de liquidación y escalas...</div>
                  </td>
                </tr>
              ) : filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={visiblePeriodos.length + 1} className="px-6 py-16 text-center text-slate-400">
                    No se encontraron clientes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((row) => (
                  <tr 
                    key={row.sellerId} 
                    onClick={() => handleSelectSellerRow(row.sellerId, row.sellerName)}
                    className={`cursor-pointer transition-colors group ${
                      selectedCell?.sellerId === row.sellerId 
                        ? "bg-blue-50/70 hover:bg-blue-100/60" 
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Columna Fija: Seller */}
                    <td className={`px-5 py-3.5 font-semibold text-slate-900 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200 transition-colors ${
                      selectedCell?.sellerId === row.sellerId 
                        ? "bg-blue-50/95 border-l-4 border-l-blue-600" 
                        : "bg-white group-hover:bg-slate-50/90"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          selectedCell?.sellerId === row.sellerId ? "bg-blue-600 ring-2 ring-blue-300" : "bg-[#4981fb]"
                        }`}></span>
                        <div className="truncate max-w-[170px]" title={row.sellerName}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs truncate">{row.sellerName}</span>
                            {selectedCell?.sellerId === row.sellerId && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white shadow-2xs">
                                Activa
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <span>{COUNTRY_CONFIG[row.countryCode]?.flag || "🌐"} {row.countryCode}</span>
                            <span>•</span>
                            <span className="font-bold text-slate-600">{row.moneda}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Columnas Mensuales */}
                    {visiblePeriodos.map((p) => {
                      const cell = row.monthsData[p];
                      const isProjected = p >= "2026-11-01";
                      const key = `${row.sellerId}_${p}`;
                      const isSimulated = simulatedFees[key] !== undefined;
                      const currentFee = isSimulated ? simulatedFees[key] : (cell?.originalFee || 0);
                      const isSelected = selectedCell?.sellerId === row.sellerId && selectedCell?.periodo === p;

                      // Si es proyectado, calculamos la resolución inversa en tiempo real
                      const inverseResult = isProjected
                        ? solveInverseEscala(row.sellerId, p, currentFee, cell?.previousVentaBruta || 0)
                        : null;

                      // Formato mes real cerrado
                      if (!isProjected) {
                        return (
                          <td key={p} className="px-3 py-3 text-right border-l border-slate-100 bg-white/50">
                            <div className="font-bold text-slate-800 text-xs">
                              {cell?.originalFee ? formatCurrency2(cell.originalFee) : "—"}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Cerrado</span>
                          </td>
                        );
                      }

                      // Mes Proyectado Editable
                      return (
                        <td
                          key={p}
                          onClick={() => {
                            setSelectedCell({
                              sellerId: row.sellerId,
                              periodo: p,
                              sellerName: row.sellerName,
                              monthStr: formatMonthStr(p)
                            });
                          }}
                          className={`px-2.5 py-2.5 border-l border-slate-200 transition-all cursor-pointer relative ${
                            isSelected 
                              ? "bg-orange-50/70 ring-2 ring-inset ring-[#ff5100]" 
                              : isSimulated 
                                ? "bg-amber-50/40 hover:bg-amber-50/70" 
                                : "bg-white hover:bg-slate-50/80"
                          }`}
                        >
                          {/* Badge de simulado / reset */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                              isSimulated 
                                ? "bg-[#ff5100] text-white" 
                                : "text-slate-400 bg-slate-100"
                            }`}>
                              {isSimulated ? "SIMULADO" : "PROY"}
                            </span>
                            {isSimulated && (
                              <button
                                onClick={(e) => handleResetSellerMonth(row.sellerId, p, e)}
                                title="Volver al proyectado original"
                                className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                              >
                                <RotateCcw size={11} />
                              </button>
                            )}
                          </div>

                          {/* Input de Fee Neto Editable con 2 decimales exactos */}
                          <div className="flex items-center relative mb-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="absolute left-2 text-[11px] font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={currentFee !== undefined && currentFee !== null ? Number(currentFee.toFixed(2)) : ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleFeeChange(row.sellerId, p, isNaN(val) ? 0 : Number(val.toFixed(2)));
                              }}
                              onFocus={() => {
                                setSelectedCell({
                                  sellerId: row.sellerId,
                                  periodo: p,
                                  sellerName: row.sellerName,
                                  monthStr: formatMonthStr(p)
                                });
                              }}
                              className={`w-full pl-5 pr-2 py-1 text-xs font-black rounded-md border outline-none text-right transition-all font-mono ${
                                isSimulated
                                  ? "border-[#ff5100] bg-white text-[#ff5100] shadow-2xs font-extrabold"
                                  : "border-slate-200 bg-slate-50/70 text-slate-800 focus:bg-white focus:border-[#4981fb]"
                              }`}
                            />
                          </div>

                          {/* Resultado Inverso Directo en la Celda con Tooltip Trigger */}
                          {inverseResult && (
                            <div className="text-[10px] space-y-0.5 border-t border-slate-100 pt-1">
                              {inverseResult.status === "BELOW_MINIMUM" ? (
                                <div 
                                  className="text-rose-600 font-semibold flex items-center gap-1 justify-end cursor-help p-0.5 rounded hover:bg-rose-50/70 transition-colors"
                                  onMouseEnter={(e) => handleTriggerTooltip(e, row.sellerName, p, currentFee, cell?.previousVentaBruta || 0, inverseResult)}
                                  onMouseLeave={() => setHoveredTooltip(null)}
                                >
                                  <AlertTriangle size={11} />
                                  <span>&lt; Mínimo ({formatCurrency2(inverseResult.minimoValor)})</span>
                                </div>
                              ) : inverseResult.status === "MINIMO" ? (
                                <div 
                                  className="text-[#275ec9] font-medium text-right cursor-help p-0.5 rounded hover:bg-blue-50/60 transition-colors"
                                  onMouseEnter={(e) => handleTriggerTooltip(e, row.sellerName, p, currentFee, cell?.previousVentaBruta || 0, inverseResult)}
                                  onMouseLeave={() => setHoveredTooltip(null)}
                                >
                                  <span>Aplica mínimo ({row.sellerId === "978681369" ? `< ${inverseResult.primerUmbral.toLocaleString("es-AR")} ses.` : `Venta < ${formatCurrency2(inverseResult.primerUmbral)}`})</span>
                                </div>
                              ) : inverseResult.solutions.length === 1 ? (
                                (() => {
                                  const sol = inverseResult.solutions[0];
                                  const isSes = sol.metricaTipo === "SESIONES";
                                  return (
                                    <div 
                                      className="flex flex-col text-right cursor-help p-1 -m-1 rounded hover:bg-slate-100/70 transition-colors"
                                      onMouseEnter={(e) => handleTriggerTooltip(e, row.sellerName, p, currentFee, cell?.previousVentaBruta || 0, inverseResult)}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                    >
                                      <div className="font-bold text-slate-800 font-mono">
                                        {isSes ? `${sol.ventaBruta.toLocaleString("es-AR")} ses.` : `ML: ${formatCurrency2(sol.ventaBruta)}`}
                                      </div>
                                      <div className="flex items-center justify-end gap-1 text-[9px]">
                                        <span className="text-slate-400 font-mono">@{sol.alicuotaStr}</span>
                                        {sol.variacionVsAnterior !== null && (
                                          <span className={`font-bold ${
                                            sol.variacionVsAnterior >= 0 ? "text-emerald-600" : "text-rose-600"
                                          }`}>
                                            {sol.variacionVsAnterior >= 0 ? "▲ +" : "▼ "}{sol.variacionVsAnterior.toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : inverseResult.solutions.length > 1 ? (
                                <div 
                                  className="flex flex-col text-right cursor-help p-1 -m-0.5 rounded-md bg-orange-50/70 hover:bg-orange-100/80 border border-orange-200/60 transition-all shadow-2xs group/franja"
                                  onMouseEnter={(e) => handleTriggerTooltip(e, row.sellerName, p, currentFee, cell?.previousVentaBruta || 0, inverseResult)}
                                  onMouseLeave={() => setHoveredTooltip(null)}
                                >
                                  <div className="font-bold text-[#ff5100] flex items-center justify-end gap-1 text-[10px]">
                                    <Layers size={11} className="text-[#ff5100]" />
                                    <span>{inverseResult.solutions.length} franjas posibles</span>
                                  </div>
                                  <div className="text-[9px] text-slate-600 font-mono font-medium flex items-center justify-end gap-1">
                                    <span>Desde</span>
                                    <span className="font-bold text-slate-800">
                                      {inverseResult.solutions[0].metricaTipo === "SESIONES"
                                        ? `${inverseResult.solutions[0].ventaBruta.toLocaleString("es-AR")} ses.`
                                        : formatCurrency2(inverseResult.solutions[0].ventaBruta)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-right block">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Panel de Inspección Cartesiana Detallada */}
      {inspectionData && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#eff5ff] text-[#275ec9] border border-[#daebfe]">
                  {inspectionData.monthStr}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Desglose de Meta & Venta Bruta Necesaria: {inspectionData.sellerName}
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Para cobrar un fee neto de <strong className="text-slate-900">{formatCurrency2(inspectionData.targetFee)}</strong> en {inspectionData.monthStr}, el modelo matemático de escalas proyectadas arroja las siguientes soluciones:
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Venta Mes Anterior</p>
                <p className="text-sm font-bold text-slate-800 font-mono">
                  {inspectionData.previousVenta > 0 ? formatCurrency(inspectionData.previousVenta, inspectionData.currency) : "No registrada"}
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Fee Objetivo Reply</p>
                <p className="text-sm font-black text-[#ff5100] font-mono">
                  {formatCurrency(inspectionData.targetFee, inspectionData.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Tarjetas de Soluciones Inversas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inspectionData.inverse.status === "BELOW_MINIMUM" ? (
              <div className="col-span-full p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-900 mb-1">Fee Inalcanzable (Por debajo del mínimo contractual)</h4>
                  <p>{inspectionData.inverse.mensaje}</p>
                </div>
              </div>
            ) : inspectionData.inverse.status === "MINIMO" ? (
              <div className="col-span-full p-4 rounded-xl bg-[#eff5ff] border border-[#daebfe] text-[#1e3a8a] text-xs flex items-start gap-3">
                <Info size={18} className="text-[#4981fb] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#1e3a8a] mb-1">Zona de Cargo Mínimo Contractual</h4>
                  <p>{inspectionData.inverse.mensaje}</p>
                </div>
              </div>
            ) : inspectionData.inverse.solutions.length === 0 ? (
              <div className="col-span-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
                No se encontraron franjas de escala configuradas para este cliente en el período seleccionado.
              </div>
            ) : (
              inspectionData.inverse.solutions.map((sol, index) => {
                const isFirst = index === 0;
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isFirst 
                        ? "bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200 shadow-xs" 
                        : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isFirst 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          Alternativa {index + 1} {isFirst ? "• Menor Volumen ML" : "• Escala con Descuento"}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#4981fb]">
                          Alícuota {sol.alicuotaStr}
                        </span>
                      </div>

                      <div className="mb-3">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">
                          {sol.metricaLabel ? `${sol.metricaLabel} Requerida` : "Facturación Bruta Requerida"}
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-0.5 font-mono">
                          {sol.metricaTipo === "SESIONES"
                            ? `${sol.ventaBruta.toLocaleString("es-AR")} sesiones`
                            : formatCurrency2(sol.ventaBruta, inspectionData.currency)}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-1 mb-2">
                        <div className="flex justify-between text-slate-600">
                          <span>Tramo de Escala:</span>
                          <span className="font-semibold text-slate-800">
                            {sol.metricaTipo === "SESIONES"
                              ? `${sol.rangoMin.toLocaleString("es-AR")} ${sol.rangoMax ? `a ${sol.rangoMax.toLocaleString("es-AR")}` : "en adelante"} sesiones`
                              : `${formatCurrency2(sol.rangoMin, inspectionData.currency)} ${sol.rangoMax ? `a ${formatCurrency2(sol.rangoMax, inspectionData.currency)}` : "en adelante"}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Cálculo:</span>
                          <span className="font-mono text-slate-700">
                            {sol.formulaExplicativa || `${formatCurrency2(sol.ventaBruta, inspectionData.currency)} × ${sol.alicuotaStr}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Variación vs Mes Anterior:</span>
                      {sol.variacionVsAnterior !== null ? (
                        <span className={`font-extrabold flex items-center gap-0.5 px-2 py-0.5 rounded ${
                          sol.variacionVsAnterior >= 0 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                            : "bg-rose-50 text-rose-700 border border-rose-200/60"
                        }`}>
                          {sol.variacionVsAnterior >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {sol.variacionVsAnterior >= 0 ? "+" : ""}{sol.variacionVsAnterior.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>


          {/* Aclaración y Referencias de Meta vs Histórico */}
          <div className="bg-gradient-to-r from-orange-50/70 via-blue-50/40 to-purple-50/40 border border-slate-200/90 rounded-xl p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#ff5100]" />
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Aclaración de Referencias del Gráfico
              </h4>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11.5px]">
              La curva azul representa la escala de honorarios contractual según facturación bruta en Mercado Libre. Las líneas punteadas horizontales contrastan el objetivo simulado frente a la historia real de la cuenta:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="flex items-start gap-2.5 bg-white/95 p-3 rounded-xl border border-orange-200/90 shadow-2xs">
                <span className="w-3.5 h-1 bg-[#ff5100] rounded-full mt-2 shrink-0 border-t-2 border-dashed border-[#ff5100]"></span>
                <div>
                  <span className="font-extrabold text-orange-950 block text-xs">Línea Naranja — Meta Objetivo ({inspectionData.monthStr})</span>
                  <span className="font-black text-[#ff5100] font-mono text-base block mt-0.5">
                    {formatCurrency(inspectionData.targetFee, inspectionData.currency)}
                  </span>
                  <span className="text-[10px] text-slate-500">Monto objetivo mensual simulado a cobrar</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/95 p-3 rounded-xl border border-blue-200/90 shadow-2xs">
                <span className="w-3.5 h-1 bg-[#2563eb] rounded-full mt-2 shrink-0 border-t-2 border-dashed border-[#2563eb]"></span>
                <div>
                  <span className="font-extrabold text-blue-950 block text-xs">Línea Azul — Último Mes Real ({inspectionData.lastRealMonthStr})</span>
                  <span className="font-black text-[#2563eb] font-mono text-base block mt-0.5">
                    {inspectionData.lastRealFee > 0 ? formatCurrency(inspectionData.lastRealFee, inspectionData.currency) : "Sin historial"}
                  </span>
                  {inspectionData.lastRealFee > 0 && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      inspectionData.targetFee >= inspectionData.lastRealFee ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {inspectionData.targetFee >= inspectionData.lastRealFee ? "▲ +" : "▼ "}
                      {(((inspectionData.targetFee - inspectionData.lastRealFee) / inspectionData.lastRealFee) * 100).toFixed(1)}% vs meta
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/95 p-3 rounded-xl border border-purple-200/90 shadow-2xs">
                <span className="w-3.5 h-1 bg-[#8b5cf6] rounded-full mt-2 shrink-0 border-t-2 border-dashed border-[#8b5cf6]"></span>
                <div>
                  <span className="font-extrabold text-purple-950 block text-xs">Línea Violeta — Promedio Últimos 6 Meses</span>
                  <span className="font-black text-[#8b5cf6] font-mono text-base block mt-0.5">
                    {inspectionData.avg6MonthsFee > 0 ? formatCurrency(inspectionData.avg6MonthsFee, inspectionData.currency) : "Sin historial"}
                  </span>
                  {inspectionData.avg6MonthsFee > 0 && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      inspectionData.targetFee >= inspectionData.avg6MonthsFee ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {inspectionData.targetFee >= inspectionData.avg6MonthsFee ? "▲ +" : "▼ "}
                      {(((inspectionData.targetFee - inspectionData.avg6MonthsFee) / inspectionData.avg6MonthsFee) * 100).toFixed(1)}% vs meta
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico Cartesiano ECharts de la Escala */}
          {inspectionData.chartPoints.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-5">
              <div className="h-[480px] md:h-[520px] w-full">
                <ReactECharts
                  option={getCartesianChartOption()}
                  style={{ height: "100%", width: "100%" }}
                  opts={{ renderer: "svg" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Tooltip Popover Flotante Interactivo de Franjas Posibles */}
      {hoveredTooltip && (
        <div 
          className="fixed z-[9999] pointer-events-none transition-all duration-150 ease-out"
          style={{
            left: `${Math.min(Math.max(hoveredTooltip.x, 210), typeof window !== "undefined" ? window.innerWidth - 210 : 300)}px`,
            top: hoveredTooltip.y > 330 ? `${hoveredTooltip.y - 10}px` : `${hoveredTooltip.y + 40}px`,
            transform: hoveredTooltip.y > 330 ? "translate(-50%, -100%)" : "translate(-50%, 0)"
          }}
        >
          <div className="w-[390px] bg-white/95 backdrop-blur-md rounded-2xl border-2 border-orange-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.22)] p-4 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Tooltip */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-50 text-[#ff5100] border border-orange-200/60 shrink-0">
                  <Layers size={16} />
                </span>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs leading-tight">
                    {hoveredTooltip.sellerName}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-[#ff5100] bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200/50">
                      {hoveredTooltip.monthStr}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Escala Proyectada
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                  Meta Cobro
                </span>
                <span className="font-mono font-black text-slate-900 text-xs">
                  {formatCurrency2(hoveredTooltip.targetFee)}
                </span>
              </div>
            </div>

            {/* Subheader descriptivo */}
            <div className="my-2.5">
              {hoveredTooltip.inverseResult.solutions.length > 1 ? (
                <p className="text-[11px] text-slate-600 leading-snug">
                  Debido a los tramos de la escala, este fee neto se puede alcanzar con <strong className="text-[#ff5100] font-bold">{hoveredTooltip.inverseResult.solutions.length} alternativas</strong> de volumen:
                </p>
              ) : hoveredTooltip.inverseResult.solutions.length === 1 ? (
                <p className="text-[11px] text-slate-600 leading-snug">
                  {hoveredTooltip.inverseResult.solutions[0].metricaTipo === "SESIONES"
                    ? "Sesiones web requeridas para alcanzar esta meta:"
                    : "Venta bruta requerida en Mercado Libre para alcanzar esta meta:"}
                </p>
              ) : hoveredTooltip.inverseResult.status === "MINIMO" ? (
                <p className="text-[11px] text-[#275ec9] leading-snug font-medium">
                  {hoveredTooltip.inverseResult.mensaje}
                </p>
              ) : (
                <p className="text-[11px] text-rose-600 leading-snug font-medium">
                  {hoveredTooltip.inverseResult.mensaje}
                </p>
              )}
            </div>

            {/* Lista de Soluciones con 2 Decimales */}
            {hoveredTooltip.inverseResult.solutions.length > 0 && (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                {hoveredTooltip.inverseResult.solutions.map((sol, sIdx) => {
                  const isMinVolume = sIdx === 0;
                  const isSes = sol.metricaTipo === "SESIONES";
                  return (
                    <div 
                      key={sIdx}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                        isMinVolume 
                          ? "bg-gradient-to-r from-orange-50/70 via-amber-50/30 to-white border-[#ff5100]/30 shadow-2xs" 
                          : "bg-slate-50/80 border-slate-200/70"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            isMinVolume ? "bg-[#ff5100] text-white" : "bg-white text-slate-700 border border-slate-200"
                          }`}>
                            Franja {sIdx + 1}
                          </span>
                          <span className="text-[10px] font-extrabold text-[#4981fb] font-mono">
                            @{sol.alicuotaStr}
                          </span>
                          {isMinVolume && (
                            <span className="text-[9px] font-bold text-[#ff5100]">
                              ★ Menor Volumen
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 truncate">
                          Tramo: {isSes
                            ? `${sol.rangoMin.toLocaleString("es-AR")} ${sol.rangoMax ? `a ${sol.rangoMax.toLocaleString("es-AR")}` : "en adelante"} sesiones`
                            : `${formatCurrency2(sol.rangoMin)} ${sol.rangoMax ? `a ${formatCurrency2(sol.rangoMax)}` : "en adelante"}`}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-slate-900 text-xs">
                          {isSes ? `${sol.ventaBruta.toLocaleString("es-AR")} ses.` : formatCurrency2(sol.ventaBruta)}
                        </div>
                        {sol.variacionVsAnterior !== null ? (
                          <div className={`text-[9.5px] font-extrabold flex items-center justify-end gap-0.5 ${
                            sol.variacionVsAnterior >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            <span>{sol.variacionVsAnterior >= 0 ? "▲ +" : "▼ "}{sol.variacionVsAnterior.toFixed(1)}%</span>
                            <span className="text-[8.5px] text-slate-400 font-normal">vs mes ant.</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-mono">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer con referencia y sugerencia */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <span>Ref. Mes Anterior:</span>
                <span className="font-mono font-semibold text-slate-600">
                  {hoveredTooltip.previousVenta > 0 ? formatCurrency2(hoveredTooltip.previousVenta) : "No registrada"}
                </span>
              </div>
              <span className="text-[#ff5100] font-medium flex items-center gap-0.5">
                <Sparkles size={11} /> Click celda para fijar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
