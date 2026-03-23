-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 005
-- Corregir RLS de locations para permitir que cualquier usuario
-- gestione su dirección (necesario tras el refactor 004).
-- ============================================================

-- 1. Eliminar políticas antiguas restrictivas
DROP POLICY IF EXISTS "locations_owner_insert" ON public.locations;
DROP POLICY IF EXISTS "locations_owner_update" ON public.locations;

-- 2. Permitir que cualquier usuario inserte su propio registro de dirección
-- Se elimina la restricción de que el rol deba ser 'owner' o 'admin'
-- ya que ahora todos los perfiles guardan su dirección aquí.
CREATE POLICY "locations_owner_insert"
  ON public.locations FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
  );

-- 3. Permitir que cualquier usuario actualice su propio registro
CREATE POLICY "locations_owner_update"
  ON public.locations FOR UPDATE
  USING (owner_id = auth.uid() OR public.my_role() = 'admin')
  WITH CHECK (owner_id = auth.uid() OR public.my_role() = 'admin');

COMMENT ON POLICY "locations_owner_insert" ON public.locations IS 'Permite a cualquier usuario crear su propio registro de dirección.';
COMMENT ON POLICY "locations_owner_update" ON public.locations IS 'Permite a cualquier usuario o administrador actualizar su propia dirección.';
