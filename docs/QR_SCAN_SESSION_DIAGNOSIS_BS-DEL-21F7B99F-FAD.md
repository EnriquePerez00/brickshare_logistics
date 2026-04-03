# Diagnóstico del Error de Escaneo QR BS-DEL-21F7B99F-FAD

**Fecha:** 2026-03-04 21:11
**Sesión:** a31-8ba8-145e6219fd9b
**QR Code:** BS-DEL-21F7B99F-FAD
**Error:** "QR no válido o destino equivocado"

---

## 🔴 **CAUSA RAÍZ CONFIRMADA: Túnel ngrok OFFLINE**

### Verificación Realizada

1. **Proceso ngrok**: ❌ NO ESTÁ CORRIENDO
   ```bash
   $ ps aux | grep ngrok | grep -v grep
   (Sin resultados)
   ```

2. **API ngrok (puerto 4040)**: ❌ NO RESPONDE
   ```bash
   $ curl http://localhost:4040/api/tunnels
   (Sin respuesta)
   ```

### Estado del Sistema

**✅ FUNCIONANDO:**
- Autenticación en BD Cloud (Logistics)
- Usuario: d7a9f671-f5fa-4a31-8ba8-145e6219fd9b (user@brickshare.eu)
- JWT válido y decodificado correctamente
- GPS activo (lat: 37.4220, lon: -122.0840, accuracy: 5m)
- App móvil comunicándose correctamente con Edge Function

**❌ FALLANDO:**
- Túnel ngrok OFFLINE
- Conexión a BD Local (Brickshare) INACCESIBLE
- Validación de QR imposible
- URL configurada: `https://semblably-dizzied-bruno.ngrok-free.dev`

### Análisis del Flujo de Error

```
[9:09:47 PM] ✅ App móvil escanea QR: BS-DEL-21F7B99F-FAD
[9:09:47 PM] ✅ Envía petición a Edge Function process-pudo-scan
[9:09:47 PM] ✅ Edge Function autentica usuario correctamente
[9:09:47 PM] ❌ Edge Function intenta validar QR en BD Local vía ngrok
[9:09:47 PM] ❌ ngrok OFFLINE → Timeout/Error de conexión
[9:09:48 PM] ❌ Edge Function retorna: "QR no válido o destino equivocado"
[9:09:48 PM] ❌ App móvil muestra error al usuario
```

### Código Relevante

**Edge Function** (`supabase/functions/process-pudo-scan/index.ts`, líneas 222-234):

```typescript
const { data: shipment, error: shipmentErr } = await localSupabase
  .from('shipments')
  .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, ...')
  .or(`delivery_qr_code.eq.${scanned_code},pickup_qr_code.eq.${scanned_code},return_qr_code.eq.${scanned_code}`)
  .single()

if (shipmentErr || !shipment) {
  console.error('[VALIDATE] ❌ QR not found in shipments table:', shipmentErr?.message)
  return errorResponse(404, 'QR no válido o destino equivocado')  // ← ESTE ES EL ERROR
}
```

**Problema:** Cuando ngrok está offline, `localSupabase` no puede conectar y la consulta falla, retornando el error genérico.

---

## 🔧 **SOLUCIÓN: Reiniciar Túnel ngrok**

### Paso 1: Iniciar ngrok

```bash
node scripts/ngrok-only.mjs &
```

Este comando:
- Inicia ngrok en background
- Expone el puerto 54321 (Supabase local)
- Genera una URL pública tipo: `https://xxxx-xxxx-xxxx.ngrok-free.dev`

### Paso 2: Verificar que está corriendo

```bash
# Verificar proceso
ps aux | grep ngrok | grep -v grep

# Verificar API
curl http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

### Paso 3: Actualizar configuración Edge Function

La Edge Function usa estas variables de entorno (configuradas en Supabase Dashboard):

```
brickshare_API_URL=https://tu-nueva-url.ngrok-free.dev
brickshare_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE:** Si la URL de ngrok cambió, debes actualizar `brickshare_API_URL` en:
1. Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Redeploy el Edge Function: `npm run deploy:edge-functions`

### Paso 4: Verificar conectividad

