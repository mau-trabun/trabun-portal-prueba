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
  && h.slice(0, 13).join('|') === 'RBD|Colegio|Programa|Modelo|EDI|Jefe/a de Proyecto|Coordinador/a|Correo enviado|Ingresos desde la apertura|Último ingreso|Compartió la EFA|Contactos SF|Respuestas'
  && h.slice(13, 28).join('|') === 'Director/a resp.|Director/a esp.|Director/a %|Encargado/a resp.|Encargado/a esp.|Encargado/a %|Mentor/a resp.|Mentor/a esp.|Mentor/a %|Otros líderes resp.|Otros líderes esp.|Otros líderes %|Docentes resp.|Docentes esp.|Docentes %'
  && h[28] === 'Niveles sin docentes' && h[29] === '1° básico doc.' && h[30] === '1° básico cursos' && h[h.length - 1] === 'IV° medio cursos' && h.length === 29 + 2 * 12);
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
  a['Contactos SF'] === 9 && a['Director/a esp.'] === 1 && a['Encargado/a esp.'] === 2 && a['Mentor/a esp.'] === 1 && a['Otros líderes esp.'] === 1 && a['Docentes esp.'] === 4
  && rl['Contactos SF'] === 5 && rl['Docentes esp.'] === 2 && rl['Mentor/a esp.'] === 1 && rl['Otros líderes esp.'] === 1 && f['Contactos SF'] === 2 && f['Mentor/a esp.'] === 0);
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
check('no Contactos EFA tab: Contactos SF, esp. and % blank, header note says why', (() => {
  const x = fila('11111', 'ASE', sinContactos.tabs['Resumen']), hd = sinContactos.tabs['Resumen'][2];
  return x['Contactos SF'] === '' && x['Docentes esp.'] === '' && x['Docentes %'] === '' && x['Docentes resp.'] === 3
    && sinContactos.notas['Resumen'].some(([r, j, t]) => r === 2 && hd[j] === 'Contactos SF' && /^Falta la pestaña Contactos EFA/.test(t));
})());
check('Correo enviado from Correos EFA (date only); logins since the EFA opened, internal views excluded; latest login',
  a['Correo enviado'] === '02-11-2026' && f['Correo enviado'] === '' && a['Ingresos desde la apertura'] === 1 && a['Último ingreso'] === '03-11-2026 10:00');
check('Compartió la EFA per program, deduplicated; Test shares and internal ones left out', a['Compartió la EFA'] === 'WhatsApp, QR' && rl['Compartió la EFA'] === 'link' && f['Compartió la EFA'] === '');
check('ASE docentes by grade: count per declared grade, CxN as cursos; outside the registered grades flagged; REL blank',
  a['5° básico doc.'] === 1 && a['5° básico cursos'] === 2 && a['I° medio doc.'] === 1 && a['I° medio cursos'] === 'Fuera de lo registrado'
  && a['1° básico doc.'] === 0 && f['5° básico doc.'] === 1 && f['6° básico doc.'] === 1 && f['4° básico doc.'] === 1 && f['1° básico doc.'] === ''
  && rl['5° básico doc.'] === '' && rl['Niveles sin docentes'] === '');
check('Niveles sin docentes: implemented grades with no docente (short labels)', a['Niveles sin docentes'] === '1°, 2°, 3°, 4°, 7°, 8°' && f['Niveles sin docentes'] === '7°, 8°, I°, II°, III°, IV°');
check('header notes: what Contactos SF, Respuestas, roles, Otros líderes and the grade block mean',
  /^Contactos vigentes en Salesforce/.test(notaEnc('Contactos SF')) && /1 contacto no tiene colegio en Salesforce/.test(notaEnc('Contactos SF'))
  && /No se muestran: 1 respuesta de un programa Control, 1 respuesta de un RBD que no está en SF \\(pruebas incluidas\\), 1 respuesta de un programa que el colegio no tiene en SF\\.$/.test(notaEnc('Respuestas'))
  && !out.notas['Resumen'].some(([r, c, t]) => r === 2 && /sin rol/.test(t)) && !notaEnc('Director/a resp.')
  && /Equipo Directivo/.test(notaEnc('Otros líderes resp.')) && /cursos = CxN en SF/.test(notaEnc('1° básico doc.')) && /desde el 02-11-2026/.test(notaEnc('Ingresos desde la apertura')));
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
check('notes on Contactos SF: repeated email (same role / one without role / two roles), no role, also in another school',
  nota(11111, 'ASE', 'Contactos SF') === '1 correo aparece más de una vez con el mismo rol: cuenta cada vez. Si es la misma persona, corrígelo en Salesforce.\\n'
  + '1 contacto sin Rol en la Implementación en Salesforce: no cuenta en ningún esperado. Complétalo en Salesforce.\\n1 correo también aparece en otro colegio (RBD 22222).'
  && nota(11111, 'REL', 'Contactos SF') === '1 correo aparece más de una vez, al menos una sin Rol en la Implementación. Si es la misma persona, corrígelo en Salesforce.\\n'
  + '1 correo tiene roles distintos en filas distintas («Docente y Mentor/a» y «Otro»): cuenta en cada rol. Si no corresponde, corrígelo en Salesforce.\\n1 contacto sin Rol en la Implementación en Salesforce: no cuenta en ningún esperado. Complétalo en Salesforce.');
check('note on a grade outside the registered ones', nota(11111, 'ASE', 'I° medio cursos') === 'Fuera de lo registrado: SF no tiene este nivel en el programa, pero 1 docente lo declaró.');
check('gray blocks: Director/a, Mentor/a, Docentes (3 columns each), then every other grade pair',
  out.formato['Resumen'].gris.slice(0, 9).map(c => h[c]).join() === 'Director/a resp.,Director/a esp.,Director/a %,Mentor/a resp.,Mentor/a esp.,Mentor/a %,Docentes resp.,Docentes esp.,Docentes %'
  && out.formato['Resumen'].gris.slice(9, 13).map(c => h[c]).join() === '1° básico doc.,1° básico cursos,3° básico doc.,3° básico cursos');
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
  && ROLES.every(r => g['% Avance ' + r] === (sumaR(filas, r + ' esp.') ? Math.round(sumaR(filas, r + ' resp.') / sumaR(filas, r + ' esp.') * 1000) / 1000 : ''));
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
  const n = out.notas['Por JdP'];
  return !TJ.some(r => r.some(v => /sin rol/i.test(v))) && n.length >= 1 && n.every(([r, c, x]) => c === 4 && TJ[r][4] >= 1
    && /^\\d+ respuestas? sin rol: cuentan? en Respuestas totales, pero no en la desagregación por rol\\.$/.test(x))
    && n.some(([r]) => TJ[r][1] === 'Total') && out.notas['Por programa'].every(([r, c]) => c === 4 && typeof TP[r][4] === 'number');
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
  const R = n('Respuestas'), C = n('Contactos SF');
  return / personas: 1 persona respondió más de una vez la encuesta, con un rol distinto cada vez/.test(R)
    && C.includes('1 correo tiene roles distintos en filas distintas («Director/a» y «Mentor/a» y «Otro»): cuenta en cada rol')
    && C.includes('1 correo aparece más de una vez, siempre sin Rol en la Implementación') && !C.includes('mismo rol')
    && C.includes('en otros colegios (RBD 11111, 33333)');
})());
check('the Test tracker is unchanged by the EFA sources', Object.keys(ctx.seguimiento_(d, s, reloj).tabs).join() === 'Resumen,Por curso');
`);
