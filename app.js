/* Interface de QCM Civique. Utilise Engine (engine.js). Aucune donnée n'est envoyée : tout reste dans le navigateur. */
(() => {
  'use strict';
  const E = Engine;
  const $app = document.getElementById('app');

  // ------------------------------------------------------------------ utilitaires
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const DAY = 86400000;

  function getStorage() {
    try {
      localStorage.setItem('__test', '1');
      localStorage.removeItem('__test');
      return { storage: localStorage, persistent: true };
    } catch (e) {
      const mem = {};
      return { storage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } }, persistent: false };
    }
  }

  const { storage, persistent } = getStorage();
  const store = new E.Store(storage);
  const rng = E.makeRng();
  const state = {
    bank: null, immediate: true,
    session: null, view: 'home', timer: null, tick: null,
  };
  const currentBank = () => state.bank;
  const prefs = () => store.data.prefs;

  // ------------------------------------------------------------------ apparence
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => prefs().theme === 'dark' || ((prefs().theme || 'auto') === 'auto' && Boolean(darkQuery && darkQuery.matches));

  function applySettings() {
    const root = document.documentElement;
    const theme = prefs().theme || 'auto';
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    if (prefs().textSize === 'large') root.setAttribute('data-text', 'large'); else root.removeAttribute('data-text');
    document.body.classList.add('official');   // thème bleu-blanc-rouge
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark() ? '#0f1b33' : '#0055a4');
  }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applySettings);

  // ------------------------------------------------------------------ boîtes de dialogue
  // Intégrées à la page : les boîtes natives (confirm, alert) peuvent être bloquées par le
  // navigateur ou l'application installée, et la question reste alors sans réponse.
  function closeDialog() {
    const d = document.getElementById('dialog');
    if (d) d.remove();
  }

  function dialog(message, buttons) {
    closeDialog();
    const el = document.createElement('div');
    el.className = 'modal';
    el.id = 'dialog';
    el.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p>${esc(message)}</p>
      <div class="actions end">${buttons.map((b, i) => `<button class="btn ${b.primary ? '' : 'secondary'}" data-dlg="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dlg]');
      if (!b) return;
      const cfg = buttons[Number(b.dataset.dlg)];
      closeDialog();
      if (cfg.onClick) cfg.onClick();
    });
    document.body.appendChild(el);
  }

  const notify = (message) => dialog(message, [{ label: 'OK', primary: true }]);
  const askConfirm = (message, yesLabel, onYes, noLabel = 'Continuer la séance') =>
    dialog(message, [{ label: noLabel }, { label: yesLabel, primary: true, onClick: onYes }]);

  function stopTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    state.tick = null;
  }

  function show(view, html) {
    stopTimer();
    state.view = view;
    $app.innerHTML = html;
    $app.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
    window.scrollTo(0, 0);
  }

  function header(title) {
    return `<h1>${esc(title)}</h1><hr class="rule">`;
  }

  // ------------------------------------------------------------------ « En savoir plus » et marquage
  function sourceText(m) {
    if (!m.s) return '';
    return m.s === 'Hors Livret' ? 'Non traité dans le Livret du citoyen.' : `Livret du citoyen (mai 2026), ${m.s}`;
  }

  function moreHtml(m) {
    if (!m || !(m.k || m.c)) return '';
    const src = sourceText(m);
    return `<details class="more"><summary>En savoir plus</summary>
      ${m.k ? `<p><strong>À retenir :</strong> ${esc(m.k)}</p>` : ''}
      ${m.c ? `<p><strong>Pour comprendre :</strong> ${esc(m.c)}</p>` : ''}
      ${src ? `<p class="src">${esc(src)}</p>` : ''}</details>`;
  }

  const flagLabel = (on) => (on ? '★ Marquée' : '☆ À revoir');
  const flagButton = (id, cls = 'link flagbtn') =>
    `<button class="${cls}" data-act="flag" data-id="${esc(id)}" aria-label="Marquer cette question à revoir">${flagLabel(store.isFlagged(id))}</button>`;

  // ------------------------------------------------------------------ une question posée
  function qaHtml(snap, number, onlyErrors) {
    const ok = E.snapshotOk(snap);
    if (onlyErrors && ok) return '';
    const good = snap.options[snap.correct];
    let body;
    if (ok) {
      body = `<div class="ans good">Votre réponse (correcte) : ${esc(good)}</div>`;
    } else {
      const given = snap.chosen !== null && snap.chosen !== undefined ? snap.options[snap.chosen] : '(pas de réponse)';
      body = `<div class="ans bad">Votre réponse : ${esc(given)}</div><div class="ans good">Bonne réponse : ${esc(good)}</div>`;
    }
    if (snap.e) body += `<div class="ans why">Justification : ${esc(snap.e)}</div>`;
    body += moreHtml(snap.m);
    body += `<div class="ans">${flagButton(snap.id)}</div>`;
    return `<article class="qa ${ok ? 'ok' : 'ko'}"><div class="qline"><span class="mark">${ok ? '✓' : '✗'}</span><span>${number}. ${esc(snap.q)}</span></div>${body}</article>`;
  }

  function qaList(snaps, onlyErrors) {
    const html = snaps.map((s, i) => qaHtml(s, i + 1, onlyErrors)).join('');
    return html || '<p class="tag-ok">Aucune erreur dans cette tentative, bravo !</p>';
  }

  // ------------------------------------------------------------------ maîtrise
  const masteryPct = (m) => (m.seen ? Math.round((100 * m.mastered) / m.seen) : null);
  const masteryText = (m) => (m.seen
    ? `Maîtrise ${masteryPct(m)} % · ${m.seen} vue${m.seen > 1 ? 's' : ''} sur ${m.total}`
    : `Pas encore travaillée · ${m.total} questions`);
  // les largeurs sont appliquées par le script (data-w) : la politique de sécurité interdit les styles en ligne
  const meterHtml = (m) => `<div class="meter"><div class="seen" data-w="${(100 * m.seen) / m.total}"></div>
    <div class="done" data-w="${(100 * m.mastered) / m.total}"></div></div>`;

  // ------------------------------------------------------------------ rappels de l'accueil
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  function noticesHtml() {
    let html = '';
    if (!persistent) {
      html += '<div class="banner">Le stockage du navigateur est indisponible (navigation privée ?) : l\'historique ne sera pas conservé.</div>';
    }
    if (isIOS() && !isStandalone() && !prefs().installHintDismissed) {
      html += `<div class="notice"><p><strong>Installer l'application</strong> : touchez Partager, puis « Sur l'écran d'accueil ». Elle fonctionnera hors ligne et votre historique sera mieux protégé.</p>
        <div class="actions"><button class="btn secondary small" data-act="dismiss-install">Compris</button></div></div>`;
    }
    const last = prefs().lastExport || 0;
    if (store.data.history.length >= 3 && Date.now() - last > 7 * DAY && Date.now() > (prefs().exportSnooze || 0)) {
      html += `<div class="notice"><p><strong>Sauvegarde</strong> : ${last ? 'votre dernière sauvegarde date de plus d\'une semaine' : 'votre historique n\'a jamais été sauvegardé'}. Exportez-le pour ne pas le perdre.</p>
        <div class="actions"><button class="btn small" data-act="export">Exporter</button>
        <button class="btn secondary small" data-act="snooze-export">Plus tard</button></div></div>`;
    }
    return html;
  }

  // ------------------------------------------------------------------ accueil
  function renderHome() {
    state.session = null;
    const bank = currentBank();
    const mastery = store.mastery(bank);
    const totals = Object.values(mastery).reduce((a, m) => ({ seen: a.seen + m.seen, mastered: a.mastered + m.mastered, total: a.total + m.total }), { seen: 0, mastered: 0, total: 0 });
    const batchButtons = (attrs) => E.BATCH_SIZES.map((n) => `<button class="btn secondary" ${attrs} data-n="${n}">${n}</button>`).join('');

    const cats = Object.values(bank).map((c) => {
      const m = mastery[c.key];
      return `<div class="cat"><div class="info"><div class="name">${esc(c.label)}</div>
        <div class="muted small">${masteryText(m)}</div>${meterHtml(m)}</div>${batchButtons(`data-act="cat" data-key="${c.key}"`)}</div>`;
    }).join('');
    const missed = store.missedQuestions(bank).length;
    const flagged = store.flaggedQuestions(bank).length;

    show('home', `
      ${noticesHtml()}
      ${header('QCM Civique')}
      <p class="muted">Les questions de la liste officielle de l'examen civique publiée par le ministère de l'Intérieur : entraînez-vous par catégorie ou passez une simulation d'examen.</p>
      ${totals.seen ? `<div class="card progress"><div><strong>${totals.mastered}</strong> question${totals.mastered > 1 ? 's' : ''} maîtrisée${totals.mastered > 1 ? 's' : ''} sur ${totals.total}</div>
        ${meterHtml(totals)}<div class="muted small">${totals.seen} déjà vues · maîtrisée = dernière réponse juste</div></div>` : ''}
      <div class="actions"><button class="btn grow" data-act="sim">Simulation d'examen · 40 questions · 45 min</button></div>
      <label class="check"><input type="checkbox" data-change="immediate" ${state.immediate ? 'checked' : ''}>
        <span>Afficher la correction après chaque question (entraînement)</span></label>
      <div class="card smart"><div class="cat"><div class="info"><div class="name">Série intelligente</div>
        <div class="muted small">Priorité à vos erreurs, aux questions jamais vues et à celles que vous avez marquées</div></div>${batchButtons('data-act="smart"')}</div></div>
      <div class="card">${cats}
        <div class="cat"><div class="info"><div class="name">Mix de toutes les catégories</div>
          <div class="muted small">${E.allQuestions(bank).length} questions</div></div>${batchButtons('data-act="mix"')}</div>
      </div>
      <div class="actions">
        <button class="btn secondary" data-act="revise" ${missed ? '' : 'disabled'}>Réviser mes erreurs (${missed})</button>
        <button class="btn secondary" data-act="flags">Questions à revoir (${flagged})</button>
      </div>
      <div class="actions">
        <button class="btn secondary" data-act="sheets">Fiches de révision</button>
        <button class="btn secondary" data-act="history">Historique</button>
      </div>
      <footer><span class="muted small">Application non officielle</span><br>
        <button class="link" data-act="settings">Réglages</button> · <button class="link" data-act="about">À propos</button></footer>`);
  }

  function renderAbout() {
    show('about', `
      ${header('À propos')}
      <div class="card">
        <p><strong>QCM Civique</strong> est une application d'entraînement au QCM de l'examen civique pour la naturalisation française. Ce n'est pas un service officiel.</p>
        <h3>Les questions</h3>
        <p>Les énoncés viennent de la liste des questions de connaissance publiée par la Direction générale des étrangers en France (ministère de l'Intérieur) en janvier 2026. Cette liste ne donne pas les réponses : les choix et les explications ont été préparés avec l'aide d'une IA, puis relus à l'aide du Livret du citoyen (édition de mai 2026). Dans « En savoir plus », les pages du Livret sont indiquées.</p>
        <h3>Fiabilité</h3>
        <p>Une erreur reste possible. En cas de doute, la référence est le Livret du citoyen du ministère de l'Intérieur.</p>
        <h3>Vos données</h3>
        <p>Aucune donnée n'est envoyée. Votre historique reste sur cet appareil.</p>
      </div>
      <div class="actions"><button class="btn secondary" data-act="home">Retour</button></div>`);
  }

  // ------------------------------------------------------------------ réglages
  function renderSettings() {
    const theme = prefs().theme || 'auto';
    const size = prefs().textSize || 'normal';
    const opt = (act, key, value, label, current) =>
      `<button class="btn ${current === value ? '' : 'secondary'}" data-act="${act}" data-${key}="${value}">${label}</button>`;
    show('settings', `
      ${header('Réglages')}
      <div class="card"><h3 class="first">Apparence</h3>
        <div class="tabs">${opt('set-theme', 'value', 'auto', 'Automatique', theme)}${opt('set-theme', 'value', 'light', 'Clair', theme)}${opt('set-theme', 'value', 'dark', 'Sombre', theme)}</div>
        <h3>Taille du texte</h3>
        <div class="tabs">${opt('set-size', 'value', 'normal', 'Normale', size)}${opt('set-size', 'value', 'large', 'Grande', size)}</div>
      </div>
      <div class="card"><h3 class="first">Sauvegarde et transfert</h3>
        <p class="muted small">Votre historique et vos questions marquées restent sur cet appareil. Exportez-les pour les conserver ou les transférer sur un autre appareil.${prefs().lastExport ? ` Dernière sauvegarde : ${esc(E.nowString(new Date(prefs().lastExport)))}.` : ''}</p>
        <div class="actions">
          <button class="btn secondary small" data-act="export">Exporter</button>
          <button class="btn secondary small" data-act="import">Importer et fusionner</button>
          <input type="file" id="import-file" accept=".json,application/json" hidden data-change="import">
        </div>
        <h3>Effacer mes données</h3>
        <p class="muted small">Supprime l'historique, les statistiques, les erreurs et les questions marquées de cet appareil. Pensez à exporter avant.</p>
        <div class="actions"><button class="btn secondary small" data-act="reset">Effacer mes données</button></div>
      </div>
      <div class="actions"><button class="btn secondary" data-act="home">Retour</button></div>`);
  }

  // ------------------------------------------------------------------ fiches de révision
  function sheetItemHtml(q) {
    const m = q.more;
    const text = norm(`${q.text} ${q.answer} ${m ? `${m.k} ${m.c}` : ''}`);
    const src = m ? sourceText(m) : '';
    return `<article class="sheet-item" data-search="${esc(text)}">
      <div class="qline"><strong>${esc(q.text)}</strong></div>
      <div class="ans good">Réponse : ${esc(q.answer)}</div>
      ${m && m.k ? `<p class="k"><strong>À retenir :</strong> ${esc(m.k)}</p>` : ''}
      ${m && m.c ? `<details class="more"><summary>Pour comprendre</summary><p>${esc(m.c)}</p>${src ? `<p class="src">${esc(src)}</p>` : ''}</details>` : ''}
      <div class="ans">${flagButton(q.id)}</div></article>`;
  }

  function renderSheets() {
    const bank = currentBank();
    const sections = Object.values(bank).map((c) => `<details class="sheet-cat" data-cat="${esc(c.key)}">
      <summary><strong>${esc(c.label)}</strong> <span class="muted small" data-count>${c.questions.length} fiches</span></summary>
      ${c.questions.map(sheetItemHtml).join('')}</details>`).join('');
    show('sheets', `
      ${header('Fiches de révision')}
      <p class="muted small">L'essentiel de chaque question, regroupé par catégorie. Touchez ☆ pour marquer une fiche à revoir.</p>
      <input type="search" id="sheet-q" class="search" placeholder="Rechercher (ex. laïcité, 1905, préfet)" autocomplete="off" autocapitalize="off" aria-label="Rechercher dans les fiches">
      <div id="sheet-empty" class="muted" hidden>Aucune fiche ne correspond à cette recherche.</div>
      <div id="sheet-list">${sections}</div>
      <div class="actions"><button class="btn secondary" data-act="home">Accueil</button></div>`);
  }

  function filterSheets(value) {
    const q = norm(value).trim();
    let total = 0;
    document.querySelectorAll('.sheet-cat').forEach((cat) => {
      let shown = 0;
      cat.querySelectorAll('.sheet-item').forEach((it) => {
        const hit = !q || it.dataset.search.includes(q);
        it.hidden = !hit;
        if (hit) shown += 1;
      });
      cat.hidden = shown === 0;
      const count = cat.querySelector('[data-count]');
      if (count) count.textContent = `${shown} fiche${shown > 1 ? 's' : ''}`;
      if (q) cat.open = shown > 0;
      total += shown;
    });
    document.getElementById('sheet-empty').hidden = total > 0;
  }

  // ------------------------------------------------------------------ questions à revoir
  function renderFlags() {
    const flagged = store.flaggedQuestions(currentBank());
    const list = flagged.map((q) => `<article class="sheet-item">
      <div class="qline"><strong>${esc(q.text)}</strong></div>
      <div class="ans good">Réponse : ${esc(q.answer)}</div>
      ${moreHtml(q.more)}
      <div class="ans"><button class="link" data-act="unflag" data-id="${esc(q.id)}">Retirer de la liste</button></div></article>`).join('');
    show('flags', `
      ${header('Questions à revoir')}
      ${flagged.length
        ? `<p class="muted small">Les questions que vous avez marquées avec ☆ pendant vos séances ou dans les fiches.</p>
           <div class="actions"><button class="btn grow" data-act="start-flagged">Faire une série avec ces ${flagged.length} questions</button></div>
           <div class="card">${list}</div>`
        : '<div class="card muted">Aucune question marquée. Pendant une série, touchez « ☆ À revoir » pour garder une question de côté et la retrouver ici.</div>'}
      <div class="actions"><button class="btn secondary" data-act="home">Accueil</button></div>`);
  }

  // ------------------------------------------------------------------ démarrage des séances
  function begin(mode, label, questions, practice, replay) {
    if (!questions.length) { notify('Aucune question disponible pour ce choix.'); return; }
    state.session = {
      mode, label,
      items: questions.map((q) => E.present(q, rng)), practice, replay,
      seriesId: null, attemptNo: 1, seconds: 0, index: 0, validated: false, choice: -1, start: Date.now(),
    };
    renderQuestion();
  }

  const shuffled = (arr) => {
    const qs = arr.slice();
    for (let i = qs.length - 1; i > 0; i--) { const j = rng.int(i + 1); [qs[i], qs[j]] = [qs[j], qs[i]]; }
    return qs;
  };

  function startCategory(key, n) {
    const cat = currentBank()[key];
    const qs = E.pickBatch(cat.questions, n, rng);
    begin('categorie', `${cat.label} (${qs.length} questions)`, qs, state.immediate, () => startCategory(key, n));
  }

  function startMix(n) {
    const qs = E.pickBatch(E.allQuestions(currentBank()), n, rng);
    begin('mix', `Mix toutes catégories (${qs.length} questions)`, qs, state.immediate, () => startMix(n));
  }

  function startSmart(n) {
    const qs = store.smartBatch(E.allQuestions(currentBank()), n, rng);
    begin('smart', `Série intelligente (${qs.length} questions)`, qs, state.immediate, () => startSmart(n));
  }

  function startSimulation() {
    const qs = E.buildSimulation(currentBank(), rng);
    begin('simulation', `Simulation d'examen (${qs.length} questions)`, qs, false, startSimulation);
  }

  function startRevision() {
    const qs = shuffled(store.missedQuestions(currentBank()));
    begin('revision', `Révision de mes erreurs (${qs.length} questions)`, qs, true, startRevision);
  }

  function startFlagged() {
    const qs = shuffled(store.flaggedQuestions(currentBank()));
    begin('flagged', `Questions à revoir (${qs.length} questions)`, qs, true, startFlagged);
  }

  /** Nouvelle tentative d'une série, limitée aux erreurs restantes. */
  function startRetry(seriesId, replay) {
    const entry = store.findSeries(seriesId);
    const errors = E.remainingErrors(entry.attempts);
    if (!errors.length) { notify('Toutes les erreurs de cette série sont corrigées.'); return; }
    const qs = shuffled(errors.map(E.questionFromSnapshot));
    state.session = {
      mode: 'retry', label: `${entry.label} - tentative ${entry.attempts.length + 1} (erreurs)`,
      items: qs.map((q) => E.present(q, rng)), practice: true, replay: replay || null,
      seriesId, attemptNo: entry.attempts.length + 1, seconds: 0, index: 0, validated: false, choice: -1, start: Date.now(),
    };
    renderQuestion();
  }

  // ------------------------------------------------------------------ écran de question
  /** Simulation d'examen : 45 minutes, aucune correction, une question sans réponse est fausse. */
  const isExam = (s) => s.mode === 'simulation';

  function renderQuestion() {
    const s = state.session;
    const item = s.items[s.index];
    s.validated = false;
    s.choice = -1;
    let where = currentBank()[item.question.category].label;
    if (item.question.theme) where += ` · Thème de l'examen : ${item.question.theme}`;
    const pct = (100 * s.index) / s.items.length;

    show('question', `
      <div class="topline"><span class="session-label">${esc(s.label)}</span><span id="timer" class="muted small"></span></div>
      <div class="muted small">Question ${s.index + 1} / ${s.items.length} · ${esc(where)}</div>
      <div class="bar"><div data-w="${pct}"></div></div>
      ${isExam(s) ? '<div class="exam-note">Examen de 45 minutes. Une question passée sans réponse est comptée comme fausse.</div>' : ''}
      <div class="card question">
        <h2>${esc(item.question.text)}</h2>
        <div id="opts">${item.options.map((o, i) => `<button class="opt" data-act="choose" data-i="${i}">
          <span class="letter">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      </div>
      <div id="feedback" class="feedback" hidden></div>
      <div id="more"></div>
      <div class="qactions">
        <button class="btn" id="next" data-act="next" disabled>Valider</button>
        <button class="btn secondary" data-act="abandon">Abandonner</button>
        ${flagButton(item.question.id, 'btn secondary')}
      </div>`);
    const tick = () => {
      const cur = state.session;
      const el = document.getElementById('timer');
      if (!cur || !el) return;
      const elapsed = Math.floor((Date.now() - cur.start) / 1000);
      if (isExam(cur)) {
        const left = E.EXAM_SECONDS - elapsed;
        if (left <= 0) { timeUp(); return; }
        el.textContent = `Temps restant : ${fmtTime(left)}`;
        el.classList.toggle('alert', left <= 300);
      } else {
        el.textContent = `Temps : ${fmtTime(elapsed)}`;
      }
    };
    tick();
    state.tick = tick;
    state.timer = setInterval(tick, 1000);
    updateNext();
  }

  /** Fin du temps : l'examen s'arrête, les questions non traitées comptent fausses. */
  function timeUp() {
    const s = state.session;
    if (!s || s.finished) return;
    closeDialog();
    if (s.choice >= 0) s.items[s.index].chosen = s.choice;   // réponse choisie mais pas encore validée
    s.timeUp = true;
    showResults();
    notify('Temps écoulé : les 45 minutes de l\'examen sont terminées. Les questions sans réponse sont comptées comme fausses.');
  }

  function updateNext() {
    const s = state.session;
    const btn = document.getElementById('next');
    if (!btn) return;
    const last = s.index === s.items.length - 1;
    const answered = s.choice >= 0;
    if (s.practice && !s.validated) {
      btn.textContent = 'Valider';
      btn.disabled = !answered;
    } else {
      btn.textContent = last ? 'Voir le résultat' : 'Question suivante';
      // Entraînement : une réponse est obligatoire (avec correction, elle a déjà été validée).
      // Simulation d'examen : on peut passer sans répondre, un message d'attention s'affiche alors.
      btn.disabled = s.practice || isExam(s) ? false : !answered;
    }
  }

  function choose(i) {
    const s = state.session;
    if (!s || s.validated) return;
    s.choice = i;
    document.querySelectorAll('#opts .opt').forEach((b, j) => b.classList.toggle('selected', j === i));
    updateNext();
  }

  function showFeedback(item) {
    document.querySelectorAll('#opts .opt').forEach((b, i) => {
      b.classList.add('locked');
      b.classList.remove('selected');
      if (i === item.correctIndex) b.classList.add('correct');
      else if (i === item.chosen) b.classList.add('wrong');
    });
    const ok = E.isCorrect(item);
    let msg = ok ? 'Bonne réponse !' : `Mauvaise réponse. Bonne réponse : ${item.options[item.correctIndex]}`;
    if (item.question.explanation) msg += `\n${item.question.explanation}`;
    const fb = document.getElementById('feedback');
    fb.textContent = msg;
    fb.className = `feedback ${ok ? 'good' : 'bad'}`;
    fb.hidden = false;
    document.getElementById('more').innerHTML = moreHtml(item.question.more);
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function next() {
    const s = state.session;
    const item = s.items[s.index];
    const answered = s.choice >= 0;
    if (s.practice) {
      if (!s.validated) {
        if (!answered) return;
        item.chosen = s.choice;
        s.validated = true;
        showFeedback(item);
        updateNext();
        return;
      }
      advance(item.chosen);
      return;
    }
    if (answered) { advance(s.choice); return; }
    if (isExam(s)) warnSkip();   // comme à l'examen : on peut passer, mais la question compte fausse
  }

  /** Enregistre le choix (null = sans réponse) et passe à la question suivante ou au résultat. */
  function advance(choice) {
    const s = state.session;
    s.items[s.index].chosen = choice;
    if (s.index + 1 < s.items.length) { s.index += 1; renderQuestion(); } else { showResults(); }
  }

  function warnSkip() {
    const s = state.session;
    const last = s.index === s.items.length - 1;
    dialog('Attention : aucune réponse n\'est sélectionnée. Comme à l\'examen, une question passée sans réponse est comptée comme fausse.',
      [{ label: 'Revenir à la question', primary: true },
       { label: last ? 'Terminer sans répondre' : 'Passer sans répondre', onClick: () => advance(null) }]);
  }

  function abandon() {
    askConfirm('Quitter cette séance ? Les réponses ne seront pas enregistrées.', 'Quitter la séance', renderHome);
  }

  // ------------------------------------------------------------------ résultats d'une série
  function showResults() {
    const s = state.session;
    if (s.finished) return;
    s.finished = true;
    const elapsed = Math.floor((Date.now() - s.start) / 1000);
    s.seconds = isExam(s) ? Math.min(elapsed, E.EXAM_SECONDS) : elapsed;
    if (s.seriesId === null) {
      s.seriesId = store.recordSession(s.mode, s.label, s.items, s.seconds);
      s.attemptNo = 1;
    } else {
      s.attemptNo = store.recordAttempt(s.seriesId, s.items, s.seconds);
    }
    renderResults('all');
  }

  function renderResults(flt) {
    const s = state.session;
    const entry = store.findSeries(s.seriesId);
    const attempts = entry.attempts;
    const snaps = s.items.map(E.snapshotItem);
    const res = E.summarize(s.items);
    const pct = Math.round((100 * res.score) / res.total);
    const ok = E.passed(res.score, res.total);
    const remaining = E.remainingErrors(attempts);
    const nErr = snaps.filter((x) => !E.snapshotOk(x)).length;
    const bank = currentBank();

    let info = `Temps : ${fmtTime(s.seconds)}`;
    if (s.timeUp) info += ' (temps écoulé)';
    if (s.mode === 'simulation') info += ` · Seuil de réussite : ${Math.floor(E.PASS_RATIO * res.total)} / ${res.total}`;
    const blanks = s.items.filter((it) => it.chosen === null || it.chosen === undefined).length;
    if (blanks) info += ` · ${plural(blanks, 'question')} sans réponse (comptée${blanks > 1 ? 's' : ''} fausse${blanks > 1 ? 's' : ''})`;
    const chain = attempts.length > 1
      ? `<div class="muted">Tentatives de cette série : ${attempts.map((a) => `${a.n}) ${a.score}/${a.total}`).join('  ')}</div>` : '';
    const cats = Object.keys(res.byCategory).sort().map((k) => `<div class="list-line">${esc(bank[k].label)} : ${res.byCategory[k][0]} / ${res.byCategory[k][1]}</div>`).join('');

    show('results', `
      ${header(s.attemptNo > 1 ? `Résultat - tentative ${s.attemptNo} (erreurs reprises)` : 'Résultat')}
      <div class="muted">${esc(entry.label)}</div>
      <div class="score ${ok ? 'good' : 'bad'}">
        <div class="big">${res.score} / ${res.total} (${pct} %)</div>
        <div>${ok ? 'Objectif atteint (80 % ou plus)' : 'En dessous de 80 % : continuez à réviser'}</div>
        <div class="muted">${info}</div>${chain}
      </div>
      <div class="actions">
        ${remaining.length ? `<button class="btn grow" data-act="retry">Refaire mes erreurs (${remaining.length})</button>` : ''}
        ${s.replay ? '<button class="btn secondary" data-act="replay">Nouvelle série identique</button>' : ''}
        <button class="btn secondary" data-act="home">Accueil</button>
        <button class="btn secondary" data-act="history">Historique</button>
      </div>
      <h3>Par catégorie</h3>${cats}
      <div class="tabs">
        <button class="btn ${flt === 'all' ? '' : 'secondary'}" data-act="tab-results" data-flt="all">Toutes (${snaps.length})</button>
        <button class="btn ${flt === 'errors' ? '' : 'secondary'}" data-act="tab-results" data-flt="errors">Erreurs (${nErr})</button>
      </div>
      <div class="card">${qaList(snaps, flt === 'errors')}</div>`);
  }

  // ------------------------------------------------------------------ historique
  function renderHistory() {
    const history = store.data.history;
    const bank = currentBank();
    const mastery = store.mastery(bank);
    const rows = Object.values(bank).map((c) => {
      const m = mastery[c.key];
      return `<div class="hist-cat"><div class="name">${esc(c.label)}</div><div class="muted small">${masteryText(m)}${m.seen ? ` · ${m.mastered} maîtrisée${m.mastered > 1 ? 's' : ''}` : ''}</div>${meterHtml(m)}</div>`;
    }).join('');
    const sims = history.filter((h) => h.mode === 'simulation');
    let simLine = '';
    if (sims.length) {
      const best = sims.reduce((a, b) => (b.score / b.total > a.score / a.total ? b : a));
      simLine = `<p class="muted small">Simulations : ${sims.length} · meilleur score ${best.score}/${best.total}</p>`;
    }
    const list = history.map((h, idx) => {
      const att = h.attempts;
      const extra = att
        ? `${plural(att.length - 1, 'reprise')} · <span class="${E.remainingErrors(att).length ? 'tag-ko' : 'tag-ok'}">${E.remainingErrors(att).length} à corriger</span>`
        : 'détail non conservé';
      return `<button class="series" data-act="detail" data-idx="${idx}"><div class="top"><span>${esc(h.label)}</span>
        <span class="score-pill">${h.score}/${h.total}</span></div><div class="muted small">${esc(h.date)} · ${extra}</div></button>`;
    }).reverse().join('');

    show('history', `
      ${header('Historique')}
      <div class="card"><h3 class="first">Maîtrise par catégorie</h3>
        <p class="muted small">Une question est maîtrisée quand votre dernière réponse était juste. Corriger une erreur la fait remonter.</p>${rows}${simLine}</div>
      <h3>Séances (touchez-en une pour le détail)</h3>
      ${list || '<p class="muted">Aucune séance pour l\'instant.</p>'}
      <div class="actions"><button class="btn secondary" data-act="home">Accueil</button></div>`);
  }

  function renderDetail(idx, flt) {
    const h = store.data.history[idx];
    const att = h.attempts;
    let body;
    let retryBtn = '';
    if (!att) {
      body = '<div class="card muted">Le détail des questions n\'a pas été conservé pour cette séance : elle a été faite avant l\'ajout de cette fonction. Seul le résumé (score, durée) existe. Les prochaines séances seront détaillées.</div>';
    } else {
      const remaining = E.remainingErrors(att);
      const retries = att.length - 1;
      const kind = (a) => (a.n === 1 ? 'série complète' : 'reprise des erreurs');
      const summary = att.map((a) => `<div class="list-line">Tentative ${a.n} (${kind(a)}) : ${a.score}/${a.total} · ${fmtTime(a.seconds)} · ${esc(a.date)}</div>`).join('');
      const blocks = att.map((a) => `<h3>Tentative ${a.n} - ${kind(a)} - ${a.score}/${a.total}</h3><div class="card">${qaList(a.items, flt === 'errors')}</div>`).join('');
      if (remaining.length) retryBtn = `<button class="btn grow" data-act="retry-series" data-id="${esc(h.id)}">Refaire mes erreurs (${remaining.length})</button>`;
      body = `<div class="card"><h3 class="first">Résumé</h3>
          <div class="list-line">Tentatives : ${att.length} (${retries ? `${plural(retries, 'reprise')} des erreurs` : 'aucune reprise'})</div>${summary}
          <div class="list-line ${remaining.length ? 'tag-ko' : 'tag-ok'}">Erreurs restant à corriger : ${remaining.length}</div></div>
        <div class="tabs">
          <button class="btn ${flt === 'all' ? '' : 'secondary'}" data-act="tab-detail" data-idx="${idx}" data-flt="all">Toutes les questions</button>
          <button class="btn ${flt === 'errors' ? '' : 'secondary'}" data-act="tab-detail" data-idx="${idx}" data-flt="errors">Erreurs seulement</button>
        </div>${blocks}`;
    }
    show('detail', `
      ${header('Détail de la séance')}
      <div><strong>${esc(h.label)}</strong></div>
      <div class="muted">${esc(h.date)} · Durée : ${fmtTime(h.seconds)} · Score : ${h.score}/${h.total}</div>
      <div class="actions">${retryBtn}<button class="btn secondary" data-act="history">Retour à l'historique</button></div>
      ${body}`);
  }

  // ------------------------------------------------------------------ sauvegarde
  async function exportHistory() {
    const name = `qcm-civique-historique-${E.nowString().slice(0, 10)}.json`;
    const file = new File([store.exportJSON()], name, { type: 'application/json' });
    const done = () => { store.setPref('lastExport', Date.now()); if (state.view === 'home') renderHome(); };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); done(); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    done();
  }

  async function importHistory(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const added = store.importMerge(await file.text());
      renderSettings();
      notify(added ? `${plural(added, 'séance ajoutée')}. Les erreurs à revoir, les statistiques et les questions marquées ont été fusionnées.` : 'Aucune nouvelle séance : ce fichier est déjà intégré.');
    } catch (e) {
      notify('Import impossible : ce fichier n\'est pas un historique valide.');
    }
    input.value = '';
  }

  function resetData() {
    askConfirm('Effacer l\'historique, les statistiques, les erreurs et les questions marquées de cet appareil ? Cette action est définitive.',
      'Effacer mes données', () => { store.reset(); renderSettings(); notify('Vos données ont été effacées.'); }, 'Annuler');
  }

  // ------------------------------------------------------------------ évènements
  function toggleFlag(id) {
    const on = store.toggleFlag(id);
    document.querySelectorAll(`[data-act="flag"][data-id="${id}"]`).forEach((b) => { b.textContent = flagLabel(on); });
  }

  const actions = {
    cat: (d) => startCategory(d.key, Number(d.n)),
    mix: (d) => startMix(Number(d.n)),
    smart: (d) => startSmart(Number(d.n)),
    sim: startSimulation,
    revise: startRevision,
    flags: renderFlags,
    'start-flagged': startFlagged,
    sheets: renderSheets,
    history: renderHistory,
    home: renderHome,
    about: renderAbout,
    settings: renderSettings,
    choose: (d) => choose(Number(d.i)),
    next,
    abandon,
    flag: (d) => toggleFlag(d.id),
    unflag: (d) => { store.toggleFlag(d.id); renderFlags(); },
    retry: () => startRetry(state.session.seriesId, state.session.replay),
    replay: () => state.session.replay(),
    'tab-results': (d) => renderResults(d.flt),
    detail: (d) => renderDetail(Number(d.idx), 'all'),
    'tab-detail': (d) => renderDetail(Number(d.idx), d.flt),
    'retry-series': (d) => startRetry(d.id, null),
    export: exportHistory,
    import: () => document.getElementById('import-file').click(),
    reset: resetData,
    'set-theme': (d) => { store.setPref('theme', d.value); applySettings(); renderSettings(); },
    'set-size': (d) => { store.setPref('textSize', d.value); applySettings(); renderSettings(); },
    'dismiss-install': () => { store.setPref('installHintDismissed', true); renderHome(); },
    'snooze-export': () => { store.setPref('exportSnooze', Date.now() + 2 * DAY); renderHome(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el.dataset);
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'immediate') {
      state.immediate = el.checked;
    } else if (el.dataset.change === 'import') {
      importHistory(el);
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'sheet-q') filterSheets(e.target.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDialog();
    if (document.getElementById('dialog')) return;   // une boîte de dialogue est ouverte
    if (state.view !== 'question' || !state.session || e.target !== document.body) return;
    if (e.key === 'Enter') {
      const btn = document.getElementById('next');
      if (btn && !btn.disabled) next();
      return;
    }
    const idx = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
    if (idx !== undefined) choose(idx);
  });

  // le chrono se met à jour dès le retour sur l'application (iOS suspend les minuteries en arrière-plan)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.tick) state.tick(); });

  // indicateur de connexion : l'application fonctionne hors ligne, on le signale simplement
  function showNetwork() {
    let pill = document.getElementById('net');
    if (navigator.onLine) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'net';
      pill.textContent = 'Hors ligne : tout fonctionne normalement';
      document.body.appendChild(pill);
    }
  }
  window.addEventListener('online', showNetwork);
  window.addEventListener('offline', showNetwork);

  // ------------------------------------------------------------------ démarrage
  async function init() {
    applySettings();
    showNetwork();
    try {
      const raw = await (await fetch('data/banks.json')).json();
      state.bank = E.loadBank(raw.official);
    } catch (e) {
      $app.innerHTML = '<div class="banner">Impossible de charger les questions. Vérifiez la connexion, puis rechargez la page.</div>';
      return;
    }
    renderHome();
  }

  init();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
