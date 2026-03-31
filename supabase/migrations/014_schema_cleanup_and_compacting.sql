-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 014
-- Limpieza de esquema y consolidación
-- ============================================================

-- 1. Consolidación de locations.location_name a locations.name
UPDATE public.locations 
SET name = location_name 
WHERE location_name IS NOT NULL AND location_name != '' AND name = '';

ALTER TABLE public.locations DROP COLUMN IF EXISTS location_name;

-- 2. Estandarización de users.role
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'user'::text;

-- 3. Limpieza de public.packages (Datos Remotos Obsoletos)
ALTER TABLE public.packages 
  DROP COLUMN IF EXISTS remote_customer_name, 
  DROP COLUMN IF EXISTS remote_delivery_address, 
  DROP COLUMN IF EXISTS remote_shipping_status, 
  DROP COLUMN IF EXISTS remote_estimated_delivery;

-- 4. Limpieza de Telemetría Plana en Tablas de Logs
ALTER TABLE public.pudo_scan_logs 
  DROP COLUMN IF EXISTS device_info, 
  DROP COLUMN IF EXISTS app_version;

ALTER TABLE public.package_events 
  DROP COLUMN IF EXISTS device_info;

-- 5. Actualizar log_pudo_scan
DROP FUNCTION IF EXISTS public.log_pudo_scan(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.log_pudo_scan(
  p_pudo_location_id UUID,
  p_remote_shipment_id TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_action_type TEXT,
  p_scan_latitude NUMERIC DEFAULT NULL,
  p_scan_longitude NUMERIC DEFAULT NULL,
  p_gps_accuracy_meters NUMERIC DEFAULT NULL,
  p_api_successful BOOLEAN DEFAULT false,
  p_api_response_code INTEGER DEFAULT NULL,
  p_api_response_message TEXT DEFAULT NULL,
  p_api_duration_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_gps_valid BOOLEAN := false;
  v_user_id UUID;
BEGIN
  -- Obtener ID del usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Validar acción
  IF p_action_type NOT IN ('delivery_confirmation', 'return_confirmation') THEN
    RAISE EXCEPTION 'Invalid action_type: %. Must be delivery_confirmation or return_confirmation', p_action_type;
  END IF;
  
  -- Validar GPS si se proporcionan coordenadas
  IF p_scan_latitude IS NOT NULL AND p_scan_longitude IS NOT NULL THEN
    v_gps_valid := public.validate_gps_location(
      p_scan_latitude,
      p_scan_longitude,
      p_pudo_location_id
    );
  END IF;
  
  -- Insertar log
  INSERT INTO public.pudo_scan_logs (
    pudo_location_id,
    remote_shipment_id,
    previous_status,
    new_status,
    scanned_by_user_id,
    action_type,
    scan_latitude,
    scan_longitude,
    gps_accuracy_meters,
    gps_validation_passed,
    api_request_successful,
    api_response_code,
    api_response_message,
    api_request_duration_ms,
    metadata
  ) VALUES (
    p_pudo_location_id,
    p_remote_shipment_id,
    p_previous_status,
    p_new_status,
    v_user_id,
    p_action_type::pudo_action_type,
    p_scan_latitude,
    p_scan_longitude,
    p_gps_accuracy_meters,
    v_gps_valid,
    p_api_successful,
    p_api_response_code,
    p_api_response_message,
    p_api_duration_ms,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;
