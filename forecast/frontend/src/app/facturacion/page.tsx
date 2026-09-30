'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowUpRight, ArrowDownRight, LineChart as LucideLineChart, BarChart as LucideBarChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function FacturacionPage() {
  const [data, setData] = useState<any[]>([]);
  const [monthsStr, setMonthsStr] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [sellerNames, setSellerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [variationType, setVariationType] = useState<'monthly' | 'yearly'>('monthly');
  const [valueType, setValueType] = useState<'absolute' | 'relative'>('absolute');
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [estMensual, setEstMensual] = useState<any[]>([]);
  const [estDiaria, setEstDiaria] = useState<any[]>([]);
  const [sellersMapRef, setSellersMapRef] = useState<any>({});

  useEffect(() => {
    async function fetchData() {
      const { data: sellersData, error: errSellers } = await supabase
        .from('dim_sellers')
        .select('*');
        
      if (errSellers) {
        console.error(errSellers);
        return;
      }
      
      const sellersMap: any = {};
      sellersData.forEach((s: any) => {
        sellersMap[s.id_seller] = {
          name: s.nombre_seller,
          pais: s.pais,
          moneda: s.moneda
        };
      });

      const { data: factData, error: errFact } = await supabase
        .from('facturacion')
        .select('*')
        .order('periodo', { ascending: true });

      if (errFact) {
        console.error(errFact);
        setLoading(false);
        return;
      }

      const sellersGroups: Record<string, any> = {};
      const periodosSet = new Set<string>();

      const rawMap: any = {};
      factData.forEach((row: any) => {
          if (!rawMap[row.seller_id]) rawMap[row.seller_id] = {};
          rawMap[row.seller_id][row.periodo] = row.valor_facturado;
      });

      factData.forEach((row: any) => {
        periodosSet.add(row.periodo);
        const sId = row.seller_id;
        if (!sellersGroups[sId]) {
          const sellerInfo = sellersMap[sId] || { name: `Seller ${sId}`, pais: 'ARG', moneda: 'ARS' };
          sellersGroups[sId] = {
            sellerId: sId,
            sellerName: sellerInfo.name,
            pais: sellerInfo.pais,
            moneda: sellerInfo.moneda,
            months: {}
          };
        }
        
        const date = new Date(row.periodo + "T12:00:00");
        date.setFullYear(date.getFullYear() - 1);
        const prevYearPeriodo = date.toISOString().split('T')[0];
        
        const prevVal = rawMap[sId]?.[prevYearPeriodo];
        let varAnual = 0;
        if (prevVal && prevVal > 0) {
            varAnual = (row.valor_facturado - prevVal) / prevVal;
        }

        sellersGroups[sId].months[row.periodo] = {
          valor: row.valor_facturado,
          variacion_mensual: row.variacion_mensual,
          variacion_anual: varAnual,
          estado: row.estado || 'REAL'
        };
      });

      const { data: estMensualData } = await supabase.from('estacionalidad_mensual').select('*');
      const { data: estDiariaData } = await supabase.from('estacionalidad_diaria').select('*');
      
      setEstMensual(estMensualData || []);
      setEstDiaria(estDiariaData || []);
      setSellersMapRef(sellersMap);

      const sortedPeriodos = Array.from(periodosSet).sort();

      const rowsArray = Object.values(sellersGroups).sort((a: any, b: any) => 
        a.sellerName.localeCompare(b.sellerName)
      ).map((row: any) => {
        let prevMonthVal = 0;
        let maxVal = 0;
        
        sortedPeriodos.forEach(p => {
            const cell = row.months[p];
            if (cell) {
                if (cell.valor > maxVal) maxVal = cell.valor;
                if (prevMonthVal > 0) {
                    cell.variacion_mensual = (cell.valor - prevMonthVal) / prevMonthVal;
                } else {
                    cell.variacion_mensual = 0;
                }
                prevMonthVal = cell.valor;
            }
        });
        
        return { ...row, maxVal: Math.max(maxVal, 1) };
      });

      const cData: any[] = [];
      const sNames = new Set<string>();

      sortedPeriodos.forEach(p => {
         const mStr = formatMonthStr(p);
         const rowData: any = { name: mStr, periodo: p, total: 0 };
         Object.values(sellersGroups).forEach((sg: any) => {
             sNames.add(sg.sellerName);
             const val = sg.months[p]?.valor || 0;
             rowData[sg.sellerName] = val;
             rowData.total += val;
             rowData[`${sg.sellerName}_varM`] = sg.months[p]?.variacion_mensual || 0;
             rowData[`${sg.sellerName}_varA`] = sg.months[p]?.variacion_anual || 0;
             rowData[`${sg.sellerName}_estado`] = sg.months[p]?.estado || 'REAL';
         });
         cData.push(rowData);
      });
      
      for (let i = 0; i < cData.length; i++) {
          if (i > 0) {
              const prevTotal = cData[i-1].total;
              cData[i].total_varM = prevTotal ? (cData[i].total - prevTotal) / prevTotal : 0;
          } else cData[i].total_varM = 0;
          
          const date = new Date(cData[i].periodo + "T12:00:00");
          date.setFullYear(date.getFullYear() - 1);
          const prevYearP = date.toISOString().split('T')[0];
          const prevYearRow = cData.find((c: any) => c.periodo === prevYearP);
          if (prevYearRow && prevYearRow.total) {
              cData[i].total_varA = (cData[i].total - prevYearRow.total) / prevYearRow.total;
          } else cData[i].total_varA = 0;
      }

      setSellerNames(Array.from(sNames));
      setChartData(cData);
      setMonthsStr(sortedPeriodos);
      setData(rowsArray);
      setLoading(false);
    }
    
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  const formatMonthStr = (p: string) => {
    const d = new Date(p + "T12:00:00");
    let mStr = d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
    return mStr.charAt(0).toUpperCase() + mStr.slice(1);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = data.total;
      const totalVar = variationType === 'monthly' ? data.total_varM : data.total_varA;
      
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100/50 text-xs min-w-[200px]">
          <div className="font-bold text-gray-800 mb-2 border-b border-gray-100/80 pb-2 flex justify-between items-center">
            <span>{label}</span>
          </div>
          <div className="space-y-1.5 mb-2">
            {payload.map((entry: any, index: number) => {
              const varValue = data[`${entry.name}_var${variationType === 'monthly' ? 'M' : 'A'}`];
              if (entry.value === 0) return null;
              const percentage = total > 0 ? (entry.value / total) * 100 : 0;
              return (
                <div key={index} className="flex justify-between items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600 font-medium">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right flex flex-col">
                      <span className="font-semibold text-gray-900 leading-tight">{formatCurrency(entry.value)}</span>
                      <span className="text-[10px] text-gray-400 font-medium leading-tight">{percentage.toFixed(1)}%</span>
                    </div>
                    {varValue !== 0 && varValue != null ? (
                      <span className={`text-[10px] w-10 text-right ${varValue > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {varValue > 0 ? '+' : ''}{(varValue * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[10px] w-10 text-right text-transparent">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100/80 pt-2 flex justify-between items-center">
            <span className="font-bold text-gray-700">Total Bruto</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
              {totalVar !== 0 && totalVar != null ? (
                <span className={`text-[10px] w-10 text-right font-medium ${totalVar > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totalVar > 0 ? '+' : ''}{(totalVar * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] w-10 text-right text-transparent">-</span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const { chartMensual, chartDOW, chartDOM } = useMemo(() => {
    let mData: any[] = [];
    let dowData: any[] = [];
    let domData: any[] = [];

    const dows = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    let selectedId: any = null;
    if (selectedSeller) {
      const row = data.find(r => r.sellerName === selectedSeller);
      if (row) selectedId = row.sellerId;
    }

    // Mensual
    for (let i = 1; i <= 12; i++) {
      let val = 1.0;
      const arr = estMensual.filter(e => e.mes === i && (!selectedId || e.seller_id === selectedId));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      mData.push({ name: meses[i - 1], value: val });
    }

    // DOW
    for (let i = 1; i <= 7; i++) {
      let val = 1.0;
      const arr = estDiaria.filter(e => e.tipo === 'DIA_SEMANA' && e.llave === i && (!selectedId || e.seller_id === selectedId));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      dowData.push({ name: dows[i - 1], value: val });
    }

    // DOM
    for (let i = 1; i <= 31; i++) {
      let val = 1.0;
      const arr = estDiaria.filter(e => e.tipo === 'DIA_MES' && e.llave === i && (!selectedId || e.seller_id === selectedId));
      if (arr.length) val = arr.reduce((acc, curr) => acc + curr.indice_peso, 0) / arr.length;
      domData.push({ name: String(i), value: val });
    }

    return { chartMensual: mData, chartDOW: dowData, chartDOM: domData };
  }, [estMensual, estDiaria, selectedSeller, data]);

  const avgDOW = chartDOW.length ? chartDOW.reduce((a, b) => a + b.value, 0) / chartDOW.length : 1;
  const avgDOM = chartDOM.length ? chartDOM.reduce((a, b) => a + b.value, 0) / chartDOM.length : 1;
  const avgMensual = chartMensual.length ? chartMensual.reduce((a, b) => a + b.value, 0) / chartMensual.length : 1;

  return (
    <div className="space-y-6 pb-12 w-full h-full overflow-y-auto flex flex-col pr-2">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Historial de Facturación</h1>
          <p className="text-sm text-gray-500">Métricas de ingresos brutos por cliente</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-inner">
            <button
              onClick={() => setValueType('absolute')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${valueType === 'absolute' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Absoluto ($)
            </button>
            <button
              onClick={() => setValueType('relative')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${valueType === 'relative' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Relativo (%)
            </button>
          </div>
          <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-inner">
            <button
              onClick={() => setVariationType('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${variationType === 'monthly' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Var. Mensual
            </button>
            <button
              onClick={() => setVariationType('yearly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${variationType === 'yearly' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Var. Anual
            </button>
          </div>
          <div className="text-right border-l border-gray-100 pl-4 hidden md:block">
            <p className="text-xs font-medium text-gray-500">Última actualización</p>
            <p className="text-sm font-semibold text-gray-900">En tiempo real</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 shrink-0">
        <h2 className="text-md font-semibold text-gray-800 mb-4">Evolución de Facturación por Seller</h2>
        <div className="h-[300px] w-full">
          {loading ? (
             <div className="animate-pulse w-full h-full bg-gray-50 rounded"></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} stackOffset={valueType === 'relative' ? 'expand' : 'none'}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6B7280' }} 
                  tickFormatter={(value) => valueType === 'relative' ? `${(value * 100).toFixed(0)}%` : new Intl.NumberFormat('es-AR', { notation: "compact", compactDisplay: "short" }).format(value)} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {sellerNames.filter(name => !selectedSeller || name === selectedSeller).map((name, index) => {
                  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
                  const color = colors[index % colors.length];
                  return (
                    <Bar key={name} dataKey={name} stackId="a" fill={color}>
                      {chartData.map((entry, idx) => {
                         const isProjected = entry[`${name}_estado`] === 'PROYECTADO';
                         return (
                           <Cell 
                             key={`cell-${idx}`} 
                             fill={isProjected ? 'transparent' : color} 
                             stroke={color} 
                             strokeDasharray={isProjected ? "4 4" : undefined}
                             strokeWidth={isProjected ? 2 : 0} 
                           />
                         );
                      })}
                    </Bar>
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px] shrink-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold min-w-[220px] sticky left-0 bg-gray-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Seller</th>
                {monthsStr.map((p) => (
                  <th key={p} scope="col" className="px-4 py-3 font-medium text-right whitespace-nowrap min-w-[140px]">{formatMonthStr(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={monthsStr.length + 1} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-pulse">Cargando facturación...</div>
                  </td>
                </tr>
              ) : (
                data.map((row: any) => (
                  <tr 
                    key={row.sellerId} 
                    onClick={() => setSelectedSeller(selectedSeller === row.sellerName ? null : row.sellerName)}
                    className={`border-b border-gray-50 transition-colors group cursor-pointer ${selectedSeller === row.sellerName ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <td className={`px-4 py-3 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100 ${selectedSeller === row.sellerName ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                      <div className="font-semibold text-gray-900 text-[14px]">{row.sellerName}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{row.pais} | {row.moneda}</div>
                    </td>
                    
                    {monthsStr.map((p) => {
                      const cellData = row.months[p];
                      
                      if (!cellData) {
                        return (
                          <td key={p} className="px-4 py-3 text-right border-l border-gray-50">
                            <span className="text-gray-300">-</span>
                          </td>
                        );
                      }

                      const val = cellData.valor;
                      const variation = variationType === 'monthly' ? cellData.variacion_mensual : cellData.variacion_anual;
                      const barWidth = (val / row.maxVal) * 100;
                      const isProjected = cellData.estado === 'PROYECTADO';

                      return (
                        <td key={p} className={`px-4 py-3 text-right border-l border-gray-50 relative ${isProjected ? 'bg-orange-50/30' : ''}`}>
                          {isProjected && (
                             <div className="absolute top-0 right-0 mt-1 mr-1 flex">
                               <span className="relative flex h-1.5 w-1.5">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                               </span>
                             </div>
                          )}
                          <div className={`font-semibold text-[14px] mb-1 ${isProjected ? 'text-orange-900' : 'text-gray-800'}`}>
                             {formatCurrency(val)}
                             {isProjected && <span className="ml-1 text-[9px] text-orange-500 font-normal uppercase" title="Dato proyectado (Estacionalidad + REM BCRA)">*PROY</span>}
                          </div>
                          
                          <div className="h-3 flex items-center justify-end">
                            {variation !== null && variation !== 0 ? (
                              <div className={`flex items-center gap-0.5 text-[11px] font-medium ${variation > 0 ? (isProjected ? 'text-orange-600' : 'text-emerald-500') : 'text-rose-500'}`}>
                                {variation > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {(Math.abs(variation) * 100).toFixed(1)}%
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-300">-</span>
                            )}
                          </div>
                          
                          <div className="w-full bg-gray-100 rounded-full h-1 mt-2 overflow-hidden flex justify-end">
                            <div className={`${isProjected ? 'bg-orange-400' : 'bg-blue-400'} h-1 rounded-full transition-all duration-500`} style={{ width: `${barWidth}%` }}></div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        {/* Gráfico Día de la Semana */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <LucideBarChart size={18} className="text-blue-500" />
            <h3 className="font-semibold text-sm">Estacionalidad: Día de la Semana</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDOW} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: number) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgDOW} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Día del Mes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <LucideBarChart size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-sm">Estacionalidad: Día del Mes</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDOM} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} interval="preserveStartEnd" minTickGap={20} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: number) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgDOM} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Mensual */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-[280px]">
          <div className="flex items-center gap-2 mb-4 text-gray-800">
            <LucideBarChart size={18} className="text-purple-500" />
            <h3 className="font-semibold text-sm">Estacionalidad: Mensual (12 Meses)</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMensual} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(val: number) => [`Índice: ${val.toFixed(2)}`, 'Peso']}
                />
                <ReferenceLine y={1} stroke="#000000" strokeWidth={1} />
                <ReferenceLine y={avgMensual} stroke="#6B7280" strokeDasharray="3 3" />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
