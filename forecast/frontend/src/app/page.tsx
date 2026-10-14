"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ReactECharts from 'echarts-for-react';

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("1088146491");
  const [allSeguimiento, setAllSeguimiento] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'CIERRE' | 'DIA_ACTUAL'>('CIERRE');

  useEffect(() => {
    async function fetchSellers() {
      const { data, error } = await supabase.from("dim_sellers").select("*").eq("estado", true);
      if (!error && data) {
        setSellers(data);
      }
    }
    fetchSellers();
    
    async function fetchAllSeguimiento() {
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("seguimiento_diario_proyecciones").select("*").range(page * 1000, (page + 1) * 1000 - 1);
        if (data && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      if (allData.length > 0) setAllSeguimiento(allData);
    }
    fetchAllSeguimiento();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: dbData, error } = await supabase
          .from("seguimiento_diario_proyecciones")
          .select("*")
          .eq("seller_id", selectedSeller)
          .order("fecha", { ascending: true })
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) {
          console.error("Error fetching data:", error);
          hasMore = false;
        } else if (dbData && dbData.length > 0) {
          allData = allData.concat(dbData);
          if (dbData.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      const formattedData = allData.map((row: any) => ({
        name: new Date(row.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: '2-digit', month: 'short' }),
        acumulada: row.facturacion_acumulada_mes,
        proyeccion: row.proyeccion_fin_mes,
        raw: row
      }));
      setData(formattedData);
      setLoading(false);
    }
    
    fetchData();
  }, [selectedSeller]);

  const matrixData = useMemo(() => {
    if (!allSeguimiento.length || !sellers.length) return { rows: [], months: [] };
    const currentDay = new Date().getDate(); 
    
    const grouped: any = {};
    const monthsSet = new Set<string>();
    const monthSortMap: any = {};

    allSeguimiento.forEach(row => {
      const sId = row.seller_id;
      const date = new Date(row.fecha + "T12:00:00");
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const sortKey = `${yyyy}-${mm}`;
      
      let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
      mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
      
      if (!grouped[sId]) grouped[sId] = {};
      if (!grouped[sId][mStr]) grouped[sId][mStr] = [];
      grouped[sId][mStr].push(row);
      
      monthsSet.add(mStr);
      monthSortMap[mStr] = sortKey;
    });

    const monthsArr = Array.from(monthsSet).sort((a: string, b: string) => monthSortMap[a].localeCompare(monthSortMap[b]));

    const rows = sellers.map(seller => {
      const sId = seller.id_seller;
      const rowData: any = {
        sellerName: seller.nombre_seller,
        sellerId: sId,
        monthsData: {}
      };

      if (grouped[sId]) {
        let prevVal: number | null = null;
        monthsArr.forEach(m => {
          const days = grouped[sId][m];
          if (days) {
            days.sort((a: any, b: any) => a.dias_transcurridos - b.dias_transcurridos);
            let selectedDayRow = null;
            if (viewMode === 'CIERRE') {
              selectedDayRow = days[days.length - 1];
            } else {
              selectedDayRow = days.find((d: any) => d.dias_transcurridos === currentDay);
              if (!selectedDayRow) {
                 const validDays = days.filter((d: any) => d.dias_transcurridos <= currentDay);
                 if (validDays.length > 0) selectedDayRow = validDays[validDays.length - 1];
                 else selectedDayRow = days[0];
              }
            }
            
            let variation = null;
            if (prevVal !== null && prevVal > 0) {
               variation = (selectedDayRow.facturacion_acumulada_mes - prevVal) / prevVal;
            }
            prevVal = selectedDayRow.facturacion_acumulada_mes;

            rowData.monthsData[m] = {
              facturacion: selectedDayRow.facturacion_acumulada_mes,
              proyeccion: selectedDayRow.proyeccion_fin_mes,
              variation: variation
            };
          }
        });
      }
      return rowData;
    });

    return { rows, months: monthsArr };
  }, [allSeguimiento, sellers, viewMode]);

  // Función para formatear moneda
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  // Último valor del seller seleccionado para KPIs
  const currentSellerData = useMemo(() => {
    if (!data.length) return { acumulada: 0, proyeccion: 0, cumplimiento: 0 };
    const last = data[data.length - 1];
    const cumpl = last.proyeccion > 0 ? (last.acumulada / last.proyeccion) * 100 : 0;
    return {
      acumulada: last.acumulada || 0,
      proyeccion: last.proyeccion || 0,
      cumplimiento: Math.min(cumpl, 100)
    };
  }, [data]);

  const selectedSellerObj = useMemo(() => {
    return sellers.find(s => s.id_seller === selectedSeller);
  }, [sellers, selectedSeller]);

  // Configuración de ECharts con paleta institucional Reply
  const getEChartsOption = () => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: function (params: any) {
          let tooltipHtml = `<div style="font-weight:700;color:#0f172a;margin-bottom:8px;font-size:13px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const color = param.color;
            const seriesName = param.seriesName;
            const value = formatCurrency(param.value);
            tooltipHtml += `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:5px;font-size:12px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="display:inline-block;border-radius:50%;width:8px;height:8px;background-color:${color};"></span>
                  <span style="color:#64748b;">${seriesName}:</span>
                </div>
                <span style="font-weight:700;color:#0f172a;font-family:monospace;">${value}</span>
              </div>
            `;
          });
          return tooltipHtml;
        },
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        textStyle: { color: '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.08); border-radius: 10px;'
      },
      legend: {
        data: ['Facturación Acumulada', 'Proyección a Fin de Mes'],
        bottom: 0,
        icon: 'circle',
        itemGap: 24,
        textStyle: {
          color: '#475569',
          fontWeight: 500,
          fontSize: 12
        }
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '12%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map(d => d.name),
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { 
          color: '#64748b',
          fontSize: 11,
          formatter: (value: number) => `$${(value / 1000000).toFixed(1)}M`
        }
      },
      series: [
        {
          name: 'Facturación Acumulada',
          type: 'line',
          data: data.map(d => d.acumulada),
          smooth: 0.3,
          symbolSize: 6,
          itemStyle: { color: '#4981fb' },
          lineStyle: { width: 3, color: '#4981fb' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(73, 129, 251, 0.22)' },
                { offset: 1, color: 'rgba(73, 129, 251, 0.01)' }
              ]
            }
          }
        },
        {
          name: 'Proyección a Fin de Mes',
          type: 'line',
          data: data.map(d => d.proyeccion),
          smooth: 0.3,
          symbol: 'none',
          itemStyle: { color: '#ff5100' },
          lineStyle: { width: 2.5, type: 'dashed', color: '#ff5100' }
        }
      ]
    };
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Controles & KPIs de Cabecera */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-full sm:w-72">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Cliente Seleccionado
            </label>
            <select 
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-lg focus:ring-2 focus:ring-[#4981fb] focus:border-[#4981fb] block w-full p-2.5 transition-all outline-none"
            >
              {sellers.length > 0 ? (
                sellers.map((s) => (
                  <option key={s.id_seller} value={s.id_seller}>
                    {s.nombre_seller} ({s.id_seller})
                  </option>
                ))
              ) : (
                <option value="1088146491">Cargando sellers...</option>
              )}
            </select>
          </div>

          {selectedSellerObj && (
            <div className="hidden lg:flex items-center gap-2 pt-5">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                País: {selectedSellerObj.pais || 'ARG'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#eff5ff] text-[#275ec9] font-medium border border-[#daebfe]">
                Moneda: {selectedSellerObj.moneda || 'ARS'}
              </span>
            </div>
          )}
        </div>

        {/* Mini KPI Cards del Seller */}
        <div className="flex items-center gap-3 sm:gap-6 self-stretch justify-between sm:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ventas Acumuladas</p>
            <p className="text-base sm:text-lg font-bold text-[#4981fb]">
              {formatCurrency(currentSellerData.acumulada)}
            </p>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Proyección Fin Mes</p>
            <p className="text-base sm:text-lg font-bold text-[#ff5100]">
              {formatCurrency(currentSellerData.proyeccion)}
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico Principal */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Curva de Crecimiento & Proyección a Fin de Mes
            </h2>
            <p className="text-xs text-slate-500">
              Comparativa de ventas reales diarias acumuladas contra el ritmo estimado del modelo estadístico
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4981fb]"></span>
              Ventas Reales
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5100]"></span>
              Proyección
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              <span className="inline-block animate-pulse">Cargando serie temporal desde Supabase...</span>
            </div>
          ) : (
            <ReactECharts 
              option={getEChartsOption()} 
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          )}
        </div>
      </div>

      {/* Tabla Matricial */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Matriz Consolidada de Clientes</h2>
            <p className="text-xs text-slate-500">
              Ventas reales vs. proyecciones por periodo para toda la cartera
            </p>
          </div>
          <div className="flex bg-slate-200/80 p-1 rounded-lg self-start sm:self-auto">
            <button 
              onClick={() => setViewMode('CIERRE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'CIERRE' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cierre de Mes
            </button>
            <button 
              onClick={() => setViewMode('DIA_ACTUAL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'DIA_ACTUAL' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Al Día Actual (Día {new Date().getDate()})
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3.5 font-bold text-slate-700 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Seller
                </th>
                {matrixData.months.map(m => (
                  <th key={m} scope="col" className="px-4 py-3.5 font-bold text-slate-700 text-center min-w-[160px] border-l border-slate-100">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrixData.rows.length === 0 ? (
                <tr>
                  <td colSpan={matrixData.months.length + 1} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Cargando datos consolidados...
                  </td>
                </tr>
              ) : (
                matrixData.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="bg-white hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#4981fb]"></span>
                        <span>{row.sellerName}</span>
                      </div>
                    </td>
                    
                    {matrixData.months.map((m: string) => {
                      const cell = row.monthsData[m];
                      if (!cell) {
                        return (
                          <td key={m} className="px-4 py-3 text-center text-slate-300 border-l border-slate-100">
                            —
                          </td>
                        );
                      }
                      
                      return (
                        <td key={m} className="px-4 py-3 border-l border-slate-100">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Real:</span>
                              <span className="font-bold text-slate-900">{formatCurrency(cell.facturacion)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[10px] text-[#ff5100] font-semibold uppercase">Proy:</span>
                              <span className="font-semibold text-[#ff5100]">{formatCurrency(cell.proyeccion)}</span>
                            </div>
                            {cell.variation !== null && (
                              <div className="flex items-center justify-end pt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  cell.variation >= 0 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                                    : 'text-rose-600 bg-rose-50 border border-rose-200/60'
                                }`}>
                                  {cell.variation >= 0 ? '+' : ''}{(cell.variation * 100).toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
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
      
    </div>
  );
}
