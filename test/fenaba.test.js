import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndice, parsePuntajeEquipos, parsePrueba, nombrePrueba } from '../scripts/sources/fenaba.js';

// Fragmentos con la forma de las exportaciones de Hy-Tek que publica FENABA (Metro Master 2026, 8ª jornada).
const indice = `<html><body>METRO MASTER 2026 - 8° JORNADA<br>7/11/2026
  <a href="261107lastevt.htm" target=main>Último Evento Completado</a>
  <a href="261107F084.htm" target=main>#84 Mujeres 100 Mariposa FEDERADO</a>
  <a href="261107F085.htm" target=main>#85 Hombres 100 Mariposa FEDERADO</a></body></html>`;

const ultimo = `<pre>
                                       Puntaje Mixto por Equipos - Hasta el Evento 96

  1. Libertador Argentina Master       710   2. Asoc. Atlética Arg. Juniors       514
  5. Quilmes Atlético Club             180   6. Club A. San Lorenzo de Almagro    166
  9. Uthgra Nadadores Del Sur           84  10. Club Argentino DE Quilmes          78
 23. Marea Roja San Vicente              5
</pre>`;

const prueba = `<pre>
 Evento 85  Hombres 20-24 100 CL Metro Estilo de Mariposa FEDERADO
=========================================================================
    Nombre         Edad Equipo            Sembrar    Finales       Puntos
=========================================================================
  1 Mangini, Luis G  22 QAC               1:20.00    1:21.60          9
                 38.10      1:21.60 (43.50)
  2 Perez, Juan      21 CAAQ              1:25.00    1:24.00          7
 Evento 85  Hombres 60-64 100 CL Metro Estilo de Mariposa FEDERADO
  1 Pereda, Pablo M  61 QAC               1:45.00    1:42.24          9
  4 Gomez, Ana       62 QAC               1:55.00    1:58.00          5
</pre>`;

test('fenaba: índice con fecha, pruebas y último evento', () => {
  const i = parseIndice(indice);
  assert.equal(i.fecha, '2026-11-07T12:00:00-03:00');
  assert.deepEqual(i.pruebas, ['261107F084.htm', '261107F085.htm']);
  assert.equal(i.ultimo, '261107lastevt.htm');
});

test('fenaba: puntaje por equipos sin confundir otros "Quilmes"', () => {
  const f = parsePuntajeEquipos(ultimo, (n) => /quilmes atl[eé]tico club/i.test(n));
  assert.equal(f.length, 7);
  assert.deepEqual(f.find((x) => x.esQuilmes), { pos: 5, equipo: 'Quilmes Atlético Club', pts: 180, esQuilmes: true });
  assert.equal(f.filter((x) => x.esQuilmes).length, 1, 'Club Argentino de Quilmes no cuenta');
});

test('fenaba: podios del club por categoría', () => {
  const r = parsePrueba(prueba, 'QAC');
  assert.equal(r.nadadas, 3);
  assert.deepEqual(r.podios, [
    { puesto: 1, nadador: 'Mangini, Luis G', prueba: 'Hombres 20-24 · 100 Mariposa', tiempo: '1:21.60' },
    { puesto: 1, nadador: 'Pereda, Pablo M', prueba: 'Hombres 60-64 · 100 Mariposa', tiempo: '1:42.24' },
  ]);
  assert.equal(nombrePrueba('Mujeres 50-54 200 CL Metro Estilo Pecho FEDERADOS'), 'Mujeres 50-54 · 200 Pecho');
});
