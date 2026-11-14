const check=(id,label,group,status,detail)=>({id,label,group,status,detail});
export function securityScore(checks){
  const passed=checks.filter(c=>c.status==='pass').length,unknown=checks.filter(c=>c.status==='unknown').length;
  const tone=passed>=8?'green':passed+unknown<5?'red':passed>=5&&passed+unknown<8?'amber':'muted';
  return {passed,total:10,unknown,complete:unknown===0,tone,label:unknown?'Partial':passed===10?'Perfect':passed>=8?'Good':passed>=5?'Needs attention':'At risk'};
}
export function parseTxt(records){return (records||[]).filter(a=>a.type===16).map(a=>String(a.data).replace(/"\s*"/g,'').replace(/^"|"$/g,''));}
export function emailPolicy(records,kind){
  const list=parseTxt(records).filter(v=>kind==='spf'?/^v=spf1(?:\s|$)/i.test(v):/^v=DMARC1\s*;/i.test(v));
  if(list.length!==1)return false;
  return kind==='spf'?/\s(?:[-~?+]?all|redirect=\S+)(?:\s|$)/i.test(list[0]):/;\s*p\s*=\s*(none|quarantine|reject)(?:\s*;|\s*$)/i.test(list[0]);
}
export function securityTxtValid(content,type,now=new Date()){
  if(!/^text\/plain\b/i.test(type||''))return false;
  const contact=/^Contact:\s*(?:mailto:|https:\/\/|tel:)\S+/im.test(content||'');
  const expires=(content||'').match(/^Expires:\s*(.+)$/im)?.[1];
  return contact&&Number.isFinite(Date.parse(expires))&&Date.parse(expires)>+now;
}
export function assessSecurity(evidence,now=new Date()){
  const {https,http,tls,dns,ipv6,securityTxt,assessment}=evidence;
  const tlsStrong=tls?.valid===true&&['TLSv1.2','TLSv1.3'].includes(tls.protocol)&&Number(tls.cipherBits)>=128&&Number(tls.keyBits)>=(tls.keyType==='ec'?256:2048);
  const age=+now-Date.parse(assessment?.checkedAt);
  const grade=assessment?.grade&&assessment.fingerprint===tls?.fingerprint&&age>=0&&age<86400000?assessment.grade:null;
  const gradeStatus=tls?.valid===false?'fail':!grade?'unknown':tlsStrong&&/^(A\+?|A-|B)$/.test(grade)?'pass':'fail';
  const h=https?.headers||{},headersKnown=!!https?.reachable;
  const yesNo=v=>v===true?'pass':v===false?'fail':'unknown';
  const dnsState=(answer,predicate)=>!answer||![0,3].includes(answer.Status)?'unknown':predicate(answer)?'pass':'fail';
  const framePolicy=(h['content-security-policy']||'').match(/frame-ancestors\s+([^;]+)/i)?.[1]?.trim();
  const frame=/^(DENY|SAMEORIGIN)$/i.test(h['x-frame-options']||'')||!!framePolicy&&!framePolicy.split(/\s+/).includes('*');
  const checks=[
    check('https','HTTPS Reachable','HTTP Headers',yesNo(https?.reachable),https?.code?`HTTPS responded with HTTP ${https.code}.`:'No verified HTTPS response.'),
    check('ssl','SSL Grade A/B & Strong TLS','Network (SSL & DNS/IPv6)',gradeStatus,grade?`Verified grade ${grade}; negotiated ${tls?.protocol||'unknown'}.`:tlsStrong?'Strong TLS negotiated; a full certificate-matched grade assessment is not configured.':'A full TLS grade has not been verified.'),
    check('hsts','HSTS','HTTP Headers',headersKnown?yesNo(/(?:^|;)\s*max-age\s*=\s*[1-9]\d*/i.test(h['strict-transport-security']||'')):'unknown','Checks an enforcing Strict-Transport-Security max-age.'),
    check('csp','Content-Security-Policy','HTTP Headers',headersKnown?yesNo(!!h['content-security-policy']?.trim()):'unknown','Checks the enforcing CSP header; report-only is not counted.'),
    check('headers','Frame protection & nosniff','HTTP Headers',headersKnown?yesNo(frame&&/^nosniff$/i.test(h['x-content-type-options']||'')):'unknown','Requires frame protection plus X-Content-Type-Options: nosniff.'),
    check('dnssec','DNSSEC Enabled','Network (SSL & DNS/IPv6)',dnsState(dns?.a,a=>a.AD===true),'Checks authenticated DNS response validation, not just the presence of a DNSKEY.'),
    check('ipv6','IPv6 Record & Reachability','Network (SSL & DNS/IPv6)',yesNo(ipv6?.reachable),ipv6?.reason||'Requires an AAAA record and an observed IPv6 HTTPS response.'),
    check('spf','SPF Record','Email Auth (SPF/DMARC)',dnsState(dns?.txt,a=>emailPolicy(a.Answer,'spf')),'SPF is checked at this exact hostname; parent SPF is not inherited.'),
    check('dmarc','DMARC Record','Email Auth (SPF/DMARC)',dnsState(dns?.dmarc,a=>emailPolicy(a.Answer,'dmarc')),dns?.dmarcInherited?'An organizational-domain DMARC policy applies to this subdomain.':'Checks a valid DMARC policy at this hostname.'),
    check('securitytxt','security.txt Published','security.txt',securityTxt?.unavailable?'unknown':yesNo(securityTxt?.code===200&&securityTxtValid(securityTxt.body,securityTxt.contentType,now)),'Requires a text/plain policy with Contact and a future Expires date.')
  ];
  return {source:'Rifzki Security Inspector',checkedAt:evidence.checkedAt,grade:grade||null,strongTls:tlsStrong,checks,score:securityScore(checks)};
}
