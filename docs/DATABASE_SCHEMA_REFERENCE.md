# Referencia de Esquema de Base de Datos - Brickshare Logistics

**Versión:** 1.0  
**Fecha:** 25/03/2026  
**Propósito:** Documento de referencia para consulta por IA (Claude) y desarrolladores

---

## 📊 Diagrama de Entidades y Relaciones

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BRICKSHARE LOGISTICS DATABASE                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   auth.users     │ (Supabase Auth)
│──────────────────│
│ id (PK)          │
│ email            │
│ created_at       │
└────────┬─────────┘
         │
         │ 1:1
         │
┌────────▼─────────┐         1:N          ┌──────────────────┐
│   public.users   │◄────────────────────┤  locations       │
│──────────────────│                      │──────────────────│
│ id (PK, FK)      │                      │ id (PK)          │
│ role             │                      │ owner_id (FK)    │
│ first_name       │                      │ name             │
│ last_name        │                      │ address          │
│ email            │                      │ commission_rate  │
│ phone            │                      │ is_active        │
│ address          │                      │ latitude         │◄─────┐
│ postal_code      │                      │ longitude        │      │
│ city             │                      │ gps_validation_  │      │
│ created_at       │                      │   radius_meters  │      │
└──────────────────┘                      └────────┬─────────┘      │
         │                                         │                 │
         │ 1:N                                     │ 1:N             │
         │                                         │                 │
┌────────▼─────────┐                      ┌────────▼─────────┐      │
│   packages       │                      │ pudo_scan_logs   │      │
│──────────────────│                      │──────────────────│      │
│ id (PK)          │                      │ id (PK)          │      │
│ tracking_code    │◄─────────────────────┤ remote_shipment_ │      │
│ status           │  (relación lógica)   │   id (TEXT)      │      │
│ location_id (FK) ├──────────────────────┤ pudo_location_   │──────┘
│ customer_id (FK) │                      │   id (FK)        │
│ dynamic_qr_hash  │                      │ scanned_by_user_ │
│ qr_expires_at    │                      │   id (FK)        │
│ created_at       │                      │ previous_status  │
│ updated_at       │                      │ new_status       │
└──────────────────┘                      │ action_type      │
         │                                 │ scan_timestamp   │
         │                                 │ scan_latitude    │
         │                                 │ scan_longitude   │
         │                                 │ gps_accuracy_m   │
         │                                 │ gps_validation_  │
         │                                 │   passed         │
         │                                 │ api_request_     │
         │                                 │   successful     │
         │                                 │ api_response_    │
         │                                 │   code           │
         │                                 │ api_response_    │
         │                                 │   message        │
         │                                 │ api_request_     │
         │                                 │   duration_ms    │
         │                                 │ device_info      │
         │                                 │ app_version      │
         │                                 │ metadata         │
         │                                 └──────────────────┘
         │
         │ base para vistas
         │
