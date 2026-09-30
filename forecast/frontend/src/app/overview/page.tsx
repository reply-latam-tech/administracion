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
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex gap-4 items-center w-full max-w-lg">
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">Vista de Facturación y Variación</label>
            <select 
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
            >
              <option value="SAME_DAYS">Misma cantidad de días vs mes anterior (hasta el día {currentDayTarget || '...'})</option>
              <option value="FULL_MONTH">Meses completos consolidados</option>
            </select>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-gray-500">Última actualización</p>
          <p className="text-sm font-semibold text-gray-900">En tiempo real</p>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 text-sm flex items-start gap-3">
        <div>
          <p><strong>Nota importante:</strong> Los valores de facturación bruta mostrados en esta tabla corresponden únicamente a las órdenes en estado <strong>&quot;paid&quot;</strong> procesadas en Mercado Libre. La variación porcentual se calcula en función al filtro seleccionado arriba.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-base font-semibold text-gray-900">Resumen General de Sellers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-white border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium min-w-[200px] sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Seller</th>
                {monthsStr.map((m) => (
                  <th key={m} scope="col" className="px-6 py-4 font-medium text-right whitespace-nowrap">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={monthsStr.length + 1} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-pulse">Cargando datos históricos...</div>
                  </td>
                </tr>
              ) : (
                Object.values(data).map((seller: any) => (
                  <tr key={seller.id} className="bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-6 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="font-semibold text-gray-900 text-[15px]">{seller.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">ID: {seller.id}</div>
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
                          <td key={m} className="px-6 py-6 text-right min-w-[140px]">
                            <div className="font-semibold text-gray-900 text-[15px]">{formatCurrency(val)}</div>
                            
                            <div className="h-5 flex items-center justify-end mt-1">
                              {index > 0 && prevVal > 0 ? (
                                <div className={`flex items-center gap-0.5 text-xs font-medium ${variation >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {variation >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                  {Math.abs(variation).toFixed(1)}%
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </div>
                            
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden flex justify-end">
                              <div className="bg-blue-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }}></div>
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
