<?php
declare(strict_types=1);
function check(bool $ok,string $name):void{if(!$ok)throw new RuntimeException('FAIL: '.$name);echo 'PASS '.$name.PHP_EOL;}
$temp=sys_get_temp_dir().'/tracky2-upgrade-'.bin2hex(random_bytes(5));
if(!mkdir($temp,0700))throw new RuntimeException('Cannot prepare upgrade test.');
putenv('TRACKY2_DATA_DIR='.$temp);
require __DIR__.'/bootstrap.php';
try{
 $db=new PDO('sqlite:'.$temp.'/tracky.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $db->exec('PRAGMA foreign_keys=ON');
 $db->exec("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'viewer',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $db->exec("CREATE TABLE roles(name TEXT PRIMARY KEY,description TEXT NOT NULL)");
 $db->exec("CREATE TABLE role_permissions(role TEXT NOT NULL,permission TEXT NOT NULL,PRIMARY KEY(role,permission))");
 $db->exec("CREATE TABLE participants(id TEXT PRIMARY KEY,name TEXT NOT NULL,profile_json TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $db->exec("CREATE TABLE scenes(id TEXT PRIMARY KEY,title TEXT NOT NULL,snapshot_path TEXT,created_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $db->exec("CREATE TABLE scene_objects(id TEXT PRIMARY KEY,scene_id TEXT NOT NULL,label TEXT NOT NULL,confidence REAL,bbox_json TEXT,status TEXT NOT NULL DEFAULT 'proposed',approved_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $db->exec("CREATE TABLE object_skills(object_id TEXT NOT NULL,skill TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(object_id,skill))");
 $db->exec("CREATE TABLE provider_credentials(provider TEXT PRIMARY KEY,ciphertext TEXT NOT NULL,updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $db->exec("CREATE TABLE audit_log(id INTEGER PRIMARY KEY,actor_id INTEGER,action TEXT NOT NULL,subject TEXT NOT NULL,at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
 $profile=json_encode(['id'=>'participant01','name'=>'Pat','embeddings'=>[[0.1,0.2]],'notes'=>'legacy'],JSON_THROW_ON_ERROR);
 $s=$db->prepare("INSERT INTO participants(id,name,profile_json,consent) VALUES(?,?,?,1)");$s->execute(['participant01','Pat',$profile]);
 file_put_contents($temp.'/secret.key',random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES));chmod($temp.'/secret.key',0600);
 file_put_contents($temp.'/installed.lock','legacy');chmod($temp.'/installed.lock',0600);
 check(tracky_schema_version($db)===0,'Legacy database has no schema version');
 tracky_schema($db);
 check(tracky_schema_version($db)===TRACKY_SCHEMA_VERSION,'Upgrade records schema version');
 $cols=tracky_table_columns($db,'participants');
 foreach(['profile_ciphertext','version','client_updated_at','server_updated_at','deleted_at'] as $col)
  check(in_array($col,$cols,true),'Participant column '.$col.' added');
 $row=$db->query("SELECT profile_json,profile_ciphertext,version,server_updated_at FROM participants WHERE id='participant01'")->fetch();
 check($row['profile_json']==='{}','Legacy plaintext profile cleared');
 check(is_string($row['profile_ciphertext'])&&strlen($row['profile_ciphertext'])>40,'Encrypted participant profile stored');
 check(json_decode(tracky_decrypt($row['profile_ciphertext']),true,32,JSON_THROW_ON_ERROR)['notes']==='legacy','Encrypted legacy profile decrypts');
 check((int)$row['version']===1&&(int)$row['server_updated_at']>0,'Version and server timestamp initialized');
 check(tracky_permission($db,['role'=>'owner'],'sync.manage'),'Owner receives sync permission after upgrade');
 check(tracky_permission($db,['role'=>'owner'],'providers.use'),'Owner receives provider use permission after upgrade');
 check(tracky_permission($db,['role'=>'operator'],'providers.use'),'Operator receives provider use permission after upgrade');
 check(tracky_permission($db,['role'=>'owner'],'skills.execute'),'Owner receives governed skill execution permission after upgrade');
 check(tracky_permission($db,['role'=>'operator'],'skills.execute'),'Operator receives governed skill execution permission after upgrade');
 check(!tracky_permission($db,['role'=>'viewer'],'skills.execute'),'Viewer remains unable to execute governed skills after upgrade');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='provider_usage_daily'")->fetchColumn(),'Upgrade creates provider usage budget table');
 check(tracky_provider_table_allows_acrcloud($db,'provider_credentials'),
  'Upgrade expands encrypted provider credentials for ACRCloud');
 check(tracky_provider_table_allows_acrcloud($db,'provider_usage_daily'),
  'Upgrade expands provider usage budgets for ACRCloud');
 tracky_store_acrcloud_provider(
  $db,1,'identify-us-west-2.acrcloud.com','upgradeAccessKey01','upgradeAccessSecret01'
 );
 check(tracky_acrcloud_config($db)!==null,'Upgraded database accepts encrypted ACRCloud credentials');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_nodes'")->fetchColumn(),'Upgrade creates room node registry');
 check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_node_observations'")->fetchColumn(),'Upgrade creates room observation relay');
 foreach(['sync_devices','sync_device_scopes','sync_resources','sync_resource_changes','sync_change_receipts'] as $table)
  check((bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='".$table."'")->fetchColumn(),'Upgrade creates '.$table);
 $resourceCols=tracky_table_columns($db,'sync_resources');
 foreach(['resource_type','resource_id','payload_ciphertext','payload_bytes','version','client_updated_at','server_updated_at','deleted_at'] as $col)
  check(in_array($col,$resourceCols,true),'Metadata sync resource column '.$col.' exists');
 check(tracky_permission($db,['role'=>'owner'],'rooms.write'),'Upgrade grants owner room runtime permission');
 check(tracky_permission($db,['role'=>'operator'],'rooms.read'),'Upgrade grants operator room read permission');
 $before=$row['profile_ciphertext'];tracky_schema($db);
 $after=$db->query("SELECT profile_ciphertext FROM participants WHERE id='participant01'")->fetchColumn();
 check($before===$after,'Repeated migration is idempotent');
 echo 'PASS upgrade tests'.PHP_EOL;
}finally{
 $db=null;
 foreach(glob($temp.'/*')?:[] as $file)if(is_file($file))unlink($file);
 @rmdir($temp);
}
