"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { ExportData, exportToCSV, exportToExcel } from "@/lib/exportUtils";

interface TableExportButtonProps {
  getData?: () => ExportData;
  data?: ExportData;
  label?: string;
  variant?: "default" | "compact";
  align?: "left" | "right";
  disabled?: boolean;
  className?: string;
}

export default function TableExportButton({
  getData,
  data,
  label = "Exportar",
  variant = "default",
  align = "right",
  disabled = false,
  className = "",
}: TableExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click afuera o presionar ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const resolveData = (): ExportData | null => {
    if (getData) {
      try {
        return getData();
      } catch (err) {
        console.error("Error al obtener los datos para exportación:", err);
        return null;
      }
    }
    if (data) return data;
    return null;
  };

  const handleExportExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const resolved = resolveData();
    if (!resolved) return;
    exportToExcel(resolved);
  };

  const handleExportCSVExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const resolved = resolveData();
    if (!resolved) return;
    exportToCSV(resolved, { delimiter: ';' });
  };

  const handleExportCSVStandard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const resolved = resolveData();
    if (!resolved) return;
    exportToCSV(resolved, { delimiter: ',' });
  };

  const isCompact = variant === "compact";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={`flex items-center gap-1.5 font-semibold transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
          isCompact
            ? "px-2.5 py-1 text-[11px] rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs"
            : "px-3.5 py-2 text-xs rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs"
        }`}
        title="Descargar información de la tabla con los filtros actuales"
      >
        <Download size={isCompact ? 12 : 13} className="text-slate-500" />
        <span>{label}</span>
        <ChevronDown
          size={isCompact ? 11 : 12}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Opciones de Descarga
            </p>
          </div>

          {/* Opción 1: Excel nativo */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-emerald-50/70 transition-colors cursor-pointer group"
            role="menuitem"
          >
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100/80 transition-colors shrink-0">
              <FileSpreadsheet size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                  Excel (.xlsx)
                </p>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700">
                  Recomendado
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Hoja nativa, tipos de datos y tildes perfectas
              </p>
            </div>
          </button>

          {/* Opción 2: CSV optimizado para Excel en español */}
          <button
            type="button"
            onClick={handleExportCSVExcel}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-blue-50/70 transition-colors cursor-pointer group"
            role="menuitem"
          >
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100/80 transition-colors shrink-0">
              <FileText size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-800 group-hover:text-blue-900">
                  CSV para Excel (.csv)
                </p>
                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                  sep = ;
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                UTF-8 BOM con punto y coma (abre directo en Excel)
              </p>
            </div>
          </button>

          {/* Opción 3: CSV estándar con comas */}
          <button
            type="button"
            onClick={handleExportCSVStandard}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
            role="menuitem"
          >
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-200/70 transition-colors shrink-0">
              <FileText size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                  CSV estándar (.csv)
                </p>
                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                  sep = ,
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Separado por comas con BOM UTF-8
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
