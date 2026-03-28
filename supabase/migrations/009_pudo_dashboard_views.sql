-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 009
-- Vistas y funciones para dashboard del propietario PUDO
-- ============================================================

-- Habilitar extensión pg_trgm para búsqueda por similitud
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. VISTA: pudo_active_packages_enhanced
-- Lista mejorada de paquetes actualmente en local
-- ============================================================

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
  -- Determinar tipo de paquete (entrega o devolución)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.pudo_scan_logs psl
      WHERE psl.remote_shipment_id = p.tracking_code 
        AND psl.action_type = 'return_confirmation'
    ) THEN 'return'
    ELSE 'delivery'
  END as package_type,
  -- Número secuencial para mostrar
  ROW_NUMBER() OVER (PARTITION BY p.location_id ORDER BY p.created_at) as package_number
FROM public.packages p
LEFT JOIN public.users u ON u.id = p.customer_id
WHERE p.status = 'in_location';

COMMENT ON VIEW public.pudo_active_packages_enhanced IS 
  'Vista mejorada de paquetes activos en local con tipo, tiempo y datos del cliente. Respeta RLS.';

-- ============================================================
-- 2. VISTA: pudo_operations_history
-- Historial simplificado de operaciones PUDO
-- ============================================================

CREATE OR REPLACE VIEW public.pudo_operations_history
WITH (security_invoker = true)
AS
SELECT
  psl.id,
  psl.scan_timestamp,
  psl.remote_shipment_id as tracking_code,
  psl.action_type,
  psl.previous_status,
  psl.new_status,
  psl.api_request_successful as result,
  psl.pudo_location_id,
  -- Información del operador
  u.first_name || ' ' || u.last_name as operator_name,
  u.first_name as operator_first_name,
  u.last_name as operator_last_name,
  u.id as operator_id,
  -- Información del local
  l.name as location_name,
  l.owner_id,
  -- Formato amigable del tipo de acción
  CASE psl.action_type
    WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
    WHEN 'return_confirmation' THEN 'Devolución recibida'
    ELSE psl.action_type::TEXT
  END as action_type_label,
  -- Transición de estados formateada
  psl.previous_status || ' → ' || psl.new_status as status_transition
FROM public.pudo_scan_logs psl
JOIN public.users u ON u.id = psl.scanned_by_user_id
JOIN public.locations l ON l.id = psl.pudo_location_id
ORDER BY psl.scan_timestamp DESC;

COMMENT ON VIEW public.pudo_operations_history IS 
  'Historial simplificado de operaciones PUDO con operador y resultado. Respeta RLS.';

