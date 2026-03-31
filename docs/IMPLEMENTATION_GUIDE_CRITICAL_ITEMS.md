# Brickshare Logistics — Guía de Implementación (4 Temas Críticos)

**Fecha**: 23/03/2026  
**Estado**: Paso a paso para llevar a producción

---

## 🎯 Resumen de los 4 Temas Críticos

| # | Tema | Archivo | Estado | Esfuerzo |
|---|------|---------|--------|----------|
| 1️⃣ | Tabla `package_events` + auditoría | `007_add_audit_tables.sql` | ✅ LISTO | 30 min |
| 2️⃣ | Webhook Logistics → Brickshare | `verify-package-qr/index.ts.updated` | ✅ LISTO | 30 min |
| 3️⃣ | Validación `customer_id` obligatorio | `packages/create/route.ts` | ⏳ PENDIENTE | 15 min |
| 4️⃣ | Error handling en app móvil | `ScannerScreen.tsx` | ⏳ PENDIENTE | 30 min |

**Tiempo total estimado: 1.5-2 horas**

---

## 📋 PASO 1: Aplicar Migración de Auditoría

### ✅ Archivo Generado
- **Ruta**: `../Brickshare_logistics/supabase/migrations/007_add_audit_tables.sql`
- **Contenido**: Tablas `package_events` y `scan_errors` + funciones RPC

### 📝 Pasos de Implementación

#### 1.1 En tu terminal local

```bash
cd ../Brickshare_logistics

# Ver estado actual de migraciones
supabase migration list

# Aplicar la nueva migración
supabase db push

# Verificar que se creó correctamente
supabase db execute 'SELECT COUNT(*) FROM information_schema.tables WHERE table_name = "package_events"'
```

#### 1.2 Verificar que las funciones RPC están accesibles

```sql
-- Conectar a la BD local y probar

-- Test 1: Función log_package_event
SELECT public.log_package_event(
  'test-package-uuid',
  'qr_generated'::event_type_enum
);

-- Test 2: Función log_scan_error
SELECT public.log_scan_error(
  'QR_DATA_SAMPLE',
  'invalid_jwt'
);

-- Test 3: Vista audit_summary
SELECT * FROM public.audit_summary LIMIT 5;
```

#### 1.3 Configurar limpieza de logs (opcional pero recomendado)

```sql
-- Crear job de limpieza automática (cada semana)
-- En Supabase con cron si está disponible, o con script externo

-- Script manual para ejecutar semanalmente:
-- SELECT * FROM public.cleanup_old_audit_logs(90);
```

---

## 📋 PASO 2: Actualizar Edge Function de Verificación QR

### ✅ Archivo Generado
- **Ruta**: `../Brickshare_logistics/supabase/functions/verify-package-qr/index.ts.updated`
- **Cambios**: 
  - Registra eventos en `package_events`
  - Registra errores en `scan_errors`
  - Implementa webhook a Brickshare con reintentos

### 📝 Pasos de Implementación

#### 2.1 Reemplazar función actual

```bash
cd ../Brickshare_logistics

# Backup de la función actual
cp supabase/functions/verify-package-qr/index.ts \
   supabase/functions/verify-package-qr/index.ts.backup

# Copiar versión mejorada
cp supabase/functions/verify-package-qr/index.ts.updated \
   supabase/functions/verify-package-qr/index.ts
```

#### 2.2 Añadir variables de entorno requeridas

**En `.env.local` (desarrollo local)**:
```bash
# Webhook de notificación a Brickshare
BRICKSHARE_WEBHOOK_URL=http://localhost:3000/api/webhooks/logistics-package-status
BRICKSHARE_WEBHOOK_SECRET=your_webhook_secret_key_min_32_chars

# Clave JWT para QR (debe ser >= 256 bits / 32 bytes en base64)
# Generar si no existe:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
QR_JWT_SECRET=your_qr_jwt_secret_key_min_32_bytes
```

