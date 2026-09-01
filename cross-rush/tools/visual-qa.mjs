/**
 * visual-qa.mjs
 *
 * QA visual de la BUILD REAL, en un navegador real. El mandato es explicito:
 * esto no se cierra con tests verdes, se cierra demostrando que se ven las
 * ruedas girar, el piloto reaccionar, la suspension y la transferencia de peso
 * trabajar, y el render fluir sin microtirones.
 *
 * No sustituye a los tests. Los tests miden la simulacion en Node; esto mide
 * lo que llega de verdad a la pantalla despues de pasar por el bundle, el
 * canvas, la carga de sprites y el bucle de rAF del navegador.
 *
 * Como juega: dentro de la pagina corre un piloto automatico que despacha
 * eventos de teclado reales sobre `window`, exactamente los mismos que
 * escucha KeyboardInput. Mantiene el gas, corrige el cabeceo en el aire y
 * reinicia si se estrella, para que las medidas se tomen sobre una moto viva y
 * no sobre una carrera que termino en el primer salto. El arnes le pide gestos
 * concretos -frena aqui, echate atras aqui- y graba el estado dibujado
 * fotograma a fotograma a traves del gancho de solo lectura
 * `window.__crossRushFrame`.
 *
 * Deja capturas y video en artifacts/qa/ y un informe en INFORME.txt.
 *
 * Uso:  node tools/visual-qa.mjs [URL]
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * El entorno trae Chromium preinstalado en PLAYWRIGHT_BROWSERS_PATH, pero su
 * numero de build no tiene por que coincidir con el que espera la version de
 * playwright del proyecto. Si el binario esperado no esta, se usa el que hay
 * en vez de descargar 150 MB.
 */
