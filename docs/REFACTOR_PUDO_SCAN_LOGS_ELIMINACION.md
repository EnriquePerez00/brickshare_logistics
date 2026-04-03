# Refactorización: Eliminación de tabla pudo_scan_logs

**Fecha:** 2026-01-04  
**Estado:** ✅ Completado

## Resumen

Se ha eliminado la tabla `pudo_scan_logs` de la base de datos y de todo el código de la aplicación. Los logs de escaneo ahora se registran exclusivamente en la tabla `package_events`, que proporciona un sistema de auditoría más genérico y flexible.

## Motivación

1. **Redundancia:** La tabla `pudo_scan_logs` duplicaba información que ya se registra en `package_events`
2. **Mantenimiento:** Simplificar el esquema de base de datos reduce la complejidad
3. **Escalabilidad:** `package_events` es más genérica y puede manejar diferentes tipos de eventos
4. **Implementación futura:** Se implementará un sistema de logs más completo en una fase posterior

## Cambios Realizados

### 1. Migraciones de Base de Datos

#### Migration 021: `refactor_views_without_scan_logs.sql`
- Eliminó las vistas `pudo_operations_history` y funciones relacionadas que dependían de `pudo_scan_logs`
- Recreó las vistas usando `package_events` como fuente de datos
- Funciones actualizadas:
  - `get_pudo_operations_paginated()`
  - `export_pudo_operations_csv()`

#### Migration 022: `drop_pudo_scan_logs.sql`
- Eliminó la tabla `pudo_scan_logs` y todas sus políticas RLS
- Eliminó índices asociados
- Archivó la migración original (008_add_pudo_scan_logs.sql)

### 2. Edge Functions

#### `process-pudo-scan/index.ts`
**Antes:**
```typescript
await supabaseClient
  .from('pudo_scan_logs')
  .insert({
    pudo_location_id: locationId,
    remote_shipment_id: remoteShipmentId,
    // ... más campos
  })
```

**Después:**
```typescript
await supabaseClient
  .from('package_events')
  .insert({
    package_id: localPackage.id,
    event_type: 'pudo_scan',
    old_status: localPackage.status,
    new_status: newStatus,
    performed_by: userId,
    location_id: locationId,
    metadata: {
      action_type: actionType,
      gps_validation_passed: gpsValidationPassed,
      api_request_successful: apiSuccess,
      // ... más metadatos
    }
  })
```

#### `update-remote-shipment-status/index.ts`
- Eliminadas todas las referencias a `pudo_scan_logs`
- Los logs ahora se crean únicamente en `package_events`

### 3. TypeScript Types

**`packages/shared/src/database.types.ts`:**
- Eliminada la definición completa de `pudo_scan_logs`
- Añadido comentario indicando la eliminación

### 4. Scripts

**Actualizados:**
- `check-pudo-logs.mjs`: Ahora consulta `package_events` en lugar de `pudo_scan_logs`
- `execute-setup.mjs`: Cambiado conteo de logs a `package_events`
- `execute-setup.sql`: Actualizado para verificar `package_events`
- `setup-test-owner.sql`: Referencias cambiadas a `package_events`

### 5. Vistas y Funciones de Base de Datos

#### Vista: `pudo_operations_history`
**Nueva implementación basada en `package_events`:**
```sql
CREATE OR REPLACE VIEW pudo_operations_history AS
SELECT
  pe.id,
  pe.created_at as scan_timestamp,
  p.tracking_code,
  (pe.metadata->>'action_type')::text as action_type,
  pe.old_status as previous_status,
  pe.new_status,
  COALESCE((pe.metadata->>'api_request_successful')::boolean, false) as result,
  pe.location_id as pudo_location_id,
  CONCAT(u.first_name, ' ', u.last_name) as operator_name,
  u.first_name as operator_first_name,
  u.last_name as operator_last_name,
  pe.performed_by as operator_id,
  l.name as location_name,
  -- Etiquetas traducidas
  CASE pe.metadata->>'action_type'
    WHEN 'delivery_confirmation' THEN 'Recepción'
    WHEN 'return_confirmation' THEN 'Devolución'
    ELSE 'Desconocido'
  END as action_type_label,
  CONCAT(pe.old_status, ' → ', pe.new_status) as status_transition
FROM package_events pe
JOIN packages p ON pe.package_id = p.id
LEFT JOIN users u ON pe.performed_by = u.id
LEFT JOIN locations l ON pe.location_id = l.id
WHERE pe.event_type = 'pudo_scan'
ORDER BY pe.created_at DESC;
```

## Mapeo de Campos

