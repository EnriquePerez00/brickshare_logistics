# Guía para Regenerar Personal Access Token (PAT) de Supabase

## 🔴 Problema Detectado

Ambos tokens disponibles están dando error 401 Unauthorized:
- Token antiguo en variable de entorno: `sbp_e681814516f37e948592f4dc17336c07e9faecda`
- Token en archivos .env.local: `sbp_33162af0de27d202ff3b95edfc9ddea0802fe3dc`

Esto indica que **necesitas generar un nuevo Personal Access Token** con los permisos correctos.

## 📋 Pasos para Generar Nuevo PAT

### 1. Accede al Dashboard de Supabase

Ve a: https://supabase.com/dashboard/account/tokens

### 2. Genera un Nuevo Token

1. Haz clic en **"Generate new token"**
2. Dale un nombre descriptivo: `brickshare_logistics_PAT_2026`
3. Selecciona los siguientes permisos:
   - ✅ **All access** (recomendado para desarrollo)
   
   O si prefieres permisos específicos:
   - ✅ `functions.write` - Para desplegar Edge Functions
   - ✅ `functions.read` - Para listar Edge Functions
   - ✅ `projects.read` - Para acceder al proyecto
   - ✅ `organizations.read` - Para acceder a la organización

4. Haz clic en **"Generate token"**
5. **COPIA EL TOKEN INMEDIATAMENTE** (solo se muestra una vez)

### 3. Actualiza el Token en Todos los Archivos

Una vez tengas el nuevo token (ej: `sbp_NUEVO_TOKEN_AQUI`), actualízalo en:

#### A. Variable de entorno del sistema (sesión actual)
```bash
export SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI
```

#### B. Archivo `.env.local` (raíz del proyecto)
```bash
# Edita la línea 20
SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI
```

#### C. Archivo `apps/web/.env.local`
```bash
# Edita la línea 10
SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI
```

#### D. Archivo `apps/mobile/.env.local`
```bash
# Edita la línea 34
SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI
```

#### E. Archivo `supabase/.env.local`
```bash
# Edita la línea 12
SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI
```

### 4. Re-autentícate y Despliega

```bash
# Re-autentícate con el nuevo token
npx supabase login --token $SUPABASE_ACCESS_TOKEN

# Verifica que estás logueado
npx supabase projects list

# Despliega la Edge Function
cd supabase
npx supabase functions deploy process-pudo-scan --no-verify-jwt
```

## 🔒 Seguridad del Token

⚠️ **IMPORTANTE:**
- El PAT da acceso completo a tu proyecto de Supabase
- NUNCA lo subas a GitHub o repositorios públicos
- Los archivos `.env.local` están en `.gitignore` para protegerlo
- Si el token se compromete, revócalo inmediatamente desde el dashboard

## 📝 Para Hacer el Token Persistente en Tu Sistema

Si quieres que el token persista entre sesiones de terminal, agrégalo a tu archivo de configuración de shell:

### Para zsh (macOS por defecto):
```bash
echo 'export SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI' >> ~/.zshrc
source ~/.zshrc
```

### Para bash:
```bash
echo 'export SUPABASE_ACCESS_TOKEN=sbp_NUEVO_TOKEN_AQUI' >> ~/.bashrc
source ~/.bashrc
```

## ✅ Verificación

Después de actualizar el token, verifica que funciona:

```bash
# Debe devolver una lista de tus proyectos
npx supabase projects list

# Debe mostrar las funciones desplegadas
cd supabase
npx supabase functions list
```

## 🎯 Resumen de lo que Necesitas Hacer Ahora

1. Ve a https://supabase.com/dashboard/account/tokens
2. Genera un nuevo token con permisos completos
3. Copia el token
4. Actualiza los 4 archivos `.env.local` mencionados arriba
5. Actualiza tu variable de entorno: `export SUPABASE_ACCESS_TOKEN=tu_nuevo_token`
6. Ejecuta: `npx supabase login --token $SUPABASE_ACCESS_TOKEN`
7. Ejecuta: `cd supabase && npx supabase functions deploy process-pudo-scan --no-verify-jwt`

## 📞 Si Continúa Fallando

Si después de regenerar el token continúa el error 401:

1. Verifica que el token tenga los permisos correctos
2. Verifica que estés en la organización correcta
3. Intenta el login interactivo: `npx supabase login` (abrirá navegador)
4. Como último recurso, despliega manualmente desde el dashboard de Supabase