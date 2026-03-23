INSERT INTO public.users (id, email, role, first_name, last_name)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'role', 'customer'),
  COALESCE(raw_user_meta_data->>'first_name', ''),
  COALESCE(raw_user_meta_data->>'last_name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET role = 'admin' WHERE email = 'admin@brickshare.eu';