```bash
# Probar conexión a BD Local vía ngrok
curl -X GET "https://tu-url.ngrok-free.dev/rest/v1/shipments?select=id&limit=1" \
  -H "apikey: TU_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY"
```

### Paso 5: Diagnosticar el QR específico

```bash
node scripts/diagnose-specific-qr.mjs
```

Este script te dirá:
- ✅ Si el QR existe en la BD Local
- ✅ Cuál es el estado actual del shipment
- ✅ Si el estado es compatible con la operación de escaneo

---

## 📊 **Estados Posibles del QR BS-DEL-21F7B99F-FAD**

Una vez ngrok esté activo, el QR puede estar en uno de estos escenarios:

### Escenario A: QR Válido y Estado Correcto ✅
```
delivery_qr_code: BS-DEL-21F7B99F-FAD
shipment_status: in_transit_pudo
```
**Resultado:** El escaneo funcionará correctamente

### Escenario B: QR Válido pero Estado Incorrecto ⚠️
```
delivery_qr_code: BS-DEL-21F7B99F-FAD
shipment_status: delivered_pudo (ya procesado)
```
**Solución:** Actualizar manualmente el estado:
```sql
UPDATE shipments 
SET shipment_status = 'in_transit_pudo',
    delivery_validated_at = NULL
WHERE delivery_qr_code = 'BS-DEL-21F7B99F-FAD';
```

### Escenario C: QR No Existe ❌
```
No se encuentra el QR en la tabla shipments
```
**Solución:** Cargar datos de prueba o verificar que el QR es correcto

---

## 🎯 **Próximos Pasos**

1. ✅ **CONFIRMADO:** ngrok está offline
2. ⏳ **PENDIENTE:** Reiniciar ngrok con `node scripts/ngrok-only.mjs &`
3. ⏳ **PENDIENTE:** Verificar que ngrok está funcionando
4. ⏳ **PENDIENTE:** Diagnosticar estado del QR `BS-DEL-21F7B99F-FAD`
5. ⏳ **PENDIENTE:** Si es necesario, ajustar estado del shipment
6. ⏳ **PENDIENTE:** Reintentar escaneo en la app móvil

---

## 💡 **Recomendaciones para Evitar este Problema**

### 1. Monitoreo Automático de ngrok
Crear un script de healthcheck que verifique cada 5 minutos:
```javascript
// scripts/ngrok-healthcheck.mjs
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels')
    if (!response.ok) throw new Error('ngrok API not responding')
    console.log('✅ ngrok is healthy')
  } catch (error) {
    console.error('❌ ngrok is down, restarting...')
    execSync('node scripts/ngrok-only.mjs &')
  }
}, 300000) // cada 5 minutos
```

### 2. Auto-restart de ngrok
Usar un process manager como `pm2`:
```bash
npm install -g pm2
pm2 start scripts/ngrok-only.mjs --name ngrok-tunnel
pm2 startup  # Auto-start en reinicio del sistema
pm2 save
```

### 3. Mejorar Mensajes de Error
El Edge Function debería diferenciar entre:
- ❌ Error de conectividad con BD Local (ngrok offline)
- ❌ QR no encontrado en BD Local
- ❌ QR encontrado pero estado incorrecto

**Propuesta de mejora:**
```typescript
if (shipmentErr) {
  // Detectar error de conectividad
  if (shipmentErr.message?.includes('fetch failed') || 
      shipmentErr.message?.includes('network')) {
    return errorResponse(503, 'Error de conectividad con servidor local. Por favor, contacta al administrador.')
  }
  return errorResponse(404, 'QR no válido o destino equivocado')
}
```

### 4. Implementar Circuit Breaker
Si la BD Local falla repetidamente, cambiar a modo degradado:
- Permitir escaneos sin validación inmediata
- Encolar para procesamiento posterior
- Notificar al administrador

---

## 📝 **Resumen**

**Problema:** El escaneo del QR `BS-DEL-21F7B99F-FAD` falló porque el túnel ngrok está offline, impidiendo la validación del QR en la BD Local.

**Causa:** El proceso ngrok se detuvo o nunca se inició.

**Solución:** Reiniciar ngrok con `node scripts/ngrok-only.mjs &`

**Próximo Paso:** Una vez ngrok esté activo, diagnosticar el estado real del QR con el script de diagnóstico.