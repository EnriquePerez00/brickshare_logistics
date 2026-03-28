# Integración del Dashboard PUDO en Panel de Propietario

## Cambios Realizados

Se ha actualizado el panel de propietario (`/dashboard`) para integrar los componentes reales del dashboard PUDO, reemplazando los datos mockeados que se mostraban anteriormente.

### Modificaciones en `apps/web/app/dashboard/page.tsx`

1. **Nuevos imports añadidos**:
   - `PudoActivePackagesTable`: Componente que muestra los paquetes actualmente en el local
   - `PudoOperationsHistory`: Componente que muestra el historial de operaciones con filtros y exportación

2. **Nueva pestaña añadida**:
   - **"Historial"**: Nueva pestaña que muestra el historial completo de operaciones del PUDO

3. **Actualización de pestañas existentes**:
   - **"Paquetes Activos"**: Ahora usa `PudoActivePackagesTable` en lugar de la tabla mockeada
   - **"Resumen"**: La sección de "Últimos Movimientos" ahora redirige a las pestañas de datos reales

## Estructura de Pestañas del Dashboard

```
Dashboard
├── Resumen (overview)
│   ├── Métricas de paquetes (aún con datos mock)
│   ├── Gráfico de rentabilidad
│   └── Últimos movimientos (referencia a otras pestañas)
├── Paquetes Activos (packages) ← ACTUALIZADO
│   └── PudoActivePackagesTable (datos reales de BD)
├── Historial (history) ← NUEVO
│   └── PudoOperationsHistory (datos reales con filtros)
└── Perfil (profile)
    └── ProfileTab
```

## Funcionalidad Conectada

### Paquetes Activos
- Muestra paquetes con estados: `in_location`, `pending_pickup`, `overdue`
- Datos obtenidos de la vista `pudo_active_packages_view`
- API: `/api/pudo/active-packages`

### Historial
- Muestra todas las operaciones de escaneo realizadas
- Filtros por: fecha, estado, tipo de operación
- Exportación a CSV
- Datos obtenidos de la vista `pudo_operations_history_view`
- APIs: 
  - `/api/pudo/operations-history`
  - `/api/pudo/export-history`

## Parámetros de los Componentes

Ambos componentes reciben el `locationId` que puede ser:
- El ID del usuario propietario actual
- El ID del propietario suplantado (cuando un admin está en modo impersonación)

```tsx
<PudoActivePackagesTable locationId={impersonateId || user?.id} />
<PudoOperationsHistory locationId={impersonateId || user?.id} />
```

## Acceso al Dashboard Actualizado

1. **Como propietario**: Acceder directamente a `/dashboard`
2. **Como admin (modo impersonación)**: Acceder a `/dashboard?impersonate={ownerId}`

## Próximos Pasos (Opcional)

Las métricas en la pestaña "Resumen" aún muestran datos mockeados. Para conectarlas a datos reales, se podría:

1. Crear una API endpoint para obtener estadísticas agregadas
2. Usar las vistas de la base de datos para calcular:
   - Total de paquetes gestionados en el mes
   - Rentabilidad acumulada
   - Paquetes pendientes de recogida
3. Actualizar el componente para mostrar estos datos dinámicos

## Verificación

Para verificar que los cambios funcionan correctamente:

1. Acceder al dashboard en http://localhost:3000/dashboard
2. Navegar a la pestaña "Paquetes Activos" - debería mostrar los paquetes reales de la base de datos
3. Navegar a la pestaña "Historial" - debería mostrar el historial de operaciones con filtros funcionales
4. Si no hay datos, verificar que existen registros en las tablas `packages` y `pudo_scan_logs`