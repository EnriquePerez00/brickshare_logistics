# Brickshare Logistics — Análisis de Auditoría e Integración
**Versión 1.0 | Fecha: 23/03/2026**

---

## 📊 RESUMEN EJECUTIVO

El sistema de logística de Brickshare está **arquitectado correctamente** con separación clara entre app web de administración y app móvil de escaneo QR. Sin embargo, **existen brechas críticas en auditoría, sincronización bidireccional y manejo de errores** que deben resolverse antes de llevar a producción.

**Estado General**: ✅ 75% implementado correctamente | ⚠️ 25% requiere mejoras

---

## 1. ARQUITECTURA DE COMUNICACIÓN

### 1.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                     BRICKSHARE PRINCIPAL                         │
│              (Web app de alquiler de sets LEGO)                 │
└──────────────┬────────────────────────────────────────────────┘
               │
               │ POST /api/packages/create
               │ (X-Integration-Secret)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│         BRICKSHARE LOGISTICS (Este repositorio)                  │
│                                                                   │
│  ┌─────────────────────────┐    ┌──────────────────────────┐   │
│  │    WEB APP (Next.js)    │    │  MOBILE APP (Expo)       │   │
│  │   - Admin Dashboard     │    │  - QR Scanner            │   │
│  │   - Shipment Manager    │    │  - Barcode Reader        │   │
│  │   - Analytics           │    │  - Receipt Printer       │   │
│  └──────────────┬──────────┘    └──────────────┬───────────┘   │
│                 │                               │                │
│                 └──────────────┬────────────────┘                │
│                                │                                 │
│                    ┌───────────▼────────────┐                   │
│                    │  Supabase + RLS        │                   │
│                    │  ─────────────────     │                   │
│                    │  • packages            │                   │
│                    │  • locations           │                   │
│                    │  • users               │                   │
│                    │  • package_events ❌   │                   │
│                    │  • scan_errors ❌      │                   │
│                    └───────────┬────────────┘                   │
│                                │                                 │
│                    ┌───────────▼────────────┐                   │
│                    │  Edge Functions        │                   │
│                    │  ─────────────────     │                   │
│                    │  • generate-dynamic-qr │                   │
│                    │  • generate-static-qr  │                   │
│                    │  • verify-package-qr   │                   │
│                    └────────────────────────┘                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
               ▲
               │ ❌ WEBHOOK FALTANTE
               │ (estado de packages no notificado)
               │
┌──────────────┴─────────────────────────────────────────────────┐
│              BRICKSHARE PRINCIPAL                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. VALIDACIÓN DE PROCESOS

### ✅ 2.1 Generación de QR — CORRECTO

#### 2.1.1 QR Dinámico (Entregas)
**Función**: `supabase/functions/generate-dynamic-qr/index.ts`

- ✅ **Autenticación**: Requiere JWT de cliente (customer)
- ✅ **Validaciones**:
  - Verifica que el paquete existe
  - Verifica que es tipo `delivery`
  - Verifica que pertenece al usuario
  - Verifica estado = `in_location`
- ✅ **JWT Firma**: HMAC-SHA256 con `QR_JWT_SECRET`
- ✅ **Expiración**: 5 minutos, se regenera automáticamente
- ✅ **Almacenamiento**: Se guarda en BD con `qr_expires_at`

**Flujo Correcto**:
```
Cliente → Brickshare app → Edge Function (authenticated)
→ Genera JWT → Retorna al cliente como QR
→ Cliente muestra QR en PUDO
```

#### 2.1.2 QR Estático (Devoluciones)
**Función**: `supabase/functions/generate-static-return-qr/index.ts`

- ✅ **Autenticación**: Acepta customer JWT o service role
- ✅ **Validaciones**:
  - Verifica que es tipo `return`
  - Verifica estado = `pending_dropoff`
- ✅ **Expiración**: NO expira temporalmente
- ✅ **Invalidación**: Solo se limpia cuando se escanea

**Flujo Correcto**:
```
Cliente → Brickshare app → Edge Function
→ Genera JWT estático → Retorna al cliente
→ Cliente muestra QR en PUDO (válido durante días si es necesario)
```

---

### ✅ 2.2 Lectura/Verificación de QR — CORRECTO

**Función**: `supabase/functions/verify-package-qr/index.ts`

