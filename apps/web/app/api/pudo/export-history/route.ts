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
  
  // Llamar a la función RPC de exportación con tipos dinámicos
  const { data, error } = await (supabase.rpc as any)('export_pudo_operations_csv', {
    p_location_id: locationId,
    p_date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
    p_date_to: dateTo ? new Date(dateTo).toISOString() : null,
    p_action_type: actionType || null,
    p_result_filter: resultFilter || null,
    p_tracking_search: trackingSearch || null
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data || []);
}