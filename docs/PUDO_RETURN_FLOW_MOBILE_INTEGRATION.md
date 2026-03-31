# PUDO Return Flow - Mobile App Integration

**Documento**: Cambios en la app móvil para soportar operación RETURN  
**Fecha**: 31/3/2026  
**Estado**: ✅ IMPLEMENTADO (Edge Function v19)

---

## 📋 Resumen Ejecutivo

La app móvil Android ya soporta completamente las 3 operaciones PUDO:

1. **DROPOFF** - Recepción de paquete en punto de conveniencia
2. **PICKUP** - Entrega de paquete a cliente final
3. **RETURN** - Recepción de devolución en punto de conveniencia

La **detección del tipo de operación es automática** basándose en qué campo QR coincida:
- `delivery_qr_code` → DROPOFF
- `pickup_qr_code` → PICKUP  
- `return_qr_code` → RETURN

---

## 🏗️ Arquitectura Dual Database

```
┌─────────────────────────────────────────────────────────────┐
│                      APP MÓVIL (Android)                     │
│                   apps/mobile/src/services                   │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ sesión JWT
                         ▼
        ┌────────────────────────────────┐
        │  Edge Function v19             │
        │  process-pudo-scan             │
        │  (supabase/functions/)         │
        └───┬─────────────────┬──────────┘
            │                 │
            ▼                 ▼
      ┌──────────────┐  ┌──────────────┐
      │ DB2 LOCAL    │  │ DB1 CLOUD    │
      │ Brickshare   │  │ Logistics    │
      │ (ngrok)      │  │ (Supabase)   │
      │              │  │              │
      │ shipments    │  │ packages     │
      │ users        │  │ pudo_scan    │
      │              │  │ _logs        │
      └──────────────┘  └──────────────┘
```

---

## 🔄 Flujo RETURN Completo

### 1. **Escaneo en App Móvil**

```typescript
// apps/mobile/src/services/pudoService.ts
const result = await pudoService.processScan(scannedQrCode, gpsData);

// Si el QR es un return_qr_code:
// result.operation_type === 'return'
```

### 2. **Edge Function Procesa RETURN**

**Ubicación**: `supabase/functions/process-pudo-scan/index.ts` (v19+)

#### Paso A: Detectar Operación
```typescript
// Línea 269-276
if (shipment.return_qr_code === scanned_code) {
  operationType = 'return'
  expectedStatus = 'in_return_pudo'    // ⚠️ Estado esperado en DB2
  newStatus = 'in_return'               // ✅ Nuevo estado en DB2
  timestampField = 'return_validated_at' // timestamp
  actionType = 'return_confirmation'
}
```

#### Paso B: Validar Estado DB2
- **Shipment debe estar en**: `in_return_pudo` (DB2 Brickshare)
- **Si no está**: Error 400 con mensaje descriptivo
- **Registro en pudo_scan_logs**: `validation_failed`

#### Paso C: Actualizar DB2 (Brickshare)
```typescript
// Línea 323-332
const updateData = {
  shipment_status: 'in_return',        // Estado nuevo en DB2
  return_validated_at: now,             // Timestamp de validación
  updated_at: now
}

await localSupabase
  .from('shipments')
  .update(updateData)
  .eq('id', shipment.id)
```

#### Paso D: Actualizar DB1 (Cloud)
```typescript
// Línea 425-439
const newPackage = await cloudSupabase
  .from('packages')
  .insert({
    tracking_code: scanned_code,
    type: 'return',
    status: 'returned',                 // ✅ Estado válido en ENUM
    location_id: ownerLocation.id,
    returned_at: now,
    // ... metadata
  })
```

#### Paso E: Registrar Auditoría
```typescript
// Línea 446-473
await cloudSupabase
  .from('pudo_scan_logs')
  .insert({
    pudo_location_id: ownerLocation.id,
    remote_shipment_id: shipment.id,
    previous_status: 'in_return_pudo',
    new_status: 'in_return',
    action_type: 'return_confirmation',
    api_request_successful: true,
    metadata: {
      scanned_code,
      operation_type: 'return',
      // ... datos completos
    }
  })
```

### 3. **App Móvil Recibe Respuesta**

