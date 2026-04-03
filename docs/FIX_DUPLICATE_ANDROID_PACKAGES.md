# 🔧 Solución: Duplicidad de Apps Android en Emulador

**Problema Identificado:** 4 de Enero de 2026  
Dos versiones de la app instaladas en emulador con package names diferentes:
- `com.bricksharelogistics` (INCORRECTO - sin puntos)
- `com.brickshare.pudo` (CORRECTO - está en app.json)

---

## 🎯 Package Name Correcto

Según `apps/mobile/app.json`, la configuración oficial es:

```json
{
  "android": {
    "package": "com.brickshare.pudo"  ← CORRECTO
  },
  "ios": {
    "bundleIdentifier": "com.brickshare.pudo"  ← CORRECTO
  }
}
```

---

## 🔍 Causa Raíz

El package name `com.bricksharelogistics` (sin puntos) fue generado probablemente por:
1. Una compilación anterior con configuración diferente
2. Expo generando un package name por defecto cuando no encontró la configuración correcta
3. Un cambio histórico en `app.json` que no fue limpiado del emulador

---

## 🚀 Solución Paso a Paso

### **Paso 1: Iniciar el Emulador**

```bash
# Desde Android Studio o línea de comandos
emulator -avd Pixel_7_API_34 &

# O desde Android Studio: AVD Manager > Launch
```

### **Paso 2: Desinstalar Ambas Apps**

```bash
# Una vez que el emulador esté corriendo
adb shell pm uninstall com.bricksharelogistics
adb shell pm uninstall com.brickshare.pudo
```

### **Paso 3: Limpiar Cache y Proyectos Nativos**

```bash
cd apps/mobile

# Opción completa (recomendada)
npm run clean

# Alternativa manual
rm -rf node_modules/.cache
rm -rf android/
rm -rf ios/
cd ../..
npm install
```

### **Paso 4: Recompilar e Instalar la App Correcta**

```bash
cd apps/mobile

# Generar proyecto nativo Android con package name correcto
npm run prebuild:android

# Compilar e instalar en emulador
npm run android
```

### **Paso 5: Verificar Instalación Correcta**

```bash
# Verificar que SOLO está instalada la app correcta
adb shell pm list packages | grep brickshare

# Debería mostrar SOLO:
# package:com.brickshare.pudo

# Verificar que NO aparece com.bricksharelogistics
```

---

## ✅ Verificación de Éxito

Una vez completado, deberías ver:

```bash
$ adb shell pm list packages | grep brickshare
package:com.brickshare.pudo
```

Y en el emulador:
- 🔓 **Pantalla de Login** (no blanca con logo Google)
- Email input
- Password input
- Botón "Iniciar Sesión"

---

## 📊 Resumen de Configuración Correcta

| Aspecto | Valor |
|--------|-------|
| **Name** | `PudoBrickshare` |
| **Slug** | `pudo-brickshare` |
| **Android Package** | `com.brickshare.pudo` |
| **iOS Bundle ID** | `com.brickshare.pudo` |
| **Scheme** | `pudobrickshare` |

---

## 🆘 Si Algo Sale Mal

### Error: "gradle build failed"

```bash
# Limpiar gradle cache
cd apps/mobile/android
./gradlew clean

# Reintentar
cd ..
npm run android
```

### Error: "Package not installed"

```bash
# Verificar logs de instalación
adb shell pm install-create -i com.android.vending

# Verificar espacio disponible
adb shell df
```

### Error: "Metro bundler timeout"

```bash
# En terminal separada
cd apps/mobile
npx expo start --clear

# En terminal principal
npm run android
```

---

## 🔗 Referencias

- [SETUP_MOBILE.md](./SETUP_MOBILE.md) - Setup completo Android/iOS
- [ANDROID_EMULATOR_WHITE_SCREEN_DIAGNOSTIC.md](./ANDROID_EMULATOR_WHITE_SCREEN_DIAGNOSTIC.md) - Diagnóstico de pantalla blanca
- [app.json](../apps/mobile/app.json) - Configuración oficial de la app