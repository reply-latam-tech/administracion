import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Reply - Forecast & Administration Dashboard",
  description: "Plataforma Institucional de Proyecciones, Facturación y Administración de Reply Latam",
  icons: {
    icon: "/reply-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-50 text-slate-900 flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50/70">
          <Header />
          <div className="p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
