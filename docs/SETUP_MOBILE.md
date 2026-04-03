# 📱 Guía de Setup Mobile — Brickshare PUDO

## 🏗️ Arquitectura Dual Database

La aplicación móvil trabaja con **dos bases de datos Supabase** simultáneamente:

### **DB1 (Brickshare_logistics)** - Cloud Supabase
- 🌐 **URL:** `https://qumjzvhtotcvnzpjgjkl.supabase.co`
- 🔐 **Propósito:** Autenticación de operadores PUDO + Registro de auditoría
- 📦 **Variables:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- 🔑 **Cliente:** `supabase` (exportado desde `@brickshare/shared`)

### **DB2 (Brickshare)** - Local Database vía ngrok
- 🏠 **URL:** `https://semblably-dizzied-bruno.ngrok-free.dev` (túnel temporal)
- 📦 **Propósito:** Gestión de envíos, QR codes, clientes finales
- 📊 **Variables:** `EXPO_PUBLIC_LOCAL_SUPABASE_URL`, `EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY`
- 🔑 **Cliente:** `supabaseLocal` (exportado desde `@brickshare/shared`)

### 🔄 Flujo de Operación en la App

```
┌──────────────────────┐
│  LoginScreen.tsx     │ 1. Usuario ingresa credenciales
│                      │ 2. Autentica con DB1 (Cloud)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  ScannerScreen.tsx   │ 3. Operador escanea QR code
│                      │ 4. Captura GPS (lat, lon, accuracy)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  pudoService.ts      │ 5. Invoca Edge Function en DB1
│  processPudoScan()   │    con JWT token del usuario
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  DB1 Edge Function   │ 6. Valida operador y ubicación
│  process-pudo-scan   │ 7. Conecta a DB2 vía ngrok
└──────────┬───────────┘    8. Busca y actualiza shipment
           │                9. Registra log en DB1
           ▼
┌──────────────────────┐
│  ScannerScreen.tsx   │ 10. Muestra resultado al operador
│  Feedback UI         │ 11. Log detallado en consola
└──────────────────────┘
```

**⚠️ Dependencia crítica:** El túnel ngrok debe estar activo para que DB2 sea accesible desde la Edge Function desplegada en DB1 Cloud.

## Arquitectura de la App

El monorepo utiliza **una sola app mobile** (`apps/mobile/`) que genera builds separados para **iOS** y **Android**. El código fuente es 100% compartido entre ambas plataformas.

```
brickshare-logistics/
├── apps/
│   ├── mobile/              ← App React Native / Expo
│   │   ├── src/
│   │   │   ├── screens/     ← Pantallas de la app
│   │   │   ├── components/  ← Componentes reutilizables
│   │   │   ├── config/      ← Configuración por plataforma
│   │   │   └── utils/       ← Utilidades (logger, helpers)
│   │   ├── assets/          ← Iconos, splash screens
│   │   ├── app.json         ← Config Expo (permisos, identifiers)
│   │   ├── eas.json         ← Config EAS Build (perfiles de build)
│   │   └── metro.config.js  ← Config Metro bundler (monorepo)
│   └── web/                 ← App Next.js (dashboard)
└── packages/
    └── shared/              ← Código compartido (tipos, Supabase client)
```

---

## Requisitos Previos

### Para ambas plataformas
- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **Expo CLI**: `npm install -g expo-cli` (opcional, incluido en npx)
- **EAS CLI**: `npm install -g eas-cli` (para builds en la nube)

### Para iOS (solo en macOS)
- **Xcode** >= 15.0 (descargar desde App Store)
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods` o `brew install cocoapods`
- **Simulador iOS**: Se instala con Xcode (iPhone 15/16 Pro recomendado)

### Para Android
- **Android Studio** (descargar desde https://developer.android.com/studio)
- **Android SDK** (se instala con Android Studio)
- **Java 17**: `brew install openjdk@17` (macOS)
- **Emulador Android**: Configurar un AVD en Android Studio
- **Variables de entorno** (añadir a `~/.zshrc`):
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```

