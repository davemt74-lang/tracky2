<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TRACKY_SYNC_V2_TYPES=['memory','task','scene'];
const TRACKY_SYNC_V2_MAX_CHANGES=50;
const TRACKY_SYNC_V2_MAX_EVENTS=200;
const TRACKY_SYNC_V2_MAX_JOURNAL=1000;
const TRACKY_SYNC_V2_MAX_RECEIPTS=500;

function tracky_sync_v2_quota(string $type): int {
    return match($type){'memory'=>262144,'task'=>262144,'scene'=>65536,default=>0};
}
function tracky_sync_v2_item_limit(string $type): int {
    return match($type){'memory'=>12288,'task'=>24576,'scene'=>65536,default=>0};
}
function tracky_sync_v2_count_limit(string $type): int {
    return match($type){'memory'=>200,'task'=>200,'scene'=>1,default=>0};
}
function tracky_sync_v2_type(mixed $value): string {
    $type=(string)$value;
    if(!in_array($type,TRACKY_SYNC_V2_TYPES,true))throw new InvalidArgumentException('Invalid resource type.');
    return $type;
}
function tracky_sync_v2_device_id(mixed $value): string {
    $id=(string)$value;
    if(!preg_match('/^[A-Za-z0-9_-]{8,96}$/D',$id))throw new InvalidArgumentException('Invalid sync device ID.');
    return $id;
}
function tracky_sync_v2_resource_id(mixed $value): string {
    $id=(string)$value;
    if(!preg_match('/^[A-Za-z0-9._:-]{1,96}$/D',$id))throw new InvalidArgumentException('Invalid sync resource ID.');
    return $id;
}
function tracky_sync_v2_change_id(mixed $value): string {
    $id=(string)$value;
    if(!preg_match('/^[A-Za-z0-9_-]{8,96}$/D',$id))throw new InvalidArgumentException('Invalid sync change ID.');
    return $id;
}
function tracky_sync_v2_device(PDO $db,string $id): ?array {
    $q=$db->prepare('SELECT id,label,enabled,revoked_at,last_seen_at FROM sync_devices WHERE id=?');
    $q->execute([$id]);$row=$q->fetch();return $row?:null;
}
function tracky_sync_v2_scope_rows(PDO $db,string $deviceId): array {
    $q=$db->prepare('SELECT resource_type,enabled,quota_bytes,updated_at FROM sync_device_scopes WHERE device_id=? ORDER BY resource_type');
    $q->execute([$deviceId]);return $q->fetchAll();
}
function tracky_sync_v2_require_device(PDO $db,string $id): array {
    $row=tracky_sync_v2_device($db,$id);
    if(!$row||!(bool)$row['enabled']||$row['revoked_at']!==null)
        throw new RuntimeException('This sync device has been revoked or is not registered.');
    return $row;
}
function tracky_sync_v2_scope(PDO $db,string $deviceId,string $type): array {
    $q=$db->prepare('SELECT resource_type,enabled,quota_bytes,updated_at FROM sync_device_scopes WHERE device_id=? AND resource_type=?');
    $q->execute([$deviceId,$type]);$row=$q->fetch();
    if(!$row||!(bool)$row['enabled'])throw new RuntimeException('This resource type is not enabled for the sync device.');
    return $row;
}
function tracky_sync_v2_select(PDO $db,string $type,string $id): ?array {
    $q=$db->prepare('SELECT resource_type,resource_id,payload_ciphertext,payload_bytes,version,client_updated_at,server_updated_at,deleted_at FROM sync_resources WHERE resource_type=? AND resource_id=?');
    $q->execute([$type,$id]);$row=$q->fetch();return $row?:null;
}
function tracky_sync_v2_record(array $row): array {
    $deleted=$row['deleted_at']!==null;$payload=null;
    if(!$deleted&&is_string($row['payload_ciphertext'])&&$row['payload_ciphertext']!==''){
        $decoded=json_decode(tracky_decrypt($row['payload_ciphertext']),true,32,JSON_THROW_ON_ERROR);
        if(!is_array($decoded))throw new RuntimeException('Stored sync resource payload is invalid.');
        $payload=$decoded;
    }
    return [
      'resourceType'=>(string)$row['resource_type'],'id'=>(string)$row['resource_id'],
      'payload'=>$payload,'version'=>(int)$row['version'],
      'clientUpdatedAt'=>$row['client_updated_at']===null?null:(int)$row['client_updated_at'],
      'serverUpdatedAt'=>(int)$row['server_updated_at'],
      'deleted'=>$deleted,'deletedAt'=>$deleted?(int)$row['deleted_at']:null,
      'payloadBytes'=>(int)$row['payload_bytes']
    ];
}
function tracky_sync_v2_forbidden_payload_keys(mixed $value,int $depth=0): void {
    if($depth>12)throw new InvalidArgumentException('Sync payload is too deeply nested.');
    if(!is_array($value))return;
    $blocked=['rawaudio','recordingmedia','recordingchunks','transcript','transcripttext','embeddings',
      'embedding','primaryphoto','latestphoto','facesamples','voicesamples','voiceembeddings',
      'faceembeddings','ciphertext','apikey','secret','prompt','imagebase64','audiobase64','blob'];
    foreach($value as $key=>$child){
        if(is_string($key)&&in_array(strtolower($key),$blocked,true))
            throw new InvalidArgumentException('Sync payload contains a forbidden field.');
        tracky_sync_v2_forbidden_payload_keys($child,$depth+1);
    }
}
function tracky_sync_v2_validate_payload(string $type,string $id,mixed $payload): array {
    if(!is_array($payload))throw new InvalidArgumentException('Sync payload must be an object.');
    tracky_sync_v2_forbidden_payload_keys($payload);
    if((string)($payload['id']??'')!==$id)throw new InvalidArgumentException('Sync payload ID mismatch.');
    if($type==='memory'){
        if(($payload['authority']??'')!=='owner'||empty($payload['persistent']))
            throw new InvalidArgumentException('Only owner-authorized durable memory may sync.');
        if(!in_array((string)($payload['type']??''),['preference','relationship','note'],true))
            throw new InvalidArgumentException('Invalid memory type.');
        if(!in_array((string)($payload['status']??''),['active','revoked'],true))
            throw new InvalidArgumentException('Invalid memory state.');
        $text=trim((string)($payload['text']??''));
        if($text===''||strlen($text)>2000)throw new InvalidArgumentException('Invalid memory text.');
    }elseif($type==='task'){
        if(!in_array((string)($payload['status']??''),['succeeded','failed','cancelled'],true)||!is_numeric($payload['confirmedAt']??null))
            throw new InvalidArgumentException('Only terminal owner-confirmed task metadata may sync.');
        if(!in_array((string)($payload['skillId']??''),['describe_object','capture_image','product_search'],true))
            throw new InvalidArgumentException('Invalid task skill.');
    }elseif($type==='scene'){
        if($id!=='local-room')throw new InvalidArgumentException('Only the canonical local scene configuration may sync.');
        if(!is_array($payload['areas']??null)||count($payload['areas'])>16||
           !is_array($payload['objects']??null)||count($payload['objects'])>32)
            throw new InvalidArgumentException('Scene configuration exceeds bounded limits.');
    }
    $json=json_encode($payload,JSON_THROW_ON_ERROR);
    if(strlen($json)>tracky_sync_v2_item_limit($type))
        throw new InvalidArgumentException('Sync resource exceeds its per-item size limit.');
    return [$payload,$json,strlen($json)];
}
function tracky_sync_v2_allowed_types(PDO $db,string $deviceId): array {
    $rows=tracky_sync_v2_scope_rows($db,$deviceId);$types=[];
    foreach($rows as $row)if((bool)$row['enabled'])$types[]=(string)$row['resource_type'];
    return $types;
}
function tracky_sync_v2_snapshot(PDO $db,array $types): array {
    if(!$types)return [];
    $marks=implode(',',array_fill(0,count($types),'?'));
    $q=$db->prepare("SELECT resource_type,resource_id,payload_ciphertext,payload_bytes,version,client_updated_at,server_updated_at,deleted_at FROM sync_resources WHERE resource_type IN ($marks) ORDER BY resource_type,resource_id LIMIT 500");
    $q->execute($types);return array_map('tracky_sync_v2_record',$q->fetchAll());
}
function tracky_sync_v2_prune(PDO $db): void {
    $db->exec('DELETE FROM sync_resource_changes WHERE seq NOT IN (SELECT seq FROM sync_resource_changes ORDER BY seq DESC LIMIT '.TRACKY_SYNC_V2_MAX_JOURNAL.')');
    $db->exec('DELETE FROM sync_change_receipts WHERE change_id NOT IN (SELECT change_id FROM sync_change_receipts ORDER BY created_at DESC LIMIT '.TRACKY_SYNC_V2_MAX_RECEIPTS.')');
}
function tracky_sync_v2_receipt(PDO $db,string $changeId): ?array {
    $q=$db->prepare('SELECT change_id,device_id,resource_type,resource_id,result_version,created_at FROM sync_change_receipts WHERE change_id=?');
    $q->execute([$changeId]);$row=$q->fetch();return $row?:null;
}

