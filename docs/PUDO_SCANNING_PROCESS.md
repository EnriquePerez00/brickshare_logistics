# Proceso de Escaneo PUDO - Brickshare Logistics

**Versión:** 1.0  
**Fecha:** 24/03/2026  
**Estado:** Implementado

---

## 📋 Resumen Ejecutivo

Este documento describe el proceso completo de escaneo de códigos QR en puntos PUDO (Punto de Conveniencia) para actualizar automáticamente el estado de envíos en la base de datos remota de Brickshare.

**Características principales:**
- ✅ Actualización automática de estados remotos
- ✅ Validación GPS del punto de escaneo
- ✅ Auditoría completa de todas las operaciones
- ✅ Manejo robusto de errores
- ✅ Registro de métricas de performance

---

## 🎯 Flujo de Operación

### Caso 1: Entrega en Punto PUDO

```
Cliente recibe notificación → Llega al PUDO → Muestra QR dinámico
    ↓
Operador PUDO escanea QR con app móvil
    ↓
Sistema valida GPS (operador debe estar en el punto PUDO)
    ↓
Sistema consulta estado actual en BD remota
    ↓
Si shipping_status = "in_transit_pudo" → Actualiza a "delivered_pudo"
    ↓
Registra operación en pudo_scan_logs
    ↓
Confirma entrega al operador
```

### Caso 2: Recogida de Devolución desde PUDO

```
Cliente lleva set LEGO al PUDO → Operador recibe paquete
    ↓
Operador escanea QR de devolución con app móvil
    ↓
Sistema valida GPS (operador debe estar en el punto PUDO)
    ↓
Sistema consulta estado actual en BD remota
    ↓
Si shipping_status = "in_return_pudo" → Actualiza a "in_return"
    ↓
Registra operación en pudo_scan_logs
    ↓
Confirma recepción al operador
```

---

## 🗄️ Esquema de Base de Datos

### Tabla: `pudo_scan_logs`

```sql
CREATE TABLE public.pudo_scan_logs (
  id UUID PRIMARY KEY,
  pudo_location_id UUID NOT NULL,          -- Referencia al punto PUDO
  remote_shipment_id TEXT NOT NULL,        -- ID del shipment en BD remota
  previous_status TEXT NOT NULL,           -- Estado antes del escaneo
  new_status TEXT NOT NULL,                -- Estado después del escaneo
  scanned_by_user_id UUID NOT NULL,        -- Operador que realizó el escaneo
  action_type pudo_action_type NOT NULL,   -- 'delivery_confirmation' | 'return_confirmation'
  
  -- Validación GPS
  scan_latitude NUMERIC(10, 8),
  scan_longitude NUMERIC(11, 8),
  gps_accuracy_meters NUMERIC(8, 2),
  gps_validation_passed BOOLEAN,
  
  -- Resultado de la operación
  api_request_successful BOOLEAN NOT NULL,
  api_response_code INTEGER,
  api_response_message TEXT,
  api_request_duration_ms INTEGER,
  
  -- Metadatos
  device_info TEXT,
  app_version TEXT,
  metadata JSONB,
  
  scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Ampliación de Tabla: `locations`

Se añaden campos para validación GPS:

```sql
ALTER TABLE public.locations
  ADD COLUMN latitude NUMERIC(10, 8),
  ADD COLUMN longitude NUMERIC(11, 8),
  ADD COLUMN gps_validation_radius_meters INTEGER DEFAULT 50;
