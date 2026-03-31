#!/usr/bin/env node

/**
 * Script para crear datos de prueba con la NUEVA estructura:
 * - user_locations (many-to-many entre users y locations)
 * - roles simplificados a 'admin' y 'user'
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde apps/web/.env.local y supabase/.env.local
dotenv.config({ path: join(__dirname, '../apps/web/.env.local') });
dotenv.config({ path: join(__dirname, '../supabase/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_bricklogistics_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno requeridas');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Iniciando creación de datos de prueba...\n');

// Paso 1: Obtener las 2 locations existentes
console.log('📍 Paso 1: Obteniendo locations existentes...');
const { data: locations, error: locationsError } = await supabase
  .from('locations')
  .select('id, name')
  .limit(2);

if (locationsError) {
  console.error('❌ Error obteniendo locations:', locationsError);
  process.exit(1);
}

if (!locations || locations.length === 0) {
  console.error('❌ No se encontraron locations en la base de datos');
  process.exit(1);
}

console.log(`✅ Se encontraron ${locations.length} locations:`);
locations.forEach(loc => console.log(`   - ${loc.name} (${loc.id})`));

// Paso 2: Obtener el usuario de prueba existente
console.log('\n👤 Paso 2: Obteniendo usuario de prueba...');
const { data: users, error: usersError } = await supabase
  .from('users')
  .select('id, email, role, first_name, last_name')
  .eq('email', 'user@brickshare.eu')
  .single();

if (usersError) {
  console.error('❌ Error obteniendo usuario:', usersError);
  process.exit(1);
}

console.log(`✅ Usuario encontrado: ${users.first_name} ${users.last_name}`);
console.log(`   Email: ${users.email}`);
console.log(`   Role: ${users.role}`);
console.log(`   ID: ${users.id}`);

// Paso 3: Asignar el usuario a AMBAS locations usando user_locations
console.log('\n🔗 Paso 3: Asignando usuario a locations...');

for (const location of locations) {
  const { error: assignError } = await supabase
    .from('user_locations')
    .upsert({
      user_id: users.id,
      location_id: location.id
    }, {
      onConflict: 'user_id,location_id'
    });

  if (assignError) {
    console.error(`❌ Error asignando a ${location.name}:`, assignError);
  } else {
    console.log(`✅ Usuario asignado a ${location.name}`);
  }
}

// Paso 4: Verificar asignaciones
console.log('\n✅ Paso 4: Verificando asignaciones...');
const { data: assignments, error: assignmentsError } = await supabase
  .from('user_locations')
  .select(`
    user_id,
    location_id,
    assigned_at,
    locations:location_id (name)
  `)
  .eq('user_id', users.id);

if (assignmentsError) {
  console.error('❌ Error verificando asignaciones:', assignmentsError);
} else {
  console.log(`✅ Usuario tiene ${assignments.length} asignaciones:`);
  assignments.forEach(assignment => {
    console.log(`   - ${assignment.locations.name}`);
  });
}

// Paso 5: Crear paquetes de prueba en ambas locations
console.log('\n📦 Paso 5: Creando paquetes de prueba...');

const testPackages = [];

for (let i = 0; i < locations.length; i++) {
  const location = locations[i];
  const trackingCode = `BS-TEST-${Date.now()}-${i}`;
  
  const { data: pkg, error: pkgError } = await supabase
    .from('packages')
    .insert({
      tracking_code: trackingCode,
      location_id: location.id,
      status: 'in_location'
    })
    .select()
    .single();

  if (pkgError) {
    console.error(`❌ Error creando paquete en ${location.name}:`, pkgError);
  } else {
    console.log(`✅ Paquete creado en ${location.name}: ${trackingCode}`);
    testPackages.push(pkg);
  }
}

// Resumen final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE DATOS DE PRUEBA');
console.log('='.repeat(60));
console.log(`✅ Usuario: ${users.email}`);
console.log(`✅ Asignaciones: ${assignments.length} locations`);
console.log(`✅ Paquetes creados: ${testPackages.length}`);
console.log('\n💡 Ahora puedes:');
console.log('   1. Iniciar sesión con user@brickshare.eu');
console.log('   2. Ver los paquetes en el dashboard');
console.log('   3. El usuario verá paquetes de TODAS sus locations asignadas');
console.log('='.repeat(60));