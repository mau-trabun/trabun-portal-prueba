# Data contract v1 — Portal de Seguimiento 2026

Agreed 05-10-2026. Items marked **PENDING** are open decisions (see CLAUDE.md). This file holds no real data; examples are fictional.

## 0. General rules
- Columns are found **by header**, never by position. Extra columns are ignored, so adding a column never breaks the backend.
  - `SF`, `Contraseñas`, `Config`, `Formularios`: exact header match.
  - Response tabs: **prefix** match. When several columns share a prefix (e.g. one `Colegio` column per region), the first non-empty value in the row wins.
- Rows with no RBD are skipped.
- The backend never writes to any tab except `Métricas` (and later `Precalculo`), plus the separate team tracker Sheet (§1 `Seguimiento interno`).
- `Nuevas` is Mau's auxiliary tab. **Nothing reads it.**

## 1. Sheet tabs

### `SF` (Salesforce connector, raw, no formula columns)
| Header | Use |
|---|---|
| `ID RBD` | key, normalized (§2) |
| `Nombre para formulario` | `Comuna - Nombre - RBD` → `nombre` = part 2, `comuna` = part 1 |
| `Implementación: Record Type` | `ASE` → `ase`, `Religión` → `rel`; any other value → row ignored |
| `Modelo` | `Formularios` matching (EFA, PENDING); shown as a pill |
| `Jefe de Proyecto`, `Coordinador` | optional; shown as pills in the program band (Trabün staff, not respondents) |
| `EDI` | TRUE/FALSE. Only ever TRUE on ASE rows. |
| `Año inicio ASE`, `Año inicio Religión` | `Formularios` matching (EDI cohort) |
| `Alumnos NT1` … `Alumnos IV` (14) | `est` per grade |
| `CxN NT1` … `CxN IV` (14) | course count per grade |

Grade suffixes: `NT1, NT2, 1º, 2º, 3º, 4º, 5º, 6º, 7º, 8º, I, II, III, IV`. If the same RBD × program appears twice, the first row wins.

### `Contraseñas`
`rbd | clave`. The match is exact after trimming spaces (case-sensitive).

### `Config` (`clave | valor | nota`)
| clave | valor |
|---|---|
| `test_abre`, `test_cierra` | date cells |
| `efa_abre`, `efa_cierra` | date cells |
| `student_id` | `nombre` \| `numero` |
| `contacto_general` | `evaluacion@fundaciontrabun.cl` |
| `contacto_edi` | `consultas_edi@fundaciontrabun.cl` |

### `Formularios` (one row per form)
| Encuesta | Form | Programa | EDI | Año inicio | Modelo | Desde | Hasta | Link |
|---|---|---|---|---|---|---|---|---|
| test | ASE_4-5 | ASE | NO | | | 4° básico | 5° básico | … |
| test | ASE_6-IV | ASE | NO | | | 6° básico | IV° medio | … |
| test | ASE_EDI_4 | ASE | SÍ | 2025 | | 4° básico | 4° básico | … |
| test | ASE_EDI_I-IV | ASE | SÍ | 2025 | | I° medio | IV° medio | … |
| test | ASE_EDI_8-IV | ASE | SÍ | 2026 | | 8° básico | IV° medio | … |
| test | REL_5-8 | REL | | | | 5° básico | 8° básico | … |
| test | REL_I-IV | REL | | | | I° medio | IV° medio | … |
| efa | *PENDING (likely one per Programa × Modelo, as in EFS)* | | | | | | | |

- **Matching:** a blank cell means "any". A school-program uses every row of that `Encuesta` whose filled-in cells all equal its SF values. `Año inicio` is compared with the program's own `Año inicio` column. Text values (`Programa`, `EDI`, `Modelo`) are compared ignoring case and accents (SF writes `Semi-Intensivo`, EFS labels wrote `Semi-intensivo`).
- **Test grades** for a school-program = union of `Desde`…`Hasta` over its matching `test` rows. This replaces any fixed availability rule.
  - EDI grades with no row are surveyed on paper by Agencia Focus (part of the RCT: cohort 2025 → 5°–8° básico, cohort 2026 → 4°–7° básico). Hardcoded in `PAPEL_EDI` (fixed by design); sent as `test.nivelesPapel` (∩ implemented) and shown as fixed, non-expandable rows ("Test en papel · a cargo de la Agencia Focus"), never with data.
