-- ==============================================================================
-- MIGRACIÓN 01: ARQUITECTURA MULTICANAL & REGIONAL PARA REPLY LATAM
-- ==============================================================================
-- Este script evoluciona el modelo plano de Mercado Libre Argentina hacia un
-- modelo multidimensional jerárquico: Cliente (Holding) -> Cuenta/Canal -> Facturación.
-- Diseñado para ser 100% RETROCOMPATIBLE con el frontend existente.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLA MAESTRA: DIM_PAISES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_paises (
    codigo_pais VARCHAR(5) PRIMARY KEY, -- AR, CL, MX, CO, US
    nombre_pais VARCHAR(50) NOT NULL,
    moneda_local VARCHAR(5) NOT NULL,   -- ARS, CLP, MXN, COP, USD
    simbolo_moneda VARCHAR(5) NOT NULL DEFAULT '$',
    bandera_emoji VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poblar países de la región Reply
INSERT INTO public.dim_paises (codigo_pais, nombre_pais, moneda_local, simbolo_moneda, bandera_emoji)
VALUES
    ('AR', 'Argentina', 'ARS', '$', '🇦🇷'),
    ('CL', 'Chile', 'CLP', '$', '🇨🇱'),
    ('MX', 'México', 'MXN', '$', '🇲🇽'),
    ('CO', 'Colombia', 'COP', '$', '🇨🇴'),
    ('US', 'Estados Unidos', 'USD', 'US$', '🇺🇸')
ON CONFLICT (codigo_pais) DO UPDATE 
SET nombre_pais = EXCLUDED.nombre_pais,
    moneda_local = EXCLUDED.moneda_local,
    simbolo_moneda = EXCLUDED.simbolo_moneda,
    bandera_emoji = EXCLUDED.bandera_emoji;


-- ------------------------------------------------------------------------------
-- 2. TABLA MAESTRA: DIM_PLATAFORMAS (Canales de Venta / Marketplaces)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_plataformas (
    codigo_plataforma VARCHAR(30) PRIMARY KEY, -- MELI, LVP, FALABELLA, AMAZON, etc.
    nombre_plataforma VARCHAR(100) NOT NULL,
    tipo_canal VARCHAR(30) NOT NULL DEFAULT 'MARKETPLACE', -- MARKETPLACE, TIENDA_PROPIA, FINTECH
    sitio_web VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poblar plataformas detectadas en facturacion.txt
INSERT INTO public.dim_plataformas (codigo_plataforma, nombre_plataforma, tipo_canal)
VALUES
    ('MELI', 'Mercado Libre', 'MARKETPLACE'),
    ('LVP', 'Liverpool', 'MARKETPLACE'),
    ('FALABELLA', 'Falabella Marketplace', 'MARKETPLACE'),
    ('RIPLEY', 'Ripley Marketplace', 'MARKETPLACE'),
    ('WALMART', 'Walmart / Lider', 'MARKETPLACE'),
    ('PARIS', 'Paris (Cencosud)', 'MARKETPLACE'),
    ('KITCHENCENTER', 'Kitchen Center', 'MARKETPLACE'),
    ('AMAZON', 'Amazon', 'MARKETPLACE'),
    ('ADDI', 'ADDI BNPL / Marketplace', 'FINTECH'),
    ('WEB', 'Tienda Web Directa', 'TIENDA_PROPIA')
ON CONFLICT (codigo_plataforma) DO UPDATE 
SET nombre_plataforma = EXCLUDED.nombre_plataforma,
    tipo_canal = EXCLUDED.tipo_canal;


-- ------------------------------------------------------------------------------
-- 3. TABLA MAESTRA: DIM_CLIENTES (Holdings / Marcas Madre)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_clientes (
    id_cliente BIGSERIAL PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL UNIQUE,
    rubro VARCHAR(100),
    pais_origen VARCHAR(5) REFERENCES public.dim_paises(codigo_pais),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poblar clientes existentes + clientes nuevos regionales
INSERT INTO public.dim_clientes (nombre_cliente, rubro, pais_origen)
VALUES
    -- Clientes existentes en Argentina
    ('Nestle', 'Alimentos & Bebidas', 'AR'),
    ('Morixe', 'Alimentos', 'AR'),
    ('La Espumería', 'Hogar & Colchones', 'AR'),
    ('Café Martínez', 'Alimentos & Cafetería', 'AR'),
    ('Dapsa', 'Combustibles & Lubricantes', 'AR'),
    ('Juan Valdez', 'Café & Alimentos', 'CO'),
    ('Lifecycle', 'Salud & Bienestar', 'AR'),
    ('Pinturas Online', 'Construcción & Hogar', 'AR'),
    ('Taurus', 'Electrodomésticos & Bazar', 'AR'),
    ('Alma Nativa', 'Cosmética & Cuidado Personal', 'AR'),
    ('Violetta Cosméticos', 'Cosmética & Belleza', 'AR'),
    ('Abarka', 'Calzado & Moda', 'AR'),
    ('Geat', 'Indumentaria & Retail', 'AR'),
    -- Clientes Nuevos Multicanal / Regionales
    ('Newsan', 'Electrodomésticos & Tecnología', 'AR'),
    ('Soda Stream', 'Bebidas & Hogar', 'AR'),
    ('Jansport', 'Accesorios & Mochilas', 'AR'),
    ('Herschel', 'Accesorios & Moda', 'AR'),
    ('Grupo Axo', 'Moda & Retail Multimarca', 'MX'),
    ('Evacol', 'Calzado & Retail', 'CO'),
    ('Natura', 'Belleza & Cosmética', 'MX'),
    ('Trademedical', 'Equipamiento Médico', 'CL'),
    ('Disuiza', 'Retail & Distribución', 'CO'),
    ('Formex', 'Manufactura & Retail', 'CO')
ON CONFLICT (nombre_cliente) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 4. EVOLUCIÓN NO DESTRUCTIVA DE: DIM_SELLERS (Ahora Cuenta Operativa)
-- ------------------------------------------------------------------------------
-- Agregamos las relaciones jerárquicas como columnas opcionales
ALTER TABLE public.dim_sellers 
    ADD COLUMN IF NOT EXISTS id_cliente BIGINT REFERENCES public.dim_clientes(id_cliente),
    ADD COLUMN IF NOT EXISTS codigo_plataforma VARCHAR(30) REFERENCES public.dim_plataformas(codigo_plataforma) DEFAULT 'MELI',
    ADD COLUMN IF NOT EXISTS codigo_pais VARCHAR(5) REFERENCES public.dim_paises(codigo_pais),
    ADD COLUMN IF NOT EXISTS marca VARCHAR(100),
    ADD COLUMN IF NOT EXISTS canal_subtipo VARCHAR(50);

-- Actualizar los 13 sellers actuales para que apunten a sus nuevos clientes y plataforma MELI
UPDATE public.dim_sellers SET codigo_plataforma = 'MELI' WHERE codigo_plataforma IS NULL;
UPDATE public.dim_sellers SET codigo_pais = 'AR' WHERE codigo_pais IS NULL AND (pais = 'AR' OR pais = 'ARS' OR pais IS NULL);

-- Vincular cada seller existente con su id_cliente correspondiente
UPDATE public.dim_sellers s
SET id_cliente = c.id_cliente
FROM public.dim_clientes c
WHERE LOWER(TRIM(s.nombre_seller)) = LOWER(TRIM(c.nombre_cliente))
  AND s.id_cliente IS NULL;

-- Casos con tildes o variaciones de nombre:
UPDATE public.dim_sellers SET id_cliente = (SELECT id_cliente FROM public.dim_clientes WHERE nombre_cliente = 'Café Martínez')
WHERE nombre_seller ILIKE '%martinez%' AND id_cliente IS NULL;

UPDATE public.dim_sellers SET id_cliente = (SELECT id_cliente FROM public.dim_clientes WHERE nombre_cliente = 'La Espumería')
WHERE nombre_seller ILIKE '%espumer%' AND id_cliente IS NULL;

UPDATE public.dim_sellers SET id_cliente = (SELECT id_cliente FROM public.dim_clientes WHERE nombre_cliente = 'Violetta Cosméticos')
WHERE nombre_seller ILIKE '%violetta%' AND id_cliente IS NULL;


-- ------------------------------------------------------------------------------
-- 5. TABLA NUEVA: FACT_METRICAS_OPERATIVAS (Para unidades no monetarias)
-- ------------------------------------------------------------------------------
-- Absorbe Sesiones, Horas Extras y Créditos sin contaminar la facturación en dinero
CREATE TABLE IF NOT EXISTS public.fact_metricas_operativas (
    id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT REFERENCES public.dim_sellers(id_seller) ON DELETE CASCADE,
    id_cliente BIGINT REFERENCES public.dim_clientes(id_cliente) ON DELETE CASCADE,
    periodo DATE NOT NULL,
    tipo_metrica VARCHAR(50) NOT NULL, -- 'SESIONES', 'HORAS_EXTRAS', 'CREDITOS'
    cantidad NUMERIC(14, 2) NOT NULL,
    unidad VARCHAR(30) NOT NULL DEFAULT 'UNIDADES', -- 'UNIDADES', 'HORAS', 'CREDITOS'
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_metrica_seller_periodo UNIQUE (seller_id, periodo, tipo_metrica)
);

CREATE INDEX IF NOT EXISTS idx_metricas_seller_periodo ON public.fact_metricas_operativas (seller_id, periodo);
CREATE INDEX IF NOT EXISTS idx_metricas_cliente ON public.fact_metricas_operativas (id_cliente);


-- ------------------------------------------------------------------------------
-- 6. VISTA ANALÍTICA CONSOLIDADA: V_SELLERS_COMPLETOS
-- ------------------------------------------------------------------------------
-- Esta vista une las dimensiones para que el Frontend o Backend puedan consultar
-- datos enriquecidos (País, Bandera, Plataforma, Holding) con un simple SELECT
CREATE OR REPLACE VIEW public.v_sellers_completos AS
SELECT 
    s.id_seller,
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
