# Diagnóstico y Corrección del Flujo PUDO Dropoff

## Problema Reportado

Al escanear el código `BS-DEL-7A2D335C-8FA` desde el simulador:
1. No se registra el "alta" en el stock del establecimiento `brickshare-001`
2. No se actualiza el campo `shipment_status` en la BD remota de brickshare

## Causa Raíz — 3 Bugs Críticos

### Bug 1: Nombre de columna incorrecto para búsqueda
**Archivo:** `supabase/functions/process-pudo-scan/index.ts`

| Antes (INCORRECTO) | Después (CORRECTO) |
|---|---|
| `.eq('tracking_code', scanned_code)` | `.eq('tracking_number', scanned_code)` |

La tabla `shipments` en brickshare tiene la columna `tracking_number`, no `tracking_code`.
El shipment nunca se encontraba en la BD remota → no se creaba el package local ni se actualizaba el status.

### Bug 2: Campo de status incorrecto
**Archivos:** `process-pudo-scan/index.ts` y `update-remote-shipment-status/index.ts`

| Antes (INCORRECTO) | Después (CORRECTO) |
|---|---|
| `shipment.shipping_status` | `shipment.shipment_status` |
| `.update({ shipping_status: 'delivered_pudo' })` | `.update({ shipment_status: 'delivered_pudo' })` |

La columna se llama `shipment_status`, no `shipping_status`.

### Bug 3: Tabla inexistente como fallback
**Archivo:** `update-remote-shipment-status/index.ts`

| Antes (INCORRECTO) | Después (CORRECTO) |
|---|---|
| `.from('shipment_status').update(...)` | `.from('shipments').update(...)` |

No existe una tabla `shipment_status`. El estado es una **columna** en la tabla `shipments`.

### Bug 4: Columnas de fallback inexistentes
**Archivo:** `process-pudo-scan/index.ts`

El código buscaba en columnas `reference_code`, `barcode`, `external_reference` que no existen en brickshare.
Se reemplazó por búsqueda en `brickshare_package_id` y por `id` (UUID).

## Esquema Real de brickshare (BD dev)

```
Tabla: public.shipments
├── id (uuid, PK)
├── user_id (uuid, NOT NULL, FK → auth.users)
├── tracking_number (text) ← código escaneado
├── shipment_status (text, NOT NULL) ← campo a actualizar
├── brickshare_pudo_id (text) ← ID del punto PUDO
├── brickshare_package_id (text) ← referencia del paquete
├── shipping_address, shipping_city, shipping_zip_code
├── pickup_type (text, default 'correos')
└── ...42 columnas total
```

### Status válidos (constraint `check_shipment_status`):
- `pending`, `preparation`
- `in_transit_pudo` → estado al salir hacia PUDO
- **`delivered_pudo`** → estado al llegar al PUDO ✅
- `delivered_user` → recogido por usuario final
- `in_return_pudo` → devuelto al PUDO
- `returned` → devuelto a almacén central
- `cancelled`

## Variables de Entorno Configuradas

```bash
# supabase/.env.local
REMOTE_DB_URL=http://host.docker.internal:54331    # API de brickshare dev (desde Docker)
REMOTE_DB_SERVICE_KEY=sb_secret_N7UND0UgjKTVK-...  # Service role key de brickshare dev
```

> `host.docker.internal` es necesario porque las Edge Functions corren dentro de Docker
> y necesitan acceder al puerto 54331 del host.

## Infraestructura Local

| Componente | Contenedor | Puerto Host |
|---|---|---|
| Brickshare Dev API (Kong) | `supabase_kong_Brickshare` | 54331 |
| Brickshare Dev DB (Postgres) | `supabase_db_Brickshare` | 5433 |
| Brickshare Prod DB | `supabase_db_prod` | 5432 |

## Dato de Prueba Insertado

```sql
-- En BD brickshare dev (puerto 5433)
INSERT INTO public.shipments (
  user_id, tracking_number, shipment_status,
  shipping_address, shipping_city, shipping_zip_code,
  pickup_type, brickshare_pudo_id, brickshare_package_id
) VALUES (
  '37429d55-...', 'BS-DEL-7A2D335C-8FA', 'in_transit_pudo',
  'C/ Gran Vía 28, 3ºA', 'Madrid', '28013',
  'brickshare', 'brickshare-001', 'BS-DEL-7A2D335C-8FA'
);
-- ID generado: 4e58b5c7-8254-4730-9933-0bcf993cc762
```

## Flujo Corregido

```
Mobile App → Escanea "BS-DEL-7A2D335C-8FA"
    │
    ▼
process-pudo-scan Edge Function
    │
    ├─ 1. Autentica operador PUDO (BD cloud logistics)
    ├─ 2. Busca en BD remota brickshare:
    │     SELECT * FROM shipments WHERE tracking_number = 'BS-DEL-7A2D335C-8FA'
    │     ✅ Ahora ENCUENTRA el shipment (antes fallaba por usar tracking_code)
    ├─ 3. Crea package en BD local logistics (status: in_location)
    ├─ 4. Actualiza BD remota brickshare:
    │     UPDATE shipments SET shipment_status = 'delivered_pudo' WHERE id = ...
    │     ✅ Ahora ACTUALIZA correctamente (antes fallaba por usar shipping_status)
    └─ 5. Registra log en pudo_scan_logs
```

## Próximos Pasos para Testing

1. Levantar `supabase functions serve` en Brickshare_logistics
2. Apuntar el simulador móvil a las funciones locales
3. Escanear `BS-DEL-7A2D335C-8FA`
4. Verificar:
   - ✅ Package creado en BD logistics con `status = 'in_location'`
   - ✅ Shipment en BD brickshare con `shipment_status = 'delivered_pudo'`
   - ✅ Log en `pudo_scan_logs` con `api_request_successful = true`