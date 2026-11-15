// Agenda del Cervecero: lee data/quilmes.json y arma las vistas.

const TZ = 'America/Argentina/Buenos_Aires';
const VISTAS = ['resumen', 'futbol', 'basquet', 'hockey'];
const ES_QUILMES = /^(quilmes|quilmes atletico club)$/i;
const $contenido = document.getElementById('contenido');
let datos = null;

// ---------- Utilidades ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Nombres en mayúsculas → formato título; Quilmes siempre como "Quilmes"; siglas tal cual. */
function nombre(n) {
  if (!n) return '';
  if (ES_QUILMES.test(n.trim())) return 'Quilmes';
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(' ')
    .map((p, i) =>
      p.includes('.') ? p.toUpperCase()
        : i > 0 && ['de', 'del', 'y', 'la', 'las', 'los'].includes(p) ? p
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ');
}

const partes = (iso, opciones) =>
  Object.fromEntries(new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opciones }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const hora = (iso) => { const p = partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false }); return `${p.hour}:${p.minute}`; };
const sinPunto = (s) => (s || '').replace('.', '');
function fechaLarga(iso) {
  if (!iso) return 'Fecha a confirmar';
  const p = partes(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} de ${p.month}, ${hora(iso)} h`;
}
function fechaBreve(iso) {
  if (!iso) return 'A confirmar';
  const p = partes(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${sinPunto(p.weekday)} ${p.day} ${sinPunto(p.month)}`;
}

/** "Hoy, en 3 h" / "Mañana" / "En 5 días". */
function cuenta(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0 && ms > -3 * 3600e3) return 'Se está jugando';
  const diaDe = (d) => partes(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const a = diaDe(new Date()), b = diaDe(iso);
  const dias = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 864e5);
  if (dias <= 0) {
    const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3);
    return h > 0 ? `Hoy, en ${h} h ${m} min` : `Hoy, en ${m} min`;
  }
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}

function resultado(p) {
  if (!p.jugado || p.gl == null || p.gv == null) return null;
  const propio = p.esLocal ? p.gl : p.gv, otro = p.esLocal ? p.gv : p.gl;
  return propio > otro ? 'G' : propio < otro ? 'P' : 'E';
}
const rival = (p) => nombre(p.esLocal ? p.visitante : p.local);
const marcadorPropio = (p) => `${p.esLocal ? p.gl : p.gv}-${p.esLocal ? p.gv : p.gl}`;
const PALABRA = { G: 'Ganó', E: 'Empató', P: 'Perdió' };

function proximos(sec) {
  const limite = Date.now() - 3 * 3600e3;
  return sec.partidos.filter((p) => !p.jugado && p.fecha && new Date(p.fecha).getTime() >= limite);
}
const jugados = (sec) => sec.partidos.filter((p) => p.jugado).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
const filaQuilmes = (sec) => sec.tabla?.filas.find((f) => f.esQuilmes) || null;
const puntos = (sec, r) => (sec.deporte === 'basquet' ? { G: 2, P: 1 }[r] ?? 0 : { G: 3, E: 1, P: 0 }[r]);

function situacion(sec) {
  const f = filaQuilmes(sec);
  if (!f) return '';
  const filas = sec.tabla.filas;
  const total = filas.length;
  if (f.pos === 1) {
    const segundo = filas.find((x) => x.pos === 2);
    const ventaja = segundo ? f.pts - segundo.pts : 0;
    return `Puntero de ${sec.tabla.nombre}${ventaja > 0 ? `, ${ventaja} ${ventaja === 1 ? 'punto' : 'puntos'} arriba del segundo` : ''}.`;
  }
  const lider = filas[0];
  const dif = lider.pts - f.pts;
  return `Puesto ${f.pos} de ${total} en ${sec.tabla.nombre}, a ${dif} ${dif === 1 ? 'punto' : 'puntos'} del primero.`;
}

