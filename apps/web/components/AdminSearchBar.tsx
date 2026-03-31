'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Package, User, MapPin, Loader2 } from 'lucide-react'

type SearchResult = {
  packages: any[]
  users: any[]
  locations: any[]
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_dropoff: { label: 'Pendiente recepción', color: 'bg-yellow-100 text-yellow-800' },
  in_location:     { label: 'En local',             color: 'bg-blue-100 text-blue-800'   },
  picked_up:       { label: 'Recogido',              color: 'bg-green-100 text-green-800' },
  returned:        { label: 'Devuelto',              color: 'bg-zinc-100 text-zinc-700'   },
}

export function AdminSearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (value: string) => {
    const supabase = createClient()
    setQuery(value)
    if (value.trim().length < 2) {
      setResults(null)
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    const q = `%${value.trim()}%`

    const [pkgRes, userRes, locRes] = await Promise.all([
      supabase
        .from('packages')
        .select(`
          id, tracking_code, status, created_at, updated_at,
          location:locations(name, location_name, city),
          customer:users!packages_customer_id_fkey(first_name, last_name, email)
        `)
        .ilike('tracking_code', q)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('users')
        .select('id, first_name, last_name, email, role, created_at')
        .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(10),
      supabase
        .from('locations')
        .select(`
          id, name, location_name, address, city, postal_code, is_active
        `)
        .or(`name.ilike.${q},location_name.ilike.${q},address.ilike.${q},city.ilike.${q}`)
        .limit(10),
    ])

    setResults({
      packages:  (pkgRes.data  || []) as any[],
      users:     (userRes.data || []) as any[],
      locations: (locRes.data  || []) as any[],
    })
    setLoading(false)
  }, [])

  const total = results
    ? results.packages.length + results.users.length + results.locations.length
    : 0

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        )}
        <Input
          id="admin-search-input"
          className="pl-10 pr-10 h-12 text-base border-zinc-200 focus:ring-2 focus:ring-zinc-900"
          placeholder="Buscar tracking, email, nombre de local, ciudad..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {searched && !loading && (
        <p className="text-sm text-zinc-500 px-1">
          {total === 0
            ? `Sin resultados para "${query}"`
            : `${total} resultado${total !== 1 ? 's' : ''} para "${query}"`}
        </p>
      )}

      {results && (
        <div className="space-y-4">
          {/* Packages */}
          {results.packages.length > 0 && (
            <Card className="border-blue-100">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                  <Package className="h-4 w-4" /> Paquetes ({results.packages.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="divide-y divide-zinc-100">
                  {results.packages.map((pkg: any) => {
                    const s = statusLabels[pkg.status] || { label: pkg.status, color: 'bg-zinc-100 text-zinc-600' }
                    return (
                      <div key={pkg.id} className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span className="font-mono font-semibold text-zinc-900">{pkg.tracking_code}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
                        <span className="text-zinc-500">{pkg.location?.location_name || pkg.location?.name || '—'} · {pkg.location?.city || ''}</span>
                        {pkg.customer && (
                          <span className="text-zinc-500">{pkg.customer.first_name} {pkg.customer.last_name} ({pkg.customer.email})</span>
                        )}
                        <span className="text-zinc-400 ml-auto">{new Date(pkg.updated_at).toLocaleDateString('es-ES')}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users */}
          {results.users.length > 0 && (
            <Card className="border-purple-100">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700">
                  <User className="h-4 w-4" /> Locales / Usuarios ({results.users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="divide-y divide-zinc-100">
                  {results.users.map((u: any) => (
                    <div key={u.id} className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="font-medium text-zinc-900">{u.first_name} {u.last_name}</span>
                      <span className="text-zinc-500">{u.email}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} capitalize`}>
                        {u.role === 'user' ? 'Usuario' : u.role}
                      </span>
                      <span className="text-zinc-400 ml-auto">Desde {new Date(u.created_at).toLocaleDateString('es-ES')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Locations */}
          {results.locations.length > 0 && (
            <Card className="border-green-100">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-700">
                  <MapPin className="h-4 w-4" /> Establecimientos ({results.locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="divide-y divide-zinc-100">
                  {results.locations.map((loc: any) => (
                    <div key={loc.id} className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="font-medium text-zinc-900">{loc.location_name || loc.name}</span>
                      <span className="text-zinc-500">{loc.address}, {loc.city} {loc.postal_code}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {loc.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
