# Fix: PUDO User Locations Architecture Migration

## Problem

After migration 013 removed `owner_id` from the `locations` table and introduced the `user_locations` many-to-many relationship table, the Edge Functions were still trying to access `owner_id`, causing authentication failures:

```
Error: Only PUDO operators (usuarios/admin) can process scans
```

## Root Cause

1. **Edge Functions outdated**: Both `process-pudo-scan` and `update-remote-shipment-status` were querying:
   ```typescript
   .from('locations')
   .select('id, name, pudo_id, address, owner_id')  // ❌ owner_id doesn't exist
   .eq('owner_id', ownerUser.id)  // ❌ invalid filter
   ```

2. **Missing DEV_MODE configuration**: The `.env.local` file didn't have `DEV_MODE=true` set, so even though the mobile app was sending `X-Dev-Bypass` headers, the Edge Functions weren't respecting them.

3. **User had no location assignment**: The user `user@brickshare.eu` existed but had no entries in the `user_locations` table.

## Solution Implemented

### 1. Added DEV_MODE to Edge Function Configuration

**File**: `supabase/functions/process-pudo-scan/.env.local`

```bash
# Added at the end
DEV_MODE=true
```

This enables development mode bypass for JWT validation during local testing.

### 2. Updated process-pudo-scan Edge Function

**File**: `supabase/functions/process-pudo-scan/index.ts`

Changed location query from:
```typescript
const { data: location, error: locErr } = await cloudSupabase
  .from('locations')
  .select('id, name, pudo_id, address, owner_id')
  .eq('owner_id', ownerUser.id)
  .single()
```

To:
```typescript
const { data: userLocationData, error: locErr } = await cloudSupabase
  .from('user_locations')
  .select(`
    location_id,
    locations (
      id,
      name,
      pudo_id,
      address
    )
  `)
  .eq('user_id', ownerUser.id)
  .limit(1)
  .single()

// Extract location from JOIN
ownerLocation = Array.isArray(userLocationData.locations) 
  ? userLocationData.locations[0] 
  : userLocationData.locations
```

### 3. Updated update-remote-shipment-status Edge Function

**File**: `supabase/functions/update-remote-shipment-status/index.ts`

Applied the same changes:
- Added DEV_MODE support
- Changed to use `user_locations` table with JOIN query
- Properly extract location from nested response

### 4. Created Location Assignment Script

**File**: `scripts/assign-pudo-location-to-user.mjs`

A utility script to assign PUDO locations to users:

```bash
node scripts/assign-pudo-location-to-user.mjs user@brickshare.eu
```

Features:
- Checks if user exists
- Verifies existing assignments
- Assigns first available location
- Provides detailed feedback

## Testing

After implementing these changes:

1. **Restart Supabase Functions**:
   ```bash
   supabase functions serve
   ```

2. **Test with mobile app**:
   - Login as `user@brickshare.eu`
   - Scan a QR code in the simulator
   - Should work without "Only PUDO operators" error

3. **Verify in database**:
   ```sql
   SELECT u.email, ul.location_id, l.name, l.pudo_id
   FROM users u
   JOIN user_locations ul ON u.id = ul.user_id
   JOIN locations l ON ul.location_id = l.id
   WHERE u.email = 'user@brickshare.eu';
   ```

## Benefits

- ✅ **Production-ready**: Uses proper `user_locations` many-to-many relationship
- ✅ **Flexible**: Users can be assigned to multiple locations
- ✅ **Maintainable**: Follows migration 013 architecture
- ✅ **Dev-friendly**: DEV_MODE for local testing without complex setup

## Migration Path for Other Users

To assign locations to other PUDO operators:

```bash
# For a single user
node scripts/assign-pudo-location-to-user.mjs operator@example.com

# Or directly in SQL
INSERT INTO user_locations (user_id, location_id)
SELECT 
  (SELECT id FROM users WHERE email = 'operator@example.com'),
  (SELECT id FROM locations WHERE pudo_id = 'PUDO-001')
ON CONFLICT DO NOTHING;
```

## Related Files

- `supabase/migrations/013_refactor_remove_owner_id.sql` - Original migration
- `supabase/functions/process-pudo-scan/index.ts` - Dropoff processing
- `supabase/functions/update-remote-shipment-status/index.ts` - Pickup processing
- `scripts/assign-pudo-location-to-user.mjs` - Location assignment utility

## Next Steps

When deploying to production:
1. Remove or set `DEV_MODE=false` in Edge Function environment
2. Ensure all PUDO operators have proper location assignments
3. Test full authentication flow end-to-end