---

## Setup Inicial

### 1. Instalar dependencias del monorepo

```bash
# Desde la raíz del proyecto
npm install
```

### 2. Configurar variables de entorno

```bash
# Copiar el ejemplo
cp apps/mobile/.env.example apps/mobile/.env.local

# Editar con tus credenciales
nano apps/mobile/.env.local
```

**Variables requeridas:**
```bash
# ═══════════════════════════════════════════════════════════
# DB1 - CLOUD (Brickshare_logistics)
# Autenticación y logs de auditoría
# ═══════════════════════════════════════════════════════════
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ═══════════════════════════════════════════════════════════
# DB2 - LOCAL (Brickshare) vía ngrok
# Gestión de shipments y QR codes
# ═══════════════════════════════════════════════════════════
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://semblably-dizzied-bruno.ngrok-free.dev
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

# ═══════════════════════════════════════════════════════════
# DEV MODE (opcional)
# ═══════════════════════════════════════════════════════════
EXPO_PUBLIC_DEV_MODE=true  # Bypass JWT validation para testing
```

**🔄 Actualizar URL de ngrok:**

ngrok genera una nueva URL cada vez que se reinicia (plan gratuito). Para actualizar:

```bash
# 1. Relanzar ngrok en la máquina con DB2 local
ngrok http 54321

# 2. Copiar la nueva URL (ej: https://nueva-url.ngrok-free.dev)

# 3. Actualizar en apps/mobile/.env.local
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://nueva-url.ngrok-free.dev

# 4. Reiniciar la app móvil para cargar la nueva configuración
```

### 3. Verificar la configuración

```bash
cd apps/mobile
npx expo-doctor
```

---

## Desarrollo Local

### Opción 1: Expo Go (Rápido, limitaciones con librerías nativas)

```bash
# Desde la raíz
npm run dev:mobile

# O desde apps/mobile
cd apps/mobile
npm run start:go
```

Escanea el QR con la app **Expo Go** (iOS: App Store / Android: Play Store).

> ⚠️ **Limitación**: Expo Go no soporta `react-native-thermal-receipt-printer` ni otras librerías nativas personalizadas. Para funcionalidad completa, usa Development Builds.

### Opción 2: Development Build (Funcionalidad completa)

#### iOS (requiere Mac + Xcode)

```bash
# Generar proyecto nativo iOS y compilar
npm run dev:mobile:ios

# O desde apps/mobile
cd apps/mobile
npm run ios
```

Esto genera la carpeta `ios/`, instala pods, y lanza la app en el simulador.

#### Android (requiere Android Studio + emulador)

```bash
# Generar proyecto nativo Android y compilar
npm run dev:mobile:android

# O desde apps/mobile
cd apps/mobile
npm run android
```

Esto genera la carpeta `android/`, compila el APK, y lanza la app en el emulador.

### Opción 3: Dev Client (Para uso continuo)

Después de hacer el primer build nativo:

```bash
cd apps/mobile
npm run start:dev-client
```

Esto inicia el servidor Metro y se conecta al build nativo que ya está instalado.

---

## Builds para Testing

### Builds Locales (Sin cuenta EAS)

#### iOS Simulator Build
```bash
cd apps/mobile
npm run prebuild:ios        # Genera proyecto nativo
npm run ios                 # Compila y ejecuta en simulador
```

#### Android APK Local
```bash
cd apps/mobile
npm run prebuild:android    # Genera proyecto nativo
npm run android             # Compila y ejecuta en emulador/dispositivo
```

### Builds con EAS (En la nube, requiere cuenta gratuita de Expo)

Primero, crea una cuenta en https://expo.dev y configura tu proyecto:

```bash
# Login en EAS
eas login

# Configurar proyecto (solo la primera vez)
eas init
```

#### Build para iOS (simulador)
```bash
cd apps/mobile
npm run build:ios:dev       # Build local para simulador
```

