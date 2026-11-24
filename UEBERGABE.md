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
     künftige abgezinst mit (1+r)^(−Tage30/360/360) — Kern `barwert()` Δ 0,15 € (Restunsicherheit
     in der Tageszählung der Zukunftszahlungen; zweiter Messpunkt, z. B. Zins 10 %, steht aus —
     Prognosen dafür stehen in ~/zzr-analyse/bw-formel.js).
   - HTML-Fläche: Feld Stichtag/Zins + Endwert-/Barwert-Knopf (Berechnung-Gruppe).
   - HINWEIS Orakel: Zinssatz-Dialog ist mit „5“ vorbelegt — Eingaben APPENDEN (unser „5“→„55“-
     Vorfall); Feld vor dem Tippen leeren (End+Backspace). Nach Stichtag-OK fragt ein ZWEITER
     Dialog (Verzinsung) nach dem Zins — nicht wundern. Ergebnis = Info-Box (Fenster läuft
     aus dem Bild, per xdriver holen).
4. **Feinschliff Rundung**: Live-Wine-Konto akkumuliert ab Jahr 2 mit Monatsrhythmus
   statt Tageszählung (vs. Goldmaster) — ±0,04 € Rauschen in PAngV-Tests akzeptiert;
   wer Pixelparität will, muss die Original-Kumulierung nochmal verifizieren.
   (AIBD-Konto: keine Abweichung — max 0,005 € = reine Anzeigerundung.)

## Befehle

- Tests: `node ~/zinsrechner/tests/test-core.js`
- HTML bauen: `node ~/zinsrechner/webapp/build.js`  → `~/zinsrechner/dist/zinsrechner.html`
- Wine-Orakel (falls Original needed):
  `DISPLAY=:10.0 WINEPREFIX=$HOME/.wine-zzr ~/opt/wine-10.0-amd64-wow64/bin/wine 'C:\Program Files (x86)\ZZR\Zzr.exe' 'Z:\home\ml\zinsrechner\<datei>.zzr'`
  (lizenziert; Fenster per ~/zzr-analyse/xdriver.py `liste`/`verschiebe` holen —
  Positionen laufen aus dem Bildschirm; Konto-Export: Analyse►Vergleichskonto erstellen,
  dann Datei►Speichern unter… im Konto-Fenster)
- Desktop-Starter: ~/Schreibtisch/zinsrechner.desktop
