import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import {assessSecurity,emailPolicy,parseTxt} from './security-model.mjs';
const TIMEOUT=7000;
const allowedHost=host=>host==='rifzki.my.id'||/^[a-z0-9-]+\.rifzki\.my\.id$/.test(host);
const publicHeaders=headers=>Object.fromEntries(['strict-transport-security','content-security-policy','x-frame-options','x-content-type-options','alt-svc'].filter(k=>headers[k]!==undefined).map(k=>[k,String(headers[k])]));
export function requestEndpoint(url,{family,body=false,redirects=3,timeout=TIMEOUT}={}){
  return new Promise(resolve=>{
    const target=new URL(url);if(!allowedHost(target.hostname)||!['http:','https:'].includes(target.protocol)||target.port&&!['80','443'].includes(target.port)){resolve({reachable:null,reason:'Target is outside the endpoint allowlist.'});return;}
    const started=performance.now();const transport=target.protocol==='https:'?https:http;
    let finished=false;const finish=value=>{if(!finished){finished=true;resolve({...value,responseTime:Math.round(performance.now()-started)});}};
    const req=transport.get(target,{family,signal:AbortSignal.timeout(timeout),headers:{'User-Agent':'Rifzki-System-Status/1.0',Accept:body?'text/plain':'*/*'},rejectUnauthorized:true},res=>{
      const code=res.statusCode||0,headers=res.headers;let location=null;try{location=headers.location?new URL(headers.location,target):null;}catch{}
      if(body&&location&&redirects>0&&location.hostname===target.hostname&&location.protocol==='https:'){
        res.destroy();requestEndpoint(location,{family,body,redirects:redirects-1,timeout}).then(finish);return;
      }
      const result={reachable:true,code,httpVersion:res.httpVersion,headers:publicHeaders(headers),redirect:location?.href||null,contentType:String(headers['content-type']||'')};
      if(!body){res.destroy();finish(result);return;}
      let size=0,parts=[];res.on('data',chunk=>{size+=chunk.length;if(size>32768){res.destroy();finish({...result,body:'',unavailable:true,reason:'Policy exceeds the 32 KiB inspection limit.'});}else parts.push(chunk);});
      res.on('end',()=>finish({...result,body:Buffer.concat(parts).toString('utf8')}));res.on('error',()=>finish({...result,body:'',unavailable:true}));
    });
    req.setTimeout(timeout,()=>{req.destroy(Object.assign(new Error('timeout'),{code:'ETIMEDOUT'}));});
    req.on('error',e=>finish({reachable:['ENETUNREACH','EAFNOSUPPORT','ETIMEDOUT','ABORT_ERR','EAI_AGAIN'].includes(e.code)?null:false,unavailable:true,reason:family===6&&['ENETUNREACH','EAFNOSUPPORT'].includes(e.code)?'The inspection runner has no usable IPv6 route.':'The request did not produce a verified response.'}));
  });
}
export function inspectTls(host){return new Promise(resolve=>{
  let finished=false;const done=value=>{if(!finished){finished=true;socket.destroy();resolve(value);}};
  const socket=tls.connect({host,port:443,servername:host,rejectUnauthorized:true,ALPNProtocols:['h2','http/1.1']},()=>{
    const cert=socket.getPeerCertificate(),cipher=socket.getCipher();
    const cipherName=cipher.standardName||cipher.name||'',cipherBits=/CHACHA20/.test(cipherName)?256:Number(cipherName.match(/AES[_-]?(128|256)/)?.[1]||0);
    done({valid:true,protocol:socket.getProtocol(),alpn:socket.alpnProtocol||null,cipherBits,keyBits:cert.bits||0,keyType:cert.asn1Curve?'ec':'rsa',expires:cert.valid_to?new Date(cert.valid_to).toISOString():null,issuer:cert.issuer?.O||cert.issuer?.CN||null,fingerprint:cert.fingerprint256||null});
  });
  socket.setTimeout(TIMEOUT,()=>done({valid:null,reason:'TLS verification timed out.'}));
  socket.on('error',e=>{let cert={};try{cert=socket.getPeerCertificate()||{};}catch{}done({valid:['CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(e.code)?false:null,errorCode:e.code,expires:cert.valid_to?new Date(cert.valid_to).toISOString():null,issuer:cert.issuer?.O||cert.issuer?.CN||null,reason:'TLS verification did not complete.'});});
});}
export async function dnsQuery(host,type,fetcher=fetch){
  try{const url=new URL('https://dns.google/resolve');url.search=new URLSearchParams({name:host,type,do:'1',cd:'0',edns_client_subnet:'0.0.0.0/0'}).toString();const r=await fetcher(url,{signal:AbortSignal.timeout(TIMEOUT)});if(!r.ok)return null;return await r.json();}catch{return null;}
}
async function gradeAssessment(host,fingerprint){
  // Optional trusted scanner must return a current certificate-matched assessment.
  const base=process.env.SSL_ASSESSMENT_URL;if(!base)return null;
  try{const url=new URL(base);if(url.protocol!=='https:')return null;url.searchParams.set('host',host);const r=await fetch(url,{signal:AbortSignal.timeout(TIMEOUT),headers:process.env.SSL_ASSESSMENT_TOKEN?{Authorization:'Bearer '+process.env.SSL_ASSESSMENT_TOKEN}:{}});if(!r.ok)return null;const result=await r.json();if(result.host!==host||result.fingerprint!==fingerprint||!['A+','A','A-','B','C','D','E','F','T','M'].includes(result.grade))return null;return result;}catch{return null;}
}
export async function inspectEndpoint(endpoint){
  const host=endpoint.host;if(!allowedHost(host))throw Error('Invalid inspection hostname');
  const checkedAt=new Date().toISOString();
  const [secure,insecure,certificate,a,aaaa,txt,dmarcExact,securityTxt]=await Promise.all([
    requestEndpoint('https://'+host),requestEndpoint('http://'+host),inspectTls(host),dnsQuery(host,'A'),dnsQuery(host,'AAAA'),dnsQuery(host,'TXT'),dnsQuery('_dmarc.'+host,'TXT'),requestEndpoint('https://'+host+'/.well-known/security.txt',{body:true})
  ]);
  let dmarc=dmarcExact,dmarcInherited=false;
  if(host!=='rifzki.my.id'&&dmarcExact&&[0,3].includes(dmarcExact.Status)&&!parseTxt(dmarcExact.Answer).some(v=>/^v=DMARC1/i.test(v))){dmarc=await dnsQuery('_dmarc.rifzki.my.id','TXT');dmarcInherited=!!dmarc&&emailPolicy(dmarc.Answer,'dmarc');}
  const addresses=aaaa?.Answer?.filter(a=>a.type===28)||[];
  const ipv6=!aaaa||![0,3].includes(aaaa.Status)?{reachable:null,reason:'AAAA lookup could not be verified.'}:!addresses.length?{reachable:false,reason:'No AAAA record was returned.'}:await requestEndpoint('https://'+host,{family:6});
  const assessment=await gradeAssessment(host,certificate.fingerprint);
  const evidence={checkedAt,https:secure,http:insecure,tls:certificate,dns:{a,aaaa,txt,dmarc,dmarcInherited},ipv6,securityTxt,assessment};
  const security=assessSecurity(evidence);
  const redirectToHttps=!!insecure.redirect&&new URL(insecure.redirect).protocol==='https:'&&new URL(insecure.redirect).hostname===host&&[301,302,303,307,308].includes(insecure.code);
  return {security,http:{httpsReachable:secure.reachable,code:secure.code||null,redirectToHttps:insecure.reachable?redirectToHttps:null,protocol:certificate.alpn==='h2'?'HTTP/2':secure.httpVersion?'HTTP/'+secure.httpVersion:null,http3Advertised:/\bh3(?:-|=)/.test(secure.headers?.['alt-svc']||''),responseTime:secure.reachable?secure.responseTime:null},ssl:{...certificate,checkedAt,grade:security.grade},lastUpdated:checkedAt,status:secure.reachable===true&&secure.code>=200&&secure.code<400?'up':secure.reachable===null?'unknown':'down',responseTime:secure.reachable?secure.responseTime:null};
}
