// Hockey: AHBA (tournamenttracker.buenosaireshockey.ar).
// La API del sitio responde encriptada, así que abrimos la página con un navegador
// automático: el propio sitio desencripta los datos y nosotros leemos lo que muestra.
import { chromium } from 'playwright';
import { fechaCortaAISO, limpiar, numero } from '../lib/util.js';

const BASE = 'https://tournamenttracker.buenosaireshockey.ar';

/** Se ejecuta DENTRO de la página: lee los partidos del fixture ("Todas las fechas"). */
export function extraerPartidosEnPagina() {
  const vistos = new Set();
  const salida = [];
  let ronda = null;
  for (const el of document.querySelectorAll('main *')) {
    const texto = el.childElementCount === 0 ? el.textContent.trim() : '';
    if (/^Fecha \d+$/.test(texto)) {
      ronda = texto;
      continue;
    }
    if (!el.classList.contains('nombre-local')) continue;
    const fila = el.closest('.ms-Grid-row');
    if (!fila) continue;
    const visitante = fila.querySelector('.nombre-visitante');
    const icono = fila.querySelector('[data-icon-name="Calendar"]');
    const fecha = icono ? icono.parentElement.textContent.trim() : '';
    const goles = [...fila.querySelectorAll('.score')].map((s) => s.textContent.trim());
    const escudos = [...fila.querySelectorAll('img')].map((i) => i.src);
    const item = {
      ronda,
      fecha,
      local: el.textContent.trim(),
      visitante: visitante ? visitante.textContent.trim() : '',
      gl: goles[0] ?? null,
      gv: goles[1] ?? null,
      escudoLocal: escudos[0] || null,
      escudoVisitante: escudos[1] || null,
    };
    const clave = `${item.fecha}|${item.local}|${item.visitante}`;
    if (vistos.has(clave)) continue; // el sitio repite cada partido para móvil y escritorio
    vistos.add(clave);
    salida.push(item);
  }
  return salida;
}

/** Se ejecuta DENTRO de la página: lee la primera grilla de posiciones. */
export function extraerTablaEnPagina() {
  const lista = document.querySelector('.ms-DetailsList');
  if (!lista) return [];
  return [...lista.querySelectorAll('[role=row]')].map((r) =>
    [...r.querySelectorAll('[role=gridcell],[role=columnheader],[role=rowheader]')].map((c) => c.innerText.trim()),
  );
}

/** Convierte lo leído en la página al formato común. */
export function normalizarHockey({ titulo, subtitulo, crudos, grilla }, nombreEquipo, zona = '-03:00') {
  const anio = (subtitulo.match(/(20\d{2})/) || [])[1] || String(new Date().getFullYear());
  const partidos = crudos
    .filter((p) => p.local === nombreEquipo || p.visitante === nombreEquipo)
    .map((p) => {
      const gl = numero(p.gl);
      const gv = numero(p.gv);
      const jugado = gl != null && gv != null;
      return {
        fecha: fechaCortaAISO(p.fecha, anio, zona),
        ronda: p.ronda,
        local: p.local,
        visitante: p.visitante,
        esLocal: p.local === nombreEquipo,
        gl, gv, jugado,
        estado: jugado ? 'Finalizado' : 'Programado',
        escudoLocal: p.escudoLocal,
        escudoVisitante: p.escudoVisitante,
      };
    })
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const [encabezado = [], ...resto] = grilla;
  const idx = (n) => encabezado.findIndex((h) => h.toUpperCase() === n);
  const filas = resto
    .filter((c) => c.length > 3 && numero(c[0]) != null)
    .map((c) => {
      const v = (n) => numero(c[idx(n)]);
      const equipo = limpiar(c[idx('CLUB')]);
      return {
        pos: numero(c[0]), equipo,
        pts: v('PTS'), pj: v('PJ'), pg: v('PG'), pe: v('PE'), pp: v('PP'), gf: v('GF'), gc: v('GC'), dif: v('DF'),
        esQuilmes: equipo === nombreEquipo,
      };
    });
  return { titulo, subtitulo, partidos, filas };
}

async function leerTorneo(page, cfg, torneo, zona) {
  await page.goto(`${BASE}/${torneo.codigo}?clubId=${cfg.clubId}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.nombre-header-torneo', { timeout: 30000 });
  const titulo = limpiar(await page.locator('.nombre-header-torneo').first().textContent());
  const subtitulo = limpiar(await page.locator('.nombre-header-torneo + span').first().textContent());

  // Fixture: "Todas las fechas" muestra solo los partidos del club elegido.
  await page.getByText('Todas las fechas', { exact: true }).filter({ visible: true }).first().click();
  await page.waitForTimeout(2500);
  const crudos = await page.evaluate(extraerPartidosEnPagina);

  // Tabla de posiciones.
  await page.locator('button[role=tab][name="Posiciones"]').click();
  await page.waitForSelector('.ms-DetailsList [role=row]', { timeout: 30000 });
  const grilla = await page.evaluate(extraerTablaEnPagina);

  const n = normalizarHockey({ titulo, subtitulo, crudos, grilla }, cfg.nombreEquipo, zona);
  if (n.partidos.length === 0 && n.filas.length === 0) throw new Error(`AHBA: sin datos en ${torneo.titulo}`);
  return {
    id: torneo.id,
    deporte: 'hockey',
    deporteNombre: torneo.deporteNombre,
    titulo: torneo.titulo,
    competencia: `Metropolitano ${n.subtitulo.split(' - ')[2] || ''}`.trim(),
    descripcion: torneo.descripcion,
    fuente: 'AHBA',
    tabla: { nombre: n.titulo, columnas: ['pts', 'pj', 'pg', 'pe', 'pp', 'gf', 'gc', 'dif'], filas: n.filas },
    partidos: n.partidos,
  };
}

/** Devuelve un resultado por torneo: { ok, seccion } o { ok:false, id, error }. */
export async function leerAhba(cfg, zona) {
  const browser = await chromium.launch();
  const resultados = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
    for (const torneo of cfg.torneos) {
      try {
        resultados.push({ ok: true, seccion: await leerTorneo(page, cfg, torneo, zona) });
      } catch (e) {
        resultados.push({ ok: false, id: torneo.id, error: e.message });
      }
    }
  } finally {
    await browser.close();
  }
  return resultados;
}
