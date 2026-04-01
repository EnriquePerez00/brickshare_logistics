#!/usr/bin/env node

/**
 * Script de diagnóstico para escaneo QR BS-DEL-4BCD6EB3-C99
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

const NGROK_URL = process.env.SUPABASE_brickshare_API_URL || 'https://semblably-dizzied-bruno.ngrok-free.dev';
const LOCAL_DB_KEY = process.env.SUPABASE_brickshare_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const QR_CODE = 'BS-DEL-4BCD6EB3-C99';

console.log('🔍 DIAGNÓSTICO DE ESCANEO QR\n');
console.log('═'.repeat(60));
console.log(`📋 QR Code: ${QR_CODE}`);
console.log(`🔗 BD Local (ngrok): ${NGROK_URL}`);
console.log('═'.repeat(60));

const localSupabase = createClient(NGROK_URL, LOCAL_DB_KEY);

async function main() {
  try {
    console.log('\n📡 Conectando a BD local (Brickshare via ngrok)...');
    
    // Primero, obtener lista de tablas disponibles
    console.log(`\n🔍 Listando tablas disponibles en la BD local...`);
    
    const { data: tables, error: tablesErr } = await localSupabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesErr) {
      console.log('⚠️  No se pueden listar tablas desde information_schema');
      console.log('   Intentando acceso directo a shipments...');
    } else {
      console.log('✅ Tablas en schema public:');
      if (tables && tables.length > 0) {
        tables.slice(0, 20).forEach(t => {
          console.log(`   - ${t.table_name}`);
        });
      }
    }
    
    // Buscar el shipment por QR en los tres campos posibles
    console.log(`\n🔎 Buscando QR en tabla shipments...`);
    
    const { data: shipment, error: shipmentErr } = await localSupabase
      .from('shipments')
      .select('id, delivery_qr_code, pickup_qr_code, return_qr_code, shipment_status, tracking_number, user_id, shipping_address, shipping_city')
      .or(`delivery_qr_code.eq.${QR_CODE},pickup_qr_code.eq.${QR_CODE},return_qr_code.eq.${QR_CODE}`)
      .single();

    if (shipmentErr) {
      console.error('❌ Error buscando shipment:', shipmentErr.message);
      console.error('   Código de error:', shipmentErr.code);
      
      if (shipmentErr.code === 'PGRST205') {
        console.error('\n   ⚠️  PROBLEMA: La tabla shipments no está accesible');
        console.error('   Posibles causas:');
        console.error('   1. Tabla en un schema diferente a "public"');
        console.error('   2. Las credenciales no tienen permisos');
        console.error('   3. ngrok URL inaccesible o en timeout');
      }
      return;
    }

    if (!shipment) {
      console.error('❌ Shipment NO encontrado');
      
      // Buscar shipments con cualquier delivery_qr_code para verificar que la tabla existe
      const { data: allShipments, error: allErr } = await localSupabase
        .from('shipments')
        .select('id, delivery_qr_code, shipment_status')
        .limit(5);
      
      if (allErr) {
        console.error('❌ Error consultando tabla shipments:', allErr.message);
        return;
      }
      
      console.log('\n📊 Shipments encontrados en la tabla:');
      if (allShipments && allShipments.length > 0) {
        allShipments.forEach(s => {
          console.log(`   - ID: ${s.id}, QR: ${s.delivery_qr_code}, Status: ${s.shipment_status}`);
        });
      } else {
        console.log('   (Tabla está vacía)');
      }
      return;
    }

    console.log('✅ Shipment encontrado!');
    console.log('\n📦 DATOS DEL SHIPMENT:');
    console.log(`   ID: ${shipment.id}`);
    console.log(`   Tracking: ${shipment.tracking_number}`);
    console.log(`   Usuario: ${shipment.user_id}`);
    console.log(`   Dirección: ${shipment.shipping_address}, ${shipment.shipping_city}`);
    
    console.log('\n🔐 CÓDIGOS QR:');
    console.log(`   delivery_qr_code: ${shipment.delivery_qr_code || 'NULL'}`);
    console.log(`   pickup_qr_code: ${shipment.pickup_qr_code || 'NULL'}`);
    console.log(`   return_qr_code: ${shipment.return_qr_code || 'NULL'}`);
    
    console.log('\n📊 ESTADO ACTUAL:');
    console.log(`   shipment_status: ${shipment.shipment_status}`);
    
    // Determinar tipo de operación
    let operationType = null;
    let expectedStatus = null;
    let newStatus = null;
    
    if (shipment.delivery_qr_code === QR_CODE) {
      operationType = 'DROPOFF (recepción en PUDO)';
      expectedStatus = 'in_transit_pudo';
      newStatus = 'delivered_pudo';
    } else if (shipment.pickup_qr_code === QR_CODE) {
      operationType = 'PICKUP (entrega a cliente)';
      expectedStatus = 'delivered_pudo';
      newStatus = 'delivered_user';
    } else if (shipment.return_qr_code === QR_CODE) {
      operationType = 'RETURN (devolución en PUDO)';
      expectedStatus = 'in_return_pudo';
      newStatus = 'in_return';
    }
    
    console.log('\n🎯 OPERACIÓN DETECTADA:');
    console.log(`   Tipo: ${operationType}`);
    console.log(`   Estado esperado: ${expectedStatus}`);
    console.log(`   Nuevo estado: ${newStatus}`);
    
    console.log('\n✅ VALIDACIÓN DE ESTADO:');
    if (shipment.shipment_status === expectedStatus) {
      console.log(`   ✅ CORRECTO: El shipment está en estado '${expectedStatus}'`);
      console.log(`   El escaneo debería funcionar correctamente.`);
    } else {
      console.log(`   ❌ INCORRECTO: Se esperaba '${expectedStatus}' pero está en '${shipment.shipment_status}'`);
      console.log(`   PROBLEMA: Este es el error que recibiste en la app móvil!`);
      console.log(`\n   💡 SOLUCIÓN: Necesitas actualizar el estado del shipment a '${expectedStatus}'`);
      console.log(`   SQL: UPDATE shipments SET shipment_status = '${expectedStatus}' WHERE id = '${shipment.id}';`);
    }
    
  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
    console.error(err);
  }
}

main();