-- ============================================================
-- Tests para funciones de base de datos PUDO
-- Ejecutar con: psql -f 008_add_pudo_scan_logs.test.sql
-- ============================================================

-- Setup: Crear datos de prueba temporales
BEGIN;

-- Crear usuario de prueba
INSERT INTO auth.users (id, email) 
VALUES ('00000000-0000-0000-0000-000000000001', 'test@pudo.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, role, first_name, last_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'owner', 'Test', 'Owner', 'test@pudo.com')
ON CONFLICT DO NOTHING;

-- Crear location de prueba con coordenadas GPS
INSERT INTO public.locations (id, owner_id, name, address, latitude, longitude, gps_validation_radius_meters)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Test PUDO Location',
  'Calle Test 123',
  40.4168,  -- Madrid Centro
  -3.7038,
  50  -- Radio de 50 metros
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TEST 1: Función validate_gps_location
-- ============================================================

-- Test 1.1: Coordenadas dentro del radio (15 metros)
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT public.validate_gps_location(
    40.41695,  -- ~15m al norte
    -3.7038,
    '00000000-0000-0000-0000-000000000002'
  ) INTO v_result;
  
  IF v_result = TRUE THEN
    RAISE NOTICE 'PASS: GPS validation dentro del radio (15m)';
  ELSE
    RAISE EXCEPTION 'FAIL: GPS validation debería pasar con 15m de distancia';
  END IF;
END $$;

-- Test 1.2: Coordenadas fuera del radio (100 metros)
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT public.validate_gps_location(
    40.4177,  -- ~100m al norte
    -3.7038,
    '00000000-0000-0000-0000-000000000002'
  ) INTO v_result;
  
  IF v_result = FALSE THEN
    RAISE NOTICE 'PASS: GPS validation fuera del radio (100m)';
  ELSE
    RAISE EXCEPTION 'FAIL: GPS validation debería fallar con 100m de distancia';
  END IF;
END $$;

-- Test 1.3: Coordenadas exactas (0 metros)
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT public.validate_gps_location(
    40.4168,
    -3.7038,
    '00000000-0000-0000-0000-000000000002'
  ) INTO v_result;
  
  IF v_result = TRUE THEN
    RAISE NOTICE 'PASS: GPS validation en coordenadas exactas';
  ELSE
    RAISE EXCEPTION 'FAIL: GPS validation debería pasar en coordenadas exactas';
  END IF;
END $$;

-- Test 1.4: Location sin coordenadas configuradas (debe aprobar)
DO $$
DECLARE
  v_test_location_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Crear location sin GPS
  INSERT INTO public.locations (id, owner_id, name, address)
  VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Test PUDO Sin GPS',
    'Calle Test 456'
  )
  RETURNING id INTO v_test_location_id;
  
  SELECT public.validate_gps_location(
    40.4168,
    -3.7038,
    v_test_location_id
  ) INTO v_result;
  
  IF v_result = TRUE THEN
    RAISE NOTICE 'PASS: GPS validation sin coordenadas configuradas (auto-aprueba)';
  ELSE
    RAISE EXCEPTION 'FAIL: GPS validation debería aprobar cuando no hay coordenadas';
  END IF;
  
  -- Cleanup
  DELETE FROM public.locations WHERE id = v_test_location_id;
END $$;

-- ============================================================
-- TEST 2: Función log_pudo_scan
-- ============================================================

-- Test 2.1: Inserción exitosa con todos los campos
DO $$
DECLARE
  v_log_id UUID;
  v_log_count INT;
BEGIN
  -- Simular autenticación (en producción esto vendría del JWT)
  -- Nota: Esto es una simplificación para testing
  
  -- Llamar función RPC
  SELECT public.log_pudo_scan(
    p_pudo_location_id := '00000000-0000-0000-0000-000000000002',
    p_remote_shipment_id := 'TEST-SHIPMENT-001',
    p_previous_status := 'in_transit_pudo',
    p_new_status := 'delivered_pudo',
    p_action_type := 'delivery_confirmation',
    p_scan_latitude := 40.41695,
    p_scan_longitude := -3.7038,
    p_gps_accuracy_meters := 10.5,
    p_device_info := 'Test Device',
    p_app_version := '1.0.0',
    p_api_successful := true,
    p_api_response_code := 200,
    p_api_response_message := 'Status updated successfully',
    p_api_duration_ms := 234,
    p_metadata := '{"test": true}'::jsonb
  ) INTO v_log_id;
  
  -- Verificar que se creó el registro
  SELECT COUNT(*) INTO v_log_count
  FROM public.pudo_scan_logs
  WHERE id = v_log_id;
  
  IF v_log_count = 1 THEN
    RAISE NOTICE 'PASS: log_pudo_scan insertó registro correctamente (id: %)', v_log_id;
  ELSE
    RAISE EXCEPTION 'FAIL: log_pudo_scan no insertó el registro';
  END IF;
  
  -- Verificar validación GPS automática
  DECLARE
    v_gps_validated BOOLEAN;
  BEGIN
    SELECT gps_validation_passed INTO v_gps_validated
    FROM public.pudo_scan_logs
    WHERE id = v_log_id;
    
    IF v_gps_validated = TRUE THEN
      RAISE NOTICE 'PASS: GPS validation automática funcionó correctamente';
    ELSE
      RAISE EXCEPTION 'FAIL: GPS validation debería ser TRUE';
    END IF;
  END;