- **`Link`:** an empty `Link` hides that share row, but the row still defines which grades have a Test.
- **Test links are per school (SurveyMonkey custom variables, 07-10-2026).** `Link` holds the survey's base link (`https://www.surveymonkey.com/r/XXXXXXX`); the backend appends `?RBD=<rbd>&colegio=<Nombre, Comuna>` (`linkColegio_()`: name and comuna from SF `Nombre para formulario`, spaces collapsed, URL-encoded with `!'()*` escaped too). This reproduces the 2026 per-school links file byte for byte (533/533). SurveyMonkey stores the values, so `RBD` reaches the responses; the survey shows the `colegio` text. A `Link` that already has `RBD=` is left as is. EFA links are not changed.
- **`Form`:** uses the same label as the `Form` column of the response imports.

### `Respuestas Test`
Header row typed by hand. **Source (07-10-2026): SurveyMonkey, not Google Forms**: a compiled responses Sheet with one tab per survey (7), SurveyMonkey export columns (`Respondent ID`, `Start Date`, …, `QN. Nombres`, `QN. Apellidos`, `QN. Número de lista …`, `QN. ¿En qué curso estás?`, `QN. ¿Cuál es la letra de tu curso? …`, answers, then `RBD` and `colegio` from the link's custom variables). Question positions differ between REL and ASE tabs. A2 holds one `LET`/`VSTACK` formula: per tab it reads the header row via `IMPORTRANGE`, finds each column by header (`XMATCH` wildcards), imports only the span of identification columns plus the `RBD` column, keeps rows with an RBD, and labels `Form`. A tab that can't be read, or a missing column, writes a visible "REVISAR: …" row naming the problem. **Authorize `IMPORTRANGE` first in a separate cell** (`=IMPORTRANGE(id; "'REL I - IV medio'!1:1")` → Permitir acceso): inside the `LET` the error is caught and the "Permitir acceso" prompt never shows, so every tab reads "REVISAR" (seen 07-10-2026). The source tabs' EDI names carry the cohort in brackets (`ASE EDI 4° básico [Cohorte 1]`); xlsx exports drop the brackets. **Import only these columns**, never test answers.

| Form | Marca temporal | Nombres | Apellidos | Número de lista | Nivel | Letra | Colegio (×N) |
|---|---|---|---|---|---|---|---|

- `Marca temporal` = SurveyMonkey `Start Date`. The bare `RBD` goes into the first `Colegio` column (the backend takes the last ` - ` segment of the first non-empty `Colegio`, so a bare RBD works); the other `Colegio` columns stay empty. They remain from the Google Forms design (one per region) and are harmless.

- `Marca temporal` is optional (students are not deduplicated).
- `Nivel` is mandatory in the form.
- `Nombres`/`Apellidos` are used in `nombre` mode; `Número de lista` in `numero` mode. Both are mandatory in the forms; the blank-value handling ("Sin identificar", "sin número de lista") is only a guard in case a form question is left optional by mistake.

### `Respuestas EFA`
Same import pattern as EFS.

| Form | Fecha | Nombre | Apellido | Correo | Colegio | Rol | Niveles |
|---|---|---|---|---|---|---|---|

- `Fecha` is a date cell or ISO text.
- `Niveles` is comma-separated (`5° básico, 6° básico`); `-` = empty.
- `Rol` values: fixed list, **PENDING**.

### `Métricas` (append-only, successful logins and usage events only)
`timestamp | rbd | programas | testOk | efaOk | evento`. It never stores the clave, IP or names.
- Login: `programas` = the school's programs (`ASE,REL`), `testOk`/`efaOk` booleans, `evento` = `login`.
- Usage event (sent by the portal once per session each): `programas` = the program of the card used (`ASE` | `REL`; blank for `ver_efa`), `testOk`/`efaOk` blank, `evento` one of: `ver_efa` (EFA tab opened); `test_copiar_link`, `test_copiar_mensaje`, `test_whatsapp`, `test_qr`, `test_instructivo`, `test_copiar_lista`, `test_whatsapp_lista`; `efa_copiar_link`, `efa_copiar_mensaje`, `efa_whatsapp`, `efa_qr`.

### `Sin Test` (written by `listarSinTest()`, manual; Mau ticks `Habilitar`)
`RBD | Colegio | Comuna | Programa | Modelo | EDI | Año inicio | Jefe/a de Proyecto | Niveles del colegio | Test en papel | Habilitar`, plus any column Mau adds.
- One row per school-program (all SF programs, Control included) whose SF grades have no online Test: `Formularios` test grades ∩ SF grades is empty. `Niveles del colegio` and `Test en papel` are written as ranges ("NT1 a 3° básico").
- **The portal shows these school-programs no Test links** (only "No hay niveles con Test…" or their paper rows). `Habilitar` ticked (checkbox, or `SÍ`/`TRUE` typed) → `test.habilitado: true` → the share section shows every Test link of the group, as before 07-10-2026.
- Re-run after SF or `Formularios` change: the tab is rebuilt, sorted by Programa, Jefe/a de Proyecto, Colegio; `Habilitar` and extra columns are kept per RBD + Programa **as values** (a formula in an extra column becomes its value: keep lookups in another tab). Rows that no longer qualify are dropped. Missing tab = nobody habilitado; login never depends on it.

### `Encargados` and `Correos Test` (announcement emails; manual functions, run as evaluacion@)
- `Encargados`: the SF encargados export pasted as is (`Nombre para formulario | ID RBD | Programa que participa | Account Name | First Name | Last Name | Email`, one row per person). Never in `TABS`: Cloud Run never reads people's emails.
- **Bien Público / SIP** (optional SF columns `Proyecto` and `Sostenedor`; absent = no effect): a program with `Proyecto` = "Bien Público" is not announced (like Control); a school left with only such programs, or whose `Sostenedor` is the Sociedad de Instrucción Primaria (SIP), gets `Enviar` unticked by default with an Observación starting "Bien Público:" / "SIP:" (joint SIP email still to be defined). Mau's tick is kept on rebuild unless the school changes category.
- `correos_jdp`: name (first column) → email (column whose header contains "correo"), for the CC. Names matched to SF `Jefe de Proyecto` / `Coordinador` ignoring case, accents and spaces.
- `prepararCorreosTest()` writes `Correos Test`: `RBD | Colegio | Programas | Jefe/a de Proyecto | Para | CC | Nombres | Contacto | Asunto | Mensaje | Observaciones | Enviar | Enviado`, one row per school in `Contraseñas`. Programs come from SF (Control and no-Test programs left out, `Habilitar` counts), never from the export's "Programa" column; all the school's encargados (emails deduplicated, lower case; RBD from "ID RBD" or the name's last ` - ` segment) go together in one email, singular (tú) or plural (ustedes) wording. Rebuild keeps `Enviado` and an unticked `Enviar` per RBD. `CC` = Jefe/a de Proyecto + Coordinador/a of the announced programs (deduped, never an encargado); names missing from `correos_jdp` are listed in Observaciones. `Para` and `CC` can be edited by hand before sending.
- `enviarCorreoPrueba()`: up to 3 samples, subject "[PRUEBA] …", to Config `correos_prueba` (comma-separated, in the Sheet only) or the runner. `enviarCorreosTest()`: every ticked row without `Enviado`, stamps `Enviado` after each send (never twice), stops before the daily quota or ~5 min (re-run to continue). Designed HTML (table layout, inline styles, brand colors; logo sent inside the email as an inline image `cid:logo`, because Outlook and others block hosted images by default) + plain-text body; signed "Fundación Trabün"; order: what the portal offers first, then the access box; samples carry a box with the real Para/CC and never CC anyone. Name "Fundación Trabün", reply-to = the school's contacto (consultas_edi@ for EDI), text says it's automatic and not to reply. Logs counts only.

### `Seguimiento interno` (separate Sheet for the team, written by Cloud Run; 19-10-2026)
A Google Sheet outside the 2026 Sheet (which holds claves and emails), shared with the team and with the service account `portal-api@…` as **Editor**. Its ID goes only in the env var `SEGUIMIENTO_ID` at deploy (`SHEET_ID=… SEGUIMIENTO_ID=… bash cloudrun/deploy.sh prod`); unset = not written. **Counts only, never names or emails.**
- Rewritten after every snapshot (Scheduler every 2 min, so as fresh as the portal; IMPORTRANGE's own delay is upstream) **from 8:00 to 18:00** Santiago time (`SEG_HORARIO` in `gas/Code.js`); outside those hours only the first snapshot of each clock hour writes (18:00, 19:00 … 23:00, 6:00, 7:00). Nothing from 0:00 to 6:00, when the Scheduler is off (unless a login triggers a snapshot). Row 2 states the schedule. Built by `seguimiento_(d, datosSeguimiento_(), reloj)` in `gas/Code.js` (pure), which runs `panel_()` per school: every number is the one the school sees. Not written when `Respuestas Test` can't be read (the previous version stays). Never blocks a login.
- Extra sources: `Métricas` (logins and Test share events) and `Correos Test` (**only** the `RBD` and `Enviado` columns are downloaded by Cloud Run, never `Para`/`CC`). Either missing → blank columns.
- Each tab: A1 = "Actualizado: DD-MM-YYYY HH:MM", A2 = "Actualización automática cada 2 minutos de 8:00 a 18:00, y una vez por hora el resto del día." (Mau 19-10-2026), row 3 = header, data from row 4. Values written RAW (numbers stay numbers, dates as `DD-MM-YYYY` text). The layout's formatting: 3 frozen rows, bold header, `%` columns as percentages (the rest automatic), and **gray bands per grade** (Mau 19-10-2026): every other grade's `resp.` + `est.` pair gray (`#EEEEEE`) from the header down, every other column white (`formato.gris` from `seguimiento_()`). Applied to a new tab, and again only when the layout changes (header, bands or `FORMATO_V` in `cloudrun/sheets.js`), tracked by a developer-metadata marker `seguimiento_formato` on each tab; otherwise only values are written, so the team's formatting stays. Re-applying repaints the backgrounds of the header and data columns; conditional formatting rules are separate and survive. **Manual edits and sorts are overwritten**: use filter views.
- Rows: every SF school-program with Test grades (registered ∪ seen), sorted by Jefe/a de Proyecto, Colegio, Programa. Left out: paper-only and no-Test school-programs, and Control unless it has responses.
- **`Resumen`**: `RBD | Colegio | Programa | Modelo | EDI | Jefe/a de Proyecto | Coordinador/a | Correo enviado | Ingresos al portal | Último ingreso | Compartió el Test | Respuestas | Estimado | % | Cursos sin respuestas | <two columns per grade, canonical order: '<grade> resp.' | '<grade> est.'>` (no Comuna; Coordinador/a from SF `Coordinador` of that program; Mau 19-10-2026).
  - `Correo enviado` = `Correos Test` `Enviado` date of the RBD. `Ingresos al portal` / `Último ingreso` = `login` rows of the RBD (per school, same on both program rows). `Compartió el Test` = distinct Test share events of that program (`link, mensaje, WhatsApp, QR, instructivo, lista por curso`).
  - `Respuestas`, `Estimado`, `%` = panel `resumen.r`, `resumen.est`, `rConEst / est` (internal only: schools never see a %).
  - `Cursos sin respuestas` = registered classes (SF letters) of registered grades with 0 responses (`7°B, I°A`); a registered grade with no SF letters and 0 responses is listed by name.
  - Grade columns, two numbers so the team can add them up (Mau 19-10-2026; was one `r / ~est` text cell): `resp.` = `r`, `est.` = grade `est` (blank if none). Text only where there is no number (SUM ignores it): `est.` = `Fuera de lo registrado` for an unregistered grade with responses; `resp.` = `Papel` for an EDI paper grade; both blank when the school doesn't have the grade. Σ `resp.` = `Respuestas`, Σ `est.` = `Estimado`.
