// Junta los datos de todas las fuentes y escribe public/data/quilmes.json.
// Si una fuente falla, conserva lo que había de esa sección y la marca como desactualizada.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { leerAfa } from './sources/afa.js';
import { leerFebamba } from './sources/febamba.js';
import { leerAhba } from './sources/ahba.js';
import { leerPromiedos } from './sources/promiedos.js';
import { leerDatafem } from './sources/datafem.js';
import { leerFenaba } from './sources/fenaba.js';
import { leerAat } from './sources/aat.js';

const RUTA = new URL('../public/data/quilmes.json', import.meta.url);
const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
const zona = config.zonaHoraria;

let anterior = { secciones: [] };
try {
  anterior = JSON.parse(await readFile(RUTA, 'utf8'));
} catch {
  /* primera corrida */
}
const previa = (id) => anterior.secciones?.find((s) => s.id === id);
const ahora = new Date().toISOString();

const secciones = [];
const errores = [];

function agregar(id, resultado) {
  if (resultado.ok) {
    secciones.push({ ...resultado.seccion, actualizado: ahora, desactualizado: false });
    const s = resultado.seccion;
    console.log(`✔ ${id}: ${s.jornadas ? `${s.jornadas.length} jornadas` : `${s.partidos.length} partidos`}, ${s.tabla?.filas.length ?? 0} equipos en tabla`);
    return;
  }
  errores.push(`${id}: ${resultado.error}`);
  console.error(`✘ ${id}: ${resultado.error}`);
  const vieja = previa(id);
  if (vieja) secciones.push({ ...vieja, desactualizado: true, error: resultado.error });
}

async function intentar(id, fn) {
  try {
    agregar(id, { ok: true, seccion: await fn() });
  } catch (e) {
    agregar(id, { ok: false, error: e.message });
  }
}

await intentar(config.afa.id, () => leerAfa(config.afa, zona));
await intentar(config.reserva.id, () => leerPromiedos(config.reserva, zona));
await intentar(config.femenino.id, () => leerDatafem(config.femenino, zona));
await intentar(config.febamba.id, () => leerFebamba(config.febamba, zona));
try {
  for (const r of await leerAat(config.tenis, zona)) agregar(r.ok ? r.seccion.id : r.id, r);
} catch (e) {
  for (const t of config.tenis.categorias) agregar(t.id, { ok: false, error: e.message });
}
await intentar(config.natacion.id, () => leerFenaba(config.natacion, zona, previa(config.natacion.id)));
try {
  for (const r of await leerAhba(config.ahba, zona)) agregar(r.ok ? r.seccion.id : r.id, r);
} catch (e) {
  for (const t of config.ahba.torneos) agregar(t.id, { ok: false, error: e.message });
}

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(RUTA, JSON.stringify({ generado: ahora, secciones, errores }, null, 2) + '\n');
console.log(`Listo: ${secciones.length} secciones, ${errores.length} errores.`);

// Falla el proceso solo si no se pudo leer ninguna fuente.
if (secciones.every((s) => s.desactualizado)) process.exit(1);
