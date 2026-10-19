// Google Sheets API v4 over fetch, authenticated as the Cloud Run service account via the metadata server
// (no key files). The Sheet must be shared with that service account.
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=' + encodeURIComponent(SCOPE);

let token = null;
async function tokenAcceso() {
  if (token && token.exp > Date.now() + 60000) return token.valor;
  const r = await fetch(TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('token ' + r.status);
  const j = await r.json();
  token = { valor: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.valor;
}

async function api(url, opciones = {}) {
  const r = await fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), Authorization: 'Bearer ' + (await tokenAcceso()) },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error('Sheets ' + r.status); // status only: bodies may echo cell data
  return r.json();
}

function crearPlanilla(id) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id);
  const rango = t => "'" + t.replace(/'/g, "''") + "'";
  const batchGet = (rangos, modoFecha) => (rangos.length
    ? api(base + '/values:batchGet?' + new URLSearchParams([
      ...rangos.map(r => ['ranges', r]),
      ['valueRenderOption', 'UNFORMATTED_VALUE'], ['dateTimeRenderOption', modoFecha], ['majorDimension', 'ROWS'],
    ])).then(j => j.valueRanges.map(v => v.values || []))
    : Promise.resolve([]));

  return {
    // Missing tabs are left out, so Code.js degrades exactly as in Apps Script (getSheetByName → null).
    // columnas: {tab: [headers]} → only those columns of that tab are downloaded (Correos Test: never the emails).
    async leer(tabs, sinFechas, columnas = {}) {
      const meta = await api(base + '?fields=sheets.properties.title');
      const titulos = meta.sheets.map(s => s.properties.title);
      const presentes = tabs.filter(t => titulos.includes(t));
      const enteras = presentes.filter(t => !columnas[t]);
      const conFechas = enteras.filter(t => !sinFechas.includes(t));
      const [s, f] = await Promise.all([batchGet(enteras.map(rango), 'SERIAL_NUMBER'), batchGet(conFechas.map(rango), 'FORMATTED_STRING')]);
      const seriales = {}, formateados = {};
      enteras.forEach((t, i) => { seriales[t] = s[i]; });
      conFechas.forEach((t, i) => { formateados[t] = f[i]; });
      for (const t of presentes.filter(x => columnas[x])) {
        const [enc] = await batchGet([rango(t) + '!1:1'], 'SERIAL_NUMBER');
        const cols = columnas[t].map(h => ({ h, i: (enc[0] || []).map(x => String(x).trim()).indexOf(h) })).filter(c => c.i >= 0);
        const rangos = cols.map(c => rango(t) + '!' + letra(c.i + 1) + ':' + letra(c.i + 1));
        const [cs, cf] = await Promise.all([batchGet(rangos, 'SERIAL_NUMBER'), batchGet(rangos, 'FORMATTED_STRING')]);
        // Columns read one by one (each comes with its header in row 1), rebuilt as rows of just those columns
        const filas = (lista) => {
          const alto = lista.reduce((m, c) => Math.max(m, c.length), 0);
          return Array.from({ length: alto }, (_, r) => lista.map(c => (c[r] && c[r].length ? c[r][0] : '')));
        };
        seriales[t] = filas(cs);
        formateados[t] = filas(cf);
      }
      return { titulos, seriales, formateados };
    },
    agregar(tab, fila) {
      return api(base + '/values/' + encodeURIComponent(rango(tab) + '!A1') + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [fila] }),
      });
    },
  };
}

