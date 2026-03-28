# Guía de Instalación - Sistema PUDO

**Versión:** 1.0  
**Fecha:** 24/03/2026

---

## 📋 Prerrequisitos

- Node.js 18+
- Supabase CLI instalado
- Acceso a la base de datos remota de Brickshare
- Expo CLI para desarrollo móvil (opcional)

---

## 🚀 Instalación Paso a Paso

### 1. Aplicar Migración de Base de Datos

```bash
cd /Users/I764690/Code_personal/Brickshare_logistics

# Verificar migraciones pendientes
supabase migration list

# Aplicar migración 008
supabase db push

# Verificar que se aplicó correctamente
supabase db execute 'SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '\''pudo_scan_logs'\'''
```

**Salida esperada:**
```
Applying migration 008_add_pudo_scan_logs.sql...
✔ Migration applied successfully
```

---

### 2. Configurar Variables de Entorno

#### 2.1 Variables para Edge Functions

Añadir en **Supabase Dashboard → Settings → Edge Functions → Environment Variables:**

```bash
# Base de datos remota de Brickshare
REMOTE_DB_URL=https://[tu-proyecto-remoto].supabase.co
REMOTE_DB_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...[tu-service-key]

# Estas ya deberían existir
SUPABASE_URL=https://[tu-proyecto].supabase.co
SUPABASE_ANON_KEY=eyJhbGc...[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...[tu-service-role-key]
QR_JWT_SECRET=[tu-secret-min-256-bits]
```

#### 2.2 Variables para Desarrollo Local

Crear/actualizar `.env.local`:

```bash
# En apps/web/.env.local
BRICKSHARE_INTEGRATION_SECRET=tu_secret_compartido

# En apps/mobile/.env.local (si existe)
EXPO_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...[tu-anon-key]
```

---

### 3. Deployar Edge Function

```bash
# Desde la raíz del proyecto
cd /Users/I764690/Code_personal/Brickshare_logistics

# Deployar función
supabase functions deploy update-remote-shipment-status

# Verificar deployment
supabase functions list
```

**Salida esperada:**
```
✔ Function update-remote-shipment-status deployed successfully
URL: https://[tu-proyecto].supabase.co/functions/v1/update-remote-shipment-status
```

---

### 4. Instalar Dependencias de App Móvil

```bash
cd apps/mobile

# Instalar expo-location
npm install expo-location

# Verificar instalación
npm list expo-location
```

**Salida esperada:**
```
├── expo-location@18.0.7
```

---

### 5. Configurar Coordenadas GPS de Puntos PUDO

**Opción A: Mediante SQL**

```sql
-- Actualizar coordenadas de un punto PUDO existente
UPDATE public.locations
SET 
  latitude = 40.4168,        -- Latitud del PUDO
  longitude = -3.7038,       -- Longitud del PUDO
  gps_validation_radius_meters = 50  -- Radio en metros
WHERE id = '[uuid-del-pudo]';

-- Verificar configuración
SELECT 
  id, 
  name, 
  latitude, 
  longitude, 
  gps_validation_radius_meters
FROM public.locations
WHERE latitude IS NOT NULL;
```

**Opción B: Mediante App Web**

1. Acceder al panel de administración
2. Seleccionar el punto PUDO
3. Añadir coordenadas GPS
4. Configurar radio de validación (por defecto 50m)

---

### 6. Ejecutar Tests

#### 6.1 Tests de Edge Function (TypeScript)

```bash
cd supabase/functions/update-remote-shipment-status

# Ejecutar tests
deno test index.test.ts --allow-all
```

**Salida esperada:**
```
running 10 tests from ./index.test.ts
test calculateDistance - Madrid Centro a Madrid Norte (~10km) ... ok (5ms)
test calculateDistance - Misma ubicación (0 metros) ... ok (1ms)
...
test result: ok. 10 passed; 0 failed; 0 ignored
```

#### 6.2 Tests de Base de Datos (SQL)

```bash
# Ejecutar tests SQL
psql [tu-connection-string] -f supabase/migrations/008_add_pudo_scan_logs.test.sql
```

**Salida esperada:**
```
NOTICE:  PASS: GPS validation dentro del radio (15m)
NOTICE:  PASS: GPS validation fuera del radio (100m)
...
NOTICE:  TOTAL: 10/10 TESTS PASSED ✓
```

---

## 🔧 Configuración Avanzada

### Ajustar Radio de Validación GPS

Para locales grandes o zonas con mala precisión GPS:

```sql
UPDATE public.locations
SET gps_validation_radius_meters = 100  -- Aumentar a 100m
WHERE name = 'Nombre del PUDO';
```

### Desactivar Validación GPS para un PUDO

```sql
UPDATE public.locations
SET 
  latitude = NULL,
  longitude = NULL
WHERE id = '[uuid-del-pudo]';
-- Con NULL, la validación GPS se omite automáticamente
```

---

## 📱 Compilar y Distribuir App Móvil

### Desarrollo

```bash
cd apps/mobile

# Iniciar en modo desarrollo
npx expo start

# Escanear QR con Expo Go en tu dispositivo
```

### Producción (Build para iOS/Android)

```bash
# Configurar credenciales
eas login

# Build para iOS
eas build --platform ios

# Build para Android
eas build --platform android
```

