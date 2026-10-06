<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_provider_openai(string $secret,string $model,array $messages): string {
    $system=[];$input=[];
    foreach($messages as $row){
        if($row['role']==='system'){$system[]=$row['content'];continue;}
        $input[]=['role'=>$row['role'],'content'=>$row['content']];
    }
    $payload=['model'=>$model,'input'=>$input,'max_output_tokens'=>180,'store'=>false];
    if($system)$payload['instructions']=implode("\n",$system);
    $res=tracky_provider_http('https://api.openai.com/v1/responses',[
      'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14 provider-runtime');
    $data=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    $reply=trim((string)($data['output_text']??''));
    if($reply===''){
        foreach((array)($data['output']??[]) as $item)
          foreach((array)($item['content']??[]) as $part)
            if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
        $reply=trim($reply);
    }
    if($reply==='')throw new RuntimeException('Provider returned no text reply.');
    return substr($reply,0,700);
}
function tracky_provider_anthropic(string $secret,string $model,array $messages): string {
    $system=[];$input=[];
    foreach($messages as $row){
        if($row['role']==='system'){$system[]=$row['content'];continue;}
        $input[]=['role'=>$row['role'],'content'=>$row['content']];
    }
    $payload=['model'=>$model,'max_tokens'=>180,'messages'=>$input];
    if($system)$payload['system']=implode("\n",$system);
    $res=tracky_provider_http('https://api.anthropic.com/v1/messages',[
      'x-api-key: '.$secret,'anthropic-version: 2023-06-01',
      'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14 provider-runtime');
    $data=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);$reply='';
    foreach((array)($data['content']??[]) as $part)
      if(($part['type']??'')==='text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    $reply=trim($reply);
    if($reply==='')throw new RuntimeException('Provider returned no text reply.');
    return substr($reply,0,700);
}

function tracky_provider_collect_sources(mixed $value,array &$sources,array &$seen,int $depth=0): void {
    if($depth>8||count($sources)>=5)return;
    if(!is_array($value))return;
    $url=is_string($value['url']??null)?trim($value['url']):'';
    if($url!==''&&preg_match('#^https://#i',$url)&&!isset($seen[$url])){
        $seen[$url]=true;
        $title=is_string($value['title']??null)?trim($value['title']):'';
        $sources[]=['url'=>substr($url,0,700),'title'=>substr($title!==''?$title:$url,0,160)];
        if(count($sources)>=5)return;
    }
    foreach($value as $child)if(is_array($child))tracky_provider_collect_sources($child,$sources,$seen,$depth+1);
}
function tracky_provider_openai_research(string $secret,string $model,array $messages): array {
    $system=[];$input=[];
    foreach($messages as $row){
        if($row['role']==='system'){$system[]=$row['content'];continue;}
        $input[]=['role'=>$row['role'],'content'=>$row['content']];
    }
    $payload=['model'=>$model,'input'=>$input,'max_output_tokens'=>500,'store'=>false,
      'tools'=>[['type'=>'web_search']]];
    if($system)$payload['instructions']=implode("\n",$system);
    $res=tracky_provider_http('https://api.openai.com/v1/responses',[
      'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14 provider-research');
    $data=json_decode($res['body'],true,96,JSON_THROW_ON_ERROR);$reply=trim((string)($data['output_text']??''));
    if($reply===''){
        foreach((array)($data['output']??[]) as $item)
          foreach((array)($item['content']??[]) as $part)
            if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
        $reply=trim($reply);
    }
    if($reply==='')throw new RuntimeException('Research provider returned no text reply.');
    $sources=[];$seen=[];tracky_provider_collect_sources($data,$sources,$seen);
    return ['reply'=>substr($reply,0,1200),'sources'=>$sources];
}
function tracky_provider_anthropic_research(string $secret,string $model,array $messages): array {
    $system=[];$input=[];
    foreach($messages as $row){
        if($row['role']==='system'){$system[]=$row['content'];continue;}
        $input[]=['role'=>$row['role'],'content'=>$row['content']];
    }
    $payload=['model'=>$model,'max_tokens'=>500,'messages'=>$input,
      'tools'=>[['type'=>'web_search_20250305','name'=>'web_search','max_uses'=>3]]];
    if($system)$payload['system']=implode("\n",$system);
    $res=tracky_provider_http('https://api.anthropic.com/v1/messages',[
      'x-api-key: '.$secret,'anthropic-version: 2023-06-01',
      'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14 provider-research');
    $data=json_decode($res['body'],true,96,JSON_THROW_ON_ERROR);$reply='';
    foreach((array)($data['content']??[]) as $part)
      if(($part['type']??'')==='text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    $reply=trim($reply);
    if($reply==='')throw new RuntimeException('Research provider returned no text reply.');
    $sources=[];$seen=[];tracky_provider_collect_sources($data,$sources,$seen);
    return ['reply'=>substr($reply,0,1200),'sources'=>$sources];
}
function tracky_provider_elevenlabs(string $secret,string $model,string $voiceId,string $text): array {
    if(!preg_match('/^[A-Za-z0-9_-]{8,64}$/D',$voiceId))throw new InvalidArgumentException('Invalid ElevenLabs voice ID.');
    $text=trim(preg_replace('/\s+/u',' ',$text)??'');
    if($text===''||strlen($text)>700)throw new InvalidArgumentException('Speech text must be 1-700 characters.');
    $url='https://api.elevenlabs.io/v1/text-to-speech/'.rawurlencode($voiceId).'?output_format=mp3_44100_128';
    $res=tracky_provider_http($url,[
      'xi-api-key: '.$secret,'Content-Type: application/json','Accept: audio/mpeg'
    ],json_encode(['text'=>$text,'model_id'=>$model],JSON_THROW_ON_ERROR),true,'Tracky2/0.14 provider-runtime');
    if(strlen($res['body'])<32||strlen($res['body'])>2*1024*1024)
      throw new RuntimeException('Speech provider returned an invalid audio payload.');
    return ['audioBase64'=>base64_encode($res['body']),'mimeType'=>'audio/mpeg'];
}

try{
    $db=tracky_db();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        $actor=tracky_require($db,'providers.use');
        $providers=[];
        foreach(tracky_provider_status($db) as $row){
            $row['budget']=tracky_provider_usage_snapshot($db,(int)$actor['id'],$row['provider']);
            $providers[]=$row;
        }
        tracky_reply(['authenticated'=>true,'providers'=>$providers,'csrf'=>tracky_csrf()]);
    }
    if($method!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'providers.use');tracky_check_csrf();$data=tracky_json();
    $action=(string)($data['action']??'chat');$provider=(string)($data['provider']??'');
    if(!in_array($provider,TRACKY_PROVIDERS,true))tracky_reply(['error'=>'Unsupported provider'],422);
    if($provider==='acrcloud')
        tracky_reply(['error'=>'ACRCloud is available only through the governed music fingerprint runtime'],422);
    if(tracky_provider_circuit_open($provider))tracky_reply(['error'=>'Provider temporarily paused after repeated failures'],503);
    $secret=tracky_provider_secret($db,$provider);
    if(!$secret)tracky_reply(['error'=>'Provider is not configured'],409);
    $model=(string)($data['model']??tracky_provider_default_model($provider));
    if(!tracky_provider_model_allowed($provider,$model))tracky_reply(['error'=>'Model is not allowlisted'],422);

    if($action==='research'){
        if(!in_array($provider,['openai','anthropic'],true))tracky_reply(['error'=>'Provider does not support web research'],422);
        if(($data['confirmed']??false)!==true)tracky_reply(['error'=>'Explicit owner confirmation is required for web research'],403);
        $messages=tracky_provider_messages($data['messages']??null);
        $units=tracky_provider_request_units($messages,520);
        try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],$provider,$units);}
        catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}
        try{
            $result=$provider==='openai'
              ?tracky_provider_openai_research($secret,$model,$messages)
              :tracky_provider_anthropic_research($secret,$model,$messages);
            tracky_provider_note_success($provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.research',$provider,$model,'success',$units);
            tracky_reply([
              'reply'=>$result['reply'],'sources'=>$result['sources'],
              'provider'=>$provider,'model'=>$model,'budget'=>$budget,'confirmed'=>true
            ]);
        }catch(Throwable $e){
            tracky_provider_note_failure($db,(int)$actor['id'],$provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.research',$provider,$model,'failed',$units);
            tracky_reply(['error'=>$e instanceof RuntimeException?$e->getMessage():'Research provider request failed.'],502);
        }
    }
    if($action==='chat'){
        if(!in_array($provider,['openai','anthropic'],true))tracky_reply(['error'=>'Provider does not support chat routing'],422);
        $messages=tracky_provider_messages($data['messages']??null);
        $units=tracky_provider_request_units($messages,180);
        try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],$provider,$units);}
        catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}
        try{
            $reply=$provider==='openai'
              ?tracky_provider_openai($secret,$model,$messages)
              :tracky_provider_anthropic($secret,$model,$messages);
            tracky_provider_note_success($provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.chat',$provider,$model,'success',$units);
            tracky_reply(['reply'=>$reply,'provider'=>$provider,'model'=>$model,'budget'=>$budget]);
        }catch(Throwable $e){
            tracky_provider_note_failure($db,(int)$actor['id'],$provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.chat',$provider,$model,'failed',$units);
            tracky_reply(['error'=>$e instanceof RuntimeException?$e->getMessage():'Provider request failed.'],502);
        }
    }
    if($action==='speech'){
        if($provider!=='elevenlabs')tracky_reply(['error'=>'Provider does not support speech routing'],422);
        $text=trim((string)($data['text']??''));$units=max(1,min(700,strlen($text)));
        try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],$provider,$units);}
        catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}
        try{
            $audio=tracky_provider_elevenlabs($secret,$model,(string)($data['voiceId']??''),$text);
            tracky_provider_note_success($provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.speech',$provider,$model,'success',$units);
            tracky_reply($audio+['provider'=>$provider,'model'=>$model,'budget'=>$budget]);
        }catch(Throwable $e){
            tracky_provider_note_failure($db,(int)$actor['id'],$provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.speech',$provider,$model,'failed',$units);
            tracky_reply(['error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException?$e->getMessage():'Speech provider request failed.'],502);
        }
    }
    tracky_reply(['error'=>'Unsupported provider action'],422);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply(['error'=>$e instanceof RuntimeException?$e->getMessage():'Provider runtime unavailable'],$status);
}
