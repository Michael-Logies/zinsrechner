# Zinsrechner — Zahlungsströme & Effektivzins

Eigenständiger Zinsrechner als eine HTML-Datei (offline, keine Abhängigkeiten):
Zahlungsströme erfassen, Effektivzins nach drei Methoden (historische
PAngV-1985-Vergleichskontomethode, EG-Anhang II/AIBD tagesgenau, PAngV
2011/2026 amtlich nach Remark (C)), Vergleichskonto, Endwert/Barwert,
Zielzins-Löser, Verbraucherinformationsblatt (EU-Muster), Laden/Speichern
im .zzr-Format (kompatibel zum historischen Programm ZZR, 1999–2007).

Die Rechenregeln wurden am Verhalten des historischen Programms verifiziert
(Black-Box-Gegenproben unter Wine: Original-Export und Live-Messungen); der
Code ist vollständig neu geschrieben (keine Übernahme aus dem Original).

## Entstehung

KI-unterstützt entwickelt: Qwen Code (Agent) mit LLM GLM-5.3-Flash über den
z.ai-Fallback-Proxy, unter Richtung, Prüfung und Dokumentation von
Michael Logies. Vermessungsprotokoll und Prüfreferenzen: ~/zzr-analyse
(lokal) und tests/ (Goldmaster-Datenpunkte).

## Build & Tests

    node webapp/build.js      # erzeugt dist/zinsrechner.html (Einzeldatei)
    node tests/test-core.js   # Goldmaster-Gegenproben + Identitätstests

## Lizenz

Copyright (C) 2026 Michael Logies

Dieses Programm ist lizenziert unter der GNU Affero General Public License
v3 oder später (AGPL-3.0-or-later); siehe LICENSE.