┌────────▼─────────────────────────────────────────┐
│        monthly_profitability (VIEW)              │
│──────────────────────────────────────────────────│
│ month, location_id, location_name, owner_id,     │
│ commission_rate, total_packages, active_packages,│
│ dropoffs, pickups, profitability                 │
└──────────────────────────────────────────────────┘
```

---

## 📋 Tablas Principales

### 1. `public.users`

**Descripción:** Perfiles de usuario que extienden `auth.users` de Supabase.

**Columnas:**

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, FK → auth.users(id) | Identificador único del usuario |
| `role` | TEXT | NOT NULL, CHECK | Rol: 'admin', 'owner', 'customer' |
| `first_name` | TEXT | NOT NULL, DEFAULT '' | Nombre del usuario |
| `last_name` | TEXT | NOT NULL, DEFAULT '' | Apellido del usuario |
| `email` | TEXT | - | Email del usuario |
| `phone` | TEXT | DEFAULT '+34 ' | Teléfono del usuario |
| `address` | TEXT | NOT NULL, DEFAULT '' | Dirección del usuario |
| `postal_code` | TEXT | NOT NULL, DEFAULT '' | Código postal |
| `city` | TEXT | NOT NULL, DEFAULT '' | Ciudad |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación |

**Índices:**
- PRIMARY KEY en `id`

**RLS (Row Level Security):**
- `users_select_own`: Usuarios pueden ver su propio perfil o admins pueden ver todos
- `users_update_own`: Usuarios pueden actualizar su perfil (excepto role)
- `users_admin_all`: Admins tienen acceso total

**Triggers:**
- `on_auth_user_created`: Crea automáticamente un perfil en `public.users` cuando se registra un nuevo usuario en `auth.users`

---

### 2. `public.locations`

**Descripción:** Puntos de conveniencia (PUDO) gestionados por propietarios (owners).

**Columnas:**

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único del local |
| `owner_id` | UUID | NOT NULL, FK → users(id) | Propietario del local |
| `name` | TEXT | NOT NULL | Nombre del local |
| `address` | TEXT | NOT NULL | Dirección del local |
| `commission_rate` | NUMERIC(10,2) | NOT NULL, DEFAULT 0.35, CHECK >= 0 | Comisión por paquete (EUR) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Estado activo/inactivo |
| `latitude` | NUMERIC(10,8) | - | Latitud para validación GPS |
| `longitude` | NUMERIC(11,8) | - | Longitud para validación GPS |
| `gps_validation_radius_meters` | INTEGER | DEFAULT 50 | Radio de validación GPS (metros) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación |

**Índices:**
- PRIMARY KEY en `id`
- `idx_locations_owner_id` en `owner_id`

**RLS:**
- `locations_owner_select`: Owners ven solo sus locales, admins ven todos
- `locations_owner_insert`: Owners pueden crear locales propios
- `locations_owner_update`: Owners pueden actualizar sus locales
- `locations_admin_delete`: Solo admins pueden eliminar locales

---

### 3. `public.packages`

**Descripción:** Paquetes gestionados en los puntos de conveniencia.

**Columnas:**

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único del paquete |
| `tracking_code` | TEXT | NOT NULL, UNIQUE | Código de tracking |
| `status` | package_status | NOT NULL, DEFAULT 'pending_dropoff' | Estado del paquete |
| `location_id` | UUID | NOT NULL, FK → locations(id) | Ubicación del paquete |
| `customer_id` | UUID | FK → users(id), ON DELETE SET NULL | Cliente propietario |
| `dynamic_qr_hash` | TEXT | - | Hash/JWT del QR dinámico |
| `qr_expires_at` | TIMESTAMPTZ | - | Expiración del QR (5 min) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Última actualización |

**Enum: `package_status`**
- `pending_dropoff`: Esperando depósito
- `in_location`: En el local
- `picked_up`: Recogido
- `returned`: Devuelto

**Índices:**
- PRIMARY KEY en `id`
- UNIQUE en `tracking_code`
- `idx_packages_location_id` en `location_id`
- `idx_packages_customer_id` en `customer_id`
- `idx_packages_status` en `status`
- `idx_packages_tracking` en `tracking_code`

**Triggers:**
- `packages_updated_at`: Actualiza `updated_at` automáticamente en cada UPDATE

**RLS:**
- `packages_owner_select`: Owners ven paquetes de sus locales
- `packages_owner_insert`: Owners pueden crear paquetes en sus locales
- `packages_owner_update`: Owners pueden actualizar paquetes de sus locales
- `packages_customer_select`: Customers ven solo sus paquetes
- `packages_admin_all`: Admins tienen acceso total

---

### 4. `public.pudo_scan_logs`

**Descripción:** Registro de todas las acciones de escaneo QR en centros PUDO con validación GPS y resultado de API remota.

**Columnas:**

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único del log |
| `pudo_location_id` | UUID | NOT NULL, FK → locations(id) | Punto PUDO donde se realizó el escaneo |
| `remote_shipment_id` | TEXT | NOT NULL | ID del shipment en BD remota de Brickshare |
| `previous_status` | TEXT | NOT NULL | Estado antes del escaneo |
| `new_status` | TEXT | NOT NULL | Estado después del escaneo |
| `scanned_by_user_id` | UUID | NOT NULL, FK → users(id) | Usuario que realizó el escaneo |
| `action_type` | pudo_action_type | NOT NULL | Tipo de acción realizada |
| `scan_timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha/hora del escaneo |
| `scan_latitude` | NUMERIC(10,8) | - | Latitud donde se realizó el escaneo |
| `scan_longitude` | NUMERIC(11,8) | - | Longitud donde se realizó el escaneo |
| `gps_accuracy_meters` | NUMERIC(8,2) | - | Precisión GPS en metros |
| `gps_validation_passed` | BOOLEAN | DEFAULT false | Si el GPS está dentro del radio |
| `device_info` | TEXT | - | Información del dispositivo |
| `app_version` | TEXT | - | Versión de la app móvil |
| `api_request_successful` | BOOLEAN | NOT NULL, DEFAULT false | Si la API remota respondió exitosamente |
| `api_response_code` | INTEGER | - | Código HTTP de respuesta |
| `api_response_message` | TEXT | - | Mensaje de respuesta |
| `api_request_duration_ms` | INTEGER | - | Duración de la request en ms |
| `metadata` | JSONB | DEFAULT '{}' | Metadatos adicionales |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Fecha de creación del log |

