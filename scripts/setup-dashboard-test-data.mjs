#!/usr/bin/env node

/**
 * Script para configurar datos de prueba completos para el dashboard
 * 
 * Crea:
 * 1. Usuario owner de prueba en auth.users (se sincroniza automáticamente con public.users)
 * 2. Actualiza locations existentes con el owner correcto
 * 3. Inserta paquetes de prueba con status='in_location'
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', 'apps', 'web', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

// Usar service role para bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 CONFIGURACIÓN DE DATOS DE PRUEBA PARA DASHBOARD');
console.log('=' .repeat(60));
console.log();

const TEST_USER = {
  email: 'owner@brickshare.test',
  password: 'TestOwner123!',
  firstName: 'Test',
  lastName: 'Owner'
};

async function main() {
  try {
    // 1. Verificar si el usuario ya existe
    console.log('👤 1. VERIFICANDO USUARIO DE PRUEBA');
    console.log('-'.repeat(60));
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error al listar usuarios:', authError.message);
      process.exit(1);
    }
    
    let testUser = authUsers.users.find(u => u.email === TEST_USER.email);
    
    if (testUser) {
      console.log(`✓ Usuario ya existe: ${TEST_USER.email} (${testUser.id})`);
    } else {
      console.log(`Creando usuario: ${TEST_USER.email}...`);
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        email_confirm: true,
        user_metadata: {
          role: 'owner',
          first_name: TEST_USER.firstName,
          last_name: TEST_USER.lastName
        }
      });
      
      if (createError) {
        console.error('❌ Error al crear usuario:', createError.message);
        process.exit(1);
      }
      
      testUser = newUser.user;
      console.log(`✓ Usuario creado: ${TEST_USER.email} (${testUser.id})`);
    }
    
    const testUserId = testUser.id;
    
    // 2. Verificar que el usuario está en public.users
    console.log();
    console.log('📋 2. VERIFICANDO SINCRONIZACIÓN CON public.users');
    console.log('-'.repeat(60));
    
    // Esperar un momento para que el trigger se ejecute
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: publicUser, error: publicUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', testUserId)
      .single();
    
    if (publicUserError || !publicUser) {
      console.log('⚠️  Usuario no encontrado en public.users, insertando manualmente...');
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: testUserId,
          email: TEST_USER.email,
          role: 'owner',
          first_name: TEST_USER.firstName,
          last_name: TEST_USER.lastName
        });
      
      if (insertError) {
        console.error('❌ Error al insertar en public.users:', insertError.message);
      } else {
        console.log('✓ Usuario sincronizado con public.users');
      }
    } else {
      console.log(`✓ Usuario encontrado en public.users con role: ${publicUser.role}`);
    }
    
    // 3. Actualizar locations con el owner correcto
    console.log();
    console.log('🏪 3. ACTUALIZANDO LOCATIONS CON OWNER CORRECTO');
    console.log('-'.repeat(60));
    
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('*');
    
    if (locationsError) {
      console.error('❌ Error al obtener locations:', locationsError.message);
    } else if (!locations || locations.length === 0) {
      console.log('⚠️  No hay locations en la base de datos');
      console.log('   Debes crear al menos una location primero');
    } else {
      // Actualizar la primera location
      const firstLocation = locations[0];
      
      const { error: updateError } = await supabase
        .from('locations')
        .update({ owner_id: testUserId })
        .eq('id', firstLocation.id);
      
      if (updateError) {
        console.error('❌ Error al actualizar location:', updateError.message);
      } else {
        console.log(`✓ Location actualizada: ${firstLocation.name} (${firstLocation.id})`);
        console.log(`  Owner ID: ${testUserId}`);
      }
    }
    
    // 4. Insertar paquetes de prueba
    console.log();
    console.log('📦 4. INSERTANDO PAQUETES DE PRUEBA');
    console.log('-'.repeat(60));
    
    if (!locations || locations.length === 0) {
      console.log('⚠️  No se pueden insertar paquetes sin locations');
    } else {
      const firstLocation = locations[0];
      
      // Verificar si ya existen paquetes
      const { data: existingPackages } = await supabase
        .from('packages')
        .select('tracking_code')
        .in('tracking_code', ['BS-DEI-714C3F3D-FFD', 'BS-DEL-7A2D335C-8FA']);
      
      const packagesToInsert = [];
      
      if (!existingPackages?.find(p => p.tracking_code === 'BS-DEI-714C3F3D-FFD')) {
        packagesToInsert.push({
          tracking_code: 'BS-DEI-714C3F3D-FFD',
          status: 'in_location',
          location_id: firstLocation.id,
          customer_id: null
        });
      }
      
      if (!existingPackages?.find(p => p.tracking_code === 'BS-DEL-7A2D335C-8FA')) {
        packagesToInsert.push({
          tracking_code: 'BS-DEL-7A2D335C-8FA',
          status: 'in_location',
          location_id: firstLocation.id,
          customer_id: null
        });
      }
      
      if (packagesToInsert.length === 0) {
        console.log('✓ Los paquetes ya existen');
      } else {
        const { data: insertedPackages, error: insertError } = await supabase
          .from('packages')
          .insert(packagesToInsert)
          .select();
        
        if (insertError) {
          console.error('❌ Error al insertar paquetes:', insertError.message);
        } else {
          console.log(`✓ ${insertedPackages.length} paquete(s) insertado(s):`);
          insertedPackages.forEach(pkg => {
            console.log(`  - ${pkg.tracking_code} (${pkg.id})`);
          });
        }
      }
    }
    
    // 5. Verificación final
    console.log();
    console.log('✅ 5. VERIFICACIÓN FINAL');
    console.log('-'.repeat(60));
    
    const { data: finalPackages } = await supabase
      .from('packages')
      .select('*')
      .eq('status', 'in_location');
    
    console.log(`Total de paquetes con status='in_location': ${finalPackages?.length || 0}`);
    
    if (finalPackages && finalPackages.length > 0) {
      console.log();
      console.log('Paquetes activos:');
      finalPackages.forEach(pkg => {
        console.log(`  - ${pkg.tracking_code} en location ${pkg.location_id}`);
      });
    }
    
    console.log();
    console.log('=' .repeat(60));
    console.log('✅ CONFIGURACIÓN COMPLETADA');
    console.log();
    console.log('🔐 CREDENCIALES DE ACCESO AL DASHBOARD:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
    console.log();
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('   1. Accede al dashboard web');
    console.log('   2. Inicia sesión con las credenciales de arriba');
    console.log('   3. Ve a la pestaña "Paquetes Activos"');
    console.log('   4. Deberías ver los paquetes listados');
    console.log();
    
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

main();