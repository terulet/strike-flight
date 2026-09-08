#!/usr/bin/env node
/**
 * Escribe LA-GRAN-TORMENTA.rbxmx: los siete scripts en UN solo archivo,
 * para meterlos en un sitio de Roblox que ya exista.
 *
 *   node la-gran-tormenta/herramientas/empaquetar-modelo.mjs
 *
 * No es lo mismo que el .rbxlx. El .rbxlx es el sitio ENTERO y se abre y
 * se juega; este es solo el codigo, para injertarlo en otro sitio.
 *
 * Van en tres carpetas con el nombre del servicio al que hay que
 * llevarlos, y no es adorno: Ajustes y Parcela se buscan con
 * ReplicatedStorage:WaitForChild(...), que NO mira dentro de carpetas, y
 * Juego busca a Mundo, Guardado y Tormenta como hermanos suyos. Si algo
 * acaba en el sitio equivocado, el juego se queda esperando para siempre
 * sin decir por que.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");

// Dentro de un CDATA no puede aparecer "]]>".
function cdata(texto) {
  return "<![CDATA[" + texto.split("]]>").join("]]]]><![CDATA[>") + "]]>";
}

let siguiente = 0;
const ref = () => "RBX" + siguiente++;

function guion(clase, nombre, fuente, sangria) {
  const s = " ".repeat(sangria);
  return `${s}<Item class="${clase}" referent="${ref()}">
${s}  <Properties>
${s}    <string name="Name">${nombre}</string>
${s}    <ProtectedString name="Source">${cdata(fuente)}</ProtectedString>
${s}    <bool name="Disabled">false</bool>
${s}  </Properties>
${s}</Item>`;
}

function carpeta(nombre, dentro, sangria) {
  const s = " ".repeat(sangria);
  return `${s}<Item class="Folder" referent="${ref()}">
${s}  <Properties>
${s}    <string name="Name">${nombre}</string>
${s}  </Properties>
${dentro.join("\n")}
${s}</Item>`;
}

const ajustes = leer("src/ReplicatedStorage/Ajustes.luau");
const parcela = leer("src/ReplicatedStorage/Parcela.luau");
const mundo = leer("src/ServerScriptService/Mundo.luau");
const guardado = leer("src/ServerScriptService/Guardado.luau");
const tormenta = leer("src/ServerScriptService/Tormenta.luau");
const servidor = leer("src/ServerScriptService/Juego.server.luau");
const cliente = leer("src/StarterPlayer/StarterPlayerScripts/Cliente.client.luau");

const modelo = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
${carpeta(
  "LA GRAN TORMENTA (vacia las 3 carpetas y borrame)",
  [
    carpeta(
      "1 - a ReplicatedStorage",
      [guion("ModuleScript", "Ajustes", ajustes, 8), guion("ModuleScript", "Parcela", parcela, 8)],
      6,
    ),
    carpeta(
      "2 - a ServerScriptService",
      [
        guion("ModuleScript", "Mundo", mundo, 8),
        guion("ModuleScript", "Guardado", guardado, 8),
        guion("ModuleScript", "Tormenta", tormenta, 8),
        guion("Script", "Juego", servidor, 8),
      ],
      6,
    ),
    carpeta("3 - a StarterPlayer > StarterPlayerScripts", [guion("LocalScript", "Cliente", cliente, 8)], 6),
  ],
  2,
)}
</roblox>
`;

const destino = join(raiz, "LA-GRAN-TORMENTA.rbxmx");
writeFileSync(destino, modelo);

// El codigo que ha quedado dentro tiene que ser el mismo, caracter a
// caracter. Indentar el XML no puede tocar el Lua.
const dentro = modelo.match(/<!\[CDATA\[([\s\S]*?)\]\]>/g) || [];
const limpio = dentro.map((t) => t.slice(9, -3));
const originales = [ajustes, parcela, mundo, guardado, tormenta, servidor, cliente];
if (limpio.length !== originales.length) {
  console.error(`esperaba ${originales.length} scripts dentro y hay ${limpio.length}`);
  process.exit(1);
}
for (let i = 0; i < originales.length; i++) {
  if (limpio[i] !== originales[i]) {
    console.error(
      `el archivo ${i + 1} ha cambiado al empaquetarlo ` +
        `(${originales[i].length} -> ${(limpio[i] || "").length} caracteres)`,
    );
    process.exit(1);
  }
}

const kb = (modelo.length / 1024).toFixed(0);
console.log(`escrito ${destino} (${kb} KB)`);
console.log("dentro van los 7 scripts, identicos a los .luau");
console.log("en Studio: clic derecho en Workspace > Insert from File");