**Enum: `pudo_action_type`**
- `delivery_confirmation`: Confirma entrega en PUDO (`in_transit_pudo` → `delivered_pudo`)
- `return_confirmation`: Confirma recogida de devolución (`in_return_pudo` → `in_return`)

**Índices:**
- PRIMARY KEY en `id`
- `idx_pudo_scan_logs_location` en `pudo_location_id`
- `idx_pudo_scan_logs_shipment` en `remote_shipment_id`
- `idx_pudo_scan_logs_timestamp` en `scan_timestamp DESC`
- `idx_pudo_scan_logs_user` en `scanned_by_user_id`
- `idx_pudo_scan_logs_action_type` en `action_type`
- `idx_pudo_scan_logs_location_date` en `(pudo_location_id, scan_timestamp DESC)`

**RLS:**
- `pudo_scan_logs_admin_all`: Admins pueden ver todos los logs
- `pudo_scan_logs_owner_view`: Owners ven logs de sus puntos PUDO
- `pudo_scan_logs_owner_insert`: Owners pueden insertar logs en sus puntos

---

## 📊 Vistas

### 1. `public.monthly_profitability`

**Descripción:** Pre-calcula métricas mensuales por local para el dashboard. Respeta RLS.

**Columnas:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `month` | TEXT | Mes en formato YYYY-MM |
| `location_id` | UUID | ID del local |
| `location_name` | TEXT | Nombre del local |
| `owner_id` | UUID | ID del propietario |
| `commission_rate` | NUMERIC | Tasa de comisión |
| `total_packages` | BIGINT | Total de paquetes |
| `active_packages` | BIGINT | Paquetes activos |
| `dropoffs` | BIGINT | Depósitos |
| `pickups` | BIGINT | Recogidas |
| `profitability` | NUMERIC | Rentabilidad (EUR) |

**Query base:**
```sql
SELECT
  to_char(p.created_at, 'YYYY-MM') AS month,
  l.id AS location_id,
  l.name AS location_name,
  l.owner_id,
  l.commission_rate,
  COUNT(*) AS total_packages,
  COUNT(*) FILTER (WHERE p.status IN ('pending_dropoff', 'in_location')) AS active_packages,
  COUNT(*) FILTER (WHERE p.status = 'in_location') AS dropoffs,
  COUNT(*) FILTER (WHERE p.status = 'picked_up') AS pickups,
  SUM(l.commission_rate) FILTER (WHERE p.status = 'picked_up') AS profitability
FROM public.packages p
JOIN public.locations l ON l.id = p.location_id
GROUP BY to_char(p.created_at, 'YYYY-MM'), l.id, l.name, l.owner_id, l.commission_rate
ORDER BY month DESC, l.name;
```

---

### 2. `public.pudo_scan_summary`

**Descripción:** Resumen diario de escaneos por punto PUDO, tipo de acción y resultado.

