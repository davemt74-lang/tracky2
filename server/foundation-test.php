<?php
declare(strict_types=1);
function check(bool $ok,string $name):void{if(!$ok)throw new RuntimeException('FAIL: '.$name);echo 'PASS '.$name.PHP_EOL;}
$temp=sys_get_temp_dir().'/tracky2-foundation-'.bin2hex(random_bytes(5));
if(!mkdir($temp,0700))throw new RuntimeException('Cannot prepare temporary test DB.');
putenv('TRACKY2_DATA_DIR='.$temp);
require __DIR__.'/providers.php';
tracky_session(); // Session must start before PASS output in the CLI test runner.
try{
 $db=new PDO('sqlite:'.$temp.'/tracky.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $db->exec('PRAGMA foreign_keys=ON');
 tracky_schema($db);
 check((int)$db->query('SELECT COUNT(*) FROM roles')->fetchColumn()===4,'Four default roles created');
 $owner=(array)$db->query("SELECT permission FROM role_permissions WHERE role='owner'")->fetchAll(PDO::FETCH_COLUMN);
 check(in_array('providers.manage',$owner,true)&&in_array('providers.use',$owner,true)&&in_array('skills.execute',$owner,true)&&in_array('roles.manage',$owner,true)&&in_array('sync.manage',$owner,true),'Owner gets provider use/manage, governed skill execution, role and sync admin');
 $stmt=$db->prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,'owner')");
 $stmt->execute(['first-owner',password_hash('correct horse battery stable',PASSWORD_DEFAULT)]);
 $id=(int)$db->lastInsertId();
 check(tracky_permission($db,['role'=>'owner'],'roles.manage'),'Owner can manage roles');
 check(!tracky_permission($db,['role'=>'viewer'],'providers.manage'),'Viewer cannot access keys');
 check(tracky_permission($db,['role'=>'operator'],'providers.use'),'Operator can use configured providers');
 check(!tracky_permission($db,['role'=>'viewer'],'providers.use'),'Viewer cannot consume provider budget by default');
 check(tracky_permission($db,['role'=>'operator'],'skills.execute'),'Operator can execute approved governed skills');
 check(!tracky_permission($db,['role'=>'viewer'],'skills.execute'),'Viewer cannot execute governed skills by default');
 $secret='sk-this-is-only-a-test-not-an-api-key';
 tracky_store_provider($db,$id,'openai',$secret);
 check(tracky_provider_secret($db,'openai')===$secret,'Encrypted OpenAI key round-trips server-side');
 $data=$db->query("SELECT ciphertext FROM provider_credentials WHERE provider='openai'")->fetchColumn();
 check(!str_contains((string)$data,$secret),'Plaintext secret never stored');
 check(count(tracky_provider_status($db))===3,'Three configured provider choices');
 check(tracky_provider_model_allowed('openai','gpt-6-luna'),'OpenAI default model allowlisted');
 check(!tracky_provider_model_allowed('openai','arbitrary-model'),'Unknown model rejected');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='provider_usage_daily'")->fetchColumn(),'Provider usage budget table exists');
 $budget=tracky_provider_consume_budget($db,$id,'openai',250);
 check($budget['daily']['requests']===1&&$budget['daily']['units']===250,'Provider budget consumption is persisted');
 check($budget['session']['requests']===1&&$budget['session']['units']===250,'Provider session budget is bounded');
 tracky_provider_note_failure($db,$id,'openai');tracky_provider_note_failure($db,$id,'openai');tracky_provider_note_failure($db,$id,'openai');
 check(tracky_provider_circuit_open('openai'),'Provider circuit opens after repeated failures');
 tracky_provider_note_success('openai');check(!tracky_provider_circuit_open('openai'),'Provider success resets circuit');
 check(count($db->query('SELECT * FROM audit_log')->fetchAll())===1,'Provider updates audited');
 $encrypted=tracky_encrypt('participant-profile-test');
 check(!str_contains($encrypted,'participant-profile-test'),'Generic encrypted data is not plaintext');
 check(tracky_decrypt($encrypted)==='participant-profile-test','Generic encrypted data round-trips');
 check(tracky_schema_version($db)===TRACKY_SCHEMA_VERSION,'Fresh schema version recorded');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_nodes'")->fetchColumn(),'Room node registry table exists');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_node_observations'")->fetchColumn(),'Room observation relay table exists');
 check(tracky_permission($db,['role'=>'owner'],'rooms.read')&&tracky_permission($db,['role'=>'owner'],'rooms.write'),'Owner can run multi-room nodes');
 check(tracky_permission($db,['role'=>'operator'],'rooms.read')&&tracky_permission($db,['role'=>'operator'],'rooms.write'),'Operator can run multi-room nodes');
 check(!tracky_permission($db,['role'=>'viewer'],'rooms.read'),'Viewer cannot read live room-node presence');
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
