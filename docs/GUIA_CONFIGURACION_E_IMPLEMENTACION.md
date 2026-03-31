# 🚀 Guía de Configuración e Implementación - Brickshare Mobile

**Fecha**: 29/03/2026  
**Versión**: 1.0.0  
**Audiencia**: Desarrolladores, DevOps, Administradores

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Setup Inicial del Proyecto](#setup-inicial-del-proyecto)
3. [Configuración de Bases de Datos](#configuración-de-bases-de-datos)
4. [Configuración de Edge Functions](#configuración-de-edge-functions)
5. [Configuración de la App Móvil](#configuración-de-la-app-móvil)
6. [Variables de Entorno](#variables-de-entorno)
7. [Compilación y Builds](#compilación-y-builds)
8. [Deployment](#deployment)
9. [Verificación y Testing](#verificación-y-testing)
10. [Checklist de Go-Live](#checklist-de-go-live)

---

## 📋 Requisitos Previos

### Software Necesario

```bash
# Node.js y npm
node --version     # >= 20.0.0
npm --version      # >= 9.0.0

# Expo CLI (opcional, incluido en npx)
npm install -g expo-cli

# EAS CLI (para builds en nube)
npm install -g eas-cli

# Supabase CLI (para Edge Functions)
npm install -g supabase

# Android SDK (para Android)
# Descargar desde: https://developer.android.com/studio
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools

# Java 17 (para Android)
brew install openjdk@17

# Xcode (solo macOS, para iOS)
# Descargar desde App Store
xcode-select --install
```

### Cuentas Necesarias

- ✅ **Supabase** (DB1 local + DB2 Brickshare)
  - Crear proyecto en https://app.supabase.com
  - Obtener URL y API keys

- ✅ **Expo** (para builds en EAS)
  - Crear cuenta en https://expo.dev
  - Generar token: `npx expo whoami`

- ✅ **GitHub** (opcional, para CI/CD)
  - Repositorio privado recomendado

### Variables de Acceso

```bash
# Tokens personales necesarios
SUPABASE_ACCESS_TOKEN="sbp_xxxxx..."      # De Supabase
EXPO_TOKEN="expy_xxxxx..."                # De Expo
GITHUB_TOKEN="ghp_xxxxx..." (opcional)    # De GitHub
```

---

## 🏗️ Setup Inicial del Proyecto

### Paso 1: Clonar y Dependencias

```bash
# Clonar repositorio
git clone https://github.com/EnriquePerez00/brickshare_logistics.git
cd brickshare_logistics

# Instalar dependencias del monorepo
npm install

# Verificar que todo está en orden
npm run dev:mobile --dry-run
```

### Paso 2: Estructura de Directorios

```bash
# Crear directorios necesarios para configuración
mkdir -p apps/mobile/.env.local
mkdir -p supabase/config

# Verificar estructura
tree -L 2 -I 'node_modules'
```

### Paso 3: Inicialización de Git (si es nuevo proyecto)

```bash
git init
git add .
git commit -m "Initial commit: Brickshare Mobile setup"
git remote add origin https://github.com/user/brickshare_logistics.git
git push -u origin main
```

---

## 🗄️ Configuración de Bases de Datos

### DB1: Creación y Configuración (Local - El Puente)

#### 1. Crear Proyecto en Supabase

```bash
# Opción A: Via Supabase Dashboard
# 1. Ir a https://app.supabase.com
# 2. Click "New Project"
# 3. Nombre: "brickshare-local"
# 4. Región: Europa (Madrid o Irlanda recomendado)
# 5. Contraseña fuerte
# 6. Esperar ~3-5 minutos

# Opción B: Via CLI (si está disponible)
supabase projects create --name "brickshare-local"
```

#### 2. Obtener Credenciales DB1

```bash
# En Supabase Dashboard DB1:
# Settings → API
SUPABASE_URL_DB1="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY_DB1="eyJhbGc..."
SUPABASE_SERVICE_ROLE_KEY_DB1="eyJhbGc..."

# Guardar localmente (NO en git)
cat > .env.local.db1 << EOF
SUPABASE_URL=$SUPABASE_URL_DB1
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_DB1
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY_DB1
EOF
```

#### 3. Crear Migraciones en DB1

```bash
# Aplicar migraciones existentes
export SUPABASE_ACCESS_TOKEN="tu_token"
cd supabase
supabase db push

# O crear manualmente desde SQL
# Dashboard → SQL Editor → New Query
# Copiar contenido de: supabase/migrations/*.sql
```

#### 4. Crear Tablas Principales

```sql
-- En DB1, ejecutar:

-- Tabla: packages (paquetes recibidos en PUDO)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code TEXT UNIQUE NOT NULL,
  location_id UUID NOT NULL,
  remote_shipment_id UUID,
  status TEXT DEFAULT 'in_location',
  remote_shipment_data JSONB,
  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla: pudo_scan_logs (auditoría)
CREATE TABLE pudo_scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pudo_location_id UUID NOT NULL,
  remote_shipment_id TEXT,
  scanned_by_user_id UUID,
  scan_latitude FLOAT,
  scan_longitude FLOAT,
  gps_accuracy_meters FLOAT,
  gps_validation_passed BOOLEAN DEFAULT FALSE,
  api_request_successful BOOLEAN DEFAULT FALSE,
  api_response_code INT,
  api_response_message TEXT,
  api_request_duration_ms INT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Crear índices
CREATE INDEX idx_packages_tracking ON packages(tracking_code);
CREATE INDEX idx_pudo_logs_timestamp ON pudo_scan_logs(timestamp DESC);
```

---

### DB2: Configuración (Remota - Brickshare)

#### 1. Obtener Credenciales Brickshare

```bash
# En Supabase Dashboard Brickshare (DB2):
# Settings → API
REMOTE_DB_URL="https://qumjzvhtotcvnzpjgjkl.supabase.co"
REMOTE_DB_ANON_KEY="eyJhbGc..."
REMOTE_DB_SERVICE_ROLE_KEY="eyJhbGc..."

# Guardar localmente
cat > .env.local.db2 << EOF
REMOTE_DB_URL=$REMOTE_DB_URL
REMOTE_DB_SERVICE_ROLE_KEY=$REMOTE_DB_SERVICE_ROLE_KEY
EOF
```

#### 2. Verificar Tablas en DB2

```bash
# Conectar a DB2 y verificar tablas existentes:
psql -h qumjzvhtotcvnzpjgjkl.db.supabase.co -U postgres -d postgres

# Listar tablas importantes:
\dt users
\dt locations
\dt shipments

# Salir
\q
```

#### 3. Crear Vista o Función si Falta

```sql
-- En DB2, si shipments no tiene índice en tracking_number:
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_package_id ON shipments(brickshare_package_id);

-- Crear rol para Edge Function si falta:
CREATE ROLE edge_function WITH LOGIN PASSWORD 'securepassword123!';
GRANT SELECT ON shipments, users, locations TO edge_function;
GRANT UPDATE ON shipments TO edge_function;
```

---

## ⚙️ Configuración de Edge Functions

### Paso 1: Desplegar Edge Function en DB1

```bash
# Autenticarse con Supabase
export SUPABASE_ACCESS_TOKEN="tu_token_de_db1"

# Configurar variables de entorno de la función
supabase secrets set REMOTE_DB_URL="https://qumjzvhtotcvnzpjgjkl.supabase.co"
supabase secrets set REMOTE_DB_SERVICE_KEY="eyJhbGc..."
supabase secrets set BRICKSHARE_API_URL="https://qumjzvhtotcvnzpjgjkl.supabase.co" (opcional)

# Verificar que se configuraron correctamente
supabase secrets list
```

### Paso 2: Desplegar la Función

```bash
# Desplegar function existente
supabase functions deploy process-pudo-scan

# Salida esperada:
# Deploying function 'process-pudo-scan'...
# Deployed successfully with ID: xxxxx-xxxxx-xxxxx-xxxxx
# Function endpoint: https://xxxxx.supabase.co/functions/v1/process-pudo-scan
```

### Paso 3: Verificar Deployments

```bash
# Listar funciones desplegadas
supabase functions list

# Ver logs de la función
supabase functions logs process-pudo-scan

# Test de la función
curl -X POST https://xxxxx.supabase.co/functions/v1/process-pudo-scan \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scanned_code": "TEST-123",
    "gps_latitude": 40.4168,
    "gps_longitude": -3.7038
  }'
```

### Paso 4: Configurar Permisos RLS (Row Level Security)

```sql
-- En DB1, habilitar RLS en tablas sensibles:

-- Tabla packages
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access" ON packages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tabla pudo_scan_logs
ALTER TABLE pudo_scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access" ON pudo_scan_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

## 📱 Configuración de la App Móvil

### Paso 1: Configurar .env.local

```bash
# apps/mobile/.env.local

# ========== DB1 (Local - Donde está la Edge Function) ==========
# URL del servidor local (donde desplegaste la Edge Function)
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ========== DB2 (Brickshare - Producción) ==========
# URL de Brickshare (donde está el master data)
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Paso 2: Configurar app.json

```json
{
  "expo": {
    "name": "PudoBrickshare",
    "slug": "pudo-brickshare",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "scheme": "pudobrickshare",
    "owner": "tu_username_expo",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "ios": {
      "supportsTabletMode": true,
      "infoPlist": {
        "NSCameraUsageDescription": "Necesitamos acceso a la cámara para escanear códigos de barras",
        "NSLocationWhenInUseUsageDescription": "Necesitamos tu ubicación para validar entregas en el PUDO",
        "NSBluetoothAlwaysUsageDescription": "Necesitamos Bluetooth para conectar con la impresora térmica"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundColor": "#09090b"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_SCAN"
      ]
    }
  }
}
```

### Paso 3: Configurar eas.json

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true,
        "buildConfiguration": "Debug"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true,
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "tu_apple_id@email.com",
        "appleTeamId": "ABC123XYZ",
        "askToLogin": true,
        "appleAppSpecificPassword": "xxxx-xxxx-xxxx-xxxx"
      },
      "android": {
        "serviceAccount": "./android-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## 🔑 Variables de Entorno

### Archivo: `apps/mobile/.env.local`

```bash
# ===== PRODUCCIÓN (DB2 - Brickshare) =====
# Este es el servidor remoto con los datos maestros
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzAwMDAwMDAsImV4cCI6MTcwMDAwMDAwfQ.XXXXX

# ===== LOCAL (DB1 - El Puente) =====
# Este es el servidor local donde se despliegan las Edge Functions
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZWphcWtuYm5xdWF0YWV5bHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzAwMDAwMDAsImV4cCI6MTcwMDAwMDAwfQ.YYYYY

# ===== DESARROLLO (Opcional) =====
# Usar para testing locales
DEBUG_MODE=true
LOG_LEVEL=debug
```

### Validación de Variables

```bash
# Verificar que las variables están correctas
cat apps/mobile/.env.local

# Verificar que la app puede leerlas
npm run dev:mobile -- --inspect

# Buscar en logs:
# "[Supabase] Initialized with URL: https://..."
```

---

## 🔨 Compilación y Builds

### Desarrollo Local

```bash
# Opción 1: Expo Go (rápido, limitaciones)
cd apps/mobile
npm run start:go

# Escanear QR con Expo Go app (iOS/Android)

# Opción 2: Development Build (funcionalidad completa)
npm run ios                    # Compilar para iOS
npm run android                # Compilar para Android

# Opción 3: Dev Client (recomendado para desarrollo continuo)
npm run start:dev-client

# Luego ejecutar en el dispositivo que ya tiene dev client instalado
```

### Build para Testing

```bash
# Android APK (para testers)
npm run build:android:apk

# iOS Preview (para testers con Mac)
npm run build:ios:preview

# Ambas plataformas
npm run build:all:preview
```

### Build para Producción

```bash
# Aumentar versión en app.json
# "version": "1.0.1"

# iOS Production
npm run build:ios:prod

# Android Production (AAB para Play Store)
npm run build:android:prod

# Ambas
npm run build:all:prod
```

---

## 📦 Deployment

### Paso 1: Crear Cuentas de Desarrollador

#### iOS (Apple Developer)
```bash
# 1. Ir a https://developer.apple.com
# 2. Registrar cuenta ($99/año)
# 3. Crear App ID en Certificates, Identifiers & Profiles
# 4. Descargar certificados
# 5. Guardar en eas.json
```

#### Android (Google Play)
```bash
# 1. Ir a https://play.google.com/console
# 2. Registrar cuenta ($25 única)
# 3. Crear aplicación
# 4. Descargar Google Cloud Service Account JSON
# 5. Guardar en android-service-account.json
```

### Paso 2: Configurar Credentials

```bash
# Para iOS
eas credentials configure --platform ios

# Para Android
eas credentials configure --platform android

# Verificar
eas credentials list
```

### Paso 3: Submitter a Stores

```bash
# Submitter iOS a App Store
eas submit --platform ios --profile production

# Submitter Android a Play Store
eas submit --platform android --profile production
```

---

## ✅ Verificación y Testing

### Test de Autenticación

```bash
# 1. Abrir app
# 2. Ir a LoginScreen
# 3. Ingresar credenciales de DB2 (Brickshare)
# 4. Verificar que se autentica correctamente
# 5. Ver logs: "✅ Authenticated successfully"
```

### Test de Escaneo

```bash
# 1. En ScannerScreen, modo "Recepción"
# 2. Usar modo de simulación: "⌨️ Código Manual"
# 3. Ingresar código: "BS-DEL-7A2D335C-8FA" (o válido en DB2)
# 4. Verificar:
#    ├─ GPS se obtiene
#    ├─ Edge Function responde
#    ├─ Package se crea en DB1
#    ├─ Shipment se actualiza en DB2
#    └─ Confirmación muestra datos correctos
```

### Test de GPS

```bash
# 1. En ScannerScreen, ver indicador GPS
# 2. Verificar que muestra: "🟢 GPS: 40.4168, -3.7038 (10m)"
# 3. Escanear código
# 4. Verificar que GPS se usó en validación
```

### Test de Logs

```bash
# 1. En ScannerScreen (modo dev), scrollear abajo
# 2. Ver "📊 Logs" panel
# 3. Realizar scan
# 4. Verificar que aparecen logs:
#    ├─ ScannerScreen initializing...
#    ├─ GPS location updated (warm)
#    ├─ Process Dropoff starting...
#    └─ Scan successful
```

### Checklist de Verificación

```
Autenticación:
  ☐ Login con email/password funciona
  ☐ JWT se obtiene correctamente
  ☐ Logout cierra sesión

GPS:
  ☐ GPS "caliente" funciona
  ☐ Coordenadas son precisas
  ☐ Accuracy < 50 metros

Escaneo:
  ☐ Barcode se detecta
  ☐ QR se detecta
  ☐ Manual input funciona

Edge Function:
  ☐ Responde en < 500ms
  ☐ Crea package en DB1
  ☐ Actualiza shipment en DB2
  ☐ Registra log de auditoría

UI/UX:
  ☐ Tema oscuro correcto
  ☐ Loading states visible
  ☐ Errores mostrados claramente
  ☐ Safe area handling

Performance:
  ☐ No freezes en escaneo
  ☐ Memoria estable
  ☐ Battery consumption aceptable
```

---

## 🚀 Checklist de Go-Live

### 1 Semana Antes

- [ ] Verificar todas las credenciales están correctas
- [ ] Hacer build final en ambas plataformas
- [ ] Ejecutar suite completa de tests
- [ ] Revisar documentación de usuario
- [ ] Comunicar a testers fecha de release

### Día Anterior

- [ ] Backup de DB1 y DB2
- [ ] Verificar Edge Function status
- [ ] Confirmar app builds están listos
- [ ] Crear release notes

### Día de Go-Live

**Mañana (before release)**:
```bash
# 1. Hacer build final
npm run build:all:prod

# 2. Verificar que builds son correctos
eas build:list --limit 5

# 3. Hacer deploy de Edge Function si hay cambios
supabase functions deploy process-pudo-scan
```

**Tarde (release)**:
```bash
# 1. Submitter apps a stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# 2. Esperar aprobación de stores (~24h para iOS, ~2h para Android)

# 3. Notificar a usuarios que versión está disponible
```

**Post-Release**:
- [ ] Monitorear logs de error
- [ ] Responder a feedback de usuarios
- [ ] Preparar hotfix si es necesario
- [ ] Celebrar 🎉

---

## 📊 Monitoreo Post-Deployment

### Logs en Supabase

```bash
# Ver logs de Edge Function en vivo
supabase functions logs process-pudo-scan --follow

# Buscar errores específicos
supabase functions logs process-pudo-scan | grep ERROR
```

### Métricas en DB1

```sql
-- Ver últimos scans
SELECT * FROM pudo_scan_logs ORDER BY timestamp DESC LIMIT 10;

-- Contar scans por día
SELECT DATE(timestamp) as date, COUNT(*) as count
FROM pudo_scan_logs
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Scans fallidos
SELECT * FROM pudo_scan_logs
WHERE api_request_successful = false
ORDER BY timestamp DESC;
```

### Alertas Recomendadas

```sql
-- En DB1, crear tabla de alertas
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Alert: Muchos errores en últimos 10 minutos
INSERT INTO system_alerts (alert_type, severity, message)
SELECT 
  'HIGH_ERROR_RATE',
  'WARNING',
  CONCAT('High error rate: ', COUNT(*), ' failures in last 10 minutes')
FROM pudo_scan_logs
WHERE api_request_successful = false
AND timestamp > NOW() - INTERVAL '10 minutes'
HAVING COUNT(*) > 5;
```

---

## 🔧 Troubleshooting Común

### Error: "Missing SUPABASE_URL"

```bash
# Verificar .env.local existe
ls -la apps/mobile/.env.local

# Verificar contenido
cat apps/mobile/.env.local | grep EXPO_PUBLIC_SUPABASE_URL

# Si falta, crear:
echo "EXPO_PUBLIC_SUPABASE_URL=https://..." >> apps/mobile/.env.local
```

### Error: "401 Unauthorized"

```bash
# 1. Verificar que DB2 keys son correctos
supabase status --project-ref qumjzvhtotcvnzpjgjkl

# 2. Regenerar keys si necesario
# Dashboard → Settings → API → Regenerate

# 3. Verificar usuario existe
SELECT * FROM users WHERE email = 'test@example.com';
```

### Error: "Connection refused"

```bash
# 1. Verificar que Edge Function está deployed
supabase functions list

# 2. Test endpoint directamente
curl https://xxxxx.supabase.co/functions/v1/process-pudo-scan

# 3. Ver logs
supabase functions logs process-pudo-scan
```

---

**Documento generado**: 29/03/2026  
**Versión**: 1.0.0  
**Última actualización**: 29/03/2026