<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TRACKY_ROOM_NODE_STALE_MS=15000;
const TRACKY_ROOM_EVENT_RETENTION_MS=300000;

function tracky_room_id(mixed $value,string $label='ID',int $max=96): string {
    $id=trim((string)$value);
    if($id===''||strlen($id)>$max||!preg_match('/^[A-Za-z0-9_.:-]+$/D',$id))
        throw new InvalidArgumentException('Invalid '.$label.'.');
    return $id;
}
function tracky_room_name(mixed $value): string {
    $name=trim((string)$value);
    if($name===''||strlen($name)>96)throw new InvalidArgumentException('Invalid room name.');
    return $name;
}
function tracky_room_nodes(PDO $db,int $now): array {
    $cutoff=$now-TRACKY_ROOM_NODE_STALE_MS;
    $s=$db->prepare('SELECT id,room_id,room_name,runtime_instance_id,preferred_primary,client_at,server_seen_at,connected_at
      FROM room_nodes WHERE server_seen_at>=? ORDER BY room_id,connected_at,id');
    $s->execute([$cutoff]);
    return array_map(static fn($r)=>[
      'id'=>(string)$r['id'],'roomId'=>(string)$r['room_id'],'roomName'=>(string)$r['room_name'],
      'runtimeInstanceId'=>$r['runtime_instance_id']===null?null:(string)$r['runtime_instance_id'],
      'preferredPrimary'=>(bool)$r['preferred_primary'],
      'clientAt'=>$r['client_at']===null?null:(int)$r['client_at'],
      'serverSeenAt'=>(int)$r['server_seen_at'],'connectedAt'=>(int)$r['connected_at']
    ],$s->fetchAll());
}
function tracky_room_observations(PDO $db,int $since,int $now): array {
    $floor=max($since,$now-TRACKY_ROOM_EVENT_RETENTION_MS);
    $s=$db->prepare('SELECT id,node_id,room_id,participant_id,semantic,from_room_id,to_room_id,authority,
      client_observed_at,server_received_at
      FROM room_node_observations WHERE server_received_at>? ORDER BY server_received_at,id LIMIT 200');
    $s->execute([$floor]);
    return array_map(static fn($r)=>[
      'id'=>(string)$r['id'],'nodeId'=>(string)$r['node_id'],'roomId'=>(string)$r['room_id'],
      'participantId'=>(string)$r['participant_id'],'semantic'=>(string)$r['semantic'],
      'fromRoomId'=>$r['from_room_id']===null?null:(string)$r['from_room_id'],
      'toRoomId'=>$r['to_room_id']===null?null:(string)$r['to_room_id'],
      'authority'=>$r['authority']===null?null:(string)$r['authority'],
      'clientObservedAt'=>$r['client_observed_at']===null?null:(int)$r['client_observed_at'],
      'serverReceivedAt'=>(int)$r['server_received_at']
    ],$s->fetchAll());
}

try{
    $db=tracky_db();
    if((int)($_SERVER['CONTENT_LENGTH']??0)>128000)tracky_reply(['error'=>'Request too large'],413);
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    $permission=$method==='GET'?'rooms.read':'rooms.write';
    if(!in_array($method,['GET','POST'],true))tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,$permission);
    $now=(int)floor(microtime(true)*1000);
    $since=isset($_GET['since'])&&is_numeric($_GET['since'])?max(0,(int)$_GET['since']):$now-30000;

    if($method==='POST'){
        tracky_check_csrf();
        $data=tracky_json();$node=$data['node']??null;$events=$data['observations']??[];
        if(!is_array($node)||!is_array($events)||count($events)>32)
            tracky_reply(['error'=>'Invalid room node payload'],422);
        $nodeId=tracky_room_id($node['id']??'','node ID',80);
        $roomId=tracky_room_id($node['roomId']??'','room ID');
        $roomName=tracky_room_name($node['roomName']??$roomId);
        $runtime=(string)($node['runtimeInstanceId']??'');
        if($runtime!==''&&(strlen($runtime)>96||!preg_match('/^[A-Za-z0-9_.:-]+$/D',$runtime)))
            throw new InvalidArgumentException('Invalid runtime instance ID.');
        $clientAt=isset($node['clientAt'])&&is_numeric($node['clientAt'])?(int)$node['clientAt']:null;
        $preferred=!empty($node['preferredPrimary'])?1:0;
        $current=$db->prepare('SELECT connected_at FROM room_nodes WHERE id=?');$current->execute([$nodeId]);
        $connected=$current->fetchColumn();$connected=$connected===false?$now:(int)$connected;
        $db->prepare('INSERT INTO room_nodes(id,room_id,room_name,runtime_instance_id,preferred_primary,client_at,server_seen_at,connected_at,updated_by)
          VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET room_id=excluded.room_id,room_name=excluded.room_name,
           runtime_instance_id=excluded.runtime_instance_id,preferred_primary=excluded.preferred_primary,
           client_at=excluded.client_at,server_seen_at=excluded.server_seen_at,updated_by=excluded.updated_by')
          ->execute([$nodeId,$roomId,$roomName,$runtime===''?null:$runtime,$preferred,$clientAt,$now,$connected,$actor['id']]);

        $allowed=['participant-observed','participant-out-of-view','room-handoff-declared','room-departure-confirmed'];
        $insert=$db->prepare('INSERT OR IGNORE INTO room_node_observations
          (id,node_id,room_id,participant_id,semantic,from_room_id,to_room_id,authority,client_observed_at,server_received_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)');
        $accepted=0;
        foreach($events as $event){
            if(!is_array($event))continue;
            $eventId=tracky_room_id($event['id']??'','event ID',128);
            $eventRoom=tracky_room_id($event['roomId']??$roomId,'room ID');
            $participant=tracky_room_id($event['participantId']??'','participant ID',80);
            $semantic=(string)($event['semantic']??'');
            if(!in_array($semantic,$allowed,true))throw new InvalidArgumentException('Invalid room observation semantic.');
            $from=isset($event['fromRoomId'])&&$event['fromRoomId']!==null
              ?tracky_room_id($event['fromRoomId'],'from room ID'):null;
            $to=isset($event['toRoomId'])&&$event['toRoomId']!==null
              ?tracky_room_id($event['toRoomId'],'to room ID'):null;
            $authority=isset($event['authority'])?substr(trim((string)$event['authority']),0,48):null;
            $clientObserved=isset($event['clientObservedAt'])&&is_numeric($event['clientObservedAt'])
              ?(int)$event['clientObservedAt']:null;
            $insert->execute([$eventId,$nodeId,$eventRoom,$participant,$semantic,$from,$to,
              $authority===''?null:$authority,$clientObserved,$now]);
            $accepted+=$insert->rowCount();
        }
        $db->prepare('DELETE FROM room_node_observations WHERE server_received_at<?')
          ->execute([$now-TRACKY_ROOM_EVENT_RETENTION_MS]);
        $db->prepare('DELETE FROM room_nodes WHERE server_seen_at<?')
          ->execute([$now-TRACKY_ROOM_EVENT_RETENTION_MS]);
        $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
          ->execute([$actor['id'],'rooms.runtime.heartbeat',$nodeId]);
        tracky_reply([
          'schemaVersion'=>TRACKY_SCHEMA_VERSION,'serverNow'=>$now,'accepted'=>$accepted,
          'nodes'=>tracky_room_nodes($db,$now),
          'observations'=>tracky_room_observations($db,$since,$now)
        ]);
    }

    tracky_reply([
      'schemaVersion'=>TRACKY_SCHEMA_VERSION,'serverNow'=>$now,
      'nodes'=>tracky_room_nodes($db,$now),
      'observations'=>tracky_room_observations($db,$since,$now)
    ]);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)http_response_code($e instanceof PDOException?409:400);
    tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],http_response_code());
}