**En Supabase (producción)**:
```bash
# Configurar en:
# Supabase Dashboard → Project → Settings → Edge Functions → Environment Variables

# Añadir:
BRICKSHARE_WEBHOOK_URL=https://api.brickshare.com/webhooks/logistics-status
BRICKSHARE_WEBHOOK_SECRET=production_webhook_secret
QR_JWT_SECRET=production_qr_jwt_secret
```

#### 2.3 Deployar la Edge Function

```bash
# Deployar a Cloud
supabase functions deploy verify-package-qr

# Verificar que funciona
curl -X POST https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/verify-package-qr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qr_hash": "test_jwt_token"}'
```

#### 2.4 Prueba de auditoría

```bash
# Después de escanear un paquete, verificar logs:
curl -X GET https://qumjzvhtotcvnzpjgjkl.supabase.co/rest/v1/package_events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Debe retornar eventos registrados
```

---

## 📋 PASO 3: Validar customer_id Obligatorio

### ⏳ Implementación Pendiente
- **Archivo**: `../Brickshare_logistics/apps/web/app/api/packages/create/route.ts`
- **Cambio**: Hacer `customer_id` obligatorio para packages de Brickshare

### 📝 Pasos de Implementación

#### 3.1 Actualizar validación de entrada

**Buscar la sección de validación (línea ~50)** y reemplazar:

```typescript
// ANTES:
if (!req.body.location_id || !req.body.type) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}

// DESPUÉS:
if (!req.body.location_id || !req.body.type) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}

// Nueva validación: customer_id obligatorio si viene de Brickshare
if (req.body.source_system === 'brickshare' || !req.body.source_system) {
  if (!req.body.customer_id) {
    return NextResponse.json(
      { error: 'customer_id is required for packages from Brickshare' },
      { status: 400 }
    )
  }
}
```

#### 3.2 Actualizar documentación de API

**En README o documentación de API**, añadir:

```markdown
### POST /api/packages/create

#### Campos Requeridos

| Campo | Tipo | Requerido | Notas |
|-------|------|----------|-------|
| `tracking_code` | string | ✅ | ID humano del paquete |
| `type` | enum | ✅ | 'delivery' o 'return' |
| `location_id` | UUID | ✅ | ID del punto PUDO |
| `customer_id` | UUID | ✅ | ID del cliente (obligatorio) |
| `external_shipment_id` | string | ✅ | ID del shipment en Brickshare |
| `source_system` | string | ✅ | 'brickshare' |

#### Ejemplo

```json
{
  "tracking_code": "BSH-2026-001234",
  "type": "delivery",
  "location_id": "e2baeb8e-a2b1-4ce8-b64d-df7b78ca60e8",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_shipment_id": "SHIPMENT-5678",
  "source_system": "brickshare"
}
```
```

#### 3.3 Prueba

```bash
# Prueba SIN customer_id (debe fallar con 400)
curl -X POST http://localhost:3000/api/packages/create \
  -H "X-Integration-Secret: $(echo -n 'brickshare_api_key' | sha256sum)" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_code": "BSH-2026-001234",
    "type": "delivery",
    "location_id": "e2baeb8e-a2b1-4ce8-b64d-df7b78ca60e8",
    "external_shipment_id": "SHIPMENT-5678",
    "source_system": "brickshare"
  }'
# Esperado: 400 Bad Request

# Prueba CON customer_id (debe funcionar)
curl -X POST http://localhost:3000/api/packages/create \
  -H "X-Integration-Secret: $(echo -n 'brickshare_api_key' | sha256sum)" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_code": "BSH-2026-001234",
    "type": "delivery",
    "location_id": "e2baeb8e-a2b1-4ce8-b64d-df7b78ca60e8",
    "customer_id": "550e8400-e29b-41d4-a716-446655440000",
    "external_shipment_id": "SHIPMENT-5678",
    "source_system": "brickshare"
  }'
# Esperado: 201 Created
```

---

## 📋 PASO 4: Mejorar Manejo de Errores en App Móvil

