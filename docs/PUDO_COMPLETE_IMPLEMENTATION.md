# Implementación Completa del Sistema PUDO

## Resumen Ejecutivo

Este documento describe la implementación completa del sistema de gestión de puntos PUDO (Pick Up Drop Off) para Brickshare Logistics, que permite el escaneo de QR codes en puntos de recogida/devolución y la actualización automática de estados de envíos.

## Fecha de Implementación
24-25 de Marzo de 2026

---

## 1. Arquitectura del Sistema

### 1.1 Componentes Principales

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│  - ScannerScreen con validación GPS                     │
│  - Lectura de QR codes                                  │
│  - Integración con expo-location                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│              Supabase Edge Functions                     │
│  - verify-package-qr: Validación de QR                  │
│  - update-remote-shipment-status: Cambio de estados    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                     │
│  - shipments: Envíos principales                        │
│  - shipment_status: Estados de envíos                   │
│  - pudo_scan_logs: Registro de escaneos                │
│  - Vistas: pudo_active_packages_enhanced               │
│  - Funciones: get_pudo_operations_paginated            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│                    Web Dashboard                         │
│  - APIs REST para consulta de paquetes                  │
│  - Componentes React para visualización                │
│  - Exportación de histórico a CSV                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Flujo de Datos

1. **App Mobile** escanea QR y valida ubicación GPS
2. **Edge Function** `verify-package-qr` valida el código y recupera información del shipment
3. Si el estado es válido para transición, se llama a `update-remote-shipment-status`
4. **Edge Function** actualiza estado y registra en `pudo_scan_logs`
5. **Dashboard Web** consulta datos a través de APIs REST

---

## 2. Base de Datos

### 2.1 Tabla: pudo_scan_logs

```sql
CREATE TABLE pudo_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  location_id UUID NOT NULL REFERENCES deposit_points(id),
  scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  operator_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('delivery_confirmation', 'return_confirmation')),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  result BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  device_info JSONB
);
```

**Índices creados:**
- `idx_pudo_scan_logs_shipment` en shipment_id
- `idx_pudo_scan_logs_location` en location_id  
- `idx_pudo_scan_logs_timestamp` en scan_timestamp
- `idx_pudo_scan_logs_operator` en operator_id

### 2.2 Vistas

#### pudo_active_packages_enhanced
Muestra paquetes activos en cada punto PUDO con información enriquecida:
- Código de tracking
- Información del cliente
- Tipo de paquete (entrega/devolución)
- Tiempo en local (horas)
- Estados actuales

#### pudo_operations_summary
Vista agregada con estadísticas por ubicación:
- Total de operaciones
- Operaciones exitosas/fallidas
- Últimas operaciones
- Paquetes activos

### 2.3 Funciones RPC

#### get_pudo_operations_paginated
Consulta paginada del histórico de operaciones con filtros:
- Rango de fechas
- Tipo de acción
- Resultado (exitoso/fallido)
- Búsqueda por tracking

#### export_pudo_operations_csv
Exporta histórico completo sin paginación para CSV.

---

## 3. Edge Functions

### 3.1 verify-package-qr

**Endpoint:** `POST /functions/v1/verify-package-qr`

**Input:**
```json
{
  "qrCode": "SHIP-123456-01",
  "locationId": "uuid",
  "latitude": 40.4168,
  "longitude": -3.7038
}
```

**Output:**
```json
{
  "valid": true,
  "shipment": {
    "id": "uuid",
    "tracking_code": "SHIP-123456",
    "status": "in_transit_pudo",
    "package_number": 1
  }
}
```

### 3.2 update-remote-shipment-status

**Endpoint:** `POST /functions/v1/update-remote-shipment-status`

**Input:**
```json
{
  "shipmentId": "uuid",
  "currentStatus": "in_transit_pudo",
  "locationId": "uuid",
  "operatorId": "uuid",
  "latitude": 40.4168,
  "longitude": -3.7038
}
```

**Transiciones soportadas:**
- `in_transit_pudo` → `delivered_pudo`
- `in_return_pudo` → `in_return`

