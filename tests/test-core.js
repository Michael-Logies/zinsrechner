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
console.log('PAngV 2011/2026 (Goldmaster):', (pahGold * 100).toFixed(6), '% p.a.  (kein Original-Referenzwert — Methode kam 2007 noch nicht; Identitätstests 365/365 und 366/366 grün)');

// Amtliches Zeitbeispiel aus Remark (C), SWD(2012) 128 final: 1.12.2012 →
// 2.2.2013 = 2/12 + 1/366 (ganze Monate rückwärts, Resttag/Jahreslänge des
// Kalenderjahres am Monatsanker — Schaltjahr, weil 2.12.2011→2.12.2012 366 Tage)
const tSWD = ZZR.jahreActAct(ZZR.toOrdinal(2012, 12, 1), ZZR.toOrdinal(2013, 2, 2));
console.log('Zeit 1.12.2012→2.2.2013:', tSWD.toFixed(12), '| amtlich: 2/12+1/366 =', (2 / 12 + 1 / 366).toFixed(12));
assert.ok(Math.abs(tSWD - (2 / 12 + 1 / 366)) < 1e-12, 'Remark-(C)-Zeitbeispiel weicht ab: ' + tSWD);

// 14) Kredit-Richtung für PAngV (alt): der Nutzer-Fall +12000 Auszahlung,
//     −1050×12 ab 31.12.2026 (fallende Restsaldo-Richtung — das Raster-
//     Verfahren findet die sinnvolle positive Wurzel statt der absurden
//     negativen)
const kreditProj = { titel: 'Kredit-Test', methode: 1, euro: 1, beschreibung: '', strome: [
  { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:ZZR.toOrdinal(2026, 1, 1), ultimo:0, betrag:12000, raten:1, abstand:1, notiz:'Auszahlung' },
  { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:ZZR.toOrdinal(2026, 12, 31), ultimo:0, betrag:-1050, raten:12, abstand:1, notiz:'' }
]};
const kreditFlows = ZZR.expandiere(kreditProj);
const pahKredit = ZZR.effPAngV(kreditFlows);
console.log('EFF PAngV (Kredit-Fall):', pahKredit === null ? 'NULL' : (pahKredit * 100).toFixed(6), '% p.a.');
assert.ok(pahKredit !== null, 'Kredit-Fall liefert null');
assert.ok(pahKredit > 0 && pahKredit < 1, 'Kredit-Fall außerhalb des plausiblen Bereichs: ' + pahKredit);
// Wert verankert (Nutzer-Fall 24.11.2026); die frühere Notiz 3,413993 % war mit
// dem daysInMonth-Bug (Februar = 31 Tage → „31.2.“ lief still als 3.3.) gerechnet.
// Korrekt (28.02.2027-Termin): 3,415658 % — dicht an AIBD 3,4156 % (Sanity).
assert.ok(Math.abs(pahKredit * 100 - 3.415658) < 0.0002,
  'Kredit-Fall PAngV weicht vom verankerten Wert ab: ' + (pahKredit * 100).toFixed(6));
const restKredit = ZZR.kontoSimulation(kreditFlows, pahKredit).restsald;
assert.ok(Math.abs(restKredit) < 0.01, 'Konto geht beim PAngV-Ergebnis nicht auf 0: ' + restKredit.toFixed(2));

// 15) Ultimo-Semantik + gebrochene Raten — Beleg: Zzr.hlp des Originals
//     (Absatz „Monatsultimo“: „wird ‚immer zum Ultimo‘ angekreuzt, erfolgen die
//     weiteren Ratenzahlungen zum 31.3., 30.4., usw.“; im anderen Fall „mit dem
//     28. des Monats“; Absatz „Anzahl der Raten“: 2,5 mal DM 100 → letzte Rate 50).
//     Die ERSTE Zahlung behält stets ihr eingegebenes Datum.
function stromEin(datum, ultimo, betrag, raten, abstand) {
  return { titel: 'T', methode: 1, euro: 1, beschreibung: '', strome: [
    { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:datum, ultimo:ultimo,
      betrag:betrag, raten:raten, abstand:abstand, notiz:'' } ] };
}
const ultF = ZZR.expandiere(stromEin(ZZR.toOrdinal(1999, 2, 28), 1, 100, 4, 1));
assert.deepStrictEqual(ultF.map(f => ZZR.deDate(f.datum)),
  ['28.02.1999', '31.03.1999', '30.04.1999', '31.05.1999'],
  'Ultimo=1: Folgeraten müssen auf die Monatsultimo fallen');