- **Cell notes** (hover notes, Mau 19-10-2026): unexpected cases carry a note that starts with the portal's wording and says why. Rewritten as a whole per tab when they change (the writer remembers the last set; first write after a restart always sends them), placed after the values. Notes typed by hand in rows ≥ 4 of these tabs are erased.
  - `Resumen`, grade `est.` = `Fuera de lo registrado` → "Fuera de lo registrado: {why}, pero hay N respuestas. Cuentan en Respuestas, no en el %." with {why} = "este nivel hace el test en papel (Agencia Focus)" (EDI paper grade) | "este nivel no tiene Test en línea para el colegio" (implemented, no form) | "SF no tiene este nivel en el programa".
  - `Resumen`, registered grade without estimate, on `est.` → "Sin estimado: SF no tiene Alumnos para este nivel. No cuenta en el %."; `resp.` above `est.` → "N sobre lo estimado (estimado: E)."; `resp.` = `Papel` → "Test en papel · a cargo de la Agencia Focus."; `%` when `rConEst < r` → "El % considera solo los niveles con estimado: X de N respuestas."
  - `Por curso`, `Registrado` = `Fuera de lo registrado` → "Curso no registrado: {why}." (grade outside) | "Curso no registrado: SF tiene K cursos en {nivel} (A, B)." | "…: SF no tiene cursos (CxN) para {nivel}."; `Sin letra` → note on `Curso` and `Registrado`; registered class without estimate → `Estimado` "Sin estimado: falta Alumnos o CxN en SF."; `Respuestas` above `Estimado` → "N sobre lo estimado."
