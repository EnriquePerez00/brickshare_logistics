# Actualización de Token PAT - 2026-01-04

## ✅ Resumen de Actualización

**Nuevo Token PAT:** `sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44`
**Fecha:** 2026-01-04 22:24 (UTC+2)
**Estado:** Token configurado en todos los archivos

---

## 📂 Archivos Actualizados

### 1. `.env.local` (raíz del proyecto)
```bash
SUPABASE_ACCESS_TOKEN=sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44
```
✅ Actualizado con comentario de fecha

### 2. `apps/web/.env.local`
```bash
SUPABASE_ACCESS_TOKEN=sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44
```
✅ Actualizado con comentario de fecha

### 3. `apps/mobile/.env.local`
```bash
SUPABASE_ACCESS_TOKEN=sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44
```
✅ Actualizado con comentario de fecha

### 4. `supabase/.env.local`
```bash
SUPABASE_ACCESS_TOKEN=sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44
```
✅ Actualizado con comentario de fecha

### 5. `~/.zshrc` (configuración del sistema)
```bash
# ═══════════════════════════════════════════════════════════
# Supabase Configuration - Updated 2026-01-04
# ═══════════════════════════════════════════════════════════
export SUPABASE_ACCESS_TOKEN="sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44"
export SUPABASE_DB_PASSWORD="YOUR_DB_PASSWORD"
```
✅ Actualizado (agregado al final del archivo)

---

## 🔍 Validación del Token

### ✅ Comandos que Funcionan:
```bash
$ supabase projects list
LINKED | ORG ID               | REFERENCE ID         | NAME            | REGION              | CREATED AT
  ●    | pqmubqpdmvwgoazajhwj | qumjzvhtotcvnzpjgjkl | Podo_logistics  | West EU (Ireland)   | 2026-03-19 18:57:11
```

### ❌ Comandos que Requieren Permisos Adicionales:
```bash
$ supabase functions list
# Error: unexpected list functions status 401: {"message":"Unauthorized"}

$ supabase link --project-ref qumjzvhtotcvnzpjgjkl --password "YOUR_DB_PASSWORD"
# Error: Unexpected error retrieving remote project status: {"message":"Unauthorized"}
```

---

## 🎯 Estado Actual del CLI

### Funcionamiento:
- ✅ `supabase projects list` - **Funciona correctamente**
- ✅ Token autenticado en la API de Supabase
- ✅ Acceso a listado de proyectos

### Limitaciones Identificadas:
- ❌ **No puede listar edge functions** - Requiere permisos adicionales
- ❌ **No puede vincular proyecto localmente** - Requiere token con más permisos
- ❌ **No puede desplegar edge functions vía CLI** - Requiere proyecto vinculado

---

## 🔐 Análisis de Permisos del Token

El token PAT actual tiene permisos limitados. Para operaciones con Edge Functions se necesita:

### Permisos Requeridos para Edge Functions:
1. **Read functions** - Listar funciones existentes
2. **Write functions** - Desplegar/actualizar funciones
3. **Manage project** - Vincular proyecto localmente

### Opciones de Solución:

#### Opción A: Regenerar Token con Más Permisos
1. Ir a: https://supabase.com/dashboard/account/tokens
2. Crear nuevo token con permisos:
   - ✅ All organization access
   - ✅ Full access to all resources
3. Actualizar en todos los archivos .env

#### Opción B: Deployment Manual via Dashboard
1. Acceder al dashboard de Supabase
2. Ir a Edge Functions
3. Desplegar manualmente cada función
4. Verificar con cURL/Postman

---

## 📋 Edge Functions del Proyecto

### Funciones Locales (en `supabase/functions/`):
1. **generate-dynamic-qr** - Genera QR dinámicos
2. **generate-static-return-qr** - Genera QR estáticos para retorno
3. **process-pudo-scan** - Procesa escaneos en PUDOs
4. **update-remote-shipment-status** - Actualiza estado en DB remota
5. **verify-package-qr** - Verifica validez de QR

### Estado de Deployment:
- ⚠️ **No verificable vía CLI** (requiere permisos)
- ℹ️ Se debe verificar manualmente en dashboard:
  - URL: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions

---

## 🚀 Próximos Pasos Recomendados

### Paso 1: Verificar Estado Actual en Dashboard
```
1. Acceder a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl
2. Ir a sección "Edge Functions"
3. Verificar qué funciones están desplegadas
4. Anotar versión/fecha de último deployment
```

### Paso 2: Decidir Estrategia de Deployment

**Si las funciones YA están desplegadas:**
- ✅ No hacer nada
- ✅ Documentar estado actual
- ✅ Solo redesplegar si hay cambios

**Si las funciones NO están desplegadas:**
- Opción A: Deployment manual via Dashboard
- Opción B: Regenerar token PAT con permisos completos

### Paso 3: Actualizar Documentación
- Crear registro de estado actual
- Documentar versiones de edge functions
- Establecer proceso de deployment

---

## 📝 Comandos para Actualizar Token en Nueva Terminal

Si abres una nueva terminal y necesitas el token:

```bash
# Recargar configuración de zsh
source ~/.zshrc

# Verificar que el token está cargado
echo $SUPABASE_ACCESS_TOKEN
# Debe mostrar: sbp_1f00330c5b1aa860c9e83f78a5dfa0e915594d44

# Probar conexión
supabase projects list
```

---

## 🔗 Enlaces Útiles

- **Dashboard del Proyecto:** https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl
- **Edge Functions:** https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions
- **Gestión de Tokens:** https://supabase.com/dashboard/account/tokens
- **Documentación CLI:** https://supabase.com/docs/guides/cli

---

## ⚠️ Notas Importantes

1. **El token anterior (`sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc`) está EXPIRADO**
2. **Las entradas antiguas en ~/.zshrc (líneas 44, 47, 80) contienen tokens obsoletos**
3. **La nueva configuración (final del archivo) es la válida**
4. **NO subir este token a GitHub** - está en .gitignore

---

## 🎯 Resumen Ejecutivo

✅ **Token actualizado en todos los archivos de configuración**
✅ **CLI funciona para operaciones básicas (projects list)**
❌ **CLI NO funciona para edge functions (requiere más permisos)**
⚠️ **Se requiere verificación manual en dashboard de Supabase**

**Próxima acción recomendada:** Verificar estado de edge functions en el dashboard de Supabase y decidir si es necesario redesplegar o si ya están actualizadas.