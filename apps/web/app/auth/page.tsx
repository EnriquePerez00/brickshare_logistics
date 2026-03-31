'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [isForgotOpen, setIsForgotOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single() as { data: any }
        
        if (profile?.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Verificar rol del usuario
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single() as { data: any }

    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotMsg('')
    
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })

    setForgotLoading(false)
    if (error) {
      setForgotMsg(`Error: ${error.message}`)
    } else {
      setForgotMsg('Correo enviado con éxito. Revisa tu bandeja de entrada.')
      setTimeout(() => setIsForgotOpen(false), 3000)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-zinc-200 dark:border-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Brickshare Logistics
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Acceso para puntos de conveniencia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="ejemplo@tienda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white dark:bg-zinc-900"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white dark:bg-zinc-900 pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-semibold transition-all"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 text-sm text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => setIsForgotOpen(true)}
            className="hover:underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ¿Has olvidado tu contraseña?
          </button>
          
          <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleForgotPassword}>
                <DialogHeader>
                  <DialogTitle>Recuperar contraseña</DialogTitle>
                  <DialogDescription>
                    Introduce tu correo electrónico para enviarte un enlace de recuperación.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="ejemplo@tienda.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  {forgotMsg && (
                    <div className={`text-sm font-medium p-2 rounded ${forgotMsg.includes('Error') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                      {forgotMsg}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsForgotOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={forgotLoading}>
                    {forgotLoading ? 'Enviando...' : 'Confirmar Email'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <p className="pt-2 text-center text-xs">
            ¿Problemas para acceder? Contacta a soporte.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
