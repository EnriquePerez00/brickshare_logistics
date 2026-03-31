# Diagnóstico: Dashboard y Conexión a Base de Datos Cloud

**Fecha**: 31/03/2026  
**Problema reportado**: Los paquetes visibles en Supabase Cloud Dashboard no aparecen en el dashboard web del usuario

## 🔍 Investigación Realizada

### 1. Verificación de Configuración

✅ **Apps Web está CORRECTAMENTE configurada**
- Archivo: `apps/web/.env.local`
- `NEXT_PUBLIC_SUPABASE_URL=https://qumjzvhtotcvnzpjgjkl.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...` (Cloud Bricklogistics)

✅ **Dashboard se conecta a la base de datos CLOUD correctamente**
- Confirmado mediante script de prueba
- Las locations se pueden consultar sin problemas
- La autenticación funciona correctamente

### 2. Problemas Identificados

#### ❌ Problema 1: Los paquetes NO EXISTEN en la base de datos
```
📦 Paquetes buscados:
- BS-DEI-714C3F3D-FFD
- BS-DEL-7A2D335C-8FA

🔍 Resultado: 0 paquetes encontrados
```

**Posibles causas:**
1. Los paquetes fueron eliminados de la base de datos
2. La captura de pantalla era de un momento anterior
3. Los paquetes están en una tabla diferente (external_packages, package_events, etc.)
4. Los tracking codes son diferentes a los mostrados

#### ❌ Problema 2: Error 401 Unauthorized al cargar el dashboard
```
GET /api/pudo/active-packages?location_id=9ae13c49-de91-462b-ba63-32c8e7a546a5 401
```

**Causa:** El usuario no está autenticado correctamente en el dashboard web.

**Solución:** El usuario debe:
1. Ir a http://localhost:3000/auth
2. Iniciar sesión con un usuario válido
3. Ese usuario debe tener una `location` asignada en la tabla `locations`

### 3. Arquitectura Actual

```
┌─────────────────────────────────────────┐
│  Dashboard Web (localhost:3000)         │
│  ✅ Conectado a Cloud DB                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Supabase Cloud (qumjzvhtotcvnzpjgjkl)  │
│  - URL: https://qumjzvhtotcvnzpjgjkl... │
│  - Locations: 2 encontradas             │
│  - Packages in_location: 0 encontrados  │
└─────────────────────────────────────────┘
```

## ✅ Soluciones Implementadas

### 1. Variables de Entorno Actualizadas
Se actualizaron todas las referencias de variables en:
- ✅ Edge Functions (5 archivos)
- ✅ Scripts (5 archivos)
- ✅ API Routes (3 archivos)
- ✅ Archivos de configuración (4 archivos)

### 2. Scripts de Diagnóstico Creados
- `scripts/test-dashboard-connection.mjs` - Verifica conexión a cloud DB
- `scripts/check-packages-status.mjs` - Verifica estado de paquetes específicos

## 📋 Próximos Pasos

### Para ver paquetes en el dashboard:

#### Opción A: Autenticarse correctamente
1. Ir a http://localhost:3000/auth
2. Iniciar sesión con credenciales válidas
3. Verificar que el usuario tenga una location asignada

#### Opción B: Crear paquetes de prueba
1. Usar la app móvil para escanear paquetes
2. O crear paquetes manualmente en Supabase Dashboard:
```sql
INSERT INTO packages (
  tracking_code,
  status,
  location_id,
  customer_id,
  created_at
) VALUES (
  'BS-DEL-TEST123',
  'in_location',
  '9ae13c49-de91-462b-ba63-32c8e7a546a5',
  NULL,
  NOW()
);
```

#### Opción C: Verificar datos en Supabase Dashboard
1. Ir a https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl
2. Buscar en la tabla `packages`
3. Verificar:
   - ¿Existen los paquetes?
   - ¿Cuál es su `status`?
   - ¿Tienen `location_id` asignado?

## 🎯 Resumen

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Configuración Web App | ✅ OK | Apunta a Cloud DB correctamente |
| Conexión a Cloud DB | ✅ OK | Probado con éxito |
| Paquetes en DB | ❌ NO | 0 paquetes con status `in_location` |
| Autenticación Usuario | ❌ NO | Error 401 - Usuario no autenticado |
| Locations disponibles | ✅ OK | 2 locations encontradas |

## 🔐 Recordatorio de Seguridad

Las variables de entorno incluidas en este documento son de desarrollo/prueba. Para producción:
- Usar variables diferentes
- Rotar todas las claves
- Configurar RLS apropiadamente
- Revisar políticas de acceso