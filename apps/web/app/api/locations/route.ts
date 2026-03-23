import { NextResponse } from 'next/server'
import { supabase } from '@brickshare/shared'

export const dynamic = 'force-dynamic'

/**
 * Generates a consistent 5-digit code based on a given string ID.
 * This guarantees the same ID will always return the same 5-digit code.
 */
function generateCodeFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const positiveHash = Math.abs(hash)
  // Ensure we get a 5 digit number strictly between 10000 and 99999
  return (positiveHash % 90000 + 10000).toString()
}

export async function GET(req: Request) {
  console.log(`[API Locations] Inbound GET from ${req.headers.get('origin') || 'no-origin'} - URL: ${req.url}`);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name, location_name, address, postal_code, city, is_active')
      .eq('is_active', true)
    
    if (error) {
      console.error('[Deposit Points API] Database error fetching locations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch deposit points' }, 
        { status: 500, headers: corsHeaders }
      )
    }

    // Cast data as any[] to prevent TS 'never' inferences for string picks
    const locationsWithCode = (locations as any[]).map(loc => ({
      id: loc.id,
      code: generateCodeFromId(loc.id),
      name: loc.name,
      location_name: loc.location_name,
      address: loc.address,
      postal_code: loc.postal_code,
      city: loc.city,
      is_active: loc.is_active
    }))

    return NextResponse.json(locationsWithCode, { headers: corsHeaders })
  } catch (error) {
    console.error('[Deposit Points API] Unexpected server error:', error)
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
