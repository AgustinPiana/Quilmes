import { test } from 'node:test';
import assert from 'node:assert/strict';
import { llaves, crucesDelClub, datosDelGrupo, club, equiposDeEntidad, torneoProlijo, mostrar } from '../scripts/sources/aat.js';

// Forma real del HTML de las llaves de deportivoaat.com.ar (mal formado a propósito: <h2> suelto).
const celda = (txt) => `<tr ><td class=llave> ${txt}</td></tr><tr ><td class=entreLlave>&nbsp;</td></tr>`;
const eq = (n, lado = '') => `<a href=../app/vEquipo.php?idEquipo=1>${n}</a>${lado ? ` (${lado})` : ''}`;
const gan = (n, lado, s) => `<a href=../app/vEquipo.php?idEquipo=1>${n}${lado ? ` (${lado})` : ''}</a><br/><a href=../app/vSerie.php?idSerie=9>Score: ${s} </a>`;
const ronda = (...c) => `<td><table align=center>${c.map(celda).join('')}</table></td>`;
const html = `<tr><td><h2> Llave Campeonato </h2></td></tr><table id=Campeonato><tr>
  ${ronda(eq('GIMNASIA-A'), 'Bye', eq('QUILMES ATLETICO-A', 'L'), eq('BANCO PROV.DE BS. AS.-A', 'V'))}
  ${ronda(eq('GIMNASIA-A', 'L'), gan('BANCO PROV.DE BS. AS.-A', 'V', '3-0'))}
  ${ronda(gan('GIMNASIA-A', '', '2-1'))}
</tr></table> Imprimir Todos los Grupos/Zonas`;

test('aat: nombre del club sin la letra del equipo', () => {
  assert.equal(club('QUILMES ATLETICO-A'), 'QUILMES ATLETICO');
  assert.equal(club('SOC.ITALIANA (SITAS)-A (V)'), 'SOC.ITALIANA (SITAS)');
});

test('aat: el score de la llave es del ganador (Quilmes local perdió 0-3)', () => {
  const ll = llaves(html);
  assert.deepEqual(ll.map((l) => [l.nombre, l.rondas.map((r) => r.length)]), [['Llave Campeonato', [4, 2, 1]]]);
  const c = crucesDelClub(ll, 'QUILMES ATLETICO-A');
  assert.equal(c.length, 1);
  assert.deepEqual(
    { local: c[0].local, visitante: c[0].visitante, esLocal: c[0].esLocal, gl: c[0].gl, gv: c[0].gv, ronda: c[0].ronda },
    { local: 'Quilmes', visitante: 'BANCO PROV.DE BS. AS.', esLocal: true, gl: 0, gv: 3, ronda: 'Llave Campeonato · Semifinal' },
  );
});

test('aat: tabla y series del grupo (números como texto o número)', () => {
  const d = datosDelGrupo({
    posiciones: [{ equipo: 'QUILMES ATLETICO-A', puntos: 11, seriesJugadas: '6', seriesGanadas: 5, difSet: '+15', difGame: '+49' }],
    series: [
      { Grupo: 'D', fec: '2026-03-15', Hora: '12:30', nombreEntL: 'LUJAN TENNIS CLUB', nombreEqL: 'A', nombreEntV: 'QUILMES ATLETICO', nombreEqV: 'A', puntosL: '2', puntosV: '1', wo: '0' },
      { Grupo: 'D', fec: '2026-03-15', Hora: '12:30', nombreEntL: 'COMERCIO', nombreEqL: 'A', nombreEntV: 'QUILMES ATLETICO', nombreEqV: 'B', puntosL: '1', puntosV: '2', wo: '0' },
    ],
  }, 'QUILMES ATLETICO-A', 'D');
  assert.deepEqual(d.filas[0], { pos: 1, equipo: 'Quilmes', pts: 11, pj: 6, pg: 5, pp: 1, dif: 15, dg: 49, esQuilmes: true });
  assert.equal(d.partidos.length, 1, 'la serie del equipo B no es del A');
  assert.deepEqual(
    { fecha: d.partidos[0].fecha, esLocal: d.partidos[0].esLocal, gl: d.partidos[0].gl, gv: d.partidos[0].gv, jugado: d.partidos[0].jugado },
    { fecha: '2026-03-15T12:30:00-03:00', esLocal: false, gl: 2, gv: 1, jugado: true },
  );
});

test('aat: equipos del club desde la página de la entidad', () => {
  const fila = (eq, comp, q) => `<tr><td></td><td><a href=../app/vEquipo.php?idEquipo=1&idTorneo=${q[0]}&idCategoria=${q[1]}&idNivel=${q[2]}>${eq}</a></td><td></td><td>${comp}</td></tr>`;
  const html = [
    '<tr><td>27-11-2026</td><td><a href=../app/vEquipo.php?idEquipo=1&idTorneo=152&idCategoria=23&idNivel=1>QUILMES ATLETICO-A</a></td><td><a href=../app/vEquipo.php?idEquipo=2&idTorneo=152&idCategoria=23&idNivel=1>HARRODS-A</a></td></tr>',
    fila('QUILMES ATLETICO-B', 'Interclub Mayores - Agosto2026-Caballeros +65-Segunda (2026)', [152, 83, 2]),
    fila('QUILMES ATLETICO-A', 'Interclubes por edad 2026 1er Cuat-Caballeros +40-Segunda (2026)', [147, 96, 2]),
  ].join('');
  const e = equiposDeEntidad(html);
  assert.equal(e.length, 2, 'la fila de próximo partido (dos equipos) no cuenta');
  assert.deepEqual(e[0], { idEquipo: 1, idTorneo: 152, idCategoria: 83, idNivel: 2, equipo: 'QUILMES ATLETICO-B', anio: 2026, torneo: 'Interclub Mayores - Agosto2026', categoria: 'Caballeros +65', nivel: 'Segunda' });
  assert.equal(torneoProlijo(e[0].torneo), 'Interclub Mayores · Agosto 2026');
  assert.equal(torneoProlijo(e[1].torneo), 'Interclubes por edad 2026 1er cuatrimestre');
  assert.equal(mostrar('QUILMES ATLETICO-B', 'QUILMES ATLETICO'), 'Quilmes B');
});
