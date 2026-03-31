# QR Scanning Refactor - Unified Operation Detection

**Date:** March 31, 2026  
**Status:** Implementation Complete  
**Scope:** Android Mobile App - Automatic Detection of DROPOFF vs PICKUP Operations

---

## Overview

This refactor consolidates PUDO QR scanning into a single unified flow that automatically detects whether a scanned code represents a **DROPOFF** (package delivery to PUDO) or **PICKUP** (package delivery to customer).

### Key Changes
- **Single `processScan()` function** replaces separate `processDropoff()` and `processPickup()` methods
- **Automatic operation detection** in Edge Function based on QR code field matching
- **Unified response structure** with `operation_type` field
- **Dual-field support** in remote database: `delivery_qr_code` + `pickup_qr_code`

---

## Architecture

### 1. Database Schema (Remote Brickshare DB)

Each shipment now has **two QR code fields**:

```sql
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS:
  - delivery_qr_code TEXT UNIQUE          -- For PUDO reception
  - pickup_qr_code TEXT UNIQUE            -- For customer delivery
  - delivery_validated_at TIMESTAMP       -- When PUDO receives it
  - pickup_validated_at TIMESTAMP         -- When customer receives it
```

**Indexes** created for fast lookups:
```sql
CREATE INDEX idx_shipments_delivery_qr_code 
  ON shipments(delivery_qr_code) WHERE delivery_qr_code IS NOT NULL;

CREATE INDEX idx_shipments_pickup_qr_code 
  ON shipments(pickup_qr_code) WHERE pickup_qr_code IS NOT NULL;
```

---

### 2. Edge Function: `process-pudo-scan`

**Location:** `supabase/functions/process-pudo-scan/index.ts`

#### Flow

```
1. Authentication
   └─ Validate JWT token from mobile app
   
2. Location Resolution
   └─ Get PUDO operator's location from user_locations table
   
3. QR Code Detection
   └─ Search scanned code in BOTH fields:
      - delivery_qr_code (DROPOFF)
      - pickup_qr_code (PICKUP)
   
4. Operation Type Determination
   ├─ If code matches delivery_qr_code:
   │  └─ Operation = DROPOFF
   │     - Expected status: in_transit_pudo
   │     - New status: delivered_pudo
   │     - Timestamp field: delivery_validated_at
   │
   └─ If code matches pickup_qr_code:
      └─ Operation = PICKUP
         - Expected status: delivered_pudo
         - New status: delivered_user
         - Timestamp field: pickup_validated_at
   
5. Status Validation
   └─ Verify shipment is in expected state
   
6. Local DB Update
   └─ Update shipment status + appropriate timestamp
   
7. Cloud DB Logging
   ├─ Create package record
   ├─ Create package_event
   └─ Create pudo_scan_log
   
8. Response
   └─ Return operation_type + detailed status
```

#### Key Code: Operation Detection

```typescript
let operationType: 'dropoff' | 'pickup'
let expectedStatus: string
let newStatus: string
let timestampField: string

if (shipment.delivery_qr_code === scanned_code) {
  operationType = 'dropoff'
  expectedStatus = 'in_transit_pudo'
  newStatus = 'delivered_pudo'
  timestampField = 'delivery_validated_at'
} else if (shipment.pickup_qr_code === scanned_code) {
  operationType = 'pickup'
  expectedStatus = 'delivered_pudo'
  newStatus = 'delivered_user'
  timestampField = 'pickup_validated_at'
}
```

---

### 3. Mobile Service: `pudoService.ts`

**Location:** `apps/mobile/src/services/pudoService.ts`

#### Unified Interface

```typescript
export interface ScanResult {
  success: boolean;
  operation_type: 'dropoff' | 'pickup';  // ← Auto-detected
  message: string;
  package?: {
    id: string;
    tracking_code: string;
    tracking_number: string;
    status: string;
    type: 'delivery' | 'return';
    location: { id; name; pudo_id; address };
    received_at?: string;      // DROPOFF timestamp
    picked_up_at?: string;     // PICKUP timestamp
  };
  shipment?: {
    id: string;
    previous_status: string;
    new_status: string;
    updated_at: string;
    customer_id: string;
    delivery_address: string;
  };
  operator?: { id; email };
  timestamp: string;
  duration_ms: number;
}
```

#### Single Function

```typescript
async processScan(
  scannedCode: string,
  gpsData?: { latitude; longitude; accuracy }
): Promise<ScanResult> {
  // 1. Authenticate
  // 2. Call Edge Function with scanned code
  // 3. Edge Function detects operation type
  // 4. Return result with operation_type included
}
```

**No more separate methods for dropoff/pickup!**

---

### 4. Scanner Screen: `ScannerScreen.tsx`

**Location:** `apps/mobile/src/screens/ScannerScreen.tsx`

#### Simplified Handler

```typescript
const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
  setLoading(true);
  
  try {
    const gpsData = await getValidatedLocation();
    
    // Single call - Edge Function detects type
    const result = await pudoService.processScan(data, gpsData);
    
    // Show message based on detected operation
    if (result.operation_type === 'dropoff') {
      showDropoffSuccess(result, data);
    } else {
      showPickupSuccess(result);
    }
  } catch (err) {
    Alert.alert('Error', err.message);
  } finally {
    setLoading(false);
  }
};
```

