# Audio de terceros — licencias

**Estado actual: no hay ni un solo archivo de audio de terceros en este
repositorio.** Todo el sonido del juego se genera por síntesis en el
navegador, en tiempo real, dentro de `index.html`.

Esta página existe igualmente porque es el registro obligatorio del día
que entre el primero, y porque las reglas hay que fijarlas antes de
necesitarlas, no después.

---

## Por qué no hay archivos

No es una tarea pendiente por descuido. Es una decisión, y tiene tres
motivos:

1. **El juego tiene que funcionar con doble clic y sin conexión.** Con
   `file://` el navegador bloquea `fetch()`, así que `decodeAudioData()`
   no puede leer un `.mp3` del disco. Un juego que se queda mudo al
   abrirlo desde la carpeta no es un juego con audio: es un juego con
   audio a veces.
2. **Cero latencia de carga y cero peso.** Los 40 sonidos ocupan 0 bytes
   y suenan en el primer fotograma. Un pack equivalente son 3–6 MB que
   hay que descargar antes de la primera partida.
3. **Cero riesgo de licencia.** Lo sintetizado no tiene autor que
   acreditar ni condición que incumplir. Un pack «gratis» de procedencia
   dudosa metido en un juego que se publica es un problema legal
   esperando su turno.

Lo que sí falta —y está documentado como pendiente, no como hecho— es la
**música**. Ver más abajo.

---

## Lo que hay: 40 sonidos sintetizados

Motor completo en `index.html`, sección **MOTOR DE AUDIO**:

- Cuatro buses: `MASTER`, `MUSICA`, `SFX`, `UI`, cada uno con volumen
  propio y guardado en los ajustes del jugador.
- Compresor a la salida. No es adorno: con seis cañones a 6 disparos por
  segundo más tres explosiones, la suma de las voces se sale de rango y
  lo que se oye es un chasquido.
- Por sonido: prioridad, límite de voces simultáneas, espera mínima
  entre disparos y variación aleatoria de afinación.
- Tope global de 24 voces. Al llenarse solo entra lo que tiene prioridad
  ≥ 5: la explosión del jefe siempre, el impacto número treinta no.

| Familia | Sonidos |
|---|---|
| Armas del jugador | `cannon` `rapid` `plasma` `laser` `railgun` `electrico` `fuego` `cryo` `misil` `ultimate` |
| Enemigos | `ene_disparo` `ene_pesado` `sniper_lock` `sniper_aviso` `sniper_tiro` `kamikaze` `escudo_zumb` |
| Impactos | `imp_ligero` `imp_medio` `imp_pesado` `imp_escudo` |
| Explosiones | `exp_peq` `exp_med` `exp_grande` `exp_boss` |
| Sistema | `pickup` `mejora` `combo` `aviso` `boss_llega` `escudo_on` `bomba` `emp` `fase` |
| Interfaz | `ui_sel` `ui_ok` `ui_atras` `ui_no` |
| Partida | `mision_ini` `victoria` `derrota` |

---

## PENDIENTE: música

La arquitectura está puesta y sin usar, a propósito:

```js
const PISTAS = { menu:null, combate:null, jefe:null, victoria:null, derrota:null };
musica("jefe");   // ya se llama desde el juego; hoy no hace nada
```

El juego **ya pide las pistas en los momentos correctos** —menú, combate,
entrada de jefe, victoria, derrota—. En cuanto `PISTAS` apunte a
archivos reales en `audio/musica/`, suenan sin tocar una línea más.

No se ha metido música por dos razones, en este orden:

1. No integrar música mediocre solo por tener música. Una pista genérica
   en bucle hace que un juego parezca más barato, no más caro.
2. No integrar nada cuya licencia no se pueda verificar en la fuente
   original.

---

## Reglas para cuando entre audio externo

**Orden de preferencia de licencia:**

1. CC0 / dominio público
2. Royalty-free con uso comercial explícito
3. CC-BY, con la atribución publicada en el juego y aquí

**Prohibido, sin excepciones:** audio extraído de videojuegos, de
películas, de vídeos de YouTube, o de packs recopilados por terceros sin
enlace a la fuente original. Si no se puede abrir la página del autor y
leer la licencia, no entra.

**Ficha obligatoria por archivo.** Sin los doce campos, no se integra:

| Campo | |
|---|---|
| Nombre en el juego | `audio/sfx/xxx.ogg` |
| Nombre original | |
| Título | |
| Autor | |
| Página original | |
| URL de descarga | |
| Licencia | |
| URL de la licencia | |
| Uso comercial | sí / no |
| Atribución exigida | sí / no |
| Modificaciones | recorte, normalizado, conversión… |
| Fecha de descarga | |
| SHA-256 | |

**Cómo se integra.** `cargarMuestra(id, url)` en `index.html` registra un
archivo externo como un sonido más del catálogo, con su límite de voces y
su variación de afinación:

```js
cargarMuestra("exp_boss", "audio/sfx/exp_boss.ogg");
```

Y hay que dejar el sintetizado como repuesto: si la descarga falla o el
juego se abre con `file://`, `cargarMuestra` no sobrescribe nada y suena
la versión generada. El juego nunca se queda mudo.

---

## Registro de archivos integrados

_(vacío)_
