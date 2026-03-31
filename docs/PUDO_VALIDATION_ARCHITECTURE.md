# PUDO Validation Architecture

## Overview

La validación para ejecutar `process-pudo-scan` se basa **ÚNICAMENTE** en la tabla `user_locations`. El rol del usuario **NO importa** para autorizar escaneos PUDO en producción ni en desarrollo.

## Requisitos para Procesar Escaneos PUDO

### Requiere:
1. ✅ Usuario autenticado (JWT válido)
2. ✅ Registro en tabla `user_locations` donde:
   - `user_id` = ID del usuario autenticado
   - `location_id` = ID de ubicación PUDO válida

### NO Requiere:
- ❌ Rol específico (`usuarios`, `admin`, `user`, etc.)
- ❌ Permisos administrativos
- ❌ Validación en tabla `users.role`

## Flujo de Validación

```
POST /functions/v1/process-pudo-scan
    ↓
1. Validar JWT (Bearer token)
    ↓
2. Obtener user_id del JWT
    ↓
3. Buscar en user_locations WHERE user_id = <extracted_id>
    ↓
    ├─ Si existe registro → ✅ Permitir escaneo
    └─ Si NO existe → ❌ Error 404 "No location assigned to this user"
    ↓
4. Procesar escaneo normalmente
```

## Código Relevante

### Edge Function: `supabase/functions/process-pudo-scan/index.ts`

**Líneas 132-169**: Obtención de ubicación PUDO
```typescript
// NOTA: La validación se basa ÚNICAMENTE en user_locations.
// El rol del usuario NO importa para procesar escaneos PUDO.
// Solo se requiere que el usuario tenga una ubicación asignada en user_locations.

const { data: userLocationData, error: locErr } = await cloudSupabase
  .from('user_locations')
  .select(`
    location_id,
    locations (
      id,
      name,
      pudo_id,
      address
    )
  `)
  .eq('user_id', ownerUser.id)
  .limit(1)
  .single()

if (locErr || !userLocationData || !userLocationData.locations) {
  console.error('[LOCATION] ❌ No location assigned to user:', ownerUser.id)
  return errorResponse(404, 'No location assigned to this user. Please contact administrator.')
}
```

## Validación en Aplicaciones

### App Móvil (`apps/mobile/src/services/pudoService.ts`)
- ✅ NO hace validaciones de rol
- ✅ Solo autentica usuarios
- ✅ La Edge Function es responsable de validar `user_locations`

### App Web (`apps/web/app/`)
- ✅ Las validaciones de rol son solo para UI/UX (mostrar/ocultar secciones)
- ✅ Distinguen entre panel admin (`/admin`) vs dashboard normal (`/dashboard`)
- ✅ NO afectan autorización PUDO

## Arquitectura de Bases de Datos

### BD Cloud (Logistics)
- Tabla `users`: Contiene `id`, `email`, `role` (valores: `admin`, `usuarios`)
- Tabla `user_locations`: Many-to-many de `users` → `locations`
- Tabla `locations`: Puntos PUDO disponibles

### BD Local (Brickshare via ngrok)
- Tabla `shipments`: Envíos con `delivery_qr_code`, `shipment_status`

## Notas Importantes

1. **El rol "usuarios" es heredado**: Existe en esquemas legacy pero NO se usa para validar escaneos PUDO
2. **user_locations es la fuente de verdad**: Es el único control de acceso para operadores PUDO
3. **Compatible en producción y desarrollo**: El flujo es idéntico en ambos entornos
4. **DEV_MODE**: Cuando está activado, la función bypass salta autenticación y usa cualquier ubicación disponible

## Cambios Recientes

- ✅ Mensaje de error actualizado (línea 168)
  - Antes: "Only PUDO operators (usuarios/admin) can process scans"
  - Ahora: "No location assigned to this user. Please contact administrator."
- ✅ Documentación mejorada en código (líneas 127-131)
- ✅ Valor de rol removido de DEV_MODE (línea 95)

## Verificación

Para verificar que un usuario puede procesar escaneos:

```sql
-- BD Cloud (Logistics)
SELECT u.id, u.email, u.role, ul.location_id, l.name, l.pudo_id
FROM public.users u
LEFT JOIN public.user_locations ul ON u.id = ul.user_id
LEFT JOIN public.locations l ON ul.location_id = l.id
WHERE u.email = 'user@brickshare.eu';
```

Si existe algún registro en `user_locations`, el usuario puede procesar escaneos independientemente de su `role`.