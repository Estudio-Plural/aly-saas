#!/bin/bash
# Despliega Aly SaaS v2 en la VPS desde origin/main. Se corre desde el Mac:
#   bash ~/Dev/plural.ai/aly-saas/scripts/deploy-vps.sh
#
# Orden a propósito: aly-web corre `next dev` sobre el working tree (recarga solo), así que
# las migraciones van ANTES de traer el código — si no, las páginas nuevas leen tablas que
# todavía no existen. Todo paso que falla corta el script sin seguir.
#   0. ¿trabajo solo en la VPS?  1. respaldo de la base  2. migraciones 010–014 (desde
#   origin/main, idempotentes)  3. variables nuevas  4. código + dependencias  5. reinicio
#   6. Caddy :8093 sin clave propia (la protege la puerta)  7. verificación
set -euo pipefail

ssh archetype-vps 'bash -s' <<'REMOTE'
set -euo pipefail
cd /root/aly-saas
WEB_ENV=apps/web/.env.local
API_ENV=apps/api/.env

echo "==> 0. ¿Hay trabajo solo en la VPS?"
git fetch -q origin
solo=$(git log --oneline origin/main..HEAD | wc -l)
sucio=$(git status --porcelain | grep -vc '^??' || true)
echo "   solo-en-VPS=$solo  sin-commit=$sucio"
if [ "$solo" -gt 0 ] || [ "$sucio" -gt 0 ]; then echo "   !! reconciliar antes. No se tocó nada."; exit 1; fi
if systemctl is-active --quiet cloudflared-aly-saas; then
  echo "   !! el túnel cloudflared-aly-saas está vivo: sin la clave de Caddy saltaría la puerta."
  echo "   Apágalo: systemctl disable --now cloudflared-aly-saas"; exit 1
fi

DB_URL=$(grep -E '^DATABASE_URL=' "$WEB_ENV" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')
[ -n "$DB_URL" ] || { echo "   !! no encontré DATABASE_URL en $WEB_ENV"; exit 1; }

echo "==> 1. Respaldo de la base"
mkdir -p /root/backups
resp=/root/backups/aly-saas-$(date +%Y-%m-%d-%H%M).sql.gz
pg_dump "$DB_URL" | gzip > "$resp"
echo "   $resp ($(du -h "$resp" | cut -f1))"

echo "==> 2. Migraciones 010–014 (desde origin/main; son idempotentes)"
for m in 010_conversation_supervisor 011_orgs_roles 012_disenar_programa 013_whatsapp_canal 014_casos_dificiles; do
  f=$(git ls-tree --name-only origin/main supabase/migrations/ | grep "/${m%%_*}_" | head -1)
  [ -n "$f" ] || { echo "   !! no está la migración $m en origin/main"; exit 1; }
  git show "origin/main:$f" | psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f - >/dev/null
  echo "   ok $f"
done

echo "==> 3. Variables nuevas (solo las que falten; no se imprime ningún valor)"
agregar() { # archivo clave valor
  grep -q "^$2=" "$1" || { printf '%s=%s\n' "$2" "$3" >> "$1"; echo "   + $2 en $1"; }
}
ENGINE_TOKEN=$(grep -hE '^ENGINE_TOKEN=' "$API_ENV" "$WEB_ENV" 2>/dev/null | head -1 | cut -d= -f2-)
[ -n "$ENGINE_TOKEN" ] || ENGINE_TOKEN=$(openssl rand -hex 32)
GATE_SECRET=$(grep -E '^GATE_SECRET=' /root/plural-suite/gate/.env | cut -d= -f2-)
[ -n "$GATE_SECRET" ] || { echo "   !! no encontré GATE_SECRET en la puerta"; exit 1; }
agregar "$WEB_ENV" ENGINE_TOKEN "$ENGINE_TOKEN"
agregar "$API_ENV" ENGINE_TOKEN "$ENGINE_TOKEN"
agregar "$WEB_ENV" GATE_SECRET "$GATE_SECRET"
agregar "$WEB_ENV" PLURAL_REQUIRE_GATE 1
agregar "$API_ENV" SUPERVISOR_TOKEN "$(openssl rand -hex 32)"
# Solo desarrollo: en la VPS nunca.
sed -i '/^DEV_USER_EMAIL=/d; /^CASOS_RESPUESTAS_SIMULADAS=/d' "$WEB_ENV"
chmod 600 "$WEB_ENV" "$API_ENV"

echo "==> 4. Código y dependencias"
git pull -q --ff-only
if command -v pnpm >/dev/null; then pnpm install --frozen-lockfile --silent
else npx -y pnpm@9 install --frozen-lockfile --silent; fi
echo "   $(git log --oneline -1)"

echo "==> 5. Reinicio"
systemctl restart aly-engine
systemctl restart aly-web
sleep 12
systemctl is-active --quiet aly-engine || { journalctl -u aly-engine -n 30 --no-pager; exit 1; }
systemctl is-active --quiet aly-web || { journalctl -u aly-web -n 30 --no-pager; exit 1; }
echo "   aly-engine y aly-web activos"

echo "==> 6. Caddy :8093 sin clave propia (la protege la puerta)"
f=/root/transcriptor-caddy/Caddyfile
if python3 - "$f" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
i = s.index(":8093 {"); j = s.index("\n}\n", i)
bloque = s[i:j]
nuevo, n = re.subn(r"\n[ \t]*basic_auth \{[^}]*\}\n", "\n", bloque, count=1)
if n == 0: sys.exit(1)
open(p + ".bak-aly-gate", "w").write(s)
open(p, "w").write(s[:i] + nuevo + s[j:])
PY
then docker exec transcriptor-caddy caddy reload --config /etc/caddy/Caddyfile; echo "   ok (respaldo: $f.bak-aly-gate)"
else echo "   ya estaba sin clave"; fi

echo "==> 7. Verificación"
echo "   engine /health            $(curl -s -o /dev/null -w '%{http_code}' localhost:8081/health)   (esperado 200)"
echo "   engine sin token          $(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8081/api/rag/doQuestion -H 'content-type: application/json' -d '{}')   (esperado 401)"
echo "   web sin identidad         $(curl -s -o /dev/null -w '%{http_code}' localhost:3000/dashboard)   (esperado 307 a /sin-acceso)"
echo "   web API sin identidad     $(curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/workspaces)   (esperado 401)"
REMOTE
echo "==> Listo. Falta el DNS aly.estudio-plural.co (registro A en Wix → 72.62.138.164) para entrar por la puerta."
