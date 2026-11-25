# ZZR-Datenformat (.zzr) — Beschreibung für KI-Agenten

Diese Datei beschreibt das Datenformat, das der Zinsrechner liest und schreibt (und das
historische Programm ZZR, 1999–2007, gelesen hat). Wenn Du eine Datei in diesem Format
erzeugen oder lesen möchtest, halte dich EXAKT an diese Vorgaben.

## Datei-Ebene

- Textdatei in **CP1252** (Windows-Ansi) — KEIN UTF-8: Umlaute sind ä=0xE4, ö=0xF6,
  ü=0xFC, ß=0xDF. Zeilenenden **CRLF** (`\r\n`).
- Sektionen in eckigen Klammern (`[Sektionsname]`), Zeilen mit führendem `;` sind Kommentare.
- Schlüssel/Wert-Zeilen im Format `Schlüssel=Wert` (keine Leerzeichen um das `=`).

## Sektion `[Information]`

| Schlüssel | Bedeutung |
|---|---|
| `Typ` | immer `ZZR-Datei` |
| `Version` | immer `1` |
| `Erzeuger` | freier Text |
| `Titel` | freier Text (CP1252), wird als Überschrift gezeigt |
| `EZ-Methode` | `0` = EG-Anhang II (AIBD) tagesgenau (2023); `1` = PAngV-Vergleichskonto (bis 2010) |
| `Euro` | `1` = Euro-Beträge |
| `Zahlungsstroeme` | Anzahl der `[ZahlungsstromN]`-Sektionen (muß stimmen!) |

## Sektionen `[Zahlungsstrom1]` … `[ZahlungsstromN]`

Jede Sektion = ein Strom gleichförmiger Zahlungen. Felder:

| Schlüssel | Bedeutung |
|---|---|
| `Aktiv` | `1` = in die Rechnung einbezogen, `0` = ausgeblendet |
| `Stufen` | Anzahl Stufen (Typischer Wert: `1`) |
| `Dynamik` | prozentuale Steigerung je Stufe (in Prozent, z. B. 3 für 3 %). `0` = aus |
| `Zuwachs` | absoluter Euro-Zuwachs je Stufe. `0` = aus (entweder Dynamik ODER Zuwachs) |
| `Realdatum` | **Tagesnummer** des ERSTEN Zahlungstermins (siehe unten) |
| `Ultimo` | `1` = Folgeraten auf Monatsenden gerundet; `0` = exakt am Ankertag + Abstand (mit Kappung auf Monatsende) |
| `Betrag` | Betrag einer EINZELNEN Zahlung der ERSTEN Stufe |
| `Raten` | Anzahl Zahlungen **pro Stufe** (gebrochen zulässig: „2,5" = Schlußrate trägt 0,5) |
| `Abstand` | Tage zwischen aufeinanderfolgenden Zahlungen |
| `Notiz` | freier CP1252-Text (Bezeichnung) |

**Tagesnummer (Realdatum):** fortlaufende Tageszahl der proleptisch gregorianischen
Zeitrechnung ab 1.1.0001. Beispiele: 1.1.2000 = `730120`, 30.12.1999 = `730118`,
1.1.2015 = `735599`. In Python: `(datum - date(1, 1, 1)).days + 1`.

**Zahlenformat („Delphi-Float"):** Mantisse mit 14 Nachkommastellen, dann `E` und
vierstelliger Exponent mit Vorzeichen; positives Vorzeichen als LEERZEICHEN:
` 2.40000000000000E+0001` (= 24), `-1.00000000000000E+0004` (= −10.000),
` 0.00000000000000E+0000` (= 0). Ein einfacher Dezimalwert wird vom Reader auch
akzeptiert; der Originalexport nutzt ausschließlich die Float-Form.

## Rechen-Semantik (wichtig für Korrektheit)

- Ein Strom expandiert zu `Raten × Stufen` Einzelzahlungen. Stufe `s` (0-basiert)
  beginnt `s × Raten × Abstand` Tage nach `Realdatum` und trägt je Zahlung
  `Betrag × (1 + Dynamik/100)^s` (bei Dynamik) bzw. `Betrag + s × Zuwachs` (bei Zuwachs).
- **Vorzeichen:** Auszahlung des Anlegers negativ (z. B. −10.000 Anlage),
  Rückfluß positiv. Der Effektivzins wird über ALLE Einzelzahlungen aller
  aktiven Ströme berechnet (Vorzeichenwechsel muß existieren).
- Der Effektivzins wird nach zwei Verfahren gerechnet: EZ-Methode `0` = EG-Anhang II
  (AIBD), tagesgenau, Exponent Tage/360 auf Zinsfuß-Basis 1+i; EZ-Methode `1` =
  PAngV-Vergleichskonto (bis 2010) mit 30/360-Monatsraster (Februar-Ende zählt als 30).
- `Ultimo` wirkt nur bei monatsnahen Abständen: `1` = Folgeraten rutschen auf
  Monatsenden; `0` = Ankertag + Abstand, dabei Kappung auf Monatsende (29.02 im
  Schaltjahr bleibt 29.02).

## Sektion `[Beschreibung]` (optional)

`Zeilen=<n>`, danach `Zeile1=<Text>` … `Zeile<n>=<Text>` — freier Beschreibungstext.

## Minimales Beispiel (Anlage + Rückzahlung)

```
[Information]
Typ=ZZR-Datei
Version=1
Erzeuger=Beispiel
Titel=Minimalbeispiel
EZ-Methode=0
Euro=1
Zahlungsstroeme=2

[Zahlungsstrom1]
Aktiv=1
Stufen=1
Dynamik= 0.00000000000000E+0000
Zuwachs= 0.00000000000000E+0000
Realdatum=730120
Ultimo=0
Betrag=-1.00000000000000E+0004
Raten= 1.00000000000000E+0000
Abstand=1
Notiz=Anlage am 1.1.2000

[Zahlungsstrom2]
Aktiv=1
Stufen=1
Dynamik= 0.00000000000000E+0000
Zuwachs= 0.00000000000000E+0000
Realdatum=730486
Ultimo=0
Betrag= 1.05000000000000E+0004
Raten= 1.00000000000000E+0000
Abstand=1
Notiz=Rückzahlung am 1.1.2001

[Beschreibung]
Zeilen=1
Zeile1=1.1.2000 Anlage 10.000 €, 1.1.2001 Rückzahlung 10.500 € (Effektivzins 5 %)
```

## Häufige Fehler bei Konvertierungen

- UTF-8 statt CP1252 schreiben (Umlaute zerstören das Format für das alte Programm).
- LF statt CRLF.
- `Zahlungsstroeme` nicht zur Sektionszahl passend.
- Tagesnummern als „Tage seit 1970" statt „Tage ab 1.1.0001".
- Dynamik und Zuwachs gleichzeitig gesetzt (nur eines der beiden).
- Erste Zahlung ≠ `Realdatum` (das Realdatum IST der erste Zahlungstermin).
