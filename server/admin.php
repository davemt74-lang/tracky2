<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
try{$db=tracky_db();}catch(Throwable $e){http_response_code(503);exit('Install Tracky2 first.');}
tracky_session();$error='';
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
 try{
 tracky_check_csrf();$action=(string)($_POST['action']??'');
 if($action==='login'){
  $s=$db->prepare('SELECT * FROM users WHERE username=? AND active=1');$s->execute([trim((string)($_POST['username']??''))]);$u=$s->fetch();
  if(!$u||!password_verify((string)($_POST['password']??''),$u['password_hash'])){usleep(250000);throw new RuntimeException('Invalid credentials.');}
  session_regenerate_id(true);$_SESSION['uid']=$u['id'];$_SESSION['csrf']=bin2hex(random_bytes(32));
 }elseif($action==='logout'){$_SESSION=[];session_regenerate_id(true);}
 else{
  $permission=match($action){'create-user'=>'users.manage','permission'=>'roles.manage','provider-save','provider-delete'=>'providers.manage',default=>'invalid'};
  $actor=tracky_require($db,$permission);
  if($action==='create-user'){
   $username=trim((string)($_POST['username']??''));$pass=(string)($_POST['password']??'');$role=(string)($_POST['role']??'');
   if(!preg_match('/^[A-Za-z0-9_-]{3,40}$/D',$username)||strlen($pass)<12||strlen($pass)>256||!in_array($role,['viewer','operator','admin'],true))throw new RuntimeException('Invalid user.');
   $db->prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)')->execute([$username,password_hash($pass,PASSWORD_DEFAULT),$role]);
  }elseif($action==='permission'){
   $role=(string)($_POST['role']??'');$perm=(string)($_POST['permission']??'');
   $allowed=['participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage'];
   if(!in_array($role,['viewer','operator','admin'],true)||!in_array($perm,$allowed,true))throw new RuntimeException('Invalid permission.');
   if(($_POST['enabled']??'')==='1')$db->prepare('INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)')->execute([$role,$perm]);
   else $db->prepare('DELETE FROM role_permissions WHERE role=? AND permission=?')->execute([$role,$perm]);
  }elseif($action==='provider-save')tracky_store_provider($db,(int)$actor['id'],(string)($_POST['provider']??''),(string)($_POST['secret']??''));
  elseif($action==='provider-delete'){
   $provider=(string)($_POST['provider']??'');
   if(!in_array($provider,TRACKY_PROVIDERS,true))throw new RuntimeException('Invalid provider.');
   $db->prepare('DELETE FROM provider_credentials WHERE provider=?')->execute([$provider]);
   $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor['id'],'provider.delete',$provider]);
  }
  $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor['id'],$action,(string)($_POST['provider']??$_POST['username']??$_POST['role']??'')]);
 }
 header('Location: admin.php',true,303);exit;
 }catch(Throwable $e){$error=$e instanceof PDOException?'Operation failed.':$e->getMessage();}
}
function h(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$user=tracky_user($db);$csrf=h(tracky_csrf());header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Tracky2 Admin</title><style>body{background:#101724;color:white;font:16px system-ui;max-width:920px;margin:auto;padding:2rem}section{border:1px solid #566;padding:1rem;border-radius:14px;margin:1rem 0}input,select,button{padding:.65rem;margin:.35rem}label{display:inline-block}</style><main><h1>Tracky2 administration</h1>';
if($error)echo '<p role="alert">'.h($error).'</p>';
if(!$user){echo '<section><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="login"><label>Username<input name="username" required></label><label>Password<input type="password" name="password" required></label><button>Sign in</button></form></section>';}
else{
 echo '<p>'.h($user['username']).' · '.h($user['role']).'</p><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="logout"><button>Log out</button></form>';
 if(tracky_permission($db,$user,'users.manage')){
  echo '<section><h2>Users</h2><ul>';
  foreach($db->query('SELECT username,role,active FROM users ORDER BY id') as $u)echo '<li>'.h($u['username']).' — '.h($u['role']).' '.($u['active']?'active':'disabled').'</li>';
  echo '</ul><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="create-user"><label>Username<input name="username" required></label><label>Password<input name="password" type="password" minlength="12" required></label><label>Type<select name="role"><option>viewer</option><option>operator</option><option>admin</option></select></label><button>Create user</button></form></section>';
 }
 if(tracky_permission($db,$user,'roles.manage')){
  echo '<section><h2>User types & permissions</h2><p>Owner permissions cannot be changed.</p><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="permission"><select name="role"><option>admin</option><option>operator</option><option>viewer</option></select><select name="permission">';
  foreach(['participants.read','participants.write','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage'] as $p)echo '<option>'.h($p).'</option>';
  echo '</select><select name="enabled"><option value="1">Allow</option><option value="0">Deny</option></select><button>Save permission</button></form></section>';
 }
 if(tracky_permission($db,$user,'providers.manage')){
  echo '<section><h2>LLM & Voice Providers</h2><p>Keys are encrypted on this server. Saved values cannot be viewed or sent to browsers.</p>';
  $names=['openai'=>'OpenAI / ChatGPT','anthropic'=>'Anthropic / Claude','elevenlabs'=>'ElevenLabs voice'];
  foreach(tracky_provider_status($db) as $p){
   $provider=$p['provider'];echo '<h3>'.h($names[$provider]).' — '.($p['configured']?'Configured':'Not configured').'</h3><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-save"><input type="hidden" name="provider" value="'.h($provider).'"><label>API key<input type="password" name="secret" autocomplete="off" required></label><button>Save / replace</button></form>';
   if($p['configured'])echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-delete"><input type="hidden" name="provider" value="'.h($provider).'"><button>Remove key</button></form>';
  }
  echo '</section>';
 }
}
echo '</main></html>';
