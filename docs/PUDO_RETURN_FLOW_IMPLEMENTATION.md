# PUDO Return Flow Implementation

## Overview

Se ha añadido soporte para un tercer tipo de operación: **RETURN** (Devolución en PUDO). El sistema ahora detecta automáticamente si un código QR escaneado corresponde a:

1. **DROPOFF** (Recepción en PUDO)
2. **PICKUP** (Entrega a cliente)
3. **RETURN** (Devolución en PUDO) - **NUEVO**

## Requisitos Implementados

### 1. Soporte para Return QR Code

- ✅ Campo `shipments.return_qr_code` ya existe
- ✅ Campo `shipments.return_validated_at` ya existe
- ✅ Campo `users.user_status` ya existe

### 2. Flujos de Operación

#### DROPOFF (Recepción en PUDO)
```
QR Code: delivery_qr_code
Estado esperado: in_transit_pudo
Estado nuevo: delivered_pudo
Timestamp: delivery_validated_at
```

#### PICKUP (Entrega a cliente)
```
QR Code: pickup_qr_code
Estado esperado: delivered_pudo
Estado nuevo: delivered_user
Timestamp: pickup_validated_at
→ NUEVO: Actualiza users.user_status = 'received'
```

#### RETURN (Devolución en PUDO) - NUEVO
```
QR Code: return_qr_code
Estado esperado: delivered_user
Estado nuevo: in_return
Timestamp: return_validated_at
```

## Cambios Realizados

### 1. Edge Function (`supabase/functions/process-pudo-scan/index.ts`)

#### Búsqueda de QR (Línea 194-198)
```typescript
const { data: shipment, error: shipmentErr } = await localSupabase
  .from('shipments')
  .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, tracking_number, user_id, shipping_address, shipping_city')
  .or(`delivery_qr_code.eq.${scannedCode},pickup_qr_code.eq.${scannedCode},return_qr_code.eq.${scannedCode}`)
  .single()
```

#### Detección de Operación (Línea 216-253)
```typescript
let operationType: 'dropoff' | 'pickup' | 'return'
let expectedStatus: string
let newStatus: string
let timestampField: string
let actionType: 'delivery_confirmation' | 'return_confirmation'

if (shipment.delivery_qr_code === scanned_code) {
  operationType = 'dropoff'
  expectedStatus = 'in_transit_pudo'
  newStatus = 'delivered_pudo'
  timestampField = 'delivery_validated_at'
  actionType = 'delivery_confirmation'
} else if (shipment.pickup_qr_code === scanned_code) {
  operationType = 'pickup'
  expectedStatus = 'delivered_pudo'
  newStatus = 'delivered_user'
  timestampField = 'pickup_validated_at'
  actionType = 'delivery_confirmation'
} else if (shipment.return_qr_code === scanned_code) {
  operationType = 'return'
  expectedStatus = 'delivered_user'
  newStatus = 'in_return'
  timestampField = 'return_validated_at'
  actionType = 'return_confirmation'
}
```

#### Actualización de User Status (NUEVO - Línea 292-310)
```typescript
// Para operaciones PICKUP, actualizar users.user_status = 'received'
if (operationType === 'pickup' && newStatus === 'delivered_user') {
  console.log('[UPDATE] Updating user status to "received"...')
  const { error: userUpdateErr } = await localSupabase
    .from('users')
    .update({ user_status: 'received' })
    .eq('id', shipment.user_id)

  if (userUpdateErr) {
    console.error('[UPDATE] ⚠️ Failed to update user status:', userUpdateErr.message)
  } else {
    console.log('[UPDATE] ✓ User status updated to "received"')
  }
}
```

#### Actualización de Package en Cloud (Línea 317-332)
```typescript
const { data: newPackage, error: packageErr } = await cloudSupabase
  .from('packages')
  .insert({
    tracking_code: scanned_code,
    type: operationType === 'dropoff' ? 'delivery' : operationType === 'pickup' ? 'delivery' : 'return',
    status: operationType === 'dropoff' ? 'in_location' : operationType === 'pickup' ? 'picked_up' : 'in_return',
    location_id: ownerLocation.id,
    source_system: 'brickshare',
    external_shipment_id: shipment.id,
    received_at: operationType === 'dropoff' ? now : undefined,
    picked_up_at: operationType === 'pickup' ? now : undefined,
    returned_at: operationType === 'return' ? now : undefined,
    remote_shipment_data: shipment,
  })
```

