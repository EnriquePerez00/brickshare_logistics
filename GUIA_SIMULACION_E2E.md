# 🎬 Guía de Simulación E2E: Recepción y Entrega de Paquetes

## ⚡ Estado Actual

✅ **Servidor Expo iniciado en puerto 8089**
- URL: `exp://localhost:8089`
- Metro Bundler activo
- Esperando conexión desde Expo Go

---

## 📋 Escenario Completo (Brickshare + Logistics)

### PASO 1️⃣: RECEPCIÓN EN PUDO (Almacén → Punto PuDo)

**¿Qué pasa?**
- Courier entrega paquete al punto PuDo
- Operador escanea código de barras de la etiqueta
- App crea registro de paquete en estado `in_location`

**Preparación en iPhone (Expo Go)**:

1. **Instalar Expo Go**
   - App Store → "Expo Go" → Instalar

2. **Conectar a servidor Expo**
   ```
   En Expo Go:
   - Pestaña "Home"
   - Botón escanear (esquina arriba dcha)
   - Escanear QR que verás en terminal Mac
   
   O conectar directamente:
   - Terminal mostrará URL + código QR
   - iPhone en misma red Wi-Fi que Mac
   ```

3. **Login en app**
   ```
   Email: user@brickshare.eu
   Password: [tu contraseña local Supabase]
   ```

4. **Aceptar permisos**
   - Cámara: "Allow"
   - Ubicación: "Allow While Using App" (GPS para validación)

5. **Seleccionar Modo: "Recepción"** (botón azul)

6. **Escanear código de barras**
   - Necesitas un código de barras físico o generado
   - Ejemplos válidos:
     - `TEST001` (Code128)
     - `8412345678901` (EAN13)
     - Usa generador: https://barcode.tec-it.com
   
   - Resultado esperado:
     ```
     ✅ Recepcionado
     Tracking: TEST001
     Estado: in_location
     Hora: [timestamp]
     ```

7. **Verificar en Base de Datos**
   ```sql
   SELECT * FROM packages 
   WHERE tracking_code = 'TEST001'
   AND status = 'in_location';
   
   -- Debe existir con:
   -- - type: 'delivery'
   -- - status: 'in_location'
   -- - location_id: [punto PuDo del usuario]
   ```

---

### PASO 2️⃣: GENERACIÓN DE QR DINÁMICO

**¿Qué pasa?**
- Sistema genera QR que el cliente mostrará al buscar su paquete
- QR es un JWT que expira en 5 minutos
- Cliente recibe email con QR (en sistema real)

**En Terminal Mac**:

```bash
# Conectar a Supabase local
cd /Users/I764690/Code_personal/Brickshare_logistics

# Ver credenciales
supabase status

# Generar QR dinámico para el paquete
curl -X POST http://127.0.0.1:54321/functions/v1/generate-dynamic-qr \
  -H "Authorization: Bearer <JWT_DEL_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "[UUID_DEL_PACKAGE]"
  }'

# Respuesta exitosa:
# {
#   "qr_hash": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "expires_at": "2026-03-27T17:52:00Z",
#   "package_id": "[uuid]"
# }
```

**Generar QR Visual**:
- Usar generador QR online: https://qr-code-generator.com/
- Pegar el `qr_hash` como texto
- Capturar pantalla del QR (o imprimirlo)

---

### PASO 3️⃣: ENTREGA A CLIENTE (PuDo → Cliente)

**¿Qué pasa?**
- Cliente llega al PuDo y muestra QR en pantalla
- Operador escanea el QR
- App captura GPS
- App comunica con Brickshare: "Paquete entregado"

**En iPhone (Expo Go)**:

1. **Mantener iPhone cerca del PuDo**
   - Punto: Casa - Test (41.3851, 2.1734)
   - Radio: 50 metros (configurable)
   - App tendrá acceso GPS automático

2. **Cambiar modo a "Entrega (QR)"** (botón verde)

3. **Escanear el QR del cliente**
   - Mostrar pantalla con QR en otra device
   - iPhone captura con cámara Expo Go
   
   - Proceso automático:
     ```
     1. App lee QR Code (JWT)
     2. Extrae shipment_id del JWT
     3. Captura GPS actual
     4. Valida distancia < 50m al punto PuDo
     5. Llama update-remote-shipment-status
     6. Edge Function comunica con Brickshare
     7. Muestra confirmación
     ```

4. **Resultado esperado**:
   ```
   ✅ Entrega Confirmada
   
   Shipment ID: [id]
   Estado anterior: in_transit_pudo
   Estado nuevo: delivered_pudo
   GPS: 41.3851, 2.1734 (validado ✓)
   Timestamp: [ISO8601]
   ```

