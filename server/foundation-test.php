<?php
declare(strict_types=1);
function check(bool $ok,string $name):void{if(!$ok)throw new RuntimeException('FAIL: '.$name);echo 'PASS '.$name.PHP_EOL;}
$temp=sys_get_temp_dir().'/tracky2-foundation-'.bin2hex(random_bytes(5));
if(!mkdir($temp,0700))throw new RuntimeException('Cannot prepare temporary test DB.');
putenv('TRACKY2_DATA_DIR='.$temp);
require dirname(__DIR__).'/providers.php';
try{
 $db=new PDO('sqlite:'.$temp.'/tracky.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $db->exec('PRAGMA foreign_keys=ON');
 tracky_schema($db);
 check((int)$db->query('SELECT COUNT(*) FROM roles')->fetchColumn()===4,'Four default roles created');
 $owner=(array)$db->query("SELECT permission FROM role_permissions WHERE role='owner'")->fetchAll(PDO::FETCH_COLUMN);
 check(in_array('providers.manage',$owner,true)&&in_array('roles.manage',$owner,true),'Owner gets provider and role admin');
 $stmt=$db->prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,'owner')");
 $stmt->execute(['first-owner',password_hash('correct horse battery stable',PASSWORD_DEFAULT)]);
 $id=(int)$db->lastInsertId();
 check(tracky_permission($db,['role'=>'owner'],'roles.manage'),'Owner can manage roles');
 check(!tracky_permission($db,['role'=>'viewer'],'providers.manage'),'Viewer cannot access keys');
 $secret='sk-this-is-only-a-test-not-an-api-key';
 tracky_store_provider($db,$id,'openai',$secret);
 check(tracky_provider_secret($db,'openai')===$secret,'Encrypted OpenAI key round-trips server-side');
 $data=$db->query("SELECT ciphertext FROM provider_credentials WHERE provider='openai'")->fetchColumn();
 check(!str_contains((string)$data,$secret),'Plaintext secret never stored');
 check(count(tracky_provider_status($db))===3,'Three configured provider choices');
 check(count($db->query('SELECT * FROM audit_log')->fetchAll())===1,'Provider updates audited');
 $failed=false;try{tracky_store_provider($db,$id,'bad-provider','1234567890');}catch(InvalidArgumentException $e){$failed=true;}
 check($failed,'Unknown providers rejected');
 file_put_contents($temp.'/installed.lock','test');
 rename($temp.'/secret.key',$temp.'/secret.key.bak');
 $failed=false;try{tracky_secret_key();}catch(RuntimeException $e){$failed=true;}
 check($failed&&!is_file($temp.'/secret.key'),'Lost encryption key does not silently rotate after install');
 rename($temp.'/secret.key.bak',$temp.'/secret.key');
 check(tracky_provider_secret($db,'openai')===$secret,'Recovered original encryption key restores access');
 tracky_session();
 $_SERVER['HTTP_X_CSRF_TOKEN']=tracky_csrf();
 tracky_check_csrf();
 $_SERVER['HTTP_X_CSRF_TOKEN']='not-a-token';
 $failed=false;try{tracky_check_csrf();}catch(RuntimeException $e){$failed=true;}
 check($failed,'Invalid CSRF token fails');
 unset($_SERVER['HTTP_X_CSRF_TOKEN']);
 $_POST['csrf']=tracky_csrf();tracky_check_csrf();
 check(true,'HTML form CSRF accepted');
 echo 'PASS foundation tests'.PHP_EOL;
} finally {
 $db=null;
 foreach(glob($temp.'/*')?:[] as $file)if(is_file($file))unlink($file);
 rmdir($temp);
}
