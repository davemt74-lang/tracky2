<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TRACKY_METADATA_SCOPES=['memory','task','scene'];
const TRACKY_METADATA_QUOTAS=['memory'=>200,'task'=>200,'scene'=>4];
const TRACKY_METADATA_MAX_BYTES=['memory'=>12000,'task'=>12000,'scene'=>64000];

function tracky_metadata_scope(mixed $value): string {
    $scope=(string)$value;
    if(!in_array($scope,TRACKY_METADATA_SCOPES,true))throw new InvalidArgumentException('Invalid metadata sync scope.');
    return $scope;
}
function tracky_metadata_id(mixed $value): string {
    $id=(string)$value;
    if(strlen($id)<1||strlen($id)>96||!preg_match('/^[A-Za-z0-9_.:-]+$/D',$id))
        throw new InvalidArgumentException('Invalid metadata resource ID.');
    return $id;
}
function tracky_metadata_device_id(mixed $value): string {
    $id=(string)$value;
    if(strlen($id)<8||strlen($id)>96||!preg_match('/^[A-Za-z0-9_-]+$/D',$id))
        throw new InvalidArgumentException('Invalid sync device ID.');
    return $id;
}
function tracky_metadata_text(mixed $value,int $max): string {
    $text=trim(preg_replace('/\s+/u',' ',(string)$value)??'');
    return substr($text,0,$max);
}
function tracky_metadata_num(mixed $value): ?float {
    return is_numeric($value)?(float)$value:null;
}
function tracky_metadata_int(mixed $value): ?int {
    return is_numeric($value)?(int)$value:null;
}
function tracky_metadata_source_refs(mixed $input): array {
    $out=[];
    foreach(is_array($input)?array_slice($input,0,5):[] as $ref){
        if(!is_array($ref))continue;
        $kind=tracky_metadata_text($ref['kind']??'',32);
        $id=tracky_metadata_text($ref['sourceId']??'',96);
        if($kind===''||$id==='')continue;
        $out[]=[
          'kind'=>$kind,'sourceId'=>$id,
          'meetingId'=>($v=tracky_metadata_text($ref['meetingId']??'',96))!==''?$v:null,
          'participantId'=>($v=tracky_metadata_text($ref['participantId']??'',96))!==''?$v:null,
          'at'=>tracky_metadata_int($ref['at']??null),
          'fingerprint'=>($v=tracky_metadata_text($ref['fingerprint']??'',96))!==''?$v:null
        ];
    }
    return $out;
}
function tracky_metadata_memory(array $p,string $id): array {
    if(($p['authority']??'')!=='owner'||!in_array($p['provenance']??'',['owner-authored','owner-approved-proposal'],true))
        throw new InvalidArgumentException('Only owner-authorized memory can synchronize.');
    if((string)($p['id']??'')!==$id)throw new InvalidArgumentException('Memory ID mismatch.');
    $text=tracky_metadata_text($p['text']??'',500);
    if($text==='')throw new InvalidArgumentException('Memory text required.');
    $type=in_array($p['type']??'', ['preference','relationship','note'],true)?$p['type']:'note';
    $revisions=[];
    foreach(is_array($p['revisions']??null)?array_slice($p['revisions'],-20):[] as $row){
        if(!is_array($row))continue;$t=tracky_metadata_text($row['text']??'',500);if($t==='')continue;
        $revisions[]=['text'=>$t,'at'=>tracky_metadata_int($row['at']??null)??0];
    }
    $provenance=(string)$p['provenance'];
    return [
      'schema'=>(int)($p['schema']??1)>=2?2:1,'id'=>$id,'type'=>$type,
      'participantId'=>($v=tracky_metadata_text($p['participantId']??'',96))!==''?$v:null,
      'text'=>$text,'authority'=>'owner','provenance'=>$provenance,
      'sourceRefs'=>$provenance==='owner-approved-proposal'?tracky_metadata_source_refs($p['sourceRefs']??[]):[],
      'approvedAt'=>tracky_metadata_int($p['approvedAt']??null),
      'proposalMethod'=>($v=tracky_metadata_text($p['proposalMethod']??'',64))!==''?$v:null,
      'createdAt'=>tracky_metadata_int($p['createdAt']??null)??0,
      'updatedAt'=>tracky_metadata_int($p['updatedAt']??null)??0,
      'expiresAt'=>tracky_metadata_int($p['expiresAt']??null),
      'status'=>($p['status']??'')==='revoked'?'revoked':'active',
      'revokedAt'=>tracky_metadata_int($p['revokedAt']??null),
      'revokeReason'=>tracky_metadata_text($p['revokeReason']??'',160),
      'revisions'=>$revisions,'persistent'=>true
    ];
}
function tracky_metadata_task(array $p,string $id): array {
    if((string)($p['id']??'')!==$id)throw new InvalidArgumentException('Task ID mismatch.');
    $skill=(string)($p['skillId']??'');
    if(!in_array($skill,['describe_object','capture_image','product_search'],true))
        throw new InvalidArgumentException('Unsupported task skill.');
    $statuses=['pending-confirmation','scheduled','running','succeeded','failed','cancelled'];
    $sources=[];
    foreach(is_array($p['resultSources']??null)?array_slice($p['resultSources'],0,5):[] as $row){
        if(!is_array($row))continue;$url=tracky_metadata_text($row['url']??'',700);
        if(!str_starts_with(strtolower($url),'https://'))continue;
        $sources[]=['title'=>tracky_metadata_text($row['title']??'',160),'url'=>$url];
    }
    $prov=null;
    if(is_array($p['executionProvenance']??null)){
        $allowed=['contract','skillId','skillVersion','sideEffect','targetId','targetSource','outcome','executedAt',
          'authorization','provider','model','resultCount','mediaBytes','mediaWidth','mediaHeight'];
        $prov=[];
        foreach($allowed as $key)if(isset($p['executionProvenance'][$key])&&
          (is_string($p['executionProvenance'][$key])||is_numeric($p['executionProvenance'][$key])))
          $prov[$key]=$p['executionProvenance'][$key];
    }
    return [
      'schema'=>(int)($p['schema']??1)>=2?2:1,'id'=>$id,'skillId'=>$skill,
      'targetId'=>tracky_metadata_text($p['targetId']??'',96),
      'targetSource'=>($p['targetSource']??'')==='server-approved'?'server-approved':'local-owner-defined',
      'idempotencyKey'=>tracky_metadata_text($p['idempotencyKey']??'',180),
      'status'=>in_array($p['status']??'',$statuses,true)?$p['status']:'failed',
      'runAt'=>tracky_metadata_int($p['runAt']??null)??0,'createdAt'=>tracky_metadata_int($p['createdAt']??null)??0,
      'updatedAt'=>tracky_metadata_int($p['updatedAt']??null)??0,'confirmedAt'=>tracky_metadata_int($p['confirmedAt']??null),
      'startedAt'=>tracky_metadata_int($p['startedAt']??null),'completedAt'=>tracky_metadata_int($p['completedAt']??null),
      'attempts'=>max(0,min(5,(int)($p['attempts']??0))),'maxAttempts'=>max(1,min(5,(int)($p['maxAttempts']??2))),
      'resultText'=>tracky_metadata_text($p['resultText']??'',900),'resultSources'=>$sources,
      'executionProvenance'=>$prov,'errorText'=>tracky_metadata_text($p['errorText']??'',240),
      'relatedEventId'=>($v=tracky_metadata_text($p['relatedEventId']??'',96))!==''?$v:null
    ];
}
function tracky_metadata_rect(mixed $input): ?array {
    if(!is_array($input))return null;
    foreach(['x','y','width','height'] as $key)if(!is_numeric($input[$key]??null))return null;
    $x=(float)$input['x'];$y=(float)$input['y'];$w=(float)$input['width'];$h=(float)$input['height'];
    if($x<0||$y<0||$w<.025||$h<.025||$x+$w>1.000001||$y+$h>1.000001)return null;
    return ['x'=>$x,'y'=>$y,'width'=>$w,'height'=>$h];
}
function tracky_metadata_calibration(mixed $input): ?array {
    if($input===null)return null;
    if(!is_array($input)||($input['mode']??'')!=='floor-plane')throw new InvalidArgumentException('Invalid floor calibration.');
    $width=tracky_metadata_num($input['widthM']??null);$depth=tracky_metadata_num($input['depthM']??null);
    if($width===null||$depth===null||$width<.5||$depth<.5||$width>50||$depth>50)
        throw new InvalidArgumentException('Invalid floor calibration dimensions.');
    $points=[];
    foreach(['nearLeft','nearRight','farRight','farLeft'] as $key){
        $point=$input['points'][$key]??null;
        if(!is_array($point)||!is_numeric($point['x']??null)||!is_numeric($point['y']??null))
            throw new InvalidArgumentException('Invalid floor calibration point.');
        $x=(float)$point['x'];$y=(float)$point['y'];
        if($x<0||$x>1||$y<0||$y>1)throw new InvalidArgumentException('Invalid floor calibration point.');
        $points[$key]=['x'=>$x,'y'=>$y];
    }
    $listener=null;
    if(isset($input['listener'])&&$input['listener']!==null){
        $x=tracky_metadata_num($input['listener']['xM']??null);$d=tracky_metadata_num($input['listener']['depthM']??null);
        if($x===null||$d===null||$x<0||$d<0||$x>$width||$d>$depth)
            throw new InvalidArgumentException('Invalid listener calibration.');
        $listener=['xM'=>$x,'depthM'=>$d];
    }
    return ['schema'=>1,'mode'=>'floor-plane','provenance'=>'owner-defined-floor-plane','units'=>'meters',
      'widthM'=>$width,'depthM'=>$depth,'points'=>$points,'listener'=>$listener,
      'updatedAt'=>tracky_metadata_int($input['updatedAt']??null)??0];
}
function tracky_metadata_scene(array $p,string $id): array {
    if($id!=='local-room')throw new InvalidArgumentException('Only local-room scene configuration may synchronize.');
    $areas=[];$areaIds=[];
    foreach(is_array($p['areas']??null)?array_slice($p['areas'],0,16):[] as $row){
        if(!is_array($row))continue;$rid=tracky_metadata_text($row['id']??'',96);
        $name=tracky_metadata_text($row['name']??'',64);$rect=tracky_metadata_rect($row['rect']??null);
        if($rid===''||$name===''||$rect===null||isset($areaIds[$rid]))continue;
        $areaIds[$rid]=true;$kind=in_array($row['kind']??'', ['zone','entrance','desk','seat','other'],true)?$row['kind']:'zone';
        $areas[]=['id'=>$rid,'name'=>$name,'kind'=>$kind,'rect'=>$rect,'provenance'=>'owner-defined'];
    }
    $objects=[];$seen=[];
    foreach(is_array($p['objects']??null)?array_slice($p['objects'],0,32):[] as $row){
        if(!is_array($row))continue;$rid=tracky_metadata_text($row['id']??'',96);$name=tracky_metadata_text($row['name']??'',64);
        if($rid===''||$name===''||isset($seen[$rid]))continue;$seen[$rid]=true;
        $kind=in_array($row['kind']??'',['furniture','device','other'],true)?$row['kind']:'other';
        $skills=array_values(array_unique(array_intersect(is_array($row['skills']??null)?$row['skills']:[],
          ['describe_object','capture_image','product_search'])));
        $area=tracky_metadata_text($row['areaId']??'',96);
        $objects[]=['id'=>$rid,'name'=>$name,'kind'=>$kind,'areaId'=>isset($areaIds[$area])?$area:null,
          'skills'=>array_slice($skills,0,3),'provenance'=>'owner-defined'];
    }
    return ['version'=>max(1,min(20,(int)($p['version']??1))),'id'=>'local-room',
      'roomIdentityId'=>($v=tracky_metadata_text($p['roomIdentityId']??'',96))!==''?$v:'room-local',
      'roomName'=>($v=tracky_metadata_text($p['roomName']??'',96))!==''?$v:'Local room',
      'areas'=>$areas,'objects'=>$objects,'calibration'=>tracky_metadata_calibration($p['calibration']??null)];
}
function tracky_metadata_payload(string $scope,mixed $input,string $id): array {
    if(!is_array($input))throw new InvalidArgumentException('Metadata payload must be an object.');
    return match($scope){
      'memory'=>tracky_metadata_memory($input,$id),
      'task'=>tracky_metadata_task($input,$id),
      'scene'=>tracky_metadata_scene($input,$id)
    };
}
function tracky_metadata_select(PDO $db,string $scope,string $id): ?array {
    $s=$db->prepare('SELECT scope,resource_id,payload_ciphertext,version,client_updated_at,server_updated_at,deleted_at,device_id FROM metadata_sync_resources WHERE scope=? AND resource_id=?');
    $s->execute([$scope,$id]);$row=$s->fetch();return $row?:null;
}
function tracky_metadata_record(array $row): array {
    $deleted=$row['deleted_at']!==null;$payload=null;
    if(!$deleted&&!empty($row['payload_ciphertext'])){
        $decoded=json_decode(tracky_decrypt((string)$row['payload_ciphertext']),true,64,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))throw new RuntimeException('Stored metadata payload is invalid.');
        $payload=$decoded;
    }
    return ['scope'=>(string)$row['scope'],'id'=>(string)$row['resource_id'],'payload'=>$payload,
      'version'=>(int)$row['version'],'clientUpdatedAt'=>$row['client_updated_at']===null?null:(int)$row['client_updated_at'],
      'serverUpdatedAt'=>(int)$row['server_updated_at'],'deleted'=>$deleted,
      'deletedAt'=>$deleted?(int)$row['deleted_at']:null,'deviceId'=>$row['device_id']?:null];
}
function tracky_metadata_device(PDO $db,string $id): array {
    $s=$db->prepare('SELECT id,label,created_at,last_seen_at,revoked_at FROM sync_devices WHERE id=?');$s->execute([$id]);
    $row=$s->fetch();if(!$row)throw new RuntimeException('Sync device is not authorized.');
    if($row['revoked_at']!==null)throw new RuntimeException('Sync device has been revoked.');
    return $row;
}
function tracky_metadata_touch_device(PDO $db,string $id,int $now): void {
    tracky_metadata_device($db,$id);
    $db->prepare('UPDATE sync_devices SET last_seen_at=? WHERE id=?')->execute([$now,$id]);
}
function tracky_metadata_quota(PDO $db,string $scope,bool $newActive): void {
    if(!$newActive)return;
    $s=$db->prepare('SELECT COUNT(*) FROM metadata_sync_resources WHERE scope=? AND deleted_at IS NULL');
    $s->execute([$scope]);
    if((int)$s->fetchColumn()>=TRACKY_METADATA_QUOTAS[$scope])throw new RuntimeException('Metadata sync quota reached for '.$scope.'.');
}

