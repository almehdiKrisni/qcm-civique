/* Moteur du QCM : tirage, correction, historique. Aucun accès au DOM (testable avec Node).
 * Reprend la logique de quiz_engine.py. Le format d'historique est identique à celui de
 * l'application Python (resultats.json) : on peut exporter d'un côté et importer de l'autre. */
const Engine = (() => {
  const SIM_SIZE = 40;
  const PASS_RATIO = 0.8;
  const BATCH_SIZES = [10, 20, 30];

  // ------------------------------------------------------------------ hasard
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const f = seed == null ? Math.random : mulberry32(seed);
    return { int: (n) => Math.floor(f() * n) };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sample(arr, n, rng) {
    return shuffle(arr.slice(), rng).slice(0, Math.min(n, arr.length));
  }

  // ------------------------------------------------------------------ banque de questions
  /** raw = { clé: { label, questions: [{id, q, a, w, e, theme?}] } }  ->  { clé: Category } */
  function loadBank(raw) {
    const bank = {};
    Object.keys(raw).sort().forEach((key) => {
      const cat = raw[key];
      const questions = cat.questions.map((r) => {
        const options = [r.a, ...r.w];
        if (options.length !== 4 || new Set(options).size !== 4) {
          throw new Error(`${key} : il faut 4 réponses distinctes (${r.q})`);
        }
        return { id: r.id, category: key, text: r.q, answer: r.a, wrong: r.w.slice(),
                 explanation: r.e || '', theme: r.theme || '' };
      });
      bank[key] = { key, label: cat.label, questions };
    });
    return bank;
  }

  function allQuestions(bank) {
    return Object.values(bank).flatMap((c) => c.questions);
  }

  // ------------------------------------------------------------------ tirage
  function present(question, rng) {
    const options = shuffle([question.answer, ...question.wrong], rng);
    return { question, options, correctIndex: options.indexOf(question.answer), chosen: null };
  }

  function pickBatch(questions, n, rng) {
    return sample(questions, n, rng);
  }

  /** Tirage équilibré dans toutes les catégories (40 = 5 ou 6 par catégorie). */
  function buildSimulation(bank, rng, size = SIM_SIZE) {
    const cats = Object.values(bank);
    const base = Math.floor(size / cats.length);
    const extra = size % cats.length;
    const quotas = {};
    cats.forEach((c) => { quotas[c.key] = base; });
    sample(cats, extra, rng).forEach((c) => { quotas[c.key] += 1; });

    let chosen = [];
    cats.forEach((c) => { chosen = chosen.concat(sample(c.questions, quotas[c.key], rng)); });
    if (chosen.length < size) {
      const used = new Set(chosen.map((q) => q.id));
      const rest = allQuestions(bank).filter((q) => !used.has(q.id));
      chosen = chosen.concat(sample(rest, size - chosen.length, rng));
    }
    return shuffle(chosen, rng);
  }

  // ------------------------------------------------------------------ correction
  const isCorrect = (it) => it.chosen === it.correctIndex;

  function summarize(items) {
    const byCategory = {};
    items.forEach((it) => {
      const cur = byCategory[it.question.category] || [0, 0];
      byCategory[it.question.category] = [cur[0] + (isCorrect(it) ? 1 : 0), cur[1] + 1];
    });
    return { score: items.filter(isCorrect).length, total: items.length, byCategory };
  }

  const passed = (score, total) => total > 0 && score / total >= PASS_RATIO;

  // ------------------------------------------------------------------ instantanés
  // Copie d'une question posée avec la réponse donnée : l'historique reste lisible même si
  // la banque de questions change plus tard.
  function snapshotItem(it) {
    const q = it.question;
    return { id: q.id, category: q.category, theme: q.theme, q: q.text, options: it.options.slice(),
             correct: it.correctIndex, chosen: it.chosen, e: q.explanation };
  }

  const snapshotOk = (s) => s.chosen === s.correct;

  function questionFromSnapshot(s) {
    return { id: s.id, category: s.category, text: s.q, answer: s.options[s.correct],
             wrong: s.options.filter((_, i) => i !== s.correct), explanation: s.e || '',
             theme: s.theme || '' };
  }

  /** Dernier résultat de chaque question de la série, gardé s'il est faux. */
  function remainingErrors(attempts) {
    const last = new Map();
    attempts.forEach((att) => att.items.forEach((s) => last.set(s.id, s)));
    return [...last.values()].filter((s) => !snapshotOk(s));
  }

  // ------------------------------------------------------------------ historique
  const pad = (n) => String(n).padStart(2, '0');
  function nowString(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Historique des séances, statistiques par question et erreurs à revoir.
   *  `storage` est un objet de type localStorage (getItem / setItem). */
  class Store {
    constructor(storage, key = 'qcm-civique-v1') {
      this.storage = storage;
      this.key = key;
      this.data = { history: [], missed: {}, stats: {}, prefs: {} };
      this.saveOk = true;
      this.load();
    }

    load() {
      try {
        const raw = this.storage.getItem(this.key);
        if (raw) {
          const o = JSON.parse(raw);
          Object.keys(this.data).forEach((k) => { if (o[k] !== undefined) this.data[k] = o[k]; });
        }
      } catch (e) { /* stockage illisible : on repart d'un historique vide */ }
    }

    save() {
      try {
        this.storage.setItem(this.key, JSON.stringify(this.data));
        this.saveOk = true;
      } catch (e) {
        this.saveOk = false;
      }
      return this.saveOk;
    }

    static attempt(items, seconds, number) {
      const res = summarize(items);
      return { n: number, date: nowString(), seconds: Math.round(seconds), score: res.score,
               total: res.total, items: items.map(snapshotItem) };
    }

    updateQuestions(items, countStats) {
      items.forEach((it) => {
        const id = it.question.id;
        if (countStats) {
          const st = this.data.stats[id] || (this.data.stats[id] = { ok: 0, ko: 0 });
          st[isCorrect(it) ? 'ok' : 'ko'] += 1;
        }
        if (isCorrect(it)) delete this.data.missed[id];
        else this.data.missed[id] = (this.data.missed[id] || 0) + 1;
      });
    }

    /** Nouvelle série (tentative 1). Retourne son identifiant. */
    recordSession(mode, label, items, seconds) {
      const att = Store.attempt(items, seconds, 1);
      const id = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.data.history.push({ id, date: att.date, mode, label, score: att.score, total: att.total,
                               seconds: att.seconds, attempts: [att] });
      this.updateQuestions(items, true);
      this.save();
      return id;
    }

    findSeries(id) {
      for (let i = this.data.history.length - 1; i >= 0; i--) {
        if (this.data.history[i].id === id) return this.data.history[i];
      }
      throw new Error(`Série introuvable : ${id}`);
    }

    /** Reprise des erreurs d'une série. Les reprises ne comptent pas dans les statistiques
     *  de réussite (elles les fausseraient) mais mettent à jour les erreurs à revoir. */
    recordAttempt(id, items, seconds) {
      const entry = this.findSeries(id);
      const number = entry.attempts.length + 1;
      entry.attempts.push(Store.attempt(items, seconds, number));
      this.updateQuestions(items, false);
      this.save();
      return number;
    }

    missedQuestions(bank) {
      const byId = new Map(allQuestions(bank).map((q) => [q.id, q]));
      return Object.keys(this.data.missed).filter((id) => byId.has(id)).map((id) => byId.get(id));
    }

    /** { clé: [réussies, total] } sur la première tentative de chaque question posée. */
    categoryRates(bank) {
      const catById = new Map(allQuestions(bank).map((q) => [q.id, q.category]));
      const rates = {};
      Object.entries(this.data.stats).forEach(([id, st]) => {
        const cat = catById.get(id);
        if (!cat) return;
        const cur = rates[cat] || [0, 0];
        rates[cat] = [cur[0] + st.ok, cur[1] + st.ok + st.ko];
      });
      return rates;
    }

    exportJSON() {
      return JSON.stringify(this.data, null, 1);
    }

    /** Fusionne un historique exporté (de l'appli web ou de l'appli Python) avec l'existant.
     *  Sans doublon : on peut réimporter le même fichier sans fausser les chiffres. */
    importMerge(text) {
      const other = JSON.parse(text);
      if (!other || !Array.isArray(other.history)) throw new Error('Fichier d\'historique invalide.');
      const keyOf = (h) => h.id || `${h.date}|${h.label}|${h.score}|${h.total}`;
      const have = new Set(this.data.history.map(keyOf));
      let added = 0;
      other.history.forEach((h) => {
        if (!have.has(keyOf(h))) { this.data.history.push(h); have.add(keyOf(h)); added += 1; }
      });
      this.data.history.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      Object.entries(other.missed || {}).forEach(([id, n]) => {
        this.data.missed[id] = Math.max(this.data.missed[id] || 0, n);
      });
      Object.entries(other.stats || {}).forEach(([id, st]) => {
        const cur = this.data.stats[id] || (this.data.stats[id] = { ok: 0, ko: 0 });
        cur.ok = Math.max(cur.ok, st.ok || 0);
        cur.ko = Math.max(cur.ko, st.ko || 0);
      });
      this.save();
      return added;
    }
  }

  return {
    SIM_SIZE, PASS_RATIO, BATCH_SIZES, makeRng, loadBank, allQuestions, present, pickBatch,
    buildSimulation, isCorrect, summarize, passed, snapshotItem, snapshotOk, questionFromSnapshot,
    remainingErrors, nowString, Store,
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