#### Validaciones Implementadas:
1. ✅ **Autenticación del owner**: Verifica JWT y rol = 'owner'
2. ✅ **Verificación de firma JWT**: Valida HMAC-SHA256
3. ✅ **Verificación de expiración**: Rechaza QR dinámico expirado
4. ✅ **Verificación de pertenencia**: Owner solo puede escanear en sus locales
5. ✅ **Validación de transición de estado**:
   - Delivery: `in_location` → `picked_up`
   - Return: `pending_dropoff` → `in_location`
6. ✅ **Limpiar QRs después del uso**: Se ponen a NULL los campos hash

**Respuesta de éxito**:
```json
{
  "success": true,
  "package_id": "uuid",
  "event_type": "delivery_completed|return_received",
  "new_status": "picked_up|in_location",
  "timestamp": "2026-03-23T15:30:00Z"
}
```

---

### ⚠️ 2.3 Comunicación Entre Apps — PARCIALMENTE CORRECTA

#### Web → Móvil
- ❌ No hay comunicación directa (por diseño, correcto)
- ✅ Ambas leen de la misma BD (Supabase)
- ✅ RLS asegura que cada rol ve solo sus datos

#### Móvil → Supabase
**En `apps/mobile/src/screens/ScannerScreen.tsx`**

- ✅ **Recepción de paquetes** (modo dropoff):
  - Lee tracking_code del código de barras del courier
  - Valida que no existe previamente
  - Inserta con estado `in_location`
  - Imprime recibo

- ⚠️ **Entrega de paquetes** (modo pickup):
  - Invoca Edge Function `verify-package-qr`
  - Pero **NO captura ni registra errores de escaneo**
  ```typescript
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Error inesperado');
    // ❌ NO se registra en servidor
  }
  ```

#### Brickshare → Logistics
**En `apps/web/app/api/packages/create/route.ts`**

- ✅ **Autenticación**: Valida `X-Integration-Secret` (shared secret)
- ✅ **Validaciones**:
  - Campos requeridos: `tracking_code`, `type`, `location_id`, `external_shipment_id`
  - Tipo válido: `delivery` o `return`
  - Location existe y está activo
- ✅ **Errores manejados**:
  - 401 Unauthorized (secret inválido)
  - 400 Bad Request (campos faltantes)
  - 404 Not Found (location no existe)
  - 409 Conflict (tracking_code duplicado)
  - 500 Internal Server Error

**Cuerpo de ejemplo**:
```json
{
  "tracking_code": "BSH-2026-001234",
  "type": "delivery",
  "location_id": "e2baeb8e-a2b1-4ce8-b64d-df7b78ca60e8",
  "customer_id": "uuid-del-cliente",
  "external_shipment_id": "SHIPMENT-5678",
  "source_system": "brickshare"
}
```

---

### ❌ 2.4 Sincronización Bidireccional — FALTANTE CRÍTICO

**Problema**: El estado cambia en Logistics pero NO se notifica a Brickshare.

#### Estados Sin Sincronizar:
1. Package llega a PUDO → `pending_dropoff`
2. Owner escanea recepción → `in_location`
3. Customer recoge → `picked_up`
4. Customer inicia devolución → `pending_dropoff` (return)
5. Owner recibe devolución → `in_location`
6. Courier recoge return → `returned`

**Impacto en Brickshare**:
- ❌ No sabe cuándo el set está en el PUDO
- ❌ No sabe si el cliente ya recogió
- ❌ No puede actualizar timeline del shipment
- ❌ No puede notificar al usuario

**Solución requerida** (ver sección 5):
Implementar webhook: Logistics → Brickshare

---

## 3. REGISTRO DE MOVIMIENTOS EN BD

### ✅ 3.1 Tabla `packages` — CORRECTA

| Campo | Tipo | Propósito | Estado |
|-------|------|----------|--------|
| `id` | UUID | PK | ✅ |
| `tracking_code` | TEXT | Identifier humano | ✅ |
| `status` | ENUM | Estado actual | ✅ |
| `type` | TEXT | delivery/return | ✅ |
| `location_id` | UUID | FK a locations | ✅ |
| `customer_id` | UUID | FK a users (nullable) | ⚠️ |
| `dynamic_qr_hash` | TEXT | JWT dinámico | ✅ |
| `static_qr_hash` | TEXT | JWT estático | ✅ |
| `qr_expires_at` | TIMESTAMPTZ | Para dinámico | ✅ |
| `external_shipment_id` | TEXT | ID en Brickshare | ✅ |
| `source_system` | TEXT | Origen (logistics/brickshare) | ✅ |
| `created_at` | TIMESTAMPTZ | Timestamp creación | ✅ |
| `updated_at` | TIMESTAMPTZ | Timestamp actualización | ✅ |

