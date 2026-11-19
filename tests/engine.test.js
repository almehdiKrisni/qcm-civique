// Tests du moteur et de la banque de questions : node tests/engine.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const root = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'banks.json'), 'utf8'));
const bank = E.loadBank(raw.official);
const all = E.allQuestions(bank);

// ------------------------------------------------------------------ banque de questions
assert.deepStrictEqual(Object.keys(bank), ['culture', 'droits_devoirs', 'geographie', 'histoire', 'institutions', 'mises_en_situation', 'valeurs_laicite']);
assert.strictEqual(all.length, 258);
assert.strictEqual(new Set(all.map((q) => q.id)).size, all.length, 'identifiants uniques');
assert.strictEqual(new Set(all.map((q) => q.text)).size, all.length, 'énoncés uniques');
assert.ok(all.every((q) => q.id.startsWith('off-') && q.theme), 'questions officielles avec leur thème');
assert.ok(all.every((q) => q.explanation), 'chaque question a une explication');
assert.ok(all.every((q) => q.more && q.more.k && q.more.c && q.more.s), '« En savoir plus » complet');

// ------------------------------------------------------------------ équilibre des choix
// Les fausses réponses ne doivent pas trahir la bonne : la bonne réponse ne doit pas être
// systématiquement la plus longue. Le hasard donne environ 25 %.
const longest = all.filter((q) => q.answer.length > Math.max(...q.wrong.map((w) => w.length)));
const ratio = longest.length / all.length;
assert.ok(ratio <= 0.35, `la bonne réponse est la plus longue dans ${Math.round(100 * ratio)} % des questions (max 35 %)`);
const standout = all.filter((q) => q.answer.length > 14 && q.answer.length >= 1.3 * Math.max(...q.wrong.map((w) => w.length)));
assert.ok(standout.length <= Math.ceil(all.length * 0.03),
  `${standout.length} questions où la bonne réponse dépasse nettement les autres : ${standout.slice(0, 3).map((q) => q.text).join(' | ')}`);
// les 3 fausses réponses sont toutes différentes de la bonne et entre elles
assert.ok(all.every((q) => new Set([q.answer, ...q.wrong]).size === 4));

// ------------------------------------------------------------------ simulation et tirages
for (let seed = 1; seed <= 5; seed++) {
  const sim = E.buildSimulation(bank, E.makeRng(seed));
  assert.strictEqual(sim.length, 40);
  assert.strictEqual(new Set(sim.map((q) => q.id)).size, 40);
  const counts = {};
  sim.forEach((q) => { counts[q.category] = (counts[q.category] || 0) + 1; });
  Object.values(counts).forEach((n) => assert.ok(n === 5 || n === 6, JSON.stringify(counts)));
}
assert.strictEqual(E.pickBatch(bank.geographie.questions, 30, E.makeRng(2)).length, bank.geographie.questions.length);

// la bonne réponse suit le mélange
const rng = E.makeRng(3);
all.forEach((q) => {
  const it = E.present(q, rng);
  assert.strictEqual(it.options[it.correctIndex], q.answer);
  assert.strictEqual(new Set(it.options).size, 4);
});
// la position de la bonne réponse est équilibrée (A à D)
const pos = [0, 0, 0, 0];
const rng2 = E.makeRng(11);
for (let i = 0; i < 4000; i++) pos[E.present(all[i % all.length], rng2).correctIndex] += 1;
pos.forEach((n) => assert.ok(n > 800 && n < 1200, `position de la bonne réponse : ${pos}`));

// ------------------------------------------------------------------ historique, reprises, maîtrise
const mem = {};
const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
const store = new E.Store(storage);
const answer = (it, wrong) => { it.chosen = wrong ? (it.correctIndex + 1) % 4 : it.correctIndex; return it; };

const qs = E.pickBatch(bank.histoire.questions, 10, E.makeRng(4));
let items = qs.map((q, i) => answer(E.present(q, rng), i % 2 === 0));
const sid = store.recordSession('categorie', 'Histoire (10 questions)', items, 61.4);
let entry = store.findSeries(sid);
assert.strictEqual(entry.attempts.length, 1);
assert.strictEqual(entry.score, 5);
assert.strictEqual(entry.seconds, 61);
assert.strictEqual(E.remainingErrors(entry.attempts).length, 5);
assert.strictEqual(Object.keys(store.data.missed).length, 5);
assert.ok(entry.attempts[0].items.every((s) => s.m && s.m.s), 'le complément suit la question dans l\'historique');

let errs = E.remainingErrors(entry.attempts).map(E.questionFromSnapshot);
assert.ok(errs.every((q) => q.more), 'le complément survit à la reprise');
items = errs.map((q, i) => answer(E.present(q, rng), i === 0));
assert.strictEqual(store.recordAttempt(sid, items, 20), 2);
assert.strictEqual(E.remainingErrors(entry.attempts).length, 1);
errs = E.remainingErrors(entry.attempts).map(E.questionFromSnapshot);
items = errs.map((q) => answer(E.present(q, rng), false));
assert.strictEqual(store.recordAttempt(sid, items, 5), 3);
assert.strictEqual(E.remainingErrors(entry.attempts).length, 0);
assert.deepStrictEqual(entry.attempts.map((a) => a.score), [5, 4, 1]);
assert.strictEqual(Object.keys(store.data.missed).length, 0);
assert.strictEqual(entry.score, 5, 'le score initial reste celui de la 1re tentative');

