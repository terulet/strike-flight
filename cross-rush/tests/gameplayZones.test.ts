import { describe, expect, it } from 'vitest';
import { RaceManager } from '../src/gameplay/RaceManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { computeGameplayZones } from '../src/gameplay/GameplayZones';
import { InputState } from '../src/input/InputManager';
import { SIM_DT, BikeConfig, SuspensionConfig, GameplayZoneConfig } from '../src/config/GameConfig';

function neutralInput(): InputState {
  return { throttle: false, brake: false, lean: 0, restartPressed: false };
}

function driveToRacing(race: RaceManager): void {
  race.begin();
  while (race.state === 'COUNTDOWN') {
    race.step(SIM_DT, neutralInput());
  }
}

const restHeight = BikeConfig.comHeight + (SuspensionConfig.front.restLength + SuspensionConfig.rear.restLength) / 2;

describe('GameplayZones (piezas de riesgo/recompensa)', () => {
  it('coloca las 3 zonas detectables en un orden coherente con la pista', () => {
    const track = buildCanyonRun();
    const zones = computeGameplayZones(track);

    expect(zones.speedPad).not.toBeNull();
    expect(zones.riskGap).not.toBeNull();
    expect(zones.flowRing).not.toBeNull();
    expect(zones.altRamp).not.toBeNull();
    expect(zones.bumpGate).not.toBeNull();

    const technicalX = track.labels.find((l) => l.name === 'TECHNICAL')!.x;
    const uphillX = track.labels.find((l) => l.name === 'UPHILL')!.x;
    const riskLineX = track.labels.find((l) => l.name === 'RISK_LINE_JUMP')!.x;
    const megaJumpX = track.labels.find((l) => l.name === 'MEGA_JUMP')!.x;

    expect(zones.speedPad!.x).toBeGreaterThan(uphillX);
    expect(zones.riskGap!.startX).toBeCloseTo(riskLineX, 9);
    expect(zones.riskGap!.endX).toBeGreaterThan(zones.riskGap!.startX);
    expect(zones.flowRing!.x).toBeGreaterThan(megaJumpX);
    expect(zones.flowRing!.radius).toBeGreaterThan(0);
    expect(zones.bumpGate!.x).toBeGreaterThan(technicalX);
    expect(zones.altRamp!.x).toBeGreaterThan(uphillX);
  });

  it('speed_pad: da un empujon de velocidad y de FLOW una unica vez al pisarlo', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    driveToRacing(race);

    const pad = race.gameplayZones.speedPad!;
    race.bike.x = pad.x - 0.02;
    race.bike.y = track.terrain.surfaceY(race.bike.x) + restHeight;
    race.bike.vx = 5;
    race.bike.vy = 0;
    race.bike.angle = 0;
    race.bike.angularVelocity = 0;

    const flowBefore = race.flow.value;
    race.step(SIM_DT, neutralInput());

    expect(race.bike.x).toBeGreaterThanOrEqual(pad.x);
    // La fisica de suspension/pendiente absorbe algo del empujon en el mismo
    // tick (el pad esta al principio de la subida), asi que comprobamos que
    // se nota con claridad en vez de exigir el valor exacto del boost.
    expect(race.bike.vx).toBeGreaterThan(5 + GameplayZoneConfig.speedPad.boostVx * 0.5);
    expect(race.flow.value).toBeGreaterThanOrEqual(flowBefore + GameplayZoneConfig.speedPad.flowBonus - 0.1);

    // No debe volver a activarse en el mismo intento aunque se vuelva a cruzar la x.
    const vxAfterFirstHit = race.bike.vx;
    race.bike.x = pad.x - 0.02;
    race.bike.vx = 5;
    race.step(SIM_DT, neutralInput());
    expect(race.bike.vx).toBeLessThan(vxAfterFirstHit + 0.5);
  });

  it('flow_ring: solo da bonus si se atraviesa dentro de la tolerancia vertical', () => {
    const track = buildCanyonRun();

    const raceHit = new RaceManager(track);
    driveToRacing(raceHit);
    const ring = raceHit.gameplayZones.flowRing!;
    raceHit.bike.x = ring.x - 0.05;
    raceHit.bike.y = ring.y;
    raceHit.bike.vx = 8;
    raceHit.bike.vy = 0;
    const flowBeforeHit = raceHit.flow.value;
    raceHit.step(SIM_DT, neutralInput());
    expect(raceHit.flow.value).toBeGreaterThanOrEqual(flowBeforeHit + GameplayZoneConfig.flowRing.flowBonus - 0.5);
    // Acertar el aro no solo suma FLOW: tambien concede el refuerzo de
    // REDLINE aunque el medidor no llegue a 100 por acumulacion normal (ver
    // FlowMeter.extendRedline) -es la "recompensa" real de la pieza.
    expect(raceHit.flow.isRedline).toBe(true);

    const raceMiss = new RaceManager(track);
    driveToRacing(raceMiss);
    const ringMiss = raceMiss.gameplayZones.flowRing!;
    raceMiss.bike.x = ringMiss.x - 0.05;
    raceMiss.bike.y = ringMiss.y + ringMiss.radius + 20; // muy lejos verticalmente: no cuenta como acierto
    raceMiss.bike.vx = 8;
    raceMiss.bike.vy = 0;
    const flowBeforeMiss = raceMiss.flow.value;
    raceMiss.step(SIM_DT, neutralInput());
    expect(raceMiss.flow.value).toBeLessThan(flowBeforeMiss + 1); // como mucho la ganancia pasiva de un tick, nunca el bonus
  });

  it('risk_gap: saltar el hueco entero da bonus de FLOW al aterrizar mas alla de la linea segura', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    driveToRacing(race);

    const gap = race.gameplayZones.riskGap!;
    // Simula un salto ya en vuelo que aterriza justo despues de la linea segura.
    race.bike.x = gap.endX - 0.5;
    race.bike.y = track.terrain.surfaceY(gap.endX) + 3;
    race.bike.vx = 10;
    race.bike.vy = -6;
    race.bike.angle = 0;
    race.bike.angularVelocity = 0;

    const flowBefore = race.flow.value;
    let awarded = false;
    for (let i = 0; i < 200 && race.state === 'RACING'; i++) {
      race.step(SIM_DT, neutralInput());
      if (race.flow.value >= flowBefore + GameplayZoneConfig.riskGap.flowBonus - 1) {
        awarded = true;
        break;
      }
    }
    expect(awarded).toBe(true);
  });
});
