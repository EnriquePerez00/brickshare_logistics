-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 013
-- Refactor: Eliminar owner_id, simplificar roles a admin/user
-- ============================================================

-- ============================================================
-- 1. CREAR TABLA user_locations (relación many-to-many)
-- ============================================================

CREATE TABLE public.user_locations (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

COMMENT ON TABLE public.user_locations IS 
  'Relación many-to-many: usuarios pueden trabajar en múltiples locations y viceversa.';

CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_location_id ON public.user_locations(location_id);

-- Habilitar RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. MIGRAR DATOS EXISTENTES: owner_id → user_locations
-- ============================================================

-- Migrar todos los owner_id actuales a la tabla user_locations
INSERT INTO public.user_locations (user_id, location_id)
SELECT owner_id, id 
FROM public.locations 
WHERE owner_id IS NOT NULL
ON CONFLICT (user_id, location_id) DO NOTHING;

-- ============================================================
-- 3. ELIMINAR TODAS LAS POLÍTICAS Y VISTAS QUE DEPENDEN DE owner_id
-- ============================================================

-- Eliminar políticas de locations que usan owner_id
DROP POLICY IF EXISTS "locations_owner_select" ON public.locations;
DROP POLICY IF EXISTS "locations_owner_insert" ON public.locations;
DROP POLICY IF EXISTS "locations_owner_update" ON public.locations;

-- Eliminar políticas de packages que usan owner_id
DROP POLICY IF EXISTS "packages_owner_select" ON public.packages;
DROP POLICY IF EXISTS "packages_owner_insert" ON public.packages;
DROP POLICY IF EXISTS "packages_owner_update" ON public.packages;
DROP POLICY IF EXISTS "packages_external_id_select" ON public.packages;

-- Eliminar políticas de package_events que usan owner_id
DROP POLICY IF EXISTS "package_events_owner_view" ON public.package_events;

-- Eliminar políticas de scan_errors que usan owner_id
DROP POLICY IF EXISTS "scan_errors_owner_view" ON public.scan_errors;

-- Eliminar políticas de pudo_scan_logs que usan owner_id  
DROP POLICY IF EXISTS "pudo_scan_logs_owner_view" ON public.pudo_scan_logs;
DROP POLICY IF EXISTS "pudo_scan_logs_owner_insert" ON public.pudo_scan_logs;

-- Eliminar vistas que dependen de owner_id
DROP VIEW IF EXISTS public.monthly_profitability;
DROP VIEW IF EXISTS public.pudo_operations_history;

-- Eliminar índice relacionado
DROP INDEX IF EXISTS idx_locations_owner_id;

-- Ahora sí podemos eliminar la columna owner_id
ALTER TABLE public.locations DROP COLUMN IF EXISTS owner_id;

-- ============================================================
-- 4. ACTUALIZAR CONSTRAINT DE ROLES: solo 'admin' y 'user'
-- ============================================================

-- Eliminar TODOS los constraints de role que puedan existir
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS public_users_role_check;

-- Ahora actualizar los roles sin constraint activo
UPDATE public.users 
SET role = 'user' 
WHERE role NOT IN ('admin', 'user');

-- Crear el nuevo constraint
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'user'));

-- Actualizar la función trigger handle_new_user para usar solo admin/user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')  -- default: 'user'
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. NUEVA FUNCIÓN HELPER: my_location_ids()
-- Retorna los IDs de locations asignados al usuario actual
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_location_ids()
RETURNS SETOF UUID 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id 
  FROM public.user_locations 
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_location_ids IS 
  'Retorna los location_ids asignados al usuario autenticado actual.';

-- ============================================================
-- 6. NUEVAS POLÍTICAS RLS PARA locations
-- ============================================================

-- USERS: Solo ven locations asignados a ellos
CREATE POLICY "locations_user_select"
  ON public.locations FOR SELECT
  USING (
    id IN (SELECT public.my_location_ids())
    OR public.my_role() = 'admin'
  );

-- ADMINS: Pueden insertar locations
CREATE POLICY "locations_admin_insert"
  ON public.locations FOR INSERT
  WITH CHECK (public.my_role() = 'admin');

-- ADMINS: Pueden actualizar locations
CREATE POLICY "locations_admin_update"
  ON public.locations FOR UPDATE
  USING (public.my_role() = 'admin')
  WITH CHECK (public.my_role() = 'admin');

-- ADMINS: Pueden eliminar locations (ya existía)
-- CREATE POLICY "locations_admin_delete" ya existe de migración anterior

-- ============================================================
-- 7. ACTUALIZAR POLÍTICAS RLS PARA packages
-- ============================================================

-- Eliminar políticas antiguas que usan owner_id
DROP POLICY IF EXISTS "packages_owner_select" ON public.packages;
DROP POLICY IF EXISTS "packages_owner_insert" ON public.packages;
DROP POLICY IF EXISTS "packages_owner_update" ON public.packages;
DROP POLICY IF EXISTS "packages_customer_select" ON public.packages;

-- USERS: Solo ven paquetes de SUS locations asignados
CREATE POLICY "packages_user_select"
  ON public.packages FOR SELECT
  USING (
    location_id IN (SELECT public.my_location_ids())
    OR public.my_role() = 'admin'
  );

