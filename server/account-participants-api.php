<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_account_participant_id(mixed $value): string {
    $id=(string)$value;
    if(!preg_match('/^[A-Za-z0-9_-]{8,96}$/D',$id))throw new InvalidArgumentException('Invalid participant ID.');
    return $id;
}
function tracky_account_participant_select(PDO $db,string $id): ?array {
    $q=$db->prepare('SELECT id,name,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at FROM participants WHERE id=?');
    $q->execute([$id]);$row=$q->fetch();return $row?:null;
}
function tracky_account_participant_record(array $row): array {
    $deleted=$row['deleted_at']!==null;$profile=null;
    if(!$deleted&&!empty($row['profile_ciphertext'])){
        $decoded=json_decode(tracky_decrypt((string)$row['profile_ciphertext']),true,32,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))throw new RuntimeException('Stored participant profile is invalid.');
        $profile=$decoded;
    }
    return [
      'id'=>(string)$row['id'],'name'=>$deleted?null:(string)$row['name'],
      'profile'=>$profile,'biometricConsent'=>(bool)$row['consent'],
      'version'=>(int)$row['version'],
      'clientUpdatedAt'=>$row['client_updated_at']===null?null:(int)$row['client_updated_at'],
      'serverUpdatedAt'=>(int)$row['server_updated_at'],
      'deleted'=>$deleted,'deletedAt'=>$deleted?(int)$row['deleted_at']:null
    ];
}
function tracky_account_profile_has_biometrics(array $profile): bool {
    foreach(['primaryPhoto','latestPhoto','embeddings','faceSamples','voiceEmbeddings',
      'voiceProfileSamples','voiceProfileReady','voiceUpdatedAt'] as $key){
        $value=$profile[$key]??null;
        if(is_array($value)?count($value)>0:!empty($value))return true;
    }
    return false;
}
function tracky_account_validate_profile(array $profile,bool $biometricConsent): array {
    $allowed=['nickname','notes','recognitionEnabled','agentGreetingEnabled','agentProactiveEnabled',
      'voiceRecognitionEnabled','createdAt','updatedAt','lastSeenAt','gamesPlayed',
      'primaryPhoto','latestPhoto','embeddings','faceSamples','voiceEmbeddings',
      'voiceProfileSamples','voiceProfileReady','voiceUpdatedAt'];
    foreach(array_keys($profile) as $key)
        if(!in_array((string)$key,$allowed,true))throw new InvalidArgumentException('Participant profile contains an unsupported field.');
    $profile['nickname']=substr(trim((string)($profile['nickname']??'')),0,80);
    $profile['notes']=substr(trim((string)($profile['notes']??'')),0,500);
    if(!$biometricConsent&&tracky_account_profile_has_biometrics($profile))
        throw new InvalidArgumentException('Explicit participant consent is required for cross-device biometric synchronization.');
    $json=json_encode($profile,JSON_THROW_ON_ERROR);
    if(strlen($json)>3_000_000)throw new InvalidArgumentException('Participant profile exceeds the encrypted account storage limit.');
    return [$profile,$json];
}

try{
    $db=tracky_db();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        tracky_require($db,'participants.read');
        $rows=$db->query('SELECT id,name,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at FROM participants ORDER BY server_updated_at,id')->fetchAll();
        tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'records'=>array_map('tracky_account_participant_record',$rows)]);
    }
    if($method!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>3_500_000)tracky_reply(['error'=>'Request too large'],413);
    $actor=tracky_require($db,'participants.write');tracky_check_csrf();
    $data=tracky_json();$changes=$data['changes']??null;
    if(!is_array($changes)||count($changes)>25)tracky_reply(['error'=>'changes must contain at most 25 records'],422);
    $results=[];$now=(int)floor(microtime(true)*1000);

    foreach($changes as $change){
        $id=null;$locked=false;
        try{
            if(!is_array($change))throw new InvalidArgumentException('Invalid participant change.');
            $id=tracky_account_participant_id($change['id']??'');
            $operation=(string)($change['operation']??'');
            if(!in_array($operation,['upsert','delete'],true))throw new InvalidArgumentException('Invalid participant operation.');
            $baseVersion=filter_var($change['baseVersion']??null,FILTER_VALIDATE_INT);
            if($baseVersion===false||$baseVersion<0)throw new InvalidArgumentException('Invalid participant base version.');
            $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
            $name='';$cipher=null;$consent=false;
            if($operation==='upsert'){
                $name=trim((string)($change['name']??''));
                if($name===''||strlen($name)>80)throw new InvalidArgumentException('Participant name is required.');
                $consent=($change['biometricConsent']??false)===true;
                $profile=$change['profile']??null;
                if(!is_array($profile))throw new InvalidArgumentException('Participant profile is required.');
                [, $json]=tracky_account_validate_profile($profile,$consent);
                $cipher=tracky_encrypt($json);
            }

            $db->exec('BEGIN IMMEDIATE');$locked=true;
            // Permission/session can change while the client is preparing the write.
            $actor=tracky_require($db,'participants.write');
            $current=tracky_account_participant_select($db,$id);
            $currentVersion=$current?(int)$current['version']:0;
            if($baseVersion!==$currentVersion){
                $server=$current?tracky_account_participant_record($current):null;
                $db->exec('ROLLBACK');$locked=false;
                $results[]=['id'=>$id,'status'=>'conflict','server'=>$server];continue;
            }
            $nextVersion=$currentVersion+1;
            if($operation==='delete'){
                if($current){
                    $q=$db->prepare("UPDATE participants SET name='Deleted participant',profile_json='{}',profile_ciphertext=NULL,
                      consent=0,version=?,client_updated_at=?,server_updated_at=?,deleted_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
                    $q->execute([$nextVersion,$clientAt,$now,$now,$actor['id'],$id]);
                }else{
                    $q=$db->prepare("INSERT INTO participants(id,name,profile_json,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                      VALUES(?,'Deleted participant','{}',NULL,0,1,?,?,?,?)");
                    $q->execute([$id,$clientAt,$now,$now,$actor['id']]);$nextVersion=1;
                }
            }else{
                $q=$db->prepare("INSERT INTO participants(id,name,profile_json,profile_ciphertext,consent,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                  VALUES(?,?,'{}',?,?,1,?,?,NULL,?)
                  ON CONFLICT(id) DO UPDATE SET name=excluded.name,profile_json='{}',profile_ciphertext=excluded.profile_ciphertext,
                    consent=excluded.consent,version=?,client_updated_at=excluded.client_updated_at,server_updated_at=excluded.server_updated_at,
                    deleted_at=NULL,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP");
                $q->execute([$id,$name,$cipher,$consent?1:0,$clientAt,$now,$actor['id'],$nextVersion]);
            }
            $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
              ->execute([$actor['id'],'participant.account.'.$operation,$id]);
            $db->exec('COMMIT');$locked=false;
            $saved=tracky_account_participant_select($db,$id);
            $results[]=['id'=>$id,'status'=>'applied','record'=>tracky_account_participant_record($saved)];
        }catch(Throwable $e){
            if($locked){try{$db->exec('ROLLBACK');}catch(Throwable){}}
            $results[]=['id'=>$id,'status'=>'rejected','error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()];
        }
    }
    tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'results'=>$results]);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=$e instanceof PDOException?409:400;
    tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],$status);
}
