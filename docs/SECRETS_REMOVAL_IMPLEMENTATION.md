# 🔐 Eliminación de Secretos Hardcodeados - Guía de Configuración

**Fecha:** 04/01/2026  
**Commit:** 971a1ce

## ✅ Cambios Implementados

Se han eliminado todos los secretos hardcodeados del código fuente para cumplir con las mejores prácticas de seguridad y resolver las alertas de GitHub Secret Scanning.

### Archivos Modificados

1. **`scripts/diagnose-qr-scan.mjs`** (Líneas 23-24)
   - ❌ **ANTES:** Fallback hardcodeado a ngrok URL y service role key
   - ✅ **DESPUÉS:** Validación obligatoria de variables de entorno

2. **`supabase/functions/process-pudo-scan/index.ts`** (Líneas 35-41)
   - ❌ **ANTES:** Credenciales Cloud y Local hardcodeadas con fallbacks
   - ✅ **DESPUÉS:** Validación fail-fast sin fallbacks hardcodeados

## 📊 Resultados

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Secretos en código** | ❌ 3 hardcodeados | ✅ 0 en código |
| **Seguridad** | ❌ Expuestos en GitHub | ✅ Solo en entorno |
| **GitHub Push** | ❌ Alertas de seguridad | ✅ Sin problemas |
| **Debugging** | ❌ Difícil diagnóstico | ✅ Errores claros |

## 🔧 Configuración Requerida

### 1. Para Scripts Locales (`diagnose-qr-scan.mjs`)

Ya configurado en `supabase/.env.local`:

```bash
SUPABASE_brickshare_API_URL=https://semblably-dizzied-bruno.ngrok-free.dev
SUPABASE_brickshare_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

**Validación:**
```bash
node scripts/diagnose-qr-scan.mjs
```

Si faltan variables, verás:
```
❌ ERROR: Variables de entorno requeridas no están configuradas
   SUPABASE_brickshare_API_URL: ❌ FALTA
   SUPABASE_brickshare_SERVICE_ROLE_KEY: ❌ FALTA

💡 Solución: Configurar en supabase/.env.local o .env.local
```

### 2. Para Edge Function (`process-pudo-scan`)

**IMPORTANTE:** Debes configurar los secretos en Supabase Dashboard.

#### Paso a Paso:

1. **Acceder a Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl
   ```

2. **Navegar a Edge Functions → Secrets:**
   ```
   Project Settings → Edge Functions → Secrets
   ```

3. **Agregar estos 2 secretos:**

   **Secreto 1:**
   - Name: `BRICKSHARE_LOCAL_DB_URL`
   - Value: `https://semblably-dizzied-bruno.ngrok-free.dev`
   - Description: `Ngrok tunnel URL to local Brickshare database`

   **Secreto 2:**
   - Name: `BRICKSHARE_LOCAL_SERVICE_ROLE_KEY`
   - Value: `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`
   - Description: `Service role key for local Brickshare database`

4. **Redesplegar Edge Function:**
   ```bash
   # Desde el directorio raíz del proyecto
   cd /Users/I764690/Code_personal/Brickshare_logistics
   supabase functions deploy process-pudo-scan
   ```

## 🚨 Errores Esperados Sin Configuración

### Script Local
```bash
❌ ERROR: Variables de entorno requeridas no están configuradas
   SUPABASE_brickshare_API_URL: ❌ FALTA
   
💡 Solución: Configurar en supabase/.env.local
```

### Edge Function
```
[FATAL] Local Brickshare DB credentials not configured
  BRICKSHARE_LOCAL_DB_URL: ❌ MISSING
  BRICKSHARE_LOCAL_SERVICE_ROLE_KEY: ❌ MISSING

💡 Configure in Supabase Dashboard → Project Settings → Edge Functions → Secrets
```

## ✅ Verificación Post-Configuración

### 1. Verificar Script Local
```bash
node scripts/diagnose-qr-scan.mjs
```

Debe mostrar:
```
🔍 DIAGNÓSTICO DE ESCANEO QR
═══════════════════════════════════════════════════════════
📋 QR Code: BS-DEL-4BCD6EB3-C99
🔗 BD Local (ngrok): https://semblably-dizzied-bruno.ngrok-free.dev
═══════════════════════════════════════════════════════════
```

### 2. Verificar Edge Function

Después de desplegar con los secretos configurados:

```bash
# Probar con curl
curl -X POST \
  https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scanned_code":"BS-DEL-TEST","scan_mode":"dropoff"}'
```

Si los secretos están bien configurados, no verás errores de `[FATAL] Missing credentials`.

## 📝 Notas Importantes

1. **Ngrok URL Dinámica:** 
   - La URL de ngrok cambia cada vez que reinicias el túnel
   - Debes actualizar ambas configuraciones cuando cambies la URL

2. **Rotación de Credenciales:**
   - Si rotas el service role key, actualiza en ambos lugares:
     - `supabase/.env.local` (para scripts)
     - Supabase Dashboard Secrets (para Edge Function)

3. **Ambientes:**
   - **Local:** Usa `supabase/.env.local`
   - **Cloud (Edge Functions):** Usa Supabase Dashboard → Secrets

4. **Seguridad:**
   - Los secretos en Dashboard son encriptados
   - No se exponen en logs ni en GitHub
   - Solo accesibles en runtime de la Edge Function

## 🔄 Próximos Pasos

Una vez que configures los secretos en Supabase Dashboard:

1. ✅ Redesplegar Edge Function: `supabase functions deploy process-pudo-scan`
2. ✅ Verificar que no hay errores de credenciales en logs
3. ✅ Probar un escaneo QR desde la app móvil
4. ✅ Confirmar que el flujo completo funciona

## 📚 Referencias

- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- Documento previo: `docs/HARDCODED_SECRETS_ANALYSIS_AND_PROPOSAL.md`

---

**Estado:** ✅ Código sin secretos hardcodeados  
**GitHub Push:** ✅ Sin alertas de seguridad  
**Configuración Pendiente:** ⚠️ Agregar secretos en Supabase Dashboard