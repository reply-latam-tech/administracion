"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function OverviewPage() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"SAME_DAYS" | "FULL_MONTH">("SAME_DAYS");
  const [monthsStr, setMonthsStr] = useState<string[]>([]);
  const [currentDayTarget, setCurrentDayTarget] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: dbData, error } = await supabase
        .from("seguimiento_diario_proyecciones")
        .select("*")
        .order("fecha", { ascending: true });

      if (error) {
        console.error("Error fetching overview data:", error);
        setLoading(false);
        return;
      }

      // Find the absolute maximum fecha to determine current day target
      let maxDias = 0;
      let lastMonthStr = "";
      
      const sellersMap: Record<string, string> = {
        '1088146491': 'Café Martínez',
        '425901767': 'La Espumería'
      };

      const groupedSellers: any = {};
      const globalMonthsSet = new Set<string>();

      dbData.forEach((row: any) => {
        const date = new Date(row.fecha + "T12:00:00");
        let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
        mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);

        globalMonthsSet.add(mStr);
        lastMonthStr = mStr;

        const sId = row.seller_id;
        if (!groupedSellers[sId]) {
          groupedSellers[sId] = {
            id: sId,
            name: sellersMap[sId] || `Seller ${sId}`,
            months: {}
          };
        }
        if (!groupedSellers[sId].months[mStr]) {
          groupedSellers[sId].months[mStr] = [];
        }
        groupedSellers[sId].months[mStr].push(row);
      });

      // Compute maxDias from any seller in the last month
      for (const sId in groupedSellers) {
        if (groupedSellers[sId].months[lastMonthStr]) {
          const arr = groupedSellers[sId].months[lastMonthStr];
          if (arr.length > 0) {
            const max = arr[arr.length - 1].dias_transcurridos;
            if (max > maxDias) maxDias = max;
          }
        }
      }

      setCurrentDayTarget(maxDias);
      setMonthsStr(Array.from(globalMonthsSet));
      setData(groupedSellers);
      setLoading(false);
    }
    
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  const getMonthValue = (monthData: any[]) => {
    if (!monthData || monthData.length === 0) return 0;
    if (filterMode === "FULL_MONTH") {
      return monthData[monthData.length - 1].facturacion_acumulada_mes;
    } else {
      let targetRow = monthData[0];
      for (const row of monthData) {
        if (row.dias_transcurridos <= currentDayTarget) {
          targetRow = row;
        } else {
          break;
        }
      }
      return targetRow.facturacion_acumulada_mes;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs gap-4">
        <div className="flex gap-4 items-center w-full max-w-lg">
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Ventana de Análisis & Comparativa
            </label>
            <select 
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-lg focus:ring-2 focus:ring-[#4981fb] focus:border-[#4981fb] block w-full p-2.5 outline-none transition-all"
            >
              <option value="SAME_DAYS">Misma cantidad de días vs mes anterior (hasta el día {currentDayTarget || '...'})</option>
              <option value="FULL_MONTH">Meses completos consolidados</option>
            </select>
          </div>
        </div>
        <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sincronización</p>
          <p className="text-sm font-bold text-slate-800 flex items-center md:justify-end gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Base Supabase en vivo
          </p>
        </div>
      </div>

      {/* Nota Metodológica Institucional */}
      <div className="bg-[#eff5ff] text-[#1e40af] p-4 rounded-xl border border-[#daebfe] text-xs flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-[#4981fb] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
          i
        </div>
        <div>
          <p className="leading-relaxed">
            <strong className="font-semibold text-slate-900">Metodología de Ingesta:</strong> Los valores de facturación bruta mostrados corresponden a las órdenes confirmadas y pagadas (<code className="bg-white/80 px-1 py-0.5 rounded text-[#275ec9] font-mono text-[11px]">status: paid</code>) en Mercado Libre sincronizadas automáticamente a diario. La variación porcentual se recalcula dinámicamente según el filtro temporal seleccionado.
          </p>
        </div>
      </div>

      {/* Tabla Resumen */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Resumen Ejecutivo por Seller</h2>
            <p className="text-xs text-slate-500">Evolución mensual y variaciones intermensuales</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold text-slate-700 min-w-[220px] sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Seller / Cliente
                </th>
                {monthsStr.map((m) => (
                  <th key={m} scope="col" className="px-6 py-4 font-bold text-slate-700 text-right whitespace-nowrap border-l border-slate-100">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={monthsStr.length + 1} className="px-6 py-12 text-center text-slate-400 text-sm">
                    <div className="animate-pulse">Cargando serie consolidada...</div>
                  </td>
                </tr>
              ) : (
                Object.values(data).map((seller: any) => (
                  <tr key={seller.id} className="bg-white hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4981fb]"></span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{seller.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {seller.id}</div>
                        </div>
                      </div>
                    </td>
                    {(() => {
                      const rowValues = monthsStr.map(m => getMonthValue(seller.months[m]));
                      const maxRowValue = Math.max(...rowValues, 1);

                      return monthsStr.map((m, index) => {
                        const val = rowValues[index];
                        let prevVal = 0;
                        let variation = 0;
                        
                        if (index > 0) {
                          prevVal = rowValues[index - 1];
                          if (prevVal > 0) {
                            variation = ((val - prevVal) / prevVal) * 100;
                          }
                        }
                        
                        const barWidth = (val / maxRowValue) * 100;

                        return (
                          <td key={m} className="px-6 py-5 text-right min-w-[150px] border-l border-slate-100">
                            <div className="font-bold text-slate-900 text-sm">{formatCurrency(val)}</div>
                            
                            <div className="h-5 flex items-center justify-end mt-1">
                              {index > 0 && prevVal > 0 ? (
                                <div className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                                  variation >= 0 
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60' 
                                    : 'text-rose-600 bg-rose-50 border border-rose-200/60'
                                }`}>
                                  {variation >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                  {Math.abs(variation).toFixed(1)}%
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-300 font-mono">—</span>
                              )}
                            </div>
                            
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden flex justify-end">
                              <div 
                                className="bg-[#4981fb] h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${barWidth}%` }}
                              ></div>
                            </div>
                          </td>
                        );
                      });
                    })()}
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
