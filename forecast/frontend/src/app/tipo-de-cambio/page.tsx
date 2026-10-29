"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Filter, 
  Download, 
  Database, 
  RefreshCw, 
  Globe, 
  TrendingUp,
  Search,
  DollarSign,
  CheckCircle2
} from "lucide-react";
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { supabase } from "@/lib/supabase";

// Interfaz para la cotización de un mes
interface TipoCambioRow {
  periodo: string; // 'YYYY-MM-DD' o 'YYYY-MM'
  ars: number | null;
  mxn: number | null;
  pen: number | null;
  clp: number | null;
  cop: number | null;
  moneda_base: string;
  fuente?: string;
  estado?: 'REAL' | 'PROYECTADO';
}

// Datos predeterminados sincronizados con tipo_de_cambio.txt (33 Reales + 12 Proyectados)
const DEFAULT_DATA: TipoCambioRow[] = [
  { periodo: '2024-01-01', ars: null, mxn: 17.16, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-02-01', ars: null, mxn: 17.06, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-03-01', ars: null, mxn: 16.67, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-04-01', ars: null, mxn: 16.93, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-05-01', ars: null, mxn: 17.63, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-06-01', ars: null, mxn: 17.96, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-07-01', ars: null, mxn: 19.04, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-08-01', ars: null, mxn: 19.80, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-09-01', ars: null, mxn: 19.67, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-10-01', ars: null, mxn: 20.16, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-11-01', ars: null, mxn: 20.42, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-12-01', ars: null, mxn: 20.27, pen: null, clp: null, cop: null, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-01-01', ars: 1032.0, mxn: 19.50, pen: 3.75, clp: 996.46, cop: 3950.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-02-01', ars: 1046.0, mxn: 19.60, pen: 3.76, clp: 956.90, cop: 3970.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-03-01', ars: 1060.0, mxn: 19.70, pen: 3.77, clp: 946.59, cop: 3990.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-04-01', ars: 1197.74, mxn: 19.61, pen: 3.70, clp: 940.18, cop: 4305.02, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-05-01', ars: 1150.0, mxn: 19.23, pen: 3.66, clp: 935.00, cop: 4107.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-06-01', ars: 1215.0, mxn: 18.83, pen: 3.62, clp: 926.62, cop: 3974.37, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-07-01', ars: 1330.0, mxn: 18.80, pen: 3.56, clp: 964.28, cop: 4097.38, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-08-01', ars: 1330.0, mxn: 18.65, pen: 3.54, clp: 965.28, cop: 4016.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-09-01', ars: 1450.0, mxn: 18.35, pen: 3.50, clp: 959.19, cop: 3897.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-10-01', ars: 1480.0, mxn: 18.54, pen: 3.43, clp: 940.53, cop: 1.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-11-01', ars: 1420.0, mxn: 18.35, pen: 3.37, clp: 928.00, cop: 3784.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-12-01', ars: 1450.0, mxn: 18.00, pen: 3.37, clp: 911.18, cop: 3790.77, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-01-01', ars: 1430.0, mxn: 17.29, pen: 3.36, clp: 860.00, cop: 3622.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-02-01', ars: 1395.0, mxn: 17.22, pen: 3.36, clp: 884.21, cop: 3769.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-03-01', ars: 1405.0, mxn: 18.00, pen: 3.44, clp: 927.46, cop: 3660.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-04-01', ars: 1420.0, mxn: 17.47, pen: 3.51, clp: 903.05, cop: 3660.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-05-01', ars: 1427.0, mxn: 17.29, pen: 3.39, clp: 892.91, cop: 3562.0, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-06-01', ars: 1490.0, mxn: 17.51, pen: 3.39, clp: 922.21, cop: 3440.83, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-07-01', ars: 1525.0, mxn: 17.46, pen: 3.41, clp: 941.93, cop: 3205.80, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-08-01', ars: 1530.0, mxn: 16.97, pen: 3.40, clp: 929.18, cop: 3213.97, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-09-01', ars: 1565.0, mxn: 18.07, pen: 3.36, clp: 972.60, cop: 3312.84, moneda_base: 'USD', estado: 'REAL' },
  // 12 Meses Proyectados para proyecciones futuras (2026-10 a 2027-09)
  { periodo: '2026-10-01', ars: 1590.0, mxn: 18.12, pen: 3.36, clp: 975.00, cop: 3325.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2026-11-01', ars: 1615.0, mxn: 18.18, pen: 3.37, clp: 978.00, cop: 3340.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2026-12-01', ars: 1645.0, mxn: 18.25, pen: 3.37, clp: 982.00, cop: 3360.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-01-01', ars: 1670.0, mxn: 18.32, pen: 3.38, clp: 985.00, cop: 3375.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-02-01', ars: 1695.0, mxn: 18.38, pen: 3.38, clp: 989.00, cop: 3390.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-03-01', ars: 1720.0, mxn: 18.45, pen: 3.39, clp: 993.00, cop: 3410.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-04-01', ars: 1745.0, mxn: 18.52, pen: 3.39, clp: 998.00, cop: 3425.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-05-01', ars: 1770.0, mxn: 18.60, pen: 3.40, clp: 1002.00, cop: 3440.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-06-01', ars: 1795.0, mxn: 18.68, pen: 3.40, clp: 1006.00, cop: 3455.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-07-01', ars: 1820.0, mxn: 18.75, pen: 3.41, clp: 1010.00, cop: 3470.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-08-01', ars: 1845.0, mxn: 18.82, pen: 3.41, clp: 1014.00, cop: 3485.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-09-01', ars: 1870.0, mxn: 18.90, pen: 3.42, clp: 1018.00, cop: 3500.00, moneda_base: 'USD', estado: 'PROYECTADO' },
];

type CurrencyKey = 'ars' | 'mxn' | 'pen' | 'clp' | 'cop';

interface CurrencyConfig {
  key: CurrencyKey;
  code: string;
  label: string;
  country: string;
  flag: string;
  symbol: string;
  decimals: number;
  color: string;
  bgLight: string;
}

const CURRENCIES: CurrencyConfig[] = [
  { key: 'ars', code: 'ARS', label: 'Argentina', country: 'AR', flag: '🇦🇷', symbol: '$', decimals: 2, color: '#2563eb', bgLight: 'bg-blue-50' },
  { key: 'mxn', code: 'MXN', label: 'México', country: 'MX', flag: '🇲🇽', symbol: '$', decimals: 2, color: '#059669', bgLight: 'bg-emerald-50' },
  { key: 'pen', code: 'PEN', label: 'Perú', country: 'PE', flag: '🇵🇪', symbol: 'S/', decimals: 2, color: '#d97706', bgLight: 'bg-amber-50' },
  { key: 'clp', code: 'CLP', label: 'Chile', country: 'CL', flag: '🇨🇱', symbol: '$', decimals: 2, color: '#dc2626', bgLight: 'bg-red-50' },
  { key: 'cop', code: 'COP', label: 'Colombia', country: 'CO', flag: '🇨🇴', symbol: '$', decimals: 2, color: '#7c3aed', bgLight: 'bg-purple-50' },
];

export default function TipoDeCambioPage() {
  const [data, setData] = useState<TipoCambioRow[]>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [isLiveFromDb, setIsLiveFromDb] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'REAL' | 'PROYECTADO'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Moneda seleccionada por defecto: siempre ARS
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('ars');

  // Cargar datos de Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbData, error } = await supabase
        .from('tipo_de_cambio')
        .select('*')
        .order('periodo', { ascending: true });

      if (error || !dbData || dbData.length === 0) {
        console.warn('No se pudo leer tipo_de_cambio de Supabase. Usando datos sincronizados.');
        setIsLiveFromDb(false);
        setData(DEFAULT_DATA);
      } else {
        setIsLiveFromDb(true);
        setData(dbData);
      }
    } catch (e) {
      console.warn('Error consultando Supabase:', e);
      setIsLiveFromDb(false);
      setData(DEFAULT_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrado de columnas (meses)
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const p = row.periodo;
      if (selectedYear !== 'ALL') {
        if (!p.startsWith(selectedYear)) return false;
      }
      if (selectedStatus !== 'ALL') {
        const isProj = row.estado === 'PROYECTADO' || p >= '2026-10-01';
        if (selectedStatus === 'REAL' && isProj) return false;
        if (selectedStatus === 'PROYECTADO' && !isProj) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (!p.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [data, selectedYear, selectedStatus, searchTerm]);

  // Moneda activa seleccionada
  const activeCurrencyObj = useMemo(() => {
    return CURRENCIES.find(c => c.key === selectedCurrency) || CURRENCIES[0];
  }, [selectedCurrency]);

  // Último registro real para los KPI cards de cotización vigente
  const latestRealRow = useMemo(() => {
    const reals = data.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-09-01');
    return reals.length ? reals[reals.length - 1] : (data.length ? data[data.length - 1] : null);
  }, [data]);

  // Penúltimo registro para variaciones MoM en KPIs
  const previousRow = useMemo(() => {
    const reals = data.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-09-01');
    if (reals.length < 2) return null;
    return reals[reals.length - 2];
  }, [data]);

  // Formateador numérico
  const formatVal = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  };

  // Formato corto de período para encabezados de columnas (ej. "Sep 26")
  const formatShortPeriod = (p: string) => {
    const clean = p.substring(0, 7);
    const [yyyy, mm] = clean.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mIdx = parseInt(mm, 10) - 1;
    return `${monthNames[mIdx] || mm} ${yyyy.substring(2)}`;
  };

  // Formato completo para tooltips
  const formatFullPeriod = (p: string) => {
    const clean = p.substring(0, 7);
    const [yyyy, mm] = clean.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mIdx = parseInt(mm, 10) - 1;
    return `${monthNames[mIdx] || mm} ${yyyy}`;
  };

  // Cálculo de variación porcentual respecto al mes anterior en la tabla
  const getMoMVariation = (currentIndex: number, currKey: CurrencyKey) => {
    if (currentIndex <= 0) return null;
    const currentVal = filteredData[currentIndex][currKey] as number | null;
    const prevVal = filteredData[currentIndex - 1][currKey] as number | null;
    if (!currentVal || !prevVal || prevVal === 0) return null;
    return ((currentVal - prevVal) / prevVal) * 100;
  };

  // Estadísticas de la moneda seleccionada para el gráfico
  const currencyStats = useMemo(() => {
    const values = filteredData
      .map(r => r[selectedCurrency] as number | null)
      .filter((v): v is number => v !== null && v > 0);

    if (!values.length) {
      return { minVal: 0, maxVal: 0, latestVal: 0, totalChange: 0 };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const firstVal = values[0];
    const latestVal = values[values.length - 1];
    const totalChange = firstVal > 0 ? ((latestVal - firstVal) / firstVal) * 100 : 0;

    return { minVal, maxVal, latestVal, totalChange };
  }, [filteredData, selectedCurrency]);

  // Configuración de ECharts para el gráfico de línea con puntos
  const chartOptions = useMemo(() => {
    const activeCurr = activeCurrencyObj;
    const xAxisData = filteredData.map(r => formatShortPeriod(r.periodo));
    const seriesData = filteredData.map(r => r[activeCurr.key] as number | null);

    const validVals = seriesData.filter((v): v is number => v !== null && v > 0);
    const minVal = validVals.length ? Math.min(...validVals) : 0;
    const maxVal = validVals.length ? Math.max(...validVals) : 100;
    const padding = (maxVal - minVal) * 0.12 || (minVal * 0.05) || 5;
    const yAxisMin = Math.max(0, Math.floor(minVal - padding));
    const yAxisMax = Math.ceil(maxVal + padding);

    // Índice de inicio de proyecciones
    const projStartIndex = filteredData.findIndex(r => r.estado === 'PROYECTADO' || r.periodo >= '2026-10-01');

    return {
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px;',
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          const item = params[0];
          const dataIndex = item.dataIndex;
          const row = filteredData[dataIndex];
          const val = row[activeCurr.key] as number | null;
          const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-10-01';

          let varStr = '—';
          if (dataIndex > 0) {
            const prev = filteredData[dataIndex - 1][activeCurr.key] as number | null;
            if (val && prev) {
              const pct = ((val - prev) / prev) * 100;
              const sign = pct > 0 ? '+' : '';
              const color = pct > 0 ? '#d97706' : '#059669';
              varStr = `<span style="color:${color};font-weight:700;">${sign}${pct.toFixed(2)}%</span>`;
            }
          }

          return `
            <div style="min-width: 180px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;">
                <span style="font-weight:700;color:#0f172a;font-size:13px;">${formatFullPeriod(row.periodo)}</span>
                <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${isProj ? '#f3e8ff' : '#f1f5f9'};color:${isProj ? '#7e22ce' : '#475569'};">
                  ${isProj ? 'PROYECTADO' : 'REAL'}
                </span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;">
                <span style="color:#64748b;font-size:12px;">1 USD =</span>
                <span style="font-weight:800;color:${activeCurr.color};font-family:monospace;font-size:13px;">
                  ${activeCurr.symbol} ${formatVal(val, activeCurr.decimals)}
                </span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;">
                <span style="color:#64748b;">Variación MoM:</span>
                <span>${varStr}</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: filteredData.length > 20 ? '16%' : '10%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { alignWithLabel: true, lineStyle: { color: '#cbd5e1' } },
        axisLabel: { 
          color: '#64748b', 
          fontSize: 11,
          interval: filteredData.length > 25 ? 1 : 0,
          rotate: filteredData.length > 15 ? 45 : 0
        }
      },
      yAxis: {
        type: 'value',
        min: yAxisMin,
        max: yAxisMax,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (val: number) => `${activeCurr.symbol} ${formatVal(val, activeCurr.decimals)}`
        }
      },
      series: [
        {
          name: activeCurr.code,
          type: 'line',
          smooth: 0.25,
          data: seriesData,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: {
            color: activeCurr.color,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          lineStyle: {
            color: activeCurr.color,
            width: 3,
            shadowColor: 'rgba(0,0,0,0.08)',
            shadowBlur: 8,
            shadowOffsetY: 4
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${activeCurr.color}35` },
              { offset: 1, color: `${activeCurr.color}00` }
            ])
          },
          markArea: projStartIndex > 0 ? {
            silent: true,
            data: [
              [
                {
                  xAxis: xAxisData[projStartIndex],
                  itemStyle: { color: 'rgba(147, 51, 234, 0.04)' }
                },
                {
                  xAxis: xAxisData[xAxisData.length - 1]
                }
              ]
            ]
          } : undefined,
          markLine: projStartIndex > 0 ? {
            symbol: ['none', 'none'],
            silent: true,
            label: {
              formatter: 'Inicio Proyecciones',
              position: 'insideStartTop',
              color: '#7e22ce',
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: '#faf5ff',
              padding: [3, 6],
              borderRadius: 4,
              borderColor: '#e9d5ff',
              borderWidth: 1
            },
            lineStyle: {
              color: '#9333ea',
              type: 'dashed',
              width: 1.5
            },
            data: [{ xAxis: xAxisData[projStartIndex] }]
          } : undefined
        }
      ]
    };
  }, [filteredData, activeCurrencyObj]);

  // Exportar a CSV
  const handleExportCSV = () => {
    const headers = ['Periodo', 'ARS (Argentina)', 'MXN (México)', 'PEN (Perú)', 'CLP (Chile)', 'COP (Colombia)', 'Moneda_Base', 'Estado'];
    const rows = filteredData.map(r => [
      r.periodo.substring(0, 7),
      r.ars ?? '',
      r.mxn ?? '',
      r.pen ?? '',
      r.clp ?? '',
      r.cop ?? '',
      r.moneda_base || 'USD',
      r.estado || (r.periodo >= '2026-10-01' ? 'PROYECTADO' : 'REAL')
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tipos_de_cambio_reply_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 w-full select-none">
      
      {/* 1. Header de Sección */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Coins size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Tipos de Cambio Oficiales (FX Regional)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Moneda Base: USD
              </span>
              {isLiveFromDb ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Database size={11} /> Sincronizado en Vivo
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Datos de Archivo Base
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Cotizaciones mensuales para liquidación, proyección y conversión a USD de todas las cuentas del exterior (Argentina, México, Perú, Chile, Colombia).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-blue-600" : ""} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Download size={13} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas KPI de Cotización Vigente (Clickables para cambiar la moneda activa) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {CURRENCIES.map((curr) => {
          const val = latestRealRow ? (latestRealRow[curr.key] as number | null) : null;
          const prev = previousRow ? (previousRow[curr.key] as number | null) : null;
          const isSelected = selectedCurrency === curr.key;
          
          let mom: number | null = null;
          if (val && prev) {
            mom = ((val - prev) / prev) * 100;
          }
          const isUp = mom !== null && mom > 0;

          return (
            <div
              key={curr.key}
              onClick={() => setSelectedCurrency(curr.key)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-white ring-2 ring-blue-600 shadow-md border-blue-300'
                  : 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0" 
                    style={{ backgroundColor: `${curr.color}15`, color: curr.color, border: `1px solid ${curr.color}35` }}
                  >
                    {curr.country}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">{curr.code} / USD</span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">{curr.label}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                    <CheckCircle2 size={10} /> Activa
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-xl font-bold font-mono tracking-tight text-slate-900">
                  {curr.symbol} {formatVal(val, curr.decimals)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Último: {latestRealRow ? formatShortPeriod(latestRealRow.periodo) : '—'}</span>
                  {mom !== null && (
                    <span className={`font-semibold flex items-center ${isUp ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {Math.abs(mom).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Controles de Filtrado de Columnas (Años y Estado) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar size={13} />
              Año:
            </span>
            {['ALL', '2027', '2026', '2025', '2024'].map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedYear === year
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {year === 'ALL' ? 'Todos los Años' : year}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter size={13} />
              Estado:
            </span>
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'REAL', label: 'Solo Reales' },
              { id: 'PROYECTADO', label: 'Solo Proyectados' }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? st.id === 'PROYECTADO'
                      ? 'bg-purple-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-800 text-white font-bold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por período (ej. 2026)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 4. Tabla Horizontal Pivotada (Filas = Monedas, Columnas = Meses) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Matriz Mensual de Cotizaciones por Moneda
            </h2>
            <p className="text-xs text-slate-500">
              {filteredData.length} meses en columnas • Haz clic en una fila para seleccionarla y ver su evolución gráfica abajo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Unidades de Moneda Local por 1 USD
            </span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[680px] relative border-t border-slate-100">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold tracking-wider">
                {/* Columna fija de Moneda */}
                <th className="py-3 px-4 sticky left-0 top-0 z-30 bg-slate-100 min-w-[210px] border-r border-b border-slate-200 text-slate-800 text-left font-bold shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  Moneda / País
                </th>

                {/* Columnas de Períodos */}
                {filteredData.map((row) => {
                  const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-10-01';
                  return (
                    <th 
                      key={row.periodo} 
                      className={`py-2.5 px-3.5 text-center min-w-[105px] whitespace-nowrap border-r border-b border-slate-200 sticky top-0 z-20 ${
                        isProj ? 'bg-purple-50/95 text-purple-950' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="font-bold text-slate-800 text-[11px]">
                        {formatShortPeriod(row.periodo)}
                      </div>
                      <div className="mt-0.5">
                        {isProj ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                            PROY
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-400">
                            REAL
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {CURRENCIES.map((curr) => {
                const isSelected = selectedCurrency === curr.key;

                return (
                  <tr
                    key={curr.key}
                    onClick={() => setSelectedCurrency(curr.key)}
                    className={`transition-all cursor-pointer group ${
                      isSelected 
                        ? 'bg-blue-50/70 border-l-4 border-blue-600 font-medium' 
                        : 'hover:bg-slate-50/80 bg-white border-l-4 border-transparent'
                    }`}
                  >
                    {/* Celda Fija de la Moneda */}
                    <td className={`py-3.5 px-4 sticky left-0 z-20 border-r border-slate-200 backdrop-blur-xs transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.02)] ${
                      isSelected ? 'bg-blue-50/95 text-blue-950' : 'bg-white group-hover:bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0" 
                            style={{ backgroundColor: `${curr.color}15`, color: curr.color, border: `1px solid ${curr.color}35` }}
                          >
                            {curr.country}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 leading-tight">
                              <span className="font-bold text-slate-900 text-sm tracking-tight">{curr.code}</span>
                              <span className="text-xs text-slate-500 font-medium">({curr.label})</span>
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs shrink-0">
                            Activa
                          </span>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                            Ver gráfico
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Celdas mensuales */}
                    {filteredData.map((row, idx) => {
                      const val = row[curr.key] as number | null;
                      const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-10-01';
                      const mom = idx > 0 ? getMoMVariation(idx, curr.key) : null;
                      const isUp = mom !== null && mom > 0;

                      return (
                        <td 
                          key={row.periodo} 
                          className={`py-2.5 px-3 text-right font-mono border-r border-slate-100 whitespace-nowrap ${
                            isProj ? (isSelected ? 'bg-purple-50/30' : 'bg-purple-50/15') : ''
                          }`}
                        >
                          {val !== null ? (
                            <div>
                              <span className={`text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                                {curr.symbol} {formatVal(val, curr.decimals)}
                              </span>
                              {mom !== null && (
                                <div className="text-[10px] mt-0.5 font-sans leading-none">
                                  <span className={isUp ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                                    {isUp ? '+' : ''}{mom.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-sans text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer de la Tabla */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Mostrando 5 monedas en filas. Desplaza horizontalmente para explorar los meses.
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Moneda seleccionada para el gráfico: <strong className="text-slate-700">{activeCurrencyObj.code} ({activeCurrencyObj.label})</strong>
          </span>
        </div>
      </div>

      {/* 5. Gráfico de Línea con Puntos de la Moneda Seleccionada */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs shrink-0"
              style={{ backgroundColor: `${activeCurrencyObj.color}15`, color: activeCurrencyObj.color, border: `1px solid ${activeCurrencyObj.color}35` }}
            >
              {activeCurrencyObj.country}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Evolución y Proyección de Tipo de Cambio: {activeCurrencyObj.code} / USD ({activeCurrencyObj.label})
                </h3>
                <span 
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${activeCurrencyObj.color}20`, color: activeCurrencyObj.color }}
                >
                  {activeCurrencyObj.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Valores mensuales de cotización oficial por 1 USD • Haz clic en las filas de la tabla superior para cambiar de moneda
              </p>
            </div>
          </div>

          {/* Estadísticas Rápidas de la Moneda */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Último Real:</span>
              <span className="font-bold font-mono text-slate-900">
                {activeCurrencyObj.symbol} {formatVal(currencyStats.latestVal, activeCurrencyObj.decimals)}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Mínimo Período:</span>
              <span className="font-bold font-mono text-slate-700">
                {activeCurrencyObj.symbol} {formatVal(currencyStats.minVal, activeCurrencyObj.decimals)}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Máximo Período:</span>
              <span className="font-bold font-mono text-slate-700">
                {activeCurrencyObj.symbol} {formatVal(currencyStats.maxVal, activeCurrencyObj.decimals)}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Variación Total:</span>
              <span className={`font-bold font-mono ${currencyStats.totalChange >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {currencyStats.totalChange >= 0 ? '+' : ''}{currencyStats.totalChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* ECharts Line Chart */}
        <div className="w-full h-[340px]">
          <ReactECharts 
            option={chartOptions} 
            style={{ height: '100%', width: '100%' }} 
            opts={{ renderer: 'canvas' }}
            notMerge={true}
          />
        </div>
      </div>

    </div>
  );
}
