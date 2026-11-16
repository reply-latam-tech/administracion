"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, ArrowRight, ShieldCheck, Edit3 } from "lucide-react";

export interface AuditTooltipData {
  usuario_email: string;
  fecha: string;
  valor_anterior: string | number | null;
  valor_nuevo: string | number;
  moneda?: string;
  label?: string;
}

interface AuditTooltipProps {
  audit?: AuditTooltipData | null;
  children: React.ReactNode;
  className?: string;
}

export default function AuditTooltip({ audit, children, className = "" }: AuditTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = () => {
    if (!audit || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const placeAbove = rect.top > 160; // Si hay espacio arriba, lo ponemos arriba

    setCoords({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      placeAbove
    });
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  // Formato amigable de fecha
  const formatFriendlyDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const userInitials = (audit?.usuario_email || "U")
    .split("@")[0]
    .substring(0, 2)
    .toUpperCase();

  // Cálculo de variación porcentual si ambos son números
  let diffBadge = null;
  const oldNum = typeof audit?.valor_anterior === 'number' ? audit.valor_anterior : parseFloat(String(audit?.valor_anterior || ''));
  const newNum = typeof audit?.valor_nuevo === 'number' ? audit.valor_nuevo : parseFloat(String(audit?.valor_nuevo || ''));

  if (!isNaN(oldNum) && !isNaN(newNum) && oldNum > 0) {
    const diff = ((newNum - oldNum) / oldNum) * 100;
    const isPositive = diff > 0;
    diffBadge = (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        isPositive ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
      }`}>
        {isPositive ? "+" : ""}{diff.toFixed(2)}%
      </span>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-block w-full h-full ${className}`}
      >
        {children}
      </div>

      {mounted && isOpen && audit && coords && createPortal(
        <div
          style={{
            position: "fixed",
            top: coords.placeAbove ? undefined : `${coords.top}px`,
            bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : undefined,
            left: `${coords.left}px`,
            transform: "translateX(-50%)",
            zIndex: 99999,
          }}
          className="pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="w-72 p-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white shadow-2xl border border-slate-700/70 backdrop-blur-md">
            
            {/* Header: Usuario y Rol */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {userInitials}
                </div>
                <div className="truncate">
                  <span className="block text-xs font-bold text-slate-100 truncate">
                    {audit.usuario_email}
                  </span>
                  <span className="text-[10px] text-blue-400 font-medium block -mt-0.5">
                    Modificación Autorizada
                  </span>
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck size={11} /> Auditado
              </span>
            </div>

            {/* Fecha y Hora */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-2.5">
              <Clock size={12} className="text-slate-400 shrink-0" />
              <span>{formatFriendlyDate(audit.fecha)} <strong className="text-slate-400 font-normal">(ART)</strong></span>
            </div>

            {/* Comparativa de Valores: Anterior ➔ Nuevo */}
            <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 mb-2">
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>{audit.label || "Ajuste de Valor"}</span>
                {diffBadge}
              </div>
              
              <div className="flex items-center justify-between gap-2 font-mono text-xs">
                <div className="text-slate-400 truncate">
                  <span className="text-[10px] text-slate-500 block font-sans">Anterior:</span>
                  <span className="line-through decoration-slate-500">
                    {audit.moneda ? `${audit.moneda} ` : ""}{audit.valor_anterior ?? "—"}
                  </span>
                </div>
                
                <ArrowRight size={14} className="text-blue-400 shrink-0" />

                <div className="text-right text-emerald-400 font-bold truncate">
                  <span className="text-[10px] text-slate-400 block font-sans font-normal">Nuevo:</span>
                  <span>
                    {audit.moneda ? `${audit.moneda} ` : ""}{audit.valor_nuevo}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer con micro-tag */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Edit3 size={10} className="text-blue-400" />
                <span>Valor manual personalizado</span>
              </span>
              <span className="text-slate-400 font-mono">Reply FX</span>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}