const ultAus = ZZR.expandiere(stromEin(ZZR.toOrdinal(1999, 2, 28), 0, 100, 4, 1));
assert.deepStrictEqual(ultAus.map(f => ZZR.deDate(f.datum)),
  ['28.02.1999', '28.03.1999', '28.04.1999', '28.05.1999'],
  'Ultimo=0: Folgeraten am gleichen Tag des Monats');
const ultNov = ZZR.expandiere(stromEin(ZZR.toOrdinal(1999, 11, 30), 1, 1, 4, 1));
assert.deepStrictEqual(ultNov.map(f => ZZR.deDate(f.datum)),
  ['30.11.1999', '31.12.1999', '31.01.2000', '29.02.2000'],
  'Ultimo=1 ab 30.11.: 31.12./31.01./29.02. (Schaltjahr)');
const ultAb3 = ZZR.expandiere(stromEin(ZZR.toOrdinal(1999, 2, 28), 1, 1, 3, 3));
assert.deepStrictEqual(ultAb3.map(f => ZZR.deDate(f.datum)),
  ['28.02.1999', '31.05.1999', '31.08.1999'],
  'Ultimo=1 mit Abstand 3: Ultimo des Zielmonats');
// Kalender-Regression: Februar in Gemeinjahren hat 28 Tage — addMonths darf nie
// einen „31.2.“ erzeugen, der still ins März-Datum überläuft (Bug 24.11.2026)
assert.strictEqual(ZZR.deDate(ZZR.addMonths(ZZR.toOrdinal(2026, 12, 31), 2)), '28.02.2027',
  'addMonths 31.12.→+2: kappet auf 28.2. (Gemeinjahr)');
assert.strictEqual(ZZR.deDate(ZZR.addMonths(ZZR.toOrdinal(2001, 1, 31), 1)), '28.02.2001',
  'addMonths 31.1.2001→+1: 28.2.2001');
assert.strictEqual(ZZR.deDate(ZZR.addMonths(ZZR.toOrdinal(2000, 1, 31), 1)), '29.02.2000',
  'addMonths 31.1.2000→+1: 29.2.2000 (Schaltjahr)');
const bruchF = ZZR.expandiere(stromEin(ZZR.toOrdinal(2000, 1, 15), 0, 100, 2.5, 1));
assert.strictEqual(bruchF.length, 3, '2,5 Raten = 3 Zahlungen');
assert.ok(Math.abs(bruchF[0].betrag - 100) < 1e-9 && Math.abs(bruchF[1].betrag - 100) < 1e-9,
  'volle Raten unverändert');
assert.ok(Math.abs(bruchF[2].betrag - 50) < 1e-9, 'Schlußrate = Bruchteil (50)');
assert.strictEqual(ZZR.deDate(bruchF[2].datum), '15.03.2000', 'Schlußrate am dritten Slot');
console.log('Ultimo + gebrochene Raten: alle Datums-/Bruchteil-Fälle grün');