// maîtrise : 10 questions vues, toutes maîtrisées après correction des erreurs
let m = store.mastery(bank).histoire;
assert.deepStrictEqual([m.seen, m.mastered, m.total], [10, 10, bank.histoire.questions.length]);
const lone = new E.Store({ getItem: () => null, setItem: () => {} });
const sample4 = E.pickBatch(bank.culture.questions, 4, E.makeRng(9)).map((q, i) => answer(E.present(q, rng), i === 0));
lone.recordSession('categorie', 'Culture', sample4, 10);
m = lone.mastery(bank).culture;
assert.deepStrictEqual([m.seen, m.mastered], [4, 3]);
assert.deepStrictEqual(lone.mastery(bank).histoire, { seen: 0, mastered: 0, total: bank.histoire.questions.length });
const missedQ = lone.missedQuestions(bank)[0];
lone.recordSession('revision', 'Révision', [answer(E.present(missedQ, rng), false)], 3);
m = lone.mastery(bank).culture;
assert.deepStrictEqual([m.seen, m.mastered], [4, 4]);

// les reprises n'entrent pas dans les statistiques de la 1re tentative
assert.deepStrictEqual(store.categoryRates(bank).histoire, [5, 10]);

// persistance et stockage indisponible
const store2 = new E.Store(storage);
assert.strictEqual(store2.data.history.length, 1);
assert.strictEqual(store2.data.history[0].attempts.length, 3);
const broken = new E.Store({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
broken.recordSession('categorie', 'x', items, 1);
assert.strictEqual(broken.saveOk, false);

// ------------------------------------------------------------------ questions à revoir
assert.strictEqual(E.EXAM_SECONDS, 2700, 'l\'examen dure 45 minutes');
const fl = new E.Store({ getItem: () => null, setItem: () => {} });
const fid = all[10].id;
assert.strictEqual(fl.isFlagged(fid), false);
assert.strictEqual(fl.toggleFlag(fid), true);
assert.deepStrictEqual(fl.flaggedQuestions(bank).map((q) => q.id), [fid]);
assert.strictEqual(fl.toggleFlag(fid), false);
assert.strictEqual(fl.flaggedQuestions(bank).length, 0);
fl.setPref('theme', 'dark');
assert.strictEqual(fl.data.prefs.theme, 'dark');

// ------------------------------------------------------------------ série intelligente
{
  const sm = new E.Store({ getItem: () => null, setItem: () => {} });
  const pool = bank.histoire.questions;            // 33 questions
  const wrong = pool.slice(0, 5);                  // erreurs actuelles
  const mastered = pool.slice(5, 15);              // déjà bien réussies
  wrong.forEach((q) => { sm.data.stats[q.id] = { ok: 0, ko: 2 }; sm.data.missed[q.id] = 2; });
  mastered.forEach((q) => { sm.data.stats[q.id] = { ok: 4, ko: 0 }; });
  const flagged = pool[20];
  sm.toggleFlag(flagged.id);
  const counts = new Map();
  const r = E.makeRng(21);
  for (let i = 0; i < 400; i++) sm.smartBatch(pool, 10, r).forEach((q) => counts.set(q.id, (counts.get(q.id) || 0) + 1));
  const avg = (qs) => qs.reduce((a, q) => a + (counts.get(q.id) || 0), 0) / qs.length;
  const unseen = pool.slice(15).filter((q) => q.id !== flagged.id);
  assert.ok(avg(wrong) > avg(unseen), 'les erreurs reviennent plus souvent que les questions jamais vues');
  assert.ok(avg(unseen) > avg(mastered) * 2, 'les questions jamais vues reviennent bien plus que les questions maîtrisées');
  assert.ok((counts.get(flagged.id) || 0) > avg(unseen), 'une question marquée à revoir est favorisée');
  const one = sm.smartBatch(pool, 10, E.makeRng(5));
  assert.strictEqual(new Set(one.map((q) => q.id)).size, 10, 'pas de doublon dans une série');
  assert.strictEqual(sm.smartBatch(pool, 99, E.makeRng(5)).length, pool.length, 'plafonné au nombre de questions');
}

// ------------------------------------------------------------------ import / export
const legacy = JSON.stringify({
  history: [{ date: '2026-11-17 17:01', mode: 'categorie', label: 'Culture (10 questions)', score: 8, total: 10, seconds: 112 }],
  missed: { 'culture-aaaa1111': 2 }, stats: { 'culture-aaaa1111': { ok: 2, ko: 1 } }, prefs: {},
});
assert.strictEqual(store.importMerge(legacy), 1);
assert.strictEqual(store.importMerge(legacy), 0, 'réimport : aucun doublon');
assert.strictEqual(store.data.history.length, 2);
assert.throws(() => store.importMerge('{"x":1}'));
// les questions marquées à revoir se fusionnent aussi
const withFlags = JSON.stringify({ history: [], flags: { 'off-culture-test': 1700000000000 } });
store.importMerge(withFlags);
assert.strictEqual(store.isFlagged('off-culture-test'), true);
// les identifiants d'anciennes questions absentes de la banque ne cassent rien
assert.ok(Array.isArray(store.missedQuestions(bank)));
assert.doesNotThrow(() => store.mastery(bank));

console.log(`MOTEUR ET BANQUE OK (${all.length} questions, bonne réponse la plus longue : ${Math.round(100 * ratio)} %)`);