**Columnas:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `location_id` | UUID | ID del local |
| `location_name` | TEXT | Nombre del local |
| `scan_date` | DATE | Fecha del escaneo |
| `action_type` | pudo_action_type | Tipo de acción |
| `total_scans` | BIGINT | Total de escaneos |
| `successful_scans` | BIGINT | Escaneos exitosos |
| `failed_scans` | BIGINT | Escaneos fallidos |
| `gps_valid_scans` | BIGINT | Escaneos con GPS válido |
| `gps_invalid_scans` | BIGINT | Escaneos con GPS inválido |
| `avg_api_duration_ms` | INTEGER | Duración promedio de API |
| `unique_operators` | BIGINT | Operadores únicos |

---

## 🔧 Funciones

### 1. `public.my_role()`

**Descripción:** Obtiene el rol del usuario actual autenticado.

**Retorna:** `TEXT`

**Uso:**
```sql
SELECT public.my_role(); -- 'admin', 'owner', o 'customer'
```

---

### 2. `public.handle_new_user()`

**Descripción:** Trigger function que crea automáticamente un perfil en `public.users` cuando se registra un usuario en `auth.users`.

**Tipo:** TRIGGER FUNCTION

**Se ejecuta:** AFTER INSERT en `auth.users`

---

### 3. `public.touch_updated_at()`

**Descripción:** Trigger function que actualiza automáticamente el campo `updated_at` en cada UPDATE.

**Tipo:** TRIGGER FUNCTION

**Se ejecuta:** BEFORE UPDATE en `public.packages`

---

### 4. `public.validate_gps_location()`

**Descripción:** Valida si las coordenadas GPS del escaneo están dentro del radio permitido del punto PUDO usando fórmula de Haversine.

**Parámetros:**
- `p_scan_lat` NUMERIC - Latitud del escaneo
- `p_scan_lon` NUMERIC - Longitud del escaneo
- `p_pudo_location_id` UUID - ID del punto PUDO

**Retorna:** BOOLEAN
- `true`: Coordenadas dentro del radio o sin coordenadas configuradas
- `false`: Coordenadas fuera del radio

**Uso:**
```sql
SELECT public.validate_gps_location(40.4168, -3.7038, 'location-uuid');
```

**Algoritmo:**
1. Obtiene coordenadas y radio del punto PUDO
2. Si no hay coordenadas configuradas, retorna `true`
3. Calcula distancia usando fórmula de Haversine
4. Compara distancia con radio configurado

---

### 5. `public.log_pudo_scan()`

**Descripción:** Registra un escaneo en punto PUDO con validación GPS automática y resultado de API remota.

**Parámetros:**
- `p_pudo_location_id` UUID - ID del punto PUDO
- `p_remote_shipment_id` TEXT - ID del shipment remoto
- `p_previous_status` TEXT - Estado anterior
- `p_new_status` TEXT - Nuevo estado
- `p_action_type` TEXT - Tipo de acción ('delivery_confirmation' o 'return_confirmation')
- `p_scan_latitude` NUMERIC (opcional) - Latitud
- `p_scan_longitude` NUMERIC (opcional) - Longitud
- `p_gps_accuracy_meters` NUMERIC (opcional) - Precisión GPS
- `p_device_info` TEXT (opcional) - Info del dispositivo
- `p_app_version` TEXT (opcional) - Versión de la app
- `p_api_successful` BOOLEAN (opcional) - Si API fue exitosa
- `p_api_response_code` INTEGER (opcional) - Código HTTP
- `p_api_response_message` TEXT (opcional) - Mensaje de respuesta
- `p_api_duration_ms` INTEGER (opcional) - Duración en ms
- `p_metadata` JSONB (opcional) - Metadatos adicionales

**Retorna:** UUID (ID del log creado)

**Uso:**
```sql
SELECT public.log_pudo_scan(
  'location-uuid',
  'SHIP123',
  'in_transit_pudo',
  'delivered_pudo',
  'delivery_confirmation',
  40.4168,
  -3.7038,
  15.5,
  'iPhone 14 Pro',
  '1.0.0',
  true,
  200,
  'Success',
  450,
  '{"note": "test"}'::jsonb
);
```

---

## 📝 Queries de Ejemplo

### Paquetes Activos en un Local

