# Brickshare Logistics

Plataforma de gestión de logística para puntos PUDO (Pick Up Drop Off) con sincronización en tiempo real.

## Configuración Rápida

### Requisitos Previos
- Node.js >= 18
- Expo CLI: `npm install -g expo-cli`
- Android SDK (para compilar app móvil)
- Supabase CLI: `npm install -g supabase`

### Variables de Entorno

#### Personal Access Token (PAT) de Supabase

Para hacer deploy de Edge Functions a Supabase remoto, necesitas un Personal Access Token:

```bash
# Guardado localmente para referencia:
SUPABASE_ACCESS_TOKEN=sbp_6d79d81b64210cec8ffdbed83ded20da4ea47567

# Para usar en desarrollo:
export SUPABASE_ACCESS_TOKEN="sbp_6d79d81b64210cec8ffdbed83ded20da4ea47567"
```

**⚠️ Seguridad:** Este token tiene permisos amplios. NO lo comitas a git. Mantenlo seguro y regeneralo si es comprometido.

## Estructura del Proyecto

```
.
├── apps/
│   ├── mobile/          # App React Native (Android/iOS)
│   └── web/             # Dashboard Next.js
├── packages/
│   └── shared/          # Tipos y utilidades compartidas
├── supabase/
│   ├── migrations/      # Migraciones de BD
│   └── functions/       # Edge Functions
│       └── process-pudo-scan/   # Procesa scans de paquetes
└── scripts/             # Utilidades CLI
```

## Edge Functions

### process-pudo-scan

Procesa scans de códigos de barras y QR dinámicos en puntos PUDO.

**Ubicación:** `supabase/functions/process-pudo-scan/index.ts`

**Cambios recientes (29/03/2026):**
- ✅ Fixed role check: `['owner', 'admin']` → `['usuarios', 'admin']`
- ✅ Deployed a Supabase remoto exitosamente

**Hacer deploy:**
```bash
export SUPABASE_ACCESS_TOKEN="sbp_6d79d81b64210cec8ffdbed83ded20da4ea47567"
npx supabase functions deploy process-pudo-scan
```

## Desarrollo Local

### Android Emulator

```bash
cd apps/mobile
npm install
npx expo run:android
```

La app incluye logging ultra-detallado en `ScannerScreen.tsx` que captura:
- Autenticación y sesiones
- Ubicación GPS (lat, lon, accuracy)
- Requests/responses a Edge Functions
- Duración de operaciones
- Errores detallados con stack traces

### Web Dashboard

```bash
cd apps/web
npm install
npm run dev
```

Abre `http://localhost:3000`

## Testing

### Simulación Manual de Scans

En el emulador Android:
1. Toca botón "⌨️ Código Manual"
2. Ingresa un tracking code (ej: `BS-DEL-7A2D335C-8FA`)
3. Toca "🚀 Procesar Scan"

### Upload de Imágenes

Para testear decodificación de códigos de barras desde imágenes:
1. Toca "📂 Desde Download"
2. Selecciona imagen con código de barras
3. El sistema intenta decodificar automáticamente
4. Si falla, puedes ingresar manualmente

## Base de Datos

**Proyecto Supabase:** `qumjzvhtotcvnzpjgjkl`

**Conexión remota:**
```
URL: https://qumjzvhtotcvnzpjgjkl.supabase.co
```

### Migraciones

Las migraciones se aplican automáticamente desde `supabase/migrations/`. Para aplicar manualmente:

```bash
npx supabase db push
```

## Troubleshooting

### 403 Forbidden en Edge Function

**Síntoma:** "Error: Unauthorized (role check failed)"

**Causa:** El usuario no tiene rol correcto en Supabase

**Solución:** La migración `20260320195000_refactor_roles.sql` debe estar aplicada. Verifica con:
```sql
SELECT role_id, user_id FROM auth.user_roles WHERE user_id = 'tu_user_id';
```

### Puerto 8081 en uso

Si el emulator falla diciendo que el puerto 8081 está ocupado:

```bash
# Matar proceso anterior
kill $(lsof -t -i:8081)

# O usar puerto diferente
npx expo run:android -- --port 8082
```

## Documentación Adicional

- [SETUP_MOBILE.md](docs/SETUP_MOBILE.md) - Configuración detallada de Android
- [SETUP_ANDROID_SDK.md](docs/SETUP_ANDROID_SDK.md) - SDK de Android
- [PUDO_DROPOFF_FLOW_FIX.md](docs/PUDO_DROPOFF_FLOW_FIX.md) - Flujo de dropoff
- [FIX_EDGE_FUNCTION_ERROR.md](docs/FIX_EDGE_FUNCTION_ERROR.md) - Fix de errores

## Commits Recientes

- **29/03/2026:** Fixed edge function role check y añadido logging detallado en ScannerScreen
  - `supabase/functions/process-pudo-scan/index.ts` - Changed role validation
  - `apps/mobile/src/screens/ScannerScreen.tsx` - Added comprehensive logging
  - Deployed exitosamente a Supabase remoto

## Licencia

Privado - Brickshare