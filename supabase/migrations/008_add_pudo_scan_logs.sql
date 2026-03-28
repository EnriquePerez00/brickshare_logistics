-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 008
-- Tabla de logs de escaneo en centros PUDO
-- ============================================================

-- ============================================================
-- 1. TABLA: pudo_scan_logs
-- Registra todas las acciones de escaneo en cada centro PUDO
-- ============================================================

CREATE TYPE pudo_action_type AS ENUM (
  'delivery_confirmation',    -- Confirma entrega en PUDO (in_transit_pudo → delivered_pudo)
  'return_confirmation'       -- Confirma recogida de devolución (in_return_pudo → in_return)
);

CREATE TABLE public.pudo_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia al punto PUDO (deposit_points en BD remota, locations en local)
  pudo_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  
  -- ID del shipment en sistema remoto (Brickshare)
  remote_shipment_id TEXT NOT NULL,
  
  -- Estados antes/después
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  
  -- Usuario que realizó el escaneo
  scanned_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Tipo de acción
  action_type pudo_action_type NOT NULL,
  
  -- Timestamp del escaneo
  scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validación GPS
  scan_latitude NUMERIC(10, 8),
  scan_longitude NUMERIC(11, 8),
  gps_accuracy_meters NUMERIC(8, 2),
  gps_validation_passed BOOLEAN DEFAULT false,
  
  -- Información del dispositivo
  device_info TEXT,
  app_version TEXT,
  
  -- Resultado de la operación remota
  api_request_successful BOOLEAN NOT NULL DEFAULT false,
  api_response_code INTEGER,
  api_response_message TEXT,
  api_request_duration_ms INTEGER,
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Índices de auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_pudo_scan_logs_location 
  ON public.pudo_scan_logs(pudo_location_id);

CREATE INDEX idx_pudo_scan_logs_shipment 
  ON public.pudo_scan_logs(remote_shipment_id);

CREATE INDEX idx_pudo_scan_logs_timestamp 
  ON public.pudo_scan_logs(scan_timestamp DESC);

CREATE INDEX idx_pudo_scan_logs_user 
  ON public.pudo_scan_logs(scanned_by_user_id);

CREATE INDEX idx_pudo_scan_logs_action_type 
  ON public.pudo_scan_logs(action_type);

-- Índice compuesto para análisis por ubicación y fecha
CREATE INDEX idx_pudo_scan_logs_location_date 
  ON public.pudo_scan_logs(pudo_location_id, scan_timestamp DESC);

COMMENT ON TABLE public.pudo_scan_logs IS 
  'Registro de todas las acciones de escaneo QR en centros PUDO con validación GPS y resultado de API remota';

COMMENT ON COLUMN public.pudo_scan_logs.remote_shipment_id IS 
  'ID del shipment en la base de datos remota de Brickshare';

COMMENT ON COLUMN public.pudo_scan_logs.gps_validation_passed IS 
  'Indica si las coordenadas GPS del escaneo están dentro del radio permitido del punto PUDO';

COMMENT ON COLUMN public.pudo_scan_logs.api_request_successful IS 
  'Indica si la solicitud de cambio de estado a la API remota fue exitosa';

-- ============================================================
-- 2. Añadir coordenadas GPS a la tabla locations
-- ============================================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS gps_validation_radius_meters INTEGER DEFAULT 50;

COMMENT ON COLUMN public.locations.latitude IS 
  'Latitud del punto PUDO para validación GPS';

COMMENT ON COLUMN public.locations.longitude IS 
  'Longitud del punto PUDO para validación GPS';

COMMENT ON COLUMN public.locations.gps_validation_radius_meters IS 
  'Radio en metros dentro del cual se considera válido el escaneo (por defecto 50m)';

-- ============================================================
-- 3. RLS para pudo_scan_logs
-- ============================================================

ALTER TABLE public.pudo_scan_logs ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver todos los logs
CREATE POLICY "pudo_scan_logs_admin_all"
  ON public.pudo_scan_logs FOR SELECT
  TO authenticated
  USING (public.my_role() = 'admin');

