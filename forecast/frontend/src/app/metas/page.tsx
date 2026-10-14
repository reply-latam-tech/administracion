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
  AlertTriangle
} from "lucide-react";

interface EscalaRow {
  id: number;
  seller_id: number | string;
  periodo: string;
  tipo_cargo: "MINIMO" | "PORCENTUAL";
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
}

interface InverseResult {
  status: "OK" | "MINIMO" | "BELOW_MINIMUM" | "NO_ESCALAS";
  solutions: InverseOption[];
  minimoValor: number;
  primerUmbral: number;
  mensaje?: string;
}

export default function MetasPage() {
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<any[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<EscalaRow[]>([]);
  const [facturacionReal, setFacturacionReal] = useState<any[]>([]);
  
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
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>("ALL");

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 1. Sellers
      const { data: sellersData } = await supabase.from("dim_sellers").select("*").order("nombre_seller");
      
      // 2. Liquidaciones
      const { data: liqData } = await supabase
        .from("liquidaciones")
        .select("*")
        .order("periodo", { ascending: true });

      // 3. Escalas completas (paginadas)
      let allEscalas: EscalaRow[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: escPage } = await supabase
          .from("dim_escalas")
          .select("*")
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (escPage && escPage.length > 0) {
          allEscalas = allEscalas.concat(escPage);
          if (escPage.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      // 4. Facturación histórica de ventas brutas (para calcular variación vs mes anterior)
      const { data: factData } = await supabase.from("facturacion").select("*");

      if (sellersData) setSellers(sellersData);
      if (liqData) setLiquidaciones(liqData);
      setEscalas(allEscalas);
      if (factData) setFacturacionReal(factData);

      setLoading(false);
    }

    loadData();
  }, []);

  const formatCurrency = (val: number, decimals: number = 0) => 
    new Intl.NumberFormat("es-AR", { 
      style: "currency", 
      currency: "ARS", 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    }).format(val);

  // Formato estándar con 2 decimales para valores proyectados y metas
  const formatCurrency2 = (val: number) => formatCurrency(val, 2);

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
      // Si algún seller lo tiene como PROYECTADO o el registro lo marca
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
        const estado = (found?.estado as any) || (p >= "2026-09-01" ? "PROYECTADO" : "REAL");
        const originalFee = found?.subtotal_mercado_libre 
          ? Number(Number(found.subtotal_mercado_libre).toFixed(2)) 
          : 0;
        const currentVenta = ventaBrutaMap[`${sId}_${p}`] || found?.valor_facturado || 0;
        
        // Venta del mes anterior
        const prevPeriodo = idx > 0 ? sortedP[idx - 1] : null;
        const previousVentaBruta = prevPeriodo ? (ventaBrutaMap[`${sId}_${prevPeriodo}`] || 0) : 0;

        monthsData[p] = {
          estado,
          originalFee,
          originalVentaBruta: currentVenta,
          previousVentaBruta
        };
      });

      return {
        sellerId: sId,
        sellerName: s.nombre_seller,
        pais: s.pais || "ARG",
        moneda: s.moneda || "ARS",
        monthsData
      };
    });

    return {
      allPeriodos: sortedP,
      periodosMap: pStatusMap,
      sellersMatrix: matrix
    };
  }, [liquidaciones, sellers, facturacionReal]);

  // Función matemática de resolución inversa con soporte de 2 decimales
  const solveInverseEscala = (
    sellerId: string,
    periodo: string,
    targetFeeRaw: number,
    previousVenta: number
  ): InverseResult => {
    const targetFee = Number(Number(targetFeeRaw).toFixed(2));

    // Filtrar escalas de ese seller y período
    const sellerEscalas = escalas.filter(
      (e) => String(e.seller_id) === String(sellerId) && e.periodo === periodo
    );

    if (sellerEscalas.length === 0) {
      return { status: "NO_ESCALAS", solutions: [], minimoValor: 0, primerUmbral: 0 };
    }

    const minimoRow = sellerEscalas.find((e) => e.tipo_cargo === "MINIMO");
    const minimoValor = minimoRow ? Number(Number(minimoRow.monto_objetivo).toFixed(2)) : 0;

    const porcentuales = sellerEscalas
      .filter((e) => e.tipo_cargo === "PORCENTUAL")
      .sort((a, b) => Number(a.monto_objetivo) - Number(b.monto_objetivo));

    const primerUmbral = porcentuales.length > 0 ? Number(Number(porcentuales[0].monto_objetivo).toFixed(2)) : 0;

    // Caso A: Menor al mínimo contractual
    if (targetFee < minimoValor - 0.5) {
      return {
        status: "BELOW_MINIMUM",
        solutions: [],
        minimoValor,
        primerUmbral,
        mensaje: `El fee deseado (${formatCurrency2(targetFee)}) es inferior al piso contractual mínimo (${formatCurrency2(minimoValor)}).`
      };
    }

    // Caso B: Igual al mínimo (o dentro del rango mínimo)
    if (Math.abs(targetFee - minimoValor) < 1) {
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
          esfuerzo: "menor_volumen"
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

        validSolutions.push({
          tramoIndex: i + 1,
          ventaBruta: ventaCon2Dec,
          alicuota: rate,
          alicuotaStr: `${(rate * 100).toFixed(2)}%`,
          rangoMin: V_min,
          rangoMax: V_max,
          variacionVsAnterior: variacion,
          esfuerzo: validSolutions.length === 0 ? "menor_volumen" : "mayor_volumen"
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

  // Filtrado de Sellers para la tabla
  const filteredMatrix = useMemo(() => {
    return sellersMatrix.filter((row) => {
      const matchesSearch = row.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = selectedSellerFilter === "ALL" || row.sellerId === selectedSellerFilter;
      return matchesSearch && matchesFilter;
    });
  }, [sellersMatrix, searchQuery, selectedSellerFilter]);

  // Selección automática de celda por defecto si no hay ninguna seleccionada
  useEffect(() => {
    if (!selectedCell && filteredMatrix.length > 0) {
      // Buscar el primer mes proyectado (ej. 2026-09-01 o 2026-10-01)
      const firstProy = allPeriodos.find((p) => p >= "2026-09-01") || allPeriodos[allPeriodos.length - 1];
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

    return {
      sellerId,
      periodo,
      sellerName,
      monthStr,
      targetFee,
      isSimulated: simulatedFees[key] !== undefined,
      originalFee: cellData?.originalFee || 0,
      previousVenta: cellData?.previousVentaBruta || 0,
      inverse,
      chartPoints,
      maxVenta
    };
  }, [selectedCell, simulatedFees, sellersMatrix, escalas]);

  // Configuración de ECharts para el gráfico de escala cartesiana
  const getCartesianChartOption = () => {
    if (!inspectionData) return {};

    const { chartPoints, targetFee, inverse, sellerName, monthStr } = inspectionData;

    // Puntos de intersección (soluciones válidas)
    const scatterData = inverse.solutions.map((sol, idx) => ({
      name: `Alternativa ${idx + 1}`,
      value: [sol.ventaBruta, targetFee],
      alicuota: sol.alicuotaStr,
      variacion: sol.variacionVsAnterior
    }));

    return {
      title: {
        text: `Curva de Escala & Puntos de Intersección — ${sellerName} (${monthStr})`,
        textStyle: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
        left: "center",
        top: 8
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
              <div>Venta Bruta ML: <b>${formatCurrency2(data.value[0])}</b></div>
              <div>Fee Reply: <b>${formatCurrency2(data.value[1])}</b></div>
              <div style="margin-top:4px;font-size:11px;">${varStr}</div>
            `;
          }
          return `Venta: <b>${formatCurrency2(param.value[0])}</b><br/>Fee: <b>${formatCurrency2(param.value[1])}</b>`;
        },
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        textStyle: { color: "#0f172a", fontSize: 12 }
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "12%",
        top: "16%",
        containLabel: true
      },
      xAxis: {
        type: "value",
        name: "Facturación Bruta Mercado Libre ($)",
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: 600 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (v: number) => `$${Math.round(v / 1000000)}M`
        }
      },
      yAxis: {
        type: "value",
        name: "Fee de Servicio Reply ($)",
        nameTextStyle: { color: "#64748b", fontSize: 11, fontWeight: 600 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (v: number) => `$${(v / 1000000).toFixed(2)}M`
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
            silent: true,
            symbol: ["none", "none"],
            lineStyle: {
              type: "dashed",
              color: "#ff5100",
              width: 2
            },
            data: [
              {
                yAxis: targetFee,
                label: {
                  formatter: `Meta Fee: ${formatCurrency2(targetFee)}`,
                  position: "end",
                  color: "#ff5100",
                  fontWeight: "bold",
                  fontSize: 11
                }
              }
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
            shadowColor: "rgba(0,0,0,0.2)",
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

    // Evaluamos el período proyectado destacado (ej. 2026-09-01 o el primero proyectado)
    const targetPeriodo = selectedCell?.periodo || "2026-09-01";

    sellersMatrix.forEach((s) => {
      const cell = s.monthsData[targetPeriodo];
      if (cell) {
        const orig = cell.originalFee || 0;
        const key = `${s.sellerId}_${targetPeriodo}`;
        const sim = simulatedFees[key] !== undefined ? simulatedFees[key] : orig;

        originalTotal += orig;
        simulatedTotal += sim;
        if (simulatedFees[key] !== undefined) modifiedCount++;
      }
    });

    const diff = simulatedTotal - originalTotal;
    const diffPct = originalTotal > 0 ? (diff / originalTotal) * 100 : 0;

    return {
      targetPeriodo,
      targetMonthStr: formatMonthStr(targetPeriodo),
      originalTotal,
      simulatedTotal,
      diff,
      diffPct,
      modifiedCount
    };
  }, [sellersMatrix, simulatedFees, selectedCell]);

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
              {formatCurrency2(globalKpis.originalTotal)}
            </p>
          </div>

          <div className="bg-[#eff5ff] border border-[#daebfe] rounded-xl p-3 min-w-[170px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#275ec9]">
              Meta Simulada Reply
            </p>
            <p className="text-base font-extrabold text-[#4981fb] mt-0.5">
              {formatCurrency2(globalKpis.simulatedTotal)}
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
              {globalKpis.diff >= 0 ? "+" : ""}{formatCurrency2(globalKpis.diff)}
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

      {/* 2. Barra de Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#4981fb] focus:border-[#4981fb] outline-none transition-all"
            />
          </div>

          <select
            value={selectedSellerFilter}
            onChange={(e) => setSelectedSellerFilter(e.target.value)}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none"
          >
            <option value="ALL">Todos los clientes ({sellersMatrix.length})</option>
            {sellersMatrix.map((s) => (
              <option key={s.sellerId} value={s.sellerId}>
                {s.sellerName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
            <span>Mes Cerrado (Real)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-[#ff5100]"></span>
            <span className="font-semibold text-slate-700">Mes Proyectado (Editable)</span>
          </div>
        </div>
      </div>

      {/* 3. Tabla Matricial Interactiva de Metas */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[380px]">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-xs text-left text-slate-600 border-collapse">
            <thead className="text-[11px] uppercase tracking-wider bg-slate-50/90 sticky top-0 z-20 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-bold text-slate-700 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[210px]">
                  Seller / Cliente
                </th>
                {allPeriodos.map((p) => {
                  const isProjected = p >= "2026-09-01";
                  return (
                    <th 
                      key={p} 
                      scope="col" 
                      className={`px-3 py-3 font-bold text-center min-w-[170px] border-l border-slate-200 ${
                        isProjected ? "bg-orange-50/40 text-[#ff5100]" : "text-slate-600"
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
                  <td colSpan={allPeriodos.length + 1} className="px-6 py-16 text-center text-slate-400">
                    <div className="animate-pulse">Cargando matrices de liquidación y escalas...</div>
                  </td>
                </tr>
              ) : filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={allPeriodos.length + 1} className="px-6 py-16 text-center text-slate-400">
                    No se encontraron clientes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((row) => (
                  <tr key={row.sellerId} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Columna Fija: Seller */}
                    <td className="px-5 py-3.5 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#4981fb] shrink-0"></span>
                        <div className="truncate max-w-[170px]" title={row.sellerName}>
                          <div className="font-bold text-slate-900 text-xs truncate">{row.sellerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {row.pais} • {row.moneda}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Columnas Mensuales */}
                    {allPeriodos.map((p) => {
                      const cell = row.monthsData[p];
                      const isProjected = p >= "2026-09-01";
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
                                  <span>Aplica mínimo (Venta &lt; {formatCurrency2(inverseResult.primerUmbral)})</span>
                                </div>
                              ) : inverseResult.solutions.length === 1 ? (
                                (() => {
                                  const sol = inverseResult.solutions[0];
                                  return (
                                    <div 
                                      className="flex flex-col text-right cursor-help p-1 -m-1 rounded hover:bg-slate-100/70 transition-colors"
                                      onMouseEnter={(e) => handleTriggerTooltip(e, row.sellerName, p, currentFee, cell?.previousVentaBruta || 0, inverseResult)}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                    >
                                      <div className="font-bold text-slate-800 font-mono">
                                        ML: {formatCurrency2(sol.ventaBruta)}
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
                                    <span className="font-bold text-slate-800">{formatCurrency2(inverseResult.solutions[0].ventaBruta)}</span>
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

            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Venta Mes Anterior</p>
                <p className="text-sm font-bold text-slate-800 font-mono">
                  {inspectionData.previousVenta > 0 ? formatCurrency2(inspectionData.previousVenta) : "No registrada"}
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Fee Objetivo Reply</p>
                <p className="text-sm font-black text-[#ff5100] font-mono">
                  {formatCurrency2(inspectionData.targetFee)}
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
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">Facturación Bruta Requerida</p>
                        <p className="text-xl font-black text-slate-900 mt-0.5 font-mono">
                          {formatCurrency2(sol.ventaBruta)}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-1 mb-2">
                        <div className="flex justify-between text-slate-600">
                          <span>Tramo de Escala:</span>
                          <span className="font-semibold text-slate-800">
                            {formatCurrency2(sol.rangoMin)} {sol.rangoMax ? `a ${formatCurrency2(sol.rangoMax)}` : "en adelante"}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Cálculo:</span>
                          <span className="font-mono text-slate-700">
                            {formatCurrency2(sol.ventaBruta)} × {sol.alicuotaStr}
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

          {/* Gráfico Cartesiano ECharts de la Escala */}
          {inspectionData.chartPoints.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-5">
              <div className="h-72 w-full">
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
                  Debido a los tramos de la escala, este fee neto se puede alcanzar con <strong className="text-[#ff5100] font-bold">{hoveredTooltip.inverseResult.solutions.length} niveles de ventas brutas</strong> en Mercado Libre:
                </p>
              ) : hoveredTooltip.inverseResult.solutions.length === 1 ? (
                <p className="text-[11px] text-slate-600 leading-snug">
                  Venta bruta requerida en Mercado Libre para alcanzar esta meta:
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
                              ★ Menor Venta
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-500 font-mono mt-0.5 truncate">
                          Tramo: {formatCurrency2(sol.rangoMin)} {sol.rangoMax ? `a ${formatCurrency2(sol.rangoMax)}` : "en adelante"}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-slate-900 text-xs">
                          {formatCurrency2(sol.ventaBruta)}
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
