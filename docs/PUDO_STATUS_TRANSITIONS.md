# Diagrama de Transiciones de Estado PUDO

**Versión:** 1.0  
**Fecha:** 24/03/2026

---

## 🔄 Ciclo Completo de Vida de un Envío

### Vista General

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SISTEMA BRICKSHARE                              │
│                   (Base de Datos Remota)                            │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               │ Estados gestionados remotamente
               │
┌──────────────▼──────────────────────────────────────────────────────┐
│                                                                       │
│  ENVÍO (Delivery)                                                    │
│  ═══════════════                                                     │
│                                                                       │
│  1. pending                                                          │
│     │                                                                │
│     ├──► 2. confirmed                                               │
│     │        │                                                        │
│     │        └──► 3. preparing                                      │
│     │                 │                                              │
│     │                 └──► 4. in_transit                           │
│     │                          │                                     │
│     │                          └──► 5. in_transit_pudo ◄─┐          │
│     │                                   │                 │          │
│     │                                   │    [ESCANEO    │          │
│     │                                   │     QR EN      │          │
│     │                                   │     PUDO]      │          │
│     │                                   │                 │          │
│     │                                   └──► 6. delivered_pudo      │
│     │                                            │                   │
│     │                                            └──► 7. delivered  │
│     │                                                                │
│     └──────────────────────────────────────────────────► 8. canceled│
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  DEVOLUCIÓN (Return)                                                 │
│  ══════════════════                                                  │
│                                                                       │
│  1. return_requested                                                 │
│     │                                                                │
│     └──► 2. return_approved                                         │
│              │                                                        │
│              └──► 3. in_return_pudo ◄─┐                            │
│                       │                 │                            │
│                       │    [ESCANEO    │                            │
│                       │     QR EN      │                            │
│                       │     PUDO]      │                            │
│                       │                 │                            │
│                       └──► 4. in_return                             │
│                                │                                     │
│                                └──► 5. return_received              │
│                                         │                            │
│                                         └──► 6. return_processed    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Estados Detallados

### Estados de Envío (Delivery)

| Estado | Descripción | Actor Responsable | Siguiente Estado |
|--------|-------------|-------------------|------------------|
| `pending` | Pedido creado, esperando confirmación | Sistema | `confirmed` o `canceled` |
| `confirmed` | Pedido confirmado por el cliente | Cliente | `preparing` |
| `preparing` | Set LEGO siendo preparado en almacén | Almacén Brickshare | `in_transit` |
| `in_transit` | En camino a punto PUDO via courier | Courier (Correos/SEUR) | `in_transit_pudo` |
| **`in_transit_pudo`** | **Llegado al punto PUDO, esperando entrega** | **Sistema** | **`delivered_pudo`** |
| **`delivered_pudo`** | **Cliente recogió en PUDO** | **Operador PUDO** | `delivered` |
| `delivered` | Entrega completada y confirmada | Sistema | - (estado final) |
| `canceled` | Pedido cancelado | Cliente/Admin | - (estado final) |

### Estados de Devolución (Return)

| Estado | Descripción | Actor Responsable | Siguiente Estado |
|--------|-------------|-------------------|------------------|
| `return_requested` | Cliente solicita devolución | Cliente | `return_approved` o `return_rejected` |
| `return_approved` | Devolución aprobada | Admin Brickshare | `in_return_pudo` |
| **`in_return_pudo`** | **Set en PUDO esperando recogida** | **Cliente** | **`in_return`** |
| **`in_return`** | **En camino de vuelta al almacén** | **Operador PUDO** | `return_received` |
| `return_received` | Recibido en almacén | Almacén Brickshare | `return_processed` |
| `return_processed` | Devolución procesada (reembolso realizado) | Sistema | - (estado final) |

---

## 🎯 Transiciones Gestionadas por Sistema PUDO

### Transición 1: Entrega en PUDO

**Trigger:** Escaneo de QR por operador PUDO

**Condición Previa:**
- `shipping_status = "in_transit_pudo"`
- El set llegó físicamente al PUDO
- Cliente muestra QR dinámico válido (no expirado)

**Validaciones:**
1. ✅ JWT del QR válido y firmado correctamente
2. ✅ QR no expirado (máx 5 minutos desde generación)
3. ✅ Operador autenticado con rol `owner`
4. ✅ Operador pertenece al PUDO correcto
5. ✅ GPS del operador dentro del radio permitido (50m por defecto)

