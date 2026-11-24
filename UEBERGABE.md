# Übergabe ZZR-Neubau (Stand 24.11.2026, ~21:40)

**Kurzstand für den nächsten Kontext:** Alle Kernfunktionen Goldmaster-GRÜN (19 Testblöcke
in tests/test-core.js) — PAngV-alt, EG/AIBD, effPAngVHeu (heutige Rechtslage), End-/Barwert
(beide Methoden), Aktiv-Häkchen-Fix, Raster-Wurzelsuche für alle Kontorichtungen,
EU-Verbraucherinformationsblatt, AGPL + README. **NEU 24.11. abends: Ultimo-Semantik
bewiesen und implementiert, gebrochene Raten, 30/360-Februarregel, Kalender-Bugfix
(Februar = 28 Tage), Löser-BSP_1-Referenzpunkt 1.375,57 DM, Zahlungsplan-Ansicht +
Laufzeit (3 Konventionen), und ALLE 7 Zielgrößen-Löser des Originals (Ratenhöhe,
Ratenanzahl gebrochen, Zahlungsdatum, Ratenabstand, Dynamik %/absolut, Stufenzahl —
BSP_3/4/6-Referenzzahlen aus der Zzr.hlp exakt getroffen).** Orakel-Gegenprobe auf
Dateiebene bestanden (tests/vk1-ultimo-u1.txt, 8 Zeilen ≤ 0,0046 €). Repo sauber, nichts
Blockierendes. **Fortsetzungsbefehl: „Lies /home/ml/zinsrechner/UEBERGABE.md und setze
die Arbeit am ZZR-Neubau fort."** Voller Wissensstand: Memory-MCP #1467 + #1479 (Tags zzr).

## Was steht (alles committet in ~/zinsrechner, lokal, kein Push)

