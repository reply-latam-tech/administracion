-- ==============================================================================
-- MIGRACIÓN 08: TABLA DE SNAPSHOTS MENSUALES DE PROYECCIONES FUTURAS
-- ==============================================================================
-- Permite congelar periódicamente (mes a mes) una foto histórica del forecast 
-- a 12 meses vista, habilitando el análisis longitudinal de variaciones y desvíos.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fact_snapshots_proyecciones (
    id BIGSERIAL PRIMARY KEY,
    fecha_corte DATE NOT NULL,                          -- Primer día del mes de corte (ej. '2026-10-01')
    seller_id BIGINT NOT NULL REFERENCES public.dim_sellers(id_seller) ON DELETE CASCADE,
    periodo_proyectado DATE NOT NULL,                   -- Mes futuro proyectado (ej. '2026-11-01')
    valor_proyectado NUMERIC(16, 2) NOT NULL,
    moneda VARCHAR(5) DEFAULT 'ARS',
    observacion VARCHAR(150) DEFAULT 'SNAPSHOT_MENSUAL_OFICIAL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_snapshot_seller_periodo UNIQUE(fecha_corte, seller_id, periodo_proyectado)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_fecha_corte ON public.fact_snapshots_proyecciones(fecha_corte);
CREATE INDEX IF NOT EXISTS idx_snapshots_seller_id ON public.fact_snapshots_proyecciones(seller_id);

-- RLS
ALTER TABLE public.fact_snapshots_proyecciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticados snapshots" ON public.fact_snapshots_proyecciones;
CREATE POLICY "Lectura autenticados snapshots"
    ON public.fact_snapshots_proyecciones FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Modificacion snapshots propietario" ON public.fact_snapshots_proyecciones;
CREATE POLICY "Modificacion snapshots propietario"
    ON public.fact_snapshots_proyecciones FOR ALL
    TO authenticated, service_role
    USING (
        auth.jwt()->>'email' = 'matias.molesini@replylatam.com'
        OR auth.jwt()->'app_metadata'->>'role' = 'propietario'
    )
    WITH CHECK (
        auth.jwt()->>'email' = 'matias.molesini@replylatam.com'
        OR auth.jwt()->'app_metadata'->>'role' = 'propietario'
    );

COMMIT;
