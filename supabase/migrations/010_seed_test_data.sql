-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 010
-- Seed data: SIMPLIFICADO - Solo migración de pudo_id
-- ============================================================

-- NOTA: Este script se ha simplificado para solo comentar la necesidad de seed data
-- El seed data completo debe ser ejecutado usando el script scripts/seed-via-api.mjs
-- que crea correctamente los usuarios y datos de prueba

-- La migración 010 se mantiene por compatibilidad pero no ejecuta ninguna acción
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration 010: Seed data script (simplified)';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'To create test data, run: npm run seed-api';
  RAISE NOTICE 'This will properly create users and packages via API';
END $$;

-- ============================================================
-- FIN DE SEED DATA
-- ============================================================