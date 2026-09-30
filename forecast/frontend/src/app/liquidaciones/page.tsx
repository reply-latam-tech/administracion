'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LiquidacionesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: dbData, error } = await supabase
        .from('liquidaciones')
        .select('*')
        .order('periodo', { ascending: false })
        .order('nombre_seller', { ascending: true });

      if (error) {
        console.error('Error fetching liquidaciones:', error);
        setLoading(false);
        return;
      }

      // Group by Seller
      const sellersMap: Record<string, any> = {};
      const globalMonthsSet = new Set<string>();
      const monthSortMap: Record<string, string> = {};

      if (dbData) {
        dbData.forEach((row: any) => {
          const date = new Date(row.periodo + "T12:00:00");
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const sortKey = `${yyyy}-${mm}`;
          
          let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
          mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);

          globalMonthsSet.add(mStr);
          monthSortMap[mStr] = sortKey;

          const sId = row.seller_id;
          if (!sellersMap[sId]) {
            sellersMap[sId] = {
              id: sId,
              name: row.nombre_seller,
              months: {}
            };
          }
          
          sellersMap[sId].months[mStr] = {
            estado: row.estado || 'REAL',
            facturacion: row.valor_facturado,
            fee: row.tipo_cargo_aplicado === 'MINIMO' ? 'MÍNIMO' : row.alicuota_aplicada,
            montoServicio: row.subtotal_mercado_libre,
            botmaker: row.botmaker,
            botmaker_original: row.botmaker_original,
            cobrar_botmaker: row.cobrar_botmaker,
            subtotal: row.subtotal,
            iva: row.iva,
            total: row.total_factura
          };
        });
      }

      const sortedMonths = Array.from(globalMonthsSet).sort((a, b) => monthSortMap[a].localeCompare(monthSortMap[b]));
      const sortedSellers = Object.values(sellersMap).sort((a, b) => a.name.localeCompare(b.name));

      setData({
        months: sortedMonths,
        sellers: sortedSellers
      });
      setLoading(false);
    }
    
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  const formatPercent = (val: number | string | null) => {
    if (val === 'MÍNIMO') return 'MÍNIMO';
    return val !== null && typeof val === 'number' ? new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 2 }).format(val) : '-';
  };

  return (
    <div className="space-y-6 pb-12 w-full h-full overflow-hidden flex flex-col">
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Montos a Facturar (Liquidaciones)</h1>
            <p className="text-sm text-gray-500">Cálculo automático de cargos por seller según escala</p>
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
            Las columnas resaltadas en color naranja indican valores <span className="font-bold">proyectados</span>. 
            El motor de cálculo asume la facturación proyectada (basada en el promedio de ventas diarias para el mes en curso, y en tendencias históricas para meses futuros), y cruza dichos montos con las escalas correspondientes ajustadas por inflación esperada. Los montos de servicio, IVA y Totales se derivan automáticamente de estas suposiciones.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold sticky left-0 bg-gray-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">Concepto</th>
                {data.months?.map((m: string) => (
                  <th key={m} scope="col" className="px-6 py-4 font-semibold text-right min-w-[150px] uppercase border-l border-gray-100">{m}</th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-pulse">Calculando liquidaciones...</div>
                  </td>
                </tr>
              </tbody>
            ) : (
              data.sellers?.map((seller: any, sIdx: number) => (
                <tbody key={seller.id} className={`${sIdx > 0 ? 'border-t-8 border-gray-100' : ''}`}>
                  {/* Fila Cliente */}
                  <tr className="bg-orange-50/50">
                    <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-orange-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-900 border-r border-orange-100">
                      Cliente
                    </td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-3 whitespace-nowrap text-right font-bold border-l relative ${isProjected ? 'border-orange-200 bg-orange-100/50 text-orange-900' : 'border-orange-100 bg-orange-50/30 text-gray-900'}`}>
                          {seller.name}
                        </td>
                      );
                    })}
                  </tr>
                  
                  {/* Fila Facturación */}
                  <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-600 font-medium">Facturación</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProjected ? 'bg-orange-50/30 border-orange-50 text-orange-900' : 'border-gray-50 text-gray-800'}`}>
                          {seller.months[m] ? formatCurrency(seller.months[m].facturacion) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila Fee */}
                  <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-600 font-medium">Fee</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProjected ? 'bg-orange-50/30 border-orange-50 text-orange-900' : 'border-gray-50 text-gray-800'}`}>
                          {seller.months[m] ? formatPercent(seller.months[m].fee) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila Monto Servicio */}
                  <tr className="bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-900 font-bold">Monto Servicio</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right font-semibold border-l ${isProjected ? 'bg-orange-100/40 border-orange-100/50 text-orange-900' : 'border-gray-100 text-gray-900'}`}>
                          {seller.months[m] ? formatCurrency(seller.months[m].montoServicio) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila Botmaker */}
                  <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-600 font-medium">Botmaker</td>
                    {data.months.map((m: string) => {
                      const mData = seller.months[m];
                      const isProjected = mData?.estado === 'PROYECTADO';
                      if (!mData) return <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProjected ? 'bg-orange-50/30 border-orange-50 text-orange-600' : 'border-gray-50 text-gray-600'}`}>-</td>;
                      
                      const hasBotmaker = mData.botmaker_original !== null && mData.botmaker_original > 0;
                      const showDot = hasBotmaker && !mData.cobrar_botmaker;
                      
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProjected ? 'bg-orange-50/30 border-orange-50 text-orange-800' : 'border-gray-50 text-gray-600'}`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {showDot && (
                              <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" title="Cuenta con servicio Botmaker pero está bonificado (no se cobra)"></span>
                            )}
                            <span>{mData.botmaker !== null && mData.botmaker !== undefined ? formatCurrency(mData.botmaker) : '-'}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila Subtotal */}
                  <tr className="bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-900 font-bold">Subtotal</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right font-semibold border-l ${isProjected ? 'bg-orange-100/40 border-orange-100/50 text-orange-900' : 'border-gray-100 text-gray-900'}`}>
                          {seller.months[m] ? formatCurrency(seller.months[m].subtotal) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila IVA */}
                  <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <td className="px-6 py-2.5 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-600 font-medium">IVA</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-2.5 whitespace-nowrap text-right border-l ${isProjected ? 'bg-orange-50/30 border-orange-50 text-orange-800' : 'border-gray-50 text-gray-600'}`}>
                          {seller.months[m] ? formatCurrency(seller.months[m].iva) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Fila Total Factura */}
                  <tr className="bg-green-50/50 hover:bg-green-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap sticky left-0 bg-green-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-green-900 font-bold border-r border-green-100">Total Factura</td>
                    {data.months.map((m: string) => {
                      const isProjected = seller.months[m]?.estado === 'PROYECTADO';
                      return (
                        <td key={m} className={`px-6 py-3 whitespace-nowrap text-right font-black border-l ${isProjected ? 'bg-orange-100/50 border-orange-200/50 text-orange-900' : 'border-green-100 text-green-900'}`}>
                          {seller.months[m] ? formatCurrency(seller.months[m].total) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              ))
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
