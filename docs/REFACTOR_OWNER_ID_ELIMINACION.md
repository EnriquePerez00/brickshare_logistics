# Refactor: Eliminación de owner_id y Simplificación de Roles

## Fecha
31 de marzo de 2026

## Problema Original
El usuario reportó que no veía registros en el dashboard a pesar de tener 2 paquetes en la base de datos cloud. El análisis reveló que el problema raíz era el modelo de datos obsoleto basado en `owner_id` que no permitía la flexibilidad necesaria para el sistema.

## Solución Implementada

### 1. Migración SQL (013_refactor_remove_owner_id.sql)

#### Cambios en el Esquema
- **Nueva tabla `user_locations`**: Relación many-to-many entre usuarios y locations
  - `user_id` → `users.id`
  - `location_id` → `locations.id`
  - Permite que múltiples usuarios trabajen en múltiples locations

- **Eliminación de `locations.owner_id`**: Ya no existe la columna owner_id

- **Simplificación de roles**: Solo quedan 2 roles
  - `admin`: Administradores del sistema
  - `user`: Usuarios regulares (antiguos 'owner' y 'customer')

#### Nuevas Funciones y Políticas RLS
- **Función `my_location_ids()`**: Retorna los location_ids asignados al usuario actual
- **Nuevas políticas RLS para `locations`**:
  - Users solo ven locations asignados a ellos
  - Admins tienen acceso completo

- **Nuevas políticas RLS para `packages`**:
  - Users solo ven/modifican paquetes de SUS locations asignados
  - Admins tienen acceso completo

- **Políticas RLS para `user_locations`**:
  - Users ven sus propias asignaciones
  - Admins tienen control total

#### Vistas Actualizadas
- `monthly_profitability`: Eliminadas referencias a owner_id
- `pudo_operations_history`: Eliminadas referencias a owner_id

### 2. Actualizaciones del Frontend Web

#### apps/web/app/dashboard/page.tsx
- ✅ Cambiado de `locations.owner_id` a `user_locations` join
- ✅ Fetch de location_id mediante `user_locations` table

#### apps/web/components/ProfileTab.tsx
- ✅ Eliminadas referencias a `owner_id` al crear/actualizar locations
- ✅ Creación automática de entrada en `user_locations` al crear location
- ✅ Cambio de rol 'usuarios' a 'user'
- ✅ Fetch de location mediante join con `user_locations`

#### apps/web/components/AdminSearchBar.tsx
- ✅ Eliminada la columna `owner` del SELECT de locations
- ✅ Eliminada la visualización de owner email
- ✅ Cambio de 'usuarios' a 'user' en el label

#### apps/web/app/admin/page.tsx
- ✅ Fetch de users con role='user' en lugar de 'usuarios'
- ✅ Eliminado `owner_id` del SELECT de locations
- ✅ Uso de `user_locations` para mapear users → locations
- ✅ Construcción de locationMap usando user_locations join

### 3. Estado Actual

#### ✅ Completado
- Migración SQL completa creada
- Todos los archivos del frontend web actualizados
- Sin errores de TypeScript

#### ⏳ Pendiente
- Aplicar la migración SQL a la base de datos
- Buscar y actualizar referencias en apps/mobile
- Buscar y actualizar referencias en edge functions
- Crear datos de prueba con la nueva estructura
- Verificar que el dashboard muestra los paquetes correctamente

## Próximos Pasos

### 1. Aplicar Migración SQL
```bash
cd supabase
supabase db push
```

### 2. Crear Datos de Prueba
Necesitamos crear:
- Un usuario con role='user'
- Un location
- Una entrada en user_locations vinculando el user al location
- Algunos packages en ese location

### 3. Verificar el Dashboard
- Login como el usuario de prueba
- Verificar que se ven los paquetes en "Paquetes Activos"
- Verificar que las políticas RLS funcionan correctamente

### 4. Actualizar Resto del Código
- Buscar referencias a 'owner' y 'customer' en apps/mobile
- Buscar referencias a owner_id en edge functions
- Actualizar según sea necesario

## Beneficios del Refactor

1. **Flexibilidad**: Un usuario puede trabajar en múltiples locations
2. **Simplicidad**: Solo 2 roles en lugar de 4
3. **Claridad**: La relación many-to-many es más explícita
4. **Mantenibilidad**: Menos lógica condicional basada en roles
5. **Seguridad**: Las políticas RLS son más claras y fáciles de auditar

## Notas Importantes

- La migración incluye conversión automática de datos existentes
- Todos los owner_id actuales se migran a user_locations
- Todos los roles 'owner' y 'customer' se convierten a 'user'
- Las políticas RLS antiguas se eliminan y reemplazan completamente