function resolveChromium() {
  const candidates = [
    process.env.CROSSRUSH_CHROMIUM,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

const BASE_URL = process.argv[2] ?? 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve('artifacts/qa');
/**
 * Radio de rueda de reserva. El valor bueno llega del juego
 * (`window.__crossRushTrack.wheelRadius`); esta constante solo cubre una build
 * antigua que aun no lo publique. Estaba copiada a mano y se quedo en 0.28
 * cuando el radio se recalibro a partir del arte, asi que el informe acusaba
 * al juego de perder un 25% del giro que en realidad si daba.
 */
const FALLBACK_WHEEL_RADIUS = 0.3633;
/** Paso fijo de simulacion del juego (SIM_HZ = 120). */
const SIM_DT = 1 / 120;

const PROFILES = [
  { name: 'escritorio-1366x768', viewport: { width: 1366, height: 768 }, hasTouch: false, deviceScaleFactor: 1 },
  { name: 'movil-393x852', viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

const failures = [];
const notes = [];

function check(profile, label, condition, detail) {
  const line = `${condition ? 'OK   ' : 'FALLA'} [${profile}] ${label}${detail ? ` — ${detail}` : ''}`;
  notes.push(line);
  console.log(line);
  if (!condition) failures.push(`[${profile}] ${label}: ${detail ?? ''}`);
}

function info(profile, label, detail) {
  const line = `INFO  [${profile}] ${label}${detail ? ` — ${detail}` : ''}`;
  notes.push(line);
  console.log(line);
}

/**
 * Piloto automatico, inyectado en la pagina.
 *
 * Despacha KeyboardEvent reales sobre `window`, que es exactamente lo que
 * escucha `KeyboardInput`: pasa por el mismo camino que un jugador, incluido
 * el suavizado de entrada. Expone `window.__qa` para que el arnes le pida
 * gestos concretos y le pregunte por lo que ha visto.
 */
function installPilot() {
  const held = new Set();
  const keyEvent = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const setKey = (code, down) => {
    if (down && !held.has(code)) {
      held.add(code);
      keyEvent('keydown', code);
    } else if (!down && held.has(code)) {
      held.delete(code);
      keyEvent('keyup', code);
    }
  };

  const qa = {
    /** 'throttle' | 'brake' | 'coast' */
    drive: 'throttle',
    /** null = deja al piloto corregir en el aire; -1/0/1 = fuerza ese gesto. */
    forceLean: null,
    /** Reinicia solo tras estrellarse. */
    autoRestart: true,
    crashes: 0,
    restarts: 0,
    /** Marcas de tiempo (ms) del ultimo cambio de estado, para el informe. */
    lastState: null,
    lastError: null,
    stop: false,
  };

  let wasCrashed = false;
  let restartCooldown = 0;

  const tick = () => {
    if (qa.stop) return;
    try {
      pilotStep();
    } catch (error) {
      // Si un tick falla y no se recoge, el bucle muere en silencio y el
      // arnes se queda esperando a una moto que ya no conduce nadie.
      qa.lastError = String(error);
    }
    requestAnimationFrame(tick);
  };

  const pilotStep = () => {
    const frame = window.__crossRushFrame;
    if (frame) {
      if (frame.state !== qa.lastState) qa.lastState = frame.state;

      const crashed = frame.state === 'CRASHED' || frame.state === 'FINISHED';
      if (crashed && !wasCrashed) {
        if (frame.state === 'CRASHED') qa.crashes += 1;
        restartCooldown = 25;
      }
      wasCrashed = crashed;

      if (crashed) {
        setKey('ArrowRight', false);
        setKey('ArrowLeft', false);
        setKey('ArrowUp', false);
        setKey('ArrowDown', false);
        if (qa.autoRestart && restartCooldown-- <= 0) {
          setKey('KeyR', true);
          setTimeout(() => setKey('KeyR', false), 40);
          qa.restarts += 1;
          restartCooldown = 90;
        }
      } else {
        setKey('ArrowRight', qa.drive === 'throttle');
        // Gasta el turbo en cuanto esta listo. Sin esto el REDLINE no ocurre
        // nunca en las pasadas automaticas, y la llamarada del escape y las
        // lineas de velocidad se quedarian sin cubrir por el QA.
        if (window.__crossRushFrame?.boostReady) {
          keyEvent('keydown', 'Space');
          keyEvent('keyup', 'Space');
        }
        setKey('ArrowLeft', qa.drive === 'brake');

        let lean = 0;
        if (qa.forceLean !== null) {
          lean = qa.forceLean;
        } else {
          const airborne = !frame.frontContact && !frame.rearContact;
          if (airborne) {
            // Apuntar la moto a la pendiente que viene, frenando la propia
            // rotacion: un P+D, que es lo que hace un jugador sin darse cuenta.
            const targetAngle = window.__qaTargetSlope ? window.__qaTargetSlope(frame) : 0;
            let delta = targetAngle - frame.angle;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta <= -Math.PI) delta += Math.PI * 2;
            const want = delta * 2.2 - frame.angularVelocity * 0.42;
            lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
          }
        }
        setKey('ArrowUp', lean > 0);
        setKey('ArrowDown', lean < 0);
      }
    }
  };
  requestAnimationFrame(tick);

  // El piloto necesita la pendiente del terreno que tiene delante. No hay
  // acceso al terreno desde fuera del bundle, asi que se estima con la propia
  // trayectoria: apuntar la moto a la direccion en la que se esta moviendo es
  // una aproximacion honesta de "aterriza alineado".
  window.__qaTargetSlope = (frame) => {
    // Con la moto casi parada -la caida inicial desde la parrilla, por
    // ejemplo- la direccion del movimiento es "hacia abajo" y apuntar la moto
    // ahi es clavarla de morro. Sin velocidad horizontal, lo que quiere
    // cualquiera es nivelar.
    if (Math.abs(frame.vx) < 3) return 0;
    // Mirar la pendiente del terreno donde se va a aterrizar, que es lo que
    // hace un jugador. El horizonte crece con la velocidad.
    const track = window.__crossRushTrack;
    if (track?.surfaceSlope) {
      const ahead = frame.x + Math.max(2, Math.abs(frame.vx) * 0.32);
      return Math.max(-0.9, Math.min(0.9, Math.atan(track.surfaceSlope(ahead))));
    }
    return Math.max(-0.9, Math.min(0.9, Math.atan2(frame.vy, Math.abs(frame.vx))));
  };
  window.__qa = qa;
}

const airborne = (frame) => !frame.frontContact && !frame.rearContact;
const racing = (frames) => frames.filter((f) => f.state === 'RACING');
const range = (frames, key) => {
  const values = frames.map((f) => f[key]);
  return { min: Math.min(...values), max: Math.max(...values) };
};

/** Graba un fotograma por rAF durante `ms` milisegundos. */
async function recordFrames(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const samples = [];
        const started = performance.now();
        const tick = () => {
          const frame = window.__crossRushFrame;
          if (frame) samples.push({ ...frame, wall: performance.now() - started });
          if (performance.now() - started < duration) requestAnimationFrame(tick);
          else resolve(samples);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

/**
 * Graba hasta reunir al menos `minFrames` fotogramas EN CARRERA. Si la ventana
 * cae entera dentro de un choque -que pasa, y es normal- vuelve a intentarlo
 * cuando el piloto ha reiniciado, en vez de devolver una lista vacia y sacar
 * un NaN por informe.
 */
async function recordRacingFrames(page, ms, minFrames = 12, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await page
      .waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 })
      .catch(() => {});
    const all = await recordFrames(page, ms);
    const frames = racing(all);
    if (frames.length >= minFrames) return frames;
    if (process.env.QA_DEBUG) {
      const counts = {};
      for (const f of all) counts[f.state] = (counts[f.state] ?? 0) + 1;
      console.log('DEBUG recordRacingFrames', attempt, 'total', all.length, JSON.stringify(counts));
    }
  }
  return [];
}

/**
 * Mide la transferencia de carga por el cuerpo esperando expresamente a tener
 * las dos ruedas en el suelo. Se usa cuando la ventana normal cae en un tramo
 * aereo largo -pasa, la pista tiene saltos encadenados-.
 */
async function measureBodyLoadTransfer(page, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Sin gas y sobre el llano de salida: las dos ruedas apoyadas y quietas.
    // Asi lo unico que mueve la carga es el peso del piloto, que es justo lo
    // que se quiere medir; con gas, la moto salta y no hay eje que medir.
    await page.evaluate(() => {
      window.__qa.drive = 'coast';
      window.__qa.forceLean = 0;
    });
    await page
      .waitForFunction(
        () => {
          const f = window.__crossRushFrame;
          return f && f.state === 'RACING' && f.frontContact && f.rearContact && Math.abs(f.vx) < 4;
        },
        null,
        { timeout: 15000 },
      )
      .catch(() => {});

    const result = {};
    for (const [key, lean] of [['back', 1], ['forward', -1]]) {
      await setLean(page, lean);
      await page.waitForTimeout(450); // que el muelle del cuerpo llegue al sitio
      const frames = (await recordFrames(page, 400)).filter(
        (f) => f.state === 'RACING' && f.frontContact && f.rearContact,
      );
      result[key] = frames.map((f) => f.frontLoad);
    }
    await setLean(page, null);
    await page.evaluate(() => (window.__qa.drive = 'throttle'));
    if ((result.back?.length ?? 0) >= 5 && (result.forward?.length ?? 0) >= 5) {
      const avg = (values) => values.reduce((a, b) => a + b, 0) / values.length;
      return { back: avg(result.back), forward: avg(result.forward) };
    }
  }
  await setLean(page, null);
  await page.evaluate(() => (window.__qa.drive = 'throttle'));
  return null;
}

/**
 * Mide una frenada de verdad: espera a tener velocidad y las DOS ruedas en el
 * suelo, guarda como estaba la moto, frena, y se queda solo con los
 * fotogramas que siguen apoyados. Sin esto, la ventana de medida cae a menudo
 * en pleno salto y se acaba comparando la horquilla de un aterrizaje contra
 * la de un vuelo, que no dice nada de la frenada.
 */
async function measureBraking(page, attempts = 6) {
  const track = await page.evaluate(() => window.__crossRushTrack);
  const firstFeatureX = Math.min(...track.features.map((f) => f.startX));

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Se mide en la recta de salida, antes de la primera pieza de terreno.
    // Es el unico tramo de la pista donde se puede garantizar que la moto va
    // con las dos ruedas en el suelo y la suspension asentada; mas adelante
    // encadena saltos y la ventana de medida cae casi siempre en pleno vuelo,
    // que es comparar la horquilla de un aterrizaje con la de un vuelo.
    await page.keyboard.press('KeyR');
    await page
      .waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 })
      .catch(() => {});
    await setDrive(page, 'throttle');
    await setLean(page, 0);

    const reached = await page
      .waitForFunction(
        (limit) => {
          const f = window.__crossRushFrame;
          return f && f.state === 'RACING' && f.vx > 9 && f.x < limit && f.frontContact && f.rearContact;
        },
        firstFeatureX - 4,
        { timeout: 12000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!reached) continue;

    const beforeWindow = (await recordFrames(page, 150)).filter(
      (f) => f.state === 'RACING' && f.frontContact && f.rearContact,
    );
    if (beforeWindow.length < 4) continue;
    const beforeValues = beforeWindow.map((f) => f.frontCompression);
    const beforeCompression = beforeValues.reduce((a, b) => a + b, 0) / beforeValues.length;

    await setDrive(page, 'brake');
    const frames = (await recordFrames(page, 600)).filter(
      (f) => f.state === 'RACING' && f.frontContact && f.rearContact,
    );
    await setDrive(page, 'throttle');
    await setLean(page, null);
    if (frames.length >= 8) {
      return { before: { ...beforeWindow[beforeWindow.length - 1], frontCompression: beforeCompression }, frames };
    }
  }
  await setDrive(page, 'throttle');
  await setLean(page, null);
  return null;
}

