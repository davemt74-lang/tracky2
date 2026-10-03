<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
if(PHP_SAPI!=='cli'&&empty($_SERVER['HTTPS'])&&!in_array($_SERVER['HTTP_HOST']??'',['localhost','127.0.0.1'],true)){http_response_code(403);exit('HTTPS is required.');}
if(is_file(TRACKY_DATA.'/installed.lock')){http_response_code(404);exit('Installer disabled.');}
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 header('Content-Type: text/html; charset=utf-8');
 echo '<!doctype html><html><meta name="viewport" content="width=device-width"><title>Tracky2 Setup</title><body><h1>Tracky2: Create first owner</h1><form method="post"><label>Username <input name="username" required minlength="3" maxlength="40"></label><label>Password <input type="password" name="password" required minlength="12"></label><button>Create owner and install</button></form></body></html>';exit;
}
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit;}
$username=trim((string)($_POST['username']??''));$password=(string)($_POST['password']??'');
if(!preg_match('/^[a-zA-Z0-9_-]{3,40}$/D',$username)||strlen($password)<12||strlen($password)>256){http_response_code(422);exit('Invalid username or password.');}
if(!is_dir(TRACKY_DATA)&&!mkdir(TRACKY_DATA,0700,true)){http_response_code(500);exit('Unable to create private directory.');}
$guard=fopen(TRACKY_DATA.'/install.guard','c');
if(!$guard||!flock($guard,LOCK_EX|LOCK_NB)){http_response_code(409);exit('Installation already running.');}
try{
 if(is_file(TRACKY_DATA.'/installed.lock')){http_response_code(409);exit('Already installed.');}
 $db=new PDO('sqlite:'.TRACKY_DATA.'/tracky.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 tracky_schema($db);
 if((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()>0){http_response_code(409);exit('Database already has an owner. Manual recovery required.');}
 $s=$db->prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,'owner')");
 $s->execute([$username,password_hash($password,PASSWORD_DEFAULT)]);
 if(file_put_contents(TRACKY_DATA.'/installed.lock',date(DATE_ATOM),LOCK_EX)===false)throw new RuntimeException('Could not lock installer.');
 @chmod(TRACKY_DATA.'/tracky.sqlite',0600);@chmod(TRACKY_DATA.'/installed.lock',0600);
 header('Content-Type: text/plain; charset=utf-8');echo 'Installed. Open server/admin.php to sign in.';
}finally{flock($guard,LOCK_UN);fclose($guard);}
