// Tests the optional Letras tab (a school's real class letters per grade) on top of the run.js mocks (fictional schools).
// Run from the repo root: node test/letras.js
const base = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8').split("const post =")[0];
eval(base + `
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const notas_ = {}, congeladas = {};
const hoja_ = name => ({
  getDataRange: () => ({ getValues: () => sheets[name].map(r => r.slice()) }),
  setFrozenRows: n => { congeladas[name] = n; },
  getRange: (r, c, nr, nc) => { const rg = {
    setValues: v => { v.forEach((row, i) => { const f = sheets[name][r - 1 + i] || (sheets[name][r - 1 + i] = []); row.forEach((x, j) => { f[c - 1 + j] = x; }); }); return rg; },
    setFontWeight: () => rg, setNotes: n => { notas_[name] = n[0]; return rg; },
    insertCheckboxes: () => { for (let i = 0; i < nr; i++) { const f = sheets[name][r - 1 + i] || (sheets[name][r - 1 + i] = []); for (let j = 0; j < nc; j++) f[c - 1 + j] = false; } return rg; } }; return rg; },
});
const ssBase = ctx.SpreadsheetApp.getActiveSpreadsheet;
ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: n => sheets[n] ? hoja_(n) : null, insertSheet: n => { sheets[n] = []; return hoja_(n); }, getNumSheets: () => Object.keys(sheets).length });
const nivel = (rbd, prog, n) => ctx.panel_(rbd, ctx.cargarDatos_(), ctx.reloj_()).programas.find(p => p.programa === prog).test.niveles.find(x => x.nivel === n);
const resumen = c => c.map(x => (x.letra || '-') + (x.registrado ? '' : '*') + ':' + x.r + '/' + (x.est == null ? '' : x.est)).join(' ');

const sinTab = resumen(nivel('11111', 'ase', '4° básico').cursos);
check('no Letras tab: letters from SF CxN (2 → A, B), C unregistered, est = Alumnos ÷ CxN', sinTab === 'A:2/30 B:1/30 C*:1/' && !logs.some(l => /Letras/.test(l)));

sheets['Letras'] = [['RBD', 'Nivel', 'Letras', 'ASE', 'REL'],
  ['11111', '4° Básico', 'A y D', true, true],   // both programs
  [11111, '6 basico', 'a, c', true, false],
  ['11111', '6° básico', 'B', false, 'TRUE'],    // REL only (checkbox typed as text)
  ['11111', 'Cuarto', 'A, B', true, true],       // unknown grade → ignored
  ['11111', '5° básico', '', true, true],        // no letters → ignored
  ['11111', '7° básico', 'A, B', false, false],  // nothing ticked → ignored
  ['', '', '', false, false]];
const conTab = nivel('11111', 'ase', '4° básico');
check('Letras row: registered classes = its letters (A, D); B and C become unregistered; est split among them', resumen(conTab.cursos) === 'A:2/30 D:0/30 B*:1/ C*:1/');
check('grade totals untouched (estimate stays the SF grade figure)', conTab.est === 60 && conTab.r === 4 && conTab.registrado === true);
check('grade with a blank sign and lowercase letters parsed; each row only for the programs ticked',
  resumen(nivel('11111', 'ase', '6° básico').cursos).startsWith('A:0/30 C:0/30 B*:1/') && JSON.stringify(ctx.letrasDe_(ctx.cargarDatos_(), '11111', 'rel', 7)) === '["B"]'
  && JSON.stringify(ctx.letrasDe_(ctx.cargarDatos_(), '11111', 'ase', 7)) === '["A","C"]');
check('rows with an unknown grade, no letters or nothing ticked are ignored', (() => { const l = ctx.cargarDatos_().letras; return Object.keys(l).length === 4 && !l['11111|8|ase'] && !l['11111|8|rel'] && !l['11111|6|ase']; })());
check('other schools and grades keep SF letters', resumen(nivel('11111', 'ase', '7° básico').cursos) === 'A:0/30 B:0/30' && nivel('22222', 'ase', '8° básico').cursos.filter(c => c.registrado).map(c => c.letra).join() === 'A');
check('numero mode: tope uses the split estimate', (() => { sheets['Config'].push(['student_id', 'numero', '']); sheets['Config'] = sheets['Config'].filter((r, i, a) => r[0] !== 'student_id' || i === a.length - 1);
  const c = nivel('11111', 'ase', '4° básico').cursos; sheets['Config'] = sheets['Config'].map(r => r[0] === 'student_id' ? ['student_id', '', ''] : r); return c.find(x => x.letra === 'D').tope === 30; })());
const seg = ctx.seguimiento_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), ctx.reloj_());
const notas = JSON.stringify(seg.notas);
check('team tracker: unregistered class note names the Letras tab', /Curso no registrado: la pestaña Letras tiene A, D en 4° básico/.test(notas)
  && seg.tabs['Por curso'].some(r => r[0] === 11111 && r[6] === '4° básico' && /D$/.test(r[7]) && r[9] === 30));
check('prepararLetras: creates the tab with the 5 headers, checkboxes in ASE and REL, a note per header; never overwrites', (() => {
  const g = sheets['Letras']; delete sheets['Letras'];
  const r1 = ctx.prepararLetras(), t = sheets['Letras'];
  const ok = t[0].join('|') === 'RBD|Nivel|Letras|ASE|REL' && t[1][3] === false && t[300][4] === false && notas_.Letras.length === 5 && /coma/.test(notas_.Letras[2]) && congeladas.Letras === 1;
  t[1][0] = '5992'; const r2 = ctx.prepararLetras();
  sheets['Letras'] = g; return ok && /creada/.test(r1) && /ya existe/.test(r2) && sheets['Letras'] === g; })());
check('a broken Letras tab never breaks a login (SF letters)', (() => { sheets['Letras'] = [['RBD', 'Nivel']]; const ok = nivel('11111', 'ase', '4° básico').cursos.filter(c => c.registrado).map(c => c.letra).join() === 'A,B'; delete sheets['Letras']; return ok && logs.some(l => /^ERROR Letras/.test(l)); })());
`);