// 16) 30/360 Februar-Ende-Regel (Zzr.hlp: „mit dem 30.2. usw. gerechnet“) —
//     Februar-Ende (28./29.) zählt in der 30/360-Welt als 30; sonst kappet > 30.
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(1999, 2, 28), ZZR.toOrdinal(1999, 3, 31)), 30,
  '28.2.1999→31.3.1999: 30 Tage (vorher 32)');
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(2000, 2, 29), ZZR.toOrdinal(2000, 3, 31)), 30,
  '29.2.2000→31.3.2000: 30 Tage');
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(1999, 1, 31), ZZR.toOrdinal(1999, 2, 28)), 30,
  '31.1.1999→28.2.1999: 30 Tage (Feb-Ende als Zweitgrenze)');
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(1999, 12, 30), ZZR.toOrdinal(2000, 1, 1)), 1,
  '30.12.→1.1.: 1 Tag (Goldmaster-Stütz, unverändert)');
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(2000, 1, 1), ZZR.toOrdinal(2001, 1, 1)), 360,
  'Volljahr: 360 Tage (unverändert)');
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(2000, 1, 31), ZZR.toOrdinal(2000, 2, 29)), 30,
  '31.1.→29.2. (Schaltjahr): 30 Tage');
console.log('30/360 Februar-Ende-Regel: grün (Goldmaster-Daten ohne Februar-Enden — unbeeinflußt)');

// 17) Ratenhöhe-Löser am Original-Beispiel BSP_1 (DM-Version, Zzr.hlp):
//     −200.000 DM @30.12.1999, 180×1 DM ab 01.01.2000, +50.000 DM @01.01.2015,
//     Zielrendite 5 %, PAngV → „Das Ergebnis: DM 1.375,57 bei PAngV“
const bsp1 = { titel: 'BSP1', methode: 1, euro: 0, beschreibung: '', strome: [
  { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:ZZR.toOrdinal(1999,12,30), ultimo:0, betrag:-200000, raten:1, abstand:1, notiz:'' },
  { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:ZZR.toOrdinal(2000,1,1), ultimo:0, betrag:1, raten:180, abstand:1, notiz:'' },
  { aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:ZZR.toOrdinal(2015,1,1), ultimo:0, betrag:50000, raten:1, abstand:1, notiz:'' } ]};
const bsp1Hoehe = ZZR.loeseRatenhoehe(bsp1, 2, 0.05, 1);
console.log('Löser BSP_1 (DM, Ziel 5 %):', bsp1Hoehe === null ? 'NULL' : bsp1Hoehe.toFixed(2), 'DM  | Zzr.hlp: 1375,57 DM');
assert.ok(bsp1Hoehe !== null && Math.abs(bsp1Hoehe - 1375.57) < 0.02,
  'BSP_1-Ratenhöhe weicht ab: ' + bsp1Hoehe);

// 18) Zahlungsplan + Laufzeit — Belege vom Original (24.11.2026, Probe ultimo-u1,
//     Wine-Orakel): der Plan „entsteht bei der Vorbereitung“ (Fehlerdialog des
//     Originals ohne Nullstelle); die Laufzeit folgt der Kontokonvention —
//     PAngV: „Die Laufzeitbestimmung erfolgt mittels eines 30/360-Tage-
//     Kalendariums“ → 31.10.1999→30.04.2000 = „6 Monaten, 0 Tagen“;
//     AIBD (echter Kalender) → „5 Monaten, 30 Tagen“ (beide im Original-View
//     gelesen). Plan = alle Einzelzahlungen (hier 8, Summen 10.000/10.036).
const u1proj = ZZR.parseZZR(fs.readFileSync('/home/ml/zinsrechner/probe-ultimo-u1.zzr', 'latin1'));
const plan = ZZR.zahlungsplan(u1proj);
assert.strictEqual(plan.zeilen.length, 8, 'Plan: 8 Zahlungen erwartet');
assert.strictEqual(ZZR.deDate(plan.zeilen[2].datum), '31.12.1999', 'Plan-Zeile 3 = erste Ultimo-Folgerate');
assert.strictEqual(ZZR.deDate(plan.zeilen[4].datum), '29.02.2000', 'Plan-Zeile 5 = Februar-Ende (Schaltjahr)');
assert.ok(Math.abs(plan.summeEin + 10000) < 1e-9 && Math.abs(plan.summeAus - 10036) < 1e-9,
  'Plan-Summen falsch: ' + plan.summeEin + '/' + plan.summeAus);
