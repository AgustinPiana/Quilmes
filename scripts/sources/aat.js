// Tenis: Interclubes de la Asociación Argentina de Tenis (deportivoaat.com.ar). Todo público:
//   app/vFixture2.php?idTorneo=&idCategoria=&idNivel=   → página de la categoría: grupos y llaves (HTML)
//   app/xml/ajaxTraerFixtureGrupo.php?…&idGrupo=        → series y posiciones de un grupo (JSON)
// El JSON solo responde con la cookie de la página y el encabezado X-Requested-With (como hace el navegador).
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

/** "QUILMES ATLETICO-A" → "QUILMES ATLETICO" (saca la letra del equipo). */
export const club = (n) => limpiar(n).replace(/\s*\((L|V)\)\s*$/, '').replace(/-[A-Z]$/, '').trim();

/** Grupos de la categoría (los argumentos de mostrarDiv en la página). */
export function grupos(html) {
  return [...new Set([...html.matchAll(/mostrarDiv\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d+)\s*\)/g)].map((m) => m[1]))];
}

/**
 * Llaves (campeonato, repechajes…). El HTML viene mal formado, así que se lee por texto:
 * cada "<h2> Llave … </h2>" va seguido de tablas "align=center", una por ronda, con celdas td.llave.
 * Una celda de la ronda siguiente es el ganador del par anterior y trae "Score: L-V" de ese cruce.
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
        return { equipo: /^bye$/i.test(nombreEq) || !nombreEq ? null : club(nombreEq), lado, score: score.length ? score : null };
      });
      if (celdas.length) rondas.push(celdas);
    }
    if (rondas.length > 1) out.push({ nombre, rondas });
  }
  return out;
}

const NOMBRE_RONDA = (faltan) => ['Final', 'Semifinal', 'Cuartos de final', 'Octavos de final'][faltan] || 'Primera ronda';

/** Cruces de las llaves donde jugó el club (sin fecha: la AAT no la publica en la llave). */
export function crucesDelClub(lls, nombreClub) {
  const out = [];
  for (const ll of lls) {
    for (let k = 0; k < ll.rondas.length - 1; k++) {
      const r = ll.rondas[k], sig = ll.rondas[k + 1];
      for (let i = 0; i < r.length; i += 2) {
        const a = r[i], b = r[i + 1];
        if (!a?.equipo || !b?.equipo) continue; // bye
        if (a.equipo !== nombreClub && b.equipo !== nombreClub) continue;
        const [L, V] = a.lado === 'V' || b.lado === 'L' ? [b, a] : [a, b];
        const ganador = sig[i / 2];
        const jugado = !!(ganador?.equipo && ganador.score);
        // El "Score" de la llave viene del lado del ganador (ej. 3-0 para el que pasó), no local-visitante.
        const [g, p] = jugado ? [Math.max(...ganador.score), Math.min(...ganador.score)] : [null, null];
        const ganoLocal = jugado && ganador.equipo === L.equipo;
        out.push({
          fecha: null,
          ronda: `${ll.nombre.replace(/^Llave\s*/i, 'Llave ')} · ${NOMBRE_RONDA(ll.rondas.length - 2 - k)}`,
          local: L.equipo, visitante: V.equipo,
          esLocal: L.equipo === nombreClub,
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

/** Del JSON de un grupo: tabla y series del club. */
export function datosDelGrupo(j, nombreClub, letraGrupo, zona = '-03:00') {
  const filas = (j.posiciones || []).map((p, i) => {
    const pj = numero(p.seriesJugadas), pg = numero(p.seriesGanadas);
    return {
      pos: i + 1,
      equipo: club(p.equipo),
      pts: numero(p.puntos), pj, pg, pp: pj != null && pg != null ? pj - pg : null,
      dif: numero(p.difSet),
      dg: numero(p.difGame),
      esQuilmes: club(p.equipo) === nombreClub,
    };
  });
  const partidos = (j.series || [])
    .filter((s) => club(s.nombreEntL) === nombreClub || club(s.nombreEntV) === nombreClub)
    .map((s) => {
      const gl = numero(s.puntosL), gv = numero(s.puntosV);
      const jugado = gl != null && gv != null && (gl + gv > 0 || s.wo === '1');
      return {
        fecha: s.fec ? `${s.fec}T${/^\d{2}:\d{2}$/.test(s.Hora || '') ? s.Hora : '12:00'}:00${zona}` : null,
        ronda: `Grupo ${s.Grupo || letraGrupo} · Fecha ${numero(s.numero) + 1}`,
        local: club(s.nombreEntL), visitante: club(s.nombreEntV),
        esLocal: club(s.nombreEntL) === nombreClub,
        gl: jugado ? gl : null, gv: jugado ? gv : null,
        jugado,
        estado: jugado ? 'Finalizado' : s.reprogramada === '1' ? 'Reprogramado' : 'Programado',
      };
    });
  return { filas, partidos };
}

export async function leerAat(cfg, zona) {
  const nombreClub = cfg.nombreClub;
  const secciones = [];
  for (const t of cfg.categorias) {
    try {
      const q = `idTorneo=${t.idTorneo}&idCategoria=${t.idCategoria}&idNivel=${t.idNivel}`;
      const r = await pedir(`${BASE}/vFixture2.php?${q}`);
      const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
      const html = await r.text();
      let grupo = null;
      for (const g of grupos(html)) {
        const j = await (await pedir(`${BASE}/xml/ajaxTraerFixtureGrupo.php?${q}&idGrupo=${g}`, {
          'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/vFixture2.php?${q}`, ...(cookie ? { Cookie: cookie } : {}),
        })).json();
        if ((j.posiciones || []).some((p) => club(p.equipo) === nombreClub)) { grupo = { j, letra: j.series?.[0]?.Grupo || '' }; break; }
        await new Promise((res) => setTimeout(res, 200));
      }
      if (!grupo) throw new Error(`AAT: no encontré a ${nombreClub} en ${t.titulo}`);
      const d = datosDelGrupo(grupo.j, nombreClub, grupo.letra, zona);
      // Fase de grupos numerada por orden de fecha; después, los cruces de la llave.
      const grupo1 = d.partidos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map((p, i) => ({ ...p, ronda: `Grupo ${grupo.letra} · Fecha ${i + 1}` }));
      const partidos = [...grupo1, ...crucesDelClub(llaves(html), nombreClub)];
      secciones.push({
        ok: true,
        seccion: {
          id: t.id,
          deporte: 'tenis',
          deporteNombre: 'Tenis',
          titulo: t.titulo,
          competencia: t.competencia,
          descripcion: t.descripcion,
          fuente: 'AAT',
          tabla: { nombre: `Grupo ${grupo.letra}`, columnas: ['pts', 'pj', 'pg', 'pp', 'dif', 'dg'], filas: d.filas },
          partidos,
        },
      });
    } catch (e) {
      secciones.push({ ok: false, id: t.id, error: e.message });
    }
  }
  return secciones;
}
