import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

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
        <Sidebar />

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
