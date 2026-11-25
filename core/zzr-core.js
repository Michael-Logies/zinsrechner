/*
 * ZZR-Neubau — Rechenkern (Zinsrechner)
 *
 * Verhaltensgetreue Neuentwicklung des „Zuckers Zins Rechner" (Gabriele Zucker,
 * Villingen, ca. 1999–2007) nach beobachtbarem Verhalten und öffentlichen
 * Rechenregeln (PAngV-Vergleichskonto [1985, Geltung bis 2010]; EG-Richtlinie
 * 87/102/EWG Anhang II [1989, zuletzt fortgeführt 2023 durch CCD2]).
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
  function daysInMonth(y, m) {
    if (m === 2) return isLeap(y) ? 29 : 28; // Gemeinjahr-Februar = 28 (Bug 24.11.: sonst 31 → Monatsüberlauf)
    return (m === 4 || m === 6 || m === 9 || m === 11) ? 30 : 31;
  }
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
  // 30E/360 (deutsche Bankenkonvention): Tag 31 wird auf 30 gekappt. Dazu die
  // Februar-Ende-Regel (Beleg: Zzr.hlp, Absatz „Monatsultimo“, 24.11.2026):
  // „… bei Vergleichskonto PAngV oder AIBD360 würde mit dem 30.2. usw. gerechnet“ —
  // ein Datum am Ende des Februar (28./29.) zählt in der 30/360-Welt als 30.
  function istFebruarEnde(ord) {
    const c = fromOrdinal(ord);
    return c.m === 2 && c.d === daysInMonth(c.y, 2);
  }
  function days30360(ord1, ord2) {
    const a = fromOrdinal(ord1), b = fromOrdinal(ord2);
    const d1 = istFebruarEnde(ord1) ? 30 : Math.min(a.d, 30);
    const d2 = istFebruarEnde(ord2) ? 30 : Math.min(b.d, 30);
    return (b.y - a.y) * 360 + (b.m - a.m) * 30 + (d2 - d1);
  }
  function days365(ord1, ord2) { return ord2 - ord1; }

  // ----------------------------------------------------------- Zahlungsströme
  // Projekt: { titel, methode (0=EG Anhang II [2023], 1=PAngV Vergleichskonto [bis 2010]), euro,
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
          case 'Raten': strom.raten = parseFloat(val) || 0; break; // gebrochene Ratenzahl zulässig (Zzr.hlp: „2,5 mal DM 100,-“)
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
      // Gebrochene Ratenzahl zulässig (Zzr.hlp „Beispiel: Ratenanzahl“, Absatz
      // „Anzahl der Raten“: „2,5 mal DM 100,- … beim dritten mal jedoch nur DM 50,-“) —
      // die letzte Zahlung einer Stufe trägt den Bruchteil des Betrags.
      const raten = Math.max(0, s.raten || 0);
      const nStufe = Math.ceil(raten - 1e-6);
      const anker = fromOrdinal(s.datum);
      for (let st = 0; st < stufen; st++) {
        let betragStufe = s.betrag;
        if (s.zuwachs) betragStufe = betragStufe + st * s.zuwachs;
        if (s.dynamik) betragStufe = betragStufe * Math.pow(1 + s.dynamik / 100, st);
        for (let k = 0; k < nStufe; k++) {
          const n = st * nStufe + k;              // laufender Raten-Index des Stroms
          const anteil = Math.min(1, raten - k);  // Bruchteil der Schlußrate
          if (anteil <= 1e-9) continue;
          let datum;
          if (n === 0) {
            datum = s.datum; // erste Zahlung: Datum wie eingegeben (echter Kalender)
          } else {
            // Folgeraten: Monat = Ankermonat + n·Abstand. Ultimo (Zzr.hlp
            // „Monatsultimo“: „wird ‚immer zum Ultimo‘ angekreuzt, erfolgen die
            // weiteren Ratenzahlungen zum 31.3., 30.4., usw.“) = letzter Kalender-
            // tag des Zielmonats; sonst der Ankertag, an kurzen Monaten gekappt.
            const ziel = anker.y * 12 + (anker.m - 1) + n * (s.abstand || 1);
            const y = Math.floor(ziel / 12), m = ziel % 12 + 1;
            datum = s.ultimo
              ? toOrdinal(y, m, daysInMonth(y, m))
              : toOrdinal(y, m, Math.min(anker.d, daysInMonth(y, m)));
          }
          liste.push({ datum: datum, betrag: betragStufe * anteil, notiz: s.notiz || ('Strom ' + (i + 1)), strom: i + 1, ultimo: !!s.ultimo });
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
    const kandidaten = wurzelnSuchen(i => npvEG(flows, i, z), -0.99, 10);
    return plausibleWurzel(kandidaten);
  }

  // ---------- gemeinsame Raster-Wurzelsuche (für alle drei EFF-Methoden) ----
  /*
   * Beliebige Zahlungsströme (Ansparvorgänge, Kredite, Mischformen) können
   * nicht-monotone Konto-/NPV-Verläufe mit MEHREREN Wurzeln erzeugen — eine
   * einfache Grenz-Bisektion verpasst Lösungen oder liefert die absurde.
   * Das Raster findet alle Vorzeichenwechsel im Bereich −99 % bis +1000 %;
   * je Bereich wird bisektiert. EU-Konvention: der kleinste positive Zins,
   * sonst die dem Nullpunkt nächste Lösung.
   */
  function wurzelnSuchen(f, eMin, eMax) {
    const wurzeln = [];
    let ePrev = eMin, sPrev = f(ePrev);
    if (!isFinite(sPrev)) return wurzeln;
    for (let e = eMin + 0.01; e <= eMax + 0.0001; e += 0.01) {
      const sCur = f(e);
      if (isFinite(sCur) && sPrev * sCur < 0) {
        let a = ePrev, b = e, sa = sPrev;
        for (let it = 0; it < 80; it++) {
          const mid = (a + b) / 2, sm = f(mid);
          if (sa * sm <= 0) { b = mid; } else { a = mid; sa = sm; }
          if (b - a < 1e-14) break;
        }
        wurzeln.push((a + b) / 2);
      }
      ePrev = e;
      sPrev = sCur;
    }
    return wurzeln;
  }
  function plausibleWurzel(wurzeln) {
    if (!wurzeln.length) return null;
    const positiv = wurzeln.filter(w => w > 0);
    if (positiv.length) return Math.min(...positiv);
    return wurzeln.slice().sort((x, y) => Math.abs(x) - Math.abs(y))[0];
  }

  // ------------------- AIBD 360 (vierte Konto-Variante, 24.11.2026 bewiesen)
  /*
   * Das Original-Dropdown nennt vier Varianten: PAngV (alt) [bis 2010], AIBD (ISMA)
   * [2023/CCD2], AIBD 360, PAngV 2000. AIBD 360 ist am Original bewiesen (Orakel 24.11.2026,
   * Probe ultimo-u3, Export tests/orakel-u3b-aibd360.txt): Effektivzins
   * 0,7410 % p.a. — exakt die Gleichung
   *     Σ CF·(1+i)^(-t/360) = 0   mit t = 30/360-Tagezahlen (days30360)
   * ab der ersten Zahlung, also exponentielle Verzinsung im 30/360-Kalendarium.
   * AIBD (ISMA) ist dieselbe Formel mit act/365-Tagezahlen (effEG). AIBD 360 ist eine
   * Marktkonvention (Rentenmärkte) OHNE gesetzliche Regelung — für die drei übrigen
   * Varianten gelten die Jahre: PAngV (alt) bis 2010, AIBD/CCD2 2023, PAngV 2000 = 2000.
   * Nachweis zugleich in tests/test-core.js (Block „Orakel-Referenzen 24.11.").
   */
  function npvAibd360(flows, i) {
    const S = flows[0].datum;
    let s = 0;
    for (const f of flows) {
      const t = days30360(S, f.datum);
      s += f.betrag * Math.pow(1 + i, -t / 360);
    }
    return s;
  }
  function effAibd360(flows) {
    if (flows.length === 0) return null;
    const hatVorzeichenwechsel = flows.some(f => f.betrag > 0) && flows.some(f => f.betrag < 0);
    if (!hatVorzeichenwechsel) return null;
    const kandidaten = wurzelnSuchen(i => npvAibd360(flows, i), -0.99, 10);
    return plausibleWurzel(kandidaten);
  }

  // ---------------------------- PAngV 2011/2026 (Gesamtkreditkosten-Formel)
  /*
   * Heutige Rechtslage (Anlage zu § 16 PAngV, Neufassung 2021 — BGBl. I S. 4921 —,
   * zuletzt geändert 2026; Umsetzung der Verbraucherkredit-
   * richtlinie 2008/48/EG; fortgeführt durch RL (EU) 2023/2225 „CCD2", seit
   * 20.11.2026 anwendbar): Der effektive Jahreszins X löst
   *     Σ C_k·(1+X)^(-t_k) = Σ D_l·(1+X)^(-s_l)
   * (Barwert der Auszahlungen = Barwert aller Rückzahlungen inkl. Kosten).
   * Zeiten in Jahren mit je-Kalenderjahr-Zinstagen: 365, im Schaltjahr 366
   * („act/act"). Für ein allgemeines Zahlungsgeschäft (Konto-Sicht, Nutzer-
   * Vorzeichen) ist das äquivalent zur NPV-Gleichung Σ CF·(1+X)^(-t) = 0.
   * Der ZZR (2007) kennt diese Methode NICHT (98/7/EG und PAngV 2011 kamen
   * später) — daher ohne Original-Referenzpunkt. Verifikation:
   *  - Identitätstest 365/365-Tage-Jahr = 10,000 % (tests/test-core.js),
   *  - Abgleich mit den amtlichen Kommissions-Rechenbeispiele (ABl. C 127/2,
   *    4.5.2012, CELEX 52012XC0504(01)) STEHT NOCH AUS (EUR-Lex-Abruf lieferte
   *    am 24.11.2026 nur eine leere Seite).
   * Anzeige-Rundung nach RL 2011/90/EU: eine Nachkommastelle (oder 0,1 prozent-
   * punkte); die Fläche zeigt vier Stellen zur Genauigkeitskontrolle.
   */
  function jahreActAct(d0, d) {
    // Remark (C), SWD(2012) 128 final — Kommissions-Leitfaden zur APR-Berechnung
    // (https://ec.europa.eu/transparency/documents-register/api/files/SWD(2012)128_0/
    //  de00000000562627): Ganze Monate werden vom Zahlungstag RÜCKWÄRTS gezählt
    // (m/12 Jahre — „1 Monat" ist 1/12, nicht 28-31 Tage), die Resttage (ohne den
    // ersten, einschließlich des letzten) teilen durch die Jahreslänge des
    // Kalenderjahres, das am Monatsanker endet (rückwärts bis zum gleichen Tag des
    // Vorjahres — 365 oder 366). Amtliches Zeitbeispiel des SWD: 1.12.2012 →
    // 2.2.2013 = 2/12 + 1/366.
    let m = fromOrdinal(d).y * 12 + fromOrdinal(d).m -
            (fromOrdinal(d0).y * 12 + fromOrdinal(d0).m);
    let anchor = addMonths(d, -m);
    if (anchor < d0) { m -= 1; anchor = addMonths(d, -m); }
    const rest = anchor - d0;
    const ay = fromOrdinal(anchor);
    const vorjahr = toOrdinal(ay.y - 1, ay.m, Math.min(ay.d, daysInMonth(ay.y - 1, ay.m)));
    return m / 12 + rest / (anchor - vorjahr);
  }
  function effPAngVHeu(flows) {
    if (flows.length === 0) return null;
    const hatVorzeichenwechsel = flows.some(f => f.betrag > 0) && flows.some(f => f.betrag < 0);
    if (!hatVorzeichenwechsel) return null;
    const z = flows.map(f => jahreActAct(flows[0].datum, f.datum));
    const kandidaten = wurzelnSuchen(i => {
      let s = 0;
      for (let k = 0; k < flows.length; k++) s += flows[k].betrag * Math.pow(1 + i, -z[k]);
      return s;
    }, -0.99, 10);
    return plausibleWurzel(kandidaten);
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
    // Ziel: Restsaldo des Vergleichskontos = 0. Die Kontogleichung kann mehrere
    // Wurzeln haben (z. B. eine absurde negative Lösung neben der sinnvollen
    // positiven bei Krediten) — EU-Konvention: der kleinste positive
    // effektive Jahreszins, sonst die dem Nullpunkt nächste Lösung.
    function rest(eff) {
      const k = kontoSimulation(flows, eff);
      return k ? k.restsald : NaN;
    }
    const kandidaten = wurzelnSuchen(rest, -0.99, 10);
    return plausibleWurzel(kandidaten);
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
      // Einseitiger Strom (z. B. winzige skalierte Rate — nur Auszahlungen an
      // den Nutzer oder nur eigene Zahlungen): kein EFF existiert. Für die
      // Bracket-Suche wirkt das wie „−unendlich“ — die Lösung liegt zwingend
      // oberhalb, die Bracket-Erweiterung darf deshalb NICHT abbrechen
      // (Nutzer-Bug 25.11.2026: Anlage 10.000, Start-Rate 100, Ziel 5 % →
      // Start-Bracket ×0,05 einseitig → Löser lieferte null).
      const einseitig = !flows.some(f => f.betrag > 0) || !flows.some(f => f.betrag < 0);
      if (einseitig) { s.betrag = alt; return -1e9; }
      let e;
      if (methode === 1) e = effPAngV(flows); else e = effEG(flows);
      s.betrag = alt;
      return e;
    }
    let lo = 0.05, hi = 20, flo = effMit(lo), fhi = effMit(hi);
    // null = kein EFF im durchsuchten Bereich (−99 %…+1000 %): BEIDE Ränder null
    // heißt, die Lösung liegt ZWISCHEN ihnen (reale EFFs existieren dann in der
    // Mitte — der Löser bisektiert zwischen den ±unendlich-Kanten). Ein RAND
    // null allein: das Ziel liegt jenseits dieses Randes (Nutzer-Bug 25.11.2026:
    // Anlage 10.000, Start-Rate 100, Ziel 5 % → beide Ränder null, früher
    // sofortiger Abbruch „Löser ohne Ergebnis“).
    if (flo === null) flo = -Infinity;
    if (fhi === null) fhi = +Infinity;
    // Bracket geometrisch erweitern, bis der Zielzins eingekreist ist — der
    // fixe [0.05, 20]-Bracket verfehlte das Zzr.hlp-Beispiel BSP_1 (Nennbetrag
    // 1 DM, Lösung ≈ 1375 DM). Nicht erreichbare Ziele brechen am Wachstums-Limit.
    let guard = 0;
    while (guard++ < 200 && (flo - ziel) * (fhi - ziel) > 0) {
      if (fhi - ziel > 0) { hi = lo; lo = lo / 4; fhi = flo; flo = effMit(lo); }
      else { lo = hi; hi = hi * 4; flo = fhi; fhi = effMit(hi); }
      if (!isFinite(lo) || !isFinite(hi)) return null;
    }
    if ((flo - ziel) * (fhi - ziel) > 0) return null;
    const steigt = fhi > flo; // Skalierung des Betrags wirkt auf den Effektivzins
    for (let it = 0; it < 200; it++) {
      const mid = Math.sqrt(lo * hi); // geometrisch: Größenordnungen
      const fm = effMit(mid);
      if (fm === null) {
        // Kein EFF im Bereich (Konto kann den Zielzins bei dieser Größenordnung
        // gar nicht erreichen — Rückzahlungen zu klein): unterhalb der Lösung,
        // weiter nach oben suchen (steigt = true ist hier die Norm).
        if (steigt) { lo = mid; continue; }
        return null;
      }
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
  function endwert(flows, rate, stichtag, methode) {
    if (flows.length === 0) return null;
    const aibd = (methode === 0);
    const letztes = flows[flows.length - 1].datum;
    const S = (stichtag === undefined || stichtag === null) ? letztes : stichtag;
    if (aibd) {
      // Methode 0: Endsaldo des AIBD-Tageskontos — bewiesen exakt
      // (Original 24.11.2026: 73.721.200,13 € bei 55 %, Δ 0,00)
      return kontoAIBD(flows, rate).restsald;
    }
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
  function barwert(flows, rate, stichtag, methode) {
    if (flows.length === 0) return null;
    const aibd = (methode === 0);
    const S = (stichtag === undefined || stichtag === null) ? flows[0].datum : stichtag;
    // Methode 1: 30/360-Abzinsung (bewiesen 55 %: Δ 0,15 / 10 %: Δ 1,67)
    // Methode 0: act/365-Abzinsung (bewiesen 55 %: 102.208,70 gemessen vs
    // 102.208,66 berechnet, Δ 0,04 — AIBD-Tageszins-Konvention)
    const nenner = aibd ? 365 : 360;
    const tageFkt = aibd ? days365 : days30360;
    let s = 0;
    for (const f of flows) {
      const zahlung = -f.betrag; // Kontosicht: Nutzer zahlt → Einlage (+)
      if (f.datum <= S) s += zahlung;
      else s += zahlung * Math.pow(1 + rate, -tageFkt(S, f.datum) / nenner);
    }
    return s;
  }

  // ------------------------------------------------ Zahlungsplan (ZZR-„Vorbereitung")
  /*
   * Das Original erzeugt bei der Vorbereitung der Ergebnisse einen Zahlungsplan —
   * die vollständige Aufstellung aller Einzelzahlungen (Fehlerdialog „Es kann kein
   * Zahlungsplan erstellt werden…“, wenn keine Nullstelle existiert). Die
   * Laufzeitangabe folgt der Kontokonvention: PAngV rechnet sie mit dem
   * 30/360-Kalendarium (ZA-Bericht: „Die Laufzeitbestimmung erfolgt mittels eines
   * 30/360-Tage-Kalendariums“ — 31.10.1999→30.04.2000 = „6 Monaten, 0 Tagen“),
   * das AIBD-Konto mit echtem Kalender („5 Monaten, 30 Tagen“). Beide Werte am
   * Original-View verifiziert (24.11.2026, Probe ultimo-u1).
   */
  function laufzeit(d1, d2, methode) {
    const a = fromOrdinal(d1), b = fromOrdinal(d2);
    if (methode === 2) {
      // PAngV 2011/2026 (Remark C, SWD(2012) 128): ganze Monate rückwärts vom
      // letzten Zahlungstag, Resttage real (ohne den ersten, einschließlich des
      // letzten) — dieselbe Monatszählung wie in jahreActAct.
      let m = (b.y * 12 + (b.m - 1)) - (a.y * 12 + (a.m - 1));
      let anchor = addMonths(d2, -m);
      if (anchor < d1) { m -= 1; anchor = addMonths(d2, -m); }
      const jahre = Math.floor(m / 12);
      return { jahre: jahre, monate: m - jahre * 12, tage: d2 - anchor };
    }
    let t1, t2;
    if (methode === 1) {
      t1 = istFebruarEnde(d1) ? 30 : Math.min(a.d, 30);
      t2 = istFebruarEnde(d2) ? 30 : Math.min(b.d, 30);
    } else { t1 = a.d; t2 = b.d; }
    let monate = (b.y * 12 + (b.m - 1)) - (a.y * 12 + (a.m - 1));
    let tage = t2 - t1;
    if (tage < 0) {
      monate -= 1;
      const vy = b.m === 1 ? b.y - 1 : b.y, vm = b.m === 1 ? 12 : b.m - 1;
      tage += (methode === 1) ? 30 : daysInMonth(vy, vm);
    }
    const jahre = Math.floor(monate / 12);
    return { jahre: jahre, monate: monate - jahre * 12, tage: tage };
  }
  function zahlungsplan(proj) {
    const flows = expandiere(proj);
    const zeilen = flows.map(function (f, i) {
      return { nr: i + 1, datum: f.datum, betrag: f.betrag, strom: f.strom, notiz: f.notiz };
    });
    let summeEin = 0, summeAus = 0;
    flows.forEach(function (f) { if (f.betrag < 0) summeEin += f.betrag; else summeAus += f.betrag; });
    return {
      zeilen: zeilen,
      summeEin: summeEin,  // Zahlungen des Nutzers (negativ)
      summeAus: summeAus,  // Auszahlungen an den Nutzer (positiv)
      erste: flows.length ? flows[0].datum : null,
      letzte: flows.length ? flows[flows.length - 1].datum : null,
      laufzeit: flows.length ? laufzeit(flows[0].datum, flows[flows.length - 1].datum, proj.methode) : null
    };
  }

  // ------------------------------------------------ XLSX-Export (Tabellenkalkulation mit Formeln)
  /*
   * Erzeugt ein XLSX (Office Open XML, ECMA-376) mit ECHTEN Zellformeln, damit
   * in LibreOffice Calc / Excel weitergerechnet werden kann:
   *  - Blatt „Zahlungsströme": Stufenansicht, Datum als Datumszellen
   *  - Blatt „Vergleichskonto" (wenn ein Konto erstellt wurde): Valuta als
   *    Datumszellen, Zins/Saldo/Tilgung als Formelkette, der Effektivzins in
   *    einer Eingabezelle (B2) — Zins ändern = Konto rechnet neu; den
   *    Effektivzins selbst ermittelt die Tabellenkalkulation über Daten →
   *    Zielwertsuche auf die letzte Abschluss-Zelle (= 0)
   *  - Blatt „Zahlungsplan": kumulierte Spalte als Formel
   * Technik: ZIP ohne Kompression (STORE) aus XML-Texten, erzeugt im Browser
   * ohne externe Bibliothek. Tage-Spalten sind Werte (vom Kern; die 30/360-
   * Februarregeln weichen von Excel-TAGE360 in Grenzfällen ab). Formelzellen
   * tragen die Kern-Ergebnisse als Cache (<v>) und workbook.xml erzwingt
   * Neuberechnung beim Öffnen (fullCalcOnLoad).
   */
  function xlsxExport(proj, konto) {
    // ---- Helfer
    function utf8(s) { return new TextEncoder().encode(s); }
    function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function spalte(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
    const CRC_TABELLE = (function () { const t = new Uint32Array(256); for (let x = 0; x < 256; x++) { let c = x; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[x] = c >>> 0; } return t; })();
    function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABELLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

    // ---- Daten sammeln
    const flows = expandiere(proj);
    const plan = zahlungsplan(proj);
    let kontoZeilen = null, kontoMethode = null, kontoEff = null;
    if (konto && konto.zeilen && konto.zeilen.length) {
      kontoZeilen = konto.zeilen; kontoMethode = konto.methode; kontoEff = konto.eff;
    } else {
      // Kein Konto vorab erstellt: der Export berechnet es SELBST (mit der
      // gewählten Kontoart bzw. der EZ-Methode der Datei) — jedes XLSX
      // enthält damit immer auch die Konto-Formelkette (Nutzer-Bug 25.11.:
      // ohne vorab erstelltes Konto fehlte das Konto-Blatt komplett).
      const methode = (konto && konto.methode !== undefined) ? konto.methode : proj.methode;
      const eff = (methode === 0) ? effEG(flows) : effPAngV(flows);
      if (eff !== null) {
        const k = (methode === 0) ? kontoAIBD(flows, eff) : kontoSimulation(flows, eff);
        if (k && k.zeilen.length) { kontoZeilen = k.zeilen; kontoMethode = methode; kontoEff = eff; }
      }
    }

    // ---- Zell-/Zeilenbauer: zellTyp 't'=Text, 'n'=Zahl, 'd'=Datum-Serial, 'f'=Formel (v = Cache)
    function zeileXML(nr, zellen) {
      let h = '<row r="' + nr + '">';
      zellen.forEach(function (z, i) {
        const ref = spalte(i + 1) + nr;
        if (z === null || z === undefined) return;
        if (z.f !== undefined) {
          h += '<c r="' + ref + '"' + (z.v !== undefined && z.v !== null ? '><f>' + xmlEsc(z.f) + '</f><v>' + z.v + '</v></c>' : '/>');
        } else if (z.t === 't') {
          h += '<c r="' + ref + '" t="inlineStr"' + (z.s ? ' s="' + z.s + '"' : '') + '><is><t xml:space="preserve">' + xmlEsc(z.v) + '</t></is></c>';
        } else {
          h += '<c r="' + ref + '"' + (z.s ? ' s="' + z.s + '"' : '') + '><v>' + z.v + '</v></c>';
        }
      });
      return h + '</row>';
    }

    const blattXmls = [];

    // ---- Blatt 1: Zahlungsströme (Stufenansicht)
    {
      const rows = [];
      rows.push(zeileXML(1, [
        { t: 't', v: 'Akt.' }, { t: 't', v: 'Datum von' }, { t: 't', v: 'Betrag' }, { t: 't', v: 'Raten' },
        { t: 't', v: 'Abstand (Mon.)' }, { t: 't', v: 'Stufen' }, { t: 't', v: 'Dynamik %' },
        { t: 't', v: 'Zuwachs' }, { t: 't', v: 'Ultimo' }, { t: 't', v: 'Beschreibung' }
      ]));
      proj.strome.forEach(function (s, i) {
        rows.push(zeileXML(i + 2, [
          { t: 't', v: s.aktiv ? 'ja' : '—' },
          { v: s.datum - 693594, s: 1 },
          { v: s.betrag }, { v: s.raten }, { v: s.abstand }, { v: s.stufen }, { v: s.dynamik }, { v: s.zuwachs },
          { t: 't', v: s.ultimo ? 'Ultimo' : '' }, { t: 't', v: s.notiz || '' }
        ]));
      });
      blattXmls.push(rows.join(''));
    }

    // ---- Blatt 2: Zahlungen (expandiert) + Effektivzins als XIRR-FORMEL
    // XIRR(values, dates) = interner Zinsfuß mit echten Tagesdaten /365 — das
    // ist exakt die EG/AIBD-Methode (effEG). Ändert der Nutzer eine Zahlung,
    // berechnet der Effektivzins sich selbst neu.
    {
      const aktiveFlows = flows.filter(function (f) { return true; });
      const ersteZeile = 5, letzteZeile = ersteZeile + aktiveFlows.length - 1;
      const rows = [];
      rows.push(zeileXML(1, [{ t: 't', v: 'Effektivzins EG/AIBD (XIRR aus den Zahlungen unten):' },
        { f: 'XIRR(B' + ersteZeile + ':B' + letzteZeile + ',A' + ersteZeile + ':A' + letzteZeile + ')', v: effEG(aktiveFlows) }]));
      rows.push(zeileXML(2, [{ t: 't', v: 'PAngV-Effektivzins (30/360-Sparbuch — Wert vom Rechenkern):' },
        { v: effPAngV(aktiveFlows) !== null ? effPAngV(aktiveFlows) : '' }]));
      rows.push(zeileXML(3, [{ t: 't', v: 'PAngV-Formel gibt es in Tabellenkalkulationen nicht — nur über Zielwertsuche im Vergleichskonto-Blatt.' }]));
      rows.push(zeileXML(4, [{ t: 't', v: 'Datum' }, { t: 't', v: 'Betrag' }]));
      aktiveFlows.forEach(function (f, i) {
        rows.push(zeileXML(ersteZeile + i, [{ v: f.datum - 693594, s: 1 }, { v: f.betrag }]));
      });
      blattXmls.push(rows.join(''));
    }

    // ---- Blatt: Vergleichskonto (Formelkette)
    if (kontoZeilen) {
      const rows = [];
      rows.push(zeileXML(1, [{ t: 't', v: 'Kontoart:' }, { t: 't', v: kontoMethode === 0 ? 'AIBD (EG-Anhang II) (2023)' : 'PAngV (alt) (bis 2010)' }]));
      // B2: bei AIBD = Verweis auf die XIRR-Formel im Blatt „Zahlungen“
      // (Änderung einer Zahlung zieht das Konto nach); bei PAngV = Wert vom
      // Rechenkern (30/360-Sparbuch-EFF ist als Tabellenfunktion nicht
      // verfügbar — Ermittlung über Zielwertsuche).
      const b2 = (kontoMethode === 0)
        ? { f: 'Zahlungen!B1', v: kontoEff }
        : { v: kontoEff };
      rows.push(zeileXML(2, [{ t: 't', v: 'Effektivzins (Dezimal — editierbar):' }, b2]));
      rows.push(zeileXML(3, [{ t: 't', v: 'Zelle B2 ändern = Konto rechnet neu. Effektivzins selbst ermitteln: Extras → Zielwertsuche, Zielzelle = letzte Abschluss-Saldo-Zelle (Ziel 0), veränderbare Zelle = B2.' }]));
      const istAibd = (kontoMethode === 0);
      const kopf = istAibd
        ? ['Valuta', 'Beschreibung', 'Betrag', 'Tage', 'Zins anteilig', 'Tilgung', 'Saldo']
        : ['Valuta', 'Beschreibung', 'Betrag', 'Tage', 'Saldo für Zinsber.', 'Zins anteilig', 'Zins kumuliert', 'Tilgung anteilig', 'Abschluss-Saldo'];
      rows.push(zeileXML(4, kopf.map(function (t) { return { t: 't', v: t }; })));
      let prevDatum = null;
      kontoZeilen.forEach(function (r, i) {
        const nr = i + 5;
        const tage = (prevDatum === null) ? 0 : (istAibd ? (r.valuta - prevDatum) : days30360(prevDatum, r.valuta));
        const z = [];
        z.push({ v: r.valuta - 693594, s: 1 });
        z.push({ t: 't', v: r.beschreibung || '' });
        z.push({ v: r.betrag });
        z.push({ v: tage });
        if (istAibd) {
          z.push((i === 0) ? { v: 0 } : { f: 'G' + (nr - 1) + '*((1+$B$2)^(D' + nr + '/365)-1)', v: r.zins });
          z.push({ f: 'C' + nr + '+E' + nr, v: r.tilgung });
          z.push((i === 0) ? { f: 'F' + nr, v: r.saldo } : { f: 'G' + (nr - 1) + '+F' + nr, v: r.saldo });
        } else {
          z.push((i === 0) ? { v: 0 } : { f: 'I' + (nr - 1) + '-G' + (nr - 1), v: r.saldoZinsber });
          z.push((i === 0) ? { v: 0 } : { f: 'E' + nr + '*$B$2*D' + nr + '/360', v: r.zinsAnteilig });
          z.push((i === 0) ? { v: 0 } : { f: 'G' + (nr - 1) + '+F' + nr, v: r.zinsKumuliert });
          z.push((i === 0) ? { f: 'I' + nr + '-F' + nr, v: r.tilgungAnteilig }
                           : { f: 'I' + nr + '-I' + (nr - 1) + '-F' + nr, v: r.tilgungAnteilig });
          z.push((i === 0) ? { f: 'C' + nr, v: r.abschlussSaldo } : { f: 'I' + (nr - 1) + '+C' + nr + '+F' + nr, v: r.abschlussSaldo });
        }
        rows.push(zeileXML(nr, z));
        prevDatum = r.valuta;
      });
      rows.push(zeileXML(kontoZeilen.length + 6, [{ t: 't', v: 'Letzte Abschluss-Saldo-Zelle muss 0 sein — Extras → Zielwertsuche ermittelt den Effektivzins in B2 neu.' }]));
      blattXmls.push(rows.join(''));
    }

    // ---- Blatt: Zahlungsplan (kumulierte Spalte als Formel)
    {
      const rows = [];
      rows.push(zeileXML(1, [{ t: 't', v: 'Zahlungsplan zu „' + proj.titel + '“' }]));
      rows.push(zeileXML(2, [
        { t: 't', v: 'Nr.' }, { t: 't', v: 'Valuta' }, { t: 't', v: 'Beschreibung' }, { t: 't', v: 'Betrag' }, { t: 't', v: 'Kumuliert' }
      ]));
      let kum = 0;
      plan.zeilen.forEach(function (z, i) {
        kum += z.betrag;
        const nr = i + 3;
        rows.push(zeileXML(nr, [
          { v: z.nr }, { v: z.datum - 693594, s: 1 }, { t: 't', v: z.notiz || ('Strom ' + z.strom) },
          { v: z.betrag }, (i === 0) ? { f: 'D' + nr, v: kum } : { f: 'E' + (nr - 1) + '+D' + nr, v: kum }
        ]));
      });
      rows.push(zeileXML(plan.zeilen.length + 4, [
        null, null, { t: 't', v: 'Summen:' },
        { f: 'SUM(D3:D' + (plan.zeilen.length + 2) + ')', v: plan.summeEin + plan.summeAus }, null
      ]));
      blattXmls.push(rows.join(''));
    }

    // ---- XML-Teile
    const hatKonto = !!kontoZeilen;
    const blattNamen = hatKonto
      ? ['Zahlungsströme', 'Zahlungen', 'Vergleichskonto', 'Zahlungsplan']
      : ['Zahlungsströme', 'Zahlungen', 'Zahlungsplan'];
    const sheetOverrides = blattNamen.map(function (_, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('');
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + sheetOverrides
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const sheetsXml = blattNamen.map(function (n, i) {
      return '<sheet name="' + xmlEsc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('');
    const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets>' + sheetsXml + '</sheets><calcPr calcId="124519" fullCalcOnLoad="1"/></workbook>';
    const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + blattNamen.map(function (_, i) {
        return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join('')
      + '<Relationship Id="rId' + (blattNamen.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>';
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<numFmts count="1"><numFmt numFmtId="164" formatCode="DD.MM.YYYY"/></numFmts>'
      + '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
      + '<borders count="1"><border/></borders>'
      + '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
      + '<cellXfs count="2"><xf/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>';
    const sheetFiles = blattXmls.map(function (inhalt, i) {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + inhalt + '</sheetData></worksheet>';
    });

    // ---- ZIP (STORE) zusammenstellen
    const dateien = [
      { name: '[Content_Types].xml', text: contentTypes },
      { name: '_rels/.rels', text: rels },
      { name: 'xl/workbook.xml', text: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', text: workbookRels },
      { name: 'xl/styles.xml', text: stylesXml },
    ];
    sheetFiles.forEach(function (text, i) { dateien.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: text }); });

    const teile = [];
    const zentral = [];
    let offset = 0;
    dateien.forEach(function (d) {
      const nameB = utf8(d.name);
      const daten = utf8(d.text);
      const crc = crc32(daten);
      const kopf = [
        0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, (crc >>> 24) & 255,
        daten.length & 255, (daten.length >>> 8) & 255, (daten.length >>> 16) & 255, (daten.length >>> 24) & 255,
        daten.length & 255, (daten.length >>> 8) & 255, (daten.length >>> 16) & 255, (daten.length >>> 24) & 255,
        nameB.length & 255, (nameB.length >>> 8) & 255,
        0, 0,
      ];
      teile.push(kopf, nameB, daten);
      zentral.push({
        name: nameB, crc: crc, groesse: daten.length, offset: offset,
      });
      offset += kopf.length + nameB.length + daten.length;
    });
    const cdStart = offset;
    let cdGroesse = 0;
    zentral.forEach(function (z) {
      const eintrag = [
        0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        z.crc & 255, (z.crc >>> 8) & 255, (z.crc >>> 16) & 255, (z.crc >>> 24) & 255,
        z.groesse & 255, (z.groesse >>> 8) & 255, (z.groesse >>> 16) & 255, (z.groesse >>> 24) & 255,
        z.groesse & 255, (z.groesse >>> 8) & 255, (z.groesse >>> 16) & 255, (z.groesse >>> 24) & 255,
        z.name.length & 255, (z.name.length >>> 8) & 255,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        z.offset & 255, (z.offset >>> 8) & 255, (z.offset >>> 16) & 255, (z.offset >>> 24) & 255,
      ];
      teile.push(eintrag, z.name);
      cdGroesse += eintrag.length + z.name.length;
    });
    const eocd = [
      0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0,
      zentral.length & 255, (zentral.length >>> 8) & 255,
      zentral.length & 255, (zentral.length >>> 8) & 255,
      cdGroesse & 255, (cdGroesse >>> 8) & 255, (cdGroesse >>> 16) & 255, (cdGroesse >>> 24) & 255,
      cdStart & 255, (cdStart >>> 8) & 255, (cdStart >>> 16) & 255, (cdStart >>> 24) & 255,
      0, 0,
    ];
    teile.push(eocd);
    const gesamt = [];
    teile.forEach(function (t) { for (let i = 0; i < t.length; i++) gesamt.push(t[i]); });
    return new Uint8Array(gesamt);
  }

  // --------------------------------- Zielgrößen-Löser (Zzr.hlp „Zahlungsstrom berechnen")
  /*
   * Das Original löst neben der Ratenhöhe fünf weitere Zielgrößen (Menü
   * Zahlungsstrom berechnen | …): Ratenanzahl, Zahlungsdatum, Ratenabstand,
   * Dynamik (absolut/prozentual), Stufenzahl. Zzr.hlp „Zielzins zur Berechnung
   * eines Zahlungsstroms": bei stetig veränderlicher Größe (Ratenhöhe, Ratenzahl
   * — GEBROCHEN zulässig! —, Zuwachs, Dynamik) trifft der Löser die Zielvorgabe
   * exakt; bei ganzzahligen Größen (Stufenzahl, Ratenabstand in Monaten,
   * Zahlungsdatum in Tagen) wird die bestmögliche Näherung zurückgegeben.
   * Verifikationsanker aus den Hilfe-Beispielen: BSP_3 Datum → 20.03.2003
   * (Ziel 3 %, erreicht 2,9997 %), BSP_4 Abstand → 36 Monate (Ziel 5 %),
   * BSP_6 Dynamik → 6,46 % (Ziel 5 %).
   */
  // Gerichtete Zielgrößen-Suche: f ist monoton (steigt/fällt — durch Probe bestimmt),
  // null = außerhalb des Gültigkeitsbereichs. Wir wandern vom Basiswert in die Richtung,
  // in der g(x) = gerichtete Distanz zum Ziel (monoton steigend konstruiert) das
  // Vorzeichen wechselt, und bisektieren dort — kontinuierlich oder ganzzahlig
  // (bestmögliche Näherung, Zzr.hlp: „bestmögliche Näherung" bei ganzzahligen Größen).
  function loeseZielgroesse(eff, basis, ziel, schritt0, ganzzahlig, maxSchritte) {
    let fBasis = eff(basis);
    if (fBasis === null) return null;
    const fBasisProbe = eff(basis + (ganzzahlig ? 1 : schritt0 / 8));
    let steigt;
    if (fBasisProbe === null) steigt = true; // verlässliche Richtung nicht testbar — Annahme
    else steigt = fBasisProbe > fBasis;
    const g = function (x) {
      const v = eff(x);
      return v === null ? null : (steigt ? v - ziel : ziel - v);
    };
    let gBasis = g(basis);
    if (gBasis === 0) return basis;
    const richtung = gBasis > 0 ? -1 : 1;
    let vor = basis, gVor = gBasis, schritt = schritt0, guard = 0, x = basis, gx = gBasis;
    while (guard++ < (maxSchritte || 200)) {
      x = vor + richtung * schritt;
      gx = g(x);
      if (gx === null) return null; // Gültigkeitsgrenze ohne Vorzeichenwechsel
      if ((gVor > 0 && gx <= 0) || (gVor < 0 && gx >= 0)) break;
      vor = x; gVor = gx;
      schritt *= ganzzahlig ? 2 : 1.7;
    }
    if (guard > (maxSchritte || 200)) return null;
    let a = Math.min(vor, x), b = Math.max(vor, x);
    if (ganzzahlig) {
      while (b - a > 1) {
        const m = Math.floor((a + b) / 2), gm = g(m);
        if (gm === null) return null;
        if (gm < 0) a = m; else b = m;
      }
      const ga = g(a), gb = g(b);
      const da = ga === null ? Infinity : Math.abs(ga);
      const db = gb === null ? Infinity : Math.abs(gb);
      return da <= db ? a : b;
    }
    for (let it = 0; it < 200; it++) {
      const m = (a + b) / 2, gm = g(m);
      if (gm === null) return null;
      if (gm < 0) a = m; else b = m;
      if (b - a < 1e-12) break;
    }
    return (a + b) / 2;
  }

  function loeseRatenanzahl(proj, stromNr, zielEff, methode, folgeVerschieben) {
    const s = proj.strome[stromNr - 1];
    if (!s) return null;
    const altRaten = s.raten;
    const n = loeseZielgroesse(function (x) {
      if (x <= 0) return null;
      s.raten = x;
      const flows = expandiere(proj);
      let e;
      if (methode === 0) e = effEG(flows); else e = effPAngV(flows);
      s.raten = altRaten;
      return e;
    }, altRaten, zielEff, Math.max(1, Math.round(altRaten * 0.1)), false, 200);
    if (n === null) return null;
    if (folgeVerschieben) {
      // Nachfolge-Ströme mitschieben, damit ihr Abstand zum Wirkungsende erhalten
      // bleibt (Zzr.hlp BSP_2: „ob Sie nachfolgende Zahlungsströme so schieben
      // wollen, da der Abstand … erhalten bleibt")
      const altEnde = addMonths(s.datum, Math.ceil(altRaten - 1e-6) * (s.abstand || 1));
      const neuEnde = addMonths(s.datum, Math.ceil(n - 1e-6) * (s.abstand || 1));
      const deltaMonate = (fromOrdinal(neuEnde).y * 12 + fromOrdinal(neuEnde).m) -
                          (fromOrdinal(altEnde).y * 12 + fromOrdinal(altEnde).m);
      s.raten = n;
      if (deltaMonate !== 0) {
        for (let i = stromNr; i < proj.strome.length; i++) {
          proj.strome[i].datum = addMonths(proj.strome[i].datum, deltaMonate);
        }
      }
    }
    return n;
  }

  function loeseZahlungsdatum(proj, stromNr, zielEff, methode) {
    const s = proj.strome[stromNr - 1];
    if (!s) return null;
    const altDatum = s.datum;
    // Vorwärts in ganzen Tagen (BSP_3: 31.01.2000 → 20.03.2003 bei Ziel 3 % —
    // das Datum wandert nach hinten, der Effektivzins sinkt dabei: f fällt in k)
    const k = loeseZielgroesse(function (x) {
      s.datum = altDatum + x;
      const flows = expandiere(proj);
      let e;
      if (methode === 0) e = effEG(flows); else e = effPAngV(flows);
      s.datum = altDatum;
      return e;
    }, 0, zielEff, 32, true, 200);
    if (k === null) return null;
    return altDatum + k;
  }

  function loeseRatenabstand(proj, stromNr, zielEff, methode) {
    const s = proj.strome[stromNr - 1];
    if (!s) return null;
    const altAbstand = s.abstand;
    // Größerer Abstand schiebt die Raten nach hinten → Effektivzins steigt
    const m = loeseZielgroesse(function (x) {
      s.abstand = x;
      const flows = expandiere(proj);
      let e;
      if (methode === 0) e = effEG(flows); else e = effPAngV(flows);
      s.abstand = altAbstand;
      return e;
    }, altAbstand, zielEff, Math.max(1, Math.round(altAbstand / 4)), true, 200);
    if (m === null) return null;
    return m;
  }

  function loeseDynamik(proj, stromNr, zielEff, methode, art) {
    const s = proj.strome[stromNr - 1];
    if (!s) return null;
    const istProzent = (art !== 'absolut');
    const alt = istProzent ? s.dynamik : s.zuwachs;
    const x = loeseZielgroesse(function (v) {
      if (istProzent) { if (v <= -99.9) return null; s.dynamik = v; }
      else s.zuwachs = v;
      const flows = expandiere(proj);
      let e;
      if (methode === 0) e = effEG(flows); else e = effPAngV(flows);
      if (istProzent) s.dynamik = alt; else s.zuwachs = alt;
      return e;
    }, alt, zielEff, istProzent ? 2 : Math.max(1, Math.abs(s.betrag) / 10), false, 200);
    if (x === null) return null;
    return x;
  }

  function loeseStufenzahl(proj, stromNr, zielEff, methode) {
    const s = proj.strome[stromNr - 1];
    if (!s || (s.stufen || 1) < 1) return null;
    const altStufen = s.stufen;
    const st = loeseZielgroesse(function (x) {
      if (x < 1) return null;
      s.stufen = x;
      const flows = expandiere(proj);
      let e;
      if (methode === 0) e = effEG(flows); else e = effPAngV(flows);
      s.stufen = altStufen;
      return e;
    }, altStufen, zielEff, Math.max(1, Math.round(altStufen / 4)), true, 200);
    if (st === null) return null;
    return st;
  }

  const API = {
    fromOrdinal, toOrdinal, addMonths, addYears, deDate, isLeap, daysInMonth,
    days30360, days365,
    parseZZR, serializeZZR, expandiere,
    effEG, effPAngV, effAibd360, kontoSimulation, kontoAIBD, xlsxExport,
    loeseRatenhoehe, endwert, barwert, effPAngVHeu, jahreActAct,
    laufzeit, zahlungsplan,
    loeseRatenanzahl, loeseZahlungsdatum, loeseRatenabstand, loeseDynamik, loeseStufenzahl
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.ZZR = API;
  return API;
})();
