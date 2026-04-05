-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 019
-- Asegurar que la columna app_version existe en pudo_scan_logs
-- ============================================================
-- Fecha: 2026-01-04
-- Problema: Edge function falla porque app_version no existe en DB1 Cloud
-- Solución: Añadir columna si no existe (idempotente)
-- ============================================================

-- Añadir columna app_version si no existe
ALTER TABLE public.pudo_scan_logs
  ADD COLUMN IF NOT EXISTS app_version TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN public.pudo_scan_logs.app_version IS 
  'Versión de la aplicación móvil que registró el escaneo (ej: 1.0.0). Útil para auditoría, debugging y análisis de compatibilidad.';

-- ============================================================
-- FIN DE MIGRACIÓN 019
-- ============================================================