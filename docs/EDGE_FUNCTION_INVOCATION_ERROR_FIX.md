# 🔴 ERROR CRÍTICO: Edge Function Invocation "no-2xx"

**Fecha:** 2026-01-04  
**Estado:** ❌ IDENTIFICADO - Requiere corrección urgente  
**Severidad:** CRÍTICA - Bloquea todo el flujo de escaneo QR

---

## 🔍 DIAGNÓSTICO COMPLETO

### Problema Identificado

La app móvil **NO PUEDE INVOCAR** la edge function `process-pudo-scan`, generando error:
```
FunctionsHttpError: no-2xx HTTP status code received
```

### Causa Raíz: ARQUITECTURA INCORRECTA

El problema está en **dónde se invoca la edge function**:

#### ❌ ACTUAL (INCORRECTO):
```typescript
// apps/mobile/src/services/pudoService.ts línea 151
const { data, error } = await supabaseLocal.functions.invoke('process-pudo-scan', {
  headers: { 'X-Auth-Token': `Bearer ${session.access_token}` },
  body: { scanned_code: scannedCode, ... }
});
```

**Problema:** La app intenta invocar la edge function en `supabaseLocal`, que apunta a:
- `EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://semblably-dizzied-bruno.ngrok-free.dev`
- Esta URL es el **túnel ngrok** hacia la **base de datos LOCAL Brickshare**
- **Las edge functions NO están desplegadas en la DB local**, solo en la DB Cloud

#### ✅ CORRECTO:
La edge function `process-pudo-scan` está desplegada en **DB1 Cloud (bricklogistics)**:
- URL: `https://qumjzvhtotcvnzpjgjkl.supabase.co`
- Las edge functions deben invocarse desde `supabase`, NO desde `supabaseLocal`

---

## 📋 ANÁLISIS DE CONFIGURACIÓN

### 1. Configuración actual en `.env.local`:

```bash
# DB1 (Cloud) - DONDE ESTÁN LAS EDGE FUNCTIONS ✅
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# DB2 (Local vía ngrok) - DONDE NO HAY EDGE FUNCTIONS ❌
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://semblably-dizzied-bruno.ngrok-free.dev
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=sb_secret_N7UND0UgjKTVK...
```

### 2. Cliente Supabase en `packages/shared/src/supabase.ts`:

```typescript
// ✅ Cliente Cloud - Tiene edge functions
const supabase = createClient(
  'https://qumjzvhtotcvnzpjgjkl.supabase.co',
  'eyJhbGci...'
)

// ❌ Cliente Local - NO tiene edge functions
const supabaseLocal = createClient(
  'https://semblably-dizzied-bruno.ngrok-free.dev',
  'sb_secret_...'
)
```

### 3. Código del servicio PUDO:

```typescript
// ❌ LÍNEA 151 - INVOCA EN CLIENTE INCORRECTO
const { data, error } = await supabaseLocal.functions.invoke('process-pudo-scan', {
  //                            ^^^^^^^^^^^^^^
  //                            ESTE ES EL ERROR
```

---

## ✅ SOLUCIÓN

### Cambio requerido en `apps/mobile/src/services/pudoService.ts`

**ANTES (línea 151):**
```typescript
const { data, error } = await supabaseLocal.functions.invoke('process-pudo-scan', {
```

**DESPUÉS:**
```typescript
const { data, error } = await supabase.functions.invoke('process-pudo-scan', {
```

### Justificación:

1. **Edge functions están en DB Cloud:** La función `process-pudo-scan` está desplegada en `bricklogistics` (DB1 Cloud)
2. **La edge function se conecta a DB Local:** La edge function internamente tiene las credenciales para conectarse a la DB local vía ngrok
3. **Flujo correcto:**
   ```
   App Móvil → supabase.functions.invoke() → Edge Function en Cloud
                                                     ↓
                                          Conecta a DB Local (ngrok)
   ```

---

## 🔧 IMPLEMENTACIÓN

### Paso 1: Modificar pudoService.ts