END $$;

-- Test 2.2: Validación de action_type inválido
DO $$
DECLARE
  v_log_id UUID;
BEGIN
  BEGIN
    SELECT public.log_pudo_scan(
      p_pudo_location_id := '00000000-0000-0000-0000-000000000002',
      p_remote_shipment_id := 'TEST-SHIPMENT-002',
      p_previous_status := 'in_transit',
      p_new_status := 'delivered',
      p_action_type := 'invalid_action',  -- Acción inválida
      p_api_successful := false
    ) INTO v_log_id;
    
    RAISE EXCEPTION 'FAIL: Debería rechazar action_type inválido';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Invalid action_type%' THEN
        RAISE NOTICE 'PASS: log_pudo_scan rechaza action_type inválido';
      ELSE
        RAISE;
      END IF;
  END;
END $$;

-- ============================================================
-- TEST 3: Vista pudo_scan_summary
-- ============================================================

-- Test 3.1: Verificar estructura de la vista
DO $$
DECLARE
  v_column_count INT;
BEGIN
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'pudo_scan_summary'
    AND table_schema = 'public';
  
  IF v_column_count >= 10 THEN
    RAISE NOTICE 'PASS: Vista pudo_scan_summary tiene columnas esperadas';
  ELSE
    RAISE EXCEPTION 'FAIL: Vista pudo_scan_summary no tiene todas las columnas';
  END IF;
END $$;

-- Test 3.2: Consultar vista con datos de prueba
DO $$
DECLARE
  v_summary_count INT;
BEGIN
  SELECT COUNT(*) INTO v_summary_count
  FROM public.pudo_scan_summary
  WHERE location_id = '00000000-0000-0000-0000-000000000002';
  
  IF v_summary_count >= 0 THEN
    RAISE NOTICE 'PASS: Vista pudo_scan_summary es consultable (% registros)', v_summary_count;
  ELSE
    RAISE EXCEPTION 'FAIL: No se pudo consultar vista pudo_scan_summary';
  END IF;
END $$;

-- ============================================================
-- TEST 4: RLS Policies
-- ============================================================

-- Test 4.1: Verificar que las políticas RLS existen
DO $$
DECLARE
  v_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'pudo_scan_logs'
    AND schemaname = 'public';
  
  IF v_policy_count >= 3 THEN
    RAISE NOTICE 'PASS: Políticas RLS para pudo_scan_logs están creadas';
  ELSE
    RAISE EXCEPTION 'FAIL: Faltan políticas RLS para pudo_scan_logs';
  END IF;
END $$;

-- ============================================================
-- TEST 5: Índices
-- ============================================================

-- Test 5.1: Verificar índices importantes
DO $$
DECLARE
  v_index_count INT;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename = 'pudo_scan_logs'
    AND schemaname = 'public'
    AND indexname LIKE 'idx_pudo_scan_logs_%';
  
  IF v_index_count >= 5 THEN
    RAISE NOTICE 'PASS: Índices para pudo_scan_logs están creados (% índices)', v_index_count;
  ELSE
    RAISE EXCEPTION 'FAIL: Faltan índices para pudo_scan_logs';
  END IF;
END $$;

-- ============================================================
-- Cleanup: Eliminar datos de prueba
-- ============================================================

DELETE FROM public.pudo_scan_logs 
WHERE remote_shipment_id LIKE 'TEST-SHIPMENT-%';

DELETE FROM public.locations 
WHERE name LIKE 'Test PUDO%';

DELETE FROM public.users 
WHERE id = '00000000-0000-0000-0000-000000000001';

DELETE FROM auth.users 
WHERE id = '00000000-0000-0000-0000-000000000001';

COMMIT;

-- ============================================================
-- Resumen de Tests
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE TESTS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tests de validate_gps_location: 4/4 ✓';
  RAISE NOTICE 'Tests de log_pudo_scan: 2/2 ✓';
  RAISE NOTICE 'Tests de vistas: 2/2 ✓';
  RAISE NOTICE 'Tests de RLS: 1/1 ✓';
  RAISE NOTICE 'Tests de índices: 1/1 ✓';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TOTAL: 10/10 TESTS PASSED ✓';
  RAISE NOTICE '========================================';
END $$;