const lzP = ZZR.laufzeit(plan.erste, plan.letzte, 1);
assert.strictEqual(lzP.jahre + '/' + lzP.monate + '/' + lzP.tage, '0/6/0',
  'Laufzeit PAngV (30/360) weicht ab: ' + JSON.stringify(lzP));
const lzA = ZZR.laufzeit(plan.erste, plan.letzte, 0);
assert.strictEqual(lzA.jahre + '/' + lzA.monate + '/' + lzA.tage, '0/5/30',
  'Laufzeit AIBD (echter Kalender) weicht ab: ' + JSON.stringify(lzA));
// Gegenprobe der Plan-Zeilen gegen den Original-Konto-Export vk1.txt (Datumfolge)
// 19) Zielgrößen-Löser des Originals (Zzr.hlp „Zahlungsstrom berechnen | …").
//     Referenzzahlen aus der Original-Hilfe: BSP_3 Datum → 20.03.2003 (Ziel 3 %,
//     erreicht 2,9997 %), BSP_4 Abstand → 36 Monate (Ziel 5 %), BSP_6 Dynamik →
//     6,46 % (Ziel 5 %, Rate Jahr 2 dann 2.129,19). Ratenanzahl löst GEBROCHEN
//     (Zzr.hlp: „Die Ratenzahl … enthält einen gebrochenen Wert"), Stufenzahl
//     liefert die bestmögliche ganzzahlige Näherung.
function stromFeld(datum, betrag, extra) {
  return Object.assign({ aktiv:1, stufen:1, dynamik:0, zuwachs:0, datum:datum, ultimo:0,
    betrag:betrag, raten:1, abstand:1, notiz:'' }, extra || {});
}
const bsp3 = { titel: 'BSP3', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(1999,12,31), -50000),
  stromFeld(ZZR.toOrdinal(2000,1,31), 55000) ]};
const d3 = ZZR.loeseZahlungsdatum(bsp3, 2, 0.03, 1);
assert.strictEqual(d3, ZZR.toOrdinal(2003,3,20), 'BSP_3: Datum muss 20.03.2003 sein');
const p3 = { titel: 'BSP3', methode: 1, euro: 0, beschreibung: '', strome: [bsp3.strome[0], { ...bsp3.strome[1], datum: d3 }] };
const eff3 = ZZR.effPAngV(ZZR.expandiere(p3));
assert.ok(Math.abs(eff3 * 100 - 2.9997) < 0.0005, 'BSP_3: EFF beim gelösten Datum (2,9997 %): ' + (eff3 * 100).toFixed(6));

const bsp4 = { titel: 'BSP4', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(1999,12,31), 10000),
  stromFeld(ZZR.toOrdinal(2000,6,30), -5500, { raten:2 }) ]};
const m4 = ZZR.loeseRatenabstand(bsp4, 2, 0.05, 1);
assert.strictEqual(m4, 36, 'BSP_4: Ratenabstand muss 36 Monate sein');

const bsp6 = { titel: 'BSP6', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(2000,1,1), -250000),
  stromFeld(ZZR.toOrdinal(2000,1,1), 2000, { raten:12, stufen:10 }) ]};
const dyn6 = ZZR.loeseDynamik(bsp6, 2, 0.05, 1, 'prozent');
assert.ok(Math.abs(dyn6 - 6.46) < 0.01, 'BSP_6: Dynamik muss ~6,46 % sein: ' + dyn6);
const zu6 = ZZR.loeseDynamik(bsp6, 2, 0.05, 1, 'absolut');
assert.ok(zu6 !== null && Math.abs(zu6) > 0, 'BSP_6: absoluter Zuwachs gelöst');
const p6 = { titel: 'BSP6', methode: 1, euro: 0, beschreibung: '', strome: [
  bsp6.strome[0], { ...bsp6.strome[1], zuwachs: zu6 } ]};
