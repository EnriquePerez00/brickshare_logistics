-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 015
-- Corregir dependencias de vistas tras refactor de owner_id
-- ============================================================

-- 1. Actualizar public.pudo_operations_history
-- Eliminamos owner_id de la vista ya que no existe en locations
-- Las políticas RLS (security_invoker = true) seguirán funcionando por location_id
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
  -- l.owner_id,  -- ELIMINADO en el refactor multicontrol
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
JOIN public.locations l ON l.id = psl.pudo_location_id;

COMMENT ON VIEW public.pudo_operations_history IS 
  'Historial simplificado de operaciones PUDO (Corregido: sin owner_id). Respeta RLS.';

-- 2. Asegurar que monthly_profitability usa 'name' en lugar de 'location_name'
-- Corregimos el filtrado por estados válidos del enum package_status
DROP VIEW IF EXISTS public.monthly_profitability;
CREATE OR REPLACE VIEW public.monthly_profitability
WITH (security_invoker = true)
AS
SELECT 
    TO_CHAR(pe.created_at, 'YYYY-MM') as month,
    l.id as location_id,
    l.name as name,
    l.commission_rate,
    COUNT(DISTINCT pe.package_id) as total_packages,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'in_location') as active_packages,
    -- Usamos el cambio de estado en package_events en lugar de event_type inexistentes
    COUNT(pe.id) FILTER (WHERE pe.new_status = 'in_location') as dropoffs,
    COUNT(pe.id) FILTER (WHERE pe.new_status = 'picked_up') as pickups,
    ((COUNT(pe.id) FILTER (WHERE pe.new_status = 'in_location') + 
      COUNT(pe.id) FILTER (WHERE pe.new_status = 'picked_up')) * l.commission_rate) as profitability
FROM public.locations l
LEFT JOIN public.package_events pe ON pe.location_id = l.id
LEFT JOIN public.packages p ON p.id = pe.package_id
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.monthly_profitability IS 
  'Vista de rentabilidad mensual por local (Corregido: usa name y estados de enum).';
