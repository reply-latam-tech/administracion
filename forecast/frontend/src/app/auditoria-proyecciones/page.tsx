"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  Target, 
  Calendar, 
  Filter, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Crown, 
  RefreshCw, 
  Search, 
  ArrowRight,
  Info,
  Clock,
  Zap,
  Activity,
  Layers,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useAuth, OWNER_EMAIL } from "@/context/AuthContext";

interface ConvergencePoint {
  day: number;
  mape: number;
  median_error: number;
  count: number;
}

interface DailyProyItem {
  proyeccion: number;
  desvio_pct: number | null;
  es_teorico?: boolean;
  pct_avance_teorico?: number;
  proy_cierre_fijo?: number;
}

interface SellerSummary {
  seller_id: number;
  nombre: string;
  pais: string;
  moneda: string;
  cierre_real: number | null;
  proy_final: number | null;
  residual: number | null;
  error_pct: number | null;
  calidad: "optima" | "buena" | "alerta" | "en_curso" | "sin_datos";
  sesgo: "sobreestima" | "subestima" | "exacto" | "indeterminado";
  dias_muestreados: number;
  tiene_telemetria_diaria?: boolean;
  metodologia?: string;
  dias_proyeccion?: Record<number, DailyProyItem>;
}

const COUNTRY_FLAGS: Record<string, string> = {
  AR: "🇦🇷",
  MX: "🇲🇽",
  CL: "🇨🇱",
  CO: "🇨🇴",
  US: "🇺🇸",
  ALL: "🌐"
};

interface GlobalStats {
  mape: number;
  mae: number;
  rmse: number;
  mean_residual: number;
  median_residual: number;
  std_dev: number;
  q25: number;
  q75: number;
  iqr: number;
  min_error: number;
  max_error: number;
  tracking_signal: number;
  total_cuentas_cartera?: number;
  total_cuentas_evaluadas: number;
  pct_optimas: number;
  pct_buenas: number;
  pct_alerta: number;
}

