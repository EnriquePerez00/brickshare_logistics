# Mejoras del Dashboard del Propietario PUDO

**Versión:** 1.0  
**Fecha:** 25/03/2026  
**Estado:** Especificación Técnica

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Vista Actual vs. Vista Mejorada](#vista-actual-vs-vista-mejorada)
3. [Especificación de Componentes](#especificación-de-componentes)
4. [APIs Necesarias](#apis-necesarias)
5. [Base de Datos](#base-de-datos)
6. [Flujos de Usuario](#flujos-de-usuario)
7. [Guía de Implementación](#guía-de-implementación)

---

## 🎯 Resumen Ejecutivo

Este documento especifica las mejoras al dashboard del propietario de punto PUDO, enfocándose en:

1. **Vista de Paquetes Activos Mejorada** - Más información y mejor usabilidad
2. **Nueva Vista de Histórico** - Consulta de operaciones pasadas con filtros

### Objetivos

- ✅ Identificar rápidamente paquetes en local
- ✅ Ver número, código de tracking y tiempo en tienda
- ✅ Distinguir entre entregas y devoluciones
- ✅ Acceder al histórico de operaciones
- ✅ Filtrar y buscar operaciones específicas
- ✅ Exportar datos a CSV

---

## 📊 Vista Actual vs. Vista Mejorada

### Dashboard Actual

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
│  ┌─────────┬──────────────────┬────────┐                   │
│  │ Resumen │ Paquetes Activos │ Perfil │                   │
│  └─────────┴──────────────────┴────────┘                   │
│                                                              │
│  Inventario Físico                                          │
│  Paquetes que actualmente están en tu local (in_location)  │
│                                                              │
│  ┌──────────────┬─────────────┬──────────────────┐        │
│  │ Tracking Code│   Estado    │ Tiempo en local  │        │
│  ├──────────────┼─────────────┼──────────────────┤        │
│  │ ES982349823  │ in_location │ Hace 2 horas     │        │
│  │ ES112233445  │ in_location │ Hace 5 horas     │        │
│  └──────────────┴─────────────┴──────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Mejorado

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                                         │
│  ┌─────────┬──────────────────┬──────────┬────────┐                             │
│  │ Resumen │ Paquetes Activos │ Histórico│ Perfil │                             │
│  └─────────┴──────────────────┴──────────┴────────┘                             │
│                                                                                    │
│  ┌─ Paquetes Activos ────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  🔍 Buscar por tracking...           📦 Todos │ 🚚 Entregas │ 🔄 Devoluc. │  │
│  │                                                                             │  │
│  │  ┌───┬──────────────┬──────────┬─────────┬──────────────┬─────────────┐  │  │
│  │  │ # │ Tracking Code│ Cliente  │  Tipo   │   Estado     │ Tiempo      │  │  │
│  │  ├───┼──────────────┼──────────┼─────────┼──────────────┼─────────────┤  │  │
│  │  │ 1 │ ES982349823  │ Juan P.  │ 🚚 Entr │ En local    │ 2h 15m      │  │  │
│  │  │ 2 │ ES112233445  │ María G. │ 🔄 Dev. │ En local    │ 5h 42m ⚠️  │  │  │
│  │  └───┴──────────────┴──────────┴─────────┴──────────────┴─────────────┘  │  │
│  │                                                                             │  │
│  │  ⚠️ 1 paquete con más de 24h en local                                     │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
│  ┌─ Histórico de Operaciones ────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  Filtros:                                                                   │  │
│  │  📅 Desde: [Hoy ▼]  Hasta: [Hoy ▼]  🎯 Acción: [Todas ▼]                 │  │
│  │  ✓ Resultado: [Todos ▼]  🔍 Tracking: [________]  [Buscar] [Exportar CSV] │  │
│  │                                                                             │  │
│  │  ┌──────────────────┬──────────────┬─────────────────┬──────────┬────────┐│  │
│  │  │ Fecha/Hora       │ Tracking Code│ Acción          │ Estados  │Resultado│  │
│  │  ├──────────────────┼──────────────┼─────────────────┼──────────┼────────┤│  │
│  │  │ 25/03/26 10:15  │ ES982349823  │ Entrega confirm │ transit→ │   ✓    ││  │
│  │  │                  │              │ Operador: Ana L.│ delivered│        ││  │
│  │  ├──────────────────┼──────────────┼─────────────────┼──────────┼────────┤│  │
│  │  │ 25/03/26 09:42  │ ES112233445  │ Devoluc. recib. │ return→  │   ✓    ││  │
│  │  │                  │              │ Operador: Juan M│ in_return│        ││  │
│  │  └──────────────────┴──────────────┴─────────────────┴──────────┴────────┘│  │
│  │                                                                             │  │
│  │  Mostrando 1-20 de 156 registros  [← 1 2 3 ... 8 →]                      │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Especificación de Componentes

### 1. Componente: `PudoActivePackagesTable`

**Ubicación:** `apps/web/components/pudo/PudoActivePackagesTable.tsx`

**Props:**
```typescript
interface PudoActivePackagesTableProps {
  locationId: string;
  onRefresh?: () => void;
}
```

**Estado Local:**
```typescript
const [packages, setPackages] = useState<ActivePackage[]>([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'return'>('all');
const [sortBy, setSortBy] = useState<'time' | 'tracking' | 'type'>('time');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
```

**Tipos:**
```typescript
interface ActivePackage {
  id: string;
  tracking_code: string;
  status: string;
  package_number: number;
  package_type: 'delivery' | 'return';
  customer_name: string;
  customer_first_name: string;
  customer_last_name: string;
  hours_in_location: number;
  created_at: string;
  updated_at: string;
}
```

**Funcionalidades:**

1. **Búsqueda por Tracking**
   - Input de búsqueda en tiempo real
   - Filtrado local (cliente) o por API si dataset grande

2. **Filtros de Tipo**
   - Todos los paquetes
   - Solo entregas (🚚)
   - Solo devoluciones (🔄)

3. **Ordenamiento**
   - Por tiempo en local (default)
   - Por tracking code
   - Por tipo

4. **Alertas Visuales**
   - Paquetes >24h: fondo amarillo claro + icono ⚠️
   - Contador de alertas debajo de la tabla

5. **Formato de Tiempo**
   ```typescript
   function formatTimeInLocation(hours: number): string {
     if (hours < 1) {
       return `${Math.floor(hours * 60)}m`;
     } else if (hours < 24) {
       const h = Math.floor(hours);
       const m = Math.floor((hours - h) * 60);
       return `${h}h ${m}m`;
     } else {
       const days = Math.floor(hours / 24);
       const h = Math.floor(hours % 24);
       return `${days}d ${h}h`;
     }
   }
   ```

**Ejemplo de Uso:**
```tsx
<PudoActivePackagesTable 
  locationId={currentLocation.id} 
  onRefresh={handleRefresh}
/>
```

---

### 2. Componente: `PudoOperationsHistory`

**Ubicación:** `apps/web/components/pudo/PudoOperationsHistory.tsx`

**Props:**
```typescript
interface PudoOperationsHistoryProps {
  locationId: string;
}
```

**Estado Local:**
```typescript
const [operations, setOperations] = useState<OperationRecord[]>([]);
const [loading, setLoading] = useState(true);
const [filters, setFilters] = useState<HistoryFilters>({
  dateFrom: format(new Date(), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  actionType: 'all',
  resultFilter: 'all',
  trackingSearch: ''
});
const [pagination, setPagination] = useState({
  page: 1,
  limit: 20,
  totalCount: 0
});
```

**Tipos:**
```typescript
interface OperationRecord {
  id: string;
  scan_timestamp: string;
  tracking_code: string;
  action_type: 'delivery_confirmation' | 'return_confirmation';
  action_type_label: string;
  previous_status: string;
  new_status: string;
  status_transition: string;
  result: boolean;
  operator_name: string;
  operator_id: string;
}

interface HistoryFilters {
  dateFrom: string;  // YYYY-MM-DD
  dateTo: string;    // YYYY-MM-DD
  actionType: 'all' | 'delivery_confirmation' | 'return_confirmation';
  resultFilter: 'all' | 'success' | 'failed';
  trackingSearch: string;
}
```

**Funcionalidades:**

1. **Filtros de Fecha**
   - Presets: Hoy, Última semana, Último mes, Personalizado
   - Date pickers para from/to

2. **Filtro de Tipo de Acción**
   - Todas las acciones
   - Solo entregas confirmadas
   - Solo devoluciones recibidas

3. **Filtro de Resultado**
   - Todos
   - Solo exitosos (✓)
   - Solo fallidos (✗)

4. **Búsqueda por Tracking**
   - Input de búsqueda
   - Búsqueda parcial (ILIKE)

5. **Paginación**
   - 20 registros por página
   - Navegación de páginas
   - Total de registros

6. **Exportar a CSV**
   - Botón de exportación
   - Respeta filtros actuales
   - Descarga CSV con todos los resultados filtrados

**Ejemplo de Uso:**
```tsx
<PudoOperationsHistory locationId={currentLocation.id} />
```

---

### 3. Componente: `HistoryFilters`

**Ubicación:** `apps/web/components/pudo/HistoryFilters.tsx`

**Props:**
```typescript
interface HistoryFiltersProps {
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  onExport: () => void;
  isExporting: boolean;
}
```

**UI Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Filtros:                                                    │
│ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│ │ Desde: Hoy ▼ │ │ Hasta: Hoy ▼ │ │ Acción: Todas   ▼ │  │
│ └──────────────┘ └──────────────┘ └────────────────────┘  │
│                                                             │
│ ┌──────────────────┐ ┌───────────────────┐ ┌────────────┐│
│ │ Resultado: Todos▼│ │ Tracking: _______ │ │  Buscar    ││
│ └──────────────────┘ └───────────────────┘ └────────────┘│
│                                             ┌────────────┐│
│                                             │ Exportar CSV││
│                                             └────────────┘│
└────────────────────────────────────────────────────────────┘
```

---

### 4. Componente: `ExportButton`

**Ubicación:** `apps/web/components/pudo/ExportButton.tsx`

**Props:**
```typescript
interface ExportButtonProps {
  onExport: () => void;
  isExporting: boolean;
  disabled?: boolean;
}
```

**Funcionalidad:**
```typescript
async function handleExport() {
  setIsExporting(true);
  try {
    const response = await fetch('/api/pudo/export-history?' + queryParams);
    const data = await response.json();
    
    // Convertir JSON a CSV
    const csv = convertToCSV(data);
    
    // Descargar archivo
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operaciones-pudo-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } finally {
    setIsExporting(false);
  }
}

function convertToCSV(data: any[]): string {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escapar comillas y comas
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}
```

---

## 🌐 APIs Necesarias

### 1. GET `/api/pudo/active-packages`

**Descripción:** Lista de paquetes actualmente en local con información completa.

**Query Parameters:**
- `location_id` (required): UUID del local
- `sort` (optional): Campo de ordenamiento ('time', 'tracking', 'type')
- `order` (optional): Orden ('asc', 'desc')

**Response:**
```typescript
{
  data: Array<{
    id: string;
    tracking_code: string;
    status: string;
    package_number: number;
    package_type: 'delivery' | 'return';
    customer_name: string;
    customer_first_name: string;
    customer_last_name: string;
    hours_in_location: number;
    created_at: string;
    updated_at: string;
  }>;
  count: number;
  alerts: {
    over_24h: number;
  };
}
```

**Implementación:**
```typescript
// apps/web/app/api/pudo/active-packages/route.ts

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const sort = searchParams.get('sort') || 'time';
  const order = searchParams.get('order') || 'desc';
  
  if (!locationId) {
    return NextResponse.json(
      { error: 'location_id is required' },
      { status: 400 }
    );
  }
  
  const supabase = createClient();
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Query usando la vista
  let query = supabase
    .from('pudo_active_packages_enhanced')
    .select('*')
    .eq('location_id', locationId);
  
  // Ordenamiento
  const orderColumn = sort === 'time' ? 'hours_in_location' :
                      sort === 'tracking' ? 'tracking_code' :
                      'package_type';
  query = query.order(orderColumn, { ascending: order === 'asc' });
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Calcular alertas
  const over24h = data?.filter(p => p.hours_in_location > 24).length || 0;
  
  return NextResponse.json({
    data: data || [],
    count: data?.length || 0,
    alerts: { over_24h }
  });
}
```

---

### 2. GET `/api/pudo/operations-history`

**Descripción:** Histórico de operaciones con filtros y paginación.

**Query Parameters:**
- `location_id` (required): UUID del local
- `date_from` (optional): Fecha desde (YYYY-MM-DD)
- `date_to` (optional): Fecha hasta (YYYY-MM-DD)
- `action_type` (optional): 'delivery_confirmation' | 'return_confirmation'
- `result_filter` (optional): 'success' | 'failed'
- `tracking_search` (optional): Término de búsqueda
- `page` (optional): Número de página (default: 1)
- `limit` (optional): Registros por página (default: 20, max: 100)

**Response:**
```typescript
{
  data: Array<{
    id: string;
    scan_timestamp: string;
    tracking_code: string;
    action_type: 'delivery_confirmation' | 'return_confirmation';
    action_type_label: string;
    previous_status: string;
    new_status: string;
    status_transition: string;
    result: boolean;
    operator_name: string;
    operator_id: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}
```

**Implementación:**
```typescript
// apps/web/app/api/pudo/operations-history/route.ts

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const actionType = searchParams.get('action_type');
  const resultFilter = searchParams.get('result_filter');
  const trackingSearch = searchParams.get('tracking_search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  if (!locationId) {
    return NextResponse.json(
      { error: 'location_id is required' },
      { status: 400 }
    );
  }
  
  const supabase = createClient();
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Llamar a la función RPC
  const { data, error } = await supabase.rpc('get_pudo_operations_paginated', {
    p_location_id: locationId,
    p_date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
    p_date_to: dateTo ? new Date(dateTo).toISOString() : null,
    p_action_type: actionType,
    p_result_filter: resultFilter,
    p_tracking_search: trackingSearch,
    p_page: page,
    p_limit: limit
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const totalCount = data?.[0]?.total_count || 0;
  const totalPages = Math.ceil(totalCount / limit);
  
  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages
    }
  });
}
```

---

### 3. GET `/api/pudo/export-history`

**Descripción:** Exporta operaciones a CSV (retorna JSON que el frontend convierte).

**Query Parameters:** Mismos que `/api/pudo/operations-history` excepto `page` y `limit`

**Response:**
```typescript
Array<{
  scan_timestamp: string;
  tracking_code: string;
  action_type_label: string;
  status_transition: string;
  result: string;
  operator_name: string;
}>
```

**Implementación:**
```typescript
// apps/web/app/api/pudo/export-history/route.ts

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const actionType = searchParams.get('action_type');
  const resultFilter = searchParams.get('result_filter');
  const trackingSearch = searchParams.get('tracking_search');
  
  if (!locationId) {
    return NextResponse.json(
      { error: 'location_id is required' },
      { status: 400 }
    );
  }
  
  const supabase = createClient();
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Llamar a la función RPC de exportación
  const { data, error } = await supabase.rpc('export_pudo_operations_csv', {
    p_location_id: locationId,
    p_date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
    p_date_to: dateTo ? new Date(dateTo).toISOString() : null,
    p_action_type: actionType,
    p_result_filter: resultFilter,
    p_tracking_search: trackingSearch
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data || []);
}
```

---

## 💾 Base de Datos

### Vistas Creadas (Migración 009)

1. **`pudo_active_packages_enhanced`**
   - Paquetes actualmente en local
   - Con tipo, tiempo, datos del cliente
   - Respeta RLS

2. **`pudo_operations_history`**
   - Histórico completo de operaciones
   - Con operador y formato amigable
   - Respeta RLS

### Funciones RPC Creadas

1. **`get_pudo_operations_paginated()`**
   - Filtros múltiples
   - Paginación
   - Retorna total_count para UI

2. **`export_pudo_operations_csv()`**
   - Sin paginación
   - Formato CSV-friendly
   - Respeta filtros

### Índices Nuevos

1. `idx_packages_location_status` - Para paquetes activos
2. `idx_pudo_scan_logs_location_timestamp_action` - Para histórico con filtros
3. `idx_pudo_scan_logs_shipment_gin` - Para búsqueda de tracking

---

## 🔄 Flujos de Usuario

### Flujo 1: Ver Paquetes Activos

```
1. Usuario navega a Dashboard → Paquetes Activos
2. Sistema carga vista pudo_active_packages_enhanced
3. Se muestra tabla con:
   - Número secuencial
   - Tracking code
   - Nombre del cliente
   - Tipo (entrega/devolución con icono)
   - Estado
   - Tiempo en local
4. Si hay paquetes >24h, se muestran destacados con ⚠️
5. Usuario puede:
   - Buscar por tracking
   - Filtrar por tipo
   - Ordenar por columna
```

### Flujo 2: Consultar Histórico

```
1. Usuario navega a Dashboard → Histórico
2. Por defecto: operaciones de HOY
3. Sistema carga usando get_pudo_operations_paginated()
4. Se muestra tabla con:
   - Fecha/hora
   - Tracking
   - Acción realizada
   - Transición de estados
   - Operador
   - Resultado (✓/✗)
5. Usuario aplica filtros:
   - Cambia rango de fechas
   - Selecciona tipo de acción
   - Filtra por resultado
   - Busca tracking específico
6. Sistema recarga con nuevos filtros
7. Usuario navega entre páginas si hay >20 registros
```

### Flujo 3: Exportar a CSV

```
1. Usuario está en vista Histórico
2. Aplica filtros deseados (opcional)
3. Click en botón "Exportar CSV"
4. Sistema llama a /api/pudo/export-history
5. Frontend convierte JSON a CSV
6. Se descarga archivo: operaciones-pudo-2026-03-25.csv
7. Usuario puede abrir en Excel/Numbers/Google Sheets
```

---

## 📐 Guía de Implementación

### Paso 1: Aplicar Migración

```bash
# Aplicar migración 009
supabase db push

# Verificar que se crearon las vistas
supabase db execute "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'pudo_%'"
```

### Paso 2: Crear APIs

1. Crear directorio: `apps/web/app/api/pudo/`
2. Implementar `active-packages/route.ts`
3. Implementar `operations-history/route.ts`
4. Implementar `export-history/route.ts`

### Paso 3: Crear Componentes

1. Crear directorio: `apps/web/components/pudo/`
2. Implementar `PudoActivePackagesTable.tsx`
3. Implementar `PudoOperationsHistory.tsx`
4. Implementar `HistoryFilters.tsx`
5. Implementar `ExportButton.tsx`

### Paso 4: Integrar en Dashboard

```tsx
// apps/web/app/dashboard/page.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PudoActivePackagesTable from '@/components/pudo/PudoActivePackagesTable';
import PudoOperationsHistory from '@/components/pudo/PudoOperationsHistory';

export default function DashboardPage() {
  const { location } = useUserLocation(); // Hook custom
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="paquetes">Paquetes Activos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
        </TabsList>
        
        <TabsContent value="resumen">
          {/* Contenido existente */}
        </TabsContent>
        
        <TabsContent value="paquetes">
          <PudoActivePackagesTable locationId={location.id} />
        </TabsContent>
        
        <TabsContent value="historico">
          <PudoOperationsHistory locationId={location.id} />
        </TabsContent>
        
        <TabsContent value="perfil">
          {/* Contenido existente */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Paso 5: Testing

**Tests Unitarios:**
```typescript
// tests/components/PudoActivePackagesTable.test.tsx
describe('PudoActivePackagesTable', () => {
  it('renders active packages', async () => {
    // Mock API response
    // Render component
    // Assert table rows
  });
  
  it('filters packages by type', () => {
    // Test filtering logic
  });
  
  it('highlights packages over 24h', () => {
    // Test alert styling
  });
});
```

**Tests de Integración:**
```typescript
// tests/api/pudo/active-packages.test.ts
describe('GET /api/pudo/active-packages', () => {
  it('returns active packages for location', async () => {
    // Test API endpoint
  });
  
  it('requires authentication', async () => {
    // Test auth
  });
});
```

### Paso 6: Documentación

1. Actualizar README del proyecto
2. Documentar nuevas APIs en Swagger/OpenAPI
3. Crear guía de usuario para propietarios PUDO

---

## 📊 Métricas de Éxito

- ✅ Tiempo de carga de paquetes activos: <500ms
- ✅ Tiempo de carga de histórico (20 registros): <1s
- ✅ Búsqueda por tracking: respuesta instantánea (<100ms)
- ✅ Exportación CSV: <3s para 1000 registros
- ✅ Tasa de adopción: >80% de propietarios usan el histórico

---

## 🐛 Casos Edge y Errores

### Error 1: Sin Paquetes Activos

**UI:**
```
┌─────────────────────────────────────────┐
│  📦 No hay paquetes en local           │
│                                         │
│  Cuando lleguen paquetes, aparecerán   │
│  aquí automáticamente.                  │
└─────────────────────────────────────────┘
```

### Error 2: Sin Histórico

**UI:**
```
┌─────────────────────────────────────────┐
│  📋 No hay operaciones registradas     │
│                                         │
│  Las operaciones de escaneo aparecerán │
│  aquí una vez que se realicen.         │
└─────────────────────────────────────────┘
```

### Error 3: Error de API

**UI:**
```
┌─────────────────────────────────────────┐
│  ⚠️ Error al cargar los datos          │
│                                         │
│  Por favor, intenta de nuevo.           │
│  [Reintentar]                           │
└─────────────────────────────────────────┘
```

---

## 📚 Referencias

- **Migración 009:** `supabase/migrations/009_pudo_dashboard_views.sql`
- **Esquema BD:** `docs/DATABASE_SCHEMA_REFERENCE.md`
- **Proceso PUDO:** `docs/PUDO_SCANNING_PROCESS.md`

---

**Documento preparado:** 25/03/2026  
**Última actualización:** 25/03/2026