#!/usr/bin/env node

import fetch from 'node-fetch';

const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const NGROK_DOMAIN = 'semblably-dizzied-bruno.ngrok-free.dev';

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

async function checkStatus() {
  try {
    log('\n🔍 Checking ngrok status...', 'blue');

    const response = await fetch(NGROK_API_URL, { timeout: 5000 });

    if (!response.ok) {
      throw new Error(
        'ngrok API not responding. Is ngrok running? (Run: npm run dev:tunnel)'
      );
    }

    const data = await response.json();

    if (!data.tunnels || data.tunnels.length === 0) {
      throw new Error('No tunnels configured');
    }

    const httpTunnel = data.tunnels.find((t) => t.proto === 'http');
    const httpsTunnel = data.tunnels.find((t) => t.proto === 'https');

    log('\n✓ ngrok is running!', 'green');
    console.log('\nTunnel Information:');
    console.log('─'.repeat(50));

    if (httpTunnel) {
      log(`  HTTP URL:  ${httpTunnel.public_url}`, 'cyan');
    }

    if (httpsTunnel) {
      log(`  HTTPS URL: ${httpsTunnel.public_url}`, 'cyan');
    }

    // Validate connection
    try {
      const testUrl = httpsTunnel?.public_url || httpTunnel?.public_url;
      if (testUrl) {
        log(`\n  Testing connection...`, 'yellow');
        const testResponse = await fetch(`${testUrl}/rest/v1/health`, {
          timeout: 5000,
          headers: {
            apikey: 'placeholder',
          },
        });

        if (testResponse.ok) {
          log(`  ✓ Connection working!`, 'green');
        } else {
          log(`  ⚠ Connection received response (HTTP ${testResponse.status})`, 'yellow');
        }
      }
    } catch (error) {
      log(`  ⚠ Could not reach tunnel: ${error.message}`, 'yellow');
    }

    console.log('─'.repeat(50));

    // Configuration info
    console.log('\nConfiguration:');
    log(`  Configured Domain: ${NGROK_DOMAIN}`, 'cyan');
    log(`  Local Port: 54321`, 'cyan');
    log(`  API Dashboard: http://localhost:4040`, 'cyan');

    console.log('\n');
    process.exit(0);

  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    console.log('\nTo start ngrok, run:');
    log('  npm run dev:tunnel', 'yellow');
    console.log('\n');
    process.exit(1);
  }
}

checkStatus();