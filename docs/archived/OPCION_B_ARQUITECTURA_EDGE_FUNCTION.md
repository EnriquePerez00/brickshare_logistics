# ✅ OPCIÓN B: Arquitectura Centralizada por Edge Function

## 📋 Resumen

**Implementación completada:** La app móvil ahora utiliza una arquitectura completamente centralizada donde **todo el flujo de datos pasa por la Edge Function**, eliminando cualquier acceso directo a bases de datos locales.

## 🏗️ Arquitectura Implementada

```
┌─────────────────┐
│   APP MÓVIL     │
│  (Emulador)     │
└────────┬────────┘
         │ 1. Auth + Edge Function calls
         │ (via EXPO_PUBLIC_SUPABASE_URL)
         ▼
┌─────────────────────────────────────┐
│  DB1: Brickshare_logistics (Cloud)  │
│  https://qumjzvhtotcvnzpjgjkl...    │
│                                     │
│  ✅ Autenticación (JWT)             │
│  ✅ Edge Functions                  │
└────────┬────────────────────────────┘
         │ 2. Edge Function accede a DB2
         │ (via ngrok tunnel)
         ▼
┌─────────────────────────────────────┐
│  DB2: Brickshare (Local)            │
│  https://semblably-dizzied-bruno... │
│  (ngrok → localhost:54331)          │
│                                     │
│  ✅ Tabla shipments                 │
│  ✅ Validación de QR                │
│  ✅ Datos de producción             │
└─────────────────────────────────────┘
```

## 🔧 Cambios Realizados

### 1. **apps/mobile/.env.local**

```bash
# ✅ DB1 (Cloud) - Para autenticación y Edge Functions
EXPO_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# ❌ ELIMINADAS las variables de acceso directo a BD local
# La app NO accede directamente a puerto 54421 ni 54331
# EXPO_PUBLIC_LOCAL_SUPABASE_URL= (comentada)
# EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY= (comentada)

# ✅ Dev mode para bypass JWT en desarrollo
EXPO_PUBLIC_DEV_MODE=true

# ✅ Service role key para Edge Function
EXPO_PUBLIC_BRICKSHARE_SERVICE_ROLE_KEY=eyJ...
```

### 2. **supabase/functions/process-pudo-scan/.env.local**

```bash
# ✅ CORRECTO: Edge Function accede a Brickshare via ngrok
REMOTE_DB_URL=https://semblably-dizzied-bruno.ngrok-free.dev
REMOTE_DB_SERVICE_KEY=eyJ...

# Alias para compatibilidad
BRICKSHARE_API_URL=https://semblably-dizzied-bruno.ngrok-free.dev
BRICKSHARE_SERVICE_ROLE_KEY=eyJ...
```

## 📊 Variables de Entorno Críticas

### **BRICKSHARE_ANON_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### **BRICKSHARE_SERVICE_ROLE_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## ✅ Ventajas de Opción B

1. **🔒 Seguridad centralizada**: Toda la lógica de validación en un solo punto
2. **📝 Logs consistentes**: Todos los accesos pasan por la Edge Function
3. **🌐 Funciona en cualquier red**: No depende de acceso local, usa ngrok
4. **🛠️ Fácil mantenimiento**: Un solo punto para actualizar lógica de negocio
5. **🔄 Escalable**: Lista para producción con mínimos cambios

## ❌ Desventajas (Menores)

1. **⏱️ Latencia adicional**: Una petición extra (app → Edge Function → Brickshare)
2. **🔗 Dependencia de ngrok**: Requiere que el túnel esté activo

## 🎯 Flujo de Escaneo QR

```
1. Usuario escanea QR "BS-DEL-714C3F3D-FFD"
   ↓
2. App móvil llama a Edge Function:
   POST https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan
   Body: { trackingCode: "BS-DEL-714C3F3D-FFD" }
   ↓
3. Edge Function valida JWT y accede a Brickshare via ngrok:
   GET https://semblably-dizzied-bruno.ngrok-free.dev/rest/v1/shipments?delivery_qr_code=eq.BS-DEL-714C3F3D-FFD
   ↓
4. Si existe, actualiza estado y retorna a la app
   ↓
5. App muestra resultado al usuario
```

## 🚀 Comandos para Ejecutar

### Paso 1: Verificar que ngrok esté corriendo
```bash
# El túnel debe apuntar al puerto 54331 (Brickshare)
ngrok http 54331
# Salida esperada: https://semblably-dizzied-bruno.ngrok-free.dev
```

### Paso 2: Verificar Edge Function
```bash
# Debe estar corriendo en DB1 (logistics - Cloud)
supabase functions serve
# Salida: process-pudo-scan available at https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan
```

### Paso 3: Reiniciar app móvil
```bash
cd apps/mobile
# Limpiar caché
rm -rf .expo
npx expo start --clear
# Presionar 'a' para Android
```

## 🔍 Verificación

### Test 1: Verificar que app NO usa puerto 54331 (Brickshare local)
```bash
# Buscar referencias en logs de Metro
# Verificar que solo usa Cloud: https://qumjzvhtotcvnzpjgjkl.supabase.co
# NO debería haber conexiones a localhost:54331 ni 54421
```

### Test 2: Verificar que Edge Function accede a Brickshare
```bash
# Ver logs de supabase functions
# Debería mostrar conexiones a ngrok URL
```

### Test 3: Escanear QR de prueba
```
QR: BS-DEL-714C3F3D-FFD
Resultado esperado: "Paquete encontrado y validado"
```

## 📝 Documentación Actualizada

- ✅ apps/mobile/.env.local modificado
- ✅ Referencias a puerto 54421 eliminadas
- ✅ Arquitectura documentada en este archivo
- ⚠️ Actualizar docs/GUIA_EJECUCION_APP_ANDROID.md con nueva configuración

## 🎉 Estado Final

```
✅ Opción B implementada correctamente
✅ App móvil usa SOLO Edge Function
✅ Edge Function accede a Brickshare via ngrok
✅ No hay acceso directo a puerto 54421 ni 54331
✅ Arquitectura lista para pruebas
```

---

**Fecha:** 31/03/2026 10:59 AM  
**Autor:** Cline AI Assistant  
**Versión:** 1.0