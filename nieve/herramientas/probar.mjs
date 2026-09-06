#!/usr/bin/env node
/**
 * Junta el entorno de mentira + los ajustes + el servidor + los casos
 * en un solo archivo y se lo pasa al interprete de Luau.
 *
 *   node nieve/herramientas/probar.mjs
 *
 * Hace falta el binario `luau` en el PATH (o en LUAU_BIN):
 *   https://github.com/luau-lang/luau/releases  ->  luau-ubuntu.zip
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");

const ajustes = leer("src/ReplicatedStorage/AjustesNieve.luau");
let servidor = leer("src/ServerScriptService/Nieve.server.luau");
const entorno = leer("herramientas/entorno.luau");
// `node probar.mjs ritmo` corre el simulador de progresion en vez de las pruebas.
const modo = process.argv[2] === "ritmo" ? "ritmo" : "casos";
const casos = leer(`herramientas/${modo}.luau`);

// El require de Roblox no existe fuera de Roblox: se cambia por la tabla ya cargada.
const antes = servidor;
servidor = servidor.replace(
  /local A = require\(RS:WaitForChild\("AjustesNieve"\)\)/,
  "local A = AJUSTES",
);
if (servidor === antes) {
  console.error("no he encontrado el require de AjustesNieve en el servidor");
  process.exit(1);
}

const junto = [
  "-- generado por probar.mjs, no se edita a mano",
  entorno,
  "AJUSTES = (function()",
  ajustes,
  "end)()",
  "do",
  servidor,
  "end",
  "do",
  casos,
  "end",
].join("\n");

const carpeta = mkdtempSync(join(tmpdir(), "nieve-"));
const archivo = join(carpeta, "prueba.luau");
writeFileSync(archivo, junto);

const luau = process.env.LUAU_BIN || "luau";
const salida = spawnSync(luau, [archivo], { stdio: "inherit" });
if (salida.error) {
  console.error(`no encuentro el interprete "${luau}".`);
  console.error("bajalo de https://github.com/luau-lang/luau/releases");
  console.error("o dime donde esta con LUAU_BIN=/ruta/al/luau");
  process.exit(1);
}
process.exit(salida.status ?? 1);
