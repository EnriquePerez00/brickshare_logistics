#!/usr/bin/env node

/**
 * Script de diagnóstico para QR específico BS-DEL-94BB3AB2-59E
 * Verifica:
 * 1. Si el QR existe en la BD local (Brickshare)
 * 2. Estado actual del shipment
 * 3. Si el estado es el esperado para la operación
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '../supabase/.env.local') });
dotenv.config({ path: join(__dirname, '../.env.local') });

const NGROK_URL = process.env.SUPABASE_brickshare_API_URL;
const LOCAL_DB_KEY = process.env.SUPABASE_brickshare_SERVICE_ROLE_KEY;

// Validación obligatoria de variables de entorno
if (!NGROK_URL || !LOCAL_DB_KEY) {
  console.error('❌ ERROR: Variables de entorno requeridas no están configuradas');
  console.error('   SUPABASE_brickshare_API_URL:', NGROK_URL ? '✅ Configurada' : '❌ FALTA');
  console.error('   SUPABASE_brickshare_SERVICE_ROLE_KEY:', LOCAL_DB_KEY ? '✅ Configurada' : '❌ FALTA');
  console.error('\n💡 Solución: Configurar en supabase/.env.local o .env.local');
  process.exit(1);
}

const QR_CODE = 'BS-DEL-94BB3AB2-59E';

console.log('🔍 DIAGNÓSTICO DE ESCANEO QR\n');
console.log('═'.repeat(60));
console.log(`📋 QR Code: ${QR_CODE}`);
console.log(`🔗 BD Local (ngrok): ${NGROK_URL}`);
console.log('═'.repeat(60));

const localSupabase = createClient(NGROK_URL, LOCAL_DB_KEY);

async function main() {
  try {
    console.log('\n📡 Conectando a BD local (Brickshare via ngrok)...');
    
    // Buscar el shipment por QR en los tres campos posibles
    console.log(`\n🔎 Buscando QR "${QR_CODE}" en tabla shipments...`);
    
    const { data: shipment, error: shipmentErr } = await localSupabase
      .from('shipments')
      .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, tracking_number, user_id, shipping_address, shipping_city, created_at, updated_at')
      .or(`delivery_qr_code.eq.${QR_CODE},pickup_qr_code.eq.${QR_CODE},return_qr_code.eq.${QR_CODE}`)
      .single();

    if (shipmentErr) {
      console.error('\n❌ ERROR buscando shipment:', shipmentErr.message);
      console.error('   Código de error:', shipmentErr.code);
      
      if (shipmentErr.code === 'PGRST116') {
        console.error('\n   ⚠️  PROBLEMA: QR NO ENCONTRADO en la base de datos');
        console.error('   El QR "' + QR_CODE + '" NO existe en ninguno de los campos:');
        console.error('   - delivery_qr_code');
        console.error('   - pickup_qr_code');
        console.error('   - return_qr_code');
        
        // Buscar QRs similares
        console.log('\n🔍 Buscando QRs similares en la BD...');
        const prefix = QR_CODE.substring(0, 10); // BS-DEL-94B
        const { data: similar, error: simErr } = await localSupabase
          .from('shipments')
          .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status')
          .or(`delivery_qr_code.like.${prefix}%,pickup_qr_code.like.${prefix}%,return_qr_code.like.${prefix}%`)
          .limit(10);
        
        if (!simErr && similar && similar.length > 0) {
          console.log(`\n   Encontrados ${similar.length} QRs que empiezan con "${prefix}":`);
          similar.forEach(s => {
            console.log(`   - delivery: ${s.delivery_qr_code || 'NULL'}`);
            console.log(`     pickup:   ${s.pickup_qr_code || 'NULL'}`);
            console.log(`     return:   ${s.return_qr_code || 'NULL'}`);
            console.log(`     status:   ${s.shipment_status}`);
            console.log('');
          });
        } else {
          console.log(`   No se encontraron QRs similares con prefijo "${prefix}"`);
        }
        
        // Listar algunos shipments para ver qué hay en la BD
        console.log('\n📊 Listando shipments recientes en la BD local:');
        const { data: recent, error: recErr } = await localSupabase
          .from('shipments')
          .select('id, delivery_qr_code, shipment_status, tracking_number')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (!recErr && recent && recent.length > 0) {
          console.log(`   Total encontrados: ${recent.length}`);
          recent.forEach((s, idx) => {
            console.log(`   ${idx + 1}. QR: ${s.delivery_qr_code || 'NULL'}`);
            console.log(`      Status: ${s.shipment_status}`);
            console.log(`      Tracking: ${s.tracking_number || 'N/A'}`);
          });
        } else {
          console.log('   ⚠️  No hay shipments en la BD local');
        }
        
      } else if (shipmentErr.code === 'PGRST205') {
        console.error('\n   ⚠️  PROBLEMA: La tabla shipments no está accesible');
        console.error('   Posibles causas:');
        console.error('   1. Tabla en un schema diferente a "public"');
        console.error('   2. Las credenciales no tienen permisos');
        console.error('   3. ngrok URL inaccesible o en timeout');
      }
      return;
    }

    if (!shipment) {
      console.error('\n❌ Shipment NO encontrado (resultado null)');
      return;
    }

    console.log('\n✅ SHIPMENT ENCONTRADO!');
    console.log('\n📦 DATOS DEL SHIPMENT:');
    console.log(`   ID: ${shipment.id}`);
    console.log(`   Tracking: ${shipment.tracking_number || 'N/A'}`);
    console.log(`   Usuario: ${shipment.user_id}`);
    console.log(`   Dirección: ${shipment.shipping_address || 'N/A'}, ${shipment.shipping_city || 'N/A'}`);
    console.log(`   Creado: ${shipment.created_at || 'N/A'}`);
    console.log(`   Actualizado: ${shipment.updated_at || 'N/A'}`);
    
    console.log('\n🔐 CÓDIGOS QR REGISTRADOS:');
    console.log(`   delivery_qr_code: ${shipment.delivery_qr_code || 'NULL'}`);
    console.log(`   pickup_qr_code:   ${shipment.pickup_qr_code || 'NULL'}`);
    console.log(`   return_qr_code:   ${shipment.return_qr_code || 'NULL'}`);
    
    console.log('\n📊 ESTADO ACTUAL:');
    console.log(`   shipment_status: ${shipment.shipment_status}`);
    
    // Determinar tipo de operación
    let operationType = null;
    let expectedStatus = null;
    let newStatus = null;
    let matchedField = null;
    
    if (shipment.delivery_qr_code === QR_CODE) {
      operationType = 'DROPOFF (recepción en PUDO)';
      expectedStatus = 'in_transit_pudo';
      newStatus = 'delivered_pudo';
      matchedField = 'delivery_qr_code';
    } else if (shipment.pickup_qr_code === QR_CODE) {
      operationType = 'PICKUP (entrega a cliente)';
      expectedStatus = 'delivered_pudo';
      newStatus = 'delivered_user';
      matchedField = 'pickup_qr_code';
    } else if (shipment.return_qr_code === QR_CODE) {
      operationType = 'RETURN (devolución en PUDO)';
      expectedStatus = 'in_return_pudo';
      newStatus = 'in_return';
      matchedField = 'return_qr_code';
    }
    
    console.log('\n🎯 OPERACIÓN DETECTADA:');
    console.log(`   Campo que coincide: ${matchedField}`);
    console.log(`   Tipo de operación: ${operationType}`);
    console.log(`   Estado esperado: ${expectedStatus}`);
    console.log(`   Nuevo estado tras escaneo: ${newStatus}`);
    
    console.log('\n✅ VALIDACIÓN DE ESTADO:');
    if (shipment.shipment_status === expectedStatus) {
      console.log(`   ✅ CORRECTO: El shipment está en estado '${expectedStatus}'`);
      console.log(`   ✓ El escaneo debería funcionar correctamente.`);
    } else {
      console.log(`   ❌ INCORRECTO: Estado actual vs esperado`);
      console.log(`      Actual:   '${shipment.shipment_status}'`);
      console.log(`      Esperado: '${expectedStatus}'`);
      console.log(`\n   ⚠️  ESTE ES EL PROBLEMA que causa el error en la app móvil!`);
      console.log(`\n   📝 EXPLICACIÓN:`);
      console.log(`      El Edge Function valida que el shipment esté en el estado correcto`);
      console.log(`      antes de permitir el escaneo. En este caso:`);
      console.log(`      - Intentas hacer: ${operationType}`);
      console.log(`      - Se requiere estado: ${expectedStatus}`);
      console.log(`      - Pero el shipment está en: ${shipment.shipment_status}`);
      console.log(`\n   💡 POSIBLES CAUSAS:`);
      console.log(`      1. El paquete ya fue procesado anteriormente`);
      console.log(`      2. El paquete está en un estado de flujo diferente`);
      console.log(`      3. Los datos de prueba no están correctamente inicializados`);
      console.log(`\n   🔧 SOLUCIÓN:`);
      console.log(`      Actualizar el estado del shipment a '${expectedStatus}':`);
      console.log(`      \n      SQL:`);
      console.log(`      UPDATE shipments`);
      console.log(`      SET shipment_status = '${expectedStatus}',`);
      console.log(`          updated_at = NOW()`);
      console.log(`      WHERE id = '${shipment.id}';`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('FIN DEL DIAGNÓSTICO');
    console.log('═'.repeat(60));
    
  } catch (err) {
    console.error('\n❌ Error inesperado:', err.message);
    console.error(err);
  }
}

main();