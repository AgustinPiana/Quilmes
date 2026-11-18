// Agenda del Cervecero: lee data/quilmes.json y arma las vistas.

const TZ = 'America/Argentina/Buenos_Aires';
const VISTAS = ['resumen', 'futbol', 'basquet', 'hockey', 'natacion'];
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
  natacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="17" cy="6.5" r="2"/><path d="m4 12.5 5-4.5 3.5 2.5L15 8M3 16.5c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2M3 20.5c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2"/></svg>',
};

// ---------- Natación: se compite por jornadas, no por partidos ----------
const esNatacion = (sec) => Array.isArray(sec.jornadas);
const ultimaJornada = (sec) => sec.jornadas?.at(-1) || null;
const totalMedallas = (j) => (j?.oro || 0) + (j?.plata || 0) + (j?.bronce || 0);
const medallas = (j) => `<span class="medallas" aria-label="${j.oro} oros, ${j.plata} platas, ${j.bronce} bronces"><i class="oro">${j.oro}</i><i class="plata">${j.plata}</i><i class="bronce">${j.bronce}</i></span>`;
const fechaDe = (x) => (x.p ? x.p.fecha : x.j?.fecha) || '';

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
    .map(({ p, j, sec }) => {
      if (j) {
        const contexto = [sec && `${sec.deporteNombre} ${minus(sec.titulo)}`, fechaBreve(j.fecha), j.equipos ? `${j.equipos} equipos` : null].filter(Boolean).join(' · ');
        return `<li><span class="quien">${esc(sec.competencia)} · ${esc(j.nombre)}<small>${esc(contexto)}</small></span><span class="marcador">${medallas(j)}<b>${j.puesto ? `${esc(j.puesto)}°` : '–'}</b></span></li>`;
      }
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
    .flatMap((sec) => (esNatacion(sec) ? (ultimaJornada(sec) ? [{ j: ultimaJornada(sec), sec }] : []) : jugados(sec).slice(0, 3).map((p) => ({ p, sec }))))
    .sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)))
    .slice(0, 8)
    .map(({ p, j, sec }) => j
      ? `<span class="cinta-item" style="--c:var(--gano)"><i></i>${esc(sec.deporteNombre)} ${esc(sec.titulo)}<b>Quilmes ${j.puesto ? `${esc(j.puesto)}° · ` : ''}${esc(j.oro)} oros · ${esc(j.nombre)}</b></span>`
      : `<span class="cinta-item" style="--c:${COLOR[resultado(p)]}"><i></i>${esc(sec.deporteNombre)} ${esc(sec.titulo.split(' ')[0])}<b>Quilmes ${esc(marcadorPropio(p))} ${esc(rival(p))}</b></span>`)
    .join('');
  if (!items) return '';
  return `<div class="cinta-pista" aria-hidden="true">${items}${items}</div>`;
}

// ---------- Vistas ----------
// Próximo partido (grande) y los que siguen, de todos los deportes o de uno solo.
function listaProximos(dep) {
  const futuros = deLa(dep)
    .flatMap((sec) => proximos(sec).map((p) => ({ p, sec })))
    .sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999'));
  const [primero, ...resto] = futuros;
  if (!primero) {
    return dep === 'todos'
      ? '<p class="vacio">No hay partidos programados por ahora. La página se actualiza sola cuando las ligas publican el fixture.</p>'
      : `<p class="vacio">No hay ${dep === 'natacion' ? 'jornadas programadas' : 'partidos programados'} de este deporte por ahora.</p>`;
  }
  return `${proximo(primero.p, primero.sec)}
      ${resto.length ? `<ul class="siguen" aria-label="Después">${resto.slice(0, 5).map(({ p, sec }) => `<li>
            <span class="cuando chica">${p.fecha ? `<b>${esc(partes(p.fecha, { day: 'numeric' }).day)}</b>${esc(sinPunto(partes(p.fecha, { weekday: 'short' }).weekday))} · ${esc(sinPunto(partes(p.fecha, { month: 'short' }).month))}` : '<b>–</b>A confirmar'}</span>
            <span class="quien">${p.esLocal ? 'vs' : 'en cancha de'} ${esc(rival(p))}<small>${esc(sec.deporteNombre)} ${esc(minus(sec.titulo))}${p.ronda && !p.fecha ? ` · ${esc(p.ronda)}` : ''}</small></span>
            <span class="hora">${p.fecha ? esc(hora(p.fecha)) : ''}</span></li>`).join('')}</ul>` : ''}`;
}

