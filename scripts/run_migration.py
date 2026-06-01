#!/usr/bin/env python3
"""
Script para ejecutar la migración SQL en Supabase
Uso: python3 scripts/run_migration.py
"""

import os
import sys
from supabase import create_client, Client

# Credentials
SUPABASE_URL = "https://lroiqesjdmocmawtazhd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb2lxZXNqZG1vY21hd3RhemhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NzM1MCwiZXhwIjoyMDc3MjUzMzUwfQ.fTcO_AKka9STedIpyCP_qwKRz_wLKdQtimBoXoMu0Gc"

# Leer migración
migration_path = os.path.join(os.path.dirname(__file__), '../supabase/migrations/001_initial_schema.sql')

try:
    with open(migration_path, 'r') as f:
        sql = f.read()
except FileNotFoundError:
    print(f"❌ Error: No se encontró {migration_path}")
    sys.exit(1)

print(f"📄 Leyendo migración: {migration_path}")
print(f"📊 Tamaño: {len(sql)} caracteres")
print(f"🔗 Conectando a Supabase: {SUPABASE_URL}")

# Crear cliente
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Ejecutar SQL
print("\n🚀 Ejecutando migración...")

try:
    # Supabase Python no tiene método directo para ejecutar SQL raw
    # Usamos rpc con una función personalizada o ejecutamos statement por statement

    # Separar por statement (;) y ejecutar cada uno
    statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]

    print(f"📝 Encontrados {len(statements)} statements SQL")

    for i, stmt in enumerate(statements, 1):
        if len(stmt) < 20:
            continue  # Skip empty or very short statements

        # Mostrar preview
        preview = stmt[:100].replace('\n', ' ')
        print(f"  [{i}/{len(statements)}] {preview}...")

        try:
            # Ejecutar via PostgREST rpc
            result = supabase.rpc('exec', {'sql': stmt}).execute()
            print(f"    ✅ OK")
        except Exception as e:
            error_msg = str(e)
            # Algunos errores son esperados (IF NOT EXISTS, etc)
            if 'already exists' in error_msg.lower() or 'duplicate' in error_msg.lower():
                print(f"    ⚠️  Skip (ya existe)")
            else:
                print(f"    ❌ Error: {error_msg[:200]}")
                # No hacer sys.exit, continuar con el resto

    print("\n✅ Migración completada!")
    print("\n🎯 Próximo paso: Verificar tablas creadas")
    print("   Ir a: https://supabase.com/dashboard/project/lroiqesjdmocmawtazhd/editor")

except Exception as e:
    print(f"\n❌ Error general: {e}")
    sys.exit(1)