| pudo_scan_logs (antiguo) | package_events (nuevo) | Notas |
|--------------------------|------------------------|-------|
| `id` | `id` | Identificador único |
| `pudo_location_id` | `location_id` | ID de la ubicación |
| `remote_shipment_id` | N/A | Se obtiene del `package_id` |
| `previous_status` | `old_status` | Estado anterior |
| `new_status` | `new_status` | Estado nuevo |
| `scanned_by_user_id` | `performed_by` | Usuario que realizó la acción |
| `action_type` | `metadata->>'action_type'` | Tipo de acción (en metadata) |
| `scan_timestamp` | `created_at` | Timestamp del evento |
| `scan_latitude` | `metadata->>'scan_latitude'` | Latitud GPS (en metadata) |
| `scan_longitude` | `metadata->>'scan_longitude'` | Longitud GPS (en metadata) |
| `gps_accuracy_meters` | `metadata->>'gps_accuracy_meters'` | Precisión GPS (en metadata) |
| `gps_validation_passed` | `metadata->>'gps_validation_passed'` | Validación GPS (en metadata) |
| `api_request_successful` | `metadata->>'api_request_successful'` | Éxito de API (en metadata) |
| `api_response_code` | `metadata->>'api_response_code'` | Código respuesta (en metadata) |
| `api_response_message` | `metadata->>'api_response_message'` | Mensaje respuesta (en metadata) |
| `api_request_duration_ms` | `metadata->>'api_request_duration_ms'` | Duración request (en metadata) |
| `metadata` | `metadata` | Metadata adicional |

## Testing

### Verificar la migración:
```bash
# Conectar a Supabase y verificar que la tabla no existe
psql <connection_string>
\dt pudo_scan_logs  # Debe retornar "no se encontró la relación"
\dt package_events  # Debe mostrar la tabla
```

### Verificar logs de eventos:
```bash
node scripts/check-pudo-logs.mjs
```

### Verificar vistas:
```sql
SELECT * FROM pudo_operations_history LIMIT 10;
```

## Impacto en Funcionalidad

### ✅ Funcionalidad Mantenida
- Historial de operaciones PUDO
- Exportación CSV de operaciones
- Filtrado y paginación de logs
- Validación GPS de scans
- Registro de éxito/error de llamadas API

### 🔄 Cambios en Implementación
- Los logs ahora usan `package_events` con `event_type = 'pudo_scan'`
- Información detallada almacenada en campo `metadata` (JSONB)
- Vistas recreadas para mantener compatibilidad con dashboard

### ❌ No Afectado
- Ninguna funcionalidad del usuario final se ve afectada
- El dashboard PUDO sigue mostrando la misma información
- Las apps móviles funcionan igual

## Archivos Modificados

### Migraciones
- ✅ `supabase/migrations/021_refactor_views_without_scan_logs.sql` (nuevo)
- ✅ `supabase/migrations/022_drop_pudo_scan_logs.sql` (nuevo)

### Edge Functions
- ✅ `supabase/functions/process-pudo-scan/index.ts`
- ✅ `supabase/functions/update-remote-shipment-status/index.ts`

### TypeScript
- ✅ `packages/shared/src/database.types.ts`

### Scripts
- ✅ `scripts/check-pudo-logs.mjs`
- ✅ `scripts/execute-setup.mjs`
- ✅ `scripts/execute-setup.sql`
- ✅ `scripts/setup-test-owner.sql`

### Documentación
- ✅ `docs/REFACTOR_PUDO_SCAN_LOGS_ELIMINACION.md` (este documento)

## Próximos Pasos

1. ⏳ **Implementar sistema de logs completo** (Fase 2)
   - Sistema de logging estructurado
   - Niveles de log (debug, info, warning, error)
   - Rotación de logs
   - Análisis y métricas

2. ⏳ **Optimizaciones de package_events**
   - Índices adicionales si es necesario
   - Particionamiento por fecha para escalabilidad
   - Políticas de retención de datos

3. ⏳ **Monitorización**
   - Alertas sobre errores en logs
   - Dashboard de métricas de operaciones PUDO
   - Análisis de rendimiento

## Rollback (si es necesario)

Para revertir estos cambios:

1. Restaurar migration 008: `008_add_pudo_scan_logs.sql`
2. Ejecutar migration 017: `017_fix_pudo_scan_logs_rls.sql`
3. Revertir cambios en edge functions
4. Restaurar tipos TypeScript
5. Revertir cambios en scripts

**⚠️ IMPORTANTE:** El rollback resultará en pérdida de logs creados después de la migración a `package_events`.

## Conclusión

La refactorización ha simplificado el esquema de base de datos eliminando redundancia, mientras mantiene toda la funcionalidad existente. El sistema ahora es más mantenible y preparado para futuras mejoras en el sistema de logging.