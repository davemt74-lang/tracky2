#!/usr/bin/env bash
set -euo pipefail
temp="$(mktemp -d)"
port=18777
pid=''
cleanup(){ [[ -z "$pid" ]] || kill "$pid" 2>/dev/null || true; rm -rf "$temp"; }
trap cleanup EXIT
TRACKY2_DATA_DIR="$temp/private" php -S "127.0.0.1:$port" -t . >"$temp/php.log" 2>&1 &
pid=$!
for attempt in 1 2 3 4 5 6 7 8 9 10; do
 if curl -sf "http://127.0.0.1:$port/server/install.php" -o "$temp/get.html" -c "$temp/cookies"; then break; fi
 sleep 0.3
done
grep -F 'Create owner and install' "$temp/get.html" >/dev/null
token="$(sed -n 's/.*name="csrf" value="\([^"]*\)".*/\1/p' "$temp/get.html")"
[[ "${#token}" -eq 64 ]]
code="$(curl -s -o /dev/null -w '%{http_code}' -b "$temp/cookies" -c "$temp/cookies" \
 --data-urlencode "csrf=$token" --data-urlencode "username=first-owner" \
 --data-urlencode "password=correct horse battery stable" \
 "http://127.0.0.1:$port/server/install.php")"
[[ "$code" == 303 ]] || { cat "$temp/php.log"; echo "install returned $code";exit 1; }
test -s "$temp/private/installed.lock"
test -s "$temp/private/tracky.sqlite"
test -s "$temp/private/secret.key"
[[ "$(stat -c %a "$temp/private/secret.key")" == 600 ]]
[[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/server/install.php")" == 404 ]]
# Installer must not create a second owner from repeat requests.
[[ "$(TRACKY2_DATA_DIR="$temp/private" php -r '$db=new PDO("sqlite:".getenv("TRACKY2_DATA_DIR")."/tracky.sqlite");echo $db->query("SELECT COUNT(*) FROM users")->fetchColumn();')" == 1 ]]
curl -sf -b "$temp/cookies" -c "$temp/cookies" "http://127.0.0.1:$port/server/admin.php" -o "$temp/login.html"
login_token="$(sed -n 's/.*name="csrf" value="\([^"]*\)".*/\1/p' "$temp/login.html" | head -1)"
[[ "${#login_token}" -eq 64 ]]
code="$(curl -s -o /dev/null -w '%{http_code}' -b "$temp/cookies" -c "$temp/cookies" \
 --data-urlencode "csrf=$login_token" --data-urlencode "action=login" \
 --data-urlencode "username=first-owner" --data-urlencode "password=correct horse battery stable" \
 "http://127.0.0.1:$port/server/admin.php")"
[[ "$code" == 303 ]] || { cat "$temp/php.log"; echo "login returned $code";exit 1; }
curl -sf -b "$temp/cookies" "http://127.0.0.1:$port/server/admin.php" | grep -F 'LLM &amp; Voice Providers' >/dev/null || \
 curl -sf -b "$temp/cookies" "http://127.0.0.1:$port/server/admin.php" | grep -F 'LLM & Voice Providers' >/dev/null
printf 'PASS: installer single-owner lock, secret key, authenticated admin\n'
