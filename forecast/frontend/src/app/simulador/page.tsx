'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell
} from 'recharts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SimuladorPage() {
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [dbEscalas, setDbEscalas] = useState<any[]>([]);
  const [dbFactReal, setDbFactReal] = useState<any[]>([]);
  
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const [simulatedFacturacion, setSimulatedFacturacion] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch Sellers
      const { data: sellersData } = await supabase.from("dim_sellers").select("*").order("nombre_seller");
      
      // 2. Fetch Escalas (all rows)
      let allEscalas: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("dim_escalas").select("*").order("periodo", { ascending: true }).range(page * 1000, (page + 1) * 1000 - 1);
        if (data && data.length > 0) {
          allEscalas = allEscalas.concat(data);
          if (data.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      const escalasData = allEscalas;
      
      // 3. Fetch Histórico Real
      const { data: realData } = await supabase.from("facturacion_real_historica").select("*");

      if (sellersData && escalasData.length > 0) {
        setSellers(sellersData);
        setDbEscalas(escalasData);
        if (realData) setDbFactReal(realData);

        // Extraer meses únicos
        const uniqueMonths = new Set<string>();
        escalasData.forEach(e => {
          const date = new Date(e.periodo + "T12:00:00");
          let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
          mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
          uniqueMonths.add(mStr);
        });
        const monthsArr = Array.from(uniqueMonths);
        setMonths(monthsArr);

        // Valores por defecto
        if (sellersData.length > 0) setSelectedSeller(sellersData[0].id_seller);
        if (monthsArr.length > 0) setSelectedMonth(monthsArr[monthsArr.length - 1]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  // Generamos los datos del gráfico
  const chartData = useMemo(() => {
    if (!selectedSeller || !selectedMonth || dbEscalas.length === 0) return [];

    // Filtrar escalas para seller y mes
    const escalasDelMes = dbEscalas.filter(e => {
      const date = new Date(e.periodo + "T12:00:00");
      let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
      mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
      return e.seller_id.toString() === selectedSeller.toString() && mStr === selectedMonth;
    });

    if (escalasDelMes.length === 0) return [];

    const minimoRow = escalasDelMes.find(e => e.tipo_cargo === 'MINIMO');
    const porcentuales = escalasDelMes
      .filter(e => e.tipo_cargo === 'PORCENTUAL')
      .sort((a, b) => a.monto_objetivo - b.monto_objetivo);

    if (!minimoRow || porcentuales.length === 0) return [];

    const MINIMO = minimoRow.monto_objetivo;
    const last = porcentuales[porcentuales.length - 1];
    const maxView = last.monto_objetivo * 1.3;

    let basePoints = [];
    
    // 1. Puntos fijos dinámicos (aprox 100 puntos) para tener una cuadrícula fluida en el tooltip sin importar la escala
    const step = Math.max(Math.round(maxView / 100), 1000);
    for (let f = 0; f <= maxView; f += step) {
      basePoints.push(f);
    }
    
    // 2. Umbrales exactos para hacer las caídas verticales perfectas
    porcentuales.forEach(p => {
       basePoints.push(p.monto_objetivo - 1);
       basePoints.push(p.monto_objetivo);
    });
    
    // 3. Puntos medios de cada escala para ubicar el Histograma (Gráfico de barras)
    const centrosEscalas = new Map<number, number>(); // map de centro_X -> id_umbral
    const centroMinimo = Math.round(porcentuales[0].monto_objetivo / 2);
    centrosEscalas.set(centroMinimo, 0); // 0 representa el MÍNIMO
    basePoints.push(centroMinimo);
    
    for (let i = 0; i < porcentuales.length; i++) {
       const curr = porcentuales[i];
       const next = i < porcentuales.length - 1 ? porcentuales[i+1].monto_objetivo : maxView;
       const centro = Math.round((curr.monto_objetivo + next) / 2);
       centrosEscalas.set(centro, curr.monto_objetivo);
       basePoints.push(centro);
    }
    
    // Contamos las frecuencias históricas (historial ajustado a la inflación actual)
    const historialSeller = dbFactReal.filter(f => f.seller_id.toString() === selectedSeller.toString());
    const tierCounts = new Map<number, number>();
    const porcentualesDescParaConteo = [...porcentuales].sort((a, b) => b.monto_objetivo - a.monto_objetivo);
    
    historialSeller.forEach(h => {
      const v = h.valor_real;
      const matched = porcentualesDescParaConteo.find(e => v >= e.monto_objetivo);
      const tId = matched ? matched.monto_objetivo : 0;
      tierCounts.set(tId, (tierCounts.get(tId) || 0) + 1);
    });
    
    // Removemos duplicados y ordenamos
    basePoints = Array.from(new Set(basePoints)).sort((a, b) => a - b);
    
    // 4. Calculamos la tarifa para cada punto y le enchufamos el conteo si es un punto central
    // Para buscar, necesitamos ordenar de mayor a menor umbral
    const porcentualesDesc = [...porcentuales].sort((a, b) => b.monto_objetivo - a.monto_objetivo);
    
    const points = basePoints.map(fact => {
      let fee = MINIMO;
      let label = 'MÍNIMO';
      
      const matched = porcentualesDesc.find(e => fact >= e.monto_objetivo);
      if (matched) {
         fee = fact * matched.alicuota;
         label = `Escala ${(matched.alicuota * 100).toFixed(2)}%`;
      }
      
      // Si este punto en el eje X corresponde al centro de una escala, le pasamos la altura de la barra
      let histCount = null;
      if (centrosEscalas.has(fact)) {
        histCount = tierCounts.get(centrosEscalas.get(fact)!) || 0;
      }
      
      return { facturacion: fact, fee, label, histCount };
    });

    // 5. Calculamos las dimensiones para los bloques del histograma visual
    const histogramTiers: any[] = [];
    const t0 = porcentuales[0].monto_objetivo;
    histogramTiers.push({
      id: 0,
      min: t0 * 0.05,
      max: t0 * 0.95,
      count: tierCounts.get(0) || 0
    });
    
    for (let i = 0; i < porcentuales.length; i++) {
       const curr = porcentuales[i];
       const next = i < porcentuales.length - 1 ? porcentuales[i+1].monto_objetivo : maxView;
       const width = next - curr.monto_objetivo;
       
       histogramTiers.push({
         id: curr.monto_objetivo,
         min: curr.monto_objetivo + (width * 0.05),
         max: next - (width * 0.05),
         count: tierCounts.get(curr.monto_objetivo) || 0
       });
    }

    return { points, histogramTiers };
  }, [selectedSeller, selectedMonth, dbEscalas, dbFactReal]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700">
          <p className="text-gray-300 font-medium mb-1">{payload[0].payload.label}</p>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-400">Facturación:</span>
              <span className="font-medium text-blue-200">{formatCurrency(payload[0].payload.facturacion)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs mt-1">
              <span className="text-gray-400">Nuestro Fee:</span>
              <span className="font-bold text-green-300">{formatCurrency(payload[0].payload.fee)}</span>
            </div>
            {payload[0].payload.histCount !== null && (
              <div className="flex justify-between gap-4 text-xs mt-2 pt-2 border-t border-gray-700">
                <span className="text-gray-400 font-semibold text-orange-200">Frecuencia histórica:</span>
                <span className="font-bold text-orange-400">{payload[0].payload.histCount} meses</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const { points = [], histogramTiers = [] } = chartData as any;

  // Encontrar el valor actual simulado
  let simulatedFee = 0;
  let simulatedAlicuotaStr = '-';
  if (points.length > 0 && simulatedFacturacion > 0) {
    const escalasDelMes = dbEscalas.filter(e => {
      const date = new Date(e.periodo + "T12:00:00");
      let mStr = date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
      mStr = mStr.charAt(0).toUpperCase() + mStr.slice(1);
      return e.seller_id.toString() === selectedSeller.toString() && mStr === selectedMonth;
    });

    const porcentuales = escalasDelMes
      .filter(e => e.tipo_cargo === 'PORCENTUAL')
      .sort((a, b) => b.monto_objetivo - a.monto_objetivo);
    
    const matched = porcentuales.find(e => simulatedFacturacion >= e.monto_objetivo);
    
    if (matched) {
      simulatedFee = simulatedFacturacion * matched.alicuota;
      simulatedAlicuotaStr = `${(matched.alicuota * 100).toFixed(2)}%`;
    } else {
      const min = escalasDelMes.find(e => e.tipo_cargo === 'MINIMO');
      simulatedFee = min ? min.monto_objetivo : 0;
      simulatedAlicuotaStr = 'MÍNIMO';
    }
  }

  const maxSliderVal = points.length > 0 ? points[points.length - 1].facturacion : 1000000000;

  return (
    <div className="space-y-6 pb-12 w-full h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Simulador Cartesiano de Liquidación</h1>
          <p className="text-sm text-gray-500">Visualizá los saltos y el &quot;efecto precipicio&quot; (cliffs) en los fees</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
        
        {/* Controles */}
        <div className="flex gap-4">
          <div className="w-1/2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Cuenta / Seller</label>
            <select 
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              {sellers.map(s => (
                <option key={s.id_seller} value={s.id_seller}>{s.nombre_seller}</option>
              ))}
            </select>
          </div>
          <div className="w-1/2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Período de Escala</label>
            <select 
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gráfico */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Cargando el motor gráfico...
          </div>
        ) : points.length > 0 ? (
          <>
            <div className="h-[450px] w-full border border-gray-100 rounded-xl bg-gray-50/30 p-4 pb-8 pr-8">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorFee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="facturacion" 
                    type="number"
                    domain={[0, 'dataMax']}
                    tickFormatter={(val) => `$ ${Math.round(val / 1000000)}M`}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickMargin={10}
                    tickCount={15}
                    label={{ value: 'Facturación Bruta Ajustada', position: 'bottom', offset: 0, fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(val) => `$ ${Math.round(val / 1000000)}M`}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickMargin={10}
                    label={{ value: 'Nuestro Fee ($)', angle: -90, position: 'insideLeft', offset: -5, fill: '#3b82f6', fontSize: 13, fontWeight: 600 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#f59e0b"
                    fontSize={12}
                    tickMargin={10}
                    allowDecimals={false}
                    label={{ value: 'Frecuencia Histórica (Meses)', angle: 90, position: 'insideRight', offset: 0, fill: '#9ca3af', fontSize: 13, fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Bloques visuales del histograma */}
                  {histogramTiers.filter((t: any) => t.count > 0).map((t: any) => (
                    <ReferenceArea 
                      key={t.id}
                      yAxisId="right"
                      x1={t.min}
                      x2={t.max}
                      y1={0}
                      y2={t.count}
                      fill="transparent"
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeOpacity={0.8}
                    />
                  ))}

                  {/* Barra invisible solo para activar el Tooltip en el centro de la escala */}
                  <Bar yAxisId="right" dataKey="histCount" barSize={40} fill="transparent" />
                  
                  <Area 
                    yAxisId="left"
                    type="linear" 
                    dataKey="fee" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorFee)" 
                    isAnimationActive={false}
                  />
                  {simulatedFacturacion > 0 && (
                    <ReferenceLine yAxisId="left" x={simulatedFacturacion} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Venta', fill: '#ef4444', fontSize: 12 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Panel Interactivo */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">Calculadora en vivo</h3>
                  <p className="text-xs text-blue-600">Deslizá para simular una facturación de {selectedMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-500 font-medium uppercase tracking-wider mb-1">Nuestro Fee Resultante</p>
                  <div className="text-3xl font-black text-blue-700 tracking-tight">{formatCurrency(simulatedFee)}</div>
                  <div className="text-xs font-semibold text-blue-600 bg-blue-100 inline-block px-2 py-0.5 rounded mt-1">Escala aplicada: {simulatedAlicuotaStr}</div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs text-blue-600 font-medium mb-2">
                  <span>$0</span>
                  <span className="text-sm font-bold">{formatCurrency(simulatedFacturacion)} Bruto</span>
                  <span>{formatCurrency(maxSliderVal)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={maxSliderVal} 
                  step="10000"
                  value={simulatedFacturacion}
                  onChange={(e) => setSimulatedFacturacion(Number(e.target.value))}
                  className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            No hay escalas cargadas para este cliente en este mes.
          </div>
        )}
      </div>
    </div>
  );
}
