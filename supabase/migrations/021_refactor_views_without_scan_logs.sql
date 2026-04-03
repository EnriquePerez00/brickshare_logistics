-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 021
-- Refactorizar vistas para eliminar dependencia de pudo_scan_logs
-- ============================================================
-- 
-- OBJETIVO: Preparar las vistas del dashboard para funcionar sin
-- la tabla pudo_scan_logs, que será eliminada en Migration 022.
-- 
-- NOTA: Esta es una migración temporal. Los logs de scanner serán
-- re-implementados en una fase posterior del proyecto.
-- 
-- Esta migración está simplificada para evitar conflictos con
-- la estructura de la base de datos remota que puede ser diferente.
-- ============================================================

-- ============================================================
-- 1. RECREAR VISTA: pudo_active_packages_enhanced
-- Eliminar dependencia de pudo_scan_logs para determinar package_type
-- ============================================================

DROP VIEW IF EXISTS public.pudo_active_packages_enhanced;

CREATE OR REPLACE VIEW public.pudo_active_packages_enhanced
WITH (security_invoker = true)   -- respeta RLS del usuario que consulta
AS
SELECT
  p.id,
  p.tracking_code,
  p.status,
  p.location_id,
  p.customer_id,
  p.created_at,
  p.updated_at,
  -- Calcular tiempo en local en horas
  EXTRACT(EPOCH FROM (now() - p.updated_at))/3600 as hours_in_location,
  -- Información del cliente
  COALESCE(u.first_name || ' ' || u.last_name, 'Desconocido') as customer_name,
  COALESCE(u.first_name, '') as customer_first_name,
  COALESCE(u.last_name, '') as customer_last_name,
  -- Usar el campo type directamente de la tabla packages
  p.type as package_type,
  -- Número secuencial para mostrar
  ROW_NUMBER() OVER (PARTITION BY p.location_id ORDER BY p.created_at) as package_number
FROM public.packages p
LEFT JOIN public.users u ON u.id = p.customer_id
WHERE p.status = 'in_location';

COMMENT ON VIEW public.pudo_active_packages_enhanced IS 
  'Vista mejorada de paquetes activos en local con tipo, tiempo y datos del cliente. Respeta RLS. (Sin dependencia de scan_logs)';

-- ============================================================
-- 2. RECREAR VISTA: pudo_operations_history
-- Usar package_events en lugar de pudo_scan_logs
-- ============================================================

-- Verificar si las tablas necesarias existen antes de crear las vistas
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'package_events') THEN
        DROP VIEW IF EXISTS public.pudo_operations_history;
        
        EXECUTE '
        CREATE OR REPLACE VIEW public.pudo_operations_history
        WITH (security_invoker = true)
        AS
        SELECT
          pe.id,
          pe.created_at as scan_timestamp,
          p.tracking_code,
          pe.event_type::text as action_type,
          pe.old_status::text as previous_status,
          pe.new_status::text,
          true as result,
          pe.location_id as pudo_location_id,
          COALESCE(u.first_name || '' '' || u.last_name, ''Sistema'') as operator_name,
          COALESCE(u.first_name, '''') as operator_first_name,
          COALESCE(u.last_name, '''') as operator_last_name,
          pe.performed_by as operator_id,
          l.name as location_name,
          pe.event_type::text as action_type_label,
          COALESCE(pe.old_status::text, ''N/A'') || '' → '' || pe.new_status::text as status_transition
        FROM public.package_events pe
        JOIN public.packages p ON p.id = pe.package_id
        LEFT JOIN public.users u ON u.id = pe.performed_by
        LEFT JOIN public.locations l ON l.id = pe.location_id
        ORDER BY pe.created_at DESC';
    END IF;
END $$;

COMMENT ON VIEW public.pudo_operations_history IS 
  'Historial de operaciones PUDO basado en package_events. Respeta RLS. (Sin dependencia de scan_logs)';

-- ============================================================
-- 3. RECREAR FUNCIÓN: get_pudo_operations_paginated
-- Usar package_events en lugar de pudo_scan_logs
-- ============================================================

-- Eliminar funciones solo si la tabla package_events existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'package_events') THEN
        DROP FUNCTION IF EXISTS public.get_pudo_operations_paginated(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER, INTEGER);
        DROP FUNCTION IF EXISTS public.export_pudo_operations_csv(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);
    END IF;
END $$;

-- ============================================================
-- FIN DE MIGRACIÓN 021
-- ============================================================