---

## 4. APIs REST (Web Dashboard)

### 4.1 GET /api/pudo/active-packages

Consulta paquetes activos en un punto PUDO.

**Query params:**
- `location_id` (required)
- `sort` (opcional: time, tracking, type)
- `order` (opcional: asc, desc)

**Response:**
```json
{
  "data": [...],
  "count": 5,
  "alerts": { "over_24h": 2 }
}
```

### 4.2 GET /api/pudo/operations-history

Histórico paginado de operaciones.

**Query params:**
- `location_id` (required)
- `date_from`, `date_to`
- `action_type`
- `result_filter`
- `tracking_search`
- `page`, `limit`

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 150,
    "total_pages": 8
  }
}
```

### 4.3 GET /api/pudo/export-history

Exportación de histórico para CSV (sin paginación).

**Query params:** Mismos que operations-history excepto page/limit

---

## 5. Componentes React

### 5.1 PudoActivePackagesTable
- Tabla de paquetes activos
- Filtros por tipo y búsqueda
- Alertas para paquetes >24h en local
- Formato de tiempo legible

### 5.2 PudoOperationsHistory
- Tabla de histórico con paginación
- Integración con HistoryFilters
- Exportación a CSV
- Indicadores visuales de éxito/error

### 5.3 HistoryFilters
- Filtros de fecha con presets (hoy, semana, mes)
- Filtro por tipo de acción
- Filtro por resultado
- Búsqueda por tracking
- Botón de exportación

---

## 6. Mobile App (ScannerScreen)

### 6.1 Características

```typescript
// Validación GPS antes de escanear
const validateLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  
  const location = await Location.getCurrentPositionAsync({});
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  };
};

// Proceso de escaneo
1. Validar permisos GPS
2. Obtener ubicación actual
3. Escanear QR code
4. Enviar a verify-package-qr
5. Si válido y estado correcto, actualizar estado
6. Mostrar confirmación
```

### 6.2 Estados Manejados

- **in_transit_pudo**: Paquete en camino al PUDO → Confirmar entrega
- **in_return_pudo**: Devolución en PUDO → Confirmar recepción
- Otros estados: No permiten escaneo

---

## 7. Transiciones de Estados

```
ENTREGAS:
pending → picked_up → in_transit → in_transit_pudo → delivered_pudo → delivered

DEVOLUCIONES:
return_requested → in_return_pudo → in_return → returned_to_warehouse
```

### 7.1 Validaciones

- Estado actual debe ser `in_transit_pudo` o `in_return_pudo`
- Ubicación GPS debe estar cerca del punto PUDO (±100m tolerancia)
- Usuario debe tener rol `pudo_operator`
- QR code debe ser válido y pertenecer a shipment existente

---

## 8. Tests

### 8.1 Tests Unitarios Edge Function

**Archivo:** `supabase/functions/update-remote-shipment-status/index.test.ts`

Casos cubiertos:
- ✅ Transición válida: in_transit_pudo → delivered_pudo
- ✅ Transición válida: in_return_pudo → in_return
- ✅ Estado inválido (error 400)
- ✅ Shipment no encontrado (error 404)

**Ejecución:**
```bash
deno test --allow-env --allow-net supabase/functions/update-remote-shipment-status/index.test.ts
```

### 8.2 Tests SQL

**Archivo:** `supabase/migrations/008_add_pudo_scan_logs.test.sql`

Casos cubiertos:
- ✅ Inserción de log exitoso
- ✅ Inserción de log fallido
- ✅ Verificación de índices
- ✅ Verificación de constraints

**Ejecución:**
```bash
psql -d brickshare_logistics -f supabase/migrations/008_add_pudo_scan_logs.test.sql
```

---

## 9. Formato de Etiquetas QR

### 9.1 Estructura

```
Formato: {TRACKING_CODE}-{PACKAGE_NUMBER}
Ejemplo: SHIP-123456-01

