#!/usr/bin/env node
/**
 * AUDITORIA DEL ARCHIVO MAESTRO.
 *
 *   node kali-snow-world/herramientas/auditar.mjs
 *
 * Busca las cosas que rompen un juego montado a partir de varios
 * prototipos, y que no se ven jugando cinco minutos:
 *
 *   - scripts duplicados
 *   - dos remotos con el mismo nombre, o uno que el cliente espera y
 *     nadie crea
 *   - herramientas concedidas por dos sitios distintos
 *   - restos del guardado de un prototipo anterior
 *   - referencias a cosas que no van dentro del RBXLX
 *   - capitulos que no se pueden activar (objetivos imposibles)
 *
 * Lo que NO puede comprobar esto: que la historia se termine. Eso lo
 * demuestran las pruebas (probar.mjs) y el simulador (probar.mjs medir),
 * que juegan la partida entera de verdad.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");

let fallos = 0;
let avisos = 0;
function bien(t) {
  console.log("  ok   " + t);
}
function mal(t) {
  console.log("  MAL  " + t);
  fallos++;
}
function ojo(t) {
  console.log("  ojo  " + t);
  avisos++;
}
function titulo(t) {
  console.log("\n── " + t);
}

// ---------------------------------------------------------------- 1
titulo("UN SOLO SCRIPT DE CADA COSA");

const ESPERADOS = [
  "src/ReplicatedStorage/Ajustes.luau",
  "src/ReplicatedStorage/Parcela.luau",
  "src/ServerScriptService/Mundo.luau",
  "src/ServerScriptService/Guardado.luau",
  "src/ServerScriptService/Tormenta.luau",
  "src/ServerScriptService/Juego.server.luau",
  "src/StarterPlayer/StarterPlayerScripts/Cliente.client.luau",
];

function todosLosLuau(dir, acc = []) {
  for (const nombre of readdirSync(join(raiz, dir))) {
    const rel = dir + "/" + nombre;
    if (statSync(join(raiz, rel)).isDirectory()) {
      todosLosLuau(rel, acc);
    } else if (nombre.endsWith(".luau")) {
      acc.push(rel);
    }
  }
  return acc;
}
const enDisco = todosLosLuau("src").sort();
if (enDisco.length === ESPERADOS.length && ESPERADOS.every((p) => enDisco.includes(p))) {
  bien(`${enDisco.length} scripts, ni uno mas`);
} else {
  mal(`los scripts no son los siete esperados:\n       ${enDisco.join("\n       ")}`);
}
const nombres = enDisco.map((p) => basename(p));
const repes = nombres.filter((n, i) => nombres.indexOf(n) !== i);
if (repes.length === 0) {
  bien("ningun nombre repetido");
} else {
  mal("nombres repetidos: " + repes.join(", "));
}

const fuentes = {};
for (const p of ESPERADOS) {
  fuentes[basename(p)] = existsSync(join(raiz, p)) ? leer(p) : "";
}
const servidor = fuentes["Juego.server.luau"];
const cliente = fuentes["Cliente.client.luau"];
const ajustes = fuentes["Ajustes.luau"];
const guardado = fuentes["Guardado.luau"];

// ---------------------------------------------------------------- 2
titulo("LOS REMOTOS");

const creados = [...servidor.matchAll(/remoto\("([A-Za-z]+)"\)/g)].map((m) => m[1]);
const dobles = creados.filter((n, i) => creados.indexOf(n) !== i);
if (dobles.length === 0) {
  bien(`${creados.length} remotos y ninguno repetido: ${creados.join(", ")}`);
} else {
  mal("hay remotos con el mismo nombre: " + dobles.join(", "));
}

const carpetaRemotos = (servidor.match(/remotos\.Name = "([A-Za-z]+)"/) || [])[1];
const pedidos = [...cliente.matchAll(/remotos:WaitForChild\("([A-Za-z]+)"\)/g)].map((m) => m[1]);
const huerfanos = pedidos.filter((n) => !creados.includes(n));
if (huerfanos.length === 0) {
  bien(`el cliente pide ${pedidos.length} y todos existen`);
} else {
  mal("el cliente espera remotos que nadie crea: " + huerfanos.join(", "));
}
const sinUsar = creados.filter((n) => !pedidos.includes(n));
if (sinUsar.length > 0) {
  ojo("remotos que el cliente no usa: " + sinUsar.join(", "));
}

// ---------------------------------------------------------------- 3
titulo("LAS HERRAMIENTAS SE DAN UNA VEZ");

for (const util of ["sopladora", "quitanieves"]) {
  const sitios = [...servidor.matchAll(new RegExp(`\\.tiene\\.${util} = true`, "g"))].length;
  const alCargar = [...servidor.matchAll(
    new RegExp(`\\.tiene\\.${util} = datos\\.herramientas\\.${util} == true`, "g"),
  )].length;
  if (sitios === 1) {
    bien(`la ${util} se concede en un solo sitio (mas ${alCargar} al cargar la partida)`);
  } else {
    mal(`la ${util} se concede en ${sitios} sitios distintos`);
  }
}

// ---------------------------------------------------------------- 4
titulo("EL GUARDADO NO SE MEZCLA CON NINGUN PROTOTIPO");

const PROTOTIPOS = ["Nieve_", "Desenterrar", "AbreLaCalle", "BarrioDespierta", "GranTormenta"];
const tienda = (guardado.match(/Guardado\.nombreTienda = "([A-Za-z_]+)"/) || [])[1];
if (tienda === "KaliSnowWorld_v") {
  bien('el almacen es propio: "KaliSnowWorld_v" + esquema');
} else {
  mal("el almacen no es el del maestro: " + tienda);
}
const contaminado = PROTOTIPOS.filter((n) =>
  Object.values(fuentes).some((f) => f.includes(n)),
);
if (contaminado.length === 0) {
  bien("no queda ni una mencion a los almacenes de los prototipos");
} else {
  mal("hay restos de prototipos en el codigo: " + contaminado.join(", "));
}
if (/if Correr:IsStudio\(\) then\n\tGuardado\.nombreTienda = Guardado\.nombreTienda \.\. "_DEV"/.test(guardado)) {
  bien("y en Studio lleva _DEV");
} else {
  mal("en Studio NO se separa el almacen con _DEV");
}

// ---------------------------------------------------------------- 5
titulo("NADA DE FUERA DEL RBXLX");

const DENTRO = ["Ajustes", "Parcela", "Mundo", "Guardado", "Tormenta"];
const buscados = new Set();
for (const [nombre, f] of Object.entries(fuentes)) {
  for (const m of f.matchAll(/RS:WaitForChild\("([A-Za-z]+)"\)/g)) buscados.add(m[1]);
  for (const m of f.matchAll(/require\(script\.Parent\.([A-Za-z]+)\)/g)) buscados.add(m[1]);
  if (/require\("|loadstring|getfenv|HttpService/.test(f)) {
    ojo(`${nombre} usa require de texto, loadstring o HTTP: revisalo a mano`);
  }
}
const fuera = [...buscados].filter((n) => !DENTRO.includes(n) && n !== carpetaRemotos);
if (fuera.length === 0) {
  bien("todo lo que se busca va dentro del archivo: " + [...buscados].join(", "));
} else {
  mal("se busca algo que no esta empaquetado: " + fuera.join(", "));
}

const conAssets = [...Object.values(fuentes).join("\n").matchAll(/rbxassetid:\/\/(\d+)/g)];
if (conAssets.length === 0) {
  bien("no se depende de ningun asset subido a Roblox (todo es rbxasset:// de serie)");
} else {
  ojo(`${conAssets.length} rbxassetid: si esos no son tuyos, en otra cuenta no cargan`);
}

// ---------------------------------------------------------------- 6
titulo("LOS OBJETIVOS SE PUEDEN ACTIVAR TODOS");

const capitulos = [];
const bloque = ajustes.slice(ajustes.indexOf("Ajustes.capitulos"));
for (const m of bloque.matchAll(/clave = "([a-z]+)"/g)) {
  capitulos.push(m[1]);
  if (capitulos.length > 20) break;
}
const orden = capitulos.slice(0, capitulos.indexOf("fin") + 1);
const ESPERADO = ["puerta", "garaje", "sopladora", "carretera", "vecino", "quitanieves", "plaza", "fin"];
if (orden.join(",") === ESPERADO.join(",")) {
  bien("la cadena de objetivos es una sola y va en orden: " + orden.join(" > "));
} else {
  mal("la cadena de objetivos no es la esperada: " + orden.join(" > "));
}
// Un capitulo se activa cuando su condicion se cumple, y las
// condiciones estan todas en la tabla "cumplido" de avanzarCapitulo. Un
// objetivo imposible es justamente uno que no tenga entrada ahi, o que
// la tenga puesta a false: el guion se quedaria clavado en el para
// siempre y no habria forma de terminar la partida.
const trozo = servidor.slice(servidor.indexOf("local cumplido = {"));
const tabla = trozo.slice(0, trozo.indexOf("}"));
const condiciones = {};
for (const m of tabla.matchAll(/([a-z]+) = ([^,\n]+),/g)) {
  condiciones[m[1]] = m[2].trim();
}
let imposibles = 0;
for (const clave of orden) {
  const cond = condiciones[clave];
  if (!cond) {
    mal(`el capitulo "${clave}" no tiene condicion: no hay forma de pasarlo`);
    imposibles++;
  } else if (cond === "false" && clave !== "fin") {
    mal(`el capitulo "${clave}" tiene la condicion en false: es imposible`);
    imposibles++;
  }
}
if (imposibles === 0) {
  bien("cada capitulo tiene una condicion que se puede cumplir");
  for (const clave of orden) {
    if (clave !== "fin") {
      console.log(`         ${clave.padEnd(12)} <- ${condiciones[clave]}`);
    }
  }
}

// Y las condiciones que salen de un hallazgo tienen que ser hallazgos
// que existan de verdad en la lista.
const declarados = new Set();
for (const m of ajustes.matchAll(/clave = "([a-z]+)", *\n?\s*(?:zona|nombre)/g)) declarados.add(m[1]);
for (const m of ajustes.matchAll(/\{ *clave = "([a-z]+)"/g)) declarados.add(m[1]);
let sueltos = [];
for (const [cap, cond] of Object.entries(condiciones)) {
  const h = (cond.match(/^hechos\.([a-z]+)$/) || [])[1];
  if (h && !declarados.has(h) && !servidor.includes(`hallazgos.${h}`)) {
    sueltos.push(`${cap} espera el hallazgo "${h}"`);
  }
}
if (sueltos.length === 0) {
  bien("y los hallazgos que esperan existen en la lista");
} else {
  ojo("condiciones que dependen de hallazgos raros: " + sueltos.join(", "));
}

// ---------------------------------------------------------------- 7
titulo("LA DESCARGA NO SE PUEDE TAPAR");

const D = ajustes.match(/libre = (\d+),/);
const R = ajustes.match(/radioDescarga = (\d+),/);
if (D && R && Number(D[1]) > Number(R[1])) {
  bien(`el monton se aparta ${D[1]} y se vacia a ${R[1]}: nunca lo tapa`);
} else {
  mal("el hueco del monton no es mayor que el radio de descarga");
}

// ---------------------------------------------------------------- 8
titulo("LA VERSION SE DICE EN VOZ ALTA");

const version = (ajustes.match(/Ajustes\.version = "([^"]+)"/) || [])[1];
if (version && servidor.includes("A.version")) {
  bien(`sale por el Output: ${version}`);
} else {
  mal("la version no se imprime al arrancar");
}

console.log("");
if (fallos === 0) {
  console.log(`── auditoria limpia (${avisos} cosas para mirar de reojo)`);
} else {
  console.log(`── ${fallos} problemas que hay que arreglar`);
  process.exit(1);
}
