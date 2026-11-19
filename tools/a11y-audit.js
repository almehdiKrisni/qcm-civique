/* Audit d'accessibilité à lancer dans la console du navigateur sur l'application.
 *   1. Servir le dossier (python -m http.server) et ouvrir l'application.
 *   2. Charger ce fichier : const s = document.createElement('script'); s.src = 'tools/a11y-audit.js'; document.head.append(s);
 *   3. Lancer : await runA11yAudit()  ->  tableau de résultats (aussi retourné en objet).
 * Parcourt les écrans principaux en thème clair et sombre et mesure : contraste (WCAG 1.4.3),
 * noms accessibles, taille des zones de toucher (44 px), structure des titres, repères,
 * sémantique des réponses et des boîtes de dialogue, indicateur de focus. */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const click = async (s) => { const el = $(s); if (el) { el.click(); await sleep(60); } return Boolean(el); };

  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return { r: 255, g: 255, b: 255, a: 0 };
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (top, bottom) => ({ // composition d'une couleur translucide sur un fond opaque
    r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1,
  });

  function backgroundOf(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    if (!layers.length || layers[layers.length - 1].a < 0.99) base = parse(getComputedStyle(document.body).backgroundColor);
    return layers.reverse().reduce((bg, l) => over(l, bg), base.a ? base : { r: 255, g: 255, b: 255, a: 1 });
  }

  function opacityOf(el) {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]');
  };

  const isSrOnly = (el) => { const r = el.getBoundingClientRect(); return r.width <= 1 && r.height <= 1; };

  function contrastFailures() {
    const fails = [];
    let checked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || !visible(el) || isSrOnly(el) || el.closest('[disabled], [inert]') || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
      if (el.closest('button:disabled')) continue;
      const cs = getComputedStyle(el);
      const bg = backgroundOf(el);
      const fg0 = parse(cs.color);
      const fg = over({ ...fg0, a: fg0.a * opacityOf(el) }, bg);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      const r = ratio(fg, bg);
      checked += 1;
      if (r < need) fails.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} « ${n.textContent.trim().slice(0, 28)} » ${r.toFixed(2)} (min ${need})`);
    }
    return { checked, fails };
  }

  function accessibleName(el) {
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) return labelled.split(' ').map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    return (el.getAttribute('aria-label') || '').trim()
      || (el.labels && el.labels.length ? [...el.labels].map((l) => l.textContent).join(' ').trim() : '')
      || (el.getAttribute('title') || '').trim()
      || (el.getAttribute('placeholder') || '').trim()
      || el.textContent.replace(/\s+/g, ' ').trim();
  }

  const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="radio"], [tabindex]:not([tabindex="-1"])';

  function structure() {
    const interactive = [...document.querySelectorAll(INTERACTIVE)].filter((e) => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none');
    const unnamed = interactive.filter((e) => !accessibleName(e));
    // zone de toucher : l'élément ou son libellé (cas des boutons radio / cases à cocher)
    const small = interactive.filter((e) => {
      if (e.disabled || !visible(e) && !(e.labels && e.labels.length)) return false;
      const t = (e.type === 'radio' || e.type === 'checkbox') && e.closest('label') ? e.closest('label') : e;
      if (!visible(t)) return false;
      const r = t.getBoundingClientRect();
      return Math.min(r.width, r.height) < 44 - 0.5;
    });
    const heads = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible).map((h) => Number(h.tagName[1]));
    let skips = 0;
    heads.forEach((lvl, i) => { if (i && lvl > heads[i - 1] + 1) skips += 1; });
    return {
      unnamed: unnamed.map((e) => `${e.tagName.toLowerCase()}[${(e.textContent || '').trim().slice(0, 15)}]`),
      small: small.map((e) => `${e.tagName.toLowerCase()}[${(e.textContent || e.className || '').toString().trim().slice(0, 18)}] ${Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))}px`),
      h1: heads.filter((l) => l === 1).length,
      headingSkips: skips,
      main: Boolean(document.querySelector('main, [role="main"]')),
    };
  }

  function staticChecks() {
    const css = [];
    [...document.styleSheets].forEach((sh) => { try { [...sh.cssRules].forEach((r) => css.push(r.cssText)); } catch (e) { /* feuille externe */ } });
    const all = css.join('\n');
    return {
      lang: document.documentElement.lang || '(absente)',
      zoomAllowed: !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test((document.querySelector('meta[name="viewport"]') || {}).content || ''),
      focusVisibleRule: /:focus-visible/.test(all),
      outlineRemoved: /outline:\s*(none|0)/.test(all),
      reducedMotionRule: /prefers-reduced-motion/.test(all),
      title: document.title,
    };
  }

  async function questionChecks() {
    await click('[data-act="cat"][data-key="histoire"][data-n="10"]');
    const opts = [...document.querySelectorAll('#opts input[type="radio"], #opts [role="radio"], #opts .opt')];
    const radios = document.querySelectorAll('#opts input[type="radio"], #opts [role="radio"]').length;
    const group = Boolean(document.querySelector('#opts[role="radiogroup"], fieldset#opts'));
    const live = Boolean(document.querySelector('#feedback[role="status"], #feedback[aria-live]'));
    const progress = Boolean(document.querySelector('[role="progressbar"]'));
    const flag = document.querySelector('[data-act="flag"]');
    const flagPressed = Boolean(flag && flag.hasAttribute('aria-pressed'));
    const heading = Boolean(document.activeElement && /^H[12]$/.test(document.activeElement.tagName));
    return { options: opts.length, nativeOrAriaRadios: radios, radiogroup: group, feedbackAnnounced: live, progressbarRole: progress, flagToggleState: flagPressed, focusMovedToHeading: heading };
  }

  async function dialogChecks() {
    await click('[data-act="abandon"]');
    const d = $('#dialog');
    const box = d && d.querySelector('[role="dialog"], [role="alertdialog"]');
    const res = {
      open: Boolean(d),
      role: Boolean(box),
      modal: Boolean(box && box.getAttribute('aria-modal') === 'true'),
      labelled: Boolean(box && (box.getAttribute('aria-labelledby') || box.getAttribute('aria-label') || box.getAttribute('aria-describedby'))),
      focusInside: Boolean(d && d.contains(document.activeElement)),
      backgroundInert: Boolean($('#app') && ($('#app').hasAttribute('inert') || $('#app').getAttribute('aria-hidden') === 'true')),
    };
    if (d) d.querySelector('[data-dlg="0"]').click();
    await sleep(40);
    return res;
  }

  async function setTheme(value) {
    await click('[data-act="home"]'); await click('[data-act="settings"]');
    await click(`[data-act="set-theme"][data-value="${value}"]`);
    await click('[data-act="home"]');
  }

  async function screens() {
    const out = [];
    const visit = async (name, steps) => { for (const s of steps) await click(s); out.push({ name, ...structure(), contrast: contrastFailures() }); await click('[data-act="home"]'); };
    out.push({ name: 'accueil', ...structure(), contrast: contrastFailures() });
    await visit('réglages', ['[data-act="settings"]']);
    await visit('à propos', ['[data-act="about"]']);
    await visit('fiches', ['[data-act="sheets"]']);
    await visit('historique', ['[data-act="history"]']);
    await visit('questions à revoir', ['[data-act="flags"]']);
    // une question avec correction (réponse fausse puis bonne) et le résultat
    await click('[data-act="cat"][data-key="culture"][data-n="10"]');
    const first = document.querySelector('#opts input, #opts .opt');
    if (first) { first.click(); await sleep(30); }
    await click('#next');
    out.push({ name: 'question corrigée', ...structure(), contrast: contrastFailures() });
    await click('[data-act="abandon"]'); const q = $('#dialog [data-dlg="1"]'); if (q) { q.click(); await sleep(40); }
    return out;
  }

  window.runA11yAudit = async function runA11yAudit() {
    const report = { static: staticChecks(), themes: {} };
    for (const theme of ['light', 'dark']) {
      await setTheme(theme);
      const t = { screens: await screens() };
      t.question = await questionChecks();
      t.dialog = await dialogChecks();
      await click('[data-act="abandon"]'); const q = $('#dialog [data-dlg="1"]'); if (q) { q.click(); await sleep(40); }
      report.themes[theme] = t;
    }
    await setTheme('auto');
    const sum = { contrastChecked: 0, contrastFails: [], unnamed: 0, small: new Set(), headingSkips: 0 };
    Object.entries(report.themes).forEach(([theme, t]) => t.screens.forEach((s) => {
      sum.contrastChecked += s.contrast.checked;
      s.contrast.fails.forEach((f) => sum.contrastFails.push(`[${theme} · ${s.name}] ${f}`));
      sum.unnamed += s.unnamed.length;
      s.small.forEach((x) => sum.small.add(x));
      sum.headingSkips += s.headingSkips;
    }));
    sum.small = [...sum.small];
    report.summary = sum;
    window.__a11yReport = report;
    return report;
  };
})();
