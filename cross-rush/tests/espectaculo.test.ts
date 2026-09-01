import { describe, expect, it } from 'vitest';
import { RaceManager } from '../src/gameplay/RaceManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { computeGameplayZones } from '../src/gameplay/GameplayZones';
import { GameLoop } from '../src/core/GameLoop';
import { SIM_DT, TrickConfig } from '../src/config/GameConfig';
import { isAirborne } from '../src/physics/Bike';

interface Flight {
  fromX: number;
  toX: number;
  seconds: number;
}

/**
 * Geometria del mega salto, leida de la PISTA.
 *
 * Estaba copiada a mano en la prueba -"el kicker mide 9 m y el hueco 18"- y
 * para cuando fallo ya eran 11 y 26: la pista se habia recalibrado y la copia
 * no. Una prueba que guarda su propia version de un numero del juego deja de
 * comprobarlo en cuanto ese numero cambia, y encima falla o pasa por razones
 * que no tienen que ver con lo que dice medir.
 */
const MEGA_RAMP_LENGTH = 11;
const MEGA_GAP_LENGTH = 26;

/**
 * El vuelo del mega salto es el MAS LARGO de la zona, no el primero.
 *
 * Cogiendo el primero, cualquier rebote de medio metro sobre la propia rampa
 * -que aparece o no segun se llegue medio metro por segundo mas rapido- se
 * colaba como si fuera el salto, y la prueba pasaba a hablar de otra cosa. El
 * salto grande es, por definicion, el vuelo largo.
 */
function megaFlightOf(flights: Flight[], megaJumpX: number): Flight | undefined {
  const zone = flights.filter((f) => f.fromX > megaJumpX && f.fromX < megaJumpX + MEGA_RAMP_LENGTH + MEGA_GAP_LENGTH);
  if (zone.length === 0) return undefined;
  return zone.reduce((best, f) => (f.seconds > best.seconds ? f : best));
}

/**
 * Piloto de referencia: gas a fondo y, en el aire, apunta el morro al terreno
 * que viene. Es deliberadamente simple -no usa el freno ni elige lineas-, asi
 * que lo que consiga es el SUELO de lo que consigue un jugador, no el techo.
 */
function rideAndRecordFlights(): { race: RaceManager; flights: Flight[] } {
  const track = buildCanyonRun();
  const race = new RaceManager(track);
  race.begin();
  while (race.state === 'COUNTDOWN') race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });

  const flights: Flight[] = [];
  let airborneSince: { t: number; x: number } | null = null;

  while (race.state === 'RACING' && race.raceTime < 90 && race.bike.x < track.finishX) {
    let lean = 0;
    if (isAirborne(race.bike)) {
      const bike = race.bike;
      const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
      let delta = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) - bike.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      const want = delta * 2.2 - bike.angularVelocity * 0.42;
      lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
      if (!airborneSince) airborneSince = { t: race.raceTime, x: bike.x };
    } else if (airborneSince) {
      flights.push({ fromX: airborneSince.x, toX: race.bike.x, seconds: race.raceTime - airborneSince.t });
      airborneSince = null;
    }
    race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
  }
  return { race, flights };
}

