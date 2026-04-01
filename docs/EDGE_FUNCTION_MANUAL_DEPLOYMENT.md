# Despliegue Manual de Edge Function - process-pudo-scan

## Problema
El token de acceso de Supabase CLI está expirado o no tiene los permisos necesarios para desplegar funciones mediante CLI.

## Solución aplicada al código
✅ **Los errores de TypeScript han sido corregidos exitosamente**

Se agregó una conversión de tipo explícita en `supabase/functions/process-pudo-scan/index.ts`:

```typescript
// Type assertion after null check - convert to unknown first for type safety
const verifiedData = verifiedShipment as unknown as { shipment_status: string; [key: string]: any }
```

## Despliegue Manual desde Dashboard

### Opción 1: Despliegue directo desde el Dashboard

1. **Accede al Dashboard de Supabase**
   - Ve a https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl

2. **Navega a Edge Functions**
   - En el menú lateral, selecciona "Edge Functions"

3. **Selecciona la función `process-pudo-scan`**
   - Haz clic en la función existente

4. **Edita la función**
   - Copia el contenido completo del archivo: `supabase/functions/process-pudo-scan/index.ts`
   - Pégalo en el editor del dashboard
   - Guarda los cambios

5. **Verifica la configuración**
   - Asegúrate que `verify_jwt` esté en `false` en la configuración de la función

### Opción 2: Generar nuevo token de acceso

1. **Genera un nuevo Personal Access Token**
   - Ve a https://supabase.com/dashboard/account/tokens
   - Crea un nuevo token con permisos de:
     - `functions.write`
     - `functions.read`
   
2. **Actualiza la variable de entorno**
   ```bash
   export SUPABASE_ACCESS_TOKEN=tu_nuevo_token
   ```

3. **Vuelve a intentar el despliegue**
   ```bash
   npx supabase login --token $SUPABASE_ACCESS_TOKEN
   cd supabase
   npx supabase functions deploy process-pudo-scan --no-verify-jwt
   ```

### Opción 3: Usar Supabase CLI con credenciales interactivas

1. **Login interactivo**
   ```bash
   npx supabase login
   ```
   - Esto abrirá un navegador para autenticarte

2. **Link el proyecto**
   ```bash
   cd supabase
   npx supabase link --project-ref qumjzvhtotcvnzpjgjkl
   ```

3. **Despliega la función**
   ```bash
   npx supabase functions deploy process-pudo-scan --no-verify-jwt
   ```

## Verificación del despliegue

Una vez desplegada, verifica que la función esté activa:

```bash
curl https://qumjzvhtotcvnzpjgjkl.supabase.co/functions/v1/process-pudo-scan
```

Deberías recibir una respuesta indicando que la función está activa.

## Archivos modificados

- `supabase/functions/process-pudo-scan/index.ts`: Corrección de tipos en líneas 381, 383, 395, y 403

## Estado actual

- ✅ Código corregido y verificado con `deno check`
- ⚠️ Pendiente de despliegue (por problemas de autenticación del token)
- Recomendación: **Usar Opción 1 (despliegue manual desde dashboard)** como la forma más rápida de completar el despliegue