### ⏳ Implementación Pendiente
- **Archivo**: `../Brickshare_logistics/apps/mobile/src/screens/ScannerScreen.tsx`
- **Cambio**: Registrar errores en tabla `scan_errors`

### 📝 Pasos de Implementación

#### 4.1 Actualizar función handlePickupWithRetry

**Buscar la función `handlePickupWithRetry` (línea ~200)** y actualizar:

```typescript
const handlePickupWithRetry = async (qrHash: string, maxRetries = 3) => {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await supabase.functions.invoke('verify-package-qr', {
        body: { qr_hash: qrHash },
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      
      if (response.error) {
        throw response.error
      }

      // Éxito
      lastError = null
      return response.data
      
    } catch (err: any) {
      lastError = err
      
      // Registrar intento fallido en servidor
      if (attempt === maxRetries) {
        try {
          await supabase.from('scan_errors').insert({
            scanned_data: qrHash.substring(0, 100),
            error_type: err.message?.includes('expired') ? 'expired_qr' : 'unknown_error',
            error_message: err.message,
            location_id: locationId,
            performed_by: user.id,
            user_agent: 'React Native Mobile App',
            metadata: {
              retry_attempts: attempt,
              error_code: err.code
            }
          })
        } catch (logErr) {
          console.error('Failed to log scan error:', logErr)
        }
      }
      
      if (attempt < maxRetries) {
        // Esperar antes de reintentar
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }
  
  throw lastError || new Error('Failed to scan QR after retries')
}
```

#### 4.2 Actualizar función handleDropoff

**Buscar la función `handleDropoff` (línea ~120)** y mejorar error handling:

```typescript
const handleDropoff = async (trackingCode: string) => {
  try {
    // ... código existente de validación ...
    
    // Registrar evento exitoso
    await supabase.from('package_events').insert({
      package_id: newPackage.id,
      event_type: 'package_created',
      new_status: 'in_location',
      performed_by: user.id,
      location_id: locationId,
      metadata: {
        source: 'barcode_scan',
        tracking_code: trackingCode
      }
    }).catch(e => console.error('Failed to log event:', e))
    
    // Mostrar confirmación
    Alert.alert('Éxito', `Paquete ${trackingCode} recibido`)
    printReceipt(trackingCode)
    
  } catch (err: any) {
    // Registrar evento de error
    try {
      await supabase.from('scan_errors').insert({
        scanned_data: trackingCode,
        error_type: err.code || 'unknown_error',
        error_message: err.message,
        location_id: locationId,
        performed_by: user.id,
        user_agent: 'React Native Mobile App',
        metadata: {
          operation_type: 'dropoff',
          error_context: err.context
        }
      })
    } catch (logErr) {
      console.error('Failed to log scan error:', logErr)
    }
    
    Alert.alert('Error', err.message || 'Error inesperado al procesar paquete')
  }
}
```

#### 4.3 Actualizar función handlePickup

**Buscar la función `handlePickup` (línea ~250)** y mejorar manejo:

```typescript
const handlePickup = async (qrHash: string) => {
  try {
    const result = await handlePickupWithRetry(qrHash)
    
    // Registrar éxito
    await supabase.from('package_events').insert({
      package_id: result.package_id,
      event_type: 'qr_scanned_success',
      performed_by: user.id,
      location_id: locationId,
      metadata: {
        source: 'qr_scan_mobile',
        event_type: result.event_type
      }
    }).catch(e => console.error('Failed to log event:', e))
    
    Alert.alert(
      'Éxito',
      `${result.event_type === 'delivery_completed' ? 'Entrega' : 'Devolución'} confirmada`
    )
    printReceipt(result.tracking_code)
    
  } catch (err: any) {
    // El error ya fue registrado en handlePickupWithRetry
    Alert.alert('Error', err.message || 'Error al verificar QR')
  }
}
```

#### 4.4 Prueba

