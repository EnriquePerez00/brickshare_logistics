# 🤖 Setup Android SDK & Emulador — macOS

## Componentes Instalados

| Componente | Versión | Ubicación |
|-----------|---------|-----------|
| Java JDK | 17.0.18 (Homebrew) | `/opt/homebrew/Cellar/openjdk@17/17.0.18/` |
| Android Studio | Latest | `/Applications/Android Studio.app` |
| Android SDK | Se instala con Android Studio | `~/Library/Android/sdk` |
| Watchman | Latest (Homebrew) | `/opt/homebrew/bin/watchman` |

## Variables de Entorno (en `~/.zshrc`)

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home
export PATH=$PATH:$JAVA_HOME/bin
```

---

## Configuración Inicial de Android Studio (Primera vez)

### 1. Abrir Android Studio
```bash
open -a "Android Studio"
```

### 2. Asistente de Configuración
1. Seleccionar **Standard** installation
2. Aceptar licencias de SDK
3. Esperar a que descargue los componentes (~2-3GB)

### 3. Instalar SDK Components (SDK Manager)
Ir a **Android Studio > Settings > Languages & Frameworks > Android SDK**

#### Pestaña "SDK Platforms":
- ✅ Android 14.0 (API 34)
- ✅ Android 13.0 (API 33)

#### Pestaña "SDK Tools":
- ✅ Android SDK Build-Tools 34.0.0
- ✅ Android SDK Command-line Tools (latest)
- ✅ Android Emulator
- ✅ Android SDK Platform-Tools
- ✅ Google Play services

### 4. Crear AVD (Android Virtual Device)
Ir a **Android Studio > Device Manager > Create Device**

**Configuración recomendada:**
- **Device:** Pixel 7 (o Pixel 6)
- **System Image:** API 34 (Android 14) - seleccionar la de **arm64-v8a** (Apple Silicon)
- **Nombre:** `Pixel_7_API_34`
- **RAM:** 2048 MB
- **Internal Storage:** 2048 MB

---

## Extensiones VS Code Instaladas

| Extensión | ID | Uso |
|----------|-----|-----|
| React Native Tools | `msjsdiag.vscode-react-native` | Debugging, IntelliSense, comandos RN |
| Android iOS Emulator | `DiemasMichiels.emulate` | Lanzar emulador desde VS Code |

---

## Comandos Útiles

### Emulador
```bash
# Listar AVDs disponibles
emulator -list-avds

# Iniciar emulador específico
emulator -avd Pixel_7_API_34

# Iniciar emulador desde VS Code
# Cmd+Shift+P > "Emulate: Android"
```

### ADB (Android Debug Bridge)
```bash
# Ver dispositivos conectados (emulador o físicos)
adb devices

# Ver logs en tiempo real
adb logcat | grep -E "ReactNative|ReactNativeJS"

# Logs filtrados (menos ruido)
adb logcat *:S ReactNative:V ReactNativeJS:V

# Reinstalar app
adb install -r app.apk

# Limpiar datos de la app
adb shell pm clear com.brickshare.pudo

# Reverse port (para Metro bundler)
adb reverse tcp:8081 tcp:8081

# Captura de pantalla
adb exec-out screencap -p > screenshot.png
```

### Expo / React Native
```bash
# Compilar y ejecutar en emulador Android
cd apps/mobile
npm run android

# Solo para dispositivo conectado por USB
npm run android:device

# Generar proyecto nativo Android
npm run prebuild:android

# Limpiar y regenerar
npm run prebuild:clean

# Iniciar Metro bundler con dev client
npm run start:dev-client
```

### Verificación de Instalación
```bash
# Verificar Java
java --version
echo $JAVA_HOME

# Verificar Android SDK
echo $ANDROID_HOME
ls $ANDROID_HOME

# Verificar herramientas
adb --version
emulator -list-avds
sdkmanager --list | head -20
```

---

## Debugging desde VS Code

### Opción 1: Debug Launch (F5)
1. Abre el panel **Run & Debug** (Ctrl+Shift+D)
2. Selecciona **"Debug Android Emulator"**
3. Presiona **F5** → Compila y lanza la app en emulador

### Opción 2: Attach (app ya corriendo)
1. Ejecuta `npm run android` en terminal
2. Selecciona **"Attach to Expo Android"**
3. Presiona **F5** → Se conecta al proceso

### Opción 3: Lanzar Emulador desde VS Code
1. **Cmd+Shift+P** → "Emulate: Android"
2. Selecciona el AVD creado
3. Luego ejecuta `npm run android`

---

## Troubleshooting

### "SDK location not found"
```bash
# Verificar variable
echo $ANDROID_HOME
# Debe mostrar: /Users/TU_USUARIO/Library/Android/sdk

# Si está vacío, recargar shell
source ~/.zshrc
```

### "Failed to install the app"
```bash
# Limpiar y reinstalar
cd apps/mobile
npm run clean:native
npm run prebuild:android
npm run android
```

### "Unable to load script" (Metro)
```bash
# Verificar que Metro está corriendo
npx expo start --clear

# Reverse port para emulador
adb reverse tcp:8081 tcp:8081
```

### Emulador lento
```bash
# Usar hardware acceleration
emulator -avd Pixel_7_API_34 -gpu host

# O en Android Studio: Habilitar "Use Host GPU"
```

### "Java version mismatch"
```bash
# Verificar que usa JDK 17
java --version
# Debe mostrar: openjdk 17.x.x

# Si muestra otra versión, verificar JAVA_HOME
echo $JAVA_HOME
# Debe ser: /opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home
```

### Limpiar completamente y empezar de nuevo
```bash
cd apps/mobile
npm run clean           # Elimina node_modules, .expo, ios, android
cd ../..
npm install             # Reinstala dependencias del monorepo
cd apps/mobile
npm run prebuild:clean  # Regenera proyectos nativos
npm run android         # Compila y ejecuta
```

---

## Estructura del Proyecto Android (después de prebuild)

```
apps/mobile/android/
├── app/
│   ├── build.gradle          ← Configuración de build
│   ├── src/
│   │   └── main/
│   │       ├── AndroidManifest.xml  ← Permisos
│   │       ├── java/               ← Código nativo (generado)
│   │       └── res/                ← Recursos (iconos, strings)
├── build.gradle              ← Config gradle root
├── gradle.properties         ← Properties (JVM, SDK paths)
├── gradlew                   ← Gradle wrapper
└── settings.gradle           ← Configuración de módulos
```

> ⚠️ La carpeta `android/` es generada por `expo prebuild`. No edites manualmente a menos que sea necesario. Los cambios se pierden con `prebuild --clean`.