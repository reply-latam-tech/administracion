"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { LoginView } from "@/components/LoginView";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, isAuthorized, loading } = useAuth();

  // 1. Estado de carga inicial de sesión
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 select-none">
        <div className="relative h-10 w-40 mb-6 animate-pulse">
          <Image
            src="/reply-logo-cropped.png"
            alt="Reply Latam"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
          <span>Verificando credenciales institucionales...</span>
        </div>
      </div>
    );
  }

  // 2. Si no hay sesión o no pertenece al dominio permitido, mostrar Login
  if (!session || !isAuthorized) {
    return <LoginView />;
  }

  // 3. Usuario autenticado y autorizado: Dashboard completo
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar con Suspense */}
      <Suspense
        fallback={
          <aside className="w-64 bg-white border-r border-slate-200/90 shrink-0 h-screen" />
        }
      >
        <Sidebar />
      </Suspense>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50/70">
        <Header />
        <div className="p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
