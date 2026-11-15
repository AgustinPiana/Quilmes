// Utilidades compartidas por los lectores de cada fuente.

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Descarga una URL como texto, con 3 intentos. */
export async function fetchText(url, { intentos = 3 } = {}) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return await r.text();
    } catch (e) {
      ultimoError = e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw ultimoError;
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

export const limpiar = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

export const numero = (s) => {
  const t = limpiar(s).replace(',', '.');
  if (t === '' || isNaN(Number(t))) return null;
  return Number(t);
};

/** "2026/02/16 17:00" o "16/02/2026 17:00" → ISO con zona horaria. */
export function aISO(texto, zona = '-03:00') {
  const t = limpiar(texto);
  let m = t.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${zona}`;
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00${zona}`;
  return null;
}

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12 };

/** "dom 08 mar 16:00" + año → ISO. */
export function fechaCortaAISO(texto, anio, zona = '-03:00') {
  const m = limpiar(texto).toLowerCase().match(/(\d{1,2})\s+([a-zé]+)\.?\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const mes = MESES[m[2]];
  if (!mes) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${anio}-${p(mes)}-${p(m[1])}T${p(m[3])}:${m[4]}:00${zona}`;
}

/** Fecha YYYY-MM-DD desplazada N días desde hoy. */
export function diaRelativo(dias) {
  const d = new Date(Date.now() + dias * 86400000);
  return d.toISOString().slice(0, 10);
}
