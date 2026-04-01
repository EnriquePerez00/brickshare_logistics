# 📱 Guía de Ejecución - App Android

**Fecha:** 31 de Marzo de 2026  
**Estado:** ✅ **ACTUALIZADA CON ARQUITECTURA DUAL DB**

---

## 🎯 Comando para Ejecutar la App Android en el Emulador

```bash
cd apps/mobile
npx expo start
```

Luego presiona `a` para abrir en Android, o escanea el QR con Expo Go.

---

## 📋 Pasos Completos de Ejecución

### **1️⃣ Prerequisitos**

```bash
# Verificar que Supabase local está corriendo
npx supabase status

# Debe mostrar:
# API URL: http://127.0.0.1:54421
# Status: RUNNING
```

Si no está corriendo:
```bash
npx supabase start
```

### **2️⃣ Configurar Variables de Entorno**

Verifica que `apps/mobile/.env.local` tiene las URLs correctas:

```bash
# BD CLOUD (para auth y Edge Functions)
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWp6dmh0b3Rjdm56cGpnamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzMzk5NTksImV4cCI6MjA0OTkxNTk1OX0.YY4NqzFWEqfPYQjnO2aXGCkB0KuMdRd5O2OIvG0D-aQ

# BD LOCAL (puerto correcto 54421)
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54421  # ← ¡IMPORTANTE!
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Modo desarrollo
EXPO_PUBLIC_DEV_MODE=true
```

**⚠️ IMPORTANTE:** La URL local usa `10.0.2.2:54421` que es el IP especial del emulador Android para acceder a `localhost` del host.

### **3️⃣ Iniciar el Metro Bundler**

```bash
cd apps/mobile
npx expo start
```

Verás algo como:
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
```

### **4️⃣ Abrir en Emulador Android**

**Opción A: Presiona `a`** (si tienes Android Studio y un emulador corriendo)

**Opción B: Expo Go**
1. Instala Expo Go en tu dispositivo físico
2. Escanea el QR con Expo Go
3. La app se abrirá automáticamente

### **5️⃣ Login en la App**

**Credenciales de prueba:**
```
Email: test@example.com
Password: test123456
```

**Usuario alternativo:**
```
Email: user@brickshare.eu
Password: password123
```

---

## 🔄 Flujo de Prueba Completo

### **Escenario 1: Escaneo QR Exitoso**

**Prerequisito:** Debe existir un shipment con estado correcto en BD Local

```sql
-- Ejecutar en BD Local (puerto 54421)
INSERT INTO shipments (
  delivery_qr_code,
  shipment_status,
  tracking_number,
  user_id,
  shipping_address,
  shipping_city
) VALUES (
  'BS-DEL-TEST-001',
  'in_transit_pudo',
  'TRACK-TEST-001',
  'user-uuid',
  'Calle Test 123',
  'Madrid'
);
```

**Pasos en la App:**
1. Login con `test@example.com`
2. Ir a pantalla de escaneo
3. Escanear o ingresar: `BS-DEL-TEST-001`
4. ✅ Debe mostrar: "Paquete recepcionado exitosamente"

**Verificar en BD Local:**
```bash
curl "http://127.0.0.1:54421/rest/v1/shipments?delivery_qr_code=eq.BS-DEL-TEST-001&select=shipment_status,delivery_validated_at" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Debe retornar:
# {"shipment_status": "delivered_pudo", "delivery_validated_at": "2026-03-31T10:30:00Z"}
```

**Verificar en Dashboard:**
1. Abrir: http://localhost:3000/dashboard
2. Login con el mismo usuario
3. Debe aparecer el paquete en "Paquetes Activos"

---

### **Escenario 2: QR No Válido**

**Pasos en la App:**
1. Login
2. Escanear QR inexistente: `BS-DEL-FAKE-999`
3. ❌ Debe mostrar: "QR no válido o destino equivocado"

---

### **Escenario 3: Estado Inválido**

**Prerequisito:** Shipment con estado incorrecto

```sql
-- Ejecutar en BD Local
INSERT INTO shipments (
  delivery_qr_code,
  shipment_status,
  tracking_number
) VALUES (
  'BS-DEL-TEST-002',
  'delivered',  -- ← Estado incorrecto
  'TRACK-TEST-002'
);
```

**Pasos en la App:**
1. Login
2. Escanear: `BS-DEL-TEST-002`
3. ❌ Debe mostrar: "Estado inválido: se esperaba 'in_transit_pudo', pero el paquete está en 'delivered'"

---

## 🛠️ Comandos Útiles

### **Reiniciar App**
```bash
# En la terminal de Metro, presiona:
r  # Reload app
```

### **Limpiar Caché**
```bash
cd apps/mobile
npx expo start -c  # Clear cache
```

### **Ver Logs del Emulador**
```bash
# Android Studio > Logcat
# O en terminal:
adb logcat | grep -i "expo"
```

### **Reiniciar Supabase Local**
```bash
npx supabase stop
npx supabase start
```

### **Ver Estado de Supabase**
```bash
npx supabase status

