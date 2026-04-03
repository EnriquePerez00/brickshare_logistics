# Configuración del CLI de Supabase - Completada ✅

## Resumen

El CLI de Supabase ha sido configurado exitosamente y vinculado al proyecto remoto **Podo_logistics** (ID: `qumjzvhtotcvnzpjgjkl`).

## Estado Actual

### ✅ CLI Instalado
- **Versión**: 2.84.2
- **Ruta**: `/opt/homebrew/bin/supabase`
- **Instalado vía**: Homebrew

### ✅ Autenticación Configurada
- **Token de acceso**: Configurado y actualizado en `~/.zshrc`
- **Token personal**: `sbp_e681814516f37e948592f4dc17336c07e9faecda`
- **Estado**: Autenticado correctamente

### ✅ Proyecto Vinculado
- **Nombre**: Podo_logistics
- **Reference ID**: qumjzvhtotcvnzpjgjkl
- **Región**: West EU (Ireland)
- **Organización**: pqmubqpdmvwgoazajhwj
- **Estado**: ● Vinculado (linked)

## Entorno Local

### Servicios Activos
```
🔧 Development Tools
├─ Studio:  http://127.0.0.1:54423
├─ Mailpit: http://127.0.0.1:54424
└─ MCP:     http://127.0.0.1:54421/mcp

🌐 APIs
├─ Project URL:    http://127.0.0.1:54421
├─ REST:           http://127.0.0.1:54421/rest/v1
├─ GraphQL:        http://127.0.0.1:54421/graphql/v1
└─ Edge Functions: http://127.0.0.1:54421/functions/v1

⛁ Database
└─ URL: postgresql://postgres:postgres@127.0.0.1:54422/postgres

📦 Storage (S3)
└─ URL: http://127.0.0.1:54421/storage/v1/s3
```

## Comandos Principales

### Ver proyectos disponibles
```bash
supabase projects list
```

### Ver estado del proyecto local
```bash
supabase status
```

### Ver estado del proyecto remoto
```bash
supabase db remote status
```

### Sincronizar migraciones locales → remoto
```bash
supabase db push
```

### Descargar esquema remoto → local
```bash
supabase db pull
```

### Gestionar Edge Functions
```bash
# Listar funciones
supabase functions list

# Desplegar una función
supabase functions deploy <nombre-funcion>

# Ver logs de una función
supabase functions logs <nombre-funcion>
```

### Gestionar migraciones
```bash
# Crear nueva migración
supabase migration new <nombre-migracion>

# Aplicar migraciones localmente
supabase db reset

# Ver historial de migraciones
supabase migration list
```

## Configuración de Variables de Entorno

### Token de Acceso Personal
El token se ha configurado en `~/.zshrc`:
```bash
export SUPABASE_ACCESS_TOKEN="sbp_e681814516f37e948592f4dc17336c07e9faecda"
```

Para que los cambios surtan efecto en nuevas terminales, se actualizó el archivo `.zshrc`. 

Para la sesión actual, exporta el token manualmente:
```bash
export SUPABASE_ACCESS_TOKEN="sbp_e681814516f37e948592f4dc17336c07e9faecda"
```

O reinicia tu terminal:
```bash
source ~/.zshrc
```

## Otros Proyectos Disponibles

Tu organización tiene acceso a:

1. **enriqueperezbcn1973@gmail.com's Project**
   - ID: lnukmvrcejqkbgkdpwos
   - Región: West EU (Paris)

2. **BricksahreDDBB**
   - ID: tevoogkifiszfontzkgd
   - Región: Central Europe (Zurich)

3. **Podo_logistics** ● (Actualmente vinculado)
   - ID: qumjzvhtotcvnzpjgjkl
   - Región: West EU (Ireland)

## Resolución de Problemas

### Si aparece "Unauthorized"
1. Verifica que el token esté configurado:
   ```bash
   echo $SUPABASE_ACCESS_TOKEN
   ```

2. Si no aparece o es incorrecto, exporta el token correcto:
   ```bash
   export SUPABASE_ACCESS_TOKEN="sbp_e681814516f37e948592f4dc17336c07e9faecda"
   ```

3. Para hacer permanente el cambio, asegúrate de que esté en `~/.zshrc`

### Cambiar de proyecto
Para vincular un proyecto diferente:
```bash
supabase unlink
supabase link --project-ref <reference-id>
```

### Verificar conexión remota
```bash
supabase projects list
```

## Recursos Adicionales

- [Documentación oficial del CLI](https://supabase.com/docs/guides/cli)
- [Gestión de migraciones](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Dashboard del proyecto](https://supabase.com/dashboard/project/qumjzvhtotcvnzpjgjkl)

## Próximos Pasos Recomendados

1. **Sincronizar esquema local con remoto**:
   ```bash
   supabase db pull
   ```

2. **O subir cambios locales al remoto**:
   ```bash
   supabase db push
   ```

3. **Desplegar Edge Functions**:
   ```bash
   supabase functions deploy process-pudo-scan
   supabase functions deploy update-remote-shipment-status
   ```

4. **Configurar secretos para Edge Functions** (si es necesario):
   ```bash
   supabase secrets set MY_SECRET=value
   ```

---

**Fecha de configuración**: 31 de marzo de 2026  
