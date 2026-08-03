/* Lazy-loaded calculator + team builder (route-split from app.js). */
function _dcWeaponAttributeDisplayHtml(wpn){
const lab=weaponAttrDisplayLabel(wpn);
if(!lab)return '';
return `<span class="dc-wpn-attr-pill">${esc('<'+lab+'>')}</span>`;
}
const DC_WPN_ATK_TYPE_ICON_FALLBACK={Ranged:'/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp',Melee:'/static/images/UI/UI_Common_TypeIcon_Melee_S.webp',Awaken:'/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp',Attack:'/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.webp'};
function _dcWeaponAttackTypeIconsHtml(wpn){
const ats=wpn.attack_types||[];
if(!ats.length)return '';
return ats.map(at=>{
const raw=(at.label||'').trim();
const iconKey=(at.key||'').trim()||DC_ATK_TYPE_LABEL_MAP[raw]||raw;
const src=(at.icon&&String(at.icon).trim())||DC_WPN_ATK_TYPE_ICON_FALLBACK[iconKey]||DC_WPN_ATK_TYPE_ICON_FALLBACK[raw]||'';
if(!src)return '';
const tip=esc(raw||iconKey);
return`<img class="dc-wpn-atk-type-icon" src="${imgUrlPreferCdn(src)}" alt="" loading="lazy" title="${tip}" onerror="this.style.display='none'">`;
}).join('');
}
function _dcWeaponDtuSumPct(wpn){
const keys=_dcWeaponAttributeKeys(wpn);
let sum=0;
keys.forEach(k=>{
if(k==='beam')sum+=S.dc.dtuBeam||0;
else if(k==='physical')sum+=S.dc.dtuPhysical||0;
else sum+=S.dc.dtuSpecial||0;
});
return sum;
}
function _dcWeaponElement(wpn){return _dcWeaponAttributeKeys(wpn)[0]||'special'}
function _dcDefaultWeaponDistance(wpn){const eff=_dcGetEffectiveRange(wpn);const mn=eff.min_range||1,mx=eff.max_range||mn;let d=Math.max(1,mn);if(d>mx)d=mx;return d}
function _dcNonMapWeapons(ud){
if(!ud||!ud.weapons)return[];
const um=S.dc.unitStatMode||'normal';
return ud.weapons.filter(w=>w.weapon_type!=='3'&&(!w.is_ssp_weapon||um==='ssp'));
}
/** From API: per-level enemy DEF % down on this attack (base + optional Supercharged-only line). */
function _dcWeaponEnemyDefDebuffEffective(wpn,wpnLvIdx){
if(!wpn)return 0;
const lv=_dcWeaponLevelRow(wpn,wpnLvIdx);
let b=parseInt(lv.enemy_def_debuff_base_pct,10);
let sp=parseInt(lv.enemy_def_debuff_supercharged_pct,10);
if(Number.isNaN(b))b=0;
if(Number.isNaN(sp))sp=0;
if(!b&&!sp){
const leg=parseInt(lv.enemy_def_debuff_pct,10);
if(!Number.isNaN(leg)&&leg>0)b=leg;
}
const sup=_dcNormMpLevel(S.dc.mpLevel)==='super';
let pct=Math.max(b,sup?Math.max(b,sp):b);
const wt=_dcParseWeaponTraits(wpn,wpnLvIdx);
if((wt.enemyTagDefBonus|0)>0&&_dcEnemyTagWeaponBonusActive(wt))pct+=(wt.enemyTagDefBonus|0);
return Math.min(100,pct);
}
function _dcManualPlusWeaponDefDebuffPct(wpn,wpnLvIdx){
const manual=parseInt(document.getElementById('dcDefDebuffPct')?.value,10)||0;
const wp=_dcWeaponEnemyDefDebuffEffective(wpn,wpnLvIdx);
return Math.min(100,manual+wp);
}
function _dcGetAutoWeaponPowerDisplay(){
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons)return null;
const wpns=_dcNonMapWeapons(ud);const wpn=wpns[S.dc.wpnIdx];if(!wpn)return null;
return _dcComputedWeaponPowerForLevel(wpn,S.dc.wpnLv);
}
function _dcRefreshFinalWpnPowPlaceholder(){
const el=document.getElementById('dcFinalWpnPow');if(!el)return;
const v=_dcGetAutoWeaponPowerDisplay();
el.placeholder=v!=null?`Auto (${fmtN(v)})`:'Auto (—)';
}
function _dcRefreshDtuInputHighlights(){
['dcDtuRowBeam','dcDtuRowPhysical','dcDtuRowSpecial'].forEach(id=>{const row=document.getElementById(id);if(row)row.classList.remove('dc-dtu-row--on','dc-dtu--beam','dc-dtu--physical','dc-dtu--special')});
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons)return;
const wpns=_dcNonMapWeapons(ud);const w=wpns[S.dc.wpnIdx];if(!w)return;
const keys=_dcWeaponAttributeKeys(w);
const map={beam:['dcDtuRowBeam','dc-dtu--beam'],physical:['dcDtuRowPhysical','dc-dtu--physical'],special:['dcDtuRowSpecial','dc-dtu--special']};
keys.forEach(k=>{const m=map[k];if(!m)return;const row=document.getElementById(m[0]);if(row){row.classList.add('dc-dtu-row--on',m[1])}});
}
function _dcRefreshDefDebuffInputStyle(){
const el=document.getElementById('dcDefDebuffPct');if(!el)return;
el.classList.toggle('dc-input--def-debuff',(parseInt(el.value)||0)>0);
}
function _dcRefreshCalcDependentUi(){
_dcRefreshFinalWpnPowPlaceholder();
_dcRefreshDtuInputHighlights();
_dcRefreshDefDebuffInputStyle();
_dcRefreshDmgIncreaseVigorSub();
_dcApplySupportCounterLang();
_dcUpdateSupportCounterAtkUi();
}
function _dcApplySupportCounterLang(rawPct){
const titleEl=document.getElementById('dcAtkSupportCounterTitle');
if(titleEl){titleEl.textContent=t('dc_support_counter_title');titleEl.title=t('dc_support_counter_tip')}
const pct=rawPct!=null&&rawPct!==''?rawPct|0:(S.dc._supportCounterAtkPct|0);
const note=document.getElementById('dcAtkSupportCounterPilotNote');
if(note&&pct>0)note.innerHTML=t('dc_support_counter_pilot_note').replace('{pct}',String(pct));
}
function _dcRefreshDmgIncreaseVigorSub(){
const el=document.getElementById('dcDmgIncreaseVigorSub');
const effEl=document.getElementById('dcDmgIncreaseEffectiveLine');
const user=parseInt(document.getElementById('dcDmgIncrease')?.value,10)||0;
const mp=_dcMpProfile(S.dc.mpLevel);
const vigPct=Math.round((mp.dmgBonus||0)*100);
const total=user+vigPct;
if(effEl){
if(vigPct>0||user>0){
effEl.style.display='';
effEl.removeAttribute('aria-hidden');
effEl.textContent=`Effective ⑨ total: ${total}% (${user}% passive${vigPct>0?` + ${vigPct}% vigor`:''}) — same value used in damage.`;
effEl.title='Damage Dealt Up % passive plus vigor bonus share one pool; they are not applied twice.';
}else{
effEl.style.display='none';effEl.textContent='';effEl.setAttribute('aria-hidden','true');
}
}
if(!el)return;
if(vigPct<=0){el.style.display='none';el.textContent='';el.setAttribute('aria-hidden','true');return}
const lk=_dcNormMpLevel(S.dc.mpLevel);
el.style.display='';
el.removeAttribute('aria-hidden');
el.className='dc-stat-mini-bonus';
el.title='Vigor adds this % into the same ⑨ damage increase pool as Damage Dealt Up % (not double-counted).';
el.textContent=String(t('dc_vigor_dmg_bonus_sub')).replace('{pct}',String(vigPct)).replace('{label}',_dcVigorLabel(lk));
}
function _dcRefreshTotalDebuffsDisplay(){
const el=document.getElementById('dcTotalDebuffsDisplay');if(!el)return;
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons){el.textContent='—';return}
const wpns=_dcNonMapWeapons(ud);const w=wpns[S.dc.wpnIdx];if(!w){el.textContent='—';return}
el.textContent=String(_dcWeaponDtuSumPct(w)||0);
}
function _dcCreateEmptyAttackerSlot(){
return JSON.parse(JSON.stringify({
atkUnit:null,atkChar:null,atkUnitData:null,atkCharData:null,
lbTier:3,wpnIdx:0,wpnLv:0,
unitStatMode:'normal',charStatMode:'normal',unitCondPassive:false,charCondPassive:false,dcSuperchargedExTier:0,
optionParts:[],supporters:[],
_unitIsSD:false,
_wpnTraitDistPow:0,_wpnTraitHpPow:0,_wpnTraits:{},
_wpnCritDmgUp:0,_integratedWpnCritDmgUp:0,
_vigorCondThreshold:null,
_activeSkills:{},
mpLevel:'medium',
terrainMode:'normal',terrain:0,
finalWpnPow:0,dmgIncrease:0,critDmgUp:0,exSquadAtkPct:0,exSquadAtkPctExplicitZero:false,squadCondPct:0,atkCounterOwnAtk:false,supportCounterAtk:false,_supportCounterAtkPct:0,supportCntPairSnap:null,applyAdvantageEnemyTag:true,applyZeonEnemyTag:true,
unitTurnBuffAtk:false,unitTurnBuffDef:false,masterLeagueBuff:false,grandOffensiveBuff:false,bigRangZeonSquadBuff:false
}));
}
function _dcReadAttackerFromDc(){
return JSON.parse(JSON.stringify({
atkUnit:S.dc.atkUnit,atkChar:S.dc.atkChar,
atkUnitData:S.dc.atkUnitData,atkCharData:S.dc.atkCharData,
lbTier:S.dc.lbTier,wpnIdx:S.dc.wpnIdx,wpnLv:S.dc.wpnLv,
unitStatMode:S.dc.unitStatMode||'normal',charStatMode:S.dc.charStatMode||'normal',
unitCondPassive:!!S.dc.unitCondPassive,charCondPassive:!!S.dc.charCondPassive,dcSuperchargedExTier:Math.max(0,S.dc.dcSuperchargedExTier|0),
optionParts:S.dc.optionParts||[],supporters:S.dc.supporters||[],
_unitIsSD:!!S.dc._unitIsSD,
_wpnTraitDistPow:S.dc._wpnTraitDistPow||0,_wpnTraitHpPow:S.dc._wpnTraitHpPow||0,
_wpnTraits:S.dc._wpnTraits||{},
_wpnCritDmgUp:S.dc._wpnCritDmgUp|0,_integratedWpnCritDmgUp:S.dc._integratedWpnCritDmgUp|0,
_vigorCondThreshold:S.dc._vigorCondThreshold||null,
_activeSkills:S.dc._activeSkills||{},
mpLevel:S.dc.mpLevel||'medium',
terrainMode:S.dc.terrainMode||'normal',terrain:S.dc.terrain||0,
finalWpnPow:S.dc.finalWpnPow||0,dmgIncrease:S.dc.dmgIncrease||0,critDmgUp:S.dc.critDmgUp||0,exSquadAtkPct:S.dc.exSquadAtkPct||0,exSquadAtkPctExplicitZero:!!S.dc.exSquadAtkPctExplicitZero,squadCondPct:S.dc.squadCondPct||0,atkCounterOwnAtk:!!S.dc.atkCounterOwnAtk,supportCounterAtk:!!S.dc.supportCounterAtk,_supportCounterAtkPct:S.dc._supportCounterAtkPct|0,supportCntPairSnap:(function(){const m=S.dc._supportCntAtkPairSnapBySlot;if(!m)return null;const i=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);const v=m[i];return v?String(v):null})(),applyAdvantageEnemyTag:S.dc.applyAdvantageEnemyTag!==false,applyZeonEnemyTag:S.dc.applyZeonEnemyTag!==false,
unitTurnBuffAtk:!!S.dc.unitTurnBuffAtk,unitTurnBuffDef:!!S.dc.unitTurnBuffDef,
masterLeagueBuff:!!S.dc.masterLeagueBuff,
grandOffensiveBuff:!!S.dc.grandOffensiveBuff,
bigRangZeonSquadBuff:!!S.dc.bigRangZeonSquadBuff,
_pilotDmgCritExplicit:!!S.dc._pilotDmgCritExplicit,
_squadCondFlatAdApply:(function(){const w=document.getElementById('dcSquadCondFlatAdWrap');const cb=document.getElementById('dcSquadCondFlatAdApply');if(!w||w.style.display==='none'||!cb)return undefined;return !!cb.checked})()
}));
}
function _dcWriteAttackerToDc(slot,supportSnapSlotIdx){
if(!slot)return;
if(slot._dcSquadCondShareMissing&&slot.atkCharData&&slot.atkUnitData){
slot._dcSquadCondShareMissing=0;
if(_dcCharShouldShowSquadCondUi(slot.atkCharData,slot.atkUnitData))slot.squadCondPct=_dcDefaultSquadCondPctForCdUd(slot.atkCharData,slot.atkUnitData);
}
S.dc.atkUnit=slot.atkUnit;S.dc.atkChar=slot.atkChar;
S.dc.atkUnitData=slot.atkUnitData;S.dc.atkCharData=slot.atkCharData;
S.dc.lbTier=slot.lbTier;S.dc.wpnIdx=slot.wpnIdx;S.dc.wpnLv=slot.wpnLv;
S.dc.unitStatMode=slot.unitStatMode||'normal';S.dc.charStatMode=slot.charStatMode||'normal';
S.dc.unitCondPassive=!!slot.unitCondPassive;S.dc.charCondPassive=!!slot.charCondPassive;S.dc.dcSuperchargedExTier=Math.max(0,slot.dcSuperchargedExTier|0);
S.dc.optionParts=Array.isArray(slot.optionParts)?slot.optionParts:[];S.dc.supporters=Array.isArray(slot.supporters)?slot.supporters:[];
S.dc._unitIsSD=!!slot._unitIsSD;
S.dc._wpnTraitDistPow=slot._wpnTraitDistPow||0;S.dc._wpnTraitHpPow=slot._wpnTraitHpPow||0;
S.dc._wpnTraits=slot._wpnTraits&&typeof slot._wpnTraits==='object'?{...slot._wpnTraits}:{};
S.dc._wpnCritDmgUp=slot._wpnCritDmgUp|0;S.dc._integratedWpnCritDmgUp=slot._integratedWpnCritDmgUp|0;
S.dc._vigorCondThreshold=slot._vigorCondThreshold;
S.dc._activeSkills=slot._activeSkills&&typeof slot._activeSkills==='object'?{...slot._activeSkills}:{};
S.dc.mpLevel=_dcNormMpLevel(slot.mpLevel);
S.dc.terrainMode=slot.terrainMode||'normal';S.dc.terrain=slot.terrain||0;
S.dc.finalWpnPow=slot.finalWpnPow||0;S.dc.dmgIncrease=slot.dmgIncrease||0;S.dc.critDmgUp=slot.critDmgUp||0;S.dc.exSquadAtkPct=slot.exSquadAtkPct||0;S.dc.exSquadAtkPctExplicitZero=!!slot.exSquadAtkPctExplicitZero;S.dc.squadCondPct=slot.squadCondPct|0;S.dc.atkCounterOwnAtk=!!slot.atkCounterOwnAtk;S.dc.supportCounterAtk=!!slot.supportCounterAtk;{const _cdw=slot.atkCharData,_udw=slot.atkUnitData;let _scp=0;if(_cdw&&!_cdw._manual){const _fr=_dcParseMaxSupportCounterAtkPctFromChar(_cdw,_udw)|0;_scp=_fr>0?_fr:(slot._supportCounterAtkPct|0)}S.dc._supportCounterAtkPct=_scp}{const wi=supportSnapSlotIdx!==undefined&&supportSnapSlotIdx!==null?Math.min(Math.max(supportSnapSlotIdx|0,0),DC_ATK_SLOT_COUNT-1):Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);if(!S.dc._supportCntAtkPairSnapBySlot)S.dc._supportCntAtkPairSnapBySlot={};const skProvided=slot&&Object.prototype.hasOwnProperty.call(slot,'supportCntPairSnap')&&slot.supportCntPairSnap!=null&&String(slot.supportCntPairSnap).trim()!=='';S.dc._supportCntAtkPairSnapBySlot[wi]=skProvided?String(slot.supportCntPairSnap):(_dcSupportCntEligiblePairSnap(slot.atkCharData,slot.atkUnitData)||null)}S.dc.applyAdvantageEnemyTag=slot.applyAdvantageEnemyTag!==false;
S.dc.applyZeonEnemyTag=slot.applyZeonEnemyTag!==false;
S.dc.unitTurnBuffAtk=!!slot.unitTurnBuffAtk;S.dc.unitTurnBuffDef=!!slot.unitTurnBuffDef;
S.dc.masterLeagueBuff=!!slot.masterLeagueBuff;
S.dc.grandOffensiveBuff=!!slot.grandOffensiveBuff;
S.dc.bigRangZeonSquadBuff=!!slot.bigRangZeonSquadBuff;
S.dc._pilotDmgCritExplicit=!!slot._pilotDmgCritExplicit;
_dcSyncSquadCondEffectiveFromState();
if(S.dc.atkCharData)S.dc._pilotSkills=_dcPilotSkillsVisibleForDc(S.dc.atkCharData)||[];
}
function _dcCritDmgUpFromWeapon(ud,wpnIdx,wpnLv){
if(!ud||ud._manual||!ud.weapons)return 0;
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length)return 0;
const i=Math.min(Math.max(0,wpnIdx|0),wpns.length-1);
const w=wpns[i];
if(!w)return 0;
const lv=w.levels&&w.levels.length?Math.min(Math.max(0,wpnLv|0),w.levels.length-1):0;
return _dcParseWeaponTraits(w,lv).critDmgUp|0;
}
/** Recompute Damage Dealt Up / Crit Dmg Up the same way as _dcRecalcPilotBonuses(true) would for a freshly-rendered pilot row: toggle passives use default on unless marked conditional (it.cond). Does not read DOM pilot bonus checkboxes — required when calculateDamage runs for an off-screen attacker slot (share links, multi-column compare). Caller must have run _dcWriteAttackerToDc(slot) so S.dc.atkUnitData matches the slot. */
function _dcDerivePilotDmgCritForSlotContext(slot,wCrit){
if(slot.atkCharData&&slot.atkCharData._manual)return{dmgIncrease:S.dc.dmgIncrease|0,critDmgUp:S.dc.critDmgUp|0};
const cd=slot.atkCharData;
if(!cd)return{dmgIncrease:0,critDmgUp:wCrit|0};
const saveChar=S.dc.charStatMode,savePS=S.dc._pilotSkills,saveAS=S.dc._activeSkills,savePB=S.dc._pilotBonuses;
try{
S.dc.charStatMode=slot.charStatMode||'normal';
S.dc._pilotSkills=_dcPilotSkillsVisibleForDc(cd)||[];
S.dc._activeSkills=slot._activeSkills&&typeof slot._activeSkills==='object'?{...slot._activeSkills}:{};
S.dc._pilotBonuses=_dcParsePilotAbilBonuses(cd);
const b=S.dc._pilotBonuses||{items:[]};
let dmgDealt=0,critDmg=0;
b.items.forEach(it=>{
if(it.key==='atkPct')return;
if(it.spCharGate){
if(it.cond)return;
if((S.dc.charStatMode||'normal')!=='sp')return;
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
if(it.alwaysActive){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
if(!it.cond){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
}
});
const skB=_dcGetActiveSkillBonuses();
dmgDealt+=skB.dmgDealt;
return{dmgIncrease:dmgDealt|0,critDmgUp:(critDmg+(wCrit|0))|0};
}finally{
S.dc.charStatMode=saveChar;
S.dc._pilotSkills=savePS;
S.dc._activeSkills=saveAS;
S.dc._pilotBonuses=savePB;
}
}
function _dcSnapActiveAttackerToSlot(){
if(!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))S.dc.atkSlots=Array.from({length:DC_ATK_SLOT_COUNT},()=>_dcCreateEmptyAttackerSlot());
while(S.dc.atkSlots.length<DC_ATK_SLOT_COUNT)S.dc.atkSlots.push(_dcCreateEmptyAttackerSlot());
onDcParamChange();
S.dc.atkSlots[Math.min(S.dc.atkSlotIndex|0,DC_ATK_SLOT_COUNT-1)]=_dcReadAttackerFromDc();
}
function _dcSyncAttackerDomFromDc(){
const fwp=document.getElementById('dcFinalWpnPow');if(fwp)fwp.value=S.dc.finalWpnPow?String(S.dc.finalWpnPow):'';
const di=document.getElementById('dcDmgIncrease');if(di)di.value=String(S.dc.dmgIncrease||0);
const cu=document.getElementById('dcCritDmgUp');if(cu)cu.value=String(S.dc.critDmgUp||0);
const exa=document.getElementById('dcExSquadAtkPct');if(exa){const x=S.dc.exSquadAtkPct|0;if(x>0)exa.value=String(Math.min(20,x));else if(S.dc.exSquadAtkPctExplicitZero&&_scIsQubeleyExCombo(S.dc.atkCharData,S.dc.atkUnitData))exa.value='0';else exa.value=''}
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
const acoa=document.getElementById('dcAtkCounterOwnAtk');if(acoa)acoa.checked=!!S.dc.atkCounterOwnAtk;
const aet=document.getElementById('dcAtkAdvantageEnemyTag');if(aet)aet.checked=S.dc.applyAdvantageEnemyTag!==false;
document.querySelectorAll('#dcMpBtns .dc-ctrl-btn').forEach(b=>b.classList.toggle('active',b.dataset.mp===S.dc.mpLevel));
const nb=document.getElementById('dcTerrainNormal'),hb=document.getElementById('dcTerrainHalved');
if(nb)nb.classList.toggle('active',S.dc.terrainMode==='normal');
if(hb)hb.classList.toggle('active',S.dc.terrainMode==='halved');
}
function _dcAnimateAttackerPanelShuffle(){
const el=document.getElementById('dcAtkPanelShuffle');if(!el)return;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
el.classList.remove('dc-atk-panel-shuffle');
void el.offsetWidth;
el.classList.add('dc-atk-panel-shuffle');
const fin=()=>{el.classList.remove('dc-atk-panel-shuffle');el.removeEventListener('animationend',fin)};
el.addEventListener('animationend',fin,{once:true});
}
function _dcRefreshAtkSlotUi(){
const idx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
S.dc.atkSlotIndex=idx;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const p=document.getElementById('dcAtkSlotPill'+i);if(!p)continue;
p.classList.toggle('is-active',i===idx);
p.setAttribute('aria-selected',i===idx?'true':'false');
}
}
function _dcEnsureAttackerSlots(){
if(!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots)||S.dc.atkSlots.length<DC_ATK_SLOT_COUNT){
S.dc.atkSlotIndex=Math.min(S.dc.atkSlotIndex|0,DC_ATK_SLOT_COUNT-1);
const cur=_dcReadAttackerFromDc();
const slots=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++)slots.push(i===S.dc.atkSlotIndex?cur:_dcCreateEmptyAttackerSlot());
S.dc.atkSlots=slots;
}
_dcRefreshAtkSlotUi();
}
function _dcCalculateDamageWithSlot(slotIdx){
const slots=S.dc.atkSlots;if(!slots||!slots[slotIdx])return null;
const slot=slots[slotIdx];if(!slot.atkUnitData||!slot.atkCharData)return null;
const backup=_dcReadAttackerFromDc();
_dcWriteAttackerToDc(slot,slotIdx);
const wc=_dcCritDmgUpFromWeapon(S.dc.atkUnitData,S.dc.wpnIdx,S.dc.wpnLv);
S.dc._wpnCritDmgUp=wc;
if(!(slot.atkCharData&&slot.atkCharData._manual)){
if(!slot._pilotDmgCritExplicit){
const d=_dcDerivePilotDmgCritForSlotContext(slot,wc);
S.dc.dmgIncrease=d.dmgIncrease;
S.dc.critDmgUp=d.critDmgUp;
}else{
/* Explicit totals (share links / prior snap) can omit weapon Crit Damage after pilot/EX swaps — re-apply live weapon trait. */
const prevW=slot._integratedWpnCritDmgUp|0;
S.dc.critDmgUp=Math.max(0,(S.dc.critDmgUp|0)-prevW+wc);
}
}
S.dc._integratedWpnCritDmgUp=wc;
let r=null;
try{r=calculateDamage()}catch(e){console.error('calculateDamage slot',slotIdx,e)}
_dcWriteAttackerToDc(backup);
return r;
}
function setDcAttackerSlot(idx){
const t=parseInt(idx,10);if(Number.isNaN(t)||t<0||t>=DC_ATK_SLOT_COUNT)return;
if(t===(S.dc.atkSlotIndex|0))return;
_dcSnapActiveAttackerToSlot();
S.dc.atkSlotIndex=t;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcSyncAttackerDomFromDc();
_dcRefreshAtkSlotUi();
_dcAnimateAttackerPanelShuffle();
renderDcAtkUnit();
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_dcReadAttackerFromDc()));
_dcSyncAtkModeUiFromState();
onDcParamChange();
if(_dcSlotNeedsAutoFit(S.dc.atkSlots[S.dc.atkSlotIndex|0]))_dcScheduleAutoFitOptionPartAndSupporter();
}
function toggleDcAttackerSlot(){
_dcSnapActiveAttackerToSlot();
S.dc.atkSlotIndex=((S.dc.atkSlotIndex|0)+1)%DC_ATK_SLOT_COUNT;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcSyncAttackerDomFromDc();
_dcRefreshAtkSlotUi();
_dcAnimateAttackerPanelShuffle();
renderDcAtkUnit();
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_dcReadAttackerFromDc()));
_dcSyncAtkModeUiFromState();
onDcParamChange();
if(_dcSlotNeedsAutoFit(S.dc.atkSlots[S.dc.atkSlotIndex|0]))_dcScheduleAutoFitOptionPartAndSupporter();
}

function initDmgCalc(){
S._dcAtkPresetBackup=null;S._dcAtkManualPackBackup=null;S._dcDefPresetNpcBackup=null;S._dcDefDbBackup=null;S._dcDefCustomPackBackup=null;
S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;S.dc.lbTier=3;
S.dc.defNpc=null;S.dc.defTargetMode='preset';S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defLbTier=3;S.dc.npcList=[];S.dc.wpnIdx=0;S.dc.wpnLv=0;S.dc.terrain=0;S.dc.mpLevel='medium';S.dc.defending=false;S.dc.shield=false;S.dc.finalWpnPow=0;S.dc.dmgIncrease=0;S.dc.critDmgUp=0;S.dc.exSquadAtkPct=0;S.dc.exSquadAtkPctExplicitZero=false;S.dc.squadCondPct=0;S.dc.squadCondAtkPct=0;S.dc.squadCondDefPct=0;S.dc.bigRangZeonSquadBuff=false;S.dc.defNpcMapBonusesOn=false;S.dc.atkCounterOwnAtk=false;S.dc.supportCounterAtk=false;S.dc._supportCounterAtkPct=0;S.dc.applyAdvantageEnemyTag=true;S.dc.applyZeonEnemyTag=true;S.dc.dmgTakenDownPilot=0;S.dc.dmgTakenDownUnit=0;S.dc.unitStatMode='normal';S.dc.charStatMode='normal';S.dc.unitCondPassive=false;S.dc.charCondPassive=false;S.dc.dcSuperchargedExTier=0;S.dc.optionParts=[];S.dc.supporters=[];S.dc._wpnTraitDistPow=0;S.dc._wpnTraitHpPow=0;S.dc._wpnTraits={};S.dc._wpnCritDmgUp=0;S.dc._integratedWpnCritDmgUp=0;S.dc._vigorCondThreshold=null;S.dc._activeSkills={};S.dc.unitTurnBuffAtk=false;S.dc.unitTurnBuffDef=false;S.dc.masterLeagueBuff=false;S.dc.grandOffensiveBuff=false;S.dc.multiPctCompare=false;S.dc._dcAutoFitGen=0;S.dc._supportCntAtkPairSnapBySlot={};
renderDcDefDbPicks();
const _drp=document.getElementById('dcDefModePreset'),_drc=document.getElementById('dcDefModeCustom'),_ddb=document.getElementById('dcDefModeDatabase'),_dpw=document.getElementById('dcDefPresetWrap'),_dcw=document.getElementById('dcDefCustomWrap'),_ddbw=document.getElementById('dcDefDatabaseWrap');
if(_drp)_drp.checked=true;if(_drc)_drc.checked=false;if(_ddb)_ddb.checked=false;if(_dpw)_dpw.style.display='';if(_dcw)_dcw.style.display='none';if(_ddbw)_ddbw.style.display='none';
const fwp=document.getElementById('dcFinalWpnPow');if(fwp)fwp.value='';
const di=document.getElementById('dcDmgIncrease');if(di)di.value=0;
const cu=document.getElementById('dcCritDmgUp');if(cu)cu.value=0;
const exa=document.getElementById('dcExSquadAtkPct');if(exa)exa.value='';
const sqc=document.getElementById('dcSquadCondPct');if(sqc)sqc.value='';
const dmb=document.getElementById('dcDefNpcMapBonusesOn');if(dmb)dmb.checked=true;
const acoa=document.getElementById('dcAtkCounterOwnAtk');if(acoa){acoa.checked=false}
{const tog=document.getElementById('dcAtkSupportCounterToggle');if(tog){tog.classList.remove('active');tog.setAttribute('aria-pressed','false')}}
const aet=document.getElementById('dcAtkAdvantageEnemyTag');if(aet)aet.checked=true;
const dtp=document.getElementById('dcDmgTakenDownPilot');if(dtp)dtp.value=0;
const dtu=document.getElementById('dcDmgTakenDownUnit');if(dtu)dtu.value=0;
const dss=document.getElementById('dcStageSearch');if(dss)dss.value='';
_dcCloseDcStageDd();_dcUpdateDcStageDdLabel();
['dcDefDebuffPct','dcDtuBeam','dcDtuPhysical','dcDtuSpecial'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0});
setDcMp('medium');setDcDefend(false);setDcShield(false);setDcTerrain('normal');
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();renderDcDefStats();onDcParamChange();
S.dc.atkSlotIndex=0;
S.dc.atkSlots=[_dcReadAttackerFromDc(),_dcCreateEmptyAttackerSlot(),_dcCreateEmptyAttackerSlot()];
_dcRefreshAtkSlotUi();
_dcSyncAtkModeUiFromState();
}
async function openDmgCalc(){
const d=S.currentDetailData;
switchTab('calculator');
if(d&&d.npc_details){
await loadDcStages();
_dcFillDcStageSelectOptions(_dcStagesCache||[]);
const stgSel=document.getElementById('dcStageSelect');
if(stgSel&&d.id){stgSel.value=d.id;_dcUpdateDcStageDdLabel();await onDcStageChange()}
}
}
function setDcTerrain(mode){
S.dc.terrainMode=mode;
S.dc.terrain=mode==='halved'?50:0;
const nb=document.getElementById('dcTerrainNormal'),hb=document.getElementById('dcTerrainHalved');
if(nb)nb.classList.toggle('active',mode==='normal');
if(hb)hb.classList.toggle('active',mode==='halved');
onDcParamChange();
}
let _dcStagesCache=null;
let _dcStagesFetchLang=null;
async function loadDcStages(){
if(_dcStagesCache!==null&&_dcStagesFetchLang===S.lang)return _dcStagesCache;
try{const r=await fetch(`/api/dc_targets?lang=${encodeURIComponent(S.lang)}`);const d=await r.json();_dcStagesCache=Array.isArray(d)?d:[];_dcStagesFetchLang=S.lang;return _dcStagesCache}catch(e){return[]}}
async function renderDcStageDropdown(){
const stages=await loadDcStages();
_dcFillDcStageSelectOptions(stages);
}
async function onDcStageChange(){
const keepDb=((S.dc.defTargetMode||'preset')==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData._manual&&!S.dc.defCharData._manual&&!S.dc.defUnitData.error&&!S.dc.defCharData.error);
if(!keepDb){
S.dc.defTargetMode='preset';
S.dc.defUnitData=null;S.dc.defCharData=null;
const _drp=document.getElementById('dcDefModePreset'),_drc=document.getElementById('dcDefModeCustom'),_ddb=document.getElementById('dcDefModeDatabase'),_dpw=document.getElementById('dcDefPresetWrap'),_dcw=document.getElementById('dcDefCustomWrap'),_ddbw=document.getElementById('dcDefDatabaseWrap');
if(_drp)_drp.checked=true;if(_drc)_drc.checked=false;if(_ddb)_ddb.checked=false;if(_dpw)_dpw.style.display='';if(_dcw)_dcw.style.display='none';if(_ddbw)_ddbw.style.display='none';
}
const sel=document.getElementById('dcStageSelect');
const stageId=sel.value;
const lockMsg=document.getElementById('dcStageContentLockMsg');
if(lockMsg){lockMsg.style.display='none';lockMsg.textContent=''}
_dcUpdateDcStageDdLabel();
if(!stageId){S.dc.npcList=[];S.dc.defNpc=null;renderDcNpcDropdown();renderDcDefStats();onDcParamChange();return}
try{
const r=await fetch(`/api/stage/${stageId}?lang=${S.lang}`);const d=await r.json();
if(d.content_locked){
S.dc.npcList=[];S.dc.defNpc=null;S.dc._stageData=d;
if(lockMsg){lockMsg.style.display='block';lockMsg.textContent=d.password_required?t('er_stage_lock_hint'):t('er_stage_lock_wait')}
renderDcNpcDropdown();renderDcDefStats();onDcParamChange();return
}
S.dc.npcList=(d.npc_details&&Array.isArray(d.npc_details))?d.npc_details.filter(n=>n.side==='enemy'):[];
S.dc.defNpc=null;S.dc._stageData=d;
renderDcNpcDropdown();renderDcDefStats();onDcParamChange();
}catch(e){S.dc.npcList=[];renderDcNpcDropdown()}
}
function closeDmgCalc(){}
/** Parse minimum vigor tier from ability name + detail lines (EN/JA/TW/HK). Trait titles use e.g. （テンション条件） / （戰意條件） / (Vigor conditions). */
function _dcVigorTierFromAbilityText(blob){
const raw=String(blob||'');
const t=raw.toLowerCase();
if(/\bvigor\s+is\s+supercharged\b/.test(t)||/\bsupercharged(?:\s+ex)?(?:\s+\d+)?\s+or\s+higher\b/.test(t))return'super';
if(/\bvigor\s+is\s+max\b/.test(t)||/\bmax\s+or\s+higher\b/.test(t))return'max';
if(/\bvigor\s+is\s+high\b/.test(t)||/\bhigh\s+or\s+higher\b/.test(t))return'high';
if(/テンションが「超一撃」以上/.test(raw)||/テンションが「超一擊」以上/.test(raw))return'super';
if(/テンションが「超強気」以上/.test(raw)||/テンションが「最大」以上/.test(raw))return'max';
if(/テンションが「強気」以上/.test(raw))return'high';
if(/戰意(?:為|是)「超一擊」以上/.test(raw)||/战意(?:为|是)「超一击」以上/.test(raw))return'super';
if(/戰意(?:為|是)「超強勢」以上/.test(raw)||/战意(?:为|是)「超强」以上/.test(raw))return'max';
if(/戰意(?:為|是)「強勢」以上/.test(raw)||/战意(?:为|是)「强势」以上/.test(raw))return'high';
return null;
}
/** Concatenate translatable strings for vigor detection (base + SP/SSP replacement payloads). */
function _dcVigorAbilityTextBlob(ab){
if(!ab)return'';
const chunks=[];
function pushOne(a){
if(!a)return;
chunks.push(a.name||'');
(a.details||[]).forEach(d=>{if(d&&d.text)chunks.push(d.text)});
}
pushOne(ab);
pushOne(ab.ssp_replacement);
pushOne(ab.sp_replacement);
return chunks.join('\n');
}
function _dcVigorThresholdFromUnit(ud){
if(!ud||!ud.abilities)return null;
const V=['medium','high','max','super'];
const rk=(x)=>V.indexOf(x);
let thr=null;
(ud.abilities||[]).forEach(ab=>{
const full=_dcVigorAbilityTextBlob(ab);
let x=_dcVigorTierFromAbilityText(full);
if(!x&&/\(vigor conditions\)|\bvigor conditions\b|テンション条件|戰意條件|战意条件/i.test(full)){
const tl=full.toLowerCase();
if(tl.includes('supercharged')||/超一撃|超一擊/.test(full))x='super';
else if(/\bvigor\s+is\s+max\b/.test(tl)||/\bmax\s+or\s+higher\b/.test(tl)||/超強気|超強勢/.test(full))x='max';
else if(/\bvigor\s+is\s+high\b/.test(tl)||/\bhigh\s+or\s+higher\b/.test(tl)||/「強勢」以上|「强势」以上/.test(full))x='high';
else x='max';
}
if(x!==null&&(thr===null||rk(x)>rk(thr)))thr=x;
});
return thr;
}
/** Vigor gate on a single pilot ability line (CP stats only — not tag damage-dealt lines). */
function _dcCharCpVigorFromAbilityLine(txt){
const t=String(txt||'');
if(!t.trim())return null;
const low=t.toLowerCase();
if(!low.includes('supercharged')&&!/超一撃|超一擊/.test(t)&&!/\(vigor conditions\)|\bvigor conditions\b|テンション条件|戰意條件|战意条件/i.test(t))return null;
if(!/(awaken|reaction|\bdef\b|ranged|melee|attack stat|射擊|格鬥|覺醒|防御|攻撃)/i.test(t))return null;
let x=_dcVigorTierFromAbilityText(t);
if(!x&&/\(vigor conditions\)|\bvigor conditions\b|テンション条件|戰意條件|战意条件/i.test(t)){
if(low.includes('supercharged')||/超一撃|超一擊/.test(t))x='super';
else if(/\bvigor\s+is\s+max\b/.test(low)||/\bmax\s+or\s+higher\b/.test(low)||/超強気|超強勢/.test(t))x='max';
else if(/\bvigor\s+is\s+high\b/.test(low)||/\bhigh\s+or\s+higher\b/.test(low)||/「強勢」以上|「强势」以上/.test(t))x='high';
else x='max';
}else if(!x&&(low.includes('supercharged')||/超一撃|超一擊/.test(t)))x='super';
return x;
}
/** Minimum vigor for pilot CP when EX/conditional stats are gated (e.g. Supercharged Awaken/Reaction). */
function _dcVigorThresholdFromChar(cd){
if(!cd||!cd.abilities)return null;
const V=['medium','high','max','super'];
const rk=(x)=>V.indexOf(x);
let thr=null;
(cd.abilities||[]).forEach(ab=>{
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return;
(r.details||[]).forEach(ln=>{
const txt=(ln&&ln.text)||'';
const x=_dcCharCpVigorFromAbilityLine(txt);
if(x!==null&&(thr===null||rk(x)>rk(thr)))thr=x;
});
});
return thr;
}
function _dcCharCpVigorRequirement(cd){
if(!cd||cd._manual||!_dcCharHasConditional(cd))return null;
return _dcVigorThresholdFromChar(cd);
}
function _dcB64UrlEncode(str){
const bytes=new TextEncoder().encode(str);
let bin='';
for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _dcB64UrlDecode(s){
if(!s)return'';
let pad=String(s).replace(/-/g,'+').replace(/_/g,'/');
while(pad.length%4)pad+='=';
const bin=atob(pad);
const bytes=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
return new TextDecoder().decode(bytes);
}
function _dcU8ToB64Url(u8){
let bin='';
for(let i=0;i<u8.length;i++)bin+=String.fromCharCode(u8[i]);
return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _dcB64UrlToU8(s){
if(!s)return new Uint8Array(0);
let pad=String(s).replace(/-/g,'+').replace(/_/g,'/');
while(pad.length%4)pad+='=';
const bin=atob(pad);
const u8=new Uint8Array(bin.length);
for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
return u8;
}
async function _dcEncodeSharePayload(obj){
const json=JSON.stringify(obj);
const bytes=new TextEncoder().encode(json);
if(typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined'){
try{
const cs=new CompressionStream('deflate');
const blob=new Blob([bytes]).stream().pipeThrough(cs);
const comp=new Uint8Array(await new Response(blob).arrayBuffer());
if(comp.length+1<bytes.length){
const out=new Uint8Array(1+comp.length);
out[0]=1; // deflate payload
out.set(comp,1);
return _dcU8ToB64Url(out);
}
}catch(_){}
}
const out=new Uint8Array(1+bytes.length);
out[0]=2; // plain json payload
out.set(bytes,1);
return _dcU8ToB64Url(out);
}
async function _dcDecodeSharePayload(raw){
const u8=_dcB64UrlToU8(raw);
if(!u8.length)return null;
if(u8[0]===0x7b){ // legacy v1 json without header
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
// Final backward fallback for older links.
try{return JSON.parse(_dcB64UrlDecode(raw))}catch(_){return null}
}
function _dcManualDefNpcFromDefC(c){
const num=(k,def)=>{const x=parseInt(c[k],10);return Number.isFinite(x)?x:def};
return{npc_id:'__manual__',_manual:true,unit:{name:String(c.un||'Custom unit'),portrait:'',thum:'',stats_raw:{HP:num('uHP',0),Attack:num('uATK',0),Defense:num('uDEF',0),Mobility:num('uMOB',0)},bonus_amounts:{}},character:{name:String(c.cn||'Custom pilot'),portrait:'',thum:'',stats_raw:{Ranged:num('cRNG',0),Melee:num('cMEL',0),Awaken:num('cAWK',0),Defense:num('cDEF',0),Reaction:num('cREA',0)},bonus_amounts:{}}};
}
function _dcBuildManualDefNpcFromDom(){return _dcManualDefNpcFromDefC(_dcDefManualStatsToPack())}
function _dcDefManualStatsToPack(){
return{un:document.getElementById('dcDefManual_uName')?.value||'Custom unit',cn:document.getElementById('dcDefManual_cName')?.value||'Custom pilot',uHP:parseInt(document.getElementById('dcDefManual_uHP')?.value,10)||0,uATK:parseInt(document.getElementById('dcDefManual_uATK')?.value,10)||0,uDEF:parseInt(document.getElementById('dcDefManual_uDEF')?.value,10)||0,uMOB:parseInt(document.getElementById('dcDefManual_uMOB')?.value,10)||0,cRNG:parseInt(document.getElementById('dcDefManual_cRNG')?.value,10)||0,cMEL:parseInt(document.getElementById('dcDefManual_cMEL')?.value,10)||0,cAWK:parseInt(document.getElementById('dcDefManual_cAWK')?.value,10)||0,cDEF:parseInt(document.getElementById('dcDefManual_cDEF')?.value,10)||0,cREA:parseInt(document.getElementById('dcDefManual_cREA')?.value,10)||0};
}
function _dcFillManualDefDomFromPack(c){
const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null&&v!==''?String(v):''};
setv('dcDefManual_uName',c.un);setv('dcDefManual_cName',c.cn);setv('dcDefManual_uHP',c.uHP);setv('dcDefManual_uATK',c.uATK);setv('dcDefManual_uDEF',c.uDEF);setv('dcDefManual_uMOB',c.uMOB);setv('dcDefManual_cRNG',c.cRNG);setv('dcDefManual_cMEL',c.cMEL);setv('dcDefManual_cAWK',c.cAWK);setv('dcDefManual_cDEF',c.cDEF);setv('dcDefManual_cREA',c.cREA);
}
function _dcStatPairFromApiList(statArr){
const stats_raw={},bonus_amounts={};
(statArr||[]).forEach(e=>{
if(!e||e.name==null)return;
const nm=String(e.name);
const tot=Math.round(Number(e.total));
if(Number.isFinite(tot))stats_raw[nm]=tot;
const bon=Math.round(Number(e.bonus));
if(Number.isFinite(bon)&&bon>0)bonus_amounts[nm]=bon;
});
return{stats_raw,bonus_amounts};
}
function _dcSyncDefNpcFromDatabase(){
const ud=S.dc.defUnitData,cd=S.dc.defCharData;
if(!ud||ud.error||ud._manual||!cd||cd.error||cd._manual){S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();onDcParamChange();return}
const lb=ud.lb_data;
const maxT=lb&&lb.length?lb.length-1:0;
const tier=Math.min(Math.max(0,S.dc.defLbTier|0),maxT);
S.dc.defLbTier=tier;
const row=lb&&lb[tier]?lb[tier]:null;
const ustats=row?row.stats_no_cond:(Array.isArray(ud.stats)?ud.stats:null);
const {stats_raw:ur,bonus_amounts:ub}=_dcStatPairFromApiList(ustats);
const {stats_raw:cr,bonus_amounts:cb}=_dcStatPairFromApiList(cd.stats);
S.dc.defNpc={
npc_id:'__db__',
_fromDatabase:true,
unit:{
name:ud.name,
portrait:ud.portrait||'',
thum:ud.thum||'',
rarity_icon:ud.rarity_icon||'',
role_icon:ud.role_icon||'',
stats_raw:{
HP:ur.HP||0,
EN:ur.EN||0,
Attack:ur.Attack||0,
Defense:ur.Defense||0,
Mobility:ur.Mobility||0,
Move:ur.Move||0
},
bonus_amounts:{
HP:ub.HP||0,
Attack:ub.Attack||0,
Defense:ub.Defense||0,
Mobility:ub.Mobility||0,
Move:ub.Move||0
},
tags:ud.tags||[]
},
character:{
name:cd.name,
portrait:cd.portrait||'',
thum:cd.thum||'',
stats_raw:{
Ranged:cr.Ranged||0,
Melee:cr.Melee||0,
Awaken:cr.Awaken||0,
Defense:cr.Defense||0,
Reaction:cr.Reaction||0
},
bonus_amounts:{
Ranged:cb.Ranged||0,
Melee:cb.Melee||0,
Awaken:cb.Awaken||0,
Defense:cb.Defense||0,
Reaction:cb.Reaction||0
},
tags:cd.tags||[]
}
};
renderDcDefDbPicks();
renderDcDefStats();
onDcParamChange();
}
function renderDcDefDbPicks(){
const uEl=document.getElementById('dcDefDbUnitSlot'),cEl=document.getElementById('dcDefDbCharSlot');
if(!uEl||!cEl)return;
const ud=S.dc.defUnitData,cd=S.dc.defCharData;
const isSD=ud&&!ud.error&&String(ud.body_type||'')==='3';
if(ud&&!ud.error){
const lb=ud.lb_data;
const maxTier=lb&&lb.length?lb.length-1:0;
let lbBlock='';
if(lb&&lb.length>1&&!ud.is_ultimate){
const tier=Math.min(Math.max(0,S.dc.defLbTier|0),maxTier);
const cur=cmpLbPipsAtTier(tier);
let lbMenu='';
for(let tt=0;tt<=maxTier;tt++){
const p=cmpLbPipsAtTier(tt);
lbMenu+=`<button type="button" class="cmp-lb-opt${tt===tier?' is-active':''}" onclick="setDcDefLbTier(${tt});var _ddb=document.getElementById('dcDefLbTierDetails');if(_ddb)_ddb.open=false" role="option" aria-selected="${tt===tier}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;
}
lbBlock=`<div class="dc-lb-inline-wrap"><details id="dcDefLbTierDetails" class="cmp-lb-details dc-lb-tier-details"><summary class="cmp-lb-summary" title="${esc(t('cmp_lb'))}">${cmpLbPipsRow(cur[0],cur[1],cur[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${esc(t('cmp_lb'))}">${lbMenu}</div></details></div>`;
}
const lbStatCluster=lbBlock?`<div class="dc-unit-lb-stat-cluster">${lbBlock}</div>`:'';
uEl.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(ud.thum||ud.portrait||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div class="dc-picked-badges">${ud.rarity_icon?`<img src="${imgUrl(ud.rarity_icon)}">`:''}${ud.role_icon?`<img src="${imgUrl(ud.role_icon)}">`:''}</div></div>${lbStatCluster}<button type="button" class="dc-picked-change" onclick="openDcPicker('def_unit')">${t('dc_change')}</button></div>`;
}else{
uEl.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('def_unit')">${t('dc_pick_unit')}</button>`;
}
if(cd&&!cd.error){
const chBtn=isSD?'':`<button type="button" class="dc-picked-change" onclick="openDcPicker('def_character')">${t('dc_change')}</button>`;
const sdNote=isSD?`<div style="font-size:10px;color:var(--text-muted);margin-top:4px">SD — paired pilot from unit</div>`:'';
cEl.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(cd.thum||cd.portrait||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div></div>${sdNote}${chBtn}</div>`;
}else if(isSD){
cEl.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an SD unit to load its pilot.</div>';
}else{
cEl.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('def_character')">${t('dc_pick_char')}</button>`;
}
}
function setDcDefLbTier(t){
let tt=Math.min(3,Math.max(0,t|0));
const ud=S.dc.defUnitData;
if(ud&&ud.lb_data&&ud.lb_data.length)tt=Math.min(tt,ud.lb_data.length-1);
S.dc.defLbTier=tt;
const defDbReady=(S.dc.defTargetMode||'preset')==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error;
if(defDbReady)_dcSyncDefNpcFromDatabase();
else renderDcDefDbPicks();
}
function setDcDefTargetMode(mode){
const prev=S.dc.defTargetMode||'preset';
if(prev==='preset'&&S.dc.defNpc)
try{S._dcDefPresetNpcBackup=JSON.parse(JSON.stringify(S.dc.defNpc))}catch(_){S._dcDefPresetNpcBackup=S.dc.defNpc}
if(prev==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error&&!S.dc.defUnitData._manual){
try{
S._dcDefDbBackup={defLbTier:S.dc.defLbTier|0,unitData:JSON.parse(JSON.stringify(S.dc.defUnitData)),charData:JSON.parse(JSON.stringify(S.dc.defCharData))}
}catch(_){S._dcDefDbBackup=null}
}
if(prev==='custom')
try{S._dcDefCustomPackBackup=_dcDefManualStatsToPack()}catch(_){}
S.dc.defTargetMode=mode;
const pw=document.getElementById('dcDefPresetWrap');
const cw=document.getElementById('dcDefCustomWrap');
const dbw=document.getElementById('dcDefDatabaseWrap');
const rp=document.getElementById('dcDefModePreset');
const rc=document.getElementById('dcDefModeCustom');
const rd=document.getElementById('dcDefModeDatabase');
if(rp)rp.checked=mode==='preset';
if(rc)rc.checked=mode==='custom';
if(rd)rd.checked=mode==='database';
if(pw)pw.style.display=mode==='preset'?'':'none';
if(cw)cw.style.display=mode==='custom'?'':'none';
if(dbw)dbw.style.display=mode==='database'?'':'none';
if(mode==='custom'){
S.dc.defUnitData=null;S.dc.defCharData=null;
if(S._dcDefCustomPackBackup)_dcFillManualDefDomFromPack(S._dcDefCustomPackBackup);
S.dc.defNpc=_dcBuildManualDefNpcFromDom();
renderDcDefStats();
onDcParamChange();
}else if(mode==='database'){
if(S._dcDefDbBackup&&S._dcDefDbBackup.unitData&&S._dcDefDbBackup.charData){
S.dc.defUnitData=S._dcDefDbBackup.unitData;
S.dc.defCharData=S._dcDefDbBackup.charData;
S.dc.defLbTier=S._dcDefDbBackup.defLbTier|0;
_dcSyncDefNpcFromDatabase();
}else if(S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData.error&&!S.dc.defCharData.error)_dcSyncDefNpcFromDatabase();
else{S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();onDcParamChange();return}
renderDcDefStats();
onDcParamChange();
}else{
S.dc.defUnitData=null;S.dc.defCharData=null;
if(S._dcDefPresetNpcBackup){
try{S.dc.defNpc=JSON.parse(JSON.stringify(S._dcDefPresetNpcBackup))}catch(_){S.dc.defNpc=S._dcDefPresetNpcBackup}
const sel=document.getElementById('dcNpcSelect');
if(sel&&S.dc.defNpc&&S.dc.defNpc.npc_id!=null&&String(S.dc.defNpc.npc_id)!==''){
const want=String(S.dc.defNpc.npc_id);
for(let j=0;j<sel.options.length;j++){if(sel.options[j].value===want){sel.selectedIndex=j;break}}
}
}else{S.dc.defNpc=null}
const sel=document.getElementById('dcNpcSelect');
if(!S.dc.defNpc&&sel&&sel.value)selectDcNpc();
else{renderDcDefStats();onDcParamChange()}
}
}
function syncDcManualDefFromInputs(){
if((S.dc.defTargetMode||'preset')!=='custom')return;
S.dc.defNpc=_dcBuildManualDefNpcFromDom();
renderDcDefStats();
onDcParamChange();
}
function _dcSyncAtkModeUiFromState(){
const custom=!!(S.dc.atkUnitData&&S.dc.atkUnitData._manual);
const pw=document.getElementById('dcAtkPresetWrap'),cw=document.getElementById('dcAtkCustomWrap');
const rp=document.getElementById('dcAtkModePreset'),rc=document.getElementById('dcAtkModeCustom');
if(rp)rp.checked=!custom;if(rc)rc.checked=custom;
if(pw)pw.style.display=custom?'none':'';
if(cw)cw.style.display=custom?'':'none';
document.querySelectorAll('.dc-atk-preset-only').forEach(el=>{el.style.display=custom?'none':''});
}
function _dcStatArrUnit(hp,atk,def,mob){
return[{name:'HP',total:hp},{name:'Attack',total:atk},{name:'Defense',total:def},{name:'Mobility',total:mob},{name:'Move',total:0}];
}
function _dcBuildManualAtkUnitFromDom(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
const stats=_dcStatArrUnit(g('dcAtkManual_uHP'),g('dcAtkManual_uATK'),g('dcAtkManual_uDEF'),g('dcAtkManual_uMOB'));
const lb0={stats_no_cond:stats,stats:stats,sp_stats:stats,ssp_stats:stats};
const aid=_dcNormalizeManualWeaponAttrId(document.getElementById('dcAtkManual_wAttr')?.value);
const atkLbl=String(document.getElementById('dcAtkManual_wAtkType')?.value||'Ranged');
const wPow=g('dcAtkManual_wPow'),wAcc=g('dcAtkManual_wAcc'),wCrit=g('dcAtkManual_wCrit');
const wMin=Math.max(1,g('dcAtkManual_wMin')),wMax=Math.max(wMin,g('dcAtkManual_wMax'));
const isEx=!!document.getElementById('dcAtkManual_wEx')?.checked;
const w={weapon_type:'1',attribute_id:aid,attribute:'',min_range:wMin,max_range:wMax,is_ex:isEx,levels:[{level:1,power:wPow,accuracy:wAcc,critical:wCrit,en:0,traits:[]}],attack_types:[{label:atkLbl}]};
return{_manual:true,name:gs('dcAtkManual_uName')||'Custom unit',id:'__manual__',lb_data:[lb0],stats:{stats_no_cond:stats},has_sp:false,is_ultimate:true,has_cond_stats:false,tags:[],weapons:[w],body_type:'0',rarity_id:'5'};
}
function _dcBuildManualAtkCharFromDom(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
const stats=[{name:'Ranged',total:g('dcAtkManual_cRNG')},{name:'Melee',total:g('dcAtkManual_cMEL')},{name:'Awaken',total:g('dcAtkManual_cAWK')},{name:'Defense',total:g('dcAtkManual_cDEF')},{name:'Reaction',total:g('dcAtkManual_cREA')}];
return{_manual:true,name:gs('dcAtkManual_cName')||'Custom pilot',id:'__manual__',stats:stats,has_sp:false,sp_stats:[],has_conditional_passive:false,has_ex_stats:false,abilities:[],skills:[],rarity_id:'5'};
}
function _dcAtkManualStatsToPack(){
const g=(id)=>parseInt(document.getElementById(id)?.value,10)||0;
const gs=(id)=>String(document.getElementById(id)?.value||'').trim();
return{un:gs('dcAtkManual_uName'),cn:gs('dcAtkManual_cName'),uHP:g('dcAtkManual_uHP'),uATK:g('dcAtkManual_uATK'),uDEF:g('dcAtkManual_uDEF'),uMOB:g('dcAtkManual_uMOB'),cRNG:g('dcAtkManual_cRNG'),cMEL:g('dcAtkManual_cMEL'),cAWK:g('dcAtkManual_cAWK'),cDEF:g('dcAtkManual_cDEF'),cREA:g('dcAtkManual_cREA'),wPow:g('dcAtkManual_wPow'),wAcc:g('dcAtkManual_wAcc'),wCrit:g('dcAtkManual_wCrit'),wMin:g('dcAtkManual_wMin'),wMax:g('dcAtkManual_wMax'),wAttr:_dcNormalizeManualWeaponAttrId(document.getElementById('dcAtkManual_wAttr')?.value),wAtk:gs('dcAtkManual_wAtkType')||'Ranged',wEx:!!document.getElementById('dcAtkManual_wEx')?.checked};
}
function _dcFillManualAtkDomFromPack(p){
const setv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null&&v!==''?String(v):''};
const setc=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=!!v};
setv('dcAtkManual_uName',p.un);setv('dcAtkManual_cName',p.cn);setv('dcAtkManual_uHP',p.uHP);setv('dcAtkManual_uATK',p.uATK);setv('dcAtkManual_uDEF',p.uDEF);setv('dcAtkManual_uMOB',p.uMOB);setv('dcAtkManual_cRNG',p.cRNG);setv('dcAtkManual_cMEL',p.cMEL);setv('dcAtkManual_cAWK',p.cAWK);setv('dcAtkManual_cDEF',p.cDEF);setv('dcAtkManual_cREA',p.cREA);setv('dcAtkManual_wPow',p.wPow);setv('dcAtkManual_wAcc',p.wAcc);setv('dcAtkManual_wCrit',p.wCrit);setv('dcAtkManual_wMin',p.wMin);setv('dcAtkManual_wMax',p.wMax);setv('dcAtkManual_wAttr',_dcNormalizeManualWeaponAttrId(p.wAttr));setv('dcAtkManual_wAtkType',p.wAtk);setc('dcAtkManual_wEx',p.wEx);
}
function _dcManualAtkUnitFromPack(p){
const setv=(k,def)=>{const x=parseInt(p[k],10);return Number.isFinite(x)?x:def};
const stats=_dcStatArrUnit(setv('uHP',0),setv('uATK',0),setv('uDEF',0),setv('uMOB',0));
const lb0={stats_no_cond:stats,stats:stats,sp_stats:stats,ssp_stats:stats};
const aid=_dcNormalizeManualWeaponAttrId(p.wAttr);
const atkLbl=String(p.wAtk||'Ranged');
const wPow=setv('wPow',0),wAcc=setv('wAcc',0),wCrit=setv('wCrit',0);
const wMin=Math.max(1,setv('wMin',1)),wMax=Math.max(wMin,setv('wMax',10));
const isEx=!!p.wEx;
const w={weapon_type:'1',attribute_id:aid,attribute:'',min_range:wMin,max_range:wMax,is_ex:isEx,levels:[{level:1,power:wPow,accuracy:wAcc,critical:wCrit,en:0,traits:[]}],attack_types:[{label:atkLbl}]};
return{_manual:true,name:String(p.un||'Custom unit'),id:'__manual__',lb_data:[lb0],stats:{stats_no_cond:stats},has_sp:false,is_ultimate:true,has_cond_stats:false,tags:[],weapons:[w],body_type:'0',rarity_id:'5'};
}
function _dcManualAtkCharFromPack(p){
const setv=(k,def)=>{const x=parseInt(p[k],10);return Number.isFinite(x)?x:def};
const stats=[{name:'Ranged',total:setv('cRNG',0)},{name:'Melee',total:setv('cMEL',0)},{name:'Awaken',total:setv('cAWK',0)},{name:'Defense',total:setv('cDEF',0)},{name:'Reaction',total:setv('cREA',0)}];
return{_manual:true,name:String(p.cn||'Custom pilot'),id:'__manual__',stats:stats,has_sp:false,sp_stats:[],has_conditional_passive:false,has_ex_stats:false,abilities:[],skills:[],rarity_id:'5'};
}
function setDcAtkTargetMode(mode){
if(mode==='custom'){
if(S.dc.atkUnitData&&!S.dc.atkUnitData._manual&&(S.dc.atkUnit||S.dc.atkChar))
try{S._dcAtkPresetBackup=_dcReadAttackerFromDc()}catch(_){S._dcAtkPresetBackup=null}
if(S._dcAtkManualPackBackup)_dcFillManualAtkDomFromPack(S._dcAtkManualPackBackup);
S.dc.atkUnit='__manual__';S.dc.atkChar='__manual__';
S.dc.atkUnitData=_dcBuildManualAtkUnitFromDom();
S.dc.atkCharData=_dcBuildManualAtkCharFromDom();
S.dc.atkUnitData._manual=true;
S.dc._unitIsSD=false;
S.dc.lbTier=0;
S.dc.wpnIdx=0;S.dc.wpnLv=0;
S.dc._wpnTraitDistPow=0;S.dc._wpnTraitHpPow=0;S.dc._wpnTraits={};S.dc._wpnCritDmgUp=0;
S.dc._vigorCondThreshold=null;
_dcSyncAtkModeUiFromState();
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
onDcParamChange();
}else{
if(S.dc.atkUnitData&&S.dc.atkUnitData._manual)
try{S._dcAtkManualPackBackup=_dcAtkManualPackFromSlot(_dcReadAttackerFromDc())}catch(_){}
if(S._dcAtkPresetBackup){
try{_dcWriteAttackerToDc(S._dcAtkPresetBackup)}catch(_){S._dcAtkPresetBackup=null;S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;S.dc._unitIsSD=false}
}
if(!S._dcAtkPresetBackup||!S.dc.atkUnitData||S.dc.atkUnitData._manual){
if(!S.dc.atkUnitData||S.dc.atkUnitData._manual){
S.dc.atkUnit=null;S.dc.atkChar=null;S.dc.atkUnitData=null;S.dc.atkCharData=null;
S.dc._unitIsSD=false;
const uA=document.getElementById('dcAtkUnitArea'),cA=document.getElementById('dcAtkCharArea'),sA=document.getElementById('dcAtkStatsArea');
if(uA)uA.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('unit')" id="dcPickUnitBtn">${t('dc_pick_unit')}</button>`;
if(cA)cA.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('character')" id="dcPickCharBtn">${t('dc_pick_char')}</button>`;
if(sA)sA.innerHTML='';
}
}
_dcSyncAtkModeUiFromState();
renderDcWeaponArea();renderDcOptionParts();renderDcSupporters();renderDcAtkUnit();renderDcAtkChar();
onDcParamChange();
}
}
function syncDcManualAtkFromInputs(){
if(!S.dc.atkUnitData||!S.dc.atkUnitData._manual)return;
S.dc.atkUnitData=_dcBuildManualAtkUnitFromDom();
S.dc.atkCharData=_dcBuildManualAtkCharFromDom();
renderDcAtkUnit();renderDcAtkChar();
onDcParamChange();
}
function _dcAtkManualPackFromSlot(sl){
const u=sl.atkUnitData,c=sl.atkCharData,w=u&&u.weapons&&u.weapons[0];
const st=u&&u.lb_data&&u.lb_data[0]?u.lb_data[0].stats_no_cond:null;
const fg=(name)=>{if(!st)return 0;const x=st.find(s=>s.name===name);return x?Math.round(x.total||0):0};
const fc=(name)=>{if(!c||!c.stats)return 0;const x=c.stats.find(s=>s.name===name);return x?Math.round(x.total||0):0};
const lv=w&&w.levels&&w.levels[0]?w.levels[0]:{};
const atkLbl=(w&&w.attack_types&&w.attack_types[0]&&w.attack_types[0].label)||'Ranged';
return{un:u?u.name:'',cn:c?c.name:'',uHP:fg('HP'),uATK:fg('Attack'),uDEF:fg('Defense'),uMOB:fg('Mobility'),cRNG:fc('Ranged'),cMEL:fc('Melee'),cAWK:fc('Awaken'),cDEF:fc('Defense'),cREA:fc('Reaction'),wPow:lv.power||0,wAcc:lv.accuracy||0,wCrit:lv.critical||0,wMin:w?w.min_range||1:1,wMax:w?w.max_range||10:10,wAttr:_dcNormalizeManualWeaponAttrId(w&&w.attribute_id),wAtk:atkLbl,wEx:!!(w&&w.is_ex)};
}
/** Snap live DOM + derived fields into every attacker slot before share encode (must run before compression). */
function _dcFinalizeAllSlotsBeforeShare(){
onDcParamChange();
_dcSnapActiveAttackerToSlot();
const prevIdx=S.dc.atkSlotIndex|0;
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
onDcParamChange();
_dcSnapActiveAttackerToSlot();
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=S.dc.atkSlots[i];
if(!sl||!sl.atkUnit||!sl.atkChar)continue;
sl.dmgIncrease=sl.dmgIncrease|0;
sl.critDmgUp=sl.critDmgUp|0;
sl._pilotDmgCritExplicit=true;
if(i===prevIdx){
const flatCb=document.getElementById('dcSquadCondFlatAdApply');
if(flatCb)sl._squadCondFlatAdApply=!!flatCb.checked;
const brCb=document.getElementById('dcBigRangZeonSquadApply');
const brW=document.getElementById('dcBigRangZeonSquadWrap');
if(brW&&brW.style.display!=='none'&&brCb)sl.bigRangZeonSquadBuff=!!brCb.checked;
}
S.dc.atkSlots[i]=sl;
}
}
function _dcPackShareState(){
_dcFinalizeAllSlotsBeforeShare();
const slots=(S.dc.atkSlots||[]).map(sl=>sl?JSON.parse(JSON.stringify(sl)):null);
const slotArr=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=slots[i];
if(!sl||!sl.atkUnit||!sl.atkChar){slotArr.push(null);continue}
const o={};
if(sl.atkUnitData&&sl.atkUnitData._manual){
o.atkM=1;
o.atkP=_dcAtkManualPackFromSlot(sl);
}else{
o.u=sl.atkUnit;
o.c=sl.atkChar;
if(sl.atkUnitData&&!sl.atkUnitData._manual){
o.wi=sl.wpnIdx|0;
o.wl=sl.wpnLv|0;
o.di=sl.dmgIncrease|0;
o.cu=sl.critDmgUp|0;
o.pdc=1;
o.v=_dcNormMpLevel(sl.mpLevel||'medium');
const skOn=sl._activeSkills&&typeof sl._activeSkills==='object'?Object.keys(sl._activeSkills).filter(k=>sl._activeSkills[k]):[];
if(skOn.length)o.sk=skOn;
if(sl._squadCondFlatAdApply===false)o.scfa=0;
else if(sl._squadCondFlatAdApply===true)o.scfa=1;
}
}
if(sl.lbTier!==3)o.lb=sl.lbTier;
if((sl.unitStatMode||'normal')!=='normal')o.um=sl.unitStatMode;
if((sl.charStatMode||'normal')!=='normal')o.cm=sl.charStatMode;
if((sl.terrainMode||'normal')!=='normal')o.t=sl.terrainMode;
if(sl.finalWpnPow)o.fwp=sl.finalWpnPow;
if((sl.exSquadAtkPct|0)>0)o.exa=sl.exSquadAtkPct;else if(sl.exSquadAtkPctExplicitZero)o.exa=0;
if(_dcSlotShouldPackSquadCond(sl))o.sqc=sl.squadCondPct|0;
if(sl._wpnTraitDistPow)o.td=sl._wpnTraitDistPow;
if(sl._wpnTraitHpPow)o.th=sl._wpnTraitHpPow;
if(sl.unitCondPassive)o.ucp=1;
if(sl.charCondPassive)o.ccp=1;
if((sl.dcSuperchargedExTier|0)>0)o.cex=sl.dcSuperchargedExTier|0;
if(sl.atkCounterOwnAtk)o.acoa=1;
if(sl.supportCounterAtk)o.sac=1;
if(sl.unitTurnBuffAtk)o.uta=1;
if(sl.unitTurnBuffDef)o.utd=1;
if(sl.masterLeagueBuff)o.mlb=1;
if(sl.grandOffensiveBuff)o.ogb=1;
if(sl.bigRangZeonSquadBuff)o.brz=1;
if(sl.applyAdvantageEnemyTag===false)o.ae=0;
if(sl.applyZeonEnemyTag===false)o.az=0;
const op=sl.optionParts&&sl.optionParts[0];
if(op&&op.id!=null)o.op=op.id;
const sp=sl.supporters&&sl.supporters[0];
if(sp&&sp.id!=null){
o.sp=sp.id;
if((sp._dcLevel||100)!==100)o.spl=sp._dcLevel;
if((sp._dcLbTier!==undefined?sp._dcLbTier:3)!==3)o.spb=sp._dcLbTier;
}
slotArr.push(o);
}
const stgSel=document.getElementById('dcStageSelect');
const npcSel=document.getElementById('dcNpcSelect');
const defNpc=S.dc.defNpc;
const D={};
const _dtm=S.dc.defTargetMode||'preset';
if(_dtm==='preset'){
if(defNpc&&defNpc.npc_id!=null&&String(defNpc.npc_id)!==''){
D.n=String(defNpc.npc_id);
if(stgSel&&stgSel.value)D.s=stgSel.value;
}else if(npcSel&&npcSel.value){
D.n=npcSel.value;
if(stgSel&&stgSel.value)D.s=stgSel.value;
}else if(stgSel&&stgSel.value)D.s=stgSel.value;
}
if(S.dc.dmgTakenDownPilot)D.dtp=S.dc.dmgTakenDownPilot;
if(S.dc.dmgTakenDownUnit)D.dttu=S.dc.dmgTakenDownUnit;
if(S.dc.defDebuffPct)D.defp=S.dc.defDebuffPct;
if(S.dc.dtuBeam)D.dtb=S.dc.dtuBeam;
if(S.dc.dtuPhysical)D.dtph=S.dc.dtuPhysical;
if(S.dc.dtuSpecial)D.dts=S.dc.dtuSpecial;
if(S.dc.defending)D.def=1;
if(S.dc.shield)D.sh=1;
if(S.dc.defNpcMapBonusesOn===false)D.nmb=0;
const out={v:1,a:S.dc.atkSlotIndex|0,S:slotArr,lg:S.lang||'EN'};
if(S.dc.multiPctCompare)out.mpc=1;
if(Object.keys(D).length)out.D=D;
if(_dtm==='database'&&S.dc.defUnitData&&S.dc.defCharData&&!S.dc.defUnitData._manual&&!S.dc.defCharData._manual&&!S.dc.defUnitData.error&&!S.dc.defCharData.error){
out.defDb=1;
out.defU=String(S.dc.defUnitData.id);
out.defC=String(S.dc.defCharData.id);
if((S.dc.defLbTier|0)!==3)out.defLT=S.dc.defLbTier|0;
}
if(_dtm==='custom'){out.defM=1;out.defC=_dcDefManualStatsToPack()}
return out;
}
async function _dcLoadSlotFromPackedObj(o){
if(!o)return null;
const slot=_dcCreateEmptyAttackerSlot();
if(o.atkM&&o.atkP){
slot.atkUnit='__manual__';
slot.atkChar='__manual__';
slot.atkUnitData=_dcManualAtkUnitFromPack(o.atkP);
slot.atkCharData=_dcManualAtkCharFromPack(o.atkP);
slot.atkUnitData._manual=true;
slot._unitIsSD=false;
slot._vigorCondThreshold=null;
slot.wpnIdx=0;slot.wpnLv=0;slot.lbTier=0;
}else{
if(!o.u||!o.c)return null;
const uid=String(o.u),cid=String(o.c);
let ur,cr;
try{
[ur,cr]=await Promise.all([
fetch(`/api/unit/${uid}?lang=${S.lang}`).then(r=>r.json()),
fetch(`/api/character/${cid}?lang=${S.lang}`).then(r=>r.json())
]);
}catch(_){return null}
slot.atkUnit=uid;slot.atkChar=cid;
slot.atkUnitData=ur;slot.atkCharData=cr;
slot._unitIsSD=String(ur.body_type||'')==='3';
slot._vigorCondThreshold=_dcVigorThresholdFromUnit(ur);
if(o.wi!==undefined){const n=parseInt(o.wi,10);if(!Number.isNaN(n)&&n>=0)slot.wpnIdx=n}else slot.wpnIdx=0;
if(o.wl!==undefined){const n=parseInt(o.wl,10);if(!Number.isNaN(n)&&n>=0)slot.wpnLv=n}
else if(o.wi!==undefined){
const _wpUn=_dcNonMapWeapons(ur);
const _wUn=_wpUn[slot.wpnIdx];
slot.wpnLv=_wUn?_dcDefaultWpnLvIndex(_wUn):0;
}else slot.wpnLv=0;
if(o.wi===undefined&&o.wl===undefined){const _pb=_dcPickBestWeaponIndices(ur);slot.wpnIdx=_pb.wpnIdx;slot.wpnLv=_pb.wpnLv}
const _wpFix=_dcNonMapWeapons(ur);
if(_wpFix.length&&((slot.wpnIdx|0)<0||(slot.wpnIdx|0)>=_wpFix.length)){const _pb2=_dcPickBestWeaponIndices(ur);slot.wpnIdx=_pb2.wpnIdx;slot.wpnLv=_pb2.wpnLv}
else{const _cwFix=_wpFix[slot.wpnIdx|0];if(_cwFix&&_cwFix.levels&&_cwFix.levels.length&&(slot.wpnLv|0)>=_cwFix.levels.length)slot.wpnLv=_cwFix.levels.length-1}
if(o.lb!==undefined){const n=parseInt(o.lb,10);if(!Number.isNaN(n)&&n>=0)slot.lbTier=n}
}
const um=o.um;if(um==='normal'||um==='sp'||um==='ssp')slot.unitStatMode=um;
const cm=o.cm;if(cm==='normal'||cm==='sp')slot.charStatMode=cm;
if(o.v)slot.mpLevel=_dcNormMpLevel(o.v);
else slot._dcNeedAutoMp=true;
if(o.pdc)slot._pilotDmgCritExplicit=true;
if(Array.isArray(o.sk)&&o.sk.length){
slot._activeSkills={};
o.sk.forEach(sid=>{const k=String(sid||'').trim();if(k)slot._activeSkills[k]=true});
}
if(o.scfa!==undefined)slot._squadCondFlatAdApply=!(o.scfa===0||o.scfa==='0');
if(o.t==='halved'){slot.terrainMode='halved';slot.terrain=50}
else if(o.t){slot.terrainMode=o.t;slot.terrain=0}
else{slot.terrainMode='normal';slot.terrain=0}
if(o.fwp!==undefined){const n=parseInt(o.fwp,10);if(Number.isFinite(n))slot.finalWpnPow=n}
if(o.di!==undefined){const n=parseInt(o.di,10);if(Number.isFinite(n)){slot.dmgIncrease=n;slot._dmgIncreasePacked=n;slot._pilotDmgCritExplicit=true}}
if(o.cu!==undefined){const n=parseInt(o.cu,10);if(Number.isFinite(n)){slot.critDmgUp=n;slot._critDmgUpPacked=n;slot._pilotDmgCritExplicit=true}}
if(o.exa!==undefined){const n=parseInt(o.exa,10);if(Number.isFinite(n)){slot.exSquadAtkPct=Math.min(20,Math.max(0,n));slot.exSquadAtkPctExplicitZero=(n===0)}}else slot.exSquadAtkPctExplicitZero=false;
if(o.sqc!==undefined){const n=parseInt(o.sqc,10);if(Number.isFinite(n))slot.squadCondPct=Math.max(0,n);else slot.squadCondPct=0}
else if(!o.atkM)slot._dcSquadCondShareMissing=1;
if(o.td!==undefined){const n=parseInt(o.td,10);if(!Number.isNaN(n)&&n>=0)slot._wpnTraitDistPow=n}
if(o.th!==undefined){const n=parseInt(o.th,10);if(!Number.isNaN(n)&&n>=0)slot._wpnTraitHpPow=n}
if(o.ucp)slot.unitCondPassive=true;
if(o.ccp)slot.charCondPassive=true;
else if(slot.atkCharData&&slot.atkUnitData&&!slot.atkCharData._manual&&!slot.atkUnitData._manual){
slot.charCondPassive=_dcShouldAutoCharCondPassive(slot.atkCharData,slot.atkUnitData);
}
if(o.cex!==undefined){const n=parseInt(o.cex,10);if(!Number.isNaN(n)&&n>=0)slot.dcSuperchargedExTier=n}
if(slot.atkCharData&&!slot.atkCharData._manual){const _xt=slot.atkCharData.ex_supercharged_tiers;if(_xt&&_xt.length>1)slot.dcSuperchargedExTier=Math.min(Math.max(0,slot.dcSuperchargedExTier|0),_xt.length-1);else slot.dcSuperchargedExTier=0}
if(o.acoa)slot.atkCounterOwnAtk=true;
if(o.sac)slot.supportCounterAtk=true;
slot.supportCntPairSnap=_dcSupportCntEligiblePairSnap(slot.atkCharData,slot.atkUnitData)||null;
if(o.uta)slot.unitTurnBuffAtk=true;
if(o.utd)slot.unitTurnBuffDef=true;
if(o.mlb)slot.masterLeagueBuff=true;
if(o.ogb)slot.grandOffensiveBuff=true;
if(o.brz)slot.bigRangZeonSquadBuff=true;
if(o.ae===0)slot.applyAdvantageEnemyTag=false;
if(o.az===0)slot.applyZeonEnemyTag=false;
const opId=o.op;
if(opId&&!o.atkM){
const uidForOp=String(slot.atkUnit||'');
try{
const r=await fetch(`/api/option_parts?lang=${S.lang}&page=1&per_page=100&q=${encodeURIComponent(String(opId))}&unit_id=${encodeURIComponent(uidForOp)}`);
const d=await r.json();
const hit=(d.rows||[]).find(x=>String(x.id)===String(opId));
if(hit)slot.optionParts=[{id:hit.id,name:hit.name,details:hit.details||'',thum:hit.thum||'',tags:hit.tags||[]}];
}catch(_){}
}
const spId=o.sp;
if(spId){
const lv=Math.min(100,Math.max(1,parseInt(o.spl!==undefined?o.spl:100,10)));
const lb=Math.min(3,Math.max(0,parseInt(o.spb!==undefined?o.spb:3,10)));
try{
let cq='';
if(slot.atkUnit&&slot.atkUnit!=='__manual__')cq+='&for_unit_id='+encodeURIComponent(String(slot.atkUnit));
if(slot.atkChar&&slot.atkChar!=='__manual__')cq+='&for_char_id='+encodeURIComponent(String(slot.atkChar));
const rd=await fetch(`/api/supporter/${spId}?lang=${S.lang}&level=${lv}&lb_tier=${lb}${cq}`).then(r=>r.json());
if(rd&&!rd.error){rd._dcLevel=lv;rd._dcLbTier=lb;slot.supporters=[rd]}
}catch(_){}
}
return slot;
}
async function _dcApplyPackedShareState(obj){
if(obj.lg&&obj.lg!==S.lang&&S.languages&&S.languages.includes(obj.lg)){
S.lang=obj.lg;
persistLang(obj.lg);
syncUiLangDocumentAttr();
try{document.getElementById('langLabel').textContent=S.lang;renderLangDD()}catch(_){}
applyLang();
_dcStagesCache=null;
_dcStagesFetchLang=null;
}
if(obj.mpc===1)S.dc.multiPctCompare=true;
const D=obj.D||{};
const preset=document.getElementById('dcDefModePreset');
const custom=document.getElementById('dcDefModeCustom');
const database=document.getElementById('dcDefModeDatabase');
const pw=document.getElementById('dcDefPresetWrap');
const cw=document.getElementById('dcDefCustomWrap');
const dbw=document.getElementById('dcDefDatabaseWrap');
if(obj.defDb&&obj.defU&&obj.defC){
S.dc.defTargetMode='database';
{const n=parseInt(obj.defLT,10);S.dc.defLbTier=obj.defLT!=null&&!Number.isNaN(n)?Math.min(3,Math.max(0,n)):3;}
renderDcDefDbPicks();
if(preset)preset.checked=false;
if(custom)custom.checked=false;
if(database)database.checked=true;
if(pw)pw.style.display='none';
if(cw)cw.style.display='none';
if(dbw)dbw.style.display='block';
const uid=String(obj.defU),cid=String(obj.defC);
try{
const[ur,cr]=await Promise.all([
fetch(`/api/unit/${encodeURIComponent(uid)}?lang=${S.lang}`).then(r=>r.json()),
fetch(`/api/character/${encodeURIComponent(cid)}?lang=${S.lang}`).then(r=>r.json())
]);
if(!ur.error&&!cr.error){S.dc.defUnitData=ur;S.dc.defCharData=cr;_dcSyncDefNpcFromDatabase();}
else{S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();}
}catch(_){S.dc.defUnitData=null;S.dc.defCharData=null;S.dc.defNpc=null;renderDcDefDbPicks();renderDcDefStats();}
}else if(obj.defM===1&&obj.defC){
S.dc.defTargetMode='custom';
S.dc.defUnitData=null;S.dc.defCharData=null;
_dcFillManualDefDomFromPack(obj.defC);
if(preset)preset.checked=false;
if(custom)custom.checked=true;
if(database)database.checked=false;
if(pw)pw.style.display='none';
if(cw)cw.style.display='block';
if(dbw)dbw.style.display='none';
S.dc.defNpc=_dcManualDefNpcFromDefC(obj.defC);
}else{
S.dc.defTargetMode='preset';
S.dc.defUnitData=null;S.dc.defCharData=null;
if(preset)preset.checked=true;
if(custom)custom.checked=false;
if(database)database.checked=false;
if(pw)pw.style.display='';
if(cw)cw.style.display='none';
if(dbw)dbw.style.display='none';
if(D.s){
const sel=document.getElementById('dcStageSelect');
if(sel){sel.value=D.s;if(sel.value===D.s)await onDcStageChange()}
}
}
const arr=Array.isArray(obj.S)?obj.S:[null,null,null];
const loaded=await Promise.all([0,1,2].map(i=>{
const o=arr[i];
return o?_dcLoadSlotFromPackedObj(o):Promise.resolve(null);
}));
const slots=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++)slots.push(loaded[i]||_dcCreateEmptyAttackerSlot());
S.dc.atkSlots=slots;
_dcDedupeSsrOptionPartsAcrossDcSlots();
{const _prevIdx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
for(let si=0;si<DC_ATK_SLOT_COUNT;si++){
const sl=S.dc.atkSlots[si];
if(!sl||!sl.atkUnitData||!sl._dcNeedAutoMp)continue;
S.dc.atkSlotIndex=si;
_dcWriteAttackerToDc(sl);
_dcAutoSetVigor();
sl.mpLevel=S.dc.mpLevel;
delete sl._dcNeedAutoMp;
}
S.dc.atkSlotIndex=_prevIdx;
}
const asRaw=parseInt(obj.a||'0',10);
const ai=Number.isNaN(asRaw)?0:Math.min(Math.max(asRaw,0),DC_ATK_SLOT_COUNT-1);
S.dc.atkSlotIndex=ai;
_dcWriteAttackerToDc(S.dc.atkSlots[S.dc.atkSlotIndex]);
_dcDetectVigorCondAbilities(S.dc.atkUnitData);
_dcSyncUnitCondPassiveFromVigor();
_dcSyncAttackerDomFromDc();
S.dc.atkSlots[S.dc.atkSlotIndex]=_dcReadAttackerFromDc();
if((S.dc.defTargetMode||'preset')==='preset'&&D.n){const nSel=document.getElementById('dcNpcSelect');if(nSel){nSel.value=D.n;selectDcNpc()}}
if(D.dtp!==undefined){const el=document.getElementById('dcDmgTakenDownPilot');if(el)el.value=String(D.dtp)}
if(D.dttu!==undefined){const el=document.getElementById('dcDmgTakenDownUnit');if(el)el.value=String(D.dttu)}
if(D.defp!==undefined){const el=document.getElementById('dcDefDebuffPct');if(el)el.value=String(D.defp)}
if(D.dtb!==undefined){const el=document.getElementById('dcDtuBeam');if(el)el.value=String(D.dtb)}
if(D.dtph!==undefined){const el=document.getElementById('dcDtuPhysical');if(el)el.value=String(D.dtph)}
if(D.dts!==undefined){const el=document.getElementById('dcDtuSpecial');if(el)el.value=String(D.dts)}
if(D.def===1)setDcDefend(true);
if(D.sh===1)setDcShield(true);
if(D.nmb===0)S.dc.defNpcMapBonusesOn=false;else if(D.nmb===1)S.dc.defNpcMapBonusesOn=true;
const _dmbEl=document.getElementById('dcDefNpcMapBonusesOn');if(_dmbEl)_dmbEl.checked=S.dc.defNpcMapBonusesOn!==false;
_dcUpdateDefNpcMapBonusesToggleUi();
const _asl=S.dc.atkSlots[S.dc.atkSlotIndex|0];
if(_asl&&_asl.atkUnitData&&_asl.atkUnitData._manual)_dcFillManualAtkDomFromPack(_dcAtkManualPackFromSlot(_asl));
_dcUpdateSquadConditionGroupVisibility();
const _actSl=S.dc.atkSlots[S.dc.atkSlotIndex|0];
if(_actSl&&_actSl._squadCondFlatAdApply!==undefined){
const _scfaEl=document.getElementById('dcSquadCondFlatAdApply');
if(_scfaEl)_scfaEl.checked=!!_actSl._squadCondFlatAdApply;
}
_dcSyncAtkModeUiFromState();
}
async function _dcCheckUrlParams(){
const p=new URLSearchParams(location.search);
const _t=p.get('tab');
const _path=(location.pathname||'').replace(/\/+$/,'');
const _hasShare=!!(p.get('d')||p.get('dc'));
if(_t!=='calculator'&&_t!=='DS'&&_path!=='/cal'&&!_hasShare)return;
initDmgCalc();switchTab('calculator');
await renderDcStageDropdown();
let isMultiSlotUrl=false;
const dRaw=p.get('d');
const dcRaw=p.get('dc');
if(dRaw||dcRaw){
let obj=null;
try{
if(dRaw)obj=await _dcDecodeSharePayload(dRaw);
if((!obj||obj.v!==1)&&dcRaw&&dcRaw!==dRaw)obj=await _dcDecodeSharePayload(dcRaw);
if(obj&&obj.v===1){
await _dcApplyPackedShareState(obj);
isMultiSlotUrl=true;
}
}catch(e){console.warn('dc share payload',e)}
}
renderDcAtkUnit();renderDcAtkChar();renderDcOptionParts();renderDcSupporters();
if(isMultiSlotUrl){
_dcSyncAttackerDomFromDc();
const thp=S.dc._wpnTraitHpPow|0;const tel2=document.getElementById('dcWpnTraitHpPow');if(tel2)tel2.value=String(thp);
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const sl=S.dc.atkSlots&&S.dc.atkSlots[si];
if(sl){
if(sl._dmgIncreasePacked!=null){const el=document.getElementById('dcDmgIncrease');if(el)el.value=String(sl._dmgIncreasePacked);S.dc.dmgIncrease=sl._dmgIncreasePacked;delete sl._dmgIncreasePacked}
if(sl._critDmgUpPacked!=null){const el=document.getElementById('dcCritDmgUp');if(el)el.value=String(sl._critDmgUpPacked);S.dc.critDmgUp=sl._critDmgUpPacked;delete sl._critDmgUpPacked}
}
S.dc._integratedWpnCritDmgUp=S.dc._wpnCritDmgUp|0;
}
onDcParamChange();
if(!isMultiSlotUrl){
S.dc.atkSlotIndex=0;
S.dc.atkSlots=[_dcReadAttackerFromDc(),_dcCreateEmptyAttackerSlot(),_dcCreateEmptyAttackerSlot()];
}
_dcRefreshAtkSlotUi();
}

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
function _tbGetUnitStatKey(ud,slot){
if(!ud)return'stats_no_cond';
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
const mode=slot.unitStatMode||'normal';
const hasCond=!!ud.has_cond_stats;
const passiveOn=!!(hasCond&&slot.unitCondPassive);
const sfx=passiveOn?'_with_cond':'_no_cond';
if(mode==='ssp'&&hasSp)return'ssp_stats'+sfx;
if(mode==='sp'&&hasSp)return'sp_stats'+sfx;
return'stats'+sfx;
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
/** Phenex (unit 1144000550): unique squad passive — each deployed copy whose pilot satisfies condition 1 grants +5% ATK & +5% DEF (sheet) to units with this passive’s receiver tag (condition 2, e.g. NT-D); stacks once per Phenex MS in the squad (max five slots ⇒ 25% each). Pilot IDs that currently satisfy condition 1 in roster data: 1144000100, 1144000102, 1144000101, 1144000500 — so typical max stacks today are four (20%); game updates may raise this toward the five-slot cap. */
const PHENEX_STACK_UNIT_ID='1144000550';
const PHENEX_SQUAD_FLAT_AD_PER_STACK_PCT=5;
const PHENEX_SQUAD_FLAT_AD_MAX_STACKS=5;
const PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT=PHENEX_SQUAD_FLAT_AD_PER_STACK_PCT*PHENEX_SQUAD_FLAT_AD_MAX_STACKS;
/** Big-Rang (EX) 1009000550 + EX pilot 1009000100: +5% ATK/DEF (permanent) to Zeon-tagged squad units. */
const BIG_RANG_ZEON_SQUAD_UNIT_ID='1009000550';
const BIG_RANG_ZEON_SQUAD_PILOT_ID='1009000100';
const ZEON_LINEAGE_TAG_ID='1015';
const BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT=5;
/** All five slots; each MS with Neo Zeon counts once (4% each, cap 20%), including the piloted Qubeley when it bears that tag. */
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
/** Squad tag / count EX passives (ATK stack or ATK+DEF flat). Qubeley ZZ + EX unit uses EX squad % only. */
function _scIsQubeleyExCombo(cd,ud){
return!!(cd&&ud&&String(cd.id)===TB_QUBELEY_ZZ_PILOT_ID&&String(ud.id)===TB_PLUS_EX_SQUAD_UNIT_ID);
}
function _scTextImpliesSquadBuff(txt){
if(!txt)return false;
if(/支援攻擊|支援攻撃|support attack/i.test(txt))return false;
return/同部隊|部隊內|所屬部隊|自身所屬部隊|same squad|in the same squad|in your squad|for each (?:unit |)bearing.*squad|squad unit bearing|each squad unit|每有\d*架|上述「標籤」|上述标签|上記タグ/i.test(txt);
}
/** True when ATK+DEF bonus stacks per qualifying squad unit (input 0–5 = count), not a single flat N% row. */
function _scTraitLineImpliesPerSquadUnitFlatStack(raw){
const s=String(raw||'');
if(!/same squad|in the same squad|同部隊|部隊內/i.test(s))return false;
// "for each … bearing" stacks per qualifying unit; "for units bearing" is receiver scope only (flat N% aura).
if(/for each (?:unit |)bearing|each unit bearing|for each squad unit bearing|each squad unit bearing|for each Unit bearing|各機体|各部隊|每有\d*架|每有1架/i.test(s))return true;
return false;
}
function _scParseSquadLineStats(txt){
if(!txt)return null;
const raw=String(txt).replace(/\r/g,'');
const t=raw.replace(/\s+/g,' ');
const hasCond1=/(?:\[condition\s*1\]|【條件\s*1】|【条件\s*1】)/i.test(raw);
const hasCond2=/(?:\[condition\s*2\]|【條件\s*2】|【条件\s*2】)/i.test(raw);
let m=t.match(/increase own ATK by (\d+)%[\s\S]*?\(up to (\d+)%\)/i);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
/* EN dual-stack (e.g. 1210002400 Wing Series): Condition 1 = piloting tag, Condition 2 = per-squad count tag. */
if(hasCond1&&hasCond2){
m=t.match(/Increase ATK by (\d+)% \(up to (\d+)%\)/i);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
}
if(hasCond1){
m=t.match(/自身の攻撃力が(\d+)%上昇（最大(\d+)%）/);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
m=t.match(/自身攻擊力提升(\d+)%（最高(\d+)%）/);
if(m)return{kind:'dual_stack_atk',per:+m[1],max:+m[2]};
}
m=t.match(/Increase ATK by (\d+)% \(up to (\d+)%\)/i);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/攻撃力が(\d+)%上昇（最大(\d+)%）/);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/自身攻擊力提升(\d+)%（最高(\d+)%）/);
if(m)return{kind:'stack_atk',per:+m[1],max:+m[2]};
m=t.match(/increases ATK and DEF by (\d+)%/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/gain increased ATK and DEF (\d+)%/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/increased ATK and DEF (\d+)%/i);
if(m&&!/increases ATK and DEF by/i.test(t))return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/(?:also\s+)?(?:grant|grants)\s+\+(\d+)%\s+ATK\s+and\s+DEF/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/\+(\d+)%\s+ATK\s+and\s+DEF/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/gain increased ATK and DEF (\d+)%/i);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻撃力と防御力(\d+)%アップ/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻擊力與防禦力提升(\d+)/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/攻擊力、防禦力提升(\d+)%/);
if(m)return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=t.match(/increase ATK by (\d+)%/i);
if(m&&!/\(up to \d+%\)/i.test(t))return{kind:'flat_atk',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
m=raw.match(/「攻擊力提升(\d+)%」、「防禦力提升(\d+)%」/);
if(m&&m[1]===m[2])return{kind:'flat_ad',flat:+m[1],perSquadUnit:_scTraitLineImpliesPerSquadUnitFlatStack(raw)};
return null;
}
function _scBuildBindingFromParsed(parsed,groups,txt){
const G=Array.isArray(groups)?groups:[];
if(!parsed)return null;
if(parsed.kind==='dual_stack_atk'){
const g1=G.find(x=>/condition\s*1/i.test(String(x.label||'')))||G[0];
const g2=G.find(x=>/condition\s*2/i.test(String(x.label||'')))||G[1];
if(!g1||!g2||!((g1.conditions||[]).length)||!((g2.conditions||[]).length))return null;
return{kind:'dual_stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:[g1],countGroup:g2,affectsDef:false,inputCap:parsed.max};
}
if(parsed.kind==='stack_atk'){
if(G.length>=2){
const gPilot=G.find(x=>/condition\s*1/i.test(String(x.label||'')))||G[0];
const gCount=G.find(x=>/condition\s*2|target tags|boost target/i.test(String(x.label||'')))||G[1];
if(!((gCount.conditions||[]).length))return null;
return{kind:'stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:[gPilot],countGroup:gCount,affectsDef:false,inputCap:parsed.max};
}
if(G.length===1&&!((G[0].conditions||[]).length))return null;
if(G.length===1)return{kind:'stack_atk',perUnit:parsed.per,max:parsed.max,pilotGroups:null,countGroup:G[0],affectsDef:false,inputCap:parsed.max};
return null;
}
if(parsed.kind==='flat_ad'){
const perU=!!parsed.perSquadUnit;
const maxSlots=5;
const cap=perU?maxSlots:parsed.flat;
if(G.length>=2){
const gPilot=G[0];
const gRecv=G.find(x=>/target tags|boost target/i.test(String(x.label||'')))||G[1];
return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:[gPilot],recvGroup:gRecv,affectsDef:true,inputCap:cap,flatPerUnit:perU};
}
if(G.length===1)return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:[G[0]],recvGroup:G[0],affectsDef:true,inputCap:cap,flatPerUnit:perU};
return{kind:'flat_ad',flatPct:parsed.flat,pilotGroups:null,recvGroup:null,affectsDef:true,inputCap:cap,flatPerUnit:perU};
}
if(parsed.kind==='flat_atk'){
const perU=!!parsed.perSquadUnit;
if(G.length>=2){
const gPilot=G[0];
const gRecv=G.find(x=>/target tags|boost target/i.test(String(x.label||'')))||G[1];
return{kind:'flat_atk',flatPct:parsed.flat,pilotGroups:[gPilot],recvGroup:gRecv,affectsDef:false,inputCap:parsed.flat,flatPerUnit:perU};
}
if(G.length===1)return{kind:'flat_atk',flatPct:parsed.flat,pilotGroups:[G[0]],recvGroup:G[0],affectsDef:false,inputCap:parsed.flat,flatPerUnit:perU};
return{kind:'flat_atk',flatPct:parsed.flat,pilotGroups:null,recvGroup:null,affectsDef:false,inputCap:parsed.flat,flatPerUnit:perU};
}
return null;
}
function _scWalkAbilityDetailsForSquad(cd,ud,visitor){
function walkResolved(resolved){
if(!resolved)return;
const det=resolved.details||[];
for(let i=0;i<det.length;i++){
const ln=det[i];
const tx=String((ln&&ln.text)||'');
if(!_scTextImpliesSquadBuff(tx))continue;
const parsed=_scParseSquadLineStats(tx);
if(!parsed)continue;
const b=_scBuildBindingFromParsed(parsed,ln.condition_groups||[],tx);
if(b)visitor(b,ln);
}
}
if(cd&&!cd._manual&&Array.isArray(cd.abilities)){
for(let a=0;a<cd.abilities.length;a++)walkResolved(_dcResolveCharAbilityForMode(cd.abilities[a]));
}
if(ud&&!ud._manual&&Array.isArray(ud.abilities)){
for(let a=0;a<ud.abilities.length;a++)walkResolved(_dcResolveUnitAbilityForMode(ud.abilities[a]));
}
}
const _scSquadBindingCache=new Map();
function _scSquadBindingCacheKey(cd,ud){
const cid=cd&&!cd._manual?String(cd.id||''):'';
const uid=ud&&!ud._manual?String(ud.id||''):'';
const cm=(S.dc&&S.dc.charStatMode)||'normal';
const um=(S.dc&&S.dc.unitStatMode)||'normal';
const cc=!!(S.dc&&S.dc.charCondPassive);
const uc=!!(S.dc&&S.dc.unitCondPassive);
return cid+'|'+uid+'|'+cm+'|'+um+'|'+(cc?'1':'0')+'|'+(uc?'1':'0');
}
function _scFindSquadConditionBinding(cd,ud){
const key=_scSquadBindingCacheKey(cd,ud);
if(_scSquadBindingCache.has(key))return _scSquadBindingCache.get(key);
let found=null;
_scWalkAbilityDetailsForSquad(cd,ud,(b)=>{if(!found)found=b});
if(_scSquadBindingCache.size>400)_scSquadBindingCache.clear();
_scSquadBindingCache.set(key,found);
return found;
}
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
/** Phenex unique ability: cross-slot aura from 1144000550; stacking capped PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT in team builder. */
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
function _dcOptionPartRowIsSsr(row){return row&&String(row.rarity||'').toUpperCase()==='SSR'}
function _dcCollectUsedSsrDcOptionPartIds(exceptSlotIdx){
const u=new Set();
if(!S.dc||!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))return u;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
if(exceptSlotIdx!=null&&i===exceptSlotIdx)continue;
const sl=S.dc.atkSlots[i];
(sl&&sl.optionParts||[]).forEach(p=>{if(p&&p.id&&_tbOptionPartIsSsr(p))u.add(String(p.id))});
}
return u;
}
function _dcDcOptionPartSsrDeniedForSlot(optionId,slotIdx){
return _dcCollectUsedSsrDcOptionPartIds(slotIdx).has(String(optionId));
}
function _dcStatTotalsForAutoRank(sl,optionParts,supporterObj){
const ud=sl&&sl.unitData;
if(!ud)return null;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(sl.lbTier|0,maxTier);
const statKey=_tbGetUnitStatKey(ud,sl);
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
let supporters=[];
if(supporterObj&&!supporterObj.error)supporters=[supporterObj];
const fullCtx={masterLeagueBuff:!!S.dc.masterLeagueBuff,grandOffensiveBuff:!!S.dc.grandOffensiveBuff,masterLeagueBuffMove:false,optionParts:optionParts||[],supporters,unitTurnBuffAtk:!!sl.unitTurnBuffAtk,atkUnitData:ud,atkCharData:sl.charData||null,exSquadAtkPct:_dcEffectiveExSquadAtkPct(),squadCondAtkPct:S.dc.squadCondAtkPct|0,squadCondDefPct:S.dc.squadCondDefPct|0};
const f=_dcGetModifiedAttackerUnitStatsFromCtx(fullCtx,stats);
let fatk=f.unitAtk,fdef=f.unitDefVal;
const prf=_tbPilotPairUnitAtkDef(sl.charData,ud,!!sl.charCondPassive,fatk,fdef);
fatk=prf.unitAtk;fdef=prf.unitDefVal;
fdef=_tbApplyUnitTurnBuffDefToMsDef(fdef,ud,!!sl.unitTurnBuffDef);
return{hp:f.unitHp,atk:fatk,def:fdef,mob:f.unitMob,mov:f.unitMove};
}
function _dcRankOptionForAutoFill(sl,row,supForSlot){
const rk=_tbUnitRoleKind(sl.unitData);
const b=_dcParseOptionPartBonuses(row.details||'');
const part={id:row.id,name:row.name||'',details:row.details||'',thum:row.thum||'',tags:row.tags||[]};
const z=_dcStatTotalsForAutoRank(sl,[],supForSlot);
const w=_dcStatTotalsForAutoRank(sl,[part],supForSlot);
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
function _dcDedupeSsrOptionPartsAcrossDcSlots(){
if(!S.dc||!S.dc.atkSlots||!Array.isArray(S.dc.atkSlots))return;
const seen=new Set();
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=S.dc.atkSlots[i];
if(!sl||!sl.optionParts||!sl.optionParts.length)continue;
const p=sl.optionParts[0];
if(!p||!p.id)continue;
if(!_tbOptionPartIsSsr(p))continue;
const k=String(p.id);
if(seen.has(k))sl.optionParts=[];
else seen.add(k);
}
}
function _dcAutoFitContextValid(fitGen,slotIdx,unitId,charId){
if(typeof S==='undefined'||!S.dc)return false;
if(fitGen!=null&&fitGen!==(S.dc._dcAutoFitGen|0))return false;
const curIdx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
if(curIdx!==slotIdx)return false;
if(String(S.dc.atkUnit||'')!==String(unitId||''))return false;
if(String(S.dc.atkChar||'')!==String(charId||''))return false;
return true;
}
function _dcSlotNeedsAutoFit(sl){
if(!sl||!sl.atkUnit||!sl.atkChar||!sl.atkUnitData||sl.atkUnitData._manual||!sl.atkCharData||sl.atkCharData._manual)return false;
const hasOp=Array.isArray(sl.optionParts)&&sl.optionParts.length>0;
const hasSup=Array.isArray(sl.supporters)&&sl.supporters.length>0;
return !hasOp||!hasSup;
}
function _dcScheduleAutoFitOptionPartAndSupporter(){
if(typeof S==='undefined'||!S.dc)return;
S.dc._dcAutoFitGen=(S.dc._dcAutoFitGen|0)+1;
const gen=S.dc._dcAutoFitGen;
void dcAutoFitOptionPartAndSupporter(gen).then(()=>{
if(gen!==(S.dc._dcAutoFitGen|0))return;
renderDcAtkUnit();
if(S.dc.atkCharData)renderDcAtkChar();
renderDcOptionParts();
renderDcSupporters();
_dcSnapActiveAttackerToSlot();
_dcSyncAtkModeUiFromState();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
});
}
async function dcAutoFitOptionPartAndSupporter(fitGen){
if(typeof S==='undefined'||!S.dc)return;
if(S.dc._dcAutoFitBusy){
S.dc._dcAutoFitQueuedGen=fitGen;
return;
}
const ud=S.dc.atkUnitData;
if(!ud||ud._manual||!S.dc.atkUnit||!S.dc.atkChar||!S.dc.atkCharData||S.dc.atkCharData._manual)return;
S.dc._dcAutoFitBusy=true;
try{
const slotIdx=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const sl={unitData:ud,charData:S.dc.atkCharData,unitId:S.dc.atkUnit,charId:S.dc.atkChar,lbTier:S.dc.lbTier,charCondPassive:!!S.dc.charCondPassive,unitCondPassive:!!S.dc.unitCondPassive,unitStatMode:S.dc.unitStatMode||'normal',unitTurnBuffAtk:!!S.dc.unitTurnBuffAtk,unitTurnBuffDef:!!S.dc.unitTurnBuffDef,optionParts:[]};
const cq=_dcForSupporterContextQuery();
const supRows=await _dcFetchAllListRows('/api/supporters','rarity=ALL'+_dcSupporterUnitCharQuery());
let bestSup=null,bestAtk=-1;
const chunk=14;
for(let i=0;i<supRows.length;i+=chunk){
if(!_dcAutoFitContextValid(fitGen,slotIdx,sl.unitId,sl.charId))return;
const batch=supRows.slice(i,i+chunk);
const resolved=await Promise.all(batch.map(async row=>{
try{const d=await fetch(`/api/supporter/${encodeURIComponent(row.id)}?lang=${S.lang}&level=100&lb_tier=3${cq}`).then(r=>r.json());
return(!d||d.error)?null:d;
}catch(_){return null}
}));
for(let j=0;j<resolved.length;j++){
const d=resolved[j];
if(!d)continue;
const atk=(_dcStatTotalsForAutoRank(sl,[],d)||{}).atk|0;
if(atk>bestAtk){bestAtk=atk;bestSup=d}
}
}
if(!_dcAutoFitContextValid(fitGen,slotIdx,sl.unitId,sl.charId))return;
if(bestSup){bestSup._dcLevel=100;bestSup._dcLbTier=3;S.dc.supporters=[bestSup]}
else S.dc.supporters=[];
const supFor=S.dc.supporters[0]||null;
const uid=String(S.dc.atkUnit);
const opRows=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL&unit_id='+encodeURIComponent(uid));
const used=_dcCollectUsedSsrDcOptionPartIds(slotIdx);
let bestOp=null,bestR=null;
for(let k=0;k<opRows.length;k++){
if(!_dcAutoFitContextValid(fitGen,slotIdx,sl.unitId,sl.charId))return;
const row=opRows[k];
const id=String(row.id);
if(used.has(id))continue;
const ra=_dcRankOptionForAutoFill(sl,row,supFor);
if(!bestR||_tbCompareRankAuto(ra,bestR)>0){bestR=ra;bestOp=row}
}
if(!_dcAutoFitContextValid(fitGen,slotIdx,sl.unitId,sl.charId))return;
if(bestOp)S.dc.optionParts=[{id:bestOp.id,name:bestOp.name,details:bestOp.details||'',thum:bestOp.thum||'',tags:bestOp.tags||[]}];
else S.dc.optionParts=[];
}catch(_){}
finally{
S.dc._dcAutoFitBusy=false;
const queued=S.dc._dcAutoFitQueuedGen;
if(queued!=null){
S.dc._dcAutoFitQueuedGen=null;
if(queued===(S.dc._dcAutoFitGen|0))void dcAutoFitOptionPartAndSupporter(queued);
}
}
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
function _tbOptionPartIsSsr(p){
return p&&String(p.rarity||'').toUpperCase()==='SSR';
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
function renderEntityPickerItemCell(r,t,th,pickIdAttr){
const id=escAttr(String(r.id));
const attr=pickIdAttr||'data-tb-pick-id';
const thumb=renderListThumb(r,t,th,{pickerThumb:true});
let role='';
if((t==='unit'||t==='char')&&r.role_icon){
role=`<span class="tb-picker-role-inline" aria-hidden="true">${pictureRasterHtml(r.role_icon,{cls:'tb-picker-role-ic',loading:'eager',decoding:'async',alt:'',lazy:false})}</span>`;
}
return`<div class="tb-picker-item" role="button" tabindex="0" ${attr}="${id}">${thumb}${role}<span class="tb-picker-item-name">${esc(r.name||'')}</span></div>`;
}
function renderOptionPartPickerCell(r,th,pickIdAttr){
const id=escAttr(String(r.id));
const attr=pickIdAttr||'data-dc-pick-id';
const sz=th||52;
const thumb=r.thum
?pictureRasterHtml(r.thum,{cls:'dc-picker-mod-thum',loading:'eager',decoding:'async',alt:'',extra:`style="width:${sz}px;height:${sz}px;object-fit:contain;flex-shrink:0"`,onerror:"this.style.display='none'",lazy:false})
:`<div class="dc-picker-mod-thum dc-picker-mod-thum--ph" style="width:${sz}px;height:${sz}px" aria-hidden="true">⚙</div>`;
const details=String(r.details||'').trim();
const meta=details?`<span class="tb-picker-item-meta">${esc(details)}</span>`:'';
return`<div class="tb-picker-item tb-picker-item--rich" role="button" tabindex="0" ${attr}="${id}">${thumb}<div class="tb-picker-item-body"><span class="tb-picker-item-name">${esc(r.name||'')}</span>${meta}</div></div>`;
}
function renderSupporterPickerCell(r,th,pickIdAttr){
const id=escAttr(String(r.id));
const attr=pickIdAttr||'data-dc-pick-id';
const thumb=renderListThumb(r,'supp',th,{pickerThumb:true});
const tags=(r.skill_tag_data&&r.skill_tag_data.length)?`<div class="tb-picker-item-tags detail-tags-row">${renderSkillTags(r.skill_tag_data)}</div>`:'';
return`<div class="tb-picker-item tb-picker-item--rich" role="button" tabindex="0" ${attr}="${id}">${thumb}<div class="tb-picker-item-body"><span class="tb-picker-item-name">${esc(r.name||'')}</span>${tags}</div></div>`;
}
function _tbSortPickerEntityRows(rows){
return(rows||[]).slice().sort((a,b)=>{
const ra=Number(a.rarity_sort);const rb=Number(b.rarity_sort);
const na=Number.isFinite(ra)?ra:4;const nb=Number.isFinite(rb)?rb:4;
if(na!==nb)return na-nb;
const sa=String(a.id??'');const sb=String(b.id??'');
const ia=parseInt(sa,10);const ib=parseInt(sb,10);
if(Number.isFinite(ia)&&Number.isFinite(ib)&&ia!==ib)return ia-ib;
return sa.localeCompare(sb,'en',{numeric:true,sensitivity:'base'});
});
}
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
function _tbPickerRowSearchHay(r){
const tagBits=[];
(r.tags||[]).forEach(tg=>{if(tg!=null)tagBits.push(String(tg.name!=null?tg.name:tg))});
(r.skill_tag_data||[]).forEach(sd=>{(sd&&sd.tags||[]).forEach(tg=>{if(tg&&tg.name)tagBits.push(String(tg.name))})});
if(r.series_tag)tagBits.push(String(r.series_tag));
return(String(r.name||'')+' '+String(r.details||r.boost||'')+' '+tagBits.join(' ')).toLowerCase();
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

const DC_VIGOR_ORDER=['medium','high','max','super'];
function _dcVigorAtLeast(cur,thr){const a=_dcNormMpLevel(cur),b=_dcNormMpLevel(thr);return DC_VIGOR_ORDER.indexOf(a)>=DC_VIGOR_ORDER.indexOf(b)}
/** For vigor-gated unit conditional passives, require at least Max (so Max and Supercharged qualify). If ability text requires Supercharged only, keep that stricter tier. */
function _dcVigorTierMax(a,b){
const na=_dcNormMpLevel(a||'medium'),nb=_dcNormMpLevel(b||'medium');
const ia=DC_VIGOR_ORDER.indexOf(na),ib=DC_VIGOR_ORDER.indexOf(nb);
return ia>=ib?na:nb;
}
function _dcUnitCpVigorRequirement(){
if(!S.dc._vigorCondThreshold)return null;
return _dcVigorTierMax(S.dc._vigorCondThreshold,'max');
}
/** When unit conditional stats are vigor-gated, sync passive from vigor (Max+). Call from setDcMp / unit pick only — not every render — so the toggle can override until vigor changes. */
function _dcSyncUnitCondPassiveFromVigor(){
const ud=S.dc.atkUnitData;
if(!ud||ud._manual||!ud.has_cond_stats||!S.dc._vigorCondThreshold)return;
const req=_dcUnitCpVigorRequirement();
if(!req)return;
S.dc.unitCondPassive=_dcVigorAtLeast(S.dc.mpLevel,req);
}
function _dcDetectVigorCondAbilities(ud){
S.dc._vigorCondThreshold=_dcVigorThresholdFromUnit(ud);
}
function _dcIsVigorCondActive(){
if(!S.dc._vigorCondThreshold)return false;
const req=_dcUnitCpVigorRequirement();
return req?_dcVigorAtLeast(S.dc.mpLevel,req):false;
}
function _dcGetUnitStatKeyForCp(useCondPassive){
const ud=S.dc.atkUnitData;if(!ud)return 'stats_no_cond';
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
const mode=S.dc.unitStatMode||'normal';
const hasCond=!!ud.has_cond_stats;
const passiveOn=!!(hasCond&&useCondPassive);
const sfx=passiveOn?'_with_cond':'_no_cond';
if(mode==='ssp'&&hasSp)return 'ssp_stats'+sfx;
if(mode==='sp'&&hasSp)return 'sp_stats'+sfx;
return 'stats'+sfx;
}
function _dcGetUnitStatKey(){
return _dcGetUnitStatKeyForCp(!!S.dc.unitCondPassive);
}
function _dcCpChipSpanHtml(active){
const ac=active?' active':'';
return`<span class="list-cond-toggle dc-dc-cp-chip${ac}"><span class="cp-word-pad"><span class="cp-wide"><span class="cp-wide-c" aria-hidden="true">C</span><span aria-hidden="true">P</span></span></span></span>`;
}
function _dcCharHasConditional(cd){if(!cd)return false;return cd.has_conditional_passive!=null?cd.has_conditional_passive:!!cd.has_ex_stats}
/** Character EX/CP is tied to a specific MS (recommend unit or pair maps from API). */
function _dcCharHasPairRequirement(cd){
if(!cd||cd._manual)return false;
if(cd.recommend_unit&&cd.recommend_unit.id)return true;
const pm=cd.pair_unit_stat_mod;
if(pm&&Object.keys(pm).length)return true;
const cm=cd.pair_unit_counter_atk_mod;
if(cm&&Object.keys(cm).length)return true;
return false;
}
/** True when the selected unit and pilot satisfy pair-gated CP criteria. */
function _dcUnitCharPairMatch(cd,ud){
if(!cd||!ud||cd._manual||ud._manual)return false;
const uid=String(ud.id||''),cid=String(cd.id||'');
if(cd.recommend_unit&&String(cd.recommend_unit.id)===uid)return true;
if(ud.recommend_character&&String(ud.recommend_character.id)===cid)return true;
const pm=cd.pair_unit_stat_mod;
if(pm&&pm[uid])return true;
const cm=cd.pair_unit_counter_atk_mod;
if(cm&&cm[uid]!=null)return true;
return false;
}
/** Default pilot CP on in DC when pairing matches (or when CP is not pair-gated) and vigor meets any CP gate. */
function _dcShouldAutoCharCondPassive(cd,ud){
if(!cd||!ud||cd._manual||ud._manual)return false;
if(!_dcCharHasConditional(cd))return false;
/** Super vigor max-damage: Supercharged EX 1/2 applies on any MS (not Destiny-only). */
if(_dcNormMpLevel(S.dc.mpLevel)==='super'&&cd.ex_supercharged_tiers&&cd.ex_supercharged_tiers.length>1)return true;
if(_dcIsShinnAsukaCharacter(cd)&&_dcNormMpLevel(S.dc.mpLevel)==='super')return true;
if(_dcCharHasPairRequirement(cd)&&!_dcUnitCharPairMatch(cd,ud)){
if(_dcNormMpLevel(S.dc.mpLevel)==='super'&&cd.ex_supercharged_tiers&&cd.ex_supercharged_tiers.length>1)return true;
return false;
}
const vReq=_dcCharCpVigorRequirement(cd);
if(vReq&&!_dcVigorAtLeast(S.dc.mpLevel,vReq))return false;
return true;
}
/** Sync pilot CP from unit+character pairing. Call on pick / share load — not every render — so manual toggle can override until the pair changes. */
function _dcSyncCharCondPassiveFromPair(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!cd||!ud||cd._manual||ud._manual)return;
S.dc.charCondPassive=_dcShouldAutoCharCondPassive(cd,ud);
if(!S.dc.charCondPassive)S.dc.dcSuperchargedExTier=0;
else _dcSyncSuperchargedExTierForVigor();
}
function _dcCharGuaranteedCritActive(){
const cd=S.dc.atkCharData;
if(!cd||!S.dc.charCondPassive)return false;
function scanAb(ab){
if(!ab||ab.is_ex)return false;
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return false;
let blob=String(r.name||'')+'\n';
(r.details||[]).forEach(d=>{blob+=String((d&&d.text)||'')+'\n'});
return DC_GUARANTEED_CRIT_RE.test(blob);
}
if(Array.isArray(cd.abilities)&&cd.abilities.some(scanAb))return true;
if(_dcNormMpLevel(S.dc.mpLevel)==='super'&&cd.ex_supercharged_tiers&&cd.ex_supercharged_tiers.length>1){
const maxTi=cd.ex_supercharged_tiers.length-1;
if((S.dc.dcSuperchargedExTier|0)>=maxTi&&_dcSuperchargedExTierHasGuaranteedCrit(cd,2))return true;
}
return false;
}
function _dcGetCharStatsForCp(charCpOn){
const cd=S.dc.atkCharData;if(!cd)return[];
const mode=S.dc.charStatMode||'normal';
const cp=!!(_dcCharHasConditional(cd)&&charCpOn);
const exTiers=cd.ex_supercharged_tiers;
if(cp&&exTiers&&exTiers.length>1){
const ti=Math.min(Math.max(0,S.dc.dcSuperchargedExTier|0),exTiers.length-1);
const row=exTiers[ti]&&exTiers[ti].stats;
if(row&&row.length)return row;
}
if(mode==='sp'&&_dcCharHasSpStats(cd))return cp?cd.sp_stats_with_ex:cd.sp_stats;
return cp?cd.stats_with_ex:cd.stats;
}
function _dcGetCharStats(){
return _dcGetCharStatsForCp(!!S.dc.charCondPassive);
}
function _dcCharExSquadSynergyAbilityBlob(cd){
if(!cd||cd._manual||!Array.isArray(cd.abilities))return'';
let out='';
for(const ab of cd.abilities){
const r=_dcResolveCharAbilityForMode(ab);
if(!r)continue;
out+=String(r.name||'')+'\n';
const det=r.details||[];
for(let i=0;i<det.length;i++)out+=String((det[i]&&det[i].text)||'')+'\n';
if(r.desc)out+=String(r.desc)+'\n';
}
return out;
}
function _dcCharHasExSquadSynergyAbility(cd,udOpt){
const blob=_dcCharExSquadSynergyAbilityBlob(cd);
if(!blob)return false;
if(!/\bsquad\b/i.test(blob)&&!/同部隊/i.test(blob))return false;
const ud=udOpt!==undefined?udOpt:S.dc.atkUnitData;
if(ud&&!ud._manual){
const b=_scFindSquadConditionBinding(cd,ud);
if(b&&!_scIsQubeleyExCombo(cd,ud))return false;
}
return/\bIncrease ATK by \d+%/i.test(blob)||/攻撃力が\d+%上昇/.test(blob)||/自身攻擊力提升\d+%/.test(blob);
}
function _dcCharShouldShowSquadCondUi(cd,ud){
if(!cd||cd._manual||!ud||ud._manual)return false;
if(_scIsQubeleyExCombo(cd,ud))return false;
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return false;
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups))return false;
return true;
}
function _dcSquadRecvGroupMet(ud,cd,rg){
if(!rg)return true;
const conds=rg.conditions||[];
if(!conds.length)return true;
return _dcAbilityCondContextMeetsGroups(ud,cd,[rg]);
}
/** Phenex unique squad flat ATK+DEF (see PHENEX_* constants); null if this pair is not that binding. */
function _dcPhenexUniqueSquadFlatAdBinding(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
if(!b||b.kind!=='flat_ad'||b.flatPerUnit)return null;
if(!ud||ud._manual||String(ud.id)!==PHENEX_STACK_UNIT_ID)return null;
return b;
}
function _dcSquadFlatAdSingleBinding(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
return b&&b.kind==='flat_ad'&&!b.flatPerUnit?b:null;
}
function _dcSlotShouldPackSquadCond(sl){
if(!sl||!sl.atkUnit||!sl.atkChar||sl.atkUnit==='__manual__'||sl.atkChar==='__manual__')return false;
return!!(sl.atkCharData&&!sl.atkCharData._manual&&sl.atkUnitData&&!sl.atkUnitData._manual);
}
function _dcSquadCondInputCap(cd,ud){
const b=_scFindSquadConditionBinding(cd,ud);
if(!b)return 0;
if(_dcPhenexUniqueSquadFlatAdBinding(cd,ud))return PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT;
return(b.inputCap!=null?b.inputCap:(b.kind==='flat_ad'?b.flatPct:b.max))|0;
}
function _dcDcCountUnitsMatchingCountGroup(cg){
if(!cg||!((cg.conditions||[]).length))return 0;
if(typeof S==='undefined'||!S.dc||!S.dc.atkSlots)return 0;
let n=0;
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=S.dc.atkSlots[i];
const u2=sl&&(sl.atkUnitData||sl.unitData);
if(!u2||u2._manual)continue;
if(_dcConditionGroupMatches(u2,null,cg))n++;
}
return n;
}
/** Stack squad ATK (2%×N up to 10%, etc.): count matching DC attacker MS, always including the active unit when it matches. */
function _dcStackSquadAtkDefaultPct(cd,ud,b){
if(!b||!b.countGroup)return 0;
let n=_dcDcCountUnitsMatchingCountGroup(b.countGroup)|0;
if(ud&&!ud._manual&&_dcConditionGroupMatches(ud,null,b.countGroup)&&n<1)n=1;
const per=b.perUnit|0,max=b.max|0;
if(!(per>0)||!(max>0))return 0;
return Math.min(max,per*Math.max(0,n));
}
function _dcDefaultSquadCondPctForCdUd(cd,ud){
if(!_dcCharShouldShowSquadCondUi(cd,ud))return 0;
const b=_scFindSquadConditionBinding(cd,ud);
if(b&&(b.kind==='stack_atk'||b.kind==='dual_stack_atk')&&b.countGroup){
/* e.g. 1210002400 Wing Series: alone on a Wing MS → 2%; five Wing MS → 10%. User can raise/lower the Squad conditions field. */
return _dcStackSquadAtkDefaultPct(cd,ud,b);
}
if(b&&b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg))return 0;
}
const phen=_dcPhenexUniqueSquadFlatAdBinding(cd,ud);
if(phen)return phen.flatPct|0;
return _dcSquadCondInputCap(cd,ud);
}
function _dcUnitHasZeonLineageTag(ud){
if(!ud||ud._manual)return false;
const want=ZEON_LINEAGE_TAG_ID;
const tags=ud.tags||[];
for(let i=0;i<tags.length;i++){
const tg=tags[i];
if(!tg)continue;
if(String(tg.id||'').trim()===want)return true;
const nm=String(tg.name||'').toLowerCase();
if(nm==='zeon'||nm.includes('ジオン公国')||nm.includes('吉翁公國')||nm.includes('吉翁公国'))return true;
}
return false;
}
function _dcIsBigRangZeonSquadCarrierPair(cd,ud){
return!!(cd&&ud&&!cd._manual&&!ud._manual&&String(ud.id)===BIG_RANG_ZEON_SQUAD_UNIT_ID&&String(cd.id)===BIG_RANG_ZEON_SQUAD_PILOT_ID);
}
function _dcShouldShowBigRangZeonSquadBuffToggle(cd,ud){
if(!ud||ud._manual||!_dcUnitHasZeonLineageTag(ud))return false;
/* Carrier already applies the aura via normal squad-condition binding — avoid double-counting. */
if(_dcIsBigRangZeonSquadCarrierPair(cd,ud))return false;
return true;
}
function _dcBigRangZeonSquadBuffActive(){
if(!_dcShouldShowBigRangZeonSquadBuffToggle(S.dc.atkCharData,S.dc.atkUnitData))return false;
const wrap=document.getElementById('dcBigRangZeonSquadWrap');
const cb=document.getElementById('dcBigRangZeonSquadApply');
if(wrap&&wrap.style.display!=='none'&&cb)return!!cb.checked;
return!!S.dc.bigRangZeonSquadBuff;
}
function setDcBigRangZeonSquadBuff(on){
S.dc.bigRangZeonSquadBuff=!!on;
const cb=document.getElementById('dcBigRangZeonSquadApply');
if(cb)cb.checked=!!on;
onDcParamChange();
}
function toggleDcBigRangZeonSquadBuff(){
const cb=document.getElementById('dcBigRangZeonSquadApply');
setDcBigRangZeonSquadBuff(cb?!cb.checked:!S.dc.bigRangZeonSquadBuff);
}
function _dcSyncSquadCondEffectiveFromState(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
S.dc.squadCondAtkPct=0;
S.dc.squadCondDefPct=0;
if(!ud||ud._manual||!cd||cd._manual||_scIsQubeleyExCombo(cd,ud)){
if(_dcBigRangZeonSquadBuffActive()){S.dc.squadCondAtkPct=BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT;S.dc.squadCondDefPct=BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT}
return;
}
const raw=Math.max(0,S.dc.squadCondPct|0);
const b=_scFindSquadConditionBinding(cd,ud);
if(b){
if(b.pilotGroups&&b.pilotGroups.length&&!_dcAbilityCondContextMeetsGroups(ud,cd,b.pilotGroups)){
/* fall through — still allow Big-Rang Zeon aura */
}else{
if(b.kind==='flat_ad'){
const rg=b.recvGroup;
if(rg&&!_dcSquadRecvGroupMet(ud,cd,rg)){/* skip local */}
else{
const cap=_dcSquadCondInputCap(cd,ud);
const v=Math.min(Math.max(0,cap),raw);
if(b.flatPerUnit){const per=b.flatPct|0;const eff=per*v;S.dc.squadCondAtkPct=eff;S.dc.squadCondDefPct=eff}
else{S.dc.squadCondAtkPct=v;S.dc.squadCondDefPct=v}
}
}else{
/* stack_atk / dual_stack / flat_atk: use the Squad conditions input (0–cap), not live DC slot counts */
const cap=_dcSquadCondInputCap(cd,ud);
const v=Math.min(Math.max(0,cap),raw);
S.dc.squadCondAtkPct=v;
S.dc.squadCondDefPct=0;
}
}
}else{
const v=Math.min(100,raw);
S.dc.squadCondAtkPct=v;
S.dc.squadCondDefPct=0;
}
if(_dcBigRangZeonSquadBuffActive()){
S.dc.squadCondAtkPct=(S.dc.squadCondAtkPct|0)+BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT;
S.dc.squadCondDefPct=(S.dc.squadCondDefPct|0)+BIG_RANG_ZEON_SQUAD_FLAT_AD_PCT;
}
}
function _dcDefNpcMapBonusesEnabled(){return S.dc.defNpcMapBonusesOn!==false;}
/** Map NPC unit: default stats match in-game map tiles (own + pilot + this NPC's squad lines only).
 *  Toggle on adds other map NPCs' squad-wide / all-units passives (stage-wide stack). */
function _dcDefNpcUnitMapStatsPair(u){
const mapS=u&&u.stats_raw||{},mapB=u&&u.bonus_amounts||{};
const stageS=u&&u.stats_raw_npc_stage_squad_allies,stageB=u&&u.bonus_amounts_npc_stage_squad_allies;
const hasStage=stageS&&stageB&&typeof stageS==='object'&&typeof stageB==='object';
if(_dcDefNpcMapBonusesEnabled()&&hasStage)return{stats:stageS,bonuses:stageB};
return{stats:mapS,bonuses:mapB};
}
function _dcUpdateAtkSquadBuffSectionVisibility(){
const sec=document.getElementById('dcAtkSquadBuffSection');
const lbl=document.getElementById('dcAtkSquadBuffSectionLbl');
if(!sec)return;
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
const show=!!(ud&&cd&&!ud._manual&&!cd._manual);
sec.style.display=show?'':'none';
if(lbl)lbl.textContent=t('dc_squad_buff_section');
}
function _dcUpdateDefNpcMapBonusesToggleUi(){
const tw=document.getElementById('dcDefNpcMapBonusesWrap');
const cb=document.getElementById('dcDefNpcMapBonusesOn');
const n=S.dc.defNpc;
const u=n&&n.unit,c=n&&n.character;
const show=!!(u&&!n._manual&&!u._manual&&(!c||!c._manual));
if(tw)tw.style.display=show?'':'none';
if(cb)cb.checked=S.dc.defNpcMapBonusesOn!==false;
const lb=document.getElementById('dcDefNpcMapBonusesLbl');
if(lb){lb.textContent=t('dc_def_npc_squad_buff');lb.title=t('dc_def_npc_squad_buff_tip')}
}
function _dcUpdateSquadConditionGroupVisibility(){
_dcUpdateAtkSquadBuffSectionVisibility();
const wrap=document.getElementById('dcSquadCondWrap');
const inp=document.getElementById('dcSquadCondPct');
const tip=document.getElementById('dcSquadCondTip');
const rg=document.getElementById('dcSquadCondRange');
const flatW=document.getElementById('dcSquadCondFlatAdWrap');
const flatLb=document.getElementById('dcSquadCondFlatAdLbl');
const flatCb=document.getElementById('dcSquadCondFlatAdApply');
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!wrap||!inp){return}
const showPair=!!(ud&&cd&&!ud._manual&&!cd._manual);
if(!showPair){
wrap.style.display='none';
if(flatW)flatW.style.display='none';
if(tip)tip.textContent=t('dc_squad_cond_label');
return;
}
wrap.style.removeProperty('display');
const qual=_dcCharShouldShowSquadCondUi(cd,ud);
if(qual){
const cap=_dcSquadCondInputCap(cd,ud);
if(tip){tip.textContent=t('dc_squad_cond_label');tip.title=t('dc_squad_cond_tip')}
if(rg)rg.textContent='(0–'+cap+')';
inp.min='0';
inp.max=String(Math.max(0,cap));
const cur=Math.min(Math.max(0,cap),Math.max(0,S.dc.squadCondPct|0));
if(String(inp.value)!==String(cur))inp.value=String(cur);
}else{
if(tip){tip.textContent=t('dc_squad_cond_label');tip.title=t('dc_squad_cond_manual_tip')}
if(rg)rg.textContent='(0–100)';
inp.min='0';
inp.max='100';
const v=S.dc.squadCondPct|0;
const disp=v>0?String(v):'';
if(String(inp.value)!==disp)inp.value=disp;
}
if(flatW&&flatLb&&flatCb){
const bf=qual?_dcSquadFlatAdSingleBinding(cd,ud):null;
flatW.style.display=bf?'':'none';
if(bf){flatLb.textContent=t('dc_squad_cond_flat_ad_chk').replace('%n',String(bf.flatPct|0));flatLb.title=t('dc_squad_cond_flat_ad_tip');flatCb.checked=(S.dc.squadCondPct|0)>0}
}else if(flatW)flatW.style.display='none';
const brW=document.getElementById('dcBigRangZeonSquadWrap');
const brLb=document.getElementById('dcBigRangZeonSquadLbl');
const brCb=document.getElementById('dcBigRangZeonSquadApply');
if(brW&&brLb&&brCb){
const showBr=_dcShouldShowBigRangZeonSquadBuffToggle(cd,ud);
brW.style.display=showBr?'':'none';
if(showBr){
brLb.textContent=t('dc_bigrang_zeon_squad_chk');
brLb.title=t('dc_bigrang_zeon_squad_tip');
brCb.checked=!!S.dc.bigRangZeonSquadBuff;
}else if(S.dc.bigRangZeonSquadBuff){
S.dc.bigRangZeonSquadBuff=false;
brCb.checked=false;
}
}else if(brW)brW.style.display='none';
_dcUpdateDefNpcMapBonusesToggleUi();
}
function _dcEffectiveExSquadAtkPct(){return _dcEffectiveExSquadAtkPctFromCtx(S.dc);}
function _dcEffectiveExSquadAtkPctFromCtx(ctx){
const c=ctx||{};
if(!_dcCharHasExSquadSynergyAbility(c.atkCharData,c.atkUnitData))return 0;
const el=typeof document!=='undefined'?document.getElementById('dcExSquadAtkPct'):null;
if(!el){
if(c.exSquadAtkPctExplicitZero)return 0;
return _scIsQubeleyExCombo(c.atkCharData,c.atkUnitData)?20:Math.min(20,Math.max(0,c.exSquadAtkPct|0));
}
const rawStr=String(el.value).trim();
if(rawStr==='0')return 0;
if(rawStr!==''){
const raw=parseInt(rawStr,10);
return Number.isFinite(raw)?Math.min(20,Math.max(0,raw)):0;
}
return _scIsQubeleyExCombo(c.atkCharData,c.atkUnitData)?20:Math.min(20,Math.max(0,c.exSquadAtkPct|0));
}
function _dcUpdateExSquadAtkGroupVisibility(){
const wrap=document.getElementById('dcExSquadAtkWrap');
if(!wrap)return;
const inp=document.getElementById('dcExSquadAtkPct');
const cd=S.dc.atkCharData;
const ud=S.dc.atkUnitData;
const show=!!(cd&&!cd._manual&&_dcCharHasExSquadSynergyAbility(cd,ud));
if(show){
wrap.style.removeProperty('display');
if(inp){
const t=String(inp.value).trim();
if(t===''&&_scIsQubeleyExCombo(cd,ud)){inp.value='20';S.dc.exSquadAtkPct=20;S.dc.exSquadAtkPctExplicitZero=false}
}
}else{
wrap.style.display='none';
S.dc.exSquadAtkPct=0;
S.dc.exSquadAtkPctExplicitZero=false;
if(inp)inp.value='';
}
}
async function dcSwapAtkTransformUnit(){
const u=S.dc.atkUnitData;
if(!u||u._manual||!u.transform_partner_id)return;
const pid=String(u.transform_partner_id);
try{
const r=await fetch(`/api/unit/${encodeURIComponent(pid)}?lang=${S.lang}`);
const d=await r.json();
if(d.error)return;
S.dc.atkUnit=pid;
S.dc.atkUnitData=d;
const _bw=_dcPickBestWeaponIndices(d);
S.dc.wpnIdx=_bw.wpnIdx;
S.dc.wpnLv=_bw.wpnLv;
_dcDetectVigorCondAbilities(d);
if(_dcCharShouldShowSquadCondUi(S.dc.atkCharData,S.dc.atkUnitData))S.dc.squadCondPct=_dcDefaultSquadCondPctForCdUd(S.dc.atkCharData,S.dc.atkUnitData);
else S.dc.squadCondPct=0;
S.dc.optionParts=[];S.dc.supporters=[];
renderDcAtkUnit();
renderDcAtkChar();
renderDcWeaponArea();
renderDcOptionParts();
renderDcSupporters();
_dcUpdateAdvantageEnemyTagUi();_dcUpdateZeonEnemyTagUi();
onDcParamChange();
_dcScheduleAutoFitOptionPartAndSupporter();
}catch(_){}
}
function renderDcAtkUnit(){
const area=document.getElementById('dcAtkUnitArea');
const ud=S.dc.atkUnitData;
if(!ud){area.innerHTML=`<button class="dc-pick-btn" onclick="openDcPicker('unit')">${t('dc_pick_unit')}</button>`;document.getElementById('dcAtkStatsArea').innerHTML='';document.getElementById('dcAtkWpnArea').innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};S.dc._vigorCondThreshold=null;_dcUpdateAdvantageEnemyTagUi();_dcUpdateZeonEnemyTagUi();_dcUpdateExSquadAtkGroupVisibility();_dcUpdateSquadConditionGroupVisibility();_dcUpdateSupportCounterAtkUi();return}
if(ud._manual){
area.innerHTML=`<div class="dc-picked dc-picked--manual"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div style="font-size:10px;color:var(--text-muted)">Custom unit</div></div></div>`;
document.getElementById('dcAtkStatsArea').innerHTML='';
renderDcWeaponArea();
_dcUpdateAdvantageEnemyTagUi();_dcUpdateZeonEnemyTagUi();
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
return;
}
_dcDetectVigorCondAbilities(ud);
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const thum=ud.thum||ud.portrait||'';
let lbBlock='';
if(lb&&lb.length>1&&!ud.is_ultimate){
const cur=cmpLbPipsAtTier(tier);
let lbMenu='';
for(let tt=0;tt<=maxTier;tt++){
const p=cmpLbPipsAtTier(tt);
lbMenu+=`<button type="button" class="cmp-lb-opt${tt===tier?' is-active':''}" onclick="setDcLbTier(${tt});var _dlb=document.getElementById('dcLbTierDetails');if(_dlb)_dlb.open=false" role="option" aria-selected="${tt===tier}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;
}
lbBlock=`<div class="dc-lb-inline-wrap"><details id="dcLbTierDetails" class="cmp-lb-details dc-lb-tier-details"><summary class="cmp-lb-summary" title="${esc(t('cmp_lb'))}">${cmpLbPipsRow(cur[0],cur[1],cur[2])}</summary><div class="cmp-lb-menu" role="listbox" aria-label="${esc(t('cmp_lb'))}">${lbMenu}</div></details></div>`;
}
let unitCpToggle='';
if(ud.has_cond_stats){
const vGated=!!S.dc._vigorCondThreshold;
const vHint=vGated?` title="${escAttr('Default: on when Vigor is Max or Supercharged (or higher than text if ability requires Supercharged only). Changing vigor updates the default; you can still toggle for comparisons.')}"`:'';
{const _cpL=t('conditional_passive');unitCpToggle=`<div class="dc-picked-controls"${vHint}><div class="conditional-toggle dc-dc-cond-toggle"><div class="toggle-clickable${S.dc.unitCondPassive?' active':''}" role="button" tabindex="0" title="${escAttr(_cpL)}" aria-label="${escAttr(_cpL)}" onclick="toggleDcUnitCondPassive()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDcUnitCondPassive()}"><span class="toggle-label toggle-label--cp-chip">${_dcCpChipSpanHtml(!!S.dc.unitCondPassive)}</span></div></div></div>`;}
}
const hasSp=ud.has_sp!==undefined?ud.has_sp:(parseInt(ud.rarity_id||'5')<=4);
let unitStatModeHtml='';
const uModeRow=S.dc.unitStatMode||'normal';
const spModeBtns=hasSp?`<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><button type="button" class="dc-lb-btn${uModeRow==='normal'?' active':''}" onclick="setDcUnitStatMode('normal')">Normal</button><button type="button" class="dc-lb-btn${uModeRow==='sp'?' active':''}" onclick="setDcUnitStatMode('sp')">SP</button><button type="button" class="dc-lb-btn${uModeRow==='ssp'?' active':''}" onclick="setDcUnitStatMode('ssp')">SSP</button></div>`:'';
const tfBtn=ud.transform_partner_id?`<button type="button" class="sp-toggle-btn${ud.is_transform_alternate?' active':''}" title="${escAttr(t('unit_transform_title'))}" aria-label="${escAttr(t('unit_transform_title'))}" onclick="dcSwapAtkTransformUnit()"><img src="${imgUrl('/static/images/UI/UI_Common_BattleIcon_Transform.webp')}" alt="" loading="lazy" onerror="this.style.display='none'"></button>`:'';
if(spModeBtns||tfBtn){
unitStatModeHtml=`<div class="dc-lb-row dc-unit-stat-mode-row" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">${spModeBtns||''}${tfBtn||''}</div>`;
}
const lbStatCluster=(lbBlock||unitStatModeHtml)?`<div class="dc-unit-lb-stat-cluster">${lbBlock}${unitStatModeHtml}</div>`:'';
const atkBelowPortrait=(unitCpToggle||lbStatCluster)?`<div class="dc-atk-unit-below-portrait">${unitCpToggle}${lbStatCluster}</div>`:'';
area.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(thum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ud.name)}</div><div class="dc-picked-badges">${ud.rarity_icon?`<img src="${imgUrl(ud.rarity_icon)}">`:''}${ud.role_icon?`<img src="${imgUrl(ud.role_icon)}">`:''}</div></div>${atkBelowPortrait}<button type="button" class="dc-picked-change" onclick="openDcPicker('unit')">${t('dc_change')}</button></div>`;
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcSyncSquadCondEffectiveFromState();
const sa=document.getElementById('dcAtkStatsArea');
const uEff=_dcGetModifiedAttackerUnitStats(stats);
const msEnh=_dcMsStatEnhancementLinesHtml(S.dc,stats);
const atkS=uEff.unitAtk,defS=uEff.unitDefVal,mobS=uEff.unitMob,hpS=uEff.unitHp;
const uMode=S.dc.unitStatMode||'normal';
const uCp=!!(ud.has_cond_stats&&S.dc.unitCondPassive);
let statsNoCp=stats;
if(ud.has_cond_stats&&td){
const kn=_dcGetUnitStatKeyForCp(false);
statsNoCp=td[kn]||stats;
}
function _uCpCell(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?' dc-stat-mini--cp':' dc-stat-mini--cp-penalty'}
function _uCpValBuff(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?'dc-stat-val--buffed':'dc-stat-val--penalized'}
function _uCpBonusHtml(nm){if(!uCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);const d=b-a;if(d===0)return'';const tipUp='Conditional passive — extra growth stat vs off (LB row; main number may include modifiers).';const tipDn='Conditional passive — stat change vs off (LB row; main number may include modifiers).';if(d>0)return`<div class="stat-card-bonus" style="margin-top:2px" title="${escAttr(tipUp)}">(+${fmtN(d)})</div>`;return`<div class="stat-card-bonus stat-card-penalty" style="margin-top:2px" title="${escAttr(tipDn)}">(${fmtN(d)})</div>`}
const hHp=_uCpValBuff('HP'),hAtk=_uCpValBuff('Attack'),hDef=_uCpValBuff('Defense'),hMob=_uCpValBuff('Mobility');
const sheetBuffOn=!!S.dc.masterLeagueBuff||!!S.dc.grandOffensiveBuff;
function _dcUnitMiniStatCls(cp){const pen=cp==='dc-stat-val--penalized';if(cp&&sheetBuffOn&&!pen)return` class="${cp} dc-stat-val--buffed"`;if(cp)return` class="${cp}"`;if(sheetBuffOn)return` class="dc-stat-val--buffed"`;return''}
const spHp=_dcUnitMiniStatCls(hHp),spAtk=hAtk?` class="${hAtk}"`:'',spMob=_dcUnitMiniStatCls(hMob);
const exSq=_dcEffectiveExSquadAtkPct();
const utb=_dcGetDetectedUnitTurnBuffPercents(ud);
let defShow=defS;
const pr=_dcPilotPairUnitAtkDefPct(atkS,defShow);
const atkAfterPair=pr.unitAtk;
defShow=pr.unitDefVal;
const advAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,S.dc.defNpc);
const atkAfterCounter=_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair);
const advGrAtk=uEff.advantageFlatGrowthAtk|0;
const advGrDef=uEff.advantageFlatGrowthDef|0;
const atkShowPreTurn=_dcApplyAdvantageTagAtkToUnitAtk(atkAfterCounter,advAtkPct,advGrAtk);
const atkShow=atkShowPreTurn;
const advAtkFlat=(advAtkPct|0)>0?Math.floor(Math.max(0,advGrAtk)*(advAtkPct|0)/100):0;
const advDefFlat=(advAtkPct|0)>0?Math.floor(Math.max(0,advGrDef)*(advAtkPct|0)/100):0;
const defShowAdv=_dcApplyUnitTurnBuffDefToMsDef(defShow+advDefFlat,ud);
const unitTurnAtkOn=S.dc.unitTurnBuffAtk&&(utb.atkPct|0)>0;
const unitTurnDefOn=S.dc.unitTurnBuffDef&&(utb.defPct|0)>0;
const pairActive=(atkAfterPair!==atkS||defShow!==defS);
const counterActive=(atkAfterCounter!==atkAfterPair);
const supCntActive=(_dcEffectiveSupportCounterAtkPct()|0)>0;
const advantageTagActive=(advAtkPct|0)>0&&S.dc.applyAdvantageEnemyTag!==false;
const leaderAtkActive=(uEff.leaderPct|0)>0;
const dEx=uEff.deltaExAtk|0;
const atkExSub=exSq>0?`<div id="dcAtkUnitAtkExSub" class="stat-card-bonus" title="EX squad % delta within the same % bucket as the panel (ceil; same value used in damage ⑧).">+${fmtN(dEx)} · EX squad +${exSq}%</div>`:`<div id="dcAtkUnitAtkExSub" style="display:none" aria-hidden="true"></div>`;
const atkSpanClass=hAtk==='dc-stat-val--penalized'?'dc-stat-val--penalized':((exSq>0||hAtk||leaderAtkActive||pairActive||counterActive||supCntActive||advantageTagActive||unitTurnAtkOn||sheetBuffOn)?'dc-stat-val--buffed':'');
let atkMainTitle=exSq>0?(counterActive?'Includes EX squad ATK % and own ATK when countering (unit)':'Includes EX squad ATK %'):(counterActive?'Includes own ATK when countering (unit)':'');
if(supCntActive){atkMainTitle=(atkMainTitle?atkMainTitle+'; ':'')+'Support Attack/Counter +% MS ATK (pilot)'}
const atkAdvTitle=advantageTagActive?` (+${advAtkFlat} MS Attack: ${advAtkPct}% of raw LB Attack base; flat add, not +${advAtkPct}% on total MS ATK)`:'';
const atkBonusInline=Math.max(0,atkShow-(uEff.atkDbCorePassive|0));
const atkInlineBonusHtml=`<span id="dcAtkUnitAtkInlineBonus" class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">${atkBonusInline>0?`(+${fmtN(atkBonusInline)})`:''}</span>`;
const atkMainSpan=`<span id="dcAtkUnitAtkMain"${atkSpanClass?` class="${atkSpanClass}"`:''}${!atkSpanClass&&spAtk?spAtk:''}${(atkMainTitle||atkAdvTitle)?` title="${escAttr((atkMainTitle||'')+atkAdvTitle)}"`:''}>${fmtN(atkShow)}</span>${atkInlineBonusHtml}`;
const hpBonusIn=Math.max(0,hpS-(uEff.hpDbCorePassive|0));
const hpInlineBonus=hpBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(hpBonusIn)})</span>`:'';
const defBonusIn=Math.max(0,defShowAdv-(uEff.defDbCorePassive|0));
const defInlineBonus=defBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(defBonusIn)})</span>`:'';
const mobBonusIn=Math.max(0,mobS-(uEff.mobDbCorePassive|0));
const mobInlineBonus=mobBonusIn>0?`<span class="stat-card-bonus" style="display:inline;margin-left:4px;color:var(--accent-green);font-weight:600;font-size:13px">(+${fmtN(mobBonusIn)})</span>`:'';
const defPairBuff=defShow!==defS;
const spDefCls=hDef==='dc-stat-val--penalized'?'dc-stat-val--penalized':((hDef||defPairBuff||advDefFlat>0||unitTurnDefOn||sheetBuffOn)?'dc-stat-val--buffed':'');
const spDefFinal=spDefCls?` class="${spDefCls}"`:'';
const pairNote=(S.dc.atkCharData&&S.dc.atkCharData.pair_unit_stat_mod&&S.dc.atkCharData.pair_unit_stat_mod[String(ud.id)]&&S.dc.charCondPassive)?'<div style="font-size:10px;color:var(--accent-cyan);margin-top:4px;line-height:1.35">EX ability: ATK/DEF bonus to this unit when the EX ability toggle is on.</div>':'';
const cPct=_dcGetCounterOwnAtkPct();
const counterNote=(cPct>0)?'<div style="font-size:10px;color:var(--accent-cyan);margin-top:4px;line-height:1.35">EX ability: +'+cPct+'% MS Attack when countering (see Own ATK when countering below).</div>':'';
const unitModNote=pairNote+counterNote;
const vigorCondNote=_dcIsVigorCondActive()?'<div style="margin-top:4px;padding:4px 8px;background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.28);border-radius:4px;font-size:11px;color:#eab308">Vigor condition met — see unit abilities for in-battle effects.</div>':'';
let unitTurnBuffHtml='';
if((utb.atkPct|0)>0||(utb.defPct|0)>0){
unitTurnBuffHtml=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Unit skill (1 turn)</div><div style="font-size:12px;line-height:1.6">`;
if((utb.atkPct|0)>0)unitTurnBuffHtml+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px"><input type="checkbox" ${S.dc.unitTurnBuffAtk?'checked':''} onchange="setDcUnitTurnBuffAtk(this.checked)"><span>MS ATK +${utb.atkPct}% (1 turn)</span></label>`;
if((utb.defPct|0)>0)unitTurnBuffHtml+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px"><input type="checkbox" ${S.dc.unitTurnBuffDef?'checked':''} onchange="setDcUnitTurnBuffDef(this.checked)"><span>MS DEF +${utb.defPct}% (1 turn)</span></label>`;
unitTurnBuffHtml+=`<div style="font-size:10px;color:var(--text-muted);margin-top:4px;line-height:1.35">Detected from this unit’s skill descriptions. MS ATK +% (1 turn) stacks in the same % bucket as other MS Attack lines; the panel uses <strong>ceil</strong> on that bucket to match the in-game MS sheet (same value used in damage ⑧). MS DEF toggle updates the panel only (damage uses the <strong>defender</strong>’s MS DEF).</div></div>`;
}
const uGridBase=`stats-grid dc-atk-ers dc-stat-visual--${uMode} dc-stat-grid-4`;
const uGridCls=sheetBuffOn?`${uGridBase} dc-stats-mini--ml-buff`:uGridBase;
sa.innerHTML=`<div class="dc-section-label">${t('dc_unit_stats')}</div><div class="${uGridCls}"><div class="stat-card${_uCpCell('HP')}"><div class="stat-card-label">HP</div><div class="stat-card-value"><span${spHp}>${fmtN(hpS)}</span>${hpInlineBonus}${_uCpBonusHtml('HP')}${msEnh.hpHtml}</div></div><div class="stat-card${_uCpCell('Attack')}"><div class="stat-card-label">${t('col_atk')}</div><div class="stat-card-value">${atkMainSpan}${_uCpBonusHtml('Attack')}${msEnh.atkHtml}${atkExSub}</div></div><div class="stat-card${_uCpCell('Defense')}"><div class="stat-card-label">${t('col_def')}</div><div class="stat-card-value"><span${spDefFinal}>${fmtN(defShowAdv)}</span>${defInlineBonus}${_uCpBonusHtml('Defense')}${msEnh.defHtml}</div></div><div class="stat-card${_uCpCell('Mobility')}"><div class="stat-card-label">${t('col_mob')}</div><div class="stat-card-value"><span${spMob}>${fmtN(mobS)}</span>${mobInlineBonus}${_uCpBonusHtml('Mobility')}${msEnh.mobHtml}</div></div></div>${unitModNote}${vigorCondNote}${unitTurnBuffHtml}`;
renderDcWeaponArea();
_dcUpdateAdvantageEnemyTagUi();_dcUpdateZeonEnemyTagUi();
_dcUpdateSupportCounterAtkUi();
}
function _dcRefreshDcUnitAtkExOnly(){
const main=document.getElementById('dcAtkUnitAtkMain');
const sub=document.getElementById('dcAtkUnitAtkExSub');
if(!main||!sub)return;
const ud=S.dc.atkUnitData;if(!ud||ud._manual)return;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const stats=td?td[statKey]||td.stats_no_cond:[];
const uEff=_dcGetModifiedAttackerUnitStats(stats);
const atkS=uEff.unitAtk;
const exSq=_dcEffectiveExSquadAtkPct();
const atkAfterPair=_dcPilotPairUnitAtkDefPct(atkS,uEff.unitDefVal).unitAtk;
const advAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,S.dc.defNpc);
const advGrAtk=uEff.advantageFlatGrowthAtk|0;
const atkMid=_dcApplyAdvantageTagAtkToUnitAtk(_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair),advAtkPct,advGrAtk);
const atkDisp=atkMid;
const atkBonusRe=Math.max(0,atkDisp-(uEff.atkDbCorePassive|0));
const bonusEl=document.getElementById('dcAtkUnitAtkInlineBonus');
if(bonusEl)bonusEl.textContent=atkBonusRe>0?`(+${fmtN(atkBonusRe)})`:'';
const uCp=!!(ud.has_cond_stats&&S.dc.unitCondPassive);
let statsNoCp=stats;
if(ud.has_cond_stats&&td){
const kn=_dcGetUnitStatKeyForCp(false);
statsNoCp=td[kn]||stats;
}
const a=Math.round(_dcFindStat(statsNoCp,'Attack')||0),b=Math.round(_dcFindStat(stats,'Attack')||0);
const cpAtkNeg=uCp&&b<a;
main.textContent=fmtN(atkDisp);
const cPct=_dcGetCounterOwnAtkPct();
if(exSq>0){
sub.style.display='';
sub.removeAttribute('aria-hidden');
sub.className='stat-card-bonus';
sub.title='floor(base×(100+passive%+OP%+turn%+leader%+EX%+ML)/100): delta from EX% in that sum.';
sub.textContent=`+${fmtN(uEff.deltaExAtk|0)} · EX squad +${exSq}%`;
main.classList.remove('dc-stat-val--penalized');
main.classList.add('dc-stat-val--buffed');
main.title=cPct>0?'Includes EX squad ATK % and own ATK when countering (unit)':'Includes EX squad ATK %';
}else if(cPct>0){
sub.style.display='';
sub.removeAttribute('aria-hidden');
sub.className='stat-card-bonus';
sub.title='EX ability: MS Attack when countering';
sub.textContent=`+${fmtN(atkMid-atkAfterPair)} · counter +${cPct}%`;
main.classList.remove('dc-stat-val--penalized');
main.classList.add('dc-stat-val--buffed');
main.title='Includes own ATK when countering (unit)';
}else{
sub.style.display='none';
sub.setAttribute('aria-hidden','true');
sub.textContent='';
main.removeAttribute('title');
const atkAfterCounter=_dcApplyCounterOwnAtkToUnitAtk(atkAfterPair);
const utb=_dcGetDetectedUnitTurnBuffPercents(ud);
const unitTurnAtkOn=!!(S.dc.unitTurnBuffAtk&&(utb.atkPct|0)>0);
const leaderOn=(uEff.leaderPct|0)>0;
const pairOn=atkAfterPair!==atkS;
const counterOn=atkAfterCounter!==atkAfterPair;
const supOn=(_dcEffectiveSupportCounterAtkPct()|0)>0;
const advOn=(advAtkPct|0)>0&&S.dc.applyAdvantageEnemyTag!==false&&atkMid!==atkAfterCounter;
const sheetBuffMlGo=!!S.dc.masterLeagueBuff||!!S.dc.grandOffensiveBuff;
const otherBuff=sheetBuffMlGo||leaderOn||pairOn||counterOn||supOn||advOn||unitTurnAtkOn;
const cpAtkPos=uCp&&b>a;
const keepBuff=otherBuff||cpAtkPos;
if(cpAtkNeg){
main.classList.add('dc-stat-val--penalized');
main.classList.remove('dc-stat-val--buffed');
}else if(keepBuff){
main.classList.add('dc-stat-val--buffed');
main.classList.remove('dc-stat-val--penalized');
}else{
main.classList.remove('dc-stat-val--buffed');
main.classList.remove('dc-stat-val--penalized');
}
}
}
function setDcUnitStatMode(mode){S.dc.unitStatMode=mode;if(S.dc.atkUnitData&&!S.dc.atkUnitData._manual){const b=_dcPickBestWeaponIndices(S.dc.atkUnitData);S.dc.wpnIdx=b.wpnIdx;S.dc.wpnLv=b.wpnLv}renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcCharStatMode(mode){
S.dc.charStatMode=mode;
if(S.dc.atkCharData&&S.dc.atkCharData.skills&&!S.dc.atkCharData._manual){
const vis=_dcPilotSkillsVisibleForDc(S.dc.atkCharData)||[];
const visIds=new Set(vis.map(s=>String(s.id)));
if(S.dc._activeSkills)Object.keys(S.dc._activeSkills).forEach(k=>{if(!visIds.has(k))delete S.dc._activeSkills[k]});
}
renderDcAtkUnit();renderDcAtkChar();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);else onDcParamChange();
}
function setDcUnitCondPassive(on){S.dc.unitCondPassive=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcUnitTurnBuffAtk(on){S.dc.unitTurnBuffAtk=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcUnitTurnBuffDef(on){S.dc.unitTurnBuffDef=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function _dcHtmlSheetBuffToggles(){
const ml=!!S.dc.masterLeagueBuff,go=!!S.dc.grandOffensiveBuff;
const kdMl='if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleDcMasterLeagueBuff();}';
const kdGo='if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleDcGrandOffensiveBuff();}';
return`<div class="dc-sheet-buff-wrap" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
<div class="conditional-toggle dc-dc-cond-toggle" style="font-size:12px;font-weight:500"><div class="toggle-clickable${ml?' active':''}" role="button" tabindex="0" onclick="toggleDcMasterLeagueBuff()" onkeydown="${kdMl}"><span class="toggle-switch"></span><span class="toggle-label">${esc(t('dc_toggle_master_league'))}</span></div></div>
<div class="conditional-toggle dc-dc-cond-toggle" style="font-size:12px;font-weight:500"><div class="toggle-clickable${go?' active':''}" role="button" tabindex="0" onclick="toggleDcGrandOffensiveBuff()" onkeydown="${kdGo}"><span class="toggle-switch"></span><span class="toggle-label">${esc(t('dc_toggle_grand_offensive'))}</span></div></div>
<div style="font-size:10px;color:var(--text-muted);line-height:1.35">${esc(t('dc_sheet_buff_hint'))}</div>
</div>`;
}
function setDcMasterLeagueBuff(on){S.dc.masterLeagueBuff=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcGrandOffensiveBuff(on){S.dc.grandOffensiveBuff=!!on;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function toggleDcMasterLeagueBuff(){setDcMasterLeagueBuff(!S.dc.masterLeagueBuff)}
function toggleDcGrandOffensiveBuff(){setDcGrandOffensiveBuff(!S.dc.grandOffensiveBuff)}
function setDcCharCondPassive(on){S.dc.charCondPassive=!!on;if(!on)S.dc.dcSuperchargedExTier=0;else _dcSyncSuperchargedExTierForVigor();renderDcAtkUnit();renderDcAtkChar();if(S.dc.atkCharData&&!S.dc.atkCharData._manual){_dcAutoEnableMaxDamageSkills();_dcRecalcPilotBonuses(true)}const autoV=S.dc.atkCharData&&_dcShouldAutoSuperchargedVigorOnCharCp(S.dc.atkCharData);if(on&&autoV)setDcMp('super');else if(!on&&autoV)_dcAutoSetVigor();else onDcParamChange()}
function setDcSuperchargedExTier(i){const cd=S.dc.atkCharData,arr=cd&&cd.ex_supercharged_tiers;if(!arr||arr.length<2)return;const n=arr.length;S.dc.dcSuperchargedExTier=Math.max(0,Math.min(Number(i)||0,n-1));renderDcAtkUnit();renderDcAtkChar();if(S.dc.atkCharData&&!S.dc.atkCharData._manual){_dcAutoEnableMaxDamageSkills();_dcRecalcPilotBonuses(true)}else onDcParamChange()}
function toggleDcUnitCondPassive(){setDcUnitCondPassive(!S.dc.unitCondPassive)}
function toggleDcCharCondPassive(){setDcCharCondPassive(!S.dc.charCondPassive)}

function renderDcAtkChar(){
const area=document.getElementById('dcAtkCharArea');
const cd=S.dc.atkCharData;
const isSD=!!S.dc._unitIsSD;
if(!cd){area.innerHTML=isSD?`<div style="color:var(--text-muted);font-size:12px">SD unit — character locked</div>`:`<button class="dc-pick-btn" onclick="openDcPicker('character')">${t('dc_pick_char')}</button>`;_dcUpdateExSquadAtkGroupVisibility();_dcUpdateSquadConditionGroupVisibility();_dcUpdateSupportCounterAtkUi();return}
if(cd._manual){
S.dc._pilotSkills=[];
area.innerHTML=`<div class="dc-picked dc-picked--manual"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div><div style="font-size:10px;color:var(--text-muted)">Custom pilot</div></div></div>`;
area.innerHTML+=_dcHtmlSheetBuffToggles();
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
return;
}
S.dc._pilotSkills=_dcPilotSkillsVisibleForDc(cd)||[];
const stats=_dcGetCharStats();
const thum=cd.thum||cd.portrait||'';
const changeBtn=isSD?`<span class="dc-picked-change dc-picked-change--static" style="font-size:11px;color:var(--text-muted);padding:4px 8px">Locked</span>`:`<button type="button" class="dc-picked-change" onclick="openDcPicker('character')">${t('dc_change')}</button>`;
let charCpToggle='';
if(_dcCharHasConditional(cd)){
const _cpl=t('conditional_passive');
charCpToggle=`<div class="dc-picked-controls"><div class="conditional-toggle dc-dc-cond-toggle"><div class="toggle-clickable${S.dc.charCondPassive?' active':''}" role="button" tabindex="0" title="${escAttr(_cpl)}" aria-label="${escAttr(_cpl)}" onclick="toggleDcCharCondPassive()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDcCharCondPassive()}"><span class="toggle-label toggle-label--cp-chip">${_dcCpChipSpanHtml(!!S.dc.charCondPassive)}</span></div></div></div>`;
}
let charExTierRow='';
if(_dcCharHasConditional(cd)&&S.dc.charCondPassive&&cd.ex_supercharged_tiers&&cd.ex_supercharged_tiers.length>1){
const tiers=cd.ex_supercharged_tiers;
const ti=Math.min(Math.max(0,S.dc.dcSuperchargedExTier|0),tiers.length-1);
charExTierRow=`<div class="dc-atk-char-ex-tier dc-lb-row" role="group" aria-label="Supercharged EX tier">`+tiers.map((et,idx)=>`<button type="button" class="dc-lb-btn${idx===ti?' active':''}" style="font-size:11px;line-height:1.25;flex:1 1 auto;min-width:min(100%,8rem);white-space:normal;text-align:center;padding:6px 8px" onclick="setDcSuperchargedExTier(${idx})">${esc(et.label||('EX '+et.tier))}</button>`).join('')+`</div>`;
}
const hasSpChar=cd.has_sp!==undefined?cd.has_sp:(parseInt(cd.rarity_id||'5')<=4);
let charStatModeHtml='';
if(hasSpChar){
const cModeRow=S.dc.charStatMode||'normal';
charStatModeHtml=`<div class="dc-lb-row dc-char-stat-mode-row"><button type="button" class="dc-lb-btn${cModeRow==='normal'?' active':''}" onclick="setDcCharStatMode('normal')">Normal</button><button type="button" class="dc-lb-btn${cModeRow==='sp'?' active':''}" onclick="setDcCharStatMode('sp')">SP</button></div>`;
}
const charBelowPortrait=(charCpToggle||charStatModeHtml)?`<div class="dc-atk-char-below-portrait">${charCpToggle}${charStatModeHtml}</div>`:'';
area.innerHTML=`<div class="dc-atk-char-wrap"><div class="dc-picked"><img class="dc-thum" src="${imgUrl(thum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(cd.name)}</div><div class="dc-picked-badges">${cd.rarity_icon?`<img src="${imgUrl(cd.rarity_icon)}">`:''}${cd.role_icon?`<img src="${imgUrl(cd.role_icon)}">`:''}</div></div>${charBelowPortrait}${changeBtn}</div>${charExTierRow}</div>`;
const statsNoCp=_dcGetCharStatsForCp(false);
const skPct=_dcGetActiveSkillStatPct();
const skB=_dcGetActiveSkillBonuses();
const r0=_dcPilotSkillAdjustedStat(stats,'Ranged',skPct.Ranged||0),m0=_dcPilotSkillAdjustedStat(stats,'Melee',skPct.Melee||0),a0=_dcPilotAwakenAdjustedForDc(stats,skPct.Awaken||0);
const defPctSk=skB.defPct||0;
const d0=defPctSk?_dcPilotSkillAdjustedStat(stats,'Defense',defPctSk):_dcFindStat(stats,'Defense'),re0=_dcFindStat(stats,'Reaction');
const r=r0,m=m0,a=a0,d=d0,re=re0;
const sa=document.getElementById('dcAtkStatsArea');
const cMode=S.dc.charStatMode||'normal';
const cCp=!!(_dcCharHasConditional(cd)&&S.dc.charCondPassive);
function _cCpCell(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?' dc-stat-mini--cp':' dc-stat-mini--cp-penalty'}
function _skillCell(nm){if(nm==='Defense'&&defPctSk>0)return' dc-stat-mini--skill';if(['Ranged','Melee','Awaken'].includes(nm)&&(skPct[nm]||0)>0)return' dc-stat-mini--skill';return''}
function _cCpValBuff(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);if(a===b)return'';return b>a?'dc-stat-val--buffed':'dc-stat-val--penalized'}
function _cCpBonusHtml(nm){if(!cCp)return'';const a=Math.round(_dcFindStat(statsNoCp,nm)||0),b=Math.round(_dcFindStat(stats,nm)||0);const d=b-a;if(d===0)return'';const tipUp='Conditional passive — extra growth stat vs off (pilot row; main number may include skills).';const tipDn='Conditional passive — stat change vs off (pilot row; main number may include skills).';if(d>0)return`<div class="stat-card-bonus" style="margin-top:2px" title="${escAttr(tipUp)}">(+${fmtN(d)})</div>`;return`<div class="stat-card-bonus stat-card-penalty" style="margin-top:2px" title="${escAttr(tipDn)}">(${fmtN(d)})</div>`}
function _skillValBuff(nm){if(nm==='Defense'&&defPctSk>0)return'dc-stat-val--buffed';if(['Ranged','Melee','Awaken'].includes(nm)&&(skPct[nm]||0)>0)return'dc-stat-val--buffed';return''}
function _charStatValCls(nm){const a=_cCpValBuff(nm),b=_skillValBuff(nm);return a&&b?a+' '+b:(a||b||'')}
function _charStatValSpan(nm,val){const cls=_charStatValCls(nm);return`<span${cls?` class="${cls}"`:''}>${fmtN(val)}</span>`}
function _dcCharPassiveBonusLine(nm,displayedTotal){
const ent=_dcFindStatEntry(stats,nm);
if(!ent)return'';
const base=Math.max(0,Number(ent.base)||0);
const disp=Math.round(Number(displayedTotal)||0);
const bonusFromBase=Math.max(0,disp-base);
if(bonusFromBase<=0)return'';
const pAtk=['Ranged','Melee','Awaken'].includes(nm)?(skPct[nm]||0):0;
const pDef=nm==='Defense'?(defPctSk||0):0;
const hasSkill=(['Ranged','Melee','Awaken'].includes(nm)&&pAtk>0)||(nm==='Defense'&&pDef>0);
const tip=hasSkill?'Bonus over growth base: passive trait % plus active skill % (included in total above)':'Passive ability bonus (included in the total above)';
return`<div class="stat-card-bonus" title="${escAttr(tip)}">+${fmtN(bonusFromBase)}</div>`;
}
const cVis=`stats-grid dc-atk-ers dc-stat-visual--${cMode} dc-stat-grid-5`;
const bonLn=(nm,v)=>_dcCharPassiveBonusLine(nm,v);
sa.innerHTML=(sa.innerHTML||'')+`<div class="dc-section-label" style="margin-top:8px">${t('dc_char_stats')}</div><div class="${cVis}"><div class="stat-card${_cCpCell('Ranged')}${_skillCell('Ranged')}"><div class="stat-card-label">${t('col_ranged')}</div><div class="stat-card-value">${_charStatValSpan('Ranged',r)}${bonLn('Ranged',r)}${_cCpBonusHtml('Ranged')}</div></div><div class="stat-card${_cCpCell('Melee')}${_skillCell('Melee')}"><div class="stat-card-label">${t('col_melee')}</div><div class="stat-card-value">${_charStatValSpan('Melee',m)}${bonLn('Melee',m)}${_cCpBonusHtml('Melee')}</div></div><div class="stat-card${_cCpCell('Awaken')}${_skillCell('Awaken')}"><div class="stat-card-label">${t('col_awaken')}</div><div class="stat-card-value">${_charStatValSpan('Awaken',a)}${bonLn('Awaken',a)}${_cCpBonusHtml('Awaken')}</div></div><div class="stat-card${_cCpCell('Defense')}${_skillCell('Defense')}"><div class="stat-card-label">${t('col_defense')}</div><div class="stat-card-value">${_charStatValSpan('Defense',d)}${bonLn('Defense',d)}${_cCpBonusHtml('Defense')}</div></div><div class="stat-card${_cCpCell('Reaction')}"><div class="stat-card-label">${t('col_reaction')}</div><div class="stat-card-value">${_charStatValSpan('Reaction',re)}${bonLn('Reaction',re)}${_cCpBonusHtml('Reaction')}</div></div></div>`;
area.innerHTML+=_dcHtmlSheetBuffToggles();
_dcRenderPilotBonuses(area,cd);
_dcRenderPilotSkills(area,cd);
const supCntPilotPct=!cd._manual?_dcParseMaxSupportCounterAtkPctFromChar(cd,S.dc.atkUnitData):0;
if(supCntPilotPct>0){area.insertAdjacentHTML('beforeend',`<div class="dc-support-counter-pilot-note" id="dcAtkSupportCounterPilotNote">${t('dc_support_counter_pilot_note').replace('{pct}',String(supCntPilotPct))}</div>`)}
/* Full refresh so weapon Crit Damage traits are never dropped after vigor/EX re-renders. */
_dcRecalcPilotBonuses(true);
_dcUpdateExSquadAtkGroupVisibility();
_dcUpdateSquadConditionGroupVisibility();
_dcUpdateSupportCounterAtkUi();
}

/** True when ability text (line + neighbors + name) indicates the bonus applies only with pilot SP stats (Normal/SP toggle). */
function _dcSpGateHint(block){
const s=String(block||'');
if(!s.trim())return false;
if(/SP\s*enhancement|SP[- ]?enhanced|SP\s+stats?\s*(?:\(|is|are|[:.;])|SP\s+pilot|pilot\s+SP|SP\s+is\s+enhanced|SP\s+stat\s+(?:enhance|boost|buff)/i.test(s))return true;
if(/(?:after|upon|with)\s+SP\s+(?:enhancement|stats?)/i.test(s))return true;
if(/SP\s*強化|ＳＰ/.test(s))return true;
if(/\(\s*SP\s*\)/i.test(s))return true;
return false;
}
function _dcPilotAbilitySpCharGateContext(ab,lineIndex,lineText){
const t=String(lineText||'');
const lines=ab.details||[];
const prev=lineIndex>0?String(lines[lineIndex-1].text||'').replace(/\n/g,' '):'';
const next=lineIndex<lines.length-1?String(lines[lineIndex+1].text||'').replace(/\n/g,' '):'';
const name=String(ab.name||'');
return _dcSpGateHint([t,prev,next,name].join('\n'));
}

/** Match get_character / unit detail: SP pilot stats use SpAbilityId replacement when toggled. */
function _dcResolveCharAbilityForMode(ab){
if(!ab)return null;
if((S.dc.charStatMode||'normal')==='sp'&&ab.sp_replacement)return ab.sp_replacement;
return ab;
}
/** Match get_unit ep() + detail UI: SSP uses ssp_replacement; ssp_only rows apply only in SSP mode. */
function _dcResolveUnitAbilityForMode(ab){
if(!ab)return null;
const um=S.dc.unitStatMode||'normal';
if(ab.ssp_only)return um==='ssp'?ab:null;
if(um==='ssp'&&ab.ssp_replacement)return ab.ssp_replacement;
return ab;
}

/** MS ability: pilot Awaken below 900 is raised to 900; active Awaken% skills still use growth base (see _dcPilotAwakenAdjustedForDc). */
function _dcUnitAbilityTextIsAwakenFloor900(txt){
const s=String(txt||'').replace(/\r\n/g,'\n').replace(/\n/g,' ');
if(/Awaken\s+of\s+less\s+than\s+900/i.test(s)&&/Awaken\s+to\s+900/i.test(s))return true;
if(/覺醒值未滿\s*900/.test(s)&&/提升至\s*900/.test(s))return true;
if(/覚醒値が\s*900\s*未満/.test(s)&&/900/.test(s)&&/上昇|向上|する/.test(s))return true;
return false;
}
function _dcResolvedUnitAbilityGrantsAwakenFloor900(resolved){
if(!resolved)return false;
const aid=String(resolved.id||'');
if(aid==='1015102')return true;
for(let i=0;i<(resolved.details||[]).length;i++){
const ln=resolved.details[i];
const t=(ln&&ln.text)||'';
if(_dcUnitAbilityTextIsAwakenFloor900(t))return true;
}
return false;
}
function _dcUnitGrantsPilotAwakenFloor900(ud){
if(!ud||ud._manual||!Array.isArray(ud.abilities))return false;
for(let i=0;i<ud.abilities.length;i++){
const r=_dcResolveUnitAbilityForMode(ud.abilities[i]);
if(_dcResolvedUnitAbilityGrantsAwakenFloor900(r))return true;
}
return false;
}

/** Single condition from API (unit_tags OR across a group; AND across groups). */
function _dcMatchOneCondition(c,ud,cd){
const id=String(c&&c.id);
const src=String(c.source||'');
const typ=String(c.type||'');
const ut=new Set((ud&&ud.tags||[]).map(t=>String(t&&t.id)));
const usr=new Set((ud&&ud.series||[]).map(s=>String(s&&s.id)));
const ct=new Set((cd&&cd.tags||[]).map(t=>String(t&&t.id)));
const csr=new Set((cd&&cd.series||[]).map(s=>String(s&&s.id)));
if(src==='unit_ids')return !!(ud&&String(ud.id)===id);
if(src==='character_ids')return !!(cd&&String(cd.id)===id);
if(src==='character_series')return !!(cd&&csr.has(id));
if(src==='char_tags'||typ==='character')return !!(cd&&ct.has(id));
if(src==='unit_tags'||src==='group_tags')return !!(ud&&ut.has(id));
if(typ==='unit')return !!(ud&&ut.has(id));
if(typ==='series'&&src)return src==='character_series'?!!(cd&&csr.has(id)):!!(ud&&usr.has(id));
if(src==='series'||typ==='series')return !!(ud&&usr.has(id));
if(typ==='unit_role'||src==='types'){
const rid=String(id||'').replace(/^role_/,'');
return !!(ud&&String(ud.role_id||'')===rid);
}
return false;
}
/** One group: multiple unit_tags / group_tags = OR (in-game); other sources AND together. */
function _dcConditionGroupMatches(ud,cd,grp){
const conds=grp.conditions||[];
if(!conds.length)return true;
const tagConds=conds.filter(c=>{
const src=String(c&&c.source||'');
return src==='unit_tags'||src==='group_tags';
});
const other=conds.filter(c=>!tagConds.includes(c));
const tagPart=!tagConds.length||tagConds.some(c=>_dcMatchOneCondition(c,ud,cd));
const otherPart=!other.length||other.every(c=>_dcMatchOneCondition(c,ud,cd));
return tagPart&&otherPart;
}
function _dcAbilityCondContextMeetsGroups(ud,cd,condGroups){
if(!condGroups||!condGroups.length)return true;
return condGroups.every(grp=>_dcConditionGroupMatches(ud,cd,grp));
}
function _dcUnitMeetsAbilityConditionGroups(ud,condGroups){
return _dcAbilityCondContextMeetsGroups(ud,null,condGroups);
}
function _dcCharIsAttackRole(cd){return String(cd&&cd.role_id||'')==='1'}
function _dcCharIsSupportRole(cd){return String(cd&&cd.role_id||'')==='3'}
/** Trait / ability blob mentions Support Attack or Support Counter context (EN/JA/TW). */
function _dcAbilityBlobMentionsSupportCounter(s){
const t=String(s||'');
if(!t.trim())return false;
const low=t.toLowerCase();
if(low.includes('support attack/counter'))return true;
if(/when executing a counter or support counter/i.test(low))return true;
if(/support counter/i.test(low)&&/support attack/i.test(low))return true;
if(/支援攻撃|支援反撃/.test(t))return true;
if(/支援攻擊|支援反擊/.test(t))return true;
if(/「支援攻[擊撃][／/]反[擊撃]」/.test(t))return true;
return false;
}
/** Max ATK % from lines in blob that belong to Support Attack/Counter passives (parsed from localized trait text). */
function _dcExtractSupportCounterAtkPctFromBlob(blob){
const s=String(blob||'');
let max=0;
const tryN=(m)=>{if(m){const v=parseInt(m[1],10);if(Number.isFinite(v)&&v>max)max=v}};
let m;
m=s.match(/(?:increase|Increases)\s+own\s+ATK\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/(?:increase|Increases)\s+ATK\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/increase\s+own\s+atk\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/increase\s+atk\s+by\s+(\d+)%/i);tryN(m);
m=s.match(/攻撃力が(\d+)%上昇/);tryN(m);
m=s.match(/攻擊力提升(\d+)%/);tryN(m);
m=s.match(/攻擊力提昇(\d+)%/);tryN(m);
return max;
}
function _dcParseMaxSupportCounterAtkPctFromChar(cd,ud){
if(!cd||cd._manual)return 0;
const unitRef=ud||S.dc.atkUnitData;
let max=0;
(cd.abilities||[]).forEach(ab=>{
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return;
let abMax=0;
(r.details||[]).forEach(ln=>{
const tx=typeof ln==='string'?ln:(ln&&ln.text)||'';
if(!tx||!_dcAbilityBlobMentionsSupportCounter(tx))return;
const condGroups=(ln&&ln.condition_groups)||[];
if(condGroups.length&&!_dcAbilityCondContextMeetsGroups(unitRef,cd,condGroups))return;
const p=_dcExtractSupportCounterAtkPctFromBlob(tx);
if(p>abMax)abMax=p;
});
if(abMax<=0&&_dcCharIsSupportRole(cd)){
const blob=(r.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join('\n');
if(_dcAbilityBlobMentionsSupportCounter(blob))abMax=_dcExtractSupportCounterAtkPctFromBlob(blob);
}
if(abMax>max)max=abMax;
});
return max;
}
function _dcSupportCntEligiblePairSnap(cd,ud){
if(!cd||cd._manual||!ud||ud._manual||String(ud.role_id)!=='3')return '';
const rawPct=_dcParseMaxSupportCounterAtkPctFromChar(cd,ud)|0;
if(rawPct<=0)return '';
return `${String(cd.id||'')}|${String(ud.id||'')}|${rawPct}`;
}
function _dcEffectiveSupportCounterAtkPctFromCtx(ctx){
const c=ctx||{};
if(!c.supportCounterAtk)return 0;
const cd=c.atkCharData,ud=c.atkUnitData;
if(!cd||cd._manual||!ud||ud._manual||String(ud.role_id)!=='3')return 0;
const stored=c._supportCounterAtkPct|0;
if(stored>0)return stored;
return _dcParseMaxSupportCounterAtkPctFromChar(cd,ud)|0;
}
function _dcEffectiveSupportCounterAtkPct(){return _dcEffectiveSupportCounterAtkPctFromCtx(S.dc);}
/** Legacy post-multiply path — support-counter % now stacks in the same growth % bucket as OP/leader/squad (matches in-game unit panel). */
function _dcApplySupportCounterAtkToUnitAtk(unitAtk){return unitAtk;}

function _dcParsePilotAbilBonuses(cd){
const b={dmgDealt:0,critDmg:0,dmgTaken:0,atkPct:0,items:[]};
const ud=S.dc.atkUnitData;
function parseFromResolved(resolved,src){
if(!resolved)return;
const dispName=resolved.display_name||resolved.name||'';
const lines=(resolved.details||[]);
let awakenFloorAdded=false;
lines.forEach((ln,li)=>{
const txt=(ln.text||'').replace(/\n/g,' ');
const condGroups=ln.condition_groups||[];
const hasCond=condGroups.length>0;
let condMet=false;
if(hasCond)condMet=_dcAbilityCondContextMeetsGroups(ud,cd,condGroups);
else if(_dcAbilityLineIsSuperchargedExSection(txt)&&S.dc.charCondPassive&&_dcNormMpLevel(S.dc.mpLevel)==='super')condMet=true;
const isUnmet=hasCond&&!condMet;
const spCharGate=src==='char'&&_dcPilotAbilitySpCharGateContext(resolved,li,txt);
let m;
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?damage\s+dealt(?:\s+to\s+(?:the\s+)?enem(?:y|ies))?\s+(?:with\s+.+?\s+)?by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身(?:物理武裝|光束武裝|特殊武裝)?造成的損傷提升(\d+)%/);
if(!m&&_dcIsZhCalcLang())m=txt.match(/對敵方造成的損傷提升(\d+)%/);
if(m){
const v=parseInt(m[1],10);
const attackRoleBlock=src==='char'&&!_dcCharIsAttackRole(cd)&&!hasCond;
const effectiveUnmet=isUnmet||attackRoleBlock;
b.dmgDealt+=effectiveUnmet?0:v;
b.items.push({label:`Damage Dealt +${v}%`,val:v,key:'dmgDealt',cond:effectiveUnmet,autoMet:hasCond&&condMet&&!attackRoleBlock,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!effectiveUnmet&&!spCharGate,locked:attackRoleBlock,attackRoleOnly:attackRoleBlock})
}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?(?:MS\s+)?(?:ATK|Attack)\s+and\s+[Cc]ritical\s+[Dd]amage\s+by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身攻擊力及爆擊損傷提升(\d+)%/);
if(!m&&_dcIsJaCalcLang())m=txt.match(/自身の攻撃力とクリティカルダメージが(\d+)%上昇/);
if(m){const v=parseInt(m[1],10);b.critDmg+=isUnmet?0:v;b.items.push({label:`Critical Damage +${v}% (MS ATK +${v}% on growth line)`,val:v,key:'critDmg',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
/* Require "damage" — must not match Boost Critical / unit "Critical Rate by N%". */
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?[Cc]ritical\s+[Dd]amage(?:\s+dealt)?\s+by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身爆擊損傷提升(\d+)%/);
if(m){const v=parseInt(m[1],10);b.critDmg+=isUnmet?0:v;b.items.push({label:`Critical Damage +${v}%`,val:v,key:'critDmg',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
m=txt.match(/[Rr]educe\s+(?:own\s+)?damage\s+taken\s+by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身受到的損傷減輕(\d+)%/);
if(m){const v=parseInt(m[1],10);b.dmgTaken+=isUnmet?0:v;b.items.push({label:`Damage Taken -${v}%`,val:v,key:'dmgTaken',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate})}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?MP\s+by\s+(\d+)/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身MP增加(\d+)/);
if(m){const v=parseInt(m[1],10);b.items.push({label:`MP +${v} (starting vigor)`,val:v,key:'mpBonus',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,spCharGate,src,alwaysActive:!hasCond&&!isUnmet&&!spCharGate,locked:true})}
m=txt.match(/[Ii]ncrease\s+(?:own\s+)?(?:Ranged|Melee|Awaken)\s+(?:and\s+(?:Ranged|Melee|Awaken)\s+)?by\s+(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%/);
if(m){const v=parseInt(m[m.length-1],10);b.atkPct+=isUnmet?0:v;b.items.push({label:`Attack Stat +${v}%`,val:v,key:'atkPct',cond:isUnmet,autoMet:hasCond&&condMet,name:dispName,abilityHasCond:hasCond,locked:true,src})}
if(src==='unit'&&!awakenFloorAdded&&_dcUnitAbilityTextIsAwakenFloor900(txt)){
awakenFloorAdded=true;
const st=_dcGetCharStats();
const entAw=_dcFindStatEntry(st,'Awaken');
const pt=entAw?Math.round(Number(entAw.total)||0):9999;
const applies=!isUnmet&&pt<900;
b.items.push({label:'Pilot Awaken minimum 900 (MS ability)',key:'awakenFloor900',cond:!applies,autoMet:applies,name:dispName,src:'unit',locked:true,abilityHasCond:hasCond,alwaysActive:applies});
}
});
}
if(cd&&cd.abilities){
cd.abilities.forEach(ab=>parseFromResolved(_dcResolveCharAbilityForMode(ab),'char'));
}
if(ud&&ud.abilities&&!ud._manual){
ud.abilities.forEach(ab=>parseFromResolved(_dcResolveUnitAbilityForMode(ab),'unit'));
}
return b;
}
/** Skills shown in DC: normal rows always; SP-only rows only when pilot SP mode is on and the id is not already used as replaced_by_sp_id (avoid duplicate checkbox). */
function _dcPilotSkillsVisibleForDc(cd){
if(!cd||!Array.isArray(cd.skills)||!cd.skills.length)return[];
const spOn=(S.dc.charStatMode||'normal')==='sp';
const hasSp=cd.has_sp!==undefined?!!cd.has_sp:(parseInt(String(cd.rarity_id||'5'),10)<=4);
const replaced=new Set();
cd.skills.forEach(sk=>{
const rid=sk&&sk.replaced_by_sp_id;
if(rid!=null&&String(rid)!==''&&String(rid)!=='0')replaced.add(String(rid));
});
return cd.skills.filter(sk=>{
if(!sk)return false;
if(sk.is_sp){
if(!hasSp||!spOn)return false;
if(replaced.has(String(sk.id)))return false;
return true;
}
return true;
});
}
function _dcRenderPilotBonuses(area,cd){
const b=_dcParsePilotAbilBonuses(cd);
S.dc._pilotBonuses=b;
if(!b.items.length)return;
let h=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Passive Bonuses</div><div class="dc-pilot-bonus-list">`;
b.items.forEach((it,i)=>{
const condTag=it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">${it.attackRoleOnly?'(Attack-role pilots only)':'(Conditional)'}</span>`:it.autoMet?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--match">(Tag Matched)</span>`:'';
let inclTag=it.key==='atkPct'&&!it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Included in pilot stats)</span>`:(it.key==='atkPct'&&it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">(Not in stats — tags unmet)</span>`:'');
if(it.key==='awakenFloor900')inclTag=!it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Included in pilot stats)</span>`:` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">(Pilot Awaken ≥ 900)</span>`;
if(it.key==='mpBonus')inclTag=!it.cond?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Included in auto vigor)</span>`:` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--cond">(Tags unmet)</span>`;
const alwaysTag=it.alwaysActive?` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--incl">(Always active)</span>`:'';
const spTag=` <span class="dc-pilot-bonus-tag dc-pilot-bonus-tag--match">(SP pilot stats)</span>`;
if(it.key==='atkPct'||it.locked){
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked${it.cond?' dc-pilot-bonus--off':''}"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}${inclTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
if(it.spCharGate){
const spOn=(S.dc.charStatMode||'normal')==='sp';
const off=!spOn||it.cond;
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked${off?' dc-pilot-bonus--off':''}"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}${spTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
if(it.alwaysActive){
h+=`<div class="dc-pilot-bonus-row dc-pilot-bonus--locked"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${alwaysTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></div>`;
return;
}
const togId=`dcPilotBonusChk_${i}`;
const checked=!it.cond;
const rowOff=!!it.cond;
h+=`<label class="dc-pilot-bonus-row${rowOff?' dc-pilot-bonus--off':''}"><input type="checkbox" id="${togId}" ${checked?'checked':''} onchange="_dcRecalcPilotBonuses(true)"><span class="dc-pilot-bonus-line"><span class="dc-pilot-bonus-main">${esc(it.label)}${condTag}</span><span class="dc-pilot-bonus-detail">${esc(it.name)}</span></span></label>`;
});
h+=`</div>`;
area.innerHTML+=h;
}
/** fullRefresh: recompute Damage Dealt Up / Crit Dmg Up from pilot toggles, skills, and current weapon crit trait. Otherwise only swap the weapon crit trait portion of Crit Dmg Up so manual fields persist when changing weapon/form on the same unit. */
function _dcRecalcPilotBonuses(fullRefresh){
const wCrit=S.dc._wpnCritDmgUp|0;
if(!fullRefresh){
const ci=document.getElementById('dcCritDmgUp');
const prevN=S.dc._integratedWpnCritDmgUp|0;
const cur=parseInt(ci?.value,10)||0;
const newV=Math.max(0,cur-prevN+wCrit);
if(ci)ci.value=String(newV);
S.dc._integratedWpnCritDmgUp=wCrit;
onDcParamChange();
return;
}
const b=S.dc._pilotBonuses||{items:[]};
let dmgDealt=0,critDmg=0;
b.items.forEach((it,i)=>{
if(it.key==='atkPct')return;
if(it.spCharGate){
if(it.cond)return;
if((S.dc.charStatMode||'normal')!=='sp')return;
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
if(it.alwaysActive){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
return;
}
const chk=document.getElementById(`dcPilotBonusChk_${i}`);
if(chk&&chk.checked){
if(it.key==='dmgDealt')dmgDealt+=it.val;
if(it.key==='critDmg')critDmg+=it.val;
}
});
const skB=_dcGetActiveSkillBonuses();
dmgDealt+=skB.dmgDealt;
/** Vigor dmg % is only in calculateDamage (vigorDmgBonusPct); adding DC_MP here double-counts. */
const di=document.getElementById('dcDmgIncrease');
const ci=document.getElementById('dcCritDmgUp');
if(di)di.value=dmgDealt;
if(ci)ci.value=critDmg+wCrit;
S.dc._integratedWpnCritDmgUp=wCrit;
S.dc._pilotDmgCritExplicit=true;
onDcParamChange();
}
function _dcRenderPilotSkills(area,cd){
if(!cd||!cd.skills||!cd.skills.length)return;
const skillsList=_dcPilotSkillsVisibleForDc(cd)||[];
S.dc._pilotSkills=skillsList;
if(!skillsList.length)return;
S.dc._activeSkills=S.dc._activeSkills||{};
let h=`<div class="dc-section-label" style="margin-top:10px;color:var(--accent-cyan)">Skills</div><div style="font-size:12px;line-height:1.6">`;
skillsList.forEach((sk,i)=>{
const dsk=_dcResolveSkillForDcMode(sk);
const desc=((dsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ')||dsk.desc||'').replace(/\n/g,' ');
const togId=`dcSkillChk_${i}`;
const isOn=!!S.dc._activeSkills[sk.id];
h+=`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px">`;
h+=`<input type="checkbox" id="${togId}" ${isOn?'checked':''} onchange="_dcToggleSkill('${sk.id}',${i})">`;
if(dsk.icon)h+=`<img src="${imgUrl(dsk.icon)}" style="width:20px;height:20px;border-radius:3px" onerror="this.style.display='none'">`;
h+=`<span style="font-weight:600">${esc(dsk.name||sk.name)}</span>`;
if(desc)h+=`<span class="dc-pilot-skill-desc" style="margin-left:4px">${esc(desc.substring(0,60))}${desc.length>60?'...':''}</span>`;
h+=`</label>`;
});
h+=`</div>`;
area.innerHTML+=h;
}
function _dcToggleSkill(skillId,idx){
const chk=document.getElementById(`dcSkillChk_${idx}`);
if(!S.dc._activeSkills)S.dc._activeSkills={};
if(chk&&chk.checked){S.dc._activeSkills[skillId]=true}else{delete S.dc._activeSkills[skillId]}
renderDcAtkUnit();
renderDcAtkChar();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
}
/** When pilot SP stat mode is on, active skills use SpCharacterSkillId text (e.g. Melee Boost Lv3 +15%) instead of the normal row. */
function _dcResolveSkillForDcMode(sk){
const cd=S.dc.atkCharData;
if(!sk)return sk;
if((S.dc.charStatMode||'normal')==='sp'&&sk.replaced_by_sp_id&&cd&&Array.isArray(cd.skills)){
const sp=cd.skills.find(x=>String(x.id)===String(sk.replaced_by_sp_id));
if(sp)return sp;
}
return sk;
}
function _dcGetActiveSkillBonuses(){
const b={defPct:0,mobPct:0,dmgDealt:0};
if(!S.dc._pilotSkills||!S.dc._activeSkills)return b;
S.dc._pilotSkills.forEach(sk=>{
if(!S.dc._activeSkills[sk.id])return;
const rsk=_dcResolveSkillForDcMode(sk);
const detailLines=(rsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ');
const desc=[detailLines,rsk.desc||'',rsk.sp_desc||''].filter(Boolean).join(' ');
let m;
m=desc.match(/[Ii]ncrease(?:s)?\s+(?:own\s+)?damage\s+dealt\s+(?:to\s+(?:the\s+)?enem(?:y|ies)\s+)?(?:with\s+.+?\s+)?by\s*(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=desc.match(/對敵方造成的損傷提升(\d+)%/);
if(m)b.dmgDealt+=parseInt(m[1],10);
m=desc.match(/[Ii]ncreases?\s+(?:own\s+)?DEF(?:ense)?\s+by\s*(\d+)%/i);
if(!m&&_dcIsZhCalcLang())m=desc.match(/自身防禦力提升(\d+)%/);
if(m)b.defPct+=parseInt(m[1],10);
});
return b;
}

function _dcFindStat(stats,name){
if(!stats)return 0;
if(Array.isArray(stats)){const s=stats.find(s=>s.name===name);return s?s.total:0}
return stats[name]||0;
}
function _dcFindStatEntry(stats,name){
if(!stats||!Array.isArray(stats))return null;
const s=stats.find(x=>x.name===name);
if(!s)return null;
const total=Number(s.total);
const bonus=s.bonus!=null?Number(s.bonus):0;
const base=s.base!=null?Number(s.base):NaN;
const tp=s.trait_pct;
const traitPct=(tp!=null&&Number.isFinite(Number(tp)))?Number(tp):null;
const pp=s.passive_pct;
const passivePct=(pp!=null&&pp!==''&&Number.isFinite(Number(pp)))?Number(pp):null;
const baseOk=Number.isFinite(base);
const totOk=Number.isFinite(total);
const bonOk=Number.isFinite(bonus)&&bonus>0;
let b0=baseOk?base:(totOk&&bonOk?total-bonus:total);
if(!Number.isFinite(b0))b0=totOk?total:0;
return{name,total:totOk?total:0,bonus:bonOk?bonus:0,base:Number.isFinite(b0)?b0:0,trait_pct:traitPct,passive_pct:passivePct};
}
/** Passive % for unit sheet stats (API passive_pct or infer from floor(base×p/100)===bonus). */
function _dcStatPassivePctFromEntry(ent){
const F=Math.floor;
if(!ent)return 0;
if(ent.name==='Move'||ent.name==='MOV'||ent.name==='Movement'){
if(ent.passive_pct!=null&&Number.isFinite(ent.passive_pct))return Math.max(0,ent.passive_pct);
return 0;
}
if(ent.passive_pct!=null&&Number.isFinite(ent.passive_pct))return Math.max(0,ent.passive_pct);
const b0=F(Math.max(0,ent.base||0)),bon=F(Math.max(0,ent.bonus||0));
if(b0>0&&bon>0){for(let p=0;p<=500;p++){if(F(b0*p/100)===bon)return p}}
return 0;
}
/** Active pilot skill % on growth base: in-game uses floor on base×skill% (e.g. Ranged 713 +25% → +178, total 1033 not 1034). */
function _dcPilotActiveSkillPctBonus(base,pct){
const b=Math.max(0,Number(base)||0);
const p=Math.max(0,Number(pct)||0);
if(b<=0||p<=0)return 0;
return Math.floor(b*p/100);
}
/** Pilot skills: passive total (API — trait% on growth base) + floor(base×skill%/100) for active skills. Passive and skill % are computed separately, not one combined floor on (trait+skill). */
function _dcPilotSkillAdjustedStat(stats,statName,pct){
const p=Math.max(0,Number(pct)||0);
const ent=_dcFindStatEntry(stats,statName);
if(!ent)return Math.floor(_dcFindStat(stats,statName)*(1+p/100));
if(p<=0)return Math.round(Number(ent.total)||0);
const base=Math.max(0,Number(ent.base)||0);
const passiveTotal=Math.round(Number(ent.total)||0);
return passiveTotal+_dcPilotActiveSkillPctBonus(base,p);
}
/** When an MS sets pilot Awaken to 900 if below 900, use 900 + floor(base×skill%) instead of passiveTotal + floor(base×skill%). */
function _dcPilotAwakenAdjustedForDc(stats,skPctAwaken){
const ud=S.dc.atkUnitData;
const p=Math.max(0,Number(skPctAwaken)||0);
const ent=_dcFindStatEntry(stats,'Awaken');
if(!ent)return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
if(!_dcUnitGrantsPilotAwakenFloor900(ud))return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
const base=Math.max(0,Number(ent.base)||0);
const passiveTotal=Math.round(Number(ent.total)||0);
if(passiveTotal>=900)return _dcPilotSkillAdjustedStat(stats,'Awaken',p);
return 900+(p>0?_dcPilotActiveSkillPctBonus(base,p):0);
}

const VIGOR_LEVEL_ORDER={normal:0,medium:0,high:1,max:2,super:3,supercharged:3};
const DC_MP_THRESHOLDS=[{min:0,level:'medium'},{min:5,level:'high'},{min:12,level:'max'},{min:18,level:'super'}];
function _dcAccumMpBonusFromResolved(resolved,ud,cd){
if(!resolved)return 0;
let totalMp=0;
(resolved.details||[]).forEach(ln=>{
const txt=(ln.text||'').replace(/\n/g,' ');
let m=txt.match(/[Ii]ncrease\s+(?:own\s+)?MP\s+by\s+(\d+)/i);
if(!m&&_dcIsZhCalcLang())m=txt.match(/自身MP增加(\d+)/);
if(!m)return;
const v=parseInt(m[1],10);
const condGroups=ln.condition_groups||[];
const hasCond=condGroups.length>0;
const condMet=!hasCond||_dcAbilityCondContextMeetsGroups(ud,cd,condGroups);
if(condMet)totalMp+=v;
});
return totalMp;
}
function _dcCalcStartingVigor(){
const cd=S.dc.atkCharData;const ud=S.dc.atkUnitData;
if(!cd&&!ud)return 'medium';
let totalMp=0;
if(cd&&cd.abilities){
cd.abilities.forEach(ab=>{
totalMp+=_dcAccumMpBonusFromResolved(_dcResolveCharAbilityForMode(ab),ud,cd);
});
}
if(ud&&ud.abilities&&!ud._manual){
ud.abilities.forEach(ab=>{
totalMp+=_dcAccumMpBonusFromResolved(_dcResolveUnitAbilityForMode(ab),ud,cd);
});
}
let level='medium';
for(const t of DC_MP_THRESHOLDS){if(totalMp>=t.min)level=t.level}
return level;
}
function _dcAutoSetVigor(){
const lv=_dcCalcStartingVigor();
S.dc._autoVigor=lv;
setDcMp(lv);
const hint=document.getElementById('dcVigorAutoHint');
if(hint){
const MP_LABEL={medium:'Normal',high:'High',max:'Max',super:'Supercharged'};
if(lv!=='medium')hint.textContent=`(Auto: ${MP_LABEL[lv]||lv} from character MP bonus)`;
else hint.textContent='';
}
}
function _dcParseRangeModifiers(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
if(!cd||!ud)return[];
const unitName=(ud.name||'').toLowerCase();
const unitBare=(ud.name||'').replace(/\s*\(EX\)\s*/gi,'').trim().toLowerCase();
const mods=[];
const sources=[];
(cd.skills||[]).forEach(sk=>{
if(sk.is_sp)return;
const rsk=_dcResolveSkillForDcMode(sk);
if(rsk.desc)sources.push(rsk.desc);
if(rsk.sp_desc)sources.push(rsk.sp_desc);
});
(cd.abilities||[]).forEach(ab=>{
const r=_dcResolveCharAbilityForMode(ab);
if(!r)return;
(r.details||[]).forEach(d=>{if(typeof d==='object'&&d.text)sources.push(d.text);else if(typeof d==='string')sources.push(d)})});
function enPushIfUnit(reqUnitRaw,reqVigorKey,wpnTypesStr,rangeInc){
const ru=(reqUnitRaw||'').trim().toLowerCase();
if(ru&&!unitName.includes(ru)&&!ru.includes(unitBare))return;
mods.push({reqVigor:reqVigorKey,wpnTypes:wpnTypesStr,rangeInc});
}
if(_dcIsZhCalcLang()){
sources.forEach(txt=>{
let m;
const twFull=/搭乘(?:單位為)?「([^」]+)」[^]*?自身戰意為「([^」]+)」以上[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twFull.exec(txt))!==null){
enPushIfUnit(m[1],_dcTwBattleSpiritToVigorKey(m[2]),_dcTwZhWeaponTypesToEn(m[3]),parseInt(m[4],10)||0);
}
if(!/搭乘/.test(txt)){
const twVigor=/自身戰意為「([^」]+)」以上[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twVigor.exec(txt))!==null){
enPushIfUnit('',_dcTwBattleSpiritToVigorKey(m[1]),_dcTwZhWeaponTypesToEn(m[2]),parseInt(m[3],10)||0);
}
}
const twPilot=/搭乘「([^」]+)」時[^]*?((?:物理|光束|特殊)(?:、(?:物理|光束|特殊))*)武裝的最大射程提升(\d+)/g;
while((m=twPilot.exec(txt))!==null){
if(/自身戰意為/.test(m[0]))continue;
enPushIfUnit(m[1],'medium',_dcTwZhWeaponTypesToEn(m[2]),parseInt(m[3],10)||0);
}
});
return mods;
}
const re=/when\s+piloting\s+(.+?),\s*if\s+vigor\s+is\s+(\w+)\s+or\s+higher,?\s*(?:the\s+)?max\s+range\s+of\s+(.+?)\s+(?:weapon\s+)?is\s+increased\s+by\s+(\d+)/gi;
sources.forEach(txt=>{
let m;const re2=new RegExp(re.source,'gi');
while((m=re2.exec(txt))!==null){
const reqUnit=m[1].trim().toLowerCase();
const reqVigor=m[2].trim().toLowerCase();
const wpnTypes=m[3].trim().toLowerCase();
const rangeInc=parseInt(m[4],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor,wpnTypes,rangeInc});
}
}
const reAndVigor=/when\s+piloting\s+(.+?)\s+and\s+vigor\s+is\s+(\w+)\s+or\s+higher,?\s*increase\s+max\s+range\s+of\s+(.+?)\s+by\s+(\d+)/gi;
while((m=reAndVigor.exec(txt))!==null){
const reqUnit=m[1].trim().toLowerCase();
const reqVigor=m[2].trim().toLowerCase();
const wpnTypes=m[3].trim().toLowerCase();
const rangeInc=parseInt(m[4],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor,wpnTypes,rangeInc});
}
}
const reSimple=/when\s+piloting\s+(.+?),[\s\S]{0,160}?increase\s+max\s+range\s+of\s+(.+?)\s+by\s+(\d+)/gi;
while((m=reSimple.exec(txt))!==null){
if(/\band\s+vigor\b/i.test(m[1]))continue;
const reqUnit=m[1].trim().toLowerCase();
const wpnTypes=m[2].trim().toLowerCase();
const rangeInc=parseInt(m[3],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor:'medium',wpnTypes,rangeInc});
}
}
const reBeam=/when\s+piloting\s+(.+?),[\s\S]{0,160}?increase\s+beam\s+weapon\s+max\s+range\s+by\s+(\d+)/gi;
while((m=reBeam.exec(txt))!==null){
const reqUnit=m[1].trim().toLowerCase();
const rangeInc=parseInt(m[2],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor:'medium',wpnTypes:'beam',rangeInc});
}
}
const reWeaponMaxInc=/when\s+piloting\s+(.+?)[,\s][\s\S]{0,220}?((?:beam|physical|special)(?:\s+or\s+(?:beam|physical|special))*\s+weapon)\s+max\s+range\s+is\s+increased\s+by\s+(\d+)/gi;
while((m=reWeaponMaxInc.exec(txt))!==null){
const reqUnit=m[1].trim().toLowerCase();
const wpnTypes=m[2].trim().toLowerCase();
const rangeInc=parseInt(m[3],10)||0;
if(unitName.includes(reqUnit)||reqUnit.includes(unitBare)){
mods.push({reqVigor:'super',wpnTypes,rangeInc});
}
}
});
return mods;
}
function _dcGetEffectiveRange(wpn){
const mods=_dcParseRangeModifiers();
let maxR=wpn.max_range||0;
const curVigor=VIGOR_LEVEL_ORDER[_dcNormMpLevel(S.dc.mpLevel)]||0;
const WPN_ATTR_TYPES={'1':'beam','2':'physical','3':'special','4':'beam','5':'beam','6':'physical','7':'beam'};
const wpnKeySet=new Set(_dcWeaponAttributeKeys(wpn));
mods.forEach(mod=>{
const reqLv=VIGOR_LEVEL_ORDER[mod.reqVigor]!==undefined?VIGOR_LEVEL_ORDER[mod.reqVigor]:99;
if(curVigor>=reqLv){
if(_pilotRangeTypeKeysMatchWeapon(mod.wpnTypes,wpn))maxR+=mod.rangeInc;
}
});
return{min_range:wpn.min_range,max_range:maxR};
}

function _dcBaseWeaponIdForSsp(wid){
const s=String(wid||'');
if(s.length<8||!/^\d+$/.test(s))return null;
if(s.endsWith('90')||s.endsWith('80'))return s.slice(0,-2)+'01';
return null;
}
function _dcIsSspVariantWeapon(wpn){
if(!wpn)return false;
if(wpn.is_ssp_weapon)return true;
const bid=_dcBaseWeaponIdForSsp(wpn.id);
return bid&&String(wpn.id)!==bid;
}
function _dcMergeBaseWeaponTraitsForSsp(wpn,idx,allTraits){
// SSP weapons (...90 / ...80): scaling must come only from this row's traits + ssp_traits — not the base weapon's HP/MP/distance lines.
if(_dcIsSspVariantWeapon(wpn))return;
const bid=_dcBaseWeaponIdForSsp(wpn&&wpn.id);
if(!bid||String(wpn.id)===bid)return;
const ud=S.dc&&S.dc.atkUnitData;
if(!ud||!ud.weapons)return;
const base=ud.weapons.find(x=>String(x.id)===bid);
if(!base||!base.levels)return;
if(idx>=0&&base.levels[idx]&&(base.levels[idx].traits||[]).length){
(base.levels[idx].traits||[]).forEach(t=>allTraits.push(t));
}else{
base.levels.forEach(lv=>(lv.traits||[]).forEach(t=>allTraits.push(t)));
}
}

function _dcWeaponPowLvToMaxPct(lv){
const i=(parseInt(lv,10)||0)-1;
const arr=[5,7,10,12,15,17,20,22,25];
return(i>=0&&i<arr.length)?arr[i]:0;
}
function _dcDcIncludeSspWeaponEffects(){
return(S.dc&&S.dc.unitStatMode||'normal')==='ssp';
}
function _dcIsCustomCoreTraitLine(txt){
return /\[Custom\s*Core/i.test(txt)||/\bCustom\s+Core\s+Effect\b/i.test(txt);
}
function _dcExtractCustomCoreMaxUpPct(txt){
if(!txt)return 0;
const s=String(txt);
let m=s.match(/Maximum\s+Up\s+(\d+)%/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/\(\s*&\s*Maximum\s+Up\s+(\d+)%\s*\)/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/さらに最大値(\d+)%上昇/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/且最大值提升(\d+)%/);
if(m)return parseInt(m[1],10)||0;
return 0;
}
function _dcApplySspCorePowBonus(traits,bonus,wpn){
const x=bonus|0;if(!x)return;
// On SSP-only weapons, Custom Core "Maximum Up" stacks with that weapon's own effect (e.g. distance power), never with inherited HP/MP buckets.
if(wpn&&_dcIsSspVariantWeapon(wpn)){
traits.distCoreMax=(traits.distCoreMax|0)+x;
return;
}
if((traits.mpPowerMax|0)>0)traits.mpPowerMax=(traits.mpPowerMax|0)+x;
else if((traits.hpPowerMax|0)>0)traits.hpPowerMax=(traits.hpPowerMax|0)+x;
else if((traits.enPowerMax|0)>0)traits.enPowerMax=(traits.enPowerMax|0)+x;
else traits.distCoreMax=(traits.distCoreMax|0)+x;
}
function _dcParseWeaponTraits(wpn,lvIdx){
const traits={distPowerMax:0,hpPowerMax:0,mpPowerMax:0,enPowerMax:0,distCoreMax:0,critDmgUp:0,absoluteHit:false,dmgReductionNull:false,enemyTagWpMaxBonus:0,enemyTagDefBonus:0,enemyTagKey:'',powTraitHitSet:null};
if(!wpn)return traits;
const hit=new Set();
const noteHit=(raw)=>{if(raw!=null&&raw!=='')hit.add(String(raw).trim())};
const includeSsp=_dcDcIncludeSspWeaponEffects();
const zh=_dcIsZhCalcLang();
const isJa=(S.lang||'EN').toUpperCase()==='JA';
const allTraits=[];
const idx=lvIdx!==undefined&&lvIdx>=0?lvIdx:-1;
if(wpn.levels&&wpn.levels.length){
if(idx>=0&&wpn.levels[idx]&&(wpn.levels[idx].traits||[]).length){
(wpn.levels[idx].traits||[]).forEach(t=>allTraits.push(t));
}else{
wpn.levels.forEach(lv=>(lv.traits||[]).forEach(t=>allTraits.push(t)));
}
}else{(wpn.traits||[]).forEach(t=>allTraits.push(t));}
if(includeSsp)(wpn.ssp_traits||[]).forEach(t=>allTraits.push(t));
_dcMergeBaseWeaponTraitsForSsp(wpn,idx,allTraits);
let sspCoreBonus=0;
if(includeSsp){
(wpn.ssp_traits||[]).forEach(raw=>{
const c=_dcExtractCustomCoreMaxUpPct(String(raw||''));
if(c>sspCoreBonus)sspCoreBonus=c;
if(c>0)noteHit(raw);
});
}
allTraits.forEach(raw=>{
const txt=String(raw).replace(/\n/g,' ');
if(/absolute\s+hit/i.test(txt)||txt.includes('絕對命中'))traits.absoluteHit=true;
if(/weapon\s+attribute\s+damage\s+reduction\s+null/i.test(txt)||txt.includes('武裝屬性損傷減輕無效'))traits.dmgReductionNull=true;
let m=txt.match(/Increase\s+Critical\s+Damage\s+by\s+(\d+)%/i);
if(!m)m=txt.match(/[Ii]ncrease\s+(?:own\s+)?[Cc]ritical\s+[Dd]amage(?:\s+dealt)?\s+by\s+(\d+)%/i);
if(!m&&zh)m=txt.match(/自身爆擊損傷提升(\d+)%/);
if(m){traits.critDmgUp=Math.max(traits.critDmgUp,parseInt(m[1],10));return}
m=txt.match(/(?:the\s+)?(?:closer|farther|further)\s+(?:you\s+are(?:\s+(?:to|from)\s+the\s+enemy)?|the\s+enemy\s+is).*?(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(!m&&zh)m=txt.match(/距離敵方越(?:近|遠)，武裝POWER越為提升（最高提升(\d+)%）/);
if(!m&&isJa){m=txt.match(/敵から(?:近い|遠い)ほど武装POWERが上昇[（(]最大(\d+)%上昇[）)]/);}
if(m){const p=parseInt(m[1],10)||0;traits.distPowerMax=Math.max(traits.distPowerMax,p);noteHit(raw);}
m=txt.match(/(?:the\s+)?(?:lower|higher)\s+(?:(?:this\s+unit'?s|your|own)\s+)?remaining\s+HP.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(!m&&zh)m=txt.match(/自身剩餘HP越(?:高|低)，武裝POWER越為提升（最高提升(\d+)%）/);
if(!m&&isJa)m=txt.match(/自身の残HPが(?:多い|少ない)ほど武装POWERが上昇（最大(\d+)%上昇）/);
if(m){const p=parseInt(m[1],10)||0;traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}
m=txt.match(/(?:the\s+)?(?:higher|lower)\s+(?:(?:this\s+unit'?s|your|own)\s+)?remaining\s+EN.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)/i);
if(!m&&zh)m=txt.match(/自身剩餘EN越(?:高|低)，武裝POWER越為提升（最高提升(\d+)%）/);
if(!m&&isJa)m=txt.match(/自身の残ENが(?:多い|少ない)ほど武装POWERが上昇（最大(\d+)%上昇）/);
if(m){const p=parseInt(m[1],10)||0;traits.enPowerMax=Math.max(traits.enPowerMax,p);noteHit(raw);}
m=txt.match(/(?:With\s+More|With\s+Less)\s+Remaining\s+HP,?\s*Higher\s+Weapon\s+Power\s*LV\s*(\d+)/i);
if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}
m=txt.match(/Scaling\s+Weapon\s+Power\s+\((?:More|Less)\s+Remaining\s+HP\)\s*LV\s*(\d+)/i);
if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}
if(zh){m=txt.match(/剩餘HP越(?:高|低)武裝POWER提升\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}}
if(isJa){m=txt.match(/残HP(?:多い|少ない)ほど武装POWER上昇\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.hpPowerMax=Math.max(traits.hpPowerMax,p);noteHit(raw);}}}
m=txt.match(/the\s+higher\s+(?:your|own)\s+MP\s+is,?\s*the\s+(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)(?:\s+at\s+the\s+start\s+of\s+battle)?\.?/i);
if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}
if(zh){m=txt.match(/(?:戰鬥開始時，)?自身MP越高，武裝POWER越為提升（最高提升(\d+)%）/);if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
if(isJa){m=txt.match(/(?:戦闘開始時、)?自身のMPが多いほど武装POWERが上昇（最大(\d+)%上昇）/);if(m){const p=parseInt(m[1],10)||0;traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
m=txt.match(/Scaling\s+Weapon\s+Power\s+\(High\s+(?:Max\s+)?MP\)(?:\s*LV\s*(\d+))?/i);
if(m){const p=m[1]?_dcWeaponPowLvToMaxPct(m[1]):0;if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}
if(zh){m=txt.match(/MP越高武裝POWER提升\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}}
if(isJa){m=txt.match(/MP(?:高い|多い)ほど武装POWER上昇\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.mpPowerMax=Math.max(traits.mpPowerMax,p);noteHit(raw);}}}
m=txt.match(/Increased\s+(?:Close|Long)\s+Range\s+Weapon\s+Power\s*LV\s*(\d+)/i);
if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.distPowerMax=Math.max(traits.distPowerMax,p);noteHit(raw);}}
if(zh){m=txt.match(/(?:近距離|遠距離)時武裝POWER提升\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.distPowerMax=Math.max(traits.distPowerMax,p);noteHit(raw);}}}
if(isJa){m=txt.match(/(?:近距離|遠距離)時武装POWER上昇\s*LV\s*(\d+)/i);if(m){const p=_dcWeaponPowLvToMaxPct(m[1]);if(p){traits.distPowerMax=Math.max(traits.distPowerMax,p);noteHit(raw);}}}
/* Enemy-tag weapon bonuses (e.g. Zeon): raise HP WP max or DEF-down value when tag matches. */
m=txt.match(/When engaging enemies that include\s+([A-Za-z][\w\s/-]*?)\s+tag,\s*adds\s+(\d+)%\s+to the maximum value for Increased Weapon Power/i);
if(!m&&zh)m=txt.match(/與包含\s*([^\s，,]+)\s*標籤的敵方交戰時，?武裝POWER提升的最大值增加\s*(\d+)%/);
if(!m&&isJa)m=txt.match(/([^\s]+)タグを含む敵と交戦時、武装POWER上昇の最大値が(\d+)%増加/);
if(m){const tag=_dcNormalizeTagToken(m[1]);const p=parseInt(m[2],10)||0;if(tag&&p>0){traits.enemyTagKey=traits.enemyTagKey||tag;traits.enemyTagWpMaxBonus=Math.max(traits.enemyTagWpMaxBonus|0,p);noteHit(raw);}}
m=txt.match(/When engaging enemies that include\s+([A-Za-z][\w\s/-]*?)\s+tag,\s*adds\s+(\d+)%\s+to the weapon effect value for Decreased DEF/i);
if(!m&&zh)m=txt.match(/與包含\s*([^\s，,]+)\s*標籤的敵方交戰時，?DEF下降的武裝效果值增加\s*(\d+)%/);
if(!m&&isJa)m=txt.match(/([^\s]+)タグを含む敵と交戦時、DEF減少の武装効果が(\d+)%増加/);
if(m){const tag=_dcNormalizeTagToken(m[1]);const p=parseInt(m[2],10)||0;if(tag&&p>0){traits.enemyTagKey=traits.enemyTagKey||tag;traits.enemyTagDefBonus=Math.max(traits.enemyTagDefBonus|0,p);noteHit(raw);}}
});
_dcApplySspCorePowBonus(traits,sspCoreBonus,wpn);
traits.powTraitHitSet=hit;
return traits;
}
/** Level row for DC (clamped index), or top-level weapon stats when API has no per-level array. */
function _dcWeaponLevelRow(wpn,lvIdx){
if(!wpn)return{power:0,accuracy:0,critical:0,en:0,traits:[]};
if(wpn.levels&&wpn.levels.length){
const j=Math.min(Math.max(0,lvIdx|0),wpn.levels.length-1);
return wpn.levels[j]||{power:0,accuracy:0,critical:0,en:0,traits:[]};
}
return{power:wpn.power|0,en:(wpn.en_cost|wpn.en)|0,accuracy:wpn.accuracy|0,critical:wpn.critical|0,ammo:wpn.ammo|0,traits:wpn.traits||[]};
}
/** HP/MP/distance weapon-power % applies to sheet PWR including SSP flat enhance (e.g. Twin Beam 4440+350=4790), then ceil. */
function _dcEnemyTagWeaponBonusActive(wt){
if(!wt||(!(wt.enemyTagWpMaxBonus|0)&&!(wt.enemyTagDefBonus|0)))return false;
return S.dc.applyZeonEnemyTag!==false;
}
function _dcComputedWeaponPowerForLevel(wpn,lvIdx){
const lvData=_dcWeaponLevelRow(wpn,lvIdx);
const baseLv=lvData.power||0;
const sspFlat=_dcDcIncludeSspWeaponEffects()?(wpn.ssp_power_bonus|0):0;
const sheetPow=baseLv+sspFlat;
const traitLv=(wpn&&wpn.levels&&wpn.levels.length)?Math.min(Math.max(0,lvIdx|0),wpn.levels.length-1):0;
const wt=_dcParseWeaponTraits(wpn,traitLv);
const traitDistPow=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
let hpPow=wt.hpPowerMax|0;
let mpPow=wt.mpPowerMax|0;
let enPow=wt.enPowerMax|0;
const tagBonus=wt.enemyTagWpMaxBonus|0;
if(tagBonus>0&&_dcEnemyTagWeaponBonusActive(wt)){
if(hpPow>0)hpPow+=tagBonus;
else if(mpPow>0)mpPow+=tagBonus;
else if(enPow>0)enPow+=tagBonus;
else hpPow+=tagBonus;
}
const traitScaling=hpPow+mpPow+enPow;
// Integer % apply (floor): 6480×117/100 → 7581 for Full Burst +17% remaining EN.
return Math.floor(sheetPow*(100+traitDistPow+traitScaling)/100);
}
/** DC weapon header PWR: raw level table power + SSP flat in SSP mode only — excludes trait % scaling (that affects damage via _dcComputedWeaponPowerForLevel). */
function _dcWpnSheetFlatPower(wpn,lvIdx){
const lv=_dcWeaponLevelRow(wpn,lvIdx);
const base=lv.power|0;
return base+(_dcDcIncludeSspWeaponEffects()?(wpn.ssp_power_bonus|0):0);
}
function _dcBestLevelIndexForWeapon(wpn){
if(!wpn||!wpn.levels||!wpn.levels.length)return 0;
let bestPow=-1,bestJ=0,bestRaw=-1;
wpn.levels.forEach((lv,j)=>{
const p=_dcComputedWeaponPowerForLevel(wpn,j);
const raw=lv.power||0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&j>bestJ)))){
bestPow=p;bestJ=j;bestRaw=raw;
}
});
return bestJ;
}
function _dcPickBestWeaponIndices(ud){
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length)return{wpnIdx:0,wpnLv:0};
let bestPow=-1,bestI=0,bestJ=0,bestRaw=-1;
wpns.forEach((w,i)=>{
if(w.levels&&w.levels.length){
w.levels.forEach((lv,j)=>{
const p=_dcComputedWeaponPowerForLevel(w,j);
const raw=lv.power||0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&j>bestJ)))){
bestPow=p;bestI=i;bestJ=j;bestRaw=raw;
}
});
}else{
const p=_dcComputedWeaponPowerForLevel(w,0);
const raw=w.power|0;
if(p>bestPow||(p===bestPow&&(raw>bestRaw||(raw===bestRaw&&i>bestI)))){
bestPow=p;bestI=i;bestJ=0;bestRaw=raw;
}
}
});
return{wpnIdx:bestI,wpnLv:bestJ};
}
function _dcDefaultWpnLvIndex(wpn){
return _dcBestLevelIndexForWeapon(wpn);
}
function renderDcWeaponArea(){
const wa=document.getElementById('dcAtkWpnArea');
const ud=S.dc.atkUnitData;
if(ud&&ud._manual){wa.innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};_dcRefreshFinalWpnPowPlaceholder();return}
if(!ud||!ud.weapons||!ud.weapons.length){wa.innerHTML='';S.dc._wpnCritDmgUp=0;S.dc._wpnTraits={};_dcRefreshFinalWpnPowPlaceholder();return}
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length){wa.innerHTML='';_dcRefreshFinalWpnPowPlaceholder();return}
if(S.dc.wpnIdx<0||S.dc.wpnIdx>=wpns.length){
const b=_dcPickBestWeaponIndices(ud);
S.dc.wpnIdx=b.wpnIdx;S.dc.wpnLv=b.wpnLv;
}
let h=`<div class="dc-section-label">${t('dc_weapon')}</div><select class="dc-wpn-select" id="dcWpnSelect" name="dc_weapon" aria-label="${escAttr(t('dc_weapon'))}" onchange="setDcWeapon(this.selectedIndex)">`;
wpns.forEach((w,i)=>h+=`<option value="${i}"${i===S.dc.wpnIdx?' selected':''}>${esc(w.name)}</option>`);
h+=`</select>`;
const cw=wpns[S.dc.wpnIdx];
if(cw&&cw.levels&&cw.levels.length){
const maxLv=cw.levels.length-1;
if(S.dc.wpnLv>maxLv)S.dc.wpnLv=maxLv;
h+=`<div class="dc-wlv-row" style="margin-top:6px">`;
cw.levels.forEach((lv,i)=>h+=`<button class="dc-wlv-btn${i===S.dc.wpnLv?' active':''}" onclick="setDcWpnLv(${i})">Lv${lv.level}</button>`);
h+=`</div>`;
const ld=cw.levels[S.dc.wpnLv];
const effR=_dcGetEffectiveRange(cw);
const rangeChanged=effR.max_range!==cw.max_range;
const rangeStr=rangeChanged?`${effR.min_range}-<span style="color:#4ade80">${effR.max_range}</span>`:`${effR.min_range}-${effR.max_range}`;
const atkTypeIconsHtml=_dcWeaponAttackTypeIconsHtml(cw);
const attrHtml=_dcWeaponAttributeDisplayHtml(cw);
const exBadge=cw.is_ex?`<span style="margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(34,211,238,.15);color:var(--accent-cyan);font-size:10px;font-weight:700">EX</span>`:'';
const sheetPow=_dcWpnSheetFlatPower(cw,S.dc.wpnLv);
h+=`<div class="dc-wpn-info"><span>${t('dc_power')}: <span class="val" id="dcWpnSheetPow">${fmtN(sheetPow)}</span></span><span>${t('dc_range')}: <span class="val">${rangeStr}</span></span><span>${t('dc_accuracy')}: <span class="val">${ld.accuracy}%</span></span><span>${t('dc_critical')}: <span class="val">${ld.critical}%</span></span><span>${t('dc_en_cost')}: <span class="val">${ld.en}</span></span><span>${t('wp_type')}: <span class="val" style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px"><span class="dc-wpn-atk-icons">${atkTypeIconsHtml}</span>${attrHtml}</span>${exBadge}</span></div>`;
const wt=_dcParseWeaponTraits(cw,S.dc.wpnLv);
S.dc._wpnTraits=wt;
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const distBase=wt.distPowerMax|0;
const effDistMax=Math.min(100,distBase+(wt.distCoreMax|0));
const coreExtra=Math.max(0,effDistMax-distBase);
S.dc._wpnTraitDistPow=effDistMax;
const powHit=wt.powTraitHitSet;
const hasPowScaling=effDistMax>0||(wt.hpPowerMax|0)>0||(wt.mpPowerMax|0)>0||(wt.enPowerMax|0)>0;
if(hasPowScaling||wt.absoluteHit||wt.dmgReductionNull||(ld.traits&&ld.traits.length)||((cw.ssp_traits||[]).length)){
h+=`<div style="margin-top:8px;font-size:11px;line-height:1.55">`;
if(wt.absoluteHit)h+=`<div style="color:#4ade80">✓ Absolute Hit</div>`;
if(wt.dmgReductionNull)h+=`<div style="color:#4ade80">✓ Attribute Damage Reduction Null</div>`;
if(hasPowScaling){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:4px 0 2px">${esc(t('dc_wpn_trait_effects'))}</div>`;
if(distBase)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_dist'))}: +${distBase}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(coreExtra)h+=`<div style="color:#c084fc">${esc(t('dc_wpn_trait_custom_core'))}: +${coreExtra}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.hpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_hp'))}: +${wt.hpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.mpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_mp'))}: +${wt.mpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.enPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_en')||'EN scaling')}: +${wt.enPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if((cw.ssp_traits||[]).length&&!_dcDcIncludeSspWeaponEffects())h+=`<div style="color:#eab308;margin-top:4px">${esc(t('dc_wpn_trait_ssp_hint'))}</div>`;
}
const trLines=(arr,prefix)=>{(arr||[]).forEach(tr=>{const s=String(tr||'').trim();if(!s)return;const hi=powHit&&powHit.has(s);const cls=hi?'dc-wpn-trait-line dc-wpn-trait-line--pow':'dc-wpn-trait-line';const pre=prefix?`<span style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:rgba(192,132,252,.25);font-size:9px;font-weight:800;color:#e9d5ff">SSP</span>`:'';h+=`<div class="${cls}">${pre}${esc(s)}</div>`;});};
if((ld.traits&&ld.traits.length)||(_dcDcIncludeSspWeaponEffects()&&(cw.ssp_traits||[]).length)){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:8px 0 2px">${esc(t('dc_wpn_trait_lines'))}</div>`;
trLines(ld.traits,false);
if(_dcDcIncludeSspWeaponEffects())trLines(cw.ssp_traits,true);
}
h+=`</div>`;
}
}else if(cw){
S.dc.wpnLv=0;
const ld=_dcWeaponLevelRow(cw,0);
const effR=_dcGetEffectiveRange(cw);
const rangeChanged=effR.max_range!==cw.max_range;
const rangeStr=rangeChanged?`${effR.min_range}-<span style="color:#4ade80">${effR.max_range}</span>`:`${effR.min_range}-${effR.max_range}`;
const atkTypeIconsHtml=_dcWeaponAttackTypeIconsHtml(cw);
const attrHtml=_dcWeaponAttributeDisplayHtml(cw);
const exBadge=cw.is_ex?`<span style="margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(34,211,238,.15);color:var(--accent-cyan);font-size:10px;font-weight:700">EX</span>`:'';
const sheetPow=_dcWpnSheetFlatPower(cw,0);
h+=`<div class="dc-wpn-info"><span>${t('dc_power')}: <span class="val" id="dcWpnSheetPow">${fmtN(sheetPow)}</span></span><span>${t('dc_range')}: <span class="val">${rangeStr}</span></span><span>${t('dc_accuracy')}: <span class="val">${ld.accuracy}%</span></span><span>${t('dc_critical')}: <span class="val">${ld.critical}%</span></span><span>${t('dc_en_cost')}: <span class="val">${ld.en}</span></span><span>${t('wp_type')}: <span class="val" style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px"><span class="dc-wpn-atk-icons">${atkTypeIconsHtml}</span>${attrHtml}</span>${exBadge}</span></div>`;
const wt=_dcParseWeaponTraits(cw,0);
S.dc._wpnTraits=wt;
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const distBase=wt.distPowerMax|0;
const effDistMax=Math.min(100,distBase+(wt.distCoreMax|0));
S.dc._wpnTraitDistPow=effDistMax;
const powHit=wt.powTraitHitSet;
const hasPowScaling=effDistMax>0||(wt.hpPowerMax|0)>0||(wt.mpPowerMax|0)>0||(wt.enPowerMax|0)>0;
if(hasPowScaling||wt.absoluteHit||wt.dmgReductionNull||(ld.traits&&ld.traits.length)||((cw.ssp_traits||[]).length)){
h+=`<div style="margin-top:8px;font-size:11px;line-height:1.55">`;
if(wt.absoluteHit)h+=`<div style="color:#4ade80">✓ Absolute Hit</div>`;
if(wt.dmgReductionNull)h+=`<div style="color:#4ade80">✓ Attribute Damage Reduction Null</div>`;
if(hasPowScaling){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:4px 0 2px">${esc(t('dc_wpn_trait_effects'))}</div>`;
if(distBase)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_dist'))}: +${distBase}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
const coreExtra2=Math.max(0,effDistMax-distBase);
if(coreExtra2)h+=`<div style="color:#c084fc">${esc(t('dc_wpn_trait_custom_core'))}: +${coreExtra2}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.hpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_hp'))}: +${wt.hpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.mpPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_mp'))}: +${wt.mpPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if(wt.enPowerMax)h+=`<div style="color:var(--text-muted)">${esc(t('dc_wpn_trait_en')||'EN scaling')}: +${wt.enPowerMax}% (${esc(t('dc_wpn_trait_max_applied'))})</div>`;
if((cw.ssp_traits||[]).length&&!_dcDcIncludeSspWeaponEffects())h+=`<div style="color:#eab308;margin-top:4px">${esc(t('dc_wpn_trait_ssp_hint'))}</div>`;
}
const trLines2=(arr,prefix)=>{(arr||[]).forEach(tr=>{const s=String(tr||'').trim();if(!s)return;const hi=powHit&&powHit.has(s);const cls=hi?'dc-wpn-trait-line dc-wpn-trait-line--pow':'dc-wpn-trait-line';const pre=prefix?`<span style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:rgba(192,132,252,.25);font-size:9px;font-weight:800;color:#e9d5ff">SSP</span>`:'';h+=`<div class="${cls}">${pre}${esc(s)}</div>`;});};
if((ld.traits&&ld.traits.length)||(_dcDcIncludeSspWeaponEffects()&&(cw.ssp_traits||[]).length)){
h+=`<div style="font-weight:700;color:var(--text-secondary);margin:8px 0 2px">${esc(t('dc_wpn_trait_lines'))}</div>`;
trLines2(ld.traits,false);
if(_dcDcIncludeSspWeaponEffects())trLines2(cw.ssp_traits,true);
}
h+=`</div>`;
}
}
wa.innerHTML=h;
_dcRefreshTotalDebuffsDisplay();
_dcRefreshFinalWpnPowPlaceholder();
if(!S.dc.atkCharData||S.dc.atkCharData._manual){
const ci=document.getElementById('dcCritDmgUp');
if(ci){ci.value=String(S.dc._wpnCritDmgUp|0);onDcParamChange();}
}
}
function _dcApplyWpnTraitPow(){
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];const w=wpns[S.dc.wpnIdx];
if(w){const wt=_dcParseWeaponTraits(w,S.dc.wpnLv);S.dc._wpnTraitDistPow=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0))}
onDcParamChange();
}

function renderDcNpcDropdown(){
const sel=document.getElementById('dcNpcSelect');
const list=S.dc.npcList||[];
if(!list.length){sel.innerHTML=`<option value="">${t('dc_select_npc')}</option>`;return}
sel.innerHTML=`<option value="">${t('dc_select_npc')}</option>`+list.map((n,i)=>{
const name=n.unit?.name||n.character?.name||`NPC ${n.npc_id}`;
const vid=n.npc_id!=null&&String(n.npc_id)!==''?String(n.npc_id):String(i);
return`<option value="${esc(vid)}">${esc(name)}</option>`
}).join('');
}

function selectDcNpc(){
if((S.dc.defTargetMode||'preset')!=='preset')return;
const sel=document.getElementById('dcNpcSelect');
const raw=String(sel.value||'');
const list=S.dc.npcList||[];
if(raw===''){S.dc.defNpc=null}
else{
let def=list.find(n=>String(n.npc_id)===raw);
if(!def){const i=parseInt(raw,10);if(!Number.isNaN(i)&&i>=0&&i<list.length)def=list[i]}
S.dc.defNpc=def||null;
if(S.dc.defNpc&&S.dc.defNpc.npc_id!=null&&String(S.dc.defNpc.npc_id)!==''){
const want=String(S.dc.defNpc.npc_id);
for(let j=0;j<sel.options.length;j++){if(sel.options[j].value===want){sel.selectedIndex=j;break}}
}
}
renderDcDefStats();onDcParamChange();
}

/** Weapon / manual “enemy DEF % down on this attack”: subtract floor(baseDef×p/100) from the defender’s **total** MS DEF, where baseDef is pre–map/team bonus (NPC) or pre–trait-bonus slice (database: stats total − bonus_amounts). In-game does not apply p% to buffed total — doing so inflated damage. */
function _dcApplyEnemyDefDebuffToDefenderUnitDef(defUnit,pct,effectiveTotalOpt){
const F=Math.floor,MX=Math.max,MN=Math.min;
const tRaw=MX(0,Number(defUnit&&defUnit.stats_raw&&defUnit.stats_raw.Defense)||0);
const bon=MX(0,Number(defUnit&&defUnit.bonus_amounts&&defUnit.bonus_amounts.Defense)||0);
const base=MX(0,tRaw-bon);
const p=MX(0,MN(100,parseInt(pct,10)||0));
const tot=MX(0,effectiveTotalOpt!=null?Number(effectiveTotalOpt):tRaw);
if(p<=0)return tot;
if(tot<=0)return 0;
const reduc=base>0?F((base*p)/100):0;
return MX(0,tot-reduc);
}
/** qub +1: when enabled, DEF debuff > 35% uses nominal weapon power + 1 (unless final power override). Disabled pending re-audit; set `DC_QUB_PLUS_ONE` true to restore. */
const DC_QUB_PLUS_ONE=false;
/** Firered sheet: unitStatRatio = RoundUp((UnAtk/10)−(UnDef/10))/5000. Set false to use legacy floor−floor tenths (older Qubeley gold). */
const DC_SHEET_UNIT_STAT_RATIO=true;
/** In-game super for some totalCritMult=125% hits (e.g. Exia vs Throne) matches ceil((combined−trim)×1.3) with trim=floor(max(0,B−W)/1181), only when ⑧ is high enough; avoids changing older BD rows that still use trim=0. */
const DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE=356500;
const DC_CRIT125_TRIM_DIV=1181;
function _dcCombatWeaponPowerNominal(nominalPow,defDebuffPct,hasFinalOverride){
const n=Number(nominalPow)||0;
const p=parseInt(defDebuffPct,10)||0;
if(hasFinalOverride||p<=35||!DC_QUB_PLUS_ONE)return n;
return n+1;
}
function _dcDefEternalStatCard(statKey,val,bonus,ctx){
const b=bonus>0?Number(bonus):0;
const hl=b>0?'has-bonus-val':'';
const cardCls='stat-card'+(b>0?' has-cond-bonus':'');
const bon=b>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(b)})</div>`:'';
return`<div class="${cardCls}"><div class="stat-card-label">${esc(tStat(statKey,ctx))}</div><div class="stat-card-value ${hl}">${fmtN(val)}</div>${bon}</div>`;
}
function _dcDefStatMiniHtml(label,val,bonus){
const b=bonus>0?Number(bonus):0;
const bonLn=b>0?`<div style="font-size:10px;color:#4ade80;font-weight:600;margin-top:2px;line-height:1.2">(+${fmtN(b)})</div>`:'';
const vCls=b>0?' dc-stat-val--buffed':'';
const boxCls=b>0?' dc-def-mini--map-bonus':'';
return`<div class="dc-stat-mini${boxCls}"><div class="dc-stat-mini-label">${label}</div><div class="dc-stat-mini-val"><span class="dc-def-stat-num${vCls}">${fmtN(val)}</span>${bonLn}</div></div>`;
}
function renderDcDefStats(){
const uArea=document.getElementById('dcDefUnitArea');
const cArea=document.getElementById('dcDefCharArea');
const sArea=document.getElementById('dcDefStatsArea');
const dbMode=(S.dc.defTargetMode||'preset')==='database';
if(uArea)uArea.style.display=dbMode?'none':'';
if(cArea)cArea.style.display=dbMode?'none':'';
const n=S.dc.defNpc;
if(!n){
if(uArea)uArea.innerHTML='';
if(cArea)cArea.innerHTML='';
sArea.innerHTML='';
return;
}
const u=n.unit,ch=n.character;
if(uArea){
if(dbMode)uArea.innerHTML='';
else if(u){
uArea.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(u.portrait||u.thum||'')}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(u.name||'NPC')}</div><div class="dc-picked-badges">${u.rarity_icon?`<img src="${imgUrl(u.rarity_icon)}">`:''}${u.role_icon?`<img src="${imgUrl(u.role_icon)}">`:''}</div></div></div>`;
}else uArea.innerHTML='';
}
if(cArea){
if(dbMode)cArea.innerHTML='';
else if(ch){
const cThum=ch.portrait||ch.thum||'';
cArea.innerHTML=`<div class="dc-picked"><img class="dc-thum" src="${imgUrl(cThum)}" alt="" onerror="this.style.display='none'"><div class="dc-picked-info"><div class="dc-picked-name">${esc(ch.name||'NPC')}</div></div></div>`;
}else cArea.innerHTML='';
}
let h='';
if(u){
const {stats:us,bonuses:ub}=_dcDefNpcUnitMapStatsPair(u);
const defTotal=us.Defense||0;
const defBon=ub.Defense||0;
const defPair={val:defTotal,bonusLine:Math.max(0,Number(defBon)||0)};
const manualDeb=parseInt(document.getElementById('dcDefDebuffPct')?.value,10)||0;
const atkUd=S.dc.atkUnitData;
const atkWpns=atkUd?_dcNonMapWeapons(atkUd):[];
const atkW=atkWpns[S.dc.wpnIdx];
const wDeb=atkW?_dcWeaponEnemyDefDebuffEffective(atkW,S.dc.wpnLv):0;
const defDeb=Math.min(100,manualDeb+wDeb);
let defCardEternal='';
if(defDeb>0){
const defBefore=defPair.val;
const defAfter=_dcApplyEnemyDefDebuffToDefenderUnitDef(u,defDeb,defBefore);
const defBonHtml=defPair.bonusLine>0?`<div class="stat-card-bonus" style="font-size:12px;color:var(--accent-green);margin-top:2px;">(+${fmtN(defPair.bonusLine)})</div>`:'';
const debSub=(manualDeb>0&&wDeb>0)?`<span style="font-size:9px;color:var(--text-muted);display:block;margin-top:4px;line-height:1.25">${manualDeb}% field + ${wDeb}% weapon</span>`:'';
defCardEternal=`<div class="stat-card has-cond-bonus"><div class="stat-card-label">${esc(tStat('Defense','unit'))}</div><div class="stat-card-value has-bonus-val" style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;max-width:100%"><span>${fmtN(defBefore)}</span>${defBonHtml}<span style="color:#f87171;font-weight:800;font-size:15px">→ ${fmtN(defAfter)}</span><span style="font-size:10px;color:#f87171;font-weight:600">(${defDeb}% DEF debuff)</span>${debSub}</div></div>`;
}
const unitOrder=['HP','EN','Attack','Defense','Mobility','Move'];
let unitGrid='';
for(const s of unitOrder){
if(s==='Defense'&&defDeb>0){unitGrid+=defCardEternal;continue}
const pr={val:us[s]||0,bonusLine:Math.max(0,Number(ub[s])||0)};
unitGrid+=_dcDefEternalStatCard(s,pr.val,pr.bonusLine,'unit');
}
h+=`<div class="dc-section-label" style="color:#f87171;font-size:12px;font-weight:600">${t('dc_defender_status')}</div><div style="font-size:10px;color:var(--text-muted);margin:-2px 0 6px;line-height:1.35">${t('dc_def_stats_map_note')}</div><div class="stats-grid dc-def-ers">${unitGrid}</div>`;
}
if(ch){
const cs=ch.stats_raw||{},cb=ch.bonus_amounts||{};
const charOrder=['Ranged','Melee','Defense','Reaction','Awaken'];
let charGrid='';
for(const s of charOrder){
const pr={val:cs[s]||0,bonusLine:Math.max(0,Number(cb[s])||0)};
charGrid+=_dcDefEternalStatCard(s,pr.val,pr.bonusLine,'character');
}
h+=`<div class="dc-section-label" style="margin-top:8px">${t('dc_char_stats')}</div><div style="font-size:10px;color:var(--text-muted);margin:-2px 0 6px;line-height:1.35">${t('dc_def_char_stats_note')}</div><div class="stats-grid dc-def-ers">${charGrid}</div>`;
}
sArea.innerHTML=h;
}

function renderDcOptionParts(){
const area=document.getElementById('dcAtkOptionArea');
const hasAtk=!!(S.dc.atkUnit||(S.dc.atkUnitData&&S.dc.atkUnitData._manual));
if(!hasAtk){area.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an attacker unit first.</div>';return}
if(!S.dc.optionParts.length){
area.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('option_parts')">Select option part</button>`;
return;
}
const o=S.dc.optionParts[0];
const thumHtml=o.thum?`<img class="dc-thum dc-dc-mod-thumb" src="${imgUrl(o.thum)}" alt="" onerror="this.style.display='none'">`:'';
const optTagLine=o.tags&&o.tags.length?`<div class="detail-tags-row" style="margin-top:4px;flex-wrap:wrap;">${o.tags.map(tg=>createTagHtml(tg,{defaultTarget:'unit'})).join('')}</div>`:'';
const rmTitle=escAttr(t('tb_op_clear'));
const trashSrc=imgUrlWebp(TB_TRASH_ICON);
area.innerHTML=`<div class="dc-option-item dc-option-item--layout"><div class="dc-option-item-main">${thumHtml}<div class="dc-option-item-text" style="font-size:12px"><strong>${esc(o.name)}</strong>${optTagLine}${o.details?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(o.details)}</div>`:''}</div><div class="dc-option-item-actions"><button type="button" class="dc-picked-change" onclick="openDcPicker('option_parts')">${esc(t('dc_change'))}</button><button type="button" class="remove dc-op-remove-btn" onclick="removeDcOptionPart(0)" title="${rmTitle}" aria-label="${rmTitle}"><img src="${trashSrc}" alt="" loading="lazy" decoding="async"></button></div></div></div>`;
}
function renderDcSupporters(){
const area=document.getElementById('dcAtkSupporterArea');
const hasAtk=!!(S.dc.atkUnit||(S.dc.atkUnitData&&S.dc.atkUnitData._manual));
if(!hasAtk){area.innerHTML='<div style="font-size:11px;color:var(--text-muted)">Select an attacker unit first.</div>';return}
if(!S.dc.supporters.length){
area.innerHTML=`<button type="button" class="dc-pick-btn" onclick="openDcPicker('supporter')">Select supporter</button>`;
return;
}
const s=S.dc.supporters[0];const i=0;
const lvl=s._dcLevel||100;const lbt=s._dcLbTier!==undefined?s._dcLbTier:3;
const thumHtml=(s.portrait||s.thum)?`<img class="dc-thum dc-dc-mod-thumb" src="${imgUrl(s.portrait||s.thum)}" alt="" onerror="this.style.display='none'">`:'';
const lsHtml=(s.leader_skills||[]).map(ls=>{
const desc=ls.desc||'';
const tags=(ls.tags||[]).map(tg=>tg.name||'').filter(Boolean);
const sep=ls.separator==='and'?' & ':' / ';
const tagStr=tags.length?tags.join(sep):'';
return`<div style="font-size:11px;margin-top:2px">
${tagStr?`<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:rgba(251,191,36,.15);color:#fbbf24;font-size:10px;margin-bottom:2px">${esc(tagStr)}</span><br>`:''}
<span style="color:var(--text-muted)">${esc(desc)}</span></div>`;
}).join('');
const rmTitle=escAttr(t('tb_clear_supporter')||t('tb_op_clear')||'Clear');
const trashSrc=imgUrlWebp(TB_TRASH_ICON);
area.innerHTML=`<div class="dc-supporter-item dc-supporter-item--layout">
<div class="dc-supporter-item-main">${thumHtml}<div class="dc-supporter-item-text" style="font-size:12px"><strong>${esc(s.name)}</strong> <span style="color:var(--text-muted);font-size:11px">(${esc(s.rarity||'')})</span></div><div class="dc-supporter-item-actions"><button type="button" class="dc-picked-change" onclick="openDcPicker('supporter')">${esc(t('dc_change'))}</button><button type="button" class="dc-supp-remove-btn" onclick="removeDcSupporter(0)" title="${rmTitle}" aria-label="${rmTitle}"><img src="${trashSrc}" alt="" loading="lazy" decoding="async"></button></div></div>
${lsHtml}
<div class="dc-supporter-ctrl-row">
<span style="font-size:11px;color:var(--text-muted)">Lv</span><input type="number" class="dc-input-sm dc-supporter-lv-input" value="${lvl}" min="1" max="100" onchange="updateDcSupporterLv(0,this.value)">
<div class="lb-btn-group dc-supporter-lb-group">${[0,1,2,3].map(t=>{const p=cmpLbPipsAtTier(t);return`<button type="button" class="lb-icon-btn${t===lbt?' active':''}" onclick="updateDcSupporterLb(0,${t})" title="${t}">${cmpLbPipsRow(p[0],p[1],p[2])}</button>`;}).join('')}</div>
</div>
<div style="font-size:11px;color:var(--accent-cyan);margin-top:2px">HP+${fmtN(s.hp_support||0)} ATK+${fmtN(s.atk_support||0)}</div>
</div>`;
}
async function _dcFetchAllListRows(base,extra,listQ){
const qv=listQ!==undefined&&listQ!==null?String(listQ):'';
const rows=[];let page=1;let totalPages=1;
do{
const r=await fetch(`${base}?lang=${S.lang}&page=${page}&per_page=100&sort=rarity&dir=desc&q=${encodeURIComponent(qv)}&${extra}`);
const d=await r.json();
rows.push(...(d.rows||[]));
totalPages=d.total_pages||1;
page++;
}while(page<=totalPages);
return rows;
}
function _dcOptionPartUnitQuery(){
const uid=S.dc.atkUnit;
if(!uid||uid==='__manual__'||(S.dc.atkUnitData&&S.dc.atkUnitData._manual))return'';
return'&unit_id='+encodeURIComponent(uid);
}
function _dcSupporterUnitCharQuery(){
let q=_dcOptionPartUnitQuery();
const cid=S.dc.atkChar;
if(cid&&cid!=='__manual__'&&!(S.dc.atkCharData&&S.dc.atkCharData._manual))q+='&character_id='+encodeURIComponent(cid);
return q;
}
/** Context for supporter leader trait checks (SameGroup / lineage) — pass current DC attacker unit & pilot. */
function _dcForSupporterContextQuery(){
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
let q='';
if(ud&&!ud._manual&&ud.id&&String(ud.id)!=='__manual__')q+='&for_unit_id='+encodeURIComponent(String(ud.id));
if(cd&&!cd._manual&&cd.id&&String(cd.id)!=='__manual__')q+='&for_char_id='+encodeURIComponent(String(cd.id));
return q;
}
async function selectDcOptionPart(id){
let row=(S._dcPickerFullCache||[]).find(x=>String(x.id)===String(id));
if(row&&(!row.details||!String(row.details).trim())){
try{
const uq=_dcOptionPartUnitQuery();
const r=await fetch(`/api/option_parts?lang=${S.lang}&page=1&per_page=100&q=${encodeURIComponent(id)}${uq}`);
const d=await r.json();
const hit=(d.rows||[]).find(x=>String(x.id)===String(id));
if(hit)row=hit;
}catch(e){}
}
if(row){
const _opSlot=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
if(_dcOptionPartRowIsSsr(row)&&_dcDcOptionPartSsrDeniedForSlot(row.id,_opSlot))return;
S.dc.optionParts=[{id:row.id,name:row.name,details:row.details||'',thum:row.thum||'',tags:row.tags||[]}];renderDcOptionParts();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()
}
}
async function selectDcSupporter(id){
try{
const cq=_dcForSupporterContextQuery();
const rd=await fetch(`/api/supporter/${id}?lang=${S.lang}&level=100&lb_tier=3${cq}`).then(r=>r.json());
if(rd&&!rd.error){rd._dcLevel=100;rd._dcLbTier=3;S.dc.supporters=[rd];renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
}catch(e){}
}
async function updateDcSupporterLv(idx,val){
const s=S.dc.supporters[idx];if(!s)return;
const lv=Math.min(100,Math.max(1,parseInt(val)||100));
const lb=s._dcLbTier!==undefined?s._dcLbTier:3;
try{const r=await fetch(`/api/supporter/${s.id}?lang=${S.lang}&level=${lv}&lb_tier=${lb}${_dcForSupporterContextQuery()}`);const d=await r.json();if(d&&!d.error){Object.assign(s,d);s._dcLevel=lv;s._dcLbTier=lb;renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}}catch(e){}
}
async function updateDcSupporterLb(idx,tier){
const s=S.dc.supporters[idx];if(!s)return;
const lv=s._dcLevel||100;
try{const r=await fetch(`/api/supporter/${s.id}?lang=${S.lang}&level=${lv}&lb_tier=${tier}${_dcForSupporterContextQuery()}`);const d=await r.json();if(d&&!d.error){Object.assign(s,d);s._dcLevel=lv;s._dcLbTier=tier;renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}}catch(e){}
}
function removeDcOptionPart(i){S.dc.optionParts.splice(i,1);renderDcOptionParts();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
function removeDcSupporter(i){S.dc.supporters.splice(i,1);renderDcSupporters();_dcSnapActiveAttackerToSlot();_dcRefreshAtkPanelsAfterMods()}
function setDcLbTier(tier){S.dc.lbTier=tier;renderDcAtkUnit();renderDcAtkChar();onDcParamChange()}
function setDcWeapon(idx){
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];
const w=wpns[idx];
S.dc.wpnIdx=idx;S.dc.wpnLv=w?_dcDefaultWpnLvIndex(w):0;
const wt=w?_dcParseWeaponTraits(w,S.dc.wpnLv):{};
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const effD=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
S.dc._wpnTraitDistPow=effD>0?effD:0;
S.dc._wpnTraitHpPow=0;
renderDcWeaponArea();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcWpnLv(lv){
S.dc.wpnLv=lv;
const ud=S.dc.atkUnitData;const wpns=ud?_dcNonMapWeapons(ud):[];const w=wpns[S.dc.wpnIdx];
if(w){
const wt=_dcParseWeaponTraits(w,lv);
S.dc._wpnCritDmgUp=wt.critDmgUp|0;
const effD=Math.min(100,(wt.distPowerMax||0)+(wt.distCoreMax||0));
S.dc._wpnTraitDistPow=effD>0?effD:0;
S.dc._wpnTraitHpPow=0;
}
renderDcWeaponArea();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcMp(lv){
const prevKey=_dcGetUnitStatKey();
const prevUcp=!!S.dc.unitCondPassive;
const prevCcp=!!S.dc.charCondPassive;
S.dc.mpLevel=_dcNormMpLevel(lv);
_dcSyncUnitCondPassiveFromVigor();
_dcSyncCharCondPassiveFromPair();
const nk=S.dc.mpLevel;
document.querySelectorAll('#dcMpBtns .dc-ctrl-btn').forEach(b=>b.classList.toggle('active',b.dataset.mp===nk));
const newKey=_dcGetUnitStatKey();
const ccpChanged=!!S.dc.charCondPassive!==prevCcp;
if(S.dc.atkUnitData&&(newKey!==prevKey||!!S.dc.unitCondPassive!==prevUcp))renderDcAtkUnit();
if(ccpChanged)renderDcAtkChar();
if(S.dc.atkUnitData)renderDcWeaponArea();
if(_dcNormMpLevel(S.dc.mpLevel)==='super'){
_dcSyncSuperchargedExTierForVigor();
_dcAutoEnableMaxDamageSkills();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
}else if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(false);
else onDcParamChange();
}
function setDcDefend(v){
S.dc.defending=v;
document.getElementById('dcDefOff').classList.toggle('active',!v);
document.getElementById('dcDefOn').classList.toggle('active',v);
onDcParamChange();
}
function setDcShield(v){
S.dc.shield=v;
document.getElementById('dcShieldOff').classList.toggle('active',!v);
document.getElementById('dcShieldOn').classList.toggle('active',v);
onDcParamChange();
}
function toggleDcSquadCondFlatAdApply(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const bf=_dcCharShouldShowSquadCondUi(cd,ud)&&_dcSquadFlatAdSingleBinding(cd,ud);
const cb=document.getElementById('dcSquadCondFlatAdApply');
const inp=document.getElementById('dcSquadCondPct');
if(!bf||!cb||!inp)return;
const cap=_dcSquadCondInputCap(cd,ud);


if(cb.checked){
const phen=_dcPhenexUniqueSquadFlatAdBinding(cd,ud);
const v=phen?(phen.flatPct|0):Math.max(0,cap|0);
inp.value=String(v);S.dc.squadCondPct=v;}else{S.dc.squadCondPct=0;inp.value='0'}
onDcParamChange();
}
function _dcSyncSupportCounterHighlight(){
const w=document.getElementById('dcAtkSupportCounterWrap');
const on=!!(w&&S.dc.supportCounterAtk&&!w.classList.contains('is-disabled')&&w.style.display!=='none');
if(w)w.classList.toggle('is-active',on);
const pilotNote=document.getElementById('dcAtkSupportCounterPilotNote');
if(pilotNote)pilotNote.classList.toggle('is-highlighted',on);
}
function setDcSupportCounterAtk(v){
S.dc.supportCounterAtk=!!v;
const tog=document.getElementById('dcAtkSupportCounterToggle');
if(tog){tog.classList.toggle('active',!!v);tog.setAttribute('aria-pressed',v?'true':'false')}
_dcSyncSupportCounterHighlight();
onDcParamChange();
}
function toggleDcSupportCounterAtk(){
const wrap=document.getElementById('dcAtkSupportCounterWrap');
if(wrap&&wrap.classList.contains('is-disabled'))return;
setDcSupportCounterAtk(!S.dc.supportCounterAtk);
}
function onDcParamChange(){
const fwpEl=document.getElementById('dcFinalWpnPow');
const fwpRaw=fwpEl&&String(fwpEl.value).trim()!==''?parseInt(fwpEl.value,10):NaN;
S.dc.finalWpnPow=Number.isFinite(fwpRaw)&&fwpRaw>0?fwpRaw:0;
S.dc.dmgIncrease=parseInt(document.getElementById('dcDmgIncrease')?.value)||0;
S.dc.critDmgUp=parseInt(document.getElementById('dcCritDmgUp')?.value)||0;
{let v=0;let exZ=false;if(_dcCharHasExSquadSynergyAbility(S.dc.atkCharData,S.dc.atkUnitData)){const el=document.getElementById('dcExSquadAtkPct');const rawStr=el?String(el.value).trim():'';if(rawStr==='0'){v=0;exZ=true}else if(rawStr!==''){const raw=parseInt(rawStr,10);v=Number.isFinite(raw)?Math.min(20,Math.max(0,raw)):0}else if(_scIsQubeleyExCombo(S.dc.atkCharData,S.dc.atkUnitData))v=20;else v=0}S.dc.exSquadAtkPct=v;S.dc.exSquadAtkPctExplicitZero=exZ;const el=document.getElementById('dcExSquadAtkPct');if(el&&String(el.value).trim()===''&&v>0)el.value=String(v)}
const _prevScEffAtk=S.dc.squadCondAtkPct|0,_prevScEffDef=S.dc.squadCondDefPct|0;
{const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;const el=document.getElementById('dcSquadCondPct');
const bfBind=_dcCharShouldShowSquadCondUi(cd,ud)&&_dcSquadFlatAdSingleBinding(cd,ud);
const flatCb=document.getElementById('dcSquadCondFlatAdApply');


if(ud&&!ud._manual&&cd&&!cd._manual&&el){
let rawPct=0;const rawStr=String(el.value).trim();


if(rawStr!==''){const rx=parseInt(rawStr,10);if(Number.isFinite(rx))rawPct=Math.max(0,rx)}
if(bfBind&&flatCb&&!flatCb.checked)rawPct=0;
S.dc.squadCondPct=rawPct;
}else S.dc.squadCondPct=0}
{const wBr=document.getElementById('dcBigRangZeonSquadWrap');const cbBr=document.getElementById('dcBigRangZeonSquadApply');if(wBr&&wBr.style.display!=='none'&&cbBr)S.dc.bigRangZeonSquadBuff=!!cbBr.checked}
_dcSyncSquadCondEffectiveFromState();
{const c=document.getElementById('dcDefNpcMapBonusesOn');if(c)S.dc.defNpcMapBonusesOn=!!c.checked}
const _sqPanelChg=_prevScEffAtk!==(S.dc.squadCondAtkPct|0)||_prevScEffDef!==(S.dc.squadCondDefPct|0);
{const c=document.getElementById('dcAtkCounterOwnAtk');if(c)S.dc.atkCounterOwnAtk=!!c.checked}
{const wSc=document.getElementById('dcAtkSupportCounterWrap');const tog=document.getElementById('dcAtkSupportCounterToggle');if(wSc&&wSc.style.display!=='none'&&tog)S.dc.supportCounterAtk=tog.classList.contains('active')}
{const wAdv=document.getElementById('dcAtkAdvantageEnemyTagWrap');const a=document.getElementById('dcAtkAdvantageEnemyTag');if(a&&wAdv&&wAdv.style.display!=='none')S.dc.applyAdvantageEnemyTag=!!a.checked}
{const wZ=document.getElementById('dcAtkZeonEnemyTagWrap');const z=document.getElementById('dcAtkZeonEnemyTag');if(z&&wZ&&wZ.style.display!=='none')S.dc.applyZeonEnemyTag=!!z.checked}
_dcUpdateCounterOwnAtkUi();
_dcUpdateSupportCounterAtkUi();
_dcUpdateAdvantageEnemyTagUi();_dcUpdateZeonEnemyTagUi();
_dcUpdateZeonEnemyTagUi();
S.dc.dmgTakenDownPilot=parseInt(document.getElementById('dcDmgTakenDownPilot')?.value)||0;
S.dc.dmgTakenDownUnit=parseInt(document.getElementById('dcDmgTakenDownUnit')?.value)||0;
S.dc.defDebuffPct=parseInt(document.getElementById('dcDefDebuffPct')?.value)||0;
S.dc.dtuBeam=parseInt(document.getElementById('dcDtuBeam')?.value)||0;
S.dc.dtuPhysical=parseInt(document.getElementById('dcDtuPhysical')?.value)||0;
S.dc.dtuSpecial=parseInt(document.getElementById('dcDtuSpecial')?.value)||0;
_dcRefreshTotalDebuffsDisplay();
if(S.dc.defNpc)renderDcDefStats();
_dcUpdateDefNpcMapBonusesToggleUi();
_dcRefreshCalcDependentUi();
if(S.dc.atkSlots&&Array.isArray(S.dc.atkSlots)&&S.dc.atkSlots.length){
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
if(si<S.dc.atkSlots.length){
const slSnap=_dcReadAttackerFromDc();
slSnap._pilotDmgCritExplicit=true;
S.dc.atkSlots[si]=slSnap;
}
}
if(_sqPanelChg&&S.dc.atkUnitData&&!S.dc.atkUnitData._manual)renderDcAtkUnit();
else _dcRefreshDcUnitAtkExOnly();
renderDcResult();
}
function _dcRefreshAtkPanelsAfterMods(){
if(!S.dc.atkUnitData){onDcParamChange();return}
renderDcAtkUnit();
if(S.dc.atkCharData)renderDcAtkChar();
onDcParamChange();
}

let _dcPickerDebounce=null;
let _dcPickerSearchAbort=null;
let _dcPickerSearchGen=0;
async function openDcPicker(type){
clearTimeout(_dcPickerDebounce);_dcPickerDebounce=null;
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
_dcPickerSearchGen++;
S._dcPickerType=type;S._dcPickerCache=[];S._dcPickerFullCache=null;
const overlay=document.getElementById('dcPickerOverlay');
overlay.classList.add('active');
const inp=document.getElementById('dcPickerSearch');
const body=document.getElementById('dcPickerBody');
inp.value='';
if(type==='option_parts'||type==='supporter'){
inp.placeholder=type==='supporter'?(t('search_supporter')||'Search name, series, tags…'):'Search by name or keyword…';
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Loading applicable items…</div>';
const hasAtk=!!(S.dc.atkUnit||(S.dc.atkUnitData&&S.dc.atkUnitData._manual));
if(type==='option_parts'&&!hasAtk){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Select an attacker unit first.</div>';setTimeout(()=>inp.focus(),50);return}
if(type==='supporter'&&!hasAtk){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Select an attacker unit first.</div>';setTimeout(()=>inp.focus(),50);return}
try{
if(type==='option_parts'){
const _opAll=await _dcFetchAllListRows('/api/option_parts','rarity=ALL&effect=ALL'+_dcOptionPartUnitQuery());
const _opSi=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
S._dcPickerFullCache=_opAll.filter(r=>!_dcOptionPartRowIsSsr(r)||!_dcDcOptionPartSsrDeniedForSlot(r.id,_opSi));
}else{
S._dcPickerFullCache=await _dcFetchAllListRows('/api/supporters','rarity=ALL'+_dcSupporterUnitCharQuery());
}
S._dcPickerCache=S._dcPickerFullCache||[];
}catch(e){S._dcPickerFullCache=[];S._dcPickerCache=[]}
if(!S._dcPickerCache.length){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">No applicable items.</div>'}else{renderDcPickerList()}
setTimeout(()=>inp.focus(),50);
return;
}
inp.placeholder=(type==='character'||type==='def_character')?'Type to search characters...':'Type to search units...';
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Type at least 2 characters to search</div>';
setTimeout(()=>inp.focus(),50);
}
function closeDcPicker(){
clearTimeout(_dcPickerDebounce);_dcPickerDebounce=null;
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
document.getElementById('dcPickerOverlay').classList.remove('active')}
function filterDcPicker(){
clearTimeout(_dcPickerDebounce);
_dcPickerDebounce=setTimeout(()=>{
_dcPickerDebounce=null;
const t=S._dcPickerType;
if(t==='option_parts'||t==='supporter')_dcFilterDcPickerClientSide();
else _dcDoPickerSearch();
},55);
}
function wireDcPickerBodyClicks(){
const body=document.getElementById('dcPickerBody');
if(!body||body.dataset.dcPickWired)return;
body.dataset.dcPickWired='1';
body.addEventListener('click',function(ev){
const item=ev.target.closest('.tb-picker-item[data-dc-pick-id]');
if(!item)return;
const id=item.getAttribute('data-dc-pick-id');
if(id!=null&&id!=='')pickDcItem(id);
});
body.addEventListener('keydown',function(ev){
if(ev.key!=='Enter'&&ev.key!==' ')return;
const item=ev.target.closest('.tb-picker-item[data-dc-pick-id]');
if(!item||document.activeElement!==item)return;
ev.preventDefault();
const id=item.getAttribute('data-dc-pick-id');
if(id!=null&&id!=='')pickDcItem(id);
});
}
function _dcPickerEntityKind(type){
return(type==='character'||type==='def_character')?'char':'unit';
}
function _dcPickerIsEntityType(type){
return type==='unit'||type==='character'||type==='def_unit'||type==='def_character';
}
function _dcFilterDcPickerClientSide(){
const qRaw=String(document.getElementById('dcPickerSearch').value||'').trim();
const pool=S._dcPickerFullCache||[];
const t=S._dcPickerType;
_dcPickerSearchGen++;
if(t==='supporter'){
if(!qRaw){
S._dcPickerCache=_tbSortPickerEntityRows(pool);
renderDcPickerList();
return;
}
const q=qRaw.toLowerCase();
// Instant local match on name + leader tags (series_tag / skill_tag_data).
S._dcPickerCache=_tbSortPickerEntityRows(pool.filter(r=>_tbPickerRowSearchHay(r).includes(q)));
renderDcPickerList();
// Also query API by name/tags (no unit filter) so tag search covers the full roster.
void _dcSupporterPickerSearch(qRaw);
return;
}
const q=qRaw.toLowerCase();
let rows=!q?pool:pool.filter(r=>_tbPickerRowSearchHay(r).includes(q));
S._dcPickerCache=_tbSortPickerEntityRows(rows);
renderDcPickerList();
}
async function _dcSupporterPickerSearch(qRaw){
const myGen=++_dcPickerSearchGen;
const body=document.getElementById('dcPickerBody');
const haveVisible=!!(S._dcPickerCache&&S._dcPickerCache.length);
if(body&&!haveVisible)body.innerHTML='<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px">Searching...</div>';
try{
// Omit unit_id so tag/name search is not limited to currently applicable leaders.
const rows=await _dcFetchAllListRows('/api/supporters','rarity=ALL',qRaw);
if(myGen!==_dcPickerSearchGen)return;
S._dcPickerCache=_tbSortPickerEntityRows(rows);
renderDcPickerList();
}catch(e){
if(myGen!==_dcPickerSearchGen)return;
if(body)body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">Search failed</div>';
}
}
async function _dcDoPickerSearch(){
const q=document.getElementById('dcPickerSearch').value.trim();
const body=document.getElementById('dcPickerBody');
const type=S._dcPickerType;
if(type==='option_parts'||type==='supporter'){_dcFilterDcPickerClientSide();return}
if(_dcPickerSearchAbort){try{_dcPickerSearchAbort.abort()}catch(_){}_dcPickerSearchAbort=null}
if(q.length<2){
_dcPickerSearchGen++;
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Type at least 2 characters to search</div>';
return
}
const ac=new AbortController();
_dcPickerSearchAbort=ac;
const myGen=++_dcPickerSearchGen;
const base=(type==='character'||type==='def_character')?'/api/characters':'/api/units';
const haveVisible=!!(S._dcPickerCache&&S._dcPickerCache.length);
if(!haveVisible)body.innerHTML='<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px">Searching...</div>';
try{
const r=await fetch(`${base}?lang=${S.lang}&page=1&per_page=50&sort=rarity&dir=desc&q=${encodeURIComponent(q)}`,{signal:ac.signal});
const d=await r.json();
if(myGen!==_dcPickerSearchGen)return;
S._dcPickerCache=_tbSortPickerEntityRows(d.rows||[]);
renderDcPickerList();
}catch(e){
if(e&&e.name==='AbortError')return;
if(myGen!==_dcPickerSearchGen)return;
body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">Search failed</div>'}
}
function renderDcPickerList(){
const items=S._dcPickerCache;
const body=document.getElementById('dcPickerBody');
const type=S._dcPickerType;
if(!items.length){body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">No results</div>';return}
const th=52;
if(type==='supporter'){
const cells=_tbSortPickerEntityRows(items).map(r=>renderSupporterPickerCell(r,th,'data-dc-pick-id')).join('');
body.innerHTML=`<div class="tb-picker-grid tb-picker-grid--rich">${cells}</div>`;
return;
}
if(type==='option_parts'){
const cells=_tbSortPickerEntityRows(items).map(r=>renderOptionPartPickerCell(r,th,'data-dc-pick-id')).join('');
body.innerHTML=`<div class="tb-picker-option-list tb-picker-option-list--rich">${cells}</div>`;
return;
}
if(_dcPickerIsEntityType(type)){
const kind=_dcPickerEntityKind(type);
const cells=_tbSortPickerEntityRows(items).map(r=>renderEntityPickerItemCell(r,kind,th,'data-dc-pick-id')).join('');
body.innerHTML=`<div class="tb-picker-grid">${cells}</div>`;
return;
}
const RARITY_COLORS={'UR':'#fbbf24','SSR':'#f97316','SR':'#a78bfa','R':'#60a5fa','N':'#94a3b8'};
body.innerHTML=items.map(r=>{
const rc=RARITY_COLORS[r.rarity]||'#94a3b8';
const rarBadge=`<span style="color:${rc};font-weight:600;font-size:11px;margin-right:4px">${esc(r.rarity||'')}</span>`;
const roleBadge=r.role?`<span style="color:var(--text-muted);font-size:11px">${esc(r.role)}</span>`:'';
return`<div class="cmp-picker-item" onclick='pickDcItem(${JSON.stringify(String(r.id))})' style="padding:8px 12px;cursor:pointer">
<div><div style="display:flex;align-items:center;gap:6px">${rarBadge}<span class="cmp-picker-item-name" style="font-size:13px">${esc(r.name)}</span>${roleBadge}</div></div></div>`
}).join('');
}

async function pickDcItem(id){
const type=S._dcPickerType;
closeDcPicker();
try{
if(type==='def_unit'){
const r=await fetch(`/api/unit/${encodeURIComponent(id)}?lang=${S.lang}`);const d=await r.json();
if(d.error)return;
S.dc.defUnitData=d;
const rec=d.recommend_character;const isSD=String(d.body_type||'')==='3';
if(rec&&rec.id){
if(isSD){
try{const cr=await fetch(`/api/character/${encodeURIComponent(rec.id)}?lang=${S.lang}`);const cd=await cr.json();if(!cd.error)S.dc.defCharData=cd}catch(_){}
}else if(!S.dc.defCharData){
try{const cr=await fetch(`/api/character/${encodeURIComponent(rec.id)}?lang=${S.lang}`);const cd=await cr.json();if(!cd.error)S.dc.defCharData=cd}catch(_){}
}
}
_dcSyncDefNpcFromDatabase();
return;
}
if(type==='def_character'){
const ud=S.dc.defUnitData;
if(ud&&String(ud.body_type||'')==='3')return;
const r=await fetch(`/api/character/${encodeURIComponent(id)}?lang=${S.lang}`);const d=await r.json();
if(d.error)return;
S.dc.defCharData=d;
_dcSyncDefNpcFromDatabase();
return;
}
if(type==='option_parts'){await selectDcOptionPart(id);return}
if(type==='supporter'){await selectDcSupporter(id);return}
const url=type==='character'?`/api/character/${encodeURIComponent(id)}?lang=${S.lang}`:`/api/unit/${encodeURIComponent(id)}?lang=${S.lang}`;
const r=await fetch(url);const d=await r.json();
if(type==='unit'){
S.dc.atkUnit=id;S.dc.atkUnitData=d;
const _bw=_dcPickBestWeaponIndices(d);
S.dc.wpnIdx=_bw.wpnIdx;S.dc.wpnLv=_bw.wpnLv;
S.dc.unitStatMode='normal';S.dc.unitCondPassive=false;S.dc.unitTurnBuffAtk=false;S.dc.unitTurnBuffDef=false;
S.dc.optionParts=[];S.dc.supporters=[];
_dcDetectVigorCondAbilities(d);
const rec=d.recommend_character;const isSD=d.body_type==='3';
S.dc._unitIsSD=isSD;
if(rec&&rec.id&&(!S.dc.atkCharData||S.dc.atkCharData.id!==rec.id)){
try{const cr=await fetch(`/api/character/${rec.id}?lang=${S.lang}`);const cd=await cr.json();
S.dc.atkChar=rec.id;S.dc.atkCharData=cd;S.dc.charStatMode='normal';S.dc.dcSuperchargedExTier=0;}catch(_){}
}
}else{
S.dc.atkChar=id;S.dc.atkCharData=d;S.dc.charStatMode='normal';S.dc.dcSuperchargedExTier=0;
S.dc.optionParts=[];S.dc.supporters=[];
}
_dcSyncCharCondPassiveFromPair();
const autoV=S.dc.atkCharData&&_dcShouldAutoSuperchargedVigorOnCharCp(S.dc.atkCharData);
if(autoV)setDcMp('super');
else _dcAutoSetVigor();
if(_dcCharShouldShowSquadCondUi(S.dc.atkCharData,S.dc.atkUnitData))S.dc.squadCondPct=_dcDefaultSquadCondPctForCdUd(S.dc.atkCharData,S.dc.atkUnitData);
else S.dc.squadCondPct=0;
renderDcAtkUnit();renderDcAtkChar();
renderDcOptionParts();renderDcSupporters();
_dcSyncAtkModeUiFromState();
if(S.dc.atkCharData&&!S.dc.atkCharData._manual)_dcRecalcPilotBonuses(true);
else onDcParamChange();
_dcScheduleAutoFitOptionPartAndSupporter();
}catch(e){}
}

function _dcGetCharAtkStat(charStats,wpn){
const atkTypes=_dcWeaponAtkStatKeys(wpn);
const unique=[...new Set(atkTypes)];
if(unique.length===1)return _dcFindStat(charStats,unique[0]);
return Math.max(...unique.map(s=>_dcFindStat(charStats,s)));
}
/** Parse one skill description for Ranged/Melee/Awaken % (and ATK% to all three). Pair/triple lines do not short-circuit ATK% or extra single-stat sentences in the same text.
 * EN data often uses "by25%" (no space); JA/HK/TW use 自身射擊值提升25%（1回合） etc.
 * optMeta: optional { id, name } for Awaken Boost fallback (LV in name / trait id 200170[1-5]01) when description text is missing in some locales. */
function _dcParseSkillDescAtkPct(desc,optMeta){
const out={Ranged:0,Melee:0,Awaken:0};
const raw=[desc,optMeta&&optMeta.name||'',optMeta&&optMeta.id!=null?String(optMeta.id):''].filter(Boolean).join('\n');
if(!raw.trim())return out;
const s=String(raw);
const pairRe=/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/gi;
let mp;
while((mp=pairRe.exec(s))!==null){const p=parseInt(mp[3],10)||0;out[mp[1]]+=p;out[mp[2]]+=p;}
const mTri=s.match(/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s+and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/i);
if(mTri){const p=parseInt(mTri[4],10)||0;out[mTri[1]]+=p;out[mTri[2]]+=p;out[mTri[3]]+=p;}
const mTriOx=s.match(/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s*,\s*and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%/i);
if(mTriOx){const p=parseInt(mTriOx[4],10)||0;out[mTriOx[1]]+=p;out[mTriOx[2]]+=p;out[mTriOx[3]]+=p;}
const singleRe=/Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+by\s*(\d+)%/gi;
let mm;
while((mm=singleRe.exec(s))!==null){out[mm[1]]+=parseInt(mm[2],10)||0;}
const mAtk=s.match(/Increases?\s+(?:own\s+)?(?:ATK|Attack)\s+by\s*(\d+)%/i);
if(mAtk){const p=parseInt(mAtk[1],10)||0;out.Ranged+=p;out.Melee+=p;out.Awaken+=p;}
const zhMap={射擊值:'Ranged',格鬥值:'Melee',覺醒值:'Awaken'};
const zhComb=s.match(/自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%/);
if(zhComb){
const p=parseInt(zhComb[3],10)||0;
const k0=zhMap[zhComb[1]];if(k0)out[k0]+=p;
const rest=zhComb[2]||'';let zm;const zre=/及(射擊值|格鬥值|覺醒值)/g;
while((zm=zre.exec(rest))!==null){const kk=zhMap[zm[1]];if(kk)out[kk]+=p;}
}else{
const mR=s.match(/自身射擊值提升(\d+)%/);if(mR)out.Ranged+=parseInt(mR[1],10)||0;
const mM=s.match(/自身格鬥值提升(\d+)%/);if(mM)out.Melee+=parseInt(mM[1],10)||0;
const mA=s.match(/自身[覚覺]醒值提升(\d+)%/);if(mA)out.Awaken+=parseInt(mA[1],10)||0;
}
const jaMap={射撃値:'Ranged',格闘値:'Melee',覚醒値:'Awaken'};
const jaPilot=/自身の(射撃値|格闘値|覚醒値)が(\d+)(?:%|％)上昇/g;
let jm;
while((jm=jaPilot.exec(s))!==null){const kk=jaMap[jm[1]];if(kk)out[kk]+=parseInt(jm[2],10)||0;}
if(out.Awaken===0){
const lvFrom=(txt)=>{
let m=txt.match(/覚醒ブースト\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
m=txt.match(/Awaken\s+Boost\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
m=txt.match(/覺醒值增幅\s*LV\.?\s*(\d+)/i);if(m)return parseInt(m[1],10)||0;
return 0;
};
let lv=lvFrom(s);
if(lv>=1&&lv<=5)out.Awaken=lv*5;
}
if(out.Awaken===0&&optMeta&&optMeta.id!=null){
const sid=String(optMeta.id);
const idM=sid.match(/^200170([1-5])01$/);
if(idM){const lv=parseInt(idM[1],10);if(lv>=1&&lv<=5)out.Awaken=lv*5;}
}
return out;
}
function _dcGetActiveSkillStatPct(){
const out={Ranged:0,Melee:0,Awaken:0};
if(!S.dc._pilotSkills||!S.dc._activeSkills)return out;
S.dc._pilotSkills.forEach(sk=>{
if(!S.dc._activeSkills[sk.id])return;
const rsk=_dcResolveSkillForDcMode(sk);
const detailLines=(rsk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join(' ');
const desc=[detailLines,rsk.desc||'',rsk.sp_desc||''].filter(Boolean).join(' ');
const add=_dcParseSkillDescAtkPct(desc,{id:sk.id,name:rsk.name||sk.name||''});
out.Ranged+=add.Ranged;out.Melee+=add.Melee;out.Awaken+=add.Awaken;
});
return out;
}
function _dcGetCharAtkStatWithSkills(charStats,wpn){
const sk=_dcGetActiveSkillStatPct();
const atkTypes=_dcWeaponAtkStatKeys(wpn);
const unique=[...new Set(atkTypes)];
const val=(k)=>k==='Awaken'?_dcPilotAwakenAdjustedForDc(charStats,sk[k]||0):_dcPilotSkillAdjustedStat(charStats,k,sk[k]||0);
if(unique.length===1)return val(unique[0]);
return Math.max(...unique.map(val));
}
function _dcParseOptionPartBonuses(details){
const bonuses={HP:{flat:0,pct:0},EN:{flat:0,pct:0},Attack:{flat:0,pct:0},Defense:{flat:0,pct:0},Mobility:{flat:0,pct:0},Move:{flat:0,pct:0}};
if(!details)return bonuses;
const norm=String(details).replace(/\r\n/g,'\n').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
const statMap={ATK:'Attack',DEF:'Defense',MOB:'Mobility',MOV:'Move'};
const add=(k,v,isPct)=>{const key=k in statMap?statMap[k]:k;if(bonuses[key]){if(isPct)bonuses[key].pct+=v;else bonuses[key].flat+=v}};
const p=/(?:Increase|Increases?)\s+(?:squad\s+)?(?:own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)(?:\s*,\s*(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))*(?:\s+and\s+(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))?\s+by\s*(\d+)(%?)/gi;
let m;while((m=p.exec(norm))!==null){const val=parseInt(m[4],10)||0;const isPct=m[5]==='%';const keys=[m[1],m[2],m[3]].filter(Boolean);keys.forEach(k=>add(k,val,isPct))}
const incAnd=/\s+and\s+(?:increase|increases)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=incAnd.exec(norm))!==null){const val=parseInt(m[2],10)||0;const isPct=m[3]==='%';add(m[1],val,isPct)}
const dec=/(?:Decrease|Decreases|Reduce|Reduces|Lower|Lowers)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=dec.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const decPass=/\b(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+(?:is\s+)?(?:decreased|reduced|lowered)\s+by\s*(\d+)(%?)/gi;
while((m=decPass.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const decTail=/[;，、]\s*(?:but\s+)?(?:decrease|decreases|reduce|reduces|lower|lowers)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=decTail.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%';add(m[1],val,isPct)}
const statNegPct=/(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s*[:：]?\s*[-−](\d+)(%|％)/gi;
while((m=statNegPct.exec(norm))!==null){const val=-(parseInt(m[2],10)||0);const isPct=m[3]==='%'||m[3]==='％';add(m[1],val,isPct)}
const incTail=/[;，、]\s*(?:and\s+)?(?:increase|increases)\s+(?:squad\s+|own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)\s+by\s*(\d+)(%?)/gi;
while((m=incTail.exec(norm))!==null){const val=parseInt(m[2],10)||0;const isPct=m[3]==='%';add(m[1],val,isPct)}
const jaStat='(最大HP|最大EN|攻撃力|防御力|機動力|移動力)';
const jaMap={最大HP:'HP',最大EN:'EN',攻撃力:'Attack',防御力:'Defense',機動力:'Mobility',移動力:'Move'};
const jaDual=new RegExp('(?:自部隊の|自身の)'+jaStat+'と'+jaStat+'が(\\d+)(%?)(上昇|減少)','g');
while((m=jaDual.exec(norm))!==null){const v=parseInt(m[3],10)||0;const isPct=m[4]==='%';const sign=m[5]==='減少'?-1:1;[m[1],m[2]].forEach(st=>{const k=jaMap[st];if(k)add(k,sign*v,isPct)})}
const jaSing=new RegExp('(?:自部隊の|自身の)'+jaStat+'が(\\d+)(%?)(上昇|減少)','g');
while((m=jaSing.exec(norm))!==null){const v=parseInt(m[2],10)||0;const isPct=m[3]==='%';const sign=m[4]==='減少'?-1:1;const k=jaMap[m[1]];if(k)add(k,sign*v,isPct)}
const twStat='(最大HP|最大EN|攻擊力|防禦力|機動力|移動力)';
const twMap={最大HP:'HP',最大EN:'EN',攻擊力:'Attack',防禦力:'Defense',機動力:'Mobility',移動力:'Move'};
const twDual=new RegExp('自身'+twStat+'及'+twStat+'(提升|減少)(\\d+)(%?)','g');
while((m=twDual.exec(norm))!==null){const sign=m[3]==='減少'?-1:1;const v=parseInt(m[4],10)||0;const isPct=m[5]==='%';[m[1],m[2]].forEach(st=>{const k=twMap[st];if(k)add(k,sign*v,isPct)})}
const twSing=new RegExp('(?:自身所屬部隊|自身)'+twStat+'(提升|減少)(\\d+)(%?)','g');
while((m=twSing.exec(norm))!==null){const sign=m[2]==='減少'?-1:1;const v=parseInt(m[3],10)||0;const isPct=m[4]==='%';const k=twMap[m[1]];if(k)add(k,sign*v,isPct)}
return bonuses;
}
function _dcLeaderPctFromLeaderSkillDesc(d){
const s=String(d||'').normalize('NFKC');
let m=s.match(/by\s+(\d+)\s*[%％]/i);
if(m)return parseInt(m[1],10)||0;
m=s.match(/(\d+)\s*[%％]\s*上昇/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/全能力值(\d+)\s*[%％]/);
if(m)return parseInt(m[1],10)||0;
m=s.match(/能力值(\d+)\s*[%％]/);
if(m)return parseInt(m[1],10)||0;
return 0;
}
function _dcLeaderSkillPctAndFlags(supporters){
let pct=0;
(supporters||[]).forEach(s=>{
let best=0;
(s.leader_skills||[]).forEach(ls=>{
if(ls.applies===false)return;
const v=_dcLeaderPctFromLeaderSkillDesc(ls.desc||'');
if(v>best)best=v;
});
pct+=best;
});
return{pct};
}
/** EX squad ATK % applies to the MS growth Attack line after option-part Attack % (if any), not raw LB alone — not MS ability Attack bonuses. Supporter leader % on Attack applies after EX on that growth line. */
function _dcApplyExSquadToUnitAtk(unitAtkFull,unitAtkExBase,exPct){
const F=Math.floor;
const p=Math.min(20,Math.max(0,exPct|0));
if(p<=0)return unitAtkFull;
const b=F(Math.max(0,Number(unitAtkExBase)||0));
const full=F(Math.max(0,Number(unitAtkFull)||0));
return F(b*(100+p)/100)+(full-b);
}
/** Supporter leader % on Attack applies after EX squad, to the EX-boosted growth line only. bGrowthForEx = growth after option-part Attack % (same value passed to EX). */
function _dcApplyLeaderPctToAttackAfterEx(unitAtkAfterEx,bGrowthForEx,exSq,leaderPct){
const F=Math.floor;
const lp=leaderPct|0;
if(lp<=0)return unitAtkAfterEx;
const ex=Math.min(20,Math.max(0,exSq|0));
const b=F(Math.max(0,Number(bGrowthForEx)||0));
const gEx=F(b*(100+ex)/100);
const aAtk=F(unitAtkAfterEx)-gEx;
return F(gEx*(100+lp)/100)+aAtk;
}
/** EX abilities that buff the paired MS (see pair_unit_stat_mod from API) — after EX squad and supporter leader on Attack, same as in-game. */
function _dcPilotPairUnitAtkDefPct(unitAtk,unitDefVal){
const F=Math.floor;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_stat_mod;
if(!pm||!ud||ud._manual)return{unitAtk,unitDefVal};
const uid=String(ud.id||'');
const row=pm[uid];
if(!row||!S.dc.charCondPassive)return{unitAtk,unitDefVal};
let a=unitAtk,d=unitDefVal;
if(row.atk_pct)a=F(a*(100+row.atk_pct)/100);
if(row.def_pct)d=F(d*(100+row.def_pct)/100);
return{unitAtk:a,unitDefVal:d};
}
function _dcGetCounterOwnAtkPct(){
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_counter_atk_mod;
if(!pm||!ud||ud._manual||!S.dc.charCondPassive||!S.dc.atkCounterOwnAtk)return 0;
const v=pm[String(ud.id)];
return Number.isFinite(v)?(v|0):0;
}
function _dcApplyCounterOwnAtkToUnitAtk(unitAtk){
const F=Math.floor;
const p=_dcGetCounterOwnAtkPct();
if(p<=0)return unitAtk;
return F(Math.max(0,Number(unitAtk)||0)*(100+p)/100);
}
function _dcNormalizeTagToken(s){
if(!s)return'';
return String(s).replace(/^\s*TAG:\s*/i,'').trim().toLowerCase();
}
function _dcNpcTagTokenSet(npc){
const out=new Set();
if(!npc)return out;
const addArr=(arr)=>{(arr||[]).forEach(t=>{if(t&&t.name){const n=_dcNormalizeTagToken(t.name);if(n)out.add(n)}})};
if(npc.unit)addArr(npc.unit.tags);
if(npc.character)addArr(npc.character.tags);
return out;
}
/** Defender has Psycommu tag — used to auto-enable Advantage (enemy tag) when the attacker has the ability. */
function _dcNpcDefHasPsycommuTag(npc){
if(!npc)return false;
for(const t of _dcNpcTagTokenSet(npc)){if(t.includes('psycommu'))return true}
return false;
}
function _dcCollectTargetTagRequirementNames(detail){
const names=[];
const pushC=(arr)=>{(arr||[]).forEach(c=>{if(c&&c.name)names.push(c.name)})};
let fromTarget=false;
if(detail.condition_groups){
for(const g of detail.condition_groups){
const lab=String(g.label||'');
if(/target\s*tags?/i.test(lab)){
fromTarget=true;
pushC(g.conditions);
}
}
}
if(!fromTarget||!names.length)pushC(detail.conditions);
return names;
}
function _dcTagRequirementMatches(requiredNames,defTokens){
if(!requiredNames||!requiredNames.length||!defTokens||!defTokens.size)return false;
for(const req of requiredNames){
const r=_dcNormalizeTagToken(req);
if(!r)continue;
for(const dt of defTokens){
if(dt===r||dt.includes(r)||r.includes(dt))return true;
}
}
return false;
}
function _dcUnitHasEnemyTagAdvantageAbility(ud){
if(!ud||ud._manual||!(ud.abilities||[]).length)return false;
for(const ab of ud.abilities){
for(const d of ab.details||[]){
const det=typeof d==='string'?{text:d,conditions:[],condition_groups:[]}:d;
if(!det||!det.text)continue;
if(!_dcIsEnemyTagAdvantageAtkDefLine(det.text))continue;
if((_dcExtractAdvantageAtkDefPct(det.text)|0)<=0)continue;
return true;
}
}
return false;
}
function _dcIsEnemyTagAdvantageAtkDefLine(txt){
const low=String(txt||'').toLowerCase();
if(low.includes('piloting'))return false;
if(!low.includes('specified tag'))return false;
if(!low.includes('enem')&&!low.includes('opponent'))return false;
return /increase own atk and def by \d+%/i.test(txt);
}
function _dcExtractAdvantageAtkDefPct(detailText){
const m=String(detailText||'').match(/Increase own ATK and DEF by (\d+)%/i);
if(m)return parseInt(m[1],10)||0;
const m2=String(detailText||'').match(/increase own ATK and DEF by (\d+)%/i);
if(m2)return parseInt(m2[1],10)||0;
return 0;
}
function _dcAbilityNameFallbackAdvantageTag(ab){
const m=String(ab.name||'').match(/Advantage:\s*(.+?)\s+LV\s*\d/i);
if(!m)return'';
return m[1].trim();
}
function _dcAdvantageTagAtkPctCore(ud,npc){
if(!ud||ud._manual||!npc)return 0;
const defTags=_dcNpcTagTokenSet(npc);
if(!defTags.size)return 0;
let total=0;
for(const ab of ud.abilities||[]){
for(const d of ab.details||[]){
const det=typeof d==='string'?{text:d,conditions:[],condition_groups:[]}:d;
if(!det||!det.text)continue;
const txt=det.text;
if(!_dcIsEnemyTagAdvantageAtkDefLine(txt))continue;
const pct=_dcExtractAdvantageAtkDefPct(txt);
if(pct<=0)continue;
let req=_dcCollectTargetTagRequirementNames(det);
if(!req.length){
const fb=_dcAbilityNameFallbackAdvantageTag(ab);
if(fb)req=[fb];
}
if(_dcTagRequirementMatches(req,defTags))total+=pct;
}
}
return Math.min(100,total);
}
function _dcAdvantageTagAtkPctFromAbilities(ud,npc){
if(S.dc.applyAdvantageEnemyTag===false)return 0;
return _dcAdvantageTagAtkPctCore(ud,npc);
}
function _dcApplyAutoAdvantageForPsycommuDefender(){
const ud=S.dc.atkUnitData,npc=S.dc.defNpc;
if(!ud||ud._manual||!npc||!_dcUnitHasEnemyTagAdvantageAbility(ud))return;
if(!_dcNpcDefHasPsycommuTag(npc))return;
if(_dcAdvantageTagAtkPctCore(ud,npc)<=0)return;
S.dc.applyAdvantageEnemyTag=true;
}
/** In-game Advantage: +floor(X% × reference), not +X% on total MS ATK. Reference = raw LB Attack base (column base before MS passive % / option / EX / leader / supporter — matches in-game vs inflated unitAtkExSquadBase). */
function _dcApplyAdvantageTagAtkToUnitAtk(unitAtk,advPct,rawGrowthAtk){
const F=Math.floor,p=advPct|0;
if(p<=0)return unitAtk;
const ua=F(Math.max(0,Number(unitAtk)||0));
const rg=F(Math.max(0,Number(rawGrowthAtk)||0));
return ua+F(rg*p/100);
}
function _dcJoinUnitSkillTextBlob(sk){
const lines=(sk.details||[]).map(d=>typeof d==='string'?d:(d&&d.text)||'').join('\n');
return[sk.name,lines].filter(Boolean).join('\n');
}
/** Scan unit skill text for short self-buffs like "Increase ATK by 25% [1 turn]" (EN/JP/TW-style). Max per stat across skills. */
function _dcParseUnitTurnStatBuffPercents(blob){
const s=String(blob||'');
const hasTurn=/\[\s*1\s*turns?\s*\]|(?:^|[\s\n])for\s+1\s+turn\b|1ターン|１ターン|1\s*回合/i.test(s);
if(!hasTurn)return{atk:0,def:0};
let atk=0,def=0;
const mAtk=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?ATK\s+by\s+(\d+)%/i);
if(mAtk)atk=Math.max(atk,parseInt(mAtk[1],10)||0);
const mAtk2=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?Attack\s+by\s+(\d+)%/i);
if(mAtk2)atk=Math.max(atk,parseInt(mAtk2[1],10)||0);
const mDef=s.match(/\b(?:Increase|Increases)\s+(?:MS\s+)?DEF(?:ense)?\s+by\s+(\d+)%/i);
if(mDef)def=Math.max(def,parseInt(mDef[1],10)||0);
const mj=s.match(/攻(?:擊|撃|击)力[^%]*?(\d+)\s*%/);
if(mj)atk=Math.max(atk,parseInt(mj[1],10)||0);
const dj=s.match(/防(?:禦|御|卫)力[^%]*?(\d+)\s*%/);
if(dj)def=Math.max(def,parseInt(dj[1],10)||0);
return{atk,def};
}
function _dcGetDetectedUnitTurnBuffPercents(ud){
const skills=(ud&&!ud._manual&&ud.skills)||[];
let atkPct=0,defPct=0;
skills.forEach(sk=>{
const x=_dcParseUnitTurnStatBuffPercents(_dcJoinUnitSkillTextBlob(sk));
atkPct=Math.max(atkPct,x.atk);
defPct=Math.max(defPct,x.def);
});
return{atkPct,defPct};
}
function _dcApplyUnitTurnBuffDefToMsDef(unitDef,ud){
const F=Math.floor;
if(!ud||ud._manual||!S.dc.unitTurnBuffDef)return unitDef;
const p=_dcGetDetectedUnitTurnBuffPercents(ud).defPct|0;
if(p<=0)return unitDef;
const d=F(Math.max(0,Number(unitDef)||0));
return d+F(d*p/100);
}
function _dcUpdateCounterOwnAtkUi(){
const w=document.getElementById('dcAtkCounterOwnAtkWrap');
const cb=document.getElementById('dcAtkCounterOwnAtk');
if(!w||!cb)return;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const pm=cd&&cd.pair_unit_counter_atk_mod;
const uid=ud&&!ud._manual?String(ud.id||''):'';
const pct=pm&&uid?pm[uid]:0;
const show=!!pct;
w.style.display=show?'':'none';
if(!show||!S.dc.charCondPassive){
cb.checked=false;
S.dc.atkCounterOwnAtk=false;
cb.disabled=true;
return;
}
cb.disabled=false;
}
function _dcUpdateSupportCounterAtkUi(){
const w=document.getElementById('dcAtkSupportCounterWrap');
const tog=document.getElementById('dcAtkSupportCounterToggle');
const lbl=document.getElementById('dcAtkSupportCounterLbl');
if(!w||!tog)return;
const cd=S.dc.atkCharData,ud=S.dc.atkUnitData;
const si=Math.min(Math.max(S.dc.atkSlotIndex|0,0),DC_ATK_SLOT_COUNT-1);
const snapMap=S.dc._supportCntAtkPairSnapBySlot=S.dc._supportCntAtkPairSnapBySlot||{};
const rawPct=cd&&!cd._manual?_dcParseMaxSupportCounterAtkPctFromChar(cd,ud)|0:0;
S.dc._supportCounterAtkPct=rawPct;
const pilotOk=rawPct>0;
const unitOk=!!(ud&&!ud._manual&&String(ud.role_id)==='3');
const cid=cd&&!cd._manual?String(cd.id||''):'';
if(!pilotOk||rawPct<=0){
w.style.display='none';
w.classList.remove('is-disabled');
w.style.opacity='';
snapMap[si]=null;
S.dc.supportCounterAtk=false;
S.dc._supportCounterAtkPct=0;
tog.classList.remove('active');
tog.setAttribute('aria-pressed','false');
tog.tabIndex=-1;
_dcSyncSupportCounterHighlight();
return;
}
w.style.display='';
if(!unitOk){
S.dc.supportCounterAtk=false;
snapMap[si]=null;
tog.classList.remove('active');
tog.setAttribute('aria-pressed','false');
w.classList.add('is-disabled');
w.style.opacity='0.55';
tog.tabIndex=-1;
_dcApplySupportCounterLang(rawPct);
if(lbl){
lbl.textContent=t('dc_support_counter_desc').replace('{pct}',String(rawPct));
lbl.title=t('dc_support_counter_tip_disabled');
}
_dcSyncSupportCounterHighlight();
return;
}
w.style.opacity='';
w.classList.remove('is-disabled');
const kNow=`${cid}|${String(ud.id||'')}|${rawPct}`;
const prev=snapMap[si]!=null?String(snapMap[si]):null;
if(prev!==kNow)S.dc.supportCounterAtk=true;
snapMap[si]=kNow;
tog.tabIndex=0;
_dcApplySupportCounterLang(rawPct);
if(lbl){
lbl.textContent=t('dc_support_counter_desc').replace('{pct}',String(rawPct));
lbl.title=t('dc_support_counter_tip_enabled');
}
const onv=!!S.dc.supportCounterAtk;
tog.classList.toggle('active',onv);
tog.setAttribute('aria-pressed',onv?'true':'false');
_dcSyncSupportCounterHighlight();
}
function _dcUpdateAdvantageEnemyTagUi(){
const w=document.getElementById('dcAtkAdvantageEnemyTagWrap');
const cb=document.getElementById('dcAtkAdvantageEnemyTag');
if(!w||!cb)return;
const ud=S.dc.atkUnitData;
const has=_dcUnitHasEnemyTagAdvantageAbility(ud);
if(!has){
w.style.display='none';
cb.checked=false;
S.dc.applyAdvantageEnemyTag=false;
cb.disabled=true;
return;
}
w.style.display='';
cb.disabled=false;
_dcApplyAutoAdvantageForPsycommuDefender();
cb.checked=S.dc.applyAdvantageEnemyTag!==false;
}
function _dcSelectedWeaponEnemyTagTraits(){
const ud=S.dc.atkUnitData;if(!ud||!ud.weapons)return null;
const wpns=_dcNonMapWeapons(ud);const wpn=wpns[S.dc.wpnIdx];if(!wpn)return null;
const wt=_dcParseWeaponTraits(wpn,S.dc.wpnLv);
if(!(wt.enemyTagWpMaxBonus|0)&&!(wt.enemyTagDefBonus|0))return null;
return{wpn,wt};
}
function _dcNpcDefHasWeaponEnemyTag(npc,tagKey){
if(!npc||!tagKey)return false;
const req=[tagKey];
return _dcTagRequirementMatches(req,_dcNpcTagTokenSet(npc));
}
function _dcApplyAutoZeonForMatchingDefender(wt){
if(!wt||!wt.enemyTagKey)return;
const npc=S.dc.defNpc;
if(_dcNpcDefHasWeaponEnemyTag(npc,wt.enemyTagKey))S.dc.applyZeonEnemyTag=true;
}
function onDcZeonEnemyTagChange(){
const cb=document.getElementById('dcAtkZeonEnemyTag');
if(cb)S.dc.applyZeonEnemyTag=!!cb.checked;
onDcParamChange();
}
function _dcUpdateZeonEnemyTagUi(){
const w=document.getElementById('dcAtkZeonEnemyTagWrap');
const cb=document.getElementById('dcAtkZeonEnemyTag');
const lbl=document.getElementById('dcAtkZeonEnemyTagLbl');
if(!w||!cb)return;
const info=_dcSelectedWeaponEnemyTagTraits();
if(!info){
w.style.display='none';
cb.disabled=true;
return;
}
const tagName=(info.wt.enemyTagKey||'zeon').replace(/\b\w/g,c=>c.toUpperCase());
const bits=[];
if(info.wt.enemyTagWpMaxBonus|0)bits.push('+'+((info.wt.enemyTagWpMaxBonus|0))+'% WP max');
if(info.wt.enemyTagDefBonus|0)bits.push('+'+((info.wt.enemyTagDefBonus|0))+'% DEF down');
if(lbl){
lbl.textContent=tagName+' tag (weapon: '+bits.join(', ')+')';
lbl.title='When on, “When engaging enemies that include '+tagName+' tag…” weapon lines apply. Auto-on when the defender has that tag.';
}
w.style.display='';
cb.disabled=false;
_dcApplyAutoZeonForMatchingDefender(info.wt);
cb.checked=S.dc.applyZeonEnemyTag!==false;
}
/** Green +lines under MS HP/ATK/DEF/MOB: % bucket uses floor to match database stat display and in-game damage (same as panel MS ATK). */
function _dcMsStatEnhancementLinesHtml(ctx,atkUnitStats){
const F=Math.floor;
const c=ctx||{};
const mlPct=c.masterLeagueBuff?50:0;
const goPct=c.grandOffensiveBuff?100:0;
const sheetBuffPct=mlPct+goPct;
const opFlat={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
const opPct={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
(c.optionParts||[]).forEach(op=>{const b=_dcParseOptionPartBonuses(op.details);['Attack','HP','Defense','Mobility','Move'].forEach(k=>{opFlat[k]+=b[k].flat;opPct[k]+=b[k].pct})});
let hpSupport=0,atkSupport=0,leaderPct=0;
(c.supporters||[]).forEach(s=>{hpSupport+=Number(s.hp_support)||0;atkSupport+=Number(s.atk_support)||0});
leaderPct=_dcLeaderSkillPctAndFlags(c.supporters).pct;
const lp=leaderPct|0;
const atkEnt=_dcFindStatEntry(atkUnitStats,'Attack');
const defEnt=_dcFindStatEntry(atkUnitStats,'Defense');
const hpEnt=_dcFindStatEntry(atkUnitStats,'HP');
const mobEnt=_dcFindStatEntry(atkUnitStats,'Mobility');
const atkBase=F(Math.max(0,atkEnt?atkEnt.base:0));
const defBase=F(Math.max(0,defEnt?defEnt.base:0));
const hpBase=F(Math.max(0,hpEnt?hpEnt.base:0));
const mobBase=F(Math.max(0,mobEnt?mobEnt.base:0));
const pAtk=_dcStatPassivePctFromEntry(atkEnt);
const pDef=_dcStatPassivePctFromEntry(defEnt);
const pHp=_dcStatPassivePctFromEntry(hpEnt);
const pMob=_dcStatPassivePctFromEntry(mobEnt);
const opAt=opPct.Attack||0;
let turnAtkPct=0;
if(c.unitTurnBuffAtk&&c.atkUnitData&&!c.atkUnitData._manual)turnAtkPct=Math.max(0,_dcGetDetectedUnitTurnBuffPercents(c.atkUnitData).atkPct|0);
const tAtk=turnAtkPct|0;
function L(n,longT){const v=Math.max(0,Math.floor(Number(n)||0));if(!v)return'';return`<div class="stat-card-bonus" title="${escAttr(longT)}">+${fmtN(v)}</div>`}
const coreHp=F(hpBase*(100+pHp)/100);
const pctHp=F(hpBase*(100+pHp+(opPct.HP|0)+lp+sheetBuffPct)/100)-coreHp;
const hpHtml=L(pctHp,'Option part %, leader skill %, Master League / Grand Offensive (HP)')+L(opFlat.HP|0,'Option part flat HP')+L(hpSupport|0,'Supporter HP support');
const scAtk=c.squadCondAtkPct|0;
const scDef=c.squadCondDefPct|0;
const supCnt=_dcEffectiveSupportCounterAtkPctFromCtx(c);
const coreDef=F(defBase*(100+pDef)/100);
const pctDef=F(defBase*(100+pDef+(opPct.Defense|0)+lp+sheetBuffPct+(scDef|0))/100)-coreDef;
const defHtml=L(pctDef,'Option part %, leader skill %, Master League / Grand Offensive (DEF)'+(scDef?' · Squad conditions':''))+L(opFlat.Defense|0,'Option part flat Defense');
const coreMob=F(mobBase*(100+pMob)/100);
const pctMob=F(mobBase*(100+pMob+(opPct.Mobility|0)+lp+sheetBuffPct)/100)-coreMob;
const mobHtml=L(pctMob,'Option part %, leader skill %, Master League / Grand Offensive (MOB)')+L(opFlat.Mobility|0,'Option part flat Mobility');
const coreAtk=F(atkBase*(100+pAtk)/100);
const pctAtkNoEx=F(atkBase*(100+pAtk+opAt+tAtk+sheetBuffPct+lp+(scAtk|0)+(supCnt|0))/100)-coreAtk;
const atkHtml=L(pctAtkNoEx,'Option part %, 1-turn MS ATK %, leader %, ML/GO, squad conditions, Support Attack/Counter % (EX squad % is on the EX line below)')+L(opFlat.Attack|0,'Option part flat Attack')+L(atkSupport|0,'Supporter ATK support');
return{hpHtml,atkHtml,defHtml,mobHtml};
}
/** opts.useFloor: probe-only — force floor on % buckets. Default ceil matches in-game MS sheet (e.g. Altron LB1 + Limiter OFF 12% + Sumeragi LB1 leader 36% + ATK support 240 → 14184). */
function _dcGetModifiedAttackerUnitStatsFromCtx(ctx,atkUnitStats,opts){
const F=Math.floor,C=Math.ceil;
const R=(opts&&opts.useFloor)?F:C;
const c=ctx||{};
const scAtk=c.squadCondAtkPct|0;
const scDef=c.squadCondDefPct|0;
const supCnt=_dcEffectiveSupportCounterAtkPctFromCtx(c);
const mlPct=c.masterLeagueBuff?50:0;
const goPct=c.grandOffensiveBuff?100:0;
const sheetBuffPct=mlPct+goPct;
const opFlat={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
const opPct={Attack:0,HP:0,Defense:0,Mobility:0,Move:0};
(c.optionParts||[]).forEach(op=>{const b=_dcParseOptionPartBonuses(op.details);['Attack','HP','Defense','Mobility','Move'].forEach(k=>{opFlat[k]+=b[k].flat;opPct[k]+=b[k].pct})});
let hpSupport=0,atkSupport=0,leaderPct=0;
(c.supporters||[]).forEach(s=>{hpSupport+=Number(s.hp_support)||0;atkSupport+=Number(s.atk_support)||0});
leaderPct=_dcLeaderSkillPctAndFlags(c.supporters).pct;
const lp=leaderPct|0;
const atkEnt=_dcFindStatEntry(atkUnitStats,'Attack');
const defEnt=_dcFindStatEntry(atkUnitStats,'Defense');
const hpEnt=_dcFindStatEntry(atkUnitStats,'HP');
const mobEnt=_dcFindStatEntry(atkUnitStats,'Mobility');
const moveEnt=_dcFindStatEntry(atkUnitStats,'Move')||_dcFindStatEntry(atkUnitStats,'MOV')||_dcFindStatEntry(atkUnitStats,'Movement');
const atkBase=F(Math.max(0,atkEnt?atkEnt.base:0));
const defBase=F(Math.max(0,defEnt?defEnt.base:0));
const hpBase=F(Math.max(0,hpEnt?hpEnt.base:0));
const mobBase=F(Math.max(0,mobEnt?mobEnt.base:0));
const moveBase=F(Math.max(0,moveEnt?moveEnt.base:0));
const pAtk=_dcStatPassivePctFromEntry(atkEnt);
const pDef=_dcStatPassivePctFromEntry(defEnt);
const pHp=_dcStatPassivePctFromEntry(hpEnt);
const pMob=_dcStatPassivePctFromEntry(mobEnt);
const pMove=_dcStatPassivePctFromEntry(moveEnt);
let unitHp=R(hpBase*(100+pHp+(opPct.HP|0)+lp+sheetBuffPct)/100)+(opFlat.HP|0)+hpSupport;
let unitDefVal=R(defBase*(100+pDef+(opPct.Defense|0)+lp+sheetBuffPct+(scDef|0))/100)+(opFlat.Defense|0);
let unitMob=R(mobBase*(100+pMob+(opPct.Mobility|0)+lp+sheetBuffPct)/100)+(opFlat.Mobility|0);
const mlMovePct=(c.masterLeagueBuff&&c.masterLeagueBuffMove!==false)?mlPct:0;
let unitMove=R(moveBase*(100+pMove+(opPct.Move|0)+mlMovePct)/100)+(opFlat.Move|0);
const opAt=opPct.Attack||0;
const exSq=_dcEffectiveExSquadAtkPctFromCtx(c);
let turnAtkPct=0;
if(c.unitTurnBuffAtk&&c.atkUnitData&&!c.atkUnitData._manual)turnAtkPct=Math.max(0,_dcGetDetectedUnitTurnBuffPercents(c.atkUnitData).atkPct|0);
const tAtk=turnAtkPct|0;
const unitAtkExSquadBase=R(atkBase*(100+pAtk+sheetBuffPct)/100);
const unitDefExSquadBase=R(defBase*(100+pDef+sheetBuffPct)/100);
const unitAtkGrowthAfterOptions=R(atkBase*(100+pAtk+opAt+tAtk+sheetBuffPct)/100);
const sumAtkPctNoEx=(pAtk+opAt+tAtk+sheetBuffPct+lp)|0;
const sumAtkPctFull=sumAtkPctNoEx+(exSq|0)+(scAtk|0)+(supCnt|0);
let unitAtk=R(atkBase*(100+sumAtkPctFull)/100)+(opFlat.Attack|0)+(atkSupport|0);
let deltaExAtk=0;
if((exSq|0)>0)deltaExAtk=R(atkBase*(100+sumAtkPctNoEx+exSq+(scAtk|0)+(supCnt|0))/100)-R(atkBase*(100+sumAtkPctNoEx+(scAtk|0)+(supCnt|0))/100);
const hpDbCorePassive=F(hpBase*(100+pHp)/100);
const defDbCorePassive=F(defBase*(100+pDef)/100);
const mobDbCorePassive=F(mobBase*(100+pMob)/100);
const atkDbCorePassive=F(atkBase*(100+pAtk)/100);
return{unitAtk,unitHp,unitDefVal,unitMob,unitMove,atkSupport,leaderPct,supportCounterPct:supCnt|0,unitAtkExSquadBase,unitAtkGrowthAfterOptions,unitDefExSquadBase,deltaExAtk,advantageFlatGrowthAtk:atkBase,advantageFlatGrowthDef:defBase,hpDbCorePassive,defDbCorePassive,mobDbCorePassive,atkDbCorePassive};
}
function _dcGetModifiedAttackerUnitStats(atkUnitStats){return _dcGetModifiedAttackerUnitStatsFromCtx(S.dc,atkUnitStats);}
function _dcPilotAtkStatLabelForWeapon(wpn){
const k=_dcWeaponAtkStatKeys(wpn||{});
const u=[...new Set(k)];
if(!u.length)return'Pilot ATK stat';
if(u.length===1)return u[0];
return u.join(' / ');
}
function calculateDamage(){
const F=Math.floor,C=Math.ceil,MX=Math.max,EXP=Math.exp;
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData,npc=S.dc.defNpc;
if(!ud||!cd||!npc)return null;
const lb=ud.lb_data;const maxTier=lb?lb.length-1:0;const tier=Math.min(S.dc.lbTier,maxTier);
const statKey=_dcGetUnitStatKey();
const td=(lb&&lb[tier])||(ud.stats&&{stats_no_cond:ud.stats});
const atkUnitStats=td?(td[statKey]||td.stats_no_cond):[];
const atkCharStats=_dcGetCharStats();
const wpns=_dcNonMapWeapons(ud);
if(!wpns.length)return null;
const wpn=wpns[S.dc.wpnIdx];if(!wpn)return null;
const lvData=_dcWeaponLevelRow(wpn,S.dc.wpnLv);

const uMod=_dcGetModifiedAttackerUnitStatsFromCtx(S.dc,atkUnitStats);
let unitAtk=uMod.unitAtk,unitHp=uMod.unitHp,unitDefVal=uMod.unitDefVal,unitMob=uMod.unitMob,unitMove=uMod.unitMove;
const pairUd=_dcPilotPairUnitAtkDefPct(unitAtk,unitDefVal);
unitAtk=pairUd.unitAtk;unitDefVal=pairUd.unitDefVal;
const counterOwnAtkPct=_dcGetCounterOwnAtkPct();
unitAtk=_dcApplyCounterOwnAtkToUnitAtk(unitAtk);
const supportCounterAtkPctApplied=_dcEffectiveSupportCounterAtkPct();
const advantageTagAtkPct=_dcAdvantageTagAtkPctFromAbilities(ud,npc);
unitAtk=_dcApplyAdvantageTagAtkToUnitAtk(unitAtk,advantageTagAtkPct,uMod.advantageFlatGrowthAtk|0);
let charAtk=_dcGetCharAtkStatWithSkills(atkCharStats,wpn);

const defUnit=npc.unit;const defChar=npc.character;
const us=_dcDefNpcUnitMapStatsPair(defUnit).stats;
const cs=defChar&&defChar.stats_raw||{};
const defMsDefensePair=Math.max(0,Number(us.Defense)||0);
const defMsStatsRawDefense=Math.max(0,Number(defUnit&&defUnit.stats_raw&&defUnit.stats_raw.Defense)||0);
const defMsBonusDefense=Math.max(0,Number(defUnit&&defUnit.bonus_amounts&&defUnit.bonus_amounts.Defense)||0);
let unitDef=defMsDefensePair;
let charDef=Math.max(0,Number(cs.Defense)||0);
let defDebuffPct=_dcManualPlusWeaponDefDebuffPct(wpn,S.dc.wpnLv);
if(defDebuffPct>0){
unitDef=_dcApplyEnemyDefDebuffToDefenderUnitDef(defUnit,defDebuffPct,unitDef);
}
const defDebuffFlatSubtract=defMsDefensePair-unitDef;

const rawWpnPower=lvData.power;
const computedWpnPow=_dcComputedWeaponPowerForLevel(wpn,S.dc.wpnLv);
const traitLvCalc=(wpn.levels&&wpn.levels.length)?Math.min(Math.max(0,S.dc.wpnLv|0),wpn.levels.length-1):0;
const wtTraits=_dcParseWeaponTraits(wpn,traitLvCalc);
const traitDistPow=Math.min(100,(wtTraits.distPowerMax||0)+(wtTraits.distCoreMax||0));
let traitHpPow=wtTraits.hpPowerMax|0;
let traitMpPow=wtTraits.mpPowerMax|0;
{const tb=wtTraits.enemyTagWpMaxBonus|0;if(tb>0&&_dcEnemyTagWeaponBonusActive(wtTraits)){if(traitHpPow>0)traitHpPow+=tb;else if(traitMpPow>0)traitMpPow+=tb;else traitHpPow+=tb}}
const finalOverride=S.dc.finalWpnPow||0;
const finalWpnPowOverride=finalOverride>0;
const weaponPower=finalOverride>0?finalOverride:computedWpnPow;
const qubPlusOneApplied=DC_QUB_PLUS_ONE&&defDebuffPct>35&&!finalWpnPowOverride;
const combatWeaponPower=_dcCombatWeaponPowerNominal(weaponPower,defDebuffPct,finalOverride>0);

const dist=_dcDefaultWeaponDistance(wpn);
const terrainPct=S.dc.terrain;
const terrainCorrection=1-(terrainPct/100);
const mp=_dcMpProfile(S.dc.mpLevel);
const vigorDmgBonusPct=Math.round((mp.dmgBonus||0)*100);
const vigorCritPct=Math.round((mp.critMult||0)*100);
let defendMult=1.0;
if(S.dc.defending)defendMult=S.dc.shield?0.6:0.8;

const characterStatRatio=MX(0,charAtk-charDef)/5000;
/** Unit slice: Firered RoundUp((UnAtk/10)−(UnDef/10))/5000 when DC_SHEET_UNIT_STAT_RATIO; else floor each tenth (legacy). */
let unitStatRatio;
if(DC_SHEET_UNIT_STAT_RATIO||(defDebuffPct|0)===20){
unitStatRatio=MX(0,C((unitAtk/10)-(unitDef/10)))/5000;
}else{
const unitDiffRaw=F(unitAtk/10)-F(unitDef/10);
unitStatRatio=MX(0,F(unitDiffRaw))/5000;
}
const charSigmoid=1/(EXP(250*(charDef-charAtk)/100000)+1);
const unitSigmoid=1/(EXP(25*(unitDef-unitAtk)/100000)+1);
const baseDamage=C((characterStatRatio+unitStatRatio+charSigmoid+unitSigmoid)*combatWeaponPower);

/** ⑥⑦ wiki: 攻撃総合数値=(UnAtk+2*PlAtk)/10, 防御総合数値=(UnDef+2*PlDef)/10. Page also says 切り上げ at key steps — match game + Firered by ceil on these combined values (float here undershoots ⑧ by ~0.02% vs preview). */
const atkCombined=C((unitAtk+2*charAtk)/10);
const defCombined=C((unitDef+2*charDef)/10);
const offExp=((5000-atkCombined)*30)/100000;
const defExp=((5000-defCombined)*3)/100000;
const offenseComponent=(10000/100)/(EXP(offExp)+1);
const defenseComponent=(-4000/100)/(EXP(defExp)+1);
/** ⑦ Firered: RoundUp each correction slice before add (off/def components can be negative — ceil each × baseDamage separately). */
const offenseCorrection=C(offenseComponent*baseDamage);
const defenseCorrection=C(defenseComponent*baseDamage);
const damageCorrection=(offenseComponent+defenseComponent)*baseDamage;
const isExWeapon=!!wpn.is_ex;
const userDmgIncreasePct=S.dc.dmgIncrease||0;
const userCritDmgUpPct=S.dc.critDmgUp||0;
const dmgTakenUpPct=_dcWeaponDtuSumPct(wpn);
const dmgTakenUpTyped=dmgTakenUpPct||0;
const dmgTakenUpGeneric=0;
const dmgTakenDownPilotPct=S.dc.dmgTakenDownPilot||0;
const dmgTakenDownUnitPct=S.dc.dmgTakenDownUnit||0;
const takenDown=dmgTakenDownPilotPct+(isExWeapon?0:dmgTakenDownUnitPct);
let battleDamage=C((baseDamage+damageCorrection)*terrainCorrection);

const totalNormalMultPct=userDmgIncreasePct+vigorDmgBonusPct+dmgTakenUpPct-takenDown;
const scaledNormal=C(totalNormalMultPct*battleDamage/100);
const combinedNormal=(battleDamage+scaledNormal)*defendMult;
let normalDmg=MX(0,C(combinedNormal));

const totalCritMultPct=userDmgIncreasePct+vigorDmgBonusPct+userCritDmgUpPct+dmgTakenUpPct-takenDown;
const critCorrectionPct=vigorCritPct;
const scaledCrit=C(totalCritMultPct*battleDamage/100);
let crit125Trim=0;
if((totalCritMultPct|0)===125&&defendMult===1&&(battleDamage|0)>=DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE&&(combatWeaponPower|0)>0){
crit125Trim=F(MX(0,battleDamage-combatWeaponPower)/DC_CRIT125_TRIM_DIV);
}
const combinedCrit=MX(0,(battleDamage+scaledCrit)*defendMult-crit125Trim);
const critPreVigor=MX(0,combinedCrit);
let critDmg=MX(0,C(critPreVigor*(critCorrectionPct+100)/100-1e-9));

const effRange=_dcGetEffectiveRange(wpn);
const inRange=dist>=effRange.min_range&&dist<=effRange.max_range;
const npcHp=defUnit?Math.max(0,Number(us.HP)||0):0;
const accuracy=lvData.accuracy;
const critical=lvData.critical;

const atkCharReaction=_dcFindStat(atkCharStats,'Reaction');
const defUnitMob=defUnit?Math.max(0,Number(us.Mobility)||0):0;
const defCharReaction=defChar?Math.max(0,Number(cs.Reaction)||0):0;
const accDownPct=0,mobDownPct=0;
const accResult=wtTraits.absoluteHit?{finalHitRate:100,mobDiff:0,reaDiff:0,mobCorrection:0,baseHit:10000,rawHit:100,absoluteHit:true}:calculateAccuracy(unitMob,charAtk,atkCharReaction,defUnitMob,defCharReaction,accuracy,{mobDownPct,accDownPct});
const exSquadAtkPct=_dcEffectiveExSquadAtkPct();
const squadCondAtkPct=S.dc.squadCondAtkPct|0,squadCondDefPct=S.dc.squadCondDefPct|0;
return{normalDmg,critDmg,inRange,npcHp,accuracy,critical,baseDamage,battleDamage,weaponPower,combatWeaponPower,rawWpnPower,charAtk,charDef,unitAtk,unitDef,unitMob,
characterStatRatio,unitStatRatio,charSigmoid,unitSigmoid,
atkCombined,defCombined,offenseComponent,defenseComponent,
damageCorrection:C(damageCorrection),terrainCorrection,totalNormalMultPct,totalCritMultPct,critCorrectionPct,critPreVigor,crit125Trim,scaledNormal,scaledCrit,defendMult,isExWeapon,
defMsDefensePair,defMsStatsRawDefense,defMsBonusDefense,defDebuffFlatSubtract,qubPlusOneApplied,
traitDistPow,traitHpPow,traitMpPow,traitWpnDistBasePct:wtTraits.distPowerMax|0,traitWpnCoreBonusPct:wtTraits.distCoreMax|0,finalWpnPowOverride,vigorDmgBonusPct,userDmgIncreasePct,exSquadAtkPct,squadCondAtkPct,squadCondDefPct,counterOwnAtkPct,supportCounterAtkPctApplied,advantageTagAtkPct,advantageGrowthFlatOmitted:false,userCritDmgUpPct,dmgTakenUpPct,dmgTakenUpGeneric,dmgTakenUpTyped,takenDown,defDebuffPct,
pilotBoostPct:0,pilotAtkDownPct:0,unitAtkDownPct:0,accDownPct,mobDownPct,wpnElem:_dcWeaponAttributeKeys(wpn).join('/'),
hitRate:accResult.finalHitRate,hitRateDetails:accResult,isSuperVigor:_dcNormMpLevel(S.dc.mpLevel)==='super'};
}
function calculateAccuracy(atkUnitMob,atkCharAtk,atkCharReaction,defUnitMob,defCharReaction,baseWeaponAcc,pen){
pen=pen||{};
const F=Math.floor,RU=Math.ceil,EXP=Math.exp,MX=Math.max,MN=Math.min;
let uMob=atkUnitMob;
const mdp=Math.min(100,pen.mobDownPct||0);
if(mdp>0)uMob=F(uMob*(1-mdp/100));
const mobDiff=RU((uMob/10)-(defUnitMob/10));
const reaDiff=atkCharAtk-defCharReaction;
const expMob=(1*(120-atkUnitMob))/10000;
const denMob=EXP(expMob)+1;
const expRea=(1*(10-atkCharReaction))/10000;
const denRea=EXP(expRea)+1;
const mobTerm=(denMob*mobDiff)/2500;
const reaTerm=(denRea*reaDiff)/5000;
const mobCorrection=F((mobTerm+reaTerm)*100);
const evaPct=0;
const accUpDown=0;
const sum=mobCorrection+(-evaPct*100)+(accUpDown*100);
const adp=Math.min(100,pen.accDownPct||0);
const baseHit=baseWeaponAcc*100*(1-adp/100);
const counterMult=S.dc.defending?0.8:1;
const rawHit=F(counterMult*(baseHit+sum));
const finalHitRate=MN(100,MX(10,rawHit));
return{finalHitRate,mobDiff,reaDiff,mobCorrection,baseHit,rawHit};
}

function _dcHtmlDcResultDamageBlock(r,dmgDeltas){
const npcHp=Math.max(0,r.npcHp|0);
const hpRemN=Math.max(0,npcHp-r.normalDmg);
const hpRemC=Math.max(0,npcHp-r.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
const sup=!!r.isSuperVigor;
const critLbl=sup?t('dc_super_crit_dmg'):t('dc_crit_dmg');
const hpCritLbl=sup?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit');
const cmp=!!dmgDeltas;
const isRef=!!(dmgDeltas&&dmgDeltas.isRef);
const dn=!isRef&&dmgDeltas?dmgDeltas.n:null;
const dc=!isRef&&dmgDeltas?dmgDeltas.c:null;
function _cmpDeltaBlock(pct,ref){
if(!cmp)return{delta:'',itemCls:''};
if(ref||pct==null||!Number.isFinite(pct)||Math.abs(pct)<0.01)return{delta:'<div class="dc-dmg-cmp-delta is-ref" aria-hidden="true">—</div>',itemCls:''};
const up=pct>0;
return{delta:`<div class="dc-dmg-cmp-delta ${up?'is-pos':'is-neg'}">${esc(_dcFmtPctDelta(pct))}</div>`,itemCls:up?' dc-result-item--cmp-up':' dc-result-item--cmp-down'};
}
const blockN=_cmpDeltaBlock(dn,isRef);
const blockC=_cmpDeltaBlock(dc,isRef);
return`<div class="dc-result-row"><div class="dc-result-item${blockN.itemCls}"><div class="dc-result-label dc-dmg-anch-n-lbl">${t('dc_normal_dmg')}</div><div class="dc-result-val normal dc-dmg-anch-n">${fmtN(r.normalDmg)}</div>${blockN.delta}</div><div class="dc-result-item${blockC.itemCls}"><div class="dc-result-label">${critLbl}</div><div class="dc-result-val crit dc-dmg-anch-c">${fmtN(r.critDmg)}</div>${blockC.delta}</div><div class="dc-result-item"><div class="dc-result-label">${t('dc_hit_rate')}</div><div class="dc-result-val hit">${r.hitRate}%</div></div></div>
<div class="dc-result-hp dc-result-hp--compact">
<div class="dc-hp-mini dc-hp-mini--normal">
<div class="dc-hp-mini-top"><span class="dc-hp-mini-tag">${t('dc_hp_remaining_normal')}</span><span class="dc-hp-mini-val"><span class="dc-hp-mini-fraction">${fmtN(hpRemN)}<span class="dc-hp-mini-sep">/</span>${fmtN(npcHp)}</span>${npcHp>0?`<span class="dc-hp-mini-pct">${pctN.toFixed(1)}%</span>`:''}</span></div>
<div class="dc-hp-bar-track dc-hp-mini-track"><div class="dc-hp-bar-fill dc-hp-bar-fill--normal" style="width:${pctN}%"></div></div>
</div>
<div class="dc-hp-mini dc-hp-mini--crit">
<div class="dc-hp-mini-top"><span class="dc-hp-mini-tag">${hpCritLbl}</span><span class="dc-hp-mini-val"><span class="dc-hp-mini-fraction">${fmtN(hpRemC)}<span class="dc-hp-mini-sep">/</span>${fmtN(npcHp)}</span>${npcHp>0?`<span class="dc-hp-mini-pct">${pctC.toFixed(1)}%</span>`:''}</span></div>
<div class="dc-hp-bar-track dc-hp-mini-track"><div class="dc-hp-bar-fill dc-hp-bar-fill--crit" style="width:${pctC}%"></div></div>
</div>
</div>`;
}

function _dcPctDelta(cur,base){
const c=Number(cur),b=Number(base);
if(!Number.isFinite(c)||!Number.isFinite(b)||b===0)return null;
return((c-b)/Math.abs(b))*100;
}
function _dcFmtPctDelta(v){
if(v==null||!Number.isFinite(v))return'--';
const a=Math.abs(v);
const d=a>=100?0:(a>=10?1:2);
return`${v>=0?'+':''}${v.toFixed(d)}%`;
}
function _dcSyncMultiPctCompareUi(canCompare){
const btn=document.getElementById('dcMultiPctCompareBtn');
if(!btn)return;
if(!canCompare)S.dc.multiPctCompare=false;
const on=!!S.dc.multiPctCompare&&!!canCompare;
btn.disabled=!canCompare;
btn.classList.toggle('active',on);
const tr=btn.querySelector('.ranking-exp-switch-track');
if(tr)tr.classList.toggle('active',on);
btn.title=canCompare?'% compare between attackers':'Add at least 2 attackers to compare';
}
function toggleDcMultiPctCompareMode(){
if(!S.dc._lastMultiResults||S.dc._lastMultiResults.length<2)return;
S.dc.multiPctCompare=!S.dc.multiPctCompare;
renderDcResult();
const ov=document.getElementById('dcBattleStatsOverlay');
if(ov&&window.getComputedStyle(ov).display!=='none')_dcRenderBattleStatsPanel();
}
function _dcDetachDcMultiCompareObserver(){
const area=document.getElementById('dcResultArea');
if(!area||!area._dcMultiCompareDetach)return;
try{area._dcMultiCompareDetach()}catch(_){}
area._dcMultiCompareDetach=null;
}
function _dcBattleStatsDeltaBadge(cur,base){
const pct=_dcPctDelta(cur,base);
if(pct==null||!Number.isFinite(pct)||Math.abs(pct)<0.01)return'';
const cls=pct>=0?'dc-bs-delta--pos':'dc-bs-delta--neg';
return`<span class="dc-bs-delta ${cls}">${_dcFmtPctDelta(pct)}</span>`;
}
function _dcBattleStatsDeltaRowClass(cur,base){
const pct=_dcPctDelta(cur,base);
if(pct==null||!Number.isFinite(pct)||Math.abs(pct)<0.01)return'';
return pct>=0?'dc-battle-stats-row--diff-pos':'dc-battle-stats-row--diff-neg';
}

function renderDcResult(){
const area=document.getElementById('dcResultArea');
if(!S.dc.defNpc){
_dcDetachDcMultiCompareObserver();
_dcSyncMultiPctCompareUi(false);
area.innerHTML=`<div class="dc-result-box"><div style="color:var(--text-muted);font-size:13px">Select: NPC Target</div></div>`;return}
const multi=[];
for(let i=0;i<DC_ATK_SLOT_COUNT;i++){
const sl=(S.dc.atkSlots||[])[i];
if(!sl||!sl.atkUnitData||!sl.atkCharData)continue;
let rr=null;
try{rr=_dcCalculateDamageWithSlot(i)}catch(e){console.error('calculateDamage error slot',i,e)}
if(rr)multi.push({idx:i,slot:sl,result:rr});
}
if(!multi.length){
_dcDetachDcMultiCompareObserver();
_dcSyncMultiPctCompareUi(false);
const missing=[];
if(!S.dc.atkUnitData)missing.push('Attacker Unit');
if(!S.dc.atkCharData)missing.push('Attacker Character');
const ud=S.dc.atkUnitData;
if(ud&&ud.weapons&&!_dcNonMapWeapons(ud).length)missing.push('Unit has no non-map weapons');
const msg=missing.length?'Select: '+missing.join(', '):'Set up at least one attacker loadout (unit + character)';
area.innerHTML=`<div class="dc-result-box"><div style="color:var(--text-muted);font-size:13px">${msg}</div></div>`;return}
const activeI=S.dc.atkSlotIndex|0;
const primary=multi.find(m=>m.idx===activeI)||multi[0];
const compareEnabled=!!S.dc.multiPctCompare&&multi.length>1;
_dcSyncMultiPctCompareUi(multi.length>1);
S.dc._lastResult=primary.result;
S.dc._lastMultiResults=multi;
let inner='';
if(multi.length===1){
inner=_dcHtmlDcResultDamageBlock(multi[0].result);
}else{
inner='<div class="dc-result-multi-compare-canvas"><div class="dc-result-multi-grid'+(compareEnabled?' dc-result-multi-grid--pct-compare':'')+'">'+multi.map(m=>{
const ud=m.slot.atkUnitData,cd=m.slot.atkCharData;
const isBase=m.idx===primary.idx;
let dmgDeltas=null;
if(compareEnabled){
if(isBase)dmgDeltas={isRef:true};
else dmgDeltas={n:_dcPctDelta(m.result.normalDmg,primary.result.normalDmg),c:_dcPctDelta(m.result.critDmg,primary.result.critDmg),isRef:false};
}
const headTitle=`#${m.idx+1} · ${esc(ud.name||'Unit')} + ${esc(cd.name||'Pilot')}`;
const headBadge=compareEnabled?`<span class="dc-result-slot-badge${isBase?' is-base':' is-spacer'}"${isBase?'':' aria-hidden="true"'}">${isBase?'Base':'&nbsp;'}</span>`:'';
const head=`<div class="dc-result-multi-head"><span class="dc-result-multi-head-title">${headTitle}</span>${headBadge}</div>`;
const cls=`dc-result-multi-col${compareEnabled&&isBase?' is-compare-base':''}`;
return`<div class="${cls}" data-dc-slot="${m.idx}">${head}${_dcHtmlDcResultDamageBlock(m.result,dmgDeltas)}</div>`;
}).join('')+'</div></div>';
}
_dcDetachDcMultiCompareObserver();
area.innerHTML=`<div class="dc-result-box">${inner}
<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
<button type="button" class="dc-ctrl-btn" onclick="toggleDcBattleStats(true)" style="font-size:12px;padding:6px 14px">Battle Stats</button>
<button type="button" class="dc-ctrl-btn" onclick="shareDcLink()" style="font-size:12px;padding:6px 14px">🔗 Share Link</button>
</div>
<div id="dcShareMsg" style="text-align:center;font-size:11px;color:#22c55e;margin-top:6px"></div>
</div>`;
}
function toggleDcBattleStats(show){
const ov=document.getElementById('dcBattleStatsOverlay');
if(!ov)return;
const on=show===undefined?ov.style.display==='none'||ov.style.display==='':!!show;
ov.style.display=on?'flex':'none';
if(on)_dcRenderBattleStatsPanel();
}
function _dcBattleStatsRow(lab,val){
let rowClass='';
if(arguments.length>=3&&arguments[2])rowClass=` ${arguments[2]}`;
const valHtml=/^[\d+\-.,%()\s]+$/.test(String(val).replace(/<[^>]+>/g,''))?`<span class="dc-battle-stats-val dc-battle-stats-val--num">${val}</span>`:`<span class="dc-battle-stats-val">${val}</span>`;
return`<div class="dc-battle-stats-row${rowClass}"><span class="dc-battle-stats-lab">${esc(lab)}</span>${valHtml}</div>`;
}
function _dcHasWeaponTraitBonus(r){
if(!r)return false;
return((r.traitWpnDistBasePct|0)>0||(r.traitWpnCoreBonusPct|0)>0||(r.traitHpPow|0)>0||(r.traitMpPow|0)>0);
}
function _dcAppendWeaponTraitBattleStats(h,r){
if(!_dcHasWeaponTraitBonus(r))return h;
const tot=(r.traitDistPow|0)+(r.traitHpPow|0)+(r.traitMpPow|0);
h+=_dcBattleStatsRow(t('dc_wpn_trait_effects'),`+${tot}% (${esc(t('dc_wpn_trait_max_applied'))})`);
if(r.finalWpnPowOverride)h+=`<div class="dc-battle-stats-row" style="grid-column:1/-1;font-size:11px;color:var(--text-muted)">${esc(t('dc_wpn_trait_override_note'))}</div>`;
if(r.traitWpnDistBasePct)h+=_dcBattleStatsRow(t('dc_wpn_trait_dist'),`+${r.traitWpnDistBasePct|0}%`);
if(r.traitWpnCoreBonusPct)h+=_dcBattleStatsRow(t('dc_wpn_trait_custom_core'),`+${r.traitWpnCoreBonusPct|0}%`);
if(r.traitHpPow)h+=_dcBattleStatsRow(t('dc_wpn_trait_hp'),`+${r.traitHpPow|0}%`);
if(r.traitMpPow)h+=_dcBattleStatsRow(t('dc_wpn_trait_mp'),`+${r.traitMpPow|0}%`);
return h;
}
function _dcCopyLinesWeaponTraitBonus(rr){
if(!_dcHasWeaponTraitBonus(rr))return[];
const tot=(rr.traitDistPow|0)+(rr.traitHpPow|0)+(rr.traitMpPow|0);
const o=[];
o.push(`${t('dc_wpn_trait_effects')}: +${tot}% (${t('dc_wpn_trait_max_applied')})`);
if(rr.finalWpnPowOverride)o.push(t('dc_wpn_trait_override_note'));
if(rr.traitWpnDistBasePct)o.push(`  ${t('dc_wpn_trait_dist')}: +${rr.traitWpnDistBasePct|0}%`);
if(rr.traitWpnCoreBonusPct)o.push(`  ${t('dc_wpn_trait_custom_core')}: +${rr.traitWpnCoreBonusPct|0}%`);
if(rr.traitHpPow)o.push(`  ${t('dc_wpn_trait_hp')}: +${rr.traitHpPow|0}%`);
if(rr.traitMpPow)o.push(`  ${t('dc_wpn_trait_mp')}: +${rr.traitMpPow|0}%`);
return o;
}
function _dcBattleStatsBlock(lab,innerHtml){
return`<div class="dc-battle-stats-block"><div class="dc-battle-stats-block-label">${esc(lab)}</div><div class="dc-battle-stats-block-body">${innerHtml}</div></div>`;
}
function _dcFormatBattleStatsOptionParts(parts){
if(!parts||!parts.length)return _dcBattleStatsRow('Option parts','—');
return _dcBattleStatsBlock('Option parts',parts.map(o=>{
const det=String(o.details||'').trim();
return`<div class="dc-bs-item"><strong>${esc(o.name||'—')}</strong>${det?`<div class="dc-bs-item-detail">${esc(det)}</div>`:''}</div>`;
}).join(''));
}
function _dcFormatBattleStatsSupporters(sups){
if(!sups||!sups.length)return _dcBattleStatsRow('Supporter','—');
return _dcBattleStatsBlock('Supporter',sups.map(s=>{
const atkFlat=Number(s.atk_support)||0;
const hpFlat=Number(s.hp_support)||0;
const flatBits=[];
if(hpFlat)flatBits.push('HP +'+fmtN(hpFlat));
if(atkFlat)flatBits.push('ATK +'+fmtN(atkFlat));
const flatLine=flatBits.length?`<div class="dc-bs-item-flat">${esc(flatBits.join(' · '))}</div>`:'';
let skillHtml='';
(s.leader_skills||[]).forEach(ls=>{
const desc=String(ls.desc||'').trim();
const tags=(ls.tags||[]).map(tg=>tg.name||'').filter(Boolean);
const tagStr=tags.length?tags.join(ls.separator==='and'?' & ':' / '):'';
if(!tagStr&&!desc)return;
skillHtml+=`<div class="dc-bs-item-detail">${tagStr?`<span class="dc-bs-tag">${esc(tagStr)}</span> ` : ''}${esc(desc)}</div>`;
});
const boost=String(s.boost||'').trim();
if(!skillHtml&&boost)skillHtml=`<div class="dc-bs-item-detail">${esc(boost.split('\n').slice(0,8).join('\n'))}</div>`;
return`<div class="dc-bs-item"><strong>${esc(s.name||'—')}</strong>${flatLine}${skillHtml}</div>`;
}).join(''));
}
function _dcRenderBattleStatsDefender(npc,r){
if(!npc)return'';
const u=npc.unit,ch=npc.character;
const us=u?_dcDefNpcUnitMapStatsPair(u).stats:{};
const uDefRaw=u?(us.Defense||0):0;
const deb=r.defDebuffPct|0;
const uDefEff=deb>0?_dcApplyEnemyDefDebuffToDefenderUnitDef(u,deb,uDefRaw):uDefRaw;
const cDef=ch?(ch.stats_raw?.Defense||0):0;
const hp=u?(us.HP||0):0;
let h='<div class="dc-battle-stats-section"><h3>Defender</h3>';
h+=_dcBattleStatsRow('Unit DEF',fmtN(uDefEff)+(deb>0?` (${deb}% debuff)`:''));
h+=_dcBattleStatsRow('Pilot DEF',fmtN(cDef));
h+=_dcBattleStatsRow('Damage Taken Up',String(r.dmgTakenUpTyped|0)+'%');
h+=_dcBattleStatsRow('Damage Taken Down',String(r.takenDown|0)+'%');
h+=_dcBattleStatsRow('Hit rate',String(r.hitRate)+'%');
h+=_dcBattleStatsRow('Max HP',fmtN(hp));
h+='</div>';
return h;
}
function _dcRenderBattleStatsPanel(){
const body=document.getElementById('dcBattleStatsBody');
if(!body)return;
const multi=S.dc._lastMultiResults;
if(!multi||!multi.length){body.innerHTML='<div style="color:var(--text-muted)">Calculate damage first (attacker + defender).</div>';return}
const activeIdx=S.dc.atkSlotIndex|0;
const r0=(multi.find(m=>m.idx===activeIdx)||multi[0]).result;
const compareEnabled=!!S.dc.multiPctCompare&&multi.length>1;
let h='<div class="dc-battle-stats-attackers-grid">';
multi.forEach(m=>{
const r=m.result,sl=m.slot,ud=sl.atkUnitData,cd=sl.atkCharData;
const wpns=ud?_dcNonMapWeapons(ud):[];
const wpn=wpns[sl.wpnIdx|0]||null;
const wName=wpn?esc(wpn.name):'—';
const atkLab=_dcPilotAtkStatLabelForWeapon(wpn);
const mpL=_dcNormMpLevel(sl.mpLevel||'medium');
const vigLbl=_dcVigorLabel(mpL);
const dmgPool=(r.userDmgIncreasePct|0)+(r.vigorDmgBonusPct|0);
const baseDmgPool=(r0.userDmgIncreasePct|0)+(r0.vigorDmgBonusPct|0);
const isAct=m.idx===activeIdx;
h+=`<div class="dc-battle-stats-section${isAct?' dc-battle-stats-section--active':''}"><h3>Attacker ${m.idx+1}${isAct?' · active':''}</h3>`;
if(compareEnabled&&!isAct){
const nd=_dcPctDelta(r.normalDmg,r0.normalDmg),cdp=_dcPctDelta(r.critDmg,r0.critDmg);
h+=_dcBattleStatsRow('Damage delta vs active',`Normal ${_dcFmtPctDelta(nd)} · ${r.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')} ${_dcFmtPctDelta(cdp)}`);
}
h+=_dcBattleStatsRow('Unit',esc(ud?.name||'—'));
h+=_dcBattleStatsRow('Pilot',esc(cd?.name||'—'));
h+=_dcBattleStatsRow('MS ATK',fmtN(r.unitAtk)+_dcBattleStatsDeltaBadge(r.unitAtk,r0.unitAtk),_dcBattleStatsDeltaRowClass(r.unitAtk,r0.unitAtk));
if((r.supportCounterAtkPctApplied|0)>0)h+=_dcBattleStatsRow('Support Attack/Counter MS ATK',`+${r.supportCounterAtkPctApplied|0}% applied`);
h+=_dcBattleStatsRow('Pilot stat ('+esc(atkLab)+')',fmtN(r.charAtk)+_dcBattleStatsDeltaBadge(r.charAtk,r0.charAtk),_dcBattleStatsDeltaRowClass(r.charAtk,r0.charAtk));
h+=_dcBattleStatsRow('Weapon',wName);
h+=_dcBattleStatsRow('Weapon Power',fmtN(r.weaponPower)+_dcBattleStatsDeltaBadge(r.weaponPower,r0.weaponPower),_dcBattleStatsDeltaRowClass(r.weaponPower,r0.weaponPower));
h=_dcAppendWeaponTraitBattleStats(h,r);
h+=_dcBattleStatsRow('Damage Dealt % Total',`${dmgPool}% (${r.userDmgIncreasePct|0}% passive + ${r.vigorDmgBonusPct|0}% vigor)`+_dcBattleStatsDeltaBadge(dmgPool,baseDmgPool),_dcBattleStatsDeltaRowClass(dmgPool,baseDmgPool));
h+=_dcBattleStatsRow('Crit rate (weapon %)',String(r.critical)+'%');
h+=_dcBattleStatsRow('Vigor state',esc(vigLbl));
h+=_dcBattleStatsRow('Master League (attacker)',sl.masterLeagueBuff?'On (+50% unit sheet; not EN/Move; pilot unchanged)':'Off');
h+=_dcBattleStatsRow('Grand Offensive (attacker)',sl.grandOffensiveBuff?'On (+100% unit sheet; not EN/Move; pilot unchanged)':'Off');
h+=_dcFormatBattleStatsOptionParts(sl.optionParts||[]);
h+=_dcFormatBattleStatsSupporters(sl.supporters||[]);
h+='</div>';
});
h+='</div>';
h+=_dcRenderBattleStatsDefender(S.dc.defNpc,r0);
body.innerHTML=h+`<div class="dc-battle-stats-footer"><button type="button" class="dc-ctrl-btn dc-battle-stats-copy-btn" onclick="copyDcResultText()">📋 Copy Results</button><div id="dcBattleStatsCopyMsg" class="dc-battle-stats-copy-msg" aria-live="polite"></div></div>`;
}
async function _dcBuildShareUrl(){
const packed=_dcPackShareState();
const b64=await _dcEncodeSharePayload(packed);
if(!b64)return'';
const u=new URL(location.origin+'/cal');
u.searchParams.set('d',b64);
return u.toString();
}
function _dcWeaponDisplayNameForSlot(ud,wpnIdx){
const wpns=ud?_dcNonMapWeapons(ud):[];
const w=wpns[wpnIdx|0];
return w?(w.name||'—'):'—';
}
function _dcCopyLinesDamageFormulas(rr){
if(!rr)return[];
const supLbl=rr.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg');
return['',
'Damage formulas (Firered sheet order):',
'  scaledNormal = ceil(totalNormalMultPct × battleDamage / 100)',
'  combinedNormal = (battleDamage + scaledNormal) × defendMult',
'  Normal damage = max(0, ceil(combinedNormal))',
'  totalNormalMultPct = (passive Damage Dealt Up%) + (vigor damage bonus%) + (weapon Damage Taken Up%) − (Damage Taken Down%)',
`  Plugged in: battleDamage=${fmtN(rr.battleDamage)}, scaledNormal=${fmtN(rr.scaledNormal)}, totalNormalMultPct=${rr.totalNormalMultPct|0}% (passive ${rr.userDmgIncreasePct|0}% + vigor ${rr.vigorDmgBonusPct|0}% + taken up ${rr.dmgTakenUpPct|0}% − taken down ${rr.takenDown|0}%), defendMult=${rr.defendMult}`,
`  → Normal damage = ${fmtN(rr.normalDmg)}`,
'  scaledCrit = ceil(totalCritMultPct × battleDamage / 100); crit125Trim = (totalCritMult=125% ∧ defendMult=1 ∧ ⑧≥threshold ∧ W>0) ? floor(max(0,⑧−combatWeaponPower)/1181) : 0',
'  combinedCrit = max(0, (battleDamage + scaledCrit) × defendMult − crit125Trim)',
`  ${supLbl} = max(0, ceil(combinedCrit × (vigorCritMultPct+100) / 100))`,
'  totalCritMultPct = same pool as normal plus (Critical Damage Up % from Attacker Parameters)',
`  Plugged in: totalCritMultPct=${rr.totalCritMultPct|0}% (includes crit dmg up input ${rr.userCritDmgUpPct|0}%), vigorCritMultPct=${rr.critCorrectionPct|0}%, scaledCrit=${fmtN(rr.scaledCrit)}, crit125Trim=${fmtN(rr.crit125Trim|0)}, combinedCrit=${fmtN(rr.critPreVigor)}`,
`  → ${supLbl} = ${fmtN(rr.critDmg)}`];
}
function _dcCopyLinesBattleDamageDiagnostics(rr){
if(!rr)return[];
return['',
`Battle damage inputs (defender + weapon nominal; unitStatRatio: ${DC_SHEET_UNIT_STAT_RATIO?'Firered RoundUp((UnAtk/10)−(UnDef/10))':'legacy floor tenths'}):`,
`  MS DEF from map-stats pair (pre-debuff): ${fmtN(rr.defMsDefensePair|0)}`,
`  stats_raw Defense (sheet total) / bonus slice: ${fmtN(rr.defMsStatsRawDefense|0)} / ${fmtN(rr.defMsBonusDefense|0)}`,
`  DEF debuff % (field+weapon): ${rr.defDebuffPct|0}%; flat subtract from pair DEF: ${fmtN(rr.defDebuffFlatSubtract|0)} → MS DEF used: ${fmtN(rr.unitDef|0)}`,
`  Pilot DEF (stats_raw): ${fmtN(rr.charDef|0)}`,
`  Attacker MS ATK (final): ${fmtN(rr.unitAtk|0)}; Advantage tag %: ${rr.advantageTagAtkPct|0}${(rr.supportCounterAtkPctApplied|0)>0?`; Support Attack/Counter MS ATK: +${rr.supportCounterAtkPctApplied}%`:''}`,
`  combatWeaponPower: ${fmtN(rr.combatWeaponPower|0)} (display ${fmtN(rr.weaponPower|0)}; qub +1: ${rr.qubPlusOneApplied?'applied':'off — set DC_QUB_PLUS_ONE in app.js'})`,
`  baseDamage: ${fmtN(rr.baseDamage)}, damageCorrection: ${fmtN(rr.damageCorrection)}, terrainCorr: ${rr.terrainCorrection}, battleDamage: ${fmtN(rr.battleDamage)}`];
}
function copyDcResultText(){
const r=S.dc._lastResult;if(!r)return;
const npc=S.dc.defNpc;
const nName=npc?(npc.unit?.name||'NPC'):'?';
const vigor=`${t('dc_vigor_prefix')}: ${_dcVigorLabel(S.dc.mpLevel)}, Terrain: ${S.dc.terrainMode||'normal'}`;
const multi=S.dc._lastMultiResults;
const lines=[`⚔ GGen Damage Simulator Result`,`Target: ${nName}`];
if(multi&&multi.length>1){
multi.forEach(m=>{
const rr=m.result,ud=m.slot.atkUnitData,cd=m.slot.atkCharData,sl=m.slot;
const uName=ud?ud.name:'?';const cName=cd?cd.name:'?';
const wNm=_dcWeaponDisplayNameForSlot(ud,sl.wpnIdx);
const npcHp=Math.max(0,rr.npcHp|0);
const hpRemN=Math.max(0,npcHp-rr.normalDmg);
const hpRemC=Math.max(0,npcHp-rr.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
lines.push(`--- Attacker ${m.idx+1}: ${uName} + ${cName}`);
lines.push(`Weapon: ${wNm} (power ${fmtN(rr.weaponPower)})`);
lines.push(`Normal Damage: ${fmtN(rr.normalDmg)}`);
lines.push(`${rr.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')}: ${fmtN(rr.critDmg)}`);
lines.push(`Hit Rate: ${rr.hitRate}%`);
_dcCopyLinesWeaponTraitBonus(rr).forEach(x=>lines.push(x));
if((rr.exSquadAtkPct|0)>0)lines.push(`EX squad ATK: +${rr.exSquadAtkPct}% (on growth after option-part ATK %; then supporter leader % on Attack)`);
if((rr.squadCondAtkPct|0)>0||(rr.squadCondDefPct|0)>0)lines.push(`Squad conditions: +${rr.squadCondAtkPct|0}% MS ATK`+((rr.squadCondDefPct|0)>0?`, +${rr.squadCondDefPct|0}% MS DEF`:``)+` (same % bucket as other sheet ATK/DEF %)`+(S.dc.bigRangZeonSquadBuff?' · includes Big-Rang EX Zeon aura +5%':''));
if((rr.counterOwnAtkPct|0)>0)lines.push(`Own ATK when countering: +${rr.counterOwnAtkPct}% (MS Attack; pilot EX ability toggle + checkbox)`);
if((rr.supportCounterAtkPctApplied|0)>0)lines.push(`Support Attack/Counter: +${rr.supportCounterAtkPctApplied}% MS ATK (Support-role pilot passive; toggle in Attacker Parameters)`);
if((rr.advantageTagAtkPct|0)>0)lines.push(`Advantage (enemy tag): +floor(${rr.advantageTagAtkPct}% × raw LB MS Attack base) when defender matches (flat add, not +% on total)`);
lines.push(`HP Remaining (Normal): ${fmtN(hpRemN)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctN.toFixed(1)+'%)':''}`);
lines.push(`${rr.isSuperVigor?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit')}: ${fmtN(hpRemC)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctC.toFixed(1)+'%)':''}`);
lines.push(`${t('dc_vigor_prefix')}: ${_dcVigorLabel(m.slot.mpLevel||'medium')}, Terrain: ${m.slot.terrainMode||'normal'}`);
_dcCopyLinesBattleDamageDiagnostics(rr).forEach(x=>lines.push(x));
_dcCopyLinesDamageFormulas(rr).forEach(x=>lines.push(x));
});
}else{
const ud=S.dc.atkUnitData,cd=S.dc.atkCharData;
const uName=ud?ud.name:'?';const cName=cd?cd.name:'?';
const wNm=_dcWeaponDisplayNameForSlot(ud,S.dc.wpnIdx);
const npcHp=Math.max(0,r.npcHp|0);
const hpRemN=Math.max(0,npcHp-r.normalDmg);
const hpRemC=Math.max(0,npcHp-r.critDmg);
const pctN=npcHp>0?Math.min(100,(hpRemN/npcHp)*100):0;
const pctC=npcHp>0?Math.min(100,(hpRemC/npcHp)*100):0;
lines.push(`Attacker: ${uName} + ${cName}`);
lines.push(`Weapon: ${wNm} (power ${fmtN(r.weaponPower)})`);
lines.push(`Normal Damage: ${fmtN(r.normalDmg)}`);
lines.push(`${r.isSuperVigor?t('dc_super_crit_dmg'):t('dc_crit_dmg')}: ${fmtN(r.critDmg)}`);
lines.push(`Hit Rate: ${r.hitRate}%`);
_dcCopyLinesWeaponTraitBonus(r).forEach(x=>lines.push(x));
if((r.exSquadAtkPct|0)>0)lines.push(`EX squad ATK: +${r.exSquadAtkPct}% (on growth after option-part ATK %; then supporter leader % on Attack)`);
if((r.squadCondAtkPct|0)>0||(r.squadCondDefPct|0)>0)lines.push(`Squad conditions: +${r.squadCondAtkPct|0}% MS ATK`+((r.squadCondDefPct|0)>0?`, +${r.squadCondDefPct|0}% MS DEF`:``)+` (same % bucket as other sheet ATK/DEF %)`+(S.dc.bigRangZeonSquadBuff?' · includes Big-Rang EX Zeon aura +5%':''));
if((r.counterOwnAtkPct|0)>0)lines.push(`Own ATK when countering: +${r.counterOwnAtkPct}% (MS Attack; pilot EX ability toggle + checkbox)`);
if((r.supportCounterAtkPctApplied|0)>0)lines.push(`Support Attack/Counter: +${r.supportCounterAtkPctApplied}% MS ATK (Support-role pilot passive; toggle in Attacker Parameters)`);
if((r.advantageTagAtkPct|0)>0)lines.push(`Advantage (enemy tag): +floor(${r.advantageTagAtkPct}% × raw LB MS Attack base) when defender matches (flat add, not +% on total)`);
lines.push(`HP Remaining (Normal): ${fmtN(hpRemN)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctN.toFixed(1)+'%)':''}`);
lines.push(`${r.isSuperVigor?t('dc_hp_remaining_super_crit'):t('dc_hp_remaining_crit')}: ${fmtN(hpRemC)} / ${fmtN(npcHp)}${npcHp>0?' ('+pctC.toFixed(1)+'%)':''}`);
lines.push(vigor);
_dcCopyLinesBattleDamageDiagnostics(r).forEach(x=>lines.push(x));
_dcCopyLinesDamageFormulas(r).forEach(x=>lines.push(x));
}
navigator.clipboard.writeText(lines.join('\n')).then(()=>{
const ov=document.getElementById('dcBattleStatsOverlay');
let m=null;
try{if(ov&&window.getComputedStyle(ov).display!=='none')m=document.getElementById('dcBattleStatsCopyMsg')}catch(_){}
if(!m)m=document.getElementById('dcShareMsg');
if(m){m.textContent='Copied to clipboard!';setTimeout(()=>{if(m.textContent==='Copied to clipboard!')m.textContent=''},2000)}
});
}
async function shareDcLink(){
const url=await _dcBuildShareUrl();
if(!url)return;
navigator.clipboard.writeText(url).then(()=>{
const m=document.getElementById('dcShareMsg');if(m){m.textContent='Link copied to clipboard!';setTimeout(()=>m.textContent='',2000)}
}).catch(()=>{
const m=document.getElementById('dcShareMsg');if(m){m.textContent='Failed to copy link';setTimeout(()=>m.textContent='',2000)}
});
}

const _origSetupKeys=setupKeys;
setupKeys=function(){_origSetupKeys();
document.addEventListener('keydown',e=>{
if(e.key==='Escape'){
if(document.getElementById('dcPickerOverlay').classList.contains('active')){closeDcPicker();e.stopPropagation();return}
if(document.getElementById('cmpPickerOverlay').classList.contains('active')){closeCompPicker();e.stopPropagation()}
else if(document.getElementById('cmpOverlay').classList.contains('active')){closeCompareModal();e.stopPropagation()}
}
})
};

try{wireTbPickerBodyClicks();wireDcPickerBodyClicks()}catch(_e){}
window.__GGEN_APP_TOOLS__=1;
