"use client";

import React from 'react';
import { Calendar, Zap } from 'lucide-react';
import { PeriodFilterOption, Rolling24MRange } from '@/lib/periodFilterUtils';

interface PeriodFilterSelectorProps {
  selectedFilter: PeriodFilterOption;
  onChangeFilter: (f: PeriodFilterOption) => void;
  range24M: Rolling24MRange;
  availableYears?: string[];
  className?: string;
  compact?: boolean;
}

export default function PeriodFilterSelector({
  selectedFilter,
  onChangeFilter,
  range24M,
  availableYears = ['2027', '2026', '2025', '2024'],
  className = '',
  compact = false
}: PeriodFilterSelectorProps) {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
        <Calendar size={13} className="text-slate-400" /> Período:
      </span>

      <button
        type="button"
        onClick={() => onChangeFilter('24M')}
        title={`Ventana móvil de 24 meses (${range24M.startLabel} - ${range24M.endLabel})`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
          selectedFilter === '24M'
            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
        }`}
      >
        <Zap size={12} className={selectedFilter === '24M' ? 'text-amber-300' : 'text-blue-500'} />
        <span>24 Meses (Móvil)</span>
        <span className={`text-[10px] font-normal px-1.5 py-0.2 rounded-md ${
          selectedFilter === '24M' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-200/70 text-slate-600'
        }`}>
          {range24M.startLabel} - {range24M.endLabel}
        </span>
      </button>

      {availableYears.map((yr) => (
        <button
          key={yr}
          type="button"
          onClick={() => onChangeFilter(yr as PeriodFilterOption)}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
            selectedFilter === yr
              ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
          }`}
        >
          {yr}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChangeFilter('TODO')}
        title="Ver todo el historial completo de la base de datos"
        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
          selectedFilter === 'TODO'
            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
        }`}
      >
        Todo el Histórico
      </button>
    </div>
  );
}

