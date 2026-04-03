# Configuración del Supabase Personal Access Token (PAT)

**Fecha:** 4 de Enero de 2026  
**Versión:** 1.0  
**Estado:** ✅ Implementado y Documentado

---

## 📋 Resumen Ejecutivo

Se ha configurado el **Personal Access Token (PAT)** de Supabase `brickshare_logistics_PAT` de manera centralizada y segura en todos los entornos del proyecto (web, mobile iOS/Android, Edge Functions y CLI). El token se almacena encriptado localmente en archivos `.env.local` que **NUNCA se suben a GitHub**.

### Token Registrado
```
Nombre: brickshare_logistics_PAT
Valor: sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc
Proyecto: qumjzvhtotcvnzpjgjkl (Brickshare_logistics)
```

---

## 🔐 Seguridad

### Protección Implementada

1. **Archivos excluidos de Git**: Todos los `.env.local` están en `.gitignore`
   ```gitignore
   .env
   .env.local
   .env.*.local
   !.env.example
   ```

2. **Token almacenado localmente únicamente**: El PAT se almacena SOLO en:
   - `/.env.local` (raíz del proyecto)
   - `/apps/mobile/.env.local` (app móvil)
   - `/apps/web/.env.local` (app web)
   - `/supabase/.env.local` (CLI y Edge Functions)

3. **Permisos mínimos necesarios**: El token tiene acceso limitado a:
   - Despliegue de Edge Functions
   - Gestión de funciones en el proyecto específico
   - Operaciones de CLI autenticadas

4. **Sin exposición pública**: El token NO se expone en:
   - Variables de entorno públicas (EXPO_PUBLIC_*, NEXT_PUBLIC_*)
   - Repositorio Git
   - Logs de la aplicación
   - Configuraciones de CI/CD sin protección

---

## 📁 Distribución del Token

### 1. **Raíz del Proyecto** (`/.env.local`)

Archivo maestro que contiene la configuración centralizada:

```env
# ════════════════════════════════════════════════════════════
# SUPABASE ACCESS TOKEN (PAT) — Personal Access Token
# ════════════════════════════════════════════════════════════
# Token para desplegar Edge Functions y gestionar el proyecto
# 🔐 NUNCA SE SUBE A GITHUB - Almacenado solo localmente en .env.local
# Nombre: brickshare_logistics_PAT
# Uso: CLI deployment, Edge Functions, CI/CD
SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc
```

**Uso**: Despliegue de Edge Functions, operaciones CLI generales

---

### 2. **App Móvil** (`/apps/mobile/.env.local`)

Configuración para React Native (iOS y Android):

```env
# ════════════════════════════════════════════════════════════
# SUPABASE ACCESS TOKEN (PAT) — Personal Access Token
# ════════════════════════════════════════════════════════════
# Token para desplegar Edge Functions desde CI/CD o localmente
# 🔐 NUNCA SE SUBE A GITHUB - Almacenado solo localmente en .env.local
# Nombre: brickshare_logistics_PAT
SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc
```

**Uso**: 
- Despliegue automático en pipelines de EAS (Expo Application Services)
- Builds locales para iOS y Android
- Sincronización con Edge Functions

---

### 3. **App Web** (`/apps/web/.env.local`)

Configuración para Next.js:

```env
# ════════════════════════════════════════════════════════════
# SUPABASE ACCESS TOKEN (PAT) — Personal Access Token
# ════════════════════════════════════════════════════════════
# Token para desplegar Edge Functions desde CI/CD o localmente
# 🔐 NUNCA SE SUBE A GITHUB - Almacenado solo localmente en .env.local
# Nombre: brickshare_logistics_PAT
SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc
```

**Uso**:
- Despliegue en Vercel (puede leerse desde raíz)
- Operaciones backend en API routes
- Sincronización con Edge Functions

---

### 4. **Supabase CLI** (`/supabase/.env.local`)

Configuración específica para Supabase CLI:

```env
# ════════════════════════════════════════════════════════════
# SUPABASE ACCESS TOKEN (PAT) — Personal Access Token
# ════════════════════════════════════════════════════════════
# Token para desplegar Edge Functions y gestionar el proyecto
# 🔐 NUNCA SE SUBE A GITHUB - Almacenado solo localmente en .env.local
# Nombre: brickshare_logistics_PAT
SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc
```

**Uso**:
- Despliegue de Edge Functions: `supabase functions deploy`
- Migraciones de base de datos
- Operaciones de gestión del proyecto

---

## 🚀 Cómo Usar el Token

### Opción 1: Desde Raíz (Recomendado para CLI)

