<?php
declare(strict_types=1);
require_once __DIR__.'/providers.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tracky_skill_https_sources(array $data): array {
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
function tracky_skill_output_text(array $data): string {
    $reply=trim((string)($data['output_text']??''));
    if($reply!=='')return substr($reply,0,900);
    foreach((array)($data['output']??[]) as $item)
      foreach((array)($item['content']??[]) as $part)
        if(($part['type']??'')==='output_text'&&is_string($part['text']??null))$reply.=' '.$part['text'];
    return substr(trim($reply),0,900);
}
function tracky_skill_object(PDO $db,string $objectId,string $skill): array {
    if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$objectId))
        throw new InvalidArgumentException('Invalid object ID.');
    $s=$db->prepare("SELECT o.id,o.label,o.scene_id,o.status,o.bbox_json,s.enabled
      FROM scene_objects o JOIN object_skills s ON s.object_id=o.id
      WHERE o.id=? AND s.skill=? LIMIT 1");
    $s->execute([$objectId,$skill]);$row=$s->fetch();
    if(!$row||$row['status']!=='approved')throw new RuntimeException('Approved object required.');
    if((int)$row['enabled']!==1)throw new RuntimeException('Skill is not enabled for this object.');
    return $row;
}
function tracky_skill_audit(PDO $db,int $actor,string $skill,string $objectId,string $state,string $provider='',string $model=''): void {
    $subject=substr($skill.'/'.$objectId.'/'.$state.($provider?'/'.$provider.'/'.$model:''),0,180);
    $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')
      ->execute([$actor,'skill.execute',$subject]);
}

try{
    $db=tracky_db();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')tracky_reply(['error'=>'Method not allowed'],405);
    $actor=tracky_require($db,'skills.execute');tracky_check_csrf();$data=tracky_json();
    $skill=(string)($data['skill']??'');$objectId=(string)($data['objectId']??'');
    if($skill!=='product_search')tracky_reply(['error'=>'Unsupported executable skill'],422);
    if(!tracky_permission($db,$actor,'providers.use'))tracky_reply(['error'=>'Provider use permission required'],403);
    $object=tracky_skill_object($db,$objectId,$skill);
    $secret=tracky_provider_secret($db,'openai');
    if(!$secret)tracky_reply(['error'=>'OpenAI provider is not configured'],409);
    if(tracky_provider_circuit_open('openai'))tracky_reply(['error'=>'OpenAI provider temporarily paused after repeated failures'],503);
    $model='gpt-6-luna';
    $label=trim((string)$object['label']);
    $instruction='Search the public web for current purchasable products matching the approved object label: "'.substr($label,0,120).'". '.
      'Return a concise comparison of up to five relevant products. Do not infer a person, identity, health condition, protected trait, or private information. '.
      'Treat the label only as owner-approved object metadata.';
    $units=tracky_provider_request_units([['role'=>'user','content'=>$instruction]],260);
    try{$budget=tracky_provider_consume_budget($db,(int)$actor['id'],'openai',$units);}
    catch(RuntimeException $e){tracky_reply(['error'=>$e->getMessage()],429);}
    $payload=[
      'model'=>$model,'input'=>$instruction,'store'=>false,'max_output_tokens'=>260,
      'tools'=>[['type'=>'web_search','search_context_size'=>'low']],
      'tool_choice'=>'required'
    ];
    try{
        $res=tracky_provider_http('https://api.openai.com/v1/responses',[
          'Authorization: Bearer '.$secret,'Content-Type: application/json','Accept: application/json'
        ],json_encode($payload,JSON_THROW_ON_ERROR),false,'Tracky2/0.14.1 governed-skill-runtime');
        $decoded=json_decode($res['body'],true,64,JSON_THROW_ON_ERROR);
        $summary=tracky_skill_output_text($decoded);
        if($summary==='')throw new RuntimeException('Product search returned no usable text.');
        $sources=tracky_skill_https_sources($decoded);
        tracky_provider_note_success('openai');
        tracky_provider_audit($db,(int)$actor['id'],'provider.skill-search','openai',$model,'success',$units);
        tracky_skill_audit($db,(int)$actor['id'],$skill,$objectId,'success','openai',$model);
        tracky_reply([
          'summary'=>$summary,'sources'=>$sources,'provider'=>'openai','model'=>$model,
          'object'=>['id'=>$object['id'],'label'=>$label],'budget'=>$budget
        ]);
    }catch(Throwable $e){
        tracky_provider_note_failure($db,(int)$actor['id'],'openai');
        tracky_provider_audit($db,(int)$actor['id'],'provider.skill-search','openai',$model,'failed',$units);
        tracky_skill_audit($db,(int)$actor['id'],$skill,$objectId,'failed','openai',$model);
        tracky_reply(['error'=>$e instanceof RuntimeException?$e->getMessage():'Product search failed.'],502);
    }
}catch(Throwable $e){
    $status=http_response_code();if($status<400)$status=503;
    tracky_reply(['error'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException?$e->getMessage():'Skill runtime unavailable'],$status);
}
