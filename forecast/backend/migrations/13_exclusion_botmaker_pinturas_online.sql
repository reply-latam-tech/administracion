-- ==============================================================================
-- MIGRACIÓN 13: EXCLUSIÓN DE BOTMAKER PARA PINTURAS ONLINE (SELLER_ID 484050606)
-- ==============================================================================
-- Regla comercial oficial:
-- A Pinturas Online no se le cobra Botmaker, por más de que existan consumos
-- registrados en la tabla botmaker_consumos.
--
-- 1. Se asegura la bandera cobrar_botmaker = FALSE en dim_sellers.
-- 2. Al ser cobrar_botmaker = FALSE, la vista liquidaciones asigna automáticamente:
--    - botmaker = 0
--    - subtotal = subtotal_mercado_libre
--    - iva = subtotal_mercado_libre * 0.21 (para ARS)
--    - total_factura = subtotal_mercado_libre * 1.21
-- ==============================================================================

BEGIN;

-- 1. Actualizar bandera cobrar_botmaker en dim_sellers
UPDATE public.dim_sellers
SET cobrar_botmaker = FALSE
WHERE id_seller = 484050606 OR LOWER(nombre_seller) LIKE '%pinturas online%';

COMMIT;
