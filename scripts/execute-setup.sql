-- ============================================================
-- Setup Automático: Crear usuario OWNER + LOCATION
-- ============================================================

-- PASO 1: Ver usuarios existentes
SELECT 'STEP 1: Usuarios Existentes' AS step;
SELECT id, email, role FROM public.users LIMIT 10;

-- PASO 2: Ver último usuario para actualizar
SELECT 'STEP 2: Usuario a Actualizar' AS step;
SELECT id, email, role FROM public.users ORDER BY created_at DESC LIMIT 1;

-- PASO 3: Actualizar rol a 'owner' (el último usuario creado)
UPDATE public.users SET role = 'owner' 
WHERE id = (SELECT id FROM public.users ORDER BY created_at DESC LIMIT 1)
AND role != 'owner';

-- PASO 4: Crear location para el owner
INSERT INTO public.locations (
  owner_id,
  name,
  location_name,
  address,
  city,
  postal_code,
  latitude,
  longitude,
  gps_validation_radius_meters,
  commission_rate,
  is_active,
  created_at,
  updated_at
) 
SELECT 
  id,
  'Test PUDO - Madrid',
  'PUDO Test Location',
  'Calle Principal 123',
  'Madrid',
  '28001',
  41.3851,
  2.1734,
  500,
  0.50,
  true,
  NOW(),
  NOW()
FROM public.users
WHERE role = 'owner'
  AND id NOT IN (SELECT DISTINCT owner_id FROM public.locations)
LIMIT 1
ON CONFLICT DO NOTHING;

-- PASO 5: Verificar que location se creó
SELECT 'STEP 5: Location Creada' AS step;
SELECT 
  l.id,
  l.pudo_id,
  l.name,
  l.address,
  l.latitude,
  l.longitude,
  u.email,
  u.role
FROM public.locations l
JOIN public.users u ON l.owner_id = u.id
WHERE u.role = 'owner'
ORDER BY l.created_at DESC
LIMIT 1;

-- PASO 6: Verificar estado de packages y package_events
SELECT 'STEP 6: Estado de Tablas' AS step;
SELECT
  'packages' as table_name,
  COUNT(*) as row_count
FROM public.packages
UNION ALL
SELECT
  'package_events' as table_name,
  COUNT(*) as row_count
FROM public.package_events;

-- NOTA: pudo_scan_logs fue eliminada en migration 022

-- PASO 7: Mostrar confirmación
SELECT 'STEP 7: SETUP COMPLETADO ✅' AS result;