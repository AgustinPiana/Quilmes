// Agenda del Cervecero — lee data/quilmes.json y arma las vistas.

const TZ = 'America/Argentina/Buenos_Aires';
const NOMBRE_DEPORTE = { futbol: 'Fútbol', basquet: 'Básquet', hockey: 'Hockey' };
const ES_QUILMES = /^(quilmes|quilmes atletico club)$/i;

const $contenido = document.getElementById('contenido');
let datos = null;

// ---------- Utilidades ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** "QUILMES ATLETICO CLUB" → "Quilmes"; "TRISTAN SUAREZ" → "Tristan Suarez"; deja siglas tal cual. */
function nombre(n) {
  if (!n) return '';
  if (ES_QUILMES.test(n.trim())) return 'Quilmes';
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(' ')
    .map((p, i) =>
      p.includes('.')
        ? p.toUpperCase()
        : i > 0 && ['de', 'del', 'y', 'la', 'las', 'los'].includes(p)
          ? p
          : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ');
}

const fmtDia = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtActualizado = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });

function fecha(iso) {
  if (!iso) return 'A confirmar';
  const d = new Date(iso);
  const dia = fmtDia.format(d).replace('.', '');
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} · ${fmtHora.format(d)} h`;
}

function resultado(p) {
  if (!p.jugado || p.gl == null || p.gv == null) return null;
  const propio = p.esLocal ? p.gl : p.gv;
  const rival = p.esLocal ? p.gv : p.gl;
  return propio > rival ? 'G' : propio < rival ? 'P' : 'E';
}
const rival = (p) => nombre(p.esLocal ? p.visitante : p.local);

function proximo(sec) {
  const limite = Date.now() - 3 * 3600 * 1000; // un partido sigue "próximo" hasta 3 h después de empezar
  return sec.partidos.find((p) => !p.jugado && (!p.fecha || new Date(p.fecha).getTime() >= limite)) || null;
}
const jugados = (sec) => sec.partidos.filter((p) => p.jugado).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
const filaQuilmes = (sec) => sec.tabla?.filas.find((f) => f.esQuilmes) || null;

// ---------- Componentes ----------
function htmlMarcador(p) {
  const qL = ES_QUILMES.test(p.local) ? ' qac' : '';
  const qV = ES_QUILMES.test(p.visitante) ? ' qac' : '';
  const centro = p.jugado
    ? `<span class="goles">${esc(p.gl)} - ${esc(p.gv)}</span>`
    : `<span class="goles vs">vs</span>`;
  return `<div class="marcador">
      <span class="equipo${qL}">${esc(nombre(p.local))}</span>
      ${centro}
      <span class="equipo visit${qV}">${esc(nombre(p.visitante))}</span>
    </div>`;
}

function htmlPartido(p, sec, { destacado = false, mostrarDeporte = false } = {}) {
  const partes = [];
  if (mostrarDeporte) partes.push(`<span class="dep">${esc(sec.titulo)}</span>`);
  partes.push(`<span>${esc(fecha(p.fecha))}</span>`);
  if (p.ronda) partes.push(`<span>${esc(p.ronda)}</span>`);
  return `<div class="card partido${destacado ? ' proximo-destacado' : ''}">
      <div class="cuando">${partes.join('')}</div>
      ${htmlMarcador(p)}
      ${p.lugar ? `<div class="lugar">${esc(p.lugar)}</div>` : ''}
    </div>`;
}

function htmlLista(partidos) {
  if (!partidos.length) return '<p class="vacio">Sin partidos.</p>';
  return `<ul class="lista">${partidos
    .map((p) => {
      const r = resultado(p);
      const chip = r ? `<span class="chip ${r}" title="${{ G: 'Ganó', E: 'Empató', P: 'Perdió' }[r]}">${r}</span>` : '<span class="chip F" title="Por jugar">·</span>';
      const res = p.jugado ? `${p.esLocal ? p.gl : p.gv} - ${p.esLocal ? p.gv : p.gl}` : fmtHora.format(new Date(p.fecha)) + ' h';
      return `<li>${chip}
          <span><span class="rival">${p.esLocal ? 'vs' : 'en'} ${esc(rival(p))}</span>
            <span class="meta">${esc(fecha(p.fecha))}${p.ronda ? ' · ' + esc(p.ronda) : ''}</span></span>
          <span class="res">${esc(res)}</span></li>`;
    })
    .join('')}</ul>`;
}

function htmlForma(sec, n = 5) {
  const ult = jugados(sec).slice(0, n).reverse();
  if (!ult.length) return '';
  return `<div class="forma" aria-label="Últimos resultados">${ult
    .map((p) => `<span class="chip ${resultado(p)}" title="${esc(rival(p))}">${resultado(p)}</span>`)
    .join('')}</div>`;
}

const ETIQUETAS = { pts: 'Pts', pj: 'PJ', pg: 'PG', pe: 'PE', pp: 'PP', gf: 'GF', gc: 'GC', dif: 'Dif', pf: 'PF', pc: 'PC' };
const EXTENDIDAS = new Set(['gf', 'gc', 'pf', 'pc', 'pe']);

function htmlTabla(sec) {
  if (!sec.tabla?.filas?.length) return '<p class="vacio">Tabla no disponible.</p>';
  const cols = sec.tabla.columnas;
  const th = cols.map((c) => `<th class="${EXTENDIDAS.has(c) ? 'col-ext' : ''}">${ETIQUETAS[c] || c}</th>`).join('');
  const filas = sec.tabla.filas
    .map(
      (f) => `<tr class="${f.esQuilmes ? 'qac' : ''}">
        <td>${esc(f.pos)}</td><td class="eq">${esc(nombre(f.equipo))}</td>
        ${cols.map((c) => `<td class="${c === 'pts' ? 'pts' : ''} ${EXTENDIDAS.has(c) ? 'col-ext' : ''}">${esc(f[c] ?? '')}</td>`).join('')}
      </tr>`,
    )
    .join('');
  return `<div class="tabla-wrap"><table>
      <thead><tr><th>#</th><th class="eq">${esc(sec.tabla.nombre)}</th>${th}</tr></thead>
      <tbody>${filas}</tbody></table></div>`;
}

function htmlAviso(sec) {
  if (!sec.desactualizado) return '';
  return `<div class="aviso">No se pudo actualizar esta sección en la última corrida. Se muestran los datos del ${esc(
    fmtActualizado.format(new Date(sec.actualizado)),
  )}.</div>`;
}

// ---------- Vistas ----------
function vistaResumen() {
  const proximos = datos.secciones
    .map((s) => ({ s, p: proximo(s) }))
    .filter((x) => x.p)
    .sort((a, b) => (a.p.fecha || '').localeCompare(b.p.fecha || ''));
  const ultimos = datos.secciones
    .map((s) => ({ s, p: jugados(s)[0] }))
    .filter((x) => x.p)
    .sort((a, b) => (b.p.fecha || '').localeCompare(a.p.fecha || ''));

  const tarjetasPos = datos.secciones
    .map((s) => {
      const f = filaQuilmes(s);
      if (!f) return '';
      const extra = s.deporte === 'basquet' ? `${f.pg}G ${f.pp}P` : `${f.pg}G ${f.pe}E ${f.pp}P`;
      return `<div class="card"><h3>${esc(s.titulo)}</h3>
          <div class="posicion"><span class="num">${esc(f.pos)}°</span>
            <span class="det">${esc(s.tabla.nombre)}<br>${esc(f.pts)} pts · ${esc(extra)}</span></div>
          ${htmlForma(s)}</div>`;
    })
    .join('');

  return `
    <section class="bloque">
      <h2>Próximos partidos</h2>
      ${proximos.length
        ? `<div class="grid">${proximos.map((x, i) => htmlPartido(x.p, x.s, { destacado: i === 0, mostrarDeporte: true })).join('')}</div>`
        : '<p class="vacio">No hay partidos programados por ahora.</p>'}
    </section>
    <section class="bloque">
      <h2>Últimos resultados</h2>
      <div class="grid">${ultimos.map((x) => htmlPartido(x.p, x.s, { mostrarDeporte: true })).join('')}</div>
    </section>
    <section class="bloque">
      <h2>Posiciones</h2>
      <div class="grid">${tarjetasPos}</div>
    </section>`;
}

function vistaDeporte(deporte) {
  const secs = datos.secciones.filter((s) => s.deporte === deporte);
  if (!secs.length) return `<p class="vacio">Todavía no hay datos de ${esc(NOMBRE_DEPORTE[deporte])}.</p>`;
  return secs
    .map((s) => {
      const prox = proximo(s);
      const ult = jugados(s).slice(0, 5);
      const todos = [...s.partidos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      return `<section class="seccion">
        <div class="seccion-head"><h2 class="seccion-titulo">${esc(s.titulo)}</h2><span class="comp">${esc(s.competencia)}</span></div>
        ${htmlAviso(s)}
        <div class="dos-col">
          <div>
            ${prox ? htmlPartido(prox, s, { destacado: true }) : '<div class="card"><h3>Próximo partido</h3><p class="vacio">Sin partidos programados.</p></div>'}
            <div class="card" style="margin-top:12px"><h3>Últimos resultados</h3>${htmlLista(ult)}</div>
          </div>
          <div class="card"><h3>Tabla de posiciones</h3>${htmlTabla(s)}
            <details class="fixture"><summary>Fixture completo (${todos.length} partidos)</summary>${htmlLista(todos)}</details>
          </div>
        </div>
      </section>`;
    })
    .join('');
}

function mostrar(vista) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === vista)));
  $contenido.innerHTML = vista === 'resumen' ? vistaResumen() : vistaDeporte(vista);
  if (location.hash.slice(1) !== vista) history.replaceState(null, '', `#${vista}`);
}

// ---------- Arranque ----------
async function cargar() {
  if (window.__DATOS__) return window.__DATOS__; // vista previa con datos embebidos
  const r = await fetch(`data/quilmes.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

try {
  datos = await cargar();
  document.getElementById('actualizado').textContent = `Actualizado: ${fmtActualizado.format(new Date(datos.generado))}`;
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.vista)));
  const VISTAS = ['resumen', 'futbol', 'basquet', 'hockey'];
  const desdeHash = () => mostrar(VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'resumen');
  window.addEventListener('hashchange', desdeHash);
  desdeHash();
} catch (e) {
  document.getElementById('actualizado').textContent = 'No se pudieron cargar los datos';
  $contenido.innerHTML = `<div class="error-carga">No pude leer <code>data/quilmes.json</code> (${esc(e.message)}).</div>`;
}