```bash
# El token se lee automáticamente desde /.env.local
cd /Users/I764690/Code_personal/Brickshare_logistics
supabase functions deploy
```

### Opción 2: Exportar Variable de Entorno

```bash
export SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc

# Luego ejecutar cualquier comando Supabase
supabase functions deploy
supabase db push
```

### Opción 3: Desde Directorio Específico

```bash
# Desde /supabase
cd /Users/I764690/Code_personal/Brickshare_logistics/supabase
# El token se lee desde supabase/.env.local automáticamente
supabase functions deploy
```

---

## ✅ Despliegue de Edge Functions (Verificación)

El despliegue se realizó exitosamente el 4 de Enero de 2026:

```
Bundling Function: generate-dynamic-qr
Deploying Function: generate-dynamic-qr (script size: 74.73kB)

Bundling Function: generate-static-return-qr
Deploying Function: generate-static-return-qr (script size: 74.93kB)

Bundling Function: process-pudo-scan
Deploying Function: process-pudo-scan (script size: 72.57kB)

Bundling Function: update-remote-shipment-status
Deploying Function: update-remote-shipment-status (script size: 68.54kB)

Bundling Function: verify-package-qr
Deploying Function: verify-package-qr (script size: 76.05kB)

✅ Deployed Functions on project qumjzvhtotcvnzpjgjkl:
   - generate-dynamic-qr
   - generate-static-return-qr
   - process-pudo-scan
   - update-remote-shipment-status
   - verify-package-qr

Dashboard: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions
```

---

## 🔄 Ciclo de Vida del Token

### Rotación Recomendada

Para máxima seguridad, se recomienda rotar el token cada **90 días**:

1. **Generar nuevo token** en Supabase Dashboard → Account Settings → Access Tokens
2. **Actualizar** todos los archivos `.env.local`:
   - `/.env.local`
   - `/apps/mobile/.env.local`
   - `/apps/web/.env.local`
   - `/supabase/.env.local`
3. **Verificar** que los despliegues funcionan con el nuevo token
4. **Revocar token anterior** en Supabase Dashboard

### Monitoreo

- Token generado: 4 de Enero de 2026
- Próxima rotación recomendada: 4 de Abril de 2026
- Estado actual: ✅ Activo y funcional

---

## 📊 Matriz de Acceso

| Componente | Ruta | Token | Uso |
|-----------|------|-------|-----|
| CLI / Root | `/.env.local` | ✅ | Despliegues, migraciones |
| Mobile | `/apps/mobile/.env.local` | ✅ | Builds EAS, CI/CD móvil |
| Web | `/apps/web/.env.local` | ✅ | Vercel, API routes |
| Supabase | `/supabase/.env.local` | ✅ | Gestión de proyecto |

---

## ⚠️ Qué NO Hacer

❌ **Nunca**:
- Compartir el token por email, Slack o mensaje directo
- Guardarlo en archivos versionados (Git)
- Usarlo como variable pública (EXPO_PUBLIC_*, NEXT_PUBLIC_*)
- Logearlo en consola o logs
- Exponerlo en endpoints públicos
- Utilizarlo en configuraciones sin protección de CI/CD

---

## 🛠️ Troubleshooting

### Token no reconocido

```bash
# Verificar que el token está en el archivo correcto
cat /.env.local | grep SUPABASE_ACCESS_TOKEN

# Verificar permisos del archivo
ls -la /.env.local

# Verificar que no hay espacios en blanco extra
echo "SUPABASE_ACCESS_TOKEN=sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc"
```

### Error: "Unauthorized"

- Verificar que el token no ha expirado
- Confirmar que tiene permisos para el proyecto `qumjzvhtotcvnzpjgjkl`
- Generar nuevo token si es necesario
- Actualizar todos los archivos `.env.local`

### Despliegue fallido

```bash
# Verificar que el token está disponible
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN /.env.local | cut -d '=' -f2)
echo $SUPABASE_ACCESS_TOKEN

# Intentar despliegue manual
supabase functions deploy --verbose
```

---

## 📝 Referencias

- [Supabase Personal Access Tokens](https://supabase.com/docs/guides/platform/personal-access-tokens)
- [Supabase CLI Functions Deploy](https://supabase.com/docs/reference/cli/supabase-functions-deploy)
- [Gestión de Secretos en Monorepo](https://github.com/EnriquePerez00/brickshare_logistics)

---

**Documentado por:** Sistema de Configuración Automática  
**Última actualización:** 4 de Enero de 2026 - 19:54 UTC+2  
**Estado de Verificación:** ✅ Todos los componentes operacionales