-- Owners pueden ver logs de sus puntos PUDO
CREATE POLICY "pudo_scan_logs_owner_view"
  ON public.pudo_scan_logs FOR SELECT
  TO authenticated
  USING (
    pudo_location_id IN (
      SELECT id FROM public.locations WHERE owner_id = auth.uid()
    )
  );

-- Owners pueden insertar logs en sus puntos PUDO
CREATE POLICY "pudo_scan_logs_owner_insert"
  ON public.pudo_scan_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    pudo_location_id IN (
      SELECT id FROM public.locations WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 4. FUNCIÓN: validate_gps_location
-- Valida si las coordenadas están dentro del radio permitido
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_gps_location(
  p_scan_lat NUMERIC,
  p_scan_lon NUMERIC,
  p_pudo_location_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pudo_lat NUMERIC;
  v_pudo_lon NUMERIC;
  v_radius_meters INTEGER;
  v_distance_meters NUMERIC;
BEGIN
  -- Obtener coordenadas del punto PUDO
  SELECT latitude, longitude, gps_validation_radius_meters
  INTO v_pudo_lat, v_pudo_lon, v_radius_meters
  FROM public.locations
  WHERE id = p_pudo_location_id;
  
  -- Si no hay coordenadas configuradas, aprobar por defecto
  IF v_pudo_lat IS NULL OR v_pudo_lon IS NULL THEN
    RETURN true;
  END IF;
  
  -- Calcular distancia usando fórmula de Haversine (aproximación)
  -- Distancia en metros entre dos puntos GPS
  v_distance_meters := (
    6371000 * acos(
      cos(radians(v_pudo_lat)) * cos(radians(p_scan_lat)) *
      cos(radians(p_scan_lon) - radians(v_pudo_lon)) +
      sin(radians(v_pudo_lat)) * sin(radians(p_scan_lat))
    )
  );
  
  -- Validar si está dentro del radio
  RETURN v_distance_meters <= v_radius_meters;
END;
$$;

COMMENT ON FUNCTION public.validate_gps_location IS 
  'Valida si las coordenadas GPS del escaneo están dentro del radio permitido del punto PUDO usando fórmula de Haversine';

-- ============================================================
-- 5. VISTA: pudo_scan_summary
-- Resumen de escaneos por punto PUDO
-- ============================================================

CREATE OR REPLACE VIEW public.pudo_scan_summary AS
SELECT
  l.id as location_id,
  l.name as location_name,
  DATE(psl.scan_timestamp) as scan_date,
  psl.action_type,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE psl.api_request_successful = true) as successful_scans,
  COUNT(*) FILTER (WHERE psl.api_request_successful = false) as failed_scans,
  COUNT(*) FILTER (WHERE psl.gps_validation_passed = true) as gps_valid_scans,
  COUNT(*) FILTER (WHERE psl.gps_validation_passed = false) as gps_invalid_scans,
  AVG(psl.api_request_duration_ms)::INTEGER as avg_api_duration_ms,
  COUNT(DISTINCT psl.scanned_by_user_id) as unique_operators
FROM public.pudo_scan_logs psl
JOIN public.locations l ON l.id = psl.pudo_location_id
GROUP BY l.id, l.name, DATE(psl.scan_timestamp), psl.action_type;

COMMENT ON VIEW public.pudo_scan_summary IS 
  'Resumen diario de escaneos por punto PUDO, tipo de acción y resultado';

-- ============================================================
-- 6. FUNCIÓN RPC: log_pudo_scan
-- Registra un escaneo PUDO con validación GPS
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_pudo_scan(
  p_pudo_location_id UUID,
  p_remote_shipment_id TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_action_type TEXT,
  p_scan_latitude NUMERIC DEFAULT NULL,
  p_scan_longitude NUMERIC DEFAULT NULL,
  p_gps_accuracy_meters NUMERIC DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
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
    device_info,
    app_version,
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
    p_device_info,
    p_app_version,
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

COMMENT ON FUNCTION public.log_pudo_scan IS 
  'Registra un escaneo en punto PUDO con validación GPS automática y resultado de API remota';

-- ============================================================
-- FIN DE MIGRACIÓN 008
-- ============================================================