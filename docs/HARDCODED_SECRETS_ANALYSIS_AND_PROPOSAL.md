# 🔒 Análisis de Secretos Hardcodeados y Propuesta de Remediación

## 📋 Resumen Ejecutivo

GitHub Secret Scanning ha detectado secretos hardcodeados en el commit `db67e68d` en 2 archivos. Este documento analiza el propósito de cada archivo, identifica los secretos hardcodeados, y propone las variables de entorno correctas para sustituirlos.

---

## 🔍 Archivos Afectados

### 1. `scripts/diagnose-qr-scan.mjs:24`

**Propósito del Script:**
- Script de diagnóstico para troubleshooting de escaneo QR
- Verifica si un QR code específico existe en la BD local (Brickshare)
- Valida el estado actual del shipment
- Determina si el estado es el correcto para la operación (dropoff/pickup/return)

**Base de Datos que Accede:**
- **BD Local Brickshare** (DB2) - Instancia local de Supabase vía túnel ngrok
- Contiene: `shipments` table con QR codes y estados de envíos
- Propósito: Validar datos de negocio antes de procesamiento PUDO

**Secreto Hardcodeado (Línea 24):**
```javascript
const LOCAL_DB_KEY = process.env.SUPABASE_brickshare_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
```

**Análisis del Problema:**
- ❌ **Secreto expuesto:** `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` 
- ❌ **Tipo:** Service Role Key de la BD local Brickshare
- ❌ **Riesgo:** Acceso completo a la base de datos local, bypass de RLS
- ⚠️ **Contexto:** Este es un secreto de desarrollo local, pero NO debe estar en el código

---

### 2. `supabase/functions/process-pudo-scan/index.ts:41`

**Propósito de la Edge Function:**
- Edge Function desplegada en Supabase Cloud
- Procesa escaneos QR desde la app móvil PUDO
- **Arquitectura Dual-Database:**
  - **DB1 (Cloud Logistics):** Registra logs de escaneo en `pudo_scan_logs`
  - **DB2 (Local Brickshare):** Valida QR y actualiza estado de `shipments`

**Bases de Datos que Accede:**

1. **BD Cloud (Brickshare_logistics) - DB1:**
   - URL: `https://qumjzvhtotcvnzpjgjkl.supabase.co`
   - Tablas: `pudo_scan_logs`, `user_locations`, `profiles`
   - Propósito: Logging y autenticación

2. **BD Local (Brickshare) - DB2:**
   - URL: ngrok tunnel → instancia local Supabase
   - Tablas: `shipments` con QR codes y estados
   - Propósito: Validación y actualización de envíos

**Secretos Hardcodeados (Líneas 35 y 41):**

```typescript
// Línea 35
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('bricklogistics_SERVICE_ROLE_KEY') 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk0NjYzMCwiZXhwIjoyMDg5NTIyNjMwfQ.qFhuNtT7jw5TrvJSzg28GiYVPQGLMSJ9JYeWhMDb_4o'

// Línea 41
const LOCAL_DB_KEY = Deno.env.get('brickshare_SERVICE_ROLE_KEY') 
  || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
```

**Análisis del Problema:**
- ❌ **2 Secretos expuestos:**
  1. Service Role Key de BD Cloud (JWT eyJhbG...)
  2. Service Role Key de BD Local (sb_secret_N7...)
- ❌ **Riesgo Alto:** Acceso privilegiado a ambas bases de datos
- ⚠️ **Contexto:** Fallbacks para desarrollo, pero exponen credenciales reales

---

## ✅ PROPUESTA DE REMEDIACIÓN

### Cambios Recomendados

#### 1. **scripts/diagnose-qr-scan.mjs**

**ANTES (Línea 23-24):**
```javascript
const NGROK_URL = process.env.SUPABASE_brickshare_API_URL || 'https://semblably-dizzied-bruno.ngrok-free.dev';
const LOCAL_DB_KEY = process.env.SUPABASE_brickshare_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
```

