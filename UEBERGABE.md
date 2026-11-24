# Übergabe ZZR-Neubau (Stand 24.11.2026, nach AIBD-Kalibrierung)

## Was steht (alles committet in ~/zinsrechner, lokal, kein Remote)

1. **Rechenkern** `core/zzr-core.js` — Goldmaster-GRÜN für BEIDE Methoden:
   - PAngV: EFF −8,814493 % vs. ZZR-Original-Export −8,8145 %; alle 198 Konto-Zeilen ≤ 0,04 €
   - EG/AIBD: EFF −8,806778 % vs. Original-Anzeige −8,8068 % (konto-m0-Export,
     24.11.2026 unter Wine neu geholt — die frühere Notiz „−8,0608/ABD/EFH" war ein
     Übertragungsfehler; richtig: **AIBD = Anhang II EG-Konsumentenkredit, −8,8068 %**)
   - **EG-Methode geklärt & bewiesen** (182/182 Original-Zeilen ≤ 0,005 €):
     * Effektivzins = SUMME CF_k·(1+i)^(-t_k) = 0 mit t = Tage/365, effektive Verzinsung
     * Vergleichskonto „AIBD": Zins je Buchung = saldo·((1+EFF)^(Tage/365)−1),
       Kapitalisierung an jedem Zahlungsdatum, Tilgung saldo = Betrag + Zins,
       Restsaldo endet exakt 0 (Rekursion ≡ EG-Gleichung)
   - .zzr-Format lesen/schreiben (CP1252, CRLF, Delphi-Floats, Tagesnummern ab 1.1.0001)
   - Stufen-Semantik (live unter Wine vermessen): Raten = Anzahl PRO Stufe;
     Stufe s = Betrag×(1+Dynamik/100)^s bzw. Betrag + s×Zuwachs (Dynamik-Feld = PROZENT-Zahl,
     Zuwachs = absolut mit Vorzeichen)
   - Löser: Ratenhöhe bei Zielzins (geometrische Bisektion)
2. **HTML-Bedienerfläche** `dist/zinsrechner.html` (Einzeldatei, offline, druckbar):
   Zahlungsstrom-Tabelle editierbar, EFF beide Methoden, Vergleichskonto (PAngV- UND
   AIBD-Ansicht je nach EZ-Methode), Zielzins-Löser, .zzr Laden/Speichern, Drucken.
   Bau: `node webapp/build.js` (bettet core ein — core/zzr-core.js bleibt EINZIGE
   Quelle der Wahrheit).
3. **Tests** `tests/test-core.js` + Goldmaster-Referenzen (`goldmaster-konto.json`
   198 PAngV-Zeilen, `goldmaster-konto-m0.txt` 182 AIBD-Zeilen). Laufen mit:
   `node tests/test-core.js`

## Wissen (NICHT nochmal ableiten!)

Memory-MCP **#1467** (Tags zzr,zinsrechner,wine,...) hat ALLES: Dateiformat, Semantik,
Methoden-Mapping (EZ-Methode 1 = „PAngV (alt)", 0 = „AIBD" = EG-Anhang II/ISMA),
beide EFF-Rezepte, Wine-Orakel-Route, xdriver/Keysym-Fallen. RE-Artefakte:
~/zzr-analyse (chmod 700, NIE committen; dort auch konto-m0.txt = Original-Export
der Methode 0). HINWEIS xdriver: AltGr-Backslash kommt unter Wine als „ß" an — im
Speichern-Dialog daher kurzen NAMEN tippen (Dialog steht im Home) statt Pfad.

## Offene Punkte

1. ~~EG-Methode kalibrieren~~ **ERLEDIGT 24.11.2026** (siehe oben; AIBD-Export
   unter Wine über Datei►Speichern unter… geholt).
2. **Ultimo-Detail**: Feld vorhanden, Semantik nur für Löser relevant — unaufgeklärt.
3. ~~**Barwerte/Endwerte-Blätter**~~ **GEMESSEN UND IMPLEMENTIERT 24.11.2026** (Original-Dialoglogik:
   Analyse►Endwert-/Barwertberechnung►der Ein- & Auszahlungen → Stichtag-Dialog → Zinssatz-Dialog → Info-Box):
   - **Endwert(Stichtag 01.01.2015, 55 %) = 73.303.508,71 € = Endsaldo des PAngV-Vergleichskontos
     mit dem frei gewählten Zins** — Kern `endwert()` EXAKT (Δ 0,00 €).
   - **Barwert(Stichtag 01.01.2000, 55 %) = 102.208,33 €** = vergangene Zahlungen zum Nennwert +
     künftige abgezinst mit (1+r)^(−Tage30/360/360) — Kern `barwert()` Δ 0,15 €.
   - **ZWEITMESSUNG 24.11. (Zins 10 %): Barwert = 96.091,06 €** — Kern 30/360 Δ −1,67 €;
     act/365.25 praktisch gleichauf (−1,28 €); act/365 (+4,73 €) und act/360 (+125 €) AUSGESCHLOSSEN.
     Struktur bei beiden Zinssätzen bestätigt; Residual < 0,002 % = programminterne Cent-Rundung.
     Beide Messpunkte im Test verankert (Toleranz 0,5/2 €).
   - HTML-Fläche: Feld Stichtag/Zins + Endwert-/Barwert-Knopf (Berechnung-Gruppe).
   - HINWEIS Orakel: Zinssatz-Dialog ist mit „5“ vorbelegt — Eingaben APPENDEN (unser „5“→„55“-
     Vorfall); Feld vor dem Tippen leeren (End+Backspace). Nach Stichtag-OK fragt ein ZWEITER
     Dialog (Verzinsung) nach dem Zins — nicht wundern. Ergebnis = Info-Box (Fenster läuft
     aus dem Bild, per xdriver holen).