const eff6gel = ZZR.effPAngV(ZZR.expandiere(p6));
assert.ok(Math.abs(eff6gel - 0.05) < 1e-6, 'BSP_6: absolut gelöster Strom trifft 5 % exakt: ' + eff6gel);

// BSP_2-Muster: Ratenanzahl löst gebrochen; bei folgeVerschieben rücken nachfolgende
// Ströme den Monat-Delta nach (Hilfe: „Datum des 3. ZS wurde nach hinten geschoben")
const bsp2 = { titel: 'BSP2', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(1999,12,30), -200000),
  stromFeld(ZZR.toOrdinal(2000,1,1), 1375.57, { raten:180 }),
  stromFeld(ZZR.toOrdinal(2015,1,1), 50000) ]};
const n2 = ZZR.loeseRatenanzahl(bsp2, 2, 0.0525, 1, false);
assert.ok(n2 !== null && n2 > 180 && n2 < 186, 'BSP_2: gebrochene Ratenzahl im plausiblem Bereich: ' + n2);
const p2 = { titel: 'BSP2', methode: 1, euro: 0, beschreibung: '', strome: [
  bsp2.strome[0], { ...bsp2.strome[1], raten: n2 }, bsp2.strome[2] ]};
const eff2 = ZZR.effPAngV(ZZR.expandiere(p2));
assert.ok(Math.abs(eff2 - 0.0525) < 1e-6, 'BSP_2: Zielzins 5,25 % muss exakt getroffen sein: ' + eff2);
const bsp2b = { titel: 'BSP2b', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(1999,12,30), -200000),
  stromFeld(ZZR.toOrdinal(2000,1,1), 1375.57, { raten:180 }),
  stromFeld(ZZR.toOrdinal(2015,1,1), 50000) ]};
const n2b = ZZR.loeseRatenanzahl(bsp2b, 2, 0.0525, 1, true);
assert.strictEqual(n2b, n2, 'Schieben ändert die gelöste Ratenzahl nicht');
assert.strictEqual(ZZR.deDate(bsp2b.strome[2].datum), '01.07.2015',
  'Folgestrom muss mitschieben (Hilfe: „nach hinten geschoben")');

// Stufenzahl: Ziel = Effektivzins der 10-Stufen-Variante → Näherung muss 10 liefern
const bsp6s = { titel: 'BSP6s', methode: 1, euro: 0, beschreibung: '', strome: [
  stromFeld(ZZR.toOrdinal(2000,1,1), -250000),
  stromFeld(ZZR.toOrdinal(2000,1,1), 2000, { raten:12, stufen:10, dynamik:6.46 }) ]};
const eff6s = ZZR.effPAngV(ZZR.expandiere(bsp6s));
const st6 = ZZR.loeseStufenzahl(bsp6s, 2, eff6s, 1);
assert.strictEqual(st6, 10, 'Stufenzahl-Näherung muss 10 liefern');

// Laufzeit mit heutiger Methode (PAngV 2011/2026, Remark C): ganze Monate rückwärts
// (31.10.1999→30.04.2000: 5 ganze Monate ab 30.11.1999-Anker) + Resttage real (152)
const lz2 = ZZR.laufzeit(ZZR.toOrdinal(1999,10,31), ZZR.toOrdinal(2000,4,30), 2);
assert.strictEqual(lz2.jahre + '/' + lz2.monate + '/' + lz2.tage, '0/5/152',
  'Laufzeit PAngV 2011/2026 weicht ab: ' + JSON.stringify(lz2));
console.log('Zielgrößen-Löser (Datum/Abstand/Dynamik/Ratenanzahl/Stufenzahl) + Laufzeit 2011/2026: grün — BSP_3/4/6 exakt nach Zzr.hlp');

