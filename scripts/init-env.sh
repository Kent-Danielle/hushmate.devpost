#!/usr/bin/env bash
# Creates backend/.env and frontend/.env from the .example files if missing, and
# fills JWT_SECRET and the VAPID keys if they are empty. Idempotent. Never prints secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

for dir in backend frontend; do
  if [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "created $dir/.env"
  fi
done

env_file=backend/.env

# Sets KEY=value in the env file without echoing the value (value comes in via the environment).
set_value() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  KEY="$key" VALUE="$value" awk -F= '
    BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"]; done = 0 }
    $1 == k { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$env_file" > "$tmp"
  cat "$tmp" > "$env_file"
  rm -f "$tmp"
}

is_empty() { # true when KEY is unset or has an empty value in the env file
  local line
  line="$(grep -E "^$1=" "$env_file" | head -n1 || true)"
  [ -z "${line#*=}" ]
}

if is_empty JWT_SECRET; then
  set_value JWT_SECRET "$(openssl rand -base64 48 | tr -d '\n')"
  echo "filled JWT_SECRET"
fi

if is_empty VAPID_PUBLIC_KEY || is_empty VAPID_PRIVATE_KEY; then
  keys="$(npx --yes web-push@3.6.7 generate-vapid-keys --json)"
  pub="$(printf '%s' "$keys" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).publicKey))')"
  priv="$(printf '%s' "$keys" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).privateKey))')"
  set_value VAPID_PUBLIC_KEY "$pub"
  set_value VAPID_PRIVATE_KEY "$priv"
  echo "filled VAPID keys"
fi

echo "env ready"
