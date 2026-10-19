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
    title: "Ventas del Cliente", 
    category: "Facturación Bruta (GMV)", 
    description: "Historial de ventas y volumen transaccionado por los clientes en marketplaces" 
  },
  "/liquidaciones": { 
    title: "Metas de Facturación", 
    category: "Ingresos Reply (Subtotal)", 
    description: "Honorarios netos de servicio de Reply por cliente, proyectados e históricos" 
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
    title: "Matriz de Escalas y Tarifas", 
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

  // Formato de última actualización de escalas (ej. "Lunes 19 Oct • 18:38 hs ART")
  const now = new Date();
  const diaSemana = now.toLocaleDateString('es-AR', { weekday: 'long' });
  const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const fechaStr = now.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const horaStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const lastUpdateStr = `${diaCapitalizado} ${fechaStr} • ${horaStr} hs ART`;

  return (
    <header className="h-20 bg-white border-b border-slate-200/90 flex items-center justify-between px-8 shrink-0 sticky top-0 z-40 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
      {/* Título & Subtítulo sin breadcrumbs ni guion medio */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
          {current.title}
        </h1>
        <p className="text-xs text-slate-500 font-normal mt-1.5 leading-none">
          {current.description}
        </p>
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

        {/* Última Actualización de la Tabla de Escalas */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 text-xs text-emerald-900 font-medium shadow-2xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-500 hidden sm:inline text-[11px]">Última actualización:</span>
          <span className="font-semibold font-mono text-[11px] text-emerald-950">
            {lastUpdateStr}
          </span>
        </div>
      </div>
    </header>
  );
}
