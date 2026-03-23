-- ============================================================
-- BRICKSHARE LOGISTICS — Migration 001
-- Esquema principal + RLS + Vista de Rentabilidad
-- ============================================================

-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid() y encode

-- ============================================================
-- 2. TABLA: users
-- Extiende auth.users de Supabase con datos de perfil
-- ============================================================
CREATE TABLE public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('admin', 'owner', 'customer')),
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  email        TEXT,
  phone        TEXT DEFAULT '+34 ',
  address      TEXT NOT NULL DEFAULT '',
  postal_code  TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Perfiles de usuario. Extiende auth.users.';
COMMENT ON COLUMN public.users.role IS 'admin | owner | customer';

-- Función trigger: crea automáticamente un perfil en public.users
-- cuando se registra un nuevo usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. TABLA: locations
-- Puntos de conveniencia gestionados por owners
-- ============================================================
CREATE TABLE public.locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  address          TEXT NOT NULL,
  commission_rate  NUMERIC(10,2) NOT NULL DEFAULT 0.35
                     CHECK (commission_rate >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.locations IS 'Puntos de conveniencia (locales comerciales).';
COMMENT ON COLUMN public.locations.commission_rate IS 'Comisión por paquete en EUR.';

CREATE INDEX idx_locations_owner_id ON public.locations(owner_id);

-- ============================================================
-- 4. TABLA: packages
-- Paquetes gestionados en los puntos de conveniencia
-- ============================================================
CREATE TYPE package_status AS ENUM (
  'pending_dropoff',
  'in_location',
  'picked_up',
  'returned'
);

CREATE TABLE public.packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code    TEXT NOT NULL UNIQUE,
  status           package_status NOT NULL DEFAULT 'pending_dropoff',
  location_id      UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  customer_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dynamic_qr_hash  TEXT,          -- JWT/hash generado por Edge Function
  qr_expires_at    TIMESTAMPTZ,   -- Expiración del QR dinámico (5 min)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.packages IS 'Paquetes en tránsito a través de los puntos de conveniencia.';
COMMENT ON COLUMN public.packages.dynamic_qr_hash IS 'Hash/JWT para entrega. Generado por generate-dynamic-qr.';
COMMENT ON COLUMN public.packages.qr_expires_at IS 'Expiración del QR. Válido 5 minutos desde generación.';

CREATE INDEX idx_packages_location_id  ON public.packages(location_id);
CREATE INDEX idx_packages_customer_id  ON public.packages(customer_id);
CREATE INDEX idx_packages_status       ON public.packages(status);
CREATE INDEX idx_packages_tracking     ON public.packages(tracking_code);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 5. ACTIVAR ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. FUNCIÓN HELPER: obtener el role del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ============================================================
-- 7. POLÍTICAS RLS — tabla: users
-- ============================================================

-- Cualquier usuario autenticado puede leer su propio perfil
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.my_role() = 'admin');

-- Solo puede actualizar su propio perfil (no el role)
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid()));

-- Solo admins pueden gestionar todos los usuarios
CREATE POLICY "users_admin_all"
  ON public.users FOR ALL
  USING (public.my_role() = 'admin');

-- ============================================================
-- 8. POLÍTICAS RLS — tabla: locations
-- ============================================================

-- Owners: solo ven sus propios locales
CREATE POLICY "locations_owner_select"
  ON public.locations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.my_role() = 'admin'
  );

-- Owners: pueden insertar locales propios
CREATE POLICY "locations_owner_insert"
  ON public.locations FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND public.my_role() IN ('owner', 'admin')
  );

-- Owners: pueden actualizar sus propios locales
CREATE POLICY "locations_owner_update"
  ON public.locations FOR UPDATE
  USING (owner_id = auth.uid() OR public.my_role() = 'admin')
  WITH CHECK (owner_id = auth.uid() OR public.my_role() = 'admin');

-- Solo admins pueden eliminar locales
CREATE POLICY "locations_admin_delete"
  ON public.locations FOR DELETE
  USING (public.my_role() = 'admin');

-- ============================================================
-- 9. POLÍTICAS RLS — tabla: packages
-- ============================================================

-- OWNERS: Solo ven paquetes de SUS locales
CREATE POLICY "packages_owner_select"
  ON public.packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = packages.location_id
        AND l.owner_id = auth.uid()
    )
    OR public.my_role() = 'admin'
  );

-- OWNERS: Solo pueden insertar paquetes en SUS locales
CREATE POLICY "packages_owner_insert"
  ON public.packages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = location_id
        AND l.owner_id = auth.uid()
    )
    OR public.my_role() = 'admin'
  );

-- OWNERS: Solo pueden actualizar (status) paquetes de SUS locales
CREATE POLICY "packages_owner_update"
  ON public.packages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = packages.location_id
        AND l.owner_id = auth.uid()
    )
    OR public.my_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = packages.location_id
        AND l.owner_id = auth.uid()
    )
    OR public.my_role() = 'admin'
  );

-- CUSTOMERS: Solo ven SUS paquetes
CREATE POLICY "packages_customer_select"
  ON public.packages FOR SELECT
  USING (customer_id = auth.uid());

-- ADMINS: Política de bypass (acceso total)
-- (Las políticas de owner/customer ya incluyen 'OR admin', pero
--  esta política explícita cubre DELETE y otros casos)
CREATE POLICY "packages_admin_all"
  ON public.packages FOR ALL
  USING (public.my_role() = 'admin');

-- ============================================================
-- 10. VISTA: monthly_profitability
-- Pre-calcula métricas mensuales por local para el dashboard
-- El frontend solo necesita un SELECT sobre esta vista
-- ============================================================
CREATE OR REPLACE VIEW public.monthly_profitability
WITH (security_invoker = true)   -- respeta RLS del usuario que consulta
AS
SELECT
  to_char(p.created_at, 'YYYY-MM')  AS month,
  l.id                               AS location_id,
  l.name                             AS location_name,
  l.owner_id,
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
  l.id, l.name, l.owner_id, l.commission_rate
ORDER BY month DESC, l.name;

COMMENT ON VIEW public.monthly_profitability IS
  'Pre-calcula entregas, recogidas y rentabilidad mensual por local. Respeta RLS.';

-- ============================================================
-- FIN DE MIGRACIÓN 001
-- ============================================================
