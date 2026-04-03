#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Configuration
const NGROK_DOMAIN = 'semblably-dizzied-bruno.ngrok-free.dev';
const NGROK_PORT = 54331;
const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const MAX_RETRIES = 15;
const RETRY_INTERVAL = 1000;

let supabaseProcess = null;
let ngrokProcess = null;
let isShuttingDown = false;

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
    log(`  Validating connection to ${tunnelUrl}...`, 'yellow');
    const response = await fetch(`${tunnelUrl}/rest/v1/shipments?limit=1`, {
      timeout: 10000,
      headers: {
        apikey: 'placeholder',
      },
    });

    // We expect 401 or similar - we just need the connection to work
    if (response.status >= 400 && response.status < 500) {
      log(`  ✓ Connection established (HTTP ${response.status})`, 'green');
      return true;
    } else if (response.ok) {
      log(`  ✓ Connection established successfully`, 'green');
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    log(`  ✗ Connection failed: ${error.message}`, 'red');
    return false;
  }
}

function killProcessByPort(port) {
  try {
    // Try to find and kill any process using the port
    if (process.platform === 'darwin' || process.platform === 'linux') {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: 'ignore',
      });
    } else if (process.platform === 'win32') {
      execSync(`netstat -ano | find "${port}" | find "LISTENING" | for /F "tokens=5" %a in ('findstr "${port}"') do taskkill /PID %a /F 2>nul || true`, {
        stdio: 'ignore',
        shell: 'cmd',
      });
    }
  } catch (error) {
    // Ignore errors
  }
}

function startSupabase() {
  return new Promise((resolve, reject) => {
    log('Starting Supabase...', 'blue');

    // Kill any existing process on port 54321
    killProcessByPort(54321);
    killProcessByPort(4040); // ngrok default port

    supabaseProcess = spawn('supabase', ['start'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    let supabaseReady = false;

    // Give Supabase time to start
    setTimeout(() => {
      supabaseReady = true;
      resolve();
    }, 8000);

    supabaseProcess.on('error', (error) => {
      if (!supabaseReady) {
        reject(new Error(`Failed to start Supabase: ${error.message}`));
      }
    });

    supabaseProcess.on('exit', (code) => {
      if (code !== 0 && !isShuttingDown) {
        reject(new Error(`Supabase exited with code ${code}`));
      }
    });
  });
}

function startNgrok() {
  return new Promise((resolve, reject) => {
    log('Starting ngrok tunnel...', 'blue');

    ngrokProcess = spawn('ngrok', [
      'http',
      String(NGROK_PORT),
      `--domain=${NGROK_DOMAIN}`,
    ]);

    let ngrokReady = false;
    const timeout = setTimeout(() => {
      reject(new Error('ngrok startup timeout'));
    }, 30000);

    // Monitor ngrok output for startup messages
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started tunnel') || output.includes('forwarding')) {
        if (!ngrokReady) {
          ngrokReady = true;
          clearTimeout(timeout);
          resolve();
        }
      }
    });

    ngrokProcess.stderr.on('data', (data) => {
      const output = data.toString();
      // Check for critical errors
      if (
        output.includes('ERR_NGROK_107') ||
        output.includes('ERR_NGROK_220')
      ) {
        clearTimeout(timeout);
        reject(
          new Error(
            `ngrok error: ${output}. Make sure ngrok is installed and domain is reserved.`
          )
        );
      }
    });

    ngrokProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start ngrok: ${error.message}`));
    });

    ngrokProcess.on('exit', (code) => {
      if (code !== 0 && !isShuttingDown) {
        clearTimeout(timeout);
        reject(new Error(`ngrok exited with code ${code}`));
      }
    });
  });
}

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logSection('Shutting down services...');

  if (ngrokProcess) {
    log('Stopping ngrok...', 'yellow');
    ngrokProcess.kill();
  }

  if (supabaseProcess) {
    log('Stopping Supabase...', 'yellow');
    supabaseProcess.kill();
  }

  log('All services stopped.', 'green');
  process.exit(0);
}

async function main() {
  logSection('🚀 Brickshare Logistics Development Environment');

  // Handle shutdown signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Step 1: Start Supabase
    log('\n[1/3] Starting Supabase local database...', 'yellow');
    await startSupabase();
    log('✓ Supabase started on http://localhost:54331', 'green');

    // Step 2: Start ngrok
    log('\n[2/3] Starting ngrok tunnel...', 'yellow');
    await startNgrok();
    log('✓ ngrok started', 'green');

    // Step 3: Validate ngrok tunnel
    log('\n[3/3] Validating ngrok tunnel...', 'yellow');
    let tunnelUrl = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        tunnelUrl = await checkNgrokTunnel(0);
        log(`✓ Tunnel URL: ${tunnelUrl}`, 'green');
        break;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) {
          throw error;
        }
        log(
          `  Retrying... (${attempt + 1}/${MAX_RETRIES})`,
          'yellow'
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Validate connection
    const isConnected = await validateNgrokConnection(tunnelUrl);
    if (!isConnected) {
      throw new Error('Failed to validate ngrok connection');
    }

    // Success!
    logSection('✅ All services ready');
    log(`Database:    http://localhost:54331`, 'cyan');
    log(`ngrok tunnel: ${tunnelUrl}`, 'cyan');
    log(`Dashboard:   http://localhost:4040`, 'cyan');
    console.log('\n' + '━'.repeat(60));
    log('Press Ctrl+C to stop all services', 'yellow');
    console.log('━'.repeat(60) + '\n');

  } catch (error) {
    logSection('❌ Error starting services');
    log(error.message, 'red');

    // Cleanup on error
    if (ngrokProcess) ngrokProcess.kill();
    if (supabaseProcess) supabaseProcess.kill();

    process.exit(1);
  }
}

main();