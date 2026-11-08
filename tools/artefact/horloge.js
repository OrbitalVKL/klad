// Version de test : horloge de la page fixée au 28/10/2026 10:00 (puis le temps avance normalement), comme le banc de
// mesure ; le jeu fictif est construit pour cette date (cycle de salaire, virements, échéances).
(function () {
  'use strict';
  var REF = new Date(2026, 9, 28, 10, 0, 0).getTime(), D = Date, debut = D.now();
  function maintenant() { return REF + (D.now() - debut); }
  function FD(a, b, c, d, e, f, g) {
    if (!(this instanceof FD)) return new D(maintenant()).toString();
    var n = arguments.length;
    return n === 0 ? new D(maintenant()) : n === 1 ? new D(a) : new D(a, b, n > 2 ? c : 1, n > 3 ? d : 0, n > 4 ? e : 0, n > 5 ? f : 0, n > 6 ? g : 0);
  }
  FD.prototype = D.prototype;
  FD.now = maintenant; FD.parse = D.parse; FD.UTC = D.UTC;
  window.Date = FD;
})();
