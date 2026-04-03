-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 018
-- Add RLS policies for shipments table to allow Edge Function queries
-- ============================================================

-- Enable RLS on shipments table if not already enabled
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. SERVICE ROLE policies (for Edge Functions)
-- Edge Functions need to query shipments by QR code
-- ============================================================

-- Permitir al service_role leer shipments sin restricciones
CREATE POLICY "shipments_service_select"
  ON public.shipments FOR SELECT
  TO service_role
  USING (true);

-- Permitir al service_role actualizar shipments sin restricciones
CREATE POLICY "shipments_service_update"
  ON public.shipments FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. AUTHENTICATED users policies
-- Allow users to view their own shipments
-- ============================================================

CREATE POLICY "shipments_user_select_own"
  ON public.shipments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. ANON policies (minimal access for public queries)
-- ============================================================

CREATE POLICY "shipments_anon_select_public"
  ON public.shipments FOR SELECT
  TO anon
  USING (FALSE);  -- No access for anonymous users

COMMENT ON POLICY "shipments_service_select" ON public.shipments IS
  'Permite a las Edge Functions (service_role) leer shipments sin restricciones para validación QR';

COMMENT ON POLICY "shipments_service_update" ON public.shipments IS
  'Permite a las Edge Functions (service_role) actualizar shipments sin restricciones para cambios de estado';

COMMENT ON POLICY "shipments_user_select_own" ON public.shipments IS
  'Permite a los usuarios autenticados ver sus propios shipments';

COMMENT ON POLICY "shipments_anon_select_public" ON public.shipments IS
  'Deniega acceso a usuarios anónimos para proteger información sensible';

-- ============================================================
-- FIN DE MIGRACIÓN 018
-- ============================================================