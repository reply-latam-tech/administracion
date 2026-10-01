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

  // Configuración de ECharts
  const getEChartsOption = () => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: function (params: any) {
          let tooltipHtml = `<div style="font-weight:bold;margin-bottom:5px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const color = param.color;
            const seriesName = param.seriesName;
            const value = formatCurrency(param.value);
            tooltipHtml += `
              <div style="display:flex;align-items:center;margin-bottom:3px;">
                <span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>
                <span style="margin-right:15px;color:#666;">${seriesName}:</span>
                <span style="font-weight:bold;color:#111;">${value}</span>
              </div>
            `;
          });
          return tooltipHtml;
        },
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        padding: 12,
        textStyle: { color: '#334155' },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px;'
      },
      legend: {
        data: ['Facturación Acumulada', 'Proyección a Fin de Mes'],
        bottom: 0,
        icon: 'circle'
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '12%',
        top: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map(d => d.name),
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { 
          color: '#64748b',
          formatter: (value: number) => `$${(value / 1000000).toFixed(1)}M`
        }
      },
      series: [
        {
          name: 'Facturación Acumulada',
          type: 'line',
          data: data.map(d => d.acumulada),
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: '#2563eb' },
          lineStyle: { width: 3 }
        },
        {
          name: 'Proyección a Fin de Mes',
          type: 'line',
          data: data.map(d => d.proyeccion),
          smooth: true,
          symbol: 'none',
          itemStyle: { color: '#94a3b8' },
          lineStyle: { width: 2, type: 'dashed' }
        }
      ]
    };
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Controles */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select 
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
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
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-gray-500">Última actualización</p>
          <p className="text-sm font-semibold text-gray-900">En tiempo real</p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Tendencia de Facturación y Proyección</h2>
        <div className="h-80 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">Cargando datos de Supabase...</div>
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Matriz de Facturación y Proyecciones</h2>
            <p className="text-xs text-gray-500">Comparativa global de todos los clientes</p>
          </div>
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('CIERRE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'CIERRE' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Cierre de mes
            </button>
            <button 
              onClick={() => setViewMode('DIA_ACTUAL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'DIA_ACTUAL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Al día actual (Día {new Date().getDate()})
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-white border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Seller</th>
                {matrixData.months.map(m => (
                  <th key={m} scope="col" className="px-4 py-3 font-medium text-center min-w-[150px] border-l border-gray-50">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData.rows.length === 0 ? (
                <tr>
                  <td colSpan={matrixData.months.length + 1} className="px-6 py-8 text-center text-gray-400">Cargando datos...</td>
                </tr>
              ) : (
                matrixData.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">
                      {row.sellerName}
                    </td>
                    
                    {matrixData.months.map((m: string) => {
                      const cell = row.monthsData[m];
                      if (!cell) {
                        return <td key={m} className="px-6 py-4 text-center text-gray-300 border-l border-gray-50">-</td>;
                      }
                      
                      return (
                        <td key={m} className="px-4 py-3 border-l border-gray-50">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-gray-400 font-medium">Real:</span>
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(cell.facturacion)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-indigo-400 font-medium">Proy:</span>
                              <span className="text-sm font-medium text-indigo-600">{formatCurrency(cell.proyeccion)}</span>
                            </div>
                            {cell.variation !== null && (
                              <div className={`flex items-center justify-end gap-1 text-[10px] font-bold mt-0.5 ${cell.variation > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {cell.variation > 0 ? '▲' : '▼'} {(Math.abs(cell.variation) * 100).toFixed(1)}%
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
