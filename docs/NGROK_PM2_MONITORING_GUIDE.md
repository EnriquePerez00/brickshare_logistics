# Guía de Monitoreo y Gestión del Túnel ngrok con PM2

**Fecha:** 4 de Marzo de 2026
**Estado:** ✅ CONFIGURADO Y OPERATIVO

## 📋 Resumen

El túnel ngrok está ahora gestionado por PM2, un gestor de procesos de producción que garantiza:
- ✅ **Auto-reinicio** si el proceso se cae
- ✅ **Monitoreo en tiempo real** de CPU y memoria
- ✅ **Logs centralizados**
- ✅ **Persistencia** tras reinicios del sistema (requiere configuración adicional)

## 🎯 Estado Actual

```
┌────┬──────────────┬──────┬─────────┬──────────┐
│ ID │ Nombre       │ PID  │ Estado  │ Uptime   │
├────┼──────────────┼──────┼─────────┼──────────┤
│ 0  │ ngrok-tunnel │ 13069│ online  │ running  │
└────┴──────────────┴──────┴─────────┴──────────┘

URL del túnel: https://semblably-dizzied-bruno.ngrok-free.dev
```

## 🚀 Comandos PM2 Básicos

### Ver estado de todos los procesos
```bash
pm2 list
# o
pm2 ls
```

### Ver detalles específicos del túnel
```bash
pm2 show ngrok-tunnel
```

### Ver logs en tiempo real
```bash
# Todos los logs
pm2 logs ngrok-tunnel

# Solo logs de error
pm2 logs ngrok-tunnel --err

# Solo salida estándar
pm2 logs ngrok-tunnel --out

# Limpiar logs antiguos
pm2 flush
```

### Reiniciar el túnel
```bash
pm2 restart ngrok-tunnel
```

### Detener el túnel
```bash
pm2 stop ngrok-tunnel
```

### Eliminar del listado de PM2
```bash
pm2 delete ngrok-tunnel
```

### Monitoreo en vivo
```bash
# Dashboard interactivo
pm2 monit

# Información detallada
pm2 info ngrok-tunnel
```

## 🔄 Configuración de Auto-inicio (OPCIONAL)

Para que ngrok se inicie automáticamente al reiniciar el ordenador:

### 1. Configurar startup script
```bash
pm2 startup
```

**Importante:** PM2 te dará un comando específico que DEBES ejecutar con `sudo`. 
Para este sistema (macOS con launchd), el comando es:

```bash
sudo env PATH=$PATH:/opt/homebrew/Cellar/node/24.7.0/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u I764690 --hp /Users/I764690
```

### 2. Guardar la configuración actual
```bash
pm2 save
```

Esto guardará el estado actual de ngrok-tunnel para que se inicie automáticamente.

### 3. Verificar auto-inicio
Después de reiniciar el ordenador:
```bash
pm2 list
```

Si ngrok-tunnel aparece en la lista, el auto-inicio está funcionando correctamente.

## 📊 Scripts de Monitoreo Rápido

### Script para verificar el túnel
Crea un archivo `scripts/check-ngrok-status.sh`:

```bash
#!/bin/bash

echo "═══════════════════════════════════════"
echo "  ESTADO DEL TÚNEL NGROK"
echo "═══════════════════════════════════════"

# Ver estado de PM2
echo ""
echo "📊 Estado en PM2:"
pm2 list | grep ngrok-tunnel || echo "❌ No encontrado en PM2"

# Obtener URL del túnel
echo ""
echo "🔗 URL del túnel:"
curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url // "❌ Túnel no disponible"'

# Verificar conectividad
echo ""
echo "🌐 Test de conectividad:"
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url')
if [ ! -z "$TUNNEL_URL" ] && [ "$TUNNEL_URL" != "null" ]; then
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null "$TUNNEL_URL/rest/v1/" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Túnel accesible (HTTP $HTTP_CODE)"
  else
    echo "⚠️  Túnel responde con HTTP $HTTP_CODE"
  fi
else
  echo "❌ No se puede obtener URL del túnel"
fi

echo ""
echo "═══════════════════════════════════════"
```

Hazlo ejecutable:
```bash
chmod +x scripts/check-ngrok-status.sh
```

Úsalo:
```bash
./scripts/check-ngrok-status.sh
```

## 🔧 Solución de Problemas

### El túnel se cayó
```bash
# Ver logs del error
pm2 logs ngrok-tunnel --lines 50

# Reiniciar manualmente
pm2 restart ngrok-tunnel

# Verificar que está corriendo
pm2 list
```

### PM2 no encuentra el proceso
```bash
# Reiniciar desde cero
pm2 delete ngrok-tunnel 2>/dev/null
pm2 start scripts/ngrok-only.mjs --name ngrok-tunnel
pm2 save
```

### El túnel está online pero no responde
```bash
# Ver dashboard de ngrok
open http://localhost:4040

# Verificar conexión a la BD local
curl -s http://localhost:4040/api/tunnels | jq

# Si es necesario, reinicia Supabase local también
# (dependiendo de tu configuración)
```

### Limpiar y reiniciar todo
```bash
# Detener PM2
pm2 stop all
pm2 delete all

# Reiniciar ngrok
pm2 start scripts/ngrok-only.mjs --name ngrok-tunnel
pm2 save
```

## 📈 Monitoreo Avanzado (Opcional)

### PM2 Plus (Servicio en la nube de PM2)
PM2 ofrece un servicio de monitoreo en la nube:

```bash
pm2 link <secret_key> <public_key>
```

Esto te permite:
- Monitorear desde cualquier lugar
- Recibir alertas
- Ver métricas históricas
- Gestionar remotamente

Más info: https://pm2.io/

## 🎯 Comandos de Diagnóstico Rápido

```bash
# URL actual del túnel
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'

# Estado de PM2
pm2 list

# Uso de memoria y CPU
pm2 monit

# Logs recientes
pm2 logs ngrok-tunnel --lines 20

# Reinicio si hay problemas
pm2 restart ngrok-tunnel && sleep 5 && pm2 list
```

## 📝 Notas Importantes

1. **URL Dinámica:** La URL de ngrok cambia cada vez que se reinicia el túnel (a menos que uses ngrok de pago)

2. **Configuración persistente:** Recuerda ejecutar `pm2 save` después de cualquier cambio en la configuración

3. **Auto-inicio:** El comando `pm2 startup` requiere `sudo` y debe ejecutarse manualmente la primera vez

4. **Logs:** PM2 mantiene logs en `~/.pm2/logs/`. Límpielos periódicamente con `pm2 flush`

## ✅ Checklist de Verificación

- [x] PM2 instalado globalmente
- [x] ngrok-tunnel corriendo en PM2 (PID 13069)
- [x] Configuración guardada con `pm2 save`
- [ ] **Auto-inicio configurado** (requiere ejecutar comando sudo manualmente)
- [x] Túnel accesible: https://semblably-dizzied-bruno.ngrok-free.dev
- [x] Documentación completa creada

## 🎓 Recursos Adicionales

- **PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **ngrok Documentation:** https://ngrok.com/docs
- **PM2 Cheat Sheet:** https://pm2.keymetrics.io/docs/usage/quick-start/#cheat-sheet

---

**Última actualización:** 4 de Marzo de 2026, 21:20h  
**Mantenido por:** Sistema Brickshare Logistics