### 2. Mobile Service (`apps/mobile/src/services/pudoService.ts`)

#### Interfaz ScanResult
```typescript
export interface ScanResult {
  success: boolean;
  operation_type: 'dropoff' | 'pickup' | 'return'; // Ahora soporta 'return'
  // ... resto de propiedades incluyendo:
  package?: {
    // ...
    returned_at?: string; // Nuevo campo
  };
}
```

## Validaciones y Reglas de Negocio

### RETURN Operation
- ✅ Requiere que shipment esté en estado `delivered_user`
- ✅ Requiere que exista un `return_qr_code`
- ✅ Actualiza `shipment_status` a `in_return`
- ✅ Registra timestamp en `return_validated_at`
- ✅ Crea record en `packages` tabla con `type='return'` y `status='in_return'`
- ✅ Registra auditoría en `pudo_scan_logs`

### PICKUP Operation
- ✅ Requiere que shipment esté en estado `delivered_pudo`
- ✅ Requiere que exista un `pickup_qr_code`
- ✅ Actualiza `shipment_status` a `delivered_user`
- ✅ **NUEVO**: Actualiza `users.user_status` a `received`
- ✅ Registra timestamp en `pickup_validated_at`

## Testing

### Casos de Prueba

1. **DROPOFF**: Escanear `delivery_qr_code` con shipment en estado `in_transit_pudo`
   - ✅ Debe cambiar a `delivered_pudo`
   - ✅ Debe registrar `delivery_validated_at`

2. **PICKUP**: Escanear `pickup_qr_code` con shipment en estado `delivered_pudo`
   - ✅ Debe cambiar a `delivered_user`
   - ✅ Debe actualizar `users.user_status = 'received'`
   - ✅ Debe registrar `pickup_validated_at`

3. **RETURN**: Escanear `return_qr_code` con shipment en estado `delivered_user`
   - ✅ Debe cambiar a `in_return`
   - ✅ Debe registrar `return_validated_at`

## Logging y Auditoría

Todos los escaneos se registran en `pudo_scan_logs` con:
- `action_type`: 'delivery_confirmation' o 'return_confirmation'
- `operation_type`: 'dropoff', 'pickup', o 'return'
- Metadatos completos de la operación
- Códigos de respuesta y mensajes

## Respuestas de API

### Success Response (ejemplo RETURN)
```json
{
  "success": true,
  "operation_type": "return",
  "message": "Paquete recibido para devolución",
  "package": {
    "id": "pkg-123",
    "tracking_code": "BS-RET-ABC123",
    "status": "in_return",
    "type": "return",
    "returned_at": "2026-03-31T22:54:57.000Z"
  },
  "shipment": {
    "id": "ship-123",
    "previous_status": "delivered_user",
    "new_status": "in_return",
    "updated_at": "2026-03-31T22:54:57.000Z"
  }
}
```

## Mensajes de Error

- ❌ **delivery_qr_code no encontrado**: "QR no válido o destino equivocado"
- ❌ **pickup_qr_code no encontrado**: "QR no válido o destino equivocado"
- ❌ **return_qr_code no encontrado**: "QR no válido o destino equivocado"
- ❌ **Estado inválido para RETURN**: "Estado inválido: se esperaba 'delivered_user', pero el paquete está en '...'"

## Notas Importantes

1. El sistema detecta automáticamente el tipo de operación basándose en cuál campo QR coincide
2. Solo una ubicación por usuario, pero múltiples operaciones en esa ubicación
3. La actualización de `users.user_status` solo se aplica en operaciones PICKUP
4. Las devoluciones se registran automáticamente en BD Cloud para auditoría
5. Compatible con DEV_MODE para testing local