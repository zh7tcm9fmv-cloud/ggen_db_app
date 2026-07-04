// Minimal simulation of PEP weapon trait rendering
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function _traitLineWeaponEffectKeys(line){
const s=String(line||'');
const sl=s.toLowerCase();
const keys=new Set();
if(/damage taken from beam|damage taken from beam weapons up|ビーム武装(?:による)?被ダメージ|光束.*被|遭光束武裝攻擊時[，,]?受到的?損傷提升/i.test(s))keys.add('dmg_beam');
if(/\bdef down\b/i.test(sl)||/防御力\s*\d+\s*%?\s*減少|防禦力\s*\d+\s*%?\s*減少|防御力減少|防禦力減少/.test(s))keys.add('def_dn');
return keys;
}

function _pepWeaponEffectNoteLabel(bonus,keys){
const decKeys=['def_dn','atk_dn','mob_dn','acc_dn'];
const isDec=[...keys].some(k=>decKeys.includes(k));
return isDec?`(${bonus}% Additional Decrease)`:`(${bonus}% Additional Increase)`;
}

function _applyPilotWeaponEffectAdditiveToTraitLine(line,bonuses){
if(!bonuses||!bonuses.size)return{html:esc(line),changed:false,bonus:0};
const keys=_traitLineWeaponEffectKeys(line);
if(!keys.size)return{html:esc(line),changed:false,bonus:0};
let bonus=0;
keys.forEach(k=>{if(bonuses.has(k))bonus=Math.max(bonus,bonuses.get(k));});
if(!bonus)return{html:esc(line),changed:false,bonus:0};
let out='',last=0,changed=false,newVal=0;
const rePct=/(\d+)\s*%/g;
let m;
while((m=rePct.exec(line))!==null){
const base=parseInt(m[1],10);
newVal=base+bonus;
out+=esc(line.slice(last,m.index));
if(newVal!==base){changed=true;out+=`<span class="weapon-acc-boost">${newVal}%</span>`}
else out+=esc(m[0]);
last=m.index+m[0].length;
}
out+=esc(line.slice(last));
if(!changed)return{html:esc(line),changed:false,bonus:0};
const note=_pepWeaponEffectNoteLabel(bonus,keys);
return{html:out+`<div class="weapon-trait-pep-note">${esc(note)}</div>`,changed:true,bonus};
}

function _collectPilotWeaponEffectAdditiveBonuses(ud, pepActive){
const merged=new Map();
if(!pepActive||!ud)return merged;
const embedded=ud.pilot_weapon_effect_bonuses;
if(embedded&&typeof embedded==='object'){
Object.entries(embedded).forEach(([k,v])=>{const n=parseInt(v,10)||0;if(n)merged.set(k,n)});
if(merged.size)return merged;
}
return merged;
}

const ud = { pilot_weapon_effect_bonuses: { def_dn: 5 } };
const pepWpnFx = _collectPilotWeaponEffectAdditiveBonuses(ud, true);
const line = 'Inflict "DEF Down 35%" on the enemy [1 turn].';
const r = _applyPilotWeaponEffectAdditiveToTraitLine(line, pepWpnFx);
console.log('pepWpnFx size', pepWpnFx.size, [...pepWpnFx]);
console.log('result', r);
