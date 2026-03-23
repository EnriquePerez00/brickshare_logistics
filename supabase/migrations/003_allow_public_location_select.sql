-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 003
-- Permitir acceso público (lectura) a puntos de recogida activos
-- ============================================================

-- Permitir que cualquier usuario (incluyendo anónimos) vea los locales activos
CREATE POLICY "locations_public_select"
  ON public.locations FOR SELECT
  USING (is_active = true);

COMMENT ON POLICY "locations_public_select" ON public.locations IS 
  'Permite el acceso público de lectura a los puntos de recogida que estén marcados como activos.';
