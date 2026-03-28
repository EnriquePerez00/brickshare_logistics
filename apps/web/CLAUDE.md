# BRICKSHARE LOGISTICS — Documentación Técnica Completa

## 📋 Resumen Ejecutivo

**Brickshare Logistics** es una plataforma de gestión de paquetería para puntos de conveniencia (PuDo). Permite que propietarios de locales comerciales reciban y entreguen paquetes mediante escaneo de códigos de barras y QR dinámicos. Se integra con **Brickshare** (plataforma de alquiler de sets LEGO) y otros sistemas externos.

**Ecosistema**:
- 🎯 **Brickshare Logistics** (Este repositorio): Gestión de envíos y puntos PuDo
- 📦 **Brickshare** (`/Code_personal/brickshare`): Plataforma principal de alquiler LEGO
- 🔗 **Integración**: Communication API-based entre sistemas via Supabase Edge Functions

**Arquitectura**: Monorepo con Turbo.js
- **Mobile**: Expo/React Native (escaneo de paquetes en PuDo)
- **Web**: Next.js (dashboard admin, gestión logística)
- **Backend**: Supabase (PostgreSQL + Edge Functions con Deno)

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Mobile | Expo + React Native | 55.0.8 / 19.2.0 |
| Web | Next.js | Latest |
| Database | PostgreSQL (Supabase) | 14+ |
| Autenticación | Supabase Auth | JWT |
| Edge Functions | Deno | 1.x |
| Monorepo | Turbo.js | 2.3.3 |
| Cámara | expo-camera | 55.0.10 |
| Escaneo | expo-barcode-scanner | 13.0.1 |

### 🍎 Contexto para iOS

**Framework**: SwiftUI (principal) / UIKit (legacy)

**Tooling**: Usamos `xcodebuild` para tests

**Runtime**: iOS 26.3 (instalado en este entorno)

**Documentación**: Prioriza siempre la documentación de la SDK de iOS 19+ (o la actual)

**Simulador**: El destino por defecto es "iPhone 17 Pro" (UUID: `F319ADAF-E4FD-4B8B-BA5A-1E793973DB15`)

**Simuladores Disponibles**:
- iPhone 17 Pro (x3 instancias para testing)
- iPhone 17 Pro Max
- iPhone Air
- iPhone 17
- iPhone 16e

### Estructura de Directorios

```
Brickshare_logistics/
├── apps/
│   ├── mobile/              # Aplicación móvil (Expo)
│   │   ├── src/
│   │   │   ├── screens/    # LoginScreen, ScannerScreen, PrinterSetupScreen
│   │   │   └── components/
│   │   ├── App.tsx         # Navegación principal
│   │   └── package.json
│   │
│   └── web/                # Aplicación web (Next.js)
│       ├── app/
│       │   ├── auth/       # Login page
│       │   ├── dashboard/  # Dashboard
│       │   ├── admin/      # Panel administrativo
│       │   └── api/        # API routes
│       ├── components/     # Componentes reutilizables
│       └── package.json
│
├── packages/
│   └── shared/             # Código compartido
│       ├── src/
│       │   ├── supabase.ts # Cliente Supabase
│       │   └── database.types.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/         # Migraciones SQL
│   │   ├── 001_schema.sql
│   │   ├── 002_fix_profile_rls.sql
│   │   └── ...
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── generate-dynamic-qr/
│   │   ├── verify-package-qr/
│   │   └── generate-static-return-qr/
│   └── config.toml
│
└── docs/                   # Documentación adicional
```

---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### 1. **users** (extiende auth.users)
```sql
- id (UUID, PK) → auth.users
- role (TEXT) → 'admin' | 'owner' | 'customer'
- first_name, last_name (TEXT)
- email, phone (TEXT)
- address, postal_code, city (TEXT)
- created_at (TIMESTAMPTZ)
```
**RLS**: Usuarios ven su propio perfil. Admins acceso total.

#### 2. **locations** (Puntos de conveniencia / PuDo)
```sql
- id (UUID, PK)
- pudo_id (TEXT, UNIQUE) → ID único en formato 'brickshare-XXX' (auto-generado)
- owner_id (UUID, FK → users)
- name (TEXT) → Nombre del establecimiento
- location_name (TEXT) → Nombre descriptivo
- address (TEXT)
- postal_code (TEXT)
- city (TEXT)
- latitude (NUMERIC) → Coordenadas GPS
- longitude (NUMERIC)
- gps_validation_radius_meters (INTEGER) → Radio de validación (defecto: 50m)
- commission_rate (NUMERIC) → Comisión por paquete en EUR
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```
**Índices**: pudo_id (UNIQUE), owner_id
**RLS**: Owners ven solo sus locales. Admins acceso total.

