"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Bot, 
  Search, 
  Filter, 
  Receipt, 
  Coins, 
  Building2, 
  TrendingUp, 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Eye, 
  X, 
  Calendar, 
  Download, 
  Zap, 
  Activity, 
  Info,
  DollarSign,
  Cpu
} from "lucide-react";
import TableExportButton from "@/components/TableExportButton";
import { ExportData } from "@/lib/exportUtils";
import CountryFlag from "@/components/CountryFlag";

// Tipos de datos
interface BotmakerConsumo {
  id: number;
  periodo: string;
  seller_id: number | null;
  child_project_id: string;
  child_project_name: string;
  total_billed: number;
  raw_data: Record<string, any>;
  created_at: string;
}

interface SellerMeta {
  id_seller: number;
  nombre_seller: string;
  pais: string;
  codigo_pais: string;
  moneda: string;
  cobrar_botmaker: boolean;
}

interface EnrichedAccount {
  projectId: string;
  projectName: string;
  accountName: string;
  sellerId: number | null;
  sellerName: string;
  country: string;
  cobrarBotmaker: boolean;
  creationDate?: string;
  // Períodos: periodo -> { baseBilled, agentsBilled, feeReply, margenReply, raw }
  periodData: Record<string, {
    baseBilled: number;
    agentsBilled: number;
    otherFees: number;
    totalCost: number;
    feeReply: number;
    margenReply: number;
    status: 'COBRADO' | 'EXENTO' | 'EXTERIOR_USD' | 'SIN_CONSUMO';
    raw: Record<string, any>;
  }>;
  totalCostHist: number;
  totalBilledReplyHist: number;
  totalMargenHist: number;
}

// Períodos conocidos y metadatos
const PERIOD_METADATA: Record<string, { label: string; mesConsumo: string; markupStd: number; totalFacturaBM: number; subtotalNetoBM: number }> = {
  '2026-11-01': {
    label: 'Nov 2026',
    mesConsumo: 'Octubre 2026',
    markupStd: 0.25,
    totalFacturaBM: 4616187.20,
    subtotalNetoBM: 3783760.00
  },
  '2026-10-01': {
    label: 'Oct 2026',
    mesConsumo: 'Septiembre 2026',
    markupStd: 0.25,
    totalFacturaBM: 4460184.58,
    subtotalNetoBM: 3655889.00
  },
  '2026-09-01': {
    label: 'Sep 2026',
    mesConsumo: 'Agosto 2026',
    markupStd: 0.20,
    totalFacturaBM: 3389160.00,
    subtotalNetoBM: 2778000.00
  },
  '2026-08-01': {
    label: 'Ago 2026',
    mesConsumo: 'Julio 2026',
    markupStd: 0.20,
    totalFacturaBM: 3635322.33,
    subtotalNetoBM: 2979772.40
  }
};

