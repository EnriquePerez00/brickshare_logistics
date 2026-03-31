#!/bin/bash

# ============================================================
# Script para ejecutar setup automático en Supabase Cloud
# ============================================================

set -e

PROJECT_ID="qumjzvhtotcvnzpjgjkl"
SQL_FILE="scripts/execute-setup.sql"

echo "🚀 Iniciando Setup Automático..."
echo "📍 Project ID: $PROJECT_ID"
echo ""

# Verificar que el archivo SQL existe
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: No se encontró $SQL_FILE"
    exit 1
fi

# Ejecutar el SQL usando Supabase CLI
echo "📝 Ejecutando queries SQL..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Usar psql con los parámetros de conexión
# Primero, intentar obtener la cadena de conexión desde Supabase
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI encontrado"
    
    # Intentar ejecutar el SQL usando supabase-cli si está disponible
    # O usar directamente psql
    
    DB_URL=$(grep "^DATABASE_URL" supabase/.env.local | cut -d'=' -f2-)
    
    if [ -z "$DB_URL" ]; then
        echo "⚠️  DATABASE_URL no encontrado en supabase/.env.local"
        echo "ℹ️  Ejecuta el SQL manualmente en:"
        echo "   https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
        exit 1
    fi
    
    echo "✅ DATABASE_URL encontrada"
    echo ""
    echo "📤 Ejecutando $SQL_FILE..."
    echo ""
    
    # Ejecutar el SQL
    psql "$DB_URL" < "$SQL_FILE" 2>&1 || {
        echo ""
        echo "❌ Error ejecutando SQL con psql"
        echo ""
        echo "💡 Alternativa: Copia el contenido de $SQL_FILE"
        echo "   y pégalo en: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
        exit 1
    }
    
else
    echo "❌ Supabase CLI no encontrado"
    echo "   Instalación: brew install supabase/tap/supabase"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Setup completado exitosamente"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Cierra completamente la app móvil (swipe to close)"
echo "   2. Reabre la app"
echo "   3. Inicia sesión nuevamente"
echo "   4. Escanea: BS-DEL-7A2D335C-8FA"
echo "   5. Deberías ver: 'Recepcionado ✅'"
echo ""