#### 3. **packages** (Paquetes - Envíos y Devoluciones)
```sql
- id (UUID, PK)
- tracking_code (TEXT, UNIQUE) → Código de barras del courier
- type (TEXT) → 'delivery' | 'return' (tipo de operación)
- status (ENUM) → 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
- location_id (UUID, FK → locations)
- customer_id (UUID, FK → users, nullable)
- dynamic_qr_hash (TEXT) → JWT del QR dinámico (expiración: 5 min)
- static_qr_hash (TEXT) → JWT del QR estático para devoluciones (sin expiración temporal)
- qr_expires_at (TIMESTAMPTZ) → Expiración del QR dinámico
- external_shipment_id (TEXT) → ID shipment en sistema externo (Brickshare)
- source_system (TEXT) → 'logistics' | 'brickshare' (origen del paquete)
- created_at, updated_at (TIMESTAMPTZ)
```

**Estados por tipo**:
- **delivery**: pending_dropoff → in_location → picked_up
- **return**: pending_dropoff → in_location → returned

**RLS**: 
- Owners ven paquetes de sus locales
- Customers ven solo sus paquetes
- Service role puede crear packages externos
- Admins acceso total

**Índices**: tracking_code, status, location_id, type, source_system, external_shipment_id

#### 4. **pudo_scan_logs** (Auditoría de Escaneos)
```sql
- id (UUID, PK)
- pudo_location_id (UUID, FK → locations)
- remote_shipment_id (TEXT) → ID envío en sistema remoto
- previous_status (TEXT)
- new_status (TEXT)
- scanned_by_user_id (UUID, FK → users)
- action_type (ENUM) → 'delivery_confirmation' | 'return_confirmation'
- scan_timestamp (TIMESTAMPTZ)
- scan_latitude, scan_longitude (NUMERIC) → Coordenadas del escaneo
- gps_accuracy_meters (NUMERIC)
- gps_validation_passed (BOOLEAN)
- api_request_successful (BOOLEAN)
- api_response_code (INTEGER)
- api_response_message (TEXT)
- api_request_duration_ms (INTEGER)
- device_info (TEXT) → Ej: "iOS 17.1 / iPhone 14 Pro"
- app_version (TEXT)
- metadata (JSONB) → Datos adicionales
- created_at (TIMESTAMPTZ)
```

**Propósito**: Registro completo de operaciones PuDo para auditoría y debugging.

#### 5. **monthly_profitability** (Vista calculada)
```sql
- month (YYYY-MM)
- location_id, location_name, owner_id
- commission_rate
- total_packages, active_packages, dropoffs, pickups
- profitability (suma de comisiones)
```
**Propósito**: Pre-calcula métricas para dashboard.

#### 6. **external_packages** (Vista para Integración)
```sql
- id, tracking_code, status, type, location_id, location_name, location_address
- customer_id, dynamic_qr_hash, static_qr_hash, qr_expires_at
- external_shipment_id, source_system, created_at, updated_at
```
**Propósito**: Vistas filtradas de packages creados desde sistemas externos.

### Triggers y Funciones

- **handle_new_user()**: Crea automáticamente perfil en `public.users` cuando se registra en `auth.users`
- **touch_updated_at()**: Actualiza `updated_at` automáticamente en cambios
- **generate_pudo_id()**: Genera automáticamente `pudo_id` en formato 'brickshare-XXX' para nuevas locations
- **check_package_state_transition()**: Valida transiciones de estado legales según tipo de package
- **log_pudo_scan()**: RPC que registra operaciones de escaneo en pudo_scan_logs

### Funciones RPC Principales

```sql
public.validate_package_state_transition(
  p_current_status, p_new_status, p_type
) → BOOLEAN
-- Valida si la transición de estado es legal según el tipo de paquete

public.create_external_package(
  p_tracking_code, p_type, p_location_id, p_customer_id, 
  p_external_shipment_id, p_source_system
) → JSON
-- Crea un paquete desde un sistema externo (Brickshare, etc.)
-- Respuesta: { success, package_id, tracking_code, type, status, created_at }
```

---

## 🔐 Seguridad y RLS (Row Level Security)

### Políticas Implementadas

