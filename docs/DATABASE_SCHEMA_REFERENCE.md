# Referencia de Esquema de Base de Datos - Brickshare Logistics

**Versión:** 1.1 (Sincronizado con Producción Remota)
**Propósito:** Documento de referencia estructurado extraído de la BD Cloud real.

---

## 📋 Tablas Principales

### 1. `public.users`
Perfiles de usuario que extienden `auth.users` de Supabase.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, NOT NULL | Identificador único del usuario |
| `role` | TEXT | CHECK IN ('admin', 'user') | Rol en el sistema |
| `first_name` | TEXT | DEFAULT '' | Nombre |
| `last_name` | TEXT | DEFAULT '' | Apellido |
| `email` | TEXT | - | Email |
| `phone` | TEXT | DEFAULT '+34 ' | Teléfono |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |

*Nota técnica: El valor DEFAULT del `role` está remotamente seteado a 'usuarios', lo cual entra en conflicto con el CHECK de 'admin'/'user'. Esto debe revisarse en la migración de limpieza.*

---

### 2. `public.locations`
Puntos de conveniencia (PUDO) comerciales de la logística.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | ID del PUDO |
| `pudo_id` | TEXT | NOT NULL | ID secuencial "brickshare-XXX" |
| `name` | TEXT | NOT NULL | Nombre PUDO |
| `location_name` | TEXT | - | *(Duplicado a revisar)* Nombre del local |
| `address` | TEXT | NOT NULL | Dirección física |
| `city` | TEXT | - | Ciudad |
| `postal_code` | TEXT | - | CP |
| `latitude` | NUMERIC(10,8)| - | Latitud GPS |
| `longitude` | NUMERIC(11,8)| - | Longitud GPS |
| `gps_validation_radius_meters` | INTEGER | DEFAULT 50 | Precisión de escaneo requerida |
| `commission_rate` | NUMERIC(10,2)| DEFAULT 0.35, CHECK >= 0 |  |
| `is_active` | BOOLEAN | DEFAULT true |  |

---

### 3. `public.user_locations`
Tabla puente de asignación N:M de trabajadores a puntos PUDO.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `user_id` | UUID | FK de Users |
| `location_id` | UUID | FK de Locations |
| `assigned_at` | TIMESTAMPTZ | Cuándo fue asignado por última vez |

---

### 4. `public.packages`
Paquetes entregados en remoto y listos para transicionar.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | UUID | PK | |
| `tracking_code` | TEXT | UNIQUE, NOT NULL | |
| `status` | package_status | DEFAULT 'pending_dropoff' | 'pending_dropoff', 'in_location', 'picked_up', 'returned' |
| `type` | TEXT | CHECK ('delivery', 'return') | |
| `location_id` | UUID | NOT NULL | Hub Logístico PUDO |
| `customer_id` | UUID | - | Cliente final |
| `dynamic_qr_hash` | TEXT | - | QR rotativo generado JWT |
| `static_qr_hash` | TEXT | - | QR persistente |
| `source_system` | TEXT | DEFAULT 'logistics' | Origen ('logistics' o 'brickshare') |
| `remote_shipment_data` | JSONB | DEFAULT '{}' | Metadata JSONB completa |
| *Redundancias:* | | | `remote_customer_name`, `remote_delivery_address`, `remote_shipping_status`, `remote_estimated_delivery`, `external_shipment_id` |

---

### 5. Tablas de Análisis de Escaneos (Audit)

#### A) `public.pudo_scan_logs`
* `id` UUID PK
* `pudo_location_id` UUID
* `remote_shipment_id` TEXT
* `action_type` pudo_action_type (`delivery_confirmation`, `return_confirmation`)
* Status tracking (`previous_status`, `new_status`)
* Telemetría Scan (`scan_latitude`, `scan_longitude`, `gps_accuracy_meters`, `gps_validation_passed`)
* Estado API (`api_request_successful`, `api_response_code`, etc.)
* Device data y metadata externa (`device_info`, `app_version`, `metadata` JSONB)

#### B) `public.package_events`
Log global de la vida del paquete, para detectar desajustes (qr_generated, qr_scanned_success, auto_adjustment, etc.). Incluye metadata, ip_address, user_agent, locale.

#### C) `public.scan_errors`
Log exclusivo para intentos de escaneo de QR inválidos, expirados, errores de JWT, etc. Útil en el dashboard para diagnosticar cámaras.

---

## 🗃️ Notas
*   Este dump ha revelado tablas de auditoría modernas (`package_events`, `scan_errors`) que no existían en versiones previas del documento.
*   En la arquitectura actual de base de datos **no hay propiedad directa (owner_id)** en Locations, todo pasa mediante RLS a consultar `public.user_locations`.
*   Las vistas principales están basadas en `package_status` (`pudo_active_packages_enhanced`, `pudo_operations_history`, `monthly_profitability`).