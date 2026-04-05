# Análisis: Configuración Faltante para BD Remota (DB2) en Edge Function

**Fecha:** 4 de Marzo de 2026, 21:25h  
**Estado:** ⚠️ CONFIGURACIÓN INCOMPLETA - CRÍTICO

## 🔍 Problema Identificado

El Edge Function `process-pudo-scan` **NO puede acceder a la BD remota (DB2 Brickshare)** porque las credenciales no están configuradas en Supabase Dashboard.

### Síntoma
```
ERROR: QR no válido o destino equivocado
```

### Causa Raíz
El QR `BS-DEL-21F7B99F-FAD` existe en **DB2 (Brickshare)** tabla `shipments.delivery_qr_code`, pero el Edge Function no puede encontrarlo porque:

1. **Variables de entorno faltantes** en Supabase Cloud
2. El Edge Function intenta conectar a DB2 pero las credenciales no existen
3. La conexión falla silenciosamente y retorna "QR no válido"

## 📋 Arquitectura Actual del Edge Function

Según `supabase/functions/process-pudo-scan/index.ts` (líneas 29-56):

```typescript
// BD CLOUD (Logistics) - Para auth y logs
const CLOUD_SUPABASE_URL = Deno.env.get('bricklogistics_URL') || 'https://qumjzvhtotcvnzpjgjkl.supabase.co'
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// BD LOCAL (Brickshare via ngrok) - Para validar y actualizar shipments
const LOCAL_DB_URL = Deno.env.get('brickshare_API_URL')  // ❌ NO CONFIGURADA
const LOCAL_DB_KEY = Deno.env.get('brickshare_SERVICE_ROLE_KEY')  // ❌ NO CONFIGURADA

// Validación en startup
if (!LOCAL_DB_URL || !LOCAL_DB_KEY) {
  console.error('[FATAL] Local Brickshare DB credentials not configured')
  throw new Error('Missing Brickshare DB credentials')
}
```

### Flujo de Validación (líneas 220-234)
```typescript
// 4. VALIDAR QR EN BD LOCAL (Brickshare)
const { data: shipment, error: shipmentErr } = await localSupabase
  .from('shipments')
  .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, ...')
  .or(`delivery_qr_code.eq.${scanned_code},pickup_qr_code.eq.${scanned_code},return_qr_code.eq.${scanned_code}`)
  .single()

if (shipmentErr || !shipment) {
  console.error('[VALIDATE] ❌ QR not found in shipments table:', shipmentErr?.message)
  return errorResponse(404, 'QR no válido o destino equivocado')  // ← ERROR AQUÍ
}
```

## ✅ Configuración Actual (Verificada)

### Archivos de Entorno Locales

#### `.env.local`
```bash
# Solo contiene configuración de Supabase Cloud (DB1)
SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ FALTA: brickshare_API_URL
# ❌ FALTA: brickshare_SERVICE_ROLE_KEY
```

#### `.env`
```bash
# Solo contiene tokens de acceso
SUPABASE_ACCESS_TOKEN=YOUR_SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD=YOUR_DB_PASSWORD

# ❌ FALTA: brickshare_API_URL
# ❌ FALTA: brickshare_SERVICE_ROLE_KEY
```

## 🎯 Solución Requerida

### Opción A: Configurar Credenciales de DB2 Remota (Recomendado si DB2 es accesible)

**Paso 1:** Obtener credenciales de la BD remota Brickshare
- URL de la API (e.g., `https://api.brickshare.com` o similar)
- Service Role Key de la BD remota

**Paso 2:** Configurar en Supabase Dashboard
```
1. Ir a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl
2. Settings → Edge Functions → Secrets
3. Agregar:
   - brickshare_API_URL = https://[URL_DE_DB2]
   - brickshare_SERVICE_ROLE_KEY = eyJhbGci[...]
```

**Paso 3:** Redesplegar Edge Function
```bash
cd /Users/I764690/Code_personal/Brickshare_logistics
supabase functions deploy process-pudo-scan
```

### Opción B: Usar Túnel ngrok como Proxy a DB2 (Si DB2 está en máquina local)

