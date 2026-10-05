<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';

const TRACKY_PROVIDERS=['openai','anthropic','elevenlabs'];
const TRACKY_PROVIDER_DAILY_REQUESTS=200;
const TRACKY_PROVIDER_DAILY_UNITS=200000;
const TRACKY_PROVIDER_SESSION_REQUESTS=60;
const TRACKY_PROVIDER_SESSION_UNITS=60000;
const TRACKY_PROVIDER_CIRCUIT_FAILURES=3;
const TRACKY_PROVIDER_CIRCUIT_MS=60000;

function tracky_provider_models(string $provider): array {
    return match($provider){
        'openai'=>['gpt-6-luna','gpt-6-sol','gpt-5.6-sol'],
        'anthropic'=>['claude-sonnet-4-5','claude-haiku-4-5','claude-opus-4-1'],
        'elevenlabs'=>['eleven_flash_v2_5','eleven_multilingual_v2'],
        default=>[]
    };
}
function tracky_provider_default_model(string $provider): string {
    return match($provider){
        'openai'=>'gpt-6-luna',
        'anthropic'=>'claude-sonnet-4-5',
        'elevenlabs'=>'eleven_flash_v2_5',
        default=>''
    };
}
function tracky_provider_model_allowed(string $provider,string $model): bool {
    return in_array($model,tracky_provider_models($provider),true);
}
function tracky_store_provider(PDO $db,int $actor,string $provider,string $secret): void {
    if(!in_array($provider,TRACKY_PROVIDERS,true)) throw new InvalidArgumentException('Unknown provider.');
    $secret=trim($secret);
    if(strlen($secret)<8||strlen($secret)>4096) throw new InvalidArgumentException('Invalid credential length.');
    $cipher=tracky_encrypt($secret);
    $db->prepare('INSERT INTO provider_credentials(provider,ciphertext,updated_by) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET ciphertext=excluded.ciphertext,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP')->execute([$provider,$cipher,$actor]);
    $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor,'provider.update',$provider]);
}
function tracky_provider_secret(PDO $db,string $provider): ?string {
    if(!in_array($provider,TRACKY_PROVIDERS,true)) throw new InvalidArgumentException('Unknown provider.');
    $s=$db->prepare('SELECT ciphertext FROM provider_credentials WHERE provider=?');$s->execute([$provider]);$value=$s->fetchColumn();
    if($value===false)return null;
    return tracky_decrypt((string)$value); // server-side integrations ONLY; never return in browser API
}
function tracky_provider_status(PDO $db): array {
    $rows=$db->query('SELECT provider,updated_at FROM provider_credentials')->fetchAll();
    $configured=[];foreach($rows as $r)$configured[$r['provider']]=$r['updated_at'];
    return array_map(static fn($name)=>[
        'provider'=>$name,'configured'=>isset($configured[$name]),
        'updatedAt'=>$configured[$name]??null,
        'models'=>tracky_provider_models($name),
        'defaultModel'=>tracky_provider_default_model($name),
        'transportAvailable'=>extension_loaded('curl')
    ],TRACKY_PROVIDERS);
}
function tracky_provider_messages(mixed $input): array {
    if(!is_array($input))throw new InvalidArgumentException('Conversation messages required.');
    $rows=[];$total=0;
    foreach(array_slice($input,-12) as $row){
        if(!is_array($row))continue;
        $role=(string)($row['role']??'');
        if(!in_array($role,['system','user','assistant'],true))continue;
        $content=preg_replace('/\s+/u',' ',trim((string)($row['content']??'')))??'';
        if($content==='')continue;
        $remaining=12000-$total;if($remaining<=0)break;
        $content=substr($content,0,min(2400,$remaining));
        $rows[]=['role'=>$role,'content'=>$content];$total+=strlen($content);
    }
    if(count($rows)<2)throw new InvalidArgumentException('Conversation messages required.');
    return $rows;
}
function tracky_provider_request_units(array $messages,int $maxOutput=180): int {
    $chars=0;foreach($messages as $row)$chars+=strlen((string)$row['content']);
    return max(1,(int)ceil($chars/4)+max(1,min(400,$maxOutput)));
}
function tracky_provider_session_usage(string $provider): array {
    tracky_session();
    $all=$_SESSION['provider_usage']??[];
    $row=is_array($all)&&isset($all[$provider])&&is_array($all[$provider])?$all[$provider]:[];
    return ['requests'=>max(0,(int)($row['requests']??0)),'units'=>max(0,(int)($row['units']??0))];
}
function tracky_provider_usage_snapshot(PDO $db,int $actor,string $provider): array {
    $day=gmdate('Y-m-d');
    $s=$db->prepare('SELECT requests,units,failures FROM provider_usage_daily WHERE actor_id=? AND provider=? AND usage_day=?');
    $s->execute([$actor,$provider,$day]);$row=$s->fetch()?:[];
    $dailyRequests=max(0,(int)($row['requests']??0));$dailyUnits=max(0,(int)($row['units']??0));
    $session=tracky_provider_session_usage($provider);
    return [
      'daily'=>[
       'requests'=>$dailyRequests,'units'=>$dailyUnits,
       'requestsRemaining'=>max(0,TRACKY_PROVIDER_DAILY_REQUESTS-$dailyRequests),
       'unitsRemaining'=>max(0,TRACKY_PROVIDER_DAILY_UNITS-$dailyUnits)
      ],
      'session'=>[
       'requests'=>$session['requests'],'units'=>$session['units'],
       'requestsRemaining'=>max(0,TRACKY_PROVIDER_SESSION_REQUESTS-$session['requests']),
       'unitsRemaining'=>max(0,TRACKY_PROVIDER_SESSION_UNITS-$session['units'])
      ]
    ];
}
function tracky_provider_consume_budget(PDO $db,int $actor,string $provider,int $units): array {
    if(!in_array($provider,TRACKY_PROVIDERS,true))throw new InvalidArgumentException('Unknown provider.');
    $units=max(1,min(12000,$units));$snapshot=tracky_provider_usage_snapshot($db,$actor,$provider);
    if($snapshot['daily']['requestsRemaining']<1||$snapshot['daily']['unitsRemaining']<$units)
        throw new RuntimeException('Daily provider budget reached.');
    if($snapshot['session']['requestsRemaining']<1||$snapshot['session']['unitsRemaining']<$units)
        throw new RuntimeException('Session provider budget reached.');
    $day=gmdate('Y-m-d');
    $db->prepare('INSERT INTO provider_usage_daily(actor_id,provider,usage_day,requests,units,failures) VALUES(?,?,?,1,?,0)
      ON CONFLICT(actor_id,provider,usage_day) DO UPDATE SET requests=requests+1,units=units+excluded.units')
      ->execute([$actor,$provider,$day,$units]);
    tracky_session();
    $all=$_SESSION['provider_usage']??[];if(!is_array($all))$all=[];
    $row=is_array($all[$provider]??null)?$all[$provider]:['requests'=>0,'units'=>0];
    $all[$provider]=['requests'=>max(0,(int)$row['requests'])+1,'units'=>max(0,(int)$row['units'])+$units];
    $_SESSION['provider_usage']=$all;
    return tracky_provider_usage_snapshot($db,$actor,$provider);
}
function tracky_provider_note_failure(PDO $db,int $actor,string $provider): void {
    $day=gmdate('Y-m-d');
    $db->prepare('UPDATE provider_usage_daily SET failures=failures+1 WHERE actor_id=? AND provider=? AND usage_day=?')
      ->execute([$actor,$provider,$day]);
    tracky_session();
    $circuits=$_SESSION['provider_circuit']??[];if(!is_array($circuits))$circuits=[];
    $row=is_array($circuits[$provider]??null)?$circuits[$provider]:['failures'=>0,'lastFailureAt'=>0];
    $circuits[$provider]=['failures'=>max(0,(int)$row['failures'])+1,'lastFailureAt'=>(int)floor(microtime(true)*1000)];
    $_SESSION['provider_circuit']=$circuits;
}
function tracky_provider_note_success(string $provider): void {
    tracky_session();
    $circuits=$_SESSION['provider_circuit']??[];if(!is_array($circuits))$circuits=[];
    unset($circuits[$provider]);$_SESSION['provider_circuit']=$circuits;
}
function tracky_provider_circuit_open(string $provider,int $nowMs=0): bool {
    tracky_session();$nowMs=$nowMs>0?$nowMs:(int)floor(microtime(true)*1000);
    $circuits=$_SESSION['provider_circuit']??[];$row=is_array($circuits)&&is_array($circuits[$provider]??null)?$circuits[$provider]:null;
    if(!$row)return false;
    $failures=max(0,(int)($row['failures']??0));$last=max(0,(int)($row['lastFailureAt']??0));
    if($last>0&&$nowMs-$last>TRACKY_PROVIDER_CIRCUIT_MS){
        unset($circuits[$provider]);$_SESSION['provider_circuit']=$circuits;return false;
    }
    return $failures>=TRACKY_PROVIDER_CIRCUIT_FAILURES;
}
function tracky_provider_audit(PDO $db,int $actor,string $action,string $provider,string $model,string $state,int $units): void {
    $subject=substr($provider.'/'.$model.'/'.$state.'/u'.$units,0,180);
    $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor,$action,$subject]);
}