---

## ✅ Verificación Post-Instalación

### Checklist

- [ ] Migración 008 aplicada correctamente
- [ ] Tabla `pudo_scan_logs` creada con índices
- [ ] Función `log_pudo_scan` disponible
- [ ] Edge Function `update-remote-shipment-status` deployada
- [ ] Variables de entorno configuradas
- [ ] `expo-location` instalado en app móvil
- [ ] Coordenadas GPS configuradas para al menos 1 punto PUDO
- [ ] Tests SQL pasan (10/10)
- [ ] Tests TypeScript pasan (10/10)

### Prueba Manual

1. **Configurar punto PUDO de prueba:**
   ```sql
   UPDATE locations 
   SET latitude = [tu-latitud], longitude = [tu-longitud]
   WHERE id = '[tu-pudo-id]';
   ```

2. **Simular escaneo desde app móvil:**
   - Abrir app móvil
   - Iniciar sesión como operador PUDO
   - Seleccionar modo "Entrega (QR)"
   - Verificar que se muestra ubicación GPS
   - Escanear QR de prueba

3. **Verificar en base de datos:**
   ```sql
   SELECT * FROM pudo_scan_logs
   ORDER BY scan_timestamp DESC
   LIMIT 5;
   ```

4. **Verificar estado actualizado en BD remota:**
   ```sql
   -- Conectar a BD remota
   SELECT shipping_status 
   FROM shipments 
   WHERE id = '[shipment-id-de-prueba]';
   ```

---

## 🐛 Troubleshooting

### Error: "Migration already applied"

**Solución:**
```bash
# Ver historial de migraciones
supabase migration list

# Si 008 ya está aplicada, omitir este paso
```

---

### Error: "expo-location not found"

**Solución:**
```bash
cd apps/mobile
rm -rf node_modules
npm install
npx expo install expo-location
```

---

### Error: "GPS validation failed" en pruebas

**Causa:** Las coordenadas del operador no coinciden con las del PUDO

**Solución:**
```sql
-- Temporalmente desactivar GPS para pruebas
UPDATE locations 
SET latitude = NULL, longitude = NULL
WHERE id = '[tu-pudo-id]';

-- O usar coordenadas reales de tu ubicación actual
```

---

### Error: "Shipment not found in remote database"

**Causa:** No hay conectividad con BD remota o credenciales incorrectas

**Solución:**
1. Verificar `REMOTE_DB_URL` en variables de entorno
2. Verificar `REMOTE_DB_SERVICE_KEY` tiene permisos
3. Probar conectividad:
   ```bash
   curl -X GET \
     "[REMOTE_DB_URL]/rest/v1/shipments?limit=1" \
     -H "apikey: [REMOTE_DB_SERVICE_KEY]"
   ```

---

## 📊 Monitoreo Post-Deployment

### Dashboard de Métricas

**1. Total de escaneos por día:**
```sql
SELECT 
  DATE(scan_timestamp) as date,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE api_request_successful = true) as successful,
  COUNT(*) FILTER (WHERE api_request_successful = false) as failed
FROM pudo_scan_logs
WHERE scan_timestamp > now() - INTERVAL '7 days'
GROUP BY DATE(scan_timestamp)
ORDER BY date DESC;
```

**2. Problemas de GPS:**
```sql
SELECT 
  l.name,
  COUNT(*) FILTER (WHERE gps_validation_passed = false) as gps_failures
FROM pudo_scan_logs psl
JOIN locations l ON l.id = psl.pudo_location_id
WHERE psl.scan_timestamp > now() - INTERVAL '24 hours'
GROUP BY l.name
HAVING COUNT(*) FILTER (WHERE gps_validation_passed = false) > 0;
```

**3. Performance de API:**
```sql
SELECT 
  AVG(api_request_duration_ms) as avg_ms,
  MAX(api_request_duration_ms) as max_ms,
  COUNT(*) FILTER (WHERE api_request_duration_ms > 1000) as slow_requests
FROM pudo_scan_logs
WHERE scan_timestamp > now() - INTERVAL '24 hours'
  AND api_request_successful = true;
```

---

## 🔄 Actualización del Sistema

### Rollback de Migración (si es necesario)

```bash
# Revertir última migración
supabase db reset

# Re-aplicar migraciones hasta la 007
supabase db push
```

### Actualizar Edge Function

```bash
# Modificar código en supabase/functions/update-remote-shipment-status/index.ts
# Luego deployar nueva versión:
supabase functions deploy update-remote-shipment-status
```

---

## 📚 Recursos Adicionales

- **Documentación completa:** `docs/PUDO_SCANNING_PROCESS.md`
- **Diagrama de estados:** `docs/PUDO_STATUS_TRANSITIONS.md`
- **Análisis de auditoría:** `docs/AUDIT_AND_INTEGRATION_ANALYSIS.md`

---

## 📞 Soporte

Para problemas o dudas:
1. Revisar logs en Supabase Dashboard → Edge Functions → Logs
2. Revisar tabla `pudo_scan_logs` para debugging
3. Consultar documentación técnica
4. Contactar al equipo de desarrollo

---

**Documento preparado:** 24/03/2026  
**Última actualización:** 24/03/2026