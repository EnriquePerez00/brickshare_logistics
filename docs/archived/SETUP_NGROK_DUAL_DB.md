# 🌐 Setup ngrok - Exponer DB2 Brickshare Localmente

## Problema
- DB1 (Brickshare_logistics) corre en cloud: `https://qumjzvhtotcvnzpjgjkl.supabase.co`
- DB2 (Brickshare) corre localmente: `http://127.0.0.1:54331`
- La Edge Function en DB1 cloud no puede acceder a DB2 local
- Necesitamos exponer DB2 públicamente para que DB1 cloud lo pueda alcanzar

## Solución: Usar ngrok para crear un túnel público

### PASO 1: Instalar ngrok

```bash
# macOS
brew install ngrok

# O descargar de https://ngrok.com/download
```

### PASO 2: Crear cuenta en ngrok (si no tienes)

1. Ve a https://ngrok.com/
2. Crea una cuenta gratuita
3. Obtén tu authtoken en https://dashboard.ngrok.com/auth

### PASO 3: Autenticar ngrok (una sola vez)

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### PASO 4: Verificar que DB2 (Brickshare) está corriendo

```bash
cd /Users/I764690/Code_personal/Brickshare
npx supabase start

# Debería mostrar que está corriendo en puerto 54331
# Ejemplo: "API URL: http://localhost:54331"
```

### PASO 5: Abrir OTRA terminal y ejecutar ngrok

```bash
ngrok http 54331
```

Verás algo como:
```
ngrok by @inconshreveable

Session Status                online
Account                       your-email@example.com
Version                       3.3.5
Region                        us
Latency                        -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://semblably-dizzied-bruno.ngrok-free.dev -> http://localhost:54331
```

**COPIA LA URL PÚBLICA**: `https://semblably-dizzied-bruno.ngrok-free.dev`

### PASO 6: Configurar variables de entorno en Supabase Dashboard

1. Ve a: https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/settings/functions
2. Haz click en "Environment Variables"
3. Agrega estas variables:
   - **Nombre**: `SUPABASE_brickshare_API_URL`
   - **Valor**: `https://semblably-dizzied-bruno.ngrok-free.dev` (usa tu URL de ngrok actual)
   - Click "Save"

4. Agrega otra:
   - **Nombre**: `SUPABASE_brickshare_SERVICE_ROLE_KEY`
   - **Valor**: `[Tu clave de servicio local de Brickshare]` (obtén este valor de tu proyecto Brickshare local)
   - Click "Save"

### PASO 7: Reiniciar la Edge Function en Supabase Dashboard

En https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl/functions/process-pudo-scan
- Click en "Deploy new version" o actualiza el archivo para que se redeploy

### PASO 8: Probar la conexión

Desde tu app móvil, intenta escanear un QR. La Edge Function debería poder acceder a DB2 a través del túnel de ngrok.

## ⚠️ Notas Importantes

- **ngrok genera una URL diferente cada vez**: Cada vez que ejecutes ngrok, tendrás una URL nueva. Necesitarás actualizar las variables de entorno en Supabase.
- **ngrok gratis tiene limitaciones**: Perfecto para desarrollo local. Para producción, usa una solución más permanente.
- **Mantén ngrok corriendo**: Debes tener la terminal con ngrok abierta mientras uses la app.
- **Mantén Brickshare corriendo**: En otra terminal, Brickshare debe estar ejecutando `npx supabase start`.

## 🔄 Flujo Completo

```
[Móvil] 
  ↓ (JWT de DB1)
[Edge Function en DB1 Cloud]
  ↓ (intenta usar SUPABASE_brickshare_API_URL)
[ngrok tunnel: https://semblably-dizzied-bruno.ngrok-free.dev]
  ↓ (redirige a localhost:54331)
[DB2 Brickshare Local: http://127.0.0.1:54331]
```

## ✅ Verificación

Para verificar que todo funciona:

1. **Verifica que DB2 está corriendo:**
   ```bash
   curl http://127.0.0.1:54331/rest/v1/health
   ```
   Debería retornar `{"version":"..."}`

2. **Verifica que ngrok está redirigiendo:**
   ```bash
   curl https://semblably-dizzied-bruno.ngrok-free.dev/rest/v1/health
   ```
   Debería retornar lo mismo que arriba

3. **Verifica variables en Supabase:**
   - Dashboard → Settings → Functions → Environment Variables
   - Confirma que `SUPABASE_brickshare_API_URL` y `SUPABASE_brickshare_SERVICE_ROLE_KEY` están configuradas

4. **Prueba con la app móvil:**
   - Intenta escanear un QR en el simulador
   - Los logs en Supabase deberían mostrar que la Edge Function pudo conectarse a DB2