- **`Por curso`**: `RBD | Colegio | Programa | Modelo | Jefe/a de Proyecto | Coordinador/a | Nivel | Curso | Respuestas | Estimado | % | Registrado`, one row per class of the panel (`Sin letra` for the no-letter bucket). `Estimado` = class `est` (`round(Alumnos ÷ CxN)`); `Registrado` = `Sí` | `Fuera de lo registrado`.

### `Precalculo` (not built yet; see §3 Volume)
`rbd | json | actualizado`.

## 2. Normalization (in GAS, never in the sheet)
- **RBD:** digits only (`12345.0` → `12345`). From `Colegio`: the last ` - ` segment.
- **Program:** in SF, from the record type. In responses, from the `Programa` of the `Formularios` row with the same `Form` label (so a label like `EFA_EDI` works); if the label has no row, from its first 3 letters (`ASE`/`REL`).
- **Grade:** trim, collapse spaces, `º` → `°`, case-insensitive. Then an **exact** match against the 14 canonical labels:
  `NT1, NT2, 1° básico … 8° básico, I° medio, II° medio, III° medio, IV° medio`.
  - 2025 forms used `5° Básico`; that matches.
  - No substring matching.
  - Test rows whose grade doesn't match are skipped (grade is mandatory, so this shouldn't happen).
