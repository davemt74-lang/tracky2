<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
tracky_safe_data_dir();
tracky_session();
if(is_file(TRACKY_DATA.'/installed.lock')){http_response_code(404);exit('Installer disabled.');}
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 $token=htmlspecialchars(tracky_csrf(),ENT_QUOTES,'UTF-8');
 header('Content-Type: text/html; charset=utf-8');
 echo '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Tracky2 setup</title><style>body{font:16px system-ui;background:#101924;color:#eff;max-width:540px;margin:8vh auto;padding:2rem}form{display:grid;gap:1rem}input,button{display:block;width:100%;padding:.8rem;margin-top:.4rem;box-sizing:border-box}button{background:#116873;color:#fff;border:1px solid #7ad6d5;border-radius:8px}</style><main><h1>Install Tracky2</h1><p>Create the first owner account. No installation API key is required. Use HTTPS and ensure only you can reach this installer until setup finishes.</p><form method="post"><input type="hidden" name="csrf" value="'.$token.'"><label>Username<input name="username" required minlength="3" maxlength="40" autocomplete="username" pattern="[A-Za-z0-9_-]{3,40}"></label><label>Password<input type="password" name="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button>Create owner and install</button></form></main></html>';exit;
}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);exit;}
tracky_check_csrf();
$username=trim((string)($_POST['username']??''));$password=(string)($_POST['password']??'');
if(!preg_match('/^[a-zA-Z0-9_-]{3,40}$/D',$username)||strlen($password)<12||strlen($password)>256){
 http_response_code(422);exit('Username must be 3-40 letters/numbers; password at least 12 characters.');
}
umask(0077);
if(!is_dir(TRACKY_DATA)&&!@mkdir(TRACKY_DATA,0700,true)&&!is_dir(TRACKY_DATA)){
 http_response_code(500);exit('Private directory unavailable. Configure TRACKY2_DATA_DIR outside web root.');
}
tracky_safe_data_dir();
$guard=fopen(TRACKY_DATA.'/install.guard','c');
if(!$guard||!flock($guard,LOCK_EX|LOCK_NB)){http_response_code(409);exit('Installation is running.');}
try{
 if(is_file(TRACKY_DATA.'/installed.lock')){http_response_code(409);exit('Already installed.');}
 $db=new PDO('sqlite:'.TRACKY_DATA.'/tracky.sqlite',null,null,[
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
 ]);
 $db->exec('PRAGMA foreign_keys=ON');
 tracky_schema($db);
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()>0){
  http_response_code(409);exit('Database has users; use manual recovery instead of repeating setup.');
 }
 tracky_secret_key();
 $db->prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,'owner')")
    ->execute([$username,password_hash($password,PASSWORD_DEFAULT)]);
 if(file_put_contents(TRACKY_DATA.'/installed.lock',date(DATE_ATOM),LOCK_EX)===false)
   throw new RuntimeException('Could not lock installer.');
 @chmod(TRACKY_DATA.'/tracky.sqlite',0600);
 @chmod(TRACKY_DATA.'/installed.lock',0600);
 header('Location: admin.php',true,303);
} finally {flock($guard,LOCK_UN);fclose($guard);}
