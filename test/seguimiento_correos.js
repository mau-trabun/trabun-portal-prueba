// Tests gas-seguimiento/Code.js (the Seguimiento EFA tracker's script: progress emails → Gmail drafts of whoever runs
// it, built at click time from Resumen + Destinatarios). Fictional schools and people only.
// Run from the repo root: node test/seguimiento_correos.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas-seguimiento', 'Code.js'), 'utf8');
const { formatDate } = require('../cloudrun/app');
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const ROLES = ['Director/a', 'Encargado/a', 'Mentor/a', 'Otros líderes', 'Docentes'];
const estado = [['Actualizado: 06-11-2026 14:30'], ['Actualización automática cada 2 minutos…']];
const DEST = ['RBD', 'Colegio', 'Programas', 'Jefe/a de Proyecto', 'Correo JdP', 'Para', 'Nombres', 'CC', 'Clave', 'Cierre EFA', 'Fase EFA', 'Observaciones'];
const RES = ['RBD', 'Colegio', 'Programa'].concat([].concat.apply([], ROLES.map(r => [r + ' resp.', r + ' esp.', r + ' %'])));
const res = (rbd, prog, pares) => [rbd, 'x', prog].concat([].concat.apply([], pares.map(([r, e]) => [r, e, ''])));
let sheets, borradores, logs, yo;
const reset = () => {
  sheets = {
    Resumen: estado.concat([RES,
      res(11111, 'ASE', [[1, 1], [0, 1], [1, 0], [0, 0], [3, 4]]), res(11111, 'REL', [[0, 1], [1, 1], [0, 0], [0, 0], [2, '']]),
      res(22222, 'ASE', [[1, 1], [1, 1], [0, 1], [0, 0], [5, 10]])]),
    Destinatarios: estado.concat([DEST,
      [11111, 'Colegio Los Aromos', 'ASE + REL', 'Ana Jefa', 'ana.jefa@ejemplo.invalid', 'mj@ejemplo.invalid, pedro@ejemplo.invalid', 'María, Pedro', 'coord@ejemplo.invalid', 'aaa111', '2026-11-13', 'open', ''],
      [22222, 'Escuela El Faro', 'ASE', 'Ana Jefa', 'ana.jefa@ejemplo.invalid', 'ana@ejemplo.invalid', 'Ana', '', 'bbb222', '2026-11-13', 'open', ''],
      [33333, 'Liceo Sin Encargado', 'REL', 'Beto Jefe', 'beto@ejemplo.invalid', '', '', '', 'ccc333', '2026-11-13', 'open', 'Sin encargado en la pestaña Encargados']]),
  };
  borradores = []; logs = []; yo = 'ana.jefa@ejemplo.invalid';
};
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] ? { getDataRange: () => ({ getValues: () => sheets[n].map(r => r.slice()) }) } : null }),
    getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), showModalDialog: () => {} }) },
  Session: { getActiveUser: () => ({ getEmail: () => yo }) },
  GmailApp: { createDraft: (to, subject, body, o) => borradores.push({ to, subject, body, o }) },
  HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
  Utilities: { newBlob: (b, t, n) => ({ b, t, n }), base64Decode: b => Buffer.from(b, 'base64'), formatDate },
  console: { log: (...a) => logs.push(a.join(' ')) },
  Array, Set, String, Object, JSON, Number, Math, Date,
};
vm.createContext(ctx); vm.runInContext(src, ctx);

reset();
const d = ctx.datosDialogoAvance();
check('dialog: JdPs sorted, the runner\'s JdP preselected by email, tracker update time', d.jdps.join('|') === 'Ana Jefa|Beto Jefe' && d.miJdp === 'Ana Jefa' && d.actualizado === '06-11-2026 14:30');
check('dialog data carries no emails or claves', !/@|aaa111|bbb222|ccc333/.test(JSON.stringify(d)));
check('dialog: a row without encargado is not ready and shows why', d.filas.find(f => f.clave === '33333|REL').listo === false && /Sin encargado/.test(d.filas.find(f => f.clave === '33333|REL').obs));
yo = 'otra@ejemplo.invalid';
check('dialog: someone who is not a JdP gets no preselection', ctx.datosDialogoAvance().miJdp === '');