```typescript
{
  success: true,
  operation_type: 'return',              // ✅ Tipo de operación
  message: 'Paquete recibido para devolución',
  package: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tracking_code: 'BS-DEL-54A82B94-2F1',
    status: 'returned',                  // ✅ Estado en DB1
    type: 'return',
    returned_at: '2026-03-31T21:16:30Z'
  },
  shipment: {
    id: 'abc123',
    previous_status: 'in_return_pudo',   // DB2 antes
    new_status: 'in_return',             // DB2 después
    updated_at: '2026-03-31T21:16:30Z'
  },
  timestamp: '2026-03-31T21:16:30Z',
  duration_ms: 2850
}
```

---

## 📊 Mapeo de Estados - RETURN Operation

### Cambio en DB2 (Brickshare - shipments table)

| Campo | Antes | Después | Timestamp Field |
|-------|-------|---------|-----------------|
| `shipment_status` | `in_return_pudo` | `in_return` | `return_validated_at` |

### Cambio en DB1 (Cloud Logistics - packages table)

| Campo | Valor |
|-------|-------|
| `status` (ENUM) | `returned` ✅ |
| `type` | `return` |
| `returned_at` | ISO timestamp |

### Registro Auditoría (DB1 - pudo_scan_logs)

```typescript
{
  "pudo_location_id": "location-uuid",
  "remote_shipment_id": "shipment-uuid",
  "previous_status": "in_return_pudo",
  "new_status": "in_return",
  "scanned_by_user_id": "operator-uuid",
  "action_type": "return_confirmation",     // No "delivery_confirmation"
  "api_request_successful": true,
  "api_response_code": 200,
  "api_response_message": "Shipment successfully received for return",
  "gps_validation_passed": true,
  "scan_latitude": 40.4168,
  "scan_longitude": -3.7038,
  "gps_accuracy_meters": 10.5,
  "api_request_duration_ms": 2850,
  "metadata": {
    "scanned_code": "BS-DEL-54A82B94-2F1",
    "shipment_id": "abc123",
    "operation_type": "return",
    "package_id": "550e8400-e29b-41d4-a716-446655440000",
    "local_db_updated": true,
    "cloud_db_updated": true
  }
}
```

---

## 🔧 Interfaz ScanResult en pudoService.ts

```typescript
export interface ScanResult {
  success: boolean;
  operation_type: 'dropoff' | 'pickup' | 'return';  // ✅ 'return' soportado
  message: string;
  
  package?: {
    id: string;
    tracking_code: string;
    tracking_number: string;
    status: string;  // 'in_location', 'picked_up', o 'returned'
    type: 'delivery' | 'return';
    location: {
      id: string;
      name: string;
      pudo_id: string;
      address: string;
    };
    received_at?: string;      // Solo DROPOFF
    picked_up_at?: string;     // Solo PICKUP
    returned_at?: string;      // ✅ Solo RETURN
  };
  
  shipment?: {
    id: string;
    previous_status: string;   // 'in_return_pudo'
    new_status: string;        // 'in_return'
    updated_at: string;
    customer_id: string;
    delivery_address: string;
  };
  
  timestamp: string;
  duration_ms: number;
}
```

---

## 📱 Uso en Componentes Móviles

### ScannerScreen.tsx

```typescript
// Cuando usuario escanea un QR de devolución:
try {
  const result = await pudoService.processScan(qrCode, gpsData);
  
  if (result.operation_type === 'return') {
    // ✅ Devolución procesada exitosamente
    showSuccessMessage(
      `Paquete ${result.package?.tracking_code} recibido para devolución`
    );
    
    // Actualizar UI con:
    // - result.package.returned_at
    // - result.shipment.new_status === 'in_return'
    // - Location: result.package.location.name
    
  } else if (result.operation_type === 'pickup') {
    // Entraga a cliente
    showSuccessMessage(`Paquete entregado a cliente`);
    
  } else if (result.operation_type === 'dropoff') {
    // Recepción en PUDO
    showSuccessMessage(`Paquete recepcionado en PUDO`);
  }
  
} catch (error) {
  logger.error('❌ Escaneo fallido', { error }, 'ScannerScreen');
  showErrorMessage(error.message);
}
```

---

## ⚠️ Cambios en Edge Function v19

### Línea 269: expectedStatus para RETURN

```diff
- expectedStatus = 'delivered_user'  // ❌ Antes
+ expectedStatus = 'in_return_pudo'  // ✅ Después
```

