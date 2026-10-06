<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_media_id_https_sources(array $rows): array {
    $out=[];$seen=[];
    foreach($rows as $row){
        $url=trim((string)($row['url']??''));$title=trim((string)($row['title']??''));
        if(!str_starts_with($url,'https://')||isset($seen[$url]))continue;
        $seen[$url]=true;$out[]=['url'=>substr($url,0,700),'title'=>substr($title,0,160)];
        if(count($out)>=5)break;
    }
    return $out;
}
function tracky_media_id_openai_sources(array $data): array {
    $rows=[];
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        foreach((array)($part['annotations']??[]) as $annotation)
          if(($annotation['type']??'')==='url_citation')
            $rows[]=['url'=>$annotation['url']??'','title'=>$annotation['title']??''];
    return tracky_media_id_https_sources($rows);
}
function tracky_media_id_anthropic_sources(array $data): array {
    $rows=[];
    foreach((array)($data['content']??[]) as $part){
        if(($part['type']??'')==='web_search_tool_result'&&is_array($part['content']??null))
            foreach($part['content'] as $result)
              if(($result['type']??'')==='web_search_result')
                $rows[]=['url'=>$result['url']??'','title'=>$result['title']??''];
        if(($part['type']??'')==='text')
            foreach((array)($part['citations']??[]) as $citation)
              if(($citation['type']??'')==='web_search_result_location')
                $rows[]=['url'=>$citation['url']??'','title'=>$citation['title']??''];
    }
    return tracky_media_id_https_sources($rows);
}
function tracky_media_id_openai_text(array $data): string {
    $reply=trim((string)($data['output_text']??''));
    if($reply!=='')return substr($reply,0,2200);
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,2200);
}
function tracky_media_id_anthropic_text(array $data): string {
    $reply='';
    foreach((array)($data['content']??[]) as $part)
      if(($part['type']??'')==='text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,2200);
}
function tracky_media_id_json(string $text): array {
    $first=strpos($text,'{');$last=strrpos($text,'}');
    if($first===false||$last===false||$last<$first)throw new RuntimeException('Media search returned no structured candidate.');
    return json_decode(substr($text,$first,$last-$first+1),true,32,JSON_THROW_ON_ERROR);
}
function tracky_media_id_clue(string $value,int $max,int $minWords,string $label): string {
    $value=trim(preg_replace('/\s+/u',' ',$value)??'');
    if($value==='')return '';
    if(strlen($value)>$max)throw new InvalidArgumentException($label.' is too long.');
    $words=preg_split('/\s+/u',$value,-1,PREG_SPLIT_NO_EMPTY)?:[];
    if(count($words)<$minWords)throw new InvalidArgumentException($label.' is too short.');
    return $value;
}
function tracky_media_id_instruction(string $dialogue,string $visual,string $mediaKind): string {
    $parts=['Identify the TV, movie, episode, or streaming video from bounded room-media evidence.'];
    if($dialogue!=='')$parts[]='Possibly imperfect recorded dialogue clue: "'.$dialogue.'".';
    if($visual!=='')$parts[]='Optional visual metadata clue: "'.$visual.'".';
    $parts[]='Current acoustic media class: '.$mediaKind.'. Search the public web.';
    $parts[]='Return only a strong best candidate. Do not reproduce dialogue, subtitles, scripts, or copyrighted passages.';
    $parts[]='Do not infer who is watching. Return JSON only with found, kind, title, series, season, episode, year, service, confidence.';
    $parts[]='kind must be movie, tv-series, episode, streaming-video, or unknown. Use 0 for unknown season, episode, and year.';
    return implode(' ',$parts);
}
function tracky_media_id_openai(string $secret,string $model,string $instruction): array {
    $payload=[
      'model'=>$model,'input'=>$instruction,'store'=>false,'max_output_tokens'=>240,
      'tools'=>[['type'=>'web_search','search_context_size'=>'low']],'tool_choice'=>'required',
      'text'=>['format'=>[
       'type'=>'json_schema','name'=>'room_media_candidate','strict'=>true,
       'schema'=>[
        'type'=>'object','additionalProperties'=>false,
        'properties'=>[
          'found'=>['type'=>'boolean'],
          'kind'=>['type'=>'string','enum'=>['movie','tv-series','episode','streaming-video','unknown']],
          'title'=>['type'=>'string'],'series'=>['type'=>'string'],
          'season'=>['type'=>'integer','minimum'=>0,'maximum'=>200],
          'episode'=>['type'=>'integer','minimum'=>0,'maximum'=>2000],
          'year'=>['type'=>'integer','minimum'=>0,'maximum'=>2100],
          'service'=>['type'=>'string'],
          'confidence'=>['type'=>'number','minimum'=>0,'maximum'=>1]
        ],
        'required'=>['found','kind','title','series','season','episode','year','service','confidence']
       ]
      ]]
    ];
    $res=tracky_provider_http('https://api.openai.com/v1/responses',[
      'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 media-id-runtime');
    $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    return ['candidate'=>tracky_media_id_json(tracky_media_id_openai_text($decoded)),
      'sources'=>tracky_media_id_openai_sources($decoded)];
}
function tracky_media_id_anthropic(string $secret,string $model,string $instruction): array {
    $headers=['x-api-key: '.$secret,'anthropic-version: 2023-06-01','Content-Type: application/json','Accept: application/json'];
    $tools=[['type'=>'web_search_20250305','name'=>'web_search','max_uses'=>2]];
    $messages=[['role'=>'user','content'=>$instruction]];
    $payload=['model'=>$model,'max_tokens'=>280,
      'system'=>'Use web search for this media-identification request. Return JSON only and do not reproduce dialogue or scripts.',
      'messages'=>$messages,'tools'=>$tools];
    $res=tracky_provider_http('https://api.anthropic.com/v1/messages',$headers,
      json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 media-id-runtime');
    $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    if(($decoded['stop_reason']??'')==='pause_turn'){
        $messages[]=['role'=>'assistant','content'=>$decoded['content']??[]];$payload['messages']=$messages;
        $res=tracky_provider_http('https://api.anthropic.com/v1/messages',$headers,
          json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 media-id-runtime');
        $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    }
    return ['candidate'=>tracky_media_id_json(tracky_media_id_anthropic_text($decoded)),
      'sources'=>tracky_media_id_anthropic_sources($decoded)];
}
function tracky_media_id_candidate(array $row): array {
    $found=($row['found']??false)===true;
    $kind=(string)($row['kind']??'unknown');
    if(!in_array($kind,['movie','tv-series','episode','streaming-video','unknown'],true))$kind='unknown';
    $title=substr(trim((string)($row['title']??'')),0,140);
    $series=substr(trim((string)($row['series']??'')),0,140);
    $season=max(0,min(200,(int)($row['season']??0)));
    $episode=max(0,min(2000,(int)($row['episode']??0)));
    $year=max(0,min(2100,(int)($row['year']??0)));
    $service=substr(trim((string)($row['service']??'')),0,80);
    $confidence=max(0,min(1,(float)($row['confidence']??0)));
    if(!$found||$title==='')return [
      'found'=>false,'kind'=>'unknown','title'=>'','series'=>'','season'=>0,'episode'=>0,
      'year'=>0,'service'=>'','confidence'=>0.0
    ];
    return compact('found','kind','title','series','season','episode','year','service','confidence');
}

try{
    $db=tracky_db();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'providers.use');tracky_check_csrf();$data=tracky_json();
    if(($data['action']??'')!=='media_search')tracky_reply(['error'=>'Unsupported media ID action'],422);
    if(($data['ownerEnabled']??false)!==true)tracky_reply(['error'=>'Owner-enabled remote media lookup required'],403);
    $dialogue=tracky_media_id_clue((string)($data['dialogueQuery']??''),190,5,'Dialogue clue');
    $visual=tracky_media_id_clue((string)($data['visualClue']??''),220,2,'Visual clue');
    if($dialogue===''&&$visual==='')tracky_reply(['error'=>'A media clue is required'],422);
    $mediaKind=in_array(($data['mediaKind']??''),['television','recorded-media'],true)
      ?(string)$data['mediaKind']:'recorded-media';
    $evidenceId=substr(preg_replace('/[^A-Za-z0-9_-]/','',(string)($data['evidenceId']??''))??'',0,96);
    $preferred=strtolower(trim((string)($data['preferredProvider']??'auto')));
    if(!in_array($preferred,['auto','openai','anthropic'],true))$preferred='auto';
    $plan=tracky_chat_provider_plan($db,$preferred);
    if(!$plan)tracky_reply(['error'=>'No configured OpenAI or Anthropic provider is available'],409);

    $instruction=tracky_media_id_instruction($dialogue,$visual,$mediaKind);
    $units=tracky_provider_request_units([['role'=>'user','content'=>$instruction]],260);
    $lastError='No configured provider completed the media lookup.';
    foreach($plan as $provider){
      if(tracky_provider_circuit_open($provider)){ $lastError=$provider.' provider is temporarily paused';continue; }
      $secret=tracky_provider_secret($db,$provider);if(!$secret)continue;
      $model=tracky_provider_default_model($provider);
      try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],$provider,$units);}
      catch(RuntimeException $e){$lastError=$e->getMessage();continue;}
      try{
        $resolved=$provider==='openai'
          ?tracky_media_id_openai($secret,$model,$instruction)
          :tracky_media_id_anthropic($secret,$model,$instruction);
        $candidate=tracky_media_id_candidate($resolved['candidate']);
        tracky_provider_note_success($provider);
        tracky_provider_audit($db,(int)$actor['id'],'provider.media-id-search',$provider,$model,'success',$units);
        tracky_reply($candidate+[
          'sources'=>$resolved['sources'],'provider'=>$provider.'-web-search',
          'model'=>$model,'evidenceId'=>$evidenceId,'budget'=>$budget
        ]);
      }catch(Throwable $e){
        tracky_provider_note_failure($db,(int)$actor['id'],$provider);
        tracky_provider_audit($db,(int)$actor['id'],'provider.media-id-search',$provider,$model,'failed',$units);
        $lastError=$e instanceof RuntimeException?$e->getMessage():'Media search failed.';
      }
    }
    tracky_reply(['error'=>$lastError],502);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply(['error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException
      ?$e->getMessage():'Media ID runtime unavailable'],$status);
}
