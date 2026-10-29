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
  Receipt,
  AlertCircle,
  Edit3,
  Save
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Trazabilidad de ciclo de vida conocida (fallback y valores históricos)
const KNOWN_LIFECYCLE_DATES: Record<string, { fecha_ingreso?: string; fecha_egreso?: string; estado?: boolean; motivo?: string }> = {
  '983474076': {
    fecha_ingreso: '2026-08-01',
    fecha_egreso: '2026-09-30',
    estado: false,
    motivo: 'Baja operativa acordada con Trademedical Chile SPA al 30 de septiembre de 2026'
  }
};

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function calculateTenure(startStr?: string | null, endStr?: string | null): string {
  if (!startStr) return 'Fecha no especificada';
  const start = new Date(startStr + 'T12:00:00');
  const end = endStr ? new Date(endStr + 'T12:00:00') : new Date();
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const months = Math.max(1, Math.round(diffDays / 30.44));
  
  if (endStr) {
    return `${months} ${months === 1 ? 'mes' : 'meses'} (${formatDisplayDate(startStr)} al ${formatDisplayDate(endStr)})`;
  }
  return `${months} ${months === 1 ? 'mes' : 'meses'} activa (desde ${formatDisplayDate(startStr)})`;
}

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
    monedaCobro = 'USD';
    reglaLiquidacion = 'La facturación bruta (GMV) del cliente en Mercado Libre está en Pesos Mexicanos (MXN). Se convierte a USD según el Tipo de Cambio oficial mensual y se cruza con la escala comercial en USD: si el saldo en USD es menor a $35.000 USD se aplica el cargo mínimo garantizado de $1.000 USD; si supera los $35.000 USD se aplica la alícuota correspondiente según tramo (2,93% a 1,30%). Reply factura y cobra los honorarios siempre en Dólares (USD) sin reconvertir a pesos y sin IVA (0% IVA).';
    metodoActualizacion = 'Escala en USD con GMV convertido vía TC y cobro en USD sin IVA.';
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
    monedaCobro = 'USD';
    reglaLiquidacion = 'Ventas brutas en COP se convierten a USD vía TC oficial. Se cruza con la escala en USD (mínimo de $1.000 USD o alícuota de 4,00% a 2,00%). Se factura y cobra en USD sin IVA (exportación de servicios).';
    metodoActualizacion = 'Escala en USD con cobro liquidado en USD sin IVA.';
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
  } else if (['942368053', '977559914', '962651791', '919428720', '978106559', '936492429'].includes(sid) || (seller?.nombre_seller?.toLowerCase().includes('newsan') && p === 'CL')) {
    // Newsan Chile Multicanal (6 Cuentas)
    monedaCobro = 'USD';
    reglaLiquidacion = 'Las 6 cuentas de Newsan Chile (Mercado Libre, Falabella, Ripley, Walmart, Paris y Kitchen Center) registran su facturación bruta (GMV) en Pesos Chilenos (CLP) y se convierten mensualmente a USD según el Tipo de Cambio oficial. La suma total consolidada se cruza con la escala comercial: si el 1% es menor a $4.000 USD se cobra el cargo mínimo garantizado de $4.000 USD; si supera esa cifra, se cobra el 1% de la facturación consolidada en USD. Se factura y cobra en USD sin IVA (exportación de servicios a Chile).';
    metodoActualizacion = 'Escala fija consolidada en USD con piso mínimo de $4.000 USD o 1% s/ GMV en USD.';
  } else if (p === 'CL') {
    monedaCobro = 'CLP';
    reglaLiquidacion = 'Facturación en Pesos Chilenos (CLP) cruzada con la escala pactada por canal (Falabella, ML, Paris, etc.). Cobro en CLP.';
    metodoActualizacion = 'Escala en CLP acordada.';
  } else {
    // Clientes generales de Argentina (Nestle, Morixe, Dapsa, etc.)
    monedaCobro = 'ARS';
    reglaLiquidacion = 'Facturación bruta en Mercado Libre Argentina en ARS cruzada con la escala comercial escalonada. Cobro en ARS + 21% IVA.';
    metodoActualizacion = 'Ajuste periódico pactado.';
  }

  // 2. Moneda de la escala comercial
  const newsanChileIds = ['942368053', '977559914', '962651791', '919428720', '978106559', '936492429'];
  let monedaEscala = escalaMoneda || (['941943480', '964690754', '928666257', '928424062', '127711636', '918210724', '807100133', '984167591', ...newsanChileIds].includes(sid) || (seller?.nombre_seller?.toLowerCase().includes('newsan') && p === 'CL') ? 'USD' : (p === 'CL' ? 'CLP' : 'ARS'));

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
  const [selectedStatus, setSelectedStatus] = useState<'TODOS' | 'ACTIVAS' | 'BAJAS'>('TODOS');
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);

  // Estados de edición de vigencia en modal
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editFechaIngreso, setEditFechaIngreso] = useState('');
  const [editFechaEgreso, setEditFechaEgreso] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

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

        // Gestión de fechas de vigencia (ingreso / egreso)
        const knownDates = KNOWN_LIFECYCLE_DATES[sid] || {};
        const fechaIngreso = s.fecha_ingreso || knownDates.fecha_ingreso || (fact?.min ? fact.min.slice(0, 10) : ord?.min || '2024-01-01');
        const fechaEgreso = s.fecha_egreso || knownDates.fecha_egreso || null;
        const isEstado = knownDates.estado !== undefined ? knownDates.estado : (s.estado ?? (fechaEgreso ? false : true));
        const isBaja = !isEstado || (!!fechaEgreso && new Date(fechaEgreso + 'T23:59:59') <= new Date());

        const rules = getSellerBusinessRules(s.id_seller, s, esc?.moneda);

        return {
          ...s,
          fechaIngreso,
          fechaEgreso,
          isBaja,
          estado: !isBaja,
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

  // Sincronizar inputs de edición al seleccionar seller
  useEffect(() => {
    if (selectedSeller) {
      setEditFechaIngreso(selectedSeller.fechaIngreso || '');
      setEditFechaEgreso(selectedSeller.fechaEgreso || '');
      setIsEditingDates(false);
      setSaveFeedback(null);
    }
  }, [selectedSeller?.id_seller]);

  // Manejar guardado de fechas de vigencia
  async function handleSaveDates() {
    if (!selectedSeller) return;
    setSavingDates(true);
    setSaveFeedback(null);

    const isBaja = !!editFechaEgreso;
    const newFechaIngreso = editFechaIngreso || selectedSeller.fechaIngreso;
    const newFechaEgreso = editFechaEgreso || null;

    try {
      // 1. Intentar actualizar en Supabase dim_sellers
      const updatePayload: any = {
        estado: !isBaja
      };
      if (newFechaIngreso) updatePayload.fecha_ingreso = newFechaIngreso;
      updatePayload.fecha_egreso = newFechaEgreso;

      const { error } = await supabase
        .from('dim_sellers')
        .update(updatePayload)
        .eq('id_seller', selectedSeller.id_seller);

      if (error) {
        console.warn('Supabase update warning (las columnas pueden requerir migración DDL):', error.message);
        setSaveFeedback('Fechas actualizadas localmente. Recuerda ejecutar la migración 05_fechas_ingreso_egreso_sellers.sql en Supabase.');
      } else {
        setSaveFeedback('Fechas y estado guardados exitosamente en la base de datos.');
      }

      // 2. Actualizar estado local reactivo
      setSellersList(prev => prev.map(s => {
        if (s.id_seller === selectedSeller.id_seller) {
          return {
            ...s,
            fechaIngreso: newFechaIngreso,
            fechaEgreso: newFechaEgreso,
            isBaja,
            estado: !isBaja
          };
        }
        return s;
      }));

      setSelectedSeller((prev: any) => ({
        ...prev,
        fechaIngreso: newFechaIngreso,
        fechaEgreso: newFechaEgreso,
        isBaja,
        estado: !isBaja
      }));

      setIsEditingDates(false);
    } catch (err: any) {
      console.error('Error guardando fechas:', err);
      setSaveFeedback('Error al guardar. Se actualizaron los datos en la vista local.');
      setIsEditingDates(false);
    } finally {
      setSavingDates(false);
    }
  }

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

      // Filtro estado (Activas vs Bajas)
      const matchStatus = selectedStatus === 'TODOS' ||
        (selectedStatus === 'ACTIVAS' && !s.isBaja) ||
        (selectedStatus === 'BAJAS' && s.isBaja);

      return matchSearch && matchCountry && matchPlat && matchStatus;
    });
  }, [sellersList, searchTerm, selectedCountry, selectedPlatform, selectedStatus]);

  // KPIs superiores
  const totalAccounts = sellersList.length;
  const activeAccounts = sellersList.filter(s => !s.isBaja).length;
  const bajasAccounts = sellersList.filter(s => s.isBaja).length;
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
                Arquitectura unificada: trazabilidad de vigencia (altas y bajas), monedas GMV, cobro Reply y esquemas tarifarios
              </p>
            </div>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="flex items-center gap-3 divide-x divide-slate-100 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
          <div className="px-3 text-center">
            <p className="text-xl font-black text-slate-900">{totalAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sellers</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xl font-black text-emerald-600">{activeAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activas</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xl font-black text-rose-500">{bajasAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bajas</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xl font-black text-[#4981fb]">{syncedApiAccounts}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes API</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-xl font-black text-purple-600">{countriesCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Países</p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full lg:w-80">
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

        {/* Filtros de Estado, País & Plataforma */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          {/* Filtro de Estado (Activas vs Bajas) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/70 text-xs font-semibold">
            {[
              { id: 'TODOS', label: 'Todas' },
              { id: 'ACTIVAS', label: '🟢 Activas' },
              { id: 'BAJAS', label: '🔴 Bajas / Egresos' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id as any)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                  selectedStatus === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
                className={`px-2 py-1 rounded-md transition-all text-xs ${
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
                  <th className="px-4 py-3.5 text-slate-700 text-center" title="Fecha de alta/ingreso y fecha de baja/egreso de la cuenta">
                    Vigencia (Alta / Baja)
                  </th>
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
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${s.isBaja ? 'bg-slate-50/60' : ''}`}
                    >
                      {/* 1. Nombre / Holding */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${!s.isBaja ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500'}`} 
                            title={!s.isBaja ? 'Cuenta Activa' : 'Cuenta Dada de Baja'}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-extrabold group-hover:text-[#275ec9] transition-colors ${s.isBaja ? 'text-slate-600 line-through decoration-slate-300' : 'text-slate-900'}`}>
                                {s.nombre_seller}
                              </span>
                              {s.isBaja && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                  Baja
                                </span>
                              )}
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

                      {/* 4. Vigencia (Alta / Baja) */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700">
                            <span className="text-slate-400 font-sans text-[10px]">Alta:</span>
                            <span className="font-bold">{formatDisplayDate(s.fechaIngreso)}</span>
                          </div>
                          {s.isBaja ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              Baja: {formatDisplayDate(s.fechaEgreso)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Activa / Vigente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Moneda GMV */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs font-black bg-slate-50 text-slate-800 border border-slate-200">
                          <Coins className="w-3 h-3 text-slate-400" />
                          {s.moneda || 'ARS'}
                        </span>
                      </td>

                      {/* 6. Moneda Cobro Reply */}
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

                      {/* 7. Escala & Frecuencia */}
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

                      {/* 8. Facturación Info */}
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

                      {/* 9. Órdenes API */}
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

                      {/* 10. Botón Ver Ficha */}
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
                    {selectedSeller.isBaja ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                        ● Cuenta Dada de Baja
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        ● Activa
                      </span>
                    )}
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
              
              {/* Tarjeta de Ciclo de Vida & Vigencia (Alta y Baja) */}
              <div className={`p-4 rounded-2xl border transition-all ${
                selectedSeller.isBaja 
                  ? 'bg-gradient-to-r from-rose-50/90 via-amber-50/40 to-slate-50 border-rose-200/90' 
                  : 'bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50 border-emerald-200/80'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs ${
                      selectedSeller.isBaja 
                        ? 'bg-rose-100/90 border-rose-300 text-rose-700' 
                        : 'bg-emerald-100/90 border-emerald-300 text-emerald-700'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Ciclo de Vida & Vigencia de la Cuenta
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          selectedSeller.isBaja 
                            ? 'bg-rose-200/80 text-rose-800' 
                            : 'bg-emerald-200/80 text-emerald-800'
                        }`}>
                          {selectedSeller.isBaja ? '● Cuenta Dada de Baja' : '● Cuenta Activa y Operando'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Permanencia: <strong className="text-slate-800">{calculateTenure(selectedSeller.fechaIngreso, selectedSeller.fechaEgreso)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Botón para editar fechas */}
                  <button
                    onClick={() => setIsEditingDates(!isEditingDates)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isEditingDates ? 'Cancelar Edición' : 'Editar Vigencia'}</span>
                  </button>
                </div>

                {/* Formulario de edición rápida si se activa */}
                {isEditingDates ? (
                  <div className="mt-4 pt-3 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Fecha de Ingreso (Alta)
                      </label>
                      <input
                        type="date"
                        value={editFechaIngreso}
                        onChange={(e) => setEditFechaIngreso(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4981fb]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Fecha de Egreso (Baja)
                      </label>
                      <input
                        type="date"
                        value={editFechaEgreso}
                        onChange={(e) => setEditFechaEgreso(e.target.value)}
                        placeholder="Sin fecha si está activa"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4981fb]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveDates}
                        disabled={savingDates}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {savingDates ? (
                          <span>Guardando...</span>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Guardar Vigencia</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Fecha de Alta / Ingreso</span>
                      <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">
                        {formatDisplayDate(selectedSeller.fechaIngreso)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Fecha de Baja / Egreso</span>
                      <span className={`text-sm font-black font-mono mt-0.5 block ${selectedSeller.fechaEgreso ? 'text-rose-600' : 'text-slate-400'}`}>
                        {selectedSeller.fechaEgreso ? formatDisplayDate(selectedSeller.fechaEgreso) : 'Sin egreso (Vigente)'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-2.5 bg-white/80 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Condición Actual</span>
                      <span className={`text-xs font-black uppercase mt-0.5 block ${selectedSeller.isBaja ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {selectedSeller.isBaja ? 'Cuenta Inactiva / Baja' : 'Activa en Producción'}
                      </span>
                    </div>
                  </div>
                )}

                {saveFeedback && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-medium text-blue-800 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{saveFeedback}</span>
                  </div>
                )}
              </div>

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
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Migración SQL disponible: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">05_fechas_ingreso_egreso_sellers.sql</code>
              </span>
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