**Motivo**: El estado correcto es `in_return_pudo` cuando el cliente inicia una devolución.

### Línea 438: status en packages insert

```diff
- status: operationType === 'return' ? 'in_return'    // ❌ No existe en ENUM
+ status: operationType === 'return' ? 'returned'     // ✅ Válido en ENUM
```

**Motivo**: El ENUM de `packages.status` solo tiene `returned`, no `in_return`.

### Línea 511: status en response

```diff
- status: newStatus,  // ❌ Usar estado DB2
+ status: operationType === 'return' ? 'returned' : ...,  // ✅ Usar estado DB1
```

**Motivo**: La respuesta debe reflejar el estado en DB1 (Cloud).

---

## 🧪 Testing - Escaneo de QR de Devolución

### Simulación en Dev Mode

```typescript
// apps/mobile/src/components/DevSimulationModal.tsx

const RETURN_QR = "BS-RET-54A82B94-2F1";

async function simulateReturnScan() {
  try {
    const result = await pudoService.processScan(RETURN_QR, {
      latitude: 40.4168,
      longitude: -3.7038,
      accuracy: 10.5
    });
    
    console.log('✅ Return scan result:', result);
    // Verificar:
    // - result.operation_type === 'return'
    // - result.package.status === 'returned'
    // - result.shipment.new_status === 'in_return'
    // - result.package.returned_at existe
    
  } catch (error) {
    console.error('❌ Return scan failed:', error);
  }
}
```

### Verificación en Base de Datos

**DB2 (Brickshare - shipments)**:
```sql
SELECT id, shipment_status, return_validated_at 
FROM shipments 
WHERE return_qr_code = 'BS-RET-54A82B94-2F1';

-- Resultado esperado:
-- shipment_status = 'in_return'
-- return_validated_at = timestamp de validación
```

**DB1 (Cloud Logistics - packages)**:
```sql
SELECT id, status, returned_at 
FROM packages 
WHERE tracking_code = 'BS-RET-54A82B94-2F1';

-- Resultado esperado:
-- status = 'returned'
-- returned_at = timestamp
```

**DB1 (Cloud Logistics - pudo_scan_logs)**:
```sql
SELECT action_type, api_request_successful, new_status 
FROM pudo_scan_logs 
WHERE remote_shipment_id = '...' 
ORDER BY created_at DESC LIMIT 1;

-- Resultado esperado:
-- action_type = 'return_confirmation'
-- api_request_successful = true
-- new_status = 'in_return'
```

---

## 📝 Logs Esperados en Consola

```
✅ Escaneo Exitoso:
[pudoService] 🚀 SCAN: Starting process
[pudoService] 📱 Session found
[pudoService] 🔐 JWT CLAIMS DECODED
[pudoService] 📡 Invoking Edge Function process-pudo-scan
[pudoService] ✅ SCAN completed successfully {
  scannedCode: "BS-RET-54A82B94-2F1",
  operationType: "return",
  duration: 2850
}

Edge Function Logs (en servidor):
[VALIDATE] ✓ Shipment found
[VALIDATE] ✓ Operation: RETURN (return_qr_code matched)
[VALIDATE] ✓ Status is correct: in_return_pudo
[UPDATE] ✓ Shipment successfully updated to in_return
[CLOUD] ✓ Package created
[CLOUD] ✓ Package event created
[CLOUD] ✓ Scan log created
```

---

## 🔗 Referencias

- **Edge Function**: `supabase/functions/process-pudo-scan/index.ts` (v19+)
- **Mobile Service**: `apps/mobile/src/services/pudoService.ts`
- **Scanner Screen**: `apps/mobile/src/screens/ScannerScreen.tsx`
- **Documentation**: `docs/PUDO_RETURN_FLOW_IMPLEMENTATION.md`

---

## ✅ Checklist de Verificación

- [x] Edge Function v19 desplegada con estados correctos
- [x] DB2 expectedStatus = `in_return_pudo`
- [x] DB2 newStatus = `in_return`
- [x] DB1 status = `returned` (ENUM válido)
- [x] pudo_scan_logs registra `action_type = 'return_confirmation'`
- [x] Interface ScanResult soporta `operation_type = 'return'`
- [x] Interface ScanResult soporta `returned_at` en package
- [x] Sincronización DB2 ↔ DB1 funcionando
- [x] Timestamps correctos en ambas BDs
