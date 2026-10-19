-- ==============================================================================
-- MIGRACIÓN 03: TABLA DE TIPOS DE CAMBIO PARA CUENTAS REGIONALES / EXTERIOR
-- ==============================================================================
-- Almacena la cotización oficial mensual de monedas locales (ARS, MXN, PEN, CLP, COP)
-- con respecto a USD (Moneda Base).
-- Incluye histórico REAL y 12 meses PROYECTADOS para proyecciones futuras.
-- Fuente: forecast/backend/scripts_borradores/tipo_de_cambio.txt
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. REGISTRAR PAÍS PERÚ EN DIM_PAISES (Si no existe)
-- ------------------------------------------------------------------------------
INSERT INTO public.dim_paises (codigo_pais, nombre_pais, moneda_local, simbolo_moneda, bandera_emoji)
VALUES ('PE', 'Perú', 'PEN', 'S/', '🇵🇪')
ON CONFLICT (codigo_pais) DO UPDATE 
SET nombre_pais = EXCLUDED.nombre_pais,
    moneda_local = EXCLUDED.moneda_local,
    simbolo_moneda = EXCLUDED.simbolo_moneda,
    bandera_emoji = EXCLUDED.bandera_emoji;

-- ------------------------------------------------------------------------------
-- 2. TABLA PRINCIPAL: TIPO_DE_CAMBIO (Formato Columnar Mensual)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipo_de_cambio (
    periodo DATE PRIMARY KEY,                   -- Primer día del mes (ej. '2025-01-01')
    ars NUMERIC(14, 4),                         -- Pesos Argentinos por USD
    mxn NUMERIC(14, 4),                         -- Pesos Mexicanos por USD
    pen NUMERIC(14, 4),                         -- Soles Peruanos por USD
    clp NUMERIC(14, 4),                         -- Pesos Chilenos por USD
    cop NUMERIC(14, 4),                         -- Pesos Colombianos por USD
    moneda_base VARCHAR(5) NOT NULL DEFAULT 'USD',
    fuente VARCHAR(50) DEFAULT 'OFICIAL_REPLY',
    estado VARCHAR(20) NOT NULL DEFAULT 'REAL', -- 'REAL' o 'PROYECTADO'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna estado si ya existía la tabla
ALTER TABLE public.tipo_de_cambio ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'REAL';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.tipo_de_cambio ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso
DROP POLICY IF EXISTS "Permitir lectura publica tipo_de_cambio" ON public.tipo_de_cambio;
CREATE POLICY "Permitir lectura publica tipo_de_cambio"
    ON public.tipo_de_cambio FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir modificacion tipo_de_cambio" ON public.tipo_de_cambio;
CREATE POLICY "Permitir modificacion tipo_de_cambio"
    ON public.tipo_de_cambio FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. VISTA ANALÍTICA NORMALIZADA: V_TIPO_DE_CAMBIO (Unpivot para cruces SQL)
-- ------------------------------------------------------------------------------
-- Facilita joins directos: JOIN v_tipo_de_cambio tc ON tc.periodo = l.periodo AND tc.moneda = l.moneda
CREATE OR REPLACE VIEW public.v_tipo_de_cambio AS
SELECT periodo, 'ARS' AS moneda, moneda_base, ars AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE ars IS NOT NULL
UNION ALL
SELECT periodo, 'MXN' AS moneda, moneda_base, mxn AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE mxn IS NOT NULL
UNION ALL
SELECT periodo, 'PEN' AS moneda, moneda_base, pen AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE pen IS NOT NULL
UNION ALL
SELECT periodo, 'CLP' AS moneda, moneda_base, clp AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE clp IS NOT NULL
UNION ALL
SELECT periodo, 'COP' AS moneda, moneda_base, cop AS tc_oficial, fuente, estado, updated_at FROM public.tipo_de_cambio WHERE cop IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. POBLAR HISTÓRICO Y PROYECCIONES DESDE TIPO_DE_CAMBIO.TXT
-- ------------------------------------------------------------------------------
INSERT INTO public.tipo_de_cambio (periodo, ars, mxn, pen, clp, cop, moneda_base, estado)
VALUES
    ('2024-01-01', NULL, 17.1600, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-02-01', NULL, 17.0600, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-03-01', NULL, 16.6700, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-04-01', NULL, 16.9300, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-05-01', NULL, 17.6300, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-06-01', NULL, 17.9600, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-07-01', NULL, 19.0400, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-08-01', NULL, 19.8000, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-09-01', NULL, 19.6700, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-10-01', NULL, 20.1600, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-11-01', NULL, 20.4200, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2024-12-01', NULL, 20.2700, NULL, NULL, NULL, 'USD', 'REAL'),
    ('2025-01-01', 1032.0000, 19.5000, 3.7500, 996.4600, 3950.0000, 'USD', 'REAL'),
    ('2025-02-01', 1046.0000, 19.6000, 3.7600, 956.9000, 3970.0000, 'USD', 'REAL'),
    ('2025-03-01', 1060.0000, 19.7000, 3.7700, 946.5900, 3990.0000, 'USD', 'REAL'),
    ('2025-04-01', 1197.7400, 19.6100, 3.7000, 940.1800, 4305.0200, 'USD', 'REAL'),
    ('2025-05-01', 1150.0000, 19.2300, 3.6600, 935.0000, 4107.0000, 'USD', 'REAL'),
    ('2025-06-01', 1215.0000, 18.8300, 3.6200, 926.6200, 3974.3700, 'USD', 'REAL'),
    ('2025-07-01', 1330.0000, 18.8000, 3.5600, 964.2800, 4097.3800, 'USD', 'REAL'),
    ('2025-08-01', 1330.0000, 18.6500, 3.5400, 965.2800, 4016.0000, 'USD', 'REAL'),
    ('2025-09-01', 1450.0000, 18.3500, 3.5000, 959.1900, 3897.0000, 'USD', 'REAL'),
    ('2025-10-01', 1480.0000, 18.5400, 3.4300, 940.5300, 1.0000, 'USD', 'REAL'),
    ('2025-11-01', 1420.0000, 18.3500, 3.3700, 928.0000, 3784.0000, 'USD', 'REAL'),
    ('2025-12-01', 1450.0000, 18.0000, 3.3700, 911.1800, 3790.7700, 'USD', 'REAL'),
    ('2026-01-01', 1430.0000, 17.2900, 3.3600, 860.0000, 3622.0000, 'USD', 'REAL'),
    ('2026-02-01', 1395.0000, 17.2200, 3.3600, 884.2100, 3769.0000, 'USD', 'REAL'),
    ('2026-03-01', 1405.0000, 18.0000, 3.4400, 927.4600, 3660.0000, 'USD', 'REAL'),
    ('2026-04-01', 1420.0000, 17.4700, 3.5100, 903.0500, 3660.0000, 'USD', 'REAL'),
    ('2026-05-01', 1427.0000, 17.2900, 3.3900, 892.9100, 3562.0000, 'USD', 'REAL'),
    ('2026-06-01', 1490.0000, 17.5100, 3.3900, 922.2100, 3440.8300, 'USD', 'REAL'),
    ('2026-07-01', 1525.0000, 17.4600, 3.4100, 941.9300, 3205.8000, 'USD', 'REAL'),
    ('2026-08-01', 1530.0000, 16.9700, 3.4000, 929.1800, 3213.9700, 'USD', 'REAL'),
    ('2026-09-01', 1565.0000, 18.0700, 3.3600, 972.6000, 3312.8400, 'USD', 'REAL'),
    ('2026-10-01', 1590.0000, 18.1200, 3.3600, 975.0000, 3325.0000, 'USD', 'PROYECTADO'),
    ('2026-11-01', 1615.0000, 18.1800, 3.3700, 978.0000, 3340.0000, 'USD', 'PROYECTADO'),
    ('2026-12-01', 1645.0000, 18.2500, 3.3700, 982.0000, 3360.0000, 'USD', 'PROYECTADO'),
    ('2027-01-01', 1670.0000, 18.3200, 3.3800, 985.0000, 3375.0000, 'USD', 'PROYECTADO'),
    ('2027-02-01', 1695.0000, 18.3800, 3.3800, 989.0000, 3390.0000, 'USD', 'PROYECTADO'),
    ('2027-03-01', 1720.0000, 18.4500, 3.3900, 993.0000, 3410.0000, 'USD', 'PROYECTADO'),
    ('2027-04-01', 1745.0000, 18.5200, 3.3900, 998.0000, 3425.0000, 'USD', 'PROYECTADO'),
    ('2027-05-01', 1770.0000, 18.6000, 3.4000, 1002.0000, 3440.0000, 'USD', 'PROYECTADO'),
    ('2027-06-01', 1795.0000, 18.6800, 3.4000, 1006.0000, 3455.0000, 'USD', 'PROYECTADO'),
    ('2027-07-01', 1820.0000, 18.7500, 3.4100, 1010.0000, 3470.0000, 'USD', 'PROYECTADO'),
    ('2027-08-01', 1845.0000, 18.8200, 3.4100, 1014.0000, 3485.0000, 'USD', 'PROYECTADO'),
    ('2027-09-01', 1870.0000, 18.9000, 3.4200, 1018.0000, 3500.0000, 'USD', 'PROYECTADO')
ON CONFLICT (periodo) DO UPDATE 
SET ars = EXCLUDED.ars,
    mxn = EXCLUDED.mxn,
    pen = EXCLUDED.pen,
    clp = EXCLUDED.clp,
    cop = EXCLUDED.cop,
    moneda_base = EXCLUDED.moneda_base,
    estado = EXCLUDED.estado,
    updated_at = NOW();

COMMIT;
