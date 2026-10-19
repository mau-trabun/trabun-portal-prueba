// Tests cloudrun/ (Code.js on Node with shims) against the Apps Script harness in run.js, same fictional data.
// Run from the repo root: node test/cloudrun.js
process.env.TZ = 'America/Santiago';
const fs = require('fs'), path = require('path');
const base = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8').split('const post =')[0];
const { crearServicio, formatDate, serialAFecha, comoGetValues } = require('../cloudrun/app');
const { crearServidor } = require('../cloudrun/server');

eval(base + `
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const gasPost = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);

// Fake Sheets API from the same fixture: dates as serials (+ formatted strings), trailing blanks trimmed like the API
const aSerial = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5
  + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
const pad = n => String(n).padStart(2, '0');
const recortar = rows => {
  const out = rows.map(r => { const c = r.slice(); while (c.length && (c[c.length - 1] === '' || c[c.length - 1] == null)) c.pop(); return c; });
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
};
let lecturas = 0, faltan = [];
const filasMetricas = [];
let pedidas = [];
const planilla = {
  async leer(tabs, sinFechas, columnas = {}) {
    lecturas++;
    pedidas = tabs.slice();
    const titulos = Object.keys(sheets).filter(t => !faltan.includes(t));
    const seriales = {}, formateados = {};
    tabs.filter(t => titulos.includes(t)).forEach(t => {
      // columnas: only those headers' columns, as the real Sheets API read does
      const idx = columnas[t] ? columnas[t].map(h => sheets[t][0].indexOf(h)).filter(i => i >= 0) : null;
      const filas = idx ? sheets[t].map(r => idx.map(i => (r[i] == null ? '' : r[i]))) : sheets[t];
      seriales[t] = recortar(filas.map(r => r.map(v => (v instanceof Date ? aSerial(v) : v))));
      if (!sinFechas.includes(t) || idx) formateados[t] = recortar(filas.map(r => r.map(v => (v instanceof Date ? pad(v.getDate()) + '-' + pad(v.getMonth() + 1) + '-' + v.getFullYear() : v))));
    });
    return { titulos, seriales, formateados };
  },
  async agregar(tab, fila) { filasMetricas.push({ tab, fila }); },
};
const silencio = { log() {}, error() {} };
const sinTiempos = o => { delete o.ms; delete o.generado; return o; };

(async () => {
  // Helpers
  check('formatDate: date, ISO with offset, literal T', formatDate(new Date(2026, 9, 13, 9, 5, 7), 'America/Santiago', 'yyyy-MM-dd') === '2026-10-13'
    && /^2026-10-13T09:05:07-0[34]:00$/.test(formatDate(new Date(2026, 9, 13, 9, 5, 7), 'America/Santiago', "yyyy-MM-dd'T'HH:mm:ssXXX")));
  check('serial ↔ Date round trip (date and datetime)', serialAFecha(aSerial(new Date(2026, 10, 3, 10, 30, 0))).getTime() === new Date(2026, 10, 3, 10, 30, 0).getTime()
    && serialAFecha(46308).getFullYear() === 2026);
  const gv = comoGetValues([[1, 'a'], [46308]], [[1, 'a'], ['13-10-2026']]);
  check('comoGetValues: rectangular, date only when formatted is a string', gv[0][0] === 1 && gv[1].length === 2 && gv[1][1] === '' && gv[1][0] instanceof Date);

  const svc = crearServicio({ src, planilla, log: silencio });
  const post = async body => JSON.parse((await svc.manejar('POST', '/', JSON.stringify(body))).cuerpo);
  check('GET health', JSON.parse((await svc.manejar('GET', '/', '')).cuerpo).ok === true);

  // Same payload as Apps Script for every school and mode
  const casos = [{ rbd: '11111', clave: 'aaa111' }, { rbd: '22222', clave: 'bbb222' }, { rbd: '33333', clave: 'ccc333' }, { rbd: '44444', clave: 'ddd444' }];
  let iguales = true;
  for (const c of casos) {
    const a = sinTiempos(gasPost(c)), b = sinTiempos(await post(c));
    if (JSON.stringify(a) !== JSON.stringify(b)) { iguales = false; console.log('  difiere RBD ' + c.rbd); }
  }
  check('payload identical to Apps Script harness (4 schools)', iguales);
  check('Config dates read from serials (Date cells) and text', (await post(casos[0])).encuestas.test.abre === '2026-10-01');
  const r1 = await post(casos[0]), r2 = await post(casos[0]);
  check('repeated logins give the same payload (cached data not mutated)', JSON.stringify(sinTiempos(r1)) === JSON.stringify(sinTiempos(r2)));
  check('one Sheet read for many logins', lecturas === 1);

  // Errors and throttle
  check('wrong clave → credenciales', (await post({ rbd: '11111', clave: 'zzz' })).error === 'credenciales');
  check('malformed body → credenciales', JSON.parse((await svc.manejar('POST', '/', 'no json')).cuerpo).error === 'credenciales');
  for (let i = 0; i < 8; i++) await post({ rbd: '22222', clave: 'nope' });
  check('8 wrong attempts → blocked even with the right clave', (await post({ rbd: '22222', clave: 'bbb222' })).error === 'bloqueado');

  // Métricas: written after the reply, date as text, refreshes not logged
  await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 10));
  const n = filasMetricas.length;
  await post({ ...casos[0], refresco: true });
  await new Promise(r => setTimeout(r, 10));
  check('Métricas rows appended for logins, not for refreshes', n > 0 && filasMetricas.length === n && filasMetricas.every(m => m.tab === 'Métricas'));
  check('Métricas timestamp sent as text, no clave in the row', /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(filasMetricas[0].fila[0]) && !JSON.stringify(filasMetricas).includes('aaa111'));
  const ev = await post({ ...casos[0], evento: 'test_whatsapp', programa: 'ase' });
  await new Promise(r => setTimeout(r, 10));
  const ultima = filasMetricas[filasMetricas.length - 1];
  check('evento: {ok:true} only, one row written after the reply, no clave', JSON.stringify(ev) === '{"ok":true}' && filasMetricas.length === n + 1
    && ultima.fila[5] === 'test_whatsapp' && ultima.fila[2] === 'ASE' && !JSON.stringify(ultima).includes(casos[0].clave));

  const corto = await post({ corto: casos[0].rbd + '-ASE_4-5' });
  check('short link: same full link as Apps Script, unknown code rejected', corto.ok && corto.link === gasPost({ corto: casos[0].rbd + '-ASE_4-5' }).link
    && (await post({ corto: '99999-ASE_4-5' })).error === 'link');

  // Refresh endpoint and degradation
  await svc.manejar('POST', '/refrescar', '');
  check('/refrescar within 30 s does not re-read', lecturas === 1);
  faltan = ['Respuestas EFA'];
  const svc2 = crearServicio({ src, planilla, log: silencio });
  const rd = JSON.parse((await svc2.manejar('POST', '/', JSON.stringify(casos[0]))).cuerpo);
  check('missing Respuestas EFA → efa.ok false, login still ok', rd.ok && rd.programas.every(p => p.efa.ok === false && p.test.ok));
  faltan = ['SF'];
  const svc3 = crearServicio({ src, planilla, log: silencio });
  check('missing SF → servidor (as in Apps Script)', JSON.parse((await svc3.manejar('POST', '/', JSON.stringify(casos[0]))).cuerpo).error === 'servidor');
  faltan = [];
  const fallo = { leer: async () => { throw new Error('Sheets 503'); }, agregar: async () => {} };
  const svc4 = crearServicio({ src, planilla: fallo, log: silencio });
  check('Sheets API down on cold start → servidor, no crash', JSON.parse((await svc4.manejar('POST', '/', JSON.stringify(casos[0]))).cuerpo).error === 'servidor');

  // "Actualizar" (fresco:true) re-reads the Sheet; auto-refresh and logins use the copy
  const svc5 = crearServicio({ src, planilla, log: silencio, frescoMs: 0, minEntreMs: 0 });
  const totalTest = async extra => JSON.parse((await svc5.manejar('POST', '/', JSON.stringify({ ...casos[0], refresco: true, ...extra }))).cuerpo).programas[0].test.resumen.r;
  const antes = await totalTest({});
  sheets['Respuestas Test'].push(test('ASE_4-5', 'Nueva', 'Respuesta', 20, '4° básico', 'A', AROMOS, 4));
  const lecturasAntes = lecturas;
  const sinFresco = await totalTest({});
  const conFresco = await totalTest({ fresco: true });
  sheets['Respuestas Test'].pop();
  check('new response shows after Actualizar (fresco), not after auto-refresh', sinFresco === antes && conFresco === antes + 1 && lecturas === lecturasAntes + 1);
  const svc6 = crearServicio({ src, planilla, log: silencio, frescoMs: 0 }); // default 30 s between reads
  await svc6.manejar('POST', '/', JSON.stringify(casos[0]));
  const l0 = lecturas;
  for (let i = 0; i < 5; i++) await svc6.manejar('POST', '/', JSON.stringify({ ...casos[0], refresco: true, fresco: true }));
  check('repeated Actualizar clicks: at most one Sheet read per 30 s', lecturas === l0);

  // Team tracker: same rows as Code.js on the Apps Script harness, Correos Test read without its emails
  check('tracker off by default: Métricas and Correos Test not read', !pedidas.includes('Métricas') && !pedidas.includes('Correos Test'));
  sheets['Correos Test'] = [['RBD', 'Colegio', 'Para', 'CC', 'Enviar', 'Enviado'],
    ['11111', 'x', 'enc@ejemplo.invalid', 'jdp@ejemplo.invalid', true, new Date(2026, 9, 9, 10, 15)], ['22222', 'x', 'otro@ejemplo.invalid', '', true, '']];
  const escritos = [];
  let escribirFalla = false;
  const seg = { async escribir(tabs) { if (escribirFalla) throw new Error('Sheets 500'); escritos.push(JSON.parse(JSON.stringify(tabs))); } };
  const svc7 = crearServicio({ src, planilla, seguimiento: seg, log: silencio });
  await svc7.manejar('POST', '/refrescar', '');
  await new Promise(r => setTimeout(r, 10));
  const snapCorreos = svc7._estado().snap.tablas['Correos Test'];
  check('tracker on: Métricas + Correos Test read, Correos Test only RBD + Enviado (no emails in memory)', pedidas.includes('Métricas')
    && snapCorreos[0].join() === 'RBD,Enviado' && !JSON.stringify(snapCorreos).includes('ejemplo.invalid'));
  ctx.Utilities.formatDate = formatDate; // the Apps Script harness with the same date formatter as Cloud Run
  const esperado = ctx.seguimiento_(ctx.cargarDatos_(), ctx.datosSeguimiento_(), ctx.reloj_());
  const sinEstado = t => Object.keys(t).map(k => t[k].slice(1)); // row 1 carries the time
  check('tracker written after a snapshot, rows identical to Code.js on Apps Script (2 tabs)', escritos.length === 1
    && Object.keys(escritos[0]).join() === 'Resumen,Por curso' && JSON.stringify(sinEstado(escritos[0])) === JSON.stringify(sinEstado(esperado)));
  check('tracker carries the email date (read from its Date cell)', escritos[0].Resumen.find(r => r[0] === 11111)[escritos[0].Resumen[2].indexOf('Correo enviado')] === '09-10-2026');
  await post(casos[0]);
  await new Promise(r => setTimeout(r, 10));
  check('a login does not write the tracker (only snapshots do)', escritos.length === 1);
  escribirFalla = true;
  const svc8 = crearServicio({ src, planilla, seguimiento: seg, log: silencio });
  check('tracker write failing never breaks a login', (await JSON.parse((await svc8.manejar('POST', '/', JSON.stringify(casos[0]))).cuerpo)).ok === true);
  await new Promise(r => setTimeout(r, 10)); // let svc8's failing write finish first
  escribirFalla = false;
  faltan = ['Respuestas Test'];
  const n0 = escritos.length;
  const svc9 = crearServicio({ src, planilla, seguimiento: seg, log: silencio });
  await svc9.manejar('POST', '/refrescar', '');
  await new Promise(r => setTimeout(r, 10));
  check('responses unreadable → tracker not overwritten', escritos.length === n0);
  faltan = [];

  // Schedule: every snapshot from 8:00 to 18:00 (Santiago), otherwise the first snapshot of each clock hour
  let reloj = new Date(2026, 9, 19, 17, 56);
  const svc10 = crearServicio({ src, planilla, seguimiento: seg, log: silencio, minEntreMs: 0, ahora: () => reloj });
  const tic = async (h, m, dia = 19) => { reloj = new Date(2026, 9, dia, h, m); await svc10.manejar('POST', '/refrescar', ''); await new Promise(r => setTimeout(r, 10)); };
  const e0 = escritos.length;
  await tic(17, 56); await tic(17, 58);
  const enHorario = escritos.length - e0;
  await tic(18, 0); await tic(18, 2); await tic(18, 58);
  const tarde = escritos.length - e0 - enHorario;
  await tic(19, 0); await tic(19, 30);
  const sigHora = escritos.length - e0 - enHorario - tarde;
  await tic(7, 56, 20); await tic(7, 58, 20);
  const manana = escritos.length - e0 - enHorario - tarde - sigHora;
  await tic(8, 0, 20); await tic(8, 2, 20);
  const vuelta = escritos.length - e0 - enHorario - tarde - sigHora - manana;
  check('tracker schedule: every snapshot 8–18 h, then once per clock hour (18:00, 19:00, 7:00…)', enHorario === 2 && tarde === 1 && sigHora === 1 && manana === 1);
  check('tracker schedule: back to every snapshot at 8:00', vuelta === 2);
  check('status lines: update time in A1, schedule in A2', /^Actualizado: \\d{2}-\\d{2}-\\d{4} \\d{2}:\\d{2}$/.test(escritos[escritos.length - 1].Resumen[0][0])
    && /^Actualización automática cada 2 minutos de 8:00 a 18:00, y una vez por hora el resto del día\\.$/.test(escritos[escritos.length - 1].Resumen[1][0]));
  delete sheets['Correos Test'];

  // HTTP layer: CORS by origin, body limit, unknown route
  const srv = crearServidor(svc, ['https://mau-trabun.github.io']).listen(0);
  await new Promise(r => srv.once('listening', r));
  const url = 'http://127.0.0.1:' + srv.address().port;
  const ok = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', Origin: 'https://mau-trabun.github.io' }, body: JSON.stringify(casos[0]) });
  const otro = await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify(casos[0]) });
  check('CORS header only for allowed origins', ok.headers.get('access-control-allow-origin') === 'https://mau-trabun.github.io' && (await ok.json()).ok && !otro.headers.get('access-control-allow-origin'));
  const grande = await fetch(url, { method: 'POST', body: 'x'.repeat(20000) }).catch(() => ({ status: 413 }));
  check('body over 10 KB → 413', grande.status === 413);
  check('unknown route → 404', (await fetch(url + '/otra')).status === 404);
  srv.close();
})();
`);
