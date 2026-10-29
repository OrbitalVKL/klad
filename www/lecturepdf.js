// Klad — texte d'un PDF (pièces jointes des appels de fonds), avec pdf.js embarqué (www/pdfjs, licence Apache-2.0).
// Aucun réseau : la bibliothèque et ses tables de caractères sont dans l'appli ; chargée à la première lecture seulement.
(function (g) {
  'use strict';

  let lib = null;
  async function charger() {
    if (lib) return lib;
    lib = await import('./pdfjs/pdf.min.js');
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.js', g.location.href).href;
    return lib;
  }
  // octets : Uint8Array → texte des premières pages (lignes séparées par des retours).
  async function texte(octets, maxPages) {
    const P = await charger();
    const tache = P.getDocument({ data: octets, cMapUrl: new URL('pdfjs/cmaps/', g.location.href).href, cMapPacked: true,
      isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
    const doc = await tache.promise;
    try {
      const n = Math.min(doc.numPages, maxPages || 6), lignes = [];
      for (let i = 1; i <= n; i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        let l = '';
        for (const it of c.items) { l += it.str; if (it.hasEOL) { lignes.push(l); l = ''; } else l += ' '; }
        if (l.trim()) lignes.push(l);
      }
      return lignes.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    } finally { await tache.destroy(); }
  }

  g.KladPdf = { texte };
})(typeof window !== 'undefined' ? window : globalThis);
