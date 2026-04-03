# Diagnóstico del Error de Escaneo QR BS-DEL-94BB3AB2-59E

**Fecha:** 2026-03-04 20:43
**QR Code:** BS-DEL-94BB3AB2-59E
**Error:** "QR no válido o destino equivocado"

---

## 🔍 Resumen del Problema

El error al intentar escanear el QR **BS-DEL-94BB3AB2-59E** NO es causado por un problema con el QR en sí, sino por un **problema de conectividad** con el túnel ngrok.

## 📊 Análisis Detallado

### 1. Arquitectura del Sistema

El sistema utiliza una **arquitectura de base de datos dual**:

- **BD Cloud (Logistics)**: `https://qumjzvhtotcvnzpjgjkl.supabase.co`
  - Autentica usuarios PUDO
  - Registra logs y eventos
  - Almacena paquetes y eventos

- **BD Local (Brickshare)**: `https://semblably-dizzied-bruno.ngrok-free.dev`
  - Validación de QR codes en la tabla `shipments`
  - Actualización de estados de envíos
  - Accesible vía túnel ngrok

### 2. Flujo del Escaneo QR

Cuando escaneas un QR en la app móvil:

1. ✅ **Autenticación** en BD Cloud → EXITOSA
   ```
   User: d7a9f671-f5fa-4a31-8ba8-145e6219fd9b (user@brickshare.eu)
   ```

2. ❌ **Validación del QR** en BD Local → FALLIDA
   ```
   Error: The endpoint semblably-dizzied-bruno.ngrok-free.dev is offline.
   ERR_NGROK_3200
   ```

3. ❌ **Respuesta del Edge Function**
   ```
   "QR no válido o destino equivocado"
   ```

### 3. Causa Raíz

El **túnel ngrok está offline/caído**, lo que impide:
- Conectar con la BD local de Brickshare
- Validar si el QR existe en la tabla `shipments`
- Verificar el estado del shipment
- Procesar el escaneo

### 4. Por Qué el Túnel Está Caído

El túnel ngrok que iniciamos hace 5 minutos se cayó porque:

1. **Timeout de inactividad**: ngrok puede cerrar conexiones inactivas
2. **Límite de duración**: La versión gratuita de ngrok tiene límites de tiempo
3. **Proceso terminado**: El proceso `node scripts/ngrok-only.mjs` pudo haber terminado
4. **Conexión de red**: Problemas temporales de red

### 5. Evidencia

```bash
# Verificación del proceso ngrok
$ ps aux | grep ngrok | grep -v grep
(Sin resultados - proceso no activo)

# Intento de conectar a la BD local
$ node scripts/diagnose-specific-qr.mjs
Error: The endpoint semblably-dizzied-bruno.ngrok-free.dev is offline.
ERR_NGROK_3200
```

## 🎯 Validación del Edge Function

Revisando el código en `supabase/functions/process-pudo-scan/index.ts`:

**Líneas 222-234:** Validación del QR
```typescript
const { data: shipment, error: shipmentErr } = await localSupabase
  .from('shipments')
  .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, ...')
  .or(`delivery_qr_code.eq.${scanned_code},pickup_qr_code.eq.${scanned_code},return_qr_code.eq.${scanned_code}`)
  .single()

if (shipmentErr || !shipment) {
  console.error('[VALIDATE] ❌ QR not found in shipments table:', shipmentErr?.message)
  return errorResponse(404, 'QR no válido o destino equivocado')  // ← ESTE ES EL ERROR
}
```

El Edge Function intenta consultar `localSupabase` (la BD de Brickshare vía ngrok), pero como ngrok está offline, la consulta falla y retorna el error genérico **"QR no válido o destino equivocado"**.

## 📝 Conclusión

El QR `BS-DEL-94BB3AB2-59E` **puede o no existir** en la base de datos local, pero **no podemos saberlo** hasta que el túnel ngrok esté funcionando nuevamente.

### Estados Posibles del QR:

**Escenario A: QR existe y estado es correcto**
- Una vez ngrok esté activo, el escaneo funcionará correctamente

**Escenario B: QR existe pero estado es incorrecto**
- El QR existe pero está en un estado incompatible (ej: ya fue procesado)
- Necesitarás actualizar el estado manualmente

**Escenario C: QR no existe**
- El QR no está registrado en la tabla `shipments`
- Necesitarás cargar datos de prueba o verificar que el QR sea correcto

## 🔧 Solución

### Paso 1: Reiniciar el Túnel ngrok
```bash
node scripts/ngrok-only.mjs &
```

### Paso 2: Verificar que esté activo
```bash
# Verificar proceso
ps aux | grep ngrok | grep -v grep

# Verificar API de ngrok
curl http://localhost:4040/api/tunnels
```

### Paso 3: Ejecutar diagnóstico nuevamente
```bash
node scripts/diagnose-specific-qr.mjs
```

Esto revelará el estado real del QR y te indicará:
- Si existe en la BD local
- Cuál es su estado actual
- Si el estado es compatible con la operación de escaneo

## 📌 Recomendaciones

1. **Monitorear ngrok**: Implementar un sistema de monitoreo para detectar cuando el túnel se cae
2. **Auto-restart**: Configurar reinicio automático del túnel ngrok
3. **Logs mejorados**: El mensaje de error debería ser más específico (ej: "Error de conectividad con BD local")
4. **Timeout handling**: Implementar timeouts y reintentos en el Edge Function
5. **Healthcheck**: Agregar un endpoint de healthcheck para verificar la conectividad con la BD local

---

**Estado del Diagnóstico:** ✅ COMPLETO