```

---

## 🔐 Seguridad y Validaciones

### 1. Autenticación

- **Requisito:** JWT válido del operador PUDO
- **Rol requerido:** `owner`
- **Validación:** El operador debe pertenecer al punto PUDO

### 2. Validación GPS

**Fórmula de Haversine** para calcular distancia entre dos puntos:

```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distancia en metros
}
```

**Criterio de validación:**
- Distancia entre GPS del escaneo y GPS del punto PUDO ≤ Radio configurado (por defecto 50m)
- Si no hay coordenadas configuradas en el punto PUDO, se aprueba automáticamente

### 3. Validación de Transiciones de Estado

| Estado Actual | Estado Permitido | Tipo de Acción |
|--------------|------------------|----------------|
| `in_transit_pudo` | `delivered_pudo` | delivery_confirmation |
| `in_return_pudo` | `in_return` | return_confirmation |
| **Cualquier otro** | ❌ **Rechazado** | - |

---

## 🔧 Componentes Técnicos

### 1. Edge Function: `update-remote-shipment-status`

**Ubicación:** `supabase/functions/update-remote-shipment-status/index.ts`

**Endpoint:** `POST /functions/v1/update-remote-shipment-status`

**Headers:**
```
Authorization: Bearer <OWNER_JWT>
Content-Type: application/json
```

**Body:**
```json
{
  "shipment_id": "uuid-del-shipment",
  "qr_data": "contenido-del-qr-escaneado",
  "gps_latitude": 40.4168,
  "gps_longitude": -3.7038,
  "gps_accuracy": 10.5
}
```

**Response exitoso (200):**
```json
{
  "success": true,
  "shipment_id": "uuid",
  "previous_status": "in_transit_pudo",
  "new_status": "delivered_pudo",
  "action_type": "delivery_confirmation",
  "pudo_location": {
    "id": "uuid",
    "name": "Kiosko Central"
  },
  "gps_validation": {
    "passed": true,
    "message": "GPS validation passed: distance 15m within radius 50m"
  },
  "timestamp": "2026-03-24T22:45:00Z",
  "duration_ms": 234
}
```

**Errores posibles:**

| Código | Mensaje | Descripción |
|--------|---------|-------------|
| 401 | Missing Authorization header | No se proporcionó JWT |
| 403 | Only PUDO operators can update shipment status | El usuario no es owner |
| 403 | GPS validation failed | El operador no está en el punto PUDO |
| 404 | PUDO location not found | No se encontró el punto PUDO del operador |
| 404 | Shipment not found in remote database | El shipment_id no existe |
| 409 | Invalid status for PUDO operation | El estado actual no permite la operación |
| 500 | Failed to update shipment status | Error al actualizar la BD remota |

### 2. Función RPC: `log_pudo_scan`

Simplifica el registro de escaneos desde la Edge Function:

```sql
SELECT public.log_pudo_scan(
  p_pudo_location_id := 'uuid-del-pudo',
  p_remote_shipment_id := 'shipment-id',
  p_previous_status := 'in_transit_pudo',
  p_new_status := 'delivered_pudo',
  p_action_type := 'delivery_confirmation',
  p_scan_latitude := 40.4168,
  p_scan_longitude := -3.7038,
  p_gps_accuracy_meters := 10.5,
  p_api_successful := true,
  p_api_response_code := 200,
  p_api_response_message := 'Status updated successfully',
  p_api_duration_ms := 234
);
```

### 3. App Móvil: `ScannerScreen.tsx`

**Nuevas características:**

1. **Solicitud de permisos GPS:**
   ```typescript
   const [gpsPermission, requestGpsPermission] = Location.useForegroundPermissions();
   ```

2. **Obtención de ubicación actual:**
   ```typescript
   const loc = await Location.getCurrentPositionAsync({
     accuracy: Location.Accuracy.High,
   });
   ```

3. **Extracción de shipment_id del QR JWT:**
   ```typescript
   const payloadBase64 = qrHash.split('.')[1];
   const payload = JSON.parse(atob(payloadBase64));
   const shipmentId = payload.external_shipment_id || payload.shipment_id;
   ```

4. **Invocación de Edge Function con GPS:**
   ```typescript
   await supabase.functions.invoke('update-remote-shipment-status', {
     body: {
       shipment_id: shipmentId,
       qr_data: qrHash,
       gps_latitude: gpsData?.latitude,
       gps_longitude: gpsData?.longitude,
       gps_accuracy: gpsData?.accuracy,
     },
     headers: { Authorization: `Bearer ${session.access_token}` },
   });
   ```

---

## 📊 Auditoría y Reporting

### Vista: `pudo_scan_summary`

Proporciona resumen diario de operaciones por punto PUDO:

```sql
SELECT * FROM public.pudo_scan_summary
WHERE scan_date = CURRENT_DATE
  AND location_id = 'uuid-del-pudo'
ORDER BY scan_date DESC;
```

**Columnas:**
- `location_id`, `location_name`: Identificación del punto PUDO
- `scan_date`: Fecha del escaneo
- `action_type`: Tipo de acción (delivery/return)
- `total_scans`: Total de escaneos
- `successful_scans`: Escaneos exitosos
- `failed_scans`: Escaneos fallidos
- `gps_valid_scans`: Escaneos con GPS válido
- `gps_invalid_scans`: Escaneos con GPS inválido
- `avg_api_duration_ms`: Duración promedio de llamadas API
- `unique_operators`: Número de operadores únicos

### Queries Útiles

**1. Escaneos recientes de un punto PUDO:**
```sql
SELECT 
  psl.scan_timestamp,
  psl.action_type,
  psl.previous_status,
  psl.new_status,
  psl.gps_validation_passed,
  psl.api_request_successful,
  psl.api_request_duration_ms,
  u.first_name || ' ' || u.last_name as operator_name