**users table:**
- `users_select_own`: Usuario ve su perfil o admin ve todos
- `users_update_own`: Usuario solo actualiza su propio perfil
- `users_admin_all`: Admin acceso total

**locations table:**
- `locations_owner_select`: Owner ve sus locales
- `locations_owner_insert/update`: Owner gestiona sus locales
- `locations_admin_delete`: Solo admin puede borrar

**packages table:**
- `packages_owner_select`: Owner ve paquetes de sus locales
- `packages_owner_insert/update`: Owner gestiona paquetes de sus locales
- `packages_customer_select`: Customer ve solo sus paquetes
- `packages_admin_all`: Admin acceso total

### Función Helper

```sql
public.my_role() → Obtiene el role del usuario autenticado
```

---

## ⚙️ Edge Functions (Deno)

### 1. `generate-dynamic-qr`

**Propósito**: Genera un JWT firmado (QR dinámico) que el cliente muestra para recoger su paquete en el PuDo.

```
POST /functions/v1/generate-dynamic-qr
Authorization: Bearer <CUSTOMER_JWT>
Body: { "package_id": "uuid" }
```

**Lógica**:
1. Autentica al customer
2. Verifica que el paquete está en `in_location`
3. Genera JWT con HMAC-SHA256 (expira en 5 minutos)
4. Guarda el hash en `packages.dynamic_qr_hash`
5. Devuelve el QR y su fecha de expiración

**Respuesta**:
```json
{
  "qr_hash": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_at": "2026-03-23T16:59:59Z",
  "package_id": "uuid",
  "location_id": "uuid"
}
```

### 2. `verify-package-qr`

**Propósito**: Owner escanea QR del cliente. Verifica firma, expiración y actualiza estado.

```
POST /functions/v1/verify-package-qr
Authorization: Bearer <OWNER_JWT>
Body: { "qr_hash": "eyJ..." }
```

**Lógica**:
1. Autentica al owner
2. Verifica firma del JWT con la secret compartida
3. Valida que no ha expirado (5 min)
4. Verifica que el local del QR pertenece al owner
5. Actualiza `packages.status` de `in_location` → `picked_up`
6. Limpia `dynamic_qr_hash` y `qr_expires_at`
7. Devuelve confirmación para impresión de recibo

**Respuesta**:
```json
{
  "success": true,
  "tracking_code": "TRK123456",
  "new_status": "picked_up",
  "event_type": "delivery_completed",
  "timestamp": "2026-03-23T16:54:30Z"
}
```

### 3. `generate-static-return-qr`

**Propósito**: Genera QR estático para devoluciones (similar a dinámico pero no expira).

**Respuesta**:
```json
{
  "qr_hash": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "package_id": "uuid",
  "location_id": "uuid",
  "type": "return",
  "expires": null
}
```

### 4. `update-remote-shipment-status` ⭐ (NUEVA - Integración Brickshare)

**Propósito**: Operador PuDo escanea QR de cliente (entrega o devolución). Comunica actualización de estado al sistema remoto (Brickshare).

```
POST /functions/v1/update-remote-shipment-status
Authorization: Bearer <OWNER_JWT>
Body: {
  "shipment_id": "shipment-uuid-brickshare",
  "qr_data": "jwt-qr-escaneado",
  "gps_latitude": 41.3851,
  "gps_longitude": 2.1734,
  "gps_accuracy": 10.5
}
```

**Flujo Completo**:
1. Operador escanea QR en modo "Entrega (QR)" de ScannerScreen
2. App captura ubicación GPS actual
3. Edge Function recibe JWT y coordenadas
4. Valida:
   - JWT válido y no expirado
   - Operador es "owner" del PuDo
   - GPS está dentro del radio permitido (50m por defecto)
5. **Comunica con Brickshare** vía API HTTP:
   ```
   POST https://brickshare.com/api/shipments/{shipment_id}/status
   {
     "new_status": "delivered_pudo" | "in_return",
     "pudo_location": { id, name },
     "gps_validation": { passed, message },
     "timestamp": ISO8601
   }
   ```
6. Registra operación en `pudo_scan_logs` para auditoría
7. Devuelve confirmación al operador

**Respuesta Exitosa**:
```json
{
  "success": true,
  "shipment_id": "shipment-uuid",
  "previous_status": "in_transit_pudo",
  "new_status": "delivered_pudo",
  "action_type": "delivery_confirmation",
  "pudo_location": {
    "id": "location-uuid",
    "name": "casa - test"
  },
  "gps_validation": {
    "passed": true,
    "message": "GPS validation passed: distance 15m within radius 50m"
  },
  "timestamp": "2026-03-27T17:30:00Z",
  "duration_ms": 234
}
```