**Contexto:** El túnel ngrok ya está configurado y corriendo:
```
URL: https://semblably-dizzied-bruno.ngrok-free.dev
Gestionado por: PM2 (proceso ngrok-tunnel, PID 13069)
```

**Configuración:**

1. **En Supabase Dashboard:**
   ```
   brickshare_API_URL = https://semblably-dizzied-bruno.ngrok-free.dev/rest/v1
   brickshare_SERVICE_ROLE_KEY = [SERVICE_ROLE_KEY_DE_DB2]
   ```

2. **Verificar que el túnel expone la BD correcta:**
   ```bash
   # Probar conectividad
   curl -s "https://semblably-dizzied-bruno.ngrok-free.dev/rest/v1/shipments?delivery_qr_code=eq.BS-DEL-21F7B99F-FAD&select=id,delivery_qr_code" \
     -H "apikey: [SERVICE_ROLE_KEY]"
   ```

### Opción C: Modificar Edge Function para Usar Solo DB1 (No Recomendado)

Si DB2 no es accesible y los datos deben migrar a DB1:
1. Copiar/sincronizar datos de `shipments` desde DB2 a DB1
2. Modificar Edge Function para consultar solo DB1
3. Esta opción rompe la arquitectura dual-database actual

## 📊 Comparativa de Opciones

| Criterio | Opción A (DB2 Directa) | Opción B (ngrok) | Opción C (Solo DB1) |
|----------|------------------------|------------------|---------------------|
| **Complejidad** | Baja | Media | Alta |
| **Rendimiento** | Alto | Medio (latencia ngrok) | Alto |
| **Confiabilidad** | Alta | Media (depende de ngrok) | Alta |
| **Mantenimiento** | Bajo | Medio (mantener ngrok) | Alto (sincronización) |
| **Recomendación** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |

## 🔧 Configuración de Prueba (DEV_MODE)

El Edge Function tiene un **modo de desarrollo** que bypassa la validación de credenciales:

```typescript
const devMode = Deno.env.get('DEV_MODE') === 'true'

if (devMode) {
  console.log('[AUTH] ⚠️ DEV MODE: Bypassing JWT validation')
  ownerUser = {
    id: 'dev-user-id',
    email: 'dev@example.com',
  }
}
```

Sin embargo, **DEV_MODE NO resuelve el problema de DB2** porque:
- Sigue requiriendo `brickshare_API_URL` y `brickshare_SERVICE_ROLE_KEY`
- La consulta a `shipments` en línea 222 sigue fallando

## 📝 Recomendación Final

**Acción Inmediata:**
1. **Identificar la ubicación y credenciales de DB2 (Brickshare)**
2. **Configurar variables en Supabase Dashboard** (Opción A o B)
3. **Redesplegar Edge Function**
4. **Reintentar escaneo QR**

**Preguntas Clave para el Usuario:**
- ¿DB2 (Brickshare) está en la nube o es local?
- ¿Hay una URL pública de API para acceder a DB2?
- ¿Tienes las credenciales (Service Role Key) de DB2?
- ¿El túnel ngrok debe apuntar a DB2 o ya apunta?

## 🎯 Próximos Pasos

1. **Confirmar ubicación y acceso a DB2**
2. **Obtener credenciales de DB2**
3. **Configurar variables de entorno en Supabase Cloud**
4. **Redesplegar Edge Function**
5. **Probar escaneo QR nuevamente**

---

**Estado del Sistema Actual:**
- ✅ Túnel ngrok: OPERATIVO (PM2 gestionado)
- ✅ Edge Function: DESPLEGADO (pero sin acceso a DB2)
- ❌ Configuración DB2: FALTANTE
- ❌ Escaneo QR: FALLANDO

**Documentos Relacionados:**
- `docs/NGROK_PM2_MONITORING_GUIDE.md` - Gestión del túnel ngrok
- `docs/QR_SCAN_SESSION_DIAGNOSIS_BS-DEL-21F7B99F-FAD.md` - Diagnóstico de la sesión de escaneo
- `docs/ESTRATEGIA_DUAL_DATABASE.md` - Arquitectura de bases de datos duales