export default function AuditoriaProyeccionesPage() {
  const { user, isPropietario, role } = useAuth();
  
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [selectedSeller, setSelectedSeller] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [displayMode, setDisplayMode] = useState<"teorico" | "cierre_fijo">("teorico");
  const [countryCounts, setCountryCounts] = useState<Record<string, number>>({
    ALL: 44,
    AR: 23,
    MX: 8,
    CL: 7,
    CO: 5,
    US: 1
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);

  // Datos provenientes de la API
  const [availableMonths, setAvailableMonths] = useState<string[]>(["2026-10", "2026-09", "2026-08"]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [convergenceCurve, setConvergenceCurve] = useState<ConvergencePoint[]>([]);
  const [distributionBins, setDistributionBins] = useState<{ range: string; count: number; label: string }[]>([]);
  const [sellerSummaries, setSellerSummaries] = useState<SellerSummary[]>([]);

  // Formato numérico
  const formatMoney = (val?: number | null, decimals = 0) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  };

  // Cargar datos de auditoría
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const url = `/api/admin/auditoria?mes=${selectedMonth}&seller_id=${selectedSeller}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(data.availableMonths || []);
        setGlobalStats(data.globalStats || null);
        setConvergenceCurve(data.convergenceCurve || []);
        setDistributionBins(data.distributionBins || []);
        setCountryCounts(data.countryCounts || { ALL: 44, AR: 23, MX: 8, CL: 7, CO: 5, US: 1 });
        setSellerSummaries(data.sellerSummaries || []);
      } else {
        console.error("Error al obtener datos de auditoría:", await res.text());
      }
    } catch (err) {
      console.error("Error de red:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedSeller]);

  // Capturar snapshot mensual
  const handleCaptureSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotSuccess(null);
    try {
      const res = await fetch("/api/admin/auditoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_corte: `${selectedMonth}-01` })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSnapshotSuccess(`¡Snapshot de ${selectedMonth} capturado! Se congelaron ${data.registros_congelados} proyecciones futuras.`);
      } else {
        setSnapshotSuccess(`Aviso: ${data.message || data.error || "No se pudo completar el snapshot."}`);
      }
    } catch (e: any) {
      setSnapshotSuccess(`Error de red: ${e.message}`);
    } finally {
      setSnapshotLoading(false);
      setTimeout(() => setSnapshotSuccess(null), 6000);
    }
  };

  // Ordenamiento por % de desvío
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // Días del mes seleccionado (28, 29, 30 o 31 días)
  const daysInCurrentMonth = useMemo(() => {
    if (!selectedMonth) return 30;
    const parts = selectedMonth.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const daysList = useMemo(() => {
    return Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  }, [daysInCurrentMonth]);

  // Filtrado y ordenamiento de sellers en tabla
  const filteredSellers = useMemo(() => {
    const list = sellerSummaries.filter(s => {
      const matchSearch =
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(s.seller_id).includes(searchTerm) ||
        (s.pais && s.pais.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCountry = selectedCountry === "ALL" || s.pais === selectedCountry;
      return matchSearch && matchCountry;
    });

    return [...list].sort((a, b) => {
      const errA = a.error_pct !== null && a.error_pct !== undefined ? a.error_pct : -1;
      const errB = b.error_pct !== null && b.error_pct !== undefined ? b.error_pct : -1;
      if (errA !== -1 && errB !== -1) {
        return sortDirection === "desc" ? errB - errA : errA - errB;
      }
      if (errA !== -1) return -1;
      if (errB !== -1) return 1;
      if (a.cierre_real !== null && b.cierre_real === null) return -1;
      if (a.cierre_real === null && b.cierre_real !== null) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [sellerSummaries, searchTerm, selectedCountry, sortDirection]);

  // Gráfico 1: Embudo de Convergencia del Error (Día 1 al 31)
  const convergenceChartOptions = useMemo(() => {
    const days = convergenceCurve.map(p => `Día ${p.day}`);
    const mapes = convergenceCurve.map(p => p.mape);
    const medians = convergenceCurve.map(p => p.median_error);

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#334155",
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params: any) => {
          if (!params || params.length === 0) return "";
          const pIndex = params[0].dataIndex;
          const pt = convergenceCurve[pIndex];
          return `
            <div style="font-weight:700;margin-bottom:4px;border-bottom:1px solid #334155;padding-bottom:2px;">
              Día ${pt.day} del Mes (${pt.count} cuentas analizadas)
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px;">
              <span style="color:#94a3b8;">MAPE (Error Promedio):</span>
              <strong style="color:#60a5fa;">${pt.mape.toFixed(2)}%</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;">
              <span style="color:#94a3b8;">Error Mediana:</span>
              <strong style="color:#34d399;">${pt.median_error.toFixed(2)}%</strong>
            </div>
          `;
        }
      },
      legend: {
        data: ["MAPE (Error Medio %)", "Error Mediana %"],
        top: 0,
        textStyle: { color: "#475569", fontSize: 11 }
      },
      grid: {
        left: "2%",
        right: "3%",
        bottom: "8%",
        top: "14%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: days,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 10, interval: 2 }
      },
      yAxis: {
        type: "value",
        name: "Desvío Porcentual (%)",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { type: "dashed", color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: "{value}%"
        }
      },
      series: [
        {
          name: "MAPE (Error Medio %)",
          type: "line",
          smooth: 0.3,
          data: mapes,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: { color: "#2563eb", borderWidth: 2, borderColor: "#ffffff" },
          lineStyle: { width: 3, color: "#2563eb" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(37, 99, 235, 0.25)" },
              { offset: 1, color: "rgba(37, 99, 235, 0.0)" }
            ])
          }
        },
        {
          name: "Error Mediana %",
          type: "line",
          smooth: 0.3,
          data: medians,
          showSymbol: false,
          lineStyle: { width: 2, type: "dashed", color: "#059669" },
          itemStyle: { color: "#059669" }
        }
      ]
    };
  }, [convergenceCurve]);

  // Gráfico 2: Distribución de Frecuencia de Residuos
  const distributionChartOptions = useMemo(() => {
    const labels = distributionBins.map(b => b.range);
    const counts = distributionBins.map(b => b.count);

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#334155",
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params: any) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const bin = distributionBins[idx];
          return `
            <div style="font-weight:700;margin-bottom:2px;">${bin.label}</div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">Rango: ${bin.range}</div>
            <div><strong>${bin.count} cuentas</strong> (${globalStats?.total_cuentas_evaluadas ? Math.round((bin.count / globalStats.total_cuentas_evaluadas) * 100) : 0}%)</div>
          `;
        }
      },
      grid: {
        left: "2%",
        right: "3%",
        bottom: "8%",
        top: "10%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 10 }
      },
      yAxis: {
        type: "value",
        name: "Cuentas",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { type: "dashed", color: "#f1f5f9" } },
        axisLabel: { color: "#64748b", fontSize: 10 }
      },
      series: [
        {
          type: "bar",
          data: counts,
          barWidth: "45%",
          itemStyle: {
            color: (params: any) => {
              const idx = params.dataIndex;
              if (idx === 2 || idx === 3) return "#059669"; // Rango central óptimo (+-5%)
              if (idx === 1 || idx === 4) return "#d97706"; // Rango medio (5-10%)
              return "#dc2626"; // Desvío grande (>10%)
            },
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    };
  }, [distributionBins, globalStats]);

  // Si no es propietario, pantalla de acceso restringido
  if (!isPropietario) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Acceso Exclusivo Propietario
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            La sección de <strong>Auditoría Estadística y Análisis de Residuos</strong> está reservada para el nivel Propietario ({OWNER_EMAIL}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300">
      
      {/* 1. Header Ejecutivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-sm shadow-blue-500/20">
            <BarChart3 size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Auditoría Estadística & Desempeño de Estimaciones
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Crown size={12} /> Propietario
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Control cuantitativo de precisión predictiva, residuales gaussianos, embudo de convergencia día a día y congelamiento de snapshots mensuales.
            </p>
          </div>
        </div>

        {/* Acciones y Selectores */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Mes */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <Calendar size={13} className="text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {m === "2026-10" ? `${m} (En Curso)` : `${m} (Cerrado)`}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Snapshot Mensual */}
          <button
            onClick={handleCaptureSnapshot}
            disabled={snapshotLoading}
            title="Congelar foto oficial de proyecciones a 12 meses"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Camera size={14} className={snapshotLoading ? "animate-spin" : ""} />
            <span>{snapshotLoading ? "Congelando..." : "Snapshot Mensual"}</span>
          </button>

          {/* Botón Refrescar */}
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Alerta de Éxito de Snapshot */}
      {snapshotSuccess && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
          <span className="font-medium">{snapshotSuccess}</span>
        </div>
      )}

      {/* 2. Tarjetas de Estadística Descriptiva (KPIs Matemáticos) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        
        {/* MAPE */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">MAPE Cierre</span>
            <Target size={15} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {globalStats ? `${globalStats.mape.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Error Absoluto Medio</span>
            <span className="font-semibold text-emerald-600">
              {globalStats && globalStats.mape <= 10 ? "Bueno" : "Aceptable"}
            </span>
          </div>
        </div>

        {/* Mediana del Desvío */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mediana Desvío</span>
            <Activity size={15} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-2">
            {globalStats ? `${globalStats.median_residual.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>P50 Robusto (Sin Outliers)</span>
            <span className="font-mono text-slate-500">IQR: {globalStats?.iqr}%</span>
          </div>
        </div>

        {/* Tracking Signal (Sesgo) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tracking Signal</span>
            <Zap size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {globalStats ? `${globalStats.tracking_signal > 0 ? "+" : ""}${globalStats.tracking_signal}` : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Control: [-4.0, +4.0]</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Bajo Control
            </span>
          </div>
        </div>

        {/* Tasa de Calidad Óptima */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tasa Acierto</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {globalStats ? `${(globalStats.pct_optimas + globalStats.pct_buenas)}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Error &le; 8.5%</span>
            <span className="font-mono text-slate-500">
              {globalStats?.total_cuentas_evaluadas} / {globalStats?.total_cuentas_cartera || 44} auditadas
            </span>
          </div>
        </div>

        {/* Desviación Estándar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rango Intercuartil</span>
            <Layers size={15} className="text-indigo-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2 truncate">
            {globalStats ? `[${globalStats.q25}%, ${globalStats.q75}%]` : "—"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Percentiles P25 - P75</span>
            <span className="font-mono text-slate-500">50% Central</span>
          </div>
        </div>
      </div>

      {/* 3. Panel de Gráficos Duales: Convergencia + Distribución de Residuos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gráfico 1: Embudo de Convergencia (8 Columnas) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingDown size={16} className="text-blue-600" />
                Embudo de Convergencia Temporal: Evolución Día a Día
              </h3>
              <p className="text-[11px] text-slate-500">
                Mide cómo el error porcentual (MAPE) se reduce progresivamente del Día 1 al 30 conforme entran datos de la API.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
              Intra-Mes {selectedMonth}
            </span>
          </div>

          <div className="h-[280px] w-full">
            {convergenceCurve.length > 0 ? (
              <ReactECharts
                option={convergenceChartOptions}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No hay suficientes puntos muestreados para graficar la convergencia de este mes.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribución de Residuos (5 Columnas) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Activity size={16} className="text-emerald-600" />
                Distribución de Residuos (Normalidad)
              </h3>
              <p className="text-[11px] text-slate-500">
                Histograma de desvíos en %: La concentración central valida la ausencia de sesgo sistemático.
              </p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {distributionBins.length > 0 ? (
              <ReactECharts
                option={distributionChartOptions}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sin datos de distribución para este mes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tabla de Auditoría Seller por Seller con Evolución Temporal Día a Día */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Cabecera de Tabla con Búsqueda */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Auditoría Temporal y Desglose Diario por Cuenta ({selectedMonth})
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {daysInCurrentMonth} Días Evaluados
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Columnas fijas de resumen ejecutivo (Cuenta, Cierre Real, Desvío %, Calidad y Sesgo) + Evolución diaria (Día 01 al Día {daysInCurrentMonth}) con proyección y desvío % vs. Cierre Real contable.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {/* Selector de Modo Cuentas sin API (Opción B) */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
              <button
                onClick={() => setDisplayMode("teorico")}
                title="Curva de avance acumulado teórico según estacionalidad DOW × DOM (Opción B)"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  displayMode === "teorico"
                    ? "bg-white text-indigo-700 shadow-2xs border border-indigo-200/50"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Avance Teórico (DOW×DOM)
              </button>
              <button
                onClick={() => setDisplayMode("cierre_fijo")}
                title="Proyección mensual fija en todas las celdas"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  displayMode === "cierre_fijo"
                    ? "bg-white text-blue-700 shadow-2xs border border-blue-200/50"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cierre Fijo
              </button>
            </div>

            {/* Botón Invertir Orden */}
            <button
              onClick={() => setSortDirection(s => s === "desc" ? "asc" : "desc")}
              title="Cambiar ordenación por % de desvío"
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ArrowUpDown size={13} className="text-slate-500" />
              <span>{sortDirection === "desc" ? "Mayor Desvío" : "Menor Desvío"}</span>
            </button>

            {/* Buscador */}
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar cuenta por nombre o ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Barra de Filtro Segmentado por País */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
              <Filter size={12} /> País:
            </span>
            {[
              { code: "ALL", label: "Todos los Países", flag: "🌐" },
              { code: "AR", label: "Argentina", flag: "🇦🇷" },
              { code: "MX", label: "México", flag: "🇲🇽" },
              { code: "CL", label: "Chile", flag: "🇨🇱" },
              { code: "CO", label: "Colombia", flag: "🇨🇴" },
              { code: "US", label: "EE.UU.", flag: "🇺🇸" }
            ].map(c => {
              const count = countryCounts[c.code] ?? 0;
              const isSelected = selectedCountry === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCountry(c.code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 font-mono shrink-0 hidden sm:block">
            Mostrando <strong>{filteredSellers.length}</strong> de <strong>{sellerSummaries.length}</strong> cuentas
          </div>
        </div>

        {/* Grilla con Columnas Fijas (Sticky Left) y Scroll Horizontal de Días */}
        <div className="overflow-x-auto max-h-[700px] relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/95 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                
                {/* 1. Cuenta / Seller (Fijo Left 0) */}
                <th className="sticky left-0 top-0 z-40 bg-slate-100 border-b border-r border-slate-200 w-[190px] min-w-[190px] max-w-[190px] px-3.5 py-3">
                  Cuenta / Seller
                </th>

                {/* 2. Cierre Real (Fijo Left 190px) */}
                <th className="sticky left-[190px] top-0 z-40 bg-slate-100 border-b border-r border-slate-200 w-[125px] min-w-[125px] max-w-[125px] px-3.5 py-3 text-right">
                  Cierre Real ($)
                </th>

                {/* 3. Desvío Cierre % (Fijo Left 315px) */}
                <th 
                  onClick={() => setSortDirection(s => s === "desc" ? "asc" : "desc")}
                  className="sticky left-[315px] top-0 z-40 bg-slate-100 border-b border-r border-slate-200 w-[95px] min-w-[95px] max-w-[95px] px-3 py-3 text-right cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Desvío %</span>
                    {sortDirection === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                  </div>
                </th>

                {/* 4. Calidad (Fijo Left 410px) */}
                <th className="sticky left-[410px] top-0 z-40 bg-slate-100 border-b border-r border-slate-200 w-[105px] min-w-[105px] max-w-[105px] px-3 py-3 text-center">
                  Calidad
                </th>

                {/* 5. Sesgo (Fijo Left 515px con sombra divisoria) */}
                <th className="sticky left-[515px] top-0 z-40 bg-slate-100 border-b border-r-2 border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] w-[95px] min-w-[95px] max-w-[95px] px-3 py-3 text-center">
                  Sesgo
                </th>

                {/* 6. Días del Mes (Scrollable Timeline) */}
                {daysList.map(d => (
                  <th
                    key={d}
                    className="sticky top-0 z-30 bg-slate-100/95 border-b border-r border-slate-200/80 text-right px-3 py-3 font-mono font-bold text-[10px] text-slate-600 w-[115px] min-w-[115px] max-w-[115px] whitespace-nowrap"
                  >
                    DÍA {String(d).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5 + daysList.length} className="py-16 text-center text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                    <span>Calculando residuales y matrices diarias de error...</span>
                  </td>
                </tr>
              ) : filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan={5 + daysList.length} className="py-12 text-center text-slate-400 font-sans">
                    No hay cuentas para el filtro seleccionado ({selectedCountry !== "ALL" ? selectedCountry : "cartera"}).
                  </td>
                </tr>
              ) : (
                filteredSellers.map(s => {
                  return (
                    <tr key={s.seller_id} className="group hover:bg-slate-50/90 transition-colors border-b border-slate-100">
                      
                      {/* 1. Cuenta / Seller (Fijo Left 0) */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 w-[190px] min-w-[190px] max-w-[190px] px-3.5 py-2.5 font-sans font-bold text-slate-900">
                        <div className="flex flex-col truncate" title={`${s.nombre} (${s.moneda})`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs shrink-0">{COUNTRY_FLAGS[s.pais] || "🌐"}</span>
                            <span className="truncate">{s.nombre}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-mono font-normal text-slate-400 mt-0.5">
                            <span className="font-semibold text-slate-600">{s.pais}</span>
                            <span>•</span>
                            <span>{s.moneda}</span>
                            <span>•</span>
                            {s.tiene_telemetria_diaria ? (
                              <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="Telemetría API en Vivo">
                                API
                              </span>
                            ) : (
                              <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title="Modelo Estacional DOW × DOM (Opción B)">
                                ESTACIONAL
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Cierre Real (Fijo Left 190px) */}
                      <td className="sticky left-[190px] z-20 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 w-[125px] min-w-[125px] max-w-[125px] px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        {s.cierre_real !== null ? (
                          `$ ${formatMoney(s.cierre_real)}`
                        ) : (
                          <span className="text-slate-400 font-sans text-xs font-normal">En curso</span>
                        )}
                      </td>

                      {/* 3. Desvío Cierre % (Fijo Left 315px) */}
                      <td className="sticky left-[315px] z-20 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 w-[95px] min-w-[95px] max-w-[95px] px-3 py-2.5 text-right font-mono font-bold">
                        {s.error_pct !== null ? (
                          <span className={
                            s.error_pct < 3.5 
                              ? "text-emerald-600" 
                              : s.error_pct <= 8.5 
                              ? "text-amber-600" 
                              : "text-rose-600"
                          }>
                            {s.error_pct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* 4. Calidad (Fijo Left 410px) */}
                      <td className="sticky left-[410px] z-20 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 w-[105px] min-w-[105px] max-w-[105px] px-2 py-2.5 text-center font-sans">
                        {s.calidad === "optima" && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Óptima (&lt;3.5%)
                          </span>
                        )}
                        {s.calidad === "buena" && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Buena (&le;8.5%)
                          </span>
                        )}
                        {s.calidad === "alerta" && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Desvío &gt;8.5%
                          </span>
                        )}
                        {s.calidad === "en_curso" && (
                          <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Mes en Curso
                          </span>
                        )}
                        {s.calidad === "sin_datos" && (
                          <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200" title="Cierre contable registrado sin telemetría predictiva diaria">
                            Cierre Contable
                          </span>
                        )}
                      </td>

                      {/* 5. Sesgo (Fijo Left 515px con sombra divisoria) */}
                      <td className="sticky left-[515px] z-20 bg-white group-hover:bg-slate-50 transition-colors border-r-2 border-slate-300 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] w-[95px] min-w-[95px] max-w-[95px] px-2 py-2.5 text-center font-sans text-[11px]">
                        {s.sesgo === "sobreestima" && (
                          <span className="text-amber-600 font-medium">Sobreestimó</span>
                        )}
                        {s.sesgo === "subestima" && (
                          <span className="text-blue-600 font-medium">Subestimó</span>
                        )}
                        {s.sesgo === "exacto" && (
                          <span className="text-emerald-600 font-semibold">Exacto</span>
                        )}
                        {s.sesgo === "indeterminado" && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 6. Días del Mes (Scrollable Timeline) */}
                      {daysList.map(d => {
                        const dayItem = s.dias_proyeccion ? s.dias_proyeccion[d] : null;
                        
                        if (!dayItem || dayItem.proyeccion === null || dayItem.proyeccion === undefined) {
                          return (
                            <td
                              key={d}
                              className="w-[115px] min-w-[115px] max-w-[115px] px-3 py-2 text-right border-r border-slate-100/90 font-mono bg-white group-hover:bg-slate-50/70"
                            >
                              <span className="text-slate-300 text-xs">—</span>
                            </td>
                          );
                        }

                        // Determinar valor a mostrar según el modo seleccionado
                        const valToShow = (dayItem.es_teorico && displayMode === "cierre_fijo" && dayItem.proy_cierre_fijo)
                          ? dayItem.proy_cierre_fijo
                          : dayItem.proyeccion;

                        return (
                          <td
                            key={d}
                            className="w-[115px] min-w-[115px] max-w-[115px] px-3 py-2 text-right border-r border-slate-100/90 font-mono bg-white group-hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex flex-col items-end leading-tight">
                              {/* Valor numérico */}
                              <span className="text-[11px] font-bold text-slate-800 tracking-tight">
                                ${formatMoney(valToShow)}
                              </span>

                              {/* Micro-badge de Desvío / Avance */}
                              {dayItem.es_teorico ? (
                                d === daysList.length && s.cierre_real !== null && dayItem.desvio_pct !== null ? (
                                  <span
                                    className={`text-[9.5px] font-bold px-1 py-0.2 rounded mt-0.5 inline-block ${
                                      Math.abs(dayItem.desvio_pct) <= 5.0
                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                                        : Math.abs(dayItem.desvio_pct) <= 8.5
                                        ? "text-amber-700 bg-amber-50 border border-amber-200/60"
                                        : "text-rose-700 bg-rose-50 border border-rose-200/60"
                                    }`}
                                    title={`Proyectado mes: $${formatMoney(dayItem.proy_cierre_fijo || dayItem.proyeccion)} vs Cierre Real: $${formatMoney(s.cierre_real)}`}
                                  >
                                    {dayItem.desvio_pct > 0 ? `+${dayItem.desvio_pct.toFixed(1)}%` : `${dayItem.desvio_pct.toFixed(1)}%`}
                                  </span>
                                ) : displayMode === "cierre_fijo" && dayItem.desvio_pct !== null ? (
                                  <span
                                    className={`text-[9px] font-medium px-1 py-0.2 rounded mt-0.5 inline-block ${
                                      Math.abs(dayItem.desvio_pct) <= 5.0
                                        ? "text-slate-600 bg-slate-100 border border-slate-200"
                                        : "text-amber-700 bg-amber-50 border border-amber-200/60"
                                    }`}
                                  >
                                    {dayItem.desvio_pct > 0 ? `+${dayItem.desvio_pct.toFixed(1)}%` : `${dayItem.desvio_pct.toFixed(1)}%`}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[9px] font-semibold px-1 py-0.2 rounded mt-0.5 inline-block text-indigo-700 bg-indigo-50/90 border border-indigo-200/60"
                                    title={`Avance acumulado teórico esperado al Día ${d}: ${dayItem.pct_avance_teorico}% (Curva DOW × DOM)`}
                                  >
                                    {dayItem.pct_avance_teorico?.toFixed(1)}% acum.
                                  </span>
                                )
                              ) : (
                                s.cierre_real !== null && s.cierre_real > 0 && dayItem.desvio_pct !== null ? (
                                  <span
                                    className={`text-[9.5px] font-bold px-1 py-0.2 rounded mt-0.5 inline-block ${
                                      Math.abs(dayItem.desvio_pct) <= 5.0
                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                                        : Math.abs(dayItem.desvio_pct) <= 8.5
                                        ? "text-amber-700 bg-amber-50 border border-amber-200/60"
                                        : "text-rose-700 bg-rose-50 border border-rose-200/60"
                                    }`}
                                  >
                                    {dayItem.desvio_pct > 0 ? `+${dayItem.desvio_pct.toFixed(1)}%` : `${dayItem.desvio_pct.toFixed(1)}%`}
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] text-slate-400 font-sans mt-0.5">
                                    {s.cierre_real === null ? "En curso" : "—"}
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