**Códigos de Error**:
- `401` — Missing Authorization header
- `403` — Only PUDO operators can update shipment status
- `403` — GPS validation failed
- `404` — PUDO location not found
- `404` — Shipment not found in remote database
- `409` — Invalid status for PUDO operation
- `500` — Failed to update shipment status (error remoto)

---

## 📱 Aplicación Móvil (Expo/React Native)

### Flujos Principales

#### 1. **Login Screen** (`LoginScreen.tsx`)
- Email + Password
- Autenticación con Supabase
- Recuperación de contraseña (modal)
- Roles: `owner` accede a Scanner

#### 2. **Scanner Screen** (`ScannerScreen.tsx`) ⭐ PUNTO CRÍTICO
**Dos modos de operación que mapean a Brickshare**:

**A) Modo Recepción (Dropoff)** — Almacén → PuDo
- Escanea códigos de barras del courier (etiquetas de envío)
- Lee formatos: EAN-13, EAN-8, Code128, Code39, UPC-A, UPC-E
- Flujo:
  1. Operador lee tracking_code del código de barras de la etiqueta
  2. App inserta en tabla `packages` con:
     - `type = 'delivery'`
     - `status = 'in_location'` (paquete recibido en el PuDo)
     - `tracking_code = [código escaneado]`
  3. Si es de Brickshare, captura `external_shipment_id` del paquete
  4. Muestra confirmación: "Recepcionado ✅"
  5. Prepara para impresión de recibo

**B) Modo Entrega (Pickup)** — PuDo → Cliente (INTEGRACIÓN CON BRICKSHARE)
- Escanea QR dinámico mostrado en pantalla del cliente
- Lee formato: QR Code (JWT)
- Flujo:
  1. Cliente llega al PuDo y muestra QR en su móvil (del email de Brickshare)
  2. Operador escanea el QR con app
  3. App obtiene ubicación GPS actual del operador
  4. Llama Edge Function `update-remote-shipment-status` con:
     - `shipment_id` (extraído del JWT del QR)
     - `qr_data` (el JWT completo)
     - `gps_latitude, gps_longitude, gps_accuracy`
  5. Edge Function:
     - ✅ Valida GPS (≤ 50m del punto PuDo)
     - ✅ Verifica que operador es owner del PuDo
     - ✅ **COMUNICA CON BRICKSHARE** para actualizar estado remoto
     - ✅ Registra operación en `pudo_scan_logs`
  6. Muestra confirmación: "✅ Entrega confirmada"
  7. Estado se actualiza en Brickshare: `in_transit_pudo` → `delivered_pudo`

#### 3. **Printer Setup Screen** (`PrinterSetupScreen.tsx`)
- Configuración de impresora térmica
- Permite ajustar parámetros (ancho, temperatura)

### Permisos Requeridos

- `expo-camera`: Acceso a cámara
- `expo-barcode-scanner`: Lectura de códigos
- `expo-location`: GPS para validación del punto PuDo

### Navegación

```
Login → Scanner (Modo Recepción / Modo Entrega) ⟷ PrinterSetup
```

### Características de Integración con Brickshare

- ✅ Captura automática de `external_shipment_id` de QR
- ✅ Validación GPS para confirmar que operador está en el local
- ✅ Comunicación automática con Brickshare al escanear entrega
- ✅ Logs completos de todas las operaciones para auditoría
- ✅ Manejo robusto de errores (timeouts, GPS inválido, etc.)

---

## 🌐 Aplicación Web (Next.js)

### Rutas Principales

- `/auth` → Login
- `/dashboard` → Dashboard del owner (métricas, histórico)
- `/admin` → Panel administrativo (tabla de envíos)
- `/api/packages/*` → Endpoints para gestión de paquetes
- `/api/locations/*` → Endpoints para gestión de locales
- `/api/pudo/*` → Endpoints específicos PuDo

### API Routes

**GET `/api/packages/by-shipment/[shipmentId]/status`**
- Obtiene estado de un envío
- Permite Brickshare consultar estado remoto
- RLS respeta propiedad del local

**GET `/api/packages/[id]/status`**
- Obtiene estado individual de paquete

**GET `/api/locations`**
- Lista locales del usuario autenticado
- Incluye información GPS y radio de validación

**GET `/api/pudo/active-packages`**
- Paquetes activos en un punto PuDo

