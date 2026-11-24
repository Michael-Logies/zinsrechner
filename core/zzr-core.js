/*
 * ZZR-Neubau — Rechenkern (Zinsrechner)
 *
 * Verhaltensgetreue Neuentwicklung des „Zuckers Zins Rechner" (Gabriele Zucker,
 * Villingen, ca. 1999–2007) nach beobachtbarem Verhalten und öffentlichen
 * Rechenregeln (PAngV-Vergleichskonto, EG-Richtlinie 87/102/EWG Anhang II).
 * Es wurde kein Original-Code übernommen (Clean-Room-Nachbau, D1-Fremdcode-Regelwerk).
 *
 * Kernbegriffe:
 *  - Zahlungsstrom: Gruppe gleichartiger Zahlungen (Startdatum, Betrag, Ratenanzahl,
 *    Abstand in Monaten, Zuwachs je Stufe, Notiz, Ultimo-Flag).
 *  - Vorzeichen: negativ = Geld fließt vom Nutzer weg (er zahlt), positiv = er erhält.
 *  - Realdatum: Tagesnummer ab 1.1.0001 (bewiesen an Bsp_1: 730120 = 1.1.2000).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Kalender
  // Tagesnummer (Ordinalzahl) <-> Datum, zivilkalenderproleptisch ab 1.1.0001.
  function daysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor((y >= 0 ? y : y - 399) / 400);
    const yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468 + 719163; // 719163 = Ordinalzahl(1.1.0001); 730120 = 1.1.2000 (bewiesen)
  }
  function civilFromDays(z) {
    z -= 719163; // Ordinalzahl ab 1.1.0001 -> Tage seit 1.1.1970
    z += 719468;
    const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m: m, d: d };
  }
  function fromOrdinal(n) { return civilFromDays(n); }
  function toOrdinal(y, m, d) { return daysFromCivil(y, m, d); }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return m === 2 && isLeap(y) ? 29 : (m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31); }
  function addMonths(ord, k) {
    const c = fromOrdinal(ord);
    const total = c.y * 12 + (c.m - 1) + k;
    const y = Math.floor(total / 12);
    const m = total % 12 + 1;
    const d = Math.min(c.d, daysInMonth(y, m));
    return toOrdinal(y, m, d);
  }
  function addYears(ord, k) {
    const c = fromOrdinal(ord);
    const y = c.y + k;
    const d = Math.min(c.d, daysInMonth(y, c.m));
    return toOrdinal(y, c.m, d);
  }
  function deDate(ord) {
    const c = fromOrdinal(ord);
    const p = (n) => (n < 10 ? '0' : '') + n;
    return p(c.d) + '.' + p(c.m) + '.' + c.y;
  }

  // ---------------------------------------------------------- 30/360-Tagezahl
  // 30E/360 (deutsche Bankenkonvention): Tag 31 wird auf 30 gekappt.
  function days30360(ord1, ord2) {
    const a = fromOrdinal(ord1), b = fromOrdinal(ord2);
    const d1 = Math.min(a.d, 30), d2 = Math.min(b.d, 30);
    return (b.y - a.y) * 360 + (b.m - a.m) * 30 + (d2 - d1);
  }
  function days365(ord1, ord2) { return ord2 - ord1; }

  // ----------------------------------------------------------- Zahlungsströme
  // Projekt: { titel, methode (0=EG Anhang II, 1=PAngV Vergleichskonto), euro,
  //            beschreibung, strome: [ { aktiv, zuwachs, dynamik, datum, ultimo,
  //            betrag, raten, abstand, notiz } ] }
  function parseZZR(text) {
    const proj = { titel: '', methode: 0, euro: 0, beschreibung: '', strome: [] };
    let sektion = null, strom = null;
    const zeilen = text.split(/\r?\n/);
    for (let roh of zeilen) {
      const zeile = roh.trim();
      if (zeile === '' || zeile.charAt(0) === ';') continue;
      const sec = zeile.match(/^\[(.+)\]$/);
      if (sec) {
        sektion = sec[1];
        const m = sektion.match(/^Zahlungsstrom(\d+)$/i);
        if (m) { strom = { aktiv: 1, zuwachs: 0, dynamik: 0, ultimo: 0, notiz: '', raten: 1, abstand: 1 }; proj.strome.push(strom); }
        else strom = null;
        continue;
      }
      const kv = zeile.match(/^([^=]+)=(.*)$/);
      if (!kv) continue;
      const key = kv[1].trim(), val = kv[2].trim();
      if (sektion === 'Information') {
        if (key === 'Titel') proj.titel = val;
        else if (key === 'EZ-Methode') proj.methode = parseInt(val, 10) || 0;
        else if (key === 'Euro') proj.euro = parseInt(val, 10) || 0;
        else if (key === 'Zahlungsstroeme') proj._angesagt = parseInt(val, 10) || 0;
      } else if (sektion === 'Beschreibung') {
        if (key === 'Zeilen') proj._beschreibung = [];
        else { const m = key.match(/^Zeile(\d+)$/); if (m && proj._beschreibung) proj._beschreibung[parseInt(m[1], 10) - 1] = val; }
      } else if (strom) {
        switch (key) {
          case 'Aktiv': strom.aktiv = parseInt(val, 10) || 0; break;
          case 'Stufen': strom.stufen = parseInt(val, 10) || 1; break;
          case 'Dynamik': strom.dynamik = parseFloat(val) || 0; break;
          case 'Zuwachs': strom.zuwachs = parseFloat(val) || 0; break;
          case 'Realdatum': strom.datum = parseInt(val, 10); break;
          case 'Ultimo': strom.ultimo = parseInt(val, 10) || 0; break;
          case 'Betrag': strom.betrag = parseFloat(val) || 0; break;
          case 'Raten': strom.raten = Math.round(parseFloat(val) || 0); break;
          case 'Abstand': strom.abstand = Math.max(1, Math.round(parseFloat(val) || 1)); break;
          case 'Notiz': strom.notiz = val; break;
        }
      }
    }
    if (proj._beschreibung) proj.beschreibung = proj._beschreibung.filter(x => x !== undefined).join('\n');
    if (proj._angesagt && proj.strome.length !== proj._angesagt) {
      proj.strome = proj.strome.slice(0, proj._angesagt);
    }
    return proj;
  }

  function formatZZRFloat(x) {
    // Original-Schreibweise: "-2.54257900000000E+0002" / " 2.40000000000000E+0001"
    const neg = x < 0;
    const v = Math.abs(x);
    let exp = 0;
    if (v !== 0) {
      exp = Math.floor(Math.log10(v));
      if (v / Math.pow(10, exp) >= 10) exp += 1;
      if (v / Math.pow(10, exp) < 1) exp -= 1;
    }
    const mant = v === 0 ? 0 : v / Math.pow(10, exp);
    const mantStr = mant.toFixed(14);
    const expStr = (exp < 0 ? '-' : '+') + ('0000' + Math.abs(exp)).slice(-4);
    return (neg ? '-' : ' ') + mantStr + 'E' + expStr;
  }

  function serializeZZR(proj) {
    const L = [];
    L.push('[Information]');
    L.push('Typ=ZZR-Datei');
    L.push('Version=1');
    L.push('Erzeuger=Zuckers Zins Rechner (Nachbau)');
    L.push('Titel=' + (proj.titel || ''));
    L.push('EZ-Methode=' + (proj.methode || 0));
    L.push('Euro=' + (proj.euro || 0));
    L.push('Zahlungsstroeme=' + proj.strome.length);
    proj.strome.forEach(function (s, i) {
      L.push('');
      L.push('[Zahlungsstrom' + (i + 1) + ']');
      L.push('Aktiv=' + (s.aktiv ? 1 : 0));
      L.push('Stufen=' + (s.stufen || 1));
      L.push('Dynamik=' + formatZZRFloat(s.dynamik || 0));
      L.push('Zuwachs=' + formatZZRFloat(s.zuwachs || 0));
      L.push('Realdatum=' + s.datum);
      L.push('Ultimo=' + (s.ultimo ? 1 : 0));
      L.push('Betrag=' + formatZZRFloat(s.betrag || 0));
      L.push('Raten=' + formatZZRFloat(s.raten || 0));
      L.push('Abstand=' + (s.abstand || 1));
      L.push('Notiz=' + (s.notiz || ''));
    });
    if (proj.beschreibung) {
      const zs = proj.beschreibung.split('\n');
      L.push('');
      L.push('[Beschreibung]');
      L.push('Zeilen=' + zs.length);
      zs.forEach(function (z, i) { L.push('Zeile' + (i + 1) + '=' + z); });
    }
    return L.join('\r\n') + '\r\n';
  }

  // Alle Einzelzahlungen eines Projekts (kleinste Einheit): { datum, amount, label } —
  // Stufen-Semantik live bewiesen (23.11.2026): Raten = Anzahl PRO Stufe, Stufe s
  // trägt Betrag ×(1+Dynamik/100)^s bzw. Betrag + s×Zuwachs, Tage = s×Raten×Abstand.
  function expandiere(proj) {
    const liste = [];
    proj.strome.forEach(function (s, i) {
      if (!s.aktiv) return;
      const stufen = Math.max(1, Math.round(s.stufen || 1));
      const raten = Math.max(0, Math.round(s.raten));
      for (let st = 0; st < stufen; st++) {
        let betragStufe = s.betrag;
        if (s.zuwachs) betragStufe = betragStufe + st * s.zuwachs;
        if (s.dynamik) betragStufe = betragStufe * Math.pow(1 + s.dynamik / 100, st);
        for (let k = 0; k < raten; k++) {
          const datum = addMonths(s.datum, (st * raten + k) * (s.abstand || 1));
          liste.push({ datum: datum, betrag: betragStufe, notiz: s.notiz || ('Strom ' + (i + 1)), strom: i + 1, ultimo: !!s.ultimo });
        }
      }
    });
    liste.sort(function (a, b) { return a.datum - b.datum || a.strom - b.strom; });
    return liste;
  }

  // ------------------------------------------------------ EG-Methode (Anhang II)
  // AIBD/ISMA-Konvention (bewiesen am Original-Export konto-m0.txt, 24.11.2026):
  // Effektivzins = Lösung von SUMME CF_k * (1+i)^(-t_k) = 0 mit t = Tage/365,
  // effektive Verzinsung. Die Anzeige −8,8068 % am Goldmaster wird exakt getroffen.
  function zeitenJahre(flows) {
    const d0 = flows[0].datum;
    return flows.map(function (f) { return (f.datum - d0) / 365; });
  }
  function npvEG(flows, i, z) {
    let s = 0;
    for (let k = 0; k < flows.length; k++) s += flows[k].betrag * Math.pow(1 + i, -z[k]);
    return s;
  }
  function effEG(flows) {
    if (flows.length === 0) return null;
    const z = zeitenJahre(flows);
    const hatVorzeichenwechsel = flows.some(f => f.betrag > 0) && flows.some(f => f.betrag < 0);
    if (!hatVorzeichenwechsel) return null;
    let lo = -0.9999, hi = 10, flo = npvEG(flows, lo, z), fhi = npvEG(flows, hi, z);
    if (flo * fhi > 0) { // Bereich erweitern
      for (let hi2 = 10; hi2 <= 1e6; hi2 *= 10) { fhi = npvEG(flows, hi2, z); hi = hi2; if (flo * fhi <= 0) break; }
      if (flo * fhi > 0) return null;
    }
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2, fm = npvEG(flows, mid, z);
      if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      if (hi - lo < 1e-13) break;
    }
    return (lo + hi) / 2;
  }

  // ------------------------------------------- AIBD-Vergleichskonto (EG-Methode)
  /*
   * Bewiesen am Original-Export (Analyse►Vergleichskonto erstellen, EZ-Methode=0,
   * „Vergleichskonto AIBD Effektivzins −8,8068 %", 182 Zeilen, 24.11.2026):
   *  - Zins je Buchung: saldo × ((1+EFF)^(Tage/365) − 1) — tagesgenaue Zinseszins-
   *    Verzinsung mit dem EG-Effektivzins (keine 30/360-Bankmethode wie bei PAngV).
   *  - Kapitalisierung an jedem Zahlungsdatum: Tilgung saldo = Betrag + Zins,
   *    Abschluss-Saldo = vorheriger Saldo + Tilgung.
   *  - Die Rekursion ist zur EG-Gleichung äquivalent: das Konto endet beim letzten
   *    Flow exakt auf 0 (Goldmaster: Restguthaben-Zeile 01.01.2015, Saldo 0).
   * Alle 182 Originalzeilen bis auf Anzeige-Rundung (≤ 0,005 €) getroffen.
   */
  function kontoAIBD(flows, eff) {
    if (flows.length === 0) return null;
    const rows = [];
    let saldo = 0, prevDatum = null;
    for (const f of flows) {
      const zahlung = -f.betrag; // Kontosicht: Nutzer zahlt (+) → Einlage
      let zins = 0;
      if (prevDatum !== null) {
        const tage = f.datum - prevDatum;
        zins = saldo * (Math.pow(1 + eff, tage / 365) - 1);
      }
      const tilgung = zahlung + zins;
      saldo += tilgung;
      rows.push({
        valuta: f.datum, beschreibung: f.notiz,
        betrag: zahlung, zins, tilgung, saldo, art: 'zahlung'
      });
      prevDatum = f.datum;
    }
    return { zeilen: rows, restsald: saldo };
  }

  // ------------------------------------------------ PAngV-Vergleichskonto (ZZR-Stil)
  /*
   * Bewiesen am Original-Konto.txt:
   *  - Zinsansatz: Saldo × EFF/360 × Tage(30/360) — Stützperioden 1 Tag und 29 Tage
   *    trafen die Originalzeilen auf den Cent (−25,04 / −726,05 / −6,26).
   *  - Ansammlung an jedem Ereignisdatum (Zahlungen), Zinsverrechnung (Kapitalisierung)
   *    am Jahres-Jubiläum des frühesten Flows; kumulierte Zinsen + Stützanteil werden
   *    auf das echte Saldo übertragen, kumuliert-Spalte setzt neu.
   *  - Abschluss am letzten Ereignisdatum: Stützperiode bis zum nächsten
   *    Jahres-Jubiläum wird als Schluss-Zinsverrechnung gebucht.
   *  - „Abschluss-Saldo" = echtes Saldo + kumulierte (noch nicht verrechnete) Zinsen.
   *  - „Tilgung anteilig" = Änderung des Abschluss-Saldos − Zins anteilig.
   */
  function kontoSimulation(flows, eff) {
    if (flows.length === 0) return null;
    const start = flows[0].datum, ende = flows[flows.length - 1].datum;
    const rows = [];
    let saldoReal = 0;        // echtes Konto (Zahlungen + Jahres-Zinsverrechnungen)
    let kumuliert = 0;        // angesammelte, noch nicht verrechnete Zinsen
    let letzteAnchor = start;
    let letzteEreignis = start;
    const jubilaeum = (ord) => addYears(start, Math.max(1, fromOrdinal(ord).y - fromOrdinal(start).y));
    // Alle Ereignisdaten + Jahres-Jubiläen zwischen start und ende
    const termine = [];
    flows.forEach(f => termine.push(f.datum));
    for (let y = 1; ; y++) {
      const a = addYears(start, y);
      if (a > ende) break;
      termine.push(a);
    }
    const eindeutig = Array.from(new Set(termine)).sort((a, b) => a - b);

    function ansatz(saldo, t1, t2) {
      return saldo * (eff / 360) * days30360(t1, t2);
    }

    const fIndex = new Map(); // datum → [flows]
    flows.forEach(f => { if (!fIndex.has(f.datum)) fIndex.set(f.datum, []); fIndex.get(f.datum).push(f); });

    for (const t of eindeutig) {
      const jahrAnchor = (addYears(letzteAnchor, 1) === t);
      const fListe = fIndex.get(t) || [];
      for (const f of fListe) {
        const zins = ansatz(saldoReal, letzteEreignis, t);
        kumuliert += zins;
        const saldoVorher = saldoReal;
        saldoReal += -f.betrag; // Kontosicht: Nutzer-Auszahlung (+) → Einlage
        const abschlussAlt = saldoVorher + kumuliert - zins; // Abschluss vor dieser Zeile
        const abschlussNeu = saldoReal + kumuliert;
        rows.push({
          valuta: t, beschreibung: f.notiz,
          betrag: -f.betrag, saldoZinsber: saldoReal,
          zinsAnteilig: zins, tilgungAnteilig: abschlussNeu - abschlussAlt,
          zinsKumuliert: kumuliert, abschlussSaldo: abschlussNeu,
          art: 'zahlung'
        });
        letzteEreignis = t;
      }
      if (jahrAnchor) {
        const stuetz = ansatz(saldoReal, letzteEreignis, t);
        kumuliert += stuetz;
        rows.push({
          valuta: t, beschreibung: 'Zinsverrechnung',
          betrag: kumuliert, saldoZinsber: saldoReal + kumuliert,
          zinsAnteilig: stuetz, tilgungAnteilig: 0,
          zinsKumuliert: 0, abschlussSaldo: saldoReal + kumuliert,
          art: 'verrechnung'
        });
        saldoReal += kumuliert;
        kumuliert = 0;
        letzteAnchor = t;
        letzteEreignis = t;
      }
    }
    // Abschluss: Rest-Zinsverrechnung am LETZTEN Ereignisdatum (bewiesen am Goldmaster:
    // 01.01.2015 Entnahme mit 1-Tage-Stütz -6,26, dann Zinsverrechnung -6,26 -> Saldo 0).
    if (kumuliert !== 0) {
      rows.push({
        valuta: letzteEreignis, beschreibung: 'Zinsverrechnung',
        betrag: kumuliert, saldoZinsber: saldoReal + kumuliert,
        zinsAnteilig: 0, tilgungAnteilig: 0,
        zinsKumuliert: 0, abschlussSaldo: saldoReal + kumuliert,
        art: 'verrechnung'
      });
      saldoReal += kumuliert;
      kumuliert = 0;
    }
    return { zeilen: rows, restsald: saldoReal };
  }

  function effPAngV(flows) {
    if (flows.length === 0) return null;
    const hatW = flows.some(f => f.betrag > 0) && flows.some(f => f.betrag < 0);
    if (!hatW) return null;
    // Ziel: Restsaldo des Vergleichskontos = 0. S(eff) wächst streng monoton mit eff.
    function rest(eff) {
      const k = kontoSimulation(flows, eff);
      return k ? k.restsald : NaN;
    }
    let lo = -0.9999, hi = 10, flo = rest(lo), fhi = rest(hi);
    if (!(flo < 0 && fhi > 0)) {
      // Richtung/Bereich bereinigen
      if (flo > 0) { // Vorzeichen invertieren (Kontorichtung)
        return null;
      }
      let ok = false;
      for (let h = 10; h <= 1e6; h *= 10) { fhi = rest(h); hi = h; if (fhi > 0) { ok = true; break; } }
      if (!ok) return null;
    }
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2, fm = rest(mid);
      if (fm < 0) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; }
      if (hi - lo < 1e-14) break;
    }
    return (lo + hi) / 2;
  }

  // ------------------------------------------------------------- Löser (Ratenhöhe)
  // Skaliert den Betrag EINES Zahlungsstroms so, dass der gewählte Effektivzins erreicht wird.
  function loeseRatenhoehe(proj, stromNr, zielEff, methode) {
    const s = proj.strome[stromNr - 1];
    if (!s || s.betrag === 0) return null;
    const ziel = zielEff;
    function effMit(faktor) {
      const alt = s.betrag;
      s.betrag = alt * faktor;
      const flows = expandiere(proj);
      let e;
      if (methode === 1) e = effPAngV(flows); else e = effEG(flows);
      s.betrag = alt;
      return e;
    }
    let lo = 0.05, hi = 20, flo = effMit(lo), fhi = effMit(hi);
    let guard = 0;
    // Extremlagen ohne Vorzeichenwechsel haben keinen Effektivzins -> Grenzen einrücken
    while ((flo === null || fhi === null) && guard++ < 30) {
      if (flo === null) { lo = lo * 2 + 0.001; flo = effMit(lo); }
      if (fhi === null) { hi = hi / 2; fhi = effMit(hi); }
    }
    if (flo === null || fhi === null) return null;
    const steigt = fhi > flo; // Skalierung des Betrags wirkt auf den Effektivzins
    for (let it = 0; it < 200; it++) {
      const mid = Math.sqrt(lo * hi); // geometrisch: Größenordnungen
      const fm = effMit(mid);
      if (fm === null) return null;
      const links = steigt ? fm < ziel : fm > ziel;
      if (links) lo = mid; else hi = mid;
      if (hi / lo - 1 < 1e-13) break;
    }
    return s.betrag * Math.sqrt(lo * hi);
  }

  // ------------------------------------- Endwert-/Barwertberechnung (bewiesen)
  /*
   * Original-Messung 24.11.2026 (Analyse►Endwert-/Barwertberechnung►der Ein- &
   * Auszahlungen, Goldmaster-Szenario, Zins 55 %):
   *  - Endwert(Stichtag 01.01.2015, 55 %) = 73.303.508,71 € = Endsaldo des
   *    PAngV-Vergleichskontos (kontoSimulation) mit dem frei gewählten Zins —
   *    exakt (Δ 0,00 €).
   *  - Barwert(Stichtag 01.01.2000, 55 %) = 102.208,33 € und Zweitmessung
   *    (01.01.2000, 10 %) = 96.091,06 € = vergangene Zahlungen zum Nennwert +
   *    künftige Zahlungen abgezinst mit (1+r)^(-Tage30/360/360). Passung:
   *    55 % Δ +0,15 € / 10 % Δ −1,67 € — Struktur bei beiden Zinssätzen
   *    bestätigt; Residual = programminterne Cent-Rundung (180 Einzelwerte).
   *    30/360 bleibt beste Deutung (Konsistenz mit der PAngV-Konto-Familie);
   *    act/365.25 liegt praktisch gleichauf, act/365 und act/360 sind
   *    ausgeschlossen (Δ 4,73 / 125,38 bei 10 %).
   */
  function endwert(flows, rate, stichtag) {
    if (flows.length === 0) return null;
    const letztes = flows[flows.length - 1].datum;
    const S = (stichtag === undefined || stichtag === null) ? letztes : stichtag;
    if (S >= letztes) {
      const k = kontoSimulation(flows, rate);
      if (S === letztes) return k.restsald;
      // später als letzter Flow: Restsaldo bis zum Stichtag weiterverzinsen (30/360, unverifiziert)
      return k.restsald * (1 + rate * days30360(letztes, S) / 360);
    }
    // früherer Stichtag: Kontostand an dem Ereignis + Zins bis zum Stichtag (unverifiziert)
    const k = kontoSimulation(flows, rate);
    let saldo = 0, prev = null;
    for (const z of k.zeilen) {
      if (z.valuta <= S) { saldo = z.saldo; prev = z.valuta; } else break;
    }
    if (prev !== null && S > prev) saldo += saldo * (rate / 360) * days30360(prev, S);
    return saldo;
  }
  function barwert(flows, rate, stichtag) {
    if (flows.length === 0) return null;
    const S = (stichtag === undefined || stichtag === null) ? flows[0].datum : stichtag;
    let s = 0;
    for (const f of flows) {
      const zahlung = -f.betrag; // Kontosicht: Nutzer zahlt → Einlage (+)
      if (f.datum <= S) s += zahlung;
      else s += zahlung * Math.pow(1 + rate, -days30360(S, f.datum) / 360);
    }
    return s;
  }

  const API = {
    fromOrdinal, toOrdinal, addMonths, addYears, deDate, isLeap, daysInMonth,
    days30360, days365,
    parseZZR, serializeZZR, expandiere,
    effEG, effPAngV, kontoSimulation, kontoAIBD,
    loeseRatenhoehe, endwert, barwert
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.ZZR = API;
  return API;
})();
