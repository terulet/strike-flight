/** Bot compartido por playtest.mjs y flows.mjs: juega leyendo debugInfo(). */
export const VIEW = { w: 393, h: 852 };

export const readState = (page) => page.evaluate(() => window.__PZ.state());
export const isOver = (page) => page.evaluate(() => !!document.querySelector('.result'));

export async function launchGame(page, gameId) {
  await page.evaluate((id) => window.__PZ.app.startDebugRun(id), gameId);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
}

/**
 * El bot juega con una "calidad" 0..1. Sirve para montar duelos deterministas:
 * el mismo juego con la misma semilla da la misma puntuacion, asi que la unica
 * forma de que uno gane a otro es que juegue mejor.
 */
export async function playPulse(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state) break;
    const good = (state.nodes ?? []).filter((n) => !n.mine).sort((a, b) => a.life - b.life);
    for (const node of good.slice(0, 2)) {
      // Fallar a proposito de forma reproducible (nada de Math.random).
      if (quality < 1 && tick % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
        tick++;
        continue;
      }
      tick++;
      await page.mouse.click(node.x, node.y);
    }
    await page.waitForTimeout(45);
  }
}

export async function playSnap(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  const offset = (1 - quality) * 0.85;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.target) break;
    // Apuntar peor = disparar desviado un porcentaje del radio de la diana.
    const dx = Math.cos(tick) * state.target.r * offset;
    const dy = Math.sin(tick) * state.target.r * offset;
    tick++;
    await page.mouse.click(state.target.x + dx, state.target.y + dy);
    await page.waitForTimeout(120);
  }
}

export async function playDrift(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  await page.mouse.move(VIEW.w / 2, VIEW.h * 0.79);
  await page.mouse.down();
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.player) break;
    // Con menos calidad, de vez en cuando "se despista" y no corrige.
    if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
      await page.waitForTimeout(28);
      continue;
    }
    const player = state.player;
    const wall = (state.walls ?? []).filter((w) => w.y < player.y + 20).sort((a, b) => b.y - a.y)[0];
    let targetX = wall ? wall.gapX + wall.gapW / 2 : player.x;
    for (const block of state.blocks ?? []) {
      if (Math.abs(block.y - player.y) < 140 && Math.abs(block.x - targetX) < block.size) {
        targetX += targetX < VIEW.w / 2 ? block.size * 1.6 : -block.size * 1.6;
      }
    }
    await page.mouse.move(Math.max(12, Math.min(VIEW.w - 12, targetX)), VIEW.h * 0.79);
    await page.waitForTimeout(28);
  }
  await page.mouse.up();
}

/** MEMORY: memoriza durante el destello y toca las casillas al apagarse. */
export async function playMemory(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let remembered = [];
  let round = -1;
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.cells) break;
    if (state.round !== round) {
      round = state.round;
      remembered = [];
    }
    if (state.phase === 'flash') {
      remembered = state.pattern.slice();
    } else if (state.phase === 'input' && remembered.length > 0) {
      const found = new Set(state.found);
      for (const index of remembered) {
        if (found.has(index)) continue;
        // Con menos calidad, de vez en cuando "se le olvida" una casilla.
        if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) continue;
        const cell = state.cells[index];
        if (cell) await page.mouse.click(cell.x, cell.y);
      }
    }
    await page.waitForTimeout(40);
  }
}

/**
 * RITMO: espera al instante exacto de cada nota y toca su carril.
 *
 * La calidad se traduce en desvio temporal, que es como se falla de verdad
 * aqui: no tocando de menos, sino tocando tarde.
 */
export async function playRitmo(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  const desfase = (1 - quality) * 0.13;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.notas) break;
    const nota = state.notas[0];
    if (nota) {
      const esperar = (nota.tiempo + desfase - state.relojAudio) * 1000;
      if (esperar > 0 && esperar < 1600) {
        await page.waitForTimeout(esperar);
        await page.mouse.click(nota.x, state.lineaY);
        continue;
      }
    }
    await page.waitForTimeout(20);
  }
}

/**
 * TRAZO: recorre la figura punto a punto sin levantar el dedo.
 *
 * Se interpola cada tramo en vez de arrastrar de golpe: la precision se mide
 * frame a frame mientras el dedo esta abajo, asi que un salto directo se la
 * saltaria entera. Con menos calidad el bot curva el tramo y se despega de la
 * linea, que es exactamente como pierde precision una persona.
 */
export async function playTrazo(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  const bandazo = (1 - quality) * 30;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.puntos?.length) break;
    const puntos = state.puntos;

    await page.mouse.move(puntos[0].x, puntos[0].y);
    await page.mouse.down();
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1];
      const b = puntos[i];
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const largo = Math.hypot(nx, ny) || 1;
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const curva = Math.sin(t * Math.PI) * bandazo;
        await page.mouse.move(
          a.x + (b.x - a.x) * t + (nx / largo) * curva,
          a.y + (b.y - a.y) * t + (ny / largo) * curva,
        );
        await page.waitForTimeout(11);
      }
      if (await isOver(page)) break;
    }
    await page.mouse.up();
    await page.waitForTimeout(90);
  }
}

