import type { Metadata } from "next";
import "./globals.css";
import { LayoutDashboard, TrendingUp, Target, Settings, SlidersHorizontal, LogOut } from "lucide-react";

export const metadata: Metadata = {
  title: "Reply - Forecast Dashboard",
  description: "Dashboard de Proyecciones de Reply",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50 text-gray-900 flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
          <div>
            <div className="h-16 flex items-center px-6 border-b border-gray-100">
              <span className="text-xl font-bold tracking-tight text-gray-900">REPLY</span>
            </div>
            <nav className="p-4 space-y-1">
              <a href="/overview" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <LayoutDashboard size={18} />
                <span className="text-sm font-medium">Overview</span>
              </a>
              <a href="/clientes" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Target size={18} />
                <span className="text-sm font-medium">Directorio</span>
              </a>
              <a href="/" className="flex items-center gap-3 px-3 py-2 bg-gray-100 text-gray-900 rounded-md transition-colors">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Proyecciones</span>
              </a>
              <a href="/facturacion" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Facturación</span>
              </a>
              <a href="/liquidaciones" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Target size={18} />
                <span className="text-sm font-medium">Liquidaciones</span>
              </a>
              <a href="/simulador" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <SlidersHorizontal size={18} />
                <span className="text-sm font-medium">Simulador</span>
              </a>
              <a href="/escalas" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <SlidersHorizontal size={18} />
                <span className="text-sm font-medium">Escalas</span>
              </a>
            </nav>
          </div>
          <div className="p-4 border-t border-gray-100">
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <Settings size={18} />
              <span className="text-sm font-medium">Configuración</span>
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-gray-50/50">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shrink-0">
             <h1 className="text-lg font-semibold text-gray-800">Proyecciones de Facturación</h1>
          </header>
          <div className="p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
