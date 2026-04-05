-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 018
-- Add RLS policies for shipments table to allow Edge Function queries
-- ============================================================

-- Enable RLS on shipments table if not already enabled (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipments') THEN
    ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================
-- 1. SERVICE ROLE policies (for Edge Functions)
-- Edge Functions need to query shipments by QR code
-- ============================================================

-- Only create policies if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipments') THEN
    
    -- Permitir al service_role leer shipments sin restricciones
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'shipments_service_select') THEN
      CREATE POLICY "shipments_service_select"
        ON public.shipments FOR SELECT
        TO service_role
        USING (true);
    END IF;

    -- Permitir al service_role actualizar shipments sin restricciones
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'shipments_service_update') THEN
      CREATE POLICY "shipments_service_update"
        ON public.shipments FOR UPDATE
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;

    -- ============================================================
    -- 2. AUTHENTICATED users policies
    -- Allow users to view their own shipments
    -- ============================================================

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'shipments_user_select_own') THEN
      CREATE POLICY "shipments_user_select_own"
        ON public.shipments FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;

    -- ============================================================
    -- 3. ANON policies (minimal access for public queries)
    -- ============================================================

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'shipments_anon_select_public') THEN
      CREATE POLICY "shipments_anon_select_public"
        ON public.shipments FOR SELECT
        TO anon
        USING (FALSE);  -- No access for anonymous users
    END IF;

    -- Add comments
    COMMENT ON POLICY "shipments_service_select" ON public.shipments IS
      'Permite a las Edge Functions (service_role) leer shipments sin restricciones para validación QR';

    COMMENT ON POLICY "shipments_service_update" ON public.shipments IS
      'Permite a las Edge Functions (service_role) actualizar shipments sin restricciones para cambios de estado';

    COMMENT ON POLICY "shipments_user_select_own" ON public.shipments IS
      'Permite a los usuarios autenticados ver sus propios shipments';

    COMMENT ON POLICY "shipments_anon_select_public" ON public.shipments IS
      'Deniega acceso a usuarios anónimos para proteger información sensible';
      
  END IF;
END $$;

-- ============================================================
-- FIN DE MIGRACIÓN 018
-- ============================================================