#!/usr/bin/env node
/**
 * Junta el Roblox de mentira + los ajustes + la parcela + el servidor +
 * los casos, y se lo pasa al interprete de Luau.
 *
 *   node la-gran-tormenta/herramientas/probar.mjs         las comprobaciones
 *   node la-gran-tormenta/herramientas/probar.mjs medir   cuanto cuesta la puerta
 *
 * Hace falta el binario `luau` en el PATH (o en LUAU_BIN).
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");

const modo = process.argv[2] === "medir" ? "medir" : "casos";
const cuantos = Number(process.argv[3] || 1) || 1;

// El require de Roblox no existe fuera de Roblox.
function sinRequires(texto, nombre) {
  const antes = texto;
  texto = texto
    .replace(/local A = require\(RS:WaitForChild\("Ajustes"\)\)/, "local A = AJUSTES")
    .replace(/local Parcela = require\(RS:WaitForChild\("Parcela"\)\)/, "local Parcela = PARCELA")
    .replace(/local Mundo = require\(script\.Parent\.Mundo\)/, "local Mundo = MUNDO")
    .replace(/local Guardado = require\(script\.Parent\.Guardado\)/, "local Guardado = GUARDADO")
    .replace(/local Tormenta = require\(script\.Parent\.Tormenta\)/, "local Tormenta = TORMENTA");
  if (texto === antes) {
    console.error(`no he encontrado ningun require que cambiar en ${nombre}`);
    process.exit(1);
  }
  return texto;
}

// Una comprobacion que no puede hacerse desde dentro de Luau, porque va
// del codigo en si: el espacio NO puede servir para cavar. El espacio
// salta, y cavar dando saltos es ridiculo. Si alguien lo vuelve a atar,
// que se entere aqui y no en Studio.
const fuenteCliente = leer("src/StarterPlayer/StarterPlayerScripts/Cliente.client.luau");
if (/KeyCode\.Space/.test(fuenteCliente)) {
  console.error("el cliente vuelve a usar el espacio para cavar: el espacio salta");
  process.exit(1);
}

const junto = [
  "-- generado por probar.mjs, no se edita a mano",
  `JUGADORES = ${cuantos}`,
  leer("herramientas/entorno.luau"),
  "AJUSTES = (function()",
  leer("src/ReplicatedStorage/Ajustes.luau"),
  "end)()",
  "PARCELA = (function()",
  sinRequires(leer("src/ReplicatedStorage/Parcela.luau"), "Parcela"),
  "end)()",
  "MUNDO = (function()",
  sinRequires(leer("src/ServerScriptService/Mundo.luau"), "Mundo"),
  "end)()",
  "GUARDADO = (function()",
  sinRequires(leer("src/ServerScriptService/Guardado.luau"), "Guardado"),
  "end)()",
  "TORMENTA = (function()",
  sinRequires(leer("src/ServerScriptService/Tormenta.luau"), "Tormenta"),
  "end)()",
  "do",
  sinRequires(leer("src/ServerScriptService/Juego.server.luau"), "el servidor"),
  "end",
  "do",
  leer(`herramientas/${modo}.luau`),
  "end",
].join("\n");

const carpeta = mkdtempSync(join(tmpdir(), "tormenta-"));
const archivo = join(carpeta, "prueba.luau");
writeFileSync(archivo, junto);

const luau = process.env.LUAU_BIN || "luau";
const salida = spawnSync(luau, [archivo], { stdio: "inherit" });
if (salida.error) {
  console.error(`no encuentro el interprete "${luau}".`);
  console.error("bajalo de https://github.com/luau-lang/luau/releases");
  process.exit(1);
}
process.exit(salida.status ?? 1);
