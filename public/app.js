// Agenda del Cervecero: lee data/quilmes.json y arma las vistas.

const TZ = 'America/Argentina/Buenos_Aires';
const VISTAS = ['resumen', 'futbol', 'basquet', 'hockey'];
const ES_QUILMES = /^(quilmes|quilmes atletico club)$/i;
const $contenido = document.getElementById('contenido');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let datos = null;

// ---------- Pantalla de carga ----------
// Cuenta de 1887 al año actual mientras llegan los datos (mínimo 2 s la primera vez, 1 s después).
const loader = (() => {
  const el = document.querySelector('[data-loader]');
  const listo = () => document.documentElement.classList.add('mostrado');
  if (!el || document.documentElement.classList.contains('static')) return { fin: listo };
  const ano = el.querySelector('[data-ano]'), barra = el.querySelector('[data-barra]');
  const hasta = new Date().getFullYear();
  const visto = (() => { try { const v = sessionStorage.getItem('qac-loader'); sessionStorage.setItem('qac-loader', '1'); return !!v; } catch { return false; } })();
  const MIN = reduce ? 0 : visto ? 1000 : 2000;
  const t0 = performance.now();
  let cargado = false, cerrado = false;
  document.documentElement.style.overflow = 'hidden';
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    el.classList.add('listo');
    document.documentElement.style.overflow = '';
    setTimeout(listo, 350);
    setTimeout(() => el.remove(), 1100);
  };
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / Math.max(MIN, 1));
    const v = cargado ? k : Math.min(k, 0.9);
    const e = 1 - Math.pow(1 - v, 3);
    barra.style.transform = `scaleX(${e})`;
    ano.textContent = Math.round(1887 + (hasta - 1887) * e);
    if (v >= 1) setTimeout(cerrar, 300); else requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  setTimeout(() => { cargado = true; }, 4000); // nunca más de 4 s
  el.addEventListener('click', () => { cargado = true; });
  return { fin: () => { cargado = true; } };
})();

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
/** Solo la primera letra en minúscula: "Caballeros B" → "caballeros B". */
const minus = (t) => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1);
const dos = (n) => String(n).padStart(2, '0');
/** Largo de la palabra más larga: define el tamaño de los nombres grandes para que nunca se corten. */
const largo = (t) => Math.max(5, ...String(t).split(/\s+/).map((w) => w.length));
const escudo = (clase = '') => `<svg class="escudo ${clase}" aria-hidden="true"><use href="#escudo"/></svg>`;

function resultado(p) {
  if (!p.jugado || p.gl == null || p.gv == null) return null;
  const propio = p.esLocal ? p.gl : p.gv, otro = p.esLocal ? p.gv : p.gl;
  return propio > otro ? 'G' : propio < otro ? 'P' : 'E';
}
const rival = (p) => nombre(p.esLocal ? p.visitante : p.local);
const marcadorPropio = (p) => `${p.esLocal ? p.gl : p.gv}-${p.esLocal ? p.gv : p.gl}`;
const PALABRA = { G: 'Ganó', E: 'Empató', P: 'Perdió' };
const COLOR = { G: 'var(--gano)', E: 'var(--empato)', P: 'var(--perdio)' };

function proximos(sec) {
  const limite = Date.now() - 3 * 3600e3;
  const conFecha = sec.partidos.filter((p) => !p.jugado && p.fecha && new Date(p.fecha).getTime() >= limite);
  // Partidos sin día todavía (ej. la vuelta de una final "a confirmar"): van después de los que ya tienen fecha.
  const sinFecha = sec.partidos.filter((p) => !p.jugado && !p.fecha);
  return [...conFecha, ...sinFecha];
}
const jugados = (sec) => sec.partidos.filter((p) => p.jugado).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
const filaQuilmes = (sec) => sec.tabla?.filas.find((f) => f.esQuilmes) || null;

