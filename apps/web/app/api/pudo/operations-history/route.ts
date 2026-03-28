import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const actionType = searchParams.get('action_type');
  const resultFilter = searchParams.get('result_filter');
  const trackingSearch = searchParams.get('tracking_search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  if (!locationId) {
    return NextResponse.json(
      { error: 'location_id is required' },
      { status: 400 }
    );
  }
  
  const supabase = await createClient();
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Llamar a la función RPC
  const { data, error } = await supabase.rpc('get_pudo_operations_paginated', {
    p_location_id: locationId,
    p_date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
    p_date_to: dateTo ? new Date(dateTo).toISOString() : null,
    p_action_type: actionType,
    p_result_filter: resultFilter,
    p_tracking_search: trackingSearch,
    p_page: page,
    p_limit: limit
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const totalCount = data?.[0]?.total_count || 0;
  const totalPages = Math.ceil(totalCount / limit);
  
  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages
    }
  });
}