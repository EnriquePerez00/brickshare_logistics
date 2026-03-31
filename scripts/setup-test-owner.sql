-- ============================================================
-- Setup: Crear usuario OWNER y location para testing
-- ============================================================
-- Ejecutar este script en Supabase SQL Editor en:
-- https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/sql

-- ─────────────────────────────────────────────────────────────
-- 1. VERIFICAR USUARIOS EXISTENTES
-- ─────────────────────────────────────────────────────────────
SELECT 'STEP 1: Usuarios Existentes' AS step;
SELECT id, email, role FROM public.users LIMIT 10;

-- ─────────────────────────────────────────────────────────────
-- 2. CREAR USUARIO OWNER (si no existe)
-- ─────────────────────────────────────────────────────────────
-- NOTA: Si tienes un usuario existente, actualiza su role a 'owner'

-- Opción A: Crear nuevo usuario owner en auth.users
-- (Requiere acceso admin o crear manualmente en Authentication → Users)
-- INSERT INTO auth.users (...) VALUES (...) -- NO RECOMENDADO

-- Opción B: Actualizar usuario existente a owner
-- Primero, ver qué usuario tienes:
SELECT 'STEP 2: Usuario a actualizar' AS step;
SELECT id, email, role FROM public.users ORDER BY created_at DESC LIMIT 1;

-- Si tienes un usuario (ej: test@example.com), actualiza su role:
-- UPDATE public.users SET role = 'owner' WHERE email = 'test@example.com';

-- ─────────────────────────────────────────────────────────────
-- 3. CREAR LOCATION PARA EL OWNER
-- ─────────────────────────────────────────────────────────────
-- Reemplaza <OWNER_ID> con el ID real del usuario owner
-- Puedes obtenerlo del paso anterior

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
LIMIT 1;

-- ─────────────────────────────────────────────────────────────
-- 4. VERIFICAR LOCATION CREADA
-- ─────────────────────────────────────────────────────────────
SELECT 'STEP 4: Locations para owners' AS step;
SELECT 
  l.id,
  l.pudo_id,
  l.name,
  l.address,
  l.latitude,
  l.longitude,
  l.gps_validation_radius_meters,
  u.email
FROM public.locations l
JOIN public.users u ON l.owner_id = u.id
WHERE u.role = 'owner';

-- ─────────────────────────────────────────────────────────────
-- 5. VERIFICAR RLS POLICIES
-- ─────────────────────────────────────────────────────────────
SELECT 'STEP 5: RLS Policies en packages' AS step;
SELECT 
  table_name,
  policyname,
  permissive,
  roles,
  qual,
  check_qual
FROM pg_policies
WHERE table_name = 'packages'
ORDER BY policyname;

SELECT 'STEP 6: RLS Policies en pudo_scan_logs' AS step;
SELECT 
  table_name,
  policyname,
  permissive,
  roles,
  qual,
  check_qual
FROM pg_policies
WHERE table_name = 'pudo_scan_logs'
ORDER BY policyname;

-- ─────────────────────────────────────────────────────────────
-- 6. VERIFICAR QUE TABLAS EXISTEN
-- ─────────────────────────────────────────────────────────────
SELECT 'STEP 7: Tablas críticas' AS step;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'locations', 'packages', 'pudo_scan_logs')
ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────
-- 7. LIMPIAR DATOS DE PRUEBA PREVIOS (OPCIONAL)
-- ─────────────────────────────────────────────────────────────
-- Descomenta si quieres limpiar pruebas anteriores
-- DELETE FROM public.pudo_scan_logs;
-- DELETE FROM public.packages;

-- ─────────────────────────────────────────────────────────────
-- 8. VERIFICAR BD VACÍA DESPUÉS DE LIMPIAR
-- ─────────────────────────────────────────────────────────────
SELECT 'STEP 8: Estado de tablas' AS step;
SELECT 
  'packages' as table_name,
  COUNT(*) as row_count
FROM public.packages
UNION ALL
SELECT 
  'pudo_scan_logs' as table_name,
  COUNT(*) as row_count
FROM public.pudo_scan_logs;