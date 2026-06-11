#!/usr/bin/env bash
# Crea la base local `aly_saas` (Postgres de Homebrew) y ejecuta las
# migraciones de supabase/migrations en orden. Idempotente: se puede
# re-ejecutar tras agregar migraciones nuevas.
set -euo pipefail

DB_NAME="${ALY_DB_NAME:-aly_saas}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! pg_isready -q; then
  echo "❌ Postgres no está corriendo. Levantalo con: brew services start postgresql@16"
  exit 1
fi

if ! psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  createdb "$DB_NAME"
  echo "✅ Base de datos '$DB_NAME' creada"
else
  echo "ℹ️  Base de datos '$DB_NAME' ya existe"
fi

for migration in "$REPO_ROOT"/supabase/migrations/*.sql; do
  echo "▶ Ejecutando $(basename "$migration")..."
  psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$migration"
done

echo "✅ Migraciones aplicadas. Conexión: postgresql://localhost:5432/$DB_NAME"
