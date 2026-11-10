#!/usr/bin/env bash
# Ejecuta la migración y las pruebas RLS contra un PostgreSQL local desechable.
# Uso: bash supabase/tests/run.sh   (requiere psql y acceso como usuario postgres)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=vyro_rls_test
PSQL="psql -v ON_ERROR_STOP=1 -q"
dropdb --if-exists "$DB" && createdb "$DB"
$PSQL -d "$DB" -f tests/supabase_stub.sql
for f in migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
$PSQL -d "$DB" -f tests/rls_test.sql
dropdb "$DB"
