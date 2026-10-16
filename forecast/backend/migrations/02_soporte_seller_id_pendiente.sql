-- ==============================================================================
-- MIGRACIÓN 02: GESTIÓN DE SELLERS CON ID OFICIAL PENDIENTE / VACÍO
-- ==============================================================================
-- Objetivo:
-- 1. Permitir que los sellers nuevos o multicanal tengan su seller_id_oficial
--    literalmente VACÍO (NULL) hasta que el usuario lo complete.
-- 2. Habilitar ON UPDATE CASCADE en todas las Foreign Keys de tablas hijas
--    (dim_escalas, facturacion, metricas, ordenes, ventas), para que cuando el
--    usuario o el sistema actualice el id_seller en dim_sellers, se actualice
--    automáticamente en todo el sistema sin errores de Foreign Key.
-- 3. Actualizar la vista v_sellers_completos para exponer el estado del ID.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. AGREGAR COLUMNA SELLER_ID_OFICIAL A DIM_SELLERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.dim_sellers 
    ADD COLUMN IF NOT EXISTS seller_id_oficial BIGINT;

-- Poblar seller_id_oficial sólo para las cuentas que tienen ID oficial verificado
-- (Cuentas históricas de Mercado Libre con IDs reales)
UPDATE public.dim_sellers 
SET seller_id_oficial = id_seller 
WHERE id_seller < 900000000 OR id_seller >= 1000000000;

-- Para las cuentas con ID sintético/provisorio (rango 900M), dejamos seller_id_oficial en NULL (vacío)
UPDATE public.dim_sellers 
SET seller_id_oficial = NULL 
WHERE id_seller >= 900000000 AND id_seller < 1000000000;


-- ------------------------------------------------------------------------------
-- 2. HABILITAR ON UPDATE CASCADE EN TABLAS HIJAS
-- ------------------------------------------------------------------------------
-- dim_escalas
ALTER TABLE public.dim_escalas 
    DROP CONSTRAINT IF EXISTS fk_escalas_seller;
ALTER TABLE public.dim_escalas 
    ADD CONSTRAINT fk_escalas_seller 
    FOREIGN KEY (seller_id) REFERENCES public.dim_sellers(id_seller) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- facturacion
ALTER TABLE public.facturacion 
    DROP CONSTRAINT IF EXISTS facturacion_seller_id_fkey;
ALTER TABLE public.facturacion 
    ADD CONSTRAINT facturacion_seller_id_fkey 
    FOREIGN KEY (seller_id) REFERENCES public.dim_sellers(id_seller) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- fact_metricas_operativas
ALTER TABLE public.fact_metricas_operativas 
    DROP CONSTRAINT IF EXISTS fact_metricas_operativas_seller_id_fkey;
ALTER TABLE public.fact_metricas_operativas 
    ADD CONSTRAINT fact_metricas_operativas_seller_id_fkey 
    FOREIGN KEY (seller_id) REFERENCES public.dim_sellers(id_seller) 
    ON UPDATE CASCADE ON DELETE CASCADE;

-- ordenes (si existe la FK)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ordenes_seller_id_fkey'
    ) THEN
        ALTER TABLE public.ordenes DROP CONSTRAINT ordenes_seller_id_fkey;
        ALTER TABLE public.ordenes ADD CONSTRAINT ordenes_seller_id_fkey 
            FOREIGN KEY (seller_id) REFERENCES public.dim_sellers(id_seller) 
            ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- ventas_diarias (si existe la FK)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_diarias_seller_id_fkey'
    ) THEN
        ALTER TABLE public.ventas_diarias DROP CONSTRAINT ventas_diarias_seller_id_fkey;
        ALTER TABLE public.ventas_diarias ADD CONSTRAINT ventas_diarias_seller_id_fkey 
            FOREIGN KEY (seller_id) REFERENCES public.dim_sellers(id_seller) 
            ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. ACTUALIZAR VISTA ANALÍTICA V_SELLERS_COMPLETOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sellers_completos AS
SELECT 
    s.id_seller,
    s.seller_id_oficial,
    (s.seller_id_oficial IS NULL) AS id_pendiente,
    s.nombre_seller,
    s.estado,
    s.moneda,
    s.cobrar_botmaker,
    s.frecuencia_actualizacion,
    s.marca,
    s.canal_subtipo,
    -- Cliente Holding
    c.id_cliente,
    COALESCE(c.nombre_cliente, s.nombre_seller) AS nombre_holding,
    c.rubro,
    -- País
    COALESCE(p.codigo_pais, s.pais, 'AR') AS codigo_pais,
    COALESCE(p.nombre_pais, 'Argentina') AS nombre_pais,
    COALESCE(p.simbolo_moneda, '$') AS simbolo_moneda,
    COALESCE(p.bandera_emoji, '🇦🇷') AS bandera_emoji,
    -- Plataforma
    COALESCE(plt.codigo_plataforma, s.codigo_plataforma, 'MELI') AS codigo_plataforma,
    COALESCE(plt.nombre_plataforma, 'Mercado Libre') AS nombre_plataforma,
    COALESCE(plt.tipo_canal, 'MARKETPLACE') AS tipo_canal
FROM public.dim_sellers s
LEFT JOIN public.dim_clientes c ON s.id_cliente = c.id_cliente
LEFT JOIN public.dim_paises p ON COALESCE(s.codigo_pais, s.pais) = p.codigo_pais
LEFT JOIN public.dim_plataformas plt ON s.codigo_plataforma = plt.codigo_plataforma;

COMMIT;
