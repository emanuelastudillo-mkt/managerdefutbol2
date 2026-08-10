/* V8.52 · Filosofía e identidad del manager. */

const MANAGER_PHILOSOPHY_SCHEMA_VERSION = 1;

function managerPhilosophyCatalog(){
  return window.MANAGER_PHILOSOPHY_CATALOG || { dimensions:[], questions:[], profiles:[], coaches:[] };
}

function createInitialManagerPhilosophyState(){
  return {
    schemaVersion:MANAGER_PHILOSOPHY_SCHEMA_VERSION,
    status:'not_started',
    currentIndex:0,
    answers:{},
    result:null,
    completedAt:'',
    retakeCount:0
  };
}

function managerPhilosophyClamp(value, min=0, max=100){
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function managerPhilosophyAffinity(scores, target){
  const dimensions = managerPhilosophyCatalog().dimensions;
  if(!dimensions.length) return 0;
  const distance = dimensions.reduce((sum, dimension) => {
    return sum + Math.abs(Number(scores?.[dimension.id] ?? 50) - Number(target?.[dimension.id] ?? 50));
  }, 0) / dimensions.length;
  return Math.round(managerPhilosophyClamp(100 - distance));
}

function calculateManagerPhilosophyResult(answers, completedAt=''){
  const catalog = managerPhilosophyCatalog();
  const totals = Object.fromEntries(catalog.dimensions.map(dimension => [dimension.id, 0]));
  const maximums = Object.fromEntries(catalog.dimensions.map(dimension => [dimension.id, 0]));

  catalog.questions.forEach(question => {
    const selected = question.options.find(option => option.id === answers?.[question.id]);
    catalog.dimensions.forEach(dimension => {
      const questionMax = Math.max(0, ...question.options.map(option => Math.abs(Number(option.weights?.[dimension.id] || 0))));
      maximums[dimension.id] += questionMax;
      totals[dimension.id] += Number(selected?.weights?.[dimension.id] || 0);
    });
  });

  const scores = {};
  catalog.dimensions.forEach(dimension => {
    const maximum = Math.max(1, Number(maximums[dimension.id] || 0));
    scores[dimension.id] = Math.round(managerPhilosophyClamp(50 + ((Number(totals[dimension.id] || 0) / maximum) * 50)));
  });

  const profiles = catalog.profiles
    .map(profile => ({ id:profile.id, affinity:managerPhilosophyAffinity(scores, profile.target) }))
    .sort((a,b) => b.affinity - a.affinity || String(a.id).localeCompare(String(b.id)));
  const coaches = catalog.coaches
    .map(coach => ({ id:coach.id, affinity:managerPhilosophyAffinity(scores, coach.target) }))
    .sort((a,b) => b.affinity - a.affinity || String(a.id).localeCompare(String(b.id)))
    .slice(0, 3);

  return {
    version:String(catalog.version || 'V8.52'),
    scores,
    profileId:profiles[0]?.id || 'balanced',
    profileAffinity:Number(profiles[0]?.affinity || 0),
    coaches,
    answerCount:Object.keys(answers || {}).length,
    completedAt:String(completedAt || new Date().toISOString())
  };
}

function normalizeManagerPhilosophyState(source){
  const catalog = managerPhilosophyCatalog();
  const raw = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const validAnswers = {};
  catalog.questions.forEach(question => {
    const optionId = String(raw.answers?.[question.id] || '');
    if(question.options.some(option => option.id === optionId)) validAnswers[question.id] = optionId;
  });
  const answerCount = Object.keys(validAnswers).length;
  const complete = catalog.questions.length > 0 && answerCount === catalog.questions.length;
  const requestedStatus = ['not_started','in_progress','completed'].includes(raw.status) ? raw.status : 'not_started';
  const status = complete && requestedStatus === 'completed'
    ? 'completed'
    : (answerCount > 0 || requestedStatus === 'in_progress' ? 'in_progress' : 'not_started');
  const firstUnanswered = catalog.questions.findIndex(question => !validAnswers[question.id]);
  const currentIndex = status === 'completed'
    ? Math.max(0, catalog.questions.length - 1)
    : Math.round(managerPhilosophyClamp(
      Number.isFinite(Number(raw.currentIndex)) ? Number(raw.currentIndex) : Math.max(0, firstUnanswered),
      0,
      Math.max(0, catalog.questions.length - 1)
    ));
  const completedAt = status === 'completed' ? String(raw.completedAt || raw.result?.completedAt || '') : '';

  return {
    schemaVersion:MANAGER_PHILOSOPHY_SCHEMA_VERSION,
    status,
    currentIndex,
    answers:validAnswers,
    result:status === 'completed' ? calculateManagerPhilosophyResult(validAnswers, completedAt) : null,
    completedAt,
    retakeCount:Math.max(0, Math.round(Number(raw.retakeCount || 0)))
  };
}

function managerPhilosophyState(){
  if(!game) return createInitialManagerPhilosophyState();
  game.managerPhilosophy = normalizeManagerPhilosophyState(game.managerPhilosophy);
  return game.managerPhilosophy;
}

function persistManagerPhilosophy(){
  if(typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>{});
}

function startManagerPhilosophyQuiz(restart=false){
  if(!game) return;
  const previous = managerPhilosophyState();
  if(restart && previous.status === 'completed' && !window.confirm('¿Querés volver a realizar el cuestionario? El resultado actual será reemplazado.')) return;
  game.managerPhilosophy = {
    ...createInitialManagerPhilosophyState(),
    status:'in_progress',
    retakeCount:Number(previous.retakeCount || 0) + (restart ? 1 : 0)
  };
  persistManagerPhilosophy();
  renderManagerPhilosophy();
}

function answerManagerPhilosophyQuestion(questionId, optionId){
  if(!game) return;
  const catalog = managerPhilosophyCatalog();
  const questionIndex = catalog.questions.findIndex(question => question.id === questionId);
  const question = catalog.questions[questionIndex];
  if(questionIndex < 0 || !question?.options?.some(option => option.id === optionId)) return;
  const state = managerPhilosophyState();
  state.answers[questionId] = optionId;
  if(Object.keys(state.answers).length === catalog.questions.length){
    state.status = 'completed';
    state.currentIndex = Math.max(0, catalog.questions.length - 1);
    state.completedAt = new Date().toISOString();
    state.result = calculateManagerPhilosophyResult(state.answers, state.completedAt);
  }else{
    state.status = 'in_progress';
    state.currentIndex = Math.min(catalog.questions.length - 1, questionIndex + 1);
  }
  game.managerPhilosophy = state;
  persistManagerPhilosophy();
  renderManagerPhilosophy();
}

function moveManagerPhilosophyQuestion(delta){
  const state = managerPhilosophyState();
  state.currentIndex = Math.round(managerPhilosophyClamp(
    Number(state.currentIndex || 0) + Number(delta || 0),
    0,
    Math.max(0, managerPhilosophyCatalog().questions.length - 1)
  ));
  game.managerPhilosophy = state;
  renderManagerPhilosophy();
}

function managerPhilosophyProfile(result){
  const catalog = managerPhilosophyCatalog();
  return catalog.profiles.find(profile => profile.id === result?.profileId) || catalog.profiles[0] || null;
}

function managerPhilosophyCoach(resultCoach){
  return managerPhilosophyCatalog().coaches.find(coach => coach.id === resultCoach?.id) || null;
}

function managerPhilosophyInitials(name){
  const parts = String(name || 'DT').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'D'}${parts.length > 1 ? parts[parts.length - 1][0] : 'T'}`.toUpperCase();
}

function managerPhilosophyRadarMarkup(scores){
  const dimensions = managerPhilosophyCatalog().dimensions;
  const size = 320;
  const center = size / 2;
  const radius = 106;
  const labelRadius = 136;
  const pointAt = (index, distance) => {
    const angle = ((Math.PI * 2 * index) / dimensions.length) - (Math.PI / 2);
    return {
      x:center + (Math.cos(angle) * distance),
      y:center + (Math.sin(angle) * distance)
    };
  };
  const polygon = distance => dimensions.map((_dimension,index) => {
    const point = pointAt(index, distance);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');
  const valuePoints = dimensions.map((dimension,index) => {
    const point = pointAt(index, radius * (managerPhilosophyClamp(scores?.[dimension.id] ?? 50) / 100));
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');
  const grid = [0.25,0.5,0.75,1].map(level => `<polygon class="philosophy-radar-grid" points="${polygon(radius * level)}"></polygon>`).join('');
  const axes = dimensions.map((_dimension,index) => {
    const point = pointAt(index, radius);
    return `<line class="philosophy-radar-axis" x1="${center}" y1="${center}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}"></line>`;
  }).join('');
  const labels = dimensions.map((dimension,index) => {
    const point = pointAt(index, labelRadius);
    const anchor = point.x < center - 16 ? 'end' : point.x > center + 16 ? 'start' : 'middle';
    return `<text class="philosophy-radar-label" x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" text-anchor="${anchor}">${escapeHtml(dimension.shortHigh)}</text>`;
  }).join('');
  return `<svg class="philosophy-radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar de identidad del manager">
    ${grid}${axes}
    <polygon class="philosophy-radar-value" points="${valuePoints}"></polygon>
    ${dimensions.map((dimension,index) => {
      const point = pointAt(index, radius * (managerPhilosophyClamp(scores?.[dimension.id] ?? 50) / 100));
      return `<circle class="philosophy-radar-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${escapeHtml(dimension.label)}: ${Math.round(scores?.[dimension.id] ?? 50)}%</title></circle>`;
    }).join('')}
    ${labels}
  </svg>`;
}

function managerPhilosophyDimensionMarkup(scores){
  return managerPhilosophyCatalog().dimensions.map(dimension => {
    const value = Math.round(managerPhilosophyClamp(scores?.[dimension.id] ?? 50));
    const leaning = value >= 50 ? dimension.high : dimension.low;
    return `<article class="philosophy-dimension">
      <div class="philosophy-dimension-head"><span>${escapeHtml(dimension.label)}</span><strong>${escapeHtml(leaning)} · ${value}%</strong></div>
      <div class="philosophy-scale-labels"><small>${escapeHtml(dimension.low)}</small><small>${escapeHtml(dimension.high)}</small></div>
      <progress max="100" value="${value}" aria-label="${escapeHtml(dimension.label)}: ${value}%"></progress>
    </article>`;
  }).join('');
}

function managerPhilosophyMoney(value){
  return typeof formatMoney === 'function' ? formatMoney(Number(value || 0)) : `$${Math.round(Number(value || 0)).toLocaleString('es-AR')}`;
}

function managerPhilosophyAdvice(scores){
  const advice = [];
  const attack = Number(scores?.attack ?? 50);
  const flexibility = Number(scores?.flexibility ?? 50);
  const pressing = Number(scores?.pressing ?? 50);
  const project = Number(scores?.project ?? 50);
  const market = Number(scores?.market ?? 50);

  if(attack >= 60){
    advice.push({
      tone:'attack', eyebrow:'Tu ataque', title:'Atacá con una red de seguridad',
      text:'Adelantá la mentalidad y buscá amplitud, pero conservá al menos un mediocampista de respaldo. Si acumulás delanteros sin coberturas, cada pérdida convierte tu ataque en una ocasión rival.',
      action:'tactics', actionLabel:'Preparar la táctica'
    });
  }else if(attack <= 40){
    advice.push({
      tone:'control', eyebrow:'Tu ataque', title:'El control también necesita una salida',
      text:'No confundas seguridad con pasividad: definí un pase vertical y un jugador rápido para salir. Cuando el rival se adelante, esa ruta evita que tu bloque quede encerrado.',
      action:'tactics', actionLabel:'Revisar la táctica'
    });
  }else{
    advice.push({
      tone:'balance', eyebrow:'Tu ataque', title:'Elegí cuándo acelerar',
      text:'Usá una estructura equilibrada como base y fijá una señal para atacar: recuperación alta, rival desordenado o ingreso de un jugador fresco. Así tu ambición tiene un momento claro.',
      action:'tactics', actionLabel:'Definir el plan'
    });
  }

  if(flexibility <= 42){
    advice.push({
      tone:'warning', eyebrow:'Riesgo de dogma', title:'Tu Plan A necesita un Plan B',
      text:'El rival observa y se adapta. Guardá dos tácticas: una que conserve tu identidad y otra que cambie formación, presión o ritmo. Entrená ambas; no esperes a ir perdiendo para improvisar.',
      action:'tactics', actionLabel:'Guardar dos planes'
    });
  }else if(flexibility >= 65){
    advice.push({
      tone:'adapt', eyebrow:'Tu flexibilidad', title:'Cambiá una capa por vez',
      text:'Tu lectura del rival es una ventaja, pero demasiados cambios destruyen automatismos. Prepará una base y una variante: primero modificá presión o mentalidad; cambiá la formación sólo si hace falta.',
      action:'tactics', actionLabel:'Ordenar variantes'
    });
  }else{
    advice.push({
      tone:'balance', eyebrow:'Tu flexibilidad', title:'Asigná una condición al Plan B',
      text:'Definí antes del partido qué activa la variante: marcador, cansancio o salida rival. Una condición concreta te permite adaptarte sin abandonar la idea por una jugada aislada.',
      action:'tactics', actionLabel:'Crear una variante'
    });
  }

  if(project >= 58 || market >= 60){
    const scoutingCost = typeof ACADEMY_SCOUTING_COST !== 'undefined' ? ACADEMY_SCOUTING_COST : 1000000;
    const preparerCost = typeof YOUTH_PREPARER_COST !== 'undefined' ? YOUTH_PREPARER_COST : 1000000;
    const residenceCost = typeof ACADEMY_RESIDENCE_MONTHLY_COST !== 'undefined' ? ACADEMY_RESIDENCE_MONTHLY_COST : 560000;
    advice.push({
      tone:'academy', eyebrow:'Cantera y dinero', title:'Creá una reserva antes de captar',
      text:`Separá en tu Cuenta Bancaria personal al menos la captación (${managerPhilosophyMoney(scoutingCost)}), el preparador (${managerPhilosophyMoney(preparerCost)}), alquileres mensuales (${managerPhilosophyMoney(residenceCost)} por residencia) y salarios semanales. Dejá cupos libres para la primera captación excepcional y reinvertí las ventas juveniles en este circuito.`,
      action:'bank', actionLabel:'Ver cuenta bancaria'
    });
    advice.push({
      tone:'special', eyebrow:'Cantera y cartas', title:'Consultá con la carta activa',
      text:'Contratá el mejor preparador juvenil que puedas sostener y, antes de la consulta semanal, activá “Experto en juveniles”. Según su rareza revela habilidades extra; usala antes de decidir a quién entrenar, promover o vender.',
      action:'special', actionLabel:'Ir a Cartas'
    });
  }else{
    if(pressing >= 62){
      advice.push({
        tone:'press', eyebrow:'Tu defensa', title:'Presioná con rotación, no con agotamiento',
        text:'Una presión alta exige piernas. Alterná cargas físicas, revisá cansancio y prepará relevos por línea; cuando no puedas recuperar rápido, replegá en bloque en lugar de presionar de a uno.',
        action:'training', actionLabel:'Revisar entrenamiento'
      });
    }else{
      advice.push({
        tone:'control', eyebrow:'Tu defensa', title:'El bloque bajo necesita una salida',
        text:'Cerrá el centro y conservá un receptor rápido o fuerte por delante. Sin esa descarga, el rival recuperará cada despeje y tu equipo terminará defendiendo demasiado tiempo.',
        action:'tactics', actionLabel:'Preparar la salida'
      });
    }
    advice.push({
      tone:'market', eyebrow:'Plantel y mercado', title:market >= 50 ? 'Desarrollá con un puesto objetivo' : 'Fichá para resolver una función',
      text:market >= 50
        ? 'Elegí un juvenil por rol necesario y alineá entrenamiento, minutos y promoción. Acumular proyectos sin un lugar real sólo aumenta salarios y frena el desarrollo.'
        : 'Antes de comprar, escribí la función que falta y un precio máximo. La jerarquía sirve si resuelve el sistema sin vaciar el presupuesto de las siguientes semanas.',
      action:market >= 50 ? 'academy' : 'market',
      actionLabel:market >= 50 ? 'Planificar la Academia' : 'Abrir el mercado'
    });
  }
  return advice.slice(0, 4);
}

function managerPhilosophyAdviceMarkup(scores){
  return managerPhilosophyAdvice(scores).map((item,index) => `<article class="philosophy-advice ${escapeHtml(item.tone)}">
    <div class="philosophy-advice-number">${index + 1}</div>
    <div>
      <p class="label">${escapeHtml(item.eyebrow)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      <button class="ghost" type="button" data-philosophy-target="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel)}</button>
    </div>
  </article>`).join('');
}

function managerPhilosophyNavigate(target){
  const key = String(target || '');
  if(key === 'tactics' || key === 'training'){
    activeTab = 'firstTeam';
    firstTeamTab = key;
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('firstTeam');
  }else if(key === 'bank'){
    activeTab = 'finance';
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('finance','bank');
  }else if(['academy','special','market'].includes(key)){
    activeTab = key;
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation(key);
  }else{
    activeTab = 'home';
  }
  renderAll();
}

function managerPhilosophyIntroMarkup(){
  const count = managerPhilosophyCatalog().questions.length;
  return `<section class="philosophy-shell">
    <div class="philosophy-hero philosophy-intro">
      <div>
        <p class="eyebrow">Identidad del manager</p>
        <h1>¿Cómo querés que juegue tu equipo?</h1>
        <p>Tomá ${count} decisiones de partido, plantel, liderazgo, mercado y academia. El resultado combina ocho ejes, tres entrenadores de referencia y un plan breve para llevar tu idea al juego.</p>
        <div class="philosophy-intro-pills"><span>Sin respuestas correctas</span><span>Se guarda con tu carrera</span><span>No entrega bonificaciones</span></div>
        <button class="primary philosophy-start" type="button" data-philosophy-start>Descubrir mi filosofía</button>
      </div>
      <div class="philosophy-intro-mark" aria-hidden="true"><span>8</span><small>ejes</small></div>
    </div>
    <div class="grid cols-3 philosophy-feature-grid">
      <article class="card"><p class="label">Diagnóstico</p><h3>Una identidad, no una etiqueta</h3><p class="muted">El perfil surge de todas tus decisiones y muestra también sus tensiones.</p></article>
      <article class="card"><p class="label">Referentes</p><h3>Tres afinidades</h3><p class="muted">Entrenadores reconocidos para comprender estilos cercanos al tuyo, sin copiar una receta.</p></article>
      <article class="card"><p class="label">Aplicación</p><h3>Cuatro acciones útiles</h3><p class="muted">Consejos conectados con táctica, entrenamiento, mercado, dinero, academia y cartas.</p></article>
    </div>
  </section>`;
}

function managerPhilosophyQuizMarkup(state){
  const catalog = managerPhilosophyCatalog();
  const index = Math.round(managerPhilosophyClamp(state.currentIndex, 0, Math.max(0, catalog.questions.length - 1)));
  const question = catalog.questions[index];
  const answered = Object.keys(state.answers || {}).length;
  const selected = String(state.answers?.[question.id] || '');
  return `<section class="philosophy-shell">
    <div class="philosophy-quiz-head">
      <div><p class="eyebrow">Identidad del manager</p><h2>Decisión ${index + 1} de ${catalog.questions.length}</h2></div>
      <span class="pill">${answered} respondidas</span>
    </div>
    <progress class="philosophy-progress" max="${catalog.questions.length}" value="${answered}" aria-label="Progreso: ${answered} de ${catalog.questions.length}"></progress>
    <article class="philosophy-question card">
      <p class="label">Elegí la reacción que más se parece a vos</p>
      <h1>${escapeHtml(question.text)}</h1>
      <div class="philosophy-options">
        ${question.options.map((option,optionIndex) => `<button type="button" class="philosophy-option ${selected === option.id ? 'selected' : ''}" data-philosophy-question="${escapeHtml(question.id)}" data-philosophy-option="${escapeHtml(option.id)}">
          <span>${String.fromCharCode(65 + optionIndex)}</span><strong>${escapeHtml(option.text)}</strong>
        </button>`).join('')}
      </div>
    </article>
    <div class="row philosophy-quiz-actions">
      <button class="ghost" type="button" data-philosophy-back ${index <= 0 ? 'disabled' : ''}>← Anterior</button>
      <p class="muted small">Podés salir de la pestaña: el avance queda guardado.</p>
    </div>
  </section>`;
}

function managerPhilosophyResultMarkup(state){
  const result = state.result || calculateManagerPhilosophyResult(state.answers, state.completedAt);
  const profile = managerPhilosophyProfile(result);
  const coaches = result.coaches.map(item => ({ result:item, coach:managerPhilosophyCoach(item) })).filter(item => item.coach);
  return `<section class="philosophy-shell">
    <div class="philosophy-result-hero">
      <div>
        <p class="eyebrow">Tu identidad futbolística</p>
        <h1>${escapeHtml(profile?.title || 'Identidad equilibrada')}</h1>
        <p class="philosophy-kicker">${escapeHtml(profile?.kicker || '')}</p>
        <p>${escapeHtml(profile?.summary || '')}</p>
        <div class="philosophy-affinity"><strong>${Math.round(result.profileAffinity || 0)}%</strong><span>afinidad con el perfil</span></div>
      </div>
      <div class="philosophy-radar-wrap">${managerPhilosophyRadarMarkup(result.scores)}</div>
    </div>

    <section class="philosophy-section">
      <div class="philosophy-section-head"><div><p class="label">Tus ocho ejes</p><h2>Así se compone tu idea</h2></div><p class="muted small">El porcentaje se inclina hacia el concepto ubicado a la derecha.</p></div>
      <div class="philosophy-dimensions">${managerPhilosophyDimensionMarkup(result.scores)}</div>
    </section>

    <section class="philosophy-section">
      <div class="philosophy-section-head"><div><p class="label">Lectura del perfil</p><h2>Fortalezas y alertas</h2></div></div>
      <div class="grid cols-2 philosophy-traits">
        <article class="card"><h3>Lo que podés potenciar</h3><ul>${(profile?.strengths || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
        <article class="card warning"><h3>Lo que conviene vigilar</h3><ul>${(profile?.risks || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
      </div>
    </section>

    <section class="philosophy-section">
      <div class="philosophy-section-head"><div><p class="label">Afinidades, no equivalencias</p><h2>Tres entrenadores de referencia</h2></div><p class="muted small">Sirven para explorar ideas cercanas; no afirman que tu estilo sea idéntico.</p></div>
      <div class="philosophy-coaches">
        ${coaches.map(item => `<article class="philosophy-coach card">
          <div class="philosophy-coach-avatar" aria-hidden="true">${escapeHtml(managerPhilosophyInitials(item.coach.name))}</div>
          <div><h3>${escapeHtml(item.coach.name)}</h3><p>${escapeHtml(item.coach.style)}</p></div>
          <strong>${Math.round(item.result.affinity || 0)}%</strong>
        </article>`).join('')}
      </div>
    </section>

    <section class="philosophy-section philosophy-action-plan">
      <div class="philosophy-section-head"><div><p class="label">Cómo plasmarlo en tu carrera</p><h2>Tu plan de acción</h2></div><p class="muted small">Cuatro decisiones concretas basadas en tu resultado y en las reglas actuales del juego.</p></div>
      <div class="philosophy-advice-grid">${managerPhilosophyAdviceMarkup(result.scores)}</div>
    </section>

    <div class="philosophy-result-footer">
      <p class="muted small">Este diagnóstico es orientativo: no modifica atributos, resultados ni probabilidades del juego.</p>
      <button class="ghost" type="button" data-philosophy-retake>Volver a realizar</button>
    </div>
  </section>`;
}

function bindManagerPhilosophy(){
  document.querySelector('[data-philosophy-start]')?.addEventListener('click', () => startManagerPhilosophyQuiz(false));
  document.querySelector('[data-philosophy-retake]')?.addEventListener('click', () => startManagerPhilosophyQuiz(true));
  document.querySelector('[data-philosophy-back]')?.addEventListener('click', () => moveManagerPhilosophyQuestion(-1));
  document.querySelectorAll('[data-philosophy-question][data-philosophy-option]').forEach(button => {
    button.addEventListener('click', () => answerManagerPhilosophyQuestion(button.dataset.philosophyQuestion, button.dataset.philosophyOption));
  });
  document.querySelectorAll('[data-philosophy-target]').forEach(button => {
    button.addEventListener('click', () => managerPhilosophyNavigate(button.dataset.philosophyTarget));
  });
}

function renderManagerPhilosophy(){
  const state = managerPhilosophyState();
  if(state.status === 'completed' && state.result) view.innerHTML = managerPhilosophyResultMarkup(state);
  else if(state.status === 'in_progress') view.innerHTML = managerPhilosophyQuizMarkup(state);
  else view.innerHTML = managerPhilosophyIntroMarkup();
  bindManagerPhilosophy();
}
