-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 004
-- Refactorizar esquema: Mover dirección de users a locations
-- ============================================================

-- 1. Agregar nuevas columnas a locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Añadir restricción de unicidad para owner_id para asegurar relación 1:1 en esta etapa
-- (Si ya hay datos duplicados, esto requeriría limpieza previa)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_owner_id') THEN
        ALTER TABLE public.locations ADD CONSTRAINT unique_owner_id UNIQUE (owner_id);
    END IF;
END $$;

-- 2. Migrar datos de users a locations
-- Creamos una entrada en locations para cada usuario que tenga dirección,
-- o actualizamos la existente.
INSERT INTO public.locations (owner_id, name, address, postal_code, city, location_name, is_active)
SELECT 
  id as owner_id, 
  first_name || ' ' || last_name as name, 
  address, 
  postal_code, 
  city, 
  'Establecimiento de ' || first_name as location_name,
  true as is_active
FROM public.users
WHERE address <> '' OR postal_code <> '' OR city <> ''
ON CONFLICT (owner_id) DO UPDATE SET
  address = EXCLUDED.address,
  postal_code = EXCLUDED.postal_code,
  city = EXCLUDED.city,
  location_name = COALESCE(locations.location_name, EXCLUDED.location_name);

-- 3. Eliminar columnas de users
ALTER TABLE public.users DROP COLUMN IF EXISTS address;
ALTER TABLE public.users DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.users DROP COLUMN IF EXISTS city;

-- Actualizar comentarios
COMMENT ON COLUMN public.locations.location_name IS 'Nombre comercial del punto de recogida.';
COMMENT ON COLUMN public.locations.postal_code IS 'Código postal del local.';
COMMENT ON COLUMN public.locations.city IS 'Ciudad del local.';