```typescript
// Línea 151 - CAMBIAR DE supabaseLocal A supabase
const { data, error } = await supabase.functions.invoke('process-pudo-scan', {
  headers,
  body: {
    scanned_code: scannedCode,
    gps_latitude: gpsData?.latitude,
    gps_longitude: gpsData?.longitude,
    gps_accuracy: gpsData?.accuracy,
  },
});
```

### Paso 2: Actualizar logs de debug

```typescript
// Línea 130-135 - Actualizar logs
logger.debug('📡 [pudoService] Invoking Edge Function process-pudo-scan', 
  { 
    scannedCode,
    token_preview: session.access_token.substring(0, 30) + '...',
    supabase_url: 'https://qumjzvhtotcvnzpjgjkl.supabase.co', // Cloud URL
    edge_function: 'process-pudo-scan',
  }, 'pudoService');
```

### Paso 3: Verificar que edge function esté desplegada

```bash
# Verificar edge functions en proyecto Cloud
supabase functions list --project-ref qumjzvhtotcvnzpjgjkl

# Debería mostrar:
# process-pudo-scan (deployed)
```

---

## 🧪 VALIDACIÓN

### Test 1: Verificar invocación básica

```bash
curl -X POST \
  'https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "scanned_code": "BS-DEL-TEST-001",
    "gps_latitude": 40.4168,
    "gps_longitude": -3.7038
  }'
```

**Respuesta esperada:** 200 OK o error específico de negocio (no "no-2xx")

### Test 2: Verificar desde app móvil

1. Reiniciar app móvil después del cambio
2. Escanear un QR válido
3. Verificar logs en consola:
   ```
   ✅ [pudoService] Edge Function invoked successfully
   ```

---

## 📊 ARQUITECTURA CORRECTA (Dual Database)

```
┌─────────────────────────────────────────────────────────────┐
│  APP MÓVIL (React Native + Expo)                            │
│  - Autentica con DB1 Cloud                                  │
│  - Invoca edge functions en DB1 Cloud                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ 1. supabase.auth.signIn()
                     │ 2. supabase.functions.invoke('process-pudo-scan')
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  DB1 CLOUD (bricklogistics)                                 │
│  - URL: https://qumjzvhtotcvnzpjgjkl.supabase.co           │
│  - Gestiona: auth.users, pudo_scan_logs, packages          │
│  - Edge Functions: process-pudo-scan ✅                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Edge Function conecta a DB2 vía ngrok
                     │ usando BRICKSHARE_LOCAL_DB_URL
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  DB2 LOCAL (Brickshare via ngrok)                           │
│  - URL: https://semblably-dizzied-bruno.ngrok-free.dev     │
│  - Gestiona: shipments, users (clientes), QR codes         │
│  - NO tiene edge functions ❌                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 NOTA IMPORTANTE: DEV_MODE

Actualmente tienes:
```bash
EXPO_PUBLIC_DEV_MODE=true
```

Esto permite **bypass de validación JWT** en la edge function (línea 112-122 de `process-pudo-scan/index.ts`).

**Recomendación:** Mantener en `true` solo durante desarrollo local. En producción debe ser `false`.

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Cambiar `supabaseLocal` a `supabase` en línea 151 de `pudoService.ts`
- [ ] Actualizar logs de debug en línea 130-135
- [ ] Reiniciar app móvil
- [ ] Probar escaneo QR
- [ ] Verificar logs exitosos
- [ ] Verificar que se creen registros en `pudo_scan_logs`
- [ ] Verificar que se actualicen `shipments` en DB Local
- [ ] Documentar resultado final

---

## 📝 PRÓXIMOS PASOS

1. **Aplicar el fix inmediatamente** (crítico)
2. Verificar que ngrok esté corriendo y accesible
3. Verificar credenciales de DB Local en edge function secrets
4. Probar flujo completo de escaneo
5. Monitorear logs de edge function en dashboard

---

**Estado:** Pendiente de implementación  
**Prioridad:** 🔴 CRÍTICA  
**Tiempo estimado:** 5 minutos para el fix + 10 minutos de testing