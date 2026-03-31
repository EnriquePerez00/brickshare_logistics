# 🏗️ Implementación de Arquitectura Dual Database

**Fecha:** 31 de Marzo de 2026  
**Estado:** ✅ **IMPLEMENTADO**

---

## 📊 Arquitectura Dual Database

La aplicación usa **DOS bases de datos** con roles claramente definidos:

### 🌩️ **BD CLOUD (Logistics - Supabase Cloud)**
**URL:** `https://qumjzvhtotcvnzpjgjkl.supabase.co`

**Responsabilidades:**
- ✅ **Autenticación** (auth.users)
- ✅ **Ubicaciones PUDO** (locations)
- ✅ **Registro de paquetes** (packages)
- ✅ **Eventos de auditoría** (package_events)
- ✅ **Logs de escaneos** (pudo_scan_logs)
- ✅ **Dashboard web** lee de aquí

### 🏠 **BD LOCAL (Brickshare - Desarrollo)**
**URL:** `http://127.0.0.1:54421` (via túnel ngrok en producción)

**Responsabilidades:**
- ✅ **Validación de QR** (shipments.delivery_qr_code)
- ✅ **Actualización de estado** (shipments.shipment_status)
- ✅ **Timestamp de validación** (shipments.delivery_validated_at)
- ✅ **Datos maestros de envíos** (tabla shipments)

---

## 🔄 Flujo Completo del Escaneo QR

### **1. Usuario Abre la App Móvil**
```
App Móvil → BD CLOUD → Autenticación
```
- Login con email/password
- BD: **CLOUD**
- Tabla: `auth.users`

### **2. Usuario Escanea QR: `BS-DEL-714C3F3D-FFD`**
```
App Móvil → Edge Function (Cloud) → Inicia proceso
```

### **3. Edge Function: Validación en BD Local**
```typescript
// PASO 3A: Buscar en shipments
SELECT id, delivery_qr_code, shipment_status, tracking_number
FROM shipments
WHERE delivery_qr_code = 'BS-DEL-714C3F3D-FFD'
```
- BD: **LOCAL** (via ngrok)
- Si NO existe → ❌ Error: "QR no válido o destino equivocado"
- Si existe → Continuar

### **4. Edge Function: Validar Estado**
```typescript
// PASO 4: Verificar estado
if (shipment.shipment_status !== 'in_transit_pudo') {
  return Error('Estado inválido')
}
```
- Estado esperado: `in_transit_pudo`
- Si estado diferente → ❌ Error con mensaje del estado actual

### **5. Edge Function: Actualizar en BD Local**
```typescript
// PASO 5: Actualizar shipment
UPDATE shipments SET
  shipment_status = 'delivered_pudo',
  delivery_validated_at = NOW(),
  updated_at = NOW()
WHERE id = shipment.id
```
- BD: **LOCAL** (via ngrok)
- Nuevo estado: `delivered_pudo`
- Timestamp guardado

### **6. Edge Function: Registrar en BD Cloud**
```typescript
// PASO 6A: Crear package
INSERT INTO packages (
  tracking_code,
  status,
  location_id,
  external_shipment_id,
  ...
)

// PASO 6B: Crear evento
INSERT INTO package_events (
  package_id,
  event_type,
  performed_by,
  ...
)

// PASO 6C: Crear log
INSERT INTO pudo_scan_logs (
  pudo_location_id,
  remote_shipment_id,
  previous_status,
  new_status,
  ...
)
```
- BD: **CLOUD**
- Tablas: `packages`, `package_events`, `pudo_scan_logs`

### **7. Dashboard Web Muestra el Paquete**
```
Dashboard Web → BD CLOUD → SELECT * FROM packages
```
- BD: **CLOUD**
- Vista: `pudo_active_packages_enhanced`
- Muestra paquetes en tiempo real

---

## 📂 Archivos Modificados

### **1. Edge Function**
**Archivo:** `supabase/functions/process-pudo-scan/index.ts`

**Cambios principales:**
```typescript
// ANTES: Solo usaba BD Local para todo
const supabaseAdmin = createClient(LOCAL_URL, LOCAL_KEY)

// DESPUÉS: Usa ambas BDs con roles específicos
const cloudSupabase = createClient(CLOUD_URL, CLOUD_KEY)  // Auth y logs
const localSupabase = createClient(LOCAL_URL, LOCAL_KEY)   // Validación shipments
```

**Nueva lógica:**
1. ✅ Valida `delivery_qr_code` existe
2. ✅ Valida `shipment_status = 'in_transit_pudo'`
3. ✅ Actualiza `shipment_status = 'delivered_pudo'`
4. ✅ Registra en Cloud (packages, events, logs)

### **2. App Móvil**
**Archivo:** `apps/mobile/.env.local`

**Cambios:**
```bash
# ANTES: Puerto incorrecto
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54331  ❌

# DESPUÉS: Puerto correcto
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54421  ✅
```

### **3. Dashboard Web**
**Sin cambios necesarios** - Ya lee correctamente de BD Cloud

