// Tests the response monitor revisarConteos() / reiniciarMonitor() on top of the run.js mocks (fictional data).
// Run from the repo root: node test/monitor.js
const base = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8').split("const post =")[0];
eval(base + `
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const lastRow = n => { const s = sheets[n] || []; let i = s.length; while (i > 0 && !(s[i - 1] || []).some(v => v !== '' && v != null)) i--; return i; };
const lastCol = n => (sheets[n] || []).reduce((m, r) => Math.max(m, r.length), 0);
const mkSheet = name => ({
  getLastRow: () => lastRow(name),
  getLastColumn: () => lastCol(name),
  getDataRange: () => ({ getValues: () => sheets[name].slice(0, lastRow(name)).map(r => Array.from({ length: lastCol(name) }, (_, j) => (r[j] == null ? '' : r[j]))) }),
  clearContents: () => { sheets[name] = []; },
  getRange: (r, c, nr, nc) => {
    const rg = {
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (sheets[name][r - 1 + i] || [])[c - 1 + j]; return v == null ? '' : String(v); })),
      setValues: vals => { vals.forEach((row, i) => { if (row.length !== nc) throw new Error('width'); const fila = sheets[name][r - 1 + i] || (sheets[name][r - 1 + i] = []); row.forEach((v, j) => { fila[c - 1 + j] = v; }); }); return rg; },
      setFontWeight: () => rg,
    };
    return rg;
  },
});
ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({
  getSheetByName: n => sheets[n] ? mkSheet(n) : null,
  insertSheet: n => { sheets[n] = []; return mkSheet(n); },
  getNumSheets: () => Object.keys(sheets).length,
});
const props = {};
ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { if (v.length > 9000) throw new Error('too big'); props[k] = v; } }) };
let bloqueado = false;
ctx.LockService = { getScriptLock: () => ({ tryLock: () => !bloqueado, waitLock: () => {}, releaseLock: () => {} }) };
const enviados = [];
ctx.MailApp = { sendEmail: o => enviados.push(o) };
ctx.Session = { getEffectiveUser: () => ({ getEmail: () => 'dueno@ejemplo.invalid' }) };

const monitor = () => sheets['Monitor'];
const N = ctx.MONITOR ? ctx.MONITOR.confirmar : 5;
const confirmar = () => { for (let i = 0; i < N; i++) ctx.revisarConteos(); };
const fila = (enc, form) => monitor().find(r => r && r[0] === enc && r[1] === form) || [];
const testOrig = sheets['Respuestas Test'].map(r => r.slice());
const efaOrig = sheets['Respuestas EFA'].map(r => r.slice());

ctx.revisarConteos();
check('first run: Monitor tab created, counts per Form, no email',
  fila('Test de Estudiantes', 'ASE_6-IV')[2] === 4 && fila('Test de Estudiantes', 'ASE_4-5')[2] === 4 && fila('EFA', 'ASE Semi-intensivo')[2] === 6
  && fila('Test de Estudiantes', 'Total')[2] === 12 && fila('EFA', '(pestaña)')[4] === 'OK' && enviados.length === 0);
check('header, last check time and recipient written', monitor()[3].slice(0, 5).join('|') === 'Encuesta|Form|Respuestas ahora|Referencia|Estado' && /^Última revisión: .* avisa a: dueno@ejemplo.invalid/.test(monitor()[0][0]));

// One-run blip (e.g. IMPORTRANGE reloading): no email
sheets['Respuestas Test'] = testOrig.filter(r => r[0] !== 'ASE_6-IV');
ctx.revisarConteos();
check('drop seen once: no email yet, marked as pending', enviados.length === 0 && /1 de 5 revisiones/.test(fila('Test de Estudiantes', 'ASE_6-IV')[4]) && fila('Test de Estudiantes', 'ASE_6-IV')[2] === 0);
sheets['Respuestas Test'] = testOrig.map(r => r.slice());
ctx.revisarConteos();
check('back up on the next check: still no email, OK', enviados.length === 0 && fila('Test de Estudiantes', 'ASE_6-IV')[4] === 'OK');

// Real drop: 2 rows of ASE_6-IV disappear and stay gone
const sinDos = () => { let n = 0; return testOrig.filter(r => !(r[0] === 'ASE_6-IV' && n++ < 2)); };
sheets['Respuestas Test'] = sinDos();
confirmar();
check('drop confirmed after 5 checks in a row: one email naming the Form, before → after', enviados.length === 1
  && /ASE_6-IV/.test(enviados[0].subject) && /4 → 2 \\(−2\\)/.test(enviados[0].body) && enviados[0].to === 'dueno@ejemplo.invalid');
check('reference kept at the higher count while it stays low', fila('Test de Estudiantes', 'ASE_6-IV')[3] === 4 && /aviso enviado/.test(fila('Test de Estudiantes', 'ASE_6-IV')[4]));
confirmar();
check('no repeat email while it stays low', enviados.length === 1);
check('email and tab carry counts only, never names', !enviados.some(e => /Muñoz|Pérez|Martina|Fuentes/.test(e.body + e.subject)) && !JSON.stringify(sheets['Monitor']).match(/Muñoz|Pérez|Fuentes/));
sheets['Respuestas Test'] = testOrig.map(r => r.slice());
ctx.revisarConteos();
check('recovery email once it is back', enviados.length === 2 && /Se recuperaron/.test(enviados[1].subject) && /ASE_6-IV/.test(enviados[1].body));
check('history lists the drop and the recovery, newest first', (() => { const h = monitor().slice(4).map(r => r[10]).filter(Boolean); return h[0] === 'Se recuperó' && h[1] === 'Aviso de baja'; })());

// REVISAR row in Respuestas Test (a compilado tab that can't be read)
sheets['Respuestas Test'] = testOrig.concat([['ASE_6-IV', '', 'REVISAR: no se pudo leer «ASE 6° básico - IV medio» (¿falta autorizar el acceso o el nombre no calza?)']]);
confirmar();
check('REVISAR row alerts as a tab problem, with its text', enviados.length === 3 && /Respuestas Test/.test(enviados[2].subject) && /REVISAR: no se pudo leer/.test(enviados[2].body));
sheets['Respuestas Test'] = testOrig.map(r => r.slice());
ctx.revisarConteos();
check('REVISAR gone: recovery email', enviados.length === 4 && /Se recuperaron/.test(enviados[3].subject));

// Formula error in the whole tab: alert once, Form references untouched
sheets['Respuestas Test'] = [testOrig[0], ['#REF!']];
confirmar();
check('formula error alerts as a tab problem and keeps Form references', enviados.length === 5 && /#REF!/.test(enviados[4].body)
  && JSON.parse(props.monitor_estado).base['test|ASE_6-IV'] === 4);
sheets['Respuestas Test'] = testOrig.map(r => r.slice());
ctx.revisarConteos();
check('formula back: recovery, Forms OK without a false drop', enviados.length === 6 && !/ASE_/.test(enviados[5].body.split('Se recuperaron')[1].replace(/Respuestas Test/, '')) && fila('Test de Estudiantes', 'ASE_6-IV')[4] === 'OK');

// EFA drop, recipients from Config
sheets['Config'].push(['monitor_correo', 'a@ejemplo.invalid, b@ejemplo.invalid']);
sheets['Respuestas EFA'] = efaOrig.filter(r => r[0] !== 'REL Consolidado');
confirmar();
check('EFA drop: email names EFA and the Form, sent to Config monitor_correo', enviados.length === 7 && /REL Consolidado/.test(enviados[6].subject)
  && /EFA · REL Consolidado: 1 → 0/.test(enviados[6].body) && enviados[6].to === 'a@ejemplo.invalid,b@ejemplo.invalid');

// Mau accepts the lower number (deleted test responses)
ctx.reiniciarMonitor();
check('reiniciarMonitor: reference = current count, no email, logged', enviados.length === 7 && fila('EFA', 'REL Consolidado')[3] === 0 && fila('EFA', 'REL Consolidado')[4] === 'OK'
  && monitor().slice(4).some(r => /reiniciadas/.test(r[9] || '')));
confirmar();
check('after reset no further email', enviados.length === 7);

// New Form appears: becomes its own reference, never alerts
sheets['Respuestas Test'] = testOrig.concat([test('ASE_4-5','Nueva','Persona',1,'4° básico','A',AROMOS,4)]);
ctx.revisarConteos();
check('higher count raises the reference', fila('Test de Estudiantes', 'ASE_4-5')[3] === 5 && enviados.length === 7);

check('overlapping run skipped by the lock', (() => { bloqueado = true; const r = ctx.revisarConteos(); bloqueado = false; return r === 'Otra revisión en curso'; })());
check('missing tab: alert, never throws', (() => { const g = sheets['Respuestas EFA']; delete sheets['Respuestas EFA']; confirmar(); sheets['Respuestas EFA'] = g; return enviados.length === 8 && /falta la pestaña/.test(enviados[7].body); })());
check('state fits in script properties (history capped)', (() => { for (let i = 0; i < 80; i++) { sheets['Respuestas EFA'] = i % 4 < 2 ? efaOrig : efaOrig.slice(0, 2); ctx.revisarConteos(); } return JSON.parse(props.monitor_historial).length <= 60; })());
`);
