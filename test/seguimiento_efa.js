// Tests seguimientoEfa_() + the EFA sources of datosSeguimiento_() (EFA team tracker) on top of the run.js mocks.
// Fictional schools, people and contacts only. Run from the repo root: node test/seguimiento_efa.js
const base = require('fs').readFileSync(require('path').join(__dirname, 'run.js'), 'utf8').split("const post =")[0];
eval(base + `
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);
ctx.Utilities.formatDate = require('../cloudrun/app').formatDate; // every pattern Code.js uses (the run.js mock knows two)
const reloj = { hoy: '2026-11-03', generado: '2026-11-03T14:32:00-03:00' };
const FARO = 'Puerto Inventado - Escuela El Faro - 22222';
const DOC_ASE = 'Docente que implementa el Programa ASE-Orientación de Trabün';

sheets['Respuestas EFA'].push(
  ['ASE Semi-intensivo', '2026-11-03T15:00:00', 'Sin', 'Rol', 'sr@ejemplo.cl', AROMOS, '', '-'],                       // no role outside EFA-EDI
  ['EFA_EDI', '2026-11-03T10:00:00', 'No', 'Acepta', 'na@ejemplo.cl', FARO, '-', '-'],                                  // EDI no consent: SurveyMonkey writes "-" 
  ['EFA_EDI', '2026-11-03T10:10:00', 'Equipo', 'Directivo', 'ed@ejemplo.cl', FARO, 'Equipo Directivo / Convivencia Escolar.', ''],
  ['EFA_EDI', '2026-11-03T10:20:00', 'Varios', 'Niveles', 'vn@ejemplo.cl', FARO, 'Soy Docente e implemento el Programa', '5° básico: A, B | 6° básico: A'],
  ['EFA_EDI', '2026-11-03T10:30:00', 'Un', 'Nivel', 'un@ejemplo.cl', FARO, 'Soy Docente e implemento el Programa', '4° básico: A'],
  ['REL Consolidado', '2026-11-03T16:10:00', 'Todos', 'Roles', 'tr@ejemplo.cl', AROMOS, 'Cumplo todos los roles: Encargado/a, Mentor/a y Docente', '-'],
  ['REL Consolidado', '2026-11-03T16:20:00', 'Ambos', 'Roles', 'ar@ejemplo.cl', AROMOS, 'Cumplo ambos roles, es decir, soy Encargado/a y Mentor/a del Programa', '-'],
  ['REL Consolidado', '2026-11-03T16:30:00', 'Rol', 'Nuevo', 'rn@ejemplo.cl', AROMOS, 'Inspector/a general, en la escuela', '-'],
  ['REL Consolidado', '2026-10-30T09:00:00', 'Antes', 'Apertura', 'aa@ejemplo.cl', AROMOS, 'Docente que implementa el Programa de Religión de Trabün', '7° básico'],
  ['ASE Semi-intensivo', '2026-11-03T10:00:00', 'Error', 'Control', 'ec@ejemplo.cl', 'Cerro Falso - Liceo Control - 33333', DOC_ASE, '5° básico'], // Control
  ['ASE Semi-intensivo', '2026-11-03T10:00:00', 'Fuera', 'SF', 'fs@ejemplo.cl', 'Otra - Escuela Ajena - 55555', DOC_ASE, '5° básico'],       // RBD not in SF
  ['REL Consolidado', '2026-11-03T10:00:00', 'Sin', 'Programa', 'sp@ejemplo.cl', FARO, 'Docente que implementa el Programa de Religión de Trabün', '5° básico']); // El Faro has no REL

check('no Contactos EFA / Correos EFA tab: null contacts, empty dates, no error', (() => { const s = ctx.datosSeguimiento_(); return s.contactos === null && JSON.stringify(s.enviadosEfa) === '{}'; })());
const sinContactos = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj);

sheets['Correos EFA'] = [['RBD', 'Colegio', 'Para', 'Enviar', 'Enviado'], ['11111', 'x', 'a@ejemplo.invalid', true, new Date(2026, 10, 2, 8, 5)]];
sheets['Métricas'].push(
  ['2026-10-20 10:00:00', 11111, 'ASE,REL', true, true, 'login'],          // before the EFA opened
  ['2026-11-03 10:00:00', 11111, 'ASE,REL', true, true, 'login'],
  ['2026-11-03 11:00:00', 11111, 'ASE,REL', true, true, 'login_interno'],  // internal view: never counted
  ['2026-11-03 10:01:00', 11111, 'ASE', '', '', 'efa_whatsapp'],
  ['2026-11-03 10:02:00', 11111, 'ASE', '', '', 'efa_qr'],
  ['2026-11-03 10:03:00', 11111, 'ASE', '', '', 'efa_whatsapp'],           // repeated → once
  ['2026-11-03 10:04:00', 11111, 'ASE', '', '', 'test_qr'],                // Test share: not listed
  ['2026-11-03 10:05:00', 11111, 'REL', '', '', 'efa_copiar_link'],
  ['2026-11-03 10:06:00', 11111, 'REL', '', '', 'efa_qr_interno']);
// SF report as the connector writes it (names included: Code.js never reads them; Cloud Run never downloads them)
const contacto = (nombre, tipo, rol, correo) => [nombre, 'Cuenta Ficticia', tipo, 'x', 'False', '', 'x', 'Nombre', 'Ficticio', rol, correo, 'True', ''];
sheets['Contactos EFA'] = [['Nombre para formulario', 'Account Name', 'Implementación: Record Type', 'Implementación: Modelo', 'Implementación: EDI', 'Año inicio ASE',
  'Implementación: Nombre de la Implementación', 'First Name', 'Last Name', 'Rol en la Implementacióon', 'Email', 'Vigente 2026', 'Rol en el colegio'],
  contacto(AROMOS, 'ASE', 'Director/a', 'c1@ejemplo.invalid'),
  contacto(AROMOS, 'ASE', 'Encargado/a', 'c2@ejemplo.invalid'),
  contacto(AROMOS, 'ASE', 'Mentor/a y Encargado/a', 'c3@ejemplo.invalid'),
  contacto(AROMOS, 'ASE', 'Docente', 'c4@ejemplo.invalid'),
  contacto(AROMOS, 'ASE', 'Docente', 'C4@ejemplo.invalid '),               // same email and role twice
  contacto(AROMOS, 'ASE', 'Docente', 'c5@ejemplo.invalid'),
  contacto(AROMOS, 'ASE', 'Docente', ''),                                   // no email: still expected
  contacto(AROMOS, 'ASE', '', 'c6@ejemplo.invalid'),                        // no role
  contacto(AROMOS, 'ASE', 'Otro', 'c7@ejemplo.invalid'),                    // also in El Faro
  contacto(AROMOS, 'Religión', 'Encargado/a', 'c8@ejemplo.invalid'),
  contacto(AROMOS, 'Religión', 'Docente y Mentor/a', 'c9@ejemplo.invalid'),
  contacto(AROMOS, 'Religión', 'Otro', 'c9@ejemplo.invalid'),               // same email, another role
  contacto(AROMOS, 'Religión', '', 'c10@ejemplo.invalid'),
  contacto(AROMOS, 'Religión', 'Docente', 'c10@ejemplo.invalid'),           // same email, once without a role
  contacto(FARO, 'ASE', 'Otro', 'c7@ejemplo.invalid'),
  contacto(FARO, 'ASE', 'Docente', 'c11@ejemplo.invalid'),
  contacto(' -  - 0', 'ASE', 'Docente', 'c12@ejemplo.invalid'),             // account is not a school
  ['', '', '', '', '', '', '', '', '', '', '', '', '']];

const d = ctx.cargarDatos_();
const s = ctx.datosSeguimiento_();
const out = ctx.seguimientoEfa_(d, s, reloj);
const T = out.tabs['Resumen'], h = T[2];
const fila = (rbd, prog, t = T) => { const r = t.find(x => x[0] === Number(rbd) && x[2] === prog); return r && Object.fromEntries(t[2].map((k, i) => [k, r[i]])); };
const a = fila('11111', 'ASE'), rl = fila('11111', 'REL'), f = fila('22222', 'ASE');
const nota = (rbd, prog, c) => (out.notas['Resumen'].find(([r, j]) => T[r][0] === rbd && T[r][2] === prog && h[j] === c) || [])[2];
const notaEnc = c => (out.notas['Resumen'].find(([r, j]) => r === 2 && h[j] === c) || [])[2];

check('one tab, status lines, contract header: base, 5 roles × resp./esp./%, Niveles sin docentes, grade pairs in canonical order',
  Object.keys(out.tabs).join() === 'Resumen,Por JdP,Por programa' && T[0][0] === 'Actualizado: 03-11-2026 14:32' && /^Actualización automática cada 2 minutos/.test(T[1][0])
  && h.slice(0, 13).join('|') === 'RBD|Colegio|Programa|Modelo|EDI|Jefe/a de Proyecto|Coordinador/a|Correo enviado|Ingresos desde la apertura|Último ingreso|Compartió la EFA|Contactos en SF (sin ajustes)|Respuestas'
  && h.slice(13, 28).join('|') === 'Director/a resp.|Director/a esp.|Director/a %|Encargado/a resp.|Encargado/a esp.|Encargado/a %|Mentor/a resp.|Mentor/a esp.|Mentor/a %|Otros líderes resp.|Otros líderes esp.|Otros líderes %|Docentes resp.|Docentes esp.|Docentes %'
  && h[28] === 'Niveles sin docentes' && h[29] === '1° básico resp.' && h[30] === '1° básico cursos' && h[h.length - 1] === 'IV° medio cursos' && h.length === 29 + 2 * 12);
check('rows: school-programs with an EFA link or responses; Control left out', T.length === 6 && !!a && !!rl && !!f && !fila('33333', 'ASE'));
check('Respuestas = the portal total (dedup email + role)', (() => {
  const p = post({ rbd: '11111', clave: 'aaa111' }).programas, q = post({ rbd: '22222', clave: 'bbb222' }).programas;
  return a.Respuestas === p.find(x => x.programa === 'ase').efa.total && rl.Respuestas === p.find(x => x.programa === 'rel').efa.total
    && f.Respuestas === q.find(x => x.programa === 'ase').efa.total && a.Respuestas === 6 && rl.Respuestas === 5 && f.Respuestas === 4;
})());
check('responses by role: each counts in every role it declares ("todos" in 3, "ambos" in 2); EDI Equipo Directivo in Otros líderes; unknown option in Otros líderes',
  a['Director/a resp.'] === 1 && a['Mentor/a resp.'] === 1 && a['Docentes resp.'] === 3 && a['Encargado/a resp.'] === 0
  && rl['Encargado/a resp.'] === 2 && rl['Mentor/a resp.'] === 2 && rl['Docentes resp.'] === 3 && rl['Otros líderes resp.'] === 1
  && f['Otros líderes resp.'] === 1 && f['Docentes resp.'] === 2 && f['Director/a resp.'] === 0);
check('no role: no column; counted in Respuestas, in no role, only its count in the Respuestas note', !h.some(k => /sin rol/i.test(k)) && f['Respuestas'] === 1 + 1 + 2
  && /^1 respuesta sin rol: cuenta en Respuestas totales, pero no en la desagregación por rol\\.$/m.test(nota(22222, 'ASE', 'Respuestas')) && !/sin rol/.test(nota(11111, 'REL', 'Respuestas') || ''));
check('expected = SF contacts per role, as SF has them (repeats and no-email contacts count; multi-role in each role)',
  a['Contactos en SF (sin ajustes)'] === 9 && a['Director/a esp.'] === 1 && a['Encargado/a esp.'] === 2 && a['Mentor/a esp.'] === 1 && a['Otros líderes esp.'] === 1 && a['Docentes esp.'] === 4
  && rl['Contactos en SF (sin ajustes)'] === 5 && rl['Docentes esp.'] === 2 && rl['Mentor/a esp.'] === 1 && rl['Otros líderes esp.'] === 1 && f['Contactos en SF (sin ajustes)'] === 2 && f['Mentor/a esp.'] === 0);
check('% = resp. / esp., blank without contacts for the role', a['Docentes %'] === 0.75 && a['Director/a %'] === 1 && f['Mentor/a %'] === '' && rl['Encargado/a %'] === 2);
check('no Director/a or Encargado/a in SF: expected 1 (automatic, with a note); SF rules when it has any; other roles stay 0; never without the contacts tab', (() => {
  const auto = c => /^Esperado automático: Salesforce no tiene .* vigente para esta implementación, así que se asume 1\\./.test(nota(...c) || '');
  const x = fila('11111', 'ASE', sinContactos.tabs['Resumen']);
  return f['Director/a esp.'] === 1 && f['Encargado/a esp.'] === 1 && f['Encargado/a %'] === 0 && rl['Director/a esp.'] === 1
    && auto([22222, 'ASE', 'Director/a esp.']) && auto([22222, 'ASE', 'Encargado/a esp.']) && auto([11111, 'REL', 'Director/a esp.'])
    && /no tiene Encargado\\/a vigente/.test(nota(22222, 'ASE', 'Encargado/a esp.'))
    && a['Director/a esp.'] === 1 && !nota(11111, 'ASE', 'Director/a esp.') && a['Encargado/a esp.'] === 2 && !nota(11111, 'ASE', 'Encargado/a esp.')
    && !nota(22222, 'ASE', 'Mentor/a esp.') && x['Director/a esp.'] === '' && x['Encargado/a esp.'] === '';
})());
check('REL Cuadernillos: Encargado/a and Mentor/a expected 0 over SF (and over the automatic 1), noted; responses there noted; other roles and ASE untouched', (() => {
  const sf = Object.assign({}, d.sf), c = Object.assign({}, sf['11111']);
  c.programas = Object.assign({}, c.programas, { rel: Object.assign({}, c.programas.rel, { modelo: 'Cuadernillos' }) });
  const o = ctx.seguimientoEfa_(Object.assign({}, d, { sf: Object.assign({}, sf, { '11111': c }) }), s, reloj);
  const t = o.tabs['Resumen'], x = fila('11111', 'REL', t), y = fila('11111', 'ASE', t);
  const n = (prog, col) => (o.notas['Resumen'].find(([r, j]) => t[r][0] === 11111 && t[r][2] === prog && t[2][j] === col) || [])[2];
  return x.Modelo === 'Cuadernillos' && x['Encargado/a esp.'] === 0 && x['Mentor/a esp.'] === 0 && x['Encargado/a %'] === '' && x['Mentor/a %'] === ''
    && n('REL', 'Encargado/a esp.') === 'Encargados y mentores no responden EFA.' && n('REL', 'Mentor/a esp.') === 'Encargados y mentores no responden EFA.'
    && /^Encargados y mentores no responden EFA, pero hay \\d+ respuestas?\\.$/.test(n('REL', 'Encargado/a resp.') || '') && x['Encargado/a resp.'] > 0
    && x['Director/a esp.'] === rl['Director/a esp.'] && x['Docentes esp.'] === rl['Docentes esp.'] && x['Otros líderes esp.'] === rl['Otros líderes esp.']
    && y['Encargado/a esp.'] === a['Encargado/a esp.'] && !/no responden EFA/.test(n('ASE', 'Encargado/a esp.') || '');
})());
check('no Contactos EFA tab: Contactos en SF (sin ajustes), esp. and % blank, header note says why', (() => {
  const x = fila('11111', 'ASE', sinContactos.tabs['Resumen']), hd = sinContactos.tabs['Resumen'][2];
  return x['Contactos en SF (sin ajustes)'] === '' && x['Docentes esp.'] === '' && x['Docentes %'] === '' && x['Docentes resp.'] === 3
    && sinContactos.notas['Resumen'].some(([r, j, t]) => r === 2 && hd[j] === 'Contactos en SF (sin ajustes)' && /^Falta la pestaña Contactos EFA/.test(t));
})());
check('Correo enviado from Correos EFA (date only); logins since the EFA opened, internal views excluded; latest login',
  a['Correo enviado'] === '02-11-2026' && f['Correo enviado'] === '' && a['Ingresos desde la apertura'] === 1 && a['Último ingreso'] === '03-11-2026 10:00');
check('Compartió la EFA per program, deduplicated; Test shares and internal ones left out', a['Compartió la EFA'] === 'WhatsApp, QR' && rl['Compartió la EFA'] === 'link' && f['Compartió la EFA'] === '');
check('ASE docentes by grade: count per declared grade, CxN as cursos; outside the registered grades flagged; REL blank',
  a['5° básico resp.'] === 1 && a['5° básico cursos'] === 2 && a['I° medio resp.'] === 1 && a['I° medio cursos'] === 'Fuera de lo registrado'
  && a['1° básico resp.'] === 0 && f['5° básico resp.'] === 1 && f['6° básico resp.'] === 1 && f['4° básico resp.'] === 1 && f['1° básico resp.'] === ''
  && rl['5° básico resp.'] === '' && rl['Niveles sin docentes'] === '');
check('Niveles sin docentes: implemented grades with no docente (short labels)', a['Niveles sin docentes'] === '1°, 2°, 3°, 4°, 7°, 8°' && f['Niveles sin docentes'] === '7°, 8°, I°, II°, III°, IV°');
check('header notes: what Contactos en SF (sin ajustes), Respuestas, roles, Otros líderes and the grade block mean',
  /^Contactos vigentes de la implementación en el reporte de Salesforce .*tal como están\\. No es el total esperado/.test(notaEnc('Contactos en SF (sin ajustes)')) && /1 contacto no tiene colegio en Salesforce/.test(notaEnc('Contactos en SF (sin ajustes)'))
  && /No se muestran: 1 respuesta de un programa Control, 1 respuesta de un RBD que no está en SF \\(pruebas incluidas\\), 1 respuesta de un programa que el colegio no tiene en SF\\.$/.test(notaEnc('Respuestas'))
  && !out.notas['Resumen'].some(([r, c, t]) => r === 2 && /sin rol/.test(t)) && !notaEnc('Director/a resp.')
  && /Equipo Directivo/.test(notaEnc('Otros líderes resp.')) && /cursos = CxN en SF/.test(notaEnc('1° básico resp.')) && /desde el 02-11-2026/.test(notaEnc('Ingresos desde la apertura')));
check('note on Respuestas: several roles, repeats dropped', nota(11111, 'ASE', 'Respuestas') === '1 respuesta sin rol: cuenta en Respuestas totales, pero no en la desagregación por rol. La encuesta siempre pide el rol: revísala.\\n6 respuestas de 5 personas: 1 persona respondió más de una vez la encuesta, con un rol distinto cada vez; cada envío cuenta como una respuesta.\\nSe descartó 1 envío repetido (mismo correo y rol); de cada persona y rol cuenta el envío más reciente.');
check('note on Respuestas: "todos los roles", "ambos roles", unknown role, before the opening',
  nota(11111, 'REL', 'Respuestas') === '1 respuesta «Cumplo todos los roles» cuenta en las columnas Encargado/a, Mentor/a y Docentes; en Respuestas, una vez. La encuesta no le pregunta niveles.\\n'
  + '1 respuesta «Encargado/a y Mentor/a» cuenta en las columnas Encargado/a y Mentor/a; en Respuestas, una vez.\\nRol no reconocido «Inspector/a general»: cuenta en Otros líderes.\\n'
  + '1 respuesta anterior a la apertura (02-11-2026): posible prueba.');
check('no role: outside EFA-EDI "revísala(s)"; inside EFA-EDI only the count, never why', /revísala/.test(nota(11111, 'ASE', 'Respuestas')) && !/revísala|consent|acept|estudio/i.test(nota(22222, 'ASE', 'Respuestas')));
check('note on Docentes resp.: several grades and no grade; merged with another note on the same cell', nota(11111, 'ASE', 'Docentes resp.') === 'Docentes: 3. En los niveles suman 3: 1 declaró más de un nivel y cuenta en cada uno; 1 sin nivel declarado.'
  && nota(22222, 'ASE', 'Docentes resp.') === '1 sobre lo esperado (esperado: 1).\\nDocentes: 2. En los niveles suman 3: 1 declaró más de un nivel y cuenta en cada uno.'); // two notes on one cell: merged
check('notes per role: above what SF has; no SF contact with the role; no Encargado/a in SF',
  nota(11111, 'REL', 'Encargado/a resp.') === '1 sobre lo esperado (esperado: 1).' && nota(22222, 'ASE', 'Docentes resp.') !== undefined
  && nota(11111, 'REL', 'Docentes resp.') === '1 sobre lo esperado (esperado: 2).'
  && !nota(11111, 'ASE', 'Docentes resp.').includes('sobre lo esperado'));
check('notes on Contactos en SF (sin ajustes): repeated email (same role / one without role / two roles), no role, also in another school',
  nota(11111, 'ASE', 'Contactos en SF (sin ajustes)') === '1 correo aparece más de una vez con el mismo rol: cuenta cada vez. Si es la misma persona, corrígelo en Salesforce.\\n'
  + '1 contacto sin Rol en la Implementación en Salesforce: no cuenta en ningún esperado. Complétalo en Salesforce.\\n1 correo también aparece en otro colegio (RBD 22222).'
  && nota(11111, 'REL', 'Contactos en SF (sin ajustes)') === '1 correo aparece más de una vez, al menos una sin Rol en la Implementación. Si es la misma persona, corrígelo en Salesforce.\\n'
  + '1 correo tiene roles distintos en filas distintas («Docente y Mentor/a» y «Otro»): cuenta en cada rol. Si no corresponde, corrígelo en Salesforce.\\n1 contacto sin Rol en la Implementación en Salesforce: no cuenta en ningún esperado. Complétalo en Salesforce.');
check('note on a grade outside the registered ones', nota(11111, 'ASE', 'I° medio cursos') === 'Fuera de lo registrado: SF no tiene este nivel en el programa, pero 1 docente lo declaró.');
check('gray blocks: Director/a, Mentor/a, Docentes (3 columns each), then every other grade pair',
  out.formato['Resumen'].gris.slice(0, 9).map(c => h[c]).join() === 'Director/a resp.,Director/a esp.,Director/a %,Mentor/a resp.,Mentor/a esp.,Mentor/a %,Docentes resp.,Docentes esp.,Docentes %'
  && out.formato['Resumen'].gris.slice(9, 13).map(c => h[c]).join() === '1° básico resp.,1° básico cursos,3° básico resp.,3° básico cursos');
check('rows have the header width; RBD as a number', T.slice(3).every(r => r.length === h.length) && a.RBD === 11111);
check('notes point inside the tab (header row or below, column within the header)', out.notas['Resumen'].every(([r, c]) => r >= 2 && r < T.length && c < h.length));
check('no names or emails anywhere', !/@|Fuentes|Ríos|Ficticio|Acepta|Mella/.test(JSON.stringify(out)));
const filasR = T.slice(3).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
const sumaR = (filas, k) => filas.reduce((t, x) => t + (typeof x[k] === 'number' ? x[k] : 0), 0);
const ROLES = ['Director/a', 'Encargado/a', 'Mentor/a', 'Otros líderes', 'Docentes'];
// Free layout: tables found by their header row (label in B, "Implementaciones" in C); a table ends at the blank row
const bloques = t => {
  const res = [];
  for (let i = 3; i < t.length; i++) {
    if (t[i][2] !== 'Implementaciones') continue;
    const enc = t[i], filas = [];
    let j = i + 1;
    for (; j < t.length && t[j].length; j++) filas.push(Object.assign({ _fila: j }, Object.fromEntries(enc.map((k, c) => [k, t[j][c]]))));
    res.push({ titulo: (t[i - 1] || [])[1] || '', enc, filas });
    i = j;
  }
  return res;
};
const cuadra = (g, filas) => g.Implementaciones === filas.length && g['Impl. con al menos 1 respuesta'] === filas.filter(x => x.Respuestas > 0).length
  && g.Respuestas === sumaR(filas, 'Respuestas')
  && ROLES.every(r => g['% Avance ' + r] === (sumaR(filas, r + ' esp.') ? Math.min(1, Math.round(sumaR(filas, r + ' resp.') / sumaR(filas, r + ' esp.') * 1000) / 1000) : ''));
const TJ = out.tabs['Por JdP'], TP = out.tabs['Por programa'], BJ = bloques(TJ), BP = bloques(TP);
check('Por JdP laid out like 2025: status lines, title in B3, blank row, one table from column B (JdP rows + Total), footnote',
  /^Actualizado: /.test(TJ[0][0]) && TJ[2][0] === '' && TJ[2][1] === 'Resumen de respuestas por Jefe/a de Proyecto · EFA 2026' && !TJ[3].length
  && BJ.length === 1 && BJ[0].enc.join('|') === '|Jefe/a de Proyecto|Implementaciones|Impl. con al menos 1 respuesta|Respuestas|% Avance Director/a|% Avance Encargado/a|% Avance Mentor/a|% Avance Otros líderes|% Avance Docentes'
  && /^\\*% = respuestas del grupo ÷ contactos esperados en Salesforce/.test(TJ[TJ.length - 1][1]) && !TJ[TJ.length - 2].length);
check('Por JdP: one row per JdP (sorted) + Total; counts = sums of Resumen rows, % pooled (Σ resp. ÷ Σ esp.)', (() => {
  const f = BJ[0].filas, jdps = f.slice(0, -1).map(g => g['Jefe/a de Proyecto']);
  return f.length === new Set(filasR.map(x => x['Jefe/a de Proyecto'])).size + 1 && f[f.length - 1]['Jefe/a de Proyecto'] === 'Total'
    && JSON.stringify(jdps) === JSON.stringify(jdps.slice().sort((x, y) => ctx.compararTexto_(x, y)))
    && f.slice(0, -1).every(g => cuadra(g, filasR.filter(x => (x['Jefe/a de Proyecto'] || '(sin Jefe/a de Proyecto)') === g['Jefe/a de Proyecto'])))
    && cuadra(f[f.length - 1], filasR);
})());
check('Por programa: first table by group (ASE sin EDI, ASE EDI by cohort, REL, Total), then one table per group by modelo with its Total', (() => {
  const grp = x => (x.Programa === 'ASE' ? (x.EDI ? 'ASE EDI · cohorte 1 (2025)' : 'ASE sin EDI') : 'REL'); // fixture EDI school: Año inicio 2025
  const [g0, ...otras] = BP, resto = otras.filter(b => !/^EFA-EDI/.test(b.titulo));
  return TP[2][1] === 'Resumen de respuestas por Programa y Modelo · EFA 2026'
    && g0.titulo === 'Implementaciones por grupo' && g0.enc[1] === 'Grupo' && g0.filas.map(g => g.Grupo).join() === 'ASE sin EDI,ASE EDI · cohorte 1 (2025),REL,Total'
    && g0.filas.slice(0, -1).every(g => cuadra(g, filasR.filter(x => grp(x) === g.Grupo))) && cuadra(g0.filas[3], filasR)
    && resto.map(b => b.titulo).join() === 'Implementaciones ASE sin EDI por modelo,Implementaciones ASE EDI · cohorte 1 (2025) por modelo,Implementaciones REL por modelo'
    && resto.every(b => {
      const grupo = b.titulo.replace(/^Implementaciones /, '').replace(/ por modelo$/, ''), de = filasR.filter(x => grp(x) === grupo);
      return b.enc[1] === 'Modelo' && b.filas[b.filas.length - 1].Modelo === 'Total' && cuadra(b.filas[b.filas.length - 1], de)
        && b.filas.slice(0, -1).every(g => cuadra(g, de.filter(x => x.Modelo === g.Modelo)));
    })
    && /cohorte 1 = año de inicio 2025, cohorte 2 = 2026\\.$/.test(TP[TP.length - 1][1]);
})());
check('Por programa: EFA-EDI consents by cohort after the group table: responses, negative consents (no role), % in column F', (() => {
  const b = BP[1], f = b.filas, edi = filasR.filter(x => x.EDI);
  return b.titulo === 'EFA-EDI: consentimientos por cohorte'
    && b.enc.join('|') === '|Cohorte|Implementaciones|Respuestas EFA-EDI|Consentimientos negativos|% de consentimientos negativos'
    && f.length === 1 && f[0].Cohorte === 'ASE EDI · cohorte 1 (2025)' && f[0].Implementaciones === edi.length
    && f[0]['Respuestas EFA-EDI'] === sumaR(edi, 'Respuestas') && f[0]['Consentimientos negativos'] === 1
    && f[0]['% de consentimientos negativos'] === Math.round(1 / sumaR(edi, 'Respuestas') * 1000) / 1000
    && !out.notas['Por programa'].some(([r]) => r === f[0]._fila);
})());
check('EFA-EDI consents: one row per cohort + Total EFA-EDI when there are two cohorts; no table without EDI', (() => {
  const t = (dd, ss) => bloques(ctx.seguimientoEfa_(dd, ss, reloj).tabs['Por programa']).find(b => /^EFA-EDI/.test(b.titulo));
  const sf = Object.assign({}, d.sf), f = Object.assign({}, sf['22222']);
  f.programas = Object.assign({}, f.programas, { ase: Object.assign({}, f.programas.ase, { anioInicio: 2026 }) });
  const dos = t(Object.assign({}, d, { sf: Object.assign({}, sf, { '22222': f, '99999': sf['22222'] }) }), s);
  const sinEdi = t(Object.assign({}, d, { sf: Object.assign({}, sf, { '22222': Object.assign({}, f, { programas: Object.assign({}, f.programas, { ase: Object.assign({}, f.programas.ase, { edi: false }) }) }) }) }), s);
  const tot = dos && dos.filas[2];
  return !!dos && dos.filas.map(g => g.Cohorte).join() === 'ASE EDI · cohorte 1 (2025),ASE EDI · cohorte 2 (2026),Total EFA-EDI'
    && tot.Implementaciones === 2 && tot['Respuestas EFA-EDI'] === 4 && tot['Consentimientos negativos'] === 1 && tot['% de consentimientos negativos'] === 0.25 && !sinEdi;
})());
check('summary tabs: free layout, % columns (F–J) as percent; no bands', ['Por JdP', 'Por programa'].every(n => out.formato[n].libre === true
  && out.formato[n].pct.join() === '5,6,7,8,9' && out.formato[n].patron === '0.00%' && !out.formato[n].gris && out.formato['Resumen'].patron === '0.00%' && out.tabs[n].every(r => r.slice(5, 10).every(v => v === '' || typeof v === 'number' || /^% /.test(v)))));
check('summary tabs: no-role count only as a note on Respuestas of the rows that have it (Total included)', (() => {
  const n = out.notas['Por JdP'].filter(([, c]) => c === 4);
  return !TJ.some(r => r.some(v => /sin rol/i.test(v))) && n.length >= 1 && n.every(([r, c, x]) => c === 4 && TJ[r][4] >= 1
    && /^\\d+ respuestas? sin rol: cuentan? en Respuestas totales, pero no en la desagregación por rol\\.$/.test(x))
    && n.some(([r]) => TJ[r][1] === 'Total') && out.notas['Por programa'].filter(([, c]) => c < 5).every(([r, c]) => c === 4 && typeof TP[r][4] === 'number');
})());
check('summary %: capped at 100%; Por JdP notes the real % and why; Por programa notes the real %, how many schools and JdPs, and where to look', (() => {
  const f = BJ[0].filas, tot = f[f.length - 1];
  const capped = ROLES.filter(r => sumaR(filasR, r + ' resp.') > sumaR(filasR, r + ' esp.') && sumaR(filasR, r + ' esp.') > 0);
  const notaEn = (fila, r) => (out.notas['Por JdP'].find(([x, c]) => x === fila && c === 5 + ROLES.indexOf(r)) || [])[2];
  const sobre = r => filasR.filter(x => x[r + ' resp.'] > (x[r + ' esp.'] || 0)).length;
  return capped.length >= 1 && capped.every(r => tot['% Avance ' + r] === 1
      && notaEn(tot._fila, r) === 'Se muestra 100%, pero el cálculo da ' + String(Math.round(sumaR(filasR, r + ' resp.') / sumaR(filasR, r + ' esp.') * 10000) / 100).replace('.', ',')
        + '% (' + sumaR(filasR, r + ' resp.') + ' respuestas de ' + r + ' sobre ' + sumaR(filasR, r + ' esp.') + ' esperados): en ' + sobre(r) + (sobre(r) === 1 ? ' colegio hay' : ' colegios hay')
        + ' más respuestas que contactos de Salesforce con ese rol.')
    && ROLES.filter(r => capped.indexOf(r) < 0).every(r => !notaEn(tot._fila, r))
    && BP.every(b => b.filas.every(g => ROLES.every(r => g['% Avance ' + r] === undefined || g['% Avance ' + r] === '' || g['% Avance ' + r] <= 1)))
    && capped.every(r => {
      const totP = BP[0].filas[BP[0].filas.length - 1], jd = new Set(filasR.filter(x => x[r + ' resp.'] > (x[r + ' esp.'] || 0)).map(x => x['Jefe/a de Proyecto'])).size;
      const n = (out.notas['Por programa'].find(([x, c]) => x === totP._fila && c === 5 + ROLES.indexOf(r)) || [])[2];
      return totP['% Avance ' + r] === 1 && n === 'Se muestra 100%, pero el cálculo da ' + String(Math.round(sumaR(filasR, r + ' resp.') / sumaR(filasR, r + ' esp.') * 10000) / 100).replace('.', ',')
        + '%. Hay ' + sobre(r) + (sobre(r) === 1 ? ' colegio' : ' colegios') + ' con más respuestas que contactos de Salesforce con ese rol (de ' + jd
        + (jd === 1 ? ' Jefe/a de Proyecto' : ' Jefes/as de Proyecto') + '); el detalle está en Resumen.';
    });
})());
check('summary tabs without Contactos EFA: % blank, counts kept', (() => {
  const t = sinContactos.tabs['Por JdP'], f = bloques(t)[0].filas, tot = f[f.length - 1];
  return ROLES.every(r => tot['% Avance ' + r] === '') && typeof tot.Respuestas === 'number' && tot.Respuestas > 0;
})());
check('EFA responses unreadable → null (keep the previous tracker)', ctx.seguimientoEfa_(Object.assign({}, d, { efa: null }), s, reloj) === null);
check('counts in the notes: one person with three roles is 1 persona; three roles for one email and two other schools read right', (() => {
  const nR = sheets['Respuestas EFA'].length, nC = sheets['Contactos EFA'].length;
  const REL = 'Docente que implementa el Programa de Religión de Trabün';
  sheets['Respuestas EFA'].push(['ASE Semi-intensivo', '2026-11-03T17:00:00', 'Tres', 'Roles', 'tres@ejemplo.cl', FARO, 'Director/a del establecimiento', '-'],
    ['ASE Semi-intensivo', '2026-11-03T17:05:00', 'Tres', 'Roles', 'tres@ejemplo.cl', FARO, 'Mentor/a, es decir, acompaño y retroalimento a docentes que implementan el Programa', '-'],
    ['ASE Semi-intensivo', '2026-11-03T17:10:00', 'Tres', 'Roles', 'tres@ejemplo.cl', FARO, 'Otro/a líder', '-']);
  sheets['Contactos EFA'].push(contacto(FARO, 'ASE', 'Director/a', 'x3@ejemplo.invalid'), contacto(FARO, 'ASE', 'Mentor/a', 'x3@ejemplo.invalid'), contacto(FARO, 'ASE', 'Otro', 'x3@ejemplo.invalid'),
    contacto(FARO, 'ASE', '', 'sr2@ejemplo.invalid'), contacto(FARO, 'ASE', '', 'sr2@ejemplo.invalid'),
    contacto(AROMOS, 'ASE', 'Docente', 'c11@ejemplo.invalid'), contacto('Cerro Falso - Liceo Control - 33333', 'ASE', 'Docente', 'c11@ejemplo.invalid'));
  const o = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj), TT = o.tabs['Resumen'], hh = TT[2];
  const n = c => (o.notas['Resumen'].find(([r, j]) => TT[r][0] === 22222 && TT[r][2] === 'ASE' && hh[j] === c) || [])[2] || '';
  sheets['Respuestas EFA'].length = nR; sheets['Contactos EFA'].length = nC;
  const R = n('Respuestas'), C = n('Contactos en SF (sin ajustes)');
  return / personas: 1 persona respondió más de una vez la encuesta, con un rol distinto cada vez/.test(R)
    && C.includes('1 correo tiene roles distintos en filas distintas («Director/a» y «Mentor/a» y «Otro»): cuenta en cada rol')
    && C.includes('1 correo aparece más de una vez, siempre sin Rol en la Implementación') && !C.includes('mismo rol')
    && C.includes('en otros colegios (RBD 11111, 33333)');
})());
check('Ajustes EFA tab: expected set by role over SF and the automatic 1, note with the SF count and the reason; a grade row leaves Niveles sin docentes, with a note; unreadable rows skipped', (() => {
  sheets['Ajustes EFA'] = [['RBD', 'Programa', 'Rol', 'Esperado', 'Motivo', 'Pedido por'],
    [11111, 'Religión', 'Director/a', 0, 'Cargo vacante.', 'x'], [11111, 'ASE', '7° básico', '', 'Docente con licencia', 'x'],
    [11111, 'ASE', 'Docentes', -1, 'negativo: se ignora', ''], [11111, '', 'Mentor/a', 0, 'sin programa: se ignora', ''], ['', 'ASE', 'Mentor/a', 0, '', '']];
  const o = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj), TT = o.tabs['Resumen'], hh = TT[2];
  delete sheets['Ajustes EFA'];
  const r = TT.find(x => x[0] === 11111 && x[2] === 'REL'), fila = TT.indexOf(r), ra = TT.find(x => x[0] === 11111 && x[2] === 'ASE'), filaA = TT.indexOf(ra);
  const n = (fl, c) => (o.notas['Resumen'].find(([f, j]) => f === fl && hh[j] === c) || [])[2] || '';
  return r[hh.indexOf('Director/a esp.')] === 0 && n(fila, 'Director/a esp.') === 'Esperado ajustado a 0 (en Salesforce: 0): Cargo vacante. Ajuste acordado en la pestaña Ajustes EFA.'
    && !/automático/.test(n(fila, 'Director/a esp.')) && ra[hh.indexOf('Director/a esp.')] !== 0
    && a['Niveles sin docentes'].split(', ').indexOf('7°') >= 0 && ra[hh.indexOf('Niveles sin docentes')].split(', ').indexOf('7°') < 0
    && /^No se esperan respuestas de docentes en este nivel: Docente con licencia\./.test(n(filaA, '7° básico resp.'))
    && ra[hh.indexOf('Docentes esp.')] === a['Docentes esp.'] && ra[hh.indexOf('Mentor/a esp.')] === a['Mentor/a esp.'];
})());
check('no Ajustes EFA tab: nothing adjusted', ctx.datosSeguimiento_().ajustes && !Object.keys(ctx.datosSeguimiento_().ajustes).length);
check('regular program: someone with several SF roles who answered once counts in all of them (a lower role too; by email, else first name + first surname); once per role; noted', (() => {
  const nR = sheets['Respuestas EFA'].length, nC = sheets['Contactos EFA'].length;
  sheets['Contactos EFA'].push([AROMOS, 'Cuenta Ficticia', 'ASE', 'x', 'False', '', 'x', 'Pía Andrea', 'Prueba Uno', 'Encargado/a, Docente y Mentor/a', 'pp@ejemplo.invalid', 'True', '']);
  sheets['Respuestas EFA'].push(['ASE Semi-intensivo', '2026-11-03T17:00:00', 'Mentora', 'Encargada', 'c3@ejemplo.invalid', AROMOS, 'Mentor/a, es decir, acompaño y retroalimento a docentes', '-'],
    ['ASE Semi-intensivo', '2026-11-03T17:01:00', 'Mentora', 'Encargada', 'c3@ejemplo.invalid', AROMOS, 'Encargado/a del Programa', '-'],
    ['ASE Semi-intensivo', '2026-11-03T17:02:00', 'pia', 'prueba dos', 'otro.correo@ejemplo.invalid', AROMOS, 'Encargado/a del Programa', '-'],
    ['ASE Semi-intensivo', '2026-11-03T17:03:00', 'Otro', 'Rol', 'c5@ejemplo.invalid', AROMOS, 'Otro/a líder del establecimiento', '-']);
  const o = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj), TT = o.tabs['Resumen'], hh = TT[2];
  sheets['Respuestas EFA'].length = nR; sheets['Contactos EFA'].length = nC;
  const r = TT.find(x => x[0] === 11111 && x[2] === 'ASE'), fila = TT.indexOf(r), v = c => r[hh.indexOf(c)];
  const n = c => (o.notas['Resumen'].find(([f, j]) => f === fila && hh[j] === c) || [])[2] || '';
  return v('Encargado/a resp.') === a['Encargado/a resp.'] + 2 && v('Mentor/a resp.') === a['Mentor/a resp.'] + 2 && v('Docentes resp.') === a['Docentes resp.'] + 1
    && v('Otros líderes resp.') === a['Otros líderes resp.'] + 1 // SF says Docente, answered Otro/a líder: no SF role answered, nothing added
    && /1 persona cuenta aquí por su rol en Salesforce/.test(n('Docentes resp.')) && /1 persona cuenta aquí/.test(n('Mentor/a resp.')) // c3 answered Mentor/a herself; pp is the one added
    && v('Respuestas') === a['Respuestas'] + 4;
})());
check('Destinatarios «Ajustes internos» = SÍ only where someone counts in a role they did not mark', (() => {
  const nC = sheets['Contactos EFA'].length;
  sheets['Encargados'] = [['Nombre para formulario', 'ID RBD', 'Programa que participa', 'Account Name', 'First Name', 'Last Name', 'Email'], [FARO, 22222, 'ASE', 'x', 'ana', 'x', 'ana@ejemplo.invalid']];
  const sin = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj).tabs['Destinatarios'];
  sheets['Contactos EFA'].push(contacto(FARO, 'ASE', 'Docente', 'na@ejemplo.cl'));
  const con = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj).tabs['Destinatarios'];
  sheets['Contactos EFA'].length = nC; delete sheets['Encargados'];
  const flag = D => D.find(x => x[0] === 22222)[D[2].indexOf('Ajustes internos')];
  return flag(sin) === '' && flag(con) === 'SÍ' && con.find(x => x[0] === 11111)[con[2].indexOf('Ajustes internos')] === '';
})());
check('EFA-EDI: no role → SF roles; a leader response → their SF leader roles instead of the one picked (Mover); teacher of an EDI grade → also leader (not outside EDI grades); consents table unchanged', (() => {
  const nC = sheets['Contactos EFA'].length, nR = sheets['Respuestas EFA'].length;
  sheets['Contactos EFA'].push(contacto(FARO, 'ASE', 'Docente', 'na@ejemplo.cl'), contacto(FARO, 'ASE', 'Director/a', 'ed@ejemplo.cl'),
    contacto(FARO, 'ASE', 'Docente y Mentor/a', 'vn@ejemplo.cl'), contacto(FARO, 'ASE', 'Docente y Mentor/a', 'un@ejemplo.cl'),
    contacto(FARO, 'ASE', 'Mentor/a y Encargado/a', 'em@ejemplo.cl'));
  sheets['Respuestas EFA'].push(['EFA_EDI', '2026-11-03T10:40:00', 'Encargada', 'Mentora', 'em@ejemplo.cl', FARO, 'Soy Encargado del programa, es decir, estoy a cargo', '-']);
  const o = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj), TT = o.tabs['Resumen'], hh = TT[2];
  sheets['Contactos EFA'].length = nC; sheets['Respuestas EFA'].length = nR;
  const r = TT.find(x => x[0] === 22222 && x[2] === 'ASE'), fila = TT.indexOf(r), v = c => r[hh.indexOf(c)];
  const n = c => (o.notas['Resumen'].find(([fl, j]) => fl === fila && hh[j] === c) || [])[2] || '';
  const neg = t => { const P = t.tabs['Por programa'], i = P.findIndex(x => /consentimientos por cohorte/.test(x[1] || '')); // negative consents only
    return i >= 0 && P.slice(i + 2).filter(x => /EDI/.test(x[1] || '')).map(x => x[4]).join('|'); };
  return v('Docentes resp.') === f['Docentes resp.'] + 1 && v('Director/a resp.') === f['Director/a resp.'] + 1 && v('Otros líderes resp.') === f['Otros líderes resp.'] - 1 // ed: picked Equipo Directivo, SF Director/a → moved
    && v('Encargado/a resp.') === f['Encargado/a resp.'] + 1
    && v('Mentor/a resp.') === f['Mentor/a resp.'] + 2 // em (answered Encargado, SF also Mentor/a); vn (5° and 6°: EDI grades of cohort 2025) yes, un (4° only) no
    && /1 respuesta sin rol cuenta según el rol de la persona en Salesforce/.test(n('Respuestas')) && !/sin rol: cuenta en Respuestas totales/.test(n('Respuestas'))
    && neg(o) === neg(out) && v('Respuestas') === f['Respuestas'] + 1;
})());
check('Destinatarios: no Encargados tab → not written', !out.tabs['Destinatarios']);
check('Destinatarios: one row per school and JdP with recipients, CC (coordinator, never the JdP), clave, EFA window; header on row 3', (() => {
  sheets['Encargados'] = [['Nombre para formulario', 'ID RBD', 'Programa que participa', 'Account Name', 'First Name', 'Last Name', 'Email'],
    [AROMOS, 11111, 'ASE', 'x', 'MARÍA', 'x', 'mj@ejemplo.invalid'], [AROMOS, 11111, 'Religión', 'x', 'pedro', 'x', 'pedro@ejemplo.invalid'],
    [FARO, 22222, 'ASE', 'x', 'ana', 'x', 'ana@ejemplo.invalid']];
  sheets['correos_jdp'] = [['jdp/ci', 'correo'], ['x', 'jdp.x@ejemplo.invalid'], ['Coordinadora Uno', 'coord@ejemplo.invalid']];
  const sf = sheets['SF'].find(r => r[0] === 11111 && r[3] === 'Religión'), iC = sheets['SF'][0].indexOf('Coordinador'), antes = sf[iC];
  sf[iC] = 'Coordinadora Uno';
  const o = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj), D = o.tabs['Destinatarios'];
  sf[iC] = antes; delete sheets['Encargados']; delete sheets['correos_jdp'];
  const h = D[2], row = rbd => { const r = D.find(x => x[0] === rbd); return r && Object.fromEntries(h.map((k, i) => [k, r[i]])); };
  const a = row(11111), f = row(22222);
  return h.join('|') === 'RBD|Colegio|Programas|Jefe/a de Proyecto|Correo JdP|Para|Nombres|CC|Clave|Cierre EFA|Fase EFA|Ajustes internos|Observaciones'
    && /^Actualizado/.test(D[0][0]) && a.Programas === 'ASE + REL' && a['Correo JdP'] === 'jdp.x@ejemplo.invalid' && a.Para === 'mj@ejemplo.invalid, pedro@ejemplo.invalid'
    && a.Nombres === 'María, Pedro' && a.CC === 'coord@ejemplo.invalid' && a.Clave === 'aaa111' && a['Cierre EFA'] === '2026-11-13' && a['Fase EFA'] === 'open' && a['Ajustes internos'] === '' && a.Observaciones === ''
    && f.Para === 'ana@ejemplo.invalid' && f.Clave === 'bbb222' && !D.some(r => r[0] === 33333) && o.notas['Destinatarios'].length === 0;
})());
check('Destinatarios: programs with different JdPs → one row each; missing JdP email and encargado flagged', (() => {
  sheets['Encargados'] = [['Nombre para formulario', 'ID RBD', 'Programa que participa', 'Account Name', 'First Name', 'Last Name', 'Email']];
  sheets['correos_jdp'] = [['jdp/ci', 'correo'], ['x', 'jdp.x@ejemplo.invalid']];
  const sf = sheets['SF'].find(r => r[0] === 11111 && r[3] === 'Religión'), iJ = sheets['SF'][0].indexOf('Jefe de Proyecto'), antes = sf[iJ];
  sf[iJ] = 'Otra Jefa';
  const D = ctx.seguimientoEfa_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), reloj).tabs['Destinatarios'];
  sf[iJ] = antes; delete sheets['Encargados']; delete sheets['correos_jdp'];
  const r = D.filter(x => x[0] === 11111);
  return r.length === 2 && r.some(x => x[2] === 'ASE' && x[3] === 'x') && r.some(x => x[2] === 'REL' && x[3] === 'Otra Jefa' && /Sin correo en correos_jdp para Otra Jefa/.test(x[12]) && /Sin encargado/.test(x[12]));
})());
check('the Test tracker is unchanged by the EFA sources', Object.keys(ctx.seguimiento_(d, s, reloj).tabs).join() === 'Resumen,Por curso');
`);