function vistaResumen() {
  return `
    ${titularesHTML()}
    <section class="seccion" style="--i:0">
      ${titulo('01', 'Próximo partido')}<div class="contenedor">
      ${filtros('proximos')}<div data-lista="proximos" aria-live="polite">${listaProximos(filtro.proximos)}</div>
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

// ---------- Titulares automáticos: rachas y datos salientes ----------
// Cada candidato tiene un peso; se muestran los más fuertes (uno por equipo como máximo).
function titulares() {
  const nombreEq = (sec) => `${sec.deporteNombre} ${minus(sec.titulo)}`;
  const out = [];
  for (const sec of datos.secciones) {
    if (esNatacion(sec)) {
      const total = sec.jornadas.reduce((n, j) => n + totalMedallas(j), 0);
      const oros = sec.jornadas.reduce((n, j) => n + (j.oro || 0), 0);
      if (total) out.push({ peso: 58, valor: total, texto: `medallas en la temporada · ${oros} de oro`, tono: 'bueno', equipo: nombreEq(sec), deporte: sec.deporte });
      continue;
    }
    const js = jugados(sec); // del más reciente al más viejo
    if (!js.length) continue;
    const rs = js.map(resultado);
    const seguidos = (ok) => { let n = 0; for (const r of rs) { if (!ok(r)) break; n++; } return n; };
    const f = filaQuilmes(sec);
    const termino = !proximos(sec).length;
    const cands = [];

    const ganados = seguidos((r) => r === 'G');
    const invicto = seguidos((r) => r !== 'P');
    const sinGanar = seguidos((r) => r !== 'G');
    const perdidos = seguidos((r) => r === 'P');
    if (ganados >= 3) cands.push({ peso: 50 + ganados, valor: ganados, texto: 'victorias seguidas', tono: 'bueno' });
    else if (invicto >= 4) cands.push({ peso: 40 + invicto, valor: invicto, texto: 'partidos invicto', tono: 'bueno' });
    if (perdidos >= 3) cands.push({ peso: 35 + perdidos, valor: perdidos, texto: 'derrotas seguidas', tono: 'malo' });
    else if (sinGanar >= 4) cands.push({ peso: 30 + sinGanar, valor: sinGanar, texto: 'partidos sin ganar', tono: 'malo' });

    if (f && f.pp === 0 && f.pj >= 6) cands.push({ peso: 70 + f.pj, valor: '0', texto: `derrotas en ${f.pj} partidos`, tono: 'bueno' });
    if (f && f.pos === 1) cands.push({ peso: termino ? 80 : 60, valor: '1°', texto: termino ? `terminó primero · ${sec.competencia}` : `primero en ${sec.tabla.nombre}`, tono: 'bueno' });

    const local = sec.partidos.filter((p) => p.jugado && p.esLocal).map(resultado);
    if (local.length >= 5 && local.every((r) => r === 'G')) cands.push({ peso: 55 + local.length, valor: `${local.length}/${local.length}`, texto: 'ganados de local', tono: 'bueno' });

    const ult = js[0];
    const dias = (Date.now() - new Date(ult.fecha).getTime()) / 864e5;
    const prop = ult.esLocal ? ult.gl : ult.gv, otro = ult.esLocal ? ult.gv : ult.gl;
    const goleada = sec.deporte === 'basquet' ? 20 : 4;
    if (dias <= 14 && prop - otro >= goleada) cands.push({ peso: 45 + prop - otro, valor: `${prop}-${otro}`, texto: `goleada a ${rival(ult)}`, tono: 'bueno' });

    cands.sort((a, b) => b.peso - a.peso);
    if (cands[0]) out.push({ ...cands[0], equipo: nombreEq(sec), deporte: sec.deporte });
  }
  return out.sort((a, b) => b.peso - a.peso).slice(0, 6);
}

function titularesHTML() {
  const t = titulares();
  if (!t.length) return '';
  return `<section class="titulares" style="--i:0" aria-label="Rachas y datos de los equipos"><div class="contenedor">
      <p class="chica titulares-cab">En racha</p>
      <ul>${t.map((x) => `<li class="${x.tono}"><a href="#${esc(x.deporte)}"><b>${esc(x.valor)}</b><span>${esc(x.texto)}</span><small class="chica">${esc(x.equipo)}</small></a></li>`).join('')}</ul>
    </div></section>`;
}

// ---------- Filtros por deporte del inicio ----------
const filtro = { proximos: 'todos', equipos: 'todos', resultados: 'todos' };
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
      const uj = ultimaJornada(sec);
      const registro = esNatacion(sec) ? `${uj?.nombre || ''}` : sec.deporte === 'basquet' ? `${f.pg}G ${f.pp}P` : `${f.pg}G ${f.pe}E ${f.pp}P`;
      return `<a class="equipo" href="#${sec.deporte}">
          <div class="equipo-cab">
            <h3>${esc(sec.deporteNombre)} ${esc(minus(sec.titulo))}<span class="flecha">→</span><small class="chica">${esc(sec.competencia)}</small></h3>
            <span class="ordinal">${esc(f.pos)}<sup>°</sup></span>
          </div>
          ${pista(sec, f)}
          <div class="equipo-pie">${esNatacion(sec) && uj ? medallas(uj) : forma(sec)}<span><b>${esc(f.pts)} pts</b> · ${esc(registro)}</span></div>
        </a>`;
    })
    .join('');
  return tarjetas ? `<div class="equipos">${tarjetas}</div>` : '<p class="vacio">No hay tablas de este deporte.</p>';
}

// Todos: el último partido de cada equipo. Un deporte: sus 8 partidos más recientes.
function ultimosResultados(dep) {
  const items = dep === 'todos'
    ? deLa(dep).map((sec) => (esNatacion(sec) ? { j: ultimaJornada(sec), sec } : { p: jugados(sec)[0], sec })).filter((x) => x.p || x.j)
    : deLa(dep).flatMap((sec) => (esNatacion(sec) ? sec.jornadas.map((j) => ({ j, sec })) : jugados(sec).map((p) => ({ p, sec }))));
  items.sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
  return listaResultados(dep === 'todos' ? items : items.slice(0, 8));
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (!b || !datos) return;
  const grupo = b.dataset.filtro;
  filtro[grupo] = b.dataset.valor;
  document.querySelectorAll(`[data-filtro="${grupo}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const lista = document.querySelector(`[data-lista="${grupo}"]`);
  const armar = { proximos: listaProximos, equipos: listaEquipos, resultados: ultimosResultados }[grupo];
  lista.innerHTML = armar(filtro[grupo]);
  lista.classList.remove('cambio'); void lista.offsetWidth; lista.classList.add('cambio');
});

