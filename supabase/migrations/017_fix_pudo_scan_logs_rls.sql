-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 017
-- Fix RLS policies for pudo_scan_logs to allow Edge Function inserts
-- ============================================================

-- ============================================================
-- 1. AÑADIR POLÍTICA RLS para permitir inserciones desde Edge Functions
-- Las Edge Functions usan SERVICE_ROLE, no usuarios autenticados
-- ============================================================

-- Permitir al rol de servicio insertar sin restricciones
CREATE POLICY "pudo_scan_logs_service_insert"
  ON public.pudo_scan_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir al rol de servicio ver todos los logs
CREATE POLICY "pudo_scan_logs_service_select"
  ON public.pudo_scan_logs FOR SELECT
  TO service_role
  USING (true);

COMMENT ON POLICY "pudo_scan_logs_service_insert" ON public.pudo_scan_logs IS 
  'Permite a las Edge Functions (service_role) insertar logs de escaneo sin restricciones';

COMMENT ON POLICY "pudo_scan_logs_service_select" ON public.pudo_scan_logs IS 
  'Permite a las Edge Functions (service_role) leer todos los logs de escaneo';

-- ============================================================
-- FIN DE MIGRACIÓN 017
-- ============================================================