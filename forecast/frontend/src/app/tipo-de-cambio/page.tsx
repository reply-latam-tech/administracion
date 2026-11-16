"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Filter, 
  RefreshCw, 
  Search, 
  CheckCircle2,
  History,
  Edit3,
  Lock,
  X,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Check,
  Sparkles
} from "lucide-react";
import ReactECharts from 'echarts-for-react';
import TableExportButton from "@/components/TableExportButton";
import { ExportData } from "@/lib/exportUtils";
import { useExchangeRates, CurrencyKey, AuditEntry } from "@/context/ExchangeRateContext";
import { useAuth } from "@/context/AuthContext";
import { ExchangeRateRow } from "@/lib/exchangeRates";

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
  const { rates, auditLog, loading, saving, canEdit, updateRate, refreshRates, lastSync } = useExchangeRates();
  const { user, role } = useAuth();

  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'REAL' | 'PROYECTADO'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>('ars');

  // Estados de edición inline de celdas
  const [editingCell, setEditingCell] = useState<{ periodo: string; currency: CurrencyKey } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [justSavedKey, setJustSavedKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modal de Auditoría
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [auditFilterTerm, setAuditFilterTerm] = useState<string>('');

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Formateador numérico
  const formatVal = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  };

  // Formato corto de período (ej. "Sep 26")
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

  // Formateador de fecha y hora exacta (ART UTC-3)
  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  // Filtrado de columnas (meses)
  const filteredData = useMemo(() => {
    return rates.filter(row => {
      const p = row.periodo;
      if (selectedYear !== 'ALL') {
        if (!p.startsWith(selectedYear)) return false;
      }
      if (selectedStatus !== 'ALL') {
        const isProj = row.estado === 'PROYECTADO' || (row.estado !== 'REAL' && p >= '2026-11-01');
        if (selectedStatus === 'REAL' && isProj) return false;
        if (selectedStatus === 'PROYECTADO' && !isProj) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (!p.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [rates, selectedYear, selectedStatus, searchTerm]);

  // Moneda activa seleccionada
  const activeCurrencyObj = useMemo(() => {
    return CURRENCIES.find(c => c.key === selectedCurrency) || CURRENCIES[0];
  }, [selectedCurrency]);

  // Último registro real para los KPI cards de cotización vigente
  const latestRealRow = useMemo(() => {
    const reals = rates.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-10-01');
    return reals.length ? reals[reals.length - 1] : (rates.length ? rates[rates.length - 1] : null);
  }, [rates]);

  // Penúltimo registro para variaciones MoM en KPIs
  const previousRow = useMemo(() => {
    const reals = rates.filter(r => r.estado !== 'PROYECTADO' && r.periodo <= '2026-10-01');
    if (reals.length < 2) return null;
    return reals[reals.length - 2];
  }, [rates]);

  // Cálculo de variación porcentual respecto al mes anterior en la tabla
  const getMoMVariation = (currentIndex: number, currKey: CurrencyKey) => {
    if (currentIndex <= 0) return null;
    const currentVal = filteredData[currentIndex][currKey] as number | null;
    const prevVal = filteredData[currentIndex - 1][currKey] as number | null;
    if (!currentVal || !prevVal || prevVal === 0) return null;
    return ((currentVal - prevVal) / prevVal) * 100;
  };

  // Buscar última auditoría para una celda específica
  const getCellAudit = (periodo: string, currKey: CurrencyKey): AuditEntry | undefined => {
    const p7 = periodo.substring(0, 7);
    const code = currKey.toUpperCase();
    return auditLog.find(a => a.periodo.startsWith(p7) && a.moneda.toUpperCase() === code);
  };

  // Iniciar edición de una celda
  const handleStartEdit = (periodo: string, currKey: CurrencyKey, currentVal: number | null) => {
    if (!canEdit) return;
    setEditingCell({ periodo, currency: currKey });
    setEditValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
    setSaveError(null);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Guardar cambio en celda
  const handleSaveCell = async (periodo: string, currKey: CurrencyKey) => {
    if (!editingCell) return;
    const cellKey = `${periodo}_${currKey}`;
    const cleanStr = editValue.replace(',', '.').trim();
    const num = parseFloat(cleanStr);

    if (isNaN(num) || num <= 0) {
      setSaveError('Ingresá un valor numérico positivo válido.');
      return;
    }

    const row = rates.find(r => r.periodo.startsWith(periodo.substring(0, 7)));
    const currentVal = row ? (row[currKey] as number | null) : null;

    if (currentVal === num) {
      handleCancelEdit();
      return;
    }

    setEditingCell(null);
    setSavingCellKey(cellKey);
    setSaveError(null);

    const result = await updateRate(periodo, currKey, num);

    setSavingCellKey(null);

    if (result.success) {
      setJustSavedKey(cellKey);
      setTimeout(() => setJustSavedKey(null), 2500);
    } else {
      setSaveError(result.error || 'Error al guardar el tipo de cambio.');
    }
  };

  // Manejar teclado en celda
  const handleKeyDown = (e: React.KeyboardEvent, periodo: string, currKey: CurrencyKey) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveCell(periodo, currKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
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

  // Configuración de ECharts para el gráfico de evolución
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

    return {
      animationDuration: 400,
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
          const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-11-01';

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

          const audit = getCellAudit(row.periodo, activeCurr.key);
          const auditInfo = audit ? `
            <div style="margin-top:6px;padding-top:4px;border-top:1px dashed #e2e8f0;font-size:11px;color:#0369a1;">
              <strong>Última edición:</strong> ${audit.usuario_email}<br/>
              <strong>Fecha:</strong> ${formatDateTime(audit.created_at)}
            </div>
          ` : '';

          return `
            <div style="min-width: 190px;">
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
              ${auditInfo}
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
          data: seriesData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: true,
          itemStyle: {
            color: activeCurr.color,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          lineStyle: {
            width: 3,
            color: activeCurr.color,
            shadowColor: `${activeCurr.color}40`,
            shadowBlur: 10,
            shadowOffsetY: 4
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${activeCurr.color}30` },
                { offset: 1, color: `${activeCurr.color}02` }
              ]
            }
          }
        }
      ]
    };
  }, [filteredData, activeCurrencyObj, auditLog]);

  // Exportar matriz a Excel / CSV
  const getTableExportData = (): ExportData => {
    const matrixHeaders = ['Moneda', 'País', ...filteredData.map(r => `${formatShortPeriod(r.periodo)} (${r.estado || 'REAL'})`)];
    const matrixRows = CURRENCIES.map(curr => {
      const rowVals = filteredData.map(r => {
        const val = r[curr.key] as number | null;
        return val !== null ? val : '';
      });
      return [curr.code, curr.label, ...rowVals];
    });

    const cronoHeaders = ['Periodo', 'ARS', 'MXN', 'PEN', 'CLP', 'COP', 'Moneda_Base', 'Estado', 'Ultimo_Editor'];
    const cronoRows = filteredData.map(r => [
      r.periodo,
      r.ars ?? '',
      r.mxn ?? '',
      r.pen ?? '',
      r.clp ?? '',
      r.cop ?? '',
      'USD',
      r.estado || (r.periodo >= '2026-11-01' ? 'PROYECTADO' : 'REAL'),
      r.updated_by || ''
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      filename: `tipos_de_cambio_${dateStr}`,
      sheetName: 'Matriz en Pantalla',
      headers: matrixHeaders,
      rows: matrixRows,
      sheets: [
        { sheetName: 'Matriz en Pantalla', headers: matrixHeaders, rows: matrixRows },
        { sheetName: 'Serie Cronológica', headers: cronoHeaders, rows: cronoRows }
      ]
    };
  };

  // Exportar historial de auditoría
  const getAuditExportData = (): ExportData => {
    const headers = ['Fecha y Hora (ART)', 'Usuario', 'Período', 'Moneda', 'Valor Anterior', 'Valor Nuevo', 'Variación %'];
    const rows = filteredAuditLog.map(a => {
      let varPct = '';
      if (a.valor_anterior && a.valor_anterior > 0) {
        const diff = ((a.valor_nuevo - a.valor_anterior) / a.valor_anterior) * 100;
        varPct = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
      }
      return [
        formatDateTime(a.created_at),
        a.usuario_email,
        a.periodo.substring(0, 7),
        a.moneda,
        a.valor_anterior ?? '',
        a.valor_nuevo,
        varPct
      ];
    });

    return {
      filename: `auditoria_tipos_de_cambio_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Auditoría Tipos de Cambio',
      headers,
      rows
    };
  };

  // Filtro de auditoría en modal
  const filteredAuditLog = useMemo(() => {
    if (!auditFilterTerm.trim()) return auditLog;
    const term = auditFilterTerm.toLowerCase();
    return auditLog.filter(a => 
      a.usuario_email.toLowerCase().includes(term) ||
      a.periodo.toLowerCase().includes(term) ||
      a.moneda.toLowerCase().includes(term)
    );
  }, [auditLog, auditFilterTerm]);

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
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado en Tiempo Real
              </span>
              {canEdit ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <Edit3 size={11} /> Edición Habilitada (Admin)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Lock size={11} /> Solo Lectura
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Cotizaciones mensuales para liquidación, proyección y conversión a USD en toda la app.
              {canEdit && " Hacé clic o doble clic en cualquier celda para editar el valor en tiempo real."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center flex-wrap">
          {/* Botón de Historial de Auditoría */}
          <button
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Ver auditoría completa de modificaciones"
          >
            <History size={13} />
            <span>Auditoría de Cambios</span>
            {auditLog.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                {auditLog.length}
              </span>
            )}
          </button>

          <button
            onClick={() => refreshRates()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading || saving ? "animate-spin text-blue-600" : ""} />
            <span>Actualizar</span>
          </button>
          
          <TableExportButton getData={getTableExportData} label="Exportar" />
        </div>
      </div>

      {/* Alerta de Error de Guardado si ocurre */}
      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Tarjetas KPI de Cotización Vigente */}
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

      {/* 4. Tabla Horizontal Pivotada (Filas = Monedas, Columnas = Meses) con Edición Inline */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Matriz Mensual de Cotizaciones por Moneda
              </h2>
              {canEdit && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                  <Edit3 size={11} /> Celdas editables inline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredData.length} meses en columnas • {canEdit ? "Clic o doble clic en una celda para editar el valor." : "Visualización para analistas."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              Unidades de Moneda Local por 1 USD
            </span>
            <TableExportButton getData={getTableExportData} label="Exportar Tabla" variant="compact" />
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
                  const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-11-01';
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
                    className={`transition-all group ${
                      isSelected 
                        ? 'bg-blue-50/70 border-l-4 border-blue-600 font-medium' 
                        : 'hover:bg-slate-50/80 bg-white border-l-4 border-transparent'
                    }`}
                  >
                    {/* Celda Fija de la Moneda (Selecciona para el gráfico) */}
                    <td 
                      onClick={() => setSelectedCurrency(curr.key)}
                      className={`py-3.5 px-4 sticky left-0 z-20 border-r border-slate-200 backdrop-blur-xs transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.02)] cursor-pointer ${
                        isSelected ? 'bg-blue-50/95 text-blue-950' : 'bg-white group-hover:bg-slate-50'
                      }`}
                    >
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
                      const isProj = row.estado === 'PROYECTADO' || row.periodo >= '2026-11-01';
                      const mom = idx > 0 ? getMoMVariation(idx, curr.key) : null;
                      const isUp = mom !== null && mom > 0;
                      
                      const cellKey = `${row.periodo}_${curr.key}`;
                      const isEditing = editingCell?.periodo === row.periodo && editingCell?.currency === curr.key;
                      const isSavingThis = savingCellKey === cellKey;
                      const isJustSaved = justSavedKey === cellKey;
                      const cellAudit = getCellAudit(row.periodo, curr.key);

                      return (
                        <td 
                          key={row.periodo} 
                          onDoubleClick={() => handleStartEdit(row.periodo, curr.key, val)}
                          className={`py-2 px-2.5 text-right font-mono border-r border-slate-100 whitespace-nowrap relative transition-colors ${
                            isProj ? (isSelected ? 'bg-purple-50/30' : 'bg-purple-50/15') : ''
                          } ${
                            isJustSaved ? 'bg-emerald-100/90' : ''
                          } ${
                            canEdit && !isEditing ? 'hover:bg-blue-50/80 cursor-cell group/cell' : ''
                          }`}
                          title={
                            cellAudit
                              ? `Última modificación por ${cellAudit.usuario_email}\nFecha: ${formatDateTime(cellAudit.created_at)}\nAnterior: ${cellAudit.valor_anterior ?? '—'} → Nuevo: ${cellAudit.valor_nuevo}`
                              : canEdit ? "Doble clic para editar cotización" : "Solo lectura"
                          }
                        >
                          {/* Indicador de celda auditada */}
                          {cellAudit && !isEditing && (
                            <span 
                              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600 shadow-2xs" 
                              title={`Editado por ${cellAudit.usuario_email}`}
                            />
                          )}

                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-[10px] text-slate-400 font-sans">{curr.symbol}</span>
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, row.periodo, curr.key)}
                                onBlur={() => handleSaveCell(row.periodo, curr.key)}
                                className="w-20 px-1.5 py-1 text-xs font-bold font-mono text-right bg-white border-2 border-blue-600 rounded shadow-sm focus:outline-hidden text-slate-900"
                              />
                            </div>
                          ) : isSavingThis ? (
                            <div className="flex items-center justify-end gap-1 text-blue-600 text-xs">
                              <RefreshCw size={12} className="animate-spin" />
                              <span className="text-[10px] font-sans">Guardando...</span>
                            </div>
                          ) : isJustSaved ? (
                            <div className="flex items-center justify-end gap-1 text-emerald-700 text-xs font-bold font-sans">
                              <Check size={12} />
                              <span className="text-[10px]">Guardado</span>
                            </div>
                          ) : val !== null ? (
                            <div className="relative">
                              <div className="flex items-center justify-end gap-1">
                                <span className={`text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                                  {curr.symbol} {formatVal(val, curr.decimals)}
                                </span>
                                {canEdit && (
                                  <Edit3 
                                    size={10} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(row.periodo, curr.key, val);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity cursor-pointer shrink-0" 
                                  />
                                )}
                              </div>
                              {mom !== null && (
                                <div className="text-[10px] mt-0.5 font-sans leading-none">
                                  <span className={isUp ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                                    {isUp ? '+' : ''}{mom.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-300 font-sans text-xs">—</span>
                              {canEdit && (
                                <button
                                  onClick={() => handleStartEdit(row.periodo, curr.key, null)}
                                  className="opacity-0 group-hover/cell:opacity-100 text-[10px] text-blue-600 underline font-sans"
                                >
                                  +Agregar
                                </button>
                              )}
                            </div>
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
          <div className="flex items-center gap-3">
            <span>
              Mostrando 5 monedas en filas. Desplaza horizontalmente para explorar los meses.
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Punto azul = Cotización modificada con trazabilidad</span>
            </div>
          </div>
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

      {/* 6. MODAL DE AUDITORÍA Y TRAZABILIDAD */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Registro de Auditoría de Tipos de Cambio
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      {auditLog.length} registros
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Historial inmutable con usuario responsable (@replylatam.com), fecha y hora exacta (ART) y valores modificados.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TableExportButton getData={getAuditExportData} label="Exportar Auditoría" variant="compact" />
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Buscador dentro de Auditoría */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por usuario o moneda..."
                  value={auditFilterTerm}
                  onChange={(e) => setAuditFilterTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs text-slate-400">
                Mostrando {filteredAuditLog.length} de {auditLog.length} eventos
              </span>
            </div>

            {/* Lista de Registros de Auditoría */}
            <div className="overflow-y-auto p-4 flex-1">
              {filteredAuditLog.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <History size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Sin modificaciones registradas</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Todas las cotizaciones se encuentran con sus valores oficiales originales. Cuando un administrador edite una celda, aparecerá aquí inmediatamente.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Fecha y Hora (ART)</th>
                        <th className="py-2.5 px-3">Usuario Responsable</th>
                        <th className="py-2.5 px-3">Período</th>
                        <th className="py-2.5 px-3">Moneda</th>
                        <th className="py-2.5 px-3 text-right">Valor Anterior</th>
                        <th className="py-2.5 px-3 text-right">Valor Nuevo</th>
                        <th className="py-2.5 px-3 text-right">Variación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAuditLog.map((item, idx) => {
                        const currObj = CURRENCIES.find(c => c.code === item.moneda) || CURRENCIES[0];
                        let diffPct: number | null = null;
                        if (item.valor_anterior && item.valor_anterior > 0) {
                          diffPct = ((item.valor_nuevo - item.valor_anterior) / item.valor_anterior) * 100;
                        }

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-slate-600 font-mono whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-slate-400" />
                                {formatDateTime(item.created_at)}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                                  {item.usuario_email.substring(0, 2).toUpperCase()}
                                </div>
                                <span>{item.usuario_email}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {formatFullPeriod(item.periodo)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800">
                                <span>{currObj.flag}</span>
                                <span>{item.moneda}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {item.valor_anterior !== null ? `${currObj.symbol} ${formatVal(item.valor_anterior, currObj.decimals)}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {currObj.symbol} {formatVal(item.valor_nuevo, currObj.decimals)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                              {diffPct !== null ? (
                                <span className={`font-bold ${diffPct >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck size={14} /> Trazabilidad íntegra almacenada en Supabase DB
              </span>
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