#### Build para Android (APK instalable)
```bash
cd apps/mobile
npm run build:android:dev   # Build local (genera APK)
npm run build:android:apk   # Build en la nube (genera APK descargable)
```

#### Build para ambas plataformas
```bash
cd apps/mobile
npm run build:all:preview
```

---

## Instalar en Dispositivos Físicos

### Android
1. Genera un APK: `npm run build:android:apk`
2. Descarga el APK desde la URL que te da EAS
3. Transfiere al dispositivo e instala (habilitar "Fuentes desconocidas")

### iOS (sin Apple Developer Account)
1. Conecta tu iPhone al Mac con cable USB
2. Ejecuta `npm run ios` con el dispositivo seleccionado
3. En el iPhone: Ajustes > General > VPN y gestión de dispositivos > Confiar

> ⚠️ Sin Apple Developer Account ($99/año), solo puedes instalar directamente desde Xcode con cable. No puedes distribuir a otros dispositivos.

---

## Scripts Disponibles

### Desde la raíz del monorepo

| Script | Descripción |
|--------|-------------|
| `npm run dev:mobile` | Inicia Expo development server |
| `npm run dev:mobile:ios` | Compila y ejecuta en iOS |
| `npm run dev:mobile:android` | Compila y ejecuta en Android |
| `npm run build:mobile:ios` | Build iOS en EAS (preview) |
| `npm run build:mobile:android` | Build Android en EAS (preview) |
| `npm run build:mobile:all` | Build ambas plataformas |
| `npm run prebuild:mobile` | Genera proyectos nativos |
| `npm run prebuild:mobile:ios` | Genera solo proyecto iOS |
| `npm run prebuild:mobile:android` | Genera solo proyecto Android |

### Desde `apps/mobile/`

| Script | Descripción |
|--------|-------------|
| `npm run start` | Servidor Expo (auto-detecta) |
| `npm run start:dev-client` | Servidor para dev client |
| `npm run start:go` | Servidor para Expo Go |
| `npm run ios` | Compilar y ejecutar en iOS |
| `npm run ios:simulator` | Ejecutar en simulador específico |
| `npm run android` | Compilar y ejecutar en Android |
| `npm run android:device` | Ejecutar en dispositivo conectado |
| `npm run prebuild:clean` | Regenerar proyectos nativos |
| `npm run build:ios:dev` | Build iOS local (desarrollo) |
| `npm run build:android:dev` | Build Android local (desarrollo) |
| `npm run build:ios:preview` | Build iOS en EAS (testing) |
| `npm run build:android:apk` | Build Android APK en EAS |
| `npm run clean` | Limpiar todo (node_modules, native) |
| `npm run clean:native` | Limpiar y regenerar nativos |
| `npm run doctor` | Verificar configuración |
| `npm run type-check` | Verificar tipos TypeScript |

---

## Configuración por Plataforma

La app usa un archivo de configuración centralizado en `src/config/platform.ts` que maneja las diferencias entre iOS y Android:

```typescript
import { IS_IOS, IS_ANDROID, theme, cameraConfig } from '../config';

// Ejemplo de uso
const fontFamily = IS_IOS ? 'Courier' : 'monospace';
const scanSize = cameraConfig.scanAreaSize; // Ajustado por plataforma
```

### Diferencias manejadas automáticamente:
- **UI**: Sombras (shadowProps en iOS vs elevation en Android)
- **Fuentes**: Monospace font names
- **Cámara**: Tamaño del área de escaneo
- **Bluetooth**: Timeouts y permisos
- **GPS**: Timeouts de ubicación
- **Safe Area**: Padding para notch/home indicator

---

## Permisos por Plataforma

### iOS (configurados en `app.json > expo.ios.infoPlist`)
- `NSCameraUsageDescription` — Escaneo de QR/barcode
- `NSLocationWhenInUseUsageDescription` — Validación GPS de entregas
- `NSBluetoothAlwaysUsageDescription` — Conexión con impresora térmica
- `NSBluetoothPeripheralUsageDescription` — Escaneo de dispositivos BLE

