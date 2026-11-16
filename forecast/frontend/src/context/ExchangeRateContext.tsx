"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  ExchangeRateRow,
  EXCHANGE_RATES,
  updateLiveRateMap,
  getRateToUSD as getRateFallback,
  convertCurrency as convertCurrencyFallback
} from "@/lib/exchangeRates";

export interface AuditEntry {
  id: string | number;
  periodo: string;
  moneda: string;
  valor_anterior: number | null;
  valor_nuevo: number;
  usuario_email: string;
  created_at: string;
}

export type CurrencyKey = 'ars' | 'mxn' | 'pen' | 'clp' | 'cop';

interface ExchangeRateContextType {
  rates: ExchangeRateRow[];
  auditLog: AuditEntry[];
  loading: boolean;
  saving: boolean;
  lastSync: Date | null;
  canEdit: boolean;
  convertCurrency: (amount: number, fromCurrency: string, toCurrency: string, periodo: string) => number;
  getRateToUSD: (currency: string, periodo: string) => number;
  updateRate: (periodo: string, currency: CurrencyKey, newValue: number) => Promise<{ success: boolean; error?: string }>;
  refreshRates: () => Promise<void>;
}

const ExchangeRateContext = createContext<ExchangeRateContextType | undefined>(undefined);

export function ExchangeRateProvider({ children }: { children: React.ReactNode }) {
  const { user, role, isPropietario, isDirectivo, isAdministracion } = useAuth();
  const [rates, setRates] = useState<ExchangeRateRow[]>(EXCHANGE_RATES);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Permisos: Administracion, Directivo o Propietario pueden editar
  const canEdit = useMemo(() => {
    return isPropietario || isDirectivo || isAdministracion || (user?.email === "matias.molesini@replylatam.com");
  }, [isPropietario, isDirectivo, isAdministracion, user]);

  // Cargar datos del servidor
  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/tipo-de-cambio', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.rates && Array.isArray(json.rates) && json.rates.length > 0) {
          setRates(json.rates);
          updateLiveRateMap(json.rates);
        }
        if (json.auditLog && Array.isArray(json.auditLog)) {
          setAuditLog(json.auditLog);
        }
        setLastSync(new Date());
      }
    } catch (e) {
      console.warn('Error fetching /api/tipo-de-cambio:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial y suscripción a Supabase Realtime
  useEffect(() => {
    fetchRates();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('tc-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fact_metricas_operativas' }, (payload) => {
        const row: any = payload.new || {};
        if (row.tipo_metrica && (row.tipo_metrica.startsWith('TC_') || row.tipo_metrica === 'TC_AUDIT')) {
          fetchRates();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tipo_de_cambio' }, () => {
        fetchRates();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auditoria_tipo_cambio' }, () => {
        fetchRates();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRates]);

  // Mapa reactivo indexado por período 'YYYY-MM'
  const ratesMap = useMemo(() => {
    const map = new Map<string, ExchangeRateRow>();
    rates.forEach(r => {
      const p7 = (r.periodo || '').substring(0, 7);
      map.set(p7, r);
      map.set(r.periodo, r);
    });
    return map;
  }, [rates]);

  // Obtener cotización a USD en base al estado reactivo
  const getRateToUSD = useCallback((currency: string, periodo: string): number => {
    const c = (currency || 'USD').trim().toUpperCase();
    if (c === 'USD') return 1.0;

    const pKey = (periodo || '').substring(0, 7);
    const row = ratesMap.get(pKey);

    if (row) {
      switch (c) {
        case 'ARS': return row.ars !== null && row.ars !== undefined ? row.ars : 1500.0;
        case 'COP': return row.cop !== null && row.cop !== undefined ? row.cop : 3350.0;
        case 'CLP': return row.clp !== null && row.clp !== undefined ? row.clp : 950.0;
        case 'MXN': return row.mxn !== null && row.mxn !== undefined ? row.mxn : 18.0;
        case 'PEN': return row.pen !== null && row.pen !== undefined ? row.pen : 3.4;
        default: return 1.0;
      }
    }

    return getRateFallback(currency, periodo);
  }, [ratesMap]);

  // Conversor reactivo multimoneda
  const convertCurrency = useCallback((
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    periodo: string
  ): number => {
    if (!amount || amount === 0) return 0;
    const from = (fromCurrency || 'USD').trim().toUpperCase();
    const to = (toCurrency || 'USD').trim().toUpperCase();
    if (from === to) return amount;

    const rateFrom = getRateToUSD(from, periodo);
    const amountUSD = rateFrom > 0 ? amount / rateFrom : amount;

    if (to === 'USD') return amountUSD;

    const rateTo = getRateToUSD(to, periodo);
    return amountUSD * rateTo;
  }, [getRateToUSD]);

  // Actualizar un tipo de cambio con Optimistic UI y auditoría
  const updateRate = async (
    periodo: string,
    currency: CurrencyKey,
    newValue: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canEdit) {
      return { success: false, error: 'No tienes permisos de Administrador para editar cotizaciones.' };
    }

    const curKey = currency.toLowerCase() as CurrencyKey;
    const p7 = periodo.substring(0, 7);
    const userEmail = user?.email || 'matias.molesini@replylatam.com';

    // 1. Guardar estado previo para posible rollback
    const prevRates = [...rates];
    const prevAudit = [...auditLog];

    // 2. Optimistic UI: actualizar estado en memoria de inmediato
    const oldRow = rates.find(r => r.periodo.startsWith(p7));
    const oldValue = oldRow ? (oldRow[curKey] as number | null) : null;

    const updatedRates = rates.map(row => {
      if (row.periodo.startsWith(p7)) {
        return {
          ...row,
          [curKey]: newValue,
          updated_by: userEmail,
          updated_at: new Date().toISOString()
        };
      }
      return row;
    });

    const optimisticAuditEntry: AuditEntry = {
      id: `opt-${Date.now()}`,
      periodo: periodo.length === 7 ? `${periodo}-01` : periodo,
      moneda: curKey.toUpperCase(),
      valor_anterior: oldValue,
      valor_nuevo: newValue,
      usuario_email: userEmail,
      created_at: new Date().toISOString()
    };

    setRates(updatedRates);
    updateLiveRateMap(updatedRates);
    setAuditLog([optimisticAuditEntry, ...auditLog]);
    setSaving(true);

    try {
      // 3. Enviar al backend Next.js API route
      const res = await fetch('/api/tipo-de-cambio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo,
          currency: curKey,
          newValue,
          userEmail,
          userRole: role || (isPropietario ? 'propietario' : isDirectivo ? 'directivo' : 'administracion')
        })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        // Rollback en caso de error
        setRates(prevRates);
        updateLiveRateMap(prevRates);
        setAuditLog(prevAudit);
        return { success: false, error: json.error || 'Error al guardar el tipo de cambio.' };
      }

      // Re-sincronizar auditoría confirmada
      fetchRates();
      return { success: true };
    } catch (e: any) {
      // Rollback
      setRates(prevRates);
      updateLiveRateMap(prevRates);
      setAuditLog(prevAudit);
      return { success: false, error: e.message || 'Error de red al actualizar.' };
    } finally {
      setSaving(false);
    }
  };

  const value = {
    rates,
    auditLog,
    loading,
    saving,
    lastSync,
    canEdit,
    convertCurrency,
    getRateToUSD,
    updateRate,
    refreshRates: fetchRates
  };

  return (
    <ExchangeRateContext.Provider value={value}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRates() {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    throw new Error("useExchangeRates must be used within an ExchangeRateProvider");
  }
  return context;
}

