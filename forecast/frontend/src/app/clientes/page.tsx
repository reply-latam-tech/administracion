'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, XCircle, Clock, Calendar, AlertCircle, Database, TrendingUp, DollarSign } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ClientesPage() {
  const [sellersInfo, setSellersInfo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch sellers
      const { data: sellers } = await supabase.from('dim_sellers').select('*').order('nombre_seller');
      
      if (!sellers) {
        setLoading(false);
        return;
      }

      // 2. Fetch liquidaciones for last month info
      const { data: liquidaciones } = await supabase
        .from('liquidaciones')
        .select('seller_id, periodo, tipo_cargo_aplicado, alicuota_aplicada, estado')
        .eq('estado', 'REAL')
        .order('periodo', { ascending: false });

      // 3. Fetch facturacion_real_historica
      const { data: facturacion } = await supabase.from('facturacion_real_historica').select('seller_id, periodo_origen');

      // 4. Check orders (parallel requests limit 1 for min and max dates)
      const orderMinChecks = await Promise.all(
        sellers.map(s => supabase.from('ordenes').select('date_created').eq('seller_id', s.id_seller).order('date_created', { ascending: true }).limit(1))
      );
      const orderMaxChecks = await Promise.all(
        sellers.map(s => supabase.from('ordenes').select('date_created').eq('seller_id', s.id_seller).order('date_created', { ascending: false }).limit(1))
      );

      // 5. Check escalas
      const { data: escalas } = await supabase.from('dim_escalas').select('seller_id, periodo');

      // Helper to get min and max dates from array
      const getMinMaxDates = (arr: any[], field: string) => {
        if (!arr || arr.length === 0) return null;
        const sorted = [...arr].map(x => x[field]).filter(Boolean).sort();
        if (sorted.length === 0) return null;
        return { min: sorted[0], max: sorted[sorted.length - 1] };
      };

      // 6. Combine
      const combined = sellers.map((seller, index) => {
        const factArr = facturacion?.filter(f => f.seller_id === seller.id_seller) || [];
        const escArr = escalas?.filter(e => e.seller_id === seller.id_seller) || [];
        
        const factDates = getMinMaxDates(factArr, 'periodo_origen');
        const escDates = getMinMaxDates(escArr, 'periodo');

        const minOrder = orderMinChecks[index].data?.[0]?.date_created;
        const maxOrder = orderMaxChecks[index].data?.[0]?.date_created;
        const orderDates = minOrder && maxOrder ? { min: minOrder.split('T')[0], max: maxOrder.split('T')[0] } : null;

        const hasOrders = !!orderDates;
        const hasFacturacion = !!factDates;
        const hasEscalas = !!escDates;
        
        // Find last REAL liquidacion
        const lastLiq = liquidaciones?.find(l => l.seller_id === seller.id_seller);
        
        return {
          id: seller.id_seller,
          nombre: seller.nombre_seller,
          frecuencia: seller.frecuencia_actualizacion,
          botmaker: seller.cobrar_botmaker,
          estado: seller.estado,
          hasEscalas,
          escDates,
          hasOrders,
          orderDates,
          hasFacturacion,
          factDates,
          ultimoMesFacturado: lastLiq ? lastLiq.periodo : null,
          ultimaAlicuota: lastLiq ? (lastLiq.tipo_cargo_aplicado === 'MINIMO' ? 'MÍNIMO' : lastLiq.alicuota_aplicada) : null
        };
      });

      setSellersInfo(combined);
      setLoading(false);
    }
    
    fetchData();
  }, []);

  const formatPercent = (val: number | string | null) => {
    if (!val) return '-';
    if (val === 'MÍNIMO') return 'MÍNIMO';
    return typeof val === 'number' ? new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 2 }).format(val) : val;
  };

  const StatusIcon = ({ active, label }: { active: boolean, label?: string }) => (
    <div className="flex items-center justify-center gap-1.5" title={label}>
      {active ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      ) : (
        <XCircle className="w-5 h-5 text-rose-400" />
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-12 w-full h-full overflow-hidden flex flex-col">
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <Database className="w-5 h-5 text-[#ff5100]" />
              Directorio de Sellers & Estado de Ingesta
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo en tiempo real de cobertura histórica, tokens de API de Mercado Libre y matrices tarifarias
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-4 border-r border-slate-200">
              <p className="text-2xl font-bold text-slate-900">{sellersInfo.length}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cuentas</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-[#4981fb]">
                {sellersInfo.filter(s => s.hasOrders && s.hasFacturacion && s.hasEscalas).length}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Completas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#4981fb] border-t-transparent"></div>
              <p className="text-xs text-slate-500 font-medium">Cargando directorio de cuentas...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-50/90 sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-700">Cliente</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center">Frecuencia</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center" title="Facturación Histórica (Mensual)">Facturación</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center" title="Órdenes de Mercado Libre (Diarias)">Órdenes ML</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center" title="Matriz de Escalas Cargada">Escalas</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center">Botmaker</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-center">Último Mes Real</th>
                  <th className="px-6 py-4 font-bold text-slate-700 text-right">Última Tarifa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sellersInfo.map((seller) => (
                  <tr key={seller.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${seller.estado === 'activa' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{seller.nombre}</p>
                            {seller.id >= 900000000 && seller.id < 1000000000 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Falta completar el Seller ID oficial">
                                ⚠️ ID Pendiente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            {seller.id >= 900000000 && seller.id < 1000000000 ? (
                              <span className="text-amber-600/80 italic font-sans text-[11px]">Sin ID oficial (Completar)</span>
                            ) : (
                              seller.id
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                        seller.frecuencia === 'MENSUAL' 
                          ? 'bg-[#eff5ff] text-[#275ec9] border border-[#daebfe]' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {seller.frecuencia || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {seller.hasFacturacion && seller.factDates ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-emerald-600 font-medium">Desde {seller.factDates.min.slice(0,7)}</span>
                          <span className="text-xs text-gray-500">hasta {seller.factDates.max.slice(0,7)}</span>
                        </div>
                      ) : (
                        <StatusIcon active={false} label="Sin facturación" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {seller.hasOrders && seller.orderDates ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-emerald-600 font-medium">Desde {seller.orderDates.min}</span>
                          <span className="text-xs text-gray-500">hasta {seller.orderDates.max}</span>
                        </div>
                      ) : (
                        <StatusIcon active={false} label="Sin órdenes" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {seller.hasEscalas && seller.escDates ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-emerald-600 font-medium">Desde {seller.escDates.min.slice(0,7)}</span>
                          <span className="text-xs text-gray-500">hasta {seller.escDates.max.slice(0,7)}</span>
                        </div>
                      ) : (
                        <StatusIcon active={false} label="Sin escalas" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                       {seller.botmaker ? (
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 ring-1 ring-purple-700/10">
                           <DollarSign className="w-3.5 h-3.5" />
                           Cobrado
                         </span>
                       ) : (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-gray-400">
                           No
                         </span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {seller.ultimoMesFacturado ? (
                        <div className="flex items-center justify-center gap-2 text-gray-700">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {new Date(seller.ultimoMesFacturado + "T12:00:00").toLocaleDateString("es-AR", { month: "short", year: "numeric" }).toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <span className={`font-semibold ${seller.ultimaAlicuota === 'MÍNIMO' ? 'text-amber-600' : 'text-indigo-600'}`}>
                         {formatPercent(seller.ultimaAlicuota)}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
