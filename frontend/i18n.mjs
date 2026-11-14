import {rows} from './catalog.mjs';
export const LANGUAGES=['en-US','id-ID','zh-CN','ko-KR','th-TH','ar-SA'];
let locale='en-US',observer;
const originals=new WeakMap(),attributes=new WeakMap();
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=rows.filter(r=>r[0].includes('{')).map(r=>({r,regex:new RegExp('^'+r[0].split(/(\{\d+\})/).map(s=>/^\{/.test(s)?'([^·]+?)':escapeRegex(s)).join('')+'$')}));
export function translate(source,language=locale){
 const col=LANGUAGES.indexOf(language);if(col<=0)return source;
 const exact=rows.find(r=>r[0]===source);if(exact)return exact[col];
 for(const {r,regex}of patterns){const m=String(source).match(regex);if(m)return r[col].replace(/\{(\d+)\}/g,(_,i)=>m[+i+1]);}
 // Mixed badges keep identifiers, grades and numerical evidence intact.
 if(source.includes(' · '))return source.split(' · ').map(p=>translate(p,language)).join(' · ');
 return source;
}
export function changeLanguage(next){locale=LANGUAGES.includes(next)?next:'en-US';document.documentElement.lang=locale;document.documentElement.dir=locale==='ar-SA'?'rtl':'ltr';translatePage();}
export function translatePage(){
 observer?.disconnect();
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,#language,svg,.leaflet-control-attribution,[translate=no]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 let node;while(node=walker.nextNode()){const current=node.nodeValue,previous=originals.get(node);const source=previous&&previous.last===current?previous.source:current;const key=source.trim();const result=source.replace(key,translate(key));if(node.nodeValue!==result)node.nodeValue=result;originals.set(node,{source,last:result});}
 for(const el of document.querySelectorAll('[title],[aria-label],[placeholder]')){if(el.closest('[translate=no]'))continue;const stored=attributes.get(el)||{};for(const attr of ['title','aria-label','placeholder']){if(!el.hasAttribute(attr))continue;const current=el.getAttribute(attr),prior=stored[attr],source=prior?.last===current?prior.source:current;const result=translate(source);el.setAttribute(attr,result);stored[attr]={source,last:result};}attributes.set(el,stored);}
 for(const el of document.querySelectorAll('[data-country]')){try{el.textContent=new Intl.DisplayNames([locale],{type:'region'}).of(el.dataset.country);}catch{}}
 document.title=translate('Rifzki System Status');
 for(const [i,el] of [...document.querySelectorAll('.calendar-week span')].entries())el.textContent=new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+i)));

 observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
}
export function startTranslations(){locale='en-US';document.documentElement.lang=locale;document.documentElement.dir='ltr';document.getElementById('language').value=locale;observer=new MutationObserver(()=>translatePage());translatePage();}