// Puesto del club jornada a jornada (1° arriba).
function puestos(sec) {
  const js = sec.jornadas.filter((j) => j.puesto);
  if (js.length < 2) return '<p class="vacio">Faltan jornadas para armar el gráfico.</p>';
  const W = 320, H = 150, der = 10;
  const peor = Math.max(...js.map((j) => j.puesto), 6) + 1;
  const x = (i) => (i / (js.length - 1)) * (W - der);
  const y = (p) => ((p - 1) / (peor - 1)) * H;
  const d = js.map((j, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(j.puesto).toFixed(1)}`).join(' ');
  return `<svg class="lineas" viewBox="-18 -12 ${W + 30} ${H + 32}" role="img" aria-label="Puesto por jornada: ${js.map((j) => `${j.nombre} ${j.puesto}°`).join(', ')}">
      ${[1, Math.round(peor / 2), peor].map((g) => `<line class="eje" x1="0" x2="${W - der}" y1="${y(g)}" y2="${y(g)}"/><text x="-6" y="${y(g) + 3}" text-anchor="end">${g}°</text>`).join('')}
      <path class="G" pathLength="1" d="${d}"/>
      ${js.map((j, i) => `<circle class="G" cx="${x(i)}" cy="${y(j.puesto)}" r="3.5"/><text class="fin G" x="${x(i)}" y="${y(j.puesto) - 8}" text-anchor="middle">${j.puesto}°</text><text x="${x(i)}" y="${H + 16}" text-anchor="middle">${j.numero || i + 1}ª</text>`).join('')}
    </svg>`;
}

// Medallero: una columna por jornada, oro arriba.
function medallero(sec) {
  const max = Math.max(...sec.jornadas.map(totalMedallas), 1);
  return `<div class="medallero" role="img" aria-label="Medallas por jornada">${sec.jornadas
    .map((j) => `<div title="${esc(j.nombre)}: ${j.oro} oros, ${j.plata} platas, ${j.bronce} bronces"><b>${totalMedallas(j)}</b><span style="--h:${(totalMedallas(j) / max) * 100}%"><i class="bronce" style="flex:${j.bronce}"></i><i class="plata" style="flex:${j.plata}"></i><i class="oro" style="flex:${j.oro}"></i></span><small>${j.numero || ''}ª</small></div>`)
    .join('')}</div>
    <div class="leyenda"><span style="--c:var(--oro)"><i></i>Oro</span><span style="--c:var(--plata)"><i></i>Plata</span><span style="--c:var(--bronce)"><i></i>Bronce</span></div>`;
}

function podios(j) {
  if (!j?.podios?.length) return '<p class="vacio">Sin podios en esta jornada.</p>';
  const fila = (x) => `<li><span class="podio-m ${['', 'oro', 'plata', 'bronce'][x.puesto]}">${x.puesto}</span><span class="quien">${esc(nombre(x.nadador))}<small>${esc(x.prueba || '')}</small></span><b>${esc(x.tiempo)}</b></li>`;
  const primeros = j.podios.slice(0, 6), resto = j.podios.slice(6);
  return `<ul class="podios">${primeros.map(fila).join('')}</ul>${resto.length ? `<details class="fixture"><summary>Todos los podios · ${j.podios.length}</summary><ul class="podios">${resto.map(fila).join('')}</ul></details>` : ''}`;
}

function seccionNatacion(sec, i) {
  const js = sec.jornadas;
  const uj = ultimaJornada(sec);
  const total = js.reduce((n, j) => n + totalMedallas(j), 0);
  const oros = js.reduce((n, j) => n + (j.oro || 0), 0);
  const mejor = Math.min(...js.filter((j) => j.puesto).map((j) => j.puesto));
  const lider = sec.tabla?.filas?.[0];
  const situ = uj?.puesto ? `En la ${uj.nombre} terminó ${uj.puesto}° de ${uj.equipos} equipos${lider && !lider.esQuilmes ? `; ganó ${nombre(lider.equipo)}` : ''}.` : '';
  return `<section class="equipo-seccion" id="eq-${esc(sec.id)}" style="--i:${i + 1}">
      <header><span class="chica">${esc(sec.competencia)}</span><h2>${esc(sec.titulo)}</h2></header>
      ${aviso(sec)}
      <p class="categoria">${esc(sec.descripcion || '')} <span class="situacion">${esc(situ)}</span></p>
      <div class="cifras">
        <div><b>${uj?.puesto ? `${esc(uj.puesto)}°` : '–'}</b><small class="chica">Última jornada</small></div>
        <div><b>${Number.isFinite(mejor) ? `${mejor}°` : '–'}</b><small class="chica">Mejor puesto</small></div>
        <div><b>${total}</b><small class="chica">Medallas</small></div>
        <div><b>${oros}</b><small class="chica">De oro</small></div>
      </div>
      <div class="columnas">
        <div>
          <div class="bloque"><div class="bloque-cab"><h3>Puesto jornada a jornada</h3><span class="chica">Por equipos</span></div>${puestos(sec)}</div>
          <div class="bloque"><div class="bloque-cab"><h3>Medallero</h3><span class="chica">${js.length} jornadas</span></div>${medallero(sec)}</div>
          <div class="bloque"><div class="bloque-cab"><h3>Podios · ${esc(uj?.nombre || '')}</h3><span class="chica">${esc(fechaBreve(uj?.fecha))}</span></div>${podios(uj)}</div>
        </div>
        <div>
          <div class="bloque"><div class="bloque-cab"><h3>Puntaje por equipos</h3><span class="chica">${esc(uj?.nombre || '')}</span></div>${tabla(sec)}
            <details class="fixture"><summary>Todas las jornadas · ${js.length}</summary>${listaResultados([...js].reverse().map((j) => ({ j, sec })))}</details>
          </div>
        </div>
      </div>
    </section>`;
}

function vistaDeporte(deporte) {
  const secs = datos.secciones.filter((s) => s.deporte === deporte);
  if (!secs.length) return '<p class="vacio">Todavía no hay datos de este deporte.</p>';
  // Índice: un acceso por equipo, con su posición. Se mueve con scroll (el # de la URL elige el deporte).
  const indice = secs.length > 1 ? `<nav class="indice" aria-label="Equipos de ${esc(secs[0].deporteNombre.toLowerCase())}"><div class="contenedor"><ol>${secs
    .map((sec, i) => { const f = filaQuilmes(sec); return `<li><a href="#${esc(deporte)}" data-ir="eq-${esc(sec.id)}"><span>${dos(i + 1)}</span>${esc(sec.titulo)}${f ? `<b>${esc(f.pos)}°</b>` : ''}</a></li>`; })
    .join('')}</ol></div></nav>` : '';
  return `<div class="portada-franja azul" style="--i:0"><div class="contenedor portada"><h1 style="--n:${largo(secs[0].deporteNombre)}">${esc(secs[0].deporteNombre)}</h1>${escudo()}</div></div>${indice}<div class="contenedor">` + secs
    .map((sec, i) => {
      if (esNatacion(sec)) return seccionNatacion(sec, i);
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

// App instalable: registra el service worker (no en las capturas de prueba).
if ('serviceWorker' in navigator && !document.documentElement.classList.contains('static')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
