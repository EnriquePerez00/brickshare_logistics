// ============================================================
// generate-dynamic-qr — Supabase Edge Function (Deno)
//
// Genera un JWT firmado que el cliente muestra como QR.
// Expira en 5 minutos. Guarda el hash en la tabla packages.
//
// POST /functions/v1/generate-dynamic-qr
// Headers: Authorization: Bearer <CUSTOMER_JWT>
// Body:    { "package_id": "uuid" }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const SUPABASE_URL      = Deno.env.get('SUPABASE_bricklogistics_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_bricklogistics_ANON_KEY')!
const JWT_SECRET        = Deno.env.get('QR_JWT_SECRET_bricklogistics')!  // Secret específico para QRs
const QR_TTL_SECONDS    = 5 * 60  // 5 minutos

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar al usuario (customer) via su JWT de Supabase
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'Missing Authorization header')
    }

    // Crear cliente con el JWT del usuario para respetar RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verificar sesión y obtener usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponse(401, 'Invalid or expired session')
    }

    // 2. Leer y validar el body
    const body = await req.json().catch(() => ({}))
    const packageId: string = body?.package_id

    if (!packageId || typeof packageId !== 'string') {
      return errorResponse(400, 'package_id is required')
    }

    // 3. Verificar que el paquete pertenece al customer y está listo para recogida
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, type, status, customer_id, location_id, external_shipment_id, source_system')
      .eq('id', packageId)
      .single()

    if (pkgError || !pkg) {
      return errorResponse(404, 'Package not found or access denied')
    }

    // Validar que es un package de delivery (no return)
    if (pkg.type !== 'delivery') {
      return errorResponse(400, 'This function is only for delivery packages. Use generate-static-return-qr for returns.')
    }

    if (pkg.customer_id !== user.id) {
      return errorResponse(403, 'This package does not belong to you')
    }

    if (pkg.status !== 'in_location') {
      return errorResponse(409, `Package is not ready for pickup. Current status: ${pkg.status}`)
    }

    // 4. Generar el JWT de QR con HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )

    const now        = Math.floor(Date.now() / 1000)
    const expiresAt  = now + QR_TTL_SECONDS

    const qrJwt = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub:                user.id,
        package_id:         packageId,
        location_id:        pkg.location_id,
        type:               'delivery',
        external_shipment_id: pkg.external_shipment_id,
        source_system:      pkg.source_system,
        iat:                now,
        exp:                getNumericDate(QR_TTL_SECONDS),
      },
      key,
    )

    // 5. Guardar el hash y la expiración en la BD
    // Usamos admin client para poder actualizar (el customer solo tiene SELECT en su paquete)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_bricklogistics_SERVICE_ROLE_KEY')!,
    )

    const { error: updateError } = await supabaseAdmin
      .from('packages')
      .update({
        dynamic_qr_hash: qrJwt,
        qr_expires_at:   new Date(expiresAt * 1000).toISOString(),
      })
      .eq('id', packageId)

    if (updateError) {
      console.error('DB update error:', updateError)
      return errorResponse(500, 'Failed to store QR hash')
    }

    // 6. Responder con el QR y su expiración
    return new Response(
      JSON.stringify({
        qr_hash:             qrJwt,
        type:                'delivery',
        expires_at:          new Date(expiresAt * 1000).toISOString(),
        package_id:          packageId,
        location_id:         pkg.location_id,
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