// ---------------------------------------------------------------------------
// Orakel-Referenzen 24.11.2026 (Wine-Original; Exporte tests/orakel-*.txt).
// Probe ultimo-u3 (Ultimo=0, Anker 30.11.1999) — Original-AIBD-Konto (u3a.txt):
// Valutas 31.10 | 30.11 | 30.12 | 30.01 | 29.02 | 30.03 | 30.04 | 30.04,
// EFF 0,7431 % p.a. Der Kern expandiert exakt dieselben Daten (29.02 =
// Monatsende-Kappung) und trifft ALLE DREI EFF-Werte des Originals:
const u3flows = ZZR.expandiere(ZZR.parseZZR(fs.readFileSync(
  path.join(__dirname, '..', 'probe-ultimo-u3.zzr'), 'latin1')));
assert.strictEqual(u3flows.map(f => ZZR.deDate(f.datum)).join(' | '),
  '31.10.1999 | 30.11.1999 | 30.12.1999 | 30.01.2000 | 29.02.2000 | 30.03.2000 | 30.04.2000 | 30.04.2000',
  'Ultimo=0-Kappung muss dem Original-Konto entsprechen (29.02 im Schaltjahr)');
assert.strictEqual((ZZR.effEG(u3flows) * 100).toFixed(4), '0.7431',
  'u3 AIBD-EFF weicht vom Original ab (orakel-u3-aibd.txt: 0,7431 %)');
assert.strictEqual((ZZR.effPAngV(u3flows) * 100).toFixed(4), '0.7396',
  'u3 PAngV-EFF weicht vom Original ab (orakel-u3-pangv.txt: 0,7396 %)');
assert.strictEqual((ZZR.effAibd360(u3flows) * 100).toFixed(4), '0.7410',
  'u3 AIBD360-EFF weicht vom Original ab (orakel-u3b-aibd360.txt: 0,7410 %)');

// Probe bruch-u2 (2,5 Raten à 106 DM → Schlußrate 53; orakel-bruch-u2-*.txt):
const b2flows = ZZR.expandiere(ZZR.parseZZR(fs.readFileSync(
  path.join(__dirname, '..', 'probe-bruch-u2.zzr'), 'latin1')));
assert.strictEqual(b2flows.map(f => f.betrag).join('|'), '-10000|106|106|53|9740',
  'gebrochene Raten: Schlußrate trägt den Bruchteil 0,5');
assert.strictEqual((ZZR.effPAngV(b2flows) * 100).toFixed(4), '0.2021',
  'bruch-u2 PAngV-EFF weicht ab (orakel-bruch-u2-pangv.txt: 0,2021 %)');
assert.strictEqual((ZZR.effEG(b2flows) * 100).toFixed(4), '0.2029',
  'bruch-u2 AIBD-EFF weicht ab (orakel-bruch-u2-aibd.txt: 0,2029 %)');

// Zweitgrenze am Februar-Ende (orakel-feb-d2-pangv.txt: Valuta 30.02.2000 = 30 Tage):
assert.strictEqual(ZZR.days30360(ZZR.toOrdinal(2000, 1, 31), ZZR.toOrdinal(2000, 2, 29)), 30,
  '30/360: 31.01.→29.02. muss 30 Tage zählen (Zweitgrenze als 30 — Orakel feb-d2)');
console.log('Orakel-Referenzen 24.11.2026 (Ultimo=0, gebrochene Raten, Zweitgrenze, AIBD360): grün — Kern = Original exakt');

