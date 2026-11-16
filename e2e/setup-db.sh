#!/usr/bin/env bash
# Crea la base de datos de pruebas vyro_e2e con la migración real (ejecutar como usuario postgres).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
dropdb --if-exists vyro_e2e && createdb vyro_e2e
psql -v ON_ERROR_STOP=1 -q -d vyro_e2e -f "$DIR/supabase/tests/supabase_stub.sql"
psql -v ON_ERROR_STOP=1 -q -d vyro_e2e -c "create table auth.e2e_passwords (id uuid primary key references auth.users(id) on delete cascade, password text not null);"
for f in "$DIR"/supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d vyro_e2e -f "$f"; done
echo "vyro_e2e lista"
