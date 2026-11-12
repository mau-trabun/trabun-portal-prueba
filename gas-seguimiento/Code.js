// Seguimiento EFA (team tracker Sheet): progress emails to schools, sent by each Jefe/a de Proyecto from their own
// Gmail (Mau 06-11-2026, like the EFS 2026 tracker's "Generar correo de seguimiento"). Bound to the Seguimiento EFA
// Sheet; pushed with clasp from gas-seguimiento/. Both tabs it reads are written by Cloud Run every 2 minutes
// (gas/Code.js seguimientoEfa_): Resumen (responses and expected per role) and Destinatarios (encargados, CC, clave).
// The email is built when the JdP clicks, with the numbers of that moment. Never sends anything: drafts only.

const TAB_RESUMEN = 'Resumen', TAB_DEST = 'Destinatarios';
const COLS_DEST = ['RBD', 'Colegio', 'Programas', 'Jefe/a de Proyecto', 'Correo JdP', 'Para', 'Nombres', 'CC', 'Clave', 'Cierre EFA', 'Fase EFA', 'Observaciones'];
const ROLES = ['Director/a', 'Encargado/a', 'Mentor/a', 'Otros líderes', 'Docentes']; // Resumen columns "<rol> resp." / "<rol> esp."
const TZ = 'America/Santiago';
// Same as the portal emails (gas/Code.js): titles, colors, portal URL, logo sent inside the email (cid:logo)
const TITULO_PROGRAMA = { ASE: 'Aprendizaje Socioemocional', REL: 'Religión Católica' };
const COLOR = { tinta: '#151b29', rojo: '#b51a2a', naranjo: '#dc911b', verde: '#a2c037', celeste: '#6bacc4', amarillo: '#f9dc0a',
  gris: '#f5f5f5', celesteClaro: '#c8e3ed', muted: '#5b6070' };
const PORTAL_URL = 'https://portal.fundaciontrabun.cl';
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LOGO_B64 = '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';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Seguimiento')
    .addItem('Generar correos de avance', 'abrirDialogoAvance')
    .addToUi();
}

// A tab written by Cloud Run: rows 1–2 status lines, header on row 3
function leerTab_(nombre, requeridas) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sh) throw new Error(`Falta la pestaña «${nombre}». La escribe el servidor del portal cada 2 minutos.`);
  const v = sh.getDataRange().getValues();
  const h = (v[2] || []).map(x => String(x).trim());
  const falta = requeridas.filter(c => h.indexOf(c) < 0);
  if (falta.length) throw new Error(`La pestaña «${nombre}» no tiene las columnas esperadas (${falta.join(', ')}).`);
  return { estado: String((v[0] || [])[0] || ''), filas: v.slice(3).map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; }) };
}

function destinatarios_() {
  return leerTab_(TAB_DEST, COLS_DEST).filas.filter(f => String(f.RBD).trim()).map(f => Object.assign(f, { clave: String(f.RBD).trim() + '|' + String(f.Programas).trim() }));
}

// For the dialog: JdPs, rows (no claves or emails), the tracker's update time and who is running it
function datosDialogoAvance() {
  const filas = destinatarios_();
  const yo = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const mia = filas.find(f => String(f['Correo JdP']).toLowerCase() === yo);
  const jdp = f => String(f['Jefe/a de Proyecto'] || '(sin Jefe/a de Proyecto)');
  return {
    jdps: Array.from(new Set(filas.map(jdp))).sort((a, b) => a.localeCompare(b, 'es')),
    filas: filas.map(f => ({ clave: f.clave, colegio: String(f.Colegio), programas: String(f.Programas), jdp: jdp(f),
      listo: !!(String(f.Para).trim() && String(f.Clave).trim()), obs: String(f.Observaciones || '') })),
    actualizado: leerTab_(TAB_RESUMEN, ['RBD', 'Programa']).estado.replace(/^Actualizado:\s*/, ''),
    miJdp: mia ? jdp(mia) : '',
  };
}

function abrirDialogoAvance() {
  const html = HtmlService.createHtmlOutput(DIALOGO_HTML).setWidth(560).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Correos de avance EFA');
}