1. **Rechenkern** `core/zzr-core.js` — Goldmaster-GRÜN für BEIDE Methoden:
   - PAngV: EFF −8,814493 % vs. ZZR-Original-Export −8,8145 %; alle 198 Konto-Zeilen ≤ 0,04 €
   - EG/AIBD: EFF −8,806778 % vs. Original-Anzeige −8,8068 % (182 Zeilen ≤ 0,005 €)
   - EG-Methode = Σ CF_k·(1+i)^(-Tage/365) = 0; Vergleichskonto „AIBD": taggenaue
     Zinseszinsrechnung, Kapitalisierung an jedem Zahlungsdatum
   - .zzr-Format (CP1252, CRLF, Delphi-Floats, Tagesnummern ab 1.1.0001)
   - Stufen-Semantik: Raten = Anzahl PRO Stufe; Stufe s = Betrag×(1+Dynamik/100)^s bzw.
     Betrag + s×Zuwachs
   - **ULTIMO (24.11. bewiesen am vk1-Export): erste Zahlung behält ihr Datum; Folgeraten
     mit Ultimo=1 auf den LETZTEN Kalendertag ihres Monats (Ankermonat + n·Abstand),
     mit Ultimo=0 auf den Ankertag (an kurzen Monaten gekappt).** Beleg: Zzr.hlp
     („…erfolgen die weiteren Ratenzahlungen zum 31.3., 30.4., usw. … im anderen Fall
     mit dem 28. des Monats") + Original-Konto-Export vk1.txt (30.11. bleibt; 31.12.,
     31.01., 29.02., 31.03., 30.04.)
   - **GEBROCHENE Raten** (Zzr.hlp: „2,5 mal DM 100 → beim dritten mal nur DM 50"):
     Schlußrate trägt den Bruchteil; parseZZR rundet nicht mehr
   - **30/360-Februar-Regel** (Zzr.hlp: „bei Vergleichskonto PAngV oder AIBD360 würde
     mit dem 30.2. usw. gerechnet"): Februar-Ende (28./29.) zählt als 30. Die
     Zweitgrenzen-Seite (d2) ist über die Hilfestellung mit abgedeckt, aber nur am
     Hilfetext (nicht am Konto-Orakel) belegt — siehe Offene Punkte
   - **Kalender-Bugfix**: daysInMonth lieferte Gemeinjahr-Februar = 31 → addMonths
     erzeugte „31.2.", das still als 3.3. weiterlief. Nutzer-Kredit-Fall dadurch
     korrigiert: 3,415658 % (war 3,413993 % mit Überlauf-Datum; jetzt dicht an AIBD)
   - **Löser**: Ratenhöhe bei Zielzins; Bracket wird geometrisch erweitert (BSP_1:
     Nennbetrag 1 DM, Lösung ≈ 1375). **Neuer Referenzpunkt aus der Original-Hilfe:
     BSP_1-DM-Variante (−200.000 DM, 180×1 DM, +50.000 DM, Ziel 5 %, PAngV) →
     Original „DM 1.375,57", Kern 1375,57** — exakt
   - **zahlungsplan(proj)**: alle Einzelzahlungen (Nr., Datum, Betrag, Strom, Notiz) +
     Summen + erste/letzte Zahlung — das, was das Original „bei der Vorbereitung"
     aufstellt (Fehlerdialog „Es kann kein Zahlungsplan erstellt werden…", wenn keine
     Nullstelle existiert)
   - **laufzeit(d1, d2, methode)**: PAngV im 30/360-Kalendarium („Die Laufzeitbestimmung
     erfolgt mittels eines 30/360-Tage-Kalendariums" — ZA-Bericht), AIBD im echten
     Kalender. Am Original verifiziert: 31.10.1999→30.04.2000 = PAngV „6 Monaten,
     0 Tagen" / AIBD „5 Monaten, 30 Tagen"
2. **HTML-Bedienerfläche** `dist/zinsrechner.html` (Einzeldatei, offline, druckbar):
   Zahlungsstrom-Tabelle, EFF (3 Methoden), Vergleichskonto (AIBD- UND PAngV-Ansicht),
   **Zahlungsplan-Sektion (NEU)**: alle Zahlungen einzeln mit Datum, kumulierter Summe,
   Summenzeile Ein-/Auszahlungen, Laufzeitleiste — druckfähig. Zielzins-Löser,
   End-/Barwert-Feld, .zzr Laden/Speichern, Drucken, Verbraucherinformationsblatt,
   Methoden-Erklärbox mit Quellenfußnoten. Bau: `node webapp/build.js`
3. **Tests** `tests/test-core.js` — 18 Blöcke grün. Referenzen: `tests/goldmaster-konto.json`
   (198 PAngV-Zeilen), `tests/goldmaster-konto-m0.txt` (182 AIBD-Zeilen),
   **`tests/vk1-ultimo-u1.txt` (NEU: Original-AIBD-Konto der Ultimo-Probe, 8 Zeilen,
   EFF 0,7430 % = Kern exakt, max Δ 0,0046 €)**. Lauf: `node tests/test-core.js`

## Orakel-Erkenntnisse 24.11. abends (Nutzer gab den :10-Desktop frei)

- **Probe ultimo-u1** (−10.000 @31.10.1999; +106×6 @30.11.1999 Ultimo=1; +9.400 @30.04.2000):
  - PAngV-Ansicht des Originals: Rendite **0,7356 %** angezeigt, eigener ZA-Bericht
    **0,7396 %** = Kern exakt. Die ERGEBNIS-Ansicht zeigt offenbar einen iterativ
    gerundeten Wert — maßgeblich sind ZA-Bericht (0,7396) und Konto-Header (0,7430),
    beide = Kern exakt
  - **PAngV-View zeigt Daten durch die 30/360-Linse: 31.10.1999 erscheint als
    „30.10.1999"** — kein Datums-Bug des Nachbaus, sondern Anzeige-Normalisierung
    (Tag 31 → 30), gleiches Prinzip wie „mit dem 30.2. gerechnet"
  - AIBD-Ansicht: **0,7420 %** angezeigt, AIBD-Konto-Header **0,7430 %** = Kern exakt
  - **Vergleichskonto AIBD exportiert als tests/vk1-ultimo-u1.txt** — Valuta-Daten
    beweisen die Ultimo-Kette Zeile für Zeile
  - Dropdown „Vergleichskonto" kennt **4 Varianten: PAngV (alt), AIBD (ISMA), AIBD 360,
    PAngV 2000** — die letzten beiden sind im Nachbau NICHT implementiert
- **barwerte.txt / endwerte.txt** (im Repo-Verzeichnis erschienen, 20:39, je 8,3 KB,
  identische Größe): vom Original automatisch geschriebene Wertetabellen — x = −50…+50
  (101 Zeilen), y glatt −9.240,3 … −9.455,0 (Delphi-Floats). Deutung offen (Verdacht:
  Sensitivitätstabelle der Ergebnis-Vorbereitung). Dateien liegen untracked im Repo —
  identifizieren, dann als Referenz committen oder verwerfen
- **Zwischenablage-Route**: Knopf „Analyse in ZA kopieren" legt den vollständigen
  Analysebericht als Text in die Zwischenablage (xclip -display :10 auslesbar) —
  praktische Orakel-Route ohne Datei-Dialog
- „Analyse ausdrucken" druckt SOFORT an den Standarddrucker (kein Vorschau-Dialog!) —
  bei Orakel-Läufen NICHT anklicken oder vorher den Drucker abwählen

## Wissen (NICHT nochmal ableiten!)

Memory-MCP **#1467** + neue Notiz (Tags zzr, zinsrechner): Dateiformat, Semantik,
Methoden-Mapping (EZ-Methode 1 = „PAngV (alt)", 0 = „AIBD"), EFF-Rezepte, Wine-Orakel-
Route, xdriver/Keysym-Fallen. **NEU**: Zzr.hlp des Originals ist lesbar via
`strings ~/zzr-analyse/ZZR/Zzr.hlp > ~/zzr-analyse/hlp-strings.txt` (3393 Zeilen, der
Löser-/Dialog-/Beispiel-Stoff liegt dort fast vollständig im Klartext); Original-Beispiele
bsp_1–11.zzr in ~/zzr-analyse/ZZR/. RE-Artefakte: ~/zzr-analyse (chmod 700, NIE
committen). HINWEIS xdriver: AltGr-Backslash kommt unter Wine als „ß" an — kurze NAMEN
im Speichern-Dialog tippen (Dialog steht im Home). Wine-Fenster springen beim Fokus-
Erhalt zur INI-Position (Zzr.ini [Lage]); nach jedem verschiebe FOTO kontrollieren.
Menü-Popups sind eigene X-Fenster → Vollbild-Schnapp (`import -window root`) statt
fensterfoto. MDI-Struktur: Hauptfenster „Zuckers Zins Rechner" + Kinder
(Beschreibung „ultimo-u1", „Vergleichskonto: …"); Fenster-Menü wechselt zwischen ihnen.

## Offene Punkte

1. ~~Ultimo-Detail~~ **ERLEDIGT 24.11. abends** (bewiesen + implementiert + Orakel-Gegenprobe)
2. **Barwerte/endwerte-Tabellen deuten** (siehe oben; Dateien liegen untracked im Repo)
3. **Ergebnis-View vs. Konto-EFF**: Original zeigt in der Ansicht 0,7356/0,7420, im
   ZA-Bericht/Konto 0,7396/0,7430 (= Kern). Ursache der Ansicht-Abweichung ungeklärt
   (Verdacht: iterative Rundung) — für den Nachbau irrelevant, aber dokumentierenswert
4. **AIBD 360 und PAngV 2000** (die anderen zwei Konto-Varianten des Originals) nicht
   implementiert — Rezepte unbekannt (AIBD360 vermutlich act/360-Tageskonto; PAngV 2000
   vermutlich die Novelle-2000-Vorschriften); per Orakel messbar, wenn gewünscht
5. **30/360-Februar-Regel, Zweitgrenzen-Seite**: die Hilfe belegt den Fall „Datum ist
   Februar-Ende" (d1→30); dass auch eine Zweitgrenze am Februar-Ende als 30 rechnet,
   folgt aus derselben Formulierung, ist aber nicht separat orakelt (Probe mit
   31.01.→29.02.-Zinszeile wäre der Beweis)
6. **Ultimo=0-Zweig und gebrochene Raten**: im Hilfetext eindeutig dokumentiert und
   implementiert, aber nicht separat per Orakel gefahren (Proben probe-ultimo-u3 /
   probe-bruch-u2 liegen bereit; Ablauf wie bei u1)
7. ~~**5 weitere Löser des Originals**~~ **ERLEDIGT 24.11. ~21:40 (Commit fce6e25)**:
   Ratenanzahl (exakt, gebrochen — letzte Rate trägt den Bruchteil; optional Folgestrom-
   Verschiebung wie BSP_2), Zahlungsdatum (Tage-Näherung, BSP_3 → 20.03.2003/2,9997 %
   exakt), Ratenabstand (Monats-Näherung, BSP_4 → 36 exakt), Dynamik absolut/prozentual
   (exakt, BSP_6 → 6,46 % exakt), Stufenzahl (Näherung). Einheitlicher Sucher
   `loeseZielgroesse` (gerichtete Wanderung + Bisektion; null = Gültigkeitsbereichsende).
   Fläche: Zielgrößen-Auswahl (7 Einträge), „Folge-Ströme mitschieben"-Kästchen,
   Ergebnisse werden wie im Original in den Strom eingetragen. `laufzeit(d1,d2,2)` =
   heutige Zählung (Remark C); Zahlungsplan-Kopf zeigt sie zusätzlich an. Nicht gebaut
   aus dem Original-Umfang: Steuer-Berechnungen, Bausparkassen-Simulation, BSB-Benchmark,
   „Analyse in ZA kopieren" (Zwischenablage-Text), Taschenrechner-Button, Datei-Anhänge.
8. **Interpolationszins** (BaFin-Merkblatt, mehrere Sollzinssätze) — offen wie gehabt
9. **Vollständiges EU-Formular** (Anhang I der finalen CCD2 statt COM(2021)347-Entwurf) — offen
10. **Feinschliff Rundung**: ±0,04 € PAngV-Rauschen (Monatsrhythmus ab Jahr 2) — akzeptiert

## Lizenz / Veröffentlichung

- **LICENSE** = AGPL-3.0-or-later; **README.md** (© 2026 Michael Logies, KI-unterstützt:
  Qwen Code / GLM-5.3-Flash); Lizenz-Fußnote in der Fläche. Veröffentlichung freigegeben
  (Urheberrecht gut vertretbar, Clean-Room; s. auto-memory zzr-veroeffentlichung).
  Veröffentlichungs-Vorabprüfung: keine lokalen Pfade/IPs/Keys im Dist ✓ — nach jedem
  Rebuild erneut prüfen

## Befehle

- Tests: `node ~/zinsrechner/tests/test-core.js`
- HTML bauen: `node ~/zinsrechner/webapp/build.js` → `~/zinsrechner/dist/zinsrechner.html`
  (danach eingebettete Skripte per node --check bzw. vm.Script prüfen!)
- Wine-Orakel:
  `DISPLAY=:10.0 WINEPREFIX=$HOME/.wine-zzr ~/opt/wine-10.0-amd64-wow64/bin/wine 'C:\Program Files (x86)\ZZR\Zzr.exe' 'Z:\home\ml\zinsrechner\<datei>.zzr'`
  (lizenziert; xdriver.py liste/klick/tippe/taste/verschiebe/fensterfoto; Fenster-
  Sprung zur INI-Position beachten; Analysekette: Ergebnisse-Lasche → Vergleichskonto
  erstellen → Datei►Speichern unter → kurzer Name → landet in Z:\home\ml)
- Desktop-Starter: ~/Schreibtisch/zinsrechner.desktop
