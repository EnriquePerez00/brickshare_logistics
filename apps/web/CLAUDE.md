# BRICKSHARE LOGISTICS — Documentación Técnica Completa

## 📋 Resumen Ejecutivo

**Brickshare Logistics** es una plataforma de gestión de paquetería para puntos de conveniencia. Permite que propietarios de locales comerciales reciban y entreguen paquetes mediante escaneo de códigos de barras y QR dinámicos.

**Arquitectura**: Monorepo con Turbo.js
- **Mobile**: Expo/React Native (escaneo de paquetes)
- **Web**: Next.js (dashboard admin)
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

#### 2. **locations** (Puntos de conveniencia)
```sql
- id (UUID, PK)
- owner_id (UUID, FK → users)
- name (TEXT)
- address (TEXT)
- commission_rate (NUMERIC) → Comisión por paquete en EUR
- is_active (BOOLEAN)
- created_at (TIMESTAMPTZ)
```
**RLS**: Owners ven solo sus locales. Admins acceso total.

#### 3. **packages** (Paquetes)
```sql
- id (UUID, PK)
- tracking_code (TEXT, UNIQUE) → Código de barras/tracking del courier
- status (ENUM) → 'pending_dropoff' | 'in_location' | 'picked_up' | 'returned'
- location_id (UUID, FK → locations)
- customer_id (UUID, FK → users, nullable)
- dynamic_qr_hash (TEXT) → JWT del QR dinámico
- qr_expires_at (TIMESTAMPTZ) → Expiración (5 min)
- created_at, updated_at (TIMESTAMPTZ)
```
**RLS**: 
- Owners ven paquetes de sus locales
- Customers ven solo sus paquetes
- Admins acceso total

#### 4. **monthly_profitability** (Vista calculada)
```sql
- month (YYYY-MM)
- location_id, location_name, owner_id
- commission_rate
- total_packages, active_packages, dropoffs, pickups
- profitability (suma de comisiones)
```
**Propósito**: Pre-calcula métricas para dashboard.

### Triggers y Funciones

- **handle_new_user()**: Crea automáticamente perfil en `public.users` cuando se registra en `auth.users`
- **touch_updated_at()**: Actualiza `updated_at` automáticamente en cambios

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

**Propósito**: Genera un JWT firmado (QR dinámico) que el cliente muestra para recoger su paquete.

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

**Propósito**: Genera QR estático para devoluaciones (similar a dinámico pero no expira).

---

## 📱 Aplicación Móvil (Expo/React Native)

### Flujos Principales

#### 1. **Login Screen** (`LoginScreen.tsx`)
- Email + Password
- Autenticación con Supabase
- Recuperación de contraseña (modal)
- Roles: `owner` accede a Scanner

#### 2. **Scanner Screen** (`ScannerScreen.tsx`)
**Dos modos de operación**:

**A) Modo Recepción (Dropoff)**
- Escanea códigos de barras del courier
- Lee formatos: EAN-13, EAN-8, Code128, Code39, UPC-A, UPC-E
- Flujo:
  1. Lee tracking_code del código de barras
  2. Inserta en tabla `packages` con status `in_location`
  3. Muestra confirmación
  4. Prepara para impresión de recibo
  
**B) Modo Entrega (Pickup)**
- Escanea QR dinámico mostrado en pantalla del cliente
- Lee formato: QR Code
- Flujo:
  1. Lee qr_hash (JWT)
  2. Llama Edge Function `verify-package-qr`
  3. Actualiza status a `picked_up`
  4. Muestra confirmación

#### 3. **Printer Setup Screen** (`PrinterSetupScreen.tsx`)
- Configuración de impresora térmica
- Permite ajustar parámetros (ancho, temperatura)

### Permisos Requeridos

- `expo-camera`: Acceso a cámara
- `expo-barcode-scanner`: Lectura de códigos

### Navegación

```
Login → Scanner ⟷ PrinterSetup
```

---

## 🌐 Aplicación Web (Next.js)

### Rutas Principales

- `/auth` → Login
- `/dashboard` → Dashboard del owner (métricas)
- `/admin` → Panel administrativo (tabla de envíos)
- `/api/packages/*` → Endpoints para gestión de paquetes
- `/api/locations/*` → Endpoints para gestión de locales

### API Routes

**GET `/api/packages/by-shipment/[shipmentId]/status`**
- Obtiene estado de un envío
- RLS respeta propiedad del local

**GET `/api/locations`**
- Lista locales del usuario autenticado

---

## 🔑 Variables de Entorno

### Requeridas en todos los apps

```env
# Web (apps/web/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Mobile (apps/mobile/.env)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### En Supabase (Edge Functions)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
QR_JWT_SECRET=your-secret-key-32-chars-minimum
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

### Linting y Formatting

```bash
npm run lint
npm run format
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

## 🐛 Debugging y Troubleshooting

### Logs Útiles

```bash
# Logs de Supabase
supabase log tail --function-name verify-package-qr

# Logs de aplicación móvil (en terminal Expo)
expo start --clear
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `QR code is invalid or has expired` | JWT expirado o firma inválida | Regenerar QR dinámico |
| `This package does not belong to your location` | RLS rechazando acceso | Verificar `location_id` del usuario |
| `Missing Environment Variables` | `.env` incompleto | Revisar `SUPABASE_URL` y claves |
| `Camera permission denied` | Permiso no otorgado | Solicitar nuevamente en app |

---

## 📝 Notas para Desarrolladores

- El código está estructurado para escalabilidad (monorepo con Turbo)
- Todas las validaciones críticas ocurren en Edge Functions (backend)
- El cliente mobile es thin client, confía en Supabase para autenticación
- Las migraciones SQL están versionadas (facilita rollback)
- CORS habilitado en Edge Functions para clientes remotos

---

**Última actualización**: 23/03/2026
**Maintainer**: Equipo Brickshare