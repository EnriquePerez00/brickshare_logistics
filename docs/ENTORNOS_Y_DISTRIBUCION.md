# Entornos y Distribución de la App Brickshare PUDO

## Resumen de Entornos

Tu proyecto utiliza una estructura de **Git Flow** con dos ramas principales y tres entornos diferentes:

### Ramas Git
- **`develop`** (rama actual) - Rama de desarrollo integrado
- **`main`** - Rama de producción (estable)

---

## 1. LOCAL (Tu máquina de desarrollo)

### Configuración Actual en Local

**Rama activa:** `develop`

**Variables de entorno (`apps/mobile/.env.local`):**
```
EXPO_PUBLIC_SUPABASE_URL=<tu-URL-supabase>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

**Herramientas necesarias:**
- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Android SDK (para builds locales)
- JDK 17+

**Scripts principales:**
```bash
# Desarrollo
npm run start -w mobile                    # Inicia Expo dev server
npm run android -w mobile                 # Ejecuta en emulador Android

# Testing
npm run lint -w mobile
npm run type-check -w mobile

# Building local
npm run prebuild:android -w mobile        # Prepara archivos nativos
npm run build:android:dev -w mobile       # Build de desarrollo local
```

---

## 2. GITHUB (Repositorio Remoto)

### Estado Actual en GitHub

**Repositorio:** `https://github.com/EnriquePerez00/brickshare_logistics.git`

**Ramas:**
- `origin/develop` ← Aquí están los cambios que acabas de pushear
- `origin/main` ← Rama de producción
- `origin/HEAD` → apunta a `origin/main`

**Último commit (ya pusheado):**
```
c78aa24 feat: Add Android app distribution setup with EAS Build, QR decoder, PUDO scanning, and complete deployment documentation
```

**Nota de seguridad:** GitHub detectó 6 vulnerabilidades en dependencias (2 high, 4 moderate). Ver: https://github.com/EnriquePerez00/brickshare_logistics/security/dependabot

---

## 3. PREVIEW/TESTING (EAS Build)

### Configuración para Tests (APK)

**Perfil EAS:** `preview` (en `apps/mobile/eas.json`)

```json
{
  "preview": {
    "distribution": "internal",
    "env": {
      "APP_ENV": "preview"
    },
    "android": {
      "buildType": "apk"
    }
  }
}
```

**Generar APK para tests:**
```bash
npm run build:android:preview -w mobile
# O directamente
eas build --platform android --profile preview
```

**Resultado:** APK instalable en cualquier dispositivo Android (sin Play Store)

**Distribución:**
- Descargar desde el link de Expo EAS
- Compartir por Drive, WhatsApp, Email
- Activar "Instalar de fuentes desconocidas" en Android
- Instalar directo en el dispositivo

---

## 4. PRODUCTION (Google Play Store)

### Configuración para Producción (AAB)

**Perfil EAS:** `production` (en `apps/mobile/eas.json`)

```json
{
  "production": {
    "env": {
      "APP_ENV": "production"
    },
    "android": {
      "autoIncrement": true,
      "buildType": "app-bundle"
    }
  }
}
```

**Generar AAB para Play Store:**
```bash
npm run build:android:prod -w mobile
# O directamente
eas build --platform android --profile production
```

**Resultado:** `app-bundle` (.aab) para subir a Google Play Console

**Requisitos:**
- Cuenta de Google Play Developer ($25 de una sola vez)
- Cuenta de `expo.dev` configurada
- Archivo `google-services.json` configurado

**Flujo de distribución:**
1. Generar AAB con `eas build`
2. Subir a Google Play Console
3. Configurar pista (internal → beta → production)
4. Los usuarios descargan desde Play Store con actualizaciones automáticas

---

## 5. OTA Updates (Actualizaciones sin reinstalar APK)

### Configuración de Updates Over The Air

**Comando para actualizar sin APK:**
```bash
eas update --branch production --message "fix: corrección en scanner"
```

**Ventaja:** Los dispositivos con la app instalada reciben el cambio al abrirla, sin reinstalar.

**Limitaciones:** Solo código/assets de React Native, no cambios en código nativo Java/Kotlin.

---

## Resumen de Versiones

| Aspecto | Local | GitHub | Preview | Production |
|--------|-------|--------|---------|------------|
| **Rama** | develop | origin/develop | - | - |
| **Tipo de Build** | Debug APK | - | APK | AAB |
| **Distribución** | Local | Git (remote) | Manual (links) | Play Store |
| **Actualizaciones** | Manual reinstalar | - | Manual APK | Play Store / OTA |
| **Versión Android** | Variable | - | minSdk 21+ | minSdk 21+ |
| **Entorno** | `development` | - | `preview` | `production` |

---

## Próximos Pasos Recomendados

1. **Configurar EAS:**
   ```bash
   cd apps/mobile
   eas login
   eas build --platform android --profile preview
   ```

2. **Generar APK para tests:**
   - Compartir con tu equipo PUDO
   - Testar en dispositivos reales con diferentes versiones Android

3. **Configurar Google Play (opcional para ahora):**
   - Crear cuenta desarrollador
   - Configurar `google-services.json`
   - Subir primera versión como "pista interna"

4. **Implementar OTA Updates:**
   - Para actualizaciones rápidas sin redistribuir APK
   - Ideal para fixes menores

---

## Variables de Entorno Necesarias

### Local (`apps/mobile/.env.local`)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### EAS Credentials (via CLI)
```bash
eas credential
```

Esto gestiona automáticamente certificados y keys para Android.

---

## Comandos Útiles

```bash
# Ver estado actual
git branch -a              # Ver todas las ramas
git log --oneline -5       # Últimos 5 commits

# Trabajar con ramas
git checkout main          # Cambiar a main (producción)
git checkout develop       # Volver a develop (desarrollo)

# Builds con EAS
eas build --platform android --profile preview    # APK de test
eas build --platform android --profile production # AAB para Play
eas update --branch production                    # OTA update

# Development local
npm run start -w mobile    # Expo dev server
npm run android -w mobile  # Ejecutar en Android
```

---

## Seguridad y Mejores Prácticas

- ✅ `.env.local` está en `.gitignore` (no se pushea)
- ⚠️ 6 vulnerabilidades detectadas en dependencias → revisar Dependabot
- ✅ EAS maneja certificados automáticamente (no los almacena en git)
- ✅ Dos ramas: develop (cambios) y main (estable)

**Flujo recomendado:**
1. Cambios en `develop` (rama actual)
2. Testing local + APK preview
3. Cuando está estable → pull request a `main`
4. Merge a `main` = versión producción