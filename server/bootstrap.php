<?php
declare(strict_types=1);
const TRACKY_SCHEMA_VERSION=3;
// Self-hosted Tracky2 foundation. Requires PHP 8.1+ with PDO SQLite.
// Keep credentials and SQLite outside the served repository/document root.
// Default three levels above server/ so shared-hosted public_html is never the data directory.
define('TRACKY_DATA', getenv('TRACKY2_DATA_DIR') ?: dirname(__DIR__,3).'/tracky2-private');
function tracky_safe_data_dir(): void {
    // Fail closed if custom path would expose the database on this web host.
    if (PHP_SAPI === 'cli' || empty($_SERVER['DOCUMENT_ROOT'])) return;
    $parent=realpath(dirname(TRACKY_DATA));
    $root=realpath((string)$_SERVER['DOCUMENT_ROOT']);
    if (!$parent || !$root || str_starts_with($parent.'/',rtrim($root,'/').'/')
        || $parent===$root) throw new RuntimeException('Private data location must be outside the web root.');
}
function tracky_db(): PDO {
    tracky_safe_data_dir();
    if (!is_dir(TRACKY_DATA) || !is_file(TRACKY_DATA.'/installed.lock')) {
        throw new RuntimeException('Tracky2 is not installed.');
    }
    $db = new PDO('sqlite:'.TRACKY_DATA.'/tracky.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
    $db->exec('PRAGMA foreign_keys=ON');
    if(tracky_schema_version($db)<TRACKY_SCHEMA_VERSION) tracky_schema($db);
    return $db;
}
function tracky_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $host=parse_url('http://'.($_SERVER['HTTP_HOST'] ?? ''),PHP_URL_HOST);
    if (PHP_SAPI !== 'cli' && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')
        && !in_array($host,['localhost','127.0.0.1','[::1]'],true)) {
        throw new RuntimeException('HTTPS required for authenticated server access.');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('tracky_sid');
    session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']),'samesite'=>'Strict','path'=>'/']);
    session_start();
}
function tracky_user(PDO $db): ?array {
    tracky_session();
    if (empty($_SESSION['uid'])) return null;
    $s=$db->prepare('SELECT id,username,role,active FROM users WHERE id=?');
    $s->execute([$_SESSION['uid']]);
    $user=$s->fetch();
    return ($user && $user['active']) ? $user : null;
}
function tracky_permission(PDO $db, array $user, string $permission): bool {
    $s=$db->prepare('SELECT 1 FROM role_permissions WHERE role=? AND permission=?');
    $s->execute([$user['role'],$permission]);
    return (bool)$s->fetchColumn();
}
function tracky_require(PDO $db,string $permission): array {
    $user=tracky_user($db);
    if (!$user) { http_response_code(401); throw new RuntimeException('Sign in required.'); }
    if (!tracky_permission($db,$user,$permission)) {
        http_response_code(403); throw new RuntimeException('Permission denied.');
    }
    return $user;
}
function tracky_csrf(): string {
    tracky_session();
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
function tracky_check_csrf(): void {
    $given=$_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf'] ?? '';
    if (!is_string($given) || !hash_equals(tracky_csrf(),$given)) {
        http_response_code(403); throw new RuntimeException('Invalid CSRF token.');
    }
}
function tracky_schema_version(PDO $db): int {
    $exists=$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_meta'")->fetchColumn();
    if(!$exists)return 0;
    $s=$db->prepare('SELECT value FROM schema_meta WHERE key=?');
    $s->execute(['schema_version']);
    $value=$s->fetchColumn();
    return $value===false?0:max(0,(int)$value);
}
function tracky_secret_key(): string {
    if(!extension_loaded('sodium')) throw new RuntimeException('PHP sodium extension required for encrypted data.');
    tracky_safe_data_dir();
    $path=TRACKY_DATA.'/secret.key';
    if(!is_file($path)){
        if(is_file(TRACKY_DATA.'/installed.lock'))
            throw new RuntimeException('Encryption key missing. Restore the original instance key from backup.');
        if(!is_dir(TRACKY_DATA)) throw new RuntimeException('Install Tracky2 first.');
        $f=@fopen($path,'x');
        if($f){
            try{
                chmod($path,0600);
                if(fwrite($f,random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES))!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)
                    throw new RuntimeException('Cannot write encryption key.');
                fflush($f);
            }finally{fclose($f);}
        }
    }
    $key=@file_get_contents($path);
    if(!is_string($key)||strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)
        throw new RuntimeException('Encryption key unavailable.');
    return $key;
}
function tracky_encrypt(string $plain): string {
    $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    return base64_encode($nonce.sodium_crypto_secretbox($plain,$nonce,tracky_secret_key()));
}
function tracky_decrypt(string $cipher): string {
    $data=base64_decode($cipher,true);
    if($data===false||strlen($data)<=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES)
        throw new RuntimeException('Encrypted record is corrupt.');
    $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain=sodium_crypto_secretbox_open(substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),$nonce,tracky_secret_key());
    if($plain===false)throw new RuntimeException('Unable to decrypt record.');
    return $plain;
}
function tracky_table_columns(PDO $db,string $table): array {
    if(!preg_match('/^[a-z_]+$/D',$table))throw new InvalidArgumentException('Invalid table name.');
    return array_map(static fn($r)=>(string)$r['name'],$db->query('PRAGMA table_info('.$table.')')->fetchAll());
}
function tracky_ensure_column(PDO $db,string $table,string $column,string $definition): void {
    if(in_array($column,tracky_table_columns($db,$table),true))return;
    if(!preg_match('/^[a-z_]+$/D',$column))throw new InvalidArgumentException('Invalid column name.');
    $db->exec('ALTER TABLE '.$table.' ADD COLUMN '.$column.' '.$definition);
}
function tracky_migrate_participant_profiles(PDO $db): void {
    if(!is_file(TRACKY_DATA.'/installed.lock'))return; // fresh installer has no live rows yet
    $rows=$db->query("SELECT id,profile_json FROM participants WHERE profile_ciphertext IS NULL AND profile_json<>'{}'")->fetchAll();
    if(!$rows)return;
    if(!is_file(TRACKY_DATA.'/secret.key'))
        throw new RuntimeException('Encryption key missing; participant profile migration stopped.');
    $u=$db->prepare("UPDATE participants SET profile_ciphertext=?,profile_json='{}' WHERE id=?");
    $db->beginTransaction();
    try{
        foreach($rows as $row){
            json_decode((string)$row['profile_json'],true,32,JSON_THROW_ON_ERROR);
            $u->execute([tracky_encrypt((string)$row['profile_json']),(string)$row['id']]);
        }
        $db->commit();
    }catch(Throwable $e){$db->rollBack();throw $e;}
}

