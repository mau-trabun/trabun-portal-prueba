// Portal API on Cloud Run: runs gas/Code.js unchanged. The few Apps Script services the login path uses
// (SpreadsheetApp read + appendRow, CacheService, Utilities.formatDate, ContentService) are replaced by
// small shims backed by an in-memory snapshot of the Sheet, refreshed in the background.
// Never log request bodies, claves, emails or names.
const vm = require('vm');


// Apps Script's Utilities.formatDate for the patterns Code.js uses (yyyy MM dd HH mm ss XXX, 'literals')
function formatDate(d, tz, patron) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
  const off = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  const t = { yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second, XXX: off };
  return patron.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|XXX/g, (m, lit) => (lit !== undefined ? lit : t[m]));
}

// Sheets serial (days since 1899-12-30, in the Sheet's time zone) → Date. Needs process TZ = Sheet TZ.
function serialAFecha(s) {
  const dias = Math.floor(s);
  const seg = Math.round((s - dias) * 86400);
  const b = new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
  return new Date(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), Math.floor(seg / 3600), Math.floor((seg % 3600) / 60), seg % 60);
}

// Like getDataRange().getValues(): rectangular, '' for blanks, Date for date cells.
// A cell is a date when the SERIAL_NUMBER read gives a number and the FORMATTED_STRING read gives a string.
function comoGetValues(seriales, formateados) {
  const ancho = seriales.reduce((m, r) => Math.max(m, r.length), 0);
  return seriales.map((r, i) => {
    const f = formateados && formateados[i];
    const fila = [];
    for (let j = 0; j < ancho; j++) {
      const v = r[j] === undefined ? '' : r[j];
      fila.push(typeof v === 'number' && f && typeof f[j] === 'string' ? serialAFecha(v) : v);
    }
    return fila;
  });
}

function cargarCodigo(src, { tabla, agregarFila, log }) {
  const cache = new Map(); // throttle; single instance (max-instances 1), so memory is enough
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: n => {
          const v = tabla(n);
          return v ? { getDataRange: () => ({ getValues: () => v.map(r => r.slice()) }), appendRow: row => agregarFila(n, row) } : null;
        },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => { const e = cache.get(k); if (!e) return null; if (e.exp < Date.now()) { cache.delete(k); return null; } return e.v; },
        put: (k, v, s) => { cache.set(k, { v: String(v), exp: Date.now() + (s || 600) * 1000 }); },
        remove: k => { cache.delete(k); },
      }),
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
    Utilities: { formatDate },
    console: log,
    // Host built-ins, so `instanceof Date` in Code.js matches the Dates built here
    Date, Map, Set, JSON, Math, Number, String, Object, Array, Boolean, RegExp, Error, Intl, isFinite, isNaN, parseInt, parseFloat,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.js' });
  return ctx;
}

// Only the manual "Actualizar" sends fresco:true (the 5-min auto-refresh and logins use the in-memory copy)
function pideFresco(cuerpo) {
  try { const b = JSON.parse(cuerpo); return !!b && b.fresco === true; } catch (_) { return false; }
}

// planilla: { leer(tabs, sinFechas) → { titulos, seriales: {tab: rows}, formateados: {tab: rows} }, agregar(tab, fila) }
// ttlMs: older → refresh behind the reply. maxEdadMs: older → wait for fresh data.
// frescoMs: the "Actualizar" button (body fresco:true) waits for a re-read when the copy is older than this.
// minEntreMs: at most one Sheet read started per this interval from requests (protects the Sheets API).
// seguimiento: { escribir(tabs) } for the team tracker (separate Sheet); null = off. Rewritten after every snapshot
// during Code.js SEG_HORARIO (Santiago time, school hours), otherwise once per clock hour (first snapshot of the hour).
// seguimientoEfa: same, for the EFA tracker (its own Sheet).
// ahora: clock, for tests.
// Guard against a half-loaded import (IMPORTRANGE reloading, a compilado tab being rewritten), per school: a school with
// fewer rows than in the copy being served keeps its previous rows of that survey, while every other school gets the
// new copy. A response tab that can't be read keeps the whole previous survey. A drop still there after
// GUARDA.minLecturas reads and GUARDA.minMs is accepted (test responses deleted on purpose). Counts only in the log.
const GUARDA = { minLecturas: 3, minMs: 30 * 60 * 1000 };

