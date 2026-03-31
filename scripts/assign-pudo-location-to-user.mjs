#!/usr/bin/env node

/**
 * Script para asignar una ubicación PUDO a un usuario
 * 
 * Uso:
 *   node scripts/assign-pudo-location-to-user.mjs user@brickshare.eu
 * 
 * Este script:
 * 1. Conecta a la DB Cloud (Logistics)
 * 2. Busca el usuario por email
 * 3. Busca la primera ubicación disponible
 * 4. Crea la relación en user_locations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '../supabase/.env.local') });

const CLOUD_SUPABASE_URL = process.env.SUPABASE_bricklogistics_URL;
const CLOUD_SUPABASE_SERVICE_ROLE = process.env.SUPABASE_bricklogistics_SERVICE_ROLE_KEY;

if (!CLOUD_SUPABASE_URL || !CLOUD_SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_bricklogistics_URL:', !!CLOUD_SUPABASE_URL);
  console.error('   SUPABASE_bricklogistics_SERVICE_ROLE_KEY:', !!CLOUD_SUPABASE_SERVICE_ROLE);
  process.exit(1);
}

const supabase = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_SERVICE_ROLE);

async function assignLocationToUser(email) {
  console.log('🚀 Starting location assignment process...\n');

  // 1. Buscar usuario por email
  console.log(`🔍 Looking for user: ${email}`);
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, role')
    .eq('email', email)
    .limit(1);

  if (userError) {
    console.error('❌ Error fetching user:', userError.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.first_name} ${user.last_name}`);
  console.log(`   Role: ${user.role}\n`);

  // 2. Verificar si ya tiene ubicaciones asignadas
  console.log('🔍 Checking existing location assignments...');
  const { data: existingAssignments, error: assignmentError } = await supabase
    .from('user_locations')
    .select(`
      location_id,
      locations (
        id,
        name,
        pudo_id
      )
    `)
    .eq('user_id', user.id);

  if (assignmentError) {
    console.error('❌ Error checking assignments:', assignmentError.message);
    process.exit(1);
  }

  if (existingAssignments && existingAssignments.length > 0) {
    console.log('⚠️  User already has location assignments:');
    existingAssignments.forEach((assignment, index) => {
      const loc = assignment.locations;
      console.log(`   ${index + 1}. ${loc.name} (${loc.pudo_id})`);
    });
    console.log('\n✅ No action needed - user already has locations assigned.');
    return;
  }

  console.log('📝 No existing assignments found.\n');

  // 3. Buscar una ubicación disponible
  console.log('🔍 Looking for available PUDO locations...');
  const { data: locations, error: locationError } = await supabase
    .from('locations')
    .select('id, name, pudo_id, address, city')
    .limit(5);

  if (locationError) {
    console.error('❌ Error fetching locations:', locationError.message);
    process.exit(1);
  }

  if (!locations || locations.length === 0) {
    console.error('❌ No locations available in database');
    process.exit(1);
  }

  console.log(`✅ Found ${locations.length} available location(s):`);
  locations.forEach((loc, index) => {
    console.log(`   ${index + 1}. ${loc.name} (${loc.pudo_id}) - ${loc.city || 'N/A'}`);
  });

  // 4. Asignar la primera ubicación al usuario
  const selectedLocation = locations[0];
  console.log(`\n📍 Assigning location: ${selectedLocation.name}`);

  const { data: assignment, error: insertError } = await supabase
    .from('user_locations')
    .insert({
      user_id: user.id,
      location_id: selectedLocation.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error creating assignment:', insertError.message);
    process.exit(1);
  }

  console.log('\n✅ Location successfully assigned!');
  console.log('─────────────────────────────────────');
  console.log(`User: ${user.email}`);
  console.log(`Location: ${selectedLocation.name} (${selectedLocation.pudo_id})`);
  console.log(`Address: ${selectedLocation.address || 'N/A'}`);
  console.log(`City: ${selectedLocation.city || 'N/A'}`);
  console.log(`Assigned at: ${new Date(assignment.assigned_at).toLocaleString()}`);
  console.log('─────────────────────────────────────\n');
}

// Main execution
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/assign-pudo-location-to-user.mjs <email>');
  console.error('Example: node scripts/assign-pudo-location-to-user.mjs user@brickshare.eu');
  process.exit(1);
}

assignLocationToUser(email)
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });