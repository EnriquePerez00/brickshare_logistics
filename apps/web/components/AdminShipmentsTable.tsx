'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RefreshCw } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '',                label: 'Todos los estados' },
  { value: 'pending_dropoff', label: 'Pendiente recepción' },
  { value: 'in_location',     label: 'En local' },
  { value: 'picked_up',       label: 'Recogido' },
  { value: 'returned',        label: 'Devuelto' },
]

const statusStyle: Record<string, string> = {
  pending_dropoff: 'bg-yellow-100 text-yellow-800',
  in_location:     'bg-blue-100 text-blue-800',
  picked_up:       'bg-green-100 text-green-800',
  returned:        'bg-zinc-100 text-zinc-700',
}

const statusLabel: Record<string, string> = {
  pending_dropoff: 'Pendiente recepción',
  in_location:     'En local',
  picked_up:       'Recogido',
  returned:        'Devuelto',
}

export function AdminShipmentsTable() {
  const [packages, setPackages] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterUser, setFilterUser]         = useState('')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    // Fetch select options
    const [locRes, userRes] = await Promise.all([
      supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
      supabase.from('users').select('id, first_name, last_name, email, role').order('email'),
    ])
    setLocations((locRes.data || []) as any[])
    setUsers((userRes.data || []) as any[])

    // Build packages query
    let q = supabase
      .from('packages')
      .select(`
        id, tracking_code, status, created_at, updated_at,
        location:locations(id, name, city),
        customer:users!packages_customer_id_fkey(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filterStatus)   q = q.eq('status', filterStatus)
    if (filterLocation) q = q.eq('location_id', filterLocation)
    if (filterUser)     q = q.eq('customer_id', filterUser)
    if (filterFrom)     q = q.gte('created_at', filterFrom)
    if (filterTo)       q = q.lte('created_at', filterTo + 'T23:59:59')

    const { data, error } = await q
    if (!error) setPackages((data || []) as any[])

    setLoading(false)
  }, [filterStatus, filterLocation, filterUser, filterFrom, filterTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clearFilters = () => {
    setFilterStatus('')
    setFilterLocation('')
    setFilterUser('')
    setFilterFrom('')
    setFilterTo('')
  }

  const hasFilters = filterStatus || filterLocation || filterUser || filterFrom || filterTo

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Historial Global de Envíos</CardTitle>
            <CardDescription>Filtra y consulta todos los paquetes de la red Brickshare.</CardDescription>
          </div>
          <Button id="admin-refresh-btn" variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-zinc-50 rounded-lg border border-zinc-100">
          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Estado</Label>
            <select
              id="filter-status"
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Establecimiento</Label>
            <select
              id="filter-location"
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
            >
              <option value="">Todos los locales</option>
              {locations.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* User */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Usuario / Punto</Label>
            <select
              id="filter-user"
              className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {users.filter((u: any) => u.role === 'user').map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Desde</Label>
            <Input
              id="filter-from"
              type="date"
              className="text-sm"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Hasta</Label>
            <Input
              id="filter-to"
              type="date"
              className="text-sm"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{packages.length} resultado{packages.length !== 1 ? 's' : ''}</span>
            <Button id="clear-filters-btn" variant="ghost" size="sm" onClick={clearFilters} className="text-zinc-500 hover:text-zinc-900">
              Limpiar filtros ×
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-zinc-100 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50">
                <TableHead>Tracking Code</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Establecimiento</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                    Cargando envíos...
                  </TableCell>
                </TableRow>
              ) : packages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-400">
                    No hay envíos que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                packages.map((pkg: any) => (
                  <TableRow key={pkg.id} className="hover:bg-zinc-50">
                    <TableCell className="font-mono font-semibold text-zinc-900">{pkg.tracking_code}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[pkg.status] || 'bg-zinc-100 text-zinc-600'}`}>
                        {statusLabel[pkg.status] || pkg.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-700">{(pkg.location as any)?.name || '—'}</TableCell>
                    <TableCell className="text-zinc-500">{(pkg.location as any)?.city || '—'}</TableCell>
                    <TableCell className="text-right text-xs text-zinc-400">
                      {new Date(pkg.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
