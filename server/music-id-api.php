<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_music_id_sources(array $data): array {
    $rows=[];$seen=[];
    foreach((array)($data['output']??[]) as $item){
        foreach((array)($item['content']??[]) as $part){
            foreach((array)($part['annotations']??[]) as $annotation){
                if(($annotation['type']??'')!=='url_citation')continue;
                $url=trim((string)($annotation['url']??''));
                if(!str_starts_with($url,'https://')||isset($seen[$url]))continue;
                $seen[$url]=true;
                $rows[]=['url'=>substr($url,0,700),'title'=>substr(trim((string)($annotation['title']??'')),0,160)];
                if(count($rows)>=5)return $rows;
            }
        }
    }
    return $rows;
}
function tracky_music_id_output_text(array $data): string {
    $reply=trim((string)($data['output_text']??''));
    if($reply!=='')return substr($reply,0,1600);
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,1600);
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

try{
    $db=tracky_db();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'providers.use');tracky_check_csrf();$data=tracky_json();
    if(($data['action']??'')!=='lyric_search')tracky_reply(['error'=>'Unsupported music ID action'],422);
    if(($data['ownerEnabled']??false)!==true)tracky_reply(['error'=>'Owner-enabled remote lyric lookup required'],403);
    $query=tracky_music_id_query((string)($data['query']??''));
    $evidenceId=substr(preg_replace('/[^A-Za-z0-9_-]/','',(string)($data['evidenceId']??''))??'',0,96);

    $secret=tracky_provider_secret($db,'openai');
    if(!$secret)tracky_reply(['error'=>'OpenAI provider is not configured'],409);
    if(tracky_provider_circuit_open('openai'))
        tracky_reply(['error'=>'OpenAI provider temporarily paused after repeated failures'],503);

    $model='gpt-6-luna';
    $instruction='Identify a song from this short, possibly imperfect lyric transcription: "'.$query.'". '.
      'Search the public web. Return only the best candidate if the evidence is strong. '.
      'Do not reproduce lyrics, quote song text, infer a listener identity, or include private information. '.
      'If uncertain, set found=false and use empty strings for title, artist, and album.';
    $units=tracky_provider_request_units([['role'=>'user','content'=>$instruction]],180);
    try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],'openai',$units);}
    catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}

    $payload=[
      'model'=>$model,'input'=>$instruction,'store'=>false,'max_output_tokens'=>180,
      'tools'=>[['type'=>'web_search','search_context_size'=>'low']],
      'tool_choice'=>'required',
      'text'=>['format'=>[
        'type'=>'json_schema','name'=>'music_lyric_candidate','strict'=>true,
        'schema'=>[
          'type'=>'object','additionalProperties'=>false,
          'properties'=>[
            'found'=>['type'=>'boolean'],
            'title'=>['type'=>'string'],
            'artist'=>['type'=>'string'],
            'album'=>['type'=>'string'],
            'confidence'=>['type'=>'number','minimum'=>0,'maximum'=>1]
          ],
          'required'=>['found','title','artist','album','confidence']
        ]
      ]]
    ];

    try{
        $res=tracky_provider_http('https://api.openai.com/v1/responses',[
          'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
        ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.7 music-id-runtime');
        $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
        $text=tracky_music_id_output_text($decoded);
        if($text==='')throw new RuntimeException('Music lyric search returned no usable result.');
        $candidate=json_decode($text,true,32,JSON_THROW_ON_ERROR);
        $found=($candidate['found']??false)===true;
        $title=substr(trim((string)($candidate['title']??'')),0,120);
        $artist=substr(trim((string)($candidate['artist']??'')),0,120);
        $album=substr(trim((string)($candidate['album']??'')),0,120);
        $confidence=max(0,min(1,(float)($candidate['confidence']??0)));
        if(!$found||$title===''||$artist===''){
            $found=false;$title='';$artist='';$album='';$confidence=0.0;
        }
        $sources=tracky_music_id_sources($decoded);
        tracky_provider_note_success('openai');
        tracky_provider_audit($db,(int)$actor['id'],'provider.music-lyric-search','openai',$model,'success',$units);
        tracky_reply([
          'found'=>$found,'title'=>$title,'artist'=>$artist,'album'=>$album,
          'confidence'=>$confidence,'sources'=>$sources,
          'provider'=>'openai-web-search','model'=>$model,'evidenceId'=>$evidenceId,
          'budget'=>$budget
        ]);
    }catch(Throwable $e){
        tracky_provider_note_failure($db,(int)$actor['id'],'openai');
        tracky_provider_audit($db,(int)$actor['id'],'provider.music-lyric-search','openai',$model,'failed',$units);
        tracky_reply(['error'=>$e instanceof RuntimeException?$e->getMessage():'Music lyric search failed.'],502);
    }
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply(['error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException
      ?$e->getMessage():'Music ID runtime unavailable'],$status);
}
