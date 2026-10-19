'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  DollarSign, 
  Search, 
  Globe, 
  Building2, 
  X, 
  Layers, 
  TrendingUp, 
  Clock, 
  ArrowUpRight, 
  Tag, 
  Activity, 
  Check, 
  Info,
  ShieldCheck,
  Coins,
  Receipt
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Reglas de negocio y monedas de cobro de Reply por cuenta
function getSellerBusinessRules(sId: number | string, seller: any, escalaMoneda?: string) {
  const sid = String(sId);
  const p = (seller.codigo_pais || seller.pais || '').toUpperCase();
  const mGmv = (seller.moneda || 'ARS').toUpperCase();

  // 1. Moneda de cobro de Reply (la moneda en la que Reply factura sus honorarios)
  let monedaCobro = mGmv;
  let reglaLiquidacion = '';
  let metodoActualizacion = '';

  if (sid === '807100133') {
    // Evacol México ML
    monedaCobro = 'MXN';
    reglaLiquidacion = 'La facturación bruta (GMV) está en USD. Se deduce el 16% de IVA comercial para obtener la Base Neta. Se cruza con la escala en USD (mínimo garantizado de $1.000 USD o alícuota de 2,93% a 1,30%). El fee resultante en USD se reconvierte a Pesos Mexicanos (MXN) utilizando el Tipo de Cambio oficial mensual y se factura en MXN + 16% de IVA local.';
    metodoActualizacion = 'Escala fija en USD con umbrales en dólares y cobro reconvertido a MXN.';
  } else if (sid === '941943480') {
    // Natura Colombia
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas brutas de Mercado Libre en Pesos Colombianos (COP) se convierten a USD según el Tipo de Cambio oficial del mes. Se cruza con la escala en USD (mínimo de $1.200 USD o alícuota de 2,93% a 2,28%). La factura de Reply se cobra en USD sin IVA (exportación de servicios).';
    metodoActualizacion = 'Escala fija en USD.';
  } else if (sid === '964690754') {
    // Disuiza Colombia
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas brutas en COP se convierten a USD vía TC oficial. Se aplica alícuota fija del 2,00% sobre la facturación en USD con un honorario mínimo garantizado de $1.500 USD (si el 2% supera los $1.500 USD se cobra el valor mayor). Cobro en USD sin IVA.';
    metodoActualizacion = 'Alícuota fija del 2% con piso mínimo de $1.500 USD.';
  } else if (sid === '928666257') {
    // Evacol Colombia ML
    monedaCobro = 'COP';
    reglaLiquidacion = 'Ventas brutas en COP se convierten a USD vía TC oficial. Se cruza con la escala en USD (mínimo de $1.000 USD o alícuota de 4,00% a 2,00%). El honorario en USD se reconvierte a Pesos Colombianos (COP) multiplicando por el TC oficial del mes y se factura en COP sin IVA.';
    metodoActualizacion = 'Escala en USD con cobro reconvertido y liquidado en COP.';
  } else if (sid === '928424062') {
    // Evacol Colombia ADDI
    monedaCobro = 'USD';
    reglaLiquidacion = 'Tarifa plana fija (Flat Fee) de $1.000 USD mensuales independientemente del volumen facturado. Se factura y cobra en USD sin IVA.';
    metodoActualizacion = 'Flat fee fijo mensual de $1.000 USD.';
  } else if (sid === '127711636') {
    // Formex Colombia
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas brutas en COP se convierten a USD vía TC oficial. Se cruza con la escala en USD (mínimo de $1.000 USD o alícuota de 2,93% a 1,30%). Cobro en USD sin IVA.';
    metodoActualizacion = 'Escala fija en USD.';
  } else if (sid === '918210724') {
    // Evacol Amazon USA
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas en dólares en Amazon USA se cruzan directamente con la escala en USD (mínimo de $1.000 USD o alícuota de 2,93% a 1,30%). Se factura y cobra en USD sin IVA.';
    metodoActualizacion = 'Escala fija en USD.';
  } else if (sid === '984167591') {
    // Alma Nativa México
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas en dólares se cruzan con la escala en USD con piso mínimo. Cobro en USD.';
    metodoActualizacion = 'Escala en USD.';
  } else if (sid === '256189964') {
    // Newsan ML Consolidado
    monedaCobro = 'ARS';
    reglaLiquidacion = 'La base de cálculo es la facturación consolidada en Mercado Libre (Newsan Directo + Motorola + Pilisar). Se cruza con la escala en ARS con mínimo y alícuotas del 0,31% al 0,24%. Se actualiza trimestralmente por la inflación oficial acumulada de Argentina. Facturación en ARS + 21% IVA.';
    metodoActualizacion = 'Ajuste trimestral por inflación oficial acumulada (Ene, Abr, Jul, Oct).';
  } else if (sid === '308973138' || sid === '256324891') {
    // Motorola o Pilisar
    monedaCobro = 'ARS';
    reglaLiquidacion = 'Subcuenta operativa de Newsan en Mercado Libre. Su facturación se reporta de forma individual en el módulo de ventas pero se consolida dentro de Newsan ML para el cálculo de la escala conjunta.';
    metodoActualizacion = 'Consolidada en Newsan ML.';
  } else if (sid === '989595440') {
    // Newsan Tienda Web
    monedaCobro = 'ARS';
    reglaLiquidacion = 'Liquidación basada en métricas operativas de Tienda Web: Sesiones mensuales y Horas Extras de soporte técnico. Escala con cargo mínimo garantizado más tarifa por sesión y tarifa por hora extra. Actualización semestral (Abril y Septiembre). Facturación en ARS + 21% IVA.';
    metodoActualizacion = 'Ajuste semestral por inflación oficial acumulada (Abril y Septiembre).';
  } else if (p === 'CL') {
    monedaCobro = 'CLP';
    reglaLiquidacion = 'Facturación en Pesos Chilenos (CLP) cruzada con la escala pactada por canal (Falabella, ML, Paris, etc.). Cobro en CLP.';
    metodoActualizacion = 'Revisión periódica pactada.';
  } else if (p === 'MX') {
    monedaCobro = 'MXN';
    reglaLiquidacion = 'Facturación en Pesos Mexicanos (MXN) cruzada con la escala comercial. Cobro en MXN + 16% IVA.';
    metodoActualizacion = 'Escala comercial en pesos mexicanos.';
  } else {
    // Argentina estándar
    monedaCobro = 'ARS';
    reglaLiquidacion = 'Facturación bruta en ARS cruzada con la escala porcentual con piso mínimo garantizado. Actualización mensual indexada por la inflación oficial del IPC (INDEC). Facturación en ARS + 21% IVA.';
    metodoActualizacion = 'Indexación mensual por IPC (INDEC).';
  }

  // Moneda de la escala
  const monedaEscala = escalaMoneda || (['USD', 'COP'].includes(monedaCobro) && ['CO', 'MX', 'US'].includes(p) ? 'USD' : (p === 'CL' ? 'CLP' : (p === 'MX' ? (seller.moneda === 'USD' ? 'USD' : 'MXN') : 'ARS')));

  return {
    monedaCobro,
    monedaEscala,
    reglaLiquidacion,
    metodoActualizacion
  };
}

