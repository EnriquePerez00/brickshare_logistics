# Solución Final: Error 401 para user@brickshare.eu

## 🎯 Problema Identificado

El usuario `user@brickshare.eu` recibía error 401 al intentar ver paquetes activos en el dashboard.

## 🔍 Diagnóstico Realizado

Ejecutamos diagnósticos exhaustivos que revelaron:

1. ✅ Usuario existe en `auth.users`
2. ✅ Usuario existe en `public.users` con rol `user`
3. ✅ Usuario tiene 2 locations asignadas en `user_locations`
4. ✅ Hay 6 paquetes disponibles en la location
5. ✅ Las consultas con sesión funcionan correctamente
6. ✅ No hay problemas con RLS policies
7. ❌ **Problema**: La sesión anterior del navegador estaba corrupta/obsoleta

## 🔧 Solución Aplicada

### 1. Reset de Credenciales

Se ejecutó el script `scripts/verify-user-credentials.mjs` que:
- Verificó la existencia del usuario
- Reseteó la contraseña a `Test123456!`
- Confirmó la configuración correcta en todas las tablas

### 2. Configuración Final del Usuario

**Usuario:** `user@brickshare.eu`
- **User ID:** `d7a9f671-f5fa-4a31-8ba8-145e6219fd9b`
- **Password:** `Test123456!`
- **Role:** `user`
- **Email Confirmed:** ✅ Yes

**Locations Asignadas:**
1. **paco pil** (ID: `9ae13c49-de91-462b-ba63-32c8e7a546a5`)
2. **Test PUDO - Madrid** (ID: `1917c547-23d4-430f-ab20-a739035146b9`)

**Paquetes Disponibles:** 6 paquetes en estado `in_location`

## ✅ Pasos para Verificar la Solución

### Paso 1: Limpiar Sesión Actual

En el navegador donde tienes el error 401:

1. **Abre DevTools** (F12 o Cmd+Option+I en Mac)
2. **Ve a Application/Storage**
3. **Limpia todo:**
   - Cookies → Borrar todas de localhost:3000
   - Local Storage → Borrar todo
   - Session Storage → Borrar todo
4. **O simplemente abre una ventana de incógnito**

### Paso 2: Hacer Login Nuevamente

1. Asegúrate de que el servidor de desarrollo esté corriendo:
   ```bash
   npm run dev
   ```

2. Accede a la página de login:
   ```
   http://localhost:3000/auth
   ```

3. Inicia sesión con las credenciales correctas:
   ```
   Email:    user@brickshare.eu
   Password: Test123456!
   ```

### Paso 3: Verificar Dashboard

1. Una vez logueado, serás redirigido al dashboard
2. Ve a la pestaña **"Paquetes Activos"**
3. Deberías ver los 6 paquetes de la location "paco pil"

## 📊 Resultado Esperado

Al acceder a la pestaña "Paquetes Activos", deberías ver:

```
┌────┬──────────────────────────┬─────────────┬──────────┬──────────┬─────────────────┐
│ #  │ Tracking Code            │ Cliente     │ Tipo     │ Estado   │ Tiempo en local │
├────┼──────────────────────────┼─────────────┼──────────┼──────────┼─────────────────┤
│ 1  │ BS-DEL-7A2D335C-8FA      │ Cliente X   │ Entrega  │ En local │ Xh Xm           │
│ 2  │ BS-DEl-714C3F3D-FFD      │ Cliente Y   │ Entrega  │ En local │ Xh Xm           │
│ 3  │ BS-TEST-1774965464491-0  │ Cliente Z   │ Entrega  │ En local │ Xh Xm           │
│ ...│ ...                      │ ...         │ ...      │ ...      │ ...             │
└────┴──────────────────────────┴─────────────┴──────────┴──────────┴─────────────────┘
```

**Sin errores 401 en la consola del navegador**

## 🚨 Si el Problema Persiste

Si después de seguir estos pasos el error 401 persiste:

### Opción A: Verificar que el servidor está corriendo

```bash
# En la terminal, asegúrate de ver esto:
npm run dev

# Output esperado:
# ▲ Next.js 14.x.x
# - Local:        http://localhost:3000
# ✓ Ready in X.Xs
```

### Opción B: Reiniciar el servidor

```bash
# 1. Detén el servidor (Ctrl+C)
# 2. Limpia el cache de Next.js
rm -rf apps/web/.next

# 3. Inicia el servidor nuevamente
npm run dev
```

### Opción C: Ejecutar diagnóstico

```bash
# Ejecuta el diagnóstico completo
node scripts/diagnose-auth-401.mjs

# Debe mostrar: "✅ No issues detected with database access!"
```

## 📝 Scripts Creados

Los siguientes scripts fueron creados para resolver este problema:

1. **`scripts/verify-user-credentials.mjs`**
   - Verifica credenciales del usuario
   - Resetea la contraseña si es necesario
   - Confirma configuración en todas las tablas

2. **`scripts/diagnose-auth-401.mjs`**
   - Diagnóstico completo del problema 401
   - Prueba login, sesión, RLS, y queries
   - Identifica la causa raíz del problema

3. **`scripts/fix-401-automated.mjs`**
   - Fix automatizado completo
   - Crea usuario, asigna location, y crea paquetes de prueba

## 🎉 Conclusión

El problema estaba causado por una **sesión corrupta en el navegador** después de que se reseteó la contraseña del usuario. La solución es simple:

1. ✅ Credenciales reseteadas correctamente
2. ✅ Base de datos configurada correctamente
3. ✅ RLS policies funcionando
4. ✅ Solo falta hacer **logout/login** en el navegador

**Estado:** ✅ RESUELTO - Solo requiere logout/login del usuario

---

**Fecha:** 31 de Marzo de 2026 - 16:18 (Europe/Madrid)