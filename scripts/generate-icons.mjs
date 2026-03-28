/**
 * Genera iconos de la app PudoBrickshare con una pieza de LEGO
 * Ejecutar: node scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    // Try dynamic import
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
  }

  const ASSETS_DIR = 'apps/mobile/assets';

  // ── SVG: Icono principal (pieza de LEGO roja vista desde arriba-ángulo) ──
  const mainIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FF3B3B;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E4002B;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#CC0024;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A80020;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickRight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#B8001F;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8F0019;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="4" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  
  <!-- Subtle grid pattern -->
  <g opacity="0.05">
    <line x1="0" y1="256" x2="1024" y2="256" stroke="white" stroke-width="1"/>
    <line x1="0" y1="512" x2="1024" y2="512" stroke="white" stroke-width="1"/>
    <line x1="0" y1="768" x2="1024" y2="768" stroke="white" stroke-width="1"/>
    <line x1="256" y1="0" x2="256" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="512" y1="0" x2="512" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="768" y1="0" x2="768" y2="1024" stroke="white" stroke-width="1"/>
  </g>
  
  <!-- LEGO Brick 3D - Isometric view -->
  <g filter="url(#shadow)" transform="translate(512, 420)">
    <!-- Right face -->
    <polygon points="0,80 220,200 220,40 0,-80" fill="url(#brickRight)"/>
    
    <!-- Front face -->
    <polygon points="0,80 -280,200 -280,40 0,-80" fill="url(#brickFront)"/>
    
    <!-- Top face -->
    <polygon points="0,-80 220,40 -60,160 -280,40" fill="url(#brickTop)"/>
    
    <!-- Studs (circles on top) - 2x4 layout -->
    <!-- Row 1 -->
    <ellipse cx="-185" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-115" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-45" cy="-38" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="25" cy="-68" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    
    <!-- Row 2 -->
    <ellipse cx="-125" cy="82" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-55" cy="52" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="15" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="85" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    
    <!-- Stud tops (slightly lighter) -->
    <ellipse cx="-185" cy="18" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-115" cy="-12" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-45" cy="-42" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="25" cy="-72" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-125" cy="78" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-55" cy="48" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="15" cy="18" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="85" cy="-12" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
  </g>
  
  <!-- Text: PUDO -->
  <text x="512" y="720" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="110" fill="#FFFFFF" letter-spacing="12">PUDO</text>
  
  <!-- Text: Brickshare -->
  <text x="512" y="810" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="56" fill="#94A3B8" letter-spacing="6">Brickshare</text>
  
  <!-- Small package icon -->
  <text x="512" y="900" text-anchor="middle" font-size="40" fill="#3B82F6">📦</text>
</svg>`;

  // ── SVG: Android Adaptive Icon - Foreground (solo el LEGO, sin fondo) ──
  const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="brickTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FF3B3B;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E4002B;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#CC0024;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A80020;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickRight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#B8001F;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8F0019;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- LEGO Brick 3D centered for adaptive icon safe zone -->
  <g transform="translate(512, 400) scale(1.3)">
    <!-- Right face -->
    <polygon points="0,80 220,200 220,40 0,-80" fill="url(#brickRight)"/>
    
    <!-- Front face -->
    <polygon points="0,80 -280,200 -280,40 0,-80" fill="url(#brickFront)"/>
    
    <!-- Top face -->
    <polygon points="0,-80 220,40 -60,160 -280,40" fill="url(#brickTop)"/>
    
    <!-- Studs Row 1 -->
    <ellipse cx="-185" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-115" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-45" cy="-38" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="25" cy="-68" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    
    <!-- Studs Row 2 -->
    <ellipse cx="-125" cy="82" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-55" cy="52" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="15" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="85" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    
    <!-- Stud highlights -->
    <ellipse cx="-185" cy="18" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-115" cy="-12" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-45" cy="-42" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="25" cy="-72" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-125" cy="78" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="-55" cy="48" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="15" cy="18" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
    <ellipse cx="85" cy="-12" rx="24" ry="12" fill="#FF6B6B" opacity="0.5"/>
  </g>
  
  <!-- PUDO text below brick -->
  <text x="512" y="750" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="100" fill="#FFFFFF" letter-spacing="10">PUDO</text>
</svg>`;

  // ── SVG: Android Adaptive Icon - Background ──
  const backgroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g opacity="0.08">
    <line x1="0" y1="256" x2="1024" y2="256" stroke="white" stroke-width="1"/>
    <line x1="0" y1="512" x2="1024" y2="512" stroke="white" stroke-width="1"/>
    <line x1="0" y1="768" x2="1024" y2="768" stroke="white" stroke-width="1"/>
    <line x1="256" y1="0" x2="256" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="512" y1="0" x2="512" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="768" y1="0" x2="768" y2="1024" stroke="white" stroke-width="1"/>
  </g>
</svg>`;

  // ── SVG: Monochrome icon (for Android 13+ themed icons) ──
  const monochromeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- LEGO Brick 3D - monochrome -->
  <g transform="translate(512, 400) scale(1.3)">
    <!-- Right face -->
    <polygon points="0,80 220,200 220,40 0,-80" fill="#666666"/>
    
    <!-- Front face -->
    <polygon points="0,80 -280,200 -280,40 0,-80" fill="#888888"/>
    
    <!-- Top face -->
    <polygon points="0,-80 220,40 -60,160 -280,40" fill="#AAAAAA"/>
    
    <!-- Studs Row 1 -->
    <ellipse cx="-185" cy="22" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="-115" cy="-8" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="-45" cy="-38" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="25" cy="-68" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    
    <!-- Studs Row 2 -->
    <ellipse cx="-125" cy="82" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="-55" cy="52" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="15" cy="22" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
    <ellipse cx="85" cy="-8" rx="28" ry="16" fill="#BBBBBB" stroke="#999" stroke-width="2"/>
  </g>
  
  <text x="512" y="750" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="100" fill="#AAAAAA" letter-spacing="10">PUDO</text>
</svg>`;

  // ── SVG: Favicon / small icon ──
  const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <g transform="translate(32, 28) scale(0.08)">
    <polygon points="0,80 220,200 220,40 0,-80" fill="#B8001F"/>
    <polygon points="0,80 -280,200 -280,40 0,-80" fill="#CC0024"/>
    <polygon points="0,-80 220,40 -60,160 -280,40" fill="#E4002B"/>
    <ellipse cx="-185" cy="22" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="-115" cy="-8" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="-45" cy="-38" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="25" cy="-68" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="-125" cy="82" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="-55" cy="52" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="15" cy="22" rx="28" ry="16" fill="#FF5555"/>
    <ellipse cx="85" cy="-8" rx="28" ry="16" fill="#FF5555"/>
  </g>
  <text x="32" y="52" text-anchor="middle" font-family="Arial" font-weight="900" font-size="14" fill="white">P</text>
</svg>`;

  // ── Splash icon ──
  const splashIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="brickTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FF3B3B;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E4002B;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#CC0024;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A80020;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="brickRight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#B8001F;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8F0019;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <g transform="translate(256, 200) scale(0.65)">
    <polygon points="0,80 220,200 220,40 0,-80" fill="url(#brickRight)"/>
    <polygon points="0,80 -280,200 -280,40 0,-80" fill="url(#brickFront)"/>
    <polygon points="0,-80 220,40 -60,160 -280,40" fill="url(#brickTop)"/>
    <ellipse cx="-185" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-115" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-45" cy="-38" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="25" cy="-68" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-125" cy="82" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="-55" cy="52" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="15" cy="22" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
    <ellipse cx="85" cy="-8" rx="28" ry="16" fill="#FF5555" stroke="#E4002B" stroke-width="2"/>
  </g>
  
  <text x="256" y="380" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="60" fill="#FFFFFF" letter-spacing="6">PUDO</text>
  <text x="256" y="430" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="30" fill="#94A3B8" letter-spacing="3">Brickshare</text>
</svg>`;

  console.log('🎨 Generating PudoBrickshare icons...\n');

  const icons = [
    { name: 'icon.png', svg: mainIconSvg, width: 1024, height: 1024 },
    { name: 'android-icon-foreground.png', svg: foregroundSvg, width: 1024, height: 1024 },
    { name: 'android-icon-background.png', svg: backgroundSvg, width: 1024, height: 1024 },
    { name: 'android-icon-monochrome.png', svg: monochromeSvg, width: 1024, height: 1024 },
    { name: 'favicon.png', svg: faviconSvg, width: 64, height: 64 },
    { name: 'splash-icon.png', svg: splashIconSvg, width: 512, height: 512 },
  ];

  for (const icon of icons) {
    const svgBuffer = Buffer.from(icon.svg);
    await sharp(svgBuffer)
      .resize(icon.width, icon.height)
      .png()
      .toFile(`${ASSETS_DIR}/${icon.name}`);
    console.log(`  ✅ ${icon.name} (${icon.width}x${icon.height})`);
  }

  console.log('\n🎉 All icons generated successfully!');
  console.log(`📂 Output directory: ${ASSETS_DIR}/`);
}

generateIcons().catch(console.error);