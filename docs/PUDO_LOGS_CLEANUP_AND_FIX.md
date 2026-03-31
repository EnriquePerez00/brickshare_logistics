# PUDO Logs Cleanup and Validation Fix

## Cambios Realizados

### 1. ✅ Reducción de Logs del LoginScreen
**Archivo:** `apps/mobile/src/screens/LoginScreen.tsx`

**Antes:**
```typescript
logger.info('🔐 [LoginScreen] Attempting authentication with Remote DB (DB2)', 
  { email: email.toLowerCase() }, 'LoginScreen');
logger.success('✅ [LoginScreen] Authenticated successfully', 
  { userId: data?.user?.id, email: data?.user?.email }, 'LoginScreen');
```

**Después:**
```typescript
// Solo logs en caso de error
logger.error('❌ [LoginScreen] Auth failed', { message: error.message }, 'LoginScreen');
```

**Beneficio:** Se eliminan logs verbosos del login. Solo se registran errores.

---

### 2. ✅ Corrección de Edge Function: update-remote-shipment-status
**Archivo:** `supabase/functions/update-remote-shipment-status/index.ts`

**Problema:** 
- Validaba rol `user` explícitamente (línea 66)
- Buscaba ubicación por `owner_id` (línea 71) - arquitectura antigua

**Mensaje de Error Antiguo:**
```
Only PUDO operators (usuarios/admin) can process scans
```

**Solución Implementada:**
```typescript
// Nueva validación usando user_locations (arquitectura dual database correcta)
const { data: userLocationData, error: locErr } = await supabaseRemoteAdmin
  .from('user_locations')
  .select(`
    location_id,
    locations (
      id,
      name,
      latitude,
      longitude,
      gps_validation_radius_meters
    )
  `)
  .eq('user_id', ownerUser.id)
  .limit(1)
  .single()

if (locErr || !userLocationData || !userLocationData.locations) {
  return errorResponse(404, 'No PUDO location assigned to this user. Please contact administrator.')
}
```

**Cambios:**
- ❌ Removido: Validación de `ownerProfile.role !== 'user'`
- ❌ Removido: Búsqueda por `owner_id`
- ✅ Agregado: Validación por `user_locations` (many-to-many)
- ✅ Agregado: Mensaje de error claro si no hay ubicación asignada

---

## Arquitectura Dual Database - Resumen

### DB1 (Cloud - brickshare_logistics)
**Ubicado en:** `https://qumjzvhtotcvnzpjgjkl.supabase.co`

Validaciones y auditoría:
- Autenticación de usuarios (JWT)
- Validación de permisos (tabla `user_locations`)
- Registro de auditoría (`pudo_scan_logs`, `packages`, `package_events`)

### DB2 (Local - Brickshare via ngrok)
**Ubicado en:** `http://127.0.0.1:54331` (desarrollo)

Datos maestros y transacciones:
- Consulta de envíos (`shipments.delivery_qr_code`)
- Actualización de estados (`shipment_status`)
- Datos de clientes

---

## Validación del Usuario

### Status Actual
```
✅ Usuario: user@brickshare.eu
   ID: d7a9f671-f5fa-4a31-8ba8-145e6219fd9b
   Rol: user
   
✅ Ubicaciones Asignadas: 2
   1. paco pil (brickshare-001)
   2. Test PUDO - Madrid (brickshare-002)
```

El usuario **SÍ tiene permiso** para procesar escaneos PUDO porque:
1. ✅ Está autenticado (JWT válido)
2. ✅ Tiene registros en `user_locations`

---

## Logs de pudo-scan - Mantener

Los siguientes logs son **NORMALES Y NECESARIOS** para debugging:

```
🔍 📱 [pudoService] Session found
🔍 🔐 [pudoService] JWT CLAIMS DECODED
🔍 📡 [pudoService] Invoking Edge Function process-pudo-scan
🔍 🔧 [pudoService] DEV MODE: Adding X-Dev-Bypass header
❌ ❌ [pudoService] Edge Function error
✅ [pudoService] DROPOFF completed successfully
```

**Propósito:**
- Acceso: Validación de sesión y JWT
- Consulta: Estado de Edge Functions
- Modificación: Resultados y errores

---

## Próximos Pasos

### 1. Re-deploy de Edge Functions
Cuando estén listos para desplegar:

```bash
supabase functions deploy process-pudo-scan
supabase functions deploy update-remote-shipment-status
```

### 2. Verificar en Simulator
```bash
npm run dev
# En la app móvil:
# 1. Login: user@brickshare.eu
# 2. Scan QR
# 3. Verificar logs
```

### 3. Validar Logs Esperados
Deberían ver:
- ✅ Session found
- ✅ JWT CLAIMS DECODED
- ✅ Invoking Edge Function
- ✅ Success o error con contexto claro

**NO deberían ver:**
- ❌ "Only PUDO operators" (mensaje antiguo)
- ❌ Logs verbosos de LoginScreen

---

## Referencias

- Edge Function: `supabase/functions/process-pudo-scan/index.ts`
- Edge Function: `supabase/functions/update-remote-shipment-status/index.ts`
- Arquitectura: `docs/PUDO_VALIDATION_ARCHITECTURE.md`
