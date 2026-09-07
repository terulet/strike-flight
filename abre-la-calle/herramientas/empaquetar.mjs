#!/usr/bin/env node
/**
 * Escribe ABRE-LA-CALLE.rbxlx: el sitio de Roblox entero, con los tres
 * scripts ya puestos en su servicio y con su nombre y su tipo.
 *
 *   node abre-la-calle/herramientas/empaquetar.mjs
 *
 * Se abre con doble clic (o File > Open from File en Studio) y se le da a
 * Play. No hay que pegar nada a mano ni acertar con los nombres.
 *
 * Hay que volver a pasarlo cada vez que cambien los .luau, o el sitio se
 * queda con la version vieja dentro.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const leer = (p) => readFileSync(join(raiz, p), "utf8");

// Dentro de un CDATA no puede aparecer "]]>". El codigo Lua acaba muchos
// comentarios en "]]", asi que si algun dia uno queda pegado a un ">" hay
// que partir el bloque en dos.
function cdata(texto) {
  return "<![CDATA[" + texto.split("]]>").join("]]]]><![CDATA[>") + "]]>";
}

let siguiente = 0;
const ref = () => "RBX" + siguiente++;

function guion(clase, nombre, fuente) {
  return `    <Item class="${clase}" referent="${ref()}">
      <Properties>
        <string name="Name">${nombre}</string>
        <ProtectedString name="Source">${cdata(fuente)}</ProtectedString>
        <bool name="Disabled">false</bool>
      </Properties>
    </Item>`;
}

const ajustes = leer("src/ReplicatedStorage/Ajustes.luau");
const parcela = leer("src/ReplicatedStorage/Parcela.luau");
const servidor = leer("src/ServerScriptService/Juego.server.luau");
const cliente = leer("src/StarterPlayer/StarterPlayerScripts/Cliente.client.luau");

const sitio = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <Item class="Workspace" referent="${ref()}">
    <Properties>
      <string name="Name">Workspace</string>
      <bool name="StreamingEnabled">false</bool>
    </Properties>
  </Item>
  <Item class="Lighting" referent="${ref()}">
    <Properties>
      <string name="Name">Lighting</string>
      <!-- 3 = ShadowMap. Sin esto Roblox coge la iluminacion vieja
           ("Compatibilidad"), que esta obsoleta, y Studio saca un dialogo
           de migracion la primera vez que se abre el sitio. -->
      <token name="Technology">3</token>
      <bool name="GlobalShadows">true</bool>
    </Properties>
  </Item>
  <Item class="ReplicatedStorage" referent="${ref()}">
    <Properties>
      <string name="Name">ReplicatedStorage</string>
    </Properties>
${guion("ModuleScript", "Ajustes", ajustes)}
${guion("ModuleScript", "Parcela", parcela)}
  </Item>
  <Item class="ServerScriptService" referent="${ref()}">
    <Properties>
      <string name="Name">ServerScriptService</string>
    </Properties>
${guion("Script", "Juego", servidor)}
  </Item>
  <Item class="StarterPlayer" referent="${ref()}">
    <Properties>
      <string name="Name">StarterPlayer</string>
    </Properties>
    <Item class="StarterPlayerScripts" referent="${ref()}">
      <Properties>
        <string name="Name">StarterPlayerScripts</string>
      </Properties>
${guion("LocalScript", "Cliente", cliente)}
    </Item>
  </Item>
</roblox>
`;

const destino = join(raiz, "ABRE-LA-CALLE.rbxlx");
writeFileSync(destino, sitio);

// Comprobacion: el codigo que ha quedado dentro tiene que ser el mismo,
// caracter a caracter. Indentar el XML no puede tocar el Lua.
const dentro = sitio.match(/<!\[CDATA\[([\s\S]*?)\]\]>/g) || [];
const limpio = dentro.map((t) => t.slice(9, -3));
const originales = [ajustes, parcela, servidor, cliente];
for (let i = 0; i < originales.length; i++) {
  if (limpio[i] !== originales[i]) {
    console.error(
      `el archivo ${i + 1} ha cambiado al empaquetarlo ` +
        `(${originales[i].length} -> ${(limpio[i] || "").length} caracteres)`,
    );
    process.exit(1);
  }
}

const kb = (sitio.length / 1024).toFixed(0);
console.log(`escrito ${destino} (${kb} KB)`);
console.log(`dentro van los 4 scripts, identicos a los .luau`);
console.log("abrelo con doble clic y dale a Play.");
