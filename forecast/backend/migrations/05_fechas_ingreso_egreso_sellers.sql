-- ==============================================================================
-- MIGRACIÓN 05: FECHAS DE INGRESO Y EGRESO PARA SELLERS Y CUENTAS
-- ==============================================================================
-- Objetivo:
-- 1. Registrar fecha de alta/ingreso y fecha de baja/egreso para cada cuenta/seller
--    (dim_sellers) y holding (dim_clientes), permitiendo trazabilidad de altas,
--    bajas y vigencia contractual.
-- 2. Registrar el caso de TRADEMEDICAL CHILE SPA (Ingreso: 01/08/2026, Egreso: 30/09/2026, Estado: Inactivo/Baja).
-- 3. Actualizar la vista analítica v_sellers_completos para exponer fecha_ingreso,
--    fecha_egreso y el estado_operativo ('ACTIVA', 'BAJA', 'PROXIMA', 'INACTIVA').
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. AGREGAR COLUMNAS FECHA_INGRESO Y FECHA_EGRESO A DIM_SELLERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.dim_sellers 
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
    ADD COLUMN IF NOT EXISTS fecha_egreso DATE;

-- ------------------------------------------------------------------------------
-- 2. AGREGAR COLUMNAS FECHA_INGRESO Y FECHA_EGRESO A DIM_CLIENTES (HOLDING)
-- ------------------------------------------------------------------------------
ALTER TABLE public.dim_clientes 
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
    ADD COLUMN IF NOT EXISTS fecha_egreso DATE;

-- ------------------------------------------------------------------------------
-- 3. POBLAR CASO TRADEMEDICAL CHILE SPA (Alta: 01/08/2026, Baja: 30/09/2026)
-- ------------------------------------------------------------------------------
UPDATE public.dim_sellers
SET 
    nombre_seller = 'Trademedical Chile SPA',
    fecha_ingreso = '2026-08-01',
    fecha_egreso = '2026-09-30',
    estado = FALSE
WHERE id_seller = 983474076 OR nombre_seller ILIKE '%trademedical%';

UPDATE public.dim_clientes
SET 
    nombre_cliente = 'Trademedical',
    fecha_ingreso = '2026-08-01',
    fecha_egreso = '2026-09-30',
    activo = FALSE
WHERE id_cliente = 21 OR nombre_cliente ILIKE '%trademedical%';

-- ------------------------------------------------------------------------------
-- 4. POBLAR FECHAS DE INGRESO ESTIMADAS/HISTÓRICAS PARA EL RESTO DE LAS CUENTAS
-- ------------------------------------------------------------------------------
-- Cuentas internacionales recientes con fecha de inicio conocida (según históricos):
-- Evacol México ML: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 807100133 AND fecha_ingreso IS NULL;
-- Natura Colombia: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 941943480 AND fecha_ingreso IS NULL;
-- Disuiza Colombia: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 964690754 AND fecha_ingreso IS NULL;
-- Evacol Colombia ML: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 928666257 AND fecha_ingreso IS NULL;
-- Evacol Colombia ADDI: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 928424062 AND fecha_ingreso IS NULL;
-- Formex Colombia: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 127711636 AND fecha_ingreso IS NULL;
-- Evacol Amazon USA: 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE id_seller = 918210724 AND fecha_ingreso IS NULL;
-- Cuentas de Newsan Chile (Walmart, Falabella, Paris, Ripley, ML, Kitchen Center): 01/01/2026
UPDATE public.dim_sellers SET fecha_ingreso = '2026-01-01' WHERE codigo_pais = 'CL' AND id_seller != 983474076 AND fecha_ingreso IS NULL;

-- Cuentas históricas de Argentina (activas desde el inicio del registro 2024):
UPDATE public.dim_sellers 
SET fecha_ingreso = '2024-01-01' 
WHERE fecha_ingreso IS NULL;

-- ------------------------------------------------------------------------------
-- 5. ACTUALIZAR VISTA ANALÍTICA V_SELLERS_COMPLETOS
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
    s.fecha_ingreso,
    s.fecha_egreso,
    CASE 
        WHEN s.fecha_egreso IS NOT NULL AND s.fecha_egreso <= CURRENT_DATE THEN 'BAJA'
        WHEN s.fecha_ingreso IS NOT NULL AND s.fecha_ingreso > CURRENT_DATE THEN 'PROXIMA'
        WHEN s.estado = FALSE THEN 'INACTIVA'
        ELSE 'ACTIVA'
    END AS estado_operativo,
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