function situacion(sec) {
  const f = filaQuilmes(sec);
  if (!f) return '';
  const filas = sec.tabla.filas;
  if (f.pos === 1) {
    const segundo = filas.find((x) => x.pos === 2);
    const ventaja = segundo ? f.pts - segundo.pts : 0;
    return `Puntero de ${sec.tabla.nombre}${ventaja > 0 ? `, ${ventaja} ${ventaja === 1 ? 'punto' : 'puntos'} arriba del segundo` : ''}.`;
  }
  const dif = filas[0].pts - f.pts;
  return `Puesto ${f.pos} de ${filas.length} en ${sec.tabla.nombre}, a ${dif} ${dif === 1 ? 'punto' : 'puntos'} del primero.`;
}

// ---------- Cuándo se juega, en palabras ----------
function cuando(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { texto: 'En juego', vivo: true };
  const dia = (d) => partes(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const a = dia(new Date()), b = dia(iso);
  const dias = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 864e5);
  return { texto: dias <= 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`, vivo: false };
}

const ICONO = {
  futbol: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m12 8 3.2 2.3-1.2 3.7h-4l-1.2-3.7z"/></svg>',
  basquet: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3 3 9 0 12M18 6c-3 3-3 9 0 12"/></svg>',
  hockey: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3.5 9.5 17.5a2.5 2.5 0 0 1-2.4 1.6H4.5"/><circle cx="17.5" cy="18" r="2"/></svg>',
};

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const filaDe = (sec, equipo) => sec.tabla?.filas.find((f) => norm(f.equipo) === norm(equipo)) || null;

// ---------- Gráfico: ganados, empatados y perdidos, fecha a fecha ----------
function lineas(sec) {
  const lista = jugados(sec).slice().reverse();
  if (lista.length < 2) return '<p class="vacio">Faltan partidos para armar el gráfico.</p>';
  const W = 320, H = 150, der = 26, arriba = 8;
  const acum = { G: [0], E: [0], P: [0] };
  for (const p of lista) {
    const r = resultado(p);
    for (const k of ['G', 'E', 'P']) acum[k].push(acum[k].at(-1) + (k === r ? 1 : 0));
  }
  const tipos = sec.deporte === 'basquet' ? ['G', 'P'] : ['G', 'E', 'P'];
  const max = Math.max(...tipos.map((k) => acum[k].at(-1)), 1);
  const n = lista.length;
  const x = (i) => (i / n) * (W - der);
  const y = (v) => H - (v / max) * (H - arriba);
  const guias = [...new Set([0, Math.round(max / 2), max])];
  // si dos líneas terminan juntas, separo las etiquetas
  const finales = tipos.map((k) => ({ k, v: acum[k].at(-1), y: y(acum[k].at(-1)) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 14) finales[i].y = finales[i - 1].y + 14;
  const nombreTipo = { G: 'Ganados', E: 'Empatados', P: 'Perdidos' };
  return `<svg class="lineas" viewBox="-18 0 ${W + 18} ${H + 18}" role="img" aria-label="${tipos.map((k) => `${nombreTipo[k]}: ${acum[k].at(-1)}`).join(', ')}, en ${n} partidos">
      ${guias.map((g) => `<line class="eje" x1="0" x2="${W - der}" y1="${y(g)}" y2="${y(g)}"/><text x="-6" y="${y(g) + 3}" text-anchor="end">${g}</text>`).join('')}
      <line class="base" x1="0" x2="${W - der}" y1="${H}" y2="${H}"/>
      <text x="0" y="${H + 14}">Fecha 1</text><text x="${W - der}" y="${H + 14}" text-anchor="end">${n}</text>
      ${tipos.map((k) => `<path class="${k}" pathLength="1" d="${acum[k].map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`).join('')}
      ${tipos.map((k) => `<circle class="${k}" cx="${x(n)}" cy="${y(acum[k].at(-1))}" r="3.5"/>`).join('')}
      ${finales.map((f) => `<text class="fin ${f.k}" x="${W - der + 8}" y="${f.y + 5}">${f.v}</text>`).join('')}
    </svg>
    <div class="leyenda">${tipos.map((k) => `<span style="--c:${COLOR[k]}"><i></i>${nombreTipo[k]}</span>`).join('')}</div>`;
}

// ADN de la temporada: una barra por partido, alta si ganó, media si empató, baja si perdió.
function adn(sec) {
  const lista = jugados(sec).slice().reverse();
  if (!lista.length) return '';
  const alto = { G: '100%', E: '55%', P: '22%' };
  return `<div class="adn" role="img" aria-label="Resultados de la temporada en orden: ${lista.map((p) => PALABRA[resultado(p)]).join(', ')}">${lista
    .map((p, i) => { const r = resultado(p); return `<i style="--h:${alto[r]};--c:${COLOR[r]};--n:${i}" title="${PALABRA[r]} ${esc(marcadorPropio(p))} con ${esc(rival(p))}"></i>`; })
    .join('')}</div>
    <div class="adn-ext chica"><span>Primera fecha</span><span>Última</span></div>`;
}

const forma = (sec, n = 5) => {
  const lista = jugados(sec).slice(0, n).reverse();
  return `<div class="forma" aria-label="Últimos ${lista.length} partidos, el más reciente a la derecha">${lista
    .map((p) => `<span class="r ${resultado(p)}" title="${PALABRA[resultado(p)]} ${esc(marcadorPropio(p))} con ${esc(rival(p))}">${resultado(p)}</span>`)
    .join('')}</div>`;
};

function pista(sec, f) {
  const n = sec.tabla.filas.length;
  const x = n > 1 ? ((f.pos - 1) / (n - 1)) * 100 : 0;
  return `<div role="img" aria-label="Puesto ${f.pos} de ${n}">
      <div class="pista"><div class="pista-linea">${'<i></i>'.repeat(n)}</div><span class="yo" style="left:${x}%">${escudo()}</span></div>
      <div class="pista-ext"><span>1°</span><span>${n}°</span></div>
    </div>`;
}

// ---------- Componentes ----------
function proximo(p, sec) {
  const local = nombre(p.local), visita = nombre(p.visitante);
  const otro = p.esLocal ? p.visitante : p.local;
  const n = Math.max(largo(local), largo(visita));
  // El equipo propio se reconoce por esLocal (así "Quilmes B" también sale en azul).
  const lado = (t, propio) => `<strong class="${propio ? 'local' : 'visita'}" style="--n:${n}">${esc(t)}</strong>`;
  const t = p.fecha ? partes(p.fecha, { weekday: 'short', day: 'numeric', month: 'short' }) : null;
  const c = p.fecha ? cuando(p.fecha) : null;

  // Cara a cara con los datos de la tabla
  const yo = filaQuilmes(sec), el = filaDe(sec, otro);
  let duelo = '';
  if (yo && el) {
    const filas = [
      ['Posición', yo.pos, el.pos, (a, b) => a < b, (v) => `${v}°`],
      ['Puntos', yo.pts, el.pts, (a, b) => a > b, (v) => v],
      ['Jugados', yo.pj, el.pj, () => null, (v) => v],
      sec.deporte === 'basquet' ? ['Ganados', yo.pg, el.pg, (a, b) => a > b, (v) => v] : ['Dif. de gol', yo.dif, el.dif, (a, b) => a > b, (v) => (v > 0 ? `+${v}` : v)],
    ];
    const previo = jugados(sec).find((x) => norm(rival(x)) === norm(nombre(otro)));
    duelo = `<table class="duelo">
        <caption class="chica">Cara a cara en ${esc(sec.tabla.nombre)}</caption>
        <thead><tr><th></th><th class="yo">${esc(nombre(yo.equipo))}</th><th>${esc(nombre(otro))}</th></tr></thead>
        <tbody>${filas.map(([k, a, b, mejor, f]) => {
          const m = a == null || b == null ? null : mejor(a, b);
          return `<tr><th>${k}</th><td class="${m ? 'mejor' : ''}">${esc(f(a ?? '–'))}</td><td class="otro">${esc(f(b ?? '–'))}</td></tr>`;
        }).join('')}
        ${previo ? `<tr class="cruce-ant"><th>Último cruce</th><td colspan="2">${PALABRA[resultado(previo)]} ${esc(marcadorPropio(previo))}, ${esc(fechaBreve(previo.fecha))}</td></tr>` : ''}
        </tbody></table>`;
  }

  return `<article class="hero" aria-label="Próximo partido de ${esc(sec.deporteNombre.toLowerCase())}: ${esc(local)} contra ${esc(visita)}, ${esc(fechaLarga(p.fecha))}">
      <div class="hero-cab">
        <span class="deporte-tag">${ICONO[sec.deporte] || ''}${esc(sec.deporteNombre)}</span>
        <span class="chica"><b>${esc(sec.titulo)}</b>${esc(sec.competencia)}${p.ronda ? ` · ${esc(p.ronda.toLowerCase())}` : ''}</span>
      </div>
      <div class="cruce">${lado(local, p.esLocal)}<span class="vs chica">${escudo()}contra</span>${lado(visita, !p.esLocal)}</div>
      <div class="hero-der">
        <div class="cuando-grande">
          ${t ? `<div><b>${esc(sinPunto(t.weekday))} ${esc(t.day)}</b><small class="chica">${esc(sinPunto(t.month))}</small></div>
          <div><b>${esc(hora(p.fecha))}</b><small class="chica">Hora</small></div>
          <div class="falta${c.vivo ? ' vivo' : ''}"><b>${esc(c.texto)}</b><small class="chica">${p.esLocal ? 'De local' : 'De visitante'}</small></div>`
          : `<div><b>A confirmar</b><small class="chica">Día y hora · ${p.esLocal ? 'De local' : 'De visitante'}</small></div>`}
        </div>
        ${p.lugar ? `<p class="lugar">Cancha: <b>${esc(p.lugar)}</b></p>` : ''}
        ${duelo}
      </div>
    </article>`;
}

function listaResultados(items) {
  if (!items.length) return '<p class="vacio">Todavía no hay resultados.</p>';
  return `<ul class="resultados">${items
    .map(({ p, sec }) => {
      const r = resultado(p);
      const contexto = [sec && `${sec.deporteNombre} ${minus(sec.titulo)}`, fechaBreve(p.fecha), p.ronda].filter(Boolean).join(' · ');
      const derecha = p.jugado
        ? `<span class="marcador"><b>${esc(p.esLocal ? p.gl : p.gv)}<span>–${esc(p.esLocal ? p.gv : p.gl)}</span></b>${r ? `<span class="r ${r}" title="${PALABRA[r]}">${r}</span>` : ''}</span>`
        : `<span class="marcador pendiente"><b>${p.fecha ? esc(hora(p.fecha)) : '–'}</b></span>`;
      return `<li><span class="quien">${p.esLocal ? 'vs' : 'en cancha de'} ${esc(rival(p))}<small>${esc(contexto)}</small></span>${derecha}</li>`;
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
      .map((f) => `<tr class="${f.esQuilmes ? 'qac' : ''}"><td class="pos">${esc(f.pos)}</td><td class="eq">${f.esQuilmes ? `<span>${escudo()}${esc(nombre(f.equipo))}</span>` : esc(nombre(f.equipo))}</td>${cols
        .map((c) => `<td class="${c === 'pts' ? 'pts' : ''} ${EXT.has(c) ? 'ext' : ''}">${esc(c === 'dif' && f[c] > 0 ? `+${f[c]}` : f[c] ?? '')}</td>`)
        .join('')}</tr>`)
      .join('')}</tbody></table></div>`;
}

function aviso(sec) {
  if (!sec.desactualizado) return '';
  return `<div class="aviso">No se pudo actualizar esta sección en la última corrida. Los datos son del ${esc(fechaLarga(sec.actualizado))}.</div>`;
}

const titulo = (n, texto, extra = '') => `<header class="franja"><div class="contenedor"><span>${n}</span><h2>${texto}</h2>${extra ? `<p>${extra}</p>` : ''}</div></header>`;

// Cinta de LED con los últimos resultados de todos los equipos
function cinta() {
  const items = datos.secciones
    .flatMap((sec) => jugados(sec).slice(0, 3).map((p) => ({ p, sec })))
    .sort((a, b) => b.p.fecha.localeCompare(a.p.fecha))
    .slice(0, 8)
    .map(({ p, sec }) => `<span class="cinta-item" style="--c:${COLOR[resultado(p)]}"><i></i>${esc(sec.deporteNombre)} ${esc(sec.titulo.split(' ')[0])}<b>Quilmes ${esc(marcadorPropio(p))} ${esc(rival(p))}</b></span>`)
    .join('');
  if (!items) return '';
  return `<div class="cinta-pista" aria-hidden="true">${items}${items}</div>`;
}

// ---------- Vistas ----------
function vistaResumen() {
  const futuros = datos.secciones
    .flatMap((sec) => proximos(sec).map((p) => ({ p, sec })))
    .sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999'));
  const [primero, ...resto] = futuros;

  return `
    <section class="seccion" style="--i:0">
      ${titulo('01', 'Próximo partido')}<div class="contenedor">
      ${primero ? proximo(primero.p, primero.sec) : '<p class="vacio">No hay partidos programados por ahora. La página se actualiza sola cuando las ligas publican el fixture.</p>'}
      ${resto.length ? `<ul class="siguen" aria-label="Después">${resto.slice(0, 5).map(({ p, sec }) => `<li>
            <span class="cuando chica">${p.fecha ? `<b>${esc(partes(p.fecha, { day: 'numeric' }).day)}</b>${esc(sinPunto(partes(p.fecha, { weekday: 'short' }).weekday))} · ${esc(sinPunto(partes(p.fecha, { month: 'short' }).month))}` : '<b>–</b>A confirmar'}</span>
            <span class="quien">${p.esLocal ? 'vs' : 'en cancha de'} ${esc(rival(p))}<small>${esc(sec.deporteNombre)} ${esc(minus(sec.titulo))}${p.ronda && !p.fecha ? ` · ${esc(p.ronda)}` : ''}</small></span>
            <span class="hora">${p.fecha ? esc(hora(p.fecha)) : ''}</span></li>`).join('')}</ul>` : ''}
    </div></section>
    <section class="seccion" style="--i:1">
      ${titulo('02', 'Cómo viene cada equipo', 'Posición y últimos cinco')}
      <div class="contenedor">${filtros('equipos')}<div data-lista="equipos" aria-live="polite">${listaEquipos(filtro.equipos)}</div></div>
    </section>
    <section class="seccion" style="--i:2">
      ${titulo('03', 'Últimos resultados')}
      <div class="contenedor">${filtros('resultados')}<div data-lista="resultados" aria-live="polite">${ultimosResultados(filtro.resultados)}</div></div>
    </section>`;
}

// ---------- Filtros por deporte del inicio ----------
const filtro = { equipos: 'todos', resultados: 'todos' };
const deportes = () => [...new Map(datos.secciones.map((s) => [s.deporte, s.deporteNombre])).entries()];
const deLa = (dep) => datos.secciones.filter((s) => dep === 'todos' || s.deporte === dep);

function filtros(grupo) {
  const opciones = [['todos', 'Todos'], ...deportes()];
  return `<div class="filtros" role="group" aria-label="Filtrar por deporte">${opciones
    .map(([v, n]) => `<button type="button" data-filtro="${grupo}" data-valor="${esc(v)}" aria-pressed="${filtro[grupo] === v}">${ICONO[v] || '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>'}<span>${esc(n)}</span></button>`)
    .join('')}</div>`;
}

function listaEquipos(dep) {
  const tarjetas = deLa(dep)
    .map((sec) => {
      const f = filaQuilmes(sec);
      if (!f) return '';
      const registro = sec.deporte === 'basquet' ? `${f.pg}G ${f.pp}P` : `${f.pg}G ${f.pe}E ${f.pp}P`;
      return `<a class="equipo" href="#${sec.deporte}">
          <div class="equipo-cab">
            <h3>${esc(sec.deporteNombre)} ${esc(minus(sec.titulo))}<span class="flecha">→</span><small class="chica">${esc(sec.competencia)}</small></h3>
            <span class="ordinal">${esc(f.pos)}<sup>°</sup></span>
          </div>
          ${pista(sec, f)}
          <div class="equipo-pie">${forma(sec)}<span><b>${esc(f.pts)} pts</b> · ${esc(registro)}</span></div>
        </a>`;
    })
    .join('');
  return tarjetas ? `<div class="equipos">${tarjetas}</div>` : '<p class="vacio">No hay tablas de este deporte.</p>';
}

// Todos: el último partido de cada equipo. Un deporte: sus 8 partidos más recientes.
function ultimosResultados(dep) {
  const items = dep === 'todos'
    ? deLa(dep).map((sec) => ({ p: jugados(sec)[0], sec })).filter((x) => x.p)
    : deLa(dep).flatMap((sec) => jugados(sec).map((p) => ({ p, sec })));
  items.sort((a, b) => (b.p.fecha || '').localeCompare(a.p.fecha || ''));
  return listaResultados(dep === 'todos' ? items : items.slice(0, 8));
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (!b || !datos) return;
  const grupo = b.dataset.filtro;
  filtro[grupo] = b.dataset.valor;
  document.querySelectorAll(`[data-filtro="${grupo}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const lista = document.querySelector(`[data-lista="${grupo}"]`);
  lista.innerHTML = grupo === 'equipos' ? listaEquipos(filtro[grupo]) : ultimosResultados(filtro[grupo]);
  lista.classList.remove('cambio'); void lista.offsetWidth; lista.classList.add('cambio');
});

function vistaDeporte(deporte) {
  const secs = datos.secciones.filter((s) => s.deporte === deporte);
  if (!secs.length) return '<p class="vacio">Todavía no hay datos de este deporte.</p>';
  // Índice: un acceso por equipo, con su posición. Se mueve con scroll (el # de la URL elige el deporte).
  const indice = secs.length > 1 ? `<nav class="indice" aria-label="Equipos de ${esc(secs[0].deporteNombre.toLowerCase())}"><div class="contenedor"><ol>${secs
    .map((sec, i) => { const f = filaQuilmes(sec); return `<li><a href="#${esc(deporte)}" data-ir="eq-${esc(sec.id)}"><span>${dos(i + 1)}</span>${esc(sec.titulo)}${f ? `<b>${esc(f.pos)}°</b>` : ''}</a></li>`; })
    .join('')}</ol></div></nav>` : '';
  return `<div class="portada-franja azul" style="--i:0"><div class="contenedor portada"><h1 style="--n:${largo(secs[0].deporteNombre)}">${esc(secs[0].deporteNombre)}</h1>${escudo()}</div></div>${indice}<div class="contenedor">` + secs
    .map((sec, i) => {
      const f = filaQuilmes(sec);
      const futuros = proximos(sec);
      const ult = jugados(sec).slice(0, 5).map((p) => ({ p }));
      const todos = [...sec.partidos].sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')).map((p) => ({ p }));
      const dif = f ? (f.dif ?? (f.pf != null ? f.pf - f.pc : null)) : null;
      return `<section class="equipo-seccion" id="eq-${esc(sec.id)}" style="--i:${i + 1}">
        <header><span class="chica">${esc(sec.competencia)}</span><h2>${esc(sec.titulo)}</h2></header>
        ${aviso(sec)}
        <p class="categoria">${esc(sec.descripcion || '')} <span class="situacion">${esc(situacion(sec))}</span></p>
        ${futuros[0] ? `<div class="panel-blanco">${proximo(futuros[0], sec)}</div>` : ''}
        ${f ? `<div class="cifras">
            <div><b>${esc(f.pos)}°</b><small class="chica">Posición</small></div>
            <div><b>${esc(f.pts)}</b><small class="chica">Puntos</small></div>
            <div><b>${esc(f.pj)}</b><small class="chica">Jugados</small></div>
            <div><b>${dif == null ? '–' : esc(dif > 0 ? `+${dif}` : dif)}</b><small class="chica">${sec.deporte === 'basquet' ? 'Dif. tantos' : 'Dif. gol'}</small></div>
          </div>` : ''}
        <div class="columnas">
          <div>
            <div class="bloque"><div class="bloque-cab"><h3>Fecha a fecha</h3><span class="chica">Acumulado</span></div>${lineas(sec)}</div>
            <div class="bloque"><div class="bloque-cab"><h3>ADN de la temporada</h3><span class="chica">${jugados(sec).length} partidos</span></div>${adn(sec)}</div>
            <div class="bloque"><div class="bloque-cab"><h3>Últimos partidos</h3></div>${listaResultados(ult)}</div>
          </div>
          <div>
            <div class="bloque"><div class="bloque-cab"><h3>Tabla de posiciones</h3><span class="chica">${esc(sec.tabla?.nombre || '')}</span></div>${tabla(sec)}
              <details class="fixture"><summary>Fixture completo · ${todos.length} partidos</summary>${listaResultados(todos)}</details>
            </div>
          </div>
        </div>
      </section>`;
    })
    .join('') + '</div>';
}

function mostrar() {
  const vista = VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'resumen';
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.vista === vista ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const html = document.documentElement;
  const yaMostrado = html.classList.contains('mostrado');
  if (yaMostrado) html.classList.remove('mostrado');
  $contenido.innerHTML = vista === 'resumen' ? vistaResumen() : vistaDeporte(vista);
  window.scrollTo(0, 0);
  if (yaMostrado) requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('mostrado')));
  seguirIndice();
}

// ---------- Arranque ----------
async function cargar() {
  if (window.__DATOS__) return window.__DATOS__; // vista previa con datos embebidos
  const r = await fetch(`data/quilmes.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

document.getElementById('ano').textContent = new Date().getFullYear();

// Índice de cada deporte: baja hasta el equipo y marca cuál se está viendo.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-ir]');
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.ir)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
});
let observador = null;
function seguirIndice() {
  observador?.disconnect();
  const links = [...document.querySelectorAll('.indice [data-ir]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  observador = new IntersectionObserver((entradas) => {
    for (const en of entradas) if (en.isIntersecting) links.forEach((l) => l.toggleAttribute('aria-current', l.dataset.ir === en.target.id));
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.equipo-seccion[id]').forEach((s) => observador.observe(s));
}
try {
  datos = await cargar();
  document.getElementById('actualizado').textContent = `Actualizado ${fechaBreve(datos.generado).toLowerCase()}, ${hora(datos.generado)} h`;
  document.getElementById('cinta').innerHTML = cinta();
  window.addEventListener('hashchange', mostrar);
  mostrar();
} catch (e) {
  document.getElementById('actualizado').textContent = 'Sin datos';
  $contenido.innerHTML = `<div class="contenedor error-carga">No se pudieron cargar los datos (${esc(e.message)}). Probá recargar la página en unos minutos.</div>`;
} finally {
  loader.fin();
}