4. **Feinschliff Rundung**: Live-Wine-Konto akkumuliert ab Jahr 2 mit Monatsrhythmus
   statt Tageszählung (vs. Goldmaster) — ±0,04 € Rauschen in PAngV-Tests akzeptiert;
   wer Pixelparität will, muss die Original-Kumulierung nochmal verifizieren.
   (AIBD-Konto: keine Abweichung — max 0,005 € = reine Anzeigerundung.)
5. **AIBD-Abhängigkeit von End-/Barwert — GEMESSEN UND IMPLEMENTIERT 24.11.2026**:
   Das Original rechnet End-/Barwert MIT der EZ-Methode der Datei:
   - Methode 1 (PAngV): Endwert = PAngV-Konto-Endsaldo (73.303.508,71 € @55 %);
     Barwert = 30/360-Abzinsung (102.208,33 € @55 %)
   - Methode 0 (AIBD): Endwert = AIBD-Tageskonto-Endsaldo (**73.721.200,13 € @55 % —
     Kern kontoAIBD EXAKT, Δ 0,00**); Barwert = act/365-Abzinsung (102.208,70 € @55 %;
     Kern 102.208,66, Δ 0,04)
   - Kern: `endwert`/`barwert` nehmen Methode-Parameter; HTML übergibt `proj.methode`.
6. **Rechtsstand-Recherche 24.11.2026 (Nutzerfrage)**: Die vom ZZR zitierten Vorgaben
   sind veraltet — die EG-Richtlinie (ABl. C155/9 v. 23.06.1989) lief über 98/7/EG und
   2008/48/EG (Verbraucherkreditrichtlinie; neue Gesamtkreditkosten-Formel, Deutschland
   PAngV 2010/2011, internem Zinsfuß schon seit ~2000) zur Richtlinie (EU) 2023/2225
   (CCD2, anwendbar seit 20.11.2026); die deutsche PAngV: Neufassung 12.11.2021 (Kraft
   28.05.2022), letzte Änderung Art. 8 G v. 12.5.2026 (Kraft 20.11.2026 = CCD2-
   Anwendungsdatum). Aktuelle Formel (Anlage zu § 16 PAngV): Σ C_k(1+X)^(-t_k) =
   Σ D_l(1+X)^(-s_l) mit t in Jahren = Tage/365 (Schaltjahr 366) — act/act. Die
   Vergleichskonto-Methode des ZZR ist seit 2010/2011 aufgehoben; als historische
   Methode im Rechner behalten. **Nicht umgesetzt (Vorschlag): `effPAngVHeu` — die
   heutige Effektivzinsformel als dritte Methode (act/act-Variante von effEG);
   Verifizierung gegen die amtlichen Kommissions-Rechenbeispiele (ABl. C 127/2,
   4.5.2012) und evtl. Interpolationszins (BaFin-Merkblatt, mehrere Sollzinssätze).**

## Befehle

- Tests: `node ~/zinsrechner/tests/test-core.js`
- HTML bauen: `node ~/zinsrechner/webapp/build.js`  → `~/zinsrechner/dist/zinsrechner.html`
- Wine-Orakel (falls Original needed):
  `DISPLAY=:10.0 WINEPREFIX=$HOME/.wine-zzr ~/opt/wine-10.0-amd64-wow64/bin/wine 'C:\Program Files (x86)\ZZR\Zzr.exe' 'Z:\home\ml\zinsrechner\<datei>.zzr'`
  (lizenziert; Fenster per ~/zzr-analyse/xdriver.py `liste`/`verschiebe` holen —
  Positionen laufen aus dem Bildschirm; Konto-Export: Analyse►Vergleichskonto erstellen,
  dann Datei►Speichern unter… im Konto-Fenster)
- Desktop-Starter: ~/Schreibtisch/zinsrechner.desktop
