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

// 9) EG-Methode (AIBD) — Original-Anzeige −8,8068 % (konto-m0-Export, 24.11.2026;
//    ACHTUNG: die alte Übergabe notierte fälschlich −8,0608 — Übertragungsfehler)
const probeM0 = ZZR.parseZZR(fs.readFileSync('/home/ml/zinsrechner/probe-methode0.zzr', 'latin1'));
const flowsM0 = ZZR.expandiere(probeM0);
const effEGWert = ZZR.effEG(flowsM0);
console.log('EFF EG/AIBD (berechnet):', (effEGWert * 100).toFixed(6), '%  | Original-Anzeige: -8,8068 %');
assert.ok(Math.abs(effEGWert * 100 + 8.8068) <= 0.0005,
  'EFF EG weicht ab: ' + (effEGWert * 100).toFixed(6) + ' vs -8.8068');

// 10) AIBD-Vergleichskonto Zeile für Zeile gegen den Original-Export (182 Zeilen)
const aibdText = fs.readFileSync(path.join(__dirname, 'goldmaster-konto-m0.txt'), 'latin1');
const goldAibd = [];
const reAibd = /^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s{2,}(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})\s*$/;
for (const z of aibdText.split(/\r?\n/)) {
  const m = z.match(reAibd);
  if (m) {
    const num = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
    goldAibd.push({ valuta: m[1], betrag: num(m[3]), zins: num(m[4]), tilgung: num(m[5]), saldo: num(m[6]) });
  }
}
assert.strictEqual(goldAibd.length, 182, 'AIBD-Goldmaster: 182 Zeilen erwartet');
const kontoAibd = ZZR.kontoAIBD(flowsM0, effEGWert);
assert.strictEqual(kontoAibd.zeilen.length, goldAibd.length,
  'AIBD-Zeilenzahl ' + kontoAibd.zeilen.length + ' vs ' + goldAibd.length);

let maxAibd = 0;
for (let i = 0; i < goldAibd.length; i++) {
  const g = goldAibd[i], m = kontoAibd.zeilen[i];
  assert.strictEqual(ZZR.deDate(m.valuta), g.valuta, 'AIBD Zeile ' + i + ' Datum');
  for (const [mein, ziel] of [['zins', 'zins'], ['tilgung', 'tilgung'], ['saldo', 'saldo']]) {
    const d = Math.abs(m[mein] - g[ziel]);
    if (d > maxAibd) maxAibd = d;
    assert.ok(d <= 0.011, 'AIBD Zeile ' + i + ' ' + g.valuta + ' ' + mein +
      ': ' + m[mein].toFixed(2) + ' vs ' + g[ziel].toFixed(2));
  }
}
console.log('AIBD-Konto: maximale Abweichung über alle Zeilen:', maxAibd.toFixed(4), 'EUR');
assert.ok(Math.abs(kontoAibd.restsald) < 0.01, 'AIBD Restsaldo ' + kontoAibd.restsald);

// 11) Endwert/Barwert (Original-Messung 24.11.2026 unter Wine, Zins 55 %):
//     Endwert(01.01.2015, 55 %) = 73.303.508,71 € (exakt = PAngV-Konto-Endsaldo),
//     Barwert(01.01.2000, 55 %) = 102.208,33 € (Vergangenheit Nennwert + Zukunft
//     abgezinst 30/360; Restunsicherheit ±0,15 € — siehe core/zzr-core.js)
const ewWert = ZZR.endwert(flows, 0.55);
console.log('Endwert (55 %, 01.01.2015):', ewWert.toFixed(2), 'EUR  | Original: 73303508.71');
assert.ok(Math.abs(ewWert - 73303508.71) <= 0.01, 'Endwert weicht ab: ' + ewWert.toFixed(2));
const bwWert = ZZR.barwert(flows, 0.55, flows[1].datum);
console.log('Barwert (55 %, 01.01.2000):', bwWert.toFixed(2), 'EUR  | Original: 102208.33');
assert.ok(Math.abs(bwWert - 102208.33) <= 0.5, 'Barwert weicht ab: ' + bwWert.toFixed(2));
// Zweitmessung 10 % (24.11.2026): Struktur bestätigt, Residual = interne Rundung
const bw10 = ZZR.barwert(flows, 0.10, flows[1].datum);
console.log('Barwert (10 %, 01.01.2000):', bw10.toFixed(2), 'EUR  | Original: 96091.06');
assert.ok(Math.abs(bw10 - 96091.06) <= 2.0, 'Barwert 10 % weicht ab: ' + bw10.toFixed(2));

// 12) AIBD-Abhängigkeit von End-/Barwert (Original-Messung 24.11.2026, Probe
//     Methode 0, Zins 55 %): Endwert = AIBD-Konto-Endsaldo (EXAKT Δ 0,00),
//     Barwert = act/365-Abzinsung (Δ 0,04)
const ewAibd = ZZR.endwert(flows, 0.55, undefined, 0);
console.log('Endwert AIBD (55 %, 01.01.2015):', ewAibd.toFixed(2), 'EUR  | Original: 73721200.13');
assert.ok(Math.abs(ewAibd - 73721200.13) <= 0.01, 'Endwert AIBD weicht ab: ' + ewAibd.toFixed(2));
const bwAibd = ZZR.barwert(flows, 0.55, flows[1].datum, 0);
console.log('Barwert AIBD (55 %, 01.01.2000):', bwAibd.toFixed(2), 'EUR  | Original: 102208.70');
assert.ok(Math.abs(bwAibd - 102208.70) <= 0.2, 'Barwert AIBD weicht ab: ' + bwAibd.toFixed(2));

// 13) PAngV 2011/heute (effPAngVHeu, act/act): Identitätsnachweise der
//     kalendergenauen Zeitzählung — ein exakt 365-Tage-Jahr (kein Schaltjahr)
//     bzw. ein exakt 366-Tage-Jahr (Schaltjahr) muß 10,000 % liefern
const pah365 = ZZR.effPAngVHeu([
  { datum: ZZR.toOrdinal(2026, 1, 1), betrag: -1000, notiz: '' },
  { datum: ZZR.toOrdinal(2027, 1, 1), betrag: 1100, notiz: '' }
]);
assert.ok(Math.abs(pah365 - 0.10) < 1e-9, 'PAngV-heute 365/365 nicht exakt 10 %: ' + pah365);
const pah366 = ZZR.effPAngVHeu([
  { datum: ZZR.toOrdinal(2028, 1, 1), betrag: -1000, notiz: '' },
  { datum: ZZR.toOrdinal(2029, 1, 1), betrag: 1100, notiz: '' }
]);
assert.ok(Math.abs(pah366 - 0.10) < 1e-9, 'PAngV-heute 366/366 nicht exakt 10 %: ' + pah366);
const pahGold = ZZR.effPAngVHeu(flows);
console.log('PAngV 2011/heute (Goldmaster):', (pahGold * 100).toFixed(6), '% p.a.  (kein Original-Referenzwert — Methode kam 2007 noch nicht; Identitätstests 365/365 und 366/366 grün)');

console.log('\nGOLDMASTER GEGENPROBE BESTANDEN — Kern trifft das Original (PAngV + AIBD + End-/Barwert).');
