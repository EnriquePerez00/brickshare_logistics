-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 007
-- Crear tablas de auditoría: package_events y scan_errors
-- ============================================================

-- 1. Crear ENUM para tipos de eventos
CREATE TYPE event_type_enum AS ENUM (
  'qr_generated',
  'qr_scanned_success',
  'qr_scanned_failed',
  'qr_expired',
  'package_created',
  'status_changed',
  'manual_adjustment'
);

COMMENT ON TYPE event_type_enum IS 'Tipos de eventos de auditoría en el sistema de logística';

-- ============================================================
-- 2. TABLA: package_events (Auditoría de operaciones)
-- ============================================================

CREATE TABLE public.package_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia al paquete
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  
  -- Tipo de evento
  event_type event_type_enum NOT NULL,
  
  -- Estado antes/después (si aplica)
  old_status package_status,
  new_status package_status,
  
  -- Usuario responsable de la acción
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Ubicación donde ocurrió el evento
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Tipo de QR involucrado (si aplica)
  qr_type TEXT CHECK (qr_type IN ('dynamic', 'static')),
  
  -- Información de error (si aplica)
  error_code TEXT,
  error_message TEXT,
  
  -- Metadatos flexibles (JSON para futuras extensiones)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Información del cliente que realizó la acción
  ip_address INET,
  user_agent TEXT,
  device_info TEXT,
  
  -- Timestamp automático
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar queries frecuentes
CREATE INDEX idx_package_events_package_id 
  ON public.package_events(package_id);

CREATE INDEX idx_package_events_event_type 
  ON public.package_events(event_type);

CREATE INDEX idx_package_events_timestamp 
  ON public.package_events(created_at DESC);

CREATE INDEX idx_package_events_performed_by 
  ON public.package_events(performed_by);

CREATE INDEX idx_package_events_location_id 
  ON public.package_events(location_id);

-- Índice compuesto para auditoría por rango de tiempo y location
CREATE INDEX idx_package_events_location_timestamp 
  ON public.package_events(location_id, created_at DESC);

COMMENT ON TABLE public.package_events IS 
  'Auditoría completa de eventos en paquetes: generación de QR, escaneos, cambios de estado, errores';

COMMENT ON COLUMN public.package_events.package_id IS 
  'UUID del paquete asociado';

COMMENT ON COLUMN public.package_events.event_type IS 
  'Tipo de evento: generación QR, escaneo exitoso, escaneo fallido, etc.';

COMMENT ON COLUMN public.package_events.performed_by IS 
  'UUID del usuario que realizó la acción (owner, admin, o NULL si es sistema)';

COMMENT ON COLUMN public.package_events.qr_type IS 
  'Tipo de QR: dynamic (expira) o static (permanente hasta escaneo)';

COMMENT ON COLUMN public.package_events.metadata IS 
  'Datos flexibles en JSON: source, reason, retry_count, etc.';

-- RLS para package_events: admins y owners pueden ver eventos de sus paquetes/locales
ALTER TABLE public.package_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_events_admin_all"
  ON public.package_events FOR SELECT
  TO authenticated
  USING (public.my_role() = 'admin');

CREATE POLICY "package_events_owner_view"
  ON public.package_events FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. TABLA: scan_errors (Registro de intentos fallidos)
-- ============================================================

CREATE TABLE public.scan_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos del escaneo intentado
  scanned_data TEXT NOT NULL, -- Los primeros caracteres del QR/código de barras
  
  -- Clasificación del error
  error_type TEXT NOT NULL CHECK (error_type IN (
    'invalid_jwt',
    'expired_qr',
    'package_not_found',
    'wrong_state',
    'permission_denied',
    'invalid_signature',
    'unknown_error'
  )),
  
  error_message TEXT,
  
  -- Contexto del error
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Información de la solicitud fallida
  ip_address INET,
  user_agent TEXT,
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp automático
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para análisis de errores
CREATE INDEX idx_scan_errors_timestamp 
  ON public.scan_errors(created_at DESC);

CREATE INDEX idx_scan_errors_error_type 
  ON public.scan_errors(error_type);

CREATE INDEX idx_scan_errors_location 
  ON public.scan_errors(location_id);

CREATE INDEX idx_scan_errors_performed_by 
  ON public.scan_errors(performed_by);

-- Índice compuesto para alertas de spike de errores
CREATE INDEX idx_scan_errors_location_timestamp 
  ON public.scan_errors(location_id, created_at DESC);

-- Índice para detectar patrones de ataque (múltiples errores rápido)
CREATE INDEX idx_scan_errors_ip_timestamp 
  ON public.scan_errors(ip_address, created_at DESC);

COMMENT ON TABLE public.scan_errors IS 
  'Registro de intentos fallidos de escaneo QR/códigos de barras. Útil para debugging, detección de fraude y análisis de patrones';

COMMENT ON COLUMN public.scan_errors.scanned_data IS 
  'Primeros caracteres del dato escaneado (sin guardar todo por privacidad)';

COMMENT ON COLUMN public.scan_errors.error_type IS 
  'Clasificación del error para análisis estadístico';

COMMENT ON COLUMN public.scan_errors.metadata IS 
  'Datos contextuales: retry_count, package_status_found, etc.';

