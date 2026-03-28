import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const sort = searchParams.get('sort') || 'time';
  const order = searchParams.get('order') || 'desc';
  
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
  
  // Query usando la vista
  let query = supabase
    .from('pudo_active_packages_enhanced')
    .select('*')
    .eq('location_id', locationId);
  
  // Ordenamiento
  const orderColumn = sort === 'time' ? 'hours_in_location' :
                      sort === 'tracking' ? 'tracking_code' :
                      'package_type';
  query = query.order(orderColumn, { ascending: order === 'asc' });
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Calcular alertas
  const over24h = data?.filter((p: any) => p.hours_in_location > 24).length || 0;
  
  return NextResponse.json({
    data: data || [],
    count: data?.length || 0,
    alerts: { over_24h: over24h }
  });
}