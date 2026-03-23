'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@brickshare/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProfitabilityChart } from '@/components/ProfitabilityChart'
import { ProfileTab } from '@/components/ProfileTab'
import { Button } from '@/components/ui/button'

// Datos Mockeados
const MOCK_PACKAGES = [
  { id: 'PKG-001', tracking: 'ES982349823', status: 'in_location', date: 'Hace 2 horas' },
  { id: 'PKG-002', tracking: 'ES112233445', status: 'in_location', date: 'Hace 5 horas' },
  { id: 'PKG-003', tracking: 'ES998877665', status: 'pending_dropoff', date: 'Ayer' },
]

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const impersonateId = searchParams.get('impersonate')
  
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [targetOwner, setTargetOwner] = useState<any>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }

      setUser(session.user)

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single() as { data: any }
      
      const adminChecked = profile?.role === 'admin'
      setIsAdmin(adminChecked)

      if (adminChecked && impersonateId) {
        // Fetch target owner details for the banner
        const { data: ownerProfile } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('id', impersonateId)
          .single()
        if (ownerProfile) setTargetOwner(ownerProfile)
      } else if (adminChecked && !impersonateId) {
        // Redirigir al panel global si es admin y no está suplantando
        router.push('/admin')
        return
      } else if (impersonateId && !adminChecked) {
        // If not admin, ignore impersonate parameter by redirecting to clean dashboard
        router.replace('/dashboard')
      }

      setLoading(false)
    }
    checkUser()
  }, [router, impersonateId])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return <div className="p-8">Cargando dashboard...</div>

  return (
    <div className="flex-col md:flex">
      <div className="border-b bg-white dark:bg-zinc-950">
        <div className="flex h-16 items-center px-4">
          <h2 className="text-lg font-bold tracking-tight">Brickshare | Panel de Propietario</h2>
          <div className="ml-auto flex items-center space-x-4">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => router.push('/admin')} className="border-red-200 text-red-700 hover:bg-red-50">
                Panel Admin
              </Button>
            )}
            <span className="text-sm text-zinc-500">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Salir</Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 space-y-4 p-8 pt-6 bg-zinc-50 dark:bg-zinc-900 min-h-screen">
        {isAdmin && impersonateId && (
          <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-4 rounded shadow-sm">
            <p className="font-bold border-b border-amber-200 pb-1 mb-1">⚠️ MODO ADMINISTRADOR: Suplantación de Identidad Activa</p>
            <p className="text-sm">Estás viendo y editando el panel como si fueses el propietario <strong>{targetOwner?.email}</strong> ({targetOwner?.first_name} {targetOwner?.last_name}).</p>
            <Button variant="link" className="px-0 text-amber-900 font-semibold mt-1 h-auto" onClick={() => router.push('/admin')}>
              ← Volver al Panel de Administración
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-white dark:bg-zinc-800 border">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="packages">Paquetes Activos</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paquetes gestionados (Mes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">340</div>
                  <p className="text-xs text-muted-foreground">+20% respecto al mes anterior</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rentabilidad Acumulada</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">€ 145.25</div>
                  <p className="text-xs text-muted-foreground">Calculado a 0.35€ por paquete</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes de recogida</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">Ocupando espacio en tienda</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <div className="col-span-4">
                <ProfitabilityChart />
              </div>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Últimos Movimientos</CardTitle>
                  <CardDescription>Actividad reciente en tu local.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {MOCK_PACKAGES.map(pkg => (
                      <div key={pkg.id} className="flex items-center">
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{pkg.tracking}</p>
                          <p className="text-sm text-muted-foreground">{pkg.status.replace('_', ' ')}</p>
                        </div>
                        <div className="ml-auto font-medium text-xs text-zinc-400">{pkg.date}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="packages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventario Físico</CardTitle>
                <CardDescription>Paquetes que actualmente están en tu local (in_location)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Code</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Tiempo en local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_PACKAGES.filter(p => p.status === 'in_location').map(pkg => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.tracking}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
                            {pkg.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{pkg.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <ProfileTab impersonateId={isAdmin ? impersonateId : null} />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
