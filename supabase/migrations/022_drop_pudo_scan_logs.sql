-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 022
-- Eliminar tabla pudo_scan_logs y todas sus dependencias
-- ============================================================
-- 
-- OBJETIVO: Eliminar completamente la tabla pudo_scan_logs y todos
-- los objetos de base de datos relacionados (vistas, funciones, 
-- políticas RLS, tipos ENUM).
-- 
-- RAZÓN: Los logs de scanner serán implementados en una fase 
-- posterior del proyecto. Esta eliminación es temporal.
-- 
-- PREREQUISITO: Migration 021 debe haberse ejecutado primero para
-- refactorizar las vistas y funciones que dependían de esta tabla.
-- ============================================================

-- ============================================================
-- 1. ELIMINAR VISTA: pudo_scan_summary
-- ============================================================

DROP VIEW IF EXISTS public.pudo_scan_summary CASCADE;

-- ============================================================
-- 2. ELIMINAR FUNCIÓN RPC: log_pudo_scan
-- ============================================================

DROP FUNCTION IF EXISTS public.log_pudo_scan(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, 
  TEXT, TEXT, BOOLEAN, INTEGER, TEXT, INTEGER, JSONB
) CASCADE;

-- ============================================================
-- 3. ELIMINAR FUNCIÓN: validate_gps_location
-- ============================================================

DROP FUNCTION IF EXISTS public.validate_gps_location(NUMERIC, NUMERIC, UUID) CASCADE;

-- ============================================================
-- 4. ELIMINAR POLÍTICAS RLS DE pudo_scan_logs
-- ============================================================

-- Políticas creadas en migration 008
DROP POLICY IF EXISTS "pudo_scan_logs_admin_all" ON public.pudo_scan_logs;
DROP POLICY IF EXISTS "pudo_scan_logs_owner_view" ON public.pudo_scan_logs;
DROP POLICY IF EXISTS "pudo_scan_logs_owner_insert" ON public.pudo_scan_logs;

-- Políticas creadas en migration 017
DROP POLICY IF EXISTS "pudo_scan_logs_service_insert" ON public.pudo_scan_logs;
DROP POLICY IF EXISTS "pudo_scan_logs_service_select" ON public.pudo_scan_logs;

-- ============================================================
-- 5. ELIMINAR ÍNDICES DE pudo_scan_logs
-- ============================================================

-- Índices creados en migration 008
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_location;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_shipment;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_timestamp;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_user;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_action_type;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_location_date;

-- Índices creados en migration 009
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_location_timestamp_action;
DROP INDEX IF EXISTS public.idx_pudo_scan_logs_shipment_gin;

-- ============================================================
-- 6. ELIMINAR TABLA: pudo_scan_logs
-- ============================================================

DROP TABLE IF EXISTS public.pudo_scan_logs CASCADE;

-- ============================================================
-- 7. ELIMINAR TIPO ENUM: pudo_action_type
-- ============================================================

DROP TYPE IF EXISTS public.pudo_action_type CASCADE;

-- ============================================================
-- NOTAS POST-MIGRACIÓN
-- ============================================================
-- 
-- ✅ La tabla pudo_scan_logs ha sido completamente eliminada
-- ✅ Las vistas pudo_active_packages_enhanced y pudo_operations_history
--    ahora usan package_events en lugar de pudo_scan_logs
-- ✅ Las funciones get_pudo_operations_paginated y export_pudo_operations_csv
--    ahora usan package_events en lugar de pudo_scan_logs
-- 
-- ⚠️  IMPACTO EN LA APLICACIÓN:
-- - Edge Functions que insertaban en pudo_scan_logs deben ser actualizadas
-- - Scripts que consultaban pudo_scan_logs deben ser actualizados
-- - Documentación debe ser actualizada para reflejar estos cambios
-- 
-- 📝 PRÓXIMOS PASOS:
-- 1. Actualizar Edge Functions (process-pudo-scan, update-remote-shipment-status)
-- 2. Actualizar database.types.ts (eliminar tipo pudo_scan_logs)
-- 3. Actualizar/eliminar scripts que usen pudo_scan_logs
-- 4. Actualizar documentación del repositorio
-- 
-- ============================================================
-- FIN DE MIGRACIÓN 022
-- ============================================================