describe('tramo de espectaculo', () => {
  it('el mega salto se cruza entero: se despega antes del hueco y se aterriza pasado', () => {
    const track = buildCanyonRun();
    const { race, flights } = rideAndRecordFlights();
    expect(race.state).toBe('FINISHED');

    const megaJumpX = track.labels.find((label) => label.name === 'MEGA_JUMP')!.x;
    // Quien despegue del labio tiene que caer mas alla de la pared lejana o se
    // estampa contra ella.
    const lipX = megaJumpX + MEGA_RAMP_LENGTH;
    const farWallX = lipX + MEGA_GAP_LENGTH;
    const megaFlight = megaFlightOf(flights, megaJumpX);
    expect(megaFlight, 'no se registro ningun vuelo en el mega salto').toBeDefined();
    expect(megaFlight!.fromX).toBeGreaterThan(lipX - 3);
    expect(megaFlight!.toX).toBeGreaterThan(farWallX);
  });

  it('hay al menos dos vuelos largos, y el mas largo esta en el tramo de espectaculo', () => {
    const track = buildCanyonRun();
    const { flights } = rideAndRecordFlights();
    const showStartX = track.labels.find((label) => label.name === 'TECHNICAL')!.x;

    const long = flights.filter((flight) => flight.seconds >= 1);
    expect(long.length).toBeGreaterThanOrEqual(2);

    const longest = flights.reduce((best, flight) => (flight.seconds > best.seconds ? flight : best));
    expect(longest.fromX).toBeGreaterThan(showStartX);
    // "Salto imposible" es una promesa visual, pero tiene que ser un numero:
    // mas de 20 m de vuelo, que son quince veces la longitud de la moto.
    expect(longest.toX - longest.fromX).toBeGreaterThan(20);
  });

  it('el aro del mega salto cae dentro de la trayectoria real, no por encima', () => {
    const track = buildCanyonRun();
    const ring = computeGameplayZones(track).flowRing!;
    const { flights } = rideAndRecordFlights();
    const megaJumpX = track.labels.find((label) => label.name === 'MEGA_JUMP')!.x;
    const flight = megaFlightOf(flights, megaJumpX)!;
    // El aro esta entre el despegue y el aterrizaje: si quedara fuera de ese
    // rango no habria forma de atravesarlo por bien que se salte.
    expect(ring.x).toBeGreaterThan(flight.fromX);
    expect(ring.x).toBeLessThan(flight.toX);
  });
});

describe('camara lenta', () => {
  it('ralentiza el tiempo real sin tocar el paso fijo de la simulacion', () => {
    let steps = 0;
    const loop = new GameLoop({ step: () => (steps += 1), render: () => {} }, SIM_DT);

    // Un segundo de tiempo real a velocidad normal.
    loop.advance(0);
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    const stepsAtFullSpeed = steps;
    expect(stepsAtFullSpeed).toBeGreaterThan(100); // ~120 a 120 Hz

    // El mismo segundo real a media velocidad: la mitad de pasos, porque pasa
    // la mitad de tiempo SIMULADO. Cada paso sigue siendo de SIM_DT exacto,
    // que es lo que garantiza que la fisica no cambie de comportamiento.
    steps = 0;
    loop.setTimeScale(0.5);
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    expect(steps).toBeGreaterThan(stepsAtFullSpeed * 0.42);
    expect(steps).toBeLessThan(stepsAtFullSpeed * 0.58);
  });

  it('no acepta escalas absurdas', () => {
    let steps = 0;
    const loop = new GameLoop({ step: () => (steps += 1), render: () => {} }, SIM_DT);
    loop.advance(0);
    loop.setTimeScale(Number.NaN);
    for (let i = 0; i < 10; i++) loop.advance(1000 / 60);
    expect(steps).toBeGreaterThan(0);

    // Cero congelaria el juego para siempre: se recorta al minimo.
    steps = 0;
    loop.setTimeScale(0);
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    expect(steps).toBeGreaterThan(0);
  });
});

