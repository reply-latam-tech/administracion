import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export interface AuditEntry {
  id: string | number;
  periodo: string;
  moneda: string;
  valor_anterior: number | null;
  valor_nuevo: number;
  usuario_email: string;
  created_at: string;
}

export interface TipoCambioRow {
  periodo: string;
  ars: number | null;
  mxn: number | null;
  pen: number | null;
  clp: number | null;
  cop: number | null;
  moneda_base: string;
  estado: 'REAL' | 'PROYECTADO';
  updated_by?: string;
  updated_at?: string;
}

// 45 Períodos Base Oficiales (2024-01 a 2027-09)
const BASE_RATES: TipoCambioRow[] = [
  // 2024 Reales
  { periodo: '2024-01-01', ars: null,    mxn: 17.16, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-02-01', ars: null,    mxn: 17.06, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-03-01', ars: null,    mxn: 16.67, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-04-01', ars: null,    mxn: 16.93, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-05-01', ars: null,    mxn: 17.63, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-06-01', ars: null,    mxn: 17.96, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-07-01', ars: null,    mxn: 19.04, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-08-01', ars: null,    mxn: 19.80, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-09-01', ars: null,    mxn: 19.67, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-10-01', ars: null,    mxn: 20.16, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-11-01', ars: null,    mxn: 20.42, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2024-12-01', ars: null,    mxn: 20.27, pen: null, clp: null,   cop: null,    moneda_base: 'USD', estado: 'REAL' },
  // 2025 Reales
  { periodo: '2025-01-01', ars: 1032.00, mxn: 19.50, pen: 3.75, clp: 996.46, cop: 3950.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-02-01', ars: 1046.00, mxn: 19.60, pen: 3.76, clp: 956.90, cop: 3970.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-03-01', ars: 1060.00, mxn: 19.70, pen: 3.77, clp: 946.59, cop: 3990.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-04-01', ars: 1197.74, mxn: 19.61, pen: 3.70, clp: 940.18, cop: 4305.02, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-05-01', ars: 1150.00, mxn: 19.23, pen: 3.66, clp: 935.00, cop: 4107.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-06-01', ars: 1215.00, mxn: 18.83, pen: 3.62, clp: 926.62, cop: 3974.37, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-07-01', ars: 1330.00, mxn: 18.80, pen: 3.56, clp: 964.28, cop: 4097.38, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-08-01', ars: 1330.00, mxn: 18.65, pen: 3.54, clp: 965.28, cop: 4016.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-09-01', ars: 1450.00, mxn: 18.35, pen: 3.50, clp: 959.19, cop: 3897.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-10-01', ars: 1480.00, mxn: 18.54, pen: 3.43, clp: 940.53, cop: 3885.00,    moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-11-01', ars: 1420.00, mxn: 18.35, pen: 3.37, clp: 928.00, cop: 3784.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2025-12-01', ars: 1450.00, mxn: 18.00, pen: 3.37, clp: 911.18, cop: 3790.77, moneda_base: 'USD', estado: 'REAL' },
  // 2026 Reales
  { periodo: '2026-01-01', ars: 1430.00, mxn: 17.29, pen: 3.36, clp: 860.00, cop: 3622.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-02-01', ars: 1395.00, mxn: 17.22, pen: 3.36, clp: 884.21, cop: 3769.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-03-01', ars: 1405.00, mxn: 18.00, pen: 3.44, clp: 927.46, cop: 3660.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-04-01', ars: 1420.00, mxn: 17.47, pen: 3.51, clp: 903.05, cop: 3660.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-05-01', ars: 1427.00, mxn: 17.29, pen: 3.39, clp: 892.91, cop: 3562.00, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-06-01', ars: 1490.00, mxn: 17.51, pen: 3.39, clp: 922.21, cop: 3440.83, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-07-01', ars: 1525.00, mxn: 17.46, pen: 3.41, clp: 941.93, cop: 3205.80, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-08-01', ars: 1530.00, mxn: 16.97, pen: 3.40, clp: 929.18, cop: 3213.97, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-09-01', ars: 1565.00, mxn: 18.07, pen: 3.36, clp: 972.60, cop: 3312.84, moneda_base: 'USD', estado: 'REAL' },
  { periodo: '2026-10-01', ars: 1550.00, mxn: 18.81, pen: 3.43, clp: 981.58, cop: 3182.99, moneda_base: 'USD', estado: 'REAL' },
  // 2026 - 2027 Proyectados
  { periodo: '2026-11-01', ars: 1615.00, mxn: 18.18, pen: 3.37, clp: 978.00, cop: 3340.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2026-12-01', ars: 1645.00, mxn: 18.25, pen: 3.37, clp: 982.00, cop: 3360.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-01-01', ars: 1670.00, mxn: 18.32, pen: 3.38, clp: 985.00, cop: 3375.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-02-01', ars: 1695.00, mxn: 18.38, pen: 3.38, clp: 989.00, cop: 3390.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-03-01', ars: 1720.00, mxn: 18.45, pen: 3.39, clp: 993.00, cop: 3410.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-04-01', ars: 1745.00, mxn: 18.52, pen: 3.39, clp: 998.00, cop: 3425.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-05-01', ars: 1770.00, mxn: 18.60, pen: 3.40, clp: 1002.00, cop: 3440.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-06-01', ars: 1795.00, mxn: 18.68, pen: 3.40, clp: 1006.00, cop: 3455.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-07-01', ars: 1820.00, mxn: 18.75, pen: 3.41, clp: 1010.00, cop: 3470.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-08-01', ars: 1845.00, mxn: 18.82, pen: 3.41, clp: 1014.00, cop: 3485.00, moneda_base: 'USD', estado: 'PROYECTADO' },
  { periodo: '2027-09-01', ars: 1870.00, mxn: 18.90, pen: 3.42, clp: 1018.00, cop: 3500.00, moneda_base: 'USD', estado: 'PROYECTADO' },
];

export async function GET() {
  try {
    let liveRows: TipoCambioRow[] = BASE_RATES.map(r => ({ ...r }));
    let isFromDedicatedTable = false;
    let auditList: AuditEntry[] = [];

    // 1. Intentar consultar tabla dedicada tipo_de_cambio
    try {
      const { data: dbData, error: dbErr } = await supabaseAdmin
        .from('tipo_de_cambio')
        .select('*')
        .order('periodo', { ascending: true });

      if (!dbErr && dbData && dbData.length > 0) {
        isFromDedicatedTable = true;
        // Mapear filas de la tabla dedicada
        const dbMap = new Map<string, any>();
        dbData.forEach(d => dbMap.set(d.periodo.substring(0, 7), d));

        liveRows = liveRows.map(baseRow => {
          const pKey = baseRow.periodo.substring(0, 7);
          const found = dbMap.get(pKey);
          if (found) {
            return {
              ...baseRow,
              ars: found.ars !== null ? Number(found.ars) : baseRow.ars,
              mxn: found.mxn !== null ? Number(found.mxn) : baseRow.mxn,
              pen: found.pen !== null ? Number(found.pen) : baseRow.pen,
              clp: found.clp !== null ? Number(found.clp) : baseRow.clp,
              cop: found.cop !== null ? Number(found.cop) : baseRow.cop,
              estado: found.estado || baseRow.estado,
              updated_by: found.updated_by || baseRow.updated_by,
              updated_at: found.updated_at || baseRow.updated_at
            };
          }
          return baseRow;
        });
      }
    } catch (e) {
      // Ignorar si no existe la tabla
    }

    // 2. Consultar overrides persistidos en fact_metricas_operativas
    try {
      const { data: overrides } = await supabaseAdmin
        .from('fact_metricas_operativas')
        .select('*')
        .like('tipo_metrica', 'TC_%');

      if (overrides && overrides.length > 0) {
        overrides.forEach((ov: any) => {
          if (ov.tipo_metrica === 'TC_AUDIT') return; // Auditoría se procesa aparte
          const pKey = (ov.periodo || '').substring(0, 7);
          const currKey = ov.tipo_metrica.replace('TC_', '').toLowerCase();
          const targetRow = liveRows.find(r => r.periodo.startsWith(pKey));
          if (targetRow && ['ars', 'mxn', 'pen', 'clp', 'cop'].includes(currKey)) {
            (targetRow as any)[currKey] = Number(ov.cantidad);
            let meta: any = {};
            try {
              meta = typeof ov.notas === 'string' ? JSON.parse(ov.notas) : (ov.notas || {});
            } catch {}
            if (meta.updated_by) targetRow.updated_by = meta.updated_by;
            if (meta.updated_at || ov.created_at) targetRow.updated_at = meta.updated_at || ov.created_at;
          }
        });
      }
    } catch (e) {
      console.warn('Error leyendo overrides de fact_metricas_operativas:', e);
    }

    // 3. Obtener Historial de Auditoría
    // 3.A Intentar tabla auditoria_tipo_cambio
    try {
      const { data: dbAudit, error: auditErr } = await supabaseAdmin
        .from('auditoria_tipo_cambio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!auditErr && dbAudit && dbAudit.length > 0) {
        auditList = dbAudit.map((a: any) => ({
          id: a.id,
          periodo: a.periodo,
          moneda: a.moneda,
          valor_anterior: a.valor_anterior !== null ? Number(a.valor_anterior) : null,
          valor_nuevo: Number(a.valor_nuevo),
          usuario_email: a.usuario_email,
          created_at: a.created_at
        }));
      }
    } catch {}

    // 3.B Consultar logs de auditoría en fact_metricas_operativas (fallback o complementario)
    try {
      const { data: metaAudits } = await supabaseAdmin
        .from('fact_metricas_operativas')
        .select('*')
        .eq('tipo_metrica', 'TC_AUDIT')
        .order('created_at', { ascending: false })
        .limit(100);

      if (metaAudits && metaAudits.length > 0) {
        metaAudits.forEach((ma: any) => {
          let parsed: any = {};
          try {
            parsed = typeof ma.notas === 'string' ? JSON.parse(ma.notas) : (ma.notas || {});
          } catch {}

          const exists = auditList.some(a => 
            a.periodo === ma.periodo && 
            a.moneda === (ma.unidad || parsed.moneda) && 
            Math.abs(new Date(a.created_at).getTime() - new Date(ma.created_at).getTime()) < 2000
          );

          if (!exists) {
            auditList.push({
              id: ma.id,
              periodo: ma.periodo,
              moneda: ma.unidad || parsed.moneda || 'ARS',
              valor_anterior: parsed.valor_anterior !== undefined ? parsed.valor_anterior : null,
              valor_nuevo: Number(ma.cantidad),
              usuario_email: parsed.usuario_email || parsed.user || 'usuario@replylatam.com',
              created_at: ma.created_at
            });
          }
        });
      }
    } catch {}

    // Ordenar auditoría cronológicamente descendente
    auditList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      rates: liveRows,
      auditLog: auditList,
      source: isFromDedicatedTable ? 'tipo_de_cambio' : 'metricas_operativas'
    });
  } catch (error: any) {
    console.error('Error GET /api/tipo-de-cambio:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error consultando tipos de cambio',
      rates: BASE_RATES,
      auditLog: []
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { periodo, currency, newValue, userEmail, userRole } = body;

    // 1. Validaciones de Entrada
    if (!periodo || !currency || newValue === undefined || newValue === null) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (periodo, currency, newValue).' }, { status: 400 });
    }

    const curKey = String(currency).trim().toLowerCase();
    if (!['ars', 'mxn', 'pen', 'clp', 'cop'].includes(curKey)) {
      return NextResponse.json({ error: `Moneda '${currency}' no válida. Debe ser ARS, MXN, PEN, CLP o COP.` }, { status: 400 });
    }

    const numericVal = parseFloat(newValue);
    if (isNaN(numericVal) || numericVal <= 0) {
      return NextResponse.json({ error: 'El tipo de cambio debe ser un número positivo válido.' }, { status: 400 });
    }

    // 2. Control de Acceso Basado en Roles (RBAC)
    const emailLower = (userEmail || '').trim().toLowerCase();
    const isOwner = emailLower === 'matias.molesini@replylatam.com';
    const isReplyDomain = emailLower.endsWith('@replylatam.com');
    const role = (userRole || '').trim().toLowerCase();

    const hasPermission = isOwner || (isReplyDomain && ['propietario', 'directivo', 'administracion'].includes(role));

    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Permiso denegado: solo usuarios con nivel de Administración, Directivo o Propietario pueden modificar los tipos de cambio.' 
      }, { status: 403 });
    }

    const normalizedPeriod = periodo.length === 7 ? `${periodo}-01` : periodo;
    const nowIso = new Date().toISOString();

    // 3. Determinar valor anterior para trazabilidad de auditoría
    let previousValue: number | null = null;
    const baseMatch = BASE_RATES.find(r => r.periodo.startsWith(normalizedPeriod.substring(0, 7)));
    if (baseMatch) {
      previousValue = (baseMatch as any)[curKey] || null;
    }

    // Consultar si ya había un override en fact_metricas_operativas
    try {
      const { data: existingMetrica } = await supabaseAdmin
        .from('fact_metricas_operativas')
        .select('cantidad')
        .eq('tipo_metrica', `TC_${curKey.toUpperCase()}`)
        .eq('periodo', normalizedPeriod)
        .maybeSingle();

      if (existingMetrica?.cantidad) {
        previousValue = Number(existingMetrica.cantidad);
      }
    } catch {}

    // 4. Intentar actualización en tabla dedicada public.tipo_de_cambio
    let savedInDedicated = false;
    try {
      const isProjected = normalizedPeriod >= '2026-11-01';
      const upsertObj: any = {
        periodo: normalizedPeriod,
        [curKey]: numericVal,
        moneda_base: 'USD',
        estado: isProjected ? 'PROYECTADO' : 'REAL',
        updated_by: emailLower,
        updated_at: nowIso
      };

      const { error: tcErr } = await supabaseAdmin
        .from('tipo_de_cambio')
        .upsert(upsertObj, { onConflict: 'periodo' });

      if (!tcErr) {
        savedInDedicated = true;
      }

      // Insertar en auditoria_tipo_cambio
      await supabaseAdmin
        .from('auditoria_tipo_cambio')
        .insert([{
          periodo: normalizedPeriod,
          moneda: curKey.toUpperCase(),
          valor_anterior: previousValue,
          valor_nuevo: numericVal,
          usuario_email: emailLower,
          created_at: nowIso
        }]);
    } catch (e) {
      // Ignorar si no existe la tabla
    }

    // 5. Persistencia robusta en fact_metricas_operativas (garantía de persistencia y Realtime)
    try {
      const metricType = `TC_${curKey.toUpperCase()}`;
      
      // Eliminar registro previo de esa métrica y período para evitar duplicados
      await supabaseAdmin
        .from('fact_metricas_operativas')
        .delete()
        .eq('tipo_metrica', metricType)
        .eq('periodo', normalizedPeriod);

      // Insertar nuevo valor
      await supabaseAdmin
        .from('fact_metricas_operativas')
        .insert([{
          periodo: normalizedPeriod,
          tipo_metrica: metricType,
          cantidad: numericVal,
          unidad: `${curKey.toUpperCase()}/USD`,
          notas: JSON.stringify({
            updated_by: emailLower,
            updated_at: nowIso,
            valor_anterior: previousValue,
            valor_nuevo: numericVal
          })
        }]);

      // Insertar log de auditoría inmutable
      await supabaseAdmin
        .from('fact_metricas_operativas')
        .insert([{
          periodo: normalizedPeriod,
          tipo_metrica: 'TC_AUDIT',
          cantidad: numericVal,
          unidad: curKey.toUpperCase(),
          notas: JSON.stringify({
            usuario_email: emailLower,
            valor_anterior: previousValue,
            valor_nuevo: numericVal,
            moneda: curKey.toUpperCase(),
            timestamp: nowIso
          })
        }]);
    } catch (e: any) {
      console.error('Error persistiendo en fact_metricas_operativas:', e);
      if (!savedInDedicated) {
        return NextResponse.json({ error: 'No se pudo guardar la modificación en la base de datos.' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      updated: {
        periodo: normalizedPeriod,
        currency: curKey,
        valor_anterior: previousValue,
        valor_nuevo: numericVal,
        usuario_email: emailLower,
        created_at: nowIso
      }
    });
  } catch (error: any) {
    console.error('Error POST /api/tipo-de-cambio:', error);
    return NextResponse.json({ error: error.message || 'Error interno al actualizar tipo de cambio' }, { status: 500 });
  }
}

