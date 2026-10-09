"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Settings, 
  Layers, 
  Receipt,
  Wallet,
  Calculator
} from "lucide-react";

const mainNavItems = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Directorio", href: "/clientes", icon: Users },
  { name: "Proyecciones", href: "/", icon: TrendingUp },
  { name: "Facturación", href: "/facturacion", icon: Receipt },
  { name: "Liquidaciones", href: "/liquidaciones", icon: Wallet },
  { name: "Simulador", href: "/simulador", icon: Calculator },
  { name: "Escalas", href: "/escalas", icon: Layers },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <span className="text-xl font-bold tracking-tight text-gray-900">REPLY</span>
        </div>
        <nav className="p-4 space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon size={18} />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-100">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings size={18} />
          <span className="text-sm font-medium">Configuración</span>
        </Link>
      </div>
    </aside>
  );
}