FROM public.pudo_scan_logs psl
JOIN public.users u ON u.id = psl.scanned_by_user_id
WHERE psl.pudo_location_id = 'uuid-del-pudo'
  AND psl.scan_timestamp > now() - INTERVAL '7 days'
ORDER BY psl.scan_timestamp DESC;
```

**2. Detectar problemas de GPS:**
```sql
SELECT 
  l.name as location_name,
  COUNT(*) as failed_gps_validations,
  AVG(psl.gps_accuracy_meters) as avg_accuracy
FROM public.pudo_scan_logs psl
JOIN public.locations l ON l.id = psl.pudo_location_id
WHERE psl.gps_validation_passed = false
  AND psl.scan_timestamp > now() - INTERVAL '30 days'
GROUP BY l.id, l.name
ORDER BY failed_gps_validations DESC;
```

**3. Performance de API remota:**
```sql
SELECT 
  DATE(scan_timestamp) as date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE api_request_successful = true) as successful,
  COUNT(*) FILTER (WHERE api_request_successful = false) as failed,
  AVG(api_request_duration_ms)::INT as avg_duration_ms,
  MAX(api_request_duration_ms) as max_duration_ms
FROM public.pudo_scan_logs
WHERE scan_timestamp > now() - INTERVAL '30 days'
GROUP BY DATE(scan_timestamp)
ORDER BY date DESC;
```

---

## 🚀 Despliegue

### 1. Aplicar Migración

```bash
cd /path/to/brickshare_logistics
supabase db push
```

Esto aplicará la migración `008_add_pudo_scan_logs.sql`.

### 2. Configurar Variables de Entorno

**En Supabase Dashboard → Project → Settings → Edge Functions:**

```bash
REMOTE_DB_URL=https://remote-supabase-url.supabase.co
REMOTE_DB_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Deployar Edge Function

```bash
supabase functions deploy update-remote-shipment-status
```

### 4. Instalar Dependencias en App Móvil

```bash
cd apps/mobile
npm install expo-location
```

### 5. Configurar Coordenadas GPS de Puntos PUDO

```sql
UPDATE public.locations
SET 
  latitude = 40.4168,
  longitude = -3.7038,
  gps_validation_radius_meters = 50
WHERE id = 'uuid-del-pudo';
```

---

## 🧪 Testing

Ver documento separado: `PUDO_TESTING_GUIDE.md`

---

## 📝 Formato de Etiquetas QR

### QR Dinámico (Entregas)

**Estructura JWT:**
```json
{
  "package_id": "uuid",
  "location_id": "uuid",
  "type": "delivery",
  "external_shipment_id": "shipment-uuid",
  "source_system": "brickshare",
  "exp": 1711234567
}
```

**Firmado con:** HMAC-SHA256 usando `QR_JWT_SECRET`

**Expiración:** 5 minutos desde generación

### QR Estático (Devoluciones)

**Estructura JWT:**
```json
{
  "package_id": "uuid",
  "location_id": "uuid",
  "type": "return",
  "external_shipment_id": "shipment-uuid",
  "source_system": "brickshare"
}
```

**Firmado con:** HMAC-SHA256 usando `QR_JWT_SECRET`

**Expiración:** No expira temporalmente (válido hasta escaneo)

---

## 🔍 Troubleshooting

### Problema: GPS validation failed

**Causa:** El operador no está dentro del radio permitido del punto PUDO.

**Solución:**
1. Verificar que las coordenadas del punto PUDO sean correctas
2. Ajustar el radio de validación si es necesario
3. Pedir al operador que se acerque más al punto

### Problema: Invalid status for PUDO operation

**Causa:** El estado actual del shipment no es `in_transit_pudo` ni `in_return_pudo`.

**Solución:**
1. Verificar el estado actual en la BD remota
2. Asegurarse de que el shipment haya sido marcado como "en camino al PUDO" previamente
3. Contactar con administrador de Brickshare para corregir estado

### Problema: Shipment not found in remote database

**Causa:** El shipment_id no existe en la BD remota.

**Solución:**
1. Verificar que el QR corresponda a un shipment válido
2. Verificar conectividad con la BD remota
3. Comprobar que `REMOTE_DB_URL` esté correctamente configurado

---

## 📚 Referencias

- **Migración:** `supabase/migrations/008_add_pudo_scan_logs.sql`
- **Edge Function:** `supabase/functions/update-remote-shipment-status/index.ts`
- **App Móvil:** `apps/mobile/src/screens/ScannerScreen.tsx`
- **Análisis de Auditoría:** `docs/AUDIT_AND_INTEGRATION_ANALYSIS.md`

---

**Documento preparado:** 24/03/2026  
**Próxima revisión:** Después de primeras pruebas en producción