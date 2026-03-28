/**
 * Test script to verify jsQR decoding capability
 * 
 * Tests:
 * 1. Generate a QR code PNG with content similar to user's (BS-DEL-54A82B94-1DD)
 * 2. Decode it with jsQR
 * 3. Test with different image sizes
 * 4. Simulate the WebView flow (base64 → decode)
 */
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const TEST_DATA = 'BS-DEL-54A82B94-1DD';

async function generateQRBuffer(text, options = {}) {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: options.width || 300,
    margin: options.margin || 2,
    errorCorrectionLevel: options.ecl || 'M',
    ...options,
  });
}

function decodePNGBuffer(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  return { width, height, data: new Uint8ClampedArray(data) };
}

function decodeQR(imageData) {
  return jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
}

async function testBasicDecode() {
  console.log('═══════════════════════════════════════════');
  console.log('TEST 1: Basic QR decode');
  console.log('═══════════════════════════════════════════');
  
  const pngBuffer = await generateQRBuffer(TEST_DATA);
  const imageData = decodePNGBuffer(pngBuffer);
  
  console.log(`Image size: ${imageData.width}x${imageData.height}`);
  console.log(`Data length: ${imageData.data.length} bytes`);
  
  const result = decodeQR(imageData);
  
  if (result) {
    console.log(`✅ DECODED: "${result.data}"`);
    console.log(`   Expected: "${TEST_DATA}"`);
    console.log(`   Match: ${result.data === TEST_DATA ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('❌ FAILED: No QR code detected');
  }
  console.log();
}

async function testDifferentSizes() {
  console.log('═══════════════════════════════════════════');
  console.log('TEST 2: Different image sizes');
  console.log('═══════════════════════════════════════════');
  
  const sizes = [100, 200, 300, 500, 800, 1024, 2000];
  
  for (const size of sizes) {
    const pngBuffer = await generateQRBuffer(TEST_DATA, { width: size });
    const imageData = decodePNGBuffer(pngBuffer);
    const result = decodeQR(imageData);
    
    const status = result ? `✅ "${result.data}"` : '❌ Failed';
    console.log(`  ${size}x${size}: ${status}`);
  }
  console.log();
}

async function testBase64Flow() {
  console.log('═══════════════════════════════════════════');
  console.log('TEST 3: Base64 flow (simulating WebView)');
  console.log('═══════════════════════════════════════════');
  
  const pngBuffer = await generateQRBuffer(TEST_DATA, { width: 300 });
  const base64 = pngBuffer.toString('base64');
  
  console.log(`  Base64 length: ${base64.length} chars`);
  
  // Simulate what happens when converting back from base64
  const reconstructed = Buffer.from(base64, 'base64');
  const imageData = decodePNGBuffer(reconstructed);
  const result = decodeQR(imageData);
  
  if (result) {
    console.log(`  ✅ DECODED from base64: "${result.data}"`);
  } else {
    console.log('  ❌ FAILED from base64');
  }
  console.log();
}

async function testWithSurroundingContent() {
  console.log('═══════════════════════════════════════════');
  console.log('TEST 4: QR within larger image (simulating screenshot)');
  console.log('═══════════════════════════════════════════');
  
  // Generate a QR and embed it in a larger PNG with white padding
  const qrBuffer = await generateQRBuffer(TEST_DATA, { width: 300 });
  const qrPng = PNG.sync.read(qrBuffer);
  
  // Create a larger image (like a screenshot with text around QR)
  const padding = 100;
  const totalW = qrPng.width + padding * 2;
  const totalH = qrPng.height + padding * 2 + 80; // extra for "text" area
  
  const bigPng = new PNG({ width: totalW, height: totalH });
  
  // Fill with white
  for (let y = 0; y < totalH; y++) {
    for (let x = 0; x < totalW; x++) {
      const idx = (y * totalW + x) * 4;
      bigPng.data[idx] = 255;     // R
      bigPng.data[idx + 1] = 255; // G
      bigPng.data[idx + 2] = 255; // B
      bigPng.data[idx + 3] = 255; // A
    }
  }
  
  // Copy QR into center
  for (let y = 0; y < qrPng.height; y++) {
    for (let x = 0; x < qrPng.width; x++) {
      const srcIdx = (y * qrPng.width + x) * 4;
      const dstX = x + padding;
      const dstY = y + padding;
      const dstIdx = (dstY * totalW + dstX) * 4;
      bigPng.data[dstIdx] = qrPng.data[srcIdx];
      bigPng.data[dstIdx + 1] = qrPng.data[srcIdx + 1];
      bigPng.data[dstIdx + 2] = qrPng.data[srcIdx + 2];
      bigPng.data[dstIdx + 3] = qrPng.data[srcIdx + 3];
    }
  }
  
  // Add some "text" simulation (gray bar below QR)
  for (let y = qrPng.height + padding + 10; y < qrPng.height + padding + 30; y++) {
    for (let x = padding; x < padding + 200; x++) {
      const idx = (y * totalW + x) * 4;
      bigPng.data[idx] = 100;     // R (gray)
      bigPng.data[idx + 1] = 100; // G
      bigPng.data[idx + 2] = 200; // B (blueish like the tracking code)
      bigPng.data[idx + 3] = 255; // A
    }
  }
  
  const bigBuffer = PNG.sync.write(bigPng);
  console.log(`  Composite image: ${totalW}x${totalH}`);
  
  const imageData = decodePNGBuffer(bigBuffer);
  const result = decodeQR(imageData);
  
  if (result) {
    console.log(`  ✅ DECODED from composite: "${result.data}"`);
  } else {
    console.log('  ❌ FAILED from composite image');
  }
  
  // Also test: downscale the composite to 1024 max (like the WebView does)
  const scale = 1024 / Math.max(totalW, totalH);
  const scaledW = Math.floor(totalW * scale);
  const scaledH = Math.floor(totalH * scale);
  console.log(`  After scaling to max 1024: ${scaledW}x${scaledH}`);
  
  // Save to file for inspection
  const testFilePath = path.join('scripts', 'test-qr-output.png');
  fs.writeFileSync(testFilePath, bigBuffer);
  console.log(`  Saved composite to: ${testFilePath}`);
  console.log();
}

async function testWebViewMessageFlow() {
  console.log('═══════════════════════════════════════════');
  console.log('TEST 5: Simulating full WebView message flow');
  console.log('═══════════════════════════════════════════');
  
  const pngBuffer = await generateQRBuffer(TEST_DATA, { width: 400 });
  const base64 = pngBuffer.toString('base64');
  
  // This simulates what happens in the WebView:
  // 1. Receive base64
  // 2. Create Image from data URI
  // 3. Draw to canvas
  // 4. Get imageData
  // 5. Run jsQR
  
  // In Node.js we skip the Image/Canvas steps and go directly to pixel data
  const reconstructed = Buffer.from(base64, 'base64');
  const imageData = decodePNGBuffer(reconstructed);
  
  console.log(`  Base64 → PNG → pixels: ${imageData.width}x${imageData.height}`);
  console.log(`  Pixel data type: ${imageData.data.constructor.name}`);
  console.log(`  Pixel data length: ${imageData.data.length}`);
  console.log(`  Expected (w*h*4): ${imageData.width * imageData.height * 4}`);
  
  const result = decodeQR(imageData);
  
  if (result) {
    console.log(`  ✅ DECODED: "${result.data}"`);
  } else {
    console.log('  ❌ FAILED');
    
    // Debug: check if image data looks reasonable
    const firstPixels = Array.from(imageData.data.slice(0, 16));
    console.log(`  First 4 pixels (RGBA): ${JSON.stringify(firstPixels)}`);
  }
  console.log();
}

// ── Run all tests ──
console.log('\n🔍 jsQR Decoding Test Suite\n');
console.log(`Test data: "${TEST_DATA}"\n`);

await testBasicDecode();
await testDifferentSizes();
await testBase64Flow();
await testWithSurroundingContent();
await testWebViewMessageFlow();

console.log('═══════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════');
console.log('If all tests passed, jsQR works correctly.');
console.log('The problem is likely in the WebView image loading or');
console.log('postMessage communication between RN and WebView.');