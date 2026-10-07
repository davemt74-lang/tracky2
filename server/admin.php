<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {$db=tracky_db();tracky_session();}
catch(Throwable $e){http_response_code(503);exit('Tracky2 setup or storage required. <a href="./install.php">First-time setup</a>');}
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
     'sync-device-toggle'=>'sync.manage',
     'object-approval'=>'objects.review',
     'skill-toggle'=>'skills.approve',
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
    $allowed=['participants.read','participants.write','sync.manage','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage','providers.use','skills.execute'];
    if(!in_array($role,['viewer','operator','admin'],true)||!in_array($perm,$allowed,true))
      throw new RuntimeException('Invalid permission.');
    if(($_POST['enabled']??'')==='1')
      $db->prepare('INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)')->execute([$role,$perm]);
    else
      $db->prepare('DELETE FROM role_permissions WHERE role=? AND permission=?')->execute([$role,$perm]);
    $subject=$role.'/'.$perm;
   }elseif($action==='provider-save'){
    $subject=(string)($_POST['provider']??'');
    if($subject==='acrcloud'){
     tracky_store_acrcloud_provider(
      $db,(int)$actor['id'],
      (string)($_POST['host']??''),
      (string)($_POST['access_key']??''),
      (string)($_POST['access_secret']??'')
     );
    }else{
     tracky_store_provider($db,(int)$actor['id'],$subject,(string)($_POST['secret']??''));
    }
   }elseif($action==='provider-delete'){
    $subject=(string)($_POST['provider']??'');
    if(!in_array($subject,TRACKY_PROVIDERS,true))throw new RuntimeException('Invalid provider.');
    $db->prepare('DELETE FROM provider_credentials WHERE provider=?')->execute([$subject]);
    }elseif($action==='sync-device-toggle'){
     $subject=(string)($_POST['device_id']??'');$enabled=($_POST['enabled']??'')==='1';
     if(!preg_match('/^[A-Za-z0-9_-]{8,96}$/D',$subject))throw new RuntimeException('Invalid sync device.');
     $q=$db->prepare('SELECT id FROM sync_devices WHERE id=?');$q->execute([$subject]);
     if(!$q->fetchColumn())throw new RuntimeException('Sync device not found.');
     $now=(int)floor(microtime(true)*1000);
     $db->prepare('UPDATE sync_devices SET enabled=?,revoked_at=? WHERE id=?')
       ->execute([$enabled?1:0,$enabled?null:$now,$subject]);
    }elseif($action==='object-approval'){
     $subject=(string)($_POST['object_id']??'');$approved=($_POST['approved']??'')==='1';
     if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$subject))throw new RuntimeException('Invalid object.');
     $q=$db->prepare('SELECT id FROM scene_objects WHERE id=?');$q->execute([$subject]);
     if(!$q->fetchColumn())throw new RuntimeException('Object not found.');
     $db->prepare('UPDATE scene_objects SET status=?,approved_by=? WHERE id=?')
       ->execute([$approved?'approved':'proposed',$approved?(int)$actor['id']:null,$subject]);
     if(!$approved)$db->prepare('UPDATE object_skills SET enabled=0 WHERE object_id=?')->execute([$subject]);
    }elseif($action==='skill-toggle'){
     $subject=(string)($_POST['object_id']??'');$skill=(string)($_POST['skill']??'');
     $enabled=($_POST['enabled']??'')==='1';
     if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$subject)
       ||!in_array($skill,['describe_object','product_search'],true))
       throw new RuntimeException('Invalid object skill.');
     $q=$db->prepare("SELECT 1 FROM scene_objects WHERE id=? AND status='approved'");$q->execute([$subject]);
     if(!$q->fetchColumn())throw new RuntimeException('Object approval required.');
     $db->prepare('INSERT INTO object_skills(object_id,skill,enabled) VALUES(?,?,?) ON CONFLICT(object_id,skill) DO UPDATE SET enabled=excluded.enabled')
       ->execute([$subject,$skill,$enabled?1:0]);
     $subject.='/'.$skill;
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
   foreach(['participants.read','participants.write','sync.manage','scene.read','scene.capture','objects.review','skills.approve','users.manage','providers.manage','providers.use','skills.execute'] as $perm){
    $q=$db->prepare('SELECT 1 FROM role_permissions WHERE role=? AND permission=?');$q->execute([$role,$perm]);
    $enabled=(bool)$q->fetchColumn();
    echo '<tr><td>'.$role.'</td><td>'.$perm.'</td><td><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="permission"><input type="hidden" name="role" value="'.$role.'"><input type="hidden" name="permission" value="'.$perm.'"><input type="hidden" name="enabled" value="'.($enabled?'0':'1').'"><button>'.($enabled?'Revoke':'Grant').'</button></form></td></tr>';
   }
  echo '</table></section>';
 }
 if(tracky_permission($db,$user,'providers.manage')){
  echo '<section><h2>AI, Voice & Recognition Providers</h2><p>Encrypted server-side. Saved credentials are never displayed. Runtime use is separately governed by the <code>providers.use</code> permission and bounded daily/session budgets.</p>';
  $names=['openai'=>'OpenAI / ChatGPT','anthropic'=>'Anthropic / Claude','elevenlabs'=>'ElevenLabs','acrcloud'=>'ACRCloud Music Recognition'];
  foreach(tracky_provider_status($db) as $p){
   $provider=$p['provider'];
   echo '<h3>'.tracky_html($names[$provider]??$provider).' — '.($p['configured']?'Configured':'Not configured').'</h3>';
   if($provider==='acrcloud'){
    echo '<p><small>Use the Host, Access Key and Access Secret from an ACRCloud Audio & Video Recognition project. The host is restricted to <code>*.acrcloud.com</code>. Saved values are never displayed.</small></p><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-save"><input type="hidden" name="provider" value="acrcloud"><label>Recognition host<input name="host" placeholder="identify-us-west-2.acrcloud.com" autocomplete="off" maxlength="255" required></label><label>Access key<input type="password" name="access_key" autocomplete="off" maxlength="160" required></label><label>Access secret<input type="password" name="access_secret" autocomplete="off" maxlength="512" required></label><button>Save or replace</button></form>';
   }else{
    echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-save"><input type="hidden" name="provider" value="'.$provider.'"><label>API key<input type="password" name="secret" autocomplete="off" maxlength="4096" required></label><button>Save or replace</button></form>';
   }
   if($p['configured'])echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="provider-delete"><input type="hidden" name="provider" value="'.$provider.'"><button>Remove credentials</button></form>';
  }
  echo '</section>';
 }
  if(tracky_permission($db,$user,'scene.read')){
   echo '<section><h2>Scene objects & governed skills</h2><p>Only approved server objects can expose server-governed skills. Revoking object approval disables every server skill grant immediately. Camera capture remains a local foreground-only skill.</p>';
   $objects=$db->query("SELECT o.id,o.label,o.status,o.confidence,s.title AS scene_title FROM scene_objects o JOIN scenes s ON s.id=o.scene_id ORDER BY o.created_at DESC LIMIT 100")->fetchAll();
   if(!$objects)echo '<p>No proposed or approved self-hosted scene objects yet.</p>';
   else{
    echo '<table><tr><th>Object</th><th>Status</th><th>Govern</th></tr>';
    foreach($objects as $obj){
     $id=(string)$obj['id'];$approved=$obj['status']==='approved';
     echo '<tr><td>'.tracky_html((string)$obj['label']).'<br><small>'.tracky_html((string)$obj['scene_title']).' · '.tracky_html($id).'</small></td><td>'.tracky_html((string)$obj['status']).'</td><td>';
     if(tracky_permission($db,$user,'objects.review'))
      echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="object-approval"><input type="hidden" name="object_id" value="'.tracky_html($id).'"><input type="hidden" name="approved" value="'.($approved?'0':'1').'"><button>'.($approved?'Revoke approval':'Approve object').'</button></form>';
     if($approved&&tracky_permission($db,$user,'skills.approve')){
      foreach(['describe_object'=>'Describe object','product_search'=>'Product search'] as $skill=>$label){
       $q=$db->prepare('SELECT enabled FROM object_skills WHERE object_id=? AND skill=?');$q->execute([$id,$skill]);$on=(int)($q->fetchColumn()?:0)===1;
       echo '<form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="skill-toggle"><input type="hidden" name="object_id" value="'.tracky_html($id).'"><input type="hidden" name="skill" value="'.$skill.'"><input type="hidden" name="enabled" value="'.($on?'0':'1').'"><button>'.($on?'Disable ':'Enable ').tracky_html($label).'</button></form>';
      }
     }
     echo '</td></tr>';
    }
    echo '</table>';
   }
   echo '</section>';
  }
 if(tracky_permission($db,$user,'sync.manage')){
   echo '<section><h2>Account participants</h2><p>Signed-in Tracky2 desktop/mobile pages automatically persist ordinary participant profiles in this encrypted self-hosted database and keep IndexedDB as an offline cache. Face/voice identity data crosses devices only when that participant enables the biometric account-sync toggle in Participants.</p><p><a href="../participants.html">Open participant editor</a></p></section><section><h2>Advanced participant reconciliation</h2><p>The legacy manual reconciliation tool remains available for explicit participant/biometric recovery and conflict work. It is not required for normal signed-in participant persistence.</p><button type="button" id="loadLocalParticipants">Review legacy reconciliation</button><div id="migrationArea" role="status"></div></section>';
   echo '<section><h2>Encrypted metadata sync v2</h2><p>Manual, device-scoped synchronization for owner-authorized memory, terminal task metadata, and the owner-defined scene configuration only. Transcripts, ROOM events, recordings/media, workflows and biometrics are excluded.</p><form id="resourceSyncDeviceForm"><label>Browser label<input id="resourceSyncDeviceLabel" maxlength="80" value="This browser"></label><label><input type="checkbox" name="resourceScope" value="memory"> Memory</label><label><input type="checkbox" name="resourceScope" value="task"> Terminal tasks</label><label><input type="checkbox" name="resourceScope" value="scene"> Scene configuration</label><button type="submit">Register / update scopes</button></form><p><button type="button" id="resourceSyncRefresh">Review metadata sync</button><button type="button" id="resourceSyncResume">Resume pending journal</button><button type="button" id="resourceSyncRevoke">Revoke this browser</button></p><div id="resourceSyncStatus" role="status">Metadata sync is not running.</div><div id="resourceSyncList"></div>';
   $devices=$db->query('SELECT id,label,enabled,revoked_at,last_seen_at FROM sync_devices ORDER BY label,id')->fetchAll();
   if($devices){
    echo '<h3>Registered sync devices</h3><table><tr><th>Device</th><th>Scopes</th><th>Status</th><th>Manage</th></tr>';
    foreach($devices as $device){
     $q=$db->prepare('SELECT resource_type FROM sync_device_scopes WHERE device_id=? AND enabled=1 ORDER BY resource_type');$q->execute([$device['id']]);
     $scopes=implode(', ',$q->fetchAll(PDO::FETCH_COLUMN));$active=(bool)$device['enabled']&&$device['revoked_at']===null;
     echo '<tr><td>'.tracky_html((string)$device['label']).'<br><small>'.tracky_html((string)$device['id']).'</small></td><td>'.tracky_html($scopes?:'none').'</td><td>'.($active?'active':'revoked').'</td><td><form method="post"><input type="hidden" name="csrf" value="'.$csrf.'"><input type="hidden" name="action" value="sync-device-toggle"><input type="hidden" name="device_id" value="'.tracky_html((string)$device['id']).'"><input type="hidden" name="enabled" value="'.($active?'0':'1').'"><button>'.($active?'Revoke':'Restore').'</button></form></td></tr>';
    }
    echo '</table>';
   }
   echo '<small>Revocation stops future metadata sync for that device ID. A revoked ID cannot silently re-register itself. Metadata payloads are encrypted with the instance key and subject to per-resource quotas.</small></section><script type="module" src="./sync.js"></script><script type="module" src="./resource-sync.js"></script>';
  }
 echo '<section><h2>Meetings</h2><p>Meeting controls are administrative tools, not a fifth AGENT workspace tab. They reuse the single AGENT camera, microphone, speaker-association and canonical transcript runtime.</p><p><a href="../vertical-motion.html?admin=meeting">Open meeting controls</a></p></section>';
 echo '<section><h2>Storage & privacy</h2><p>Participant profile JSON is encrypted at rest with the same private instance key used for provider credentials. Back up both the SQLite database and secret.key together. Manual CLI backup/verification/recovery is available through <code>php server/backup.php</code>. Do not synchronize biometric records without participant consent.</p></section>';
}
echo '</main></html>';