**GET `/api/pudo/operations-history`**
- Historial de operaciones del PuDo

**GET `/api/pudo/export-history`**
- Exportar historial de operaciones

---

## 🔑 Variables de Entorno

### Requeridas en todos los apps

```env
# Web (apps/web/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Mobile (apps/mobile/.env.local)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### En Supabase (Edge Functions)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
QR_JWT_SECRET=your-secret-key-32-chars-minimum

# INTEGRACIÓN BRICKSHARE (Nuevo)
BRICKSHARE_API_URL=https://brickshare.com/api
BRICKSHARE_API_KEY=your-api-key-brickshare
BRICKSHARE_SERVICE_ROLE_KEY=service-role-key-brickshare
```

---

## 🚀 Comandos Principales

### Desarrollo

```bash
# Instalar dependencias del monorepo
npm install

# Iniciar todo en modo desarrollo
npm run dev

# O iniciar aplicaciones específicamente:
cd apps/mobile && npm start          # Expo dev server
cd apps/web && npm run dev           # Next.js dev server

# Sync database schema (si se han hecho cambios en Supabase)
npm run db:push

# Watchear cambios en migraciones y aplicarlos
npm run db:watch
```

### Build

```bash
# Build all apps
npm run build

# Build específico
cd apps/mobile && expo build
cd apps/web && npm run build
```

### Mobile (iOS - Specific)

```bash
# Iniciar Expo con iOS automáticamente (desde .vscode/tasks.json)
# Atajo: Cmd+Shift+I

# Limpiar caché de Metro y reiniciar
# Atajo: Cmd+Shift+R

# Ejecutar tests iOS con xcodebuild
npm run test:ios

# Tests con cobertura de código
npm run test:ios:coverage

# Build para Expo EAS (preview)
npm run build:ios

# Limpiar watchman y dependencias
npm run clean
```

### Linting y Formatting

```bash
npm run lint
npm run lint:fix
npm run type-check
```

---

## 📊 Flujo End-to-End Completo

### Escenario: Package Delivery (Entrega)

```
1. COURIER REGISTRA PAQUETE
   └─ Mobile App (Owner) → ScannerScreen (Recepción)
      ├─ Escanea código de barras
      ├─ Inserta en packages (status: in_location)
      └─ Imprime recibo

2. CLIENTE GENERA QR DINÁMICO
   └─ Web App o API → generate-dynamic-qr
      ├─ Customer autenticado solicita QR
      ├─ Sistema genera JWT (expira 5 min)
      ├─ Guarda en packages.dynamic_qr_hash
      └─ Cliente muestra QR en pantalla

3. OWNER VERIFICA ENTREGA
   └─ Mobile App (Owner) → ScannerScreen (Entrega)
      ├─ Escanea QR mostrado por cliente
      ├─ Llama verify-package-qr
      ├─ Backend valida firma + expiración
      ├─ Actualiza status: in_location → picked_up
      └─ Imprime confirmación

4. CONSULTA EN DASHBOARD
   └─ Web App (Owner) → Dashboard
      ├─ Lee monthly_profitability
      └─ Ve comisión calculada
```

---

## 🔍 Consideraciones Importantes

### Seguridad

1. **RLS Activo**: Todas las tablas principales tienen RLS habilitado
2. **JWT Secret**: Debe ser diferente a Supabase JWT (usa `QR_JWT_SECRET`)
3. **Edge Functions**: Solo service role puede actualizar packages
4. **Authorization Headers**: Toda llamada a Edge Functions requiere JWT válido

### Performance

1. **Vista Precalculada**: `monthly_profitability` evita cálculos en runtime
2. **Índices**: Definidos en tracking_code, status, location_id
3. **Triggers Automatizados**: `updated_at` se actualiza automáticamente

### Limitaciones Conocidas

1. **QR TTL**: 5 minutos para QR dinámicos (configurable en Edge Function)
2. **Thermal Printer**: Integración pending (`react-native-thermal-receipt-printer`)
3. **Permisos**: Requiere permiso de cámara en dispositivo

---

## 🛠️ Entorno VSCode Optimizado para iOS

### Estado Actual del Entorno

✅ **Dependencias Sincronizadas**:
- React: 19.2.4 (actualizado en raíz del monorepo)
- React DOM: 19.2.4
- React Native: 0.83.2

✅ **Simulador iOS**: F319ADAF-E4FD-4B8B-BA5A-1E793973DB15 (iPhone 17 Pro, iOS 26.3)