function tracky_provider_http(string $url,array $headers,string $body,bool $binary=false,string $userAgent='Tracky2/0.14 provider-runtime'): array {
    if(!extension_loaded('curl'))throw new RuntimeException('Provider transport unavailable; PHP cURL extension required.');
    if(!str_starts_with($url,'https://'))throw new InvalidArgumentException('HTTPS provider endpoint required.');
    $lastStatus=0;$lastBody='';$lastError='';
    for($attempt=0;$attempt<2;$attempt++){
        $ch=curl_init($url);
        if($ch===false)throw new RuntimeException('Provider transport initialization failed.');
        curl_setopt_array($ch,[
          CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,
          CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>15,CURLOPT_MAXREDIRS=>0,
          CURLOPT_HTTPHEADER=>$headers,CURLOPT_POSTFIELDS=>$body,
          CURLOPT_USERAGENT=>$userAgent
        ]);
        if(defined('CURLOPT_PROTOCOLS'))curl_setopt($ch,CURLOPT_PROTOCOLS,CURLPROTO_HTTPS);
        $result=curl_exec($ch);$errno=curl_errno($ch);$error=curl_error($ch);
        $status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        $lastStatus=$status;$lastBody=is_string($result)?$result:'';$lastError=$error;
        if($errno===0&&$status>=200&&$status<300)return ['status'=>$status,'body'=>$lastBody,'binary'=>$binary];
        $retryable=$errno!==0||$status===429||$status>=500;
        if(!$retryable||$attempt===1)break;
        usleep(250000);
    }
    $suffix=$lastStatus>0?' HTTP '.$lastStatus:($lastError!==''?' transport error':'');
    throw new RuntimeException('Provider request failed.'.$suffix);
}
