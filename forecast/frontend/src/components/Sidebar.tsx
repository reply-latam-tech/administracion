"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Layers, 
  Receipt,
  Wallet,
  Calculator,
  Target,
  FileText,
  Activity,
  CheckCircle2
} from "lucide-react";

const mainNavItems = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard, badge: "KPIs" },
  { name: "Directorio", href: "/clientes", icon: Users, badge: null },
  { name: "Proyecciones", href: "/", icon: TrendingUp, badge: "Live" },
  { name: "Facturación", href: "/facturacion", icon: Receipt, badge: null },
  { name: "Liquidaciones", href: "/liquidaciones", icon: Wallet, badge: null },
  { name: "Metas de Cobro", href: "/metas", icon: Target, badge: "Simulador" },
  { name: "Simulador", href: "/simulador", icon: Calculator, badge: "Beta" },
  { name: "Escalas", href: "/escalas", icon: Layers, badge: null },
];

export function Sidebar() {
  const pathname = usePathname();

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
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#eff5ff] text-[#275ec9] font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon 
                    size={18} 
                    className={`transition-colors ${
                      isActive 
                        ? "text-[#4981fb]" 
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isActive 
                      ? "bg-[#4981fb] text-white" 
                      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 space-y-3">
        {/* Status card */}
        <div className="p-3 bg-white rounded-lg border border-slate-200/70 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Supabase DB
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
              Online
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1 text-[10px]">
              <Activity size={12} className="text-[#ff5100]" />
              Cron 08:00 ART
            </span>
            <span className="text-[10px] text-slate-400 font-mono">v1.4</span>
          </div>
        </div>

        {/* Quick doc link */}
        <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1">
          <span>Reply Latam © 2026</span>
        </div>
      </div>
    </aside>
  );
}
