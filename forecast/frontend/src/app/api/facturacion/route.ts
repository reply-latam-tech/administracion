import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export interface GmvAuditEntry {
  id: string | number;
  seller_id: number | string;
  periodo: string;
  valor_anterior: number | null;
  valor_nuevo: number;
  moneda?: string;
  usuario_email: string;
  created_at: string;
}

// GET: Consultar auditoría de modificaciones de GMV
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('fact_metricas_operativas')
      .select('*')
      .eq('tipo_metrica', 'GMV_AUDIT')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('Error leyendo auditoría GMV:', error);
      return NextResponse.json({ success: true, auditLog: [] });
    }

    const auditLog: GmvAuditEntry[] = (data || []).map((row: any) => {
      let parsed: any = {};
      try {
        parsed = typeof row.notas === 'string' ? JSON.parse(row.notas) : (row.notas || {});
      } catch {}

      return {
        id: row.id,
        seller_id: row.seller_id,
        periodo: row.periodo,
        valor_anterior: parsed.valor_anterior !== undefined ? parsed.valor_anterior : null,
        valor_nuevo: Number(row.cantidad),
        moneda: row.unidad || parsed.moneda,
        usuario_email: parsed.usuario_email || parsed.user || 'usuario@replylatam.com',
        created_at: row.created_at
      };
    });

    return NextResponse.json({ success: true, auditLog });
  } catch (error: any) {
    console.error('Error GET /api/facturacion:', error);
    return NextResponse.json({ success: false, error: error.message, auditLog: [] }, { status: 500 });
  }
}

// POST: Modificar proyección de ventas con validación RBAC y auditoría
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seller_id, periodo, nuevo_valor, nuevo_estado, usuario_email, userRole } = body;

    // 1. Validaciones básicas
    if (!seller_id || !periodo || nuevo_valor === undefined || nuevo_valor === null) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (seller_id, periodo, nuevo_valor).' }, { status: 400 });
    }

    const numericVal = parseFloat(nuevo_valor);
    if (isNaN(numericVal) || numericVal < 0) {
      return NextResponse.json({ error: 'El valor de ventas debe ser un número mayor o igual a 0.' }, { status: 400 });
    }

    // 2. Control de Acceso Basado en Roles (RBAC)
    const emailLower = (usuario_email || '').trim().toLowerCase();
    const isOwner = emailLower === 'matias.molesini@replylatam.com';
    const isReplyDomain = emailLower.endsWith('@replylatam.com');
    const role = (userRole || '').trim().toLowerCase();

    const hasPermission = isOwner || (isReplyDomain && ['propietario', 'directivo', 'administracion'].includes(role));

    if (!hasPermission) {
      return NextResponse.json({ 
        error: 'Permiso denegado: solo usuarios con nivel de Administración, Directivo o Propietario pueden modificar proyecciones de venta.' 
      }, { status: 403 });
    }

    const normalizedPeriod = periodo.length === 7 ? `${periodo}-01` : periodo;
    const nowIso = new Date().toISOString();
    const sid = typeof seller_id === 'number' ? seller_id : parseInt(String(seller_id), 10);
    const targetEstado = (nuevo_estado === 'REAL' || nuevo_estado === 'real') ? 'REAL' : 'PROYECTADO';

    // 3. Buscar valor y estado anterior en public.facturacion
    let previousVal: number | null = null;
    let previousEstado: string = 'PROYECTADO';
    let existingRowId: number | null = null;

    try {
      const { data: existing } = await supabaseAdmin
        .from('facturacion')
        .select('id, valor_facturado, estado')
        .eq('seller_id', sid)
        .eq('periodo', normalizedPeriod)
        .maybeSingle();

      if (existing) {
        existingRowId = existing.id;
        previousVal = existing.valor_facturado !== null ? Number(existing.valor_facturado) : null;
        previousEstado = existing.estado || 'PROYECTADO';
      }
    } catch (e) {
      console.warn('Error buscando valor anterior en facturacion:', e);
    }

    // 4. Actualizar o insertar en public.facturacion
    if (existingRowId) {
      const { error: updErr } = await supabaseAdmin
        .from('facturacion')
        .update({
          valor_facturado: numericVal,
          estado: targetEstado
        })
        .eq('id', existingRowId);

      if (updErr) {
        console.error('Error actualizando facturacion:', updErr);
        return NextResponse.json({ error: 'Error al actualizar registro en base de datos: ' + updErr.message }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('facturacion')
        .insert([{
          seller_id: sid,
          periodo: normalizedPeriod,
          valor_facturado: numericVal,
          estado: targetEstado,
          variacion_mensual: 0
        }]);

      if (insErr) {
        console.error('Error insertando facturacion:', insErr);
        return NextResponse.json({ error: 'Error al crear registro de facturacion: ' + insErr.message }, { status: 500 });
      }
    }

    // 5. Registrar auditoría inmutable en fact_metricas_operativas
    try {
      await supabaseAdmin
        .from('fact_metricas_operativas')
        .insert([{
          seller_id: sid,
          periodo: normalizedPeriod,
          tipo_metrica: 'GMV_AUDIT',
          cantidad: numericVal,
          notas: JSON.stringify({
            usuario_email: emailLower,
            valor_anterior: previousVal,
            valor_nuevo: numericVal,
            estado_anterior: previousEstado,
            estado_nuevo: targetEstado,
            timestamp: nowIso
          })
        }]);
    } catch (auditErr) {
      console.warn('Error registrando auditoría GMV:', auditErr);
    }

    return NextResponse.json({
      success: true,
      updated: {
        seller_id: sid,
        periodo: normalizedPeriod,
        valor_anterior: previousVal,
        valor_nuevo: numericVal,
        usuario_email: emailLower,
        created_at: nowIso
      }
    });
  } catch (error: any) {
    console.error('Error POST /api/facturacion:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor al modificar proyección de venta' }, { status: 500 });
  }
}

