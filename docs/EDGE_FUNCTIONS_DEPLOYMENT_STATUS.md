# Edge Functions Deployment Status

## Status: ⚠️ CLI Authorization Issue - Manual Deployment Required

Las Edge Functions están **listas para ser desplegadas**, pero hay un problema de autorización con el CLI de Supabase que impide el deploy automático desde terminal.

---

## Edge Functions Disponibles

| Función | Path | Estado | Cambios Recientes |
|---------|------|--------|------------------|
| `process-pudo-scan` | `supabase/functions/process-pudo-scan/index.ts` | ✅ Actualizado | Logs reducidos |
| `update-remote-shipment-status` | `supabase/functions/update-remote-shipment-status/index.ts` | ✅ Actualizado | Validación con user_locations |
| `generate-dynamic-qr` | `supabase/functions/generate-dynamic-qr/index.ts` | ✅ Listo | Sin cambios |
| `generate-static-return-qr` | `supabase/functions/generate-static-return-qr/index.ts` | ✅ Listo | Sin cambios |
| `verify-package-qr` | `supabase/functions/verify-package-qr/index.ts` | ✅ Listo | Sin cambios |

---

## Problema: Error 401 en CLI

```
unexpected list functions status 401: {"message":"Unauthorized"}
```

**Solución: Deploy Manual vía Supabase Dashboard**

### Paso 1: Ir al Dashboard de Supabase
```
https://app.supabase.com/project/qumjzvhtotcvnzpjgjkl/functions
```

### Paso 2: Para cada función, hacer:

1. **process-pudo-scan**
   - Click en función existente
   - Copiar contenido de: `supabase/functions/process-pudo-scan/index.ts`
   - Pegar y guardar cambios

2. **update-remote-shipment-status**
   - Click en función existente
   - Copiar contenido de: `supabase/functions/update-remote-shipment-status/index.ts`
   - Pegar y guardar cambios (cambio principal aquí)

3. **generate-dynamic-qr**, **generate-static-return-qr**, **verify-package-qr**
   - Verificar que están actualizadas

---

## Cambios Principales a Desplegar

### 1. `update-remote-shipment-status/index.ts` ⭐ CRÍTICO

**De (líneas 66-77):**
```typescript
// Validación ANTIGUA con owner_id
const { data: ownerProfile } = await supabaseRemoteAdmin
  .from('users')
  .select('role')
  .eq('id', ownerUser.id)
  .single()

if (!ownerProfile || ownerProfile.role !== 'user') {
  return errorResponse(403, 'Only PUDO operators can update shipment status')
}

const { data: ownerLocation, error: locErr } = await supabaseRemoteAdmin
  .from('locations')
  .select('id, name, latitude, longitude, gps_validation_radius_meters')
  .eq('owner_id', ownerUser.id)  // ❌ VIEJO
  .single()
```

**A (líneas 66-88):**
```typescript
// Validación NUEVA con user_locations
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

const ownerLocation = Array.isArray(userLocationData.locations) 
  ? userLocationData.locations[0] 
  : userLocationData.locations
```

---

## Commits Pendientes de Deploy

**Commit:** `2038097` → branch `develop`
**Archivos:**
- ✅ `apps/mobile/src/screens/LoginScreen.tsx` - Logs reducidos
- ✅ `supabase/functions/process-pudo-scan/index.ts` - Actualizado
- ✅ `supabase/functions/update-remote-shipment-status/index.ts` - Corregido
- ✅ `docs/PUDO_LOGS_CLEANUP_AND_FIX.md` - Documentación
- ✅ `docs/PUDO_VALIDATION_ARCHITECTURE.md` - Documentación
- ✅ `scripts/verify-user-pudo-location.mjs` - Script de verificación

---

## Verificación Post-Deploy

Después de desplegar, verificar en app móvil:

```bash
npm run dev
# 1. Login: user@brickshare.eu
# 2. Scan QR
# 3. Verificar logs en consola
```

**Logs esperados:**
```
✅ Session found
✅ JWT CLAIMS DECODED
✅ Invoking Edge Function process-pudo-scan
✅ DROPOFF completed successfully
```

**NO deberían ver:**
```
❌ Only PUDO operators (usuarios/admin) can process scans
```

---

## Alternativa: Deploy vía API

Si prefiere deploy programático, usar Supabase Management API:

```bash
# Obtener API Key
export SUPABASE_API_KEY="<tu-api-key>"
export PROJECT_REF="qumjzvhtotcvnzpjgjkl"

# Deploy individual
curl -X POST \
  https://api.supabase.com/v1/projects/$PROJECT_REF/functions/update-remote-shipment-status/deploy \
  -H "Authorization: Bearer $SUPABASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @supabase/functions/update-remote-shipment-status/index.ts
```

---

## Resumen

| Tarea | Estado | Acción |
|-------|--------|--------|
| Cambios de código | ✅ Completado | Commitido a `develop` |
| CLI Deploy | ❌ Error 401 | Manual vía Dashboard |
| Documentación | ✅ Completa | Disponible en `/docs` |
| Rollback Plan | ✅ Preparado | Si es necesario revertir |

**Próximo paso:** Desplegar manualmente vía Supabase Dashboard