-- USERS: Solo pueden insertar paquetes en SUS locations
CREATE POLICY "packages_user_insert"
  ON public.packages FOR INSERT
  WITH CHECK (
    location_id IN (SELECT public.my_location_ids())
    OR public.my_role() = 'admin'
  );

-- USERS: Solo pueden actualizar paquetes de SUS locations
CREATE POLICY "packages_user_update"
  ON public.packages FOR UPDATE
  USING (
    location_id IN (SELECT public.my_location_ids())
    OR public.my_role() = 'admin'
  )
  WITH CHECK (
    location_id IN (SELECT public.my_location_ids())
    OR public.my_role() = 'admin'
  );

-- La política packages_admin_all ya existe y cubre DELETE

-- ============================================================
-- 8. POLÍTICAS RLS PARA user_locations
-- ============================================================

-- USERS: Pueden ver sus propias asignaciones
CREATE POLICY "user_locations_self_select"
  ON public.user_locations FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.my_role() = 'admin'
  );

-- ADMINS: Control total sobre asignaciones
CREATE POLICY "user_locations_admin_all"
  ON public.user_locations FOR ALL
  USING (public.my_role() = 'admin')
  WITH CHECK (public.my_role() = 'admin');

-- ============================================================
-- 9. ACTUALIZAR VISTA monthly_profitability
-- Eliminar referencia a owner_id
-- ============================================================

CREATE OR REPLACE VIEW public.monthly_profitability
WITH (security_invoker = true)
AS
SELECT
  to_char(p.created_at, 'YYYY-MM')  AS month,
  l.id                               AS location_id,
  l.name                             AS location_name,
  l.commission_rate,
  COUNT(*)                           AS total_packages,
  COUNT(*) FILTER (WHERE p.status IN ('pending_dropoff', 'in_location'))
                                     AS active_packages,
  COUNT(*) FILTER (WHERE p.status = 'in_location')
                                     AS dropoffs,
  COUNT(*) FILTER (WHERE p.status = 'picked_up')
                                     AS pickups,
  SUM(l.commission_rate) FILTER (WHERE p.status = 'picked_up')
                                     AS profitability
FROM public.packages   p
JOIN public.locations  l ON l.id = p.location_id
GROUP BY
  to_char(p.created_at, 'YYYY-MM'),
  l.id, l.name, l.commission_rate
ORDER BY month DESC, l.name;

COMMENT ON VIEW public.monthly_profitability IS
  'Pre-calcula entregas, recogidas y rentabilidad mensual por local. Respeta RLS (users ven solo sus locations asignados).';

-- ============================================================
-- 10. ACTUALIZAR VISTA pudo_operations_history
-- Eliminar referencia a owner_id
-- ============================================================

CREATE OR REPLACE VIEW public.pudo_operations_history
WITH (security_invoker = true)
AS
SELECT
  psl.id,
  psl.scan_timestamp,
  psl.remote_shipment_id as tracking_code,
  psl.action_type,
  psl.previous_status,
  psl.new_status,
  psl.api_request_successful as result,
  psl.pudo_location_id,
  -- Información del operador
  u.first_name || ' ' || u.last_name as operator_name,
  u.first_name as operator_first_name,
  u.last_name as operator_last_name,
  u.id as operator_id,
  -- Información del local
  l.name as location_name,
  -- Formato amigable del tipo de acción
  CASE psl.action_type
    WHEN 'delivery_confirmation' THEN 'Entrega confirmada'
    WHEN 'return_confirmation' THEN 'Devolución recibida'
    ELSE psl.action_type::TEXT
  END as action_type_label,
  -- Transición de estados formateada
  psl.previous_status || ' → ' || psl.new_status as status_transition
FROM public.pudo_scan_logs psl
JOIN public.users u ON u.id = psl.scanned_by_user_id
JOIN public.locations l ON l.id = psl.pudo_location_id
ORDER BY psl.scan_timestamp DESC;

COMMENT ON VIEW public.pudo_operations_history IS 
  'Historial simplificado de operaciones PUDO con operador y resultado. Respeta RLS (users ven solo sus locations).';

-- ============================================================
-- 11. ACTUALIZAR POLÍTICAS RLS DE users
-- Eliminar referencias a 'owner' en comentarios y lógica
-- ============================================================

-- La política users_update_own ya existe y no necesita cambios
-- Solo aseguramos que no hay referencias a roles obsoletos

-- ============================================================
-- FIN DE MIGRACIÓN 013
-- ============================================================

-- Verificación post-migración
DO $$
DECLARE
  v_user_locations_count INTEGER;
  v_old_roles_count INTEGER;
BEGIN
  -- Contar registros en user_locations
  SELECT COUNT(*) INTO v_user_locations_count FROM public.user_locations;
  RAISE NOTICE 'user_locations creado con % asignaciones', v_user_locations_count;
  
  -- Verificar que no quedan roles obsoletos
  SELECT COUNT(*) INTO v_old_roles_count 
  FROM public.users 
  WHERE role NOT IN ('admin', 'user');
  
  IF v_old_roles_count > 0 THEN
    RAISE EXCEPTION 'Aún existen % usuarios con roles obsoletos', v_old_roles_count;
  END IF;
  
  RAISE NOTICE 'Migración 013 completada exitosamente';
END $$;