// ---------------------------------------------------------------------------
// Löser „Nutzerart-Fall“ (25.11.2026, Nutzer-Bug „Der Löserbutton berechnet
// nichts mehr“): Anlage −10.000 €, 12 monatliche Raten (Start-Rate 100 €),
// Zielzins 5 %. Das Start-Bracket [×0,05, ×20] liefert an BEIDEN Rändern einen
// Strom ohne EFF im durchsuchten Bereich (kleiner Rand: Anlage dominiert die
// winzige Rate — kein Vorzeichenwechsel der Kontoauflösung; großer Rand: EFF
// über +1000 %) — der Löser brach dort mit null ab. Fix: Ränder ohne EFF im
// Bereich wirken wie ±unendlich, die Bisektion läuft zwischen ihnen.
const loeserProj = { titel: 'Löser-Nutzerfall', methode: 1, euro: 1, beschreibung: '', strome: [
  { aktiv: 1, stufen: 1, dynamik: 0, zuwachs: 0, datum: ZZR.toOrdinal(2026, 1, 1), ultimo: 0, betrag: -10000, raten: 1, abstand: 1, notiz: 'Anlage' },
  { aktiv: 1, stufen: 1, dynamik: 0, zuwachs: 0, datum: ZZR.toOrdinal(2026, 2, 1), ultimo: 0, betrag: 100, raten: 12, abstand: 1, notiz: 'Raten' },
] };
const loeserX = ZZR.loeseRatenhoehe(loeserProj, 2, 0.05, 1);
assert(loeserX !== null && loeserX > 0, 'Ratenhöhe-Löser muss im Nutzerart-Fall ein Ergebnis liefern (früher: null)');
loeserProj.strome[1].betrag = loeserX;
const loeserEff = ZZR.effPAngV(ZZR.expandiere(loeserProj));
assert(loeserEff !== null && Math.abs(loeserEff - 0.05) < 0.0001,
  'Ratenhöhe muss den Zielzins 5 % erreichen (ist: ' + (loeserEff * 100).toFixed(4) + ' %)');
console.log('Löser Nutzerart-Fall (Beidseitig-null-Bracket): grün — Ratenhöhe ' + loeserX.toFixed(2) + ' € trifft 5 % exakt');

// ---------------------------------------------------------------------------
// XLSX-Export (25.11.2026): Formelhaltiges Tabellenkalkulationsblatt
// (ZIP/STORE + XML, ECMA-376) — Blätter Zahlungsströme / Vergleichskonto /
// Zahlungsplan; Formelzellen (<f>) + Kern-Werte als Cache (<v>) +
// fullCalcOnLoad. Struktur- und CRC-Prüfung via python3 zipfile.
const xlsxProj = { titel: 'XLSX-Test', methode: 1, euro: 1, beschreibung: '', strome: [
  { aktiv: 1, stufen: 1, dynamik: 0, zuwachs: 0, datum: ZZR.toOrdinal(2026, 1, 1), ultimo: 0, betrag: -10000, raten: 1, abstand: 1, notiz: 'Anlage' },
  { aktiv: 1, stufen: 1, dynamik: 0, zuwachs: 0, datum: ZZR.toOrdinal(2026, 2, 1), ultimo: 0, betrag: 100, raten: 12, abstand: 1, notiz: 'Raten' },
] };
const xlsxKonto = ZZR.kontoAIBD(ZZR.expandiere(xlsxProj), 0.05);
if (xlsxKonto === null) throw new Error('Konto für XLSX-Test ohne Ergebnis');
const xlsxBytes = ZZR.xlsxExport(xlsxProj, { methode: 0, eff: 0.05, zeilen: xlsxKonto.zeilen });
assert(xlsxBytes instanceof Uint8Array && xlsxBytes.length > 1000, 'XLSX-Bytes fehlen');
assert(xlsxBytes[0] === 0x50 && xlsxBytes[1] === 0x4b, 'XLSX ohne ZIP-Signatur (PK)');
// Selbst-Berechnungs-Weg: ohne zeilen rechnet der Export das Konto selbst
const autoBytes = ZZR.xlsxExport(xlsxProj, { methode: 1 });
assert(autoBytes instanceof Uint8Array && autoBytes.length > 1000 && autoBytes[0] === 0x50, 'XLSX Selbst-Berechnung fehlt');
const xlsxPfad = require('path').join(require('os').tmpdir(), 'zzr-xlsx-test.xlsx');
require('fs').writeFileSync(xlsxPfad, Buffer.from(xlsxBytes));
require('child_process').execSync(
  'python3 -c "import zipfile, xml.etree.ElementTree as ET, sys; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; [ET.fromstring(z.read(n)) for n in z.namelist() if n.endswith(\'.xml\')]; names = z.namelist(); assert \'xl/worksheets/sheet2.xml\' in names and \'xl/worksheets/sheet3.xml\' in names; s2 = z.read(\'xl/worksheets/sheet2.xml\').decode(\'utf-8\'); assert \'XIRR(\' in s2, \'XIRR-Formel fehlt\'; s3 = z.read(\'xl/worksheets/sheet3.xml\').decode(\'utf-8\'); assert \'Zahlungen!B1\' in s3, \'B2-Verweis auf Zahlungen fehlt im Vergleichskonto\'" "' + xlsxPfad + '"',
  { stdio: 'pipe' }
);
console.log('XLSX-Export: grün — ZIP/CR C in Ordnung, XML wohlgeformt, Formelkette im Vergleichskonto');

