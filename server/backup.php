<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';

if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function tracky_backup_usage(): never {
    fwrite(STDERR,"Usage: php server/backup.php create [directory]\n");
    fwrite(STDERR,"       php server/backup.php verify <directory>\n");
    fwrite(STDERR,"       php server/backup.php restore <directory> --yes\n");
    exit(2);
}
function tracky_backup_path(string $base,string $name): string {
    return rtrim($base,DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$name;
}
function tracky_backup_hash(string $path): string {
    $hash=hash_file('sha256',$path);
    if($hash===false)throw new RuntimeException('Cannot hash '.$path);
    return $hash;
}
function tracky_backup_decrypt_with_key(string $cipher,string $key): string {
    $data=base64_decode($cipher,true);
    if($data===false||strlen($data)<=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES)
        throw new RuntimeException('Encrypted participant record is corrupt.');
    $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain=sodium_crypto_secretbox_open(substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),$nonce,$key);
    if($plain===false)throw new RuntimeException('Backup encryption key does not match participant data.');
    return $plain;
}
function tracky_backup_verify(string $dir): array {
    $manifestPath=tracky_backup_path($dir,'manifest.json');
    if(!is_file($manifestPath))throw new RuntimeException('Backup manifest missing.');
    $manifest=json_decode((string)file_get_contents($manifestPath),true,32,JSON_THROW_ON_ERROR);
    if(!is_array($manifest)||($manifest['format']??null)!==1)throw new RuntimeException('Unsupported backup format.');
    foreach(['tracky.sqlite','secret.key','installed.lock'] as $name){
        $path=tracky_backup_path($dir,$name);
        if(!is_file($path))throw new RuntimeException('Backup file missing: '.$name);
        $expected=(string)($manifest['sha256'][$name]??'');
        if(!preg_match('/^[0-9a-f]{64}$/D',$expected)||!hash_equals($expected,tracky_backup_hash($path)))
            throw new RuntimeException('Backup checksum mismatch: '.$name);
    }
    $key=(string)file_get_contents(tracky_backup_path($dir,'secret.key'));
    if(strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)throw new RuntimeException('Backup secret.key is invalid.');
    $db=new PDO('sqlite:'.tracky_backup_path($dir,'tracky.sqlite'),null,null,[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
    ]);
    $integrity=$db->query('PRAGMA integrity_check')->fetchColumn();
    if($integrity!=='ok')throw new RuntimeException('Backup SQLite integrity check failed.');
    $columns=array_map(static fn($r)=>(string)$r['name'],$db->query('PRAGMA table_info(participants)')->fetchAll());
    if(!in_array('profile_ciphertext',$columns,true))throw new RuntimeException('Backup participant schema is too old.');
    $row=$db->query("SELECT profile_ciphertext FROM participants WHERE profile_ciphertext IS NOT NULL AND deleted_at IS NULL LIMIT 1")->fetch();
    if($row){
        $plain=tracky_backup_decrypt_with_key((string)$row['profile_ciphertext'],$key);
        $decoded=json_decode($plain,true,32,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))throw new RuntimeException('Backup participant profile is invalid.');
    }
    $db=null;
    return $manifest;
}
function tracky_backup_create(string $dir): array {
    if(!is_dir(TRACKY_DATA)||!is_file(TRACKY_DATA.'/installed.lock'))throw new RuntimeException('Tracky2 is not installed.');
    if(file_exists($dir))throw new RuntimeException('Backup destination already exists.');
    if(!mkdir($dir,0700,true))throw new RuntimeException('Cannot create backup directory.');
    @chmod($dir,0700);
    $db=tracky_db();
    $dbPath=tracky_backup_path($dir,'tracky.sqlite');
    $quoted=str_replace("'","''",$dbPath);
    $db->exec("VACUUM INTO '".$quoted."'");
    $db=null;
    foreach(['secret.key','installed.lock'] as $name){
        $source=TRACKY_DATA.'/'.$name;$dest=tracky_backup_path($dir,$name);
        if(!is_file($source)||!copy($source,$dest))throw new RuntimeException('Cannot copy '.$name);
        @chmod($dest,0600);
    }
    @chmod($dbPath,0600);
    $manifest=[
      'format'=>1,'schemaVersion'=>TRACKY_SCHEMA_VERSION,'createdAt'=>date(DATE_ATOM),
      'source'=>'tracky2-private','sha256'=>[
        'tracky.sqlite'=>tracky_backup_hash($dbPath),
        'secret.key'=>tracky_backup_hash(tracky_backup_path($dir,'secret.key')),
        'installed.lock'=>tracky_backup_hash(tracky_backup_path($dir,'installed.lock'))
      ]
    ];
    $json=json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    if(file_put_contents(tracky_backup_path($dir,'manifest.json'),$json."\n",LOCK_EX)===false)
        throw new RuntimeException('Cannot write backup manifest.');
    @chmod(tracky_backup_path($dir,'manifest.json'),0600);
    tracky_backup_verify($dir);
    return $manifest;
}
function tracky_backup_restore(string $dir): void {
    tracky_backup_verify($dir);
    $guardPath=TRACKY_DATA.'/restore.guard';
    $guard=fopen($guardPath,'c');
    if(!$guard||!flock($guard,LOCK_EX|LOCK_NB))throw new RuntimeException('Restore is already running.');
    try{
        $pre=dirname(TRACKY_DATA).DIRECTORY_SEPARATOR.'tracky2-pre-restore-'.date('Ymd-His');
        tracky_backup_create($pre);
        $temps=[];
        foreach(['tracky.sqlite','secret.key','installed.lock'] as $name){
            $tmp=TRACKY_DATA.'/restore-'.$name.'.tmp';
            if(!copy(tracky_backup_path($dir,$name),$tmp))throw new RuntimeException('Cannot stage '.$name);
            @chmod($tmp,0600);$temps[$name]=$tmp;
        }
        foreach(['tracky.sqlite','secret.key','installed.lock'] as $name){
            $dest=TRACKY_DATA.'/'.$name;
            if(is_file($dest)&&!@unlink($dest))throw new RuntimeException('Cannot replace '.$name);
            if(!rename($temps[$name],$dest))throw new RuntimeException('Cannot install restored '.$name);
        }
        $db=tracky_db();
        $integrity=$db->query('PRAGMA integrity_check')->fetchColumn();
        if($integrity!=='ok')throw new RuntimeException('Restored SQLite integrity check failed.');
        $db=null;
        echo "RESTORED. Pre-restore recovery point: ".$pre.PHP_EOL;
    }finally{
        flock($guard,LOCK_UN);fclose($guard);
    }
}
$action=$argv[1]??'';
if(!in_array($action,['create','verify','restore'],true))tracky_backup_usage();
try{
    if($action==='create'){
        $dir=$argv[2]??(dirname(TRACKY_DATA).DIRECTORY_SEPARATOR.'tracky2-backup-'.date('Ymd-His'));
        $manifest=tracky_backup_create($dir);
        echo "BACKUP OK ".$dir.PHP_EOL;
        echo "DB SHA256 ".$manifest['sha256']['tracky.sqlite'].PHP_EOL;
    }elseif($action==='verify'){
        if(empty($argv[2]))tracky_backup_usage();
        $manifest=tracky_backup_verify($argv[2]);
        echo "VERIFY OK schema ".$manifest['schemaVersion'].PHP_EOL;
    }else{
        if(empty($argv[2])||($argv[3]??'')!=='--yes')tracky_backup_usage();
        tracky_backup_restore($argv[2]);
    }
}catch(Throwable $e){
    fwrite(STDERR,'ERROR: '.$e->getMessage().PHP_EOL);exit(1);
}