// 1 → A, 27 → AA
function letra(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

// The team tracker (a separate Sheet, shared with the service account as editor). Each write replaces every tab's
// values in place (no flash of an empty tab), then clears what is left of a longer previous version.
// A missing tab is created with the header row frozen and bold and "%" columns as percentages. When the header
// (row 2) changes, number formats are set again so a "%" never lands on a count; otherwise the team's own
// formatting is kept (only values are written).
function crearSeguimiento(id) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id);
  const rango = t => "'" + t.replace(/'/g, "''") + "'";
  const post = (ruta, cuerpo) => api(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  // Header bold; data rows: "%" columns as percent, every other column back to automatic
  const formatos = (sheetId, encabezado) => [{ repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }]
    .concat(encabezado.map((t, j) => ({ repeatCell: { range: { sheetId, startRowIndex: 2, startColumnIndex: j, endColumnIndex: j + 1 },
      cell: { userEnteredFormat: t === '%' ? { numberFormat: { type: 'PERCENT', pattern: '0%' } } : {} }, fields: 'userEnteredFormat.numberFormat' } })));
  return {
    async escribir(tabs) {
      const meta = await api(base + '?fields=sheets.properties(title,sheetId,gridProperties)');
      const hojas = {};
      meta.sheets.forEach(s => { hojas[s.properties.title] = s.properties; });
      const usados = new Set(meta.sheets.map(s => s.properties.sheetId));
      const pedidos = [];
      const nombres = Object.keys(tabs);
      const existentes = nombres.filter(n => hojas[n]);
      const actuales = {}; // current header (row 2) of each existing tab
      if (existentes.length) {
        const j = await api(base + '/values:batchGet?' + new URLSearchParams(existentes.map(n => ['ranges', rango(n) + '!2:2'])));
        existentes.forEach((n, i) => { actuales[n] = ((j.valueRanges[i].values || [])[0] || []).map(String); });
      }
      nombres.forEach(n => {
        const filas = tabs[n], alto = filas.length, ancho = filas.reduce((m, r) => Math.max(m, r.length), 1);
        const h = hojas[n];
        if (!h) {
          let sheetId;
          do { sheetId = 1 + Math.floor(Math.random() * 2e9); } while (usados.has(sheetId));
          usados.add(sheetId);
          pedidos.push({ addSheet: { properties: { sheetId, title: n, gridProperties: { rowCount: alto + 100, columnCount: ancho + 2, frozenRowCount: 2 } } } });
          pedidos.push(...formatos(sheetId, filas[1] || []));
          hojas[n] = { gridProperties: { rowCount: alto + 100, columnCount: ancho + 2 } };
        } else {
          const g = h.gridProperties || {};
          if ((g.rowCount || 0) < alto) pedidos.push({ appendDimension: { sheetId: h.sheetId, dimension: 'ROWS', length: alto - (g.rowCount || 0) + 100 } });
          if ((g.columnCount || 0) < ancho) pedidos.push({ appendDimension: { sheetId: h.sheetId, dimension: 'COLUMNS', length: ancho - (g.columnCount || 0) + 2 } });
          if ((filas[1] || []).join('\u0001') !== actuales[n].join('\u0001')) pedidos.push(...formatos(h.sheetId, filas[1] || []));
        }
      });
      if (pedidos.length) await post(':batchUpdate', { requests: pedidos });
      await post('/values:batchUpdate', { valueInputOption: 'RAW', data: nombres.map(n => ({ range: rango(n) + '!A1', values: tabs[n] })) });
      const limpiar = [];
      nombres.forEach(n => {
        const filas = tabs[n], alto = filas.length, ancho = filas.reduce((m, r) => Math.max(m, r.length), 1);
        const g = hojas[n].gridProperties || {};
        const filasHoja = Math.max(g.rowCount || 0, alto), colsHoja = Math.max(g.columnCount || 0, ancho);
        if (filasHoja > alto) limpiar.push(rango(n) + '!A' + (alto + 1) + ':' + letra(colsHoja) + filasHoja);
        if (colsHoja > ancho) limpiar.push(rango(n) + '!' + letra(ancho + 1) + '1:' + letra(colsHoja) + alto);
      });
      if (limpiar.length) await post('/values:batchClear', { ranges: limpiar });
    },
  };
}

module.exports = { crearPlanilla, crearSeguimiento, letra };
