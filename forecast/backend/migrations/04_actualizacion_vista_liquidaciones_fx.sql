-- ==============================================================================
-- MIGRACIÓN 04: VISTA LIQUIDACIONES CON SOPORTE MULTIMONEDA & FX (CUENTAS EXTERIOR)
-- ==============================================================================
-- Permite calcular liquidaciones automáticas para cuentas del exterior (ej. Natura Colombia)
-- donde:
-- 1. La facturación bruta de Mercado Libre está en moneda local (ej. COP).
-- 2. Se cruza con la tabla tipo_de_cambio para convertir a USD.
-- 3. Se evalúan los umbrales de la escala en USD (dim_escalas.moneda = 'USD').
-- 4. Se calcula el monto del servicio en USD (mínimo mensual o porcentaje).
-- 5. Se suma Botmaker si cobrar_botmaker = TRUE (en USD).
-- 6. NO se aplica IVA a cuentas del exterior / facturadas en USD (iva = 0).
-- 7. 100% RETROCOMPATIBLE con cuentas de Argentina (ARS) que mantienen IVA 21%.
-- ==============================================================================

BEGIN;

DROP VIEW IF EXISTS public.liquidaciones;

CREATE OR REPLACE VIEW public.liquidaciones AS
WITH FacturacionConFX AS (
  SELECT 
    f.id AS facturacion_id,
    f.periodo,
    f.seller_id,
    f.valor_facturado,
    f.estado,
    s.nombre_seller,
    COALESCE(s.codigo_pais, s.pais, 'AR') AS pais,
    s.moneda AS moneda_seller,
    s.cobrar_botmaker,
    -- Tipo de cambio oficial para el periodo y moneda
    tc.ars,
    tc.mxn,
    tc.pen,
    tc.clp,
    tc.cop
  FROM public.facturacion f
  JOIN public.dim_sellers s ON f.seller_id = s.id_seller
  LEFT JOIN public.tipo_de_cambio tc ON tc.periodo = f.periodo
),
EscalasEvaluadas AS (
  SELECT 
    fx.facturacion_id,
    fx.periodo,
    fx.seller_id,
    fx.valor_facturado,
    fx.estado,
    fx.nombre_seller,
    fx.pais,
    fx.moneda_seller,
    fx.cobrar_botmaker,
    COALESCE(e.moneda, fx.moneda_seller) AS moneda_escala,
    -- Facturación convertida a la moneda de la escala
    CASE 
      WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'COP' 
        THEN (fx.valor_facturado / NULLIF(fx.cop, 0))
      WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'MXN' 
        THEN (fx.valor_facturado / NULLIF(fx.mxn, 0))
      WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'PEN' 
        THEN (fx.valor_facturado / NULLIF(fx.pen, 0))
      WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'CLP' 
        THEN (fx.valor_facturado / NULLIF(fx.clp, 0))
      WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'ARS' 
        THEN (fx.valor_facturado / NULLIF(fx.ars, 0))
      ELSE fx.valor_facturado
    END AS facturacion_evaluar,
    e.tipo_cargo,
    e.alicuota,
    e.monto_objetivo,
    COALESCE(b.total_billed, 0) AS botmaker_original,
    CASE 
      WHEN fx.cobrar_botmaker = TRUE THEN COALESCE(b.total_billed, 0)
      ELSE 0
    END AS botmaker,
    ROW_NUMBER() OVER(
      PARTITION BY fx.facturacion_id 
      ORDER BY 
        CASE WHEN e.tipo_cargo = 'PORCENTUAL' THEN 1 ELSE 2 END,
        e.monto_objetivo DESC
    ) AS rn
  FROM FacturacionConFX fx
  LEFT JOIN public.dim_escalas e ON fx.seller_id = e.seller_id AND e.periodo = fx.periodo
  LEFT JOIN public.botmaker_consumos b ON fx.seller_id = b.seller_id AND fx.periodo = b.periodo
  WHERE (e.tipo_cargo = 'MINIMO') 
     OR (e.tipo_cargo = 'PORCENTUAL' AND (
        CASE 
          WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'COP' 
            THEN (fx.valor_facturado / NULLIF(fx.cop, 0))
          WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'MXN' 
            THEN (fx.valor_facturado / NULLIF(fx.mxn, 0))
          WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'PEN' 
            THEN (fx.valor_facturado / NULLIF(fx.pen, 0))
          WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'CLP' 
            THEN (fx.valor_facturado / NULLIF(fx.clp, 0))
          WHEN COALESCE(e.moneda, fx.moneda_seller) = 'USD' AND fx.moneda_seller = 'ARS' 
            THEN (fx.valor_facturado / NULLIF(fx.ars, 0))
          ELSE fx.valor_facturado
        END >= e.monto_objetivo
     ))
)
SELECT 
  facturacion_id,
  periodo,
  seller_id,
  nombre_seller,
  pais,
  -- Si la escala está en USD, la liquidación se emite en USD; sino en la moneda del seller
  CASE WHEN moneda_escala = 'USD' THEN 'USD' ELSE moneda_seller END AS moneda,
  valor_facturado,
  tipo_cargo AS tipo_cargo_aplicado,
  alicuota AS alicuota_aplicada,
  monto_objetivo AS umbral_alcanzado,
  -- Subtotal de honorarios Mercado Libre en la moneda de liquidación
  CASE 
    WHEN tipo_cargo = 'MINIMO' THEN monto_objetivo
    WHEN tipo_cargo = 'PORCENTUAL' THEN 
      ROUND((facturacion_evaluar * alicuota)::numeric, 2)
    ELSE 0
  END AS subtotal_mercado_libre,
  botmaker_original,
  cobrar_botmaker,
  botmaker,
  -- Subtotal = Honorarios ML + Botmaker
  (
    CASE 
      WHEN tipo_cargo = 'MINIMO' THEN monto_objetivo
      WHEN tipo_cargo = 'PORCENTUAL' THEN 
        ROUND((facturacion_evaluar * alicuota)::numeric, 2)
      ELSE 0
    END + botmaker
  ) AS subtotal,
  -- IVA: 0% para cuentas del exterior / facturadas en USD; 21% para cuentas locales de Argentina (ARS)
  CASE 
    WHEN pais = 'AR' AND moneda_seller = 'ARS' AND moneda_escala != 'USD' 
      THEN ROUND((
        (
          CASE 
            WHEN tipo_cargo = 'MINIMO' THEN monto_objetivo
            WHEN tipo_cargo = 'PORCENTUAL' THEN 
              ROUND((facturacion_evaluar * alicuota)::numeric, 2)
            ELSE 0
          END + botmaker
        ) * 0.21
      )::numeric, 4)
    ELSE 0.00
  END AS iva,
  -- Total Factura (con IVA para AR, sin IVA para Exterior)
  CASE 
    WHEN pais = 'AR' AND moneda_seller = 'ARS' AND moneda_escala != 'USD' 
      THEN ROUND((
        (
          CASE 
            WHEN tipo_cargo = 'MINIMO' THEN monto_objetivo
            WHEN tipo_cargo = 'PORCENTUAL' THEN 
              ROUND((facturacion_evaluar * alicuota)::numeric, 2)
            ELSE 0
          END + botmaker
        ) * 1.21
      )::numeric, 4)
    ELSE (
      CASE 
        WHEN tipo_cargo = 'MINIMO' THEN monto_objetivo
        WHEN tipo_cargo = 'PORCENTUAL' THEN 
          ROUND((facturacion_evaluar * alicuota)::numeric, 2)
        ELSE 0
      END + botmaker
    )
  END AS total_factura,
  estado
FROM EscalasEvaluadas
WHERE rn = 1;

COMMIT;
