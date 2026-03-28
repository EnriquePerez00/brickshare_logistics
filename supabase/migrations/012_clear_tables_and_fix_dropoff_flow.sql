-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 012
-- Limpiar tablas de datos de prueba y preparar flujo de dropoff
-- ============================================================

-- ============================================================
-- 1. LIMPIAR TABLAS (orden correcto por dependencias FK)
-- ============================================================

-- Primero tablas hijas (que referencian a packages)
TRUNCATE TABLE public.package_events CASCADE;
TRUNCATE TABLE public.scan_errors CASCADE;
TRUNCATE TABLE public.pudo_scan_logs CASCADE;
-- Luego la tabla principal
TRUNCATE TABLE public.packages CASCADE;

-- ============================================================
-- 2. Añadir campos adicionales a packages para info remota
-- ============================================================

-- Nombre del cliente destinatario (desde sistema remoto)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS remote_customer_name TEXT;

-- Dirección de entrega original (desde sistema remoto)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS remote_delivery_address TEXT;

-- Estado del shipment en sistema remoto al momento del escaneo
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS remote_shipping_status TEXT;

-- Fecha estimada de entrega (desde sistema remoto)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS remote_estimated_delivery TIMESTAMPTZ;

-- Metadata completa del shipment remoto (JSON flexible)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS remote_shipment_data JSONB DEFAULT '{}'::jsonb;

-- Fecha en que se recibió en el PUDO (momento del scan de dropoff)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.packages.remote_customer_name IS 
  'Nombre del destinatario obtenido del sistema remoto Brickshare';

COMMENT ON COLUMN public.packages.remote_delivery_address IS 
  'Dirección de entrega original del envío remoto';

COMMENT ON COLUMN public.packages.remote_shipping_status IS 
  'Estado del shipping en sistema remoto al momento del escaneo';

COMMENT ON COLUMN public.packages.remote_shipment_data IS 
  'Datos completos del shipment remoto en formato JSON';

COMMENT ON COLUMN public.packages.received_at IS 
  'Timestamp de cuando el paquete fue recepcionado (escaneado) en el PUDO';

-- ============================================================
-- FIN DE MIGRACIÓN 012
-- ============================================================