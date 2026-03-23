import { NextResponse } from 'next/server'
import { supabase } from '@brickshare/shared'

export const dynamic = 'force-dynamic'

const SHARED_SECRET = process.env.BRICKSHARE_INTEGRATION_SECRET || 'change-me-in-production'

/**
 * API endpoint para consultar el estado de un package
 * 
 * GET /api/packages/{id}/status
 * Headers:
 *   - X-Integration-Secret: <shared_secret>
 * 
 * También se puede consultar por external_shipment_id:
 * GET /api/packages/by-shipment/{external_shipment_id}/status
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  console.log('[API Packages Status] Inbound GET request for:', params.id)
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Integration-Secret',
  }

  try {
    // 1. Verificar autenticación
    const secret = req.headers.get('X-Integration-Secret')
    if (!secret || secret !== SHARED_SECRET) {
      console.error('[API Packages Status] Invalid or missing integration secret')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      )
    }

    const packageId = params.id

    // 2. Consultar el package
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select(`
        id,
        tracking_code,
        type,
        status,
        location_id,
        locations (
          id,
          name,
          address,
          city,
          postal_code
        ),
        customer_id,
        dynamic_qr_hash,
        static_qr_hash,
        qr_expires_at,
        external_shipment_id,
        source_system,
        created_at,
        updated_at
      `)
      .eq('id', packageId)
      .single()

    if (pkgError || !pkg) {
      console.error('[API Packages Status] Package not found:', packageId)
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // 3. Construir respuesta
    const response = {
      success: true,
      package: {
        id: pkg.id,
        tracking_code: pkg.tracking_code,
        type: pkg.type,
        status: pkg.status,
        location: pkg.locations ? {
          id: pkg.locations.id,
          name: pkg.locations.name,
          address: pkg.locations.address,
          city: pkg.locations.city,
          postal_code: pkg.locations.postal_code
        } : null,
        has_dynamic_qr: !!pkg.dynamic_qr_hash,
        has_static_qr: !!pkg.static_qr_hash,
        qr_expires_at: pkg.qr_expires_at,
        external_shipment_id: pkg.external_shipment_id,
        source_system: pkg.source_system,
        created_at: pkg.created_at,
        updated_at: pkg.updated_at
      }
    }

    console.log('[API Packages Status] Package found with status:', pkg.status)
    return NextResponse.json(response, { headers: corsHeaders })

  } catch (error) {
    console.error('[API Packages Status] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Integration-Secret',
    }
  })
}