**DESPUÉS (Propuesta):**
```javascript
const NGROK_URL = process.env.SUPABASE_brickshare_API_URL;
const LOCAL_DB_KEY = process.env.SUPABASE_brickshare_SERVICE_ROLE_KEY;

// Validación obligatoria
if (!NGROK_URL || !LOCAL_DB_KEY) {
  console.error('❌ ERROR: Variables de entorno requeridas no están configuradas');
  console.error('   SUPABASE_brickshare_API_URL:', NGROK_URL ? '✅' : '❌ FALTA');
  console.error('   SUPABASE_brickshare_SERVICE_ROLE_KEY:', LOCAL_DB_KEY ? '✅' : '❌ FALTA');
  console.error('\n💡 Configurar en supabase/.env.local o .env.local');
  process.exit(1);
}
```

**Justificación:**
- ✅ **Elimina secreto hardcodeado**
- ✅ **Fuerza configuración explícita** del desarrollador
- ✅ **Mensaje de error claro** si faltan variables
- ✅ **Script de diagnóstico solo para desarrollo** - es aceptable que falle si no está configurado

---

#### 2. **supabase/functions/process-pudo-scan/index.ts**

**ANTES (Líneas 35-41):**
```typescript
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('bricklogistics_SERVICE_ROLE_KEY') 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

const LOCAL_DB_URL = Deno.env.get('brickshare_API_URL') 
  || 'https://semblably-dizzied-bruno.ngrok-free.dev'
const LOCAL_DB_KEY = Deno.env.get('brickshare_SERVICE_ROLE_KEY') 
  || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
```

**DESPUÉS (Propuesta):**
```typescript
// BD CLOUD (Brickshare_logistics) - Inyectada automáticamente por Supabase
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// BD LOCAL (Brickshare) - Debe configurarse en Supabase Dashboard → Edge Functions → Secrets
const LOCAL_DB_URL = Deno.env.get('BRICKSHARE_LOCAL_DB_URL');
const LOCAL_DB_KEY = Deno.env.get('BRICKSHARE_LOCAL_SERVICE_ROLE_KEY');

// Validación en startup
if (!CLOUD_SUPABASE_SERVICE_ROLE) {
  console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY not set (auto-injected by Supabase)');
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

if (!LOCAL_DB_URL || !LOCAL_DB_KEY) {
  console.error('[FATAL] Local Brickshare DB credentials not configured');
  console.error('  BRICKSHARE_LOCAL_DB_URL:', LOCAL_DB_URL ? '✅' : '❌ MISSING');
  console.error('  BRICKSHARE_LOCAL_SERVICE_ROLE_KEY:', LOCAL_DB_KEY ? '✅' : '❌ MISSING');
  console.error('\n💡 Configure in Supabase Dashboard → Project Settings → Edge Functions → Secrets');
  throw new Error('Missing Brickshare DB credentials');
}
```

**Justificación:**
- ✅ **Elimina ambos secretos hardcodeados**
- ✅ **SUPABASE_SERVICE_ROLE_KEY:** Ya es inyectado automáticamente por Supabase en Edge Functions
- ✅ **Variables claramente nombradas:** `BRICKSHARE_LOCAL_*` para evitar confusión
- ✅ **Fallo rápido (fail-fast):** Si faltan secretos, la función falla inmediatamente en startup
- ✅ **Edge Function en producción:** Debe tener configuración explícita en Supabase Dashboard

---

## 🔐 Configuración de Secretos en Supabase Dashboard

### Para Edge Functions (Opción Recomendada)

**Ubicación:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Secretos a añadir:**

1. **BRICKSHARE_LOCAL_DB_URL**
   - Valor: URL del túnel ngrok o endpoint público de la BD local
   - Ejemplo: `https://your-ngrok-url.ngrok-free.dev`

2. **BRICKSHARE_LOCAL_SERVICE_ROLE_KEY**
   - Valor: Service Role Key de la BD local Brickshare
   - Formato: `sb_secret_...` o JWT largo

