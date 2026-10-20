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
  ExternalLink,
  DollarSign
} from "lucide-react";
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

const CURRENCIES = [
  { key: 'ars', code: 'ARS', label: 'Argentina', flag: '🇦🇷', symbol: '$', decimals: 2 },
  { key: 'mxn', code: 'MXN', label: 'México', flag: '🇲🇽', symbol: '$', decimals: 2 },
  { key: 'pen', code: 'PEN', label: 'Perú', flag: '🇵🇪', symbol: 'S/', decimals: 2 },
  { key: 'clp', code: 'CLP', label: 'Chile', flag: '🇨🇱', symbol: '$', decimals: 2 },
  { key: 'cop', code: 'COP', label: 'Colombia', flag: '🇨🇴', symbol: '$', decimals: 2 },
] as const;

export default function TipoDeCambioPage() {
  const [data, setData] = useState<TipoCambioRow[]>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [isLiveFromDb, setIsLiveFromDb] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'REAL' | 'PROYECTADO'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCurrencyTab, setSelectedCurrencyTab] = useState<string>('all');

  // Cargar datos de Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbData, error } = await supabase
        .from('tipo_de_cambio')
        .select('*')
        .order('periodo', { ascending: true });

      if (error || !dbData || dbData.length === 0) {
        console.warn('No se pudo leer tipo_de_cambio de Supabase o tabla no creada aún. Usando datos base de tipo_de_cambio.txt.');
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

  // Filtrado de filas
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

  // Último registro real para los KPI cards de cotización vigente
  const latestRealRow = useMemo(() => {
    const reals = data.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-09-01');
    return reals.length ? reals[reals.length - 1] : (data.length ? data[data.length - 1] : null);
  }, [data]);

  const latestRow = latestRealRow;

  // Penúltimo registro para variaciones
  const previousRow = useMemo(() => {
    const reals = data.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-09-01');
    if (reals.length < 2) return null;
    return reals[reals.length - 2];
  }, [data]);

  // Formateador numérico
  const formatVal = (val: number | null, decimals = 2) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  };

  // Formateador de periodo a texto amigable
  const formatPeriodLabel = (p: string) => {
    const clean = p.substring(0, 7);
    const [yyyy, mm] = clean.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mIdx = parseInt(mm, 10) - 1;
    return `${monthNames[mIdx] || mm} ${yyyy}`;
  };

  // Cálculo de variación porcentual respecto al mes anterior
  const getMoMVariation = (currentIndex: number, currKey: keyof TipoCambioRow) => {
    if (currentIndex <= 0) return null;
    const currentVal = filteredData[currentIndex][currKey] as number | null;
    const prevVal = filteredData[currentIndex - 1][currKey] as number | null;
    if (!currentVal || !prevVal || prevVal === 0) return null;
    return ((currentVal - prevVal) / prevVal) * 100;
  };

  // Descargar como CSV
  const handleExportCSV = () => {
    const headers = ['Periodo', 'ARS (Argentina)', 'MXN (México)', 'PEN (Perú)', 'CLP (Chile)', 'COP (Colombia)', 'Moneda_Base'];
    const rows = filteredData.map(r => [
      r.periodo.substring(0, 7),
      r.ars ?? '',
      r.mxn ?? '',
      r.pen ?? '',
      r.clp ?? '',
      r.cop ?? '',
      r.moneda_base || 'USD'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tipos_de_cambio_reply_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 space-y-6">
      {/* 1. Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <Coins size={22} className="text-[#275ec9]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Tipos de Cambio Oficiales (FX Regional)
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200/60">
                  Moneda Base: USD
                </span>
                {isLiveFromDb ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    En Vivo (Supabase)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Datos de Archivo Base
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Cotizaciones mensuales para liquidación, proyección y conversión a USD de todas las cuentas del exterior (Argentina, México, Perú, Chile, Colombia).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-200/80 cursor-pointer shadow-2xs"
            title="Recargar datos desde la base de datos"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            Actualizar
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all border border-slate-200/90 cursor-pointer shadow-2xs"
            title="Exportar cotizaciones a Excel / CSV"
          >
            <Download size={14} className="text-slate-500" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* 2. Cards de Resumen por Moneda (Última Cotización Oficial Registrada) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {CURRENCIES.map(curr => {
          const val = latestRow ? (latestRow[curr.key as keyof TipoCambioRow] as number | null) : null;
          const prevVal = previousRow ? (previousRow[curr.key as keyof TipoCambioRow] as number | null) : null;
          const mom = val && prevVal && prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : null;
          const isUp = mom !== null && mom > 0;

          return (
            <div 
              key={curr.code} 
              className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span className="text-base">{curr.flag}</span>
                  {curr.code} / USD
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {curr.label}
                </span>
              </div>

              <div className="pt-1">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {curr.symbol} {formatVal(val, curr.decimals)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Último: {latestRow ? formatPeriodLabel(latestRow.periodo) : '—'}</span>
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

      {/* 4. Controles de Filtrado y Búsqueda */}
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
            placeholder="Filtrar por periodo (ej. 2026-10)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 5. Tabla Principal de Cotizaciones Mensuales */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Histórico Mensual de Tipos de Cambio Oficiales
            </h2>
            <p className="text-xs text-slate-500">
              Mostrando {filteredData.length} registros mensuales ordenados cronológicamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Unidades de Moneda Local por 1 USD
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-bold tracking-wider">
                <th className="py-3 px-4 sticky left-0 bg-slate-100/90 backdrop-blur-xs z-10 w-44">
                  Periodo
                </th>
                <th className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>🇦🇷</span>
                    <span>ARS</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Arg)</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>🇲🇽</span>
                    <span>MXN</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Méx)</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>🇵🇪</span>
                    <span>PEN</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Perú)</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>🇨🇱</span>
                    <span>CLP</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Chile)</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>🇨🇴</span>
                    <span>COP</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Col)</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-center w-28">
                  Base
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((row, idx) => {
                const isEven = idx % 2 === 0;
                const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-10-01';
                return (
                  <tr 
                    key={row.periodo}
                    className={`transition-colors hover:bg-blue-50/40 ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    {/* Periodo */}
                    <td className="py-3 px-4 font-bold text-slate-800 sticky left-0 bg-inherit backdrop-blur-xs z-10 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500 font-normal text-[11px]">
                          {row.periodo.substring(0, 7)}
                        </span>
                        <span className="text-slate-900 font-semibold">
                          {formatPeriodLabel(row.periodo)}
                        </span>
                        {isProj ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200/80">
                            PROYECTADO
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                            REAL
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ARS */}
                    <td className="py-3 px-4 text-right font-mono">
                      {row.ars !== null ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            $ {formatVal(row.ars, 2)}
                          </span>
                          {idx > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const v = getMoMVariation(idx, 'ars');
                                if (v === null) return null;
                                return (
                                  <span className={v > 0 ? "text-amber-600" : "text-emerald-600"}>
                                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>

                    {/* MXN */}
                    <td className="py-3 px-4 text-right font-mono">
                      {row.mxn !== null ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            $ {formatVal(row.mxn, 2)}
                          </span>
                          {idx > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const v = getMoMVariation(idx, 'mxn');
                                if (v === null) return null;
                                return (
                                  <span className={v > 0 ? "text-amber-600" : "text-emerald-600"}>
                                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>

                    {/* PEN */}
                    <td className="py-3 px-4 text-right font-mono">
                      {row.pen !== null ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            S/ {formatVal(row.pen, 2)}
                          </span>
                          {idx > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const v = getMoMVariation(idx, 'pen');
                                if (v === null) return null;
                                return (
                                  <span className={v > 0 ? "text-amber-600" : "text-emerald-600"}>
                                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>

                    {/* CLP */}
                    <td className="py-3 px-4 text-right font-mono">
                      {row.clp !== null ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            $ {formatVal(row.clp, 2)}
                          </span>
                          {idx > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const v = getMoMVariation(idx, 'clp');
                                if (v === null) return null;
                                return (
                                  <span className={v > 0 ? "text-amber-600" : "text-emerald-600"}>
                                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>

                    {/* COP */}
                    <td className="py-3 px-4 text-right font-mono">
                      {row.cop !== null ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            $ {formatVal(row.cop, 2)}
                          </span>
                          {idx > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const v = getMoMVariation(idx, 'cop');
                                if (v === null) return null;
                                return (
                                  <span className={v > 0 ? "text-amber-600" : "text-emerald-600"}>
                                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>

                    {/* Moneda Base */}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                        {row.moneda_base || 'USD'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer de la Tabla */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Fuente de Datos: <span className="font-medium text-slate-700">Contabilidad & Administración Reply Latam (tipo_de_cambio.txt)</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Última actualización: 2026-09 (ARS: 1.565,00 | MXN: 18,07 | PEN: 3,36 | CLP: 972,60 | COP: 3.312,84)
          </span>
        </div>
      </div>
    </div>
  );
}
