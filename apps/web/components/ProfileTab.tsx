'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ProfileTab({ impersonateId }: { impersonateId?: string | null }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    const fetchProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const targetId = impersonateId || authUser.id

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetId)
        .single()
      
      if (profileData) {
        setProfile(profileData)
      } else {
        // Inicializar con valores por defecto si no existe el perfil aún
        setProfile({
          id: targetId,
          first_name: '',
          last_name: '',
          email: authUser?.email || '',
          phone: '+34 ',
          role: 'user',
        })
      }

      // Fetch location from user_locations
      const { data: userLocationData } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', targetId)
        .limit(1)
        .single() as any
      
      let locationData = null
      if (userLocationData?.location_id) {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .eq('id', userLocationData.location_id)
          .single() as any
        locationData = data
      }
      
      if (locationData) {
        setLocation(locationData)
      } else {
        setLocation({
          name: '',
          address: '',
          postal_code: '',
          city: '',
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [impersonateId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const targetId = profile?.id || impersonateId || authUser?.id

    if (!targetId) {
      alert('Error: No se ha podido identificar el usuario para actualizar el perfil.')
      setSaving(false)
      return
    }

    // Intentar actualizar el perfil de usuario (nombre, apellidos, teléfono)
    const upsertPayload = {
      id: targetId,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '+34 ',
      role: profile?.role || 'user',
      email: profile?.email || authUser?.email || '',
    }

    console.log('Intentando guardar perfil:', upsertPayload)
    const { error: userError } = await (supabase
      .from('users')
      .upsert(upsertPayload as any, { onConflict: 'id' }))

    if (userError) {
      console.error('Error saving user profile:', userError)
      alert(`Error al guardar el perfil: ${userError.message}`)
      setSaving(false)
      return
    }

    // Intentar guardar/actualizar la dirección física (tabla locations tras el refactor 004)
    // Se guarda para todos los usuarios (incluyendo clientes) ya que su dirección ahora vive allí.
    const hasAnyLocationData = location && (
      location.address || 
      location.postal_code || 
      location.city || 
      location.name
    )

    if (hasAnyLocationData) {
      const payload = {
        name: location.name || '',
        address: location.address || '',
        postal_code: location.postal_code || '',
        city: location.city || '',
        is_active: true
      }

      console.log('Intentando guardar localización/dirección:', payload)
      
      if (location.id) {
        // Update existente
        const { error: locError } = await ((supabase.from('locations') as any)
          .update(payload)
          .eq('id', location.id))
        
        if (locError) {
          console.error('Error updating location:', locError)
          alert('Error al actualizar la dirección: ' + locError.message)
        }
      } else {
        // Insert nuevo
        const { data: newLoc, error: locError } = await ((supabase.from('locations') as any)
          .insert(payload)
          .select()
          .single())
        
        if (locError) {
          console.error('Error creating location:', locError)
          alert('Error al crear el registro de dirección: ' + locError.message)
        } else if (newLoc) {
          setLocation(newLoc)
          
          // Create user_location entry
          const { error: userLocError } = await (supabase.from('user_locations') as any)
            .insert({ user_id: targetId, location_id: newLoc.id })
          
          if (userLocError) {
            console.error('Error linking user to location:', userLocError)
          }
        }
      }
    }

    setSaving(false)
    alert('Información actualizada correctamente')
  }

  if (loading) return <div className="p-8 text-zinc-500">Cargando perfil...</div>

  const isUserOrAdmin = profile?.role === 'user' || profile?.role === 'admin'

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-6 pb-12">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Datos Personales</CardTitle>
            <CardDescription>Información de contacto del responsable.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre</Label>
              <Input 
                id="first_name" 
                placeholder="Tu nombre"
                className="font-medium"
                value={profile?.first_name || ''} 
                onChange={e => setProfile({...profile, first_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellidos</Label>
              <Input 
                id="last_name" 
                placeholder="Tus apellidos"
                className="font-medium"
                value={profile?.last_name || ''} 
                onChange={e => setProfile({...profile, last_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={profile?.email || ''} disabled className="bg-zinc-50 text-zinc-500 grayscale font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono de contacto</Label>
              <div className="flex gap-2">
                <div className="bg-zinc-100 px-3 py-2 border rounded-md text-zinc-500 font-medium">+34</div>
                <Input 
                  id="phone" 
                  className="font-medium"
                  placeholder="600 000 000"
                  value={profile?.phone?.replace('+34 ', '') || ''} 
                  onChange={e => setProfile({...profile, phone: '+34 ' + e.target.value})}
                />
              </div>
            </div>
            {profile?.role && (
              <div className="space-y-2">
                <Label>Tipo de Perfil</Label>
                <div className="flex">
                  <div className="bg-zinc-900 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold text-white shadow-sm">
                    {profile.role}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Dirección Particular</CardTitle>
            <CardDescription>Tu dirección de contacto personal del responsable.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input 
                  id="address" 
                  placeholder="Calle, número, piso..."
                  value={location?.address || ''} 
                  onChange={e => setLocation({...location, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">Código Postal</Label>
                <Input 
                  id="postal_code" 
                  placeholder="28001"
                  value={location?.postal_code || ''} 
                  onChange={e => setLocation({...location, postal_code: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input 
                id="city" 
                placeholder="Madrid"
                value={location?.city || ''} 
                onChange={e => setLocation({...location, city: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        {isUserOrAdmin && (
          <Card className="border-zinc-200 shadow-sm overflow-hidden bg-zinc-50/50">
            <div className="h-1 bg-zinc-900 w-full" />
            <CardHeader>
              <CardTitle className="text-xl text-zinc-900">Punto de Conveniencia</CardTitle>
              <CardDescription>Detalles del local comercial asociado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="location_name">Nombre del Establecimiento</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: Tienda Brickshare Centro"
                  className="font-semibold text-lg bg-white"
                  value={location?.name || ''} 
                  onChange={e => setLocation({...location, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc_address">Dirección del Local</Label>
                <Input 
                  id="loc_address" 
                  placeholder="Dirección física del establecimiento"
                  className="bg-white"
                  value={location?.address || ''} 
                  onChange={e => setLocation({...location, address: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={saving} className="px-10 h-12 text-base shadow-lg bg-zinc-900 hover:bg-zinc-800">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
