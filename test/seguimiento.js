// Tests seguimiento_() + datosSeguimiento_() (internal team tracker) on top of the run.js mocks. Fictional schools only.
// Run from the repo root: node test/seguimiento.js
const base = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8').split("const post =")[0];
eval(base + `
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);
ctx.Utilities.formatDate = require('../cloudrun/app').formatDate; // every pattern Code.js uses (the run.js mock knows two)
const reloj = { hoy: '2026-10-19', generado: '2026-10-19T14:32:00-03:00' };

check('no Correos Test, empty Métricas: blank extras, no error', (() => { const s = ctx.datosSeguimiento_(); return JSON.stringify(s.enviados) === '{}' && s.metricas.length === 0; })());

sheets['Correos Test'] = [['RBD', 'Colegio', 'Para', 'Enviar', 'Enviado'],
  ['11111', 'x', 'a@ejemplo.invalid', true, new Date(2026, 9, 9, 10, 15)], ['22222', 'x', 'b@ejemplo.invalid', true, '']];
sheets['Métricas'].push(
  [new Date(2026, 9, 14, 9, 0), 11111, 'ASE,REL', true, true, 'login'],
  ['2026-10-16 18:45:00', 11111, 'ASE,REL', true, true, 'login'],          // Cloud Run writes text timestamps
  [new Date(2026, 9, 16, 18, 46), 11111, 'ASE', '', '', 'test_whatsapp'],
  [new Date(2026, 9, 16, 18, 47), 11111, 'ASE', '', '', 'test_instructivo'],
  [new Date(2026, 9, 16, 18, 48), 11111, 'ASE', '', '', 'test_whatsapp'],   // repeated → once
  [new Date(2026, 9, 16, 18, 49), 11111, 'REL', '', '', 'test_copiar_lista'],
  [new Date(2026, 9, 16, 18, 50), 11111, '', '', '', 'ver_efa'],            // not a Test share
  [new Date(2026, 9, 16, 18, 51), 22222, 'ASE', '', '', 'efa_whatsapp']);   // EFA share: not listed

sheets['SF'].find(r => r[0] === 11111 && r[3] === 'Religión')[10] = 'Coordinadora Ficticia';
const d = ctx.cargarDatos_();
const s = ctx.datosSeguimiento_();
const out = ctx.seguimiento_(d, s, reloj);
const R = out['Resumen'], K = out['Por curso'];
const h = R[1];
const fila = (rbd, prog) => { const r = R.find(x => x[0] === Number(rbd) && x[2] === prog); return r && Object.fromEntries(h.map((k, i) => [k, r[i]])); };
const a = fila('11111', 'ASE'), rl = fila('11111', 'REL'), f = fila('22222', 'ASE');

check('two tabs, status line with date, contract header + grade columns in canonical order',
  Object.keys(out).join() === 'Resumen,Por curso' && /^Actualizado: 19-10-2026 14:32 ·/.test(R[0][0])
  && h.slice(0, 15).join('|') === 'RBD|Colegio|Programa|Modelo|EDI|Jefe/a de Proyecto|Coordinador/a|Correo enviado|Ingresos al portal|Último ingreso|Compartió el Test|Respuestas|Estimado|%|Cursos sin respuestas'
  && h.slice(15, 19).join() === '4° básico resp.,4° básico est.,5° básico resp.,5° básico est.' && h.length === 15 + 2 * 9 && h[h.length - 1] === 'IV° medio est.');
check('Coordinador/a per program, no Comuna column', rl['Coordinador/a'] === 'Coordinadora Ficticia' && a['Coordinador/a'] === '' && !h.includes('Comuna'));
check('one row per school-program with online Test; Control left out (no responses)', R.length === 5 && !fila('33333', 'ASE'));
check('totals and estimate match the portal panel', (() => {
  const p = post({ rbd: '11111', clave: 'aaa111' }).programas.find(x => x.programa === 'ase').test.resumen;
  return a.Respuestas === p.r && a.Estimado === p.est && a['%'] === Math.round(p.rConEst / p.est * 1000) / 1000;
})());
check('grade columns: responses and estimate as two numbers; outside the registered grades flagged in est.; blank where the school has no grade',
  a['4° básico resp.'] === 4 && a['4° básico est.'] === 60 && a['5° básico resp.'] === 0 && a['5° básico est.'] === 60
  && a['IV° medio resp.'] === 1 && a['IV° medio est.'] === 'Fuera de lo registrado' && rl['4° básico resp.'] === '' && rl['4° básico est.'] === '');
check('grade columns add up to the program totals', h.filter(k => / resp\.$/.test(k)).reduce((t, k) => t + (typeof a[k] === 'number' ? a[k] : 0), 0) === a.Respuestas
  && h.filter(k => / est\.$/.test(k)).reduce((t, k) => t + (typeof a[k] === 'number' ? a[k] : 0), 0) === a.Estimado);
check('EDI paper grades shown as "Papel"', f.EDI === 'SÍ' && f['5° básico resp.'] === 'Papel' && f['5° básico est.'] === ''
  && f['8° básico resp.'] === 1 && f['8° básico est.'] === 'Fuera de lo registrado' && f['4° básico resp.'] === 0 && f['4° básico est.'] === 40);
check('Cursos sin respuestas: registered classes with 0 (short labels), not unregistered ones',
  a['Cursos sin respuestas'] === '5°A, 5°B, 6°A, 7°A, 7°B, 8°A, 8°B' && !/4°/.test(a['Cursos sin respuestas']));
check('Correo enviado: date only, blank when not sent or no row', a['Correo enviado'] === '09-10-2026' && rl['Correo enviado'] === '09-10-2026' && f['Correo enviado'] === '');
check('portal use: logins per school (Date and text timestamps), latest one', a['Ingresos al portal'] === 2 && a['Último ingreso'] === '16-10-2026 18:45' && f['Ingresos al portal'] === 0 && f['Último ingreso'] === '');
check('Test share actions per program, deduplicated; EFA and ver_efa left out',
  a['Compartió el Test'] === 'WhatsApp, instructivo' && rl['Compartió el Test'] === 'lista por curso' && f['Compartió el Test'] === '');
check('Por curso: one row per class with count, per-class estimate and %, flags', (() => {
  const c = K.filter(x => x[0] === 11111 && x[2] === 'ASE' && x[6] === '4° básico');
  return K[1].join('|') === 'RBD|Colegio|Programa|Modelo|Jefe/a de Proyecto|Coordinador/a|Nivel|Curso|Respuestas|Estimado|%|Registrado'
    && c.map(x => x[7] + '=' + x[8] + '/' + x[9] + '/' + x[11]).join() === '4° A=2/30/Sí,4° B=1/30/Sí,4° C=1//Fuera de lo registrado'
    && c[0][10] === Math.round(2 / 30 * 1000) / 1000
    && K.some(x => x[0] === 11111 && x[2] === 'REL' && x[5] === 'Coordinadora Ficticia');
})());
check('Por curso: no-letter bucket as "Sin letra"', K.some(x => x[0] === 11111 && x[6] === '6° básico' && x[7] === 'Sin letra' && x[8] === 1));
check('RBD written as a number (sorts and filters as a number)', a.RBD === 11111 && typeof K[2][0] === 'number');
check('rows have the header width', R.slice(1).every(r => r.length === h.length) && K.slice(1).every(r => r.length === K[1].length));
check('no names or emails anywhere', !/Rojas|Martina|Bravo|Muñoz|ejemplo/.test(JSON.stringify(out)));
check('responses tab unreadable → null (keep the previous tracker)', ctx.seguimiento_(Object.assign({}, d, { test: null }), s, reloj) === null);
`);