```bash
# Verificar que los errores se registran:
# 1. Escanear QR inválido en app móvil
# 2. Revisar tabla scan_errors en BD:

curl -X GET https://qumjzvhtotcvnzpjgjkl.supabase.co/rest/v1/scan_errors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Debe aparecer registro con:
# - error_type: 'invalid_jwt' o 'expired_qr'
# - performed_by: ID del operador
# - ip_address: IP de la app
# - user_agent: 'React Native Mobile App'
```

---

## 🔐 Variables de Entorno Requeridas

### Desarrollo Local

Añadir a `.env.local`:

```bash
# Edge Functions
BRICKSHARE_WEBHOOK_URL=http://localhost:3000/api/webhooks/logistics-package-status
BRICKSHARE_WEBHOOK_SECRET=dev_webhook_secret_min_32_chars_dev_webhook_secret_min_32_chars
QR_JWT_SECRET=dev_qr_jwt_secret_min_32_bytes_dev_qr_jwt_secret_min_32_bytes

# PUDO API Integration
CORREOS_API_USER=your_correos_user
CORREOS_API_PASSWORD=your_correos_password
CORREOS_SENDER_CODE=your_sender_code

# Supabase Cloud
SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Producción

En Supabase Dashboard → Project → Settings:

```bash
BRICKSHARE_WEBHOOK_URL=https://api.brickshare.com/webhooks/logistics-package-status
BRICKSHARE_WEBHOOK_SECRET=prod_webhook_secret_secure_value
QR_JWT_SECRET=prod_qr_jwt_secret_secure_value
```

---

## ✅ Checklist de Implementación

- [ ] **Paso 1**: Aplicar migración `007_add_audit_tables.sql`
  - [ ] `supabase db push` ejecutado exitosamente
  - [ ] Tablas `package_events` y `scan_errors` creadas
  - [ ] Funciones RPC `log_package_event` y `log_scan_error` funcionan
  
- [ ] **Paso 2**: Actualizar Edge Function `verify-package-qr`
  - [ ] Archivo reemplazado (backup hecho)
  - [ ] Variables de entorno configuradas
  - [ ] `supabase functions deploy` ejecutado
  - [ ] Prueba de escaneo QR registra evento en `package_events`
  - [ ] Webhook a Brickshare se intenta enviar

- [ ] **Paso 3**: Validar `customer_id` obligatorio
  - [ ] Código actualizado en `/api/packages/create`
  - [ ] Prueba SIN customer_id retorna 400
  - [ ] Prueba CON customer_id retorna 201
  - [ ] Documentación de API actualizada

- [ ] **Paso 4**: Mejorar error handling en app móvil
  - [ ] Función `handlePickupWithRetry` actualizada
  - [ ] Función `handleDropoff` registra errores
  - [ ] Función `handlePickup` registra eventos
  - [ ] Prueba: errores de escaneo aparecen en `scan_errors`

- [ ] **Verificación Final**
  - [ ] Flujo completo: creación → recepción → escaneo QR
  - [ ] Todos los eventos registrados en `package_events`
  - [ ] Todos los errores registrados en `scan_errors`
  - [ ] Webhook enviado a Brickshare correctamente
  - [ ] RLS policies funcionan para admins y owners

---

## 📞 Troubleshooting

### Error: "Função log_package_event não existe"
```bash
# Solución: Verificar que la migración se aplicó
supabase migration list
supabase db push
```

### Error: "Webhook failed after 3 retries"
```bash
# Verificar que la URL de Brickshare es correcta
# Verificar que BRICKSHARE_WEBHOOK_URL está configurado
# Revisar logs en Supabase: https://supabase.com/dashboard/project/*/functions
```

### Error: "customer_id is required"
```bash
# Asegurarse que está enviando customer_id en el request
# Ver ejemplo en Paso 3.3
```

---

## 📚 Documentación Relacionada

- `AUDIT_AND_INTEGRATION_ANALYSIS.md` — Análisis completo
- `deposit_points_api.md` — API de puntos PUDO
- `verify-package-qr/index.ts.updated` — Edge Function mejorada
- `007_add_audit_tables.sql` — Migración de BD

**Próximos pasos**: Una vez completados estos 4 items críticos, la arquitectura estará lista para staging.