/**
 * FRENO: toca solo las fichas que la regla marca como validas.
 *
 * El juego ya resuelve la regla en debugInfo (`vale`), asi que el bot no
 * interpreta el texto: aqui no se prueba si un bot sabe leer, se prueba si el
 * juego puntua bien lo que toca y penaliza lo que no.
 *
 * Con menos calidad el bot toca ADEMAS fichas prohibidas, que es exactamente
 * como falla una persona en este juego: no por lentitud, sino por no frenar.
 */
export async function playFreno(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.fichas) break;
    for (const ficha of state.fichas) {
      if (ficha.vale) {
        await page.mouse.click(ficha.x, ficha.y);
      } else if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
        await page.mouse.click(ficha.x, ficha.y);
      }
    }
    await page.waitForTimeout(45);
  }
}


/**
 * Espera `ms` en pasos cortos, comprobando isOver() entre paso y paso.
 *
 * Los bots de reaccion lenta (CAZA, CUENTA, TORRE, TRILE, CARGA) necesitan
 * esperar cientos de milisegundos antes de tocar -es lo que los hace jugar
 * como alguien que mira antes de decidir, no como un oraculo-, pero una espera
 * de un solo bloque deja una ventana larga en la que la partida puede acabar
 * DURANTE la espera. Si eso pasa y se toca de todos modos, el toque no cae
 * sobre nada del juego: cae sobre lo que haya debajo en ese momento, que suele
 * ser el boton de REVANCHA de la pantalla de resultado, y la partida se
 * reinicia sola. Paso a paso, la ventana se reduce al tamano de un paso.
 *
 * Devuelve false si la partida termino durante la espera (no se debe tocar).
 */
async function esperar(page, ms) {
  const paso = 55;
  let queda = ms;
  while (queda > 0) {
    await page.waitForTimeout(Math.min(paso, queda));
    queda -= paso;
    if (await isOver(page)) return false;
  }
  return true;
}

/**
 * CAZA: toca la flecha torcida. debugInfo ya dice cual es.
 *
 * EL RETARDO NO ES ADORNO, ES LA CALIBRACION. El bot sabe la respuesta de
 * antemano, asi que sin esperar juega como un oraculo: resolvia una ronda cada
 * 200 ms y sacaba 45.371 puntos, diez veces el techo de los demas juegos. Con
 * ese numero se habrian ajustado mal las marcas de los rivales y el reto con
 * CAZA habria decidido el dia entero por si solo.
 *
 * El retardo simula lo unico que el bot se salta: BUSCAR. Unos 20 ms por
 * casilla que hay que barrer, mas el tiempo de reaccion. Es una estimacion,
 * pero es una estimacion declarada, no un cero disimulado.
 */
export async function playCaza(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (!state?.rara) { await page.waitForTimeout(60); continue; }
    const buscar = 350 + (state.casillas ?? 15) * 20;
    if (!(await esperar(page, buscar * (2 - quality)))) break;
    const ahora = await readState(page);
    if (!ahora?.rara) break; // la partida ya no esta en marcha
    await page.mouse.click(ahora.rara.x, ahora.rara.y);
    await page.waitForTimeout(60);
  }
}

/**
 * CUENTA: toca el lado bueno. Con menos calidad se equivoca de lado a ratos.
 *
 * Mismo retardo declarado que en CAZA y por lo mismo (sacaba 39.200). Aqui lo
 * que cuesta tiempo es DECIDIR, y decidir cuesta mas cuanto mas parecidas son
 * las dos nubes: de ahi que la espera dependa de la ratio de la ronda.
 */
export async function playCuenta(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const state = await readState(page);
    if (state?.ganador === undefined) { await page.waitForTimeout(40); continue; }
    const espera = (350 + (1.9 - (state.ratio ?? 1.5)) * 700) * (2 - quality);
    if (!(await esperar(page, espera))) break;
    const ahora = await readState(page);
    if (ahora?.ganador === undefined) break;
    let lado = ahora.ganador;
    if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) lado = 1 - lado;
    await page.mouse.click(lado === 0 ? VIEW.w * 0.25 : VIEW.w * 0.75, VIEW.h * 0.45);
    await page.waitForTimeout(60);
  }
}

/**
 * TORRE: calcula cuando el bloque estara encima y suelta entonces.
 *
 * No sirve el bucle de "mira y toca" de los demas bots: entre leer el estado y
 * hacer clic pasan decenas de milisegundos y a esa velocidad el bloque ya se ha
 * ido. Se predice el instante y se espera, igual que en RITMO.
 *
 * `adelanto` compensa la latencia del propio Playwright. Con calidad baja se
 * exagera, que es exactamente como falla una persona: soltando pronto.
 */
