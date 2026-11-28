// Tenis: Interclubes de la Asociación Argentina de Tenis (deportivoaat.com.ar). Todo público:
//   app/vEntidad.php?idEntidad=                         → página del club: todos sus equipos con el link a cada categoría
//   app/vFixture2.php?idTorneo=&idCategoria=&idNivel=   → página de la categoría: grupos y llaves (HTML)
//   app/xml/ajaxTraerFixtureGrupo.php?…&idGrupo=        → series y posiciones de un grupo (JSON)
// El JSON solo responde con la cookie de la página y el encabezado X-Requested-With (como hace el navegador).
// Las categorías se descubren solas desde la página del club: no hay que cargarlas a mano.
import { limpiar, numero as num } from '../lib/util.js';

/** Acepta números o textos ("5", 5, "+15"). */
const numero = (v) => num(String(v ?? '').replace(/^\+/, ''));

const BASE = 'https://deportivoaat.com.ar/sis/app';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function pedir(url, extra = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...extra } });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return r;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}

const sinLado = (n) => limpiar(n).replace(/\s*\((L|V)\)\s*$/, '').trim();
/** "QUILMES ATLETICO-A" → "QUILMES ATLETICO" (saca la letra del equipo). */
export const club = (n) => sinLado(n).replace(/-[A-Z]$/, '').trim();
/** Nombre para mostrar: sin la "-A"; los equipos B, C… conservan la letra ("Quilmes B"). */
export function mostrar(n, nombreClub) {
  const m = sinLado(n).match(/^(.*?)-([A-Z])$/);
  const base = m ? m[1].trim() : sinLado(n);
  const letra = m ? m[2] : 'A';
  const nom = base === nombreClub ? 'Quilmes' : base;
  return letra === 'A' ? nom : `${nom} ${letra}`;
}

/** Grupos de la categoría (los argumentos de mostrarDiv en la página). */
export function grupos(html) {
  return [...new Set([...html.matchAll(/mostrarDiv\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d+)\s*\)/g)].map((m) => m[1]))];
}

/**
 * Llaves (campeonato, repechajes…). El HTML viene mal formado, así que se lee por texto:
 * cada "<h2> Llave … </h2>" va seguido de tablas "align=center", una por ronda, con celdas td.llave.
 * Una celda de la ronda siguiente es el ganador del par anterior y trae el "Score" de ese cruce.
 */