### Android (configurados en `app.json > expo.android.permissions`)
- `CAMERA` — Escaneo de QR/barcode
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — Validación GPS
- `BLUETOOTH` / `BLUETOOTH_ADMIN` — Conexión con impresora
- `BLUETOOTH_CONNECT` / `BLUETOOTH_SCAN` — Permisos BLE Android 12+

---

## Troubleshooting

### "Edge Function returned a non-2xx status code"

**Síntoma:** Error al escanear QR codes, la app no puede procesar los envíos

**Causas más comunes:**

1. **Túnel ngrok caído o expirado**
   ```bash
   # Verificar si ngrok está activo
   curl https://semblably-dizzied-bruno.ngrok-free.dev/health
   
   # Si falla, reiniciar ngrok (en la máquina con DB2)
   ngrok http 54321
   ```

2. **URL de ngrok desactualizada en .env.local**
   - ngrok genera una nueva URL cada reinicio (plan free)
   - Actualizar `EXPO_PUBLIC_LOCAL_SUPABASE_URL` con la nueva URL
   - Reiniciar la app móvil: `npm run android` o `npm run ios`

3. **DB2 local no está corriendo**
   ```bash
   # Verificar que Supabase local esté activo
   docker ps | grep supabase
   
   # Si no está corriendo, iniciar
   cd /ruta/a/db2
   supabase start
   ```

4. **Edge Function no puede alcanzar ngrok desde Supabase Cloud**
   - El contenedor Docker de Supabase Cloud debe poder acceder a ngrok
   - Verificar logs de la Edge Function en Supabase Dashboard
   - Considerar usar ngrok pro ($8/mes) para URL estática

**Solución paso a paso:**
```bash
# 1. Verificar que DB2 local esté corriendo
supabase status

# 2. Relanzar ngrok
ngrok http 54321

# 3. Actualizar apps/mobile/.env.local con nueva URL

# 4. Limpiar y reiniciar app
cd apps/mobile
rm -rf node_modules/.cache
npx expo start --clear
```

### "Metro bundler failed to start"
```bash
cd apps/mobile
npx expo start --clear
```

### "Cannot find module '@brickshare/shared'"
```bash
# Verificar que las dependencias del monorepo están instaladas
cd /path/to/brickshare-logistics
npm install
```

### iOS: "No signing certificate" 
No necesitas certificado para el simulador. Para dispositivo físico:
1. Abre el proyecto en Xcode: `open apps/mobile/ios/mobile.xcworkspace`
2. Selecciona tu equipo en Signing & Capabilities
3. Usa tu Apple ID personal (gratuito, limitado a 3 apps)

### Android: "SDK location not found"
```bash
# Verificar ANDROID_HOME
echo $ANDROID_HOME
# Debe apuntar a: /Users/TU_USUARIO/Library/Android/sdk
```

### "Native module not found" (react-native-thermal-receipt-printer)
Esta librería requiere un build nativo, no funciona con Expo Go:
```bash
cd apps/mobile
npm run prebuild:clean
npm run ios  # o npm run android
```

### Limpiar completamente y empezar de nuevo
```bash
cd apps/mobile
npm run clean
cd ../..
npm install
cd apps/mobile
npm run prebuild:clean
```

---

## Flujo de Trabajo Recomendado

### Desarrollo diario
1. `cd apps/mobile && npm run ios` (primera vez)
2. `npm run start:dev-client` (siguientes veces, más rápido)
3. Editar código → Hot reload automático

### Testing en dispositivos
1. Generar APK: `npm run build:android:apk`
2. Compartir APK con testers
3. Para iOS: usar simulador o dispositivo conectado por cable

### Antes de producción
1. Crear cuentas de desarrollador (Apple: $99/año, Google: $25 único)
2. Configurar `eas.json > submit` con credenciales
3. `npm run build:ios:prod` y `npm run build:android:prod`
4. Subir a stores con `eas submit`