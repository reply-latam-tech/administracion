-- ==============================================================================
-- MIGRACIÓN 11: REGLA DE NEGOCIO Y DESFASE TEMPORAL DE BOTMAKER (MES VENCIDO)
-- ==============================================================================
-- 1. Regla comercial de Botmaker:
--    - Los consumos de la plataforma Botmaker se facturan y descargan a mes vencido.
--    - Por consiguiente, existe un desfase temporal estricto de 1 mes entre el consumo y la facturación:
--      * Cierre de Julio 2026 (consumo hasta el 31/07) -> Se cobra en la liquidación de Reply de Agosto 2026 (periodo '2026-08-01').
--      * Cierre de Agosto 2026 (consumo hasta el 31/08) -> Se cobra en la liquidación de Reply de Septiembre 2026 (periodo '2026-09-01').
--      * Cierre de Septiembre 2026 (consumo hasta el 30/09) -> Se cobra en la liquidación de Reply de Octubre 2026 (periodo '2026-10-01').
--
-- 2. Esquema de Markups aplicados por Reply:
--    - Períodos anteriores a Octubre 2026 (< '2026-10-01'):
--      Markup del 20%:
--      * Cuentas estándar: Base $139.000 ARS * 1.20 = $166.800 ARS.
--      * Soda Stream: Base $276.000 ARS * 1.20 = $331.200 ARS.
--    - A partir de Octubre 2026 (>= '2026-10-01'):
--      Aumento de base Botmaker + Markup del 25%:
--      * Cuentas estándar: Base $165.000 ARS * 1.25 = $206.250 ARS.
--      * Soda Stream: Base $328.000 ARS * 1.25 = $410.000 ARS.
--      * Forbasse: Base $10.989 ARS * 1.25 = $13.736,25 ARS.
--      * Go Avance: Base $66.000 ARS * 1.25 = $82.500 ARS.
--
-- 3. Reglas especiales:
--    - Café Martínez (seller_id 1088146491): No se cobra Botmaker (cobrar_botmaker = false). Descuento del 20% sobre subtotal en todos los meses.
--    - Cuentas del exterior (CO, MX, CL, US): Botmaker ARS se convierte a USD con Tipo de Cambio oficial y se suma al subtotal en USD (sin IVA).
-- ==============================================================================

BEGIN;

-- Limpieza de registros huérfanos o sin desfase previo en 2026-07-01 si correspondiera
DELETE FROM public.botmaker_consumos
WHERE periodo = '2026-07-01';

COMMIT;
