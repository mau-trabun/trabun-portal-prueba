// Tests generarDatosPrueba() on top of the run.js mocks. Run from the repo root: node test/gen.js
const base = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8').split("const post =")[0];
eval(base + `
// more fictional schools to cover every generator case
sheets['SF'].splice(5, 0,
  sfRow(55555, 'Llano Ficticio - Colegio Santa Inventada - 55555', 'Religión', 'Intensivo', false, '', 2022, range(10,13,[35,1])),
  sfRow(66666, 'Bahía Falsa - Escuela Nueva Era - 66666', 'ASE', 'Semi-Intensivo', true, 2026, '', range(9,13,[45,2])),
  sfRow(77777, 'Valle Imaginario - Jardín Las Nubes - 77777', 'ASE', 'Semi-Intensivo', false, 2025, '', range(0,1,[30,1])),
  sfRow(88888, 'Monte Ficticio - Colegio Del Sol - 88888', 'ASE', 'Intensivo', false, 2024, '', range(5,9,[50,2])));
sheets['Contraseñas'].push([55555,'eee555'],[66666,'fff666'],[77777,'ggg777'],[88888,'hhh888']);
// 2026 EFA cases: a SIP school with EFA (the agreed exceptions), REL only in 1°–4° (no Test, EFA yes), excluded Cuadernillos
sheets['SF'][0].push('Sostenedor');
sheets['SF'].slice(1).forEach(r => { if (r[0]) r.push(''); });
sheets['SF'].splice(5, 0,
  sfRow(91111, 'Cerro Inventado - Colegio Los Nogales Ficticio - 91111', 'Religión', 'Consolidado', false, '', 2023, range(6,11,[30,1])).concat(['Sociedad De Instruccion Primaria De Santiago']),
  sfRow(92222, 'Isla Ficticia - Escuela Primeros Años - 92222', 'Religión', 'Semi-Intensivo', false, '', 2024, range(2,5,[25,1])).concat(['']),
  sfRow(93333, 'Loma Falsa - Colegio Cuadernos - 93333', 'Religión', 'Cuadernillos', false, '', 2024, range(6,9,[25,1])).concat(['Sociedad De Instruccion Primaria De Santiago']));
sheets['Contraseñas'].push([91111,'iii911'],[92222,'jjj922'],[93333,'kkk933']);
const fRow = sheets['Formularios'].findIndex(r => r[0] === '');
sheets['Formularios'].splice(fRow, 0,
  ['efa','REL Intensivo','REL','','','Intensivo','','','https://s.example/efa-rel-i?rbd={rbd}&colegio={colegio}&comuna={comuna}'],
  ['efa','REL Semi-intensivo','REL','','','Semi-Intensivo','','','https://s.example/efa-rel-s?rbd={rbd}&colegio={colegio}&comuna={comuna}'],
  ['efa','ASE Intensivo','ASE','NO','','Intensivo','','','https://s.example/efa-ase-i?rbd={rbd}&colegio={colegio}&comuna={comuna}&k={rbd}'],
  ['efa','REL Cuadernillos','REL','','','Cuadernillos','','','']);
sheets['Respuestas Test'] = [sheets['Respuestas Test'][0]];
sheets['Respuestas EFA'] = [sheets['Respuestas EFA'][0]];
const fmtOld = ctx.Utilities.formatDate;
ctx.Utilities.formatDate = (d, tz, f) => f.indexOf("'T'HH:mm:ss") > 0 && f.indexOf('XXX') < 0 ? fmtOld(d, tz, 'x').slice(0, 19) : fmtOld(d, tz, f);
const mkSheet = name => ({
  getName: () => name,
  getLastRow: () => sheets[name].length,
  getDataRange: () => ({ getValues: () => sheets[name].map(r => r.slice()) }),
  getRange: (r, c, nr, nc) => ({ setValues: vals => { vals.forEach((row, i) => { if (row.length !== nc) throw new Error('width ' + row.length + ' != ' + nc); sheets[name][r - 1 + i] = row; }); } }),
  appendRow: row => sheets[name].push(row),
});
ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: n => sheets[n] ? mkSheet(n) : null });
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };

const informe = ctx.generarDatosPrueba();
console.log(informe);
const t = sheets['Respuestas Test'], e = sheets['Respuestas EFA'];
check('every case found a school', !informe.includes('sin colegio'));
check('Control school never chosen', !informe.includes('33333'));
check('test rows: one Colegio per row, full width', t.slice(1).every(r => r.length === 23 && r.slice(7).filter(Boolean).length === 1));
check('EFA emails all @ejemplo.invalid', e.slice(1).every(r => /@ejemplo\\.invalid$/.test(r[4])));
let err = ''; try { ctx.generarDatosPrueba(); } catch (x) { err = x.message; }
check('second run refused', /ya tiene filas/.test(err));
const claves = {11111:'aaa111',22222:'bbb222',55555:'eee555',66666:'fff666',77777:'ggg777',88888:'hhh888',91111:'iii911',92222:'jjj922'};
Object.keys(claves).forEach(rbd => {
  if (!informe.includes('RBD ' + rbd)) return;
  const r = post({ rbd, clave: claves[rbd] });
  const s = r.programas.map(p => p.programa + ': test r=' + p.test.resumen.r + ' (' + p.test.niveles.map(n => n.nivel + (n.registrado ? '' : '*') + '=' + n.r).join(', ') + ') · efa total=' + p.efa.total + ' [' + p.efa.secciones.map(x => x.id + '=' + x.r).join(' ') + ']').join('\\n    ');
  console.log('  ' + rbd + ' ok=' + r.ok + '\\n    ' + s);
  check(rbd + ' login ok and has responses (EFA where it has a link)', r.ok && r.programas.every(p => (p.test.resumen.r > 0 || !p.test.niveles.length) && (p.efa.total > 0) === (p.efa.links.length > 0)));
});
check('2026 role options used; EDI wording only in EDI schools; "todos los roles" only in REL', (() => {
  const roles = e.slice(1).map(r => r[6]), ediRows = e.slice(1).filter(r => r[0] === 'EFA_EDI');
  return roles.some(x => /^Cumplo ambos/.test(x)) && ediRows.length && ediRows.every(r => !/^Cumplo/.test(r[6]) && !/^Encargado.a del Programa/.test(r[6]))
    && ediRows.some(r => /^Soy Docente/.test(r[6])) && e.slice(1).filter(r => /^Cumplo todos/.test(r[6])).every(r => /^REL/.test(r[0]));
})());
check('no EFA rows for programs without an EFA link (excluded groups)', !e.slice(1).some(r => /93333/.test(r.join('|'))));
check('new cases chosen: SIP exception, REL without Test', informe.includes('SIP con EFA (excepción): RBD 91111') && informe.includes('Religión sin Test, con EFA (solo 1° a 4° básico): RBD 92222'));
console.log(ctx.revisarFormularios());
`);
