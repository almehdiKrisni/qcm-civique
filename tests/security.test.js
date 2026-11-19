// Contrôles de sécurité de l'application : node tests/security.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const appFiles = ['index.html', 'app.js', 'engine.js', 'sw.js', 'style.css', 'manifest.webmanifest'];

// ------------------------------------------------------------------ politique de sécurité du contenu
const html = read('index.html');
const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
assert.ok(csp, 'index.html doit déclarer une politique de sécurité du contenu (CSP)');
const directives = Object.fromEntries(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [name, ...values] = d.split(/\s+/);
  return [name, values];
}));
assert.deepStrictEqual(directives['default-src'], ["'none'"], 'tout est interdit par défaut');
assert.deepStrictEqual(directives['script-src'], ["'self'"], 'seuls nos scripts s\'exécutent');
assert.deepStrictEqual(directives['connect-src'], ["'self'"], 'aucune requête vers un autre site');
assert.deepStrictEqual(directives['base-uri'], ["'none'"]);
assert.deepStrictEqual(directives['form-action'], ["'none'"]);
assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp), 'pas d\'exception dangereuse dans la CSP');

// ------------------------------------------------------------------ aucun contenu externe
appFiles.forEach((f) => {
  const text = read(f);
  const urls = text.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
  assert.deepStrictEqual(urls, [], `${f} : aucune adresse externe attendue (${urls.join(', ')})`);
});
assert.ok(!/<script(?![^>]*\ssrc=)/i.test(html), 'aucun script en ligne dans index.html');
assert.ok(!/<link[^>]+href="https?:/i.test(html) && !/<script[^>]+src="https?:/i.test(html), 'aucune ressource externe');

// ------------------------------------------------------------------ pratiques dangereuses
const js = read('app.js') + read('engine.js') + read('sw.js');
assert.ok(!/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(js), 'pas d\'eval, de Function ni de document.write');
assert.ok(!/\son(click|load|error|change|input|submit)\s*=/i.test(read('app.js') + html), 'pas de gestionnaire d\'évènement en ligne');
assert.ok(!/style="/.test(read('app.js') + html), 'pas de style en ligne (interdit par la CSP)');
assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(read('app.js')), 'pas de boîte de dialogue native (peut être bloquée)');

// ------------------------------------------------------------------ pas de secret ni de donnée personnelle
const files = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === '.git' || e.name === 'node_modules') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else files.push(path.relative(root, p));
  });
})(root);
files.forEach((f) => {
  assert.ok(!/(^|[\\/])(\.env|id_rsa|.*\.pem|.*\.key|resultats.*\.json|qcm-civique-historique-.*\.json)$/i.test(f), `fichier sensible dans le dépôt : ${f}`);
});
const secret = /(ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})/;
files.filter((f) => !/\.(png|ico)$/i.test(f)).forEach((f) => {
  assert.ok(!secret.test(fs.readFileSync(path.join(root, f), 'utf8')), `secret détecté dans ${f}`);
});

// ------------------------------------------------------------------ hors ligne : tous les fichiers du cache existent
const sw = read('sw.js');
const assets = [...(sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1]).matchAll(/'([^']+)'/g)].map((m) => m[1]);
assets.filter((a) => a !== './').forEach((a) => assert.ok(fs.existsSync(path.join(root, a)), `fichier du cache introuvable : ${a}`));
['index.html', 'style.css', 'engine.js', 'app.js', 'data/banks.json'].forEach((a) => assert.ok(assets.includes(a), `${a} doit être mis en cache`));

console.log(`SÉCURITÉ OK (${files.length} fichiers contrôlés, ${assets.length} fichiers en cache hors ligne)`);