- **Letter:** trim and uppercase. One letter A–Z, otherwise `null`.
- **List number:** a whole number from 1 to 99, otherwise `null` (a typo like 999 would otherwise draw a 999-cell grid).
- **Email:** trim and lowercase. Never leaves the server.
- **Names:** trim and collapse spaces only. Case is fixed at render time (`formatNombre`).

## 3. Derivation rules
- **Implemented grade:** `CxN > 0` or `Alumnos > 0`. Treated as a set (gaps allowed).
- **`est`:** `Alumnos` if > 0, else `null`. A `null` estimate shows as "Sin estimado" and is left out of the program %.
- **Registered letters:** the first `CxN` letters (3 → A, B, C).
- **Estudiantes grades** = (implemented ∩ test grades) ∪ grades seen in responses. A school with no intersection still shows the tab; any responses from it appear as "Fuera de lo registrado" (allowed diagnostic use).
- **Classes per grade:** registered letters ∪ letters seen.
- **Display order:** registered grades first, in canonical order, then unregistered ones; the same for letters.
- **Test totals:**
  - `r` counts every response.
  - `rConEst` = responses in grades that have an estimate.
  - Program % = `rConEst / est`.
- **`nombre` mode:** sorted by apellidos, then nombres, ignoring case and accents. No dedup.
- **`numero` mode:** no names are sent.
  - Each class sends its answered numbers (with repeats), `sinNumero`, and `tope = max(highest answered, round(Alumnos ÷ CxN))`. The second term only applies when both values are > 0, and only to registered letters (an unregistered class has no size estimate).
  - The frontend draws 1…`tope` and highlights the numbers that answered.