```sql
SELECT 
  p.id,
  p.tracking_code,
  p.status,
  p.created_at,
  p.updated_at,
  EXTRACT(EPOCH FROM (now() - p.updated_at))/3600 as hours_in_location,
  u.first_name || ' ' || u.last_name as customer_name
FROM packages p
LEFT JOIN users u ON u.id = p.customer_id
WHERE p.status = 'in_location'
  AND p.location_id = 'your-location-uuid'
ORDER BY p.updated_at ASC;
```

### Histórico de Operaciones PUDO

```sql
SELECT 
  psl.scan_timestamp,
  psl.remote_shipment_id,
  psl.action_type,
  psl.previous_status,
  psl.new_status,
  psl.api_request_successful,
  u.first_name || ' ' || u.last_name as operator_name
FROM pudo_scan_logs psl
JOIN users u ON u.id = psl.scanned_by_user_id
WHERE psl.pudo_location_id = 'your-location-uuid'
  AND psl.scan_timestamp >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY psl.scan_timestamp DESC
LIMIT 100;
```

### Tasa de Éxito de Operaciones

```sql
SELECT 
  DATE(scan_timestamp) as date,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE api_request_successful = true) as successful,
  COUNT(*) FILTER (WHERE api_request_successful = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE api_request_successful = true) / COUNT(*), 2) as success_rate
FROM pudo_scan_logs
WHERE pudo_location_id = 'your-location-uuid'
  AND scan_timestamp > now() - INTERVAL '30 days'
GROUP BY DATE(scan_timestamp)
ORDER BY date DESC;
```

### Paquetes con Más de 24h en Local

```sql
SELECT 
  p.tracking_code,
  p.status,
  p.updated_at,
  EXTRACT(EPOCH FROM (now() - p.updated_at))/3600 as hours_in_location,
  l.name as location_name
FROM packages p
JOIN locations l ON l.id = p.location_id
WHERE p.status = 'in_location'
  AND (now() - p.updated_at) > INTERVAL '24 hours'
ORDER BY p.updated_at ASC;
```

### Rentabilidad Mensual por Local

```sql
SELECT 
  month,
  location_name,
  total_packages,
  pickups,
  profitability
FROM monthly_profitability
WHERE owner_id = auth.uid()
  AND month >= to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM')
ORDER BY month DESC, location_name;
```

---

## 🔐 Seguridad (RLS)

Todas las tablas tienen **Row Level Security (RLS)** habilitado:

### Roles de Usuario

1. **admin**: Acceso total a todas las tablas y operaciones
2. **owner**: Acceso a sus propios locales y paquetes de esos locales
3. **customer**: Acceso solo a sus propios paquetes

### Políticas Principales

- **Owners** solo ven datos relacionados con sus puntos PUDO
- **Customers** solo ven sus propios paquetes
- **Admins** tienen acceso total mediante políticas específicas o bypass
- Las vistas respetan automáticamente las políticas RLS (`security_invoker = true`)

---

## 🗃️ Migraciones

Las migraciones están en: `supabase/migrations/`

| Archivo | Descripción |
|---------|-------------|
| `001_schema.sql` | Esquema principal, tablas base, RLS, vista de rentabilidad |
| `002_fix_profile_rls.sql` | Correcciones de RLS para perfiles |
| `003_allow_public_location_select.sql` | Permitir lectura pública de locales |
| `004_refactor_locations_schema.sql` | Refactorización del esquema de locations |
| `005_fix_location_rls_for_everyone.sql` | Correcciones de RLS para locations |
| `006_add_external_integration.sql` | Tablas para integración externa |
| `007_add_audit_tables.sql` | Tablas de auditoría |
| `008_add_pudo_scan_logs.sql` | Sistema de logs de escaneo PUDO con GPS |

---

## 📚 Recursos Adicionales

- **Documentación Supabase:** https://supabase.com/docs
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **Proceso PUDO:** `docs/PUDO_SCANNING_PROCESS.md`
- **Transiciones de estado:** `docs/PUDO_STATUS_TRANSITIONS.md`

---

**Documento actualizado:** 25/03/2026  
**Mantenedor:** Equipo Brickshare Logistics