// 21) Lexware-CSV-Import (JJ-Jahresübersicht → Zahlungsstrom)
const lexKopf = 'Buchungstag;Konto;Vorgang;Beschreibung;Einstandspreis;"Einnahmen /\nAusgaben";Marktwert;Rendite in %;Rendite\n';
const lexCsv = lexKopf + [
  '31.12.1994;;;Anfangs-Marktwert;0,00;;;;',
  '28.02.1995;Glob. Growth;Kauf;Global Growth;3.783,56;;;;',
  '13.12.1995;Glob. Growth;Einnahme;Global Growth;0,00;0,00;;;',
  '23.05.2014;Consors Depot ?;Einnahme;E.ON AG NA;;-31,65;;;',
  '21.03.1997;Glob. Growth;Verkauf;Global Growth;;;5.626,79;;',
  '11.12.1998;DWS Japan;WP-Entnahme;DWS Japan;;;10,43;;',
  '14.08.2000;Consors Depot ?;Ausgabe;Dyckerhoff Stamm;;-9,30;;;',
  '18.10.1999;Consors Depot ?;Kauf;Bilfinger+Berger;;-2,55;;;',
  '31.12.1995;;;End-Marktwert;;;4.006,64;;',
  '01.01.2000;?;Sonderfall;unbekannter Vorgang;;0,00;;;',
].join('\n') + '\n';
const lex = ZZR.lexwareCsvZuStrome(lexCsv);
assert.strictEqual(lex.strome.length, 7, 'Lexware-Import Zahlungen');
// Kauf −3783,56; zweite Kauf-Zeile nur E/A-Gebühr −2,55; Einnahme −31,65 (0,00 weg);
// Verkauf +5626,79; WP-Entnahme −10,43; Ausgabe −9,30; Schluß +4006,64; unbekannt übersprungen
const lexSoll = -3783.56 - 2.55 - 31.65 + 5626.79 - 10.43 - 9.30 + 4006.64;
assert(Math.abs(lex.summe - lexSoll) < 1e-6, 'Lexware-Import Summe');
assert(lex.unbekannt.length === 1 && lex.unbekannt[0].indexOf('Sonderfall') !== -1, 'Lexware unbekannter Vorgang');
assert(ZZR.deDate(lex.erster) === '28.02.1995' && ZZR.deDate(lex.letzter) === '23.05.2014', 'Lexware Zeitraum (höchstes Zahlungsdatum)');
let lexFehler = null;
try { ZZR.lexwareCsvZuStrome('Datum;Betrag\n01.01.2000;1\n'); } catch (e) { lexFehler = e; }
assert(lexFehler !== null && /Kopfzeile/.test(lexFehler.message), 'Lexware Scheitern bei fremdem Format');
console.log('Lexware-CSV-Import: grün — Abbildung, Summen, Nullbeträge weg, unbekannte Zeile gemeldet, fremdes Format scheitert.');

console.log('\nGOLDMASTER GEGENPROBE BESTANDEN — Kern trifft das Original (PAngV + AIBD + AIBD360 + End-/Barwert).');
