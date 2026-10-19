// Tests cloudrun/sheets.js against a fake Sheets API (global fetch mocked). Fictional data only.
// Run from the repo root: node test/sheets.js
const { crearPlanilla, crearSeguimiento, letra } = require('../cloudrun/sheets');
const check = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };

// Fake API: tabs as row arrays; records every request
let hojas = {}, llamadas = [];
const respuesta = (j, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => j });
const columna = (filas, c) => filas.map(r => (r[c] === undefined || r[c] === '' ? [] : [r[c]]));
const idx = l => l.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const tab = r => r.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
global.fetch = async (url, op = {}) => {
  if (url.startsWith('http://metadata')) return respuesta({ access_token: 't', expires_in: 3600 });
  const u = new URL(url);
  const cuerpo = op.body ? JSON.parse(op.body) : null;
  llamadas.push({ ruta: u.pathname, metodo: op.method || 'GET', cuerpo, params: u.searchParams });
  if (u.pathname.endsWith(':batchGet')) {
    return respuesta({ valueRanges: u.searchParams.getAll('ranges').map(r => {
      const filas = hojas[tab(r)].filas;
      const sel = r.split('!')[1];
      if (!sel) return { values: filas };
      if (sel === '1:1') return { values: [filas[0]] };
      const m = sel.match(/^([A-Z]+):([A-Z]+)$/);
      return { values: columna(filas, idx(m[1])) };
    }) });
  }
  if (u.pathname.endsWith(':batchUpdate') && !u.pathname.includes('/values')) {
    cuerpo.requests.forEach(q => { if (q.addSheet) hojas[q.addSheet.properties.title] = { props: q.addSheet.properties, filas: [] }; });
    return respuesta({});
  }
  if (u.pathname.endsWith('/values:batchUpdate')) {
    cuerpo.data.forEach(d => { hojas[tab(d.range)].filas = d.values.map(r => r.slice()); });
    return respuesta({});
  }
  if (u.pathname.endsWith('/values:batchClear')) return respuesta({});
  return respuesta({ sheets: Object.keys(hojas).map((t, i) => ({ properties: Object.assign({ title: t, sheetId: i + 1, gridProperties: { rowCount: 1000, columnCount: 26 } }, hojas[t].props) })) });
};

(async () => {
  check('column letters', letra(1) === 'A' && letra(26) === 'Z' && letra(27) === 'AA' && letra(53) === 'BA');

  // Partial read: only the named columns are requested, rebuilt as rows
  hojas = { 'Correos Test': { filas: [['RBD', 'Para', 'Enviar', 'Enviado'], [11111, 'a@ejemplo.invalid', true, 46304.4], [22222, 'b@ejemplo.invalid', true, ''], [33333, 'c@ejemplo.invalid', false, 46305]] },
    SF: { filas: [['ID RBD'], [11111]] } };
  llamadas = [];
  const raw = await crearPlanilla('x').leer(['SF', 'Correos Test', 'No existe'], [], { 'Correos Test': ['RBD', 'Enviado', 'Falta'] });
  const pedidos = llamadas.flatMap(l => l.params.getAll('ranges'));
  check('partial read: header row, then only the RBD and Enviado columns (never Para)', pedidos.includes("'Correos Test'!1:1") && pedidos.includes("'Correos Test'!A:A")
    && pedidos.includes("'Correos Test'!D:D") && !pedidos.some(r => /'Correos Test'!B/.test(r)) && !pedidos.includes("'Correos Test'"));
  check('partial read: rows of just those columns, blanks kept, missing header skipped', JSON.stringify(raw.seriales['Correos Test']) === JSON.stringify([['RBD', 'Enviado'], [11111, 46304.4], [22222, ''], [33333, 46305]])
    && !JSON.stringify(raw).includes('ejemplo.invalid'));
  check('partial read: other tabs read whole, missing tabs left out', JSON.stringify(raw.seriales.SF) === '[["ID RBD"],[11111]]' && !('No existe' in raw.seriales));

  // Writer: creates missing tabs once with frozen header, bold, % format; values RAW from A1
  hojas = {};
  llamadas = [];
  const seg = crearSeguimiento('y');
  const filas = n => [['Actualizado: …'], ['RBD', 'Respuestas', '%']].concat(Array.from({ length: n }, (_, i) => [10000 + i, i, 0.5]));
  await seg.escribir({ Resumen: filas(3), 'Por curso': filas(1500) });
  const crear = llamadas.find(l => l.ruta.endsWith(':batchUpdate') && !l.ruta.includes('values'));
  const add = crear.cuerpo.requests.filter(q => q.addSheet);
  check('missing tabs created with frozen 2 rows and room for every row', add.length === 2 && add.every(q => q.addSheet.properties.gridProperties.frozenRowCount === 2)
    && add[1].addSheet.properties.gridProperties.rowCount >= 1502);
  check('header bold and "%" column as percent on creation', crear.cuerpo.requests.some(q => q.repeatCell && q.repeatCell.fields === 'userEnteredFormat.textFormat.bold')
    && crear.cuerpo.requests.filter(q => q.repeatCell && q.repeatCell.cell.userEnteredFormat.numberFormat).every(q => q.repeatCell.range.startColumnIndex === 2 && q.repeatCell.range.startRowIndex === 2));
  const val = llamadas.find(l => l.ruta.endsWith('values:batchUpdate'));
  check('values written RAW from A1 (numbers stay numbers, nothing parsed as a date)', val.cuerpo.valueInputOption === 'RAW' && val.cuerpo.data[0].range === "'Resumen'!A1" && hojas.Resumen.filas[2][0] === 10000);

  // Second write, shorter: no tab creation, tail rows and columns cleared, never an empty tab in between
  llamadas = [];
  hojas.Resumen.props.gridProperties = { rowCount: 103, columnCount: 5 };
  hojas['Por curso'].props.gridProperties = { rowCount: 1602, columnCount: 5 };
  await seg.escribir({ Resumen: filas(1), 'Por curso': filas(1500) });
  const limpiar = llamadas.find(l => l.ruta.endsWith('values:batchClear'));
  check('second write: no structural change, values before clears', !llamadas.some(l => l.ruta.endsWith(':batchUpdate') && !l.ruta.includes('values'))
    && llamadas.findIndex(l => l.ruta.endsWith('values:batchUpdate')) < llamadas.indexOf(limpiar));
  check('second write: rows below and columns right of the new data cleared, within the grid', limpiar.cuerpo.ranges.includes("'Resumen'!A4:E103")
    && limpiar.cuerpo.ranges.includes("'Resumen'!D1:E3") && limpiar.cuerpo.ranges.includes("'Por curso'!A1503:E1602"));

  // Grid too small for a bigger write → rows appended first
  llamadas = [];
  hojas.Resumen.props.gridProperties = { rowCount: 10, columnCount: 3 };
  await seg.escribir({ Resumen: filas(50), 'Por curso': filas(1) });
  const crecer = llamadas.find(l => l.ruta.endsWith(':batchUpdate') && !l.ruta.includes('values'));
  check('grid grown before writing more rows than it has', crecer && crecer.cuerpo.requests.some(q => q.appendDimension && q.appendDimension.dimension === 'ROWS' && q.appendDimension.length >= 42));
})();
