ejecuta e# Instrucciones para Cargar Datos de Prueba

Este documento explica cómo ejecutar el script de seed para generar 100 paquetes de prueba en tu base de datos de Supabase.

## Requisitos Previos

1. Tener todas las migraciones aplicadas (001 a 009)
2. Tener al menos un usuario con rol `admin` en la base de datos
3. Acceso al panel de Supabase (https://qumjzvhtotcvnzpjgjkl.supabase.co)

## Pasos para Ejecutar el Seed

### 1. Acceder al SQL Editor de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto: `qumjzvhtotcvnzpjgjkl`
3. En el menú lateral, haz clic en **SQL Editor**

### 2. Abrir el Script de Seed

1. En VS Code, abre el archivo: `supabase/seed_test_data.sql`
2. Selecciona todo el contenido (Cmd+A / Ctrl+A)
3. Copia el contenido (Cmd+C / Ctrl+C)

### 3. Ejecutar el Script

1. En el SQL Editor de Supabase, haz clic en **New query**
2. Pega el contenido copiado (Cmd+V / Ctrl+V)
3. Haz clic en **RUN** (o presiona Cmd+Enter / Ctrl+Enter)

### 4. Verificar la Ejecución

El script debería ejecutarse en aproximadamente 5-10 segundos y mostrar mensajes como:

```
NOTICE: Starting seed data creation...
NOTICE: Using admin user: [UUID]
NOTICE: Owner user: [UUID]
NOTICE: Location created: [UUID]
NOTICE: Customer created: [UUID]
NOTICE: Created 25 packages...
NOTICE: Created 50 packages...
NOTICE: Created 75 packages...
NOTICE: Created 100 packages...
NOTICE: === SEED DATA COMPLETED ===
NOTICE: pending_dropoff: 10
NOTICE: in_location: 20
NOTICE: picked_up: 60
NOTICE: returned: 10
NOTICE: Total: 100
NOTICE: Total scan logs: 180
NOTICE: ✅ You can now access the dashboard at /dashboard?impersonate=[OWNER_UUID]
```

### 5. Acceder al Dashboard con Datos

Una vez ejecutado el script:

1. Copia el UUID del owner que aparece en el último mensaje
2. Accede a: `http://localhost:3000/dashboard?impersonate=[OWNER_UUID]`
3. Verás las pestañas:
   - **Paquetes Activos**: 30 paquetes (10 pending_dropoff + 20 in_location)
   - **Historial**: 180 registros de escaneo

## Datos Generados

El script crea:

### Usuarios
- **1 Owner de prueba**: `test.owner.pudo@brickshare.eu`
- **1 Customer de prueba**: `test.customer.pudo@example.com`

### Ubicación
- **1 Location PUDO**: "PUDO Test Center - Madrid Centro"
  - Dirección: Calle Gran Vía 45, 28013 Madrid
  - Coordenadas GPS: 40.4200, -3.7038
  - Radio validación: 100m

### Paquetes (100 total)
- **10 paquetes** en estado `pending_dropoff`
- **20 paquetes** en estado `in_location`
- **60 paquetes** en estado `picked_up`
- **10 paquetes** en estado `returned`

### Logs de Escaneo (~180 registros)
- Cada paquete con estado `in_location`, `picked_up` o `returned` tiene al menos 1 log
- Los paquetes `picked_up` y `returned` tienen 2 logs (entrega + recogida)
- Fechas distribuidas en los últimos 60 días
- Coordenadas GPS con pequeñas variaciones alrededor del centro PUDO

## Tracking Codes Generados

Los tracking codes siguen el patrón: `TEST000001` a `TEST000100`

## Troubleshooting

### Error: "No admin user found"

Si recibes este error, significa que no hay ningún usuario con rol `admin` en tu base de datos. Para solucionarlo:

1. Ve a **Authentication** → **Users** en Supabase
2. Crea un nuevo usuario o actualiza uno existente
3. Ve a **Table Editor** → **users**
4. Busca el usuario y cambia su campo `role` a `'admin'`
5. Vuelve a ejecutar el script de seed

### El script se ejecuta pero no veo datos

1. Verifica que estés accediendo con el UUID correcto del owner
2. Comprueba que las migraciones 008 y 009 estén aplicadas
3. Revisa los logs de la consola del navegador para errores de API

### "Duplicate key value violates unique constraint"

Si el script ya se ejecutó antes, algunos datos pueden existir. Puedes:

1. **Opción A**: Cambiar el email del owner en el script (línea 51)
2. **Opción B**: Eliminar los datos de prueba existentes:
   ```sql
   DELETE FROM public.pudo_scan_logs WHERE pudo_location_id IN (
     SELECT id FROM public.locations WHERE name = 'PUDO Test Center - Madrid Centro'
   );
   DELETE FROM public.packages WHERE tracking_code LIKE 'TEST%';
   DELETE FROM public.locations WHERE name = 'PUDO Test Center - Madrid Centro';
   DELETE FROM public.users WHERE email IN ('test.owner.pudo@brickshare.eu', 'test.customer.pudo@example.com');
   ```

## Limpiar Datos de Prueba

Para eliminar todos los datos de prueba generados:

```sql
-- Eliminar logs de escaneo
DELETE FROM public.pudo_scan_logs 
WHERE pudo_location_id IN (
  SELECT id FROM public.locations 
  WHERE name = 'PUDO Test Center - Madrid Centro'
);

-- Eliminar paquetes
DELETE FROM public.packages 
WHERE tracking_code LIKE 'TEST%';

-- Eliminar location
DELETE FROM public.locations 
WHERE name = 'PUDO Test Center - Madrid Centro';

-- Eliminar usuarios de prueba
DELETE FROM public.users 
WHERE email IN (
  'test.owner.pudo@brickshare.eu', 
  'test.customer.pudo@example.com'
);
```

## Próximos Pasos

Una vez cargados los datos:

1. Prueba los filtros en la pestaña "Historial"
2. Verifica la exportación a CSV
3. Comprueba que las estadísticas se calculan correctamente
4. Prueba el modo impersonación desde el Panel Admin