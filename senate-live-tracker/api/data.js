const STATES=['Maine','Ohio','Texas','Nebraska','Alaska','Iowa','Kansas','Michigan','Florida','South Carolina','New Hampshire','Minnesota','North Carolina','Georgia'];
const RACES={
'Maine':['Collins','Jackson'],'Ohio':['Husted','Brown'],'Texas':['Paxton','Talarico'],'Nebraska':['Ricketts','Osborn'],'Alaska':['Sullivan','Peltola'],'Iowa':['Hinson','Turek'],'Kansas':['Marshall','Hamilton'],'Michigan':['Rogers','El-Sayed'],'Florida':['Moody','Nixon'],'South Carolina':['Graham Nordone','Andrews'],'New Hampshire':['Sununu','Pappas'],'Minnesota':['Tafoya','Flanagan'],'North Carolina':['Whatley','Cooper'],'Georgia':['Collins','Ossoff']};
const PARTY={Collins:'R',Jackson:'D',Husted:'R',Brown:'D',Paxton:'R',Talarico:'D',Ricketts:'R',Osborn:'I',Sullivan:'R',Peltola:'D',Hinson:'R',Turek:'D',Marshall:'R',Hamilton:'D',Rogers:'R','El-Sayed':'D',Moody:'R',Nixon:'D','Graham Nordone':'R',Andrews:'D',Sununu:'R',Pappas:'D',Tafoya:'R',Flanagan:'D',Whatley:'R',Cooper:'D',Ossoff:'D'};
function strip(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
async function polls(){
 const u='https://www.realclearpolling.com/latest-polls/senate'; const html=await (await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}})).text(); const t=strip(html); const out=[];
 for(const state of STATES){const names=RACES[state]; let best=null; for(const n1 of names){for(const n2 of names){if(n1===n2)continue; const marker=`2026 ${state} Senate`; let pos=t.indexOf(marker); while(pos>=0){const seg=t.slice(pos,pos+500); if(seg.includes(n1)&&seg.includes(n2)){const nums={}; for(const n of names){const m=seg.match(new RegExp(n.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\s+(\\\\d{1,2}(?:\\\\.\\\\d+)?)')); if(m)nums[n]=+m[1];} const pm=seg.match(/Poll\\s*([^R]{2,80}?)Results/i); const sm=seg.match(/Spread\\s*([^<]{1,50}?)(?=2026|$)/i); if(Object.keys(nums).length>=2){best={state,pollster:pm?pm[1].trim():'Latest poll',candidates:names.map(n=>({name:n,party:PARTY[n],pct:nums[n]??null})),spread:sm?sm[1].trim():'',source:u};break;} pos=t.indexOf(marker,pos+marker.length)} if(best)break} if(best)break} if(best)out.push(best); else out.push({state,error:'No matching latest poll found',source:u}); }
 return out;
}
function parseJsonMaybe(x){try{return typeof x==='string'?JSON.parse(x):x}catch{return x}}
async function poly(){
 const url='https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1000'; const data=await (await fetch(url)).json(); const arr=Array.isArray(data)?data:(data.markets||[]); const out=[];
 for(const state of STATES){const names=RACES[state]; const hits=arr.filter(m=>{const q=(m.question||'').toLowerCase();return q.includes(state.toLowerCase())&&q.includes('senate')}); const candidates=[];
 for(const name of names){let match=hits.find(m=>(m.question||'').toLowerCase().includes(name.toLowerCase())); if(!match) continue; const outcomes=parseJsonMaybe(match.outcomes)||[]; const prices=parseJsonMaybe(match.outcomePrices)||[]; let p=null; if(Array.isArray(outcomes)){const i=outcomes.findIndex(x=>String(x).toLowerCase()==='yes'); if(i>=0&&prices[i]!=null)p=+prices[i]*100;} if(p==null&&match.lastTradePrice!=null)p=+match.lastTradePrice*100; candidates.push({name,party:PARTY[name],price:p,question:match.question,slug:match.slug}); }
 out.push({state,candidates,matched:hits.length,source:'https://polymarket.com'}); }
 return out;
}
module.exports=async(req,res)=>{try{const [p,m]=await Promise.allSettled([polls(),poly()]);res.status(200).json({updated:new Date().toISOString(),polls:p.status==='fulfilled'?p.value:[],markets:m.status==='fulfilled'?m.value:[],errors:[p,m].filter(x=>x.status==='rejected').map(x=>String(x.reason))});}catch(e){res.status(500).json({error:String(e)})}}
