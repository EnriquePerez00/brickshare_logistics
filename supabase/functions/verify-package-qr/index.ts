// ============================================================
// verify-package-qr — Supabase Edge Function (Deno)
//
// El owner escanea el QR del cliente. Esta función:
//   1. Verifica la firma del JWT
//   2. Para QR dinámicos: verifica que no ha expirado
//   3. Verifica que el paquete pertenece al local del owner
//   4. Actualiza el status según el tipo:
//      - delivery: in_location → picked_up
//      - return: pending_dropoff → in_location
//   5. Notifica a sistema externo si corresponde
//
// POST /functions/v1/verify-package-qr
// Headers: Authorization: Bearer <OWNER_JWT>
// Body:    { "qr_hash": "eyJ..." }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const SUPABASE_URL           = Deno.env.get('SUPABASE_bricklogistics_URL')!
const SUPABASE_ANON_KEY      = Deno.env.get('SUPABASE_bricklogistics_ANON_KEY')!
const SUPABASE_SERVICE_ROLE  = Deno.env.get('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')!
const JWT_SECRET             = Deno.env.get('QR_JWT_SECRET_bricklogistics')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar al owner
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Missing Authorization header')

    const supabaseOwner = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: ownerUser }, error: authErr } = await supabaseOwner.auth.getUser()
    if (authErr || !ownerUser) return errorResponse(401, 'Invalid or expired session')

    // Verificar que el usuario tiene rol 'owner'
    const { data: ownerProfile } = await supabaseOwner
      .from('users')
      .select('role')
      .eq('id', ownerUser.id)
      .single()

    if (!ownerProfile || ownerProfile.role !== 'owner') {
      return errorResponse(403, 'Only owners can verify package QR codes')
    }

    // 2. Leer el QR del body
    const body = await req.json().catch(() => ({}))
    const qrHash: string = body?.qr_hash

    if (!qrHash || typeof qrHash !== 'string') {
      return errorResponse(400, 'qr_hash is required')
    }

    // 3. Verificar la firma y expiración del JWT
    //    djwt lanza error si la firma es inválida o el token ha expirado
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )

    let payload: Record<string, unknown>
    try {
      payload = await verify(qrHash, key) as Record<string, unknown>
    } catch (_err) {
      return errorResponse(401, 'QR code is invalid or has expired')
    }

    const packageId  = payload.package_id as string
    const locationId = payload.location_id as string
    const qrType     = (payload.type as string) || 'delivery' // Para compatibilidad con QRs antiguos
    const externalShipmentId = payload.external_shipment_id as string | undefined
    const sourceSystem = (payload.source_system as string) || 'logistics'

    if (!packageId || !locationId) {
      return errorResponse(400, 'Malformed QR payload')
    }

    // 4. Admin client para leer sin restricciones de RLS y luego actualizar
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

    // Verificar que el paquete existe y obtener su información
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from('packages')
      .select('id, type, status, tracking_code, location_id, external_shipment_id, source_system, static_qr_hash')
      .eq('id', packageId)
      .single()

    if (pkgErr || !pkg) {
      return errorResponse(404, 'Package not found')
    }

    // Validar según el tipo de package
    if (qrType === 'delivery' || pkg.type === 'delivery') {
      // Para deliveries: el package debe estar en 'in_location'
      if (pkg.status === 'picked_up') {
        return errorResponse(409, 'Package has already been picked up')
      }
      if (pkg.status !== 'in_location') {
        return errorResponse(409, `Package cannot be picked up. Status: ${pkg.status}`)
      }
    } else if (qrType === 'return' || pkg.type === 'return') {
      // Para returns: el package debe estar en 'pending_dropoff'
      if (pkg.status === 'in_location') {
        return errorResponse(409, 'Return package already received at location')
      }
      if (pkg.status === 'returned') {
        return errorResponse(409, 'Return package already completed')
      }
      if (pkg.status !== 'pending_dropoff') {
        return errorResponse(409, `Return package cannot be received. Status: ${pkg.status}`)
      }
    } else {
      return errorResponse(400, `Unknown package type: ${pkg.type}`)
    }

    // 5. Verificar que el local del QR pertenece al owner autenticado
    const { data: location, error: locErr } = await supabaseAdmin
      .from('locations')
      .select('id, owner_id, name')
      .eq('id', locationId)
      .single()

    if (locErr || !location) {
      return errorResponse(404, 'Location not found')
    }

    if (location.owner_id !== ownerUser.id) {
      return errorResponse(403, 'This package does not belong to your location')
    }

    // Doble check: el location del paquete coincide con el del QR
    if (pkg.location_id !== locationId) {
      return errorResponse(403, 'QR location mismatch')
    }

    // 6. Actualizar estado según el tipo de package
    const timestamp = new Date().toISOString()
    let newStatus: string
    let eventType: string

    if (pkg.type === 'delivery') {
      newStatus = 'picked_up'
      eventType = 'delivery_completed'
      
      // Limpiar QR dinámico
      const { error: updateErr } = await supabaseAdmin
        .from('packages')
        .update({
          status:          newStatus,
          dynamic_qr_hash: null,
          qr_expires_at:   null,
          updated_at:      timestamp,
        })
        .eq('id', packageId)

      if (updateErr) {
        console.error('DB update error:', updateErr)
        return errorResponse(500, 'Failed to update package status')
      }
    } else if (pkg.type === 'return') {
      newStatus = 'in_location'
      eventType = 'return_received'
      
      // Limpiar QR estático
      const { error: updateErr } = await supabaseAdmin
        .from('packages')
        .update({
          status:         newStatus,
          static_qr_hash: null,
          updated_at:     timestamp,
        })
        .eq('id', packageId)

      if (updateErr) {
        console.error('DB update error:', updateErr)
        return errorResponse(500, 'Failed to update package status')
      }
    } else {
      return errorResponse(400, 'Invalid package type')
    }

    // 7. Si es de un sistema externo, notificar (opcional - para futuras integraciones)
    if (pkg.source_system === 'brickshare' && pkg.external_shipment_id) {
      // TODO: Implementar webhook a Brickshare si se requiere notificación en tiempo real
      // Por ahora, Brickshare consultará el estado de la BD directamente
      console.log(`Package ${packageId} from Brickshare shipment ${pkg.external_shipment_id} - Event: ${eventType}`)
    }

    // 8. Éxito — devolver confirmación para la impresión del recibo
    return new Response(
      JSON.stringify({
        success:       true,
        package_id:    packageId,
        package_type:  pkg.type,
        tracking_code: pkg.tracking_code,
        location_name: location.name,
        event_type:    eventType,
        new_status:    newStatus,
        timestamp:     timestamp,
        external_shipment_id: pkg.external_shipment_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Internal server error')
  }
})

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}
