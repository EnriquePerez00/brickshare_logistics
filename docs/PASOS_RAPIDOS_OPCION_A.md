# ⚡ Pasos Rápidos: Opción A - Automática

**Objetivo**: Ejecutar script SQL para crear usuario owner + location y resolver el error

---

## 🚀 Ejecución en 3 Minutos

### Paso 1: Abrir Supabase SQL Editor

1. Ir a: **https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/sql/new**
2. Debería abrirse automáticamente el SQL Editor vacío

### Paso 2: Copiar el Script SQL

El script está en: **`scripts/setup-test-owner.sql`**

**Contenido a copiar** (primeras queries relevantes):

```sql
-- 1. Ver usuarios existentes
SELECT 'STEP 1: Usuarios Existentes' AS step;
SELECT id, email, role FROM public.users LIMIT 10;

-- 2. Ver último usuario para actualizar
SELECT 'STEP 2: Usuario a actualizar' AS step;
SELECT id, email, role FROM public.users ORDER BY created_at DESC LIMIT 1;

-- 3. Actualizar rol a 'owner' (IMPORTANTE - descomentar si es necesario)
UPDATE public.users SET role = 'owner' WHERE email = 'your-email@example.com';

-- 4. Crear location para el owner
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

-- 5. Verificar location creada
SELECT 
  l.id,
  l.pudo_id,
  l.name,
  l.address,
  u.email
FROM public.locations l
JOIN public.users u ON l.owner_id = u.id;
```

### Paso 3: Pegar en SQL Editor

1. Copiar el código anterior
2. Pegar en el SQL Editor de Supabase (ventana blanca)
3. **Presionar: `Cmd+Enter` o botón "Run"**

### Paso 4: Verificar Resultados

Deberías ver:

✅ **STEP 1**: Lista de usuarios (ej: test@example.com con rol actual)
✅ **STEP 2**: Último usuario creado
✅ **Ubicación creada**: Verás el PUDO creado con `pudo_id = 'brickshare-XXX'`

---

## ⚠️ Puntos Importantes

### Si el usuario NO es "owner"

Verás en STEP 2 algo como:
```
id = "abc123"
email = "test@example.com"
role = "admin"  ← ❌ Debe ser "owner"
```

**Solución**: Ejecutar esta query con el email correcto:
```sql
UPDATE public.users SET role = 'owner' 
WHERE email = 'test@example.com';
```

### Si No Hay Usuarios

Si STEP 1 no devuelve nada, significa que NO hay usuario autenticado aún en la BD. 

**Solución**:
1. Iniciar sesión en la app móvil primero
2. Esto crea automáticamente el usuario en `public.users`
3. Luego ejecutar el script SQL

### Si Location NO se Crea

Si STEP 5 no devuelve registros después de INSERT, probablemente:
- El usuario no tiene rol "owner"
- RLS policy está bloqueando el INSERT

**Solución**: Ejecutar con `service_role_key` en lugar de `anon_key` (ver sección "Debug Avanzado")

---

## ✅ Después de Ejecutar

Una vez que el script corra exitosamente:

1. **Cerrar completamente la app móvil** (swipe to close en simulador)
2. **Reabrirla**
3. **Iniciar sesión nuevamente**
4. **Escanear**: `BS-DEL-7A2D335C-8FA`
5. **Resultado esperado**: 
   - ✅ Mensaje "Recepcionado ✅"
   - ✅ Registros aparecen en `packages` y `pudo_scan_logs`

---

## 🔍 Debug Avanzado (Si Aún Falla)

### Verificar que el usuario es "owner"

```sql
SELECT id, email, role FROM public.users WHERE email = 'your-email@example.com';
```

Debe mostrar `role = 'owner'`

### Verificar que location existe

```sql
SELECT l.id, l.pudo_id, l.name, l.owner_id 
FROM public.locations l
WHERE l.owner_id = 'the-owner-id-from-step-above';
```

Debe devolver 1 fila

### Verificar RLS Policies

```sql
SELECT 
  table_name,
  policyname,
  permissive
FROM pg_policies
WHERE table_name IN ('packages', 'pudo_scan_logs')
ORDER BY table_name, policyname;
```

---

## 📞 Si Sigue Sin Funcionar

**Haz esto y comparte los resultados:**

1. Ejecutar STEP 1 del script (ver usuarios)
2. Ejecutar STEP 2 (ver último usuario)
3. Compartir el `email` y `role` del usuario
4. Ejecutar STEP 4 y STEP 5 (ver location)
5. Compartir si location se creó o no

Con esa información podemos debuggear exactamente qué falla.

---

**✅ Tiempo estimado: 2-3 minutos**