<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_sync_has_biometrics(array $profile): bool {
    foreach(['primaryPhoto','latestPhoto','faceSamples','faceEmbeddings','embeddings',
      'voiceSamples','voiceEmbedding','voiceEmbeddings','voiceProfileSamples'] as $key)
        if(!empty($profile[$key])) return true;
    return false;
}
function tracky_sync_record(array $row): array {
    $deleted=$row['deleted_at']!==null;
    $profile=null;
    if(!$deleted && !empty($row['profile_ciphertext'])){
        $plain=tracky_decrypt((string)$row['profile_ciphertext']);
        $decoded=json_decode($plain,true,32,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))throw new RuntimeException('Stored participant profile is invalid.');
        $profile=$decoded;
    }
    return [
      'id'=>(string)$row['id'],'name'=>$deleted?null:(string)$row['name'],
      'profile'=>$profile,'consent'=>(bool)$row['consent'],
      'version'=>(int)$row['version'],
      'clientUpdatedAt'=>$row['client_updated_at']===null?null:(int)$row['client_updated_at'],
      'serverUpdatedAt'=>(int)$row['server_updated_at'],
      'deleted'=>$deleted,'deletedAt'=>$deleted?(int)$row['deleted_at']:null
    ];
}
function tracky_sync_select(PDO $db,string $id): ?array {
    $s=$db->prepare('SELECT id,name,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at FROM participants WHERE id=?');
    $s->execute([$id]);$row=$s->fetch();return $row?:null;
}
function tracky_sync_id(mixed $value): string {
    $id=(string)$value;
    if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$id))throw new InvalidArgumentException('Invalid participant ID.');
    return $id;
}

try{
    $db=tracky_db();
    if((int)($_SERVER['CONTENT_LENGTH']??0)>3_000_000)tracky_reply(['error'=>'Request too large'],413);
    $actor=tracky_require($db,'sync.manage');
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        $rows=$db->query('SELECT id,name,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at FROM participants ORDER BY server_updated_at,id')->fetchAll();
        tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'records'=>array_map('tracky_sync_record',$rows)]);
    }
    if($method!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    tracky_check_csrf();
    $data=tracky_json();$changes=$data['changes']??null;
    if(!is_array($changes)||count($changes)>50)tracky_reply(['error'=>'changes must contain at most 50 records'],422);
    $results=[];$now=(int)floor(microtime(true)*1000);
    foreach($changes as $change){
        if(!is_array($change)){ $results[]=['status'=>'rejected','error'=>'Invalid change'];continue; }
        try{
            $id=tracky_sync_id($change['id']??'');
            $operation=(string)($change['operation']??'');
            if(!in_array($operation,['upsert','delete'],true))throw new InvalidArgumentException('Invalid sync operation.');
            $baseVersion=filter_var($change['baseVersion']??null,FILTER_VALIDATE_INT);
            if($baseVersion===false||$baseVersion<0)throw new InvalidArgumentException('Invalid base version.');
            $resolution=(string)($change['resolution']??'');
            if($resolution!==''&&$resolution!=='browser')throw new InvalidArgumentException('Invalid conflict resolution.');
            $current=tracky_sync_select($db,$id);$currentVersion=$current?(int)$current['version']:0;
            if($baseVersion!==$currentVersion&&$resolution!=='browser'){
                $results[]=['id'=>$id,'status'=>'conflict','server'=>$current?tracky_sync_record($current):null];
                continue;
            }
            $nextVersion=$currentVersion+1;
            if($operation==='delete'){
                if($current){
                    $q=$db->prepare("UPDATE participants SET name='Deleted participant',profile_json='{}',profile_ciphertext=NULL,
                      consent=0,version=?,client_updated_at=?,server_updated_at=?,deleted_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
                    $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
                    $q->execute([$nextVersion,$clientAt,$now,$now,$actor['id'],$id]);
                }else{
                    $q=$db->prepare("INSERT INTO participants(id,name,profile_json,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                      VALUES(?,'Deleted participant','{}',NULL,0,1,?,?,?,?,?)");
                    $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
                    $q->execute([$id,$clientAt,$now,$now,$actor['id']]);
                    $nextVersion=1;
                }
            }else{
                $name=trim((string)($change['name']??''));$profile=$change['profile']??null;
                if(strlen($name)<1||strlen($name)>120||!is_array($profile))
                    throw new InvalidArgumentException('Invalid participant profile.');
                $consent=!empty($change['consent']);
                if(tracky_sync_has_biometrics($profile)&&!$consent)
                    throw new InvalidArgumentException('Explicit participant consent required for biometric synchronization.');
                $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
                $cipher=tracky_encrypt(json_encode($profile,JSON_THROW_ON_ERROR));
                $q=$db->prepare("INSERT INTO participants(id,name,profile_json,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                  VALUES(?,?,'{}',?,?,1,?,?,NULL,?)
                  ON CONFLICT(id) DO UPDATE SET name=excluded.name,profile_json='{}',profile_ciphertext=excluded.profile_ciphertext,
                   consent=excluded.consent,version=?,client_updated_at=excluded.client_updated_at,server_updated_at=excluded.server_updated_at,
                   deleted_at=NULL,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP");
                $q->execute([$id,$name,$cipher,$consent?1:0,$clientAt,$now,$actor['id'],$nextVersion]);
            }
            $saved=tracky_sync_select($db,$id);
            $action=$resolution==='browser'?'participant.sync.resolve-browser':'participant.sync.'.$operation;
            $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
              ->execute([$actor['id'],$action,$id]);
            $results[]=['id'=>$id,'status'=>'applied','record'=>tracky_sync_record($saved)];
        }catch(Throwable $e){
            $results[]=['id'=>isset($id)?$id:null,'status'=>'rejected','error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()];
        }
    }
    tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'results'=>$results]);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)http_response_code($e instanceof PDOException?409:400);
    tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],http_response_code());
}