- **EFA dedup:**
  - Key = email + role within RBD × program, keeping the most recent `Fecha` (if missing, the later row wins).
  - **Any combination of roles is allowed.** A person with two roles appears once per role.
  - A response with no email is not deduplicated.
- **EFA counts:**
  - Section `r` = responses with a role in that section.
  - Grade `r` = people in that grade.
  - Program `total` = responses after dedup = Σ section `r`. A person with two roles answered twice and counts twice; a docente with several grades counts once.
- **EFA sections:**
  - Role → Dirección / Líderes educativos / Docentes: **PENDING** list. Interim rule (EFS role texts): starts with `Director` → Dirección; starts with `Docente`/`Profesor` → Docentes; anything else → Líderes. The role shown under a name is the text before the first comma (`Mentor/a, es decir, …` → `Mentor/a`).
  - ASE Docentes are grouped by grade: implemented ∪ declared, NT1–IV. A docente with several grades is listed under each but counted once. A docente with no valid grade goes in a `nivel: null` group.
  - ASE grade `cursos` = SF `CxN` if > 0, else `null` (also `null` for unregistered grades and the `nivel: null` group). Shown only inside the open grade as context ("En este nivel, hay N cursos con el programa."), never as a denominator: one teacher may cover every class.
  - REL Docentes: one flat list.
- **Phases:** computed on the server in `America/Santiago`.
  - `pre` before the `abre` date, `closed` after the end of the `cierra` day, `open` otherwise.
  - `diasRestantes` = calendar days to `cierra`.
  - If `Config` dates are missing, `fase` is `null` (login still works).
- **Contact:** `contacto_edi` if the school's ASE row has EDI = TRUE, otherwise `contacto_general`.
- **Degradation:** login depends only on `Contraseñas` + `SF`. If one response source fails, that survey gets `ok: false` and the rest still renders.
- **Volume:**
  - Launch with the summary built on each login.
  - Before launch, measure on staging with ~70.000 fictional student rows.
  - Have `Precalculo` running (a trigger every ~10 min) before volume peaks (end of October).

## 4. API
**Request:** `POST /exec`, header `Content-Type: text/plain`, body `{"rbd":"12345","clave":"abc123"}`. Refreshes (the "Actualizar" button and the 5-min auto-refresh) add `"refresco":true`: same response, but not logged in `Métricas`. The "Actualizar" button also adds `"fresco":true`: the Cloud Run backend then re-reads the Sheet before answering if its copy is older than 15 s (at most one read every 30 s); Apps Script ignores it.

**Usage event:** same request plus `"evento"` (and `"programa":"ase"|"rel"` when it concerns one card). Same clave check and throttle as a login; on success it appends one `Métricas` row and answers `{"ok":true}` without building the panel. An `evento` outside the fixed list (§1 `Métricas`) or a bad `programa` → `{"ok":false,"error":"evento"}`, no row. Sent with `navigator.sendBeacon` (text/plain), response ignored.

**Short Test link:** body `{"corto":"12885-REL_5-8"}` (`<RBD>-<Form>`, Form compared ignoring case and accents), no clave, no throttle, not logged → `{"ok":true,"link":"<full per-school SurveyMonkey link>"}` only if that RBD is in SF with a program that matches that `test` row of `Formularios` (same matching as the panel) and the row has a `Link`; otherwise `{"ok":false,"error":"link"}`. Used by `docs/t/index.html` (`portal.fundaciontrabun.cl/t/?12885-REL_5-8`), which redirects to the link. It returns what the link itself carries (RBD, school name, comuna). It does reveal whether an RBD is a partner school, accepted (school names are public; claves are untouched). **Renaming a `test` Form breaks the short links already printed or shared.**

