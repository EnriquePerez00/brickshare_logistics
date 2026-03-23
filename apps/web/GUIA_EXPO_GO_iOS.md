# 📱 Guía: Ejecutar Brickshare en iOS con Expo Go

**Fecha**: 23/03/2026
**Estado**: ✅ Servidor Expo activo en puerto 8081
**Usuario Disponible**: user@brickshare.eu

---

## 🚀 Estado Actual del Servidor

```
✅ Metro Bundler: Compilando (puerto 8081)
✅ Variables de entorno: Cargadas
✅ Supabase: Conectado
✅ Expo Go: Listo para recibir conexión
```

**URL del servidor**: `http://localhost:8081`

---

## 📲 Pasos para Conectar tu iPhone

### Opción 1: Escanear Código QR (Recomendado)

1. **En tu Mac (terminal actual)**
   - El servidor Expo está corriendo en background
   - Presiona `q` en la terminal para ver opciones
   - Verá aparecer un código QR

2. **En tu iPhone**
   - Abre la app **Expo Go** (ya instalada)
   - Presiona el botón **Escanear QR** (abajo de la pantalla)
   - Apunta la cámara al código QR
   - La app se descargará y compilará automáticamente

### Opción 2: URL Directa (Si QR no funciona)

1. **Obtén la URL del servidor**
   - En la terminal, presiona `w` para web (muestra URL)
   - O busca una línea tipo: `exp://192.168.X.X:8081`

2. **En tu iPhone**
   - Abre Safari o cualquier navegador
   - Copia la URL en la barra de direcciones
   - Toca el enlace → Se abrirá en Expo Go automáticamente

### Opción 3: LAN (Misma Red WiFi)

1. **Requiere**
   - Tu Mac y iPhone en la **misma red WiFi**
   - Firewall macOS permitiendo conexiones

2. **Proceso**
   - Expo detectará automáticamente tu iPhone
   - Aparecerá en la lista de dispositivos disponibles en la terminal
   - Selecciónalo para conectar

---

## 🔑 Credenciales de Prueba

```
Email:    user@brickshare.eu
Password: (tu contraseña de test)
```

Ingresa estas credenciales en la pantalla **LoginScreen** cuando aparezca.

---

## ✅ Lo Que Verás Después de Conectar

### 1️⃣ Pantalla de Carga
```
[Descargando bundle...]
[Compilando Metro...]
[Iniciando aplicación...]
```

### 2️⃣ Pantalla de Login (LoginScreen.tsx)
```
┌─────────────────────────┐
│   BRICKSHARE LOGISTICS  │
│                         │
│  📧 Email               │
│  [user@brickshare.eu ]  │
│                         │
│  🔒 Password            │
│  [***********]          │
│                         │
│  [ LOGIN ]              │
└─────────────────────────┘
```

### 3️⃣ Después de Login Exitoso
```
Navegará a → ScannerScreen
├─ Modo: Recepción / Entrega
├─ Botón de escaneo (cámara)
├─ Historial de escaneos
└─ Configuración de impresora
```

---

## 🎮 Funcionalidades Disponibles

| Funcionalidad | Status | Detalles |
|--------------|--------|----------|
| Login | ✅ | Autenticación con Supabase |
| ScannerScreen | ✅ | Escaneo de códigos barras y QR |
| PrinterSetupScreen | ✅ | Configuración de impresora térmica |
| Navegación | ✅ | Entre pantallas principales |
| Permisos Cámara | ⏳ | Aparecerá al usar scanner |
| Conexión Supabase | ✅ | JWT y acceso a datos |

---

## 📋 Flujo de Prueba Recomendado

### Paso 1: Login
```
1. Escanea el QR con Expo Go
2. Espera a que la app se compile (30-60 segundos)
3. Verás LoginScreen
4. Ingresa: user@brickshare.eu
5. Presiona LOGIN
```

### Paso 2: Permisos
```
Si aparece diálogo de permisos de cámara:
- Permite acceso a la cámara
- El scanner comenzará a funcionar
```

