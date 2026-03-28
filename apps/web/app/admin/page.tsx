'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@brickshare/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AdminSearchBar } from '@/components/AdminSearchBar'
import { AdminShipmentsTable } from '@/components/AdminShipmentsTable'
import {
  Package, Store, TrendingUp, Users, LogOut, ArrowLeft
} from 'lucide-react'

type KPIs = {
  totalPackages: number
  inLocation: number
  pickedUp: number
  totalLocations: number
  totalOwners: number
  totalRevenue: number
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [owners, setOwners] = useState<any[]>([])
  const [kpis, setKpis] = useState<KPIs>({
    totalPackages: 0,
    inLocation: 0,
    pickedUp: 0,
    totalLocations: 0,
    totalOwners: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: profile } = await supabase
        .from('users').select('role').eq('id', session.user.id).single() as { data: any }

      if (profile?.role !== 'admin') { router.push('/dashboard'); return }

      // Parallel data fetch
      const [ownersRes, locationsRes, packagesRes] = await Promise.all([
        supabase.from('users').select('id, first_name, last_name, email, created_at').eq('role', 'usuarios').order('created_at', { ascending: false }),
        supabase.from('locations').select('id, owner_id, location_name, name, address, postal_code, city, is_active, commission_rate'),
        supabase.from('packages').select('id, status, location:locations(commission_rate)'),
      ])

      const pkgs = (packagesRes.data || []) as any[]
      const allLocations = (locationsRes.data || []) as any[]
      const ownerList = (ownersRes.data || []) as any[]
      
      // Create a map of owner_id to location for faster lookup
      const locationMap = new Map()
      allLocations.forEach((loc: any) => {
        if (loc.owner_id && !locationMap.has(loc.owner_id)) {
          locationMap.set(loc.owner_id, loc)
        }
      })
      
      // Enrich owners with their location data
      const enrichedOwners = ownerList.map((owner: any) => ({
        ...owner,
        location: locationMap.get(owner.id)
      }))

      const activeLocations = allLocations.filter((loc: any) => loc.is_active)

      const pickedUpPkgs = pkgs.filter(p => p.status === 'picked_up')
      const totalRevenue = pickedUpPkgs.reduce((sum: number, p: any) => sum + (p.location?.commission_rate || 0.35), 0)

      setOwners(enrichedOwners)
      setKpis({
        totalPackages: pkgs.length,
        inLocation: pkgs.filter(p => p.status === 'in_location').length,
        pickedUp: pickedUpPkgs.length,
        totalLocations: activeLocations.length,
        totalOwners: ownerList.length,
        totalRevenue,
      })
      setLoading(false)
    }
    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleImpersonate = (ownerId: string) => {
    router.push(`/dashboard?impersonate=${ownerId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-zinc-900 text-lg animate-pulse">Cargando panel de administración...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Navbar */}
      <div className="border-b bg-white">
        <div className="flex h-16 items-center px-6 gap-4">
          <Button
            id="admin-back-btn"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-zinc-500 hover:text-zinc-900 gap-1 p-0 h-auto"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-bold tracking-tight">Brickshare</h2>
          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-semibold tracking-widest uppercase">Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <Button
              id="admin-logout-btn"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-500 hover:text-zinc-900 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={<Package className="h-5 w-5 text-blue-600" />} label="Total paquetes" value={kpis.totalPackages} />
          <KpiCard icon={<Package className="h-5 w-5 text-yellow-600" />} label="En local ahora" value={kpis.inLocation} />
          <KpiCard icon={<Package className="h-5 w-5 text-green-600" />} label="Entregados" value={kpis.pickedUp} />
          <KpiCard icon={<Store className="h-5 w-5 text-purple-600" />} label="Locales activos" value={kpis.totalLocations} />
          <KpiCard icon={<Users className="h-5 w-5 text-pink-600" />} label="Locales registrados" value={kpis.totalOwners} />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
            label="Ingresos red"
            value={`€ ${kpis.totalRevenue.toFixed(2)}`}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="shipments" className="space-y-4">
          <TabsList className="bg-zinc-200/50 border border-zinc-200">
            <TabsTrigger id="tab-shipments" value="shipments" className="data-[state=active]:bg-white data-[state=active]:text-zinc-900 text-zinc-500">
              Envíos
            </TabsTrigger>
            <TabsTrigger id="tab-owners" value="owners" className="data-[state=active]:bg-white data-[state=active]:text-zinc-900 text-zinc-500">
              Locales
            </TabsTrigger>
            <TabsTrigger id="tab-search" value="search" className="data-[state=active]:bg-white data-[state=active]:text-zinc-900 text-zinc-500">
              Buscador global
            </TabsTrigger>
          </TabsList>

          {/* Envíos Tab */}
          <TabsContent value="shipments" className="space-y-4">
            <AdminShipmentsTable />
          </TabsContent>

          {/* Owners Tab */}
          <TabsContent value="owners" className="space-y-4">
            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-zinc-900">Locales y Puntos de Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-200 hover:bg-transparent">
                      <TableHead className="text-zinc-500">Responsable</TableHead>
                      <TableHead className="text-zinc-500">Email</TableHead>
                      <TableHead className="text-zinc-500">Establecimiento</TableHead>
                      <TableHead className="text-zinc-500">Dirección</TableHead>
                      <TableHead className="text-zinc-500">Ciudad</TableHead>
                      <TableHead className="text-zinc-500">Registrado</TableHead>
                      <TableHead className="text-right text-zinc-500">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owners.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-zinc-400 py-8">
                          No hay locales registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      owners.map(owner => {
                        const loc = owner.location
                        return (
                          <TableRow key={owner.id} className="border-zinc-100 hover:bg-zinc-50/50">
                            <TableCell className="font-medium text-zinc-900">
                              {owner.first_name || owner.last_name
                                ? `${owner.first_name} ${owner.last_name}`
                                : <span className="italic text-zinc-400">Sin nombre</span>}
                            </TableCell>
                            <TableCell className="text-zinc-600">{owner.email}</TableCell>
                            <TableCell className="text-zinc-700 font-semibold">{loc?.location_name || loc?.name || '—'}</TableCell>
                            <TableCell className="text-zinc-600">
                              {loc?.address ? `${loc.address}${loc.postal_code ? ` (${loc.postal_code})` : ''}` : '—'}
                            </TableCell>
                            <TableCell className="text-zinc-600">{loc?.city || '—'}</TableCell>
                            <TableCell className="text-zinc-500 text-sm">
                              {new Date(owner.created_at).toLocaleDateString('es-ES')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                id={`impersonate-${owner.id}`}
                                variant="outline"
                                size="sm"
                                className="border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                                onClick={() => handleImpersonate(owner.id)}
                              >
                                Ver panel
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buscador Tab */}
          <TabsContent value="search" className="space-y-4">
            <Card className="border-zinc-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-zinc-900">Buscador global</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminSearchBar />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">{icon}</div>
        <div className="text-2xl font-bold text-zinc-900">{value}</div>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}
