#!/usr/bin/env node
// CSV (Jahres-Übersicht „Aktienentwicklung alle", Semikolon, CP1252, CRLF)
// → ZZR-.zzr-Datei (Zahlungsstrom) für den Import in den Zinsrechner.
//
// Abbildung (Kassenstrom des Depots, Vorzeichen: Einzahlung negativ, Rückfluss positiv):
//   Kauf        -Einstandspreis  (+ Einnahmen/Ausgaben-Spalte zusätzlich, z. B. Gebühr)
//   Verkauf     +Marktwert
//   Einnahme    +Einnahmen/Ausgaben (kann negativ sein = Kostenbuchung)
//   WP-Entnahme -Marktwert (Wert verlässt das Depot)
//   Ausgabe     +Einnahmen/Ausgaben (negativ)
//   Letzte End-Marktwert-Zeile = Schlußzahlung (Depotwert am Dateiende)
//   Nullbeträge bleiben weg. Außer der Kopfzeile (über zwei physische Zeilen gebrochen)
//   enthalten die Datenzeilen keine Quotes.
//
// Aufruf:  node tools/csv2zzr.js <quelle.csv> <ziel.zzr>
'use strict';
const fs = require('fs');
const path = require('path');
const ZZR = require('../core/zzr-core.js');

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('Aufruf: node tools/csv2zzr.js <quelle.csv> <ziel.zzr>'); process.exit(1); }

const text = fs.readFileSync(src, 'latin1'); // 0x81 (CP1252 ü) bleibt byte-erhaltend
const lines = text.split(/\r\n|\n/);
const data = lines.filter((ln, i) => i > 0 && ln.trim() && !ln.includes('"'));

function num(s) {
  s = s.trim().replace(/\./g, '').replace(',', '.');
  return s ? parseFloat(s) : 0.0;
}
function datum(s) {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) throw new Error('Unverständliches Datum: ' + JSON.stringify(s));
  return ZZR.toOrdinal(+m[3], +m[2], +m[1]);
}

const strome = [];
let letzterEndwert = null;
let sollSumme = 0; // unabhängiger Soll-Wert direkt aus der CSV
for (const ln of data) {
  const f = ln.split(';');
  const tag = f[0], konto = f[1], vorgang = f[2], beschreibung = f[3];
  const einstand = num(f[4]), ea = num(f[5]), marktwert = num(f[6]);
  const notiz = ((konto ? konto + ': ' : '') + (beschreibung || '').trim()).trim() || vorgang;
  if (!tag.trim()) continue;
  const d = datum(tag);
  if (vorgang === 'Kauf') {
    if (einstand !== 0) { strome.push({ datum: d, betrag: -einstand, notiz }); sollSumme -= einstand; }
    if (ea !== 0) { strome.push({ datum: d, betrag: ea, notiz: notiz + ' (E/A)' }); sollSumme += ea; }
  } else if (vorgang === 'Verkauf') {
    if (marktwert !== 0) { strome.push({ datum: d, betrag: marktwert, notiz }); sollSumme += marktwert; }
  } else if (vorgang === 'Einnahme') {
    if (ea !== 0) { strome.push({ datum: d, betrag: ea, notiz }); sollSumme += ea; }
  } else if (vorgang === 'WP-Entnahme') {
    if (marktwert !== 0) { strome.push({ datum: d, betrag: -marktwert, notiz: notiz + ' (WP-Entnahme)' }); sollSumme -= marktwert; }
  } else if (vorgang === 'Ausgabe') {
    if (ea !== 0) { strome.push({ datum: d, betrag: ea, notiz: notiz + ' (Ausgabe)' }); sollSumme += ea; }
  } else if (!vorgang && (beschreibung || '').trim() === 'End-Marktwert' && marktwert !== 0) {
    letzterEndwert = { datum: d, betrag: marktwert };
  }
}
if (letzterEndwert) {
  strome.push({ datum: letzterEndwert.datum, betrag: letzterEndwert.betrag, notiz: 'End-Marktwert lt. CSV (Schlußzahlung)' });
  sollSumme += letzterEndwert.betrag;
}
strome.sort((a, b) => a.datum - b.datum);

const proj = {
  titel: 'Aktienentwicklung alle (CSV 25.11.2026)',
  methode: 0, // EG-Anhang II (AIBD) (2023) — Voreinstellung der Fläche
  euro: 1,
  beschreibung: [
    'Quelle: "2026 Aktienentwicklung alle JJ_20261125_224733.csv" (Windows, CP1252).',
    'Abbildung als Kassenstrom: Kauf -Einstandspreis; Verkauf +Marktwert;',
    'Einnahme +Einnahmen/Ausgaben (auch negativ); WP-Entnahme -Marktwert;',
    'Ausgabe +Einnahmen/Ausgaben (negativ); letzter End-Marktwert = Schlußzahlung.',
    'Nullbeträge weggelassen. Der Effektivzins über diesen Strom ist der',
    'depotbezogene interne Zinsfuss (Ein- und Auszahlungen des Anlegers).',
  ].join('\n'),
  strome: strome.map(s => ({
    aktiv: 1, stufen: 1, dynamik: 0, zuwachs: 0, datum: s.datum,
    ultimo: 0, betrag: s.betrag, raten: 1, abstand: 1, notiz: s.notiz,
  })),
};

fs.writeFileSync(dst, Buffer.from(ZZR.serializeZZR(proj), 'latin1'));

// ---- Gegenprobe: Roundtrip über parseZZR + expandiere -----------------------
const back = ZZR.parseZZR(fs.readFileSync(dst, 'latin1'));
const flows = ZZR.expandiere(back);
const betragOf = f => (f.betrag !== undefined ? f.betrag : f.amount);
let summe = 0;
for (const f of flows) summe += betragOf(f);
console.log('Stromeinträge:', back.strome.length, '| expandierte Einzelzahlungen:', flows.length);
console.log('Erste Zahlung :', ZZR.deDate(flows[0].datum), betragOf(flows[0]).toFixed(2), 'EUR —', flows[0].label);
console.log('Letzte Zahlung:', ZZR.deDate(flows[flows.length - 1].datum), betragOf(flows[flows.length - 1]).toFixed(2), 'EUR —', flows[flows.length - 1].label);
console.log('Summe Soll (CSV direkt):', sollSumme.toFixed(2), 'EUR');
console.log('Summe Ist (.zzr-Roundtrip):', summe.toFixed(2), 'EUR');
const diff = Math.abs(sollSumme - summe);
console.log(diff < 0.01 ? 'SUMMEN GLEICH — Konvertierung sauber' : 'SUMMEN-ABWEICHUNG: ' + diff.toFixed(4), 'EUR');
try {
  const eff = ZZR.effEG(flows);
  console.log('Info EFF (EG-Anhang II/AIBD) über den Strom:', (eff * 100).toFixed(4), '% p.a.');
} catch (e) {
  console.log('Info: EFF nicht ermittelt (' + e.message + ') — im Rechner prüfen.');
}
