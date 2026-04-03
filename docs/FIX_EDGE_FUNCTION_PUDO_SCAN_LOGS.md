# Fix Edge Function: pudo_scan_logs Error

**Fecha:** 2026-01-04
**Estado:** ✅ SOLUCIÓN IDENTIFICADA - REQUIERE DEPLOYMENT MANUAL

## 🔍 Problema Detectado

```
ERROR: Error registering scan log: Could not find the table 'public.pudo_scan_logs' in the schema cache
```

### Causa Raíz

La tabla `pudo_scan_logs` fue eliminada correctamente de la base de datos en la **migración 022** (`supabase/migrations/022_drop_pudo_scan_logs.sql`), pero la **Edge Function `process-pudo-scan` desplegada en Supabase Cloud** todavía tiene código que intenta escribir en esa tabla eliminada.

## ✅ Solución Aplicada (Código Local)

El código local en `supabase/functions/process-pudo-scan/index.ts` ya ha sido actualizado y **NO contiene referencias a pudo_scan_logs**:

- ✅ Línea 14: Comentario actualizado (eliminó mención de pudo_scan_logs)
- ✅ Línea 231: `// REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)`
- ✅ Línea 285: `// REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)`
- ✅ Línea 322: `// REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)`
- ✅ Línea 349: `// REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)`
- ✅ Líneas 437-442: Sección completa de pudo_scan_logs removida

El código ahora solo registra en:
1. ✅ `packages` (líneas 379-395)
2. ✅ `package_events` (líneas 407-434)

## 🚀 Deployment Requerido

### Opción A: Deployment Manual (RECOMENDADO)

1. Ir al Dashboard de Supabase:
   ```
   https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions
   ```

2. Click en la función `process-pudo-scan`

3. Click en "Edit function"

4. Copiar TODO el contenido del archivo local:
   ```
   supabase/functions/process-pudo-scan/index.ts
   ```

5. Pegar y reemplazar el código en el editor web

6. Click en "Deploy function"

7. Esperar a que el deployment termine (aprox. 30-60 segundos)

### Opción B: Deployment vía CLI (Requiere PAT Token)

Si prefieres usar el CLI, primero necesitas generar un Personal Access Token:

1. Generar PAT Token:
   ```
   https://supabase.com/dashboard/account/tokens
   ```
   (El token debe tener formato `sbp_...`)

2. Configurar el token:
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_tu_token_aqui
   ```

3. Desplegar:
   ```bash
   cd supabase
   npx supabase functions deploy process-pudo-scan --project-ref qumjzvhtotcvnzpjgjkl
   ```

## 🧪 Verificación Post-Deployment

Una vez desplegada la función actualizada:

1. Reiniciar la app móvil en el emulador
2. Intentar escanear un QR code
3. El error `Could not find the table 'public.pudo_scan_logs'` debería desaparecer
4. El escaneo debe completarse exitosamente registrando solo en `package_events`

## 📊 Arquitectura Actualizada

```
QR Scan Flow (Post-Fix):
├── 1. Autenticar usuario (Cloud DB)
├── 2. Validar QR en shipments (Local DB via ngrok)
├── 3. Actualizar shipment_status (Local DB)
├── 4. Registrar en packages (Cloud DB) ✅
├── 5. Registrar en package_events (Cloud DB) ✅
└── 6. ❌ REMOVED: pudo_scan_logs (tabla eliminada)
```

## 🔗 Referencias

- Migration que eliminó la tabla: `supabase/migrations/022_drop_pudo_scan_logs.sql`
- Código actualizado: `supabase/functions/process-pudo-scan/index.ts`
- Script de deployment: `scripts/deploy-edge-function-manual.mjs`

## ⚠️ Nota Importante

El token en `.env` (`sb_secret_...`) es el **Service Role Key**, NO un Personal Access Token válido para el CLI. Por eso el deployment automático falló con:

```
Invalid access token format. Must be like `sbp_0102...1920`.
```

Para automatizar deployments futuros, genera un PAT token desde el dashboard de Supabase.

## 📝 Checklist de Resolución

- [x] Identificar causa raíz (Edge Function desactualizada)
- [x] Verificar código local (sin referencias a pudo_scan_logs)
- [x] Intentar deployment automático (falló por falta de PAT)
- [x] Crear script de deployment manual
- [x] Documentar solución
- [ ] **PENDIENTE: Desplegar función actualizada en Supabase Cloud**
- [ ] **PENDIENTE: Verificar que QR scanning funciona sin errores**