// ---------- Gráfico: puntos acumulados ----------
function curva(sec, alto = 46) {
  const lista = jugados(sec).slice().reverse();
  if (lista.length < 2) return '';
  let acum = 0;
  const ys = [0, ...lista.map((p) => (acum += puntos(sec, resultado(p))))];
  const ancho = 200, max = Math.max(...ys, 1);
  const pts = ys.map((y, i) => [(i / (ys.length - 1)) * ancho, alto - 3 - (y / max) * (alto - 8)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ux, uy] = pts[pts.length - 1];
  return `<svg class="curva" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img" aria-label="Puntos acumulados: ${acum}">
      <path class="area" d="${d} L${ancho},${alto} L0,${alto} Z"/><path class="linea" d="${d}" vector-effect="non-scaling-stroke"/>
      <circle cx="${ux}" cy="${uy}" r="4" vector-effect="non-scaling-stroke"/></svg>`;
}

const forma = (sec, n = 5) =>
  `<div class="forma" aria-label="Últimos ${n} partidos">${jugados(sec).slice(0, n).reverse()
    .map((p) => `<span class="r ${resultado(p)}" title="${PALABRA[resultado(p)]} ${esc(marcadorPropio(p))} con ${esc(rival(p))}">${resultado(p)}</span>`)
    .join('')}</div>`;

// ---------- Componentes ----------
function entrada(p, sec) {
  const local = nombre(p.local), visita = nombre(p.visitante);
  const linea = (n) => `<span class="${n === 'Quilmes' ? '' : 'rival-nombre'}">${esc(n)}</span>`;
  const t = partes(p.fecha, { weekday: 'short', day: 'numeric', month: 'short' });
  return `<article class="entrada" aria-label="Próximo partido: ${esc(local)} contra ${esc(visita)}, ${esc(fechaLarga(p.fecha))}">
      <div class="entrada-cuerpo">
        <div class="entrada-comp"><b>${esc(sec.deporteNombre)}, ${esc(sec.titulo.toLowerCase())}</b><br>${esc(sec.competencia)}${p.ronda ? `, ${esc(p.ronda.toLowerCase())}` : ''}</div>
        <div class="cruce">${linea(local)}<span class="vs">contra</span>${linea(visita)}</div>
        <div class="entrada-pie"><span class="cuenta" data-cuenta="${esc(p.fecha)}">${esc(cuenta(p.fecha))}</span>${p.lugar ? `<span>${esc(p.lugar)}</span>` : `<span>${p.esLocal ? 'De local' : 'De visitante'}</span>`}</div>
      </div>
      <div class="entrada-talon" aria-hidden="true">
        <span class="talon-dia">${esc(sinPunto(t.weekday))}</span>
        <span class="talon-num">${esc(t.day)}</span>
        <span class="talon-mes">${esc(sinPunto(t.month))}</span>
        <span class="talon-hora">${esc(hora(p.fecha))}</span>
      </div>
    </article>`;
}

function listaResultados(items) {
  if (!items.length) return '<p class="vacio">Todavía no hay resultados.</p>';
  return `<ul class="resultados">${items
    .map(({ p, sec }) => {
      const r = resultado(p);
      const marca = r ? `<span class="r ${r}" aria-label="${PALABRA[r]}">${r}</span>` : '<span></span>';
      const derecha = p.jugado ? `<span class="tanteador">${esc(marcadorPropio(p))}</span>` : `<span class="tanteador">${esc(hora(p.fecha))}</span>`;
      const contexto = [sec && `${sec.deporteNombre} ${sec.titulo.toLowerCase()}`, fechaBreve(p.fecha), p.ronda].filter(Boolean).join(', ');
      return `<li>${marca}<span class="quien">${p.esLocal ? 'vs' : 'en cancha de'} ${esc(rival(p))}<small>${esc(contexto)}</small></span>${derecha}</li>`;
    })
    .join('')}</ul>`;
}

const COLS = { pts: 'Pts', pj: 'PJ', pg: 'G', pe: 'E', pp: 'P', gf: 'GF', gc: 'GC', dif: 'Dif', pf: 'PF', pc: 'PC' };
const EXT = new Set(['pg', 'pe', 'pp', 'gf', 'gc', 'pf', 'pc']);
function tabla(sec) {
  if (!sec.tabla?.filas?.length) return '<p class="vacio">Tabla no disponible.</p>';
  const cols = sec.tabla.columnas;
  return `<div class="tabla-wrap"><table>
    <thead><tr><th>#</th><th class="eq">${esc(sec.tabla.nombre)}</th>${cols.map((c) => `<th class="${EXT.has(c) ? 'ext' : ''}">${COLS[c] || c}</th>`).join('')}</tr></thead>
    <tbody>${sec.tabla.filas
      .map((f) => `<tr class="${f.esQuilmes ? 'qac' : ''}"><td>${esc(f.pos)}</td><td class="eq">${esc(nombre(f.equipo))}</td>${cols
        .map((c) => `<td class="${c === 'pts' ? 'pts' : ''} ${EXT.has(c) ? 'ext' : ''}">${esc(c === 'dif' && f[c] > 0 ? `+${f[c]}` : f[c] ?? '')}</td>`)
        .join('')}</tr>`)
      .join('')}</tbody></table></div>`;
}

function aviso(sec) {
  if (!sec.desactualizado) return '';
  return `<div class="aviso">No se pudo actualizar esta sección en la última corrida. Los datos son del ${esc(fechaLarga(sec.actualizado))}.</div>`;
}

// ---------- Vistas ----------
function vistaResumen() {
  const futuros = datos.secciones
    .flatMap((sec) => proximos(sec).map((p) => ({ p, sec })))
    .sort((a, b) => a.p.fecha.localeCompare(b.p.fecha));
  const [primero, ...resto] = futuros;

  const tarjetas = datos.secciones
    .map((sec) => {
      const f = filaQuilmes(sec);
      if (!f) return '';
      const registro = sec.deporte === 'basquet' ? `${f.pg}G ${f.pp}P` : `${f.pg}G ${f.pe}E ${f.pp}P`;
      return `<a class="equipo-card${f.pos === 1 ? ' lider' : ''}" href="#${sec.deporte}">
          <span class="deporte">${esc(sec.deporteNombre)}, ${esc(sec.titulo.toLowerCase())}<small>${esc(sec.competencia)}</small></span>
          <span class="puesto"><b>${esc(f.pos)}°</b><span>de ${sec.tabla.filas.length}<br>${esc(f.pts)} pts</span></span>
          ${curva(sec)}
          <span style="display:flex;justify-content:space-between;align-items:center;gap:8px">${forma(sec)}<small style="color:var(--suave)">${esc(registro)}</small></span>
        </a>`;
    })
    .join('');

  const ultimos = datos.secciones
    .map((sec) => ({ p: jugados(sec)[0], sec }))
    .filter((x) => x.p)
    .sort((a, b) => b.p.fecha.localeCompare(a.p.fecha));

  return `
    <section class="bloque">
      <h2>Próximo partido</h2>
      ${primero ? entrada(primero.p, primero.sec) : '<p class="vacio">No hay partidos programados por ahora. La página se actualiza sola cuando las ligas publican el fixture.</p>'}
      ${resto.length ? `<ul class="siguientes">${resto.slice(0, 5).map(({ p, sec }) => {
          const t = partes(p.fecha, { weekday: 'short', day: 'numeric', month: 'short' });
          return `<li><span class="fecha-corta">${esc(t.day)}<small>${esc(sinPunto(t.weekday))} ${esc(sinPunto(t.month))}</small></span>
            <span class="quien">${p.esLocal ? 'vs' : 'en cancha de'} ${esc(rival(p))}<small>${esc(sec.deporteNombre)} ${esc(sec.titulo.toLowerCase())}</small></span>
            <span class="hora">${esc(hora(p.fecha))}</span></li>`;
        }).join('')}</ul>` : ''}
    </section>
    <section class="bloque">
      <h2>Cómo viene cada equipo</h2>
      <p class="sub">Posición en la tabla, puntos sumados en la temporada y últimos cinco partidos.</p>
      <div class="equipos">${tarjetas}</div>
    </section>
    <section class="bloque">
      <h2>Últimos resultados</h2>
      ${listaResultados(ultimos)}
    </section>`;
}

function vistaDeporte(deporte) {
  const secs = datos.secciones.filter((s) => s.deporte === deporte);
  if (!secs.length) return '<p class="vacio">Todavía no hay datos de este deporte.</p>';
  return `<div class="portada"><h1>${esc(secs[0].deporteNombre)}</h1></div>` + secs
    .map((sec) => {
      const f = filaQuilmes(sec);
      const futuros = proximos(sec);
      const ult = jugados(sec).slice(0, 5).map((p) => ({ p }));
      const todos = [...sec.partidos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map((p) => ({ p }));
      const dif = f ? (f.dif ?? (f.pf != null ? f.pf - f.pc : null)) : null;
      return `<section class="equipo-seccion">
        <header><h2>${esc(sec.titulo)}</h2><span>${esc(sec.competencia)}</span></header>
        ${aviso(sec)}
        <p class="categoria">${esc(sec.descripcion || '')} <span class="situacion">${esc(situacion(sec))}</span></p>
        ${futuros[0] ? `<div class="bloque">${entrada(futuros[0], sec)}</div>` : ''}
        ${f ? `<div class="cifras">
            <div><b>${esc(f.pos)}°</b><small>Posición</small></div>
            <div><b>${esc(f.pts)}</b><small>Puntos</small></div>
            <div><b>${esc(f.pj)}</b><small>Jugados</small></div>
            <div><b>${dif == null ? '–' : esc(dif > 0 ? `+${dif}` : dif)}</b><small>${sec.deporte === 'basquet' ? 'Dif. de tantos' : 'Dif. de gol'}</small></div>
          </div>` : ''}
        <div class="columnas">
          <div class="panel">
            <h3>Así se fueron sumando los puntos</h3>
            ${curva(sec, 90)}
            <p class="leyenda">Puntos acumulados partido a partido en la temporada.</p>
            ${listaResultados(ult)}
          </div>
          <div class="panel">
            <h3>Tabla de posiciones</h3>
            ${tabla(sec)}
            <details class="fixture"><summary>Ver el fixture completo (${todos.length} partidos)</summary>${listaResultados(todos)}</details>
          </div>
        </div>
      </section>`;
    })
    .join('');
}

function mostrar() {
  const vista = VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'resumen';
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.vista === vista ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $contenido.innerHTML = vista === 'resumen' ? vistaResumen() : vistaDeporte(vista);
  window.scrollTo(0, 0);
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
  document.getElementById('actualizado').textContent = `Actualizado ${fechaBreve(datos.generado).toLowerCase()}, ${hora(datos.generado)} h`;
  window.addEventListener('hashchange', mostrar);
  mostrar();
  setInterval(() => document.querySelectorAll('[data-cuenta]').forEach((el) => (el.textContent = cuenta(el.dataset.cuenta))), 30000);
} catch (e) {
  document.getElementById('actualizado').textContent = 'Sin datos';
  $contenido.innerHTML = `<div class="error-carga">No se pudieron cargar los datos (${esc(e.message)}). Probá recargar la página en unos minutos.</div>`;
}
