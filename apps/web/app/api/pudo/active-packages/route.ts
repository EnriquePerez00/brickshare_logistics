import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const statusFilter = searchParams.get('status'); // 'in_location', 'returned', or null for all
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
  
  // Query directa a packages con joins (más confiable que la vista)
  let query = supabase
    .from('packages')
    .select(`
      id,
      tracking_code,
      status,
      location_id,
      customer_id,
      created_at,
      updated_at,
      locations (
        id,
        name
      ),
      users:customer_id (
        first_name,
        last_name
      )
    `)
    .eq('location_id', locationId);
  
  // Aplicar filtro de status solo si se proporciona
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  
  const { data: rawData, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Procesar los datos para agregar campos calculados
  const data = rawData?.map((pkg: any) => {
    const hoursInLocation = pkg.updated_at 
      ? (Date.now() - new Date(pkg.updated_at).getTime()) / (1000 * 60 * 60)
      : 0;
    
    return {
      ...pkg,
      hours_in_location: hoursInLocation,
      customer_name: pkg.users 
        ? `${pkg.users.first_name || ''} ${pkg.users.last_name || ''}`.trim() || 'Desconocido'
        : 'Desconocido',
      customer_first_name: pkg.users?.first_name || '',
      customer_last_name: pkg.users?.last_name || '',
      package_type: 'delivery', // Por ahora simplificado
      location_name: pkg.locations?.name || ''
    };
  }) || [];
  
  // Ordenamiento
  if (sort === 'time') {
    data.sort((a: any, b: any) => {
      const diff = b.hours_in_location - a.hours_in_location;
      return order === 'asc' ? -diff : diff;
    });
  } else if (sort === 'tracking') {
    data.sort((a: any, b: any) => {
      const comparison = a.tracking_code.localeCompare(b.tracking_code);
      return order === 'asc' ? comparison : -comparison;
    });
  }
  
  // Calcular alertas
  const over24h = data?.filter((p: any) => p.hours_in_location > 24).length || 0;
  
  return NextResponse.json({
    data: data || [],
    count: data?.length || 0,
    alerts: { over_24h: over24h }
  });
}