### Paso 3: ScannerScreen
```
1. Verás dos botones:
   - "Modo Recepción" (escanear códigos de barras)
   - "Modo Entrega" (escanear QR dinámicos)
2. Selecciona Modo Recepción
3. Presiona el botón de escaneo
4. Apunta a un código de barras (o QR)
5. El paquete se registrará en Supabase
```

---

## 🔧 Troubleshooting

### ❌ "No se conecta a la red"
```
Solución:
1. Verifica que Mac e iPhone estén en la MISMA red WiFi
2. Desactiva VPN si tienes
3. Reinicia Expo Go en el iPhone
```

### ❌ "Timeout connection"
```
Solución:
1. Verifica que el firewall de Mac permite entrada en puerto 8081
2. En Mac: Preferencias > Seguridad > Firewall Options
3. Asegúrate de permitir "expo" o "node"
```

### ❌ "Errores en la consola durante login"
```
Solución:
1. Abre la consola de logs en Expo Go (shake device)
2. Verifica que user@brickshare.eu existe en Supabase
3. Verifica conexión a internet
```

### ❌ "App se ve en blanco"
```
Solución:
1. Presiona Cmd+R (reload) en la terminal
2. O tira de la pantalla hacia abajo en el iPhone (refresh)
3. Espera 30 segundos a que recompile
```

### ❌ "Permiso de cámara denegado"
```
Solución:
1. Ve a Configuración > Expo Go > Cámara
2. Cambia a "Permitir"
3. Regresa a la app y reload
```

---

## 📊 Monitoreo en Tiempo Real

### Logs en la Terminal
```bash
# Ver todos los logs de la app
# Aparecerán en la terminal mientras usas la app en iPhone

# Ejemplo:
LOG  [1:51:34 PM] "Login attempt with user@brickshare.eu"
LOG  [1:51:35 PM] "Supabase auth success"
LOG  [1:51:36 PM] "Navigating to ScannerScreen"
```

### Logs en el iPhone (Expo Go)
```
1. En la app, presiona y mantén con dos dedos (shake device)
2. Abre "View logs"
3. Verás todos los logs de la aplicación
```

---

## 🌐 URLs Útiles

| Recurso | URL |
|---------|-----|
| Expo Go (App) | App Store (iOS) |
| Supabase Dashboard | https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl |
| Metro Bundler | http://localhost:8081 |
| Servidor Actual | http://localhost:8081 |

---

## 📝 Notas Importantes

1. **Variables de Entorno**: Ya están cargadas en `.env.local`
2. **Supabase**: Conectado a instancia cloud (qumjzvhtotcvnzpjgjkl)
3. **JWT**: El token ANON_KEY es válido hasta 2089
4. **React Versions**: Sincronizadas a 19.2.4
5. **Puerto**: Expo usa 8081 (no 8082 como web)

---

## ✨ Comandos Útiles en la Terminal

```bash
# Mientras Expo está corriendo:

# Presionar 'i' → Abrir iOS simulator (si tienes Xcode)
# Presionar 'a' → Abrir Android emulator
# Presionar 'w' → Abrir en web browser
# Presionar 'r' → Recargar la app
# Presionar 'j' → Ver logs con JSON
# Presionar 'm' → Ver más opciones
# Presionar 'q' → Salir de Expo

# En otra terminal, ver logs en tiempo real:
tail -f /tmp/expo_ios.log
```

---

## 🎯 Meta Final

Una vez completados los pasos, tendrás:

✅ App móvil corriendo en tu iPhone  
✅ Login con Supabase Auth funcionando  
✅ Acceso a ScannerScreen  
✅ Pruebas de escaneo disponibles  
✅ Logs en tiempo real  

**¡Listo para pruebas end-to-end en dispositivo físico!**

---

**Servidor iniciado**: 2026-03-23T17:17:40+01:00  
**Estado**: 🟢 OPERATIVO Y ESPERANDO CONEXIÓN  
**Próximo paso**: Escanea el QR con Expo Go en tu iPhone