const readFrame = (page) => page.evaluate(() => window.__crossRushFrame ?? null);
const setDrive = (page, mode) => page.evaluate((m) => (window.__qa.drive = m), mode);
const setLean = (page, lean) => page.evaluate((l) => (window.__qa.forceLean = l), lean);

/** Desenrolla una serie de angulos normalizados a (-PI, PI] y devuelve el giro total. */
function unwrapTotal(values) {
  let total = 0;
  for (let i = 1; i < values.length; i++) {
    let d = values[i] - values[i - 1];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d <= -Math.PI) d += Math.PI * 2;
    total += d;
  }
  return total;
}

async function runProfile(browser, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile ?? false,
    hasTouch: profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor,
    // El video es evidencia, no material de archivo: se graba a la mitad de
    // resolucion para que el clip quepa en el repositorio.
    recordVideo: {
      dir: path.join(OUT_DIR, 'video'),
      size: { width: Math.round(profile.viewport.width / 2), height: Math.round(profile.viewport.height / 2) },
    },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkFailures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) networkFailures.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    networkFailures.push(`fallo ${request.failure()?.errorText ?? '?'} ${request.url()}`);
  });

  // JPEG y no PNG: son 34 capturas por pasada y la evidencia tiene que poder
  // vivir en el repositorio sin engordarlo decenas de megas.
  const shot = async (name) => {
    await page.screenshot({
      path: path.join(OUT_DIR, `${profile.name}--${name}.jpg`),
      type: 'jpeg',
      quality: 72,
    });
  };

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.mouse.click(profile.viewport.width / 2, profile.viewport.height / 2);
  await page.waitForFunction(() => Boolean(window.__crossRushFrame), null, { timeout: 20000 });

  const track = await page.evaluate(() => window.__crossRushTrack);
  info(
    profile.name,
    'pista cargada',
    `${track.features.map((f) => `${f.kind} ${f.startX.toFixed(0)}-${f.endX.toFixed(0)}`).join(', ')}`,
  );

  await page.waitForTimeout(400);
  await shot('01-cuenta-atras');
  await page.waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 });
  await shot('02-salida-parado');

  // --- El piloto entra en escena ------------------------------------------
  await page.evaluate(installPilot);
  await page.evaluate(() => (window.__qa.drive = 'coast'));
  await page.waitForTimeout(120);

  // --- 1. RUEDAS GIRANDO ---------------------------------------------------
  await setDrive(page, 'throttle');
  const launchFrames = await recordRacingFrames(page, 2200, 40);
  await shot('03-acelerando-desde-parado');

  const totalRearSpin = unwrapTotal(launchFrames.map((f) => f.rearSpin));
  const totalFrontSpin = unwrapTotal(launchFrames.map((f) => f.frontSpin));
  const distance = launchFrames[launchFrames.length - 1].x - launchFrames[0].x;

  // La rueda delantera solo rueda "pura" mientras toca el suelo: en el aire
  // gira libre y pierde vueltas por el drag, asi que comparar el giro total
  // contra la distancia total mediria el vuelo, no la rodadura. Se acumulan
  // giro y avance solo en los tramos con la delantera apoyada.
  let groundedFrontSpin = 0;
  let groundedDistance = 0;
  for (let i = 1; i < launchFrames.length; i++) {
    if (!launchFrames[i].frontContact || !launchFrames[i - 1].frontContact) continue;
    groundedFrontSpin += unwrapTotal([launchFrames[i - 1].frontSpin, launchFrames[i].frontSpin]);
    groundedDistance += launchFrames[i].x - launchFrames[i - 1].x;
  }
  const wheelRadius = track.wheelRadius ?? FALLBACK_WHEEL_RADIUS;
  const expectedSpin = groundedDistance / wheelRadius;

  check(profile.name, 'las dos ruedas giran', Math.abs(totalRearSpin) > 20 && Math.abs(totalFrontSpin) > 20,
    `trasera ${totalRearSpin.toFixed(0)} rad, delantera ${totalFrontSpin.toFixed(0)} rad en ${launchFrames.length} fotogramas`);
  check(profile.name, 'giran en el sentido del avance', distance > 1 && totalRearSpin > 0 && totalFrontSpin > 0,
    `avance ${distance.toFixed(1)} m`);
  check(profile.name, 'el giro de la delantera corresponde a la distancia (rodadura pura, con la rueda apoyada)',
    groundedDistance > 5 && Math.abs(groundedFrontSpin - expectedSpin) / expectedSpin < 0.15,
    `${groundedDistance.toFixed(1)} m con la rueda en el suelo: giro ${groundedFrontSpin.toFixed(0)} rad, distancia/radio ${expectedSpin.toFixed(0)} rad`);
  const maxSlip = Math.max(...launchFrames.map((f) => f.rearSlip));
  check(profile.name, 'la trasera patina al salir de parado', maxSlip > 1,
    `deslizamiento maximo ${maxSlip.toFixed(2)} m/s`);
  const groundedLaunch = launchFrames.filter((f) => f.rearContact).map((f) => f.rearLoad).sort((a, b) => a - b);
  const medianRearLoad = groundedLaunch[Math.floor(groundedLaunch.length / 2)] ?? 0;
  check(profile.name, 'acelerar carga el eje trasero', medianRearLoad > 1.15,
    `carga trasera mediana x${medianRearLoad.toFixed(2)} del reparto estatico`);

  // --- 2. INTERPOLACION ----------------------------------------------------
  // Se mide sobre tramos con las ruedas en el suelo y sin choque: el avance
  // por fotograma tiene que ser uniforme. Sin interpolar, con la simulacion a
  // 120 Hz y la pantalla a 60, cada fotograma avanza 1 o 2 ticks segun donde
  // caiga, y eso se ve como una dispersion grande.
  const cruiseFrames = await recordRacingFrames(page, 2500, 40);
  const speeds = [];
  const alphas = [];
  for (let i = 1; i < cruiseFrames.length; i++) {
    const dt = (cruiseFrames[i].wall - cruiseFrames[i - 1].wall) / 1000;
    if (dt > 0.004 && dt < 0.05 && cruiseFrames[i].vx > 5) {
      speeds.push((cruiseFrames[i].x - cruiseFrames[i - 1].x) / dt);
      alphas.push(cruiseFrames[i].alpha);
    }
  }
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  // Prueba A/B directa: el juego publica las DOS series, la dibujada
  // (interpolada) y la del ultimo tick (que es exactamente lo que se dibujaba
  // antes). Para cada par de fotogramas se compara el avance de cada serie
  // contra la velocidad que dice la simulacion.
  //
  // Sin interpolar, con la pantalla y la simulacion a ritmos que no son
  // multiplos, unos fotogramas avanzan un tick entero y otros ninguno: el
  // avance dibujado se aparta muchisimo de la velocidad real. Eso es el
  // microtiron, y se mide. Como las dos series se miden con los mismos
  // tiempos, el ruido del reloj afecta igual a ambas y la comparacion es
  // justa.
  // El instante EXACTO al que corresponde cada fotograma dibujado sale del
  // reloj de la simulacion, no del reloj de pared: `t` es el tiempo del tick
  // actual y `alpha` la fraccion pendiente, asi que el estado dibujado
  // corresponde a t - (1 - alpha) * dt. Medir contra ese reloj elimina por
  // completo el ruido de `performance.now()`, que con el limite de fotogramas
  // liberado domina cualquier medida hecha entre fotogramas consecutivos.
  const simTime = (f) => f.t - (1 - f.alpha) * SIM_DT;
  const speedError = (key) => {
    const errors = [];
    for (let i = 1; i < cruiseFrames.length; i++) {
      const dt = simTime(cruiseFrames[i]) - simTime(cruiseFrames[i - 1]);
      const vx = cruiseFrames[i].vx;
      if (dt > 1e-4 && dt < 0.05 && vx > 6) {
        const drawn = (cruiseFrames[i][key] - cruiseFrames[i - 1][key]) / dt;
        errors.push(Math.abs(drawn - vx) / vx);
      }
    }
    errors.sort((a, b) => a - b);
    // El microtiron NO esta en el fotograma tipico: esta en el fotograma malo.
    // Sin interpolar, la mayoria de fotogramas recogen un tick y caen bien; el
    // salto lo dan los que recogen cero o dos. Por eso se mira el percentil 90
    // y no la mediana, que los esconde.
    return {
      median: errors[Math.floor(errors.length / 2)] ?? 1,
      p90: errors[Math.floor(errors.length * 0.9)] ?? 1,
      worst: errors[errors.length - 1] ?? 1,
      count: errors.length,
    };
  };
  const drawnError = speedError('x');
  const rawError = speedError('rawX');
  check(profile.name, 'los fotogramas malos desaparecen al interpolar',
    drawnError.p90 < rawError.p90 * 0.6,
    `percentil 90 del error sobre ${drawnError.count} fotogramas: dibujada ${(drawnError.p90 * 100).toFixed(1)}%, sin interpolar ${(rawError.p90 * 100).toFixed(1)}% (peor caso ${(drawnError.worst * 100).toFixed(0)}% vs ${(rawError.worst * 100).toFixed(0)}%)`);
  check(profile.name, 'el avance dibujado es fiel a la velocidad simulada',
    drawnError.median < 0.2,
    `error mediano ${(drawnError.median * 100).toFixed(1)}%`);

  info(profile.name, 'velocidad media en el tramo medido', `${meanSpeed.toFixed(1)} m/s`);

  const partialAlphas = alphas.filter((a) => a > 0.05 && a < 0.95);
  check(profile.name, 'el alpha de interpolacion toma valores intermedios de verdad',
    partialAlphas.length > alphas.length * 0.3,
    `${partialAlphas.length} de ${alphas.length} fotogramas con alpha intermedio (min ${Math.min(...alphas).toFixed(2)}, max ${Math.max(...alphas).toFixed(2)})`);
  await shot('04-en-marcha');

  // --- 3. FRENADA: SUSPENSION Y TRANSFERENCIA DE PESO ----------------------
  // Se espera a tener las dos ruedas en el suelo y velocidad, para medir la
  // frenada y no un aterrizaje.
  const braking = await measureBraking(page);
  await shot('05-frenando');
  check(profile.name, 'se ha podido medir una frenada con las dos ruedas en el suelo', braking !== null,
    braking === null ? 'no se logro en los intentos disponibles' : `${braking.frames.length} fotogramas apoyados`);
  const beforeBraking = braking?.before ?? (await readFrame(page));
  const brakingFrames = braking?.frames ?? [];

  if (brakingFrames.length > 0) {
    const frontCompression = range(brakingFrames, 'frontCompression');
    const frontLoad = range(brakingFrames, 'frontLoad');
    const rearLoad = range(brakingFrames, 'rearLoad');
    const riderX = range(brakingFrames, 'riderShiftX');
    check(profile.name, 'frenar hunde la horquilla', frontCompression.max > beforeBraking.frontCompression + 0.02,
      `antes ${beforeBraking.frontCompression.toFixed(3)} m -> frenando ${frontCompression.max.toFixed(3)} m`);
    check(profile.name, 'frenar transfiere carga del eje trasero al delantero',
      frontLoad.max > 1.1 && rearLoad.min < 0.9,
      `carga delantera hasta x${frontLoad.max.toFixed(2)}, trasera hasta x${rearLoad.min.toFixed(2)}`);
    check(profile.name, 'el piloto se va sobre el manillar al frenar',
      riderX.max > beforeBraking.riderShiftX + 0.02,
      `dx antes ${beforeBraking.riderShiftX.toFixed(3)} m -> frenando ${riderX.max.toFixed(3)} m`);
    const brakeRearSpin = Math.min(...brakingFrames.map((f) => f.rearSpinRate));
    check(profile.name, 'el freno reduce el giro de la rueda sin invertirlo', brakeRearSpin >= -1e-6,
      `giro minimo de la trasera ${brakeRearSpin.toFixed(2)} rad/s`);
  }

  // --- 4. EL CUERPO DEL PILOTO MANDA --------------------------------------
  await setLean(page, 1); // morro arriba = peso atras
  const leanBackFrames = await recordRacingFrames(page, 800);
  await shot('06-piloto-peso-atras');
  await setLean(page, -1); // morro abajo = peso delante
  const leanForwardFrames = await recordRacingFrames(page, 800);
  await shot('07-piloto-peso-delante');
  await setLean(page, null);

  check(profile.name, 'se han podido medir los dos gestos de cuerpo',
    leanBackFrames.length > 0 && leanForwardFrames.length > 0,
    `peso atras ${leanBackFrames.length} fotogramas, peso delante ${leanForwardFrames.length}`);
  const backX = range(leanBackFrames, 'riderShiftX');
  const forwardX = range(leanForwardFrames, 'riderShiftX');
  const backTorso = range(leanBackFrames, 'riderTorso');
  const forwardTorso = range(leanForwardFrames, 'riderTorso');
  check(profile.name, 'el cuerpo del piloto se desplaza segun el gesto pedido',
    backX.min < forwardX.max - 0.1,
    `peso atras dx ${backX.min.toFixed(3)} m vs peso delante dx ${forwardX.max.toFixed(3)} m`);
  check(profile.name, 'el torso gira de forma independiente del chasis',
    backTorso.max - forwardTorso.min > 0.15,
    `recorrido de torso ${(((backTorso.max - forwardTorso.min) * 180) / Math.PI).toFixed(1)} grados`);
  // La carga de un eje solo significa algo con la rueda en el suelo: en vuelo
  // es cero por definicion y promediarla mezclaria "el piloto no carga el eje"
  // con "la moto esta en el aire".
  const grounded = (frames) => frames.filter((f) => f.frontContact && f.rearContact);
  const mean = (frames, key) => frames.reduce((a, f) => a + f[key], 0) / frames.length;
  void grounded;
  void mean;
  const measured = await measureBodyLoadTransfer(page);
  check(profile.name, 'mover el cuerpo cambia de verdad la carga del eje correcto',
    measured !== null && measured.forward > measured.back * 1.1,
    measured === null
      ? 'no se logro medir con las dos ruedas en el suelo'
      : `carga delantera media, moto quieta y apoyada: peso atras x${measured.back.toFixed(2)}, peso delante x${measured.forward.toFixed(2)}`);

  // --- 5. LAS PIEZAS DE TERRENO DEL CORTE VERTICAL -------------------------
  const seen = new Set();
  const runFrames = [];
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && seen.size < track.features.length) {
    const batch = await recordFrames(page, 700);
    runFrames.push(...batch);
    for (const frame of batch) {
      if (frame.state !== 'RACING') continue;
      for (const feature of track.features) {
        if (frame.x >= feature.startX && frame.x <= feature.endX && !seen.has(feature.kind)) {
          seen.add(feature.kind);
          await shot(`08-terreno-${seen.size}-${feature.kind}`);
        }
      }
    }
  }
  const racedFrames = racing(runFrames);
  check(profile.name, `se recorren las ${track.features.length} piezas de terreno`, seen.size === track.features.length,
    `vistas: ${[...seen].join(', ') || 'ninguna'}`);

  const airFrames = racedFrames.filter(airborne);
  check(profile.name, 'la moto vuela y aterriza', airFrames.length > 10,
    `${airFrames.length} fotogramas sin contacto de ${racedFrames.length}`);
  const landingCompression = Math.max(...racedFrames.map((f) => f.rearCompression));
  check(profile.name, 'la suspension trabaja al recibir', landingCompression > 0.2,
    `compresion trasera maxima ${landingCompression.toFixed(3)} m`);
  const riderY = range(racedFrames, 'riderShiftY');
  check(profile.name, 'el piloto absorbe y se estira a lo largo del recorrido',
    riderY.max - riderY.min > 0.04,
    `recorrido vertical del cuerpo ${((riderY.max - riderY.min) * 100).toFixed(1)} cm`);
  const shake = racedFrames.filter((f) => Math.abs(f.shakeX) > 1e-6 || Math.abs(f.shakeY) > 1e-6);
  info(profile.name, 'sacudida de camara activa', `${shake.length} fotogramas con sacudida`);

  await page.keyboard.press('F1');
  await page.waitForTimeout(200);
  await shot('09-panel-de-depuracion');
  await page.keyboard.press('F1');

  // --- 6. CRASH Y REINICIO -------------------------------------------------
  const beforeCrashes = await page.evaluate(() => window.__qa.crashes);
  // Morro abajo a fondo y sostenido: acaba clavando la moto.
  await setLean(page, -1);
  await page.evaluate(() => (window.__qa.autoRestart = false));
  const crashDeadline = Date.now() + 20000;
  let crashed = false;
  while (Date.now() < crashDeadline) {
    const frame = await readFrame(page);
    if (frame.state === 'CRASHED') {
      crashed = true;
      break;
    }
    await page.waitForTimeout(120);
  }
  await shot('10-crash');
  check(profile.name, 'un morro clavado provoca crash', crashed,
    crashed ? `crashes acumulados ${(await page.evaluate(() => window.__qa.crashes)) - beforeCrashes + beforeCrashes}` : 'no llego a estrellarse en 20 s');

  if (crashed) {
    await setLean(page, null);
    await page.evaluate(() => (window.__qa.autoRestart = true));
    let recovered = await page
      .waitForFunction(() => window.__crossRushFrame?.state !== 'CRASHED', null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!recovered) {
      // Segunda via: la tecla de verdad, por si el piloto inyectado se ha
      // quedado atras. Lo que se comprueba es el juego, no el arnes.
      const pilotError = await page.evaluate(() => window.__qa.lastError);
      info(profile.name, 'el piloto no reinicio solo, se pulsa R directamente', pilotError ?? 'sin error registrado');
      await page.keyboard.press('KeyR');
      recovered = await page
        .waitForFunction(() => window.__crossRushFrame?.state !== 'CRASHED', null, { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
    }
    check(profile.name, 'se sale del estado de choque al reiniciar', recovered, recovered ? '' : 'sigue en CRASHED');
    const restarted = await readFrame(page);
    check(profile.name, 'reiniciar vuelve limpio a la salida', restarted.x < track.startX + 3 && restarted.t < 1,
      `estado ${restarted.state}, x=${restarted.x.toFixed(1)} m, t=${restarted.t.toFixed(2)} s`);
    await shot('11-reiniciada');
  }

  // --- 7. SEGUNDA CARRERA --------------------------------------------------
  await page.waitForFunction(() => window.__crossRushFrame?.state === 'RACING', null, { timeout: 20000 });
  await recordFrames(page, 3000);
  await shot('12-segunda-carrera');
  const hud = await page.evaluate(() => document.getElementById('ui-overlay')?.innerText ?? '');
  info(profile.name, 'HUD en carrera', hud.replace(/\s+/g, ' ').slice(0, 160));

  // --- 8. CONSOLA Y RED ----------------------------------------------------
  check(profile.name, 'consola sin errores', consoleErrors.length === 0, consoleErrors.join(' | ') || 'ninguno');
  check(profile.name, 'sin peticiones fallidas ni 404 de assets', networkFailures.length === 0,
    networkFailures.join(' | ') || 'ninguna');

  await page.evaluate(() => (window.__qa.stop = true));
  await context.close();
  return { launchFrames, cruiseFrames, brakingFrames, leanBackFrames, leanForwardFrames };
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const executablePath = resolveChromium();
  if (executablePath) console.log(`Chromium: ${executablePath}`);
  // Sin estos flags, Chromium sin cabeza entrega rAF a exactamente 60 Hz, que
  // es la mitad justa de los 120 Hz de simulacion: cada fotograma cae siempre
  // en el limite de un tick y el alpha de interpolacion sale siempre 0. Es
  // decir, el unico ritmo de pantalla en el que la interpolacion no se nota.
  // Liberando el limite, rAF corre a cientos de hercios y el alpha recorre
  // todo el rango, que es lo que hay que comprobar.
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
  });
  const data = {};
  try {
    for (const profile of PROFILES) {
      console.log(`\n=== ${profile.name} ===`);
      data[profile.name] = await runProfile(browser, profile);
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(OUT_DIR, 'INFORME.txt'), `${notes.join('\n')}\n`, 'utf8');
  await writeFile(path.join(OUT_DIR, 'muestras.json'), JSON.stringify(data), 'utf8');

  console.log(`\nCapturas y video en ${OUT_DIR}`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} comprobacion(es) fallidas:`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('\nQA visual: todas las comprobaciones pasan.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
