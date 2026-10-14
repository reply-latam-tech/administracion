"use client";

import { usePathname } from "next/navigation";
import { 
  Bell, 
  Calendar, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink 
} from "lucide-react";

const pageTitles: Record<string, { title: string; category: string; description: string }> = {
  "/": { 
    title: "Proyecciones de Facturación", 
    category: "Forecast", 
    description: "Seguimiento diario de ventas acumuladas y proyección a fin de mes" 
  },
  "/overview": { 
    title: "Overview de Negocio", 
    category: "Métricas Macro", 
    description: "Comparativa consolidada mes a mes y KPIs globales" 
  },
  "/clientes": { 
    title: "Directorio de Clientes", 
    category: "Gestión", 
    description: "Estado de integración y sincronización de Sellers" 
  },
  "/facturacion": { 
    title: "Historial de Facturación", 
    category: "Finanzas", 
    description: "Desglose mensual de ventas reales y variación porcentual" 
  },
  "/liquidaciones": { 
    title: "Liquidaciones y Fees", 
    category: "Cobranzas", 
    description: "Cálculo de alícuotas, mínimos y cobro por Seller" 
  },
  "/metas": { 
    title: "Metas de Cobro & Simulador Inverso", 
    category: "Planificación Financiera", 
    description: "Cálculo inverso de ventas necesarias en Mercado Libre para alcanzar objetivos de fee" 
  },
  "/simulador": { 
    title: "Simulador de Escalas", 
    category: "Escenarios", 
    description: "Modelado predictivo de facturación y saltos de escala" 
  },
  "/escalas": { 
    title: "Matrices de Escalas", 
    category: "Configuración", 
    description: "Estructura de alícuotas por volumen y tramos vigentes" 
  },
};

export function Header() {
  const pathname = usePathname();
  const current = pageTitles[pathname] || {
    title: "Panel de Control",
    category: "Reply Ops",
    description: "Sistema centralizado de estimaciones y administración"
  };

  const todayStr = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date());

  return (
    <header className="h-20 bg-white border-b border-slate-200/90 flex items-center justify-between px-8 shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
      {/* Título & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-0.5">
          <span className="text-[#ff5100] font-semibold hover:underline">Reply</span>
          <span>/</span>
          <span>{current.category}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <span className="hidden md:inline-block text-xs text-slate-500 font-normal">
            — {current.description}
          </span>
        </div>
      </div>

      {/* Badges de Estado y Acciones Rápidas */}
      <div className="flex items-center gap-3">
        {/* Fecha y Timezone */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-600">
          <Calendar size={13} className="text-slate-400" />
          <span className="capitalize">{todayStr}</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-[11px] text-slate-500">ART (UTC-3)</span>
        </div>

        {/* Sync Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#eff5ff] border border-[#daebfe] text-xs text-[#275ec9] font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4981fb] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4981fb]"></span>
          </span>
          <span className="hidden lg:inline">Sync Diaria:</span>
          <span className="font-semibold">08:00 AM</span>
        </div>

        {/* User / Workspace */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff5100] to-[#ff7a3d] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            R
          </div>
          <div className="hidden xl:block text-left text-xs">
            <div className="font-semibold text-slate-800 leading-none">Reply Team</div>
            <div className="text-[10px] text-slate-400 leading-none mt-1">Administración</div>
          </div>
        </div>
      </div>
    </header>
  );
}