# Salida esperada:
#         API URL: http://127.0.0.1:54421
#     GraphQL URL: http://127.0.0.1:54421/graphql/v1
#  S3 Storage URL: http://127.0.0.1:54421/storage/v1
#      Studio URL: http://127.0.0.1:54423
#    Inbucket URL: http://127.0.0.1:54424
```

---

## 🚨 Troubleshooting

### **Error: "Network request failed"**

**Causa:** App no puede conectar a Edge Function

**Solución:**
```bash
# 1. Verificar que Supabase local está corriendo
npx supabase status

# 2. Verificar URL en .env.local
cat apps/mobile/.env.local | grep SUPABASE_URL

# 3. Reiniciar Supabase
npx supabase restart
```

### **Error: "Tabla 'locations' no existe"**

**Causa:** Puerto incorrecto en `.env.local`

**Solución:**
```bash
# Cambiar en apps/mobile/.env.local:
# DE:
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54331  ❌

# A:
EXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54421  ✅

# Luego reiniciar app (presiona 'r' en Metro)
```

### **Error: "Usuario no encontrado"**

**Causa:** Usuario no existe en BD Cloud

**Solución:**
```bash
# Verificar usuarios en Cloud
curl "https://qumjzvhtotcvnzpjgjkl.supabase.co/rest/v1/users?select=*" \
  -H "apikey: eyJhbGc..."

# Crear usuario si no existe (via Dashboard de Supabase)
```

### **App no abre en emulador**

**Solución:**
```bash
# 1. Verificar que Android Studio está corriendo
# 2. Verificar que un emulador está iniciado
# 3. En la terminal de Metro, presiona 'a' de nuevo
# 4. O ejecuta:
npx expo run:android
```

### **Error de Build**

**Solución:**
```bash
cd apps/mobile

# Limpiar caché de Expo
npx expo start -c

# Limpiar node_modules y reinstalar
rm -rf node_modules
npm install

# Limpiar build de Android
cd android
./gradlew clean
cd ..
```

---

## 📊 Arquitectura Dual Database

La app usa **DOS bases de datos**:

### **🌩️ BD CLOUD (Supabase Cloud)**
- **Autenticación** (login/logout)
- **Edge Functions** (process-pudo-scan)
- **Logs y auditoría** (packages, package_events, pudo_scan_logs)
- **Dashboard web** lee de aquí

### **🏠 BD LOCAL (Puerto 54421)**
- **Validación de QR** (shipments.delivery_qr_code)
- **Actualización de estado** (shipments.shipment_status)
- **Datos maestros de Brickshare** (tabla shipments)

**Ver documentación completa:** `docs/DUAL_DB_ARCHITECTURE_IMPLEMENTATION.md`

---

## 🎯 Checklist de Verificación

Antes de ejecutar la app, verifica:

- [ ] Supabase local corriendo (puerto 54421)
- [ ] Variables de entorno configuradas correctamente
- [ ] Usuario de prueba existe en BD Cloud
- [ ] Tabla `shipments` existe en BD Local
- [ ] Datos de test en `shipments` con estado `in_transit_pudo`
- [ ] Edge Function desplegada localmente
- [ ] Android Studio abierto (si usas emulador)

---

## 📖 Referencias

- **Configuración inicial:** `docs/SETUP_MOBILE.md`
- **Arquitectura dual DB:** `docs/DUAL_DB_ARCHITECTURE_IMPLEMENTATION.md`
- **Setup Android SDK:** `docs/SETUP_ANDROID_SDK.md`
- **Edge Functions:** `docs/FIX_EDGE_FUNCTION_DEV_MODE.md`
- **Testing QR:** `docs/TESTING_QR_SCAN.md`

---

**Actualizado:** 2026-03-31 10:45  
