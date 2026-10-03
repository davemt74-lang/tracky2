<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
const TRACKY_PROVIDERS=['openai','anthropic','elevenlabs'];
function tracky_secret_key(): string {
    if(!extension_loaded('sodium')) throw new RuntimeException('PHP sodium extension required for API keys.');
    $path=TRACKY_DATA.'/secret.key';
    if(!is_file($path)) {
        if(!is_dir(TRACKY_DATA)) throw new RuntimeException('Install Tracky2 first.');
        $f=fopen($path,'x');
        if($f) { try {chmod($path,0600);$key=random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES);fwrite($f,$key);}finally{fclose($f);} }
    }
    $key=@file_get_contents($path);
    if(!is_string($key)||strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES) throw new RuntimeException('Credential encryption key unavailable.');
    return $key;
}
function tracky_store_provider(PDO $db,int $actor,string $provider,string $secret): void {
    if(!in_array($provider,TRACKY_PROVIDERS,true)) throw new InvalidArgumentException('Unknown provider.');
    $secret=trim($secret);
    if(strlen($secret)<8||strlen($secret)>4096) throw new InvalidArgumentException('Invalid credential length.');
    $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher=base64_encode($nonce.sodium_crypto_secretbox($secret,$nonce,tracky_secret_key()));
    $db->prepare('INSERT INTO provider_credentials(provider,ciphertext,updated_by) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET ciphertext=excluded.ciphertext,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP')->execute([$provider,$cipher,$actor]);
    $db->prepare('INSERT INTO audit_log(actor_id,action,subject) VALUES(?,?,?)')->execute([$actor,'provider.update',$provider]);
}
function tracky_provider_secret(PDO $db,string $provider): ?string {
    if(!in_array($provider,TRACKY_PROVIDERS,true)) throw new InvalidArgumentException('Unknown provider.');
    $s=$db->prepare('SELECT ciphertext FROM provider_credentials WHERE provider=?');$s->execute([$provider]);$value=$s->fetchColumn();
    if($value===false)return null;
    $data=base64_decode($value,true);
    if($data===false||strlen($data)<=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES)throw new RuntimeException('Credential is corrupt.');
    $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain=sodium_crypto_secretbox_open(substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),$nonce,tracky_secret_key());
    if($plain===false)throw new RuntimeException('Unable to decrypt credential.');
    return $plain; // server-side integrations ONLY; never return in browser API
}
function tracky_provider_status(PDO $db): array {
    $rows=$db->query('SELECT provider,updated_at FROM provider_credentials')->fetchAll();
    $configured=[];foreach($rows as $r)$configured[$r['provider']]=$r['updated_at'];
    return array_map(static fn($name)=>['provider'=>$name,'configured'=>isset($configured[$name]),'updatedAt'=>$configured[$name]??null],TRACKY_PROVIDERS);
}