// "RBD|PROG" → [{ nombre, r, e }] from Resumen at this moment
function numeros_() {
  const cols = ['RBD', 'Programa'].concat([].concat.apply([], ROLES.map(r => [r + ' resp.', r + ' esp.'])));
  const out = {};
  leerTab_(TAB_RESUMEN, cols).filas.forEach(f => {
    out[String(f.RBD).trim() + '|' + String(f.Programa).trim().toUpperCase()] = ROLES.map(nombre => ({
      nombre, r: Number(f[nombre + ' resp.']) || 0, e: typeof f[nombre + ' esp.'] === 'number' ? f[nombre + ' esp.'] : null }));
  });
  return out;
}

// Creates one draft per selected row in the Gmail of whoever runs it, with the numbers of this moment. Never sends.
function generarBorradoresAvance(claves) {
  const pedidas = new Set(claves || []);
  const filas = destinatarios_().filter(f => pedidas.has(f.clave));
  const numeros = numeros_();
  const hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const logo = Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'logo-trabun.png');
  let creados = 0;
  const omitidos = [];
  filas.forEach(f => {
    const para = String(f.Para || '').split(/[\s,;]+/).filter(Boolean).join(',');
    if (!para || !String(f.Clave).trim()) { omitidos.push(String(f.Colegio)); return; }
    const c = correoAvance_(f, numeros, hoy);
    const opciones = { htmlBody: c.html, inlineImages: { logo } };
    const cc = String(f.CC || '').split(/[\s,;]+/).filter(Boolean).join(',');
    if (cc) opciones.cc = cc;
    GmailApp.createDraft(para, c.asunto, c.texto, opciones);
    creados++;
  });
  console.log(`Borradores de avance: ${creados} creados, ${omitidos.length} omitidos.`); // counts only
  return `Borradores creados: ${creados}.` + (omitidos.length ? `\nSin correo o sin clave (revisa Observaciones en ${TAB_DEST}): ${omitidos.join(', ')}.` : '')
    + '\n\nRevísalos en Borradores de Gmail y envíalos desde ahí.';
}

