import { createClient } from '@supabase/supabase-js';

const CLOUD_URL = 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const CLOUD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk0NjYzMCwiZXhwIjoyMDg5NTIyNjMwfQ.qFhuNtT7jw5TrvJSzg28GiYVPQGLMSJ9JYeWhMDb_4o';

const supabase = createClient(CLOUD_URL, CLOUD_KEY);

const USER_ID = 'd7a9f671-f5fa-4a31-8ba8-145e6219fd9b';
const USER_EMAIL = 'user@brickshare.eu';

async function main() {
  console.log('🔍 Verificando usuario en user_locations...\n');

  // 1. Verificar si el usuario existe
  console.log(`📋 Buscando usuario: ${USER_EMAIL}`);
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', USER_ID)
    .single();

  if (userError || !user) {
    console.log('❌ Usuario no encontrado');
    console.log('Error:', userError?.message);
    return;
  }

  console.log('✅ Usuario encontrado:', user);

  // 2. Verificar si tiene ubicación asignada
  console.log(`\n📍 Buscando ubicaciones asignadas...`);
  const { data: userLocations, error: locError } = await supabase
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
    .eq('user_id', USER_ID);

  if (locError) {
    console.log('❌ Error al buscar ubicaciones:', locError.message);
    return;
  }

  if (userLocations && userLocations.length > 0) {
    console.log(`✅ Usuario ya tiene ${userLocations.length} ubicación(es) asignada(s):`);
    userLocations.forEach((ul, idx) => {
      console.log(`   ${idx + 1}. ${ul.locations.name} (${ul.locations.pudo_id}) - ID: ${ul.locations.id}`);
    });
    return;
  }

  console.log('⚠️  Usuario NO tiene ubicaciones asignadas');

  // 3. Obtener ubicaciones disponibles
  console.log(`\n🏪 Buscando ubicaciones PUDO disponibles...`);
  const { data: locations, error: locsError } = await supabase
    .from('locations')
    .select('id, name, pudo_id, address')
    .limit(5);

  if (locsError || !locations || locations.length === 0) {
    console.log('❌ No hay ubicaciones disponibles en la base de datos');
    return;
  }

  console.log(`✅ Ubicaciones disponibles:`);
  locations.forEach((loc, idx) => {
    console.log(`   ${idx + 1}. ${loc.name} (${loc.pudo_id}) - ID: ${loc.id}`);
  });

  // 4. Asignar primera ubicación
  const firstLocation = locations[0];
  console.log(`\n🔗 Asignando ubicación: ${firstLocation.name}...`);

  const { data: inserted, error: insertError } = await supabase
    .from('user_locations')
    .insert({
      user_id: USER_ID,
      location_id: firstLocation.id,
    })
    .select();

  if (insertError) {
    console.log('❌ Error al asignar ubicación:', insertError.message);
    return;
  }

  console.log('✅ Ubicación asignada exitosamente!');
  console.log('   Usuario:', USER_EMAIL);
  console.log('   Ubicación:', firstLocation.name);
  console.log('   PUDO ID:', firstLocation.pudo_id);
}

main().catch(console.error);