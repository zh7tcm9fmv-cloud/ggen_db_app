/* Team Builder — lazy-loaded via __GGEN_LAZY__.ensureTeamBuilder */
(function(global){
'use strict';
// Uses app.js globals: S, t, esc, imgUrl, fetchJsonWithWarmupRetry, _sc*, _dc*, picker cells, etc.
const TB_FORMS_KEY='ggen_tb_forms';
const TB_TRASH_ICON='/static/images/UI/UI_Common_BtnIcon_Trash.webp';
const TB_LEADER_ICON='/static/images/UI/UI_Organization_Icon_SupporterLeader_Posi.webp';
const TB_LONG_PORTRAIT_FACE_IDS=new Set(['1370000150']);
function _tbEmptySlot(){return{unitId:null,unitData:null,charId:null,charData:null,optionParts:[],lbTier:3,unitStatMode:'normal',unitCondPassive:false,charCondPassive:false,unitTurnBuffAtk:false,unitTurnBuffDef:false,exSquadAtkPct:0}}
function _tbTerrainItems(){return['Space','Atmospheric','Ground','Sea','Underwater']}
function tbClearSupporter(side){
initTeamBuilder();
const s=side|0;
if(s!==1&&s!==2)return;
S.tb.supBySide[s]={id:null,data:null,lbTier:3,level:100};
S.tb._leaderApplyCache={};
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function tbClearSquad(side){
initTeamBuilder();
const s=side|0;
if(s!==1&&s!==2)return;
const squ=S.tb.squads[s];
if(!squ||!Array.isArray(squ.slots))return;
for(let i=0;i<5;i++)squ.slots[i]=_tbEmptySlot();
S.tb._leaderApplyCache={};
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function initTeamBuilder(){
if(!S.tb){
S.tb={squads:{1:{name:'',slots:Array.from({length:5},()=>_tbEmptySlot())},2:{name:'',slots:Array.from({length:5},()=>_tbEmptySlot())}},terrainType:'Space',supBySide:{1:{id:null,data:null,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}},selectedKey:null,rearrange:null,picker:{type:null,slotKey:null,abort:null,gen:0,rows:[],opReplaceIdx:null},masterLeague:false,grandOffensive:false,_leaderApplyCache:{}};
return;
}
if(!S.tb.supBySide){
const legId=S.tb.supporterId!=null?S.tb.supporterId:null;
const legData=S.tb.supporterData||null;
S.tb.supBySide={1:{id:legId,data:legData,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}};
delete S.tb.supporterId;delete S.tb.supporterData;
}else{
for(const ss of[1,2]){const e=S.tb.supBySide[ss];if(e){if(e.lbTier==null)e.lbTier=3;if(e.level==null)e.level=100}}
}
for(const side of[1,2]){
const w=S.tb.squads&&S.tb.squads[side];
if(!w||!Array.isArray(w.slots))continue;
if(w.name==null)w.name='';
if(w.slots.length===5)continue;
const next=w.slots.slice(0,5);
while(next.length<5)next.push(_tbEmptySlot());
w.slots=next;
}
delete S.tb.activeSquad;
}
function _tbReadFormations(){try{const s=localStorage.getItem(TB_FORMS_KEY);const a=JSON.parse(s);if(!Array.isArray(a)||a.length<5)throw 0;return a.map((x,i)=>({name:String((x&&x.name)||'').trim()||('Formation '+(i+1)),data:x&&x.data||null}))}catch(_){return Array.from({length:5},(_,i)=>({name:'Formation '+(i+1),data:null}))}}
function _tbWriteFormations(arr){try{localStorage.setItem(TB_FORMS_KEY,JSON.stringify(arr))}catch(_){}}
function _tbSlotToSave(sl){const o={unitId:sl.unitId,charId:sl.charId,optionPartIds:(sl.optionParts||[]).slice(0,1).map(p=>String(p&&p.id||'')).filter(Boolean),lbTier:sl.lbTier|0,unitCondPassive:!!sl.unitCondPassive,charCondPassive:!!sl.charCondPassive,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,exSquadAtkPct:sl.exSquadAtkPct|0};if((sl.unitStatMode||'normal')!=='normal')o.um=sl.unitStatMode;if(sl.unitTurnBuffDef)o.utd=1;return o}
function tbSnapshot(){initTeamBuilder();return{v:1,terrainType:S.tb.terrainType,masterLeague:!!S.tb.masterLeague,grandOffensive:!!S.tb.grandOffensive,supporter1:S.tb.supBySide[1].id,supporter2:S.tb.supBySide[2].id,supLb1:S.tb.supBySide[1].lbTier!=null?S.tb.supBySide[1].lbTier|0:3,supLb2:S.tb.supBySide[2].lbTier!=null?S.tb.supBySide[2].lbTier|0:3,supLv1:S.tb.supBySide[1].level!=null?Math.min(100,Math.max(1,S.tb.supBySide[1].level|0)):100,supLv2:S.tb.supBySide[2].level!=null?Math.min(100,Math.max(1,S.tb.supBySide[2].level|0)):100,squads:{1:{name:String(S.tb.squads[1].name||'').trim().slice(0,40),slots:S.tb.squads[1].slots.map(_tbSlotToSave)},2:{name:String(S.tb.squads[2].name||'').trim().slice(0,40),slots:S.tb.squads[2].slots.map(_tbSlotToSave)}}}}
const _TB_TERRAIN_IDX=['Space','Atmospheric','Ground','Sea','Underwater'];
function _tbU8ToB64Url(u8){
let bin='';
for(let i=0;i<u8.length;i++)bin+=String.fromCharCode(u8[i]);
return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _tbB64UrlToU8(s){
if(!s)return new Uint8Array(0);
let pad=String(s).replace(/-/g,'+').replace(/_/g,'/');
while(pad.length%4)pad+='=';
const bin=atob(pad);
const u8=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
return u8;
}
function _tbEncShareSlot(sl){
if(!sl||!sl.unitId)return null;
const o=_tbSlotToSave(sl);
const u=String(o.unitId),c=o.charId?String(o.charId):'',op=(o.optionPartIds&&o.optionPartIds[0])?String(o.optionPartIds[0]):'';
const l=o.lbTier|0,f=(o.unitCondPassive?1:0)|(o.charCondPassive?2:0)|(o.unitTurnBuffAtk?4:0)|(o.utd?8:0),x=o.exSquadAtkPct|0;
const um=o.um==='sp'?1:o.um==='ssp'?2:0;
const a=[u,c,op,l,f,x,um];
while(a.length>6&&a[6]===0)a.pop();
while(a.length>5&&a[5]===0)a.pop();
while(a.length>4&&a[4]===0)a.pop();
while(a.length>3&&a[3]===3)a.pop();
while(a.length>2&&a[2]==='')a.pop();
while(a.length>1&&a[1]==='')a.pop();
return a;
}
function _tbDecShareSlot(a){
if(a==null)return null;
if(typeof a==='string')a=[a];
if(!Array.isArray(a)||!a.length)return null;
const u=a[0];if(!u)return null;
const c=a.length>1?String(a[1]||''):'';
const op=a.length>2?String(a[2]||''):'';
const l=a.length>3?a[3]|0:3;
const f=a.length>4?a[4]|0:0;
const x=a.length>5?a[5]|0:0;
const um=a.length>6?a[6]|0:0;
const umStr=um===1?'sp':um===2?'ssp':'normal';
const out={unitId:String(u),charId:c||null,optionPartIds:op?[op]:[],lbTier:l,unitCondPassive:!!(f&1),charCondPassive:!!(f&2),unitTurnBuffAtk:!!(f&4),exSquadAtkPct:x};
if(f&8)out.utd=1;
if(umStr!=='normal')out.um=umStr;
return out;
}
function _tbPackShareSup(ss){
const e=S.tb.supBySide[ss];
if(!e||!e.id)return null;
const id=String(e.id),lb=e.lbTier|0,lv=Math.min(100,Math.max(1,e.level|0));
if(lb===3&&lv===100)return id;
if(lv===100)return[id,lb];
return[id,lb,lv];
}
function _tbUnpackShareSup(x){
if(x==null)return{id:null,lbTier:3,level:100};
if(typeof x==='string')return{id:x,lbTier:3,level:100};
if(!Array.isArray(x)||!x.length)return{id:null,lbTier:3,level:100};
const id=x[0]!=null?String(x[0]):null;
const lb=x.length>1?x[1]|0:3;
const lv=x.length>2?x[2]|0:100;
return{id,lbTier:lb,level:Math.min(100,Math.max(1,lv))};
}
function _tbSnapshotCompactV2(){
initTeamBuilder();
const te=Math.max(0,_TB_TERRAIN_IDX.indexOf(S.tb.terrainType||'Space'));
const s1=_tbPackShareSup(1),s2=_tbPackShareSup(2);
const slotsTrim=(slots)=>{
const enc=slots.map(_tbEncShareSlot);
while(enc.length&&enc[enc.length-1]==null)enc.pop();
return enc;
};
const q=[
[String(S.tb.squads[1].name||'').trim().slice(0,40),slotsTrim(S.tb.squads[1].slots)],
[String(S.tb.squads[2].name||'').trim().slice(0,40),slotsTrim(S.tb.squads[2].slots)]
];
const o={v:2,q:q};
if(S.tb.masterLeague)o.m=1;
if(S.tb.grandOffensive)o.g=1;
if(te!==0)o.e=te;
if(s1!=null||s2!=null)o.s=[s1,s2];
return o;
}
function _tbExpandSnapshotV2(z){
if(!z||z.v!==2)return null;
const terrainType=_TB_TERRAIN_IDX[z.e!=null?z.e|0:0]||'Space';
const s=z.s;
const p1=_tbUnpackShareSup(s&&s[0]),p2=_tbUnpackShareSup(s&&s[1]);
const q=z.q||[[],[]];
const n1=q[0]&&q[0][0]!=null?String(q[0][0]).slice(0,40):'';
const n2=q[1]&&q[1][0]!=null?String(q[1][0]).slice(0,40):'';
const raw1=(q[0]&&q[0][1])||[];
const raw2=(q[1]&&q[1][1])||[];
const pad5=(arr)=>{
const out=[];
for(let i=0;i<5;i++)out.push(_tbDecShareSlot(arr&&arr[i]!=null?arr[i]:null));
return out;
};
return{v:1,terrainType,masterLeague:!!z.m,grandOffensive:!!z.g,supporter1:p1.id,supporter2:p2.id,supLb1:p1.lbTier,supLb2:p2.lbTier,supLv1:p1.level,supLv2:p2.level,squads:{1:{name:n1,slots:pad5(raw1)},2:{name:n2,slots:pad5(raw2)}}};
}
async function _tbDecodeTeamShare(b64){
const u8=_tbB64UrlToU8(b64);
if(!u8.length)return null;
if(u8[0]===0x7b){
try{return JSON.parse(new TextDecoder().decode(u8))}catch(_){return null}
}
const kind=u8[0],body=u8.slice(1);
if(kind===1){
try{
if(typeof DecompressionStream==='undefined')return null;
const ds=new DecompressionStream('deflate');
const stream=new Blob([body]).stream().pipeThrough(ds);
const out=await new Response(stream).arrayBuffer();
return JSON.parse(new TextDecoder().decode(out));
}catch(_){return null}
}
if(kind===2){
try{return JSON.parse(new TextDecoder().decode(body))}catch(_){return null}
}
return null;
}
async function _tbBuildShareUrl(){
initTeamBuilder();
let finalU8;
try{
const compact=_tbSnapshotCompactV2();
const json=JSON.stringify(compact);
const bytes=new TextEncoder().encode(json);
if(typeof CompressionStream!=='undefined'){
try{
const cs=new CompressionStream('deflate');
const blob=new Blob([bytes]).stream().pipeThrough(cs);
const comp=new Uint8Array(await new Response(blob).arrayBuffer());
if(comp.length+1<bytes.length){
finalU8=new Uint8Array(1+comp.length);
finalU8[0]=1;
finalU8.set(comp,1);
}else{
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}catch(_){
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}else{
finalU8=new Uint8Array(1+bytes.length);
finalU8[0]=2;
finalU8.set(bytes,1);
}
}catch(_){return''}
const enc=_tbU8ToB64Url(finalU8);
if(!enc)return'';
const u=new URL(location.origin+location.pathname);
u.searchParams.set('tab','TB');
u.searchParams.set('team',enc);
return u.toString()
}
function tbSyncSquadNameFromFormation(side,inp){
if(!inp)return;
initTeamBuilder();
S.tb.squads[side|0].name=String(inp.value||'').trim().slice(0,40);
inp.value=S.tb.squads[side|0].name;
tbSyncSquadLabels();
}
function _tbFormationOptionPartsHtmlForSquad(si){
initTeamBuilder();
const seen=new Map();
const squ=S.tb.squads[si];
for(let i=0;i<5;i++){
const sl=squ.slots[i];
(sl.optionParts||[]).forEach(p=>{if(!p||p.id==null)return;const id=String(p.id);if(seen.has(id))return;seen.set(id,p)});
}
if(!seen.size)return'';
const rows=[...seen.values()].map(p=>{
const th=p.thum?`<img class="tb-fpv-op-thum" src="${imgUrl(p.thum)}" alt="" loading="lazy">`:'';
return`<li class="tb-fpv-op-li">${th}<span class="tb-fpv-op-name">${esc(p.name||p.id||'')}</span></li>`;
}).join('');
const squadLabel=si===1?t('tb_squad1'):t('tb_squad2');
return`<div class="tb-fpv-opsec tb-fpv-opsec--squad"><div class="tb-fpv-op-title">${esc(squadLabel)} — ${esc(t('tb_option_parts_used'))}</div><ul class="tb-fpv-op-list">${rows}</ul></div>`;
}
function tbRenderFormationPreview(){
initTeamBuilder();
const root=document.getElementById('tbFormationPreview');
if(!root)return;
function pairHtml(sl){
const ud=sl&&sl.unitData;
const cd=sl&&sl.charData;
const uSrc=ud&&(ud.thum||ud.portrait);
const cSrc=cd&&(cd.portrait||cd.thum);
const uInner=uSrc?imgTag(uSrc,{cls:'tb-fpv-unit',webp:true,alt:'',loading:'lazy'}):'<div class="tb-fpv-empty">+</div>';
const cInner=cSrc?imgTag(cSrc,{cls:'tb-fpv-pilot',webp:true,alt:'',loading:'lazy'}):'<div class="tb-fpv-empty tb-fpv-empty--sm">+</div>';
return`<div class="tb-fpv-pair"><div class="tb-fpv-cell">${uInner}</div><div class="tb-fpv-cell">${cInner}</div></div>`;
}
function squadBlock(side){
const squ=S.tb.squads[side];
const ent=S.tb.supBySide[side];
let pairs='';
for(let i=0;i<5;i++)pairs+=pairHtml(squ.slots[i]);
const supCard=ent&&ent.data?renderTbSupporterPortraitOnly(ent.data,72):`<div class="tb-fpv-supp-empty">—</div>`;
const nm=String(squ.name||'').slice(0,40);
const ph=t('tb_squad_name_ph');
return`<div class="tb-fpv-squad"><div class="tb-fpv-squad-head"><input type="text" class="tb-fpv-name-input" maxlength="40" value="${escAttr(nm)}" placeholder="${escAttr(ph)}" aria-label="${escAttr(ph)}" onblur="tbSyncSquadNameFromFormation(${side},this)"></div><div class="tb-fpv-squad-row"><div class="tb-fpv-pairs">${pairs}</div><div class="tb-fpv-supp"><div class="tb-fpv-supp-lbl">${esc(t('tab_supporter'))}</div>${supCard}</div></div></div>`;
}
root.innerHTML=`<div id="tbFormationPreviewRoot" class="tb-fpv-root">${squadBlock(1)+_tbFormationOptionPartsHtmlForSquad(1)+squadBlock(2)+_tbFormationOptionPartsHtmlForSquad(2)}</div>`;
}
async function tbFormationCopyLink(){
const url=await _tbBuildShareUrl();
if(!url)return;
try{
await navigator.clipboard.writeText(url);
const b=document.getElementById('tbFormCopyLinkBtn');
if(b){b.textContent=t('tb_link_copied');setTimeout(()=>{b.textContent=t('tb_copy_link')},1700)}
}catch(_){
try{window.prompt(t('tb_copy_link'),url)}catch(__){}
}
}
function _tbEnsureHtml2Canvas(){
return new Promise((resolve,reject)=>{
if(typeof window.html2canvas==='function')return resolve(window.html2canvas);
const ex=document.getElementById('tbHtml2CanvasScript');
if(ex){
const t0=Date.now();
const iv=setInterval(()=>{
if(typeof window.html2canvas==='function'){clearInterval(iv);resolve(window.html2canvas)}
else if(Date.now()-t0>20000){clearInterval(iv);reject(new Error('timeout'))}
},40);
return;
}
const s=document.createElement('script');
s.id='tbHtml2CanvasScript';
s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
s.onload=()=>resolve(window.html2canvas);
s.onerror=()=>reject(new Error('load'));
document.head.appendChild(s);
});
}
async function tbFormationScreenshot(){
const host=document.getElementById('tbFormationPreviewRoot');
if(!host)return;
try{
const html2canvas=await _tbEnsureHtml2Canvas();
if(typeof html2canvas!=='function')throw new Error('html2canvas');
const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
const c=await html2canvas(host,{backgroundColor:'#0f172a',scale,useCORS:true,allowTaint:false,logging:false});
const a=document.createElement('a');
a.download='team-formation.png';
a.href=c.toDataURL('image/png');
a.click();
}catch(e){alert(t('tb_screenshot_fail')+(e&&e.message?': '+e.message:''))}
}
async function tbApplySnapshot(snap){
if(!snap||snap.v!==1)return;
initTeamBuilder();
S.tb.terrainType=snap.terrainType||'Space';
S.tb.masterLeague=!!snap.masterLeague;
S.tb.grandOffensive=!!snap.grandOffensive;
S.tb.supBySide={1:{id:null,data:null,lbTier:3,level:100},2:{id:null,data:null,lbTier:3,level:100}};
const sid1=snap.supporter1!=null?snap.supporter1:snap.supporterId;
const sid2=snap.supporter2;
if(sid1)S.tb.supBySide[1].id=String(sid1);
if(sid2)S.tb.supBySide[2].id=String(sid2);
if(snap.supLb1!=null)S.tb.supBySide[1].lbTier=Math.min(3,Math.max(0,snap.supLb1|0));
if(snap.supLb2!=null)S.tb.supBySide[2].lbTier=Math.min(3,Math.max(0,snap.supLb2|0));
if(snap.supLv1!=null)S.tb.supBySide[1].level=Math.min(100,Math.max(1,snap.supLv1|0));
if(snap.supLv2!=null)S.tb.supBySide[2].level=Math.min(100,Math.max(1,snap.supLv2|0));
S.tb._leaderApplyCache={};
function blank(){return Array.from({length:5},()=>_tbEmptySlot())}
const s1=(snap.squads&&snap.squads[1]&&snap.squads[1].slots)||[];
const s2=(snap.squads&&snap.squads[2]&&snap.squads[2].slots)||[];
S.tb.squads[1].slots=blank();
S.tb.squads[2].slots=blank();
const n1=snap.squads&&snap.squads[1]&&snap.squads[1].name!=null?String(snap.squads[1].name).trim().slice(0,40):'';
const n2=snap.squads&&snap.squads[2]&&snap.squads[2].name!=null?String(snap.squads[2].name).trim().slice(0,40):'';
S.tb.squads[1].name=n1;S.tb.squads[2].name=n2;
async function hydrateSlot(sideIdx,i,o){
if(!o)return;
const sl=S.tb.squads[sideIdx].slots[i];
sl.lbTier=o.lbTier!=null?o.lbTier:3;const um=o.um;if(um==='normal'||um==='sp'||um==='ssp')sl.unitStatMode=um;else sl.unitStatMode='normal';sl.unitCondPassive=!!o.unitCondPassive;sl.charCondPassive=!!o.charCondPassive;sl.unitTurnBuffAtk=!!o.unitTurnBuffAtk;sl.unitTurnBuffDef=!!o.utd||!!o.unitTurnBuffDef;sl.exSquadAtkPct=o.exSquadAtkPct|0;
const uid=o.unitId?String(o.unitId):'';
const cid=o.charId?String(o.charId):'';
const unitP=uid?fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json()).catch(()=>({error:1})):Promise.resolve({error:1});
const charP=cid?fetch(`/api/character/${encodeURIComponent(cid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json()).catch(()=>({error:1})):Promise.resolve({error:1});
const [ud,cd]=await Promise.all([unitP,charP]);
if(ud&&!ud.error){sl.unitId=uid;sl.unitData=ud}
if(cd&&!cd.error){sl.charId=cid;sl.charData=cd}
const ids=Array.isArray(o.optionPartIds)?o.optionPartIds.slice(0,1):[];
await Promise.all(ids.map(async(pid)=>{
if(!pid)return;
try{
const d=await fetch(`/api/option_part/${encodeURIComponent(String(pid))}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json());
if(d&&!d.error)sl.optionParts.push(d);
}catch(_){}
}));
}
async function hydrateSide(sideIdx,src){
const tasks=[];
for(let i=0;i<5&&i<src.length;i++){const o=src[i];if(o)tasks.push(hydrateSlot(sideIdx,i,o))}
await Promise.all(tasks);
}
await Promise.all([hydrateSide(1,s1),hydrateSide(2,s2)]);
await Promise.all([1,2].map(async(ss)=>{
const ent=S.tb.supBySide[ss];
if(!ent||!ent.id)return;
const lb=Math.min(3,Math.max(0,ent.lbTier|0));const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const rd=await fetch(`/api/supporter/${encodeURIComponent(ent.id)}?lang=${encodeURIComponent(S.lang)}&level=${slv}&lb_tier=${lb}${_tbSupporterFetchQs(ss)}`).then(r=>r.json());
if(!rd.error){ent.data=rd;if(rd.lb_tier!=null)ent.lbTier=rd.lb_tier|0;if(rd.level!=null)ent.level=Math.min(100,Math.max(1,rd.level|0))}
}catch(_){}
}));
_tbSyncBuffTogglesFromState();
await tbAutoFillEmptyOptionParts({skipRender:true});
tbFillTerrainSelects();renderTeamBuilder();
}
async function tbRefreshSlottedUnitData(){
initTeamBuilder();
const jobs=[];
for(let si=1;si<=2;si++){
for(let col=0;col<5;col++){
const sl=S.tb.squads[si].slots[col];
if(!sl||!sl.unitId)continue;
if(sl.unitData&&sl.unitData._manual)continue;
jobs.push({si,col,uid:String(sl.unitId)});
}
}
if(!jobs.length)return;
await Promise.all(jobs.map(async ({si,col,uid})=>{
try{
const d=await fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${encodeURIComponent(S.lang)}`).then(r=>r.json());
if(!d||d.error)return;
const sl=S.tb.squads[si].slots[col];
if(sl&&String(sl.unitId)===uid)sl.unitData=d;
}catch(_){}
}));
}

function _tbPilotPairUnitAtkDef(cd,ud,charCondPassive,unitAtk,unitDefVal){
const F=Math.floor;
const pm=cd&&cd.pair_unit_stat_mod;
if(!pm||!ud||ud._manual||!charCondPassive)return{unitAtk,unitDefVal};
const row=pm[String(ud.id||'')];
if(!row)return{unitAtk,unitDefVal};
let a=unitAtk,d=unitDefVal;
if(row.atk_pct)a=F(a*(100+row.atk_pct)/100);
if(row.def_pct)d=F(d*(100+row.def_pct)/100);
return{unitAtk:a,unitDefVal:d};
}
function _tbFmtStatDelta(n){
const d=Math.round(Number(n)||0);
if(d>0)return` <span class="tb-stat-plus">(+${fmtN(d)})</span>`;
if(d<0)return` <span class="tb-stat-minus">(-${fmtN(Math.abs(d))})</span>`;
return'';
}
function _tbEvalTerrainRow(row){
if(!row)return{known:true,blocked:true,movePenalty:false,symbol:'-',level:0};
const sym=String(row.symbol||'').trim();
const lvl=parseInt(row.level,10);
const lv=Number.isFinite(lvl)?lvl:0;
const blocked=(sym==='-'||sym==='×'||lv<=0);
const movePenalty=!blocked&&(/[△▲▵▴]/.test(sym)||/\btri/i.test(sym)||lv===1);
return{known:true,blocked,movePenalty,symbol:sym||'-',level:lv};
}
function _tbAtmoAllowsGroundDeploy(atmoState){
if(!atmoState||atmoState.blocked)return false;
if(atmoState.level>=2)return true;
return /[▲●△]/.test(String(atmoState.symbol||''));
}
function _tbSlotTerrainState(sl){
initTeamBuilder();
if(!sl||!sl.unitData)return{known:false,blocked:false,movePenalty:false,symbol:'',level:0};
const ud=sl.unitData;
const useSsp=(sl.unitStatMode==='ssp')&&Array.isArray(ud.terrain_ssp)&&ud.terrain_ssp.length;
const terrArr=useSsp?ud.terrain_ssp:ud.terrain;
if(!Array.isArray(terrArr)||!terrArr.length)return{known:false,blocked:false,movePenalty:false,symbol:'',level:0};
const terrName=S.tb.terrainType||'Space';
const findRow=(name)=>terrArr.find(x=>x&&String(x.name||'')===name);
if(terrName==='Ground'){
const groundState=_tbEvalTerrainRow(findRow('Ground'));
if(!groundState.blocked)return groundState;
const atmoState=_tbEvalTerrainRow(findRow('Atmospheric'));
if(_tbAtmoAllowsGroundDeploy(atmoState))return atmoState;
return groundState;
}
return _tbEvalTerrainRow(findRow(terrName));
}
function _tbApplyTerrainMovePenalty(v){
const n=Math.max(0,Math.round(Number(v)||0));
return Math.max(0,Math.floor(n*0.5));
}
function _tbApplyUnitTurnBuffDefToMsDef(unitDef,ud,turnBuffOn){
const F=Math.floor;
if(!ud||ud._manual||!turnBuffOn)return unitDef;
const p=_dcGetDetectedUnitTurnBuffPercents(ud).defPct|0;
if(p<=0)return unitDef;
const d=F(Math.max(0,Number(unitDef)||0));
return d+F(d*p/100);
}
function _tbSupporterForStatsNoLeader(d){
const ls=(d.leader_skills||[]).map(ls=>Object.assign({},ls,{applies:false}));
return Object.assign({},d,{leader_skills:ls});
}
const TB_PLUS_EX_SQUAD_UNIT_ID='1095002550';
const TB_QUBELEY_ZZ_PILOT_ID='1095001801';
const BIG_RANG_ZEON_SQUAD_UNIT_ID='1009000550';
const BIG_RANG_ZEON_SQUAD_PILOT_ID='1009000100';
const ZEON_LINEAGE_TAG_ID='1015';
const BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT=5;
function _tbNeoZeonUnitCountInSquad(side){
const squ=S.tb.squads[side|0];
if(!squ)return 0;
let n=0;
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(sl&&sl.unitData&&_tbUnitHasNeoZeonTag(sl.unitData))n++;
}
return n;
}
function _tbSquadHasUnitId(side,uidNeed){
if(!uidNeed)return false;
const squ=S.tb.squads[side|0];if(!squ)return false;
const need=String(uidNeed);
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(sl&&sl.unitData&&String(sl.unitData.id)===need)return true;
}
return false;
}
function _tbNameLooksNeoZeon(n){
const s=String(n||'');
const sl=s.toLowerCase();
if(sl.includes('neo zeon')||/\bneo[\s-]?zeon\b/.test(sl))return true;
return /ネオ[_・\s]*ジオン|新ジオン|新吉翁/i.test(s);
}
function _tbUnitHasNeoZeonTag(ud){
if(!ud)return false;
const tagNeo=(tg)=>{if(!tg)return false;const id=String(tg.id||'').trim();if(id==='1019')return true;return _tbNameLooksNeoZeon(tg.name)};
const tags=ud.tags||[];
for(let i=0;i<tags.length;i++){if(tagNeo(tags[i]))return true}
const blocks=ud.skill_tag_data||[];
for(let b=0;b<blocks.length;b++){
const tgs=(blocks[b]&&blocks[b].tags)||[];
for(let j=0;j<tgs.length;j++){if(tagNeo(tgs[j]))return true}
}
return false;
}
function _tbEffectiveExSquadAtkPctForTb(sl,side){
const ud=sl.unitData;
const cd=sl.charData||null;
const raw=Math.min(20,Math.max(0,sl.exSquadAtkPct|0));
if(ud&&String(ud.id)===TB_PLUS_EX_SQUAD_UNIT_ID&&cd&&String(cd.id)===TB_QUBELEY_ZZ_PILOT_ID){
const c=_tbNeoZeonUnitCountInSquad(side);
return Math.min(20,4*c);
}
if(raw<=0)return 0;
if(_dcCharHasExSquadSynergyAbility(cd,ud))return raw;
if(_tbSquadHasUnitId(side,TB_PLUS_EX_SQUAD_UNIT_ID)&&_tbUnitHasNeoZeonTag(ud))return raw;
return 0;
}

const _scSquadBindingCache=new Map();
function _tbWithSlotDcStatModes(sl,fn){
const um=S.dc.unitStatMode,cm=S.dc.charStatMode;
try{
S.dc.unitStatMode=(sl&&sl.unitStatMode)||'normal';
S.dc.charStatMode=(sl&&sl.charStatMode)||'normal';
return fn();
}finally{
S.dc.unitStatMode=um;
S.dc.charStatMode=cm;
}
}
function _tbCountSquadUnitsMatchingGroup(side,group){
if(!group||!((group.conditions||[]).length))return 0;
const squ=S.tb.squads[side|0];
if(!squ)return 0;
let n=0;
for(let i=0;i<5;i++){
const sl=squ.slots[i];
const u2=sl&&sl.unitData;
if(u2&&!u2._manual&&_dcUnitMeetsAbilityConditionGroups(u2,[group]))n++;
}
return n;
}

function _tbPhenexUniqueEligibleCarrierCountForReceiver(slRecv,side){
const squ=S.tb.squads[side|0];
if(!squ)return 0;
const udR=slRecv&&slRecv.unitData;
const cdR=slRecv&&slRecv.charData;
if(!udR||udR._manual)return 0;
let n=0;
for(let i=0;i<5;i++){
const car=squ.slots[i];
const udC=car&&car.unitData;
const cdC=car&&car.charData;
if(!udC||udC._manual||String(udC.id)!==PHENEX_STACK_UNIT_ID)continue;
const ok=_tbWithSlotDcStatModes(car,()=>{
const b=_scFindSquadConditionBinding(cdC,udC);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return false;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(udC,cdC,b.pilotGroups))return false;
return _dcSquadRecvGroupMet(udR,cdR,b.recvGroup);
});
if(ok)n++;
}
return n;
}
function _tbCarrierFlatAdAuraSheetPct(slCarrier,slReceiver,side){
const cdC=slCarrier.charData;
const udC=slCarrier.unitData;
const udR=slReceiver.unitData;
const z={atk:0,def:0};
if(!udC||udC._manual||!udR||udR._manual)return z;
if(_scIsQubeleyExCombo(cdC,udC))return z;
return _tbWithSlotDcStatModes(slCarrier,()=>{
const b=_scFindSquadConditionBinding(cdC,udC);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return z;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(udC,cdC,b.pilotGroups))return z;
const cdR=slReceiver.charData;
if(!_dcSquadRecvGroupMet(udR,cdR,b.recvGroup))return z;
const p=b.flatPct|0;
return{atk:p,def:p};
});
}
function _tbComputeExternalFlatAdSquadPctForSlot(sl,side){
const ud=sl&&sl.unitData;
if(!ud||ud._manual)return{atk:0,def:0};
const squ=S.tb.squads[side|0];
if(!squ)return{atk:0,def:0};
let atk=0,def=0;
for(let i=0;i<5;i++){
const car=squ.slots[i];
if(!car||car===sl)continue;
const patch=_tbCarrierFlatAdAuraSheetPct(car,sl,side);
atk+=patch.atk|0;def+=patch.def|0;
}
return{atk,def};
}
function _tbLocalSquadConditionSheetPcts(sl,side){
const cd=sl.charData,ud=sl.unitData;
const z={atk:0,def:0};
if(!ud||ud._manual||_scIsQubeleyExCombo(cd,ud))return z;
return _tbWithSlotDcStatModes(sl,()=>{
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return z;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups))return z;
if(b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg))return z;
if(b.flatPerUnit){
if(!rg||!((rg.conditions||[]).length))return z;
const n=_tbCountSquadUnitsMatchingGroup(side,rg);
const per=b.flatPct|0;
const eff=per*Math.min(5,Math.max(0,n));
return{atk:eff,def:eff};
}
return{atk:b.flatPct|0,def:b.flatPct|0};
}
if(b.kind==='stack_atk'||b.kind==='dual_stack_atk'){
/* Include this slot when it matches Condition 2 (e.g. Wing Series alone → 2%, full Wing squad → 10%). */
let n=_tbCountSquadUnitsMatchingGroup(side,b.countGroup)|0;
if(ud&&!ud._manual&&b.countGroup&&_dcConditionGroupMatches(ud,null,b.countGroup)&&n<1)n=1;
return{atk:Math.min(b.max|0,(b.perUnit|0)*n),def:0};
}
return z;
});
}
function _tbComputeSquadConditionSheetPcts(sl,side){
const loc=_tbLocalSquadConditionSheetPcts(sl,side);
const ext=_tbComputeExternalFlatAdSquadPctForSlot(sl,side);
let atk=(loc.atk|0)+(ext.atk|0),def=(loc.def|0)+(ext.def|0);
const phenN=_tbPhenexUniqueEligibleCarrierCountForReceiver(sl,side);
if(phenN>0&&atk===def){
atk=Math.min(PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT,atk);
def=Math.min(PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT,def);
}
return{atk,def};
}
function _tbUnitAllowsSpSsp(ud){
if(!ud||ud._manual)return false;
// Ultimate (ULT) kits are SSR-tier but never have SP/SSP.
if(ud.is_ultimate)return false;
if(ud.has_sp!==undefined)return!!ud.has_sp;
return parseInt(ud.rarity_id||'5',10)<=4;
}
function _tbStatTotalsWithFullCtx(sl,side,optionParts,supForSlot){
if(!sl||!sl.unitData)return null;
const ud=sl.unitData;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const supEnt=S.tb.supBySide[side];
let supporters=[];
if(supForSlot&&!supForSlot.error)supporters=[supForSlot];
else if(supEnt&&supEnt.data){
if(supForSlot===null)supporters=[_tbSupporterForStatsNoLeader(supEnt.data)];
else supporters=[supEnt.data];
}
const sqP=_tbComputeSquadConditionSheetPcts(sl,side);
const fullCtx={masterLeagueBuff:!!S.tb.masterLeague,grandOffensiveBuff:!!S.tb.grandOffensive,masterLeagueBuffMove:false,optionParts:optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_tbEffectiveExSquadAtkPctForTb(sl,side),squadCondAtkPct:sqP.atk|0,squadCondDefPct:sqP.def|0};
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
return{hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:f.unitMove};
}
function _tbRarityRankOption(row){return{UR:4,SSR:3,SR:2,R:1}[row&&row.rarity]||0}
function _tbRankOptionForAutoFill(sl,side,row,supForSlot){
const rk=_tbUnitRoleKind(sl.unitData);
const b=_dcParseOptionPartBonuses(row.details||'');
const part={id:row.id,name:row.name||'',details:row.details||'',thum:row.thum||'',tags:row.tags||[]};
const z=_tbStatTotalsWithFullCtx(sl,side,[],supForSlot);
const w=_tbStatTotalsWithFullCtx(sl,side,[part],supForSlot);
const dAtk=z&&w?w.atk-z.atk:0;
const dHp=z&&w?w.hp-z.hp:0;
const dDef=z&&w?w.def-z.def:0;
const atk12=b.Attack.pct===12;
const hp12=b.HP.pct===12;
const def12=b.Defense.pct===12;
const rid=parseInt(String(row.id),10)||0;
const rb=_tbRarityRankOption(row);
if(rk==='def'){
if(hp12)return[4,dHp,dDef,dAtk,rb,rid];
if(def12)return[3,dDef,dHp,dAtk,rb,rid];
return[2,dHp+dDef,dDef,dHp,rb,rid];
}
if(rk==='sup'){
if(atk12)return[4,dAtk,0,0,rb,rid];
return[2,dAtk,0,0,rb,rid];
}
if(atk12)return[4,dAtk,dHp,dDef,rb,rid];
return[2,dAtk,dHp+dDef,dDef,rb,rid];
}
function _tbCompareRankAuto(a,b){
for(let i=0;i<Math.max(a.length,b.length);i++){
const x=a[i]??0,y=b[i]??0;
if(x>y)return 1;
if(x<y)return -1;
}
return 0;
}

function _tbBuildSlotStatEff(sl,side,supForSlot){
if(!sl||!sl.unitData)return null;
const ud=sl.unitData;
const terrState=_tbSlotTerrainState(sl);
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const supEnt=S.tb.supBySide[side];
let supporters=[];
if(supForSlot&&!supForSlot.error)supporters=[supForSlot];
else if(supEnt&&supEnt.data){
if(supForSlot===null)supporters=[_tbSupporterForStatsNoLeader(supEnt.data)];
else supporters=[supEnt.data];
}
const sqP=_tbComputeSquadConditionSheetPcts(sl,side);
const fullCtx={masterLeagueBuff:!!S.tb.masterLeague,grandOffensiveBuff:!!S.tb.grandOffensive,masterLeagueBuffMove:false,optionParts:sl.optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_tbEffectiveExSquadAtkPctForTb(sl,side),squadCondAtkPct:sqP.atk|0,squadCondDefPct:sqP.def|0};
const baseCtx={masterLeagueBuff:false,grandOffensiveBuff:false,masterLeagueBuffMove:false,optionParts:[],supporters:[],unitTurnBuffAtk:false,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:0,squadCondAtkPct:0,squadCondDefPct:0};
const b=_dcGetModifiedAttackerUnitStatsFromCtx(baseCtx,stats);
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let batk=b.unitAtk,bdef=b.unitDefVal;
const prb=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,batk,bdef);
batk=prb.unitAtk;bdef=prb.unitDefVal;
bdef=_tbApplyUnitTurnBuffDefToMsDef(bdef,ud,!!sl.unitTurnBuffDef);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
const fullMovRaw=Math.max(0,Math.round(Number(f.unitMove)||0));
let movShown=fullMovRaw;
if(terrState.movePenalty)movShown=_tbApplyTerrainMovePenalty(fullMovRaw);
return{ud,hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:movShown,dHp:f.unitHp-b.unitHp,dAtk:fatk-batk,dDef:fdef-bdef,dMob:f.unitMob-b.unitMob,dMov:movShown-Math.max(0,Math.round(Number(b.unitMove)||0)),blocked:!!terrState.blocked,terrainSymbol:terrState.symbol||'-'};
}
function _tbTerrainQuery(){initTeamBuilder();const tt=S.tb.terrainType||'Space';return'&terrain='+encodeURIComponent(tt+':2+')}
function tbFillTerrainSelects(){
initTeamBuilder();
const ts=document.getElementById('tbTerrainSelect');
if(!ts)return;
const cur=S.tb.terrainType,items=_tbTerrainItems();
ts.innerHTML=items.map(x=>`<option value="${escAttr(x)}"${x===cur?' selected':''}>${esc(tTerrain(x))}</option>`).join('');
}
function onTbTerrainChange(){
initTeamBuilder();
const ts=document.getElementById('tbTerrainSelect');
if(ts)S.tb.terrainType=ts.value||'Space';
tbInvalidateTbPickerUnitCache();
renderTeamBuilder();
}
function _tbSyncBuffTogglesFromState(){
const ml=document.getElementById('tbMasterLeagueToggle'),go=document.getElementById('tbGrandOffensiveToggle');
if(ml)ml.classList.toggle('active',!!S.tb.masterLeague);
if(go)go.classList.toggle('active',!!S.tb.grandOffensive);
}
function toggleTbMasterLeague(){
initTeamBuilder();
S.tb.masterLeague=!S.tb.masterLeague;
_tbSyncBuffTogglesFromState();
renderTbStats();
}
function toggleTbGrandOffensive(){
initTeamBuilder();
S.tb.grandOffensive=!S.tb.grandOffensive;
_tbSyncBuffTogglesFromState();
renderTbStats();
}
function _tbSideFromKey(key){const s=(key>>8)&255;return s===2?2:1}
function _tbIdxFromKey(key){return key&255}
function _tbSquFromKey(key){initTeamBuilder();return S.tb.squads[_tbSideFromKey(key)]}
function _tbKey(side,col){return((side===2?2:1)<<8)+(col|0)}
function tbSlotClick(key){
initTeamBuilder();
if(S.tb.rearrange){tbRearrangeTap(key);return}
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
renderTbSlots();renderTbStats();
openTbPicker('unit',key);
}
function tbPilotAddClick(key,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
if(!sl.unitData){openTbPicker('unit',key);return}
renderTbSlots();renderTbStats();
openTbPicker('char',key);
}
async function tbPilotPickRecommended(key,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const rc=sl.unitData&&sl.unitData.recommend_character;
if(!rc||!rc.id)return;
try{const d=await fetch(`/api/character/${encodeURIComponent(rc.id)}?lang=${S.lang}`).then(r=>r.json());if(!d.error){sl.charId=String(rc.id);sl.charData=d}}catch(_){}
renderTeamBuilder();
}
function tbSetSlotLbTier(key,tier,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const ud=sl.unitData;
const lb=ud&&ud.lb_data;
if(!lb||lb.length<=1||ud.is_ultimate)return;
const max=lb.length-1;
sl.lbTier=Math.min(Math.max(0,tier|0),max);
renderTeamBuilder();
}
function tbSetSlotUnitStatMode(key,mode,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
const ud=sl.unitData;
if(!ud||!_tbUnitAllowsSpSsp(ud))return;
if(mode!=='normal'&&mode!=='sp'&&mode!=='ssp')return;
sl.unitStatMode=mode;
S.tb._leaderApplyCache={};
renderTeamBuilder();
}
function tbSlotContextMenu(key,ev){
if(ev)ev.preventDefault();
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
const sl=_tbSquFromKey(key).slots[_tbIdxFromKey(key)];
if(sl.unitData)openTbPicker(sl.charData?'option':'char',key);
else openTbPicker('unit',key);
}
function _tbFormatOptionBonusesShort(details){
try{
const b=_dcParseOptionPartBonuses(details);
const out=[];
const P=(label,v)=>{if(!v)return;if(v.pct)out.push(label+(v.pct>0?' +':(v.pct<0?' ':''))+v.pct+'%');if(v.flat)out.push(label+(v.flat>0?' +':(v.flat<0?' ':''))+fmtN(v.flat))};
P('ATK',b.Attack);P('HP',b.HP);P('DEF',b.Defense);P('MOB',b.Mobility);P('MOV',b.Move);P('EN',b.EN);
return out.slice(0,3).join(' ')||(details?String(details).trim().slice(0,48):'');
}catch(_){return details?String(details).trim().slice(0,48):''}
}

function _tbCollectUsedSsrOptionPartIds(exceptKey){
initTeamBuilder();
const u=new Set();
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const k=_tbKey(si,col);
if(exceptKey!=null&&k===exceptKey)continue;
const sl=squ.slots[col];
(sl.optionParts||[]).forEach(p=>{if(p&&p.id&&_tbOptionPartIsSsr(p))u.add(String(p.id))});
}}
return u;
}
function _tbDedupeOptionPartsAcrossTeam(){
initTeamBuilder();
const ssrSeen=new Set();
let clearedDupSsr=false;
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const sl=squ.slots[col];
if(!sl||!sl.optionParts||!sl.optionParts.length)continue;
const next=[];
for(let i=0;i<sl.optionParts.length;i++){
const p=sl.optionParts[i];
const id=p&&p.id;if(!id)continue;
if(_tbOptionPartIsSsr(p)){
const ks=String(id);
if(ssrSeen.has(ks)){clearedDupSsr=true;continue}
ssrSeen.add(ks);
}
next.push(p);
}
sl.optionParts=next.slice(0,1);
}}
}
function _tbUnitRoleKind(ud){
if(!ud)return'atk';
const id=String(ud.role_id!=null?ud.role_id:'').trim();
if(id==='2')return'def';
if(id==='3')return'sup';
const r=String(ud.role||'').toLowerCase();
if(r.includes('defens')||r.includes('耐久'))return'def';
if(r.includes('support')||r.includes('支援'))return'sup';
return'atk';
}
async function tbAutoFillEmptyOptionParts(opts){
if(typeof S==='undefined'||!S.tb)return;
if(S.tb._tbAutoOpBusy)return;
const skipRender=!!(opts&&opts.skipRender);
initTeamBuilder();
const order=[];
for(let si=1;si<=2;si++)for(let col=0;col<5;col++)order.push({si,col,key:_tbKey(si,col)});
const tasks=[];
for(let o of order){
const sl=S.tb.squads[o.si].slots[o.col];
if(sl&&sl.unitData&&sl.unitId&&!sl.unitData._manual&&(!sl.optionParts||!sl.optionParts.length))tasks.push(o);
}
if(!tasks.length)return;
S.tb._tbAutoOpBusy=true;
try{
const cache=S.tb._tbOpAllRowsByUnit||(S.tb._tbOpAllRowsByUnit={});
const used=_tbCollectUsedSsrOptionPartIds(null);
const supByKey={};
await Promise.all(tasks.map(async o=>{
const k=_tbKey(o.si,o.col);
const sl=S.tb.squads[o.si].slots[o.col];
if(!sl||!sl.unitData||!S.tb.supBySide[o.si]||!S.tb.supBySide[o.si].id){supByKey[k]=null;return}
const ent=S.tb.supBySide[o.si];
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const q=`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}&for_unit_id=${encodeURIComponent(sl.unitId)}&for_char_id=${encodeURIComponent(sl.charId||'')}`;
const d=await fetch(q).then(r=>r.json());
supByKey[k]=(!d||d.error)?null:d;
}catch(_){supByKey[k]=null}
}));
let changed=false;
for(const o of tasks){
const sl=S.tb.squads[o.si].slots[o.col];
const ud=sl.unitData;
const uid=String(sl.unitId);
const slotK=_tbKey(o.si,o.col);
let rows=cache[uid];
if(!rows){
rows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL&unit_id='+encodeURIComponent(uid));
cache[uid]=rows;
}
const supForSlot=supByKey[slotK];
let best=null,bestR=null;
for(let i=0;i<rows.length;i++){
const row=rows[i];
const id=String(row.id);
if(used.has(id))continue;
const ra=_tbRankOptionForAutoFill(sl,o.si,row,supForSlot);
if(!bestR||_tbCompareRankAuto(ra,bestR)>0){bestR=ra;best=row}
}
if(best!=null){sl.optionParts=[best];if(_tbOptionPartIsSsr(best))used.add(String(best.id));changed=true}
}
if(changed&&!skipRender){renderTbSlots();renderTbStats()}
}catch(_){}
finally{S.tb._tbAutoOpBusy=false}
}
function _tbSlotLbOutsideHtml(sl,slotKey){
const ud=sl.unitData;
if(!ud)return'';
const lb=ud.lb_data;
if(!lb||lb.length<=1||ud.is_ultimate)return'';
const maxT=lb.length-1;
const cur=Math.min(sl.lbTier|0,maxT);
const lbOpt=String(t('supp_lb_tier')||'LB');
const detId=`tbSlotLbDet${slotKey}`;
const curP=cmpLbPipsAtTier(cur);
let lbMenu='';
for(let ti=0;ti<=maxT;ti++){
const pip=cmpLbPipsAtTier(ti);
lbMenu+=`<button type="button" class="cmp-lb-opt${ti===cur?' is-active':''}" onclick="event.stopPropagation();tbSetSlotLbTier(${slotKey},${ti},event);var _tbd=document.getElementById('${detId}');if(_tbd)_tbd.open=false" role="option" aria-selected="${ti===cur}" aria-label="${escAttr(lbOpt+' '+ti)}">${cmpLbPipsRow(pip[0],pip[1],pip[2])}</button>`;
}
return`<div class="tb-slot-lb-outside" onclick="event.stopPropagation()"><details id="${detId}" class="cmp-lb-details tb-slot-lb-details"><summary class="cmp-lb-summary tb-slot-lb-summary" title="${escAttr(lbOpt)}" aria-label="${escAttr(lbOpt)}">${cmpLbPipsRow(curP[0],curP[1],curP[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${escAttr(lbOpt)}">${lbMenu}</div></details></div>`;
}
function _tbSlotStatModeHtml(key,sl){
const ud=sl.unitData;
if(!ud||ud._manual||!_tbUnitAllowsSpSsp(ud))return'';
const m=sl.unitStatMode||'normal';
const labN=escAttr(t('tb_stat_normal')||'Normal');
const labSp=escAttr(t('tb_stat_sp')||'SP');
const labSsp=escAttr(t('tb_stat_ssp')||'SSP');
return`<div class="tb-slot-stat-mode" onclick="event.stopPropagation()"><button type="button" class="tb-slot-stat-mode-btn${m==='normal'?' is-active':''}" title="${labN}" aria-label="${labN}" onclick="tbSetSlotUnitStatMode(${key},'normal',event)">${esc(t('tb_stat_normal')||'Normal')}</button><button type="button" class="tb-slot-stat-mode-btn${m==='sp'?' is-active':''}" title="${labSp}" aria-label="${labSp}" onclick="tbSetSlotUnitStatMode(${key},'sp',event)">${esc(t('tb_stat_sp')||'SP')}</button><button type="button" class="tb-slot-stat-mode-btn${m==='ssp'?' is-active':''}" title="${labSsp}" aria-label="${labSsp}" onclick="tbSetSlotUnitStatMode(${key},'ssp',event)">${esc(t('tb_stat_ssp')||'SSP')}</button></div>`;
}
function _tbSlotOpOutsideHtml(key,sl){
if(!sl.unitData)return'';
const opN=(sl.optionParts||[]).length;
const swapLbl=t('tb_op_swap')||'Change option part';
const clrLbl=escAttr(t('tb_op_clear')||'Clear');
const opClrIc=imgUrlWebp(TB_TRASH_ICON);
const opRows=(sl.optionParts||[]).map((p,i)=>{
const th=p.thum?`<img class="tb-op-thum" src="${imgUrl(p.thum)}" alt="" loading="lazy" onerror="this.style.display='none'">`:'';
const sum=esc(_tbFormatOptionBonusesShort(p.details));
const nm=String(p.name||'').trim();
const lineage=(p.tags||[]).map(tg=>String(tg.name||'').trim()).filter(Boolean).join(' · ');
const hoverRaw=[nm,lineage].filter(Boolean).join(' — ')||swapLbl;
const hoverTip=escAttr(hoverRaw);
const ariaSwap=escAttr(swapLbl+(nm||lineage?(': '+[nm,lineage].filter(Boolean).join(' — ')):''));
return`<div class="tb-op-row tb-op-row--rich tb-op-row--pick-row"><div class="tb-op-row-hit tb-op-row--pick" role="button" tabindex="0" title="${hoverTip}" aria-label="${ariaSwap}" onclick="event.stopPropagation();tbOpenOptionReplacePicker(${key},${i},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbOpenOptionReplacePicker(${key},${i},event)}">${th}<span class="tb-op-sum">${sum}</span></div><button type="button" class="tb-op-clear" title="${clrLbl}" aria-label="${clrLbl}" onclick="event.stopPropagation();tbClearOptionPart(${key},${i},event)"><img src="${opClrIc}" alt="" loading="lazy" decoding="async"></button></div>`;
}).join('');
const addBtn=opN>=1?'':`<button type="button" class="tb-op-add" onclick="event.stopPropagation();tbOpenOptionPartsPicker(${key})">+</button>`;
return`<div class="tb-slot-op-outside" onclick="event.stopPropagation()"><div class="tb-op-box tb-op-box--under-slot"><div class="tb-op-head"><span class="tb-op-title">${esc(t('tb_option_part')||'Option Part')}</span>${addBtn}</div>${opRows?opRows:`<div class="tb-op-empty">${esc(t('none'))}</div>`}</div></div>`;
}
function _tbLongCardHtml(sl,slotKey){
const ud=sl.unitData;
if(!ud){
return`<div class="tb-long-card tb-long-card--empty"><div class="tb-slot-add-ms" onclick="event.stopPropagation();tbSlotClick(${slotKey})"><span style="font-size:28px;color:var(--accent-cyan);opacity:.85">+</span></div></div>`;
}
const side=_tbSideFromKey(slotKey);
const r=ud.rarity||'N';
const base=TB_LONG_BASE_MAP[r]||TB_LONG_BASE_MAP.N;
const portraitSrc=ud.portrait||ud.thum;
const lk=`${side}:`+String(ud.id)+':'+String(sl.charData&&sl.charData.id||'');
const oneBuff=imgTag(TB_LEADER_ICON,{cls:'tb-long-supporter-buff-img',webp:true,alt:''});
const leaderIc=(S.tb._leaderApplyCache&&S.tb._leaderApplyCache[lk])?`<div class="tb-long-supporter-buff">${oneBuff}</div>`:'';
let pilotInner='';
if(sl.charData&&(sl.charData.portrait||sl.charData.thum)){
const psrc=sl.charData.portrait||sl.charData.thum;
const pilotTitle=escAttr(t('tb_pick_pilot_unit')||t('tab_char'));
pilotInner=`<div class="tb-long-pilot-corner"><div class="tb-long-pilot tb-long-pilot--click" role="button" tabindex="0" title="${pilotTitle}" aria-label="${pilotTitle}" onclick="event.stopPropagation();tbPilotAddClick(${slotKey},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbPilotAddClick(${slotKey},event)}">${imgTag(psrc,{webp:true,alt:''})}</div></div>`;
}else{
const addTitle=escAttr(t('tb_pick_pilot_unit')||t('tab_char'));
const plus=`<div class="tb-slot-add-pilot tb-slot-add-pilot--corner" role="button" tabindex="0" title="${addTitle}" aria-label="${addTitle}" onclick="event.stopPropagation();tbPilotAddClick(${slotKey},event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbPilotAddClick(${slotKey},event)}">+</div>`;
pilotInner=`<div class="tb-long-pilot-corner">${plus}</div>`;
}
let pCls='tb-long-portrait';
if(String(ud.body_type||'')==='3')pCls+=' tb-long-portrait--sd';
else if(TB_LONG_PORTRAIT_FACE_IDS.has(String(ud.id)))pCls+=' tb-long-portrait--face-balance';
const portraitInner=(portraitSrc?imgTag(portraitSrc,{cls:pCls,webp:true,alt:''}):'')+leaderIc+pilotInner;
const portrait=`<div class="tb-long-portrait-wrap">${portraitInner}</div>`;
const role=ud.role_icon?`<div class="tb-long-role"><img src="${imgUrl(ud.role_icon)}" alt=""></div>`:'';
return`<div class="tb-long-card"><img class="tb-long-base" src="${imgUrl(base)}" alt="" loading="lazy">${portrait}${role}</div>`;
}
function _tbLongCardHtmlRearrangeUnlinked(sl,slotKey){
const ud=sl.unitData;
const pk=S.tb.rearrange&&S.tb.rearrange.pendingKey===slotKey;
const pp=S.tb.rearrange&&S.tb.rearrange.pendingPart;
const msPend=pk&&pp==='unit';
const pilPend=pk&&pp==='pilot';
if(!ud){
const ep=pk&&pp==='unit';
return`<div class="tb-long-card tb-long-card--empty tb-long-card--rearrange-empty${ep?' is-rearrange-pending':''}" role="button" tabindex="0" onclick="tbRearrangeTapPart(${slotKey},'unit',event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbRearrangeTapPart(${slotKey},'unit',event)}"><div class="tb-slot-add-ms"><span style="font-size:28px;color:var(--accent-cyan);opacity:.85">+</span></div></div>`;
}
const side=_tbSideFromKey(slotKey);
const r=ud.rarity||'N';
const base=TB_LONG_BASE_MAP[r]||TB_LONG_BASE_MAP.N;
const portraitSrc=ud.portrait||ud.thum;
const lk=`${side}:`+String(ud.id)+':'+String(sl.charData&&sl.charData.id||'');
const oneBuff=imgTag(TB_LEADER_ICON,{cls:'tb-long-supporter-buff-img',webp:true,alt:''});
const leaderIc=(S.tb._leaderApplyCache&&S.tb._leaderApplyCache[lk])?`<div class="tb-long-supporter-buff">${oneBuff}</div>`:'';
let pilotBlock='';
if(sl.charData&&(sl.charData.portrait||sl.charData.thum)){
const psrc=sl.charData.portrait||sl.charData.thum;
pilotBlock=`<div class="tb-long-pilot-corner${pilPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'pilot',event)"><div class="tb-long-pilot">${imgTag(psrc,{webp:true,alt:''})}</div></div>`;
}else{
pilotBlock=`<div class="tb-long-pilot-corner${pilPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'pilot',event)"><div class="tb-slot-add-pilot tb-slot-add-pilot--corner">+</div></div>`;
}
let pCls='tb-long-portrait';
if(String(ud.body_type||'')==='3')pCls+=' tb-long-portrait--sd';
else if(TB_LONG_PORTRAIT_FACE_IDS.has(String(ud.id)))pCls+=' tb-long-portrait--face-balance';
const portraitImg=portraitSrc?imgTag(portraitSrc,{cls:pCls,webp:true,alt:''}):'';
const role=ud.role_icon?`<div class="tb-long-role"><img src="${imgUrl(ud.role_icon)}" alt=""></div>`:'';
const msZone=`<div class="tb-rearrange-ms-zone${msPend?' is-rearrange-pending-zone':''}" onclick="tbRearrangeTapPart(${slotKey},'unit',event)">${portraitImg}${leaderIc}${role}</div>`;
const portrait=`<div class="tb-long-portrait-wrap tb-long-portrait-wrap--rearrange-unlinked">${msZone}${pilotBlock}</div>`;
return`<div class="tb-long-card"><img class="tb-long-base" src="${imgUrl(base)}" alt="" loading="lazy">${portrait}</div>`;
}
function renderTbSlots(){
initTeamBuilder();
_tbDedupeOptionPartsAcrossTeam();
const r1f=document.getElementById('tbSlotsSquad1Front'),r1r=document.getElementById('tbSlotsSquad1Rear'),r2f=document.getElementById('tbSlotsSquad2Front'),r2r=document.getElementById('tbSlotsSquad2Rear');
if(!r1f||!r1r||!r2f||!r2r)return;
function rowHtml(side,col0,col1){
const squ=S.tb.squads[side];
let h='';
for(let col=col0;col<col1;col++){
const key=_tbKey(side,col);
const sl=squ.slots[col];
const sel=S.tb.selectedKey===key;
let cls='tb-slot'+(sel?' is-sel':'');
const terrState=(sl&&sl.unitData)?_tbSlotTerrainState(sl):null;
if(terrState&&terrState.blocked)cls+=' tb-slot--terrain-blocked';
else if(terrState&&terrState.movePenalty)cls+=' tb-slot--terrain-penalty';
if(S.tb.rearrange&&S.tb.rearrange.pendingKey===key)cls+=' is-rearrange-pending';
let terrTip='';
if(terrState&&terrState.blocked)terrTip=` title="${escAttr('Cannot deploy on '+tTerrain(S.tb.terrainType||'Space'))}"`;
else if(terrState&&terrState.movePenalty)terrTip=` title="${escAttr('Move -50% on '+tTerrain(S.tb.terrainType||'Space'))}"`;
h+=`<div class="tb-slot-col" data-tb-key="${key}"><div class="${cls}" data-tb-key="${key}"${terrTip} onclick="tbSlotClick(${key})" oncontextmenu="tbSlotContextMenu(${key},event);return false;">${_tbLongCardHtml(sl,key)}</div>${_tbSlotLbOutsideHtml(sl,key)}${_tbSlotStatModeHtml(key,sl)}${_tbSlotOpOutsideHtml(key,sl)}</div>`;
}
return h;
}
r1f.innerHTML=rowHtml(1,0,3);r1r.innerHTML=rowHtml(1,3,5);
r2f.innerHTML=rowHtml(2,0,3);r2r.innerHTML=rowHtml(2,3,5);
scheduleTbLeaderRefresh();
}
let _tbLeaderFt=null;
function scheduleTbLeaderRefresh(){clearTimeout(_tbLeaderFt);_tbLeaderFt=setTimeout(tbRefreshLeaderApplies,100)}
async function tbRefreshLeaderApplies(){
initTeamBuilder();
S.tb._leaderApplyCache=S.tb._leaderApplyCache||{};
const tasks=[];
for(const side of[1,2]){
const sup=S.tb.supBySide[side].data;
if(!sup||!sup.id)continue;
const squ=S.tb.squads[side];
for(let i=0;i<5;i++){
const sl=squ.slots[i];
if(!sl||!sl.unitData||sl.unitData._manual)continue;
const uid=String(sl.unitData.id);
const cid=sl.charData&&sl.charData.id?String(sl.charData.id):'';
const k=`${side}:`+uid+':'+cid;
if(S.tb._leaderApplyCache[k]!==undefined)continue;
tasks.push((async()=>{
try{
const lbQ=Math.min(3,Math.max(0,(S.tb.supBySide[side].lbTier|0)));
const lvQ=Math.min(100,Math.max(1,(S.tb.supBySide[side].level!=null?S.tb.supBySide[side].level|0:100)));
let q=`/api/supporter/${encodeURIComponent(sup.id)}?lang=${S.lang}&level=${lvQ}&lb_tier=${lbQ}&for_unit_id=${encodeURIComponent(uid)}`;
if(cid)q+='&for_char_id='+encodeURIComponent(cid);
const d=await fetch(q).then(r=>r.json());
const ls=d&&d.leader_skills||[];
S.tb._leaderApplyCache[k]=ls.some(x=>x&&x.applies);
}catch(_){S.tb._leaderApplyCache[k]=false}
})());
}}
if(tasks.length){await Promise.all(tasks);renderTbSlots()}
}
function _tbSupporterFetchQs(side){
initTeamBuilder();
const squ=S.tb.squads[side];
let uId=null,cId=null;
for(let i=0;i<5;i++){const sl=squ.slots[i];if(sl&&sl.unitData){uId=sl.unitId;cId=sl.charId;break}}
let x='';
if(uId)x+='&for_unit_id='+encodeURIComponent(uId);
if(cId)x+='&for_char_id='+encodeURIComponent(cId);
return x;
}
function _tbSupporterLbIconsHtml(side,s){
const ent=S.tb.supBySide[side];
const cur=Math.min(3,Math.max(0,(ent&&ent.lbTier!=null?ent.lbTier|0:(s.lb_tier!=null?s.lb_tier|0:0))));
const lbOpt=String(t('supp_lb_tier')||'LB');
let btns='';
for(let i=0;i<=3;i++){
const pip=cmpLbPipsAtTier(i);
const sel=i===cur?' tb-supp-lb-ic--sel':'';
btns+=`<button type="button" class="tb-supp-lb-ic${sel}" aria-pressed="${i===cur?'true':'false'}" title="${escAttr(lbOpt+' '+i)}" aria-label="${escAttr(lbOpt+' '+i)}" onclick="event.stopPropagation();tbSetSupporterLbFromIcon(${side},${i},event)">${cmpLbPipsRow(pip[0],pip[1],pip[2])}</button>`;
}
return`<div class="tb-supp-lb-icons">${btns}</div>`;
}
function tbSetSupporterLbFromIcon(side,tier,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
ent.lbTier=Math.min(3,Math.max(0,tier|0));
_tbRefetchSupporterForSide(side).then(()=>renderTeamBuilder());
}
function _tbSupporterDetailHtml(s,side){
const boost=`<div class="tb-supp-boost"><span class="support-stat-badge support-hp">${esc(t('hp_support'))} +${fmtN(s.hp_support||0)}</span><span class="support-stat-badge support-atk">${esc(t('atk_support'))} +${fmtN(s.atk_support||0)}</span></div>`;
let leaders='';
if(s.leader_skills&&s.leader_skills.length){
leaders=`<div class="tb-supp-sec"><div class="tb-supp-sec-title">${esc(t('sec_leader_skill'))}</div>`+s.leader_skills.map(ls=>{
const na=ls.applies===false?`<span class="tb-supp-na">(—)</span>`:'';
const tagRow=ls.tags&&ls.tags.length?`<div class="detail-tags-row" style="margin-top:6px">${renderSkillTags([{tags:ls.tags,separator:ls.separator}])}</div>`:'';
return`<div class="tb-supp-leader-item"><div class="tb-supp-leader-desc">${esc(ls.desc)}${na}</div>${tagRow}</div>`;
}).join('')+'</div>';
}
let act='';
if(s.active_skills&&s.active_skills.length){
act=`<div class="tb-supp-sec"><div class="tb-supp-sec-title">${esc(t('sec_active_skills'))}</div>`+s.active_skills.map(sk=>`<div class="tb-supp-act-item">${sk.icon?`<img class="tb-supp-act-ic" src="${imgUrl(sk.icon)}" alt="" loading="lazy">`:''}<div><div class="tb-supp-act-name">${esc(sk.name)}</div>${sk.desc?`<div class="tb-supp-act-desc">${esc(sk.desc)}</div>`:''}</div></div>`).join('')+'</div>';
}
return`${boost}${leaders}${act}`;
}
async function _tbRefetchSupporterForSide(side){
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const d=await fetch(`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}${_tbSupporterFetchQs(side)}`).then(r=>r.json());
if(!d.error){ent.data=d;ent.lbTier=d.lb_tier!=null?d.lb_tier|0:lb;if(d.level!=null)ent.level=Math.min(100,Math.max(1,d.level|0));S.tb._leaderApplyCache={}}
}catch(_){}
}
let _tbSupporterLevelTimers={};
function tbOnSupporterLevelInput(side,raw){
initTeamBuilder();
const ent=S.tb.supBySide[side];
if(!ent||!ent.id)return;
const lv=Math.min(100,Math.max(1,parseInt(String(raw),10)||100));
ent.level=lv;
const el=document.getElementById('tbSuppCardLvlTxt'+side);
if(el)el.textContent=fmtN(lv);
const rid='s'+String(side);
clearTimeout(_tbSupporterLevelTimers[rid]);
_tbSupporterLevelTimers[rid]=setTimeout(()=>{
_tbRefetchSupporterForSide(side).then(()=>{renderTbSupporter();renderTbStats();scheduleTbLeaderRefresh()});
},140);
}
function _tbRenderOneSupporterCol(cardId,detId,side){
const card=document.getElementById(cardId),det=document.getElementById(detId);
if(!card||!det)return;
const ent=S.tb.supBySide[side];
if(!ent||!ent.id){card.innerHTML=`<div class="tb-supp-placeholder">${esc(t('tb_pick_supp'))}</div>`;det.innerHTML='';return}
const s=ent.data;
if(!s){card.innerHTML=`<div class="tb-supp-placeholder">${esc(t('tb_pick_supp'))}</div>`;det.innerHTML='';return}
const lv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:(s.level||100)));
const slideLbl=escAttr(t('tb_supp_level_slider')||'Supporter level from 1 to 100');
const adjLbl=esc(t('tb_supp_level_adjust')||'Adjust');
card.innerHTML=`<div class="tb-supp-card-stack tb-supp-card-stack--full"><div class="tb-supp-frames tb-supp-frames--left">${renderTbSupporterPortraitOnly(s,96)}</div><div class="tb-supp-card-meta-in"><strong class="tb-supp-card-name">${esc(s.name||'')}</strong><div class="tb-supp-meta-line tb-supp-meta-line--lvl tb-supp-meta-line--in-card"><span class="tb-supp-lvl-txt"><strong>${esc(t('supp_level'))}</strong>: <span id="tbSuppCardLvlTxt${side}">${fmtN(lv)}</span></span>${_tbSupporterLbIconsHtml(side,s)}</div><div class="tb-supp-lvl-slider-row" role="group" aria-label="${slideLbl}" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" ontouchstart="event.stopPropagation()"><span class="tb-supp-lvl-slider-lbl" id="tbSuppLvLbl${side}">${adjLbl}</span><input type="range" min="1" max="100" step="1" value="${lv}" aria-labelledby="tbSuppLvLbl${side}" title="${slideLbl}" oninput="tbOnSupporterLevelInput(${side},this.value)"></div></div></div>`;
det.innerHTML=_tbSupporterDetailHtml(s,side);
}
function renderTbSupporter(){
initTeamBuilder();
_tbRenderOneSupporterCol('tbSuppCard1','tbSuppDetail1',1);
_tbRenderOneSupporterCol('tbSuppCard2','tbSuppDetail2',2);
}
function tbOpenOptionPartsPicker(key){
initTeamBuilder();
S.tb.selectedKey=key;
renderTbSlots();
openTbPicker('option',key,{opReplaceIdx:null});
}
function tbOpenOptionReplacePicker(key,idx,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
if(S.tb.rearrange)return;
S.tb.selectedKey=key;
renderTbSlots();
openTbPicker('option',key,{opReplaceIdx:idx|0});
}
function tbClearOptionPart(key,idx,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
initTeamBuilder();
const i=idx|0;
const side=_tbSideFromKey(key);
const col=_tbIdxFromKey(key);
let sl;
if(S.tb.rearrange){sl=S.tb.rearrange.draft[side].slots[col]}
else{sl=_tbSquFromKey(key).slots[col]}
if(!sl||!Array.isArray(sl.optionParts))return;
if(i<0||i>=sl.optionParts.length)return;
sl.optionParts.splice(i,1);
S.tb.selectedKey=key;
S.tb._leaderApplyCache={};
if(S.tb.rearrange)tbRenderRearrangeBody();
else renderTeamBuilder();
}
async function renderTbStats(){
initTeamBuilder();
const pan=document.getElementById('tbStatsPanel');if(!pan)return;
const jobs=[];
for(let si=1;si<=2;si++){
const squ=S.tb.squads[si];
for(let col=0;col<5;col++){
const key=_tbKey(si,col);
const sl=squ.slots[col];
jobs.push({si,col,key,sl});
}}
const supByKey={};
const needFetch=jobs.filter(j=>j.sl&&j.sl.unitData&&S.tb.supBySide[j.si]&&S.tb.supBySide[j.si].id);
if(needFetch.length){
await Promise.all(needFetch.map(async j=>{
const ent=S.tb.supBySide[j.si];
const lb=Math.min(3,Math.max(0,ent.lbTier|0));
const slv=Math.min(100,Math.max(1,ent.level!=null?ent.level|0:100));
try{
const q=`/api/supporter/${encodeURIComponent(ent.id)}?lang=${S.lang}&level=${slv}&lb_tier=${lb}&for_unit_id=${encodeURIComponent(j.sl.unitId)}&for_char_id=${encodeURIComponent(j.sl.charId||'')}`;
const d=await fetch(q).then(r=>r.json());
supByKey[j.key]=(!d||d.error)?null:d;
}catch(_){supByKey[j.key]=null}
}));
}
const mkRow=(lbl,v,d)=>{const dn=d!=null&&Math.round(Number(d)||0)<0;return`<div class="tb-stats-unit-row${dn?' tb-stats-unit-row--neg':''}"><span class="tb-sul">${lbl}</span><span class="tb-suv-wrap"><span class="tb-suv">${fmtN(v)}</span>${_tbFmtStatDelta(d)}</span></div>`};
function colHtml(j){
const{si,col,key,sl}=j;
const sel=S.tb.selectedKey===key;
const cls='tb-stats-unit-col'+(sel?' is-sel':'');
if(!sl||!sl.unitData){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div><div class="tb-stats-unit-rows"></div></div>`;
}
const st=_tbBuildSlotStatEff(sl,si,supByKey[key]);
if(!st){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div></div>`;
}
if(st.blocked){
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name">${esc(st.ud.name||'')}</div><div class="tb-stats-unit-warn">Cannot deploy on ${esc(tTerrain(S.tb.terrainType||'Space'))} (${esc(st.terrainSymbol||'-')})</div></div>`;
}
return`<div class="${cls}" data-tb-key="${key}" role="button" tabindex="0" onclick="tbSlotClick(${key})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tbSlotClick(${key})}"><div class="tb-stats-unit-name">${esc(st.ud.name||'')}</div><div class="tb-stats-unit-rows">${mkRow(t('col_hp'),st.hp,st.dHp)}${mkRow(t('col_atk'),st.atk,st.dAtk)}${mkRow(t('col_def'),st.def,st.dDef)}${mkRow(t('col_mob'),st.mob,st.dMob)}${mkRow(t('col_mov'),st.mov,st.dMov)}</div></div>`;
}
const sections=[];
for(let si=1;si<=2;si++){
const lab=si===1?t('tb_squad1'):t('tb_squad2');
const cols=jobs.filter(j=>j.si===si).map(colHtml);
sections.push(`<div class="tb-stats-squad"><div class="tb-stats-squad-h">${esc(lab)}</div><div class="tb-stats-squad-cols">${cols.join('')}</div></div>`);
}
pan.innerHTML=`<div class="tb-stats-hint" style="font-size:11px;color:var(--text-muted);margin-bottom:10px;line-height:1.45">${esc(t('tb_stats_hint'))}${esc(t('tb_stats_hint_squad'))}</div><div class="tb-stats-all tb-stats-all--squads">${sections.join('')}</div>`;
}
function tbApplyLangStatic(){
const el=id=>document.getElementById(id);
if(el('tbPageTitle'))el('tbPageTitle').textContent=t('tab_team_builder');
if(el('tbTerrainLbl'))el('tbTerrainLbl').textContent=t('terrain');
if(el('tbDeployFront1Lbl'))el('tbDeployFront1Lbl').textContent=t('tb_front_deploy');
if(el('tbDeployRear1Lbl'))el('tbDeployRear1Lbl').textContent=t('tb_rear_deploy');
if(el('tbDeployFront2Lbl'))el('tbDeployFront2Lbl').textContent=t('tb_front_deploy');
if(el('tbDeployRear2Lbl'))el('tbDeployRear2Lbl').textContent=t('tb_rear_deploy');
if(el('tbSquad1Lbl'))el('tbSquad1Lbl').textContent=t('tb_squad1');
if(el('tbSquad2Lbl'))el('tbSquad2Lbl').textContent=t('tb_squad2');
if(el('tbBtnFormation'))el('tbBtnFormation').textContent=t('tb_formation');
if(el('tbBtnRearrange'))el('tbBtnRearrange').textContent=t('tb_rearrange');
if(el('tbRearrangeBanner'))el('tbRearrangeBanner').textContent=t('tb_rearrange_banner');
if(el('tbRearrangeLinkedLbl'))el('tbRearrangeLinkedLbl').textContent=t('tb_linked_move');
if(el('tbRearrangeCancelBtn'))el('tbRearrangeCancelBtn').textContent=t('tb_cancel');
if(el('tbRearrangeOkBtn'))el('tbRearrangeOkBtn').textContent=t('tb_confirm');
if(el('tbFormModalTitle'))el('tbFormModalTitle').textContent=t('tb_formation_modal_title');
if(el('tbFormCopyLinkBtn'))el('tbFormCopyLinkBtn').textContent=t('tb_copy_link');
if(el('tbFormScreenshotBtn'))el('tbFormScreenshotBtn').textContent=t('tb_screenshot');
if(el('tbFormSavedTitle'))el('tbFormSavedTitle').textContent=t('tb_saved_formations');
if(el('tbFormationCloseBtn'))el('tbFormationCloseBtn').textContent=t('whats_new_close');
if(el('tbMlLbl'))el('tbMlLbl').textContent=t('tb_master_league');
if(el('tbGoLbl'))el('tbGoLbl').textContent=t('tb_grand_offensive');
if(el('tbSuppLbl1'))el('tbSuppLbl1').textContent=t('tb_squad1')+' · '+t('tab_supporter');
if(el('tbSuppLbl2'))el('tbSuppLbl2').textContent=t('tb_squad2')+' · '+t('tab_supporter');
const _tbs=t('tb_clear_supporter'),_tbq=t('tb_clear_squad'),_tbi=imgUrlWebp(TB_TRASH_ICON);
if(_tbi)document.querySelectorAll('#panel-team_builder img[data-tb-trash-ic]').forEach(im=>{im.src=_tbi});
['tbClearSupp1','tbClearSupp2'].forEach(id=>{const b=document.getElementById(id);if(b){b.title=_tbs;b.setAttribute('aria-label',_tbs)}});
['tbClearSquad1','tbClearSquad2'].forEach(id=>{const b=document.getElementById(id);if(b){b.title=_tbq;b.setAttribute('aria-label',_tbq)}});
}
function tbSyncSquadLabels(){
initTeamBuilder();
const d1=t('tb_squad1'),d2=t('tb_squad2');
const n1=String(S.tb.squads[1].name||'').trim();
const n2=String(S.tb.squads[2].name||'').trim();
const el1=document.getElementById('tbSquad1Lbl'),el2=document.getElementById('tbSquad2Lbl');
if(el1)el1.textContent=n1||d1;
if(el2)el2.textContent=n2||d2;
}
function renderTeamBuilder(){initTeamBuilder();tbFillTerrainSelects();tbApplyLangStatic();tbSyncSquadLabels();_tbSyncBuffTogglesFromState();renderTbSlots();renderTbSupporter();void renderTbStats()}
let _tbPickerDebounce=null,_tbPickerAbort=null,_tbPickerGen=0;
function closeTbPicker(){if(_tbPickerAbort){try{_tbPickerAbort.abort()}catch(_){}_tbPickerAbort=null}const po=document.getElementById('tbPickerOverlay');if(po){po.classList.remove('active');po.setAttribute('aria-hidden','true')}}
async function openTbPicker(type,slotKey,opts){
if(type==='char')type='character';
initTeamBuilder();closeTbPicker();clearTimeout(_tbPickerDebounce);
let opRep=null;
if(opts&&('opReplaceIdx' in opts)&&opts.opReplaceIdx!=null)opRep=opts.opReplaceIdx|0;
S.tb.picker={type,slotKey,abort:null,gen:0,rows:[],opReplaceIdx:opRep};
_tbPickerGen++;
const ov=document.getElementById('tbPickerOverlay'),inp=document.getElementById('tbPickerSearch'),body=document.getElementById('tbPickerBody');
if(!ov||!inp||!body)return;
inp.value='';
ov.classList.add('active');ov.setAttribute('aria-hidden','false');
if(type==='option'){
const squ=_tbSquFromKey(slotKey);const sl=squ.slots[_tbIdxFromKey(slotKey)];
if(!sl||!sl.unitId){body.innerHTML=`<div style="padding:16px;color:var(--text-muted)">${esc(t('dc_pick_unit'))}</div>`;return}
body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
const uq='&unit_id='+encodeURIComponent(sl.unitId);
S.tb.picker.rows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL'+uq);
filterTbPickerList();
}catch(_){body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
setTimeout(()=>inp.focus(),50);
return;
}
if(type==='supporter'){
inp.placeholder=t('search_supporter')||'Search name, series, tags…';
body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
S.tb.picker.rows=await _tbFetchSupporterPickerRows('');
filterTbPickerList();
}catch(_){S.tb.picker.rows=[];body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
setTimeout(()=>inp.focus(),50);
return;
}
inp.placeholder=type==='character'?t('search_char'):t('search_unit');
const cached=(type==='unit'||type==='character')?_tbPickerCacheGet(type,slotKey):null;
if(cached&&cached.length)S.tb.picker.rows=cached.slice();
if(S.tb.picker.rows&&S.tb.picker.rows.length)filterTbPickerList();
else body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
setTimeout(()=>inp.focus(),50);
await _tbDoPickerSearch();
}
function filterTbPicker(){clearTimeout(_tbPickerDebounce);_tbPickerDebounce=setTimeout(()=>{const typ=S.tb.picker&&S.tb.picker.type;if(typ==='unit'||typ==='character')_tbDoPickerSearch();else if(typ==='supporter')_tbDoSupporterPickerSearch();else filterTbPickerList()},55)}
function wireTbPickerBodyClicks(){
const body=document.getElementById('tbPickerBody');
if(!body||body.dataset.tbPickWired)return;
body.dataset.tbPickWired='1';
body.addEventListener('click',function(ev){
const item=ev.target.closest('.tb-picker-item');
if(!item)return;
const id=item.getAttribute('data-tb-pick-id');
if(id==null||id==='')return;
pickTbItem(id);
});
body.addEventListener('keydown',function(ev){
if(ev.key!=='Enter'&&ev.key!==' ')return;
const item=ev.target.closest('.tb-picker-item');
if(!item||document.activeElement!==item)return;
ev.preventDefault();
const id=item.getAttribute('data-tb-pick-id');
if(id!=null&&id!=='')pickTbItem(id);
});
}
function tbRenderPickerItemCell(r,t,th){return renderEntityPickerItemCell(r,t,th,'data-tb-pick-id')}

function tbInvalidateTbPickerUnitCache(){if(S._tbPickerRowCache&&S._tbPickerRowCache.unitBySide)delete S._tbPickerRowCache.unitBySide}
function _tbPickerCharCacheKey(){return'C|'+S.lang}
function _tbPickerUnitCacheKey(side){
initTeamBuilder();
const terr=S.tb.terrainType||'Space';
const sup=S.tb.supBySide[side];
const b=sup&&sup.id?String(sup.id):'';
return'U|'+S.lang+'|'+terr+'|'+side+'|'+b;
}
function _tbPickerCacheGet(type,slotKey){
if(type!=='unit'&&type!=='character')return null;
const c=S._tbPickerRowCache;if(!c)return null;
if(type==='character'){const e=c.character;if(e&&e.key===_tbPickerCharCacheKey())return e.rows;return null}
const side=slotKey!=null?_tbSideFromKey(slotKey):1;
const want=_tbPickerUnitCacheKey(side);
const e=c.unitBySide&&c.unitBySide[String(side)];
if(e&&e.key===want)return e.rows;
return null;
}
function _tbPickerCachePut(type,slotKey,qU,rows){
if(qU)return;
const sorted=_tbSortPickerEntityRows(rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
if(type==='character'){S._tbPickerRowCache.character={key:_tbPickerCharCacheKey(),rows:sorted};return}
if(type==='unit'){
const side=slotKey!=null?_tbSideFromKey(slotKey):1;
if(!S._tbPickerRowCache.unitBySide)S._tbPickerRowCache.unitBySide={};
S._tbPickerRowCache.unitBySide[String(side)]={key:_tbPickerUnitCacheKey(side),rows:sorted};
}
}
async function tbPrimePickerCaches(){
if(typeof S==='undefined'||!S.tb)return;
initTeamBuilder();
if(S._tbPickerPrimeBusy)return;
S._tbPickerPrimeBusy=true;
const terr=_tbTerrainQuery();
const lang=S.lang;
try{
const charP=fetchJsonWithWarmupRetry(`/api/characters?lang=${lang}&page=1&per_page=100&sort=rarity&dir=desc&q=`).then(r=>r.data).then(d=>{
const rows=_tbSortPickerEntityRows(d.rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
S._tbPickerRowCache.character={key:_tbPickerCharCacheKey(),rows};
}).catch(()=>{});
function primeSide(side){
const sup=S.tb.supBySide[side];
const bq=sup&&sup.id?String(sup.id):'';
const boostQ=bq?'&tb_boost_supporter='+encodeURIComponent(bq):'';
const pp=bq?'600':'100';
const url=`/api/units?lang=${lang}&page=1&per_page=${pp}&sort=rarity&dir=desc&q=${encodeURIComponent('')}&rarity=ALL${terr}${boostQ}`;
return fetchJsonWithWarmupRetry(url).then(r=>r.data).then(d=>{
const rows=_tbSortPickerEntityRows(d.rows||[]);
S._tbPickerRowCache=S._tbPickerRowCache||{};
if(!S._tbPickerRowCache.unitBySide)S._tbPickerRowCache.unitBySide={};
S._tbPickerRowCache.unitBySide[String(side)]={key:_tbPickerUnitCacheKey(side),rows};
}).catch(()=>{});
}
await Promise.all([charP,primeSide(1),primeSide(2)]);
}catch(_){}
finally{S._tbPickerPrimeBusy=false}
}

async function _tbFetchSupporterPickerRows(qRaw){
let extra='&rarity=ALL';
const ss=S._tbSupPickerSide===2?2:1;
const squ=S.tb.squads[ss];
const uIds=[],cIds=[];
for(let i=0;i<5;i++){
const sl=squ&&squ.slots?squ.slots[i]:null;
if(sl&&sl.unitData){uIds.push(sl.unitId);cIds.push(sl.charId||'')}
}
if(uIds.length){
extra+='&unit_ids='+encodeURIComponent(uIds.join(','))+'&char_ids='+encodeURIComponent(cIds.join(','));
}
const q=String(qRaw||'').trim();
const d=await fetch(`/api/supporters?lang=${S.lang}&page=1&per_page=100&sort=rarity&dir=desc&q=${encodeURIComponent(q)}${extra}`).then(r=>r.json());
return d.rows||[];
}
async function _tbDoSupporterPickerSearch(){
const body=document.getElementById('tbPickerBody');if(!body)return;
const q=String(document.getElementById('tbPickerSearch').value||'').trim();
const haveInstant=!!(S.tb.picker.rows&&S.tb.picker.rows.length);
if(!haveInstant||q)body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
S.tb.picker.rows=await _tbFetchSupporterPickerRows(q);
filterTbPickerList();
}catch(_){if(!haveInstant||q)body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
}
function filterTbPickerList(){
const body=document.getElementById('tbPickerBody');if(!body)return;
const pType=S.tb.picker.type;
const q=String(document.getElementById('tbPickerSearch').value||'').trim().toLowerCase();
let rows=S.tb.picker.rows||[];
if(q&&pType!=='unit'&&pType!=='character'&&pType!=='supporter'){
rows=rows.filter(r=>_tbPickerRowSearchHay(r).includes(q));
}else if(q&&pType==='supporter'){
// API already matched name/tags; keep a local refine for series_tag / skill_tag_data shape.
rows=rows.filter(r=>_tbPickerRowSearchHay(r).includes(q));
}
if(pType==='option'&&S.tb.picker.slotKey!=null){
const usedSsr=_tbCollectUsedSsrOptionPartIds(S.tb.picker.slotKey);
rows=rows.filter(r=>r&&r.id!=null&&!(_tbOptionPartIsSsr(r)&&usedSsr.has(String(r.id))));
}
if(pType==='unit'||pType==='character'||pType==='option'||pType==='supporter')rows=_tbSortPickerEntityRows(rows);
if(!rows.length){body.innerHTML=`<div style="padding:16px;color:var(--text-muted)">${esc(t('search_spotlight_empty'))}</div>`;return}
const th=52;
let cells;
if(pType==='option'){
const RARITY_COLORS={'UR':'#fbbf24','SSR':'#f97316','SR':'#a78bfa','R':'#60a5fa','N':'#94a3b8'};
cells=rows.map(r=>{
const rc=RARITY_COLORS[r.rarity]||'#94a3b8';
const meta=((r.details||'').trim()+(r.tags&&r.tags.length?(' · '+r.tags.map(tg=>tg.name).filter(Boolean).join(' · ')):''));
return`<div class="tb-picker-item cmp-picker-item" role="button" tabindex="0" data-tb-pick-id="${escAttr(String(r.id))}" style="padding:8px 12px;cursor:pointer;width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--border-color);background:var(--card-bg)"><div><div style="display:flex;align-items:center;gap:6px"><span style="color:${rc};font-weight:700;font-size:11px">${esc(r.rarity||'')}</span><span class="cmp-picker-item-name" style="font-size:13px">${esc(r.name)}</span></div>${meta?`<div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.35">${esc(meta)}</div>`:''}</div></div>`;
}).join('');
body.innerHTML=`<div class="tb-picker-option-list">${cells}</div>`;
return;
}else if(pType==='supporter'){
cells=rows.map(r=>tbRenderPickerItemCell(r,'supp',th));
}else{
cells=rows.map(r=>tbRenderPickerItemCell(r,pType==='character'?'char':'unit',th));
}
body.innerHTML=`<div class="tb-picker-grid">${cells.join('')}</div>`;
}
async function _tbDoPickerSearch(){
const type=S.tb.picker.type,q=document.getElementById('tbPickerSearch').value.trim(),body=document.getElementById('tbPickerBody');
if(!body)return;
if(_tbPickerAbort){try{_tbPickerAbort.abort()}catch(_){}}
const ac=new AbortController();_tbPickerAbort=ac;const myGen=++_tbPickerGen;
const base=type==='character'?'/api/characters':'/api/units';
const qU=expandTbPickerSearchQuery(q,type);
const terr=type==='unit'?_tbTerrainQuery():'';
let boostQ='';
if(type==='unit'){
const sk=S.tb.picker.slotKey;
const side=sk!=null?_tbSideFromKey(sk):1;
const sup=S.tb.supBySide[side];
if(sup&&sup.id)boostQ='&tb_boost_supporter='+encodeURIComponent(sup.id);
}
const ppTb=boostQ?'600':'100';
const haveInstantList=!qU&&S.tb.picker.rows&&S.tb.picker.rows.length;
if(!haveInstantList||qU)body.innerHTML=`<div style="padding:12px;color:var(--text-muted)">…</div>`;
try{
const url=`${base}?lang=${S.lang}&page=1&per_page=${ppTb}&sort=rarity&dir=desc&q=${encodeURIComponent(qU)}&rarity=ALL${terr}${boostQ}`;
const r=await fetch(url,{signal:ac.signal});
const d=await r.json();
if(myGen!==_tbPickerGen)return;
S.tb.picker.rows=_tbSortPickerEntityRows(d.rows||[]);
_tbPickerCachePut(type,S.tb.picker.slotKey,qU,S.tb.picker.rows);
filterTbPickerList();
}catch(e){if(e&&e.name==='AbortError')return;if(myGen!==_tbPickerGen)return;if(!haveInstantList||qU)body.innerHTML=`<div style="padding:16px">${esc(t('search_spotlight_empty'))}</div>`}
}
async function _tbAssignUnitDataToSlot(sl,d,sidStr){
if(!sl||!d||d.error)return;
sl.unitId=String(sidStr!=null?sidStr:d.id);sl.unitData=d;sl.optionParts=[];
if(!_tbUnitAllowsSpSsp(d))sl.unitStatMode='normal';
sl.charId=null;sl.charData=null;
const rc=d.recommend_character;
if(rc&&rc.id){
try{
const cd=await fetch(`/api/character/${encodeURIComponent(rc.id)}?lang=${S.lang}`).then(r=>r.json());
if(!cd.error){sl.charId=String(rc.id);sl.charData=cd}
}catch(_){}
}
}
async function pickTbItem(id){
const sid=String(id==null?'':id).trim();
const pik=S.tb.picker||{};
const type=pik.type,slotKey=pik.slotKey;
const repIdx=('opReplaceIdx' in pik&&pik.opReplaceIdx!=null)?(pik.opReplaceIdx|0):null;
const rowsSnap=pik.rows||[];
closeTbPicker();
initTeamBuilder();
if(type==='supporter'){
if(!sid)return;
const ss=S._tbSupPickerSide===2?2:1;
try{
const prevLb=S.tb.supBySide[ss]&&S.tb.supBySide[ss].lbTier!=null?S.tb.supBySide[ss].lbTier|0:3;
const prevLv=S.tb.supBySide[ss]&&S.tb.supBySide[ss].level!=null?S.tb.supBySide[ss].level|0:100;
const d=await fetch(`/api/supporter/${encodeURIComponent(sid)}?lang=${S.lang}&level=${prevLv}&lb_tier=${prevLb}${_tbSupporterFetchQs(ss)}`).then(r=>r.json());
if(!d.error){S.tb.supBySide[ss]={id:sid,data:d,lbTier:d.lb_tier!=null?d.lb_tier|0:prevLb,level:Math.min(100,Math.max(1,d.level!=null?d.level|0:prevLv))};S.tb._leaderApplyCache={};tbInvalidateTbPickerUnitCache()}
}catch(_){}
renderTeamBuilder();return;
}
if(slotKey==null)return;
if(!sid)return;
const squ=_tbSquFromKey(slotKey);const sl=squ.slots[_tbIdxFromKey(slotKey)];
if(type==='unit'){
try{
const d=await fetch(`/api/unit/${encodeURIComponent(sid)}?lang=${S.lang}`).then(r=>r.json());
await _tbAssignUnitDataToSlot(sl,d,sid);
await tbAutoFillEmptyOptionParts({skipRender:true});
}catch(_){}
}else if(type==='character'){
try{const d=await fetch(`/api/character/${encodeURIComponent(sid)}?lang=${S.lang}`).then(r=>r.json());if(!d.error){sl.charId=sid;sl.charData=d}}catch(_){}
}else if(type==='option'){
const hit=rowsSnap.find(x=>String(x.id)===String(sid));
if(hit){
if(!sl.optionParts)sl.optionParts=[];
if(repIdx!=null&&repIdx>=0&&repIdx<sl.optionParts.length){
const usedSsr=_tbCollectUsedSsrOptionPartIds(slotKey);
(sl.optionParts||[]).forEach((pp,i)=>{if(i!==repIdx&&pp&&pp.id&&_tbOptionPartIsSsr(pp))usedSsr.add(String(pp.id))});
if(_tbOptionPartIsSsr(hit)&&usedSsr.has(String(hit.id)))return;
sl.optionParts[repIdx]=hit;
}else{
if(sl.optionParts.length>=5)return;
if(sl.optionParts.some(p=>p&&String(p.id)===String(hit.id)))return;
const usedSsr=_tbCollectUsedSsrOptionPartIds(slotKey);
if(_tbOptionPartIsSsr(hit)&&usedSsr.has(String(hit.id)))return;
sl.optionParts=[hit];
}
}
}
renderTeamBuilder();
}
function openTbSupporterPicker(side){initTeamBuilder();S._tbSupPickerSide=side===2?2:1;S.tb.picker.slotKey=null;openTbPicker('supporter',null)}
function tbStartRearrange(){
initTeamBuilder();
S.tb.rearrange={draft:JSON.parse(JSON.stringify(S.tb.squads)),pendingKey:null,pendingPart:null};
document.getElementById('tbRearrangeOverlay').classList.add('active');
document.getElementById('tbRearrangeOverlay').setAttribute('aria-hidden','false');
tbRenderRearrangeBody();
}
function tbRenderRearrangeBody(){
const body=document.getElementById('tbRearrangeBody');if(!body)return;
const linked=!!document.getElementById('tbRearrangeLinked').checked;
function rowSeg(side,col0,col1,rowCls){
const squ=S.tb.rearrange.draft[side];
let h='';
for(let col=col0;col<col1;col++){
const key=_tbKey(side,col);
const sl=squ.slots[col];
const pk=S.tb.rearrange.pendingKey===key&&linked;
let slotInner='';
if(linked){
slotInner=`<div class="tb-slot${pk?' is-rearrange-pending':''}" style="width:100%;max-width:100px" onclick="tbRearrangeTap(${key})">${_tbLongCardHtml(sl,key)}</div>`;
}else{
slotInner=`<div class="tb-slot" style="width:100%;max-width:100px">${_tbLongCardHtmlRearrangeUnlinked(sl,key)}</div>`;
}
h+=`<div class="tb-slot-col tb-slot-col--rearrange" style="width:100px">${slotInner}${_tbSlotLbOutsideHtml(sl,key)}${_tbSlotOpOutsideHtml(key,sl)}</div>`;
}
return`<div class="tb-slot-row ${rowCls}">${h}</div>`;
}
function squadBlock(side,squadTitle){
const nm=S.tb.rearrange.draft[side]&&S.tb.rearrange.draft[side].name?String(S.tb.rearrange.draft[side].name).trim():'';
const head=nm?esc(nm):esc(squadTitle);
return`<div class="tb-rearrange-squad"><div class="tb-slots-label">${head}</div><div class="tb-deploy-lbl" style="margin-top:6px">${esc(t('tb_front_deploy'))}</div>${rowSeg(side,0,3,'')}<div class="tb-deploy-lbl" style="margin-top:10px">${esc(t('tb_rear_deploy'))}</div>${rowSeg(side,3,5,'tb-slot-row--rear')}</div>`;
}
body.innerHTML=`<div class="tb-rearrange-dual">${squadBlock(1,t('tb_squad1'))}${squadBlock(2,t('tb_squad2'))}</div>`;
}
function tbRearrangeLinkedToggle(){
if(!S.tb.rearrange)return;
S.tb.rearrange.pendingKey=null;
S.tb.rearrange.pendingPart=null;
tbRenderRearrangeBody();
}
function tbRearrangeTapPart(key,part,ev){
if(ev){ev.preventDefault();ev.stopPropagation()}
if(!S.tb.rearrange)return;
if(!!document.getElementById('tbRearrangeLinked').checked)return;
const p=part==='pilot'?'pilot':'unit';
const pend=S.tb.rearrange;
if(pend.pendingKey==null){pend.pendingKey=key;pend.pendingPart=p;tbRenderRearrangeBody();return}
const a=pend.pendingKey,b=key;
if(a===b&&pend.pendingPart===p){pend.pendingKey=null;pend.pendingPart=null;tbRenderRearrangeBody();return}
const sa=_tbSideFromKey(a),sb=_tbSideFromKey(b);
if(sa!==sb){pend.pendingKey=b;pend.pendingPart=p;tbRenderRearrangeBody();return}
if(pend.pendingPart!==p){pend.pendingKey=b;pend.pendingPart=p;tbRenderRearrangeBody();return}
const squ=S.tb.rearrange.draft[sa];
const ia=_tbIdxFromKey(a),ib=_tbIdxFromKey(b);
const slotA=squ.slots[ia],slotB=squ.slots[ib];
if(p==='unit'){
const ua={unitId:slotA.unitId,unitData:slotA.unitData,optionParts:slotA.optionParts||[],lbTier:slotA.lbTier|0,unitStatMode:slotA.unitStatMode||'normal',unitCondPassive:!!slotA.unitCondPassive,unitTurnBuffAtk:!!slotA.unitTurnBuffAtk,unitTurnBuffDef:!!slotA.unitTurnBuffDef,exSquadAtkPct:slotA.exSquadAtkPct|0};
const ub={unitId:slotB.unitId,unitData:slotB.unitData,optionParts:slotB.optionParts||[],lbTier:slotB.lbTier|0,unitStatMode:slotB.unitStatMode||'normal',unitCondPassive:!!slotB.unitCondPassive,unitTurnBuffAtk:!!slotB.unitTurnBuffAtk,unitTurnBuffDef:!!slotB.unitTurnBuffDef,exSquadAtkPct:slotB.exSquadAtkPct|0};
slotA.unitId=ub.unitId;slotA.unitData=ub.unitData;slotA.optionParts=ub.optionParts;slotA.lbTier=ub.lbTier;slotA.unitStatMode=ub.unitStatMode;slotA.unitCondPassive=ub.unitCondPassive;slotA.unitTurnBuffAtk=ub.unitTurnBuffAtk;slotA.unitTurnBuffDef=ub.unitTurnBuffDef;slotA.exSquadAtkPct=ub.exSquadAtkPct;
slotB.unitId=ua.unitId;slotB.unitData=ua.unitData;slotB.optionParts=ua.optionParts;slotB.lbTier=ua.lbTier;slotB.unitStatMode=ua.unitStatMode;slotB.unitCondPassive=ua.unitCondPassive;slotB.unitTurnBuffAtk=ua.unitTurnBuffAtk;slotB.unitTurnBuffDef=ua.unitTurnBuffDef;slotB.exSquadAtkPct=ua.exSquadAtkPct;
}else{
const ca={charId:slotA.charId,charData:slotA.charData,charCondPassive:!!slotA.charCondPassive};
const cb={charId:slotB.charId,charData:slotB.charData,charCondPassive:!!slotB.charCondPassive};
slotA.charId=cb.charId;slotA.charData=cb.charData;slotA.charCondPassive=cb.charCondPassive;
slotB.charId=ca.charId;slotB.charData=ca.charData;slotB.charCondPassive=ca.charCondPassive;
}
pend.pendingKey=null;pend.pendingPart=null;tbRenderRearrangeBody();
}
function tbRearrangeTap(key){
if(!S.tb.rearrange)return;
if(!document.getElementById('tbRearrangeLinked').checked)return;
if(S.tb.rearrange.pendingKey==null){S.tb.rearrange.pendingKey=key;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const a=S.tb.rearrange.pendingKey,b=key;
if(a===b){S.tb.rearrange.pendingKey=null;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const sa=_tbSideFromKey(a),sb=_tbSideFromKey(b);
if(sa!==sb){S.tb.rearrange.pendingKey=key;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();return}
const squ=S.tb.rearrange.draft[sa];
const ia=_tbIdxFromKey(a),ib=_tbIdxFromKey(b);
const slotA=squ.slots[ia],slotB=squ.slots[ib];
const ta=JSON.parse(JSON.stringify(slotA));const tbj=JSON.parse(JSON.stringify(slotB));Object.keys(slotA).forEach(k=>delete slotA[k]);Object.assign(slotA,tbj);Object.keys(slotB).forEach(k=>delete slotB[k]);Object.assign(slotB,ta);
S.tb.rearrange.pendingKey=null;S.tb.rearrange.pendingPart=null;tbRenderRearrangeBody();
}
function tbRearrangeCancel(){
S.tb.rearrange=null;
const o=document.getElementById('tbRearrangeOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
renderTeamBuilder();
}
function tbRearrangeConfirm(){
if(!S.tb.rearrange)return;
S.tb.squads=JSON.parse(JSON.stringify(S.tb.rearrange.draft));
S.tb.rearrange=null;
const o=document.getElementById('tbRearrangeOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
S.tb._leaderApplyCache={};
renderTeamBuilder();
}
function openTbFormationModal(){
tbApplyLangStatic();
tbSyncSquadLabels();
tbRenderFormationPreview();
const list=document.getElementById('tbFormationList');if(!list)return;
const arr=_tbReadFormations();
const fph=escAttr(t('tb_formation_name_placeholder'));
list.innerHTML=arr.map((x,i)=>`<div class="tb-form-row tb-form-row--saved"><span class="tb-form-slot-idx">${i+1}.</span><input type="text" id="tbFormName${i}" maxlength="80" value="${escAttr(x.name)}" placeholder="${fph}" aria-label="${fph}" onblur="_tbPersistFormationSlotName(${i})"><button type="button" class="tb-form-row-action" onclick="tbClearFormationSlot(${i})">${esc(t('tb_clear_formation_slot'))}</button><button type="button" class="tb-form-row-action" onclick="tbSaveFormationSlot(${i})">${esc(t('tb_save'))}</button><button type="button" class="tb-form-row-action" onclick="tbLoadFormationSlot(${i})">${esc(t('tb_load'))}</button></div>`).join('');
const o=document.getElementById('tbFormationOverlay');
if(o){o.classList.add('active');o.setAttribute('aria-hidden','false')}
}
function closeTbFormationModal(){
if(!S._tbSkipFormationCloseSync){
const prev=document.getElementById('tbFormationPreview');
if(prev){
const inps=prev.querySelectorAll('.tb-fpv-name-input');
if(inps[0])tbSyncSquadNameFromFormation(1,inps[0]);
if(inps[1])tbSyncSquadNameFromFormation(2,inps[1]);
}
}
const o=document.getElementById('tbFormationOverlay');if(o){o.classList.remove('active');o.setAttribute('aria-hidden','true')}
}
function _tbPersistFormationSlotName(i){
const arr=_tbReadFormations();
const ni=document.getElementById('tbFormName'+i);
if(!ni||!arr[i])return;
let nm=String(ni.value||'').trim().slice(0,80);
if(!nm)nm=String(arr[i].name||'').trim()||('Formation '+(i+1));
arr[i]=Object.assign({},arr[i],{name:nm});
ni.value=nm;
_tbWriteFormations(arr);
}
function tbClearFormationSlot(i){
const arr=_tbReadFormations();
if(!arr[i])return;
arr[i]=Object.assign({},arr[i],{data:null});
_tbWriteFormations(arr);
openTbFormationModal();
}
function tbSaveFormationSlot(i){
const arr=_tbReadFormations();
const ni=document.getElementById('tbFormName'+i);
arr[i]={name:ni?ni.value.trim().slice(0,80)||arr[i].name:arr[i].name,data:tbSnapshot()};
_tbWriteFormations(arr);openTbFormationModal();
}
async function tbLoadFormationSlot(i){const arr=_tbReadFormations();const x=arr[i];if(x&&x.data){S._tbSkipFormationCloseSync=1;try{await tbApplySnapshot(x.data)}finally{S._tbSkipFormationCloseSync=0}}closeTbFormationModal()}
function _tbCheckUrlParams(){
const p=new URLSearchParams(location.search);
const _t=p.get('tab');
if(_t!=='team_builder'&&_t!=='TB')return;
initTeamBuilder();
const teamRaw=p.get('team');
switchTab('team_builder');
if(teamRaw){
void (async()=>{
try{
const obj=await _tbDecodeTeamShare(teamRaw);
if(!obj)return;
const snap=obj.v===2?_tbExpandSnapshotV2(obj):(obj.v===1?obj:null);
if(snap)await tbApplySnapshot(snap);
}catch(e){console.warn('team share payload',e)}
})();
}
}

if(typeof initTeamBuilder==='function') global.initTeamBuilder=initTeamBuilder;
if(typeof renderTeamBuilder==='function') global.renderTeamBuilder=renderTeamBuilder;
if(typeof tbRefreshSlottedUnitData==='function') global.tbRefreshSlottedUnitData=tbRefreshSlottedUnitData;
if(typeof tbAutoFillEmptyOptionParts==='function') global.tbAutoFillEmptyOptionParts=tbAutoFillEmptyOptionParts;
if(typeof tbPrimePickerCaches==='function') global.tbPrimePickerCaches=tbPrimePickerCaches;
if(typeof tbApplyLangStatic==='function') global.tbApplyLangStatic=tbApplyLangStatic;
if(typeof wireTbPickerBodyClicks==='function') global.wireTbPickerBodyClicks=wireTbPickerBodyClicks;
if(typeof closeTbPicker==='function') global.closeTbPicker=closeTbPicker;
if(typeof _tbCheckUrlParams==='function') global._tbCheckUrlParams=_tbCheckUrlParams;
if(typeof tbClearSupporter==='function') global.tbClearSupporter=tbClearSupporter;
if(typeof tbClearSquad==='function') global.tbClearSquad=tbClearSquad;
if(typeof onTbTerrainChange==='function') global.onTbTerrainChange=onTbTerrainChange;
if(typeof toggleTbMasterLeague==='function') global.toggleTbMasterLeague=toggleTbMasterLeague;
if(typeof toggleTbGrandOffensive==='function') global.toggleTbGrandOffensive=toggleTbGrandOffensive;
if(typeof openTbFormationModal==='function') global.openTbFormationModal=openTbFormationModal;
if(typeof closeTbFormationModal==='function') global.closeTbFormationModal=closeTbFormationModal;
if(typeof tbStartRearrange==='function') global.tbStartRearrange=tbStartRearrange;
if(typeof openTbSupporterPicker==='function') global.openTbSupporterPicker=openTbSupporterPicker;
if(typeof tbSlotClick==='function') global.tbSlotClick=tbSlotClick;
if(typeof tbPilotAddClick==='function') global.tbPilotAddClick=tbPilotAddClick;
if(typeof tbPilotPickRecommended==='function') global.tbPilotPickRecommended=tbPilotPickRecommended;
if(typeof tbSetSlotLbTier==='function') global.tbSetSlotLbTier=tbSetSlotLbTier;
if(typeof tbSetSlotUnitStatMode==='function') global.tbSetSlotUnitStatMode=tbSetSlotUnitStatMode;
if(typeof tbSlotContextMenu==='function') global.tbSlotContextMenu=tbSlotContextMenu;
if(typeof tbOpenOptionPartsPicker==='function') global.tbOpenOptionPartsPicker=tbOpenOptionPartsPicker;
if(typeof tbOpenOptionReplacePicker==='function') global.tbOpenOptionReplacePicker=tbOpenOptionReplacePicker;
if(typeof tbClearOptionPart==='function') global.tbClearOptionPart=tbClearOptionPart;
if(typeof tbSetSupporterLbFromIcon==='function') global.tbSetSupporterLbFromIcon=tbSetSupporterLbFromIcon;
if(typeof tbOnSupporterLevelInput==='function') global.tbOnSupporterLevelInput=tbOnSupporterLevelInput;
if(typeof filterTbPicker==='function') global.filterTbPicker=filterTbPicker;
if(typeof filterTbPickerList==='function') global.filterTbPickerList=filterTbPickerList;
if(typeof pickTbItem==='function') global.pickTbItem=pickTbItem;
if(typeof tbRearrangeLinkedToggle==='function') global.tbRearrangeLinkedToggle=tbRearrangeLinkedToggle;
if(typeof tbRearrangeTapPart==='function') global.tbRearrangeTapPart=tbRearrangeTapPart;
if(typeof tbRearrangeTap==='function') global.tbRearrangeTap=tbRearrangeTap;
if(typeof tbRearrangeCancel==='function') global.tbRearrangeCancel=tbRearrangeCancel;
if(typeof tbRearrangeConfirm==='function') global.tbRearrangeConfirm=tbRearrangeConfirm;
if(typeof tbFormationCopyLink==='function') global.tbFormationCopyLink=tbFormationCopyLink;
if(typeof tbFormationScreenshot==='function') global.tbFormationScreenshot=tbFormationScreenshot;
if(typeof tbClearFormationSlot==='function') global.tbClearFormationSlot=tbClearFormationSlot;
if(typeof tbSaveFormationSlot==='function') global.tbSaveFormationSlot=tbSaveFormationSlot;
if(typeof tbLoadFormationSlot==='function') global.tbLoadFormationSlot=tbLoadFormationSlot;
if(typeof tbSyncSquadNameFromFormation==='function') global.tbSyncSquadNameFromFormation=tbSyncSquadNameFromFormation;
if(typeof openTbPicker==='function') global.openTbPicker=openTbPicker;
if(typeof tbFillTerrainSelects==='function') global.tbFillTerrainSelects=tbFillTerrainSelects;
if(typeof renderTbSlots==='function') global.renderTbSlots=renderTbSlots;
if(typeof renderTbSupporter==='function') global.renderTbSupporter=renderTbSupporter;
if(typeof renderTbStats==='function') global.renderTbStats=renderTbStats;
if(typeof tbRenderFormationPreview==='function') global.tbRenderFormationPreview=tbRenderFormationPreview;
if(typeof tbRenderRearrangeBody==='function') global.tbRenderRearrangeBody=tbRenderRearrangeBody;
if(typeof wireTbPickerBodyClicks==='function') try{wireTbPickerBodyClicks()}catch(_){}
global.GgenTeamBuilder={loaded:1};
})(typeof window!=='undefined'?window:globalThis);
