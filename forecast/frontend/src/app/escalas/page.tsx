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
          
          let tipo_cargo = row.tipo_cargo_aplicado;
          let alicuota = row.alicuota_aplicada;
          let subtotal_mercado_libre = row.subtotal_mercado_libre;

          // Soporte para cálculo exacto en USD de Natura Colombia (seller_id 941943480)
          if (String(row.seller_id) === '941943480') {
            const pKey = row.periodo?.substring(0, 7);
            const naturaMap: Record<string, { tipo: string; alicuota: number; subtotal: number }> = {
              '2026-02': { tipo: 'MINIMO', alicuota: 0, subtotal: 1200.00 },
              '2026-03': { tipo: 'PORCENTUAL', alicuota: 0.0293, subtotal: 1217.47 },
              '2026-04': { tipo: 'MINIMO', alicuota: 0, subtotal: 1200.00 },
              '2026-05': { tipo: 'PORCENTUAL', alicuota: 0.0276, subtotal: 1365.38 },
              '2026-06': { tipo: 'PORCENTUAL', alicuota: 0.0276, subtotal: 1374.38 },
              '2026-07': { tipo: 'PORCENTUAL', alicuota: 0.0276, subtotal: 1868.56 },
              '2026-08': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 1716.24 },
              '2026-09': { tipo: 'PORCENTUAL', alicuota: 0.0228, subtotal: 2108.48 },
              // 12 Meses Proyectados (cruce Facturación COP proyectada / TC proyectado -> Escala USD)
              '2026-10': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 1742.23 },
              '2026-11': { tipo: 'PORCENTUAL', alicuota: 0.0228, subtotal: 2170.76 },
              '2026-12': { tipo: 'PORCENTUAL', alicuota: 0.0228, subtotal: 2588.12 },
              '2027-01': { tipo: 'PORCENTUAL', alicuota: 0.0276, subtotal: 1617.70 },
              '2027-02': { tipo: 'PORCENTUAL', alicuota: 0.0276, subtotal: 1749.13 },
              '2027-03': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 1856.25 },
              '2027-04': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 1923.73 },
              '2027-05': { tipo: 'PORCENTUAL', alicuota: 0.0228, subtotal: 2314.34 },
              '2027-06': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 2025.41 },
              '2027-07': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 2095.52 },
              '2027-08': { tipo: 'PORCENTUAL', alicuota: 0.0244, subtotal: 2166.62 },
              '2027-09': { tipo: 'PORCENTUAL', alicuota: 0.0228, subtotal: 2282.10 },
            };
            if (naturaMap[pKey]) {
              tipo_cargo = naturaMap[pKey].tipo;
              alicuota = naturaMap[pKey].alicuota;
              subtotal_mercado_libre = naturaMap[pKey].subtotal;
            }
          }

          // Soporte para cálculo exacto en USD de Disuiza Colombia (seller_id 964690754)
          if (String(row.seller_id) === '964690754') {
            const pKey = row.periodo?.substring(0, 7);
            const tcCopMap: Record<string, number> = {
              '2024-04': 3897.0, '2024-05': 3897.0, '2024-06': 3897.0, '2024-07': 3897.0,
              '2024-08': 3897.0, '2024-09': 3897.0, '2024-10': 3897.0, '2024-11': 3897.0, '2024-12': 3897.0,
              '2025-01': 3950.0, '2025-02': 3970.0, '2025-03': 3990.0, '2025-04': 4305.02,
              '2025-05': 4107.0, '2025-06': 3974.37, '2025-07': 4097.38, '2025-08': 4016.0,
              '2025-09': 3897.0, '2025-10': 3800.0, '2025-11': 3784.0, '2025-12': 3790.77,
              '2026-01': 3622.0, '2026-02': 3769.0, '2026-03': 3660.0, '2026-04': 3660.0,
              '2026-05': 3562.0, '2026-06': 3440.83, '2026-07': 3205.80, '2026-08': 3213.97,
              '2026-09': 3312.84, '2026-10': 3325.00, '2026-11': 3340.00, '2026-12': 3360.00,
              '2027-01': 3375.00, '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
              '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00, '2027-08': 3485.00,
              '2027-09': 3500.00
            };
            const currentTc = (pKey && tcCopMap[pKey]) || 3350.0;
            const factVal = Number(row.valor_facturado) || 0;
            const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
            const comision2pct = factUsd * 0.02;
            const feeFinal = Math.max(1500.0, comision2pct);

            subtotal_mercado_libre = Math.round(feeFinal * 100) / 100;
            tipo_cargo = feeFinal === 1500.0 ? 'MINIMO' : 'PORCENTUAL';
            alicuota = feeFinal === 1500.0 ? 0 : 0.02;
          }

          // Soporte para cálculo exacto en COP de Evacol Colombia ML (seller_id 928666257)
          if (String(row.seller_id) === '928666257') {
            const pKey = row.periodo?.substring(0, 7);
            const tcCopMap: Record<string, number> = {
              '2026-02': 3769.00, '2026-03': 3660.00, '2026-04': 3660.00,
              '2026-05': 3562.00, '2026-06': 3440.83, '2026-07': 3205.80,
              '2026-08': 3213.97, '2026-09': 3312.84, '2026-10': 3325.00,
              '2026-11': 3340.00, '2026-12': 3360.00, '2027-01': 3375.00,
              '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
              '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00,
              '2027-08': 3485.00, '2027-09': 3500.00
            };
            const currentTc = (pKey && tcCopMap[pKey]) || 3350.0;
            const factVal = Number(row.valor_facturado) || 0;
            const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
            
            let feeUsd = 1000.0;
            let alicuotaVal = 0;
            let tipoCargoVal = 'MINIMO';
            if (factUsd >= 150000) {
              feeUsd = factUsd * 0.02;
              alicuotaVal = 0.02;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 110000) {
              feeUsd = factUsd * 0.025;
              alicuotaVal = 0.025;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 80000) {
              feeUsd = factUsd * 0.03;
              alicuotaVal = 0.03;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 60000) {
              feeUsd = factUsd * 0.035;
              alicuotaVal = 0.035;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 50000) {
              feeUsd = factUsd * 0.04;
              alicuotaVal = 0.04;
              tipoCargoVal = 'PORCENTUAL';
            } else {
              feeUsd = 1000.0;
              alicuotaVal = 0;
              tipoCargoVal = 'MINIMO';
            }

            subtotal_mercado_libre = Math.round(feeUsd * currentTc);
            tipo_cargo = tipoCargoVal;
            alicuota = alicuotaVal;
          }

          // Soporte para Evacol Colombia ADDI (seller_id 928424062)
          if (String(row.seller_id) === '928424062') {
            subtotal_mercado_libre = 1000.00;
            tipo_cargo = 'FIJO';
            alicuota = 0;
          }

          // Soporte para Formex Colombia (seller_id 127711636)
          if (String(row.seller_id) === '127711636') {
            const pKey = row.periodo?.substring(0, 7);
            const tcCopMap: Record<string, number> = {
              '2026-05': 3562.00, '2026-06': 3440.83, '2026-07': 3205.80,
              '2026-08': 3213.97, '2026-09': 3312.84, '2026-10': 3325.00,
              '2026-11': 3340.00, '2026-12': 3360.00, '2027-01': 3375.00,
              '2027-02': 3390.00, '2027-03': 3410.00, '2027-04': 3425.00,
              '2027-05': 3440.00, '2027-06': 3455.00, '2027-07': 3470.00,
              '2027-08': 3485.00, '2027-09': 3500.00
            };
            const currentTc = (pKey && tcCopMap[pKey]) || 3350.0;
            const factVal = Number(row.valor_facturado) || 0;
            const factUsd = currentTc > 0 ? (factVal / currentTc) : 0;
            
            let feeUsd = 1000.0;
            let alicuotaVal = 0;
            let tipoCargoVal = 'MINIMO';
            if (factUsd >= 230000) {
              feeUsd = factUsd * 0.0130;
              alicuotaVal = 0.0130;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 170000) {
              feeUsd = factUsd * 0.0163;
              alicuotaVal = 0.0163;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 125000) {
              feeUsd = factUsd * 0.0195;
              alicuotaVal = 0.0195;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 90000) {
              feeUsd = factUsd * 0.0228;
              alicuotaVal = 0.0228;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 70000) {
              feeUsd = factUsd * 0.0244;
              alicuotaVal = 0.0244;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 45000) {
              feeUsd = factUsd * 0.0276;
              alicuotaVal = 0.0276;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 35000) {
              feeUsd = factUsd * 0.0293;
              alicuotaVal = 0.0293;
              tipoCargoVal = 'PORCENTUAL';
            } else {
              feeUsd = 1000.0;
              alicuotaVal = 0;
              tipoCargoVal = 'MINIMO';
            }

            subtotal_mercado_libre = Math.round(feeUsd * 100) / 100;
            tipo_cargo = tipoCargoVal;
            alicuota = alicuotaVal;
          }

          // Soporte para Evacol Amazon USA (seller_id 918210724)
          if (String(row.seller_id) === '918210724') {
            const factVal = Number(row.valor_facturado) || 0;
            const factUsd = factVal;
            
            let feeUsd = 1000.0;
            let alicuotaVal = 0;
            let tipoCargoVal = 'MINIMO';
            if (factUsd >= 230000) {
              feeUsd = factUsd * 0.0130;
              alicuotaVal = 0.0130;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 170000) {
              feeUsd = factUsd * 0.0163;
              alicuotaVal = 0.0163;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 125000) {
              feeUsd = factUsd * 0.0195;
              alicuotaVal = 0.0195;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 90000) {
              feeUsd = factUsd * 0.0228;
              alicuotaVal = 0.0228;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 70000) {
              feeUsd = factUsd * 0.0244;
              alicuotaVal = 0.0244;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 45000) {
              feeUsd = factUsd * 0.0276;
              alicuotaVal = 0.0276;
              tipoCargoVal = 'PORCENTUAL';
            } else if (factUsd >= 35000) {
              feeUsd = factUsd * 0.0293;
              alicuotaVal = 0.0293;
              tipoCargoVal = 'PORCENTUAL';
            } else {
              feeUsd = 1000.0;
              alicuotaVal = 0;
              tipoCargoVal = 'MINIMO';
            }

            subtotal_mercado_libre = Math.round(feeUsd * 100) / 100;
            tipo_cargo = tipoCargoVal;
            alicuota = alicuotaVal;
          }

          // Soporte para Evacol México ML (seller_id 807100133)
          if (String(row.seller_id) === '807100133') {
            const pKey = row.periodo?.substring(0, 7);
            const tcMxnMap: Record<string, number> = {
              '2026-05': 16.70, '2026-06': 17.50, '2026-07': 17.80,
              '2026-08': 16.97, '2026-09': 18.07, '2026-10': 18.12,
              '2026-11': 18.18, '2026-12': 18.25, '2027-01': 18.32,
              '2027-02': 18.38, '2027-03': 18.45, '2027-04': 18.52,
              '2027-05': 18.58, '2027-06': 18.65, '2027-07': 18.72,
              '2027-08': 18.80, '2027-09': 18.90
            };
            const currentTc = (pKey && tcMxnMap[pKey]) || 18.12;
            const factVal = Number(row.valor_facturado) || 0;
            const gmvUsd = factVal > 500000 ? (factVal / currentTc) : factVal;
            const baseNetaUsd = gmvUsd / 1.16;
            
            let feeUsd = 1000.0;
            let alicuotaVal = 0;
            let tipoCargoVal = 'MINIMO';
            if (baseNetaUsd >= 230000) {
              feeUsd = baseNetaUsd * 0.0130;
              alicuotaVal = 0.0130;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 170000) {
              feeUsd = baseNetaUsd * 0.0163;
              alicuotaVal = 0.0163;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 125000) {
              feeUsd = baseNetaUsd * 0.0195;
              alicuotaVal = 0.0195;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 90000) {
              feeUsd = baseNetaUsd * 0.0228;
              alicuotaVal = 0.0228;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 70000) {
              feeUsd = baseNetaUsd * 0.0244;
              alicuotaVal = 0.0244;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 45000) {
              feeUsd = baseNetaUsd * 0.0276;
              alicuotaVal = 0.0276;
              tipoCargoVal = 'PORCENTUAL';
            } else if (baseNetaUsd >= 35000) {
              feeUsd = baseNetaUsd * 0.0293;
              alicuotaVal = 0.0293;
              tipoCargoVal = 'PORCENTUAL';
            } else {
              feeUsd = 1000.0;
              alicuotaVal = 0;
              tipoCargoVal = 'MINIMO';
            }

            subtotal_mercado_libre = Math.round(feeUsd * currentTc * 100) / 100;
            tipo_cargo = tipoCargoVal;
            alicuota = alicuotaVal;
          }

          liqMap[row.seller_id][mStr] = {
            tipo_cargo,
            alicuota,
            valor_facturado: row.valor_facturado,
            subtotal_mercado_libre,
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
              if (a.tipoCargo === 'SESIONES' && b.tipoCargo === 'SESIONES') {
                return a.alicuota - b.alicuota;
              }
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

  const formatCurrency = (val: number, currency = 'ARS') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    }
    if (currency === 'COP') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
    }
    if (currency === 'MXN') {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
  };

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
                      const alicuotaLabel = 
                        cellData.tipoCargo === 'MINIMO' 
                          ? 'MÍN' 
                          : cellData.tipoCargo === 'SESIONES'
                          ? `${Math.round(cellData.alicuota).toLocaleString('es-AR')} ses`
                          : formatPercent(cellData.alicuota);

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
                              {formatCurrency(val, row.moneda)}
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
                                <span className="font-medium">{formatCurrency(liq.valor_facturado, row.sellerName.includes('Colombia') ? 'COP' : row.moneda)}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-gray-400" title="Subtotal antes de Botmaker e IVA">Subtotal ML ({alicuotaLabel}):</span>
                                <span className="font-bold text-blue-300">{formatCurrency(liq.subtotal_mercado_libre, row.sellerName.includes('Colombia') || row.moneda === 'USD' ? 'USD' : row.moneda)}</span>
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