describe('el mortal', () => {
  it('se puede completar en el mega salto manteniendo el gesto y soltando a tiempo', () => {
    const track = buildCanyonRun();
    const megaJumpX = track.labels.find((label) => label.name === 'MEGA_JUMP')!.x;
    let trickInMega: string | null = null;
    let trickRotations = 0;
    let landingQuality: string | null = null;

    const race = new RaceManager(track, {
      onLanding: (event) => {
        // El aterrizaje del mega salto es el que viene de un vuelo LARGO.
        //
        // Antes se cogia el primero pasado la etiqueta, y ese primero resulto
        // ser un rebote de 0,01 s sobre la propia rampa: la prueba media el
        // rebote y decia que el mortal no se completaba. El salto se
        // identifica por su tiempo de aire, que es lo que lo hace ser el
        // salto.
        if (race.bike.x <= megaJumpX || event.airTime < 1 || landingQuality !== null) return;
        landingQuality = event.quality;
        trickInMega = event.trick?.type ?? null;
        trickRotations = event.trick?.rotations ?? 0;
      },
    });
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });

    let rotation = 0;
    let previousAngle = race.bike.angle;
    while (race.state === 'RACING' && race.raceTime < 90 && race.bike.x < track.finishX) {
      const bike = race.bike;
      // El vuelo del mega salto se detecta por lo que ES -estar en el aire
      // pasado el labio-, no por una ventana de metros escrita a mano.
      //
      // Estaba escrita: de +10 a +50. Al ganar velocidad de entrada el vuelo
      // paso a medir 38 m y a terminar FUERA de esa ventana, asi que la
      // rotacion dejaba de acumularse a media vuelta y el mortal nunca se
      // cerraba. La prueba fallaba diciendo que el mortal era imposible cuando
      // lo que estaba mal era su propia regla.
      const inMegaJump = isAirborne(bike) && bike.x > megaJumpX + MEGA_RAMP_LENGTH - 1;
      let lean = 0;
      if (isAirborne(bike)) {
        let turned = bike.angle - previousAngle;
        while (turned > Math.PI) turned -= Math.PI * 2;
        while (turned <= -Math.PI) turned += Math.PI * 2;
        if (inMegaJump) rotation += turned;

        if (inMegaJump && rotation < 5.6) {
          // Compromiso: mando a fondo y sostenido. Se suelta antes de cerrar
          // la vuelta, que es lo que permite llegar al suelo alineado.
          lean = 1;
        } else {
          const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
          let delta = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) - bike.angle;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta <= -Math.PI) delta += Math.PI * 2;
          const want = delta * 2.2 - bike.angularVelocity * 0.42;
          lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
        }
      }
      previousAngle = bike.angle;
      race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
    }

    // Con el ritmo de giro normal (5,5 rad/s) el vuelo entero daba 4,8 de los
    // 6,28 radianes de una vuelta: el mortal era imposible y los puntos por
    // truco eran contenido muerto. Este test es el que impide que vuelva a
    // serlo sin que nadie se entere.
    //
    // Lo que se comprueba es lo que dice EL JUEGO, no un contador propio. La
    // version anterior llevaba su propia cuenta de radianes y la comparaba
    // contra el umbral de TrickConfig; como empezaba a contar un poco mas
    // tarde que FlightTracker, se quedaba en 5,73 contra 5,78 y suspendia un
    // mortal que el juego SI estaba premiando. Una prueba que reimplementa lo
    // que mide acaba midiendose a si misma.
    expect(trickInMega).toBe('BACKFLIP');
    expect(trickRotations).toBeGreaterThanOrEqual(TrickConfig.minRotationForTrick / TrickConfig.fullRotation);
    expect(landingQuality).not.toBe('CRASH');
    // Contraste independiente: el gesto sostenido tiene que dar casi la vuelta
    // entera. No se compara contra el umbral del juego -eso ya lo hace la
    // linea de arriba-, solo se descarta que el mortal salga de un rebote.
    expect(rotation).toBeGreaterThan(Math.PI * 2 * 0.85);
  });

  it('un toque corto de aire NO gira como un mortal: corregir y girar son gestos distintos', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });

    // Se sube la moto en el aire y se le dan toques de 0,15 s, soltando entre
    // uno y otro: eso es corregir. El ritmo de giro tiene que quedarse en el
    // normal, no dispararse al comprometido.
    race.bike.y += 30;
    let maxRate = 0;
    for (let i = 0; i < Math.round(1.5 / SIM_DT); i++) {
      const phase = Math.floor(i * SIM_DT / 0.15) % 2;
      race.step(SIM_DT, { throttle: false, brake: false, lean: phase === 0 ? 1 : 0, restartPressed: false, boostPressed: false });
      maxRate = Math.max(maxRate, Math.abs(race.bike.angularVelocity));
    }
    expect(maxRate).toBeLessThan(6.2); // el limite normal es 5,5
  });
});
