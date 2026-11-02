-- ==============================================================================
-- MIGRACIÓN 10: ACTUALIZACIÓN DE MARKUP BOTMAKER AL 25% Y EXCLUSIÓN CAFÉ MARTÍNEZ
-- ==============================================================================
-- 1. Regla comercial Botmaker:
--    - Honorarios base Botmaker subieron a:
--      * Cuentas estándar: $165.000 ARS base
--      * Soda Stream: $328.000 ARS base
--      * Forbasse: $10.989 ARS base
--    - Valores finales a cobrar por Reply:
--      * Cuentas estándar: $206.250 ARS (Markup exacto del 25%: $165.000 * 1.25)
--      * Soda Stream: $410.000 ARS (Markup exacto del 25%: $328.000 * 1.25)
--      * Forbasse: $13.736,25 ARS ($10.989 * 1.25)
-- 2. Regla comercial Café Martínez (seller_id 1088146491):
--    - "No se le cobra Botmaker" -> cobrar_botmaker = FALSE en dim_sellers
--    - "Se le debe realizar un descuento del 20% todos los meses sobre el subtotal"
--
-- 3. Regla comercial Cuentas del Exterior (Colombia, México, Chile, USA):
--    - Los consumos de Botmaker se registran en Pesos Argentinos (ARS) en botmaker_consumos.
--    - Para cuentas del exterior facturadas en USD, el fee de Botmaker se convierte a USD
--      utilizando el Tipo de Cambio oficial del mes (tc.ars).
--    - El monto resultante en USD se suma al Subtotal en USD, y el Total de la Factura
--      se liquida en USD sin IVA (0% IVA para exportación de servicios).
-- ==============================================================================

BEGIN;

-- 1. Asegurar bandera cobrar_botmaker = FALSE para Café Martínez
UPDATE public.dim_sellers
SET cobrar_botmaker = FALSE
WHERE id_seller = 1088146491 OR LOWER(nombre_seller) LIKE '%cafe martinez%';

COMMIT;