export default function DirectorioClientesPage() {
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('TODOS');
  const [selectedPlatform, setSelectedPlatform] = useState('TODAS');
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);

  useEffect(() => {
    async function loadDirectoryData() {
      setLoading(true);

      // 1. Fetch sellers enriquecidos desde v_sellers_completos
      const [sellersRes, factRes, escRes, liqRes, ordRes] = await Promise.all([
        supabase
          .from('v_sellers_completos')
          .select('*')
          .order('nombre_seller', { ascending: true }),
        supabase
          .from('facturacion')
          .select('seller_id, periodo, valor_facturado, estado')
          .order('periodo', { ascending: true }),
        supabase
          .from('dim_escalas')
          .select('seller_id, periodo, tipo_cargo, alicuota, monto_objetivo, moneda, estado')
          .order('periodo', { ascending: false }),
        supabase
          .from('liquidaciones')
          .select('seller_id, periodo, subtotal, tipo_cargo_aplicado, alicuota_aplicada, estado')
          .order('periodo', { ascending: false }),
        supabase
          .from('ordenes')
          .select('seller_id, date_created')
          .order('date_created', { ascending: true })
      ]);

      const sellers = sellersRes.data || [];
      const facturacion = factRes.data || [];
      const escalas = escRes.data || [];
      const liquidaciones = liqRes.data || [];
      const ordenes = ordRes.data || [];

      // Mapear órdenes por seller (rango y conteo)
      const ordersMap: Record<string, { count: number; min: string; max: string }> = {};
      ordenes.forEach((o: any) => {
        const sid = String(o.seller_id);
        const d = (o.date_created || '').split('T')[0];
        if (!ordersMap[sid]) {
          ordersMap[sid] = { count: 0, min: d, max: d };
        }
        ordersMap[sid].count++;
        if (d && d < ordersMap[sid].min) ordersMap[sid].min = d;
        if (d && d > ordersMap[sid].max) ordersMap[sid].max = d;
      });

      // Mapear facturación por seller
      const factMap: Record<string, { totalMonths: number; realMonths: number; projMonths: number; min: string; max: string; lastRealPeriod: string; lastRealVal: number }> = {};
      facturacion.forEach((f: any) => {
        const sid = String(f.seller_id);
        const p = f.periodo || '';
        const isReal = f.estado === 'REAL';
        if (!factMap[sid]) {
          factMap[sid] = { totalMonths: 0, realMonths: 0, projMonths: 0, min: p, max: p, lastRealPeriod: '', lastRealVal: 0 };
        }
        factMap[sid].totalMonths++;
        if (isReal) {
          factMap[sid].realMonths++;
          if (p >= factMap[sid].lastRealPeriod) {
            factMap[sid].lastRealPeriod = p;
            factMap[sid].lastRealVal = Number(f.valor_facturado) || 0;
          }
        } else {
          factMap[sid].projMonths++;
        }
        if (p && p < factMap[sid].min) factMap[sid].min = p;
        if (p && p > factMap[sid].max) factMap[sid].max = p;
      });

      // Mapear escalas por seller
      const escMap: Record<string, { moneda: string; min: string; max: string; count: number; currentTiers: any[] }> = {};
      escalas.forEach((e: any) => {
        const sid = String(e.seller_id);
        const p = e.periodo || '';
        if (!escMap[sid]) {
          escMap[sid] = { moneda: e.moneda || 'ARS', min: p, max: p, count: 0, currentTiers: [] };
        }
        escMap[sid].count++;
        if (e.moneda) escMap[sid].moneda = e.moneda;
        if (p && p < escMap[sid].min) escMap[sid].min = p;
        if (p && p > escMap[sid].max) escMap[sid].max = p;
      });

      // Obtener tramos más recientes para cada seller
      Object.keys(escMap).forEach(sid => {
        const sellerEscalas = escalas.filter((e: any) => String(e.seller_id) === sid);
        if (sellerEscalas.length > 0) {
          const maxP = escMap[sid].max;
          escMap[sid].currentTiers = sellerEscalas
            .filter((e: any) => e.periodo === maxP)
            .sort((a: any, b: any) => (a.monto_objetivo || 0) - (b.monto_objetivo || 0));
        }
      });

      // Mapear liquidaciones por seller (último mes liquidado)
      const liqMap: Record<string, any> = {};
      liquidaciones.forEach((l: any) => {
        const sid = String(l.seller_id);
        if (!liqMap[sid] && l.estado === 'REAL') {
          liqMap[sid] = l;
        }
      });

      // Consolidar seller enriquecido
      const combined = sellers.map((s: any) => {
        const sid = String(s.id_seller);
        const ord = ordersMap[sid] || null;
        const fact = factMap[sid] || null;
        const esc = escMap[sid] || null;
        const lastLiq = liqMap[sid] || null;

        const rules = getSellerBusinessRules(s.id_seller, s, esc?.moneda);

        return {
          ...s,
          ordersInfo: ord,
          hasOrders: !!ord && ord.count > 0,
          factInfo: fact,
          hasFacturacion: !!fact && fact.totalMonths > 0,
          escInfo: esc,
          hasEscalas: !!esc && esc.count > 0,
          lastLiquidacion: lastLiq,
          rules
        };
      });

      setSellersList(combined);
      setLoading(false);
    }

    loadDirectoryData();
  }, []);

  // Filtrado reactivo
  const filteredSellers = useMemo(() => {
    return sellersList.filter(s => {
      // Filtro texto
      const search = searchTerm.toLowerCase().trim();
      const matchSearch = !search || 
        s.nombre_seller?.toLowerCase().includes(search) ||
        String(s.id_seller).includes(search) ||
        s.nombre_holding?.toLowerCase().includes(search) ||
        s.nombre_pais?.toLowerCase().includes(search);

      // Filtro país
      const c = (s.codigo_pais || s.pais || '').toUpperCase();
      const matchCountry = selectedCountry === 'TODOS' || 
        (selectedCountry === 'AR' && (c === 'AR' || c === 'ARG')) ||
        (selectedCountry === 'CO' && (c === 'CO' || c === 'COL')) ||
        (selectedCountry === 'MX' && (c === 'MX' || c === 'MEX')) ||
        (selectedCountry === 'CL' && (c === 'CL' || c === 'CHL')) ||
        (selectedCountry === 'US' && (c === 'US' || c === 'USA'));

      // Filtro plataforma
      const p = (s.codigo_plataforma || '').toUpperCase();
      const matchPlat = selectedPlatform === 'TODAS' ||
        (selectedPlatform === 'MELI' && p === 'MELI') ||
        (selectedPlatform === 'AMAZON' && p === 'AMAZON') ||
        (selectedPlatform === 'WEB' && p === 'WEB') ||
        (selectedPlatform === 'OTROS' && !['MELI', 'AMAZON', 'WEB'].includes(p));

      return matchSearch && matchCountry && matchPlat;
    });
  }, [sellersList, searchTerm, selectedCountry, selectedPlatform]);

  // KPIs superiores
  const totalAccounts = sellersList.length;
  const activeAccounts = sellersList.filter(s => s.estado === true).length;
  const syncedApiAccounts = sellersList.filter(s => s.hasOrders).length;
  const countriesCount = new Set(sellersList.map(s => s.codigo_pais).filter(Boolean)).size;

  return (
    <div className="space-y-6 pb-16 w-full flex flex-col select-none">
      {/* 1. Header & KPIs Globales */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#ff5100]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Directorio Oficial de Cuentas & Sellers
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Arquitectura unificada en tiempo real: monedas GMV, monedas de cobro Reply, esquemas tarifarios e ingesta
              </p>
            </div>
          </div>
        </div>

        {/* Metricas rápidas */}
        <div className="flex items-center gap-3 divide-x divide-slate-100 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
          <div className="px-3.5 text-center">
            <p className="text-xl font-black text-slate-900">{totalAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sellers</p>
          </div>
          <div className="px-3.5 text-center">
            <p className="text-xl font-black text-emerald-600">{activeAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activas</p>
          </div>
          <div className="px-3.5 text-center">
            <p className="text-xl font-black text-[#4981fb]">{syncedApiAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes API</p>
          </div>
          <div className="px-3.5 text-center">
            <p className="text-xl font-black text-purple-600">{countriesCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Países</p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por seller, ID, holding o país..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4981fb]/20 focus:border-[#4981fb] transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros de País & Plataforma */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* País pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/70 text-xs font-semibold">
            {[
              { id: 'TODOS', label: '🌍 Todos' },
              { id: 'AR', label: '🇦🇷 AR' },
              { id: 'CO', label: '🇨🇴 CO' },
              { id: 'MX', label: '🇲🇽 MX' },
              { id: 'CL', label: '🇨🇱 CL' },
              { id: 'US', label: '🇺🇸 US' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setSelectedCountry(pill.id)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                  selectedCountry === pill.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Plataforma selector */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4981fb]/20"
          >
            <option value="TODAS">⚡ Todas las Plataformas</option>
            <option value="MELI">Mercado Libre</option>
            <option value="AMAZON">Amazon</option>
            <option value="WEB">Tienda Web / Directa</option>
            <option value="OTROS">Otros Marketplaces</option>
          </select>
        </div>
      </div>

      {/* 3. Tabla Principal del Directorio */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#4981fb] border-t-transparent"></div>
            <p className="text-xs text-slate-500 font-semibold tracking-wide">Cargando directorio oficial de cuentas...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-slate-50/90 border-b border-slate-100 sticky top-0 z-10 font-bold">
                <tr>
                  <th className="px-5 py-3.5 text-slate-700">Cuenta / Seller</th>
                  <th className="px-4 py-3.5 text-slate-700 text-center">País</th>
                  <th className="px-4 py-3.5 text-slate-700 text-center">Plataforma</th>
                  <th className="px-4 py-3.5 text-slate-700 text-center" title="Moneda en que se registra la facturación bruta GMV del cliente">
                    Moneda GMV
                  </th>
                  <th className="px-4 py-3.5 text-slate-700 text-center" title="Moneda en que Reply factura y cobra los honorarios">
                    Cobro Reply
                  </th>
                  <th className="px-4 py-3.5 text-slate-700 text-center" title="Moneda de la escala comercial y frecuencia de ajuste">
                    Escala & Frecuencia
                  </th>
                  <th className="px-4 py-3.5 text-slate-700 text-center">Facturación</th>
                  <th className="px-4 py-3.5 text-slate-700 text-center">Órdenes API</th>
                  <th className="px-5 py-3.5 text-slate-700 text-right">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSellers.map((s) => {
                  const isIdPending = s.id_seller >= 900000000 && s.id_seller < 1000000000;
                  
                  return (
                    <tr 
                      key={s.id_seller} 
                      onClick={() => setSelectedSeller(s)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* 1. Nombre / Holding */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.estado === true ? 'bg-emerald-500 shadow-xs' : 'bg-rose-400'}`} 
                            title={s.estado === true ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 group-hover:text-[#275ec9] transition-colors">
                                {s.nombre_seller}
                              </span>
                              {isIdPending && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  ID Temp
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-slate-400">
                                #{s.id_seller}
                              </span>
                              {s.nombre_holding && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-[11px] font-medium text-slate-500">
                                    {s.nombre_holding}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. País */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                          <span>{s.bandera_emoji || '🌐'}</span>
                          <span>{s.codigo_pais || s.pais}</span>
                        </span>
                      </td>

                      {/* 3. Plataforma */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          s.codigo_plataforma === 'MELI' 
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/80' 
                            : s.codigo_plataforma === 'AMAZON'
                            ? 'bg-orange-50 text-orange-800 border border-orange-200/80'
                            : s.codigo_plataforma === 'WEB'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200/80'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {s.nombre_plataforma || s.codigo_plataforma || 'MELI'}
                        </span>
                      </td>

                      {/* 4. Moneda GMV */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs font-black bg-slate-50 text-slate-800 border border-slate-200">
                          <Coins className="w-3 h-3 text-slate-400" />
                          {s.moneda || 'ARS'}
                        </span>
                      </td>

                      {/* 5. Moneda Cobro Reply */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs font-black ${
                          s.rules.monedaCobro === 'USD'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : s.rules.monedaCobro === 'MXN'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : s.rules.monedaCobro === 'COP'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          <DollarSign className="w-3 h-3" />
                          {s.rules.monedaCobro}
                        </span>
                      </td>

                      {/* 6. Escala & Frecuencia */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            s.frecuencia_actualizacion === 'TRIMESTRAL'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : s.frecuencia_actualizacion === 'SEMESTRAL'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : s.frecuencia_actualizacion === 'FIJA'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {s.frecuencia_actualizacion || 'MENSUAL'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Escala en {s.rules.monedaEscala}
                          </span>
                        </div>
                      </td>

                      {/* 7. Facturación Info */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {s.hasFacturacion ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-semibold text-emerald-600">
                              {s.factInfo?.totalMonths} meses
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {s.factInfo?.min?.slice(0, 7)} a {s.factInfo?.max?.slice(0, 7)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <XCircle className="w-3.5 h-3.5 text-slate-300" /> Sin datos
                          </span>
                        )}
                      </td>

                      {/* 8. Órdenes API */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {s.hasOrders ? (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              {s.ordersInfo?.count?.toLocaleString('es-AR')} órdenes
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                              Hasta {s.ordersInfo?.max}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            Manual / Sin API
                          </span>
                        )}
                      </td>

                      {/* 9. Botón Ver Ficha */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSeller(s);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#275ec9] bg-[#eff5ff] hover:bg-[#dbe7fe] border border-[#daebfe] transition-all group-hover:shadow-xs"
                        >
                          <span>Ficha</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL / FICHA COMPLETA DE LA CUENTA */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-start justify-between shrink-0 relative overflow-hidden">
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl shadow-inner shrink-0">
                  {selectedSeller.bandera_emoji || '🌐'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-black tracking-tight text-white">
                      {selectedSeller.nombre_seller}
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      ● Activa
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap font-medium">
                    <span>ID: <strong className="text-white font-mono">{selectedSeller.id_seller}</strong></span>
                    <span>•</span>
                    <span>Holding: <strong className="text-white">{selectedSeller.nombre_holding || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>Plataforma: <strong className="text-white">{selectedSeller.nombre_plataforma || selectedSeller.codigo_plataforma}</strong></span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSeller(null)}
                className="relative z-10 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Cerrar Ficha"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs">
              
              {/* Grid de Monedas y Parámetros Clave */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#4981fb]" />
                  Configuración Monetaria & Territorial
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Moneda GMV */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Moneda Facturación (GMV)</p>
                    <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                      <span>{selectedSeller.moneda || 'ARS'}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {selectedSeller.moneda === 'USD' ? 'Dólares' : selectedSeller.moneda === 'MXN' ? 'Pesos Mexicanos' : selectedSeller.moneda === 'COP' ? 'Pesos Colombianos' : selectedSeller.moneda === 'CLP' ? 'Pesos Chilenos' : 'Pesos Argentinos'}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Ventas brutas del seller</p>
                  </div>

                  {/* Moneda Cobro Reply */}
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-[#275ec9]">Moneda Cobro Reply</p>
                    <p className="text-base font-black text-[#275ec9] mt-1 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span>{selectedSeller.rules.monedaCobro}</span>
                    </p>
                    <p className="text-[10px] text-blue-700/80 mt-1">Moneda de facturación del fee</p>
                  </div>

                  {/* Moneda de la Escala */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Moneda de la Escala</p>
                    <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1">
                      <span>{selectedSeller.rules.monedaEscala}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Umbrales y pisos mínimos</p>
                  </div>

                  {/* Frecuencia de Actualización */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Actualización Escala</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {selectedSeller.frecuencia_actualizacion || 'MENSUAL'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">{selectedSeller.rules.metodoActualizacion.slice(0, 24)}...</p>
                  </div>
                </div>
              </div>

              {/* Regla de Liquidación Detallada */}
              <div className="p-4 bg-gradient-to-r from-orange-50/70 to-amber-50/70 rounded-2xl border border-orange-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#ff5100]" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Mecánica de Liquidación & Regla Comercial Oficial
                  </h4>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {selectedSeller.rules.reglaLiquidacion}
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px] font-semibold text-slate-600 border-t border-orange-200/60 mt-2">
                  <span>Botmaker: <strong className={selectedSeller.cobrar_botmaker ? 'text-purple-700' : 'text-slate-500'}>{selectedSeller.cobrar_botmaker ? 'Sí (Facturado)' : 'No aplica'}</strong></span>
                  <span>•</span>
                  <span>Método de indexación: <strong className="text-slate-800">{selectedSeller.rules.metodoActualizacion}</strong></span>
                </div>
              </div>

              {/* Matriz de Escala Vigente */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#4981fb]" />
                    Tramos de Escala Vigente ({selectedSeller.escInfo?.max || 'Actual'})
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Moneda de matriz: <strong>{selectedSeller.rules.monedaEscala}</strong>
                  </span>
                </div>

                {selectedSeller.escInfo?.currentTiers && selectedSeller.escInfo.currentTiers.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Tipo de Cargo</th>
                          <th className="px-4 py-2.5 text-center">Alícuota / %</th>
                          <th className="px-4 py-2.5 text-right">Umbral / Monto Objetivo ({selectedSeller.rules.monedaEscala})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSeller.escInfo.currentTiers.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-semibold text-slate-700">
                              {t.tipo_cargo === 'MINIMO' ? 'MÍNIMO GARANTIZADO' : t.tipo_cargo}
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-slate-900 font-mono">
                              {t.tipo_cargo === 'MINIMO' ? 'Piso Fijo' : (t.alicuota ? (t.alicuota < 1 ? `${(t.alicuota * 100).toFixed(2)}%` : t.alicuota) : '0%')}
                            </td>
                            <td className="px-4 py-2 text-right font-black font-mono text-slate-900">
                              ${Number(t.monto_objetivo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    Escala calculada mediante regla fija especial (ver sección de regla comercial arriba).
                  </p>
                )}
              </div>

              {/* Cobertura de Datos en Base de Datos */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Estado de Ingesta & Base de Datos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Facturacion */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Ventas Facturación (GMV)</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {selectedSeller.hasFacturacion ? `${selectedSeller.factInfo?.totalMonths} meses cargados` : 'Sin datos'}
                    </p>
                    {selectedSeller.hasFacturacion && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {selectedSeller.factInfo?.realMonths} reales + {selectedSeller.factInfo?.projMonths} proyectados
                      </p>
                    )}
                  </div>

                  {/* Órdenes */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Órdenes Mercado Libre API</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {selectedSeller.hasOrders ? `${selectedSeller.ordersInfo?.count?.toLocaleString('es-AR')} órdenes` : 'Sin órdenes sincronizadas'}
                    </p>
                    {selectedSeller.hasOrders && (
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        Última: {selectedSeller.ordersInfo?.max}
                      </p>
                    )}
                  </div>

                  {/* Última Liquidación */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Última Liquidación Real</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {selectedSeller.lastLiquidacion ? selectedSeller.lastLiquidacion.periodo : 'N/A'}
                    </p>
                    {selectedSeller.lastLiquidacion && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Fee: {selectedSeller.lastLiquidacion.tipo_cargo_aplicado === 'MINIMO' ? 'MÍNIMO' : `${(selectedSeller.lastLiquidacion.alicuota_aplicada * 100).toFixed(2)}%`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setSelectedSeller(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
