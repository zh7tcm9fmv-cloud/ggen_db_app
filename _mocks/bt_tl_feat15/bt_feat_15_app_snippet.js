/* PARKED — /tl 1.5 featured HUD JS (not loaded by the app).
 * Re-wire later from this file + bt_feat_15.css. Oct 2026.
 */
function btDesign15On(){try{return!!(window.__GGEN_DESIGN_15__||(document.documentElement&&document.documentElement.classList.contains('ggen-15')))}catch(_){return!1}}
function btFeat15LiveEnabled(){try{return window.__GGEN_BT_FEAT15__===true}catch(_){return!1}}
function btFeat15HudOn(){return btDesign15On()&&btFeat15LiveEnabled()}
function btEnsureFeat15Sprites(){if(document.getElementById('btFeat15Sprites'))return;const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('id','btFeat15Sprites');s.setAttribute('class','bt-feat15-sprite');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');s.innerHTML='<symbol viewBox="0 0 306 312" id="bt_c_unit_card_waku" fill="none"><g clip-path="url(#bt_c_unit_card_waku_clip0)"><path d="M169.17 311H2C0.9 311 0 310.1 0 309V303H35.17C35.7 303 36.21 303.21 36.58 303.59L39.41 306.42C39.79 306.8 40.29 307.01 40.82 307.01H173.99L170.58 310.42C170.2 310.8 169.7 311.01 169.17 311.01V311Z" fill="currentColor"/><path d="M305 17H183.99C182.93 17 181.91 17.42 181.16 18.17L167.5 31.83C166.75 32.58 165.73 33 164.67 33H1V16C6.86 10.14 10.14 6.86 16 1H304C304.55 1 305 1.45 305 2V17Z" fill="currentColor"/><path d="M170.91 310.09C170.13 310.87 168.6 311.5 167.5 311.5H2.5C1.4 311.5 0.5 310.6 0.5 309.5V18.5C0.5 17.4 1.14 15.86 1.91 15.09L15.09 1.91C15.87 1.13 17.4 0.5 18.5 0.5H303.5C304.6 0.5 305.5 1.4 305.5 2.5V173.5C305.5 174.6 304.86 176.14 304.09 176.91L170.92 310.08L170.91 310.09Z" stroke="currentColor" stroke-miterlimit="10"/></g><defs><clipPath id="bt_c_unit_card_waku_clip0"><rect width="306" height="312" fill="white"/></clipPath></defs></symbol>';const host=document.getElementById('panel-banner_timeline')||document.body;host.appendChild(s)}
function btFeat15ImgHtml(src,alt,opts){const o=opts||{};const u=src?imgUrl(String(src)):'';if(!u)return'<span class="picture"><span class="i" aria-hidden="true"></span></span>';const eager=!!o.eager;const ld=eager?'eager':'lazy';const fp=eager?' fetchpriority="high"':'';return'<picture class="picture"><img class="i" src="'+escAttr(u)+'" alt="'+escAttr(alt||'')+'" loading="'+ld+'" decoding="async"'+fp+'></picture>'}
function btBannerPoolStillAvailable(b){
/* Active or not-yet-ended (incl. permanent 2099 / unknown end). Ended pools lazy-hydrate on scroll. */
if(!b||btIsSpecialScheduleBanner(b))return true;
const end=Number(b.end_ms)||0;
if(!(end>0))return true;
const ey=btBannerEndYearJstMs(end);
if(ey!=null&&ey>=2098)return true;
return Date.now()<end;
}
function btFeaturedLazyPlaceholderCell(b){
const gid=String(b&&b.gasha_id||'');
const voteOk=btVoteEnabledForBanner(b);
const rowCls=voteOk?'':' bt-vote-row--disabled';
return'<td class="bt-feat-stack-cell bt-feat-lazy'+rowCls+'" data-gasha-id="'+escAttr(gid)+'" data-bt-lazy-feat="1"><div class="bt-feat-lazy-ph" aria-hidden="true"></div></td>';
}
function btDisconnectFeatLazyObserver(){if(S._btFeatLazyObs){try{S._btFeatLazyObs.disconnect()}catch(_){}S._btFeatLazyObs=null}}
function btHydrateLazyFeatCell(td){
if(!td||!td.getAttribute||!td.getAttribute('data-bt-lazy-feat'))return;
const gid=String(td.getAttribute('data-gasha-id')||'');
const rows=(S.btCacheData&&S.btCacheData.banners)||[];
const b=rows.find(x=>String(x&&x.gasha_id||'')===gid);
if(!b){td.removeAttribute('data-bt-lazy-feat');return}
const html=btFeaturedMergedCell(b.featured_units,b.featured_chars,b.featured_supporters,gid,b);
const wrap=document.createElement('tbody');
wrap.innerHTML='<tr>'+html+'</tr>';
const neu=wrap.querySelector('td');
if(neu)td.replaceWith(neu);
else td.removeAttribute('data-bt-lazy-feat');
}
function btBindFeatLazyObserver(){
btDisconnectFeatLazyObserver();
const root=document.getElementById('bannerTimelineRoot');
if(!root)return;
const nodes=root.querySelectorAll('td[data-bt-lazy-feat]');
if(!nodes.length)return;
if(typeof IntersectionObserver==='undefined'){nodes.forEach(btHydrateLazyFeatCell);return}
const obs=new IntersectionObserver(function(entries){
entries.forEach(function(en){
if(!en.isIntersecting)return;
const td=en.target;
obs.unobserve(td);
btHydrateLazyFeatCell(td);
});
},{root:null,rootMargin:'240px 0px',threshold:0.01});
nodes.forEach(function(n){obs.observe(n)});
S._btFeatLazyObs=obs;
}
function btFeat15HitAttrs(typ,id,gid,voteCapable,picks){const vkey=btVoteOptionKey(typ,id);const vsel=voteCapable&&picks.includes(vkey);const voteCls=voteCapable?' bt-vote-tile'+(vsel?' is-vote-selected':''):'';const voteAttr=voteCapable&&gid?' data-gasha-id="'+escAttr(gid)+'" data-vote-key="'+escAttr(vkey)+'" aria-pressed="'+(vsel?'true':'false')+'"':'';const click=voteCapable?'':' onclick="openDetail(\''+typ+'\',\''+escJs(id)+'\')"';return{cls:'hit bt-feat15-hit'+voteCls,attr:' role="button" tabindex="0" data-detail-type="'+escAttr(typ)+'" data-detail-id="'+escAttr(id)+'"'+voteAttr+click}}
function btFeat15PairCards(units,chars){const used=new Set();const cards=[];(units||[]).forEach(u=>{if(!u)return;let ch=null;const rc=u.recommend_character;const rid=String((rc&&rc.id)||u.recommend_character_id||'');if(rid){ch=(chars||[]).find(c=>c&&String(c.id)===rid)||null;if(!ch&&rc&&rc.id){ch={id:rc.id,name:rc.name||'',thum:rc.thum||'',portrait:rc.portrait||rc.thum||'',is_limited_time:!!rc.is_limited_time,type:'character'}}if(ch)used.add(String(ch.id))}cards.push({kind:'pair',unit:u,char:ch})});(chars||[]).forEach(c=>{if(!c||used.has(String(c.id)))return;cards.push({kind:'char',unit:null,char:c})});return cards}
function btFeat15TileHtml(opts){const o=opts||{};const unit=o.unit||null;const ch=o.char||null;const supp=o.supporter||null;const gid=o.gid||'';const voteCapable=!!o.voteCapable;const picks=o.picks||[];const exPtsMap=o.exPtsMap||null;const isSupp=!!supp;const isCharOnly=!unit&&!!ch&&!isSupp;const primary=isSupp?supp:(unit||ch);if(!primary)return'';const lim=!!(primary.is_limited_time||(unit&&unit.is_limited_time)||(ch&&ch.is_limited_time));const limTyp=isSupp?'supporter':(unit?'unit':'character');const limCls=lim?(' bt-lr-tile--limited bt-lr-tile--lt-'+limTyp):'';const frameLimCls=lim?' bt-feat15-frame--limited bt-lr-tile--lt-'+limTyp:'';const lbl=t('limited_label');const bar=lim?'<div class="bt-limited-topbar" aria-hidden="true">'+limitedUrBadgeHtml(lbl,{size:'tile',extraClass:'limited-ur-badge--limited-time'})+'</div>':'';const label=isSupp?t('bt_feat15_supp'):(isCharOnly?t('bt_feat15_char'):t('bt_feat15_unit_char'));const cardCls='bt-c-unit-card'+(isSupp?' --supporter':'')+(isCharOnly?' --char-only':'');let visualHit='',charHit='';if(isSupp){const ha=btFeat15HitAttrs('supporter',supp.id,gid,voteCapable,picks);const src=supp.portrait||supp.thum||'';visualHit='<div class="visual"><div class="'+ha.cls+'" aria-label="'+escAttr(String(supp.name||''))+'"'+ha.attr+'>'+btFeat15ImgHtml(src,supp.name)+'</div></div>';}else if(isCharOnly){const ha=btFeat15HitAttrs('character',ch.id,gid,voteCapable,picks);const src=ch.portrait||ch.thum||'';visualHit='<div class="visual"><div class="'+ha.cls+'" aria-label="'+escAttr(String(ch.name||''))+'"'+ha.attr+'>'+btFeat15ImgHtml(src,ch.name)+'</div></div>';}else{const uha=btFeat15HitAttrs('unit',unit.id,gid,voteCapable,picks);const usrc=unit.portrait||unit.thum||'';visualHit='<div class="visual"><div class="'+uha.cls+'" aria-label="'+escAttr(String(unit.name||''))+'"'+uha.attr+'>'+btFeat15ImgHtml(usrc,unit.name)+'</div></div>';if(ch&&ch.id){const cha=btFeat15HitAttrs('character',ch.id,gid,voteCapable,picks);const csrc=ch.portrait||ch.thum||'';charHit='<div class="character"><div class="'+cha.cls+'" aria-label="'+escAttr(String(ch.name||''))+'"'+cha.attr+'>'+btFeat15ImgHtml(csrc,ch.name)+'</div></div>'}}
const title=isSupp?String(supp.name||''):(unit?String(unit.name||''):String(ch&&ch.name||''));
const pilot=(!isSupp&&unit&&ch)?String(ch.name||''):'';
const textHtml='<div class="text"><p class="name">'+esc(title)+'</p>'+(pilot?'<p class="pilot">'+esc(pilot)+'</p>':'')+'</div>';
const card='<div class="'+cardCls+'"><div class="image'+frameLimCls+'"><div class="bg"></div>'+visualHit+'<div class="waku"><svg class="icon" viewBox="0 0 306 312" preserveAspectRatio="none"><use href="#bt_c_unit_card_waku"></use></svg><p class="label">'+esc(label)+'</p></div>'+charHit+'</div>'+textHtml+'</div>';
let dropTab='',exTab='',exPts=null;const metaSrc=primary;if(exPtsMap){const typ=isSupp?'supporter':(unit?'unit':'character');const id=String(metaSrc.id);exPts=exPtsMap[typ+':'+id]!=null?exPtsMap[typ+':'+id]:exPtsMap[id]}if(exPts!=null){const exFull=(t('bt_exchangeable_pts')||'Exchange - {n} pts').replace('{n}',String(exPts));const exShort=(t('bt_exchangeable_tab')||'Exchange - {n} pts').replace('{n}',String(exPts));exTab='<div class="bt-exchange-tab" aria-label="'+escAttr(exFull)+'">'+esc(exShort)+'</div>'}dropTab=btDropRateTabHtml(metaSrc);const metaCls=(exPts!=null||dropTab)?' bt-lr-tile--has-meta':'';const exCls=exPts!=null?' bt-lr-tile--exchangeable':'';return'<div class="bt-feat-tile'+limCls+exCls+metaCls+'">'+bar+card+dropTab+exTab+'</div>'}
function btFeaturedCell15(units,chars,supporters,gid,voteCapable,exPtsMap){btEnsureFeat15Sprites();const picks=voteCapable&&gid?btVoteMineList(gid):[];let h='';const pairs=btFeat15PairCards(units,chars);pairs.forEach(p=>{h+=btFeat15TileHtml({unit:p.unit,char:p.char,gid,voteCapable,picks,exPtsMap})});(supporters||[]).forEach(s=>{h+=btFeat15TileHtml({supporter:s,gid,voteCapable,picks,exPtsMap})});if(!h)return'<span class="bt-strip-empty">—</span>';return'<div class="bt-strip bt-strip--feat15">'+h+'</div>'}
