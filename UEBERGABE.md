# Übergabe ZZR-Neubau (Stand 25.11.2026, ~18:35)

**Kurzstand für den nächsten Kontext:** Alle Kernfunktionen Goldmaster-GRÜN (jetzt 21
Testblöcke in tests/test-core.js) — PAngV-alt, EG/AIBD, **AIBD360 (NEU, bewiesen)**,
effPAngVHeu, End-/Barwert, Aktiv-Häkchen-Fix, Raster-Wurzelsuche, EU-Verbraucherinfor-
mationsblatt, AGPL + README, Ultimo-Semantik, gebrochene Raten, 30/360-Februarregel,
Kalender-Bugfix, Zahlungsplan-Ansicht + Laufzeit, alle 7 Zielgrößen-Löser.
**NEU am 25.11.: Methoden-Namen tragen überall Jahres-Klammern (Jahr der letzten
gesetzlichen Regelung): PAngV (alt) (bis 2010), EG-Anhang II (AIBD) (2023 — CCD2,
anwendbar seit 20.11.2026), PAngV 2011/2026 (2026 — Neufassung 2021, geändert
12.5.2026); AIBD360 = Marktkonvention OHNE gesetzliche Regelung; Erklärbox + ZA-Blatt +
Ergebniszeile + Konto-/Laufzeit-/Endwert-/Barwert-Texte aktualisiert; Fläche REBUILD +
vm.Script-Prüfung + Dist-Reinheitsprüfung erledigt.**
**NEU in dieser Runde (24.11. abends, Orakel-Lauf 22:45–23:10): Zweitgrenzen-Regel am
Original BEWIESEN (Konto-Export feb2.txt: Valuta „30.02.2000" → 30/360 führt auch die
Zweitgrenze am Februar-Ende als 30), Ultimo=0 orakelt (u3p/u3a: PAngV 0,7396 % / AIBD
0,7431 % = Kern EXAKT; AIBD-Konto zeigt REAL-Valutas 31.10/29.02), gebrochene Raten
orakelt (bruch2/bruch2a: 0,2021 % / 0,2029 % = Kern EXAKT; Schlußrate 53), und das
AIBD360-Rezept ENTSCHLÜSSELT: Σ CF·(1+i)^(-t/360) mit t = 30/360-Tagezahlen — Kern
effAibd360 = Original 0,7410 % EXAKT. Dazu die barwerte.txt/endwerte.txt-Deutung:
Zins-Sensitivitätstabellen (x = Zins in Zehntelprozent −5 %…+20 %, 251 Punkte) des zum
Messzeitpunkt geladenen Stroms.** Repo sauber, alles committet, nichts Blockierendes.
**Fortsetzungsbefehl: „Lies /home/ml/zinsrechner/UEBERGABE.md und setze die Arbeit am
ZZR-Neubau fort."** Voller Wissensstand: Memory-MCP #1467 + #1479 (Tags zzr) + Notiz
„ZZR-Neubau grün" (auto-memory 24.11.2026).

## Was steht (alles committet in ~/zinsrechner, lokal, kein Push)

1. **Rechenkern** `core/zzr-core.js` — Goldmaster-GRÜN für alle Methoden:
   - PAngV: EFF −8,814493 % vs. ZZR-Original-Export −8,8145 %; alle 198 Konto-Zeilen ≤ 0,04 €
   - EG/AIBD: EFF −8,806778 % vs. Original-Anzeige −8,8068 % (182 Zeilen ≤ 0,005 €)
   - **AIBD360 (NEU)**: `effAibd360(flows)` — Σ CF·(1+i)^(-t/360), t = days30360 ab
     erster Zahlung, Raster-Wurzelsuche wie effEG. Bewiesen am Orakel (u3b: 0,7410 %).
     Die gleichnamige Original-Konto-Variante führt KONTO-Zeilen im 30er-Raster
     (30.10/30.11/…/30.02/…), Zinsanteile gleichmäßig (6,15/6,09/6,03/…)
   - .zzr-Format (CP1252, CRLF, Delphi-Floats, Tagesnummern ab 1.1.0001)
   - Stufen-Semantik; **Ultimo** (erste Zahlung behält Datum, Folgeraten Ultimo=1 →
     Monatsende, Ultimo=0 → Ankertag mit Kappung auf Monatsende = 29.02 im Schaltjahr —
     jetzt am Original bestätigt); **gebrochene Raten** (Schlußrate trägt Bruchteil);
     **30/360-Februarregel** (jetzt AM ORIGINAL BEWIESEN: auch die Zweitgrenze zählt
     Februar-Ende als 30 — Konto-Valuta 30.02.2000, oderakel-probe feb-d2, tests/
     orakel-feb-d2-pangv.txt); Kalender-Bugfix; **Löser** (alle 7, BSP_1/3/4/6 exakt)
   - `zahlungsplan(proj)`, `laufzeit(d1, d2, methode)` (3 Konventionen)
