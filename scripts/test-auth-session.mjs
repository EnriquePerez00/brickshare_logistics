#!/usr/bin/env node

/**
 * Script para verificar si la sesión del usuario está funcionando correctamente
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde el archivo .env.local de web
dotenv.config({ path: join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthSession() {
  console.log('🔍 Probando autenticación de user@brickshare.eu...\n');

  // 1. Intentar login
  console.log('1️⃣ Intentando login...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'user@brickshare.eu',
    password: 'Test123456!',
  });

  if (authError) {
    console.error('❌ Error en login:', authError.message);
    return;
  }

  console.log('✅ Login exitoso');
  console.log('   User ID:', authData.user.id);
  console.log('   Email:', authData.user.email);
  console.log('   Session token existe:', !!authData.session?.access_token);

  // 2. Verificar que podemos obtener el usuario
  console.log('\n2️⃣ Verificando getUser()...');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('❌ Error en getUser():', userError.message);
    return;
  }

  console.log('✅ getUser() exitoso');
  console.log('   User ID:', userData.user.id);

  // 3. Obtener location_id del usuario
  console.log('\n3️⃣ Obteniendo location_id del usuario...');
  const { data: userLocations, error: locError } = await supabase
    .from('user_locations')
    .select('location_id')
    .eq('user_id', userData.user.id)
    .limit(1)
    .single();

  if (locError) {
    console.error('❌ Error obteniendo location:', locError.message);
    return;
  }

  const locationId = userLocations.location_id;
  console.log('✅ Location ID:', locationId);

  // 4. Probar el query de packages que hace el API
  console.log('\n4️⃣ Probando query de packages...');
  const { data: packages, error: pkgError } = await supabase
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
    .eq('location_id', locationId)
    .eq('status', 'in_location');

  if (pkgError) {
    console.error('❌ Error obteniendo packages:', pkgError.message);
    return;
  }

  console.log('✅ Packages obtenidos:', packages.length);
  packages.forEach((pkg, i) => {
    console.log(`   ${i + 1}. ${pkg.tracking_code} - ${pkg.status}`);
  });

  // 5. Simular la llamada al API
  console.log('\n5️⃣ Simulando llamada al API...');
  console.log(`   URL: /api/pudo/active-packages?location_id=${locationId}`);
  console.log('   ✅ Si llegaste aquí, la autenticación y query funcionan');
  console.log('');
  console.log('🎯 CONCLUSIÓN:');
  console.log('   Si ves este mensaje, tu cuenta funciona correctamente.');
  console.log('   El problema del 401 puede ser:');
  console.log('   1. Las cookies no se están enviando desde el navegador');
  console.log('   2. El middleware está bloqueando la petición');
  console.log('   3. Necesitas hacer un hard refresh (Cmd+Shift+R o Ctrl+Shift+R)');
}

testAuthSession().catch(console.error);