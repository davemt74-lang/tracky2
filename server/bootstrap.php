<?php
declare(strict_types=1);
// Self-hosted Tracky2 foundation. Requires PHP 8.1+ with PDO SQLite.
const TRACKY_DATA = __DIR__ . '/../private-data';
function tracky_db(): PDO {
    if (!is_dir(TRACKY_DATA) || !is_file(TRACKY_DATA.'/installed.lock')) {
        throw new RuntimeException('Tracky2 is not installed.');
    }
    $db = new PDO('sqlite:'.TRACKY_DATA.'/tracky.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
    $db->exec('PRAGMA foreign_keys=ON');
    return $db;
}
function tracky_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    if (PHP_SAPI !== 'cli' && empty($_SERVER['HTTPS']) && ($_SERVER['HTTP_HOST'] ?? '') !== 'localhost') {
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
    $given=$_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($given) || !hash_equals(tracky_csrf(),$given)) {
        http_response_code(403); throw new RuntimeException('Invalid CSRF token.');
    }
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
 id TEXT PRIMARY KEY, name TEXT NOT NULL, profile_json TEXT NOT NULL,
 consent INTEGER NOT NULL DEFAULT 0, updated_by INTEGER REFERENCES users(id),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE IF NOT EXISTS audit_log(
 id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL,
 subject TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL);
    $seed=[
      'owner'=>['install','users.manage','roles.manage','participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve'],
      'admin'=>['users.manage','participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve'],
      'operator'=>['participants.read','participants.write','scene.read','scene.capture','objects.review'],
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
