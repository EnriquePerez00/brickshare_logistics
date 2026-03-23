-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 006
-- Añadir soporte para integración con sistemas externos
-- (específicamente Brickshare - plataforma de alquiler LEGO)
-- ============================================================

-- ============================================================
-- 1. Añadir campos de integración a la tabla packages
-- ============================================================

-- Tipo de package: delivery (entrega al cliente) o return (devolución del cliente)
ALTER TABLE public.packages
  ADD COLUMN type TEXT NOT NULL DEFAULT 'delivery'
    CHECK (type IN ('delivery', 'return'));

COMMENT ON COLUMN public.packages.type IS 
  'Tipo de paquete: delivery (oficinas→cliente) o return (cliente→oficinas)';

-- QR estático para devoluciones (no expira temporalmente)
ALTER TABLE public.packages
  ADD COLUMN static_qr_hash TEXT;

COMMENT ON COLUMN public.packages.static_qr_hash IS 
  'JWT/hash estático para devoluciones. No expira temporalmente, válido hasta que se escanee.';

-- Referencia al ID del shipment en el sistema externo
ALTER TABLE public.packages
  ADD COLUMN external_shipment_id TEXT;

COMMENT ON COLUMN public.packages.external_shipment_id IS 
  'ID del shipment en el sistema externo (ej: Brickshare). Usado para sincronización.';

-- Sistema de origen del package
ALTER TABLE public.packages
  ADD COLUMN source_system TEXT NOT NULL DEFAULT 'logistics'
    CHECK (source_system IN ('logistics', 'brickshare'));

COMMENT ON COLUMN public.packages.source_system IS 
  'Sistema que creó el package: logistics (creado localmente) o brickshare (creado desde integración).';

-- ============================================================
-- 2. Crear índices para mejorar performance de consultas
-- ============================================================

CREATE INDEX idx_packages_type ON public.packages(type);
CREATE INDEX idx_packages_external_shipment_id ON public.packages(external_shipment_id);
CREATE INDEX idx_packages_source_system ON public.packages(source_system);

-- Índice compuesto para consultas de integración
CREATE INDEX idx_packages_source_external ON public.packages(source_system, external_shipment_id);

-- ============================================================
-- 3. Función helper para validar transiciones de estado
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_package_state_transition(
  p_current_status package_status,
  p_new_status package_status,
  p_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar transiciones para delivery
  IF p_type = 'delivery' THEN
    CASE p_current_status
      WHEN 'pending_dropoff' THEN
        RETURN p_new_status IN ('in_location', 'returned');
      WHEN 'in_location' THEN
        RETURN p_new_status IN ('picked_up', 'returned');
      WHEN 'picked_up' THEN
        RETURN FALSE; -- Estado final
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  -- Validar transiciones para return
  IF p_type = 'return' THEN
    CASE p_current_status
      WHEN 'pending_dropoff' THEN
        RETURN p_new_status IN ('in_location', 'returned');
      WHEN 'in_location' THEN
        RETURN p_new_status IN ('returned');
      WHEN 'returned' THEN
        RETURN FALSE; -- Estado final
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.validate_package_state_transition IS 
  'Valida que la transición de estado sea válida según el tipo de package (delivery/return)';

-- ============================================================
-- 4. Trigger para validar transiciones de estado
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_package_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo validar cuando el status cambia
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.validate_package_state_transition(OLD.status, NEW.status, NEW.type) THEN
      RAISE EXCEPTION 'Invalid state transition for % package: % -> %', 
        NEW.type, OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER packages_validate_state_transition
  BEFORE UPDATE OF status ON public.packages
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.check_package_state_transition();

COMMENT ON TRIGGER packages_validate_state_transition ON public.packages IS 
  'Valida que las transiciones de estado sean correctas según el tipo de package';

-- ============================================================
-- 5. Vista para packages de sistemas externos
-- ============================================================

CREATE OR REPLACE VIEW public.external_packages
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.tracking_code,
  p.status,
  p.type,
  p.location_id,
  l.name AS location_name,
  l.address AS location_address,
  p.customer_id,
  p.dynamic_qr_hash,
  p.static_qr_hash,
  p.qr_expires_at,
  p.external_shipment_id,
  p.source_system,
  p.created_at,
  p.updated_at
FROM public.packages p
JOIN public.locations l ON l.id = p.location_id
WHERE p.source_system != 'logistics';

COMMENT ON VIEW public.external_packages IS 
  'Vista de packages creados desde sistemas externos. Respeta RLS.';

-- ============================================================
-- 6. Función RPC para crear package desde sistema externo
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_external_package(
  p_tracking_code TEXT,
  p_type TEXT,
  p_location_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_external_shipment_id TEXT DEFAULT NULL,
  p_source_system TEXT DEFAULT 'brickshare'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package_id UUID;
  v_result JSON;
BEGIN
  -- Validar que el location existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.locations 
    WHERE id = p_location_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Location not found or inactive: %', p_location_id;
  END IF;

  -- Validar tipo
  IF p_type NOT IN ('delivery', 'return') THEN
    RAISE EXCEPTION 'Invalid package type: %. Must be delivery or return', p_type;
  END IF;

  -- Crear el package
  INSERT INTO public.packages (
    tracking_code,
    type,
    status,
    location_id,
    customer_id,
    external_shipment_id,
    source_system
  ) VALUES (
    p_tracking_code,
    p_type,
    'pending_dropoff',
    p_location_id,
    p_customer_id,
    p_external_shipment_id,
    p_source_system
  )
  RETURNING id INTO v_package_id;

  -- Construir respuesta
  SELECT json_build_object(
    'success', true,
    'package_id', v_package_id,
    'tracking_code', p_tracking_code,
    'type', p_type,
    'status', 'pending_dropoff',
    'location_id', p_location_id,
    'created_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_external_package IS 
  'Crea un package desde un sistema externo. Requiere autenticación y permisos adecuados.';

-- ============================================================
-- 7. Políticas RLS adicionales para integración
-- ============================================================

-- Permitir a service role crear packages externos
CREATE POLICY "packages_service_role_insert"
  ON public.packages FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Permitir consultar packages externos por external_shipment_id
CREATE POLICY "packages_external_id_select"
  ON public.packages FOR SELECT
  USING (
    external_shipment_id IS NOT NULL
    AND (
      -- El owner del location puede ver
      EXISTS (
        SELECT 1 FROM public.locations l
        WHERE l.id = packages.location_id
          AND l.owner_id = auth.uid()
      )
      -- O es el customer
      OR customer_id = auth.uid()
      -- O es admin
      OR public.my_role() = 'admin'
    )
  );

-- ============================================================
-- FIN DE MIGRACIÓN 006
-- ============================================================