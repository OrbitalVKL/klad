// Démarrage automatique de la version de test (page web) : code 123456, phrase recopiée toute seule, reprise FICTIVE
// importée, complément fictif, puis verrou et déverrouillage (étapes du premier déverrouillage). Ensuite, chaque
// écran de verrou est déverrouillé tout seul. Aucune donnée réelle.
import { reprisePersonnelle, PERSONNEL } from './donnees.mjs';
import { completer } from './completer.mjs';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function attendre(f, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = f(); if (v) return v; } catch (e) { /* pas encore */ } await pause(80); }
  throw new Error('délai dépassé');
}
const visible = el => !!el && el.offsetParent !== null;
const padVisible = () => [...document.querySelectorAll('.pad')].some(visible);
let saisie = false;
async function code() {
  if (saisie) return;
  saisie = true;
  try { for (const k of '123456') { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await pause(70); } }
  finally { saisie = false; }
}

// sélecteur de fichier du navigateur : la reprise fictive est fournie sans fenêtre
let fichier = null;
const clic = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () {
  if (this.type === 'file' && fichier) {
    const dt = new DataTransfer(); dt.items.add(fichier); fichier = null;
    this.files = dt.files;
    setTimeout(() => { if (this.onchange) this.onchange(); else this.dispatchEvent(new Event('change')); }, 0);
    return;
  }
  return clic.call(this);
};

function bandeau(t) {
  let b = document.getElementById('klad-test');
  if (!b) {
    b = document.createElement('div');
    b.id = 'klad-test';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:8px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:9999;font:700 10px/1.6 system-ui,sans-serif;padding:1px 8px;border-radius:999px;background:#9a6212;color:#fff;pointer-events:none;opacity:.85;max-width:70vw';
    document.body.appendChild(b);
  }
  b.textContent = t;
}

(async () => {
  bandeau('Version de test · données fictives · préparation…');
  await attendre(() => document.querySelector('[data-a="new"]') || padVisible() || (document.getElementById('appli') && !document.getElementById('appli').hidden));
  if (document.querySelector('[data-a="new"]')) {
    document.querySelector('[data-a="new"]').click();
    await attendre(padVisible); await code(); await pause(250);
    await attendre(padVisible); await code();
    await attendre(() => document.querySelector('ol.phrase li'));
    const groupes = [...document.querySelectorAll('ol.phrase li')].map(l => l.textContent.trim());
    document.querySelector('[data-a="ok"]').click();
    await attendre(() => document.getElementById('g1'));
    for (const id of ['g1', 'g2']) {
      const lab = document.querySelector('label:has(#' + id + ')').textContent, n = +lab.match(/n° (\d+)/)[1];
      const i = document.getElementById(id); i.value = groupes[n - 1]; i.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('[data-a="v"]').click();
    await attendre(() => { const a = document.getElementById('appli'); return a && !a.hidden; });
    bandeau('Version de test · données fictives · import du jeu…');
    fichier = new File([JSON.stringify(reprisePersonnelle(window.KladModele.jourLocal(Date.now())))], 'reprise.json', { type: 'application/json' });
    window.KladApp.ouvrirVolet('secReprise');
    await pause(300);
    document.getElementById('btnChoisirReprise').click();
    await attendre(() => document.querySelector('#repriseApercu [data-a="importer"]'));
    document.querySelector('#repriseApercu [data-a="importer"]').click();
    await attendre(() => { const S = window.KladApp.etat(); return S && S.budget && S.classement && S.classement.import; });
    await pause(800);
    completer(PERSONNEL);
    await pause(300);
    if (window.KladApp.fermerVolet) window.KladApp.fermerVolet(true);
    // verrou puis déverrouillage : étapes du premier déverrouillage (comme sur le téléphone après l'import)
    let b = document.getElementById('btnLock');
    if (!b) { b = document.createElement('button'); b.id = 'btnLock'; b.hidden = true; document.body.appendChild(b); }
    b.click();
    await attendre(padVisible);
    await code();
    await attendre(() => { const a = document.getElementById('appli'); return a && !a.hidden; });
  } else if (padVisible()) await code();
  bandeau('Test · fictif au 28/10 · code 123456');
  // verrou automatique (5 min en arrière-plan) : déverrouillé tout seul au retour
  new MutationObserver(() => { if (padVisible() && !saisie) setTimeout(() => { if (padVisible()) code(); }, 400); }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
})().catch(e => bandeau('Version de test : démarrage impossible (' + (e.message || e) + ')'));