// Written as from the JdP (first person: they send it and can be answered). Per program, responses vs expected per
// role (expected = SF contacts with the tracker's automatic 1), so a wrong expected count pushes the JdP to fix SF.
// Roles with nothing expected and no responses are left out; with responses they stay (they show what SF is missing).
// No traffic-light colors. Portal access as in the kickoff email.
function correoAvance_(f, numeros, hoy) {
  const nombres = String(f.Nombres || '').split(/\s*,\s*/).filter(Boolean);
  const uno = String(f.Para).split(/[\s,;]+/).filter(Boolean).length === 1;
  const tu = (a, b) => (uno ? a : b);
  const e = escHtml_;
  const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rbd = String(f.RBD).trim(), clave = String(f.Clave).trim(), jdp = String(f['Jefe/a de Proyecto'] || '').trim();
  const progs = String(f.Programas).split(/\s*\+\s*/).filter(p => TITULO_PROGRAMA[p]);
  const titulos = progs.map(p => TITULO_PROGRAMA[p]);
  const fase = String(f['Fase EFA'] || ''), cierra = fechaLarga_(fechaTexto_(f['Cierre EFA']));
  const colegio = String(f.Colegio || '') || `RBD ${rbd}`;
  const asunto = `Avance Encuesta de Fin de Año 2026 · ${colegio}`;
  const pct = x => (x.e ? `${Math.round(x.r / x.e * 100)}%` : '—');
  const tablasDatos = progs.map(p => ({ p, roles: (numeros[rbd + '|' + p] || []).filter(x => x.e || x.r) })).filter(x => x.roles.length);

  const saludo = `Hola${nombres.length ? ', ' + conY_(nombres) : ''}:`;
  const intro = `${tu('Te', 'Les')} comparto cómo va la Encuesta de Fin de Año en ${colegio}, con las respuestas recibidas hasta hoy, ${fechaLarga_(hoy)}.`
    + (fase === 'open' && cierra ? ` La encuesta está abierta hasta el ${cierra}.` : '')
    + (fase === 'extra' && cierra ? ` La encuesta tiene una semana extra: sigue abierta hasta el ${cierra}.` : ''); // Cierre EFA = end of the extra week
  const esperadas = 'Las esperadas son las personas que tenemos registradas en el programa para cada rol; quien cumple dos roles cuenta en ambos. '
    + `Si ${tu('ves', 'ven')} que falta alguien o hay alguien que ya no está, ${tu('avísame', 'avísenme')} para actualizarlo.`;
  const recordar = fase === 'open' || fase === 'extra' ? `Si aún faltan personas por responder, ${tu('te', 'les')} pido recordárselo y compartir el link con quienes no lo tengan.` : '';
  const portalA = 'En el ', portalB = ` ${tu('vas', 'van')} a encontrar:`;
  const items = [
    ['El link de la encuesta', `de ${tu('tu', 'su')} colegio, listo para copiar o enviar por WhatsApp con un mensaje para el equipo.`, COLOR.naranjo],
    ['Quiénes ya respondieron', `en dirección, líderes educativos y docentes (solo quién respondió, nunca sus respuestas), para que ${tu('puedas', 'puedan')} recordarle a quien falte.`, COLOR.rojo],
  ];
  const entrar = `${tu('Entra', 'Entren')} al portal con estos datos`;
  const reserva = `La clave es para ${tu('ti', 'ustedes')} y quienes ${tu('te', 'les')} ayuden con el seguimiento; ${tu('te', 'les')} pido no compartirla con nadie más, ya que en el portal se ve quién ha respondido.`;
  const gracias = `¡Muchas gracias por ${tu('tu', 'su')} apoyo!`;
  const firma = (jdp ? [jdp] : []).concat(['Fundación Trabün']);

  const tablaTexto = tablasDatos.map(t => `${TITULO_PROGRAMA[t.p]}:\n` + t.roles.map(x => `• ${x.nombre}: ${miles(x.r)} de ${x.e == null ? '—' : miles(x.e)} (${pct(x)})`).join('\n')).join('\n\n');
  const texto = [saludo, intro].concat(tablaTexto ? [tablaTexto] : []).concat([esperadas]).concat(recordar ? [recordar] : [])
    .concat([`${portalA}Portal de Seguimiento 2026${portalB}`, items.map(i => `• ${i[0]}: ${i[1]}`).join('\n'),
      `${entrar}:\nRBD: ${rbd}\nClave: ${clave}\n${PORTAL_URL}`, reserva, gracias, firma.join('\n')])
    .join('\n\n');

  const celda = (x, extra) => `<td style="padding:9px 12px;font-size:14px;color:${COLOR.tinta};border-bottom:1px solid #e6e6e6;${extra || ''}">${x}</td>`;
  const cab = x => `<th style="padding:10px 12px;font-size:13px;font-weight:bold;color:#ffffff;text-align:${x === 'Rol' ? 'left' : 'center'}">${x}</th>`;
  const p = s => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${COLOR.tinta}">${s}</p>`;
  const tablas = tablasDatos.map(t => `<p style="margin:6px 0 8px;font-size:15px;font-weight:bold;color:${COLOR.tinta}">${e(TITULO_PROGRAMA[t.p])}</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #e6e6e6">`
    + `<tr style="background:${COLOR.tinta}">${['Rol', 'Respuestas', 'Esperadas', 'Avance'].map(cab).join('')}</tr>`
    + t.roles.map(x => `<tr>${celda(e(x.nombre))}${celda(miles(x.r), 'text-align:center')}${celda(x.e == null ? '—' : miles(x.e), 'text-align:center')}${celda(pct(x), 'text-align:center;font-weight:bold')}</tr>`).join('')
    + '</table>')
    .concat([`<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${COLOR.tinta}">${e(esperadas)}</p>`])
    .concat(recordar ? [p(e(recordar))] : []).concat([p(`${e(portalA)}<b>Portal de Seguimiento 2026</b>${e(portalB)}`)]);

  const titulo = fase === 'closed' ? 'Así terminó la Encuesta de Fin de Año' : 'Así va la Encuesta de Fin de Año';
  const bajada = (titulos.length > 1 ? `Programas de ${conY_(titulos)}` : `Programa de ${titulos[0] || ''}`) + (fase === 'open' && cierra ? ` · abierta hasta el ${cierra}` : '')
    + (fase === 'extra' && cierra ? ` · semana extra hasta el ${cierra}` : '');
  const html = correoHtml_({ titulo, bajada, gracias, reserva, entrar, rbd, clave, firma, parrafos: [e(saludo), e(intro)], tablas, items });
  return { asunto, texto, html };
}

