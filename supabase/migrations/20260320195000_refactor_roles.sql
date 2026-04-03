-- 1. Eliminar el constraint antiguo primero para permitir la migración de datos
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Intentamos forzar la eliminación del constraint basándonos en su nombre más probable
-- En 001_schema.sql se definió inline, así que el nombre suele ser "users_role_check"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    END IF;
END $$;

-- 2. Actualizar roles existentes: owner y customer se convierten en "usuarios"
UPDATE public.users 
SET role = 'usuarios' 
WHERE role IN ('owner', 'customer', 'user');

-- 3. Añadir el nuevo constraint
ALTER TABLE public.users 
ADD CONSTRAINT public_users_role_check 
CHECK (role IN ('admin', 'usuarios'));

-- 3. Actualizar el valor por defecto de la columna role
ALTER TABLE public.users 
ALTER COLUMN role SET DEFAULT 'usuarios';

-- 4. Actualizar la función handle_new_user para usar 'usuarios' como default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') = 'admin' THEN 'admin'
      ELSE 'usuarios'
    END
  );
  RETURN NEW;
END;
$$;

-- 5. Actualizar políticas RLS que referencien roles antiguos
-- Nota: owner_id fue eliminado en la migración 013, así que no se puede usar aquí
-- Las políticas de locations ya están actualizadas en migraciones posteriores
DROP POLICY IF EXISTS "locations_owner_insert" ON public.locations;
