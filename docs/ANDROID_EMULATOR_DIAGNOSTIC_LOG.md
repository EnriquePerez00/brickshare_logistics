# Diagnóstico del Emulador Android - Brickshare Logistics

**Fecha:** 4 de Enero de 2026 - 20:01 UTC+2  
**Estado:** ⚠️ EMULADOR NO INICIADO

---

## 🔍 Resumen del Problema

El emulador Android **Pixel_7** está disponible pero **NO ESTÁ EN EJECUCIÓN**. Solo se detectan procesos residuales de `crashpad_handler` de intentos anteriores de lanzamiento.

### Estado Actual

```
✅ Emulator Path: /Users/I764690/Library/Android/sdk/emulator/emulator
✅ AVD Disponible: Pixel_7
❌ Emulator Status: NO RUNNING
❌ ADB Devices: EMPTY (sin dispositivos conectados)
```

---

## 📊 Diagnóstico Detallado

### 1. Estado de Dispositivos ADB

```bash
$ adb devices
List of devices attached
```

**Resultado:** ❌ **Sin dispositivos conectados**  
**Causa:** El emulador no está en ejecución

---

### 2. Emuladores Disponibles

```bash
$ emulator -list-avds
Pixel_7
```

**Resultado:** ✅ **AVD "Pixel_7" disponible y listo para lanzar**

---

### 3. Procesos del Emulador

```
Procesos Detectados:
├─ crashpad_handler (múltiples instancias)
│  ├─ Últimas instancias: 7:45PM (hace ~15 minutos)
│  ├─ Instancias anteriores: 7:36PM, 7:34PM, 7:33PM, etc.
│  └─ Indicador: Intentos de lanzamiento FALLIDOS
└─ Emulator QEMU: NO DETECTADO
```

**Resultado:** ⚠️ **Solo procesos zombies de crashpad**  
**Causa:** El emulador se ha crasheado múltiples veces

---

## 🔧 Causas Potenciales

### 1. **Emulador Crasheando**
- Múltiples instancias de `crashpad_handler` indican crashes
- El emulador intenta iniciar pero falla

### 2. **Problema de Hardware Virtualization**
- KVM/HAXM puede estar deshabilitado en macOS
- Memoria insuficiente (recomendado: ≥4GB)

### 3. **Puerto 5037 (ADB Daemon) Bloqueado**
- Posible conflicto de puerto con otro proceso
- El daemon de ADB no puede comunicarse con emulador

### 4. **Corrupción del AVD**
- Cache o configuración del Pixel_7 corrupta
- Necesidad de recrear el AVD

### 5. **Problemas de Permisos**
- Permisos insuficientes para ejecutar el emulador

---

## 🚨 Acciones Recomendadas (En Orden)

### Paso 1: Verificar Disponibilidad de Puerto ADB

```bash
# Verificar que el puerto 5037 no está en uso
lsof -i :5037
netstat -an | grep 5037

# Si está en uso, reiniciar adb
adb kill-server
adb start-server
```

### Paso 2: Revisar Logs del Emulador

```bash
# Verificar logs recientes
~/Library/Android/Sdk/emulator/emulator_log.txt

# Buscar errores de KVM/HAXM
grep -i "error\|kvm\|haxm" ~/Library/Android/Sdk/emulator/emulator_log.txt
```

### Paso 3: Limpiar Procesos Residuales

```bash
# Matar todos los procesos del emulador
pkill -f emulator
pkill -f crashpad_handler
pkill -f qemu

# Esperar 5 segundos
sleep 5

# Reiniciar adb daemon
adb kill-server && adb start-server
```

### Paso 4: Lanzar Emulador Manualmente

```bash
# Lanzar el emulador con logs verbosos
emulator -avd Pixel_7 -verbose -logcat '*:V' &

# Esperar a que inicie (puede tomar 30-60 segundos)
sleep 30

# Verificar que se conectó
adb devices
```

### Paso 5: Si Falla - Recrear AVD

```bash
# Eliminar AVD corrupto
rm -rf ~/.android/avd/Pixel_7.avd

# Recrear desde cero
sdkmanager "system-images;android-34;google_apis;arm64-v8a"
avdmanager create avd -n Pixel_7 -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_7 -f
```

---

## 📋 Verificación del Proceso Correcto

Cuando el emulador esté CORRECTAMENTE iniciado, deberías ver:

```bash
$ adb devices
List of devices attached
emulator-5554          device

$ ps aux | grep qemu | grep -v grep
I764690  99999  50.0 20.0 ... qemu-system-aarch64 ...
```

---

## 🛠️ Configuración de Lanzamiento desde React Native

Una vez que el emulador está corriendo, desde el proyecto:

```bash
# Terminal 1: Asegurarse que Metro bundler está corriendo
cd /Users/I764690/Code_personal/Brickshare_logistics/apps/mobile
npm start

# Terminal 2: Lanzar la app en emulador
cd /Users/I764690/Code_personal/Brickshare_logistics/apps/mobile
npx react-native run-android
```

---

## 📝 Checklist de Solución

- [ ] Verificar puerto ADB 5037
- [ ] Revisar logs del emulador (`emulator_log.txt`)
- [ ] Limpiar procesos residuales
- [ ] Lanzar emulador manualmente con logs
- [ ] Verificar que `adb devices` muestra el emulador
- [ ] Iniciar Metro bundler
- [ ] Ejecutar `react-native run-android`
- [ ] Validar que la app se carga en emulador

---

## 🔗 Referencias

- [Android Emulator Documentation](https://developer.android.com/studio/run/emulator)
- [React Native Android Setup](https://reactnative.dev/docs/environment-setup)
- [ADB Commands Reference](https://developer.android.com/tools/adb)

---

**Próxima acción:** Ejecutar Paso 1 (verificar puerto ADB) para comenzar el diagnóstico