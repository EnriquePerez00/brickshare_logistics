# Production Deployment Guide - PUDO Edge Functions

## Status: Code Ready for Deployment ✅

Los cambios están commitidos y pusheados a GitHub. Las Edge Functions están listas para desplegar en producción.

## Cambios Desplegables

### 1. Edge Function: `update-remote-shipment-status`
**Archivo:** `supabase/functions/update-remote-shipment-status/index.ts`

**Cambio Principal:**
- ✅ Validación actualizada de `owner_id` → `user_locations`
- ✅ Mejor manejo de errores
- ✅ Compatible con arquitectura dual database

**Versión anterior fallaba con:**
```
Only PUDO operators (usuarios/admin) can process scans
```

**Nueva versión retorna:**
```
No PUDO location assigned to this user. Please contact administrator.
```

### 2. App Mobile: Reducción de Logs
**Archivo:** `apps/mobile/src/screens/LoginScreen.tsx`

**Cambio:**
- ✅ Eliminados logs verbosos de autenticación exitosa
- ✅ Mantiene logs solo en caso de error
- ✅ Reduce ruido en consola

---

## Deploy en Supabase Cloud

### Requisitos Previos

```bash
# 1. Verificar CLI de Supabase instalado
supabase --version

# 2. Autenticarse con Supabase (si no está configurado)
supabase login

# 3. Verificar acceso al proyecto
supabase projects list
```

### Comando de Deploy

```bash
# Desde directorio raíz del proyecto
cd /Users/I764690/Code_personal/Brickshare_logistics

# Deploy de Edge Function
supabase functions deploy update-remote-shipment-status \
  --project-ref qumjzvhtotcvnzpjgjkl

# Deploy alternativo con process-pudo-scan
supabase functions deploy process-pudo-scan \
  --project-ref qumjzvhtotcvnzpjgjkl
```

### Troubleshooting: Error 401

Si obtienes error `Unauthorized`:

```bash
# 1. Verificar sesión
supabase link --project-ref qumjzvhtotcvnzpjgjkl

# 2. Re-autenticar
supabase logout
supabase login

# 3. Intentar deploy nuevamente
supabase functions deploy update-remote-shipment-status \
  --project-ref qumjzvhtotcvnzpjgjkl
```

---

## Verificación Post-Deploy

### 1. En Supabase Dashboard
1. Ir a: https://app.supabase.com
2. Proyecto: brickshare_logistics
3. Functions → update-remote-shipment-status
4. Verificar estado: "Active" ✅

### 2. En App Móvil
```bash
npm run dev
# Login: user@brickshare.eu
# Scan QR de prueba
# Verificar logs de operación exitosa
```

### 3. Logs Esperados
```
✅ Session found
✅ JWT CLAIMS DECODED
✅ Invoking Edge Function process-pudo-scan
✅ DROPOFF completed successfully
```

---

## Git Commit Information

**Commit Hash:** `2038097`
**Branch:** `develop`
**Files Changed:** 6
- `apps/mobile/src/screens/LoginScreen.tsx`
- `supabase/functions/process-pudo-scan/index.ts`
- `supabase/functions/update-remote-shipment-status/index.ts`
- `docs/PUDO_LOGS_CLEANUP_AND_FIX.md` (nuevo)
- `docs/PUDO_VALIDATION_ARCHITECTURE.md` (nuevo)
- `scripts/verify-user-pudo-location.mjs` (nuevo)

**GitHub:** https://github.com/EnriquePerez00/brickshare_logistics/commit/2038097

---

## Rollback Plan (Si es necesario)

```bash
# Revertir último commit en GitHub
git push origin develop --force-with-lease HEAD~1:develop

# O redeployar versión anterior
supabase functions deploy update-remote-shipment-status \
  --project-ref qumjzvhtotcvnzpjgjkl \
  --version <PREVIOUS_VERSION>
```

---

## Notas Importantes

1. **Sin cambios en BD:** No hay migraciones SQL pendientes
2. **Backward Compatible:** El cambio es compatible con clientes existentes
3. **Logs Reducidos:** La app móvil tendrá menos ruido en consola
4. **Validación Mejorada:** Error messages más claros para debugging

---

## Referencias

- Documentación oficial: `docs/PUDO_LOGS_CLEANUP_AND_FIX.md`
- Arquitectura validación: `docs/PUDO_VALIDATION_ARCHITECTURE.md`
- Edge Function actual: `supabase/functions/update-remote-shipment-status/index.ts`