**Problema con `customer_id` nullable**:
```sql
-- Si customer_id es NULL, la RLS policy falla:
CREATE POLICY "packages_customer_select"
  ON public.packages FOR SELECT
  USING (customer_id = auth.uid()); -- Nunca es true si es NULL
```

---

### ❌ 3.2 Tabla `package_events` — FALTANTE CRÍTICO

**No existe tabla de auditoría**. Se pierden:
- ¿Quién escaneó qué paquete?
- ¿Cuándo se escaneó?
- ¿Desde qué dispositivo (IP)?
- ¿Qué errores ocurrieron?
- ¿Se intentó fraude (múltiples escaneos)?

**Migración requerida**:

```sql
CREATE TYPE event_type_enum AS ENUM (
  'qr_generated',
  'qr_scanned_success',
  'qr_scanned_failed',
  'qr_expired',
  'package_created',
  'status_changed',
  'manual_adjustment'
);

CREATE TABLE public.package_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  event_type event_type_enum NOT NULL,
  
  -- Estado antes/después
  old_status package_status,
  new_status package_status,
  
  -- Usuario responsable
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Tipo de QR involucrado
  qr_type TEXT CHECK (qr_type IN ('dynamic', 'static')),
  
  -- Error (si aplica)
  error_code TEXT,
  error_message TEXT,
  
  -- Metadatos flexibles
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  device_info TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_package_events_package_id ON public.package_events(package_id);
CREATE INDEX idx_package_events_event_type ON public.package_events(event_type);
CREATE INDEX idx_package_events_timestamp ON public.package_events(created_at DESC);
CREATE INDEX idx_package_events_performed_by ON public.package_events(performed_by);
```

---

### ❌ 3.3 Tabla `scan_errors` — FALTANTE

**No se registran errores de escaneo en servidor**.

```sql
CREATE TABLE public.scan_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_data TEXT NOT NULL,
  error_type TEXT NOT NULL, -- 'invalid_jwt', 'expired', 'not_found', etc.
  error_message TEXT,
  location_id UUID REFERENCES public.locations(id),
  performed_by UUID REFERENCES public.users(id),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_errors_timestamp ON public.scan_errors(created_at DESC);
CREATE INDEX idx_scan_errors_location ON public.scan_errors(location_id);
```

---

## 4. MANEJO DE ERRORES

### ✅ 4.1 En Edge Functions — BIEN IMPLEMENTADO

**`generate-dynamic-qr`**:
```
✅ 401 - Missing/invalid auth
✅ 400 - Missing package_id
✅ 404 - Package not found
✅ 400 - Not a delivery package
✅ 403 - Package doesn't belong to user
✅ 409 - Package not in correct state
✅ 500 - DB error
```

**`verify-package-qr`**:
```
✅ 401 - Missing/invalid auth, invalid JWT signature
✅ 400 - Missing qr_hash
✅ 400 - Malformed QR payload
✅ 404 - Package/location not found
✅ 403 - Owner doesn't own location
✅ 409 - Package already processed, wrong state
✅ 500 - DB update error
```

---

### ⚠️ 4.2 En App Móvil — INCOMPLETO

**`ScannerScreen.tsx` - Modo Recepción**:
```typescript
// ✅ Valida que tracking_code no existe
// ✅ Inserta en BD
// ⚠️ Pero NO registra lo que pasó
catch (err: any) {
  Alert.alert('Error', err.message);
  // ❌ No hay registro en package_events ni scan_errors
}
```

**Mejora necesaria**:
```typescript
const handleDropoff = async (trackingCode: string) => {
  // ... código existente ...
  
  try {
    // ... validaciones ...
    
    // Registrar evento exitoso
    await supabase.from('package_events').insert({
      package_id: newPackage.id,
      event_type: 'package_created',
      new_status: 'in_location',
      performed_by: user.id,
      location_id: locationId,
      metadata: { source: 'barcode_scan' }
    });
    
  } catch (err: any) {
    // Registrar evento de error
    await supabase.from('scan_errors').insert({
      scanned_data: trackingCode,
      error_type: err.code || 'unknown',
      error_message: err.message,
      location_id: locationId,
      performed_by: user.id
    });
  }
};
```

---

### ⚠️ 4.3 En API de Integración — MODERADO

**`/api/packages/create`**:
```
✅ Valida secret
✅ Valida campos
✅ Maneja duplicados (409)
✅ Maneja location no encontrado (404)
⚠️ Pero NO registra intento fallido en tabla de auditoría
```