-- RLS para scan_errors: admins y owners pueden ver errores
ALTER TABLE public.scan_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_errors_admin_all"
  ON public.scan_errors FOR SELECT
  TO authenticated
  USING (public.my_role() = 'admin');

CREATE POLICY "scan_errors_owner_view"
  ON public.scan_errors FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 4. FUNCIÓN: log_package_event()
-- Registrar evento de paquete (simplifica inserciones desde Edge Functions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_package_event(
  p_package_id UUID,
  p_event_type event_type_enum,
  p_performed_by UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_old_status package_status DEFAULT NULL,
  p_new_status package_status DEFAULT NULL,
  p_qr_type TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.package_events (
    package_id,
    event_type,
    old_status,
    new_status,
    performed_by,
    location_id,
    qr_type,
    error_code,
    error_message,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_package_id,
    p_event_type,
    p_old_status,
    p_new_status,
    p_performed_by,
    p_location_id,
    p_qr_type,
    p_error_code,
    p_error_message,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.log_package_event IS 
  'Registra un evento de auditoría para un paquete. Útil desde Edge Functions.';

-- ============================================================
-- 5. FUNCIÓN: log_scan_error()
-- Registrar error de escaneo (simplifica inserciones)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_scan_error(
  p_scanned_data TEXT,
  p_error_type TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error_id UUID;
BEGIN
  -- Validar tipo de error
  IF p_error_type NOT IN (
    'invalid_jwt', 'expired_qr', 'package_not_found',
    'wrong_state', 'permission_denied', 'invalid_signature',
    'unknown_error'
  ) THEN
    RAISE EXCEPTION 'Invalid error_type: %', p_error_type;
  END IF;
  
  INSERT INTO public.scan_errors (
    scanned_data,
    error_type,
    error_message,
    location_id,
    performed_by,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_scanned_data,
    p_error_type,
    p_error_message,
    p_location_id,
    p_performed_by,
    p_ip_address,
    p_user_agent,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$$;

COMMENT ON FUNCTION public.log_scan_error IS 
  'Registra un error de escaneo. Útil desde Edge Functions.';

-- ============================================================
-- 6. FUNCIÓN: detect_scan_attack()
-- Detectar potencial ataque: múltiples escaneos fallidos rápido
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_scan_attack(
  p_location_id UUID,
  p_error_threshold INT DEFAULT 10,
  p_time_window_minutes INT DEFAULT 5
)
RETURNS TABLE(
  location_id UUID,
  error_count INT,
  ip_addresses TEXT[],
  alert_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.location_id,
    COUNT(*)::INT as error_count,
    ARRAY_AGG(DISTINCT se.ip_address::TEXT ORDER BY se.ip_address::TEXT) as ip_addresses,
    CASE
      WHEN COUNT(*) >= p_error_threshold THEN 'HIGH'
      WHEN COUNT(*) >= p_error_threshold / 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END as alert_level
  FROM public.scan_errors se
  WHERE
    se.location_id = p_location_id
    AND se.created_at > now() - (p_time_window_minutes || ' minutes')::INTERVAL
  GROUP BY se.location_id;
END;
$$;

COMMENT ON FUNCTION public.detect_scan_attack IS 
  'Detecta potencial ataque analizando picos de errores de escaneo en una ventana temporal';

-- ============================================================
-- 7. VISTA: audit_summary (Resumen diario de auditoría)
-- ============================================================

CREATE OR REPLACE VIEW public.audit_summary AS
SELECT
  DATE(pe.created_at) as audit_date,
  pe.location_id,
  l.name as location_name,
  COUNT(DISTINCT pe.package_id) as packages_processed,
  COUNT(pe.*) FILTER (WHERE pe.event_type = 'qr_generated') as qr_generated,
  COUNT(pe.*) FILTER (WHERE pe.event_type = 'qr_scanned_success') as qr_scanned_success,
  COUNT(pe.*) FILTER (WHERE pe.event_type = 'status_changed') as status_changes,
  COUNT(pe.*) FILTER (WHERE pe.event_type IN ('qr_scanned_failed', 'manual_adjustment')) as issues,
  COUNT(DISTINCT pe.performed_by) as unique_operators
FROM public.package_events pe
LEFT JOIN public.locations l ON l.id = pe.location_id
GROUP BY DATE(pe.created_at), pe.location_id, l.name;

COMMENT ON VIEW public.audit_summary IS 
  'Resumen diario de auditoría por location. Útil para dashboards de operaciones.';

-- ============================================================
-- 8. FUNCIÓN: cleanup_old_audit_logs()
-- Purgar logs antiguos (mantener últimos 90 días por defecto)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_days_to_keep INT DEFAULT 90
)
RETURNS TABLE(
  deleted_events INT,
  deleted_errors INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_events INT := 0;
  v_deleted_errors INT := 0;
BEGIN
  DELETE FROM public.package_events
  WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;
  
  DELETE FROM public.scan_errors
  WHERE created_at < now() - (p_days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_errors = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_events, v_deleted_errors;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 
  'Purga registros de auditoría más antiguos que el período especificado. Ejecutar periódicamente (cron).';

-- ============================================================
-- FIN DE MIGRACIÓN 007
-- ============================================================