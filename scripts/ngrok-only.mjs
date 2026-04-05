#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

// Configuration
const NGROK_DOMAIN = 'semblably-dizzied-bruno.ngrok-free.dev';
const NGROK_PORT = 54331;
const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const MAX_RETRIES = 15;
const RETRY_INTERVAL = 1000;
const LOG_FILE = join(process.cwd(), 'ngrok-debug.log');

let ngrokProcess = null;
let isShuttingDown = false;

// Initialize log file
writeFileSync(LOG_FILE, `=== ngrok Debug Log - ${new Date().toISOString()} ===\n\n`);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '━'.repeat(60));
  log(`  ${title}`, 'cyan');
  console.log('━'.repeat(60));
}

async function checkNgrokTunnel(retries = 0) {
  try {
    const response = await fetch(NGROK_API_URL, { timeout: 5000 });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.tunnels || data.tunnels.length === 0) {
      throw new Error('No tunnels found');
    }

    const tunnel = data.tunnels.find((t) => t.proto === 'https');
    if (!tunnel) {
      throw new Error('No HTTPS tunnel found');
    }

    return tunnel.public_url;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
      return checkNgrokTunnel(retries + 1);
    }
    throw error;
  }
}

async function validateNgrokConnection(tunnelUrl) {
  try {
    log(`  Validando conexión a ${tunnelUrl}...`, 'yellow');
    const response = await fetch(`${tunnelUrl}/rest/v1/shipments?limit=1`, {
      timeout: 10000,
      headers: {
        apikey: 'placeholder',
      },
    });

    // Esperamos 401 o similar - solo necesitamos que la conexión funcione
    if (response.status >= 400 && response.status < 500) {
      log(`  ✓ Conexión establecida (HTTP ${response.status})`, 'green');
      return true;
    } else if (response.ok) {
      log(`  ✓ Conexión establecida exitosamente`, 'green');
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    log(`  ✗ Conexión fallida: ${error.message}`, 'red');
    return false;
  }
}

function startNgrok() {
  return new Promise((resolve, reject) => {
    log('Iniciando túnel ngrok...', 'blue');
    log(`Logs guardándose en: ${LOG_FILE}`, 'yellow');

    const command = 'ngrok';
    const args = [
      'http',
      String(NGROK_PORT),
    ];
    
    appendFileSync(LOG_FILE, `Command: ${command} ${args.join(' ')}\n\n`);

    ngrokProcess = spawn(command, args);

    let ngrokReady = false;
    const timeout = setTimeout(() => {
      appendFileSync(LOG_FILE, '\n\n=== TIMEOUT after 60 seconds ===\n');
      reject(new Error('Timeout al iniciar ngrok - revisa ngrok-debug.log'));
    }, 60000); // Aumentado a 60 segundos

    // Monitor ngrok output for startup messages
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      const timestamp = new Date().toISOString();
      
      // Log to file
      appendFileSync(LOG_FILE, `[${timestamp}] STDOUT: ${output}\n`);
      
      // Log to console
      console.log('[ngrok stdout]', output);
      
      // Check for success indicators - más permisivo
      if (!ngrokReady && (
        output.toLowerCase().includes('tunnel') ||
        output.toLowerCase().includes('forwarding') ||
        output.toLowerCase().includes('url') ||
        output.includes('https://')
      )) {
        ngrokReady = true;
        clearTimeout(timeout);
        appendFileSync(LOG_FILE, '\n=== TUNNEL DETECTED AS READY ===\n');
        resolve();
      }
    });

    ngrokProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const timestamp = new Date().toISOString();
      
      // Log to file
      appendFileSync(LOG_FILE, `[${timestamp}] STDERR: ${output}\n`);
      
      // Log to console
      console.log('[ngrok stderr]', output);
      
      // Check for critical errors
      if (
        output.includes('ERR_NGROK_107') ||
        output.includes('ERR_NGROK_220')
      ) {
        clearTimeout(timeout);
        appendFileSync(LOG_FILE, '\n=== CRITICAL ERROR DETECTED ===\n');
        reject(
          new Error(
            `Error de ngrok: ${output}. Revisa ngrok-debug.log para más detalles.`
          )
        );
      }
    });

    ngrokProcess.on('error', (error) => {
      clearTimeout(timeout);
      appendFileSync(LOG_FILE, `\n=== PROCESS ERROR: ${error.message} ===\n`);
      reject(new Error(`Falló al iniciar ngrok: ${error.message}`));
    });

    ngrokProcess.on('exit', (code) => {
      if (code !== 0 && !isShuttingDown) {
        clearTimeout(timeout);
        appendFileSync(LOG_FILE, `\n=== PROCESS EXIT: code ${code} ===\n`);
        reject(new Error(`ngrok terminó con código ${code}`));
      }
    });
  });
}

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logSection('Deteniendo ngrok...');

  if (ngrokProcess) {
    log('Cerrando túnel ngrok...', 'yellow');
    ngrokProcess.kill();
  }

  log('Túnel ngrok detenido.', 'green');
  process.exit(0);
}

async function main() {
  logSection('🌐 Iniciando Túnel ngrok');

  // Handle shutdown signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Paso 1: Iniciar ngrok
    log('\n[1/2] Iniciando túnel ngrok...', 'yellow');
    await startNgrok();
    log('✓ ngrok iniciado', 'green');

    // Paso 2: Validar túnel ngrok
    log('\n[2/2] Validando túnel ngrok...', 'yellow');
    let tunnelUrl = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        tunnelUrl = await checkNgrokTunnel(0);
        log(`✓ URL del túnel: ${tunnelUrl}`, 'green');
        break;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) {
          throw error;
        }
        log(
          `  Reintentando... (${attempt + 1}/${MAX_RETRIES})`,
          'yellow'
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Validar conexión
    const isConnected = await validateNgrokConnection(tunnelUrl);
    if (!isConnected) {
      throw new Error('Falló la validación de la conexión ngrok');
    }

    // ¡Éxito!
    logSection('✅ Túnel ngrok OPERATIVO');
    log(`URL del túnel: ${tunnelUrl}`, 'cyan');
    log(`Dashboard:     http://localhost:4040`, 'cyan');
    console.log('\n' + '━'.repeat(60));
    log('Presiona Ctrl+C para detener el túnel', 'yellow');
    console.log('━'.repeat(60) + '\n');

  } catch (error) {
    logSection('❌ Error al iniciar el túnel ngrok');
    log(error.message, 'red');

    // Cleanup on error
    if (ngrokProcess) ngrokProcess.kill();

    process.exit(1);
  }
}

main();