---

## 5. FLUJO DE ERRORES Y MITIGACIÓN

### 5.1 QR Expirado

**Escenario**: Cliente genera QR a las 15:00, owner intenta escanear a las 15:06

**Mitigación actual**:
```typescript
// En verify-package-qr
try {
  payload = await verify(qrHash, key) // djwt verifica exp automáticamente
} catch (_err) {
  return errorResponse(401, 'QR code is invalid or has expired')
}
```

✅ **Correcto**, pero falta distinguir entre:
- Firma inválida
- Expirado
- Manipulado

**Mejora**:
```typescript
try {
  payload = await verify(qrHash, key);
} catch (err: any) {
  let errorType = 'invalid_jwt';
  if (err.message.includes('expired')) errorType = 'expired_qr';
  
  // Registrar tipo específico
  await supabaseAdmin.from('scan_errors').insert({
    scanned_data: qrHash.substring(0, 50),
    error_type: errorType,
    error_message: err.message,
    location_id: locationId
  });
  
  return errorResponse(401, 'QR code is invalid or has expired');
}
```

---

### 5.2 Paquete en Estado Inválido

**Escenario**: Owner intenta recoger paquete que ya fue recogido

**Mitigación actual**:
```sql
-- Trigger valida transiciones
CREATE TRIGGER packages_validate_state_transition
  BEFORE UPDATE OF status ON public.packages
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.check_package_state_transition();
```

✅ **Correcto**, Edge Function lo valida y retorna 409

**Mejora**: Registrar intento:
```typescript
if (pkg.status === 'picked_up') {
  await supabaseAdmin.from('package_events').insert({
    package_id: packageId,
    event_type: 'qr_scanned_failed',
    old_status: 'picked_up',
    new_status: 'picked_up', // No cambió
    performed_by: ownerUser.id,
    error_code: 'ALREADY_PICKED_UP',
    location_id: locationId
  });
  return errorResponse(409, 'Package has already been picked up');
}
```

---

### 5.3 Fallo de Conectividad

**Escenario**: Owner escanea, pero pierde conexión antes de guardar

**Mitigación actual**: ❌ No hay retry logic

**Solución recomendada** (en app móvil):
```typescript
const handlePickupWithRetry = async (qrHash: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await supabase.functions.invoke('verify-package-qr', {
        body: { qr_hash: qrHash },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (response.error) throw response.error;
      return response.data;
      
    } catch (err) {
      if (attempt === maxRetries) {
        // Guardar en storage local para retry posterior
        await AsyncStorage.setItem(`pending_scan_${Date.now()}`, qrHash);
        throw err;
      }
      // Esperar antes de reintentar
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
};
```

---

### 5.4 Sincronización Fallida (Brickshare ↔ Logistics)

**Escenario**: Logistics actualiza estado pero Brickshare no lo recibe

**Problema actual**: ❌ No hay mecanismo de webhook/notificación

**Solución requerida**:

#### Opción A: Webhook (Recomendado para baja latencia)
```typescript
// En verify-package-qr, después de actualizar estado
if (pkg.source_system === 'brickshare' && pkg.external_shipment_id) {
  const webhookPayload = {
    event_type: eventType, // 'delivery_completed' o 'return_received'
    package_id: packageId,
    external_shipment_id: pkg.external_shipment_id,
    new_status: newStatus,
    timestamp: timestamp,
    location: {
      id: locationId,
      name: location.name
    }
  };
  
  try {
    const response = await fetch(Deno.env.get('BRICKSHARE_WEBHOOK_URL')!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': Deno.env.get('BRICKSHARE_WEBHOOK_SECRET')!
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (!response.ok) {
      // Guardar fallo para retry posterior
      console.error(`Webhook failed: ${response.statusText}`);
      // TODO: Implementar retry queue
    }
  } catch (err) {
    console.error('Webhook error:', err);
    // TODO: Dead letter queue
  }
}
```

#### Opción B: Polling (Para Brickshare)
Brickshare consulta estado periódicamente:
```sql
-- En Brickshare, cada 30 seg:
SELECT status, updated_at 
FROM logistics.packages 
WHERE external_shipment_id IN (...)
  AND updated_at > last_sync_time
```

---

## 6. RECOMENDACIONES PRIORIZADAS

### 🔴 **CRÍTICO - Implementar antes de producción (Semana 1)**

1. **Crear tabla `package_events` y triggers de auditoría**
   - Registrar CADA cambio de estado
   - Registrar quién, cuándo, desde dónde
   - **Impacto**: Trazabilidad completa para debugging y cumplimiento

