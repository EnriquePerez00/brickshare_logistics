// ============================================================
// process-pudo-scan — Supabase Edge Function (Deno)
//
// ARQUITECTURA DUAL DATABASE:
// - BD LOCAL (Brickshare via ngrok): Validación de shipments
// - BD CLOUD (Logistics): Registro de logs y eventos
//
// Flujo:
//   1. Autenticar operador PUDO (Cloud)
//   2. Validar QR en shipments.delivery_qr_code (Local via ngrok)
//   3. Verificar shipment_status = 'in_transit_pudo' (Local)
//   4. Actualizar shipment_status = 'delivered_pudo' (Local)
//   5. Registrar en packages, package_events, pudo_scan_logs (Cloud)
//
// POST /functions/v1/process-pudo-scan
// Headers: Authorization: Bearer <OWNER_JWT>
// Body: {
//   "scanned_code": "BS-DEL-714C3F3D-FFD",
//   "scan_mode": "dropoff",
//   "gps_latitude": 40.4168,
//   "gps_longitude": -3.7038,
//   "gps_accuracy": 10.5
// }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────
// CONFIGURACIÓN DE BASES DE DATOS
// ─────────────────────────────────────────────────
// BD CLOUD (Logistics) - Para auth y logs
const CLOUD_SUPABASE_URL = Deno.env.get('bricklogistics_URL') || 'https://qumjzvhtotcvnzpjgjkl.supabase.co'
const CLOUD_SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const CLOUD_SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// BD LOCAL (Brickshare via ngrok) - Para validar y actualizar shipments
// Debe configurarse en Supabase Dashboard → Edge Functions → Secrets
const LOCAL_DB_URL = Deno.env.get('brickshare_API_URL')
const LOCAL_DB_KEY = Deno.env.get('brickshare_SERVICE_ROLE_KEY')

