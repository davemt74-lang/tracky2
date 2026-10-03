<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {$db=tracky_db();tracky_session();}
catch(Throwable $e){http_response_code(503);exit('Tracky2 is not installed or the private data directory is unavailable.');}
function tracky_html(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function tracky_rank(string $role):int{return ['viewer'=>0,'operator'=>1,'admin'=>2,'owner'=>3][$role]??-1;}
$error='';
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
 try {
  tracky_check_csrf();
  $action=(string)($_POST['action']??'');
  if($action==='login'){
   $s=$db->prepare('SELECT * FROM users WHERE username=? AND active=1');$s->execute([trim((string)($_POST['username']??''))]);$u=$s->fetch();
   if(!$u||!password_verify((string)($_POST['password']??''),$u['password_hash'])){
    usleep(250000);throw new RuntimeException('Invalid credentials.');
   }
   session_regenerate_id(true);
   $_SESSION['uid']=$u['id'];
   $_SESSION['csrf']=bin2hex(random_bytes(32));
  }elseif($action==='logout'){
   $_SESSION=[];
   session_regenerate_id(true);
  }else{
   $permission=match($action){
    'create-user','update-user'=>'users.manage',
    'permission'=>'roles.manage',
    'provider-save','provider-delete'=>'providers.manage',
    default=>'invalid'
   };
   $actor=tracky_require($db,$permission);
   $subject='';
   if($action==='create-user'){
    $username=trim((string)($_POST['username']??''));
    $pass=(string)($_POST['password']??'');
    $role=(string)($_POST['role']??'');
    if(!preg_match('/^[A-Za-z0-9_-]{3,40}$/D',$username)
       ||strlen($pass)<12||strlen($pass)>256
       ||!in_array($role,['viewer','operator','admin'],true)
       ||tracky_rank($role)>=tracky_rank($actor['role']))
       throw new RuntimeException('Invalid username, password, or assigned role.');
    $db->prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)')
       ->execute([$username,password_hash($pass,PASSWORD_DEFAULT),$role]);
    $subject=$username;
   }elseif($action==='update-user'){
    $id=filter_var($_POST['id']??null,FILTER_VALIDATE_INT);
    $role=(string)($_POST['role']??'');
    $active=(string)($_POST['active']??'');
    $password=(string)($_POST['password']??'');
    if(!$id||!in_array($role,['viewer','operator','admin'],true)||!in_array($active,['0','1'],true)
        ||($password!==''&&(strlen($password)<12||strlen($password)>256)))
        throw new RuntimeException('Invalid account update.');
    $q=$db->prepare('SELECT * FROM users WHERE id=?');$q->execute([$id]);$target=$q->fetch();
    if(!$target||$target['role']==='owner'||$id===$actor['id']
       ||tracky_rank($target['role'])>=tracky_rank($actor['role'])
       ||tracky_rank($role)>=tracky_rank($actor['role']))
       throw new RuntimeException('Cannot edit this account or assign that role.');
    $db->prepare('UPDATE users SET role=?,active=? WHERE id=?')
       ->execute([$role,(int)$active,$id]);
    if($password!=='')$db->prepare('UPDATE users SET password_hash=? WHERE id=?')
       ->execute([password_hash($password,PASSWORD_DEFAULT),$id]);
    $subject=$target['username'];
   }elseif($action==='permission'){
    $role=(string)($_POST['role']??'');$perm=(string)($_POST['permission']??'');
    $allowed=['participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage'];
    if(!in_array($role,['viewer','operator','admin'],true)||!in_array($perm,$allowed,true))
      throw new RuntimeException('Invalid permission.');
    if(($_POST['enabled']??'')==='1')
      $db->prepare('INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)')->execute([$role,$perm]);
    else
      $db->prepare('DELETE FROM role_permissions WHERE role=? AND permission=?')->execute([$role,$perm]);
    $subject=$role.'/'.$perm;
   }elseif($action==='provider-save'){
    $subject=(string)($_POST['provider']??'');
    tracky_store_provider($db,(int)$actor['id'],$subject,(string)($_POST['secret']??''));
   }elseif($action==='provider-delete'){
    $subject=(string)($_POST['provider']??'');
    if(!in_array($subject,TRACKY_PROVIDERS,true))throw new RuntimeException('Invalid provider.');
    $db->prepare('DELETE FROM provider_credentials WHERE provider=?')->execute([$subject]);
   }
   $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
      ->execute([$actor['id'],$action,$subject]);
  }
  header('Location: admin.php',true,303);exit;
 }catch(Throwable $e){$error=$e instanceof PDOException?'Operation failed; review account or database state.':$e->getMessage();}
}
$user=tracky_user($db);$csrf=tracky_html(tracky_csrf());
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'unsafe-inline' 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
echo '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Tracky2 Admin</title><style>
body{background:#101724;color:#eaffff;font:15px system-ui;max-width:980px;margin:auto;padding:clamp(1rem,3vw,2rem)}
section{border:1px solid #397581;padding:1rem;border-radius:14px;margin:1rem 0;background:#14303ca9}
input,select,button{padding:.65rem;margin:.2rem;color:#f2ffff;background:#183a46;border:1px solid #5093a2;border-radius:7px}
label{display:inline-grid;gap:.2rem;margin:.3rem}button{cursor:pointer}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #4561;padding:.5rem;text-align:left}small{color:#b4d4d5}
</style><main><h1>Tracky2 administration</h1>';
if($error)echo '<p role="alert">'.tracky_html($error).'</p>';
if(!$user){
 echo '<section><h2>Sign in</h2><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="login"><label>Username<input name="username" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button>Sign in</button></form></section>';
}else{
 echo '<p>'.tracky_html($user['username']).' · '.tracky_html($user['role']).'</p><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="logout"><button>Log out</button></form>';
 if(tracky_permission($db,$user,'users.manage')){
  echo '<section><h2>Users</h2><p>Owner cannot be modified. You can manage accounts with a lower role than yours.</p><table><tr><th>Account</th><th>Role / status</th><th>Manage</th></tr>';
  foreach($db->query('SELECT id,username,role,active FROM users ORDER BY id') as $u){
   echo '<tr><td>'.tracky_html($u['username']).'</td><td>'.tracky_html($u['role']).' · '.($u['active']?'active':'disabled').'</td><td>';
   if($u['role']!=='owner'&&$u['id']!=$user['id']&&tracky_rank($u['role'])<tracky_rank($user['role'])){
    echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="update-user"><input type="hidden" name="id" value="'.(int)$u['id'].'"><select name="role">';
    foreach(['viewer','operator','admin'] as $role)if(tracky_rank($role)<tracky_rank($user['role']))
      echo '<option value="'.$role.'" '.($role===$u['role']?'selected':'').'>'.$role.'</option>';
    echo '</select><select name="active"><option value="1" '.($u['active']?'selected':'').'>Active</option><option value="0" '.(!$u['active']?'selected':'').'>Disabled</option></select><input type="password" name="password" placeholder="New password (optional)" minlength="12" autocomplete="new-password"><button>Save</button></form>';
   }
   echo '</td></tr>';
  }
  echo '</table><h3>Create user</h3><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="create-user"><label>Username<input name="username" required minlength="3" maxlength="40"></label><label>Password<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label>User type<select name="role">';
  foreach(['viewer','operator','admin'] as $role)if(tracky_rank($role)<tracky_rank($user['role']))echo '<option>'.$role.'</option>';
  echo '</select></label><button>Create user</button></form></section>';
 }
 if(tracky_permission($db,$user,'roles.manage')){
  echo '<section><h2>User types & permissions</h2><p>Changes take effect on the next request. The owner role is immutable.</p><table><tr><th>Role</th><th>Permission</th><th>Grant</th></tr>';
  foreach(['admin','operator','viewer'] as $role)
   foreach(['participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage'] as $perm){
    $q=$db->prepare('SELECT 1 FROM role_permissions WHERE role=? AND permission=?');$q->execute([$role,$perm]);
    $enabled=(bool)$q->fetchColumn();
    echo '<tr><td>'.$role.'</td><td>'.$perm.'</td><td><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="permission"><input type="hidden" name="role" value="'.$role.'"><input type="hidden" name="permission" value="'.$perm.'"><input type="hidden" name="enabled" value="'.($enabled?'0':'1').'"><button>'.($enabled?'Revoke':'Grant').'</button></form></td></tr>';
   }
  echo '</table></section>';
 }
 if(tracky_permission($db,$user,'providers.manage')){
  echo '<section><h2>LLM & Voice Providers</h2><p>Encrypted server-side. Saved API keys are never displayed.</p>';
  $names=['openai'=>'OpenAI / ChatGPT','anthropic'=>'Anthropic / Claude','elevenlabs'=>'ElevenLabs'];
  foreach(tracky_provider_status($db) as $p){
   $provider=$p['provider'];echo '<h3>'.tracky_html($names[$provider]).' — '.($p['configured']?'Configured':'Not configured').'</h3><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-save"><input type="hidden" name="provider" value="'.$provider.'"><label>API key<input type="password" name="secret" autocomplete="off" maxlength="4096" required></label><button>Save or replace</button></form>';
   if($p['configured'])echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-delete"><input type="hidden" name="provider" value="'.$provider.'"><button>Remove key</button></form>';
  }
  echo '</section>';
 }
 if(tracky_permission($db,$user,'participants.write'))
  echo '<section><h2>Participant migration</h2><p>Browser profiles stay local unless you explicitly select them and approve copying them into your server database.</p><button type="button" id="loadLocalParticipants">Review browser profiles</button><div id="migrationArea" role="status"></div></section><script type="module" src="./sync.js"></script>';
 echo '<section><h2>Storage & privacy</h2><p>Back up both the SQLite database and instance secret.key from your configured private directory. Do not move biometric records to this server without participant consent. Scene capture and object actions require separate authorization.</p></section>';
}
echo '</main></html>';