export function llaves(html) {
  const out = [];
  const partes = html.split(/<h2>\s*(?=Llave)/i).slice(1);
  for (const parte of partes) {
    const nombre = limpiar(parte.slice(0, parte.search(/<\/h2>/i)).replace(/<[^>]+>/g, ''));
    const cuerpo = parte.split(/<h2>|Imprimir Todos los Grupos/i)[0];
    const rondas = [];
    for (const m of cuerpo.matchAll(/<table align=center>([\s\S]*?)<\/table>/gi)) {
      const celdas = [...m[1].matchAll(/<td class=llave>([\s\S]*?)<\/td>/gi)].map((c) => {
        const texto = limpiar(c[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '));
        const nombreEq = limpiar(texto.replace(/Score:[\s\S]*$/, ''));
        const score = (texto.match(/Score:\s*(\d+)\s*-\s*(\d+)/) || []).slice(1).map(Number);
        const lado = (nombreEq.match(/\((L|V)\)\s*$/) || [])[1] || null;
        return { equipo: /^bye$/i.test(nombreEq) || !nombreEq ? null : sinLado(nombreEq), lado, score: score.length ? score : null };
      });
      if (celdas.length) rondas.push(celdas);
    }
    if (rondas.length > 1) out.push({ nombre, rondas });
  }
  return out;
}

const NOMBRE_RONDA = (faltan) => ['Final', 'Semifinal', 'Cuartos de final', 'Octavos de final'][faltan] || 'Primera ronda';

/** Cruces de las llaves donde jugó el equipo (ej. "QUILMES ATLETICO-B"). Sin fecha: la AAT no la publica en la llave. */
export function crucesDelClub(lls, equipo, nombreClub = club(equipo)) {
  const out = [];
  for (const ll of lls) {
    for (let k = 0; k < ll.rondas.length - 1; k++) {
      const r = ll.rondas[k], sig = ll.rondas[k + 1];
      for (let i = 0; i < r.length; i += 2) {
        const a = r[i], b = r[i + 1];
        if (!a?.equipo || !b?.equipo) continue; // bye
        if (a.equipo !== equipo && b.equipo !== equipo) continue;
        const [L, V] = a.lado === 'V' || b.lado === 'L' ? [b, a] : [a, b];
        const ganador = sig[i / 2];
        const jugado = !!(ganador?.equipo && ganador.score);
        // El "Score" de la llave viene del lado del ganador (ej. 3-0 para el que pasó), no local-visitante.
        const [g, p] = jugado ? [Math.max(...ganador.score), Math.min(...ganador.score)] : [null, null];
        const ganoLocal = jugado && ganador.equipo === L.equipo;
        out.push({
          fecha: null,
          ronda: `${ll.nombre.replace(/^Llave\s*/i, 'Llave ')} · ${NOMBRE_RONDA(ll.rondas.length - 2 - k)}`,
          local: mostrar(L.equipo, nombreClub),
          visitante: mostrar(V.equipo, nombreClub),
          esLocal: L.equipo === equipo,
          gl: jugado ? (ganoLocal ? g : p) : null,
          gv: jugado ? (ganoLocal ? p : g) : null,
          jugado,
          estado: jugado ? 'Finalizado' : 'Programado',
        });
      }
    }
  }
  return out;
}

/** Del JSON de un grupo: tabla y series del equipo. */
export function datosDelGrupo(j, equipo, letraGrupo, zona = '-03:00', nombreClub = club(equipo)) {
  const filas = (j.posiciones || []).map((p, i) => {
    const pj = numero(p.seriesJugadas), pg = numero(p.seriesGanadas);
    return {
      pos: i + 1,
      equipo: mostrar(p.equipo, nombreClub),
      pts: numero(p.puntos), pj, pg, pp: pj != null && pg != null ? pj - pg : null,
      dif: numero(p.difSet),
      dg: numero(p.difGame),
      esQuilmes: sinLado(p.equipo) === equipo,
    };
  });
  const de = (s, lado) => `${limpiar(s['nombreEnt' + lado])}-${limpiar(s['nombreEq' + lado]) || 'A'}`;
  const partidos = (j.series || [])
    .filter((s) => de(s, 'L') === equipo || de(s, 'V') === equipo)
    .map((s) => {
      const gl = numero(s.puntosL), gv = numero(s.puntosV);
      const jugado = gl != null && gv != null && (gl + gv > 0 || s.wo === '1');
      return {
        fecha: s.fec ? `${s.fec}T${/^\d{2}:\d{2}$/.test(s.Hora || '') ? s.Hora : '12:00'}:00${zona}` : null,
        ronda: `Grupo ${s.Grupo || letraGrupo}`,
        local: mostrar(de(s, 'L'), nombreClub),
        visitante: mostrar(de(s, 'V'), nombreClub),
        esLocal: de(s, 'L') === equipo,
        gl: jugado ? gl : null,
        gv: jugado ? gv : null,
        jugado,
        estado: jugado ? 'Finalizado' : s.reprogramada === '1' ? 'Reprogramado' : 'Programado',
      };
    });
  return { filas, partidos };
}

/**
 * Equipos del club en la página de la entidad (vEntidad.php?idEntidad=…): filas como
 * "QUILMES ATLETICO-A | Interclub Mayores - Agosto2026-Caballeros +45-Segunda (2026)" con el link a la categoría.
 * Las filas de "próximos partidos" tienen dos equipos y se saltean.
 */
export function equiposDeEntidad(html) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const fila = m[1];
    const links = [...fila.matchAll(/vEquipo\.php\?idEquipo=(\d+)&(?:amp;)?idTorneo=(\d+)&(?:amp;)?idCategoria=(\d+)&(?:amp;)?idNivel=(\d+)/g)];
    if (links.length !== 1) continue;
    const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => limpiar(c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '))).filter(Boolean);
    const equipo = celdas.find((c) => /-[A-Z]$/.test(c));
    const comp = celdas.map((c) => c.match(/^(.*?)\s*\((\d{4})\)$/)).find(Boolean);
    if (!equipo || !comp) continue;
    const [, idEquipo, idTorneo, idCategoria, idNivel] = links[0].map(Number);
    const p = comp[1].match(/^(.*)-([^-]+)-([^-]+)$/) || [null, comp[1], '', ''];
    out.push({ idEquipo, idTorneo, idCategoria, idNivel, equipo, anio: Number(comp[2]), torneo: limpiar(p[1]), categoria: limpiar(p[2]), nivel: limpiar(p[3]) });
  }
  return out;
}

/** "BERRUTI, FERNANDO" → "Berruti, Fernando". */
const titulo = (n) => limpiar(n).toLowerCase().replace(/(^|[\s,.'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/**
 * Nombres de la lista de buena fe de un equipo (vEquipo.php). La tabla es "Orden | Nombre | DNI | Carnet de Doble":
 * se toma SOLO el nombre; DNI y datos del capitán no se guardan.
 */
export function jugadoresDeEquipo(html) {
  const i = html.search(/Orden\s*\|?[\s\S]{0,400}?Nombre/i);
  const fin = html.search(/Fixture del equipo/i);
  const tramo = html.slice(i < 0 ? 0 : i, fin < 0 ? undefined : fin);
  const out = [];
  for (const m of tramo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => limpiar(c[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')));
    const nombre = celdas.find((c) => /^[^\d|]+,\s*[^\d|]+$/.test(c)); // "APELLIDO, NOMBRE"
    if (nombre && /^\d+$/.test(celdas.find(Boolean) || '')) out.push(titulo(nombre.replace(/\s+AGREGADO$/i, '')));
  }
  return [...new Set(out)];
}

/** "Interclub Mayores - Agosto2026" → "Interclub Mayores · Agosto 2026"; "1er Cuat" → "1er cuatrimestre". */
export const torneoProlijo = (t) => limpiar(t)
  .replace(/\s+-\s+/g, ' · ')
  .replace(/([a-z])(\d{4})/gi, '$1 $2')
  .replace(/\bCuat\b\.?/i, 'cuatrimestre');

const ORDEN_NIVEL = ['Primera', 'Intermedia', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Unica'];
const edad = (c) => parseInt(String(c).replace(/\D+/g, ''), 10) || 0;
/** Una categoría terminada hace más de 30 días ya no cambia: se reutiliza lo guardado. */
const terminada = (sec) => !!sec?.partidos?.length && sec.partidos.every((p) => p.jugado)
  && Math.max(0, ...sec.partidos.filter((p) => p.fecha).map((p) => new Date(p.fecha).getTime())) < Date.now() - 30 * 864e5;

/** previa(id): la sección del último quilmes.json, para no volver a bajar categorías terminadas. */
export async function leerAat(cfg, zona, previa = () => null) {
  const nombreClub = cfg.nombreClub;
  let todos = [];
  let aviso = '';
  try {
    const html = await (await pedir(`${BASE}/vEntidad.php?idEntidad=${cfg.idEntidad}`)).text();
    todos = equiposDeEntidad(html).filter((e) => club(e.equipo) === nombreClub);
    if (!todos.length) aviso = `la página del club vino sin equipos (${html.length} bytes, "${limpiar((html.match(/<title>([^<]*)/i) || [])[1] || '')}")`;
  } catch (err) {
    aviso = err.message;
  }
  // Desde los servidores de GitHub la página del club a veces no trae los equipos:
  // entonces se usan los equipos que ya se conocían (cada sección guarda sus datos de la AAT).
  if (!todos.length) {
    todos = (cfg.conocidas || []).map((s) => s.aat).filter(Boolean);
    if (!todos.length) throw new Error(`AAT: ${aviso || 'el club no tiene equipos cargados'}`);
    console.warn(`  AAT: ${aviso}; uso los ${todos.length} equipos conocidos`);
  }
  const anio = Math.max(...todos.map((e) => e.anio));
  const equipos = todos
    .filter((e) => e.anio === anio)
    .sort((a, b) => b.idTorneo - a.idTorneo || edad(a.categoria) - edad(b.categoria)
      || ORDEN_NIVEL.indexOf(a.nivel) - ORDEN_NIVEL.indexOf(b.nivel) || a.equipo.localeCompare(b.equipo));

  const secciones = [];
  for (const e of equipos) {
    const letra = e.equipo.slice(-1);
    const id = `tenis-${e.idTorneo}-${e.idCategoria}-${e.idNivel}-${letra.toLowerCase()}`;
    const vieja = previa(id);
    if (terminada(vieja) && vieja.aat && vieja.jugadores) { secciones.push({ ok: true, seccion: vieja }); continue; }
    try {
      const q = `idTorneo=${e.idTorneo}&idCategoria=${e.idCategoria}&idNivel=${e.idNivel}`;
      const r = await pedir(`${BASE}/vFixture2.php?${q}`);
      const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
      const html = await r.text();
      let grupo = null;
      for (const g of grupos(html)) {
        const j = await (await pedir(`${BASE}/xml/ajaxTraerFixtureGrupo.php?${q}&idGrupo=${g}`, {
          'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/vFixture2.php?${q}`, ...(cookie ? { Cookie: cookie } : {}),
        })).json();
        if ((j.posiciones || []).some((p) => sinLado(p.equipo) === e.equipo)) { grupo = { j, letra: j.series?.[0]?.Grupo || '' }; break; }
        await new Promise((res) => setTimeout(res, 150));
      }
      if (!grupo) throw new Error(`AAT: no encontré a ${e.equipo} en ${e.categoria} ${e.nivel}`);
      const d = datosDelGrupo(grupo.j, e.equipo, grupo.letra, zona, nombreClub);
      // Fase de grupos numerada por orden de fecha; después, los cruces de la llave.
      const fase = d.partidos
        .sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))
        .map((p, i) => ({ ...p, ronda: `Grupo ${grupo.letra} · Fecha ${i + 1}` }));
      // Lista de buena fe del equipo: solo los nombres (la página también trae DNI y contacto del capitán: no se publican).
      let jugadores = vieja?.jugadores || [];
      if (e.idEquipo) {
        try { jugadores = jugadoresDeEquipo(await (await pedir(`${BASE}/vEquipo.php?idEquipo=${e.idEquipo}&${q}`)).text()); } catch { /* se queda con la anterior */ }
      }
      secciones.push({
        ok: true,
        seccion: {
          id,
          deporte: 'tenis',
          deporteNombre: 'Tenis',
          titulo: `${e.categoria} · ${e.nivel.replace(/^Unica$/i, 'Única')}${letra !== 'A' ? ` · Equipo ${letra}` : ''}`,
          competencia: `AAT · ${torneoProlijo(e.torneo)}`,
          descripcion: 'Interclubes de la Asociación Argentina de Tenis. Cada serie se juega a singles y dobles; los mejores de cada grupo pasan a la llave.',
          fuente: 'AAT',
          tabla: { nombre: `Grupo ${grupo.letra}`, columnas: ['pts', 'pj', 'pg', 'pp', 'dif', 'dg'], filas: d.filas },
          partidos: [...fase, ...crucesDelClub(llaves(html), e.equipo, nombreClub)],
          jugadores,
          aat: e, // para poder seguir leyendo esta categoría aunque falle la página del club
        },
      });
    } catch (err) {
      secciones.push({ ok: false, id, error: err.message });
    }
    await new Promise((res) => setTimeout(res, 200)); // sin apurar al sitio
  }
  return secciones;
}
