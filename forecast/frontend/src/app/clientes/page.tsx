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
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-600" />
              Directorio de Clientes
            </h1>
            <p className="text-sm text-gray-500 mt-1">Estado de integración y configuración de cada cuenta en tiempo real</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-4 border-r border-gray-200">
              <p className="text-2xl font-bold text-gray-900">{sellersInfo.length}</p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cuentas</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-emerald-600">
                {sellersInfo.filter(s => s.hasOrders && s.hasFacturacion && s.hasEscalas).length}
              </p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-sm text-gray-500">Cargando directorio...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-center">Frecuencia</th>
                  <th className="px-6 py-4 font-semibold text-center" title="Facturación Histórica (Mensual)">Facturación</th>
                  <th className="px-6 py-4 font-semibold text-center" title="Órdenes de Mercado Libre (Diarias)">Órdenes ML</th>
                  <th className="px-6 py-4 font-semibold text-center" title="Matriz de Escalas Cargada">Escalas</th>
                  <th className="px-6 py-4 font-semibold text-center">Botmaker</th>
                  <th className="px-6 py-4 font-semibold text-center">Último Mes Real</th>
                  <th className="px-6 py-4 font-semibold text-right">Última Tarifa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sellersInfo.map((seller) => (
                  <tr key={seller.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${seller.estado === 'activa' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <p className="font-semibold text-gray-900">{seller.nombre}</p>
                          <p className="text-xs text-gray-400 font-mono">{seller.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                        seller.frecuencia === 'MENSUAL' 
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10' 
                          : 'bg-gray-100 text-gray-700 ring-1 ring-gray-500/10'
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
