<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TRACKY_ACRCLOUD_MAX_SAMPLE_BYTES=768000;
const TRACKY_ACRCLOUD_SIGNATURE_VERSION='1';
const TRACKY_ACRCLOUD_HTTP_URI='/v1/identify';

function tracky_acrcloud_multipart(array $fields,string $sample,string $mime='audio/wav'): array {
    $boundary='----Tracky2'.bin2hex(random_bytes(12));
    $body='';
    foreach($fields as $name=>$value){
        $safeName=preg_replace('/[^A-Za-z0-9_-]/','',(string)$name)??'';
        if($safeName==='')continue;
        $body.='--'.$boundary."\r\n".
          'Content-Disposition: form-data; name="'.$safeName.'"'."\r\n\r\n".
          (string)$value."\r\n";
    }
    $body.='--'.$boundary."\r\n".
      'Content-Disposition: form-data; name="sample"; filename="tracky2-sample.bin"'."\r\n".
      'Content-Type: '.$mime."\r\n\r\n".$sample."\r\n".
      '--'.$boundary."--\r\n";
    return ['body'=>$body,'contentType'=>'multipart/form-data; boundary='.$boundary];
}
function tracky_acrcloud_signature(array $config,string $dataType,string $timestamp): string {
    $string="POST\n".TRACKY_ACRCLOUD_HTTP_URI."\n".$config['accessKey']."\n".$dataType.
      "\n".TRACKY_ACRCLOUD_SIGNATURE_VERSION."\n".$timestamp;
    return base64_encode(hash_hmac('sha1',$string,$config['accessSecret'],true));
}
function tracky_acrcloud_music_row(array $data): ?array {
    $music=$data['metadata']['music']??null;
    if(!is_array($music)||!isset($music[0])||!is_array($music[0]))return null;
    $row=$music[0];
    if(isset($row['result'])&&is_array($row['result']))$row=$row['result'];
    return $row;
}
function tracky_acrcloud_candidate(array $row,string $evidenceId): ?array {
    $title=substr(trim((string)($row['title']??'')),0,120);
    $artists=is_array($row['artists']??null)?$row['artists']:[];
    $artist='';
    foreach($artists as $item){
        $name=trim((string)($item['name']??''));
        if($name!==''){$artist=substr($name,0,120);break;}
    }
    if($title===''||$artist==='')return null;
    $album='';
    if(is_array($row['album']??null))$album=substr(trim((string)($row['album']['name']??'')),0,120);
    $score=max(0,min(100,(float)($row['score']??0)));
    $acrid=substr(trim((string)($row['acrid']??'')),0,160);
    $isrc=substr(trim((string)($row['external_ids']['isrc']??'')),0,32);
    return [
      'title'=>$title,'artist'=>$artist,'album'=>$album,
      'confidence'=>round($score/100,4),'provider'=>'acrcloud',
      'externalId'=>$acrid!==''?$acrid:null,'isrc'=>$isrc!==''?$isrc:null,
      'evidenceId'=>$evidenceId
    ];
}
function tracky_acrcloud_recognize(array $config,string $sample,string $dataType): array {
    $timestamp=(string)time();
    $fields=[
      'access_key'=>$config['accessKey'],
      'sample_bytes'=>(string)strlen($sample),
      'timestamp'=>$timestamp,
      'signature'=>tracky_acrcloud_signature($config,$dataType,$timestamp),
      'data_type'=>$dataType,
      'signature_version'=>TRACKY_ACRCLOUD_SIGNATURE_VERSION
    ];
    $multipart=tracky_acrcloud_multipart(
      $fields,$sample,$dataType==='fingerprint'?'application/octet-stream':'audio/wav'
    );
    $url='https://'.$config['host'].TRACKY_ACRCLOUD_HTTP_URI;
    $res=tracky_provider_http($url,[
      'Content-Type: '.$multipart['contentType'],'Accept: application/json'
    ],$multipart['body'],false,'Tracky2/0.14.7 acrcloud-music-id');
    $data=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    $code=(int)($data['status']['code']??-1);
    if($code===1001)return ['matched'=>false,'data'=>$data];
    if($code!==0){
        $message=substr(trim((string)($data['status']['msg']??'Recognition failed')),0,160);
        throw new RuntimeException('ACRCloud recognition failed ('.$code.'): '.$message);
    }
    return ['matched'=>true,'data'=>$data];
}

try{
    $db=tracky_db();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'providers.use');tracky_check_csrf();
    if(($_GET['ownerEnabled']??'')!=='1')tracky_reply(['error'=>'Owner-enabled exact music recognition required'],403);
    $provider=strtolower(trim((string)($_GET['provider']??'acrcloud')));
    if($provider!=='acrcloud')tracky_reply(['error'=>'Unsupported music fingerprint provider'],422);
    $dataType=strtolower(trim((string)($_GET['dataType']??'audio')));
    if(!in_array($dataType,['audio','fingerprint'],true))tracky_reply(['error'=>'Unsupported music sample type'],422);
    $evidenceId=substr(preg_replace('/[^A-Za-z0-9_-]/','',(string)($_GET['evidenceId']??''))??'',0,96);

    $sample=file_get_contents('php://input',false,null,0,TRACKY_ACRCLOUD_MAX_SAMPLE_BYTES+1);
    if(!is_string($sample)||strlen($sample)<32)tracky_reply(['error'=>'Music recognition sample required'],422);
    if(strlen($sample)>TRACKY_ACRCLOUD_MAX_SAMPLE_BYTES)tracky_reply(['error'=>'Music recognition sample exceeds Tracky2 limit'],413);
    if(tracky_provider_circuit_open('acrcloud'))
        tracky_reply(['error'=>'ACRCloud temporarily paused after repeated failures'],503);
    $config=tracky_acrcloud_config($db);
    if(!$config)tracky_reply(['error'=>'ACRCloud provider is not configured'],409);

    $units=max(1,(int)ceil(strlen($sample)/32768));
    try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],'acrcloud',$units);}
    catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}

    try{
        $result=tracky_acrcloud_recognize($config,$sample,$dataType);
        tracky_provider_note_success('acrcloud');
        tracky_provider_audit(
          $db,(int)$actor['id'],'provider.music-fingerprint','acrcloud',$dataType,
          $result['matched']?'match':'no-match',$units
        );
        if(!$result['matched'])tracky_reply([
          'found'=>false,'provider'=>'acrcloud','dataType'=>$dataType,
          'evidenceId'=>$evidenceId,'budget'=>$budget
        ]);
        $row=tracky_acrcloud_music_row($result['data']);
        $candidate=$row?tracky_acrcloud_candidate($row,$evidenceId):null;
        if(!$candidate)tracky_reply([
          'found'=>false,'provider'=>'acrcloud','dataType'=>$dataType,
          'evidenceId'=>$evidenceId,'budget'=>$budget
        ]);
        tracky_reply([
          'found'=>true,'candidate'=>$candidate,'provider'=>'acrcloud',
          'dataType'=>$dataType,'evidenceId'=>$evidenceId,'budget'=>$budget
        ]);
    }catch(Throwable $e){
        tracky_provider_note_failure($db,(int)$actor['id'],'acrcloud');
        tracky_provider_audit(
          $db,(int)$actor['id'],'provider.music-fingerprint','acrcloud',$dataType,'failed',$units
        );
        tracky_reply([
          'error'=>$e instanceof RuntimeException?$e->getMessage():'ACRCloud music recognition failed.'
        ],502);
    }
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply([
      'error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException
       ?$e->getMessage():'Music fingerprint runtime unavailable'
    ],$status);
}
