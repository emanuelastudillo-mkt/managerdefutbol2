/* V8.39 · Comunidad Discord integrada en Inicio.
   Consulta la invitación pública para mostrar cantidades aproximadas de miembros y conectados.
*/
(function(){
  'use strict';

  const state = {
    status:'idle',
    guildName:'Una vida de manager',
    online:null,
    members:null,
    updatedAt:0,
    error:''
  };
  let pendingRequest = null;
  let refreshTimer = null;

  function config(){
    const raw = window.GAME_CONFIG?.comunidad?.discord || {};
    const inviteCode = String(raw.inviteCode || 'MStvBW9RR').trim();
    const inviteUrl = String(raw.inviteUrl || `https://discord.gg/${inviteCode}`).trim();
    return {
      activo:raw.activo !== false,
      inviteCode,
      inviteUrl,
      refreshMs:Math.max(60000, Number(raw.refreshMs || 300000))
    };
  }

  function escapeText(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function formatCount(value){
    const number = Number(value);
    if(!Number.isFinite(number) || number < 0) return '—';
    try{ return new Intl.NumberFormat('es-AR').format(Math.round(number)); }
    catch(_err){ return String(Math.round(number)); }
  }

  function statusMarkup(){
    if(state.status === 'loading'){
      return '<span class="discord-community-status is-loading"><span class="discord-community-dot" aria-hidden="true"></span>Consultando Discord…</span>';
    }
    if(state.status === 'ready'){
      return `<span class="discord-community-status is-online"><span class="discord-community-dot" aria-hidden="true"></span>${formatCount(state.online)} conectados</span>`;
    }
    if(state.status === 'error'){
      return '<span class="discord-community-status is-unavailable"><span class="discord-community-dot" aria-hidden="true"></span>Comunidad disponible</span>';
    }
    return '<span class="discord-community-status"><span class="discord-community-dot" aria-hidden="true"></span>Discord oficial</span>';
  }

  function discordCommunityHomeMarkup(){
    const settings = config();
    if(!settings.activo || !settings.inviteCode) return '';
    const guildName = escapeText(state.guildName || 'Una vida de manager');
    const note = state.status === 'ready'
      ? 'Cantidades aproximadas informadas por Discord.'
      : state.status === 'error'
        ? 'No se pudo consultar el estado en este momento. La invitación sigue disponible.'
        : 'El estado se actualiza automáticamente.';
    return `
      <section class="card discord-community-card" aria-labelledby="discordCommunityTitle">
        <div class="discord-community-head">
          <div class="discord-community-brand" aria-hidden="true">D</div>
          <div class="discord-community-copy">
            <p class="label">Comunidad oficial</p>
            <h3 id="discordCommunityTitle">${guildName}</h3>
            <p class="muted">Buscá rivales, compartí capturas y logros, seguí las versiones y reportá bugs o sugerencias.</p>
          </div>
          ${statusMarkup()}
        </div>
        <div class="discord-community-body">
          <div class="discord-community-metrics" aria-live="polite">
            <div><strong>${formatCount(state.online)}</strong><span>Conectados</span></div>
            <div><strong>${formatCount(state.members)}</strong><span>Miembros</span></div>
          </div>
          <a class="primary discord-community-join" href="${escapeText(settings.inviteUrl)}" target="_blank" rel="noopener noreferrer">Unirse al Discord</a>
        </div>
        <p class="small muted discord-community-note">${escapeText(note)}</p>
      </section>`;
  }

  function renderCurrentState(){
    const holder = document.getElementById('homeDiscordCommunityBox');
    if(holder) holder.innerHTML = discordCommunityHomeMarkup();
  }

  function scheduleRefresh(){
    if(refreshTimer) clearTimeout(refreshTimer);
    const holder = document.getElementById('homeDiscordCommunityBox');
    if(!holder) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if(document.getElementById('homeDiscordCommunityBox')) fetchStatus(true);
    }, config().refreshMs);
    if(typeof refreshTimer?.unref === 'function') refreshTimer.unref();
  }

  async function fetchStatus(force=false){
    const settings = config();
    if(!settings.activo || !settings.inviteCode) return state;
    const fresh = state.status === 'ready' && Date.now() - state.updatedAt < settings.refreshMs;
    if(fresh && !force) return state;
    if(pendingRequest) return pendingRequest;

    state.status = 'loading';
    state.error = '';
    renderCurrentState();
    const endpoint = `https://discord.com/api/v10/invites/${encodeURIComponent(settings.inviteCode)}?with_counts=true`;
    pendingRequest = fetch(endpoint, {
      method:'GET',
      cache:'no-store',
      credentials:'omit',
      referrerPolicy:'no-referrer',
      headers:{ Accept:'application/json' }
    }).then(async response => {
      if(!response.ok) throw new Error(`Discord respondió ${response.status}`);
      const payload = await response.json();
      state.guildName = String(payload?.guild?.name || state.guildName || 'Una vida de manager');
      state.online = Number.isFinite(Number(payload?.approximate_presence_count)) ? Number(payload.approximate_presence_count) : null;
      state.members = Number.isFinite(Number(payload?.approximate_member_count)) ? Number(payload.approximate_member_count) : null;
      state.updatedAt = Date.now();
      state.status = 'ready';
      state.error = '';
      return state;
    }).catch(error => {
      state.status = 'error';
      state.error = String(error?.message || error || 'No disponible');
      return state;
    }).finally(() => {
      pendingRequest = null;
      renderCurrentState();
      scheduleRefresh();
    });
    return pendingRequest;
  }

  function discordCommunityHydrateHome(){
    renderCurrentState();
    fetchStatus(false);
  }

  window.discordCommunityHomeMarkup = discordCommunityHomeMarkup;
  window.discordCommunityHydrateHome = discordCommunityHydrateHome;
  window.discordCommunityRefresh = () => fetchStatus(true);
  window.discordCommunityState = state;
})();
