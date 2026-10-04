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
# V0.10H sync contract: explicit authenticated write, encrypted profile, optimistic conflict.
curl -sf -b "$temp/cookies" "http://127.0.0.1:$port/server/admin.php" -o "$temp/admin.html"
sync_token="$(sed -n 's/.*name="csrf" value="\([^"]*\)".*/\1/p' "$temp/admin.html" | head -1)"
[[ "${#sync_token}" -eq 64 ]]
first_json='{"changes":[{"id":"participant01","operation":"upsert","baseVersion":0,"name":"Pat","profile":{"id":"participant01","name":"Pat","notes":"sync smoke"},"consent":false,"clientUpdatedAt":1000}]}'
curl -sf -b "$temp/cookies" -H "X-CSRF-Token: $sync_token" -H 'Content-Type: application/json'  --data "$first_json" "http://127.0.0.1:$port/server/sync-api.php" -o "$temp/sync-first.json"
php -r '$d=json_decode(file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR); if(($d["results"][0]["status"]??"")!=="applied"||($d["results"][0]["record"]["version"]??0)!==1)exit(1);' "$temp/sync-first.json"
conflict_json='{"changes":[{"id":"participant01","operation":"upsert","baseVersion":0,"name":"Pat changed","profile":{"id":"participant01","name":"Pat changed"},"consent":false,"clientUpdatedAt":2000}]}'
curl -sf -b "$temp/cookies" -H "X-CSRF-Token: $sync_token" -H 'Content-Type: application/json'  --data "$conflict_json" "http://127.0.0.1:$port/server/sync-api.php" -o "$temp/sync-conflict.json"
php -r '$d=json_decode(file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR); if(($d["results"][0]["status"]??"")!=="conflict")exit(1);' "$temp/sync-conflict.json"
TRACKY2_DATA_DIR="$temp/private" php -r '$db=new PDO("sqlite:".getenv("TRACKY2_DATA_DIR")."/tracky.sqlite");$r=$db->query("SELECT profile_json,profile_ciphertext,version FROM participants WHERE id='''participant01'''")->fetch(PDO::FETCH_ASSOC);if(!$r||$r["profile_json"]!=="{}"||strlen((string)$r["profile_ciphertext"])<40||(int)$r["version"]!==1)exit(1);'
# Backup is CLI-only, checksum/integrity verified, and contains DB + instance key together.
TRACKY2_DATA_DIR="$temp/private" php server/backup.php create "$temp/backup" >"$temp/backup-create.log"
TRACKY2_DATA_DIR="$temp/private" php server/backup.php verify "$temp/backup" >"$temp/backup-verify.log"
grep -F 'VERIFY OK schema 2' "$temp/backup-verify.log" >/dev/null
TRACKY2_DATA_DIR="$temp/private" php -r '$db=new PDO("sqlite:".getenv("TRACKY2_DATA_DIR")."/tracky.sqlite");$db->exec("UPDATE participants SET name='''Changed after backup''' WHERE id='''participant01'''");'
TRACKY2_DATA_DIR="$temp/private" php server/backup.php restore "$temp/backup" --yes >"$temp/backup-restore.log"
grep -F 'RESTORED.' "$temp/backup-restore.log" >/dev/null
[[ "$(TRACKY2_DATA_DIR="$temp/private" php -r '$db=new PDO("sqlite:".getenv("TRACKY2_DATA_DIR")."/tracky.sqlite");echo $db->query("SELECT name FROM participants WHERE id='''participant01'''")->fetchColumn();')" == "Pat" ]]
printf 'PASS: installer, encrypted sync conflict contract, backup verify/restore\n'