// Same layout as the portal's announcement emails (gas/Code.js correoHtml_): table layout and inline styles (what Gmail
// and Outlook render), brand colors, logo inside the email (cid:logo); signed by the JdP, no automatic-email footer.
function correoHtml_(o) {
  const e = escHtml_;
  const fuente = "font-family:Lato,'Helvetica Neue',Arial,sans-serif";
  const parrafo = s => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${COLOR.tinta}">${s}</p>`;
  const caja = (fondo, borde, interior) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondo};border-left:5px solid ${borde};border-radius:12px;margin:0 0 12px"><tr><td style="padding:14px 18px">${interior}</td></tr></table>`;
  const franja = [COLOR.rojo, COLOR.naranjo, COLOR.verde, COLOR.celeste, COLOR.amarillo]
    .map(c => `<td height="6" style="height:6px;background:${c};font-size:0;line-height:0">&nbsp;</td>`).join('');
  const dato = (k, v) => `<tr><td style="padding:3px 18px 3px 0;font-size:14px;color:${COLOR.tinta}">${k}</td><td style="padding:3px 0;font-size:22px;font-weight:bold;letter-spacing:1px;color:${COLOR.tinta};font-family:Menlo,Consolas,'Courier New',monospace">${e(v)}</td></tr>`;
  return `<div style="margin:0;padding:24px 12px;background:${COLOR.gris};${fuente}">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border-collapse:separate">
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${franja}</tr></table></td></tr>
<tr><td style="padding:26px 32px 0"><img src="cid:logo" width="64" height="59" alt="Fundación Trabün" style="display:block;border:0;outline:none"></td></tr>
<tr><td style="padding:18px 32px 0">
<h1 style="margin:0 0 6px;font-size:24px;line-height:1.25;font-weight:bold;color:${COLOR.tinta}">${e(o.titulo)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.4;color:${COLOR.tinta};opacity:.8">${e(o.bajada)}</p>
${o.parrafos.map(parrafo).join('')}
${o.tablas.join('')}
${o.items.map(i => caja(COLOR.gris, i[2], `<p style="margin:0;font-size:15px;font-weight:bold;color:${COLOR.tinta}">${e(i[0])}</p><p style="margin:2px 0 0;font-size:14px;line-height:1.45;color:${COLOR.tinta}">${e(i[1].charAt(0).toUpperCase() + i[1].slice(1))}</p>`)).join('')}
<div style="height:10px"></div>
${caja(COLOR.celesteClaro, COLOR.celeste, `<p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:${COLOR.tinta}">${e(o.entrar)}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${dato('RBD', o.rbd)}${dato('Clave', o.clave)}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 10px"><tr><td style="border-radius:999px;background:${COLOR.rojo}"><a href="${PORTAL_URL}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">Entrar al portal</a></td></tr></table>
<p style="margin:0;font-size:13px;line-height:1.45;color:${COLOR.tinta}"><a href="${PORTAL_URL}" style="color:${COLOR.tinta}">portal.fundaciontrabun.cl</a> · ${e(o.reserva)}</p>`)}
<div style="height:8px"></div>${parrafo(e(o.gracias))}
<p style="margin:0 0 28px;font-size:15px;line-height:1.45;font-weight:bold;color:${COLOR.tinta}">${o.firma.map(e).join('<br>')}</p>
</td></tr>
</table></div>`;
}

// A date cell (Cloud Run writes "2026-11-13" as text; a Sheet may turn it into a Date) → "2026-11-13"
function fechaTexto_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