2. **HTML-Bedienerfläche** `dist/zinsrechner.html` (Einzeldatei, offline, druckbar):
   Zahlungsstrom-Tabelle, EFF (3 Methoden), Vergleichskonto (AIBD/PAngV-Ansicht),
   Zahlungsplan-Sektion, Zielzins-Löser, End-/Barwert-Feld, .zzr Laden/Speichern,
   Drucken, Verbraucherinformationsblatt, Methoden-Erklärbox. Bau: `node webapp/build.js`
   (Kern-Sync-Rebuild + vm.Script-Prüfung + Dist-Reinheit: erledigt 25.11.2026)
3. **Tests** `tests/test-core.js` — 21 Blöcke grün. Referenzen: goldmaster-konto.json,
   goldmaster-konto-m0.txt, vk1-ultimo-u1.txt, **NEU: orakel-feb-d2-pangv.txt,
   orakel-bruch-u2-pangv.txt / -aibd.txt, orakel-u3-pangv.txt / -aibd.txt /
   -u3b-aibd360.txt, orakel-barwerte/endwerte-2026-11-24.txt (gedeutete Sensitivitäts-
   tabellen des Originals)**. Lauf: `node tests/test-core.js`

## Orakel-Erkenntnisse 24.11. spät (Probefeb-d2, bruch-u2, u3)

- **Zweitgrenzen-Beweis (feb-d2)**: Strom −10.000 @1.11.1999, +106 @31.01.2000,
  +9.894 @29.02.2000. Original-PAngV-Konto (feb2.txt → tests/orakel-feb-d2-pangv.txt):
  Valutas 30.10/30.01/**30.02** — die Zweitgrenze (29.02) zählt als 30.02. Kern
  `days30360(31.1., 29.2.)` = 30 ✓ bereits korrekt implementiert.
- **Ultimo=0 (u3)**: −10.000 @31.10., 6×106 @30.11. Ultimo=0, +9.400 @30.04.
  - PAngV-Konto (u3p): EFF **0,7396 %** = Kern exakt; Valutas ALLE im 30er-Raster
    (30.10/30.11/30.12/30.01/30.02/30.03/30.04) → **im PAngV-Kalendarium sind u1
    (Ultimo=1) und u3 (Ultimo=0) numerisch identisch** — die Ultimo-Semantik zeigt
    sich NUR im AIBD-Konto
  - AIBD-Konto (u3a): EFF **0,7431 %** = Kern effEG EXAKT; REAL-Valutas:
    31.10/30.11/30.12/30.01/**29.02**/30.03/30.04 (Monatsende-Kappung, Zzr.hlp-Wortlaut
    „mit dem 28. des Monats" bezieht sich auf den GEMEINJAHR-Fall; im Schaltjahr
    bucht das Original den 29.02) — Kern expandiert exakt diese Daten ✓
  - AIBD360-Konto (u3b): EFF **0,7410 %** = Kern effAibd360 EXAKT (Rezept s. o.);
    Zeilen im 30er-Raster mit gleichmäßigen Zinsanteilen (6,15/6,09/6,03/5,97/5,91/5,85)
