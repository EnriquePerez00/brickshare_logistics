import { redirect } from 'next/navigation'

export default function Home() {
  // Redirigimos por defecto a la vista principal
  redirect('/auth')
}