2. **Implementar webhook Logistics → Brickshare**
   - Notificar cambios de estado en tiempo real
   - Implementar retry con exponential backoff
   - Dead letter queue para fallos persistentes
   - **Impacto**: Sincronización correcta del ciclo de vida

3. **Validar `customer_id` obligatorio para packages de Brickshare**
   - En `/api/packages/create`: rejechar si `source_system='brickshare'` y `customer_id` es NULL
   - **Impacto**: RLS policies funcionan correctamente

4. **Mejorar manejo de errores en app móvil**
   - Registrar cada error en `scan_errors`
   - Implementar retry logic para fallos de conectividad
   - **Impacto**: Datos para debugging, mejor UX

---

### 🟡 **IMPORTANTE - Implementar en Fase 2 (Semana 2)**

5. **Crear tabla `scan_errors` para análisis**
   - Detectar patrones de escaneos fallidos
   - Analytics de QR inválidos
   - **Impacto**: Data-driven improvements

6. **Implementar rate limiting en Edge Functions**
   - Máx 10 intentos de escaneo fallido por location por hora
   - Alertar si hay spike de intentos
   - **Impacto**: Seguridad contra brute force

7. **Documentar proceso de rotación de `QR_JWT_SECRET`**
   - Clave debe ser ≥256 bits
   - Especificar cómo actualizar sin romper QRs en vuelo
   - **Impacto**: Seguridad a largo plazo

8. **Crear vista materializada para analytics**
   - Pre-calcular métricas diarias por location
   - Dashboard de rentabilidad en tiempo real
   - **Impacto**: Admin puede monitorear negocio

---

### 🟢 **MEJORA - Para futuras versiones**

9. Implementar JWT con `jti` (nonce) para prevenir replay attacks
10. Geolocalización del escaneo (IP, GPS si es posible)
11. Dashboard en tiempo real de escaneos
12. Tests E2E automatizados del flujo completo
13. Circuit breaker para webhook fallido

---

## 7. CHECKLIST DE VALIDACIÓN

### ✅ Antes de llevar a staging

- [ ] Tabla `package_events` creada con triggers
- [ ] Tabla `scan_errors` creada
- [ ] Webhook implementado y testeado con Brickshare
- [ ] `customer_id` validado como obligatorio
- [ ] App móvil registra errores en `scan_errors`
- [ ] Rate limiting implementado
- [ ] `QR_JWT_SECRET` documentado (mín 256 bits)
- [ ] Tests de integración E2E del flujo completo
- [ ] Documentación de API de integración actualizada
- [ ] Variables de entorno en `.env.example` completas

### ✅ Antes de ir a producción

- [ ] Load testing: 1000 QR/min sin degradación
- [ ] Backup/restore de BD testeado
- [ ] Plan de disaster recovery documentado
- [ ] Monitoreo y alertas configurados
- [ ] SLA documentado (RPO, RTO)
- [ ] Políticas de retención de logs definidas
- [ ] Auditoría de seguridad independiente completada
- [ ] Certificados SSL/TLS configurados
- [ ] CORS políticas restringidas
- [ ] Rate limiting en todas las APIs

---

## 8. REFERENCIAS

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/001_schema.sql` | Esquema base |
| `supabase/migrations/006_add_external_integration.sql` | Integración externa |
| `supabase/functions/generate-dynamic-qr/index.ts` | Generación QR dinámico |
| `supabase/functions/generate-static-return-qr/index.ts` | Generación QR estático |
| `supabase/functions/verify-package-qr/index.ts` | Verificación QR |
| `apps/web/app/api/packages/create/route.ts` | API de integración |
| `apps/mobile/src/screens/ScannerScreen.tsx` | App de escaneo |

---

## 9. CONCLUSIÓN

**Estado actual**: El sistema de logística está **correctamente arquitectado** para el MVP. Los procesos de generación y lectura de QR son sólidos y las validaciones funcionan bien.

**Brecha principal**: **Falta completa de auditoría y sincronización bidireccional**. Esto es crítico para:
- Debugging en producción
- Cumplimiento regulatorio
- Experiencia correcta del usuario en Brickshare principal
- Detección de fraude

**Recomendación**: Implementar los 4 items críticos (sección 6) ANTES de llevar a producción. El esfuerzo estimado es **3-5 días de desarrollo**.

---

**Documento preparado**: 23/03/2026
**Próxima revisión**: Después de implementar recomendaciones críticas