// "2026-11-13" → "viernes 13 de noviembre"
function fechaLarga_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const f = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DIAS_SEMANA[f.getUTCDay()]} ${+m[3]} de ${MESES[+m[2] - 1]}`;
}

// "A, B y C"; "e" before a word that sounds like i
function conY_(l) {
  if (l.length < 2) return l[0] || '';
  const ultimo = l[l.length - 1];
  return l.slice(0, -1).join(', ') + (/^h?[ií](?![aeiouáéíóú])/i.test(String(ultimo).trim()) ? ' e ' : ' y ') + ultimo;
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DIALOGO_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#151b29;padding:16px}
.sub{font-size:12px;color:#5b6070;margin:4px 0 12px;line-height:1.4}label.t{display:block;font-size:12px;font-weight:bold;margin:0 0 4px}
select,input[type=text]{width:100%;padding:7px 10px;border:1px solid #c8ccd4;border-radius:6px;font-size:13px;margin-bottom:8px}
.ctl{display:flex;gap:12px;margin-bottom:8px}.ctl button{background:none;border:none;color:#151b29;text-decoration:underline;cursor:pointer;font-size:12px}
.lista{height:330px;overflow-y:auto;border:1px solid #e6e6e6;border-radius:6px}.it{padding:6px 10px;border-bottom:1px solid #f2f2f2}
.it label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}.it small{display:block;color:#5b6070}.it.no{opacity:.55}.oc{display:none}
.pie{display:flex;justify-content:space-between;align-items:center;margin-top:12px}.btns{display:flex;gap:8px}
.b1{padding:8px 14px;border:1px solid #c8ccd4;background:#fff;border-radius:999px;cursor:pointer}
.b2{padding:8px 16px;border:none;background:#151b29;color:#fff;border-radius:999px;cursor:pointer;font-weight:bold}.b2:disabled{background:#c8ccd4;cursor:default}
</style></head><body>
<div id="cargando">Cargando…</div>
<div id="ui" style="display:none">
<p class="sub" id="act"></p>
<label class="t" for="jdp">Jefe/a de Proyecto</label>
<select id="jdp" onchange="pintar()"><option value="">Todos</option></select>
<input type="text" id="q" placeholder="Buscar colegio…" oninput="filtrar()">
<div class="ctl"><button onclick="marcar(true)">Seleccionar todos</button><button onclick="marcar(false)">Ninguno</button></div>
<div class="lista" id="lista"></div>
<div class="pie"><span>Seleccionados: <b id="n">0</b></span>
<div class="btns"><button class="b1" onclick="google.script.host.close()">Cancelar</button><button class="b2" id="go" disabled onclick="generar()">Crear borradores</button></div></div>
</div>
<script>
var D = null;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
google.script.run.withSuccessHandler(function(d){
  D = d; var s = document.getElementById('jdp');
  d.jdps.forEach(function(j){ var o = document.createElement('option'); o.value = j; o.textContent = j; s.appendChild(o); });
  if (d.miJdp) s.value = d.miJdp;
  document.getElementById('act').textContent = 'Números del seguimiento al ' + (d.actualizado || '—') + ' (se actualizan cada 2 minutos). Se crea un borrador en tu Gmail por cada colegio marcado; nada se envía hasta que tú lo envíes.';
  document.getElementById('cargando').style.display = 'none'; document.getElementById('ui').style.display = 'block'; pintar();
}).withFailureHandler(function(e){ document.getElementById('cargando').textContent = 'No se pudo cargar: ' + e.message; }).datosDialogoAvance();
function pintar(){
  var j = document.getElementById('jdp').value;
  document.getElementById('lista').innerHTML = D.filas.filter(function(f){ return !j || f.jdp === j; }).map(function(f){
    return '<div class="it' + (f.listo ? '' : ' no') + '"><label><input type="checkbox" class="cb" value="' + esc(f.clave) + '"' + (f.listo ? '' : ' disabled') + '>'
      + '<span>' + esc(f.colegio) + ' · ' + esc(f.programas) + (f.obs ? '<small>' + esc(f.obs) + '</small>' : '') + '</span></label></div>';
  }).join('');
  document.querySelectorAll('.cb').forEach(function(c){ c.addEventListener('change', contar); }); filtrar();
}
function filtrar(){ var q = document.getElementById('q').value.toLowerCase();
  document.querySelectorAll('.it').forEach(function(it){ it.classList.toggle('oc', it.textContent.toLowerCase().indexOf(q) < 0); }); contar(); }
function marcar(v){ document.querySelectorAll('.cb').forEach(function(c){ if (!c.disabled && !c.closest('.it').classList.contains('oc')) c.checked = v; }); contar(); }
function contar(){ var n = document.querySelectorAll('.cb:checked').length; document.getElementById('n').textContent = n; document.getElementById('go').disabled = !n; }
function generar(){
  var c = Array.prototype.map.call(document.querySelectorAll('.cb:checked'), function(x){ return x.value; });
  var b = document.getElementById('go'); b.disabled = true; b.textContent = 'Creando…';
  google.script.run.withSuccessHandler(function(m){ alert(m); google.script.host.close(); })
    .withFailureHandler(function(e){ alert('Error: ' + e.message); b.disabled = false; b.textContent = 'Crear borradores'; })
    .generarBorradoresAvance(c);
}
</script></body></html>`;
