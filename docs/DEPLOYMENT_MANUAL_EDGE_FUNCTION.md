# Deployment Manual de Edge Function - process-pudo-scan

## 🚨 Problema

El CLI de Supabase no puede hacer link al proyecto debido a permisos de API. Necesitamos hacer el deployment manualmente desde el Dashboard.

## ✅ Cambios Ya Implementados

### 1. Edge Function Actualizada
- **Archivo**: `supabase/functions/process-pudo-scan/index.ts`
- **Cambio**: URLs hardcodeadas eliminadas, ahora usa variables de entorno
- **Estado**: ✅ Código actualizado localmente

### 2. Variables de Entorno Configuradas Localmente
- **Archivo**: `supabase/functions/process-pudo-scan/.env.local`
- **Variables configuradas**:
  - `REMOTE_DB_URL` = URL de ngrok
  - `REMOTE_DB_SERVICE_KEY` = Service role key de DB2 local
  - `BRICKSHARE_API_URL` = URL de ngrok (alternativa)
  - `BRICKSHARE_SERVICE_ROLE_KEY` = Service role key (alternativa)

## 🎯 Pasos para Deployment Manual

### Paso 1: Iniciar Ngrok (si no está corriendo)

```bash
ngrok http 54331
```

Anota la URL generada (ejemplo: `https://1a23-456-789-10.ngrok-free.app`)

### Paso 2: Configurar Secrets en Supabase Cloud Dashboard

1. Ve al Dashboard: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/settings/vault

2. Agrega los siguientes secrets (Edge Function Secrets):
   
   **REMOTE_DB_URL**
   ```
   https://1a23-456-789-10.ngrok-free.app
   ```
   (Reemplaza con tu URL actual de ngrok)
   
   **REMOTE_DB_SERVICE_KEY**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   ```
   
   **BRICKSHARE_API_URL** (alternativa)
   ```
   https://1a23-456-789-10.ngrok-free.app
   ```
   
   **BRICKSHARE_SERVICE_ROLE_KEY** (alternativa)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   ```

### Paso 3: Deploy de Edge Function desde Dashboard

**Opción A: Deploy Directo desde Dashboard**

1. Ve a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions

2. Encuentra la función `process-pudo-scan`

3. Click en "Edit" o "Deploy new version"

4. Copia el contenido completo de `supabase/functions/process-pudo-scan/index.ts`

5. Pégalo en el editor del dashboard

6. Click en "Deploy"

**Opción B: Deploy via CLI con Supabase CLI Global**

Si tienes acceso al proyecto desde otra cuenta o con diferentes permisos:

```bash
# Instalar CLI globalmente si no lo tienes
npm install -g supabase

# Login con cuenta que tenga permisos
supabase login

# Link al proyecto
supabase link --project-ref qumjzvhtotcvnzpjgjkl

# Deploy
supabase functions deploy process-pudo-scan
```

### Paso 4: Verificar Secrets Configurados

1. Ve a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/settings/vault

2. Verifica que estén todos los secrets:
   - ✅ REMOTE_DB_URL
   - ✅ REMOTE_DB_SERVICE_KEY
   - ✅ BRICKSHARE_API_URL
   - ✅ BRICKSHARE_SERVICE_ROLE_KEY

### Paso 5: Test de Edge Function

Una vez deployada, prueba con curl:

```bash
curl -X POST \
  https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-Dev-Bypass: true" \
  -d '{
    "scanned_code": "BS-DEL-714C3F3D-FFD",
    "scan_mode": "dropoff"
  }'
```