try{
    $db=tracky_db();
    if((int)($_SERVER['CONTENT_LENGTH']??0)>3_000_000)tracky_reply(['error'=>'Request too large'],413);
    $actor=tracky_require($db,'sync.manage');$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        $rows=$db->query('SELECT scope,resource_id,payload_ciphertext,version,client_updated_at,server_updated_at,deleted_at,device_id FROM metadata_sync_resources ORDER BY scope,server_updated_at,resource_id')->fetchAll();
        $devices=$db->query('SELECT id,label,created_at,last_seen_at,revoked_at FROM sync_devices ORDER BY created_at,id')->fetchAll();
        tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'records'=>array_map('tracky_metadata_record',$rows),'devices'=>$devices,
          'quotas'=>TRACKY_METADATA_QUOTAS]);
    }
    if($method!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    tracky_check_csrf();$data=tracky_json();$action=(string)($data['action']??'sync');$now=(int)floor(microtime(true)*1000);
    if($action==='register-device'){
        $id=tracky_metadata_device_id($data['deviceId']??'');$label=tracky_metadata_text($data['label']??'',80);
        if($label==='')throw new InvalidArgumentException('Device label required.');
        $existing=$db->prepare('SELECT revoked_at FROM sync_devices WHERE id=?');$existing->execute([$id]);$revoked=$existing->fetchColumn();
        if($revoked!==false&&$revoked!==null)throw new RuntimeException('A revoked device ID cannot be re-authorized.');
        $db->prepare('INSERT INTO sync_devices(id,label,created_by,created_at,last_seen_at,revoked_at) VALUES(?,?,?,?,?,NULL)
          ON CONFLICT(id) DO UPDATE SET label=excluded.label,last_seen_at=excluded.last_seen_at')
          ->execute([$id,$label,$actor['id'],$now,$now]);
        $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
          ->execute([$actor['id'],'metadata.sync.device-register',$id]);
        tracky_reply(['status'=>'registered','deviceId'=>$id]);
    }
    if($action==='revoke-device'){
        $id=tracky_metadata_device_id($data['deviceId']??'');
        $db->prepare('UPDATE sync_devices SET revoked_at=? WHERE id=? AND revoked_at IS NULL')->execute([$now,$id]);
        $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
          ->execute([$actor['id'],'metadata.sync.device-revoke',$id]);
        tracky_reply(['status'=>'revoked','deviceId'=>$id]);
    }
    if($action!=='sync')throw new InvalidArgumentException('Invalid metadata sync action.');
    $deviceId=tracky_metadata_device_id($data['deviceId']??'');tracky_metadata_touch_device($db,$deviceId,$now);
    $changes=$data['changes']??null;
    if(!is_array($changes)||count($changes)>50)tracky_reply(['error'=>'changes must contain at most 50 records'],422);
    $results=[];
    foreach($changes as $change){
        $scope=null;$id=null;
        if(!is_array($change)){ $results[]=['status'=>'rejected','error'=>'Invalid change'];continue; }
        try{
            $scope=tracky_metadata_scope($change['scope']??'');$id=tracky_metadata_id($change['id']??'');
            $operation=(string)($change['operation']??'');
            if(!in_array($operation,['upsert','delete'],true))throw new InvalidArgumentException('Invalid sync operation.');
            $baseVersion=filter_var($change['baseVersion']??null,FILTER_VALIDATE_INT);
            if($baseVersion===false||$baseVersion<0)throw new InvalidArgumentException('Invalid base version.');
            $resolution=(string)($change['resolution']??'');
            if($resolution!==''&&$resolution!=='browser')throw new InvalidArgumentException('Invalid conflict resolution.');
            $current=tracky_metadata_select($db,$scope,$id);$currentVersion=$current?(int)$current['version']:0;
            if($baseVersion!==$currentVersion){
                $results[]=['scope'=>$scope,'id'=>$id,'status'=>'conflict',
                  'server'=>$current?tracky_metadata_record($current):null];continue;
            }
            $nextVersion=$currentVersion+1;
            $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
            if($operation==='delete'){
                if($current){
                    $db->prepare('UPDATE metadata_sync_resources SET payload_ciphertext=NULL,version=?,client_updated_at=?,server_updated_at=?,deleted_at=?,updated_by=?,device_id=? WHERE scope=? AND resource_id=?')
                      ->execute([$nextVersion,$clientAt,$now,$now,$actor['id'],$deviceId,$scope,$id]);
                }else{
                    $db->prepare('INSERT INTO metadata_sync_resources(scope,resource_id,payload_ciphertext,version,client_updated_at,server_updated_at,deleted_at,updated_by,device_id) VALUES(?,?,NULL,1,?,?,?,?,?)')
                      ->execute([$scope,$id,$clientAt,$now,$now,$actor['id'],$deviceId]);$nextVersion=1;
                }
            }else{
                $payload=tracky_metadata_payload($scope,$change['payload']??null,$id);
                $json=json_encode($payload,JSON_THROW_ON_ERROR);
                if(strlen($json)>TRACKY_METADATA_MAX_BYTES[$scope])throw new InvalidArgumentException('Metadata payload exceeds scope limit.');
                tracky_metadata_quota($db,$scope,!$current||$current['deleted_at']!==null);
                $cipher=tracky_encrypt($json);
                $db->prepare('INSERT INTO metadata_sync_resources(scope,resource_id,payload_ciphertext,version,client_updated_at,server_updated_at,deleted_at,updated_by,device_id)
                  VALUES(?,?,?,1,?,?,NULL,?,?)
                  ON CONFLICT(scope,resource_id) DO UPDATE SET payload_ciphertext=excluded.payload_ciphertext,version=?,client_updated_at=excluded.client_updated_at,
                   server_updated_at=excluded.server_updated_at,deleted_at=NULL,updated_by=excluded.updated_by,device_id=excluded.device_id')
                  ->execute([$scope,$id,$cipher,$clientAt,$now,$actor['id'],$deviceId,$nextVersion]);
            }
            $saved=tracky_metadata_select($db,$scope,$id);
            $auditAction=$resolution==='browser'?'metadata.sync.resolve-browser':'metadata.sync.'.$operation;
            $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
              ->execute([$actor['id'],$auditAction,$scope.'/'.$id]);
            $results[]=['scope'=>$scope,'id'=>$id,'status'=>'applied','record'=>tracky_metadata_record($saved)];
        }catch(Throwable $e){
            $results[]=['scope'=>$scope,'id'=>$id,'status'=>'rejected',
              'error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()];
        }
    }
    tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'results'=>$results]);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)http_response_code($e instanceof PDOException?409:400);
    tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],http_response_code());
}
