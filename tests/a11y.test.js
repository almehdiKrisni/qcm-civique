/* Contrôles d'accessibilité automatisables sans navigateur : contraste de la palette (WCAG 1.4.3),
 * règles CSS (focus visible, mouvement réduit), HTML (langue, zoom) et sémantique de l'interface.
 * L'audit complet dans un navigateur est dans tools/a11y-audit.js.   Lancer : node tests/a11y.test.js */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('style.css');
const html = read('index.html');
const app = read('app.js');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// ---- contraste
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function palette(block) {
  const vars = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}
const lightBlock = css.match(/:root\s*\{([^}]*)\}/)[1];
const darkBlock = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)[1];
const autoDark = css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)[1];
check(JSON.stringify(palette(darkBlock)) === JSON.stringify(palette(autoDark)), 'la palette sombre manuelle et automatique ont divergé');

// paires texte / fond réellement utilisées dans l'interface : [premier plan, fond, libellé]
const pairs = [
  ['text', 'bg', 'texte'], ['text', 'card', 'texte sur carte'], ['muted', 'bg', 'texte discret'], ['muted', 'card', 'texte discret sur carte'],
  ['muted', 'btn2', 'texte discret sur bouton secondaire'], ['text', 'btn2', 'bouton secondaire'],
  ['link', 'bg', 'titres et liens'], ['link', 'card', 'titres et liens sur carte'], ['link', 'btn2', 'liens sur bouton secondaire'],
  ['alert', 'bg', 'chrono en alerte'], ['alert', 'card', 'chrono en alerte sur carte'],
  ['good-fg', 'good', 'bonne réponse'], ['bad-fg', 'bad', 'mauvaise réponse'],
];
for (const [name, block] of [['clair', lightBlock], ['sombre', darkBlock]]) {
  const v = palette(name === 'clair' ? lightBlock : block);
  const p = name === 'clair' ? v : { ...palette(lightBlock), ...v };
  for (const [fg, bg, label] of pairs) {
    const r = ratio(p[fg], p[bg]);
    check(r >= 4.5, `contraste insuffisant (${name}) : ${label} ${r.toFixed(2)} (minimum 4,5)`);
  }
  const white = ratio('#ffffff', p.primary);
  check(white >= 4.5, `contraste insuffisant (${name}) : texte blanc sur bouton principal ${white.toFixed(2)}`);
  check(ratio(p.focus, p.bg) >= 3 && ratio(p.focus, p.card) >= 3, `indicateur de focus (${name}) sous 3:1`);
}

// ---- règles CSS
check(/:focus-visible\s*\{[^}]*outline:\s*3px/.test(css), 'indicateur de focus visible absent ou trop fin');
check(/prefers-reduced-motion:\s*reduce/.test(css), 'règle prefers-reduced-motion absente');
check(/\.visually-hidden/.test(css), 'classe .visually-hidden absente');
check(!/outline:\s*(none|0)[^}]*\}/.test(css.replace(/h[12]\[tabindex="-1"\]:focus\s*\{[^}]*\}/, '')), 'un style supprime l\'indicateur de focus');
check(!/user-select:\s*none/.test(css), 'sélection de texte désactivée');

// ---- HTML
check(/<html[^>]*lang="fr"/.test(html), 'attribut lang="fr" absent');
const viewport = (html.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
check(viewport && !/user-scalable\s*=\s*no|maximum-scale/.test(viewport), 'le zoom est bloqué par la balise viewport');
check(/<title>[^<]+<\/title>/.test(html), 'titre de page absent');

// ---- sémantique de l'interface (app.js)
check(/role="radiogroup"/.test(app) && /type="radio"/.test(app), 'les réponses ne sont pas des boutons radio dans un groupe');
check(/id="feedback"[^>]*role="status"/.test(app), 'la correction n\'est pas annoncée (zone role="status")');
check(/role="progressbar"/.test(app), 'barre de progression sans rôle progressbar');
check(/aria-pressed/.test(app), 'boutons à bascule sans aria-pressed');
check(/aria-modal="true"/.test(app) && /\.setAttribute\('inert'/.test(app), 'boîte de dialogue : modale ou fond non inerte');
check(/\.focus\(/.test(app), 'aucune gestion du focus');
check(!/<h3/.test(app), 'niveau de titre h3 utilisé sous un h1 (saut de niveau)');
check(!/<img(?![^>]*\balt=)/.test(app + html), 'image sans attribut alt');
check(!/onclick=|tabindex="[1-9]/.test(app + html), 'gestionnaire en ligne ou tabindex positif');

if (failures.length) {
  console.error(`ACCESSIBILITÉ : ${failures.length} problème(s)\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('ACCESSIBILITÉ OK (contraste des palettes claire et sombre, focus, mouvement réduit, langue, zoom, sémantique)');