function tracky_schema(PDO $db): void {
    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer',
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS roles(name TEXT PRIMARY KEY, description TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions(role TEXT NOT NULL REFERENCES roles(name),
 permission TEXT NOT NULL, PRIMARY KEY(role,permission));
CREATE TABLE IF NOT EXISTS participants(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, profile_json TEXT NOT NULL DEFAULT '{}',
 profile_ciphertext TEXT, consent INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1, client_updated_at INTEGER,
 server_updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER,
 updated_by INTEGER REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schema_meta(
 key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scenes(
 id TEXT PRIMARY KEY, title TEXT NOT NULL, snapshot_path TEXT,
 created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scene_objects(
 id TEXT PRIMARY KEY, scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
 label TEXT NOT NULL, confidence REAL, bbox_json TEXT, status TEXT NOT NULL DEFAULT 'proposed',
 approved_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS object_skills(
 object_id TEXT NOT NULL REFERENCES scene_objects(id) ON DELETE CASCADE,
 skill TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(object_id,skill)
);
CREATE TABLE IF NOT EXISTS provider_credentials(
 provider TEXT PRIMARY KEY CHECK(provider IN ('openai','anthropic','elevenlabs')),
 ciphertext TEXT NOT NULL, updated_by INTEGER REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS room_nodes(
 id TEXT PRIMARY KEY, room_id TEXT NOT NULL, room_name TEXT NOT NULL,
 runtime_instance_id TEXT, preferred_primary INTEGER NOT NULL DEFAULT 0,
 client_at INTEGER, server_seen_at INTEGER NOT NULL,
 connected_at INTEGER NOT NULL, updated_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_room_nodes_room_seen ON room_nodes(room_id,server_seen_at);
CREATE TABLE IF NOT EXISTS room_node_observations(
 id TEXT PRIMARY KEY, node_id TEXT NOT NULL, room_id TEXT NOT NULL,
 participant_id TEXT NOT NULL, semantic TEXT NOT NULL,
 from_room_id TEXT, to_room_id TEXT, authority TEXT,
 client_observed_at INTEGER, server_received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_observations_received ON room_node_observations(server_received_at);
CREATE INDEX IF NOT EXISTS idx_room_observations_participant ON room_node_observations(participant_id,server_received_at);
CREATE TABLE IF NOT EXISTS audit_log(
 id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL,
 subject TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL);
    tracky_ensure_column($db,'participants','profile_ciphertext','TEXT');
    tracky_ensure_column($db,'participants','version','INTEGER NOT NULL DEFAULT 1');
    tracky_ensure_column($db,'participants','client_updated_at','INTEGER');
    tracky_ensure_column($db,'participants','server_updated_at','INTEGER NOT NULL DEFAULT 0');
    tracky_ensure_column($db,'participants','deleted_at','INTEGER');
    $now=(int)floor(microtime(true)*1000);
    $q=$db->prepare('UPDATE participants SET server_updated_at=? WHERE server_updated_at=0');$q->execute([$now]);
    tracky_migrate_participant_profiles($db);
    $meta=$db->prepare('INSERT INTO schema_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    $meta->execute(['schema_version',(string)TRACKY_SCHEMA_VERSION]);
    $seed=[
      'owner'=>['install','users.manage','roles.manage','participants.read','participants.write','sync.manage','scene.read','scene.capture','objects.review','skills.approve','providers.manage','rooms.read','rooms.write'],
      'admin'=>['users.manage','participants.read','participants.write','sync.manage','scene.read','scene.capture','objects.review','skills.approve','providers.manage','rooms.read','rooms.write'],
      'operator'=>['participants.read','participants.write','scene.read','scene.capture','objects.review','rooms.read','rooms.write'],
      'viewer'=>['participants.read','scene.read']
    ];
    $db->beginTransaction();
    try {
      $r=$db->prepare('INSERT OR IGNORE INTO roles(name,description) VALUES(?,?)');
      $p=$db->prepare('INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)');
      foreach ($seed as $role=>$perms) {
        $r->execute([$role,ucfirst($role)]);
        foreach ($perms as $perm) $p->execute([$role,$perm]);
      }
      $db->commit();
    } catch(Throwable $e){$db->rollBack();throw $e;}
}
function tracky_json(): array {
    $data=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new InvalidArgumentException('JSON object required.');
    return $data;
}
function tracky_reply(array $value,int $status=200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store'); echo json_encode($value,JSON_THROW_ON_ERROR); exit;
}