export async function playTorre(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  const adelanto = 0.035 + (1 - quality) * 0.09;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const s = await readState(page);
    if (!s || s.velocidad === undefined) { await page.waitForTimeout(40); continue; }
    const falta = (s.objetivoX - s.movilX) / (s.direccion * s.velocidad);
    if (falta > 0 && falta < 3) {
      const esperaMs = (falta - adelanto) * 1000;
      if (esperaMs > 0 && !(await esperar(page, esperaMs))) break;
      await page.mouse.click(VIEW.w / 2, VIEW.h * 0.5);
      await page.waitForTimeout(60);
      continue;
    }
    await page.waitForTimeout(25);
  }
}

/** TRILE: espera a la fase de responder y toca el disco bueno. */
export async function playTrile(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  let tick = 0;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const s = await readState(page);
    if (s?.fase !== 'respondiendo' || !s.bueno) { await page.waitForTimeout(60); continue; }
    // Tambien aqui: el bot no pierde de vista el disco nunca, asi que se le
    // pone el tiempo que tarda una persona en decidirse y senalar.
    if (!(await esperar(page, 550 * (2 - quality)))) break;
    if (quality < 1 && tick++ % Math.max(2, Math.round(1 / (1 - quality))) === 0) {
      // Perder el disco de vista: se toca a un lado, donde suele haber otro.
      await page.mouse.click(VIEW.w - s.bueno.x, s.bueno.y);
    } else {
      await page.mouse.click(s.bueno.x, s.bueno.y);
    }
    await page.waitForTimeout(120);
  }
}

/**
 * CARGA: aprieta, calcula cuando la carga llegara al centro de la franja y
 * suelta ahi. Mismo problema de latencia que TORRE y misma solucion.
 */
export async function playCarga(page, ms = 60000, quality = 1) {
  const t0 = Date.now();
  const adelanto = 0.03 + (1 - quality) * 0.1;
  while (!(await isOver(page)) && Date.now() - t0 < ms) {
    const s = await readState(page);
    if (!s?.franja) { await page.waitForTimeout(40); continue; }
    if (s.fase === 'juzgando') { await page.waitForTimeout(60); continue; }

    const centro = (s.franja[0] + s.franja[1]) / 2;
    await page.mouse.move(VIEW.w / 2, VIEW.h * 0.5);
    await page.mouse.down();
    const esperaMs = ((centro - s.carga) / s.velocidad - adelanto) * 1000;
    if (esperaMs > 0 && !(await esperar(page, esperaMs))) { await page.mouse.up(); break; }
    await page.mouse.up();
    await page.waitForTimeout(80);
  }
}

export const BOTS = {
  pulse: playPulse,
  drift: playDrift,
  snap: playSnap,
  memory: playMemory,
  ritmo: playRitmo,
  trazo: playTrazo,
  freno: playFreno,
  caza: playCaza,
  cuenta: playCuenta,
  torre: playTorre,
  trile: playTrile,
  carga: playCarga,
};

/**
 * Juega el reto que este en marcha, sea cual sea el juego.
 *
 * Espera a saber que juego es antes de elegir estrategia: si se lee demasiado
 * pronto, el estado aun no existe y el bot acabaria jugando a otra cosa (y
 * sacando cero, que fue justo lo que paso una vez).
 */
export async function playCurrent(page, ms, quality = 1) {
  let state = null;
  for (let i = 0; i < 30 && !state?.game; i++) {
    state = await readState(page);
    if (!state?.game) await page.waitForTimeout(100);
  }
  const bot = BOTS[state?.game];
  if (!bot) {
    // Antes se caia al bot de PULSE, que toca nodos inexistentes y saca cero
    // sin quejarse. Eso paso al anadir RITMO y TRAZO: flows.mjs bajo de 33/33
    // a 30/33 y los fallos apuntaban al pique y al ranking, no al bot, que era
    // donde estaba el problema. Mejor romper aqui y que se lea el motivo.
    throw new Error(
      `No hay bot para el juego "${state?.game}". Anadelo a BOTS en tools/bot.mjs: ` +
        `sin el, este juego puntua cero y las pruebas fallan en otro sitio.`,
    );
  }
  await bot(page, ms, quality);
}

/**
 * Sale de la pantalla de resultado y vuelve al ranking.
 *
 * Por CLASE y no por texto. Las herramientas seleccionaban "CONTINUAR" a mano,
 * asi que el dia que ese boton paso a llamarse "VER RANKING" -porque ahora el
 * principal ofrece el siguiente reto- se rompieron seis a la vez. La clase
 * salir-resultado la pone el propio boton y no depende de como se llame.
 */
export async function salirDelResultado(page, timeout = 10000) {
  const porClase = page.locator('.salir-resultado');
  if (await porClase.count()) await porClase.first().click();
  else await page.getByText('CONTINUAR', { exact: true }).click();
  await page.waitForSelector('.card', { timeout });
}
