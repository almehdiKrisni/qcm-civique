// Tests du moteur : node tests/engine.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const root = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'banks.json'), 'utf8'));
const std = E.loadBank(raw.standard);
const off = E.loadBank(raw.official);

// banques : mêmes catégories dans le même ordre, tailles attendues
assert.deepStrictEqual(Object.keys(std), Object.keys(off));
assert.strictEqual(E.allQuestions(std).length, 279);
assert.strictEqual(E.allQuestions(off).length, 243);
assert.ok(E.allQuestions(off).every((q) => q.id.startsWith('off-') && q.theme));
assert.ok(E.allQuestions(std).every((q) => !q.id.startsWith('off-')));
for (const bank of [std, off]) {
  const ids = E.allQuestions(bank).map((q) => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiants uniques');
}

// « En savoir plus » : toutes les questions officielles ont un complément et une source
assert.ok(E.allQuestions(off).every((q) => q.more && q.more.k && q.more.c && q.more.s), 'compléments officiels');
assert.ok(E.allQuestions(std).every((q) => q.more && q.more.k && q.more.c && q.more.s), 'compléments complémentaires');
// ...et le complément suit la question dans l'historique (instantané) puis en reprise
{
  const q = off.histoire.questions[0];
  const it = E.present(q, E.makeRng(5));
  it.chosen = it.correctIndex;
  const snap = E.snapshotItem(it);
  assert.deepStrictEqual(snap.m, q.more);
  assert.deepStrictEqual(E.questionFromSnapshot(snap).more, q.more);
  const plain = E.snapshotItem(E.present(std.culture.questions.find((x) => !x.more) || std.culture.questions[0], E.makeRng(6)));
  assert.ok(!('m' in plain) || plain.m, 'sans complément : pas de champ vide');
}

// simulation : 40 questions uniques, équilibrées
for (const bank of [std, off]) {
  const sim = E.buildSimulation(bank, E.makeRng(1));
  assert.strictEqual(sim.length, 40);
  assert.strictEqual(new Set(sim.map((q) => q.id)).size, 40);
  const counts = {};
  sim.forEach((q) => { counts[q.category] = (counts[q.category] || 0) + 1; });
  Object.values(counts).forEach((n) => assert.ok(n === 5 || n === 6, JSON.stringify(counts)));
}

// pickBatch plafonné au nombre de questions disponibles
assert.strictEqual(E.pickBatch(off.geographie.questions, 30, E.makeRng(2)).length, 22);

// présentation : la bonne réponse suit le mélange
const rng = E.makeRng(3);
E.allQuestions(std).slice(0, 50).forEach((q) => {
  const it = E.present(q, rng);
  assert.strictEqual(it.options[it.correctIndex], q.answer);
  assert.strictEqual(new Set(it.options).size, 4);
});

// historique : série, reprises, erreurs restantes
const mem = {};
const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
const store = new E.Store(storage);
const answer = (it, wrong) => { it.chosen = wrong ? (it.correctIndex + 1) % 4 : it.correctIndex; return it; };

const qs = E.pickBatch(std.histoire.questions, 10, E.makeRng(4));
let items = qs.map((q, i) => answer(E.present(q, rng), i % 2 === 0));
const sid = store.recordSession('categorie', 'Histoire (10 questions)', items, 61.4);
let entry = store.findSeries(sid);
assert.strictEqual(entry.attempts.length, 1);
assert.strictEqual(entry.score, 5);
assert.strictEqual(entry.seconds, 61);
assert.strictEqual(E.remainingErrors(entry.attempts).length, 5);
assert.strictEqual(Object.keys(store.data.missed).length, 5);

// reprise : 1 erreur de plus, puis tout juste
let errs = E.remainingErrors(entry.attempts).map(E.questionFromSnapshot);
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

// les reprises n'entrent pas dans les statistiques
const rates = store.categoryRates(std);
assert.deepStrictEqual(rates.histoire, [5, 10]);

// maîtrise : 10 questions vues dont toutes maîtrisées après correction des erreurs
let m = store.mastery(std).histoire;
assert.deepStrictEqual([m.seen, m.mastered, m.total], [10, 10, 40]);
// une erreur non corrigée fait baisser la maîtrise, sans toucher aux catégories non travaillées
const lone = new E.Store({ getItem: () => null, setItem: () => {} });
const sample4 = E.pickBatch(std.culture.questions, 4, E.makeRng(9)).map((q, i) => answer(E.present(q, rng), i === 0));
lone.recordSession('categorie', 'Culture', sample4, 10);
m = lone.mastery(std).culture;
assert.deepStrictEqual([m.seen, m.mastered, m.total], [4, 3, 40]);
assert.deepStrictEqual(lone.mastery(std).histoire, { seen: 0, mastered: 0, total: 40 });
// réussir plus tard la question ratée la rend maîtrisée
const missedQ = lone.missedQuestions(std)[0];
lone.recordSession('revision', 'Révision', [answer(E.present(missedQ, rng), false)], 3);
m = lone.mastery(std).culture;
assert.deepStrictEqual([m.seen, m.mastered], [4, 4]);

// persistance
const store2 = new E.Store(storage);
assert.strictEqual(store2.data.history.length, 1);
assert.strictEqual(store2.data.history[0].attempts.length, 3);

// stockage en échec : pas d'exception, saveOk = false
const broken = new E.Store({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
broken.recordSession('categorie', 'x', items, 1);
assert.strictEqual(broken.saveOk, false);

// import : ancien format d'historique (sans attempts), fusion sans doublon
const pyHistory = JSON.stringify({
  history: [{ date: '2026-11-17 17:01', mode: 'categorie', label: 'Culture (10 questions)', score: 8, total: 10, seconds: 112 }],
  missed: { 'culture-aaaa1111': 2 }, stats: { 'culture-aaaa1111': { ok: 2, ko: 1 } }, prefs: { official: true },
});
assert.strictEqual(store.importMerge(pyHistory), 1);
assert.strictEqual(store.importMerge(pyHistory), 0, 'réimport : aucun doublon');
assert.strictEqual(store.data.history.length, 2);
assert.strictEqual(store.data.stats['culture-aaaa1111'].ok, 2);
assert.ok(!('attempts' in store.data.history[0]) || store.data.history[0].attempts);
assert.throws(() => store.importMerge('{"x":1}'));

console.log('MOTEUR OK');
