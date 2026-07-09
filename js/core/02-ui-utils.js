/* V3.17 · Utilidades DOM, formato, avisos, transición de avance y helpers básicos de club. */

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
function formatMoney(value){
  const num = Math.round(Number(value) || 0);
  const formatted = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Math.abs(num));
  return num < 0 ? `-${formatted}` : formatted;
}
function moneyTone(value){ return Number(value || 0) < 0 ? 'bad budget-negative' : 'ok'; }
function budgetTone(value){ return Number(value || 0) < 0 ? 'budget-negative bad' : ''; }
function clubName(id){ return seed.clubs.find(c => c.id === id)?.name || '—'; }
function isFoundedClub(club){ return Boolean(club?.isFoundedClub || club?.founderClub || club?.modoFundador); }
function isFoundedClubId(clubId){ return isFoundedClub(seed?.clubs?.find(c => Number(c.id) === Number(clubId))); }
function currentGameIsFounderMode(state=game){ return Boolean(state?.founderMode || isFoundedClubId(state?.selectedClubId)); }
function clubShort(id){ return seed.clubs.find(c => c.id === id)?.short || clubName(id).slice(0,3).toUpperCase(); }
function clubColor(id){ return seed.clubs.find(c => c.id === id)?.primaryColor || '#3b82f6'; }