**Health check:** `GET /exec` → `{"ok":true,"v":1}`. It never returns data.

**Error:** `{"ok":false,"error":"credenciales"|"bloqueado"|"servidor"}`. The frontend owns the wording, and `credenciales` shows "RBD o clave incorrectos".

**Success:**
```json
{
  "ok": true, "v": 1,
  "generado": "2026-10-20T14:03:00-03:00",
  "colegio": { "rbd": "12345", "nombre": "Colegio Ficticio", "comuna": "Comuna Ficticia" },
  "contacto": "evaluacion@fundaciontrabun.cl",
  "studentId": "nombre",
  "encuestas": {
    "test": { "abre": "2026-10-13", "cierra": "2026-11-20", "fase": "open", "diasRestantes": 31 },
    "efa":  { "abre": "2026-11-02", "cierra": "2026-11-13", "fase": "pre",  "diasRestantes": null }
  },
  "programas": [{
    "programa": "ase",
    "modelo": "Semi-Intensivo", "jefeProyecto": "Nombre Ficticio", "coordinador": null,
    "edi": false,
    "nivelesImplementados": ["1° básico", "2° básico", "…", "8° básico"],
    "test": {
      "ok": true,
      "nivelesTest": ["4° básico", "…", "8° básico"],
      "nivelesPapel": [],
      "habilitado": false,
      "links": [
        { "form": "ASE_4-5",  "desde": "4° básico", "hasta": "5° básico", "link": "https://…" },
        { "form": "ASE_6-IV", "desde": "6° básico", "hasta": "IV° medio", "link": "https://…" }
      ],
      "resumen": { "r": 212, "rConEst": 208, "est": 300 },
      "niveles": [{
        "nivel": "4° básico", "registrado": true, "est": 60, "r": 41,
        "cursos": [
          { "letra": "A", "registrado": true, "r": 21, "est": 30,
            "respuestas": [{ "nombres": "Agustín", "apellidos": "Bravo Castro" }] }
        ]
      }]
    },
    "efa": {
      "ok": true,
      "links": [],
      "total": 14,
      "secciones": [
        { "id": "direccion", "r": 2, "personas": [{ "nombre": "María José Fuentes", "rol": "Director/a" }] },
        { "id": "lideres",   "r": 4, "personas": [] },
        { "id": "docentes",  "r": 8,
          "niveles": [{ "nivel": "6° básico", "registrado": true, "cursos": 3, "r": 2, "personas": [] }] }
      ]
    }
  }]
}
```

Notes:
- **Course in `numero` mode:**
  `{ "letra": "A", "registrado": true, "r": 26, "est": 38, "tope": 38, "numeros": [1, 2, 4, 14, 14, 35], "sinNumero": 1 }`
- **Course `est`** (both modes, 07-10-2026): `round(SF Alumnos ÷ CxN)` for the grade, an average per class; only for letters registered in SF and when both values are > 0, else `null` (unregistered letters, the no-letter bucket, grades missing Alumnos or CxN). Shown in the class card as "r / ~est".
- **REL `docentes`** carries `personas` (a flat list) instead of `niveles`; each person has `niveles` (declared grades, canonical order, may be `[]`), shown after the role ("Docente · 5° a 8° básico").
- **`ok: false`** on a survey omits `resumen`/`niveles`/`secciones`, but keeps `links` and `nivelesTest`.
- **A school in `Contraseñas` but not in `SF`** gets `"programas": []`.
- **Not sent:** emails, claves. (Modelo, Jefe/a de Proyecto and Coordinador/a are sent since 05-10-2026 for the band pills, as in EFS.)
- **Share UI:** one tray row per link, labeled with its grade range. The share message lists each link with its range.
