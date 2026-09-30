"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function EscalasPage() {
  const [data, setData] = useState<any[]>([]);
  const [monthsStr, setMonthsStr] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Fetch sellers for names
      const { data: sellersData } = await supabase.from("dim_sellers").select("*");
      const sellersMap: Record<string, string> = {};
      if (sellersData) {
        sellersData.forEach((s) => {
          sellersMap[s.id_seller] = s.nombre_seller;
        });
      }

      // Fetch escalas
      let allEscalas: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: dbData, error } = await supabase
          .from("dim_escalas")
          .select("*")
          .order("periodo", { ascending: true })
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) {
          console.error("Error fetching escalas data:", error);
          setLoading(false);
          return;
        }

        if (dbData && dbData.length > 0) {
          allEscalas = allEscalas.concat(dbData);
          if (dbData.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      const dbData = allEscalas;

      // Fetch liquidaciones to highlight applied tiers
      const { data: liqData } = await supabase.from('liquidaciones').select('*');
      const liqMap: Record<string, any> = {};
      if (liqData) {
        liqData.forEach((row: any) => {
          const date = new Date(row.periodo + "T12:00:00");
          let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
          mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
          
          if (!liqMap[row.seller_id]) liqMap[row.seller_id] = {};
          liqMap[row.seller_id][mStr] = {
            tipo_cargo: row.tipo_cargo_aplicado,
            alicuota: row.alicuota_aplicada,
            valor_facturado: row.valor_facturado,
            subtotal_mercado_libre: row.subtotal_mercado_libre,
            estado: row.estado
          };
        });
      }

      const sellersGroups: Record<string, any> = {};
      const globalMonthsSet = new Set<string>();

      dbData.forEach((row: any) => {
        const date = new Date(row.periodo + "T12:00:00");
        let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
        mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
        globalMonthsSet.add(mStr);

        const sId = row.seller_id;
        if (!sellersGroups[sId]) {
          sellersGroups[sId] = {
            sellerId: sId,
            sellerName: sellersMap[sId] || `Seller ${sId}`,
            pais: row.pais,
            moneda: row.moneda,
            tiersByMonth: {}
          };
        }
        
        if (!sellersGroups[sId].tiersByMonth[mStr]) {
          sellersGroups[sId].tiersByMonth[mStr] = [];
        }
        
        sellersGroups[sId].tiersByMonth[mStr].push({
          tipoCargo: row.tipo_cargo,
          alicuota: row.alicuota,
          monto: row.monto_objetivo,
          variacion: row.variacion_mensual,
          estado: row.estado || 'REAL'
        });
      });

      const sortedSellers = Object.values(sellersGroups).sort((a: any, b: any) => 
        a.sellerName.localeCompare(b.sellerName)
      );

      const formattedData: any[] = [];
      const monthsArray = Array.from(globalMonthsSet).sort((a, b) => {
        // Sort months chronologically just in case (e.g. 'Ene 2026' vs 'Feb 2026')
        const parseDate = (str: string) => {
           const [m, y] = str.split(' ');
           const map: any = {'Ene':0,'Feb':1,'Mar':2,'Abr':3,'May':4,'Jun':5,'Jul':6,'Ago':7,'Sep':8,'Sept':8,'Oct':9,'Nov':10,'Dic':11};
           return new Date(parseInt(y), map[m] || 0, 1).getTime();
        };
        return parseDate(a) - parseDate(b);
      });
      
      sortedSellers.forEach((seller) => {
        let maxTiers = 0;
        monthsArray.forEach(m => {
          if (seller.tiersByMonth[m]) {
            seller.tiersByMonth[m].sort((a: any, b: any) => {
              if (a.tipoCargo === 'MINIMO' && b.tipoCargo !== 'MINIMO') return -1;
              if (b.tipoCargo === 'MINIMO' && a.tipoCargo !== 'MINIMO') return 1;
              return b.alicuota - a.alicuota;
            });
            maxTiers = Math.max(maxTiers, seller.tiersByMonth[m].length);
          }
        });

        for (let i = 0; i < maxTiers; i++) {
          const rowMonths: any = {};
          monthsArray.forEach(m => {
             const tiers = seller.tiersByMonth[m];
             if (tiers && tiers[i]) {
               rowMonths[m] = tiers[i];
             } else {
               rowMonths[m] = null;
             }
          });
          
          formattedData.push({
            isFirstRow: i === 0,
            rowSpan: maxTiers,
            sellerId: seller.sellerId,
            sellerName: seller.sellerName,
            pais: seller.pais,
            moneda: seller.moneda,
            months: rowMonths,
            liquidaciones: liqMap[seller.sellerId] || {},
            id: `${seller.sellerId}_row_${i}`
          });
        }
      });

      setMonthsStr(monthsArray);
      setData(formattedData);
      setLoading(false);
    }
    
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  const formatPercent = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6 w-full h-[calc(100vh-130px)] flex flex-col">
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Matriz de Escalas y Tarifas</h1>
            <p className="text-sm text-gray-500">Histórico de umbrales por inflación y proyecciones</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-500">Última actualización</p>
            <p className="text-sm font-semibold text-gray-900">En tiempo real</p>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl shadow-sm text-sm text-orange-900">
          <div className="flex gap-2 font-semibold mb-1 items-center">
            <span className="w-3 h-3 rounded-full bg-orange-400"></span>
            Acerca de las Proyecciones
          </div>
          <p className="text-orange-800">
            Las celdas resaltadas en color naranja fuerte indican la escala en la que cae la <span className="font-bold">facturación proyectada</span> (basada en tendencias y promedios) contra los umbrales de escala ajustados por la inflación esperada del BCRA. Las celdas en naranja suave muestran el resto de las escalas proyectadas para esos meses.
          </p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 flex gap-2 items-start">
          <div className="mt-0.5 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </div>
          <div>
            <strong className="text-gray-700">Sobre los datos proyectados:</strong> Los valores futuros se calculan utilizando la mediana del Índice de Precios al Consumidor (IPC) – Nivel General, basándose en el REM (Relevamiento de Expectativas de Mercado) publicado por el BCRA.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold min-w-[180px] sticky left-0 bg-gray-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Seller</th>
                {monthsStr.map((m) => (
                  <th key={m} scope="col" className="px-4 py-3 font-medium text-center whitespace-nowrap min-w-[160px]">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={monthsStr.length + 1} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-pulse">Cargando escalas...</div>
                  </td>
                </tr>
              ) : (
                data.map((row: any) => (
                  <tr key={row.id} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                    {row.isFirstRow && (
                      <td 
                        rowSpan={row.rowSpan} 
                        className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100 align-top"
                      >
                        <div className="font-semibold text-gray-900 text-[14px]">{row.sellerName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{row.pais} | {row.moneda}</div>
                      </td>
                    )}
                    
                    {monthsStr.map((m) => {
                      const cellData = row.months[m];
                      
                      if (!cellData) {
                        return (
                          <td key={m} className="px-4 py-2 text-right border-l border-gray-50">
                            <span className="text-gray-300">-</span>
                          </td>
                        );
                      }

                      const val = cellData.monto;
                      const variation = cellData.variacion;
                      const alicuotaLabel = cellData.tipoCargo === 'MINIMO' ? 'MÍN' : formatPercent(cellData.alicuota);

                      const isScaleProjected = cellData.estado === 'PROYECTADO';
                      const liq = row.liquidaciones[m];
                      let isApplied = false;
                      let isLiqProjected = false;
                      if (liq) {
                        if (liq.tipo_cargo === 'MINIMO' && cellData.tipoCargo === 'MINIMO') {
                          isApplied = true;
                        } else if (liq.tipo_cargo === 'PORCENTUAL' && cellData.tipoCargo === 'PORCENTUAL') {
                          if (Math.abs(liq.alicuota - cellData.alicuota) < 0.0001) {
                            isApplied = true;
                          }
                        }
                        if (liq.estado === 'PROYECTADO') {
                            isLiqProjected = true;
                        }
                      }

                      // Determinar clases base según si es real o proyectado, y si está aplicado
                      let cellClass = "";
                      let alicuotaClass = "";
                      let montoClass = "";
                      let arrowUpClass = "text-green-600";
                      let arrowDownClass = "text-red-500";

                      if (isApplied) {
                        // Es la escala que se usó para facturar (o para proyectar)
                        if (isLiqProjected) {
                          cellClass = "bg-orange-50/60 ring-1 ring-inset ring-orange-300";
                          alicuotaClass = "bg-orange-500 text-white";
                          montoClass = "text-orange-900";
                          arrowUpClass = "text-orange-500";
                          arrowDownClass = "text-red-500";
                        } else {
                          cellClass = "bg-blue-50/60 ring-1 ring-inset ring-blue-200";
                          alicuotaClass = "bg-blue-600 text-white";
                          montoClass = "text-blue-900";
                        }
                      } else {
                        // No es la escala aplicada
                        if (isScaleProjected) {
                          cellClass = "bg-orange-50/30";
                          alicuotaClass = "text-orange-600 bg-orange-100";
                          montoClass = "text-orange-900";
                          arrowUpClass = "text-orange-500";
                          arrowDownClass = "text-red-500";
                        } else {
                          cellClass = "";
                          alicuotaClass = "text-blue-600 bg-blue-50";
                          montoClass = "text-gray-800";
                        }
                      }

                      return (
                        <td key={m} className={`px-4 py-2 text-right border-l border-gray-50 relative group/cell transition-colors ${cellClass}`}>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${alicuotaClass}`}>{alicuotaLabel}</span>
                            <div className={`font-semibold text-[13px] ${montoClass}`}>
                              {formatCurrency(val)}
                            </div>
                          </div>
                          
                          <div className="h-3 flex items-center justify-end">
                            {variation !== null && variation !== 0 ? (
                              <div className={`flex items-center gap-0.5 text-[10px] font-medium ${variation > 0 ? arrowUpClass : arrowDownClass}`}>
                                {variation > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                {(Math.abs(variation) * 100).toFixed(1)}%
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-300">-</span>
                            )}
                          </div>

                          {isApplied && !isScaleProjected && !isLiqProjected && (
                            <div className="absolute hidden group-hover/cell:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-50 pointer-events-none">
                              <div className="font-semibold mb-1.5 text-gray-200">{row.sellerName} <span className="text-gray-400 font-normal">| {m}</span></div>
                              <div className="flex justify-between mt-2">
                                <span className="text-gray-400">Facturación:</span>
                                <span className="font-medium">{formatCurrency(liq.valor_facturado)}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-gray-400" title="Subtotal antes de Botmaker e IVA">Subtotal ML ({alicuotaLabel}):</span>
                                <span className="font-bold text-blue-300">{formatCurrency(liq.subtotal_mercado_libre)}</span>
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
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
    </div>
  );
}