// nuevo, previo: cargarDatos_() results; sospechas: { 'test|<rbd>' | 'test|*': { desde, lecturas } }, kept between snapshots
function protegerRespuestas(nuevo, previo, sospechas, ahoraMs, log) {
  if (!previo) return nuevo;
  // true = hold (keep the previous rows), false = take the new ones
  const retener = clave => {
    const s = sospechas[clave] || (sospechas[clave] = { desde: ahoraMs, lecturas: 0 });
    s.lecturas++;
    if (s.lecturas >= GUARDA.minLecturas && ahoraMs - s.desde >= GUARDA.minMs) { delete sospechas[clave]; return false; }
    return true;
  };
  const soltar = clave => { const habia = !!sospechas[clave]; delete sospechas[clave]; return habia; };
  ['test', 'efa'].forEach(k => {
    const previas = previo[k], nuevas = nuevo[k];
    if (!previas || !previas.length) return;
    if (!nuevas) {
      if (retener(k + '|*')) { nuevo[k] = previas; log.log(`respuestas ${k}: no se pudo leer, se mantiene la copia anterior (${previas.length} filas)`); }
      else log.log(`respuestas ${k}: sigue sin leerse tras ${GUARDA.minMs / 60000} min, se deja de mantener la copia anterior`);
      return;
    }
    if (soltar(k + '|*')) log.log(`respuestas ${k}: se vuelve a leer`);
    const porRbd = filas => filas.reduce((m, x) => m.set(x.rbd, (m.get(x.rbd) || []).concat([x])), new Map());
    const a = porRbd(previas), b = porRbd(nuevas);
    const retenidos = new Set();
    let aceptados = 0, normales = 0, filas = 0;
    a.forEach((filasA, rbd) => {
      const clave = k + '|' + rbd;
      if ((b.get(rbd) || []).length >= filasA.length) { if (soltar(clave)) normales++; return; }
      if (retener(clave)) { retenidos.add(rbd); filas += filasA.length - (b.get(rbd) || []).length; } else aceptados++;
    });
    Object.keys(sospechas).forEach(c => { if (c.startsWith(k + '|') && c !== k + '|*' && !a.has(c.slice(k.length + 1))) delete sospechas[c]; });
    if (retenidos.size) {
      nuevo[k] = nuevas.filter(x => !retenidos.has(x.rbd)).concat(previas.filter(x => retenidos.has(x.rbd)));
      log.log(`respuestas ${k}: ${retenidos.size} colegios con menos filas (${filas}), se mantienen sus filas anteriores`);
    }
    if (aceptados) log.log(`respuestas ${k}: baja aceptada en ${aceptados} colegios tras ${GUARDA.minMs / 60000} min`);
    if (normales) log.log(`respuestas ${k}: ${normales} colegios volvieron a la normalidad`);
  });
  return nuevo;
}

