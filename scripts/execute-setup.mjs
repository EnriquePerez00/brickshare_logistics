#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_bricklogistics_URL || 'https://qumjzvhtotcvnzpjgjkl.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_bricklogistics_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk0NjYzMCwiZXhwIjoyMDg5NTIyNjMwfQ.qFhuNtT7jw5TrvJSzg28GiYVPQGLMSJ9JYeWhMDb_4o';

console.log('🚀 Iniciando Setup Automático...');
console.log('📍 Supabase URL:', SUPABASE_URL);
console.log('');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runSetup() {
  try {
    console.log('📋 PASO 1: Verificar usuarios existentes');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(10);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log('✅ Usuarios encontrados:', users.length);
    users.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    console.log('');
    
    if (users.length === 0) {
      console.log('⚠️  No hay usuarios. Por favor, inicia sesión primero en la app móvil.');
      return;
    }
    
    // Buscar usuario admin, o usar el primero
    let targetUser = users.find(u => u.role === 'admin') || users[0];
    
    console.log('📋 PASO 2: Usuario para crear PUDO location');
    console.log(`   Usuario: ${targetUser.email} (ID: ${targetUser.id})`);
    console.log(`   Rol actual: ${targetUser.role}`);
    console.log('');
    
    // Si el usuario no es admin, actualizarlo
    if (targetUser.role !== 'admin') {
      console.log('📝 PASO 3: Actualizando usuario a rol ADMIN...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', targetUser.id);
      
      if (updateError) {
        console.error('❌ Error updating user role:', updateError);
        console.error('Detalles del error:', updateError.message);
        return;
      }
      console.log('✅ Usuario actualizado a role = admin');
      targetUser.role = 'admin';
    } else {
      console.log('ℹ️  Usuario ya es admin');
    }
    console.log('');
    
    // Crear location
    console.log('📋 PASO 4: Crear location para el PUDO');
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .insert([{
        owner_id: targetUser.id,
        name: 'Test PUDO - Madrid',
        location_name: 'PUDO Test Location',
        address: 'Calle Principal 123',
        city: 'Madrid',
        postal_code: '28001',
        latitude: 41.3851,
        longitude: 2.1734,
        gps_validation_radius_meters: 500,
        commission_rate: 0.50,
        is_active: true
      }])
      .select();
    
    if (locationError) {
      console.error('❌ Error creating location:', locationError);
      return;
    }
    
    console.log('✅ Location creada:');
    console.log(`   - ID: ${location[0].id}`);
    console.log(`   - Nombre: ${location[0].name}`);
    console.log(`   - PUDO ID: ${location[0].pudo_id}`);
    console.log(`   - Coordenadas: ${location[0].latitude}, ${location[0].longitude}`);
    console.log('');
    
    // Verificar state
    console.log('📋 PASO 5: Estado de tablas');
    const { count: packagesCount } = await supabase
      .from('packages')
      .select('*', { count: 'exact', head: true });
    
    const { count: eventsCount } = await supabase
      .from('package_events')
      .select('*', { count: 'exact', head: true });
    console.log(`   - packages: ${packagesCount || 0} registros`);

    console.log(`   - package_events: ${eventsCount || 0} registros`);
    console.log(`   ⚠️  NOTA: pudo_scan_logs eliminada en migration 022`);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SETUP COMPLETADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('   1. Cierra completamente la app móvil (swipe to close)');
    console.log('   2. Reabre la app');
    console.log('   3. Inicia sesión con: user@brickshare.eu / admin@brickshare.eu');
    console.log('   4. Escanea: BS-DEL-7A2D335C-8FA');
    console.log('   5. Deberías ver: "Recepcionado ✅"');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runSetup();