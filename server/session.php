<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')tracky_reply(['error'=>'Method not allowed'],405);
 $db=tracky_db();
 $user=tracky_user($db);
 if(!$user)tracky_reply(['authenticated'=>false],401);
 $s=$db->prepare('SELECT permission FROM role_permissions WHERE role=? ORDER BY permission');
 $s->execute([$user['role']]);
 // CSRF remains scoped to this authenticated same-origin session.
 tracky_reply(['authenticated'=>true,'user'=>[
  'id'=>(int)$user['id'],'username'=>$user['username'],'role'=>$user['role']
 ],'permissions'=>$s->fetchAll(PDO::FETCH_COLUMN),'csrf'=>tracky_csrf()]);
}catch(Throwable $e){tracky_reply(['error'=>'Session unavailable'],503);}