function crearServicio({ src, planilla, seguimiento = null, seguimientoEfa = null, ahora = () => new Date(), ttlMs = 3 * 60 * 1000, maxEdadMs = 10 * 60 * 1000, frescoMs = 15 * 1000, minEntreMs = 30 * 1000, log = console }) {
  let snap = null;      // { titulos: Set, tablas: {tab: values}, leido }
  let datos = null;     // cargarDatos_() result for the current snapshot (or its error)
  let cargando = null;
  const sospechas = {}; // per-school response drops being held (protegerRespuestas)
  let ultimoIntento = 0;
  const pendientes = []; // Métricas rows waiting to be written
  let vaciando = false;

  const ctx = cargarCodigo(src, {
    tabla: n => (snap && snap.titulos.has(n) ? snap.tablas[n] || [] : null),
    agregarFila: (n, row) => pendientes.push({ n, row }),
    log,
  });
  const TABS = vm.runInContext('TABS', ctx);
  const TZ = vm.runInContext('TZ', ctx);
  const lectura = Object.keys(TABS).filter(k => k !== 'metricas').map(k => TABS[k]);
  const sinFechas = [TABS.respTest]; // the big tab: no date column is read from it
  const columnas = {};
  // The trackers also need portal use and the email date (only RBD + Enviado); the EFA one, SF contacts without names
  // (Email only to spot repeats), and for its Destinatarios tab the encargados (first name + email) and correos_jdp
  if (seguimiento || seguimientoEfa) lectura.push(TABS.metricas);
  if (seguimiento) {
    const correos = vm.runInContext('TAB_CORREOS', ctx);
    lectura.push(correos);
    columnas[correos] = ['RBD', 'Enviado'];
  }
  if (seguimientoEfa) {
    const correos = vm.runInContext('TAB_CORREOS_EFA', ctx), contactos = vm.runInContext('TAB_CONTACTOS_EFA', ctx);
    lectura.push(correos, contactos);
    columnas[correos] = ['RBD', 'Enviado'];
    columnas[contactos] = vm.runInContext('COLS_CONTACTOS_EFA', ctx);
    // Destinatarios tab (Mau 06-11-2026): encargados' first name + email per RBD, and the JdP / coordinator emails
    const encargados = vm.runInContext('TAB_ENCARGADOS', ctx), jdp = vm.runInContext('TAB_CORREOS_JDP', ctx);
    lectura.push(encargados, jdp);
    columnas[encargados] = vm.runInContext('COLS_ENCARGADOS', ctx);
  }
  let escribiendo = false;
  let ultimaHoraEscrita = null; // 'yyyy-MM-dd HH' of the last tracker write
  const HORARIO = vm.runInContext('SEG_HORARIO', ctx);
  const cargarDatosOriginal = ctx.cargarDatos_;
  // Built once per snapshot instead of per login (Code.js keeps it a pure function of the Sheet)
  ctx.cargarDatos_ = () => { if (datos.error) throw datos.error; return datos.valor; };

  function refrescar() {
    if (cargando) return cargando;
    ultimoIntento = Date.now();
    cargando = (async () => {
      const t0 = Date.now();
      const raw = await planilla.leer(lectura, sinFechas, columnas);
      const tablas = {};
      Object.keys(raw.seriales).forEach(t => { tablas[t] = comoGetValues(raw.seriales[t], raw.formateados[t]); });
      snap = { titulos: new Set(raw.titulos), tablas, leido: Date.now() };
      const previo = datos && !datos.error ? datos.valor : null;
      try { datos = { valor: protegerRespuestas(cargarDatosOriginal(), previo, sospechas, ahora().getTime(), log) }; } catch (error) { datos = { error }; }
      log.log(`snapshot ${Date.now() - t0} ms`); // timing only
      setImmediate(() => { escribirSeguimiento(); }); // never makes a login wait
    })().finally(() => { cargando = null; });
    return cargando;
  }

  // Skipped when a write is still running (the next snapshot writes) or responses could not be read (keeps the old tracker).
  // Each tracker on its own: one failing never stops the other.
  async function escribirSeguimiento() {
    if ((!seguimiento && !seguimientoEfa) || escribiendo || !datos || datos.error) return;
    const hora = formatDate(ahora(), TZ, 'yyyy-MM-dd HH');
    const h = Number(hora.slice(-2));
    if ((h < HORARIO.desde || h >= HORARIO.hasta) && hora === ultimaHoraEscrita) return; // off hours: once per hour
    escribiendo = true;
    try {
      const s = ctx.datosSeguimiento_(), reloj = ctx.reloj_();
      for (const [destino, fn, nombre] of [[seguimiento, 'seguimiento_', 'seguimiento'], [seguimientoEfa, 'seguimientoEfa_', 'seguimiento EFA']]) {
        if (!destino) continue;
        try {
          const res = ctx[fn](datos.valor, s, reloj);
          if (res) await destino.escribir(res.tabs, res.notas, res.formato);
        } catch (e) {
          log.error(nombre + ': ' + e.message);
        }
      }
      ultimaHoraEscrita = hora;
    } catch (e) {
      log.error('seguimiento: ' + e.message);
    } finally {
      escribiendo = false;
    }
  }

  async function asegurarFresco(fresco) {
    const edad = snap ? Date.now() - snap.leido : Infinity;
    try {
      if (edad > maxEdadMs) await refrescar(); // cold start or the scheduler stopped: wait for fresh data
      else if (fresco && edad > frescoMs) { // "Actualizar": the school wants what is in the Sheet now
        if (cargando) await cargando;
        else if (Date.now() - ultimoIntento >= minEntreMs) await refrescar();
      } else if (edad > ttlMs) refrescar().catch(e => log.error('refresco: ' + e.message)); // serve now, refresh behind
    } catch (e) {
      log.error('refresco: ' + e.message); // keep serving the old snapshot if there is one
    }
  }

  async function vaciarMetricas() {
    if (vaciando) return;
    vaciando = true;
    try {
      while (pendientes.length) {
        const { n, row } = pendientes[0];
        await planilla.agregar(n, row.map(v => (v instanceof Date ? formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : v)));
        pendientes.shift();
      }
    } catch (e) {
      log.error('Métricas: ' + e.message); // retried on the next login or refresh
    } finally {
      vaciando = false;
    }
  }

  return {
    async manejar(metodo, ruta, cuerpo) {
      if (metodo === 'GET' && ruta === '/') return { status: 200, cuerpo: ctx.doGet().getContent() };
      if (metodo === 'POST' && ruta === '/') {
        await asegurarFresco(pideFresco(cuerpo));
        const out = ctx.doPost({ postData: { contents: cuerpo } }).getContent();
        setImmediate(() => { vaciarMetricas(); }); // after the reply: the login never waits for the write
        return { status: 200, cuerpo: out };
      }
      if (metodo === 'POST' && ruta === '/refrescar') { // Cloud Scheduler, every 2 min: keeps data fresh and the instance warm
        if (Date.now() - ultimoIntento >= minEntreMs) await refrescar().catch(e => log.error('refresco: ' + e.message));
        await vaciarMetricas();
        return { status: 204, cuerpo: '' };
      }
      return { status: 404, cuerpo: '{"ok":false}' };
    },
    _estado: () => ({ snap, pendientes }), // tests only
  };
}

module.exports = { crearServicio, formatDate, serialAFecha, comoGetValues, protegerRespuestas, GUARDA };
