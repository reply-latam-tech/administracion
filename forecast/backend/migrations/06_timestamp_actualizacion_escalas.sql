-- ==============================================================================
-- MIGRACIÓN 06: AUDITORÍA Y TIMESTAMP DE ÚLTIMA ACTUALIZACIÓN EN DIM_ESCALAS
-- ==============================================================================
-- Agrega columna updated_at con fecha y hora exacta en que se modificó o insertó
-- cada registro de escala, con trigger automático.
-- ==============================================================================

BEGIN;

-- 1. Agregar columna updated_at si no existe
ALTER TABLE public.dim_escalas 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Función trigger para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION update_dim_escalas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el trigger antes de cada UPDATE
DROP TRIGGER IF EXISTS trigger_dim_escalas_updated_at ON public.dim_escalas;
CREATE TRIGGER trigger_dim_escalas_updated_at
BEFORE UPDATE ON public.dim_escalas
FOR EACH ROW
EXECUTE FUNCTION update_dim_escalas_updated_at();

COMMIT;