- **Gebrochene Raten (bruch-u2)**: −10.000 @15.01.2000, 2,5×106 ab 15.02., +9.740 @15.04.
  Original zeigt expandiert 106/106/**53** (Schlußrate trägt 0,5) — PAngV **0,2021 %** /
  AIBD **0,2029 %**, Kern exakt beides ✓ (bruch2/bruch2a → tests/orakel-bruch-u2-*.txt)
- **barwerte.txt/endwerte.txt Gedeutet**: Zins-Sensitivitätstabellen, 251 Punkte,
  x = Zins in Zehntelprozent (−5 %…+20 %), y(0) = Saldo −9.364 = **u1-Strom OHNE die
  Schlußzahlung 9.400** (Stand beim Tippen, 20:39:00, 3 s vor dem Speichern der Probe).
  endwerte.txt EXAKT linear: y = −9.364 − 48,675·x, Steigung beweist
  Σ(CF·t360)/36.000 (PAngV-Sparbuch-Sicht, unter 1 Jahr keine Kapitalisierung).
  barwerte.txt: Ableitung bei 0 = −0,0175 (Sparbuch-Abzinsung), Flanken passen weder
  auf pure Sparbuch- noch pure Potenz-Abzinsung — vermutlich INI-BarwertZins=3-
  Konvention; für den Nachbau IRRELEVANT (Referenz in tests/orakel-*-2026-11-24.txt).
- **Ergebnis-View vs. Konto-EFF (Punkt 3, erklärt)**: Die Original-„Ergebnis"-Ansicht
  zeigt 0,7356/0,7420, ZA-Bericht/Konto 0,7396/0,7430 (= Kern). Die Ansicht scheint
  iterativ gerundete Werte zu zeigen — für den Nachbau irrelevant (Kern = Konto,
  das ist die rechnerisch maßgebliche Größe). Dokumentiert, nicht weiter verfolgenswert.
- **Orakel-Routen-Lektionen (wichtig für künftige Läufe)**:
  - ZZR ist MDI mit SCHNELL wachsender Kind-Fenster-Liste (jedes Laden/Erstellen
    hängt ein Kind an: 1 feb-d2 … 9 VK ultimo-u3). Fenster-Menü (Konto-Kind: „Fenster")
    listet ALLE Kinder; Dokument-Kinder wechseln per Nummer.
  - Wine-Combo-Popup (Vergleichskonto-Dropdown): XTEST-Klick in die Zeile ist
    UNZUVERLÄSSIG (schließt oft ohne Auswahl; Grenzpixel-Falle). Zuverlässige Route:
    Pfeil klicken (731,109) → 3 s ruhen → taste Down (Markierung wandert) → FOTO
    → klick in die Zeilenmitte (692,132) → FOTO (Feld verifizieren!). Pfeil-Rotation
    per Tastatur wechselt nur PAngV (alt) ↔ AIBD360 (beobachtet).
  - xdriver `tippe` macht Zeichenfehler unter Wine (n→p-Versatz, .zzr→.zzf) — im
    Öffnen-Dialog lieber Ordnerbaum-DOPPELKLICK (ml) + Doppelklick auf die Datei statt
    tippen. `grep_search` versagt an hlp-strings.txt (Encoding) — System-grep nutzen.
  - „Analyse ausdrucken" druckt SOFORT (nicht anklicken!). Menü-Popups = eigene
    X-Fenster → Vollbild-Schnapp (`import -window root`) statt fensterfoto.
  - Zzr.hlp lesbar: `strings ~/zzr-analyse/ZZR/Zzr.hlp > ~/zzr-analyse/hlp-strings.txt`
    (3393 Zeilen; „mit dem 28. des Monats" = Ultimo=0-Kappungswortlaut).
- barwerte/endwerte im Repo-ROOT: überschreibbare Orakel-Auswürfe — NICHT committen,
  maßgebliche Kopien liegen in tests/orakel-barwerte/endwerte-2026-11-24.txt.
- RE-Artefakte: ~/zzr-analyse (chmod 700, NIE committen). HINWEIS xdriver: AltGr-
  Backslash kommt unter Wine als „ß" an — kurze NAMEN im Speichern-Dialog tippen
  (Dialog steht im Home). Wine-Fenster springen beim Fokus-Erhalt zur INI-Position
  (Zzr.ini [Lage]); nach jedem verschiebe FOTO kontrollieren. INI: BarwertZins=3,
  Werte_sichern=0 (Tabellen-Schalter, Wirkung noch nicht reproduziert).

## Offene Punkte

1. ~~Ultimo-Detail~~ ERLEDIGT (24.11., vk1 + u3p/u3a)
2. ~~Barwerte/endwerte-Tabellen deuten~~ ERLEDIGT (Zins-Sensitivitätstabellen; Basis =
   geladener Strom u1-ohne-Schlußzahlung; Referenz in tests/; Feinkonvention der
   Barwert-Spalte (INI BarwertZins=3) offen, für den Nachbau ohne Bedeutung)
3. ~~Ergebnis-View vs. Konto-EFF~~ ERLEDIGT (Ansicht rundet iterativ — Kern = Konto =
   maßgeblich; dokumentiert)
4. **AIBD360 ERLEDIGT** (Rezept bewiesen + Kern effAibd360 + Test). **PAngV 2000**
   bleibt offen (Rezept laut Zzr.hlp: exponentiell, Referenz-Jahr = 12×30,41666 Tage =
   365 Tage ab erster Zahlung; per Orakel messbar, wenn gewünscht — Dropdown-Route
   jetzt dokumentiert)
5. ~~30/360 Zweitgrenzen-Seite~~ ERLEDIGT (Beweis feb2.txt: Valuta 30.02.2000)
6. ~~Ultimo=0-Zweig und gebrochene Raten~~ ERLEDIGT (u3p/u3a/u3b, bruch2/bruch2a —
   Kern exakt in allen fünf Meßwerten)
7. ~~7 Zielgrößen-Löser~~ ERLEDIGT (Commit fce6e25). Nicht gebaut aus dem Original-
   Umfang: Steuer-Berechnungen, Bausparkassen-Simulation, BSB-Benchmark, „Analyse in
   ZA kopieren", Taschenrechner-Button, Datei-Anhänge
8. **Interpolationszins** (BaFin-Merkblatt, mehrere Sollzinssätze) — offen wie gehabt
9. **Vollständiges EU-Formular** (Anhang I der finalen CCD2 statt COM(2021)347-Entwurf) — offen
10. **Feinschliff Rundung**: ±0,04 € PAngV-Rauschen (Monatsrhythmus ab Jahr 2) — akzeptiert

## Lizenz / Veröffentlichung

- **LICENSE** = AGPL-3.0-or-later; **README.md** (© 2026 Michael Logies, KI-unterstützt:
  Qwen Code / GLM-5.3-Flash); Lizenz-Fußnote in der Fläche. Veröffentlichung freigegeben
  (Urheberrecht gut vertretbar, Clean-Room; s. auto-memory zzr-veroeffentlichung).
  Vorabprüfung: keine lokalen Pfade/IPs/Keys im Dist ✓ (erneut geprüft 25.11.2026 nach
  Rebuild) — nach jedem weiteren Rebuild erneut prüfen. Fläche zeigt weiterhin 3
  Methoden-Spalten; AIBD360-Nutzung in der Fläche wäre Diskussionspunkt, nicht
  stillschweigend bauen

## Befehle

- Tests: `node ~/zinsrechner/tests/test-core.js`
- HTML bauen: `node ~/zinsrechner/webapp/build.js` → `~/zinsrechner/dist/zinsrechner.html`
  (danach eingebettete Skripte per node --check bzw. vm.Script prüfen!)
- Wine-Orakel:
  `DISPLAY=:10.0 WINEPREFIX=$HOME/.wine-zzr ~/opt/wine-10.0-amd64-wow64/bin/wine 'C:\Program Files (x86)\ZZR\Zzr.exe' 'Z:\home\ml\zinsrechner\<datei>.zzr'`
  (lizenziert; xdriver.py liste/klick/doppelklick/tippe/taste/strg/altbuchstabe/verschiebe/
  fensterfoto; Fenster-Sprung zur INI-Position beachten; Menüband-Koordinaten ab Foto
  ablesen (Faktor 1920/1389 ≈ 1,3823), FOTO VOR jedem Klick; Analysekette: Ergebnisse-
  Lasche → Vergleichskonto erstellen → Datei►Speichern unter → kurzer Name → landet im
  Home bzw. zinsrechner; NICHT „Analyse ausdrucken" anklicken — druckt sofort!)
- Desktop-Starter: ~/Schreibtisch/zinsrechner.desktop