Reemplaza `YOUR_ANON_KEY` con:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ
```

## 🔧 Solución al JWT Missing SUB

El problema del "missing sub claim" es independiente del deployment de la Edge Function. Las soluciones son:

### Solución 1: Verificar Usuario en DB1 Cloud

1. Ve a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/auth/users

2. Verifica que existe el usuario `user@brickshare.eu`

3. Si no existe, créalo:
   - Email: `user@brickshare.eu`
   - Password: `usertest`
   - Email Confirmed: ✅ Sí
   - Auto Confirm User: ✅ Sí

4. Ve a Table Editor → users table y verifica que hay un registro con el mismo ID

5. Si no existe el registro en `users`:
   ```sql
   INSERT INTO users (id, email, role, first_name, last_name, phone)
   VALUES (
     'USER_ID_FROM_AUTH',  -- Reemplaza con el ID del usuario de auth
     'user@brickshare.eu',
     'usuarios',
     'Test',
     'User',
     '+34600000000'
   );
   ```

6. Verifica ubicación PUDO en `locations`:
   ```sql
   SELECT * FROM locations WHERE owner_id = 'USER_ID_FROM_AUTH';
   ```

   Si no existe:
   ```sql
   INSERT INTO locations (
     id,
     owner_id,
     name,
     pudo_id,
     address,
     city,
     postal_code,
     country,
     latitude,
     longitude,
     gps_validation_radius_meters,
     status
   ) VALUES (
     gen_random_uuid(),
     'USER_ID_FROM_AUTH',  -- Reemplaza con el ID del usuario
     'PUDO Test Location',
     'PUDO-TEST-001',
     'Calle de Prueba, 123',
     'Madrid',
     '28001',
     'España',
     40.4168,
     -3.7038,
     100,
     'active'
   );
   ```

### Solución 2: Re-login en la App

1. En la app móvil, hacer logout completo
2. Cerrar la app completamente (kill process)
3. Abrir la app de nuevo
4. Login con `user@brickshare.eu / usertest`
5. Intentar escanear QR

### Solución 3: Verificar JWT Manualmente

Agrega logs temporales en `apps/mobile/src/services/pudoService.ts` línea ~140:

```typescript
const session = await supabase.auth.getSession()
const token = session.data.session?.access_token

console.log('🔍 JWT Token:', token?.substring(0, 50) + '...')

// Decodificar payload
if (token) {
  const parts = token.split('.')
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]))
    console.log('🔍 JWT Payload:', JSON.stringify(payload, null, 2))
    console.log('🔍 Has sub claim?:', !!payload.sub)
    console.log('🔍 Sub value:', payload.sub)
  }
}
```

Luego recompila la app y mira los logs al hacer login.

## 📝 Código de la Edge Function Actualizada

El código completo está en `supabase/functions/process-pudo-scan/index.ts`:

```typescript
// Configuración de conexión a la DB remota (DB2 Brickshare)
const REMOTE_DB_URL = Deno.env.get('REMOTE_DB_URL') || Deno.env.get('BRICKSHARE_API_URL') || ''
const REMOTE_DB_KEY = Deno.env.get('REMOTE_DB_SERVICE_KEY') || Deno.env.get('BRICKSHARE_SERVICE_ROLE_KEY') || ''
```

**Cambios clave:**
- ❌ Eliminadas URLs hardcodeadas
- ✅ Usa variables de entorno dinámicas
- ✅ Soporta nombres alternativos de variables
- ✅ Fallback a string vacío si no están configuradas

## 🐛 Troubleshooting

### Error: "Unauthorized" al hacer link

- Esto es un problema de permisos de la API
- Solución: Deploy manual desde dashboard

### Error: "Remote DB connection error"

- Verificar que ngrok está corriendo: `ngrok http 54331`
- Verificar que la URL en secrets es correcta
- Verificar que el service role key es correcto

### Error: JWT sin claim `sub`

- Verificar que el usuario existe y está confirmado en auth
- Hacer logout/login completo en la app
- Verificar que no hay errores de RLS

### Ngrok URL cambia constantemente

- Ngrok free genera URLs dinámicas
- Debes actualizar el secret cada vez que reinicies ngrok
- Considera plan pago para URL estática

## ✅ Checklist Final

- [ ] Ngrok corriendo con URL actualizada
- [ ] Secrets configurados en Supabase Dashboard
- [ ] Edge Function deployada (manual o CLI)
- [ ] Usuario `user@brickshare.eu` existe en DB1
- [ ] Usuario tiene perfil en tabla `users`
- [ ] Usuario tiene ubicación PUDO
- [ ] Test con curl funciona
- [ ] Login en app funciona sin error de JWT
- [ ] Escaneo de QR funciona correctamente

## 🔐 Credenciales de Referencia

**Database Password (DB1 Cloud)**: `YOUR_DB_PASSWORD`

**Test User**:
- Email: `user@brickshare.eu`
- Password: `usertest`

**Anon Key (DB1 Cloud)**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDY2MzAsImV4cCI6MjA4OTUyMjYzMH0.j3Lr55c8-L1SuGqFtl9_zpODGhrKT-BGe7IlF2hKyNQ
```

**Service Role Key (DB2 Local)**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## 📚 Documentos Relacionados

- `docs/FIX_JWT_MISSING_SUB_Y_NGROK_SETUP.md` - Guía completa del problema y soluciones
- `docs/SETUP_NGROK_DUAL_DB.md` - Configuración de ngrok para dual database
- `supabase/functions/process-pudo-scan/index.ts` - Código de la Edge Function
- `supabase/functions/process-pudo-scan/.env.local` - Variables de entorno locales