#### UI Updates
- ✅ Single mode indicator: "🔍 Escanea QR o Código de Barras"
- ✅ Result card color changes by operation type:
  - DROPOFF: Green (#22c55e)
  - PICKUP: Cyan (#06b6d4)
- ✅ Dynamic messages based on `operation_type`

---

## Testing

**File:** `apps/mobile/src/services/pudoService.test.ts`

### Test Coverage

#### DROPOFF Scenarios
- ✅ Successful DROPOFF scan with GPS data
- ✅ DROPOFF scan without GPS data
- ✅ DROPOFF response structure validation

#### PICKUP Scenarios
- ✅ Successful PICKUP scan with GPS data
- ✅ PICKUP status validation

#### Error Handling
- ✅ No active session
- ✅ JWT decode failures
- ✅ Missing sub claim in JWT
- ✅ Edge Function errors
- ✅ Empty responses
- ✅ Error field in response

#### Response Validation
- ✅ `duration_ms` included
- ✅ `operation_type` correctly set
- ✅ Response structure completeness

**Run tests:**
```bash
cd apps/mobile
npm test -- pudoService.test.ts
```

---

## Migration Path

### For Existing Deployments

1. **Database Migration (016_add_qr_fields_to_remote_shipments.sql)**
   - Execute on remote Brickshare database
   - Adds fields: `delivery_qr_code`, `pickup_qr_code`, timestamps
   - Creates indexes for performance

2. **Edge Function Deployment**
   - Deploy updated `process-pudo-scan/index.ts`
   - Includes operation detection logic
   - Backward compatible: handles single-code searches

3. **Mobile App Update**
   - Update to new `pudoService.ts`
   - Update `ScannerScreen.tsx`
   - Update component interfaces
   - Run test suite

---

## API Response Examples

### DROPOFF Success

```json
{
  "success": true,
  "operation_type": "dropoff",
  "message": "Paquete recepcionado exitosamente en PUDO",
  "package": {
    "id": "pkg-001",
    "tracking_code": "BS-DEL-7A2D335C-8FA",
    "tracking_number": "TRK-001",
    "status": "in_location",
    "type": "delivery",
    "location": {
      "id": "loc-001",
      "name": "PUDO Centro",
      "pudo_id": "PUDO-001",
      "address": "Calle Principal 123"
    },
    "received_at": "2026-03-31T22:20:00Z"
  },
  "shipment": {
    "id": "ship-001",
    "previous_status": "in_transit_pudo",
    "new_status": "delivered_pudo",
    "updated_at": "2026-03-31T22:20:00Z"
  },
  "timestamp": "2026-03-31T22:20:00Z",
  "duration_ms": 234
}
```

### PICKUP Success

```json
{
  "success": true,
  "operation_type": "pickup",
  "message": "Paquete entregado exitosamente al cliente",
  "package": {
    "id": "pkg-002",
    "tracking_code": "BS-PU-ABC123DEF",
    "status": "picked_up",
    "type": "return",
    "picked_up_at": "2026-03-31T22:21:00Z"
  },
  "shipment": {
    "previous_status": "delivered_pudo",
    "new_status": "delivered_user"
  },
  "duration_ms": 198
}
```

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Functions** | 2 separate methods | 1 unified method |
| **Decision Logic** | UI layer | Edge Function |
| **Code Duplication** | High | Eliminated |
| **Maintenance** | Difficult (sync logic) | Simple (single source of truth) |
| **Testing** | 2x test suites | 1 unified test suite |
| **Future Operations** | Hard to add | Easy (just add QR fields) |

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/016_add_qr_fields_to_remote_shipments.sql` | New migration for DB schema |
| `supabase/functions/process-pudo-scan/index.ts` | Operation detection logic |
| `apps/mobile/src/services/pudoService.ts` | Unified `processScan()` method |
| `apps/mobile/src/screens/ScannerScreen.tsx` | Simplified handler + dynamic UI |
| `apps/mobile/src/components/DevSimulationModal.tsx` | Unified interface |
| `apps/mobile/src/components/DevImageUploadModal.tsx` | Unified interface |
| `apps/mobile/src/services/pudoService.test.ts` | Comprehensive test suite |

---

## Deployment Checklist

- [ ] Database migration applied to remote Brickshare DB
- [ ] Edge Function deployed and tested
- [ ] Mobile app updated and tested
- [ ] Test suite passes (100% coverage)
- [ ] Documentation updated
- [ ] QA sign-off on both operations
- [ ] Release notes prepared

---

## Troubleshooting

### Issue: "QR code no coincide con ninguno de los códigos registrados"

**Cause:** Scanned code doesn't match either `delivery_qr_code` or `pickup_qr_code`

**Solution:** 
- Verify QR generation includes both fields
- Check database has correct codes
- Verify code isn't already used

### Issue: "Estado inválido: se esperaba 'in_transit_pudo', pero el paquete está en 'X'"

**Cause:** Shipment is in wrong state for DROPOFF

**Solution:**
- Check if already delivered to PUDO
- Try PICKUP operation (scan pickup_qr_code)
- Verify shipment status in database

### Issue: Edge Function timeout

**Cause:** Network latency or database locks

**Solution:**
- Retry scan
- Check network connectivity
- Verify database indices exist

---

## Future Enhancements

1. **Multi-location Support**
   - Handle packages with multiple dropoff/pickup locations
   - Add location-specific validation

2. **Bulk Operations**
   - Scan multiple QR codes in single batch
   - Reduce round-trip times

3. **Offline Support**
   - Cache QR validations locally
   - Sync when online

4. **Analytics**
   - Track operation distribution (dropoff vs pickup)
   - Performance metrics by location/time

---

## Related Documentation

- [PUDO_VALIDATION_ARCHITECTURE.md](./PUDO_VALIDATION_ARCHITECTURE.md)
- [DUAL_DB_ARCHITECTURE_IMPLEMENTATION.md](./DUAL_DB_ARCHITECTURE_IMPLEMENTATION.md)
- [GUIA_EJECUCION_APP_ANDROID.md](./GUIA_EJECUCION_APP_ANDROID.md)

---

**Contact:** Development Team  
**Last Updated:** March 31, 2026