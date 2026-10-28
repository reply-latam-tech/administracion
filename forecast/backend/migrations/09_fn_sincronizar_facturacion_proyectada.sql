-- ==============================================================================
-- MIGRACIÓN 09: FUNCIÓN DE SINCRONIZACIÓN AUTOMÁTICA DE FACTURACIÓN PROYECTADA
-- ==============================================================================
-- Sincroniza el valor mensual proyectado en public.facturacion con el valor
-- calculado más reciente en public.seguimiento_diario_proyecciones para el mes corriente.
-- Se invoca al finalizar el cron diario de ingesta de órdenes de Mercado Libre.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sincronizar_facturacion_proyectada()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inicio_mes DATE;
    v_actualizados INT := 0;
    v_res jsonb;
BEGIN
    -- Determinar el primer día del mes actual según huso horario de Argentina (ART = UTC-3)
    v_inicio_mes := DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires'))::DATE;

    -- Actualizar registros en facturacion que estén en estado 'PROYECTADO'
    -- tomando la proyección fin de mes más reciente de seguimiento_diario_proyecciones
    WITH latest_proy AS (
        SELECT DISTINCT ON (seller_id)
            seller_id,
            proyeccion_fin_mes,
            fecha
        FROM public.seguimiento_diario_proyecciones
        WHERE fecha >= v_inicio_mes
        ORDER BY seller_id, fecha DESC
    ),
    prev_fact AS (
        SELECT 
            seller_id,
            valor_facturado
        FROM public.facturacion
        WHERE periodo = (v_inicio_mes - INTERVAL '1 month')::DATE
    ),
    updated AS (
        UPDATE public.facturacion f
        SET 
            valor_facturado = ROUND(lp.proyeccion_fin_mes::numeric, 2),
            variacion_mensual = CASE 
                WHEN pf.valor_facturado IS NOT NULL AND pf.valor_facturado > 0 
                THEN ROUND(((lp.proyeccion_fin_mes - pf.valor_facturado) / pf.valor_facturado)::numeric, 4)
                ELSE f.variacion_mensual
            END
        FROM latest_proy lp
        LEFT JOIN prev_fact pf ON pf.seller_id = lp.seller_id
        WHERE f.seller_id = lp.seller_id 
          AND f.periodo = v_inicio_mes
          AND f.estado = 'PROYECTADO'
        RETURNING f.seller_id, f.valor_facturado, f.variacion_mensual
    )
    SELECT COUNT(*), jsonb_agg(jsonb_build_object(
        'seller_id', seller_id,
        'nuevo_valor', valor_facturado,
        'variacion_mensual', variacion_mensual
    ))
    INTO v_actualizados, v_res
    FROM updated;

    RETURN jsonb_build_object(
        'periodo', v_inicio_mes,
        'filas_actualizadas', COALESCE(v_actualizados, 0),
        'detalle', COALESCE(v_res, '[]'::jsonb),
        'timestamp', NOW()
    );
END;
$$;

-- Otorgar permisos de ejecución al rol de servicio y usuarios autenticados
GRANT EXECUTE ON FUNCTION public.sincronizar_facturacion_proyectada() TO authenticated, service_role;
