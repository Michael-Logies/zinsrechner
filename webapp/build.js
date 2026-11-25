// Bau: bettet den getesteten Rechenkern in die HTML-Vorlage ein -> dist/zinsrechner.html
// Einzige Quelle der Wahrheit für die Mathematik bleibt core/zzr-core.js (Goldmaster-Test!).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'core', 'zzr-core.js'), 'utf8');
const vorlage = fs.readFileSync(path.join(root, 'webapp', 'template.html'), 'utf8');
if (!vorlage.includes('/*__CORE__*/')) throw new Error('Platzhalter fehlt in der Vorlage');
if (!vorlage.includes('/*__FORMATDOKU__*/')) throw new Error('Format-Doku-Platzhalter fehlt in der Vorlage');
const ausgabe = vorlage
  .replace('/*__CORE__*/', core)
  .replace('/*__FORMATDOKU__*/', () =>
    fs.readFileSync(path.join(root, 'ZZR-FORMAT.md'), 'utf8')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'zinsrechner.html'), ausgabe);
if (!ausgabe.includes('effPAngV')) throw new Error('Kern nicht eingebettet');
if (!ausgabe.includes('ZZR-Datenformat')) throw new Error('Format-Doku nicht eingebettet');
console.log('dist/zinsrechner.html gebaut (' + ausgabe.length + ' Bytes)');
