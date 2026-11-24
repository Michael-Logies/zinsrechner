# Übergabe ZZR-Neubau (Stand 24.11.2026, Kontextwechsel)

## Was steht (alles committet in ~/zinsrechner, lokal, kein Remote)

1. **Rechenkern** `core/zzr-core.js` — Goldmaster-GRÜN:
   - EFF berechnet −8,814493 % vs. ZZR-Original-Export −8,8145 %
   - Alle 198 Vergleichskonto-Zeilen des Original-Konto.txt ≤ 0,04 € Abweichung
   - .zzr-Format lesen/schreiben (CP1252, CRLF, Delphi-Floats, Tagesnummern ab 1.1.0001)
   - Stufen-Semantik (live unter Wine vermessen): Raten = Anzahl PRO Stufe;
     Stufe s = Betrag×(1+Dynamik/100)^s bzw. Betrag + s×Zuwachs (Dynamik-Feld = PROZENT-Zahl,
     Zuwachs = absolut mit Vorzeichen)
   - Löser: Ratenhöhe bei Zielzins (geometrische Bisektion)
2. **HTML-Bedienerfläche** `dist/zinsrechner.html` (29 KB Einzeldatei, offline, druckbar):
   Zahlungsstrom-Tabelle editierbar, EFF beide Methoden, Vergleichskonto, Zielzins-Löser,
   .zzr Laden/Speichern, Drucken. Bau: `node webapp/build.js` (bettet core ein —
   core/zzr-core.js bleibt EINZIGE Quelle der Wahrheit).
3. **Tests** `tests/test-core.js` + `tests/goldmaster-konto.json` (198 Zeilen aus dem
   Original-Export). Laufen mit: `node tests/test-core.js`

## Wissen (NICHT nochmal ableiten!)

Memory-MCP **#1467** (Tags zzr,zinsrechner,wine,...) hat ALLES: Dateiformat, Semantik,
Methoden-Mapping (EZ-Methode 1 = „PAngV (alt)", 0 = „ABD/EFH-Methode"), PAngV-Rezept
(30/360, Ereignis-Ansammlung, Jahres-Jubiläum des frühesten Flows, Abschluss am letzten
Ereignis), Wine-Orakel-Route, xdriver/Keysym-Fallen. RE-Artefakte: ~/zzr-analyse (chmod 700,
NIE committen).

## Offene Punkte

1. **EG-Methode kalibrieren**: Kern hat `effEG` als Standard-Tageszählung; gemessen am
   Goldmaster-Szenario (EZ-Methode=0) = **−8,0608 %** („ABD/EFH-Methode"). Kern-EFF dafür
   berechnen, Differenz analysieren, anpassen, Test ergänzen.
2. **Ultimo-Detail**: Feld vorhanden, Semantik nur für Löser relevant — unaufgeklärt.
3. **Barwerte/Endwerte-Blätter**: Original hatte Barwerte-/Endwertekurven-Exporte;
   Kern hat `barwerte`/`endwerte` (unverifiziert gegen Original — Messung unter Wine möglich:
   Analyse→Endwert-/Barwertberechnung►).
4. **Feinschliff Rundung**: Live-Wine-Konto akkumuliert ab Jahr 2 mit Monatsrhythmus statt
   Tageszählung (vs. Goldmaster) — ±0,04 € Rauschen in Tests akzeptiert; wer Pixelparität
   will, muss die Original-Kumulierung nochmal verifizieren.

## Befehle

- Tests: `node ~/zinsrechner/tests/test-core.js`
- HTML bauen: `node ~/zinsrechner/webapp/build.js`  → `~/zinsrechner/dist/zinsrechner.html`
- Wine-Orakel (falls Original needed):
  `DISPLAY=:10.0 WINEPREFIX=$HOME/.wine-zzr ~/opt/wine-10.0-amd64-wow64/bin/wine 'C:\Program Files (x86)\ZZR\Zzr.exe' 'Z:\home\ml\zinsrechner\<datei>.zzr'`
  (lizenziert; Fenster per ~/zzr-analyse/xdriver.py `liste`/`verschiebe` holen — Positionen
  laufen aus dem Bildschirm)
- Desktop-Starter: ~/Schreibtisch/zinsrechner.desktop
