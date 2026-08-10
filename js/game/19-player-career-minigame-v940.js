/*
  V9.40 · Ser jugador
  - Mueve el historial de trofeos individuales debajo de las opciones activas.
  - Compacta todavía más el historial anual de clubes.
  - Agrega una celebración destacada al ganar la Bota de oro mundial.
*/

const pcV940BaseRecordSeasonAward = pcRecordSeasonAward;
const pcV940BaseRenderPlayerCareer = renderPlayerCareer;

pcRecordSeasonAward = function(state,type,label,competition=''){
  const result = pcV940BaseRecordSeasonAward(state,type,label,competition);
  if(type === 'worldPlayer' && state){
    state.ui = state.ui && typeof state.ui === 'object' ? state.ui : {};
    state.ui.worldBootCelebration = {
      id:`${Number(state?.season?.year || 0)}-${Number(state?.player?.age || 0)}-${Date.now()}`,
      year:Number(state?.season?.year || 0),
      playerName:String(state?.player?.name || 'Jugador'),
      clubName:String(state?.club?.name || 'Club'),
      shown:false
    };
  }
  return result;
};

function pcV940WorldBootCelebrationMarkup(state){
  const celebration = state?.ui?.worldBootCelebration;
  if(!celebration || celebration.shown) return '';
  return `<div class="pc-v940-world-boot" role="status" aria-live="assertive">
    <div class="pc-v940-world-boot-rays" aria-hidden="true"></div>
    <div class="pc-v940-world-boot-card">
      <div class="pc-v940-world-boot-icon">${pcVectorIcon('worldBoot')}</div>
      <small>Distinción mundial</small>
      <h2>Bota de oro</h2>
      <strong>${pcEscape(celebration.playerName)}</strong>
      <p>Mejor jugador del mundo · ${pcFormatNumber(celebration.year)}</p>
      <span>${pcEscape(celebration.clubName)}</span>
    </div>
  </div>`;
}

function pcV940MainActionMarkup(state){
  if(state.status !== 'active') return '';
  return Number(state.season?.stage || 0) === 5 ? pcV930MarketMarkup(state) : pcV930AdvanceMarkup(state);
}

renderPlayerCareer = function(){
  if(!game){
    view.innerHTML = '<div class="card blocker"><h2>Ser jugador</h2><p>Primero cargá o creá una carrera de mánager.</p></div>';
    return;
  }
  let state = pcCareerState();
  if(!state){
    view.innerHTML = `<div class="player-career-shell player-career-v932-empty">${pcCreationView()}${pcV932ArchiveMarkup()}</div>`;
    return;
  }
  state = pcSetCareerState(state);
  pcV932PersistArchiveIfNeeded(state);
  if(state.status === 'active' && Number(state.season?.stage || 0) === 5){
    pcV930EnsureMarketDecision(state);
    state = pcSetCareerState(state);
  }
  const celebration = pcV940WorldBootCelebrationMarkup(state);
  view.innerHTML = `<div class="player-career-shell player-career-v930 player-career-v931 player-career-v932 player-career-v938 player-career-v940">
    ${celebration}
    <div class="pc-v930-board">
      <main class="pc-v930-left">
        ${pcV930IdentityMarkup(state)}
        ${pcV930RetiredMarkup(state)}
        ${pcV940MainActionMarkup(state)}
        ${pcV932IndividualTrophiesMarkup(state)}
        ${pcV930ResultMarkup(state)}
      </main>
      <aside class="pc-v930-right">${pcV930CareerTableMarkup(state)}</aside>
    </div>
    ${pcV932ArchiveMarkup()}
    <div class="pc-v930-footer-actions">
      <span>Ser jugador · carrera independiente de la gestión principal</span>
      <div><button type="button" class="ghost danger" data-pc-action="reset">${state.status==='retired'?'Nueva carrera':'Reiniciar'}</button></div>
    </div>
  </div>`;
  pcAnimateStatChanges(state);

  if(celebration && state.ui?.worldBootCelebration){
    state.ui.worldBootCelebration.shown = true;
    pcSetCareerState(state);
  }

  if(state?.status === 'active' && Number(state?.player?.age || 18) >= 32 && typeof pcV938RetirementProfile === 'function'){
    const profile = pcV938RetirementProfile(state);
    const footer = view.querySelector('.pc-v930-footer-actions>span');
    if(footer) footer.textContent = `Etapa final · Mejor Media ${Math.round(profile.peak)} · Media actual ${Math.round(profile.current)} · Última temporada ${profile.matches} PJ`;
  }
};