Donde:
- TRACKING_CODE: Código único del shipment (formato: SHIP-XXXXXX)
- PACKAGE_NUMBER: Número de paquete (01-99)
```

### 9.2 Generación

Las etiquetas se generan mediante la Edge Function `generate-dynamic-qr`:

```typescript
POST /functions/v1/generate-dynamic-qr
{
  "shipmentId": "uuid",
  "packageNumber": 1
}

Response: QR code image (PNG base64)
```

---

## 10. Seguridad

### 10.1 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

```sql
-- Solo operadores PUDO pueden insertar logs
CREATE POLICY "pudo_operators_can_insert_logs"
ON pudo_scan_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'pudo_operator'
  )
);
```

### 10.2 Autenticación

- Todas las APIs REST requieren autenticación
- Edge Functions validan JWT token
- Mobile app usa Supabase Auth

---

## 11. Instalación y Configuración

### 11.1 Requisitos Previos

- Node.js 18+
- PostgreSQL 14+
- Supabase CLI
- Expo CLI
- Deno (para Edge Functions)

### 11.2 Pasos de Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/EnriquePerez00/brickshare_logistics.git
cd brickshare_logistics

# 2. Instalar dependencias
npm install
cd apps/web && npm install
cd ../mobile && npm install

# 3. Configurar variables de entorno
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# 4. Aplicar migraciones
supabase db push

# 5. Desplegar Edge Functions
supabase functions deploy verify-package-qr
supabase functions deploy update-remote-shipment-status
```

Ver `docs/PUDO_INSTALLATION_GUIDE.md` para instrucciones detalladas.

---

## 12. Documentación Adicional

- `docs/PUDO_SCANNING_PROCESS.md` - Proceso detallado de escaneo
- `docs/PUDO_STATUS_TRANSITIONS.md` - Diagrama de transiciones de estados
- `docs/PUDO_INSTALLATION_GUIDE.md` - Guía de instalación paso a paso
- `docs/DATABASE_SCHEMA_REFERENCE.md` - Referencia completa del esquema
- `docs/PUDO_DASHBOARD_IMPROVEMENTS.md` - Mejoras del dashboard

---

## 13. Métricas y Monitoreo

### 13.1 KPIs del Sistema

- **Operaciones por día**: Contador de escaneos exitosos
- **Tasa de éxito**: % de escaneos exitosos vs fallidos
- **Tiempo promedio en PUDO**: Duración promedio de paquetes en local
- **Alertas activas**: Paquetes con >24h en local

### 13.2 Logs y Auditoría

Todos los escaneos quedan registrados en `pudo_scan_logs` con:
- Timestamp exacto
- Ubicación GPS
- Operador que realizó el escaneo
- Estado anterior y nuevo
- Resultado (exitoso/fallido)
- Información del dispositivo

---

## 14. Roadmap Futuro

### Fase 2 (Q2 2026)
- [ ] Notificaciones push cuando paquete llega a PUDO
- [ ] Firma digital del receptor
- [ ] Foto del paquete al entregar
- [ ] Dashboard analytics avanzado

### Fase 3 (Q3 2026)
- [ ] Integración con sistemas de terceros (Correos, etc)
- [ ] API pública para partners
- [ ] Sistema de incidencias
- [ ] App para clientes finales

---

## 15. Contacto y Soporte

**Equipo de Desarrollo:**
- Enrique Pérez - enrique@brickshare.com
- Equipo Brickshare Logistics

**Documentación:**
- GitHub: https://github.com/EnriquePerez00/brickshare_logistics
- Wiki interna: [URL]

**Incidencias:**
- GitHub Issues
- Email: support@brickshare.com

---

## Conclusión

La implementación del sistema PUDO proporciona una solución completa para la gestión de puntos de recogida y devolución, con:

✅ Validación GPS en tiempo real
✅ Registro completo de auditoría
✅ Dashboard web con visualización y exportación
✅ Tests unitarios y de integración
✅ Documentación completa
✅ Seguridad mediante RLS
✅ APIs REST escalables

El sistema está listo para producción y puede manejar múltiples puntos PUDO concurrentes con alta disponibilidad.