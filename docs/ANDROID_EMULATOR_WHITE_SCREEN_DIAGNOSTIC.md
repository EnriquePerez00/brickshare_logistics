# 📱 Diagnóstico: Pantalla Blanca en Emulador Android

**Fecha:** 4 de Enero de 2026  
**Problema:** El emulador Android muestra solo pantalla blanca con logo de Google, la aplicación no aparece

---

## 🔍 Problema Reportado

Al lanzar el simulador Android, aparece:
- Pantalla blanca
- Logo de Google en el centro
- **Sin la aplicación móvil visible**
- El terminal en VS Code muestra información de depuración pero sin errores críticos

---

## 🏗️ Contexto de Arquitectura

La aplicación móvil utiliza **arquitectura dual database**:

### DB1 (Brickshare_logistics) - Cloud Supabase
- 🌐 URL: `https://qumjzvhtotcvnzpjgjkl.supabase.co`
- 🔐 Autenticación de operadores PUDO
- 📦 Registro de logs de auditoría
- 🚀 Edge Functions desplegadas

### DB2 (Brickshare) - Local vía ngrok
- 🏠 URL: `https://semblably-dizzied-bruno.ngrok-free.dev`
- 📦 Gestión de shipments y QR codes
- ⚠️ **CRÍTICO:** Requiere túnel ngrok activo

---

## 🐛 Posibles Causas

### 1. **La app no se ha instalado en el emulador** ⚠️ MÁS PROBABLE

**Síntomas:**
- Emulador arranca correctamente
- Pantalla de inicio de Android (blanca con logo Google)
- Pero no hay APK instalado

**Verificación:**
```bash
# Verificar si la app está instalada
adb shell pm list packages | grep brickshare

# Debería aparecer algo como:
# package:com.brickshare.pudo
```

**Solución:**
```bash
cd apps/mobile

# Opción 1: Compilar e instalar directamente
npm run android

# Opción 2: Si ya se compiló antes, relanzar
npx expo run:android

# Opción 3: Limpiar cache y reinstalar
rm -rf node_modules/.cache
npx expo start --clear
```

---

### 2. **Metro bundler no está corriendo**

**Síntomas:**
- Emulador abre pero app no carga
- No hay servidor de desarrollo activo

**Verificación:**
```bash
# Buscar proceso de Metro
ps aux | grep "expo start"

# Verificar puerto 8081
lsof -i :8081
```

**Solución:**
```bash
cd apps/mobile

# Iniciar Metro bundler
npx expo start

# O con limpieza de cache
npx expo start --clear
```

---

### 3. **Túnel ngrok caído** (afecta funcionalidad, no pantalla blanca)

**Estado actual:**
```bash
curl https://semblably-dizzied-bruno.ngrok-free.dev/health
# Respuesta: {"message":"no Route matched with those values"}
```

✅ **ngrok está activo** pero la ruta `/health` no existe en DB2  
⚠️ Esto **NO causa la pantalla blanca**, pero impedirá el escaneo de QR codes

**Verificación correcta de ngrok:**
```bash
# Verificar conexión base (debe devolver HTML de Supabase Studio)
curl -I https://semblably-dizzied-bruno.ngrok-free.dev

# Si ngrok está caído, relanzar:
ngrok http 54321
```

---

### 4. **Variables de entorno no cargadas**

**Verificación:**
```bash
# Asegurar que existe el archivo
ls -la apps/mobile/.env.local

# Verificar contenido
cat apps/mobile/.env.local | grep EXPO_PUBLIC
```

**Contenido esperado:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
EXPO_PUBLIC_LOCAL_SUPABASE_URL=https://semblably-dizzied-bruno.ngrok-free.dev
EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY=sb_secret_...
```

---

### 5. **Error de compilación silencioso**

**Verificación:**
```bash
cd apps/mobile

# Verificar logs completos de compilación
npx expo run:android --verbose

# Buscar errores en logs
adb logcat | grep -i "error\|exception\|crash"
```

---

## 🔧 Pasos de Resolución Recomendados

### **Paso 1: Verificar instalación de la app**

```bash
# ¿Está instalada la app?
adb shell pm list packages | grep brickshare

# Si NO aparece, la app nunca se instaló
```

### **Paso 2: Reinstalar la app en el emulador**

```bash
cd apps/mobile

# Limpiar completamente
npm run clean

# Reinstalar dependencias
cd ../..
npm install

# Recompilar e instalar
cd apps/mobile
npm run android
```

### **Paso 3: Verificar Metro bundler**

```bash
# Debe mostrar servidor activo en puerto 8081
ps aux | grep "expo start"

# Si no está corriendo
npx expo start --clear
```

### **Paso 4: Verificar logs del emulador**

```bash
# Ver logs en tiempo real
adb logcat | grep -E "brickshare|Brickshare|expo"

# Buscar errores JavaScript
adb logcat | grep -i "reactnativejs"
```

### **Paso 5: Reiniciar emulador (último recurso)**

```bash
# Cerrar emulador actual
adb emu kill

# Reiniciar desde Android Studio
# O desde CLI:
emulator -avd Pixel_7_API_34 -no-snapshot-load
```

---

## ✅ Verificación de Éxito

Una vez que la app esté instalada y funcionando correctamente, deberías ver:

1. **Pantalla de Login**
   - Email input field
   - Password input field
   - Botón "Iniciar Sesión"

2. **En logcat:**
   ```
   [Supabase] Client initialized
   [Auth] AuthContext ready
   ```

3. **Lista de apps instaladas:**
   ```bash
   adb shell pm list packages | grep brickshare
   # package:com.brickshare.logistics
   ```

---

## 📊 Estado de Dependencias

### ✅ Verificadas como OK:
- ngrok tunnel: **ACTIVO** (https://semblably-dizzied-bruno.ngrok-free.dev)
- DB1 Cloud: **ACTIVO** (https://qumjzvhtotcvnzpjgjkl.supabase.co)
- Variables de entorno: **CONFIGURADAS** (apps/mobile/.env.local)
- Documentación: **ACTUALIZADA** (README.md, SETUP_MOBILE.md)

### ⚠️ Por Verificar:
- Estado de instalación de la app en emulador
- Metro bundler corriendo
- Logs de compilación Android

---

## 🚀 Comando Rápido de Recuperación

```bash
# Desde la raíz del proyecto
cd apps/mobile

# Limpiar y reinstalar TODO
npm run clean
cd ../..
npm install

# Recompilar e instalar en emulador
cd apps/mobile
npm run android

# En terminal separada, asegurar Metro está corriendo
npx expo start --clear
```

---

## 📝 Notas Adicionales

- **ngrok free plan:** Genera nueva URL cada reinicio → Actualizar `EXPO_PUBLIC_LOCAL_SUPABASE_URL`
- **DEV_MODE:** Configurado en `true` para bypass JWT validation durante testing
- **Edge Function:** Desplegada correctamente en DB1 Cloud, pero requiere ngrok activo para acceder a DB2

---

## 🔗 Referencias

- [SETUP_MOBILE.md](./SETUP_MOBILE.md) - Guía completa de setup Android/iOS
- [README.md](../README.md) - Arquitectura dual database explicada
- [NGROK_TUNNEL_SETUP.md](./NGROK_TUNNEL_SETUP.md) - Configuración de túnel ngrok
- [ANDROID_EMULATOR_DIAGNOSTIC_LOG.md](./ANDROID_EMULATOR_DIAGNOSTIC_LOG.md) - Logs previos del emulador