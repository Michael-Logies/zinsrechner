// Goldmaster-Gegenprobe: Rechenkern gegen den Original-Konto.txt-Export (ZZR, 2007)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ZZR = require('../core/zzr-core.js');

const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'goldmaster-konto.json'), 'utf8'));

// 1) Datumscodierung
assert.strictEqual(ZZR.toOrdinal(2000, 1, 1), 730120, 'Ordinal 1.1.2000');
assert.strictEqual(ZZR.deDate(730120), '01.01.2000', 'deDate');
assert.strictEqual(ZZR.toOrdinal(1999, 12, 30), 730118, 'Ordinal 30.12.1999');
assert.strictEqual(ZZR.toOrdinal(2015, 1, 1), 735599, 'Ordinal 1.1.2015');

// 2) .zzr-Datei lesen (die vom Original-Programm akzeptierte Probe)
const probe = ZZR.parseZZR(fs.readFileSync('/home/ml/zinsrechner/probe-methode1.zzr', 'latin1'));
assert.strictEqual(probe.titel, 'Probe Methode1 Goldmaster');
assert.strictEqual(probe.methode, 1);
assert.strictEqual(probe.strome.length, 3);
assert.strictEqual(probe.strome[0].datum, 730118);

// 3) Zahlungsströme expandieren
const flows = ZZR.expandiere(probe);
assert.strictEqual(flows.length, 182, '182 Einzelzahlungen');
assert.strictEqual(flows[0].betrag, -102258.38);
assert.strictEqual(flows[flows.length - 1].datum, 735599);

// 4) Effektivzins (PAngV) lösen — Goldmaster druckt -8,8145 %
const eff = ZZR.effPAngV(flows);
console.log('EFF (berechnet):', (eff * 100).toFixed(6), '%  | Goldmaster:', gold.effektivzins_prozent, '%');
assert.ok(Math.abs(eff * 100 - gold.effektivzins_prozent) < 0.002,
  'EFF weicht ab: ' + (eff * 100).toFixed(6) + ' vs ' + gold.effektivzins_prozent);

// 5) Vergleichskonto Zeile für Zeile gegen den Original-Export
const konto = ZZR.kontoSimulation(flows, eff);
assert.strictEqual(konto.zeilen.length, gold.zeilen.length,
  'Zeilenzahl ' + konto.zeilen.length + ' vs ' + gold.zeilen.length);

let maxAbweichung = 0;
let fehlerZeilen = 0;
for (let i = 0; i < gold.zeilen.length; i++) {
  const g = gold.zeilen[i], m = konto.zeilen[i];
  assert.strictEqual(ZZR.deDate(m.valuta), g.valuta, 'Zeile ' + i + ' Datum');
  for (const feld of ['betrag', 'saldo', 'zins', 'tilgung', 'kumuliert', 'abschluss']) {
    const d = Math.abs(m[feld] - g[feld]);
    if (d > maxAbweichung) maxAbweichung = d;
    if (d > 0.06) {
      fehlerZeilen++;
      if (fehlerZeilen <= 5) console.log('Abweichung Zeile', i, g.valuta, g.beschreibung, feld,
        'gold:', g[feld], 'meins:', m[feld].toFixed(2));
    }
  }
}
console.log('Maximale Abweichung über alle Felder/Zeilen:', maxAbweichung.toFixed(4), 'EUR');
console.log('Zeilen jenseits Toleranz 0,06:', fehlerZeilen);
assert.ok(maxAbweichung <= 0.06, 'Maximale Abweichung zu groß: ' + maxAbweichung);

// 6) Restsaldo schließt auf null
assert.ok(Math.abs(konto.restsald) < 0.01, 'Restsaldo ' + konto.restsald);

// 7) Ratenhöhe-Löser: Zielzins vorgeben, Ratenhöhe zurückrechnen
const ziel = eff;
const hoehe = ZZR.loeseRatenhoehe(probe, 2, ziel, 1);
assert.ok(hoehe !== null && Math.abs(hoehe - 0.51) < 0.005, 'Ratenhöhe ' + hoehe);

console.log('Ratenhöhe zurückgerechnet:', hoehe.toFixed(4));

// 8) Stufen-Semantik (live unter Wine vermessen, 23.11.2026)
const dynFlows = ZZR.expandiere(ZZR.parseZZR(fs.readFileSync('/home/ml/zinsrechner/probe-dynamik.zzr', 'latin1')));
assert.strictEqual(dynFlows.length, 24, '2 Stufen x 12 Raten');
assert.ok(Math.abs(dynFlows[0].betrag + 100) < 1e-9 && Math.abs(dynFlows[11].betrag + 100) < 1e-9, 'Stufe 1 = -100');
assert.ok(Math.abs(dynFlows[12].betrag + 100.05) < 1e-9, 'Stufe 2 = -100,05 (Dynamik 0,05 %)');
const zuwFlows = ZZR.expandiere(ZZR.parseZZR(fs.readFileSync('/home/ml/zinsrechner/probe-zuwachs.zzr', 'latin1')));
assert.strictEqual(zuwFlows.length, 24);
assert.ok(Math.abs(zuwFlows[12].betrag + 50) < 1e-9, 'Stufe 2 = -50 (Zuwachs +50 additiv)');

console.log('\nGOLDMASTER GEGENPROBE BESTANDEN — Kern trifft das Original.');