function defaultClubTheme(){
  return { base:[59,130,246], accent:[96,165,250], accent2:[125,211,252] };
}
function clampColorChannel(value){ return Math.max(0, Math.min(255, Math.round(Number(value) || 0))); }
function parseCssColorToRgb(input){
  const value = String(input || '').trim();
  if(!value) return null;
  let match = value.match(/^#([0-9a-f]{3})$/i);
  if(match){
    const hex = match[1].split('').map(ch => ch + ch).join('');
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  match = value.match(/^#([0-9a-f]{6})$/i);
  if(match){
    const hex = match[1];
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  match = value.match(/^rgba?\(([^)]+)\)$/i);
  if(match){
    const parts = match[1].split(',').map(part => Number(part.trim()));
    if(parts.length >= 3 && parts.every((part, index) => index > 2 || Number.isFinite(part))){
      return parts.slice(0,3).map(clampColorChannel);
    }
  }
  match = value.match(/^hsla?\(([^)]+)\)$/i);
  if(match){
    const parts = match[1].replace(/\//g, ',').split(',').map(part => part.trim());
    if(parts.length >= 3){
      const h = Number(parts[0]);
      const s = Number(String(parts[1]).replace('%','')) / 100;
      const l = Number(String(parts[2]).replace('%','')) / 100;
      if(Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)){
        const hue = (((h % 360) + 360) % 360) / 360;
        if(s === 0){
          const gray = clampColorChannel(l * 255);
          return [gray, gray, gray];
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hueToRgb = t => {
          let value = t;
          if(value < 0) value += 1;
          if(value > 1) value -= 1;
          if(value < 1/6) return p + (q - p) * 6 * value;
          if(value < 1/2) return q;
          if(value < 2/3) return p + (q - p) * (2/3 - value) * 6;
          return p;
        };
        return [hueToRgb(hue + 1/3), hueToRgb(hue), hueToRgb(hue - 1/3)].map(channel => clampColorChannel(channel * 255));
      }
    }
  }
  return null;
}
function mixRgb(colorA, colorB, ratio=0.5){
  const weight = Math.max(0, Math.min(1, Number(ratio) || 0));
  return [0,1,2].map(index => clampColorChannel((colorA[index] * (1 - weight)) + (colorB[index] * weight)));
}
function rgbToCss(rgb){ return `rgb(${rgb.map(clampColorChannel).join(', ')})`; }
function rgbChannels(rgb){ return rgb.map(clampColorChannel).join(', '); }
function rgbLuminance(rgb){
  const [r,g,b] = rgb.map(channel => channel / 255);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}
function buildClubThemeFromColor(inputColor){
  const defaults = defaultClubTheme();
  const baseSource = parseCssColorToRgb(inputColor) || defaults.base;
  const smoothRatio = configNumber('ui.temaClubAcentoSuavizado', 0.18, 0, 0.65);
  let base = mixRgb(baseSource, defaults.base, smoothRatio);
  if(rgbLuminance(base) > 0.86) base = mixRgb(base, defaults.base, 0.34);
  const accent = mixRgb(base, [255,255,255], 0.12);
  const accent2 = mixRgb(base, [148,163,184], 0.26);
  return { base, accent, accent2 };
}
function applySelectedClubTheme(clubId=game?.selectedClubId || 0){
  const root = document.documentElement;
  if(!root) return;
  const defaults = defaultClubTheme();
  const enabled = configBoolean('ui.temaClubActivo', true);
  const theme = (!enabled || !seed?.clubs?.length)
    ? defaults
    : buildClubThemeFromColor(seed.clubs.find(c => Number(c.id) === Number(clubId))?.primaryColor || rgbToCss(defaults.base));
  root.style.setProperty('--club-rgb', rgbChannels(theme.base));
  root.style.setProperty('--club-accent-rgb', rgbChannels(theme.accent));
  root.style.setProperty('--club-accent-2-rgb', rgbChannels(theme.accent2));
  root.style.setProperty('--accent', rgbToCss(theme.accent));
  root.style.setProperty('--accent-2', rgbToCss(theme.accent2));
  root.style.setProperty('--club-theme-bg-opacity', String(configNumber('ui.temaClubFondoOpacidad', 0.18, 0, 0.4)));
  root.style.setProperty('--club-theme-panel-opacity', String(configNumber('ui.temaClubPanelOpacidad', 0.05, 0, 0.2)));
}
function encodeAssetPath(path){
  const raw = String(path || '').trim();
  if(!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return raw.split('/').map(segment => encodeURIComponent(segment)).join('/');
}
function clubAssetSlug(name){
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'club';
}
function legacyEscudoSlug(name){
  return String(name || '').trim().replace(/\s+/g,'_').replace(/[^\x00-\x7F]/g, ch => `#U${ch.charCodeAt(0).toString(16).padStart(4,'0')}`);
}
function uniqueBadgePaths(paths){
  const seen = new Set();
  return paths.filter(path => {
    const clean = String(path || '').trim();
    if(!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}
function clubBadgeSrcCandidates(club){
  const name = club?.name || '';
  const slug = clubAssetSlug(name);
  const underscore = typeof imageSlug === 'function' ? imageSlug(name) : String(name || '').trim().replace(/\s+/g,'_');
  const legacy = legacyEscudoSlug(name);
  return uniqueBadgePaths([
    club?.crestPath,
    `img/escudos/${slug}.png`,
    `img/escudos/${slug}.webp`,
    `img/escudos/${underscore}.png`,
    `img/escudos/${underscore}.webp`,
    `img/escudos/${legacy}.png`,
    `img/escudos/${legacy}.webp`,
    `IMG/ESCUDOS/${slug}.png`,
    `IMG/ESCUDOS/${slug}.webp`
  ]).map(encodeAssetPath);
}
function nextClubBadgeSrc(img){
  if(!img) return;
  let paths = [];
  try{ paths = JSON.parse(img.dataset.fallbackSrcs || '[]'); }catch(_){ paths = []; }
  const current = Math.max(0, Number(img.dataset.fallbackIndex || 0));
  const next = current + 1;
  if(next < paths.length){
    img.dataset.fallbackIndex = String(next);
    img.src = paths[next];
    return;
  }
  img.onerror = null;
  img.style.visibility = 'hidden';
}
function clubBadge(id){
  const club = seed.clubs.find(c=>c.id===id) || {};
  const paths = clubBadgeSrcCandidates(club);
  const src = paths[0] || '';
  const fallbackJson = escapeHtml(JSON.stringify(paths));
  return `<span class="club-badge-placeholder" data-club-id="${id}" title="${escapeHtml(clubName(id))}"><img src="${escapeHtml(src)}" alt="" data-fallback-index="0" data-fallback-srcs='${fallbackJson}' onerror="nextClubBadgeSrc(this)"></span>`;
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
function managerCurrentDivisionId(){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  return club?.divisionId || game?.selectedLeagueId || seed?.divisions?.[0]?.id || 'default';
}
function resetManagerDivisionFilterForTab(tab){
  const divisionId = managerCurrentDivisionId();
  if(tab === 'fixture') fixtureViewMode = 'mine';
  if(tab === 'standings') selectedStandingsDivision = divisionId;
  if(tab === 'stats') selectedStatsDivision = divisionId;
}
