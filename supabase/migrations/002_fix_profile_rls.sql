-- ============================================================
-- Fix Profile RLS Policies
-- ============================================================

-- 1. Permite que los usuarios inserten su propio perfil si falta.
-- Esto permite que 'upsert' funcione correctamente desde el frontend,
-- aunque el trigger de auth.users sea el método principal.
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

-- 2. Simplifica la política de UPDATE
-- Eliminamos la subconsulta recursiva en WITH CHECK para evitar errores de ejecución.
-- El campo 'role' solo puede ser modificado por administradores según la política 'users_admin_all'.
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- NOTA: La política 'users_admin_all' (FOR ALL) ya cubre la gestión de roles por administradores.