reset();
const msg = ctx.generarBorradoresAvance(['11111|ASE + REL', '22222|ASE', '33333|REL']);
const b1 = borradores.find(b => /Los Aromos/.test(b.subject)), b2 = borradores.find(b => /El Faro/.test(b.subject));
check('drafts only for the selected ready rows (never sends); a not-ready row is skipped and named', borradores.length === 2 && /Borradores creados: 2/.test(msg) && /Liceo Sin Encargado/.test(msg));
check('draft: To = encargados, CC = coordinator, subject; no CC option when empty; logo inline', b1.to === 'mj@ejemplo.invalid,pedro@ejemplo.invalid' && b1.o.cc === 'coord@ejemplo.invalid'
  && b1.subject === 'Avance Encuesta de Fin de Año 2026 · Colegio Los Aromos' && !('cc' in b2.o) && b1.o.inlineImages.logo.t === 'image/png' && b1.o.inlineImages.logo.b.length > 1000);
check('numbers from Resumen per program, % rounded, «—» without expected; nothing-expected-no-responses roles left out',
  b1.body.includes('Aprendizaje Socioemocional:\n• Director/a: 1 de 1 (100%)\n• Encargado/a: 0 de 1 (0%)\n• Mentor/a: 1 de 0 (—)\n• Docentes: 3 de 4 (75%)')
  && b1.body.includes('Religión Católica:\n• Director/a: 0 de 1 (0%)\n• Encargado/a: 1 de 1 (100%)\n• Docentes: 2 de — (—)') && !/Otros líderes:/.test(b1.body));
check('JdP voice, plural / singular, closing date, signed by the JdP, no automatic footer', b1.body.includes('Les comparto cómo va la Encuesta de Fin de Año en Colegio Los Aromos')
  && b1.body.includes('abierta hasta el viernes 13 de noviembre') && b1.body.includes('avísenme para actualizarlo') && /Ana Jefa\nFundación Trabün$/.test(b1.body)
  && b2.body.includes('Te comparto cómo va') && b2.body.includes('avísame para actualizarlo') && !/automático/.test(b1.body + b1.o.htmlBody));
check('portal access: RBD + clave in text and html; html tables without red', b1.body.includes('Entren al portal con estos datos:\nRBD: 11111\nClave: aaa111') && b1.o.htmlBody.includes('aaa111')
  && (() => { const h = b1.o.htmlBody, t = h.slice(h.indexOf('>Rol<'), h.indexOf('</table>', h.indexOf('>Rol<'))); return /Esperadas/.test(t) && !/b51a2a/i.test(t); })() && /Ana Jefa<br>Fundación Trabün/.test(b1.o.htmlBody));
reset();
sheets.Resumen[5] = res(22222, 'ASE', [[1, 1], [1, 1], [0, 1], [0, 0], [9, 10]]); // the tracker moved on: 9 docentes now
ctx.generarBorradoresAvance(['22222|ASE']);
check('numbers are read at click time (the tracker changed → the draft shows the new count)', borradores[0].body.includes('• Docentes: 9 de 10 (90%)'));
check('log: counts only, never emails or claves', !/@|aaa111|bbb222/.test(logs.join(' ')));
reset(); sheets.Destinatarios = estado.concat([['RBD', 'Colegio']]);
check('Destinatarios without its columns → clear error, no drafts', (() => { try { ctx.generarBorradoresAvance(['11111|ASE']); return false; } catch (e) { return /columnas esperadas/.test(e.message) && borradores.length === 0; } })());
reset(); delete sheets.Resumen;
check('missing Resumen → clear error', (() => { try { ctx.generarBorradoresAvance(['11111|ASE + REL']); return false; } catch (e) { return /Falta la pestaña «Resumen»/.test(e.message); } })());
reset(); sheets.Destinatarios[4][9] = '2026-11-20'; sheets.Destinatarios[4][10] = 'extra';
ctx.generarBorradoresAvance(['22222|ASE']);
check('extra week: says so with the real closing date, still asks to remind', borradores.length === 1
  && borradores[0].body.includes('La encuesta tiene una semana extra: sigue abierta hasta el') && /20 de noviembre/.test(borradores[0].body)
  && borradores[0].body.includes('les pido recordárselo') === false && /recordárselo/.test(borradores[0].body) && /semana extra hasta el/.test(borradores[0].o.htmlBody));
