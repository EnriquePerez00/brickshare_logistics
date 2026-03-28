-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 011
-- Añadir campo pudo_id a locations con formato brickshare-XXX
-- ============================================================

-- 1. Crear secuencia para generar IDs secuenciales
CREATE SEQUENCE IF NOT EXISTS locations_pudo_seq START 1;

-- 2. Añadir columna pudo_id (inicialmente nullable para poder rellenar datos)
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS pudo_id TEXT;

-- 3. Rellenar registros existentes con valores secuenciales
UPDATE public.locations
SET pudo_id = 'brickshare-' || LPAD(nextval('locations_pudo_seq')::TEXT, 3, '0')
WHERE pudo_id IS NULL;

-- 4. Hacer el campo obligatorio y único
ALTER TABLE public.locations
ALTER COLUMN pudo_id SET NOT NULL;

ALTER TABLE public.locations
ADD CONSTRAINT unique_pudo_id UNIQUE (pudo_id);

-- 5. Crear función para generar pudo_id automáticamente en nuevos registros
CREATE OR REPLACE FUNCTION public.generate_pudo_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pudo_id IS NULL THEN
    NEW.pudo_id := 'brickshare-' || LPAD(nextval('locations_pudo_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_pudo_id() IS 
  'Genera automáticamente un pudo_id en formato brickshare-XXX para nuevos puntos PUDO';

-- 6. Crear trigger para ejecutar la función antes de INSERT
CREATE TRIGGER set_pudo_id_on_insert
BEFORE INSERT ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.generate_pudo_id();

-- 7. Crear índice para optimizar búsquedas por pudo_id
CREATE INDEX IF NOT EXISTS idx_locations_pudo_id ON public.locations(pudo_id);

-- 8. Añadir comentario descriptivo
COMMENT ON COLUMN public.locations.pudo_id IS 
  'Identificador único del punto PUDO en formato brickshare-XXX (secuencial de 3 dígitos)';

-- ============================================================
-- FIN DE MIGRACIÓN 011
-- ============================================================