export default function BotmakerPage() {
  const [consumos, setConsumos] = useState<BotmakerConsumo[]>([]);
  const [sellers, setSellers] = useState<SellerMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filtros
  const [activeTab, setActiveTab] = useState<'matriz' | 'detalle' | 'reglas'>('matriz');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11-01');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [selectedAccountModal, setSelectedAccountModal] = useState<{
    account: EnrichedAccount;
    periodo: string;
    details: any;
  } | null>(null);

  // Cargar datos de Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [consumosRes, sellersRes] = await Promise.all([
          supabase.from('botmaker_consumos').select('*').order('periodo', { ascending: false }),
          supabase.from('dim_sellers').select('id_seller,nombre_seller,pais,codigo_pais,moneda,cobrar_botmaker')
        ]);

        if (consumosRes.data) {
          setConsumos(consumosRes.data as BotmakerConsumo[]);
        }
        if (sellersRes.data) {
          setSellers(sellersRes.data as SellerMeta[]);
        }
      } catch (e) {
        console.error('Error cargando datos de Botmaker:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Lista de períodos ordenados cronológicamente
  const availablePeriods = useMemo(() => {
    const pSet = new Set<string>();
    consumos.forEach(c => pSet.add(c.periodo));
    return Array.from(pSet).sort((a, b) => b.localeCompare(a));
  }, [consumos]);

  // Mapa de sellers
  const sellersMap = useMemo(() => {
    const map = new Map<number, SellerMeta>();
    sellers.forEach(s => map.set(s.id_seller, s));
    return map;
  }, [sellers]);

  // Consolidar cuentas por projectId enriquecido con historial
  const enrichedAccounts = useMemo(() => {
    const accountsMap = new Map<string, EnrichedAccount>();

    consumos.forEach(c => {
      const pId = c.child_project_id || c.child_project_name;
      if (!pId) return;

      if (!accountsMap.has(pId)) {
        const seller = c.seller_id ? sellersMap.get(c.seller_id) : undefined;
        const rawCountry = c.raw_data?.['Child Country'] || seller?.codigo_pais || seller?.pais || 'AR';
        const accountName = c.raw_data?.['Child Account Name'] || c.child_project_name || pId;

        // Reglas comerciales de exención
        let cobrarBotmaker = seller ? seller.cobrar_botmaker : true;
        const normName = accountName.toLowerCase();
        if (normName.includes('cafe martinez') || normName.includes('pinturas online') || normName.includes('alma nativa')) {
          cobrarBotmaker = false;
        }

        accountsMap.set(pId, {
          projectId: pId,
          projectName: c.child_project_name,
          accountName,
          sellerId: c.seller_id,
          sellerName: seller?.nombre_seller || accountName,
          country: rawCountry.toUpperCase(),
          cobrarBotmaker,
          creationDate: c.raw_data?.['Creation date'],
          periodData: {},
          totalCostHist: 0,
          totalBilledReplyHist: 0,
          totalMargenHist: 0
        });
      }

      const acc = accountsMap.get(pId)!;
      const baseFee = Number(c.total_billed) || 0;
      
      // Agentes y otros cargos de raw_data
      const agentsFee = parseFloat(c.raw_data?.['Agents billed']) || 0;
      let otherFees = 0;
      if (c.raw_data) {
        Object.entries(c.raw_data).forEach(([k, v]) => {
          if (k.endsWith(' billed') && !k.includes('billed count') && !k.includes('platform fee') && k !== 'Agents billed') {
            otherFees += parseFloat(v) || 0;
          }
        });
      }

      const totalCost = baseFee; // El costo imputado oficial es la plataforma base (los agentes se consolidan centralizadamente)
      
      // Determinar qué factura Reply según período y reglas de negocio
      let feeReply = 0;
      let status: 'COBRADO' | 'EXENTO' | 'EXTERIOR_USD' | 'SIN_CONSUMO' = 'SIN_CONSUMO';

      if (baseFee > 0) {
        if (!acc.cobrarBotmaker) {
          status = 'EXENTO';
          feeReply = 0;
        } else if (acc.country !== 'AR') {
          status = 'EXTERIOR_USD';
          // Para exterior: USD 190 / USD 200 (se muestra en ARS aproximado al TC del mes o en USD)
          feeReply = c.periodo >= '2026-10-01' ? 190 * 1550 : 170 * 1350;
        } else {
          status = 'COBRADO';
          // Regla 20% antes de Oct 26, 25% desde Oct 26
          if (c.periodo >= '2026-10-01') {
            if (pId === 'sodastream_1' || acc.sellerId === 430009374) {
              feeReply = 410000;
            } else if (pId === 'forbasse' && c.periodo === '2026-10-01') {
              feeReply = 206750;
            } else {
              feeReply = Math.round(baseFee * 1.25 * 100) / 100;
            }
          } else {
            if (pId === 'sodastream_1' || acc.sellerId === 430009374) {
              feeReply = 331200;
            } else {
              feeReply = Math.round(baseFee * 1.20 * 100) / 100;
            }
          }
        }
      }

      const margen = feeReply > 0 ? (feeReply - totalCost) : (status === 'EXENTO' ? -totalCost : 0);

      acc.periodData[c.periodo] = {
        baseBilled: baseFee,
        agentsBilled: agentsFee,
        otherFees,
        totalCost,
        feeReply,
        margenReply: margen,
        status,
        raw: c.raw_data || {}
      };

      acc.totalCostHist += totalCost;
      acc.totalBilledReplyHist += feeReply;
      acc.totalMargenHist += margen;
    });

    return Array.from(accountsMap.values()).sort((a, b) => b.totalCostHist - a.totalCostHist);
  }, [consumos, sellersMap]);

  // Cuentas filtradas
  const filteredAccounts = useMemo(() => {
    return enrichedAccounts.filter(acc => {
      // Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = acc.accountName.toLowerCase().includes(term);
        const matchesSeller = acc.sellerName.toLowerCase().includes(term);
        const matchesId = acc.projectId.toLowerCase().includes(term);
        if (!matchesName && !matchesSeller && !matchesId) return false;
      }

      // Filtro por País
      if (countryFilter !== 'TODOS') {
        if (countryFilter === 'AR' && acc.country !== 'AR') return false;
        if (countryFilter === 'EXTERIOR' && acc.country === 'AR') return false;
        if (countryFilter !== 'AR' && countryFilter !== 'EXTERIOR' && acc.country !== countryFilter) return false;
      }

      // Filtro por Estado Comercial
      if (statusFilter !== 'TODOS') {
        const periodData = selectedPeriod ? acc.periodData[selectedPeriod] : null;
        if (statusFilter === 'ACTIVOS') {
          if (selectedPeriod && (!periodData || periodData.baseBilled <= 0)) return false;
          if (!selectedPeriod && acc.totalCostHist <= 0) return false;
        }
        if (statusFilter === 'EXENTOS' && acc.cobrarBotmaker) return false;
        if (statusFilter === 'SIN_CONSUMO') {
          if (selectedPeriod && periodData && periodData.baseBilled > 0) return false;
          if (!selectedPeriod && acc.totalCostHist > 0) return false;
        }
      }

      return true;
    });
  }, [enrichedAccounts, searchTerm, countryFilter, statusFilter, selectedPeriod]);

  // KPIs del período seleccionado
  const periodKPIs = useMemo(() => {
    const meta = PERIOD_METADATA[selectedPeriod] || {
      label: selectedPeriod,
      mesConsumo: 'Mes Vencido',
      markupStd: 0.25,
      totalFacturaBM: 0,
      subtotalNetoBM: 0
    };

    let totalCostoBase = 0;
    let totalFacturadoReply = 0;
    let totalMargenReply = 0;
    let activasConConsumo = 0;
    let cuentasExentas = 0;

    enrichedAccounts.forEach(acc => {
      const p = acc.periodData[selectedPeriod];
      if (p && p.baseBilled > 0) {
        totalCostoBase += p.baseBilled;
        totalFacturadoReply += p.feeReply;
        totalMargenReply += p.margenReply;
        activasConConsumo++;
      }
      if (!acc.cobrarBotmaker) {
        cuentasExentas++;
      }
    });

    const facturasTotales = meta.totalFacturaBM || totalCostoBase * 1.22;
    const subtotalFactura = meta.subtotalNetoBM || totalCostoBase;

    return {
      periodLabel: meta.label,
      mesConsumo: meta.mesConsumo,
      totalCostoBase,
      subtotalFactura,
      facturasTotales,
      totalFacturadoReply,
      totalMargenReply,
      activasConConsumo,
      cuentasExentas,
      totalProyectos: enrichedAccounts.length
    };
  }, [enrichedAccounts, selectedPeriod]);

  // Formateador de moneda ARS
  const formatARS = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatARSExact = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  // Exportar datos
  const getExportData = (): ExportData => {
    if (activeTab === 'matriz') {
      const headers = ['Cuenta / Proyecto', 'ID Proyecto', 'Seller Reply', 'País', 'Condición Comercial', ...availablePeriods.map(p => PERIOD_METADATA[p]?.label || p), 'Total Acumulado (ARS)'];
      const rows = filteredAccounts.map(acc => [
        acc.accountName,
        acc.projectId,
        acc.sellerName,
        acc.country,
        acc.cobrarBotmaker ? 'Cobrado' : 'Exento / Bonificado',
        ...availablePeriods.map(p => acc.periodData[p]?.baseBilled || 0),
        acc.totalCostHist
      ]);

      return {
        filename: `botmaker_matriz_historica_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Matriz Histórica Botmaker',
        headers,
        rows
      };
    } else {
      const headers = ['Proyecto', 'ID Proyecto', 'Seller Reply', 'País', 'Costo Base Plataforma', 'Agentes Billed', 'Fee Cobrado Reply', 'Margen Reply', 'Estado Cobro'];
      const rows = filteredAccounts.map(acc => {
        const p = acc.periodData[selectedPeriod];
        return [
          acc.accountName,
          acc.projectId,
          acc.sellerName,
          acc.country,
          p?.baseBilled || 0,
          p?.agentsBilled || 0,
          p?.feeReply || 0,
          p?.margenReply || 0,
          p?.status || 'SIN_CONSUMO'
        ];
      });

      return {
        filename: `botmaker_detalle_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}`,
        sheetName: `Período ${selectedPeriod}`,
        headers,
        rows
      };
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full select-none max-w-full overflow-x-hidden">
      
      {/* 1. Header de Sección */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex items-center justify-center">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Gestión & Liquidaciones de Botmaker
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Licencias & Plataforma
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Desfase +1 Mes Vencido Activo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Control contable de consumos oficiales, auditoría de cuentas hijas, márgenes de intermediación de Reply y facturas mensuales.
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 flex-wrap">
          <TableExportButton 
            getData={getExportData}
            label="Exportar a Excel"
          />
        </div>
      </div>

      {/* 2. Tarjetas KPI Ejecutivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Factura Total Oficial Botmaker */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Factura Botmaker ({periodKPIs.periodLabel})</span>
            <Receipt size={17} className="text-indigo-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {formatARSExact(periodKPIs.facturasTotales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Neto: {formatARS(periodKPIs.subtotalFactura)}</span>
            <span className="font-semibold text-slate-600">IVA/Imp: 22%</span>
          </div>
        </div>

        {/* KPI 2: Total Facturado por Reply a Clientes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Facturación Reply ({periodKPIs.periodLabel})</span>
            <TrendingUp size={17} className="text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 tracking-tight">
            {formatARS(periodKPIs.totalFacturadoReply)}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1 flex items-center gap-1 font-medium">
            <Sparkles size={12} />
            <span>Markup oficial aplicado: +25%</span>
          </div>
        </div>

        {/* KPI 3: Margen Bruto Reply */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Margen Bruto Reply</span>
            <DollarSign size={17} className="text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-blue-600 tracking-tight">
            {formatARS(periodKPIs.totalMargenReply)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Utilidad neta por intermediación de licencias
          </div>
        </div>

        {/* KPI 4: Cuentas Activas con Consumo */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuentas Activas</span>
            <Activity size={17} className="text-orange-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
            <span>{periodKPIs.activasConConsumo}</span>
            <span className="text-xs text-slate-400 font-medium">/ {periodKPIs.totalProyectos} proyectos</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {periodKPIs.totalProyectos - periodKPIs.activasConConsumo} cuentas inactivas ($0)
          </div>
        </div>

        {/* KPI 5: Cuentas Bonificadas / Exentas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bonificadas</span>
            <ShieldCheck size={17} className="text-purple-500" />
          </div>
          <div className="text-xl font-extrabold text-purple-700 tracking-tight">
            {periodKPIs.cuentasExentas} Clientes
          </div>
          <div className="text-[11px] text-purple-600/80 mt-1">
            Café Martínez, Pinturas Online, Alma Nativa
          </div>
        </div>
      </div>

      {/* 3. Barra de Control: Pestañas de Vista y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Selector de Pestañas de Vista */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('matriz')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'matriz'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Matriz Histórica Mensual</span>
          </button>

          <button
            onClick={() => setActiveTab('detalle')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'detalle'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            <span>Detalle por Factura</span>
          </button>

          <button
            onClick={() => setActiveTab('reglas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reglas'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info size={14} />
            <span>Reglas & Conciliación</span>
          </button>
        </div>

        {/* Filtros dinámicos */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Selector de Período (para vista detalle y KPIs) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Período:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              {availablePeriods.map(p => (
                <option key={p} value={p}>
                  {PERIOD_METADATA[p]?.label || p} ({PERIOD_METADATA[p]?.mesConsumo || 'Mes Vencido'})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por País */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter size={13} className="text-slate-400" />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Países</option>
              <option value="AR">🇦🇷 Argentina</option>
              <option value="EXTERIOR">🌎 Exterior (USD)</option>
              <option value="CO">🇨🇴 Colombia</option>
              <option value="MX">🇲🇽 México</option>
              <option value="CL">🇨🇱 Chile</option>
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ACTIVOS">Solo Activos (con cargo)</option>
              <option value="EXENTOS">Solo Bonificados / Exentos</option>
              <option value="SIN_CONSUMO">Solo Inactivos ($0)</option>
            </select>
          </div>

          {/* Buscador */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar proyecto, seller o ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. TABLA 1: MATRIZ HISTÓRICA MENSUAL */}
      {activeTab === 'matriz' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Evolución Mensual de Consumos de Plataforma</span>
                <span className="text-xs font-normal text-slate-500">
                  ({filteredAccounts.length} cuentas listadas)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Costo base de plataforma facturado por Botmaker a Reply en cada cierre mensual (valores expresados en ARS).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[650px] relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-20 shadow-xs border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 sticky left-0 bg-slate-50 z-30 min-w-[280px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                    Cuenta / Proyecto Botmaker
                  </th>
                  <th className="px-4 py-3 min-w-[160px] border-r border-slate-200">
                    Seller Asociado
                  </th>
                  <th className="px-3 py-3 text-center min-w-[90px] border-r border-slate-200">
                    País
                  </th>
                  <th className="px-3 py-3 text-center min-w-[120px] border-r border-slate-200">
                    Condición
                  </th>
                  {availablePeriods.map(p => (
                    <th key={p} className="px-5 py-3 text-right min-w-[140px] border-r border-slate-200">
                      <div>{PERIOD_METADATA[p]?.label || p}</div>
                      <div className="text-[10px] font-normal text-slate-400 normal-case">
                        Consumo {PERIOD_METADATA[p]?.mesConsumo || 'Mes'}
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right min-w-[150px] font-extrabold text-indigo-900 bg-indigo-50/50">
                    Total Acumulado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc, idx) => {
                  return (
                    <tr 
                      key={acc.projectId}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Sticky Account Name */}
                      <td className="px-5 py-3 sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{acc.accountName}</span>
                            {acc.accountName !== acc.projectName && (
                              <span className="text-[10px] text-slate-400 font-mono">({acc.projectName})</span>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {acc.projectId}
                        </div>
                      </td>

                      {/* Seller asociado */}
                      <td className="px-4 py-3 border-r border-slate-200">
                        <div className="font-medium text-slate-800">
                          {acc.sellerName}
                        </div>
                        {acc.sellerId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {acc.sellerId}
                          </div>
                        )}
                      </td>

                      {/* País */}
                      <td className="px-3 py-3 text-center border-r border-slate-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          <CountryFlag code={acc.country} />
                          <span>{acc.country}</span>
                        </span>
                      </td>

                      {/* Condición Comercial */}
                      <td className="px-3 py-3 text-center border-r border-slate-200">
                        {acc.cobrarBotmaker ? (
                          acc.country !== 'AR' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Exterior USD
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Cobrado +Markup
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Bonificado ($0)
                          </span>
                        )}
                      </td>

                      {/* Columnas mensuales */}
                      {availablePeriods.map(p => {
                        const pData = acc.periodData[p];
                        const base = pData?.baseBilled || 0;
                        const fee = pData?.feeReply || 0;
                        return (
                          <td key={p} className="px-5 py-3 text-right border-r border-slate-200 font-mono">
                            {base > 0 ? (
                              <div>
                                <span className="font-bold text-slate-900">
                                  {formatARS(base)}
                                </span>
                                {acc.cobrarBotmaker && fee > 0 && (
                                  <div className="text-[10px] text-emerald-600 font-sans font-medium">
                                    Reply: {formatARS(fee)}
                                  </div>
                                )}
                                {!acc.cobrarBotmaker && (
                                  <div className="text-[10px] text-purple-600 font-sans font-medium">
                                    Bonificado
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total acumulado */}
                      <td className="px-5 py-3 text-right font-mono font-bold text-indigo-900 bg-indigo-50/30">
                        {acc.totalCostHist > 0 ? (
                          <div>
                            <div>{formatARS(acc.totalCostHist)}</div>
                            {acc.cobrarBotmaker && acc.totalBilledReplyHist > 0 && (
                              <div className="text-[10px] text-emerald-600 font-sans font-medium">
                                Reply: {formatARS(acc.totalBilledReplyHist)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Pie de Totales Generales */}
              <tfoot className="bg-slate-100 font-extrabold text-slate-900 sticky bottom-0 z-20 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                <tr>
                  <td className="px-5 py-3.5 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-300">
                    TOTAL GENERAL CONSOLIDADO
                  </td>
                  <td className="px-4 py-3.5 border-r border-slate-300 text-slate-500 font-normal">
                    {filteredAccounts.length} proyectos
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-300">-</td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-300">-</td>
                  {availablePeriods.map(p => {
                    const totalPeriodCost = filteredAccounts.reduce((acc, a) => acc + (a.periodData[p]?.baseBilled || 0), 0);
                    const totalPeriodReply = filteredAccounts.reduce((acc, a) => acc + (a.periodData[p]?.feeReply || 0), 0);
                    return (
                      <td key={p} className="px-5 py-3.5 text-right font-mono border-r border-slate-300">
                        <div className="text-indigo-950">{formatARS(totalPeriodCost)}</div>
                        <div className="text-[10px] text-emerald-700 font-sans font-semibold">
                          Reply: {formatARS(totalPeriodReply)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-5 py-3.5 text-right font-mono text-indigo-950 bg-indigo-100/50">
                    {formatARS(filteredAccounts.reduce((acc, a) => acc + a.totalCostHist, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. TABLA 2: DETALLE GRANULAR DE FACTURA POR PERÍODO */}
      {activeTab === 'detalle' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Auditoría Granular de Factura — Período {PERIOD_METADATA[selectedPeriod]?.label || selectedPeriod}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Consumo {PERIOD_METADATA[selectedPeriod]?.mesConsumo || 'Mes'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Desglose técnico de cargos de plataforma, agentes, micro-consumos y liquidación neta facturada a clientes.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[650px] relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-20 shadow-xs border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 sticky left-0 bg-slate-50 z-30 min-w-[260px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                    Cuenta / Proyecto Botmaker
                  </th>
                  <th className="px-4 py-3 min-w-[150px] border-r border-slate-200">
                    Seller Reply
                  </th>
                  <th className="px-3 py-3 text-center min-w-[80px] border-r border-slate-200">
                    País
                  </th>
                  <th className="px-4 py-3 text-right min-w-[140px] border-r border-slate-200">
                    Base Plataforma
                  </th>
                  <th className="px-4 py-3 text-right min-w-[120px] border-r border-slate-200">
                    Agentes Registrados
                  </th>
                  <th className="px-4 py-3 text-right min-w-[120px] border-r border-slate-200">
                    Consumos AI / Otros
                  </th>
                  <th className="px-4 py-3 text-center min-w-[130px] border-r border-slate-200">
                    Regla Comercial
                  </th>
                  <th className="px-5 py-3 text-right min-w-[140px] border-r border-slate-200 font-extrabold text-emerald-800 bg-emerald-50/40">
                    Fee Cobrado Reply
                  </th>
                  <th className="px-4 py-3 text-right min-w-[120px] border-r border-slate-200 font-bold text-blue-700">
                    Margen Reply
                  </th>
                  <th className="px-3 py-3 text-center min-w-[100px]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map(acc => {
                  const pData = acc.periodData[selectedPeriod];
                  const base = pData?.baseBilled || 0;
                  const agents = pData?.agentsBilled || 0;
                  const other = pData?.otherFees || 0;
                  const feeReply = pData?.feeReply || 0;
                  const margen = pData?.margenReply || 0;

                  return (
                    <tr 
                      key={acc.projectId}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Proyecto */}
                      <td className="px-5 py-3 sticky left-0 bg-white group-hover:bg-slate-50/90 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-200">
                        <div className="font-bold text-slate-900">
                          {acc.accountName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {acc.projectId}
                        </div>
                      </td>

                      {/* Seller */}
                      <td className="px-4 py-3 border-r border-slate-200">
                        <div className="font-medium text-slate-800">{acc.sellerName}</div>
                        {acc.sellerId && (
                          <div className="text-[10px] text-slate-400 font-mono">ID: {acc.sellerId}</div>
                        )}
                      </td>

                      {/* País */}
                      <td className="px-3 py-3 text-center border-r border-slate-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          <CountryFlag code={acc.country} />
                          <span>{acc.country}</span>
                        </span>
                      </td>

                      {/* Base Plataforma */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                        {base > 0 ? formatARS(base) : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Agentes Registrados */}
                      <td className="px-4 py-3 text-right font-mono border-r border-slate-200">
                        {agents > 0 ? (
                          <span className="font-medium text-amber-700">{formatARS(agents)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Consumos AI */}
                      <td className="px-4 py-3 text-right font-mono border-r border-slate-200 text-slate-500">
                        {other > 0 ? `$${other.toFixed(2)}` : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Regla Comercial */}
                      <td className="px-4 py-3 text-center border-r border-slate-200">
                        {!acc.cobrarBotmaker ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Exento / Bonificado
                          </span>
                        ) : acc.country !== 'AR' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Piso USD 190
                          </span>
                        ) : base > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Markup +25%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Fee Cobrado Reply */}
                      <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20 border-r border-slate-200">
                        {feeReply > 0 ? (
                          formatARS(feeReply)
                        ) : (
                          <span className="text-slate-400 font-normal">
                            {!acc.cobrarBotmaker ? '$0 (Bonificado)' : '-'}
                          </span>
                        )}
                      </td>

                      {/* Margen Reply */}
                      <td className="px-4 py-3 text-right font-mono font-bold border-r border-slate-200">
                        {margen > 0 ? (
                          <span className="text-blue-600">+{formatARS(margen)}</span>
                        ) : margen < 0 ? (
                          <span className="text-red-500">-{formatARS(Math.abs(margen))}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setSelectedAccountModal({
                            account: acc,
                            periodo: selectedPeriod,
                            details: pData?.raw || {}
                          })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-slate-700"
                          title="Inspeccionar métricas completas de Botmaker"
                        >
                          <Eye size={12} />
                          <span>Métricas</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totales Detalle */}
              <tfoot className="bg-slate-100 font-extrabold text-slate-900 sticky bottom-0 z-20 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                <tr>
                  <td className="px-5 py-3.5 sticky left-0 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-slate-300">
                    TOTAL PERÍODO {PERIOD_METADATA[selectedPeriod]?.label || selectedPeriod}
                  </td>
                  <td className="px-4 py-3.5 border-r border-slate-300 text-slate-500 font-normal">
                    {filteredAccounts.filter(a => (a.periodData[selectedPeriod]?.baseBilled || 0) > 0).length} activas
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-300">-</td>
                  <td className="px-4 py-3.5 text-right font-mono border-r border-slate-300 text-indigo-950">
                    {formatARS(periodKPIs.totalCostoBase)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono border-r border-slate-300 text-amber-800">
                    {formatARS(filteredAccounts.reduce((acc, a) => acc + (a.periodData[selectedPeriod]?.agentsBilled || 0), 0))}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono border-r border-slate-300 text-slate-500">
                    ${filteredAccounts.reduce((acc, a) => acc + (a.periodData[selectedPeriod]?.otherFees || 0), 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 text-center border-r border-slate-300">-</td>
                  <td className="px-5 py-3.5 text-right font-mono text-emerald-800 bg-emerald-100/50 border-r border-slate-300">
                    {formatARS(periodKPIs.totalFacturadoReply)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-blue-700 border-r border-slate-300">
                    +{formatARS(periodKPIs.totalMargenReply)}
                  </td>
                  <td className="px-3 py-3.5 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 6. TABLA 3: REGLAS COMERCIALES & CONCILIACIÓN */}
      {activeTab === 'reglas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card Reglas Comerciales */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reglas de Negocio & Markups de Reply
                </h3>
                <p className="text-xs text-slate-500">
                  Directrices oficiales de facturación e intermediación de licencias
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Regla de Desfase de Mes Vencido (+1 Mes)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Los consumos de Botmaker se descargan al cierre de mes vencido. Por ello, el consumo de <strong>Octubre 2026</strong> se liquida y cobra a los clientes en la facturación de Reply de <strong>Noviembre 2026 (`2026-11-01`)</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  2. Esquema de Markups Vigente (+25%)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  A partir de Octubre 2026 rige la nueva base de Botmaker con un <strong>markup del 25%</strong> para Reply:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                  <li><strong>Cuentas Estándar:</strong> Base $165.000 ARS * 1.25 = <strong>$206.250 ARS</strong>.</li>
                  <li><strong>Soda Stream:</strong> Base $328.000 ARS * 1.25 = <strong>$410.000 ARS</strong>.</li>
                  <li><strong>Histórico (&lt; Oct 26):</strong> Markup del 20% (Base $139.000 * 1.20 = $166.800 ARS).</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  3. Cuentas Bonificadas / Exentas (No pagan Botmaker)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Por acuerdos comerciales aprobados, las siguientes cuentas tienen costo imputado absorbido por Reply (cobran $0 de Botmaker al cliente):
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                  <li><strong>Café Martínez</strong> (`cobrar_botmaker = false`)</li>
                  <li><strong>Pinturas Online</strong> (`cobrar_botmaker = false`)</li>
                  <li><strong>Alma Nativa Argentina</strong> (`cobrar_botmaker = false`)</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  4. Cuentas del Exterior (Liquidación en USD sin IVA)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Para clientes radicados en Colombia, México y Chile, Botmaker se liquida en Dólares (USD) con tarifa mínima de <strong>USD 190 / USD 200</strong> y tasa de IVA 0% (exportación de servicios).
                </p>
              </div>
            </div>
          </div>

          {/* Card Resumen de Facturas Oficiales Botmaker */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Receipt size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Conciliación de Facturas Recibidas de Botmaker
                </h3>
                <p className="text-xs text-slate-500">
                  Control de importes fiscales facturados por COMPRE AFUERA SRL
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {availablePeriods.map(p => {
                const meta = PERIOD_METADATA[p];
                return (
                  <div key={p} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          Factura {meta?.mesConsumo || p}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          Liq. Reply {meta?.label || p}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Subtotal Neto: {formatARS(meta?.subtotalNetoBM || 0)} | IVA 22%: {formatARS((meta?.totalFacturaBM || 0) - (meta?.subtotalNetoBM || 0))}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900">
                        {formatARSExact(meta?.totalFacturaBM || 0)}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end">
                        <CheckCircle2 size={11} /> Conciliado 100%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal de Inspección Técnica (Raw Data) */}
      {selectedAccountModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Métricas de Botmaker — {selectedAccountModal.account.accountName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ID: {selectedAccountModal.account.projectId} | Período: {PERIOD_METADATA[selectedAccountModal.periodo]?.label || selectedAccountModal.periodo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1 text-xs">
              
              {/* Tarjetas resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Plataforma</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatARS(selectedAccountModal.account.periodData[selectedAccountModal.periodo]?.baseBilled || 0)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Fee Reply</span>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">
                    {formatARS(selectedAccountModal.account.periodData[selectedAccountModal.periodo]?.feeReply || 0)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Mensajes</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {Number(selectedAccountModal.details['Messages billed count'] || 0).toLocaleString('es-AR')}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Agentes Free Tier</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedAccountModal.details['Agents free tier'] || '0'}
                  </div>
                </div>
              </div>

              {/* Detalle de todos los campos no vacíos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-slate-700">
                  Desglose Técnico de la Factura (Campos Oficiales)
                </div>
                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                  {Object.entries(selectedAccountModal.details)
                    .filter(([_, v]) => v && v !== '0' && v !== '0.00' && v !== 'false')
                    .map(([k, v]) => (
                      <div key={k} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50/50">
                        <span className="text-slate-600 font-medium">{k}</span>
                        <span className="font-mono text-slate-900 font-bold">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAccountModal(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
