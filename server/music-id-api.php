<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_music_id_https_sources(array $rows): array {
    $out=[];$seen=[];
    foreach($rows as $row){
        $url=trim((string)($row['url']??''));
        $title=trim((string)($row['title']??''));
        if(!str_starts_with($url,'https://')||isset($seen[$url]))continue;
        $seen[$url]=true;
        $out[]=['url'=>substr($url,0,700),'title'=>substr($title,0,160)];
        if(count($out)>=5)break;
    }
    return $out;
}
function tracky_music_id_openai_sources(array $data): array {
    $rows=[];
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        foreach((array)($part['annotations']??[]) as $annotation)
          if(($annotation['type']??'')==='url_citation')
            $rows[]=['url'=>$annotation['url']??'','title'=>$annotation['title']??''];
    return tracky_music_id_https_sources($rows);
}
function tracky_music_id_anthropic_sources(array $data): array {
    $rows=[];
    foreach((array)($data['content']??[]) as $part){
        if(($part['type']??'')==='web_search_tool_result'&&is_array($part['content']??null)){
            foreach($part['content'] as $result)
              if(($result['type']??'')==='web_search_result')
                $rows[]=['url'=>$result['url']??'','title'=>$result['title']??''];
        }
        if(($part['type']??'')==='text'){
            foreach((array)($part['citations']??[]) as $citation)
              if(($citation['type']??'')==='web_search_result_location')
                $rows[]=['url'=>$citation['url']??'','title'=>$citation['title']??''];
        }
    }
    return tracky_music_id_https_sources($rows);
}
function tracky_music_id_openai_text(array $data): string {
    $reply=trim((string)($data['output_text']??''));
    if($reply!=='')return substr($reply,0,1600);
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,1600);
}
function tracky_music_id_anthropic_text(array $data): string {
    $reply='';
    foreach((array)($data['content']??[]) as $part)
      if(($part['type']??'')==='text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,1600);
}
function tracky_music_id_json(string $text): array {
    $text=trim($text);
    $first=strpos($text,'{');$last=strrpos($text,'}');
    if($first===false||$last===false||$last<$first)throw new RuntimeException('Music lyric search returned no structured candidate.');
    return json_decode(substr($text,$first,$last-$first+1),true,32,JSON_THROW_ON_ERROR);
}
function tracky_music_id_query(string $value): string {
    $value=trim(preg_replace('/\s+/u',' ',$value)??'');
    if(strlen($value)<12||strlen($value)>160)
        throw new InvalidArgumentException('Lyric clue must be 12-160 characters.');
    $words=preg_split('/\s+/u',$value,-1,PREG_SPLIT_NO_EMPTY)?:[];
    if(count($words)<4||count($words)>24)
        throw new InvalidArgumentException('Lyric clue must contain 4-24 words.');
    return $value;
}
function tracky_music_id_instruction(string $query): string {
    return 'Identify a song from this short, possibly imperfect lyric transcription: "'.$query.'". '.
      'Search the public web. Return only the best candidate if the evidence is strong. '.
      'Do not reproduce lyrics, quote song text, infer a listener identity, or include private information. '.
      'Return JSON only with keys found, title, artist, album, confidence. '.
      'If uncertain, set found=false and use empty strings for title, artist, and album.';
}
function tracky_music_id_openai(string $secret,string $model,string $instruction): array {
    $payload=[
      'model'=>$model,'input'=>$instruction,'store'=>false,'max_output_tokens'=>180,
      'tools'=>[['type'=>'web_search','search_context_size'=>'low']],
      'tool_choice'=>'required',
      'text'=>['format'=>[
        'type'=>'json_schema','name'=>'music_lyric_candidate','strict'=>true,
        'schema'=>[
          'type'=>'object','additionalProperties'=>false,
          'properties'=>[
            'found'=>['type'=>'boolean'],'title'=>['type'=>'string'],
            'artist'=>['type'=>'string'],'album'=>['type'=>'string'],
            'confidence'=>['type'=>'number','minimum'=>0,'maximum'=>1]
          ],
          'required'=>['found','title','artist','album','confidence']
        ]
      ]]
    ];
    $res=tracky_provider_http('https://api.openai.com/v1/responses',[
      'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 music-id-runtime');
    $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    return ['candidate'=>tracky_music_id_json(tracky_music_id_openai_text($decoded)),
      'sources'=>tracky_music_id_openai_sources($decoded)];
}
function tracky_music_id_anthropic(string $secret,string $model,string $instruction): array {
    $payload=[
      'model'=>$model,'max_tokens'=>220,
      'system'=>'Use web search for this music-identification request. Return JSON only and do not reproduce song lyrics.',
      'messages'=>[['role'=>'user','content'=>$instruction]],
      'tools'=>[['type'=>'web_search_20250305','name'=>'web_search','max_uses'=>2]]
    ];
    $res=tracky_provider_http('https://api.anthropic.com/v1/messages',[
      'x-api-key: '.$secret,'anthropic-version: 2023-06-01',
      'Content-Type: application/json','Accept: application/json'
    ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 music-id-runtime');
    $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
    return ['candidate'=>tracky_music_id_json(tracky_music_id_anthropic_text($decoded)),
      'sources'=>tracky_music_id_anthropic_sources($decoded)];
}
function tracky_music_id_candidate(array $candidate): array {
    $found=($candidate['found']??false)===true;
    $title=substr(trim((string)($candidate['title']??'')),0,120);
    $artist=substr(trim((string)($candidate['artist']??'')),0,120);
    $album=substr(trim((string)($candidate['album']??'')),0,120);
    $confidence=max(0,min(1,(float)($candidate['confidence']??0)));
    if(!$found||$title===''||$artist==='')return [
      'found'=>false,'title'=>'','artist'=>'','album'=>'','confidence'=>0.0
    ];
    return compact('found','title','artist','album','confidence');
}

try{
    $db=tracky_db();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'providers.use');tracky_check_csrf();$data=tracky_json();
    if(($data['action']??'')!=='lyric_search')tracky_reply(['error'=>'Unsupported music ID action'],422);
    if(($data['ownerEnabled']??false)!==true)tracky_reply(['error'=>'Owner-enabled remote lyric lookup required'],403);
    $query=tracky_music_id_query((string)($data['query']??''));
    $evidenceId=substr(preg_replace('/[^A-Za-z0-9_-]/','',(string)($data['evidenceId']??''))??'',0,96);
    $preferred=strtolower(trim((string)($data['preferredProvider']??'auto')));
    if(!in_array($preferred,['auto','openai','anthropic'],true))$preferred='auto';
    $plan=tracky_chat_provider_plan($db,$preferred);
    if(!$plan)tracky_reply(['error'=>'No configured OpenAI or Anthropic provider is available'],409);

    $instruction=tracky_music_id_instruction($query);
    $units=tracky_provider_request_units([['role'=>'user','content'=>$instruction]],220);
    $lastError='No configured provider completed the lookup.';
    foreach($plan as $provider){
        if(tracky_provider_circuit_open($provider)){ $lastError=$provider.' provider is temporarily paused'; continue; }
        $secret=tracky_provider_secret($db,$provider);
        if(!$secret)continue;
        $model=tracky_provider_default_model($provider);
        try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],$provider,$units);}
        catch(RuntimeException $e){$lastError=$e->getMessage();continue;}
        try{
            $resolved=$provider==='openai'
              ?tracky_music_id_openai($secret,$model,$instruction)
              :tracky_music_id_anthropic($secret,$model,$instruction);
            $candidate=tracky_music_id_candidate($resolved['candidate']);
            tracky_provider_note_success($provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.music-lyric-search',$provider,$model,'success',$units);
            tracky_reply($candidate+[
              'sources'=>$resolved['sources'],'provider'=>$provider.'-web-search',
              'model'=>$model,'evidenceId'=>$evidenceId,'budget'=>$budget
            ]);
        }catch(Throwable $e){
            tracky_provider_note_failure($db,(int)$actor['id'],$provider);
            tracky_provider_audit($db,(int)$actor['id'],'provider.music-lyric-search',$provider,$model,'failed',$units);
            $lastError=$e instanceof RuntimeException?$e->getMessage():'Music lyric search failed.';
        }
    }
    tracky_reply(['error'=>$lastError],502);
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply(['error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException
      ?$e->getMessage():'Music ID runtime unavailable'],$status);
}
