<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
try {
 $db=tracky_db();
 if((int)($_SERVER['CONTENT_LENGTH']??0)>3_000_000)tracky_reply(['error'=>'Request too large'],413);
 $method=$_SERVER['REQUEST_METHOD']??'GET';$resource=(string)($_GET['resource']??'');
 $read=['participants'=>'participants.read','scenes'=>'scene.read','objects'=>'scene.read','skills'=>'scene.read'];
 $write=['participants'=>'participants.write','scenes'=>'scene.capture','objects'=>'objects.review','skills'=>'skills.approve'];
 if(!isset($read[$resource])||!in_array($method,['GET','POST'],true))tracky_reply(['error'=>'Not found'],404);
 $actor=tracky_require($db,($method==='GET'?$read:$write)[$resource]);
 if($method==='GET') {
  $query=match($resource){
   'participants'=>tracky_permission($db,$actor,'participants.write')
     ?'SELECT id,name,profile_json,consent,updated_at FROM participants ORDER BY updated_at DESC'
     :'SELECT id,name,consent,updated_at FROM participants ORDER BY updated_at DESC',
   'scenes'=>'SELECT id,title,created_at FROM scenes ORDER BY created_at DESC',
   'objects'=>'SELECT id,scene_id,label,confidence,bbox_json,status FROM scene_objects ORDER BY created_at DESC',
   'skills'=>'SELECT object_id,skill,enabled FROM object_skills ORDER BY object_id,skill'
  };
  tracky_reply(['records'=>$db->query($query)->fetchAll()]);
 }
 tracky_check_csrf();$data=tracky_json();$id=(string)($data['id']??'');
 if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$id))tracky_reply(['error'=>'Invalid ID'],422);
 if($resource==='participants'){
  $name=trim((string)($data['name']??''));$profile=$data['profile']??[];
  if(strlen($name)<1||strlen($name)>120||!is_array($profile))tracky_reply(['error'=>'Invalid participant'],422);
  // No silent transfer of photos or face/voice profile data.
  $biometricFields=['primaryPhoto','latestPhoto','faceSamples','faceEmbeddings','embeddings',
    'voiceSamples','voiceEmbedding','voiceEmbeddings','voiceProfileSamples'];
  $hasBiometricData=false;
  foreach($biometricFields as $key)if(!empty($profile[$key]))$hasBiometricData=true;
  if(empty($data['consent']) && $hasBiometricData)
      tracky_reply(['error'=>'Explicit participant consent required for biometric records'],422);
  $db->prepare('INSERT INTO participants(id,name,profile_json,consent,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,profile_json=excluded.profile_json,consent=excluded.consent,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP')->execute([$id,$name,json_encode($profile,JSON_THROW_ON_ERROR),!empty($data['consent'])?1:0,$actor['id']]);
 }elseif($resource==='scenes'){
  $title=trim((string)($data['title']??'Untitled scene'));
  if(strlen($title)<1||strlen($title)>120)tracky_reply(['error'=>'Invalid scene title'],422);
  $db->prepare('INSERT INTO scenes(id,title,created_by) VALUES(?,?,?)')->execute([$id,$title,$actor['id']]);
 }elseif($resource==='objects'){
  $scene=(string)($data['sceneId']??'');$label=trim((string)($data['label']??''));$confidence=$data['confidence']??null;$bbox=$data['bbox']??null;
  if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$scene)||strlen($label)<1||strlen($label)>120||($confidence!==null&&(!is_numeric($confidence)||$confidence<0||$confidence>1))||($bbox!==null&&(!is_array($bbox)||count($bbox)!==4||count(array_filter($bbox,fn($v)=>is_numeric($v)&&$v>=0&&$v<=1))!==4)))tracky_reply(['error'=>'Invalid detection'],422);
  $status=($data['approve']??false)?'approved':'proposed';
  $db->prepare('INSERT INTO scene_objects(id,scene_id,label,confidence,bbox_json,status,approved_by) VALUES(?,?,?,?,?,?,?)')->execute([$id,$scene,$label,$confidence,$bbox===null?null:json_encode(array_values($bbox),JSON_THROW_ON_ERROR),$status,$status==='approved'?$actor['id']:null]);
 }else{
  // Skill entries are permissions metadata, NOT executable arbitrary commands.
  $object=(string)($data['objectId']??'');$skill=(string)($data['skill']??'');
  if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$object)||!in_array($skill,['capture_image','product_search','describe_object'],true))tracky_reply(['error'=>'Invalid skill'],422);
  $s=$db->prepare("SELECT 1 FROM scene_objects WHERE id=? AND status='approved'");$s->execute([$object]);
  if(!$s->fetchColumn())tracky_reply(['error'=>'Object approval required'],409);
  $db->prepare('INSERT INTO object_skills(object_id,skill,enabled) VALUES(?,?,?) ON CONFLICT(object_id,skill) DO UPDATE SET enabled=excluded.enabled')->execute([$object,$skill,!empty($data['enabled'])?1:0]);
 }
 $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor['id'],$resource.'.write',$id]);
 tracky_reply(['ok'=>true],201);
}catch(Throwable $e){
 $status=http_response_code();if($status<400){http_response_code($e instanceof PDOException?409:400);}
 tracky_reply(['error'=>$e instanceof PDOException?'Database operation failed.':$e->getMessage()],http_response_code());
}
