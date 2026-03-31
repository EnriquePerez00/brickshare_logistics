-- ============================================================
-- BRICKSHARE LOGISTICS — Seed Test Data
-- 100 paquetes de prueba distribuidos en 2 meses
-- INSTRUCCIONES: Copiar y pegar este script en el SQL Editor de Supabase
-- ============================================================

-- IMPORTANTE: Este script debe ejecutarse después de que todas las migraciones
-- estén aplicadas (001 a 009)

DO $$
DECLARE
  v_owner_id UUID;
  v_location_id UUID;
  v_package_id UUID;
  v_tracking_code TEXT;
  v_status TEXT;
  v_created_date TIMESTAMPTZ;
  v_scan_date TIMESTAMPTZ;
  v_base_date TIMESTAMPTZ := now() - INTERVAL '60 days';
  i INTEGER;
  v_random_days INTEGER;
  v_random_hours INTEGER;
BEGIN
  RAISE NOTICE 'Starting seed data creation...';
  
  -- 1. Buscar usuario "paco pil" existente
  SELECT id INTO v_owner_id
  FROM public.users
  WHERE first_name ILIKE '%paco%' AND last_name ILIKE '%pil%'
  LIMIT 1;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Usuario "paco pil" no encontrado. Por favor verifica que existe en la base de datos.';
  END IF;
  
  RAISE NOTICE 'Using user "paco pil": %', v_owner_id;
  
  -- 2. Buscar o crear location
  SELECT l.id INTO v_location_id
  FROM public.locations l
  JOIN public.user_locations ul ON ul.location_id = l.id
  WHERE ul.user_id = v_owner_id
  LIMIT 1;
  
  IF v_location_id IS NULL THEN
    -- Si no existe, crear una nueva
    INSERT INTO public.locations (
      name,
      address,
      commission_rate,
      is_active,
      latitude,
      longitude,
      gps_validation_radius_meters
    )
    VALUES (
      'PUDO Test Center - Madrid Centro',
      'Calle Gran Vía 45, 28013 Madrid',
      0.35,
      true,
      40.4200,
      -3.7038,
      100
    )
    RETURNING id INTO v_location_id;
    
    -- Vincular usuario a la nueva localización
    INSERT INTO public.user_locations (user_id, location_id)
    VALUES (v_owner_id, v_location_id);
    
    RAISE NOTICE 'Location created and linked: %', v_location_id;
  ELSE
    RAISE NOTICE 'Using existing location: %', v_location_id;
  END IF;
  
  -- 3. Generar 100 paquetes con diferentes estados
  FOR i IN 1..100 LOOP
    -- Generar tracking code único
    v_tracking_code := 'TEST' || LPAD(i::TEXT, 6, '0');
    
    -- Fecha aleatoria en los últimos 60 días
    v_random_days := floor(random() * 60)::INTEGER;
    v_random_hours := floor(random() * 24)::INTEGER;
    v_created_date := v_base_date + (v_random_days || ' days')::INTERVAL + (v_random_hours || ' hours')::INTERVAL;
    
    -- Distribuir estados:
    -- 10% pending_dropoff (1-10)
    -- 20% in_location (11-30)
    -- 60% picked_up (31-90)
    -- 10% returned (91-100)
    CASE
      WHEN i <= 10 THEN
        v_status := 'pending_dropoff';
      WHEN i <= 30 THEN
        v_status := 'in_location';
      WHEN i <= 90 THEN
        v_status := 'picked_up';
      ELSE
        v_status := 'returned';
    END CASE;
    
    -- Insertar paquete
    INSERT INTO public.packages (
      tracking_code,
      status,
      location_id,
      customer_id,
      created_at,
      updated_at
    )
    VALUES (
      v_tracking_code,
      v_status::package_status,
      v_location_id,
      v_owner_id,
      v_created_date,
      v_created_date
    )
    RETURNING id INTO v_package_id;
    
    -- Crear logs de escaneo para estados después de pending_dropoff
    IF v_status IN ('in_location', 'picked_up', 'returned') THEN
      -- Log 1: Entrega en PUDO
      v_scan_date := v_created_date + INTERVAL '1 hour';
      
      INSERT INTO public.pudo_scan_logs (
        pudo_location_id,
        remote_shipment_id,
        previous_status,
        new_status,
        scanned_by_user_id,
        action_type,
        scan_timestamp,
        scan_latitude,
        scan_longitude,
        gps_accuracy_meters,
        gps_validation_passed,
        api_request_successful,
        api_response_code,
        api_response_message,
        api_request_duration_ms,
        metadata,
        created_at
      )
      VALUES (
        v_location_id,
        v_tracking_code,
        'pending_dropoff',
        'in_location',
        v_owner_id,
        'delivery_confirmation'::pudo_action_type,
        v_scan_date,
        40.4200 + (random() * 0.001 - 0.0005),
        -3.7038 + (random() * 0.001 - 0.0005),
        (5 + random() * 15)::NUMERIC(8,2),
        true,
        true,
        200,
        'Package delivered to PUDO',
        (150 + floor(random() * 200))::INTEGER,
        jsonb_build_object('device_info', 'iOS 17.1 / iPhone 14 Pro', 'app_version', '1.0.0'),
        v_scan_date
      );
    END IF;
    
    IF v_status IN ('picked_up', 'returned') THEN
      -- Log 2: Recogida del PUDO
      v_scan_date := v_created_date + INTERVAL '1 day' + (floor(random() * 48)::INTEGER || ' hours')::INTERVAL;
      
      INSERT INTO public.pudo_scan_logs (
        pudo_location_id,
        remote_shipment_id,
        previous_status,
        new_status,
        scanned_by_user_id,
        action_type,
        scan_timestamp,
        scan_latitude,
        scan_longitude,
        gps_accuracy_meters,
        gps_validation_passed,
        api_request_successful,
        api_response_code,
        api_response_message,
        api_request_duration_ms,
        metadata,
        created_at
      )
      VALUES (
        v_location_id,
        v_tracking_code,
        'in_location',
        v_status,
        v_owner_id,
        CASE WHEN v_status = 'returned' THEN 'return_confirmation' ELSE 'delivery_confirmation' END::pudo_action_type,
        v_scan_date,
        40.4200 + (random() * 0.001 - 0.0005),
        -3.7038 + (random() * 0.001 - 0.0005),
        (5 + random() * 15)::NUMERIC(8,2),
        true,
        true,
        200,
        'Package picked up from PUDO',
        (150 + floor(random() * 200))::INTEGER,
        jsonb_build_object('device_info', 'iOS 17.1 / iPhone 14 Pro', 'app_version', '1.0.0'),
        v_scan_date
      );
    END IF;
    
    -- Log progreso cada 25 paquetes
    IF i % 25 = 0 THEN
      RAISE NOTICE 'Created % packages...', i;
    END IF;
  END LOOP;
  
  -- Resumen final
  RAISE NOTICE '=== SEED DATA COMPLETED ===';
  RAISE NOTICE 'User "paco pil": %', v_owner_id;
  RAISE NOTICE 'Location: %', v_location_id;
  RAISE NOTICE '';
  RAISE NOTICE '=== Package Status Summary ===';
  RAISE NOTICE 'pending_dropoff: %', (SELECT COUNT(*) FROM public.packages WHERE status = 'pending_dropoff' AND location_id = v_location_id);
  RAISE NOTICE 'in_location: %', (SELECT COUNT(*) FROM public.packages WHERE status = 'in_location' AND location_id = v_location_id);
  RAISE NOTICE 'picked_up: %', (SELECT COUNT(*) FROM public.packages WHERE status = 'picked_up' AND location_id = v_location_id);
  RAISE NOTICE 'returned: %', (SELECT COUNT(*) FROM public.packages WHERE status = 'returned' AND location_id = v_location_id);
  RAISE NOTICE 'Total: %', (SELECT COUNT(*) FROM public.packages WHERE location_id = v_location_id);
  RAISE NOTICE 'Total scan logs: %', (SELECT COUNT(*) FROM public.pudo_scan_logs WHERE pudo_location_id = v_location_id);
  RAISE NOTICE '';
  RAISE NOTICE '✅ You can now access the dashboard at /dashboard?impersonate=%', v_owner_id;
  
END $$;