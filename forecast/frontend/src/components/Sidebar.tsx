"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Layers, 
  Receipt, 
  Wallet, 
  Calculator, 
  Target, 
  Activity,
  BarChart3,
  Table,
  ChevronDown,
  ChevronRight,
  Coins
} from "lucide-react";

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "subtotales";

  // Estado del acordeón de Metas de Facturación (abierto por defecto si estamos en /liquidaciones)
  const isLiquidacionesActive = pathname === "/liquidaciones";
  const [isMetasOpen, setIsMetasOpen] = useState(true);

  useEffect(() => {
    if (isLiquidacionesActive) {
      setIsMetasOpen(true);
    }
  }, [isLiquidacionesActive]);

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 h-screen select-none shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-slate-100 gap-3">
          <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-[1.02]">
            <div className="relative w-28 h-8">
              <Image 
                src="/reply-logo-cropped.png" 
                alt="Reply Logo" 
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-[#ff5100] border border-orange-200/60">
              Admin
            </span>
          </Link>
        </div>

        {/* Section Title */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Módulos de Gestión
          </p>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-1">
          {/* 1. Overview */}
          <Link
            href="/overview"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/overview"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className={pathname === "/overview" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Overview</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">KPIs</span>
          </Link>

          {/* 2. Directorio */}
          <Link
            href="/clientes"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/clientes"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Users size={18} className={pathname === "/clientes" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Directorio</span>
            </div>
          </Link>

          {/* 3. Proyecciones */}
          <Link
            href="/"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className={pathname === "/" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Proyecciones</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-[#ff5100]">Live</span>
          </Link>

          {/* 4. Ventas del Cliente */}
          <Link
            href="/facturacion"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/facturacion"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Receipt size={18} className={pathname === "/facturacion" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Ventas del Cliente</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">GMV</span>
          </Link>

          {/* 5. ACORDEÓN: METAS DE FACTURACIÓN (CON SUBSECCIONES) */}
          <div className="pt-0.5">
            <div
              onClick={() => setIsMetasOpen(!isMetasOpen)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                isLiquidacionesActive
                  ? "bg-blue-50/80 text-blue-900 font-bold"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Wallet 
                  size={18} 
                  className={isLiquidacionesActive ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} 
                />
                <span>Metas de Facturación</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  Ingresos
                </span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-transform">
                  {isMetasOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
              </div>
            </div>

            {/* Subsecciones anidadas desplegables */}
            {isMetasOpen && (
              <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-200/80 space-y-1">
                {/* Subsección 1: Resumen de Ingresos (Subtotales) */}
                <Link
                  href="/liquidaciones?view=subtotales"
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isLiquidacionesActive && currentView === "subtotales"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 
                      size={15} 
                      className={isLiquidacionesActive && currentView === "subtotales" ? "text-white" : "text-[#ff5100]"} 
                    />
                    <span>Resumen de Ingresos</span>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                    isLiquidacionesActive && currentView === "subtotales"
                      ? "bg-blue-700 text-white"
                      : "bg-orange-100 text-[#ff5100]"
                  }`}>
                    Subtotales
                  </span>
                </Link>

                {/* Subsección 2: Detalle por Concepto */}
                <Link
                  href="/liquidaciones?view=detallado"
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isLiquidacionesActive && currentView === "detallado"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Table 
                      size={15} 
                      className={isLiquidacionesActive && currentView === "detallado" ? "text-white" : "text-slate-400 group-hover:text-slate-600"} 
                    />
                    <span>Detalle por Concepto</span>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    isLiquidacionesActive && currentView === "detallado"
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    Completo
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* 6. Metas de Cobro */}
          <Link
            href="/metas"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/metas"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Target size={18} className={pathname === "/metas" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Metas de Cobro</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Simulador</span>
          </Link>

          {/* 7. Simulador */}
          <Link
            href="/simulador"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/simulador"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Calculator size={18} className={pathname === "/simulador" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Simulador</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Beta</span>
          </Link>

          {/* 8. Escalas */}
          <Link
            href="/escalas"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/escalas"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers size={18} className={pathname === "/escalas" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Escalas</span>
            </div>
          </Link>

          {/* 9. Tipos de Cambio (FX Regional) */}
          <Link
            href="/tipo-de-cambio"
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === "/tipo-de-cambio"
                ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Coins size={18} className={pathname === "/tipo-de-cambio" ? "text-[#4981fb]" : "text-slate-400 group-hover:text-slate-600"} />
              <span>Tipos de Cambio</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">FX</span>
          </Link>
        </nav>
      </div>

      {/* Footer / User Profile & System Status */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
        {/* User Profile Card */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ff5100] to-[#ff7a3d] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              R
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="font-semibold text-slate-800 text-xs truncate leading-tight">Reply Team</div>
            <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">Administración</div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-[#ff5100] border border-orange-200 uppercase shrink-0">
            Admin
          </span>
        </div>

        {/* Status card */}
        <div className="p-2.5 bg-white rounded-lg border border-slate-200/70 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Supabase DB
            </span>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
              Online
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1 text-[10px]">
              <Activity size={11} className="text-[#ff5100]" />
              Cron 08:00 ART
            </span>
            <span className="text-[10px] text-slate-400 font-mono">v1.4</span>
          </div>
        </div>

        {/* Quick doc link */}
        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-0.5">
          <span>Reply Latam © 2026</span>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 h-screen select-none shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        <div className="h-20 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-28 h-8 bg-slate-100 rounded animate-pulse" />
        </div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}