**Comando CLI (Alternativa):**
```bash
npx supabase secrets set BRICKSHARE_LOCAL_DB_URL=https://your-ngrok-url.ngrok-free.dev
npx supabase secrets set BRICKSHARE_LOCAL_SERVICE_ROLE_KEY=sb_secret_...
```

---

## 📊 Comparativa: ANTES vs DESPUÉS

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Secretos en código** | ❌ 3 secretos hardcodeados | ✅ 0 secretos en código |
| **Seguridad** | ❌ Secretos expuestos en GitHub | ✅ Secretos solo en entorno |
| **Producción** | ⚠️ Fallback a dev secrets | ✅ Configuración obligatoria |
| **Debugging** | ❌ Difícil identificar config faltante | ✅ Errores claros en startup |
| **Desarrollo Local** | ✅ Funciona sin config | ⚠️ Requiere setup explícito |

---

## 🎯 Plan de Implementación

### Fase 1: Configurar Secretos (PRIMERO)

1. **En Supabase Dashboard:**
   ```
   Edge Functions → Secrets → Add Secret
   - BRICKSHARE_LOCAL_DB_URL
   - BRICKSHARE_LOCAL_SERVICE_ROLE_KEY
   ```

2. **En desarrollo local (supabase/.env.local):**
   ```bash
   SUPABASE_brickshare_API_URL=https://your-ngrok-url.ngrok-free.dev
   SUPABASE_brickshare_SERVICE_ROLE_KEY=sb_secret_...
   ```

### Fase 2: Actualizar Código (DESPUÉS)

1. Remover fallbacks hardcodeados
2. Añadir validaciones obligatorias
3. Mejorar mensajes de error
4. Deploy Edge Function actualizada

### Fase 3: Verificación

1. Probar Edge Function en Supabase Dashboard (Invoke tab)
2. Probar script de diagnóstico localmente
3. Verificar que errores son claros si faltan secretos

---

## 🚨 Nota Importante: GitHub Push

**Estado Actual:**
- GitHub bloqueó el push por detección de secretos en commit `db67e68d`
- Los secretos están en un commit ANTERIOR, no en el commit nuevo `6172f1d`

**Opciones para desbloquear:**

### Opción A: Bypass de GitHub (Más Rápida) ⭐ RECOMENDADA
```
https://github.com/EnriquePerez00/brickshare_logistics/security/secret-scanning/unblock-secret/3BcxYgzjZczbauZlMkTN1Y3tlzO
```
- ✅ Permite push inmediato
- ⚠️ Secretos quedan en historial (pero se pueden invalidar después)

### Opción B: Limpiar Historial (Más Segura pero Compleja)
```bash
# Reescribir historial para remover secretos
git filter-branch --tree-filter 'sed -i "" "s/sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz/REMOVED_SECRET/g" scripts/diagnose-qr-scan.mjs' HEAD
git push --force origin develop
```
- ✅ Elimina secretos del historial completamente
- ⚠️ Requiere force push y rebase de todos los desarrolladores

---

## ✅ Conclusiones

1. **Secretos Identificados:** 3 Service Role Keys hardcodeados
2. **Base de Datos Objetivo:** 
   - BD Local Brickshare (DB2) para validación de shipments
   - BD Cloud Logistics (DB1) para logging
3. **Propuesta:** Eliminar todos los fallbacks hardcodeados y forzar configuración explícita
4. **Justificación:** Mejora seguridad, claridad en errores, y control de configuración
5. **Próximos Pasos:** 
   - Usar bypass URL para desbloquear push
   - Implementar cambios propuestos en nuevo commit
   - Configurar secretos en Supabase Dashboard
   - Invalidar secretos antiguos si están expuestos públicamente

---

**Fecha:** 4 de Enero de 2026  
**Autor:** Análisis de Seguridad - Cline AI  
**Estado:** Propuesta Pendiente de Aprobación e Implementación