✅ **node_modules**: Limpios e instalados (1286 packages, 0 vulnerabilities)

### Configuración Instalada

**Archivos de configuración en `.vscode/`**:
- `settings.json` — Configuración global del editor (formateo, TypeScript, hot reload)
- `launch.json` — Configuraciones de debugging (iOS Simulator, Expo, Next.js)
- `tasks.json` — Tasks automatizadas (Expo start, Metro cache clear, tests iOS)
- `keybindings.json` — Atajos personalizados
- `react-native.code-snippets` — Snippets para componentes React Native

### Extensiones VSCode Recomendadas

1. **React Native Tools** (Microsoft) — Debugging y IntelliSense
2. **Expo Tools** — Autocompletado para Expo SDK
3. **ESLint** + **Prettier** — Linting y formateo
4. **Error Lens** — Errores inline
5. **React Developer Tools** — Debugging de componentes
6. **Console Ninja** — Logs enriquecidos en editor

### Atajos Teclado (Macbook)

| Atajo | Acción |
|-------|--------|
| `Cmd+Shift+I` | Expo Start + Open iOS (iPhone 17 Pro) |
| `Cmd+Shift+R` | Clear Metro Cache |
| `Cmd+Shift+T` | iOS Tests (xcodebuild) |
| `Cmd+Shift+W` | Watchman Watch-Delete-All |

### Logger Estructurado

Ubicación: `apps/mobile/src/utils/logger.ts`

```typescript
import { logger } from '@/utils/logger';

// Uso básico
logger.info('Iniciando operación', { operationId: '123' });
logger.success('Paquete escaneado', { trackingCode: 'ABC123' });
logger.error('Error en GPS', error, 'ScannerScreen');
logger.warn('GPS accuracy baja', { accuracy: 25 });

// Debugging condicional (solo en DEV)
logger.debug('Datos intermedios', { userId, locationId });

// Medir performance
await logger.measure('Scanning operation', async () => {
  // Código a medir
}, 'ScannerScreen');

// Exportar logs para auditoría
const allLogs = logger.exportLogs();
const recentErrors = logger.getLogsByLevel('error');
const last5MinLogs = logger.getRecentLogs(5);
```

**Características**:
- ✅ Logs con timestamps
- ✅ Niveles: info, error, success, warn, debug
- ✅ Contexto por operación
- ✅ Medición automática de performance
- ✅ Histórico en memoria (últimos 100 logs)
- ✅ Exportación JSON para debugging
- ✅ Solo debug activo en desarrollo

### Debugging en VSCode

**1. Debuggear App iOS en Simulator**:
```
1. Abrir VSCode Debugger (Cmd+Shift+D)
2. Seleccionar "Debug iOS Simulator (iPhone 17 Pro)"
3. Presionar F5 o hacer clic en play
4. Breakpoints aparecen en editor
```

**2. Debuggear Edge Functions**:
```
1. Seleccionar "Debug Next.js" en VSCode Debugger
2. F5 para iniciar
3. Usar console.log con logger.info()
4. Ver logs: supabase log tail --function-name <name>
```

**3. Inspeccionar Estado de Redux/Supabase**:
- Instalar React Native Debugger: `brew install --cask react-native-debugger`
- Abrir con app corriendo: Cmd+D en Expo → "Open Debugger"

---

## 🐛 Debugging y Troubleshooting

### Logs Útiles

