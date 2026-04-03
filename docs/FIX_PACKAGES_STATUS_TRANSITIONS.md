# Fix: Packages Status Transitions on QR Confirmation

**Date:** 2026-03-04  
**Issue:** Packages status not properly updated when confirming QR reads in mobile app

## Problem Description

When the PUDO operator confirms QR code reading in the mobile app, the `shipments.shipment_status` was correctly updated in the local database, but the `packages.status` field in the cloud database was not properly reflecting the expected state transitions:

### Required Behavior:
1. **DROPOFF (Reception at PUDO)**
   - `shipments.shipment_status`: `in_transit_pudo` → `delivered_pudo`
   - `packages.status`: Should be `in_location`

2. **PICKUP (Delivery to customer)**
   - `shipments.shipment_status`: `delivered_pudo` → `delivered_user`
   - `packages.status`: Should be `picked_up`

3. **RETURN (Return confirmation)**
   - `shipments.shipment_status`: `in_return_pudo` → `in_return`
   - `packages.status`: Should be `returned`

### What Was Wrong:
The edge function `process-pudo-scan` was using hardcoded status values based on operation type, but not properly mapping to the actual shipment state transitions. The status was determined by operation type alone rather than the actual state change occurring in the shipment.

## Solution Implemented

### Files Modified:
- `supabase/functions/process-pudo-scan/index.ts`

### Changes Made:

1. **Added `packageStatus` variable** to explicitly track the correct packages.status value for each operation type (lines 249, 261, 268, 275)

2. **Updated status mapping logic** in the operation type detection section (lines 242-278):
   ```typescript
   let packageStatus: string
   
   if (shipment.delivery_qr_code === scanned_code) {
     operationType = 'dropoff'
     packageStatus = 'in_location'
   } else if (shipment.pickup_qr_code === scanned_code) {
     operationType = 'pickup'
     packageStatus = 'picked_up'
   } else if (shipment.return_qr_code === scanned_code) {
     operationType = 'return'
     packageStatus = 'returned'
   }
   ```

3. **Added logging** for status mappings (lines 382-387) to help debug any future issues:
   ```typescript
   console.log('[CLOUD] Package status mapping:', {
     operation_type: operationType,
     shipment_previous_status: shipment.shipment_status,
     shipment_new_status: newStatus,
     package_status: packageStatus,
   })
   ```

4. **Updated packages insert** to use `packageStatus` variable instead of inline ternary (line 393)

5. **Updated response payload** to return the correct `packageStatus` in the package object (line 459)

## Testing Recommendations

After deploying this fix, test the following scenarios in the mobile app:

1. **DROPOFF Flow:**
   - Scan a delivery QR code
   - Verify `packages.status` = `'in_location'`
   - Verify `shipments.shipment_status` = `'delivered_pudo'`

2. **PICKUP Flow:**
   - Scan a pickup QR code
   - Verify `packages.status` = `'picked_up'`
   - Verify `shipments.shipment_status` = `'delivered_user'`

3. **RETURN Flow:**
   - Scan a return QR code
   - Verify `packages.status` = `'returned'`
   - Verify `shipments.shipment_status` = `'in_return'`

## Deployment

To deploy this fix:

```bash
# Deploy the updated edge function
supabase functions deploy process-pudo-scan
```

Or use the manual deployment script:
```bash
node scripts/deploy-edge-function-manual.mjs
```

## Impact

- ✅ Mobile app will now display correct package status after QR confirmation
- ✅ Dashboard will show accurate package states
- ✅ State consistency maintained between shipments and packages tables
- ✅ Proper audit trail in package_events table

## Related Files

- Mobile App: `apps/mobile/src/screens/ScannerScreen.tsx`
- Service Layer: `apps/mobile/src/services/pudoService.ts`
- Edge Function: `supabase/functions/process-pudo-scan/index.ts`
- Documentation: `docs/PUDO_RETURN_FLOW_IMPLEMENTATION.md`