// Validación en startup
if (!CLOUD_SUPABASE_SERVICE_ROLE) {
  console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY not set (should be auto-injected by Supabase)')
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

if (!LOCAL_DB_URL || !LOCAL_DB_KEY) {
  console.error('[FATAL] Local Brickshare DB credentials not configured')
  console.error('  brickshare_API_URL:', LOCAL_DB_URL ? '✅ SET' : '❌ MISSING')
  console.error('  brickshare_SERVICE_ROLE_KEY:', LOCAL_DB_KEY ? '✅ SET' : '❌ MISSING')
  console.error('\n💡 Configure in Supabase Dashboard → Project Settings → Edge Functions → Secrets')
  console.error('   1. brickshare_API_URL = https://your-ngrok-url.ngrok-free.dev')
  console.error('   2. brickshare_SERVICE_ROLE_KEY = sb_secret_...')
  throw new Error('Missing Brickshare DB credentials')
}

console.log('[STARTUP] ===== DUAL DATABASE CONFIGURATION =====')
console.log('[STARTUP] CLOUD DB (Logistics):', CLOUD_SUPABASE_URL)
console.log('[STARTUP] LOCAL DB (Brickshare):', LOCAL_DB_URL || 'NOT SET')
console.log('[STARTUP] DEV_MODE:', Deno.env.get('DEV_MODE') || 'false')
console.log('[STARTUP] ============================================')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function validateEnv() {
  const devMode = Deno.env.get('DEV_MODE') === 'true'
  
  // In DEV_MODE, we allow missing config since we use hardcoded values
  if (devMode) {
    return { valid: true }
  }
  
  const missing = []
  
  if (!CLOUD_SUPABASE_URL) missing.push('bricklogistics_URL')
  if (!CLOUD_SUPABASE_SERVICE_ROLE) missing.push('bricklogistics_SERVICE_ROLE_KEY')
  if (!LOCAL_DB_URL) missing.push('brickshare_API_URL')
  if (!LOCAL_DB_KEY) missing.push('brickshare_SERVICE_ROLE_KEY')
  
  if (missing.length > 0) {
    return { valid: false, message: `Missing configuration: ${missing.join(', ')}` }
  }
  
  return { valid: true }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const envCheck = validateEnv()
  if (!envCheck.valid) {
    return errorResponse(500, envCheck.message!)
  }

  try {
    // ─────────────────────────────────────────────────
    // 1. AUTENTICACIÓN DEL OPERADOR PUDO (Cloud)
    // ─────────────────────────────────────────────────
    let authHeader = req.headers.get('X-Auth-Token') || req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'ERR_AUTH_MISSING: Missing Authorization header')
    }

    const bearerToken = authHeader.replace('Bearer ', '')
    const devMode = Deno.env.get('DEV_MODE') === 'true'
    
    let ownerUser: any = null

    if (devMode) {
      console.log('[AUTH] ⚠️ DEV MODE: Bypassing JWT validation')
      ownerUser = {
        id: 'dev-user-id',
        email: 'dev@example.com',
      }
    } else {
      // Decodificar JWT
      try {
        const jwtParts = bearerToken.split('.')
        if (jwtParts.length !== 3) {
          return errorResponse(401, 'ERR_AUTH_INVALID_JWT: Invalid JWT format')
        }
        
        const payload = JSON.parse(atob(jwtParts[1]))
        if (!payload.sub) {
          return errorResponse(401, 'ERR_AUTH_MISSING_SUB: JWT missing sub claim')
        }

        ownerUser = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        }
        console.log('[AUTH] ✓ User authenticated:', ownerUser.email)
      } catch (err: any) {
        return errorResponse(401, `ERR_AUTH_JWT_DECODE: ${err.message}`)
      }
    }

    // Inicializar clientes
    const cloudSupabase = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_SERVICE_ROLE)
    const localSupabase = createClient(LOCAL_DB_URL, LOCAL_DB_KEY)

    // ─────────────────────────────────────────────────
    // 2. OBTENER UBICACIÓN DEL OPERADOR (Cloud)
    // 
    // NOTA: La validación se basa ÚNICAMENTE en user_locations.
    // El rol del usuario NO importa para procesar escaneos PUDO.
    // Solo se requiere que el usuario tenga una ubicación asignada en user_locations.
    // ─────────────────────────────────────────────────
    let ownerLocation: any

    // Intentar cargar ubicación del usuario
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

    if (!locErr && userLocationData && userLocationData.locations) {
      // Extraer location del JOIN
      ownerLocation = Array.isArray(userLocationData.locations) 
        ? userLocationData.locations[0] 
        : userLocationData.locations
      console.log('[LOCATION] ✓ Location found for user:', ownerLocation.name)
    } else {
      // Fallback: Si no hay ubicación para el usuario, cargar cualquier ubicación disponible
      console.log('[LOCATION] ⚠️ No location for user, loading any available location...')
      const { data: locations, error: anyLocErr } = await cloudSupabase
        .from('locations')
        .select('id, name, pudo_id, address')
        .limit(1)
      
      if (anyLocErr || !locations || locations.length === 0) {
        console.error('[LOCATION] ❌ No locations available in Cloud database')
        return errorResponse(500, 'No locations available in Cloud database')
      }
      
      ownerLocation = locations[0]
      console.log('[LOCATION] ✓ Fallback location loaded:', ownerLocation.name)
    }

    // ─────────────────────────────────────────────────
    // 3. LEER DATOS DEL BODY
    // ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const {
      scanned_code,
      scan_mode = 'dropoff',
      gps_latitude,
      gps_longitude,
      gps_accuracy,
    } = body

    if (!scanned_code) {
      return errorResponse(400, 'scanned_code is required')
    }

    console.log(`[SCAN] Mode: ${scan_mode}, Code: ${scanned_code}, Location: ${ownerLocation.pudo_id}`)

    // ─────────────────────────────────────────────────
    // 4. VALIDAR QR EN BD LOCAL (Brickshare)
    // Buscar en delivery_qr_code Y pickup_qr_code
    // ─────────────────────────────────────────────────
    console.log('[VALIDATE] Checking QR codes in Local DB (delivery or pickup)...')
    
    const { data: shipment, error: shipmentErr } = await localSupabase
      .from('shipments')
      .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, tracking_number, user_id, shipping_address, shipping_city')
      .or(`delivery_qr_code.eq.${scanned_code},pickup_qr_code.eq.${scanned_code},return_qr_code.eq.${scanned_code}`)
      .single()

    if (shipmentErr || !shipment) {
      console.error('[VALIDATE] ❌ QR not found in shipments table:', shipmentErr?.message)
      
      // REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)

      return errorResponse(404, 'QR no válido o destino equivocado')
    }

    console.log('[VALIDATE] ✓ Shipment found:', {
      id: shipment.id,
      status: shipment.shipment_status,
      tracking: shipment.tracking_number,
    })

    // ─────────────────────────────────────────────────
    // 5. DETECTAR TIPO DE OPERACIÓN (DROPOFF vs PICKUP vs RETURN)
    // ─────────────────────────────────────────────────
    let operationType: 'dropoff' | 'pickup' | 'return'
    let expectedStatus: string
    let newStatus: string
    let timestampField: string
    let actionType: 'delivery_confirmation' | 'return_confirmation'
    let packageStatus: string

    if (shipment.delivery_qr_code === scanned_code) {
      // CASO 1: Recepción en PUDO
      operationType = 'dropoff'
      expectedStatus = 'in_transit_pudo'
      newStatus = 'delivered_pudo'
      timestampField = 'delivery_validated_at'
      actionType = 'delivery_confirmation'
      packageStatus = 'in_location'
      console.log('[VALIDATE] ✓ Operation: DROPOFF (delivery_qr_code matched)')
    } else if (shipment.pickup_qr_code === scanned_code) {
      // CASO 2: Entrega a cliente
      operationType = 'pickup'
      expectedStatus = 'delivered_pudo'
      newStatus = 'delivered_user'
      timestampField = 'pickup_validated_at'
      actionType = 'delivery_confirmation'
      packageStatus = 'picked_up'
      console.log('[VALIDATE] ✓ Operation: PICKUP (pickup_qr_code matched)')
    } else if (shipment.return_qr_code === scanned_code) {
      // CASO 3: Devolución en PUDO
      operationType = 'return'
      expectedStatus = 'in_return_pudo'
      newStatus = 'in_return'
      timestampField = 'return_validated_at'
      actionType = 'return_confirmation'
      packageStatus = 'returned'
      console.log('[VALIDATE] ✓ Operation: RETURN (return_qr_code matched)')
    } else {
      return errorResponse(400, 'QR code no coincide con ninguno de los códigos registrados')
    }

    // ─────────────────────────────────────────────────
    // 6. VALIDAR ESTADO ESPERADO
    // ─────────────────────────────────────────────────
    if (shipment.shipment_status !== expectedStatus) {
      console.error('[VALIDATE] ❌ Invalid status:', shipment.shipment_status)
      
      // REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)

      return errorResponse(400, `Estado inválido: se esperaba '${expectedStatus}', pero el paquete está en '${shipment.shipment_status}'`)
    }

    console.log(`[VALIDATE] ✓ Status is correct: ${expectedStatus}`)

    // ─────────────────────────────────────────────────
    // 7. ACTUALIZAR SHIPMENT EN BD LOCAL CON TIMESTAMP
    // ─────────────────────────────────────────────────
    const now = new Date().toISOString()
    
    console.log('[UPDATE] Updating shipment in Local DB...')
    console.log('[UPDATE] Target:', {
      shipment_id: shipment.id,
      current_status: shipment.shipment_status,
      new_status: newStatus,
      timestamp_field: timestampField,
      operation_type: operationType,
      db_url: LOCAL_DB_URL
    })
    
    const updateData: any = {
      shipment_status: newStatus,
      updated_at: now,
    }
    updateData[timestampField] = now

    const { error: updateErr } = await localSupabase
      .from('shipments')
      .update(updateData)
      .eq('id', shipment.id)

    if (updateErr) {
      console.error('[UPDATE] ❌ Failed to update shipment:', updateErr.message)
      console.error('[UPDATE] ❌ Error details:', updateErr)
      
      // REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)

      return errorResponse(500, `Error al actualizar shipment: ${updateErr.message}`)
    }

    // Verificar que el UPDATE realmente se aplicó
    console.log('[UPDATE] Verifying update...')
    const { data: verifiedShipment, error: verifyErr } = await localSupabase
      .from('shipments')
      .select(`shipment_status, ${timestampField}`)
      .eq('id', shipment.id)
      .single()

    if (verifyErr || !verifiedShipment) {
      console.error('[UPDATE] ❌ Failed to verify update:', verifyErr?.message || 'No data returned')
      return errorResponse(500, 'Error al verificar actualización del shipment')
    }

    // Type assertion after null check - convert to unknown first for type safety
    const verifiedData = verifiedShipment as unknown as { shipment_status: string; [key: string]: any }

    console.log('[UPDATE] ✓ Verification result:', verifiedData)

    if (verifiedData.shipment_status !== newStatus) {
      console.error('[UPDATE] ❌ Update verification failed!')
      console.error('[UPDATE] ❌ Expected: ' + newStatus + ', Got:', verifiedData.shipment_status)
      
      // REMOVED: pudo_scan_logs insert (tabla eliminada en migration 022)

      return errorResponse(500, 'La actualización del shipment no se pudo verificar')
    }

    console.log(`[UPDATE] ✓ Shipment successfully updated and verified to ${newStatus}`)

    // ─────────────────────────────────────────────────
    // 7.5 ACTUALIZAR USER_STATUS EN BD LOCAL (si aplica)
    // Para operaciones PICKUP, actualizar users.user_status = 'received'
    // ─────────────────────────────────────────────────
    if (operationType === 'pickup' && newStatus === 'delivered_user') {
      console.log('[UPDATE] Updating user status to "received"...')
      const { error: userUpdateErr } = await localSupabase
        .from('users')
        .update({ user_status: 'received' })
        .eq('id', shipment.user_id)

      if (userUpdateErr) {
        console.error('[UPDATE] ⚠️ Failed to update user status:', userUpdateErr.message)
        console.error('[UPDATE] ⚠️ Error details:', userUpdateErr)
        // No retornamos error, solo registramos la advertencia
      } else {
        console.log('[UPDATE] ✓ User status updated to "received"')
      }
    }

    // ─────────────────────────────────────────────────
    // 8. REGISTRAR EN BD CLOUD - packages
    // ─────────────────────────────────────────────────
    console.log('[CLOUD] Creating package record...')
    console.log('[CLOUD] Package status mapping:', {
      operation_type: operationType,
      shipment_previous_status: shipment.shipment_status,
      shipment_new_status: newStatus,
      package_status: packageStatus,
    })
    
    const { data: newPackage, error: packageErr } = await cloudSupabase
      .from('packages')
      .insert({
        tracking_code: scanned_code,
        type: operationType === 'dropoff' ? 'delivery' : operationType === 'pickup' ? 'delivery' : 'return',
        status: packageStatus,
        location_id: ownerLocation.id,
        source_system: 'brickshare',
        external_shipment_id: shipment.id,
        received_at: operationType === 'dropoff' ? now : undefined,
        picked_up_at: operationType === 'pickup' ? now : undefined,
        returned_at: operationType === 'return' ? now : undefined,
        remote_shipment_data: shipment,
      })
      .select()
      .single()

    if (packageErr) {
      console.error('[CLOUD] ❌ Failed to create package:', packageErr.message)
      // Continuamos, el shipment YA está actualizado en Local
    } else {
      console.log('[CLOUD] ✓ Package created:', newPackage.id)
    }

    // ─────────────────────────────────────────────────
    // 9. REGISTRAR EN BD CLOUD - package_events
    // ─────────────────────────────────────────────────
    if (newPackage) {
      try {
        console.log('[CLOUD] Creating package event...')
        const { error: eventErr } = await cloudSupabase.from('package_events').insert({
          package_id: newPackage.id,
          event_type: operationType,
          old_status: shipment.shipment_status,
          new_status: newStatus,
          performed_by: ownerUser.id,
          location_id: ownerLocation.id,
          metadata: {
            scanned_code,
            shipment_id: shipment.id,
            tracking_number: shipment.tracking_number,
            operation_type: operationType,
            source: 'pudo_scan',
          },
        })
        
        if (eventErr) {
          console.error('[CLOUD] ⚠️ Failed to create event:', eventErr.message)
        } else {
          console.log('[CLOUD] ✓ Package event created')
        }
      } catch (eventErr: any) {
        console.error('[CLOUD] ⚠️ Unexpected error creating event:', eventErr.message)
      }
    }

    // ─────────────────────────────────────────────────
    // 10. REMOVED: pudo_scan_logs registration
    // La tabla pudo_scan_logs fue eliminada en migration 022
    // Los logs ahora se registran solo en package_events
    // ─────────────────────────────────────────────────
    const duration = Date.now() - startTime
    console.log('[CLOUD] ℹ️ Scan logging skipped (pudo_scan_logs removed)')

    // ─────────────────────────────────────────────────
    // 11. RETORNAR RESPUESTA EXITOSA
    // ─────────────────────────────────────────────────
      return new Response(
      JSON.stringify({
        success: true,
        operation_type: operationType,
        message: operationType === 'dropoff' 
          ? 'Paquete recepcionado exitosamente en PUDO'
          : operationType === 'pickup'
          ? 'Paquete entregado exitosamente al cliente'
          : 'Paquete recibido para devolución',
        package: {
          id: newPackage?.id,
          tracking_code: scanned_code,
          tracking_number: shipment.tracking_number,
          status: packageStatus,
          type: operationType === 'dropoff' ? 'delivery' : operationType === 'pickup' ? 'delivery' : 'return',
          location: {
            id: ownerLocation.id,
            name: ownerLocation.name,
            pudo_id: ownerLocation.pudo_id,
            address: ownerLocation.address,
          },
          received_at: operationType === 'dropoff' ? now : undefined,
          picked_up_at: operationType === 'pickup' ? now : undefined,
          returned_at: operationType === 'return' ? now : undefined,
        },
        shipment: {
          id: shipment.id,
          previous_status: shipment.shipment_status,
          new_status: newStatus,
          updated_at: now,
          customer_id: shipment.user_id,
          delivery_address: shipment.shipping_address,
        },
        operator: {
          id: ownerUser.id,
          email: ownerUser.email,
        },
        timestamp: now,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('[ERROR] Unexpected error:', err)
    return errorResponse(500, `Internal server error: ${err.message}`)
  }
})

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}