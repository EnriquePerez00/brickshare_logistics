# 📋 GUÍA DE DEPLOY MANUAL - EDGE FUNCTIONS

## Acceso al Dashboard

**URL:** https://app.supabase.com/project/qumjzvhtotcvnzpjgjkl/functions

**Credenciales requeridas:** Tu cuenta de Supabase (enrique@brickshare.eu)

---

## FUNCIÓN 1: process-pudo-scan ⭐ CRÍTICA

**Descripción:** Procesa escaneo de códigos QR en puntos PUDO (recepción, entrega, devolución)

**Pasos:**

1. En el dashboard, busca la función existente: **process-pudo-scan**
2. Click en ella para abrirla
3. En el editor de código, selecciona TODO (Cmd+A)
4. Elimina todo el contenido
5. Abre en tu IDE el archivo: `supabase/functions/process-pudo-scan/index.ts`
6. Copia TODO el contenido del archivo
7. Pega en el editor web del Dashboard
8. Click en **"Deploy"** (botón verde arriba a la derecha)
9. Espera a que aparezca ✅ "Deployment successful"

**Tamaño archivo:** 26 KB
**Última actualización:** 1 Abril 2026
**Estado:** ✅ Listo para deploy

---

## FUNCIÓN 2: update-remote-shipment-status ⭐ CRÍTICA

**Descripción:** Actualiza estado de shipments desde la BD remota (Brickshare)

**Cambio importante en esta versión:**
- ❌ ELIMINADO: Validación con `owner_id` (obsoleto)
- ✅ NUEVO: Validación con `user_locations` (arquitectura correcta)

**Pasos:**

1. En el dashboard, busca: **update-remote-shipment-status**
2. Click en ella
3. Selecciona TODO (Cmd+A) y elimina
4. Abre en tu IDE: `supabase/functions/update-remote-shipment-status/index.ts`
5. Copia TODO el contenido
6. Pega en el editor web
7. Click en **"Deploy"**
8. Espera ✅ "Deployment successful"

**Tamaño archivo:** 12 KB
**Última actualización:** 31 Marzo 2026
**Estado:** ✅ Listo para deploy

---

## FUNCIÓN 3: generate-dynamic-qr

**Descripción:** Genera códigos QR dinámicos para shipments

**Pasos:**

1. Busca: **generate-dynamic-qr**
2. Click en ella
3. Selecciona TODO y elimina
4. Abre: `supabase/functions/generate-dynamic-qr/index.ts`
5. Copia TODO
6. Pega en el editor web
7. Click en **"Deploy"**
8. Espera ✅ "Deployment successful"

**Tamaño:** 5 KB
**Estado:** ✅ Sin cambios, pero actualizar

---

## FUNCIÓN 4: generate-static-return-qr

**Descripción:** Genera códigos QR estáticos para devoluciones

**Pasos:**

1. Busca: **generate-static-return-qr**
2. Click en ella
3. Selecciona TODO y elimina
4. Abre: `supabase/functions/generate-static-return-qr/index.ts`
5. Copia TODO
6. Pega en el editor web
7. Click en **"Deploy"**
8. Espera ✅ "Deployment successful"

**Tamaño:** 6 KB
**Estado:** ✅ Sin cambios, pero actualizar

---

## FUNCIÓN 5: verify-package-qr

**Descripción:** Verifica integridad de códigos QR de paquetes

**Pasos:**

1. Busca: **verify-package-qr**
2. Click en ella
3. Selecciona TODO y elimina
4. Abre: `supabase/functions/verify-package-qr/index.ts`
5. Copia TODO
6. Pega en el editor web
7. Click en **"Deploy"**
8. Espera ✅ "Deployment successful"

**Tamaño:** 9 KB
**Estado:** ✅ Sin cambios, pero actualizar

---

## ✅ VERIFICACIÓN POST-DEPLOY

Después de desplegar todas las funciones:

### 1. Verificar status en Dashboard
- Todas las funciones deben mostrar estado: ✅ **ACTIVE**
- Color verde junto a cada nombre

### 2. Probar en App Móvil

```bash
# Terminal 1: Inicia la app
npm run dev:mobile

# En la app:
# 1. Login con: user@brickshare.eu / password
# 2. Navega a Scanner
# 3. Escanea un QR de test
# 4. Verifica los logs en console
```

### 3. Logs Esperados

```
✅ Session found
✅ JWT CLAIMS DECODED
✅ Invoking Edge Function process-pudo-scan
✅ DROPOFF completed successfully
```

### 4. Verificar en Supabase Dashboard

Ve a: **Functions → Logs**

Deberías ver:
- ✅ Invocaciones exitosas (200)
- ✅ Duración típica: 500-1000ms
- ❌ NO deberías ver errores 401 o 500

---

## 🆘 TROUBLESHOOTING

### Error: "Function not found"
→ Verifica que el nombre de la función coincida exactamente (mayúsculas/minúsculas)

### Error: "Deployment failed"
→ Intenta recargar la página y reintentar
→ Verifica que el código no tenga errores de sintaxis

### Error: "401 Unauthorized"
→ Verifica las variables de entorno en Settings → Environment Variables
→ Comprueba que `brickshare_API_URL` apunta a: `http://host.docker.internal:54331` o `https://semblably-dizzied-bruno.ngrok-free.dev`

### La función se invoca pero falla
→ Revisa los logs en: **Functions → Logs → nombre-función**
→ Busca mensajes de error en color rojo
→ Verifica que ngrok está corriendo: http://localhost:4040

---

## 📊 RESUMEN DE CAMBIOS

| Función | Cambios | Criticidad | Acción |
|---------|---------|-----------|--------|
| process-pudo-scan | Logs mejorados | ⭐⭐⭐ CRÍTICA | DEPLOY |
| update-remote-shipment-status | user_locations en lugar de owner_id | ⭐⭐⭐ CRÍTICA | DEPLOY |
| generate-dynamic-qr | Sin cambios | ⭐⭐ MEDIA | DEPLOY |
| generate-static-return-qr | Sin cambios | ⭐⭐ MEDIA | DEPLOY |
| verify-package-qr | Sin cambios | ⭐⭐ MEDIA | DEPLOY |

**Total tiempo estimado:** 10-15 minutos
**Complejidad:** ⭐⭐ FÁCIL
**Riesgo:** ⭐ BAJO (sin cambios de schema)

---

## ✨ DESPUÉS DEL DEPLOY

Una vez completado:

1. ✅ Edge functions estarán actualizadas
2. ✅ Tunnel ngrok estará activo
3. ✅ App móvil podrá escanear QR correctamente
4. ✅ Logs serán más detallados
5. ✅ Validación con user_locations funcionará

**Próximo paso:** Probar flujo completo en app móvil