---

## 🔐 Variables de Entorno

### **Edge Function** (`supabase/functions/process-pudo-scan/.env.local`)

```bash
# BD CLOUD (Logistics)
SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# BD LOCAL (Brickshare via ngrok)
REMOTE_DB_URL=https://xxxx.ngrok.io          # ← TÚNEL NGROK
REMOTE_DB_SERVICE_KEY=eyJ...                  # ← Service role de Brickshare

# Modo desarrollo (bypass validaciones)
DEV_MODE=true                                 # ← Solo en desarrollo
```

### **App Móvil** (`apps/mobile/.env.local`)

```bash
# BD CLOUD (para auth y Edge Functions)
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# BD LOCAL (acceso directo desde emulador)
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54421  # ← Puerto correcto
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=eyJ...

# Modo desarrollo
EXPO_PUBLIC_DEV_MODE=true
```

---

## 🧪 Testing

### **Prerequisitos:**

1. ✅ Supabase local corriendo en puerto 54421
2. ✅ Tabla `shipments` existe en BD Local con:
   - `delivery_qr_code` VARCHAR
   - `shipment_status` VARCHAR
   - `delivery_validated_at` TIMESTAMP
3. ✅ Ngrok configurado (solo para producción)
4. ✅ Datos de test en `shipments`:
   ```sql
   INSERT INTO shipments (
     delivery_qr_code,
     shipment_status,
     tracking_number,
     user_id
   ) VALUES (
     'BS-DEL-714C3F3D-FFD',
     'in_transit_pudo',
     'TRACK-123',
     'user-uuid'
   );
   ```

### **Prueba Manual:**

```bash
# 1. Iniciar Supabase local
npx supabase start

# 2. Iniciar app móvil
cd apps/mobile
npx expo start

# 3. En el emulador:
- Login con test@example.com
- Escanear QR: BS-DEL-714C3F3D-FFD
- Verificar mensaje de éxito

# 4. Verificar en BD Local:
curl "http://127.0.0.1:54421/rest/v1/shipments?delivery_qr_code=eq.BS-DEL-714C3F3D-FFD&select=shipment_status" \
  -H "apikey: eyJ..."

# Debe retornar: shipment_status = "delivered_pudo"

# 5. Verificar en Dashboard:
# Abrir http://localhost:3000/dashboard
# Debe aparecer el paquete en "Paquetes Activos"
```

---

## 🚨 Troubleshooting

### **Error: "QR no válido o destino equivocado"**

**Causa:** El QR no existe en `shipments.delivery_qr_code`

**Solución:**
```sql
-- Verificar en BD Local
SELECT * FROM shipments 
WHERE delivery_qr_code = 'BS-DEL-714C3F3D-FFD';

-- Si no existe, insertar:
INSERT INTO shipments (delivery_qr_code, shipment_status, tracking_number)
VALUES ('BS-DEL-714C3F3D-FFD', 'in_transit_pudo', 'TRACK-123');
```

### **Error: "Estado inválido"**

**Causa:** El `shipment_status` no es `in_transit_pudo`

**Solución:**
```sql
-- Actualizar estado manualmente
UPDATE shipments 
SET shipment_status = 'in_transit_pudo'
WHERE delivery_qr_code = 'BS-DEL-714C3F3D-FFD';
```

### **Dashboard no muestra paquetes**

**Causa:** Dashboard lee de Cloud, pero paquete se creó en Local

**Verificación:**
```bash
# Verificar en Cloud
curl "https://qumjzvhtotcvnzpjgjkl.supabase.co/rest/v1/packages?select=*" \
  -H "apikey: eyJ..."

# Si está vacío, la Edge Function no ejecutó correctamente el paso 7
# Ver logs de la Edge Function
```

### **Error de conexión a BD Local**

**Causa:** Puerto incorrecto o Supabase local no está corriendo

**Solución:**
```bash
# Verificar puerto
npx supabase status | grep "API URL"

# Debe mostrar: http://127.0.0.1:54421

# Si no está corriendo
npx supabase start
```

---

## 📋 Checklist de Implementación

- [x] Edge Function modificada con lógica dual DB
- [x] Validación de `delivery_qr_code` en BD Local
- [x] Validación de `shipment_status = 'in_transit_pudo'`
- [x] Actualización de estado en BD Local
- [x] Registro de logs en BD Cloud
- [x] App móvil apunta a puerto correcto (54421)
- [x] Dashboard lee correctamente de Cloud
- [ ] Ngrok configurado para producción
- [ ] Datos de test en tabla `shipments`
- [ ] Pruebas E2E completadas

---

## 🎯 Próximos Pasos

1. **Configurar ngrok** para acceso remoto a BD Local
2. **Seed data** en tabla `shipments` con QR de prueba
3. **Probar flujo completo** con app móvil
4. **Verificar dashboard** muestra paquetes
5. **Documentar casos de error** y manejo

---

**Generado:** 2026-03-31 10:44  
**Autor:** Cline Assistant  
**Versión:** 1.0