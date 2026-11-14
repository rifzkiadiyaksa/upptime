import {createHash} from 'node:crypto';
export function buildArchive(incidents,maintenance=[],now=new Date(),pageSize=8){
 const entries=[...incidents.map(i=>({...i,kind:'incident',start:i.created,end:i.closed||now.toISOString()})),...maintenance.map(m=>({...m,kind:'maintenance',number:m.id,start:m.start,end:m.end}))].filter(i=>Number.isFinite(Date.parse(i.start))&&Number.isFinite(Date.parse(i.end)));
 const version=createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,16),files={},months={};
 if(!entries.length)return {index:{version,pageSize,months},files};
 const first=new Date(Math.min(...entries.map(i=>Date.parse(i.start))));let cursor=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1));
 const last=Math.max(+now,...entries.map(i=>Date.parse(i.end)));
 const put=(key,items)=>{const pages=Math.ceil(items.length/pageSize);for(let page=1;page<=pages;page++)files[`archive/${version}/${key}/${page}.json`]={version,page,total:items.length,entries:items.slice((page-1)*pageSize,page*pageSize)};return pages;};
 while(+cursor<=last){const key=cursor.toISOString().slice(0,7),next=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));const list=entries.filter(i=>Date.parse(i.start)<+next&&Date.parse(i.end)>=+cursor).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));if(list.length){const meta={total:list.length,pages:put(key,list),days:{}};for(let day=1;day<=new Date(+next-1).getUTCDate();day++){const date=key+'-'+String(day).padStart(2,'0'),start=Date.parse(date+'T00:00:00Z');const daily=list.filter(i=>Date.parse(i.start)<start+86400000&&Date.parse(i.end)>=start);if(daily.length)meta.days[date]={total:daily.length,pages:put(date,daily),incident:daily.some(i=>i.kind==='incident'),maintenance:daily.some(i=>i.kind==='maintenance')};}months[key]=meta;}cursor=next;}
 return {index:{version,pageSize,months},files};
}