**Acción:**
```
Estado: in_transit_pudo → delivered_pudo
```

**Registro en BD:**
```sql
INSERT INTO pudo_scan_logs (
  pudo_location_id,
  remote_shipment_id,
  previous_status = 'in_transit_pudo',
  new_status = 'delivered_pudo',
  action_type = 'delivery_confirmation',
  scan_latitude,
  scan_longitude,
  gps_validation_passed,
  api_request_successful,
  ...
)
```

---

### Transición 2: Recogida de Devolución en PUDO

**Trigger:** Escaneo de QR de devolución por operador PUDO

**Condición Previa:**
- `shipping_status = "in_return_pudo"`
- Cliente llevó el set físicamente al PUDO
- Cliente muestra QR estático de devolución (no expira)

**Validaciones:**
1. ✅ JWT del QR válido y firmado correctamente
2. ✅ QR estático de tipo `return`
3. ✅ Operador autenticado con rol `owner`
4. ✅ Operador pertenece al PUDO correcto
5. ✅ GPS del operador dentro del radio permitido (50m por defecto)

**Acción:**
```
Estado: in_return_pudo → in_return
```

**Registro en BD:**
```sql
INSERT INTO pudo_scan_logs (
  pudo_location_id,
  remote_shipment_id,
  previous_status = 'in_return_pudo',
  new_status = 'in_return',
  action_type = 'return_confirmation',
  scan_latitude,
  scan_longitude,
  gps_validation_passed,
  api_request_successful,
  ...
)
```

---

## ⚠️ Transiciones Rechazadas

### Estados que NO permiten operaciones PUDO

| Estado Actual | Intento de Transición | Error |
|---------------|----------------------|-------|
| `pending` | → `delivered_pudo` | ❌ Estado inválido: paquete no ha sido enviado |
| `in_transit` | → `delivered_pudo` | ❌ Paquete aún no llegó al PUDO |
| `delivered_pudo` | → `delivered_pudo` | ❌ Ya fue entregado |
| `delivered` | → `delivered_pudo` | ❌ Entrega ya completada |
| `return_requested` | → `in_return` | ❌ Devolución no aprobada aún |

---

## 🔐 Validación GPS

### Algoritmo de Validación

```typescript
function validateGPS(
  scanLat: number,
  scanLon: number,
  pudoLat: number,
  pudoLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateHaversineDistance(
    scanLat, scanLon,
    pudoLat, pudoLon
  );
  
  return distance <= radiusMeters;
}
```

### Criterios

- **Radio por defecto:** 50 metros
- **Configurable por punto PUDO:** Sí, en tabla `locations`
- **Comportamiento sin GPS:** Aprueba automáticamente si no hay coordenadas configuradas

### Ejemplos

| Distancia | Radio Configurado | Resultado |
|-----------|-------------------|-----------|
| 15m | 50m | ✅ PASS |
| 45m | 50m | ✅ PASS |
| 60m | 50m | ❌ FAIL |
| 100m | 50m | ❌ FAIL |
| N/A | Sin configurar | ✅ PASS (auto-aprobado) |

---

## 📱 Flujo en App Móvil

### Secuencia de Operación

```
1. Operador abre app móvil
   ↓
2. Sistema solicita permisos GPS
   ↓
3. Sistema obtiene ubicación actual
   ↓
4. Operador selecciona modo "Entrega (QR)"
   ↓
5. Cliente muestra QR en pantalla
   ↓
6. Operador escanea QR con cámara
   ↓
7. Sistema extrae shipment_id del JWT
   ↓
8. Sistema captura GPS actual (con precisión alta)
   ↓
9. Sistema invoca Edge Function con:
   - shipment_id
   - qr_data
   - gps_latitude
   - gps_longitude
   - gps_accuracy
   ↓
10. Edge Function valida:
    - Autenticación del operador
    - Pertenencia al PUDO correcto
    - GPS dentro del radio
    - Estado actual válido
   ↓
11. Edge Function actualiza estado en BD remota
   ↓
12. Edge Function registra en pudo_scan_logs
   ↓
13. App muestra confirmación al operador:
    ✅ "Entrega confirmada"
    Estado: in_transit_pudo → delivered_pudo
    GPS: Validación exitosa (15m dentro de 50m)
```

---

## 🗂️ Estructura de Datos

