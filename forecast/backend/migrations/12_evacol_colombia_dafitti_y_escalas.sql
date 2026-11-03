-- ==============================================================================
-- MIGRACIÓN 12: CREACIÓN DE EVACOL COLOMBIA DAFITTI Y ESCALAS MULTICANAL COLOMBIA
-- ==============================================================================
-- Evacol Colombia opera 3 marketplaces en Colombia:
-- 1. Mercado Libre (ML)   -> seller_id: 2219963574
-- 2. ADDI                -> seller_id: 928424062
-- 3. DAFITI (DAFITTI)    -> seller_id: 928424063
--
-- Regla comercial y liquidación:
-- A cada uno se le aplica la misma escala comercial en USD con piso mínimo
-- garantizado de $1.000 USD (o tramos del 4,00% al 2,00% sobre el GMV convertido de COP a USD).
-- Tramos de la escala en USD:
--   - Mínimo: USD 1.000,00 (hasta USD 50.000)
--   - >= USD 50.000: 4,00%
--   - >= USD 60.000: 3,50%
--   - >= USD 80.000: 3,00%
--   - >= USD 110.000: 2,50%
--   - >= USD 150.000: 2,00%
--
-- Mecánica de Liquidación y Facturación:
-- 1. Se toma el valor de GMV en COP de cada canal.
-- 2. Se convierte a USD con el Tipo de Cambio oficial del mes (ej: Oct 2026: $3.183 COP/USD).
-- 3. Se cruza con la escala comercial en USD obteniendo el fee en USD de cada canal (mínimo USD 1.000 c/u).
-- 4. Se totalizan los honorarios en USD (USD 1.000 + USD 1.000 + USD 1.000 = USD 3.000).
-- 5. Se reconvierte a COP multiplicando por el TC mensual ($3.182,99 * 3.000 = COP $9.548.970,00).
-- 6. Moneda de cobro de Reply: COP (Pesos Colombianos), detallando los 3 fees en una sola factura sin IVA.
-- ==============================================================================

BEGIN;

-- 1. Asegurar plataforma DAFITTI en dim_plataformas
INSERT INTO public.dim_plataformas (codigo_plataforma, nombre_plataforma)
VALUES ('DAFITTI', 'Dafiti Marketplace')
ON CONFLICT (codigo_plataforma) DO NOTHING;

-- 2. Insertar seller Evacol Colombia DAFITTI
INSERT INTO public.dim_sellers (id_seller, nombre_seller, pais, moneda, id_cliente, codigo_plataforma, estado)
VALUES (928424063, 'Evacol Colombia DAFITTI', 'CO', 'COP', 19, 'DAFITTI', TRUE)
ON CONFLICT (id_seller) DO UPDATE 
SET nombre_seller = EXCLUDED.nombre_seller,
    pais = EXCLUDED.pais,
    moneda = EXCLUDED.moneda,
    id_cliente = EXCLUDED.id_cliente,
    codigo_plataforma = EXCLUDED.codigo_plataforma,
    estado = EXCLUDED.estado;

-- 3. Replicar escala comercial completa de Evacol Colombia ML (2219963574) a ADDI (928424062) y DAFITTI (928424063)
-- Para ADDI
INSERT INTO public.dim_escalas (seller_id, periodo, tipo_cargo, monto_objetivo, alicuota, moneda, estado)
SELECT 
  928424062 AS seller_id,
  periodo,
  tipo_cargo,
  monto_objetivo,
  alicuota,
  moneda,
  estado
FROM public.dim_escalas
WHERE seller_id = 2219963574
ON CONFLICT (seller_id, periodo, tipo_cargo, monto_objetivo) DO NOTHING;

-- Para DAFITTI
INSERT INTO public.dim_escalas (seller_id, periodo, tipo_cargo, monto_objetivo, alicuota, moneda, estado)
SELECT 
  928424063 AS seller_id,
  periodo,
  tipo_cargo,
  monto_objetivo,
  alicuota,
  moneda,
  estado
FROM public.dim_escalas
WHERE seller_id = 2219963574
ON CONFLICT (seller_id, periodo, tipo_cargo, monto_objetivo) DO NOTHING;

-- 4. Registrar facturación real de Octubre 2026 para DAFITTI
INSERT INTO public.facturacion (seller_id, periodo, valor_facturado, variacion_mensual, estado)
VALUES (928424063, '2026-10-01', 0, 0, 'REAL')
ON CONFLICT (seller_id, periodo) DO NOTHING;

COMMIT;