try{
    $db=tracky_db();$actor=tracky_require($db,'sync.manage');
    if((int)($_SERVER['CONTENT_LENGTH']??0)>1_000_000)tracky_reply(['error'=>'Request too large'],413);
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        $deviceId=tracky_sync_v2_device_id($_GET['deviceId']??'');
        tracky_sync_v2_require_device($db,$deviceId);
        $now=(int)floor(microtime(true)*1000);
        $db->prepare('UPDATE sync_devices SET last_seen_at=? WHERE id=?')->execute([$now,$deviceId]);
        $cursor=filter_var($_GET['cursor']??0,FILTER_VALIDATE_INT);
        if($cursor===false||$cursor<0)throw new InvalidArgumentException('Invalid sync cursor.');
        $types=tracky_sync_v2_allowed_types($db,$deviceId);
        $minSeq=(int)($db->query('SELECT COALESCE(MIN(seq),0) FROM sync_resource_changes')->fetchColumn()?:0);
        $maxSeq=(int)($db->query('SELECT COALESCE(MAX(seq),0) FROM sync_resource_changes')->fetchColumn()?:0);
        $resetRequired=$cursor>0&&$minSeq>0&&$cursor<($minSeq-1);
        $records=[];$events=[];$nextCursor=$cursor;$hasMore=false;
        if($cursor===0||$resetRequired){
            $records=tracky_sync_v2_snapshot($db,$types);$nextCursor=$maxSeq;
        }elseif($types){
            $marks=implode(',',array_fill(0,count($types),'?'));
            $q=$db->prepare("SELECT seq,resource_type,resource_id,version,deleted,server_updated_at FROM sync_resource_changes WHERE seq>? AND resource_type IN ($marks) ORDER BY seq LIMIT ".(TRACKY_SYNC_V2_MAX_EVENTS+1));
            $q->execute([$cursor,...$types]);$rows=$q->fetchAll();
            if(count($rows)>TRACKY_SYNC_V2_MAX_EVENTS){$hasMore=true;$rows=array_slice($rows,0,TRACKY_SYNC_V2_MAX_EVENTS);}
            foreach($rows as $row){
                $current=tracky_sync_v2_select($db,(string)$row['resource_type'],(string)$row['resource_id']);
                $events[]=[
                  'seq'=>(int)$row['seq'],'resourceType'=>(string)$row['resource_type'],
                  'resourceId'=>(string)$row['resource_id'],'version'=>(int)$row['version'],
                  'deleted'=>(bool)$row['deleted'],'serverUpdatedAt'=>(int)$row['server_updated_at'],
                  'record'=>$current?tracky_sync_v2_record($current):null
                ];
                $nextCursor=(int)$row['seq'];
            }
        }
        tracky_reply([
          'schemaVersion'=>TRACKY_SCHEMA_VERSION,'device'=>tracky_sync_v2_device($db,$deviceId),
          'scopes'=>tracky_sync_v2_scope_rows($db,$deviceId),'cursor'=>$nextCursor,
          'journalFloor'=>$minSeq,'resetRequired'=>$resetRequired,'hasMore'=>$hasMore,
          'records'=>$records,'events'=>$events
        ]);
    }
    if($method!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    tracky_check_csrf();$data=tracky_json();$action=(string)($data['action']??'');
    $now=(int)floor(microtime(true)*1000);
    if($action==='register-device'){
        $deviceId=tracky_sync_v2_device_id($data['deviceId']??'');
        $label=trim((string)($data['label']??'This browser'));
        if($label===''||strlen($label)>80)throw new InvalidArgumentException('Invalid device label.');
        $scopes=$data['scopes']??[];
        if(!is_array($scopes)||count($scopes)>3)throw new InvalidArgumentException('Invalid device scopes.');
        $enabled=[];
        foreach($scopes as $scope)$enabled[tracky_sync_v2_type($scope)]=true;
        $existing=tracky_sync_v2_device($db,$deviceId);
        if($existing&&(!(bool)$existing['enabled']||$existing['revoked_at']!==null))
            tracky_reply(['error'=>'This device ID was revoked. Restore it in Admin or register a different browser ID.'],409);
        $db->beginTransaction();
        try{
            $db->prepare("INSERT INTO sync_devices(id,label,enabled,created_by,revoked_at,last_seen_at) VALUES(?,?,1,?,NULL,?)
              ON CONFLICT(id) DO UPDATE SET label=excluded.label,last_seen_at=excluded.last_seen_at")
              ->execute([$deviceId,$label,$actor['id'],$now]);
            $scopeStmt=$db->prepare("INSERT INTO sync_device_scopes(device_id,resource_type,enabled,quota_bytes,updated_at)
              VALUES(?,?,?,?,?) ON CONFLICT(device_id,resource_type) DO UPDATE SET enabled=excluded.enabled,quota_bytes=excluded.quota_bytes,updated_at=excluded.updated_at");
            foreach(TRACKY_SYNC_V2_TYPES as $type)
                $scopeStmt->execute([$deviceId,$type,isset($enabled[$type])?1:0,tracky_sync_v2_quota($type),$now]);
            $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
              ->execute([$actor['id'],'resource-sync.device-register',$deviceId]);
            $db->commit();
        }catch(Throwable $e){$db->rollBack();throw $e;}
        tracky_reply(['device'=>tracky_sync_v2_device($db,$deviceId),'scopes'=>tracky_sync_v2_scope_rows($db,$deviceId)]);
    }
    if($action==='revoke-device'){
        $deviceId=tracky_sync_v2_device_id($data['deviceId']??'');
        $db->prepare('UPDATE sync_devices SET enabled=0,revoked_at=?,last_seen_at=? WHERE id=?')
          ->execute([$now,$now,$deviceId]);
        $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
          ->execute([$actor['id'],'resource-sync.device-revoke',$deviceId]);
        tracky_reply(['revoked'=>true,'deviceId'=>$deviceId]);
    }
    if($action!=='sync')tracky_reply(['error'=>'Invalid sync action'],422);
    $deviceId=tracky_sync_v2_device_id($data['deviceId']??'');
    tracky_sync_v2_require_device($db,$deviceId);
    $changes=$data['changes']??null;
    if(!is_array($changes)||count($changes)>TRACKY_SYNC_V2_MAX_CHANGES)
        tracky_reply(['error'=>'changes must contain at most '.TRACKY_SYNC_V2_MAX_CHANGES.' records'],422);
    $results=[];
    foreach($changes as $change){
        $changeId=null;$type=null;$resourceId=null;
        try{
            if(!is_array($change))throw new InvalidArgumentException('Invalid sync change.');
            $changeId=tracky_sync_v2_change_id($change['changeId']??'');
            $type=tracky_sync_v2_type($change['resourceType']??'');
            $resourceId=tracky_sync_v2_resource_id($change['resourceId']??'');
            $scope=tracky_sync_v2_scope($db,$deviceId,$type);
            $receipt=tracky_sync_v2_receipt($db,$changeId);
            if($receipt){
                if($receipt['device_id']!==$deviceId||$receipt['resource_type']!==$type||$receipt['resource_id']!==$resourceId)
                    throw new RuntimeException('Sync change ID was already used for another resource.');
                $current=tracky_sync_v2_select($db,$type,$resourceId);
                $results[]=['changeId'=>$changeId,'resourceType'=>$type,'resourceId'=>$resourceId,
                  'status'=>'applied','replayed'=>true,'record'=>$current?tracky_sync_v2_record($current):null];
                continue;
            }
            $operation=(string)($change['operation']??'');
            if(!in_array($operation,['upsert','delete'],true))throw new InvalidArgumentException('Invalid sync operation.');
            if($type==='scene'&&$operation==='delete')throw new InvalidArgumentException('Scene configuration cannot be deleted through metadata sync.');
            $baseVersion=filter_var($change['baseVersion']??null,FILTER_VALIDATE_INT);
            if($baseVersion===false||$baseVersion<0)throw new InvalidArgumentException('Invalid base version.');
            $resolution=(string)($change['resolution']??'');
            if($resolution!==''&&$resolution!=='browser')throw new InvalidArgumentException('Invalid conflict resolution.');
            $current=tracky_sync_v2_select($db,$type,$resourceId);$currentVersion=$current?(int)$current['version']:0;
            if($baseVersion!==$currentVersion){
                $results[]=['changeId'=>$changeId,'resourceType'=>$type,'resourceId'=>$resourceId,
                  'status'=>'conflict','server'=>$current?tracky_sync_v2_record($current):null];
                continue;
            }
            $clientAt=isset($change['clientUpdatedAt'])&&is_numeric($change['clientUpdatedAt'])?(int)$change['clientUpdatedAt']:$now;
            $nextVersion=$currentVersion+1;$deleted=$operation==='delete';$cipher=null;$bytes=0;
            if(!$deleted){
                [, $json,$bytes]=tracky_sync_v2_validate_payload($type,$resourceId,$change['payload']??null);
                if(!$current||$current['deleted_at']!==null){
                    $countQ=$db->prepare("SELECT COUNT(*) FROM sync_resources WHERE resource_type=? AND deleted_at IS NULL");
                    $countQ->execute([$type]);
                    if((int)$countQ->fetchColumn()>=tracky_sync_v2_count_limit($type))
                        throw new RuntimeException('Resource sync record-count quota exceeded for '.$type.'.');
                }
                $totalQ=$db->prepare("SELECT COALESCE(SUM(payload_bytes),0) FROM sync_resources WHERE resource_type=? AND deleted_at IS NULL");
                $totalQ->execute([$type]);$total=(int)$totalQ->fetchColumn();
                $oldBytes=$current&&$current['deleted_at']===null?(int)$current['payload_bytes']:0;
                if($total-$oldBytes+$bytes>(int)$scope['quota_bytes'])
                    throw new RuntimeException('Resource sync quota exceeded for '.$type.'.');
                $cipher=tracky_encrypt($json);
            }
            $db->beginTransaction();
            try{
                if($deleted){
                    $db->prepare("INSERT INTO sync_resources(resource_type,resource_id,payload_ciphertext,payload_bytes,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                      VALUES(?,?,NULL,0,1,?,?,?,?)
                      ON CONFLICT(resource_type,resource_id) DO UPDATE SET payload_ciphertext=NULL,payload_bytes=0,version=?,client_updated_at=excluded.client_updated_at,server_updated_at=excluded.server_updated_at,deleted_at=excluded.deleted_at,updated_by=excluded.updated_by")
                      ->execute([$type,$resourceId,$clientAt,$now,$now,$actor['id'],$nextVersion]);
                    if(!$current)$nextVersion=1;
                }else{
                    $db->prepare("INSERT INTO sync_resources(resource_type,resource_id,payload_ciphertext,payload_bytes,version,client_updated_at,server_updated_at,deleted_at,updated_by)
                      VALUES(?,?,?,?,1,?,?,NULL,?)
                      ON CONFLICT(resource_type,resource_id) DO UPDATE SET payload_ciphertext=excluded.payload_ciphertext,payload_bytes=excluded.payload_bytes,version=?,client_updated_at=excluded.client_updated_at,server_updated_at=excluded.server_updated_at,deleted_at=NULL,updated_by=excluded.updated_by")
                      ->execute([$type,$resourceId,$cipher,$bytes,$clientAt,$now,$actor['id'],$nextVersion]);
                }
                $db->prepare('INSERT INTO sync_resource_changes(resource_type,resource_id,version,deleted,server_updated_at,device_id,change_id) VALUES(?,?,?,?,?,?,?)')
                  ->execute([$type,$resourceId,$nextVersion,$deleted?1:0,$now,$deviceId,$changeId]);
                $db->prepare('INSERT INTO sync_change_receipts(change_id,device_id,resource_type,resource_id,result_version,created_at) VALUES(?,?,?,?,?,?)')
                  ->execute([$changeId,$deviceId,$type,$resourceId,$nextVersion,$now]);
                $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
                  ->execute([$actor['id'],'resource-sync.'.($deleted?'delete':'upsert'),$type.'/'.$resourceId]);
                $db->commit();
            }catch(Throwable $e){$db->rollBack();throw $e;}
            tracky_sync_v2_prune($db);
            $saved=tracky_sync_v2_select($db,$type,$resourceId);
            $results[]=['changeId'=>$changeId,'resourceType'=>$type,'resourceId'=>$resourceId,
              'status'=>'applied','record'=>$saved?tracky_sync_v2_record($saved):null];
        }catch(Throwable $e){
            $results[]=['changeId'=>$changeId,'resourceType'=>$type,'resourceId'=>$resourceId,
              'status'=>'rejected','error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()];
        }
    }
    $db->prepare('UPDATE sync_devices SET last_seen_at=? WHERE id=?')->execute([$now,$deviceId]);
    $cursor=(int)($db->query('SELECT COALESCE(MAX(seq),0) FROM sync_resource_changes')->fetchColumn()?:0);
    tracky_reply(['schemaVersion'=>TRACKY_SCHEMA_VERSION,'cursor'=>$cursor,'results'=>$results]);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=$e instanceof PDOException?409:400;
    tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],$status);
}