### Tabla: shipment_status (BD Remota)

```sql
-- Esta tabla está en la BD remota de Brickshare
CREATE TABLE shipment_status (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  metadata JSONB
);
```

### Tabla: pudo_scan_logs (BD Local)

```sql
-- Esta tabla está en la BD local de Brickshare Logistics
CREATE TABLE pudo_scan_logs (
  id UUID PRIMARY KEY,
  pudo_location_id UUID NOT NULL,
  remote_shipment_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  scanned_by_user_id UUID NOT NULL,
  action_type pudo_action_type NOT NULL,
  
  -- GPS
  scan_latitude NUMERIC(10, 8),
  scan_longitude NUMERIC(11, 8),
  gps_accuracy_meters NUMERIC(8, 2),
  gps_validation_passed BOOLEAN,
  
  -- API
  api_request_successful BOOLEAN NOT NULL,
  api_response_code INTEGER,
  api_response_message TEXT,
  api_request_duration_ms INTEGER,
  
  -- Metadata
  device_info TEXT,
  app_version TEXT,
  metadata JSONB,
  
  scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 📊 Métricas y Monitoreo

### Queries de Análisis

**1. Tasa de éxito de escaneos:**
```sql
SELECT 
  DATE(scan_timestamp) as date,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE api_request_successful = true) as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE api_request_successful = true) / COUNT(*), 2) as success_rate
FROM pudo_scan_logs
WHERE scan_timestamp > now() - INTERVAL '30 days'
GROUP BY DATE(scan_timestamp)
ORDER BY date DESC;
```

**2. Validación GPS por punto PUDO:**
```sql
SELECT 
  l.name as pudo_name,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE gps_validation_passed = true) as gps_valid,
  COUNT(*) FILTER (WHERE gps_validation_passed = false) as gps_invalid
FROM pudo_scan_logs psl
JOIN locations l ON l.id = psl.pudo_location_id
WHERE psl.scan_timestamp > now() - INTERVAL '7 days'
GROUP BY l.id, l.name
ORDER BY gps_invalid DESC;
```

**3. Duración promedio de API:**
```sql
SELECT 
  action_type,
  COUNT(*) as total_requests,
  AVG(api_request_duration_ms)::INTEGER as avg_duration_ms,
  MIN(api_request_duration_ms) as min_duration_ms,
  MAX(api_request_duration_ms) as max_duration_ms
FROM pudo_scan_logs
WHERE api_request_successful = true
  AND scan_timestamp > now() - INTERVAL '7 days'
GROUP BY action_type;
```

---

## 🚨 Alertas y Errores Comunes

### Error 1: GPS Validation Failed

**Síntoma:**
```json
{
  "error": "GPS validation failed: distance 85m exceeds allowed radius 50m"
}
```

**Causa:** Operador no está físicamente en el punto PUDO

**Solución:**
1. Verificar ubicación del operador
2. Acercarse más al punto PUDO
3. Si el problema persiste, revisar coordenadas configuradas del PUDO
4. Considerar aumentar el radio de validación si el local es grande

---

### Error 2: Invalid Status for PUDO Operation

**Síntoma:**
```json
{
  "error": "Invalid status for PUDO operation: delivered. Expected in_transit_pudo or in_return_pudo."
}
```

**Causa:** El shipment ya fue procesado o tiene un estado incorrecto

**Solución:**
1. Verificar estado actual en BD remota
2. Consultar con administrador de Brickshare
3. Si es un error, corregir manualmente el estado

---

### Error 3: Shipment Not Found

**Síntoma:**
```json
{
  "error": "Shipment not found in remote database"
}
```

**Causa:** El shipment_id no existe en la BD remota

**Solución:**
1. Verificar que el QR corresponde a un envío válido
2. Comprobar conectividad con BD remota
3. Verificar configuración de `REMOTE_DB_URL`

---

## 📚 Referencias

- **Proceso completo:** `docs/PUDO_SCANNING_PROCESS.md`
- **Migración BD:** `supabase/migrations/008_add_pudo_scan_logs.sql`
- **Edge Function:** `supabase/functions/update-remote-shipment-status/index.ts`
- **App Móvil:** `apps/mobile/src/screens/ScannerScreen.tsx`
- **Tests:** `supabase/migrations/008_add_pudo_scan_logs.test.sql`

---

**Documento preparado:** 24/03/2026  
**Última actualización:** 24/03/2026