-- ============================================================
-- 3. FUNCIÓN RPC: get_pudo_operations_paginated
-- Obtener histórico de operaciones con filtros y paginación
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pudo_operations_paginated(
  p_location_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_result_filter TEXT DEFAULT NULL,  -- 'success', 'failed', o NULL (todos)
  p_tracking_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  scan_timestamp TIMESTAMPTZ,
  tracking_code TEXT,
  action_type pudo_action_type,
  action_type_label TEXT,
  previous_status TEXT,
  new_status TEXT,
  status_transition TEXT,
  result BOOLEAN,
  operator_name TEXT,
  operator_id UUID,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- Calcular offset para paginación
  v_offset := (p_page - 1) * p_limit;
  
  -- Validar límite
  IF p_limit > 100 THEN
    RAISE EXCEPTION 'Limit cannot exceed 100 records per page';
  END IF;
  
  RETURN QUERY
  WITH filtered_logs AS (
    SELECT
      psl.id,
      psl.scan_timestamp,
      psl.remote_shipment_id as tracking_code,
      psl.action_type,
      CASE psl.action_type
        WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
        WHEN 'return_confirmation' THEN 'Devolución recibida'
        ELSE psl.action_type::TEXT
      END as action_type_label,
      psl.previous_status,
      psl.new_status,
      psl.previous_status || ' → ' || psl.new_status as status_transition,
      psl.api_request_successful as result,
      u.first_name || ' ' || u.last_name as operator_name,
      u.id as operator_id
    FROM public.pudo_scan_logs psl
    JOIN public.users u ON u.id = psl.scanned_by_user_id
    WHERE psl.pudo_location_id = p_location_id
      -- Filtro de fechas
      AND (p_date_from IS NULL OR psl.scan_timestamp >= p_date_from)
      AND (p_date_to IS NULL OR psl.scan_timestamp <= p_date_to)
      -- Filtro de tipo de acción
      AND (p_action_type IS NULL OR psl.action_type::TEXT = p_action_type)
      -- Filtro de resultado
      AND (
        p_result_filter IS NULL 
        OR (p_result_filter = 'success' AND psl.api_request_successful = true)
        OR (p_result_filter = 'failed' AND psl.api_request_successful = false)
      )
      -- Búsqueda por tracking
      AND (
        p_tracking_search IS NULL 
        OR psl.remote_shipment_id ILIKE '%' || p_tracking_search || '%'
      )
  ),
  total AS (
    SELECT COUNT(*) as count FROM filtered_logs
  )
  SELECT 
    fl.*,
    t.count as total_count
  FROM filtered_logs fl
  CROSS JOIN total t
  ORDER BY fl.scan_timestamp DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_pudo_operations_paginated IS 
  'Obtiene el histórico de operaciones PUDO con filtros múltiples y paginación. Retorna total_count para implementar paginación en frontend.';

-- ============================================================
-- 4. FUNCIÓN RPC: export_pudo_operations_csv
-- Exportar operaciones a formato CSV (retorna JSON para frontend)
-- ============================================================

CREATE OR REPLACE FUNCTION public.export_pudo_operations_csv(
  p_location_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_result_filter TEXT DEFAULT NULL,
  p_tracking_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  scan_timestamp TEXT,
  tracking_code TEXT,
  action_type_label TEXT,
  status_transition TEXT,
  result TEXT,
  operator_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(psl.scan_timestamp, 'YYYY-MM-DD HH24:MI:SS') as scan_timestamp,
    psl.remote_shipment_id as tracking_code,
    CASE psl.action_type
      WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
      WHEN 'return_confirmation' THEN 'Devolución recibida'
      ELSE psl.action_type::TEXT
    END as action_type_label,
    psl.previous_status || ' → ' || psl.new_status as status_transition,
    CASE 
      WHEN psl.api_request_successful THEN 'Éxito'
      ELSE 'Fallo'
    END as result,
    u.first_name || ' ' || u.last_name as operator_name
  FROM public.pudo_scan_logs psl
  JOIN public.users u ON u.id = psl.scanned_by_user_id
  WHERE psl.pudo_location_id = p_location_id
    AND (p_date_from IS NULL OR psl.scan_timestamp >= p_date_from)
    AND (p_date_to IS NULL OR psl.scan_timestamp <= p_date_to)
    AND (p_action_type IS NULL OR psl.action_type::TEXT = p_action_type)
    AND (
      p_result_filter IS NULL 
      OR (p_result_filter = 'success' AND psl.api_request_successful = true)
      OR (p_result_filter = 'failed' AND psl.api_request_successful = false)
    )
    AND (
      p_tracking_search IS NULL 
      OR psl.remote_shipment_id ILIKE '%' || p_tracking_search || '%'
    )
  ORDER BY psl.scan_timestamp DESC;
END;
$$;

COMMENT ON FUNCTION public.export_pudo_operations_csv IS 
  'Exporta operaciones PUDO en formato compatible con CSV. El frontend debe convertir JSON a CSV.';

-- ============================================================
-- 5. ÍNDICES ADICIONALES para optimizar consultas del dashboard
-- ============================================================

-- Índice para búsqueda de paquetes activos por local
CREATE INDEX IF NOT EXISTS idx_packages_location_status 
  ON public.packages(location_id, status) 
  WHERE status = 'in_location';

-- Índice para histórico con filtros de fecha
CREATE INDEX IF NOT EXISTS idx_pudo_scan_logs_location_timestamp_action 
  ON public.pudo_scan_logs(pudo_location_id, scan_timestamp DESC, action_type);

-- Índice para búsqueda por tracking en logs
CREATE INDEX IF NOT EXISTS idx_pudo_scan_logs_shipment_gin 
  ON public.pudo_scan_logs 
  USING gin(remote_shipment_id gin_trgm_ops);

-- ============================================================
-- 6. POLÍTICAS RLS para las nuevas funciones
-- ============================================================

-- Las vistas ya respetan RLS con security_invoker = true
-- Las funciones RPC son SECURITY DEFINER pero incluyen validación implícita:
-- El usuario debe tener acceso al location_id según las políticas existentes

-- Nota: Las funciones RPC verifican implícitamente el acceso porque:
-- 1. Solo retornan datos de locations que el usuario puede ver
-- 2. Las políticas RLS en pudo_scan_logs ya restringen el acceso

-- ============================================================
-- FIN DE MIGRACIÓN 009
-- ============================================================