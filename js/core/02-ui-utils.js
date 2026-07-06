/* V3.16 · Utilidades DOM, formato, avisos, transición de avance y helpers básicos de club. */

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function showNotice(text, persist=false){
  const box = $('notice');
  if(!box) return;
  box.textContent = text;
  box.classList.remove('hidden');
  box.classList.remove('notice-pop');
  void box.offsetWidth;
  box.classList.add('notice-pop');
  clearTimeout(showNotice.timer);
  if(!persist){ showNotice.timer = setTimeout(() => box.classList.add('hidden'), NOTICE_DURATION_MS); }
}
function hideNotice(){ $('notice')?.classList.add('hidden'); }

function runActionFeedback(button, action, options={}){
  if(!button){
    const outcome = action?.() || {};
    if(outcome.message) showNotice(outcome.message, Boolean(outcome.persist));
    if(typeof outcome.after === 'function') outcome.after(outcome);
    return outcome;
  }
  if(button.disabled || button.dataset.actionBusy === '1') return null;
  const originalHtml = button.innerHTML;
  const loadingLabel = options.loadingLabel || 'Procesando...';
  const successLabel = options.successLabel || 'Acción realizada';
  const failureLabel = options.failureLabel || 'Acción fallida';
  button.dataset.actionBusy = '1';
  button.disabled = true;
  button.classList.remove('action-success','action-failure');
  button.classList.add('action-processing');
  button.innerHTML = `<span class="action-spinner" aria-hidden="true"></span><span>${escapeHtml(loadingLabel)}</span>`;
  clearTimeout(button._actionFeedbackTimer);
  button._actionFeedbackTimer = setTimeout(() => {
    let outcome = null;
    try{
      outcome = action?.() || {};
    }catch(error){
      console.error(error);
      outcome = { success:false, message:'La acción falló por un error interno.', after:null };
    }
    const success = Boolean(outcome.success);
    button.classList.remove('action-processing');
    button.classList.add(success ? 'action-success' : 'action-failure');
    button.innerHTML = `<span>${escapeHtml(outcome.buttonLabel || (success ? successLabel : failureLabel))}</span>`;
    if(outcome.message) showNotice(outcome.message, Boolean(outcome.persist));
    clearTimeout(button._actionFeedbackResultTimer);
    button._actionFeedbackResultTimer = setTimeout(() => {
      button.classList.remove('action-success','action-failure');
      button.innerHTML = originalHtml;
      button.disabled = false;
      delete button.dataset.actionBusy;
      if(typeof outcome.after === 'function') outcome.after(outcome);
    }, ACTION_FEEDBACK_RESULT_MS);
  }, ACTION_FEEDBACK_LOADING_MS);
  return null;
}
function showTurnTransition(label='Avanzando días'){
  let root = $('turnTransition');
  if(root) root.remove();
  root = document.createElement('div');
  root.id = 'turnTransition';
  root.className = 'turn-transition-backdrop';
  root.style.setProperty('--turn-transition-ms', `${TURN_TRANSITION_MS}ms`);
  root.innerHTML = `<div class="turn-transition-card"><div class="turn-spinner" aria-hidden="true"></div><strong>${escapeHtml(label)}</strong><span>Actualizando calendario, plantel y economía...</span><div class="turn-transition-bar"><i></i></div></div>`;
  document.body.appendChild(root);
  clearTimeout(showTurnTransition.timer);
  showTurnTransition.timer = setTimeout(()=>{
    root.classList.add('is-exiting');
    setTimeout(()=>root.remove(), 260);
  }, TURN_TRANSITION_MS);
}
function clamp(value,min,max){ return Math.max(min, Math.min(max, value)); }
function rnd(min,max){ return min + Math.random() * (max-min); }
function avg(values){ const clean = values.filter(v => Number.isFinite(v)); return clean.length ? clean.reduce((a,b)=>a+b,0)/clean.length : 0; }
function formatMoney(value){ return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value); }
function clubName(id){ return seed.clubs.find(c => c.id === id)?.name || '—'; }
function clubShort(id){ return seed.clubs.find(c => c.id === id)?.short || clubName(id).slice(0,3).toUpperCase(); }
function clubColor(id){ return seed.clubs.find(c => c.id === id)?.primaryColor || '#3b82f6'; }
function clubBadge(id){
  const club = seed.clubs.find(c=>c.id===id) || {};
  const src = club.crestPath || `img/escudos/${imageSlug(club.name || clubName(id))}.png`;
  return `<span class="club-badge-placeholder" data-club-id="${id}" title="${escapeHtml(clubName(id))}"><img src="${escapeHtml(src)}" alt="" onerror="this.style.visibility='hidden'"></span>`;
}
function clubLink(id){ return `<button class="linklike club-link" data-club-id="${id}">${clubBadge(id)}<span>${escapeHtml(clubName(id))}</span></button>`; }
function clubSpan(id){ return `<span class="club-click" data-club-id="${id}">${clubBadge(id)}<span>${escapeHtml(clubName(id))}</span></span>`; }
function clubAbbrev(id){ return clubBadge(id); }
function divisionOptions(selected='all'){
  const divisions = seed?.divisions || [{ id:'default', name:'Liga única' }];
  return [`<option value="all" ${selected==='all'?'selected':''}>Todas las divisiones</option>`]
    .concat(divisions.map(d => `<option value="${escapeHtml(d.id)}" ${selected===d.id?'selected':''}>${escapeHtml(d.name)}</option>`))
    .join('');
}
function divisionFilterMarkup(id, selected){
  return `<div class="division-filter"><label for="${id}">División</label><select id="${id}">${divisionOptions(selected)}</select></div>`;
}
