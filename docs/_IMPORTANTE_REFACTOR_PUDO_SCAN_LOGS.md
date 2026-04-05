# ⚠️ AVISO IMPORTANTE: Refactorización de pudo_scan_logs

**Fecha:** 2026-01-04  
**Estado:** ✅ Completado

## 🔴 La tabla `pudo_scan_logs` ha sido ELIMINADA

La tabla `pudo_scan_logs` fue eliminada de la base de datos en las migraciones 021 y 022.

### ¿Qué significa esto?

Los logs de escaneo ahora se registran en la tabla `package_events` con:
- `event_type = 'pudo_scan'`
- Información detallada en el campo `metadata` (JSONB)

### Documentos afectados

Los siguientes documentos contienen referencias a `pudo_scan_logs` que ya **NO son válidas**:

#### 📄 Documentos con información desactualizada:
- `DASHBOARD_PUDO_INTEGRATION.md`
- `PUDO_DASHBOARD_IMPROVEMENTS.md`
- `PUDO_RETURN_FLOW_IMPLEMENTATION.md`
- `RESUMEN_EJECUCION_OPCION_A.md`
- `PUDO_STATUS_TRANSITIONS.md`
- `GUIA_CONFIGURACION_E_IMPLEMENTACION.md`
- `PUDO_INSTALLATION_GUIDE.md`
- `EDGE_FUNCTION_INVOCATION_ERROR_FIX.md`
- `HARDCODED_SECRETS_ANALYSIS_AND_PROPOSAL.md`
- `PUDO_DROPOFF_FLOW_FIX.md`
- `PUDO_SCANNING_PROCESS.md`
- `EDGE_FUNCTIONS_STATUS_REPORT.md`
- `PASOS_RAPIDOS_OPCION_A.md`
- `SEED_INSTRUCTIONS.md`
- `DATABASE_SCHEMA_REFERENCE.md`
- `PUDO_RETURN_FLOW_MOBILE_INTEGRATION.md`
- `PUDO_COMPLETE_IMPLEMENTATION.md`
- `ALL_EDGE_FUNCTIONS.txt`
- `ESTRATEGIA_DUAL_DATABASE.md`

#### 📂 Archivados (contienen referencias antiguas):
- `archived/DUAL_DB_ARCHITECTURE_IMPLEMENTATION.md`
- `archived/PUDO_LOGS_CLEANUP_AND_FIX.md`
- `archived/GUIA_EJECUCION_APP_ANDROID.md`

### ✅ Documento actualizado y de referencia

Para información actualizada sobre la refactorización, consulta:

**👉 [REFACTOR_PUDO_SCAN_LOGS_ELIMINACION.md](./REFACTOR_PUDO_SCAN_LOGS_ELIMINACION.md)**

Este documento contiene:
- Motivación del cambio
- Detalles de las migraciones
- Mapeo de campos antiguos → nuevos
- Impacto en funcionalidad
- Archivos modificados
- Próximos pasos

### Equivalencias rápidas

| Operación antigua | Operación nueva |
|-------------------|-----------------|
| `SELECT * FROM pudo_scan_logs` | `SELECT * FROM package_events WHERE event_type = 'pudo_scan'` |
| `INSERT INTO pudo_scan_logs` | `INSERT INTO package_events (event_type = 'pudo_scan', metadata = {...})` |
| Vista `pudo_operations_history` | Recreada usando `package_events` (compatible) |

### Scripts actualizados

✅ Los siguientes scripts YA están actualizados:
- `scripts/check-pudo-logs.mjs` → Consulta `package_events`
- `scripts/execute-setup.mjs` → Cuenta registros en `package_events`
- `scripts/execute-setup.sql` → Verifica `package_events`
- `scripts/setup-test-owner.sql` → Referencias actualizadas

### Migraciones

✅ **Aplicadas:**
- `021_refactor_views_without_scan_logs.sql` - Recreó vistas
- `022_drop_pudo_scan_logs.sql` - Eliminó tabla y dependencias

❌ **Ya no usar:**
- `008_add_pudo_scan_logs.sql` - Creaba la tabla (archivada)
- `017_fix_pudo_scan_logs_rls.sql` - Políticas RLS (ya no aplica)

### Edge Functions actualizadas

✅ **Actualizadas para usar `package_events`:**
- `process-pudo-scan/index.ts`
- `update-remote-shipment-status/index.ts`

### Tipos TypeScript actualizados

✅ `packages/shared/src/database.types.ts`
- Eliminada definición de `pudo_scan_logs`
- Añadido comentario de migración

---

## 🚀 Para nuevos desarrolladores

Si ves referencias a `pudo_scan_logs` en la documentación:

1. **Ignora esas referencias** - La tabla ya no existe
2. **Usa `package_events`** con `event_type = 'pudo_scan'`
3. **Consulta** `REFACTOR_PUDO_SCAN_LOGS_ELIMINACION.md` para más detalles
4. **Las vistas** `pudo_operations_history` siguen funcionando (ya actualizadas internamente)

---

**Última actualización:** 2026-01-04  
**Actualizado por:** Refactorización automática