```bash
# Logs de Supabase (Edge Functions)
supabase log tail --function-name update-remote-shipment-status
supabase log tail --function-name generate-dynamic-qr

# Logs de aplicación móvil (en terminal Expo)
expo start --clear

# Ver logs de ScannerScreen usando logger
# En código: logger.getRecentLogs(5) o logger.exportLogs()

# Ver logs de pudo_scan_logs en BD
SELECT * FROM public.pudo_scan_logs 
WHERE pudo_location_id = 'location-uuid'
  AND scan_timestamp > now() - INTERVAL '1 hour'
ORDER BY scan_timestamp DESC;

# Ver simuladores iOS disponibles
xcrun simctl list devices available | grep iPhone

# Iniciar simulador específico
xcrun simctl boot "F319ADAF-E4FD-4B8B-BA5A-1E793973DB15"

# Abrir Simulator en macOS
open -a Simulator
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `GPS validation failed` | Operador fuera del radio permitido | Acercarse más al punto PuDo (≤ 50m) |
| `Only PUDO operators can update shipment status` | Usuario no es owner del PuDo | Verificar rol del usuario (debe ser 'owner') |
| `QR code is invalid or has expired` | JWT expirado o firma inválida | Regenerar QR dinámico (válido 5 min) |
| `This package does not belong to your location` | RLS rechazando acceso | Verificar `location_id` del usuario |
| `Shipment not found in remote database` | Error conexión Brickshare | Verificar `BRICKSHARE_API_URL` y credenciales |
| `Missing Environment Variables` | `.env` incompleto | Revisar todas las vars de integración Brickshare |
| `Camera permission denied` | Permiso no otorgado | Solicitar nuevamente en app |
| `Invalid device or device pair` | Simulador iOS no existe | Ejecutar `xcrun simctl boot "F319ADAF-E4FD-4B8B-BA5A-1E793973DB15"` |
| `Invalid runtime: iOS18.0` | Runtime iOS no disponible | Usar runtime disponible: iOS 26.3 |
| `npm install ERESOLVE` | Conflicto de dependencias React | React debe ser 19.2.4 en raíz del monorepo |
| `watchman: command not found` | Watchman no instalado | Ejecutar `brew install watchman` (opcional pero recomendado) |

### Setup Inicial de Desarrollo iOS

**Primera vez que clonas el proyecto**:

```bash
# 1. Instalar dependencias del monorepo
cd ~/Code_personal/Brickshare_logistics
npm install

# 2. Iniciar simulador iOS
xcrun simctl boot "F319ADAF-E4FD-4B8B-BA5A-1E793973DB15"

# 3. Iniciar Expo
cd apps/mobile
npm start

# 4. Presionar 'i' en terminal para abrir en iOS
# O usar atajo VSCode: Cmd+Shift+I
```

**Si hay cambios en dependencias**:

```bash
# Desde la raíz
npm install

# Desde apps/mobile (si es necesario)
npm run clean  # Limpia node_modules y reinstala (sin watchman)
```

### Configuración del Simulador iOS

**Simulador por defecto**: iPhone 17 Pro (iOS 26.3)
**UUID**: F319ADAF-E4FD-4B8B-BA5A-1E793973DB15

**Para cambiar de simulador**:

```bash
# 1. Ver lista de simuladores
xcrun simctl list devices available

# 2. Iniciar el que desees
xcrun simctl boot "UUID-DEL-SIMULADOR"

# 3. Iniciar Expo
cd apps/mobile && npm start
```

**Alternativa visual**: 
```bash
# Abrir Xcode Simulator directamente
open -a Simulator

# En Simulator: File → Open Simulator → [Seleccionar iPhone]
```

### Sincronización de Dependencias React

**Importante**: En este monorepo, React debe estar sincronizado en todos los workspaces.

**Versión actual**: React 19.2.4

**Ubicaciones**:
- Raíz: `package.json` → `"react": "19.2.4"`
- Web: `apps/web/package.json` → `"react": "19.2.4"`
- Mobile: Puede usar versión diferente si es compatible con Expo

**Si hay conflictos ERESOLVE**:

```bash
# 1. Borrar todos los node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# 2. Reinstalar desde la raíz
npm install

