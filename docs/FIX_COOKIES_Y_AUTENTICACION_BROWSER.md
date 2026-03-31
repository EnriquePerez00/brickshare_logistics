# Fix: Cookies y Autenticación en el Navegador

## Problema Identificado

El usuario `user@brickshare.eu` no podía ver paquetes en el dashboard porque:

1. **No había cookies de autenticación**: El navegador no guardaba cookies de Supabase
2. **Cliente Supabase incorrecto**: La aplicación web usaba `createClient` de `@supabase/supabase-js` que guarda la sesión en localStorage, no en cookies
3. **Error 401 Unauthorized**: Las APIs del servidor no podían validar la sesión del usuario

## Causa Raíz

Next.js con SSR requiere usar `@supabase/ssr` que maneja cookies correctamente tanto en cliente como servidor:

- **Cliente del navegador**: Debe usar `createBrowserClient` de `@supabase/ssr`
- **Cliente del servidor**: Debe usar `createServerClient` de `@supabase/ssr`  
- **NO usar**: `createClient` de `@supabase/supabase-js` en la web (solo mobile)

## Solución Implementada

### 1. Creado Cliente Correcto para Navegador

**Archivo**: `apps/web/lib/supabase/client.ts` (NUEVO)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@brickshare/shared/src/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 2. Actualizados Todos los Componentes del Cliente

Reemplazado `import { supabase } from '@brickshare/shared'` por `import { createClient } from '@/lib/supabase/client'` en:

- ✅ `apps/web/app/auth/page.tsx`
- ✅ `apps/web/app/dashboard/page.tsx`
- ✅ `apps/web/components/ProfileTab.tsx`
- ✅ `apps/web/components/AdminSearchBar.tsx`
- ✅ `apps/web/components/AdminShipmentsTable.tsx`

### 3. Patrón de Uso

```typescript
// ❌ INCORRECTO (viejo)
import { supabase } from '@brickshare/shared'
const { data } = await supabase.from('packages').select()

// ✅ CORRECTO (nuevo)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data } = await supabase.from('packages').select()
```

## Verificación

Después de implementar estos cambios:

1. **Hard refresh** del navegador (Cmd+Shift+R / Ctrl+Shift+R)
2. **Login** nuevamente en `/auth`
3. **Verificar cookies** en DevTools → Application → Cookies
   - Debe aparecer `sb-<project-ref>-auth-token`
4. **Verificar dashboard** → Tab "Paquetes Activos"
   - Ya no debe mostrar error 401

## Cookies Esperadas

Después del login, deberías ver cookies como:

```
sb-xxxxxx-auth-token
sb-xxxxxx-auth-token.0
sb-xxxxxx-auth-token.1
```

## Arquitectura Correcta

```
┌─────────────────────────────────────┐
│   NAVEGADOR (Client Components)     │
│   - auth/page.tsx                    │
│   - dashboard/page.tsx               │
│   - ProfileTab.tsx                   │
│   - AdminSearchBar.tsx               │
│   └─→ createBrowserClient (SSR)     │
│       ✅ Guarda en COOKIES           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   SERVIDOR (Server Components/API)  │
│   - middleware.ts                    │
│   - api/pudo/active-packages/route   │
│   └─→ createServerClient (SSR)      │
│       ✅ Lee desde COOKIES           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   MOBILE (React Native / Expo)      │
│   - LoginScreen.tsx                  │
│   - ScannerScreen.tsx                │
│   └─→ createClient (supabase-js)    │
│       ✅ Guarda en AsyncStorage      │
└─────────────────────────────────────┘
```

## Importante

- El paquete `@brickshare/shared` exporta `supabase` creado con `@supabase/supabase-js`
- Este cliente está pensado **SOLO para Mobile** (usa AsyncStorage)
- **NO usarlo en la aplicación web** (Next.js)
- La web necesita `@supabase/ssr` para manejo correcto de cookies

## Fecha de Resolución

31 de marzo de 2026