5. **Verificar en BD**:
   ```sql
   -- Paquete actualizado
   SELECT id, tracking_code, status, updated_at 
   FROM packages 
   WHERE id = '[uuid]';
   -- status debería ser 'picked_up'
   
   -- Log de operación
   SELECT * FROM pudo_scan_logs 
   WHERE pudo_location_id = '[location_id]'
   ORDER BY created_at DESC LIMIT 1;
   -- Debe tener:
   -- - action_type: 'delivery_confirmation'
   -- - gps_validation_passed: true
   -- - api_request_successful: true
   ```

---

## 🔧 Troubleshooting

### ❌ "Port 8089 already in use"
```bash
# Kill existing process
lsof -ti:8089 | xargs kill -9

# Restart Expo
npm start -- --port 8089
```

### ❌ "GPS validation failed"
- Verifica que iPhone está cercano al punto PuDo (< 50m)
- Si es simulado, edita coordenadas en app o ajusta radio

### ❌ "QR code is invalid or has expired"
- QR dinámico expira en 5 minutos
- Regenera uno nuevo antes de escanear

### ❌ "Shipment not found in remote database"
- Brickshare API no responde
- Verifica `BRICKSHARE_API_URL` en `.env`
- Revisa logs: `supabase log tail --function-name update-remote-shipment-status`

### ❌ "Camera permission denied"
- En Expo Go, ir a Settings
- Dar permiso de cámara a Expo

---

## 📊 Verificación de Integridad

### Base de Datos Local

```bash
# Conectar a PostgreSQL
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Ver punto PuDo
SELECT id, pudo_id, name, latitude, longitude FROM locations 
WHERE pudo_id = 'brickshare-001';

# Ver paquetes recibidos
SELECT id, tracking_code, type, status, external_shipment_id 
FROM packages 
WHERE type = 'delivery' 
ORDER BY created_at DESC;

# Ver logs de operaciones
SELECT id, action_type, gps_validation_passed, api_request_successful, created_at
FROM pudo_scan_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

### Edge Functions

```bash
# Ver logs de function
supabase log tail --function-name update-remote-shipment-status

# Probar connection
curl -X POST http://127.0.0.1:54321/functions/v1/generate-dynamic-qr \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"package_id": "test"}'
```

---

## 📱 Flujo Visual

```
┌─────────────────────────────────────────────────────────┐
│              OPERADOR EN PUNTO PUDO                     │
│        (iPhone con app Brickshare Logistics)            │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
    ┌─────────────┐        ┌─────────────┐
    │ RECEPCIÓN   │        │ ENTREGA     │
    │ (Barcode)   │        │ (QR)        │
    └──────┬──────┘        └──────┬──────┘
           │                      │
           ▼                      ▼
    ┌──────────────────────────────────────┐
    │  Validación + Registro BD            │
    │  packages (status: in_location)      │
    └──────────────────────────────────────┘
           │
           ▼ [5 min después]
    ┌──────────────────────────────────────┐
    │  Cliente genera QR dinámico          │
    │  JWT con external_shipment_id        │
    └──────────────────────────────────────┘
           │
           ▼ [Cliente llega al PuDo]
    ┌──────────────────────────────────────┐
    │  Operador escanea QR con app         │
    │  App captura GPS                     │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │  Edge Function: update-remote-status │
    │  - Valida JWT                        │
    │  - Valida GPS (< 50m)                │
    │  - Actualiza BD local                │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │  HTTP POST a Brickshare API          │
    │  Comunica: "Entrega confirmada"      │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │  Brickshare actualiza BD             │
    │  shipment: pending → delivered_pudo  │
    │  Usuario notificado                  │
    └──────────────────────────────────────┘
```

---

## 🎯 Checklist de Prueba

- [ ] Servidor Expo corriendo en puerto 8089
- [ ] iPhone conectado con Expo Go
- [ ] Login exitoso (user@brickshare.eu)
- [ ] Permisos otorgados (cámara + ubicación)
- [ ] **PASO 1**: Escanear código barras → Paquete creado con status `in_location`
- [ ] **PASO 2**: Generar QR dinámico para el paquete
- [ ] **PASO 2**: Capturar pantalla del QR
- [ ] **PASO 3**: Escanear QR con app
- [ ] **PASO 3**: GPS validado (< 50m)
- [ ] **PASO 3**: Confirmación de entrega mostrada
- [ ] **VERIFICAR**: Paquete en BD con status `picked_up`
- [ ] **VERIFICAR**: Log registrado en `pudo_scan_logs`
- [ ] **VERIFICAR**: Brickshare API respondió correctamente

---

**Última actualización**: 27/03/2026
**Versión**: 1.0.0 - Guía E2E Completa