# 3. Si aún hay error, verificar que React está sincronizado:
grep '"react"' package.json apps/*/package.json
```

### Validar Integración Brickshare

```bash
# 1. Verificar que Edge Function puede conectar
supabase log tail --function-name update-remote-shipment-status

# 2. Simular llamada (requiere BRICKSHARE_API_KEY)
curl -X POST http://localhost:54321/functions/v1/update-remote-shipment-status \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "test-shipment",
    "qr_data": "eyJ...",
    "gps_latitude": 41.3851,
    "gps_longitude": 2.1734,
    "gps_accuracy": 10.5
  }'

# 3. Ver logs de pudo_scan_logs
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT * FROM pudo_scan_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## 📝 Notas para Desarrolladores

### Arquitectura de Integración Brickshare

```
┌─────────────────────────────────────────────────────────────┐
│         BRICKSHARE (Sistema de Alquiler LEGO)               │
│  ├─ Gestión de suscripciones                                │
│  ├─ Catálogo de sets                                        │
│  ├─ Asignación de sets a usuarios                           │
│  └─ Generación de shipments (envíos)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        Edge Function: update-remote-shipment-status
        (Comunicación bidireccional)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  BRICKSHARE LOGISTICS (Este Repositorio)                    │
│  ├─ Puntos PuDo (locations)                                 │
│  ├─ Paquetes y tracking (packages)                          │
│  ├─ Escaneo de códigos (ScannerScreen mobile)               │
│  ├─ Validación GPS                                          │
│  └─ Auditoría de operaciones (pudo_scan_logs)               │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos Brickshare → Logistics

1. **Brickshare genera shipment** (envío)
   - Usuario solicita set en alquiler
   - Sistema crea `shipment` con estado `pending_delivery`

2. **Brickshare genera QR dinámico**
   - Llama Edge Function `generate-dynamic-qr` en Brickshare Logistics
   - Recibe JWT del QR
   - Envía email al cliente con QR

3. **Cliente llega al PuDo**
   - Muestra QR en pantalla del móvil

4. **Operador escanea con app Brickshare Logistics**
   - ScannerScreen en modo "Entrega (QR)"
   - Captura GPS automáticamente
   - Envía a Edge Function `update-remote-shipment-status`

5. **Edge Function actualiza Brickshare** (comunicación inversa)
   - HTTP POST a `BRICKSHARE_API_URL/shipments/{id}/status`
   - Brickshare actualiza estado del shipment en su BD
   - Usuario recibe notificación: "Paquete entregado en PuDo"

### Convenciones de Datos

- El código está estructurado para escalabilidad (monorepo con Turbo)
- Todas las validaciones críticas ocurren en Edge Functions (backend)
- El cliente mobile es thin client, confía en Supabase para autenticación
- Las migraciones SQL están versionadas (facilita rollback)
- CORS habilitado en Edge Functions para clientes remotos
- `external_shipment_id` siempre contiene el ID del sistema remoto (Brickshare)
- `source_system` indica origen: 'logistics' o 'brickshare'
- `pudo_id` es único y auto-generado en formato 'brickshare-XXX'

---

## 🔗 Integración Brickshare (Sistema Externo)

### Proyecto Brickshare
- **Ubicación**: `/Code_personal/brickshare`
- **Tipo**: Plataforma de alquiler circular de sets LEGO
- **Stack**: React + Vite + Supabase Local + Stripe
- **Documentación**: `brickshare/claude.md`

### Edge Functions que Comunican

| Function | Origen | Destino | Propósito |
|---|---|---|---|
| `generate-dynamic-qr` | Brickshare | Logistics | Generar QR para recoger en PuDo |
| `update-remote-shipment-status` | Logistics | Brickshare | Confirmar entrega/recepción en PuDo |

### Endpoints de Integración

**Brickshare Logistics → Brickshare**:
```
POST /api/shipments/{shipment_id}/status
{
  "new_status": "delivered_pudo|in_return",
  "pudo_location": { id, name, city },
  "gps_validation": { passed, message },
  "timestamp": ISO8601
}
```

### Datos que Circulan

```
Brickshare shipment_id
    ↓
Logistics external_shipment_id (FK al shipment de Brickshare)
    ↓
QR JWT incluye external_shipment_id
    ↓
Operador escanea QR
    ↓
Edge Function extrae shipment_id del JWT
    ↓
HTTP POST a Brickshare API con nueva información
    ↓
Brickshare actualiza estado de shipment
```

---

---

## 📋 Checklist de Desarrollo para iOS

- [ ] **Antes de comenzar sesión de desarrollo**:
  1. `npm install` (actualizar dependencias)
  2. `npm run clean` (limpiar caché de Metro y watchman)
  3. Abrir simulador: `xcrun simctl boot "iPhone 17 Pro"`

- [ ] **Durante desarrollo**:
  1. Usar logger en lugar de console.log: `import { logger } from '@/utils/logger'`
  2. Debuggear con VSCode: F5 → "Debug iOS Simulator"
  3. Atajos de teclado: Cmd+Shift+I (start), Cmd+Shift+R (clear cache)

- [ ] **Antes de commit**:
  1. `npm run lint:fix` (corregir errores de linting)
  2. `npm run type-check` (validar tipos TypeScript)
  3. `npm run test:ios` (ejecutar tests)
  4. Revisar logs: `logger.getLogsByLevel('error')`

- [ ] **Performance**:
  1. Usar `logger.measure()` para operaciones críticas
  2. Revisar Metro output para bundle size
  3. Profiling: React Profiler en React Developer Tools

---

**Última actualización**: 28/03/2026 (Resolución de conflictos de dependencias)
**Maintainer**: Equipo Brickshare
**Versión**: 1.2.0 (iOS Simulator Setup & Dependency Sync)
**Estado**: ✅ Entorno iOS configurado correctamente (iOS 26.3, React 19.2.4, simulador operativo)
