# PLAYZONE RUSH en TestFlight

La app de iOS es el mismo juego, empaquetado con Capacitor. El frontend viaja
**dentro del binario**, no se descarga de ningun sitio: abre sin cobertura y
Apple ve una app, no una pagina web envuelta. Lo unico que sale a la red es la
API, que sigue viviendo en el Mac Server como hasta ahora.

- **Bundle ID**: `com.boab.playzonerush`
- **Backend**: `https://mac-mini-de-eloi.tail011c69.ts.net` (fijado en `.env.ios`)
- **Proyecto Xcode**: `ios/App/App.xcodeproj`, esquema `App`

---

## Construir

```bash
cd playzone-rush
npm run ios:open     # build de la app + sync + abre Xcode
```

`npm run ios` hace lo mismo sin abrir Xcode. Por debajo es
`vite build --mode ios`, que **no es** la build de la web: carga `.env.ios` y
ademas quita el atributo `crossorigin` del `index.html`.

> Ese detalle no es cosmetico. Dentro de `capacitor://localhost`, WebKit trata
> el modulo marcado como CORS de otra forma y **no lo ejecuta**: la app se abre
> en una pantalla negra, sin un solo error en consola. Lo hace el plugin
> `playzone-sin-crossorigin` de `vite.config.ts`, y solo en la build nativa.

Cada vez que cambie el juego hay que volver a pasar `npm run ios`, o la app
seguira llevando dentro la version anterior.

## Subirlo (esto necesita tus manos)

Son los pasos que no puede dar nadie por ti, porque van con tu cuenta de Apple.

1. **Xcode → App → Signing & Capabilities**: elige tu equipo (el Individual) y
   deja marcado *Automatically manage signing*. La primera vez, Xcode registra
   el bundle ID `com.boab.playzonerush` en el portal.
2. **App Store Connect → Apps → +**: crea la app con ese mismo bundle ID. Nombre
   sugerido: PLAYZONE RUSH. Es un tramite: para TestFlight no hace falta ni
   captura ni descripcion de tienda.
3. **Sube el numero de build** antes de cada envio (`CURRENT_PROJECT_VERSION`).
   App Store Connect rechaza un build repetido, aunque el codigo haya cambiado.
4. **Xcode → Product → Destination → Any iOS Device**, y luego
   **Product → Archive**. Cuando termine: *Distribute App → TestFlight & App
   Store → Upload*.
5. En App Store Connect, pestana **TestFlight**, el build aparece en unos
   minutos como *Processing*.

## Quien lo prueba

- **Internos** (hasta 100): no pasan revision, pero cada uno necesita ser
  usuario de tu App Store Connect. Es dar acceso a tu cuenta de desarrollador,
  aunque sea con el rol mas limitado.
- **Externos** (hasta 10.000): les basta su email, pero el primer build pasa
  **Beta App Review** de Apple, normalmente en un dia.

Para los cinco de la alfa, externos es lo sensato: un email y ya esta, sin
meterlos en tu cuenta.

### El aviso honesto

Apple rechaza de forma rutinaria las apps que son una web envuelta sin nada
propio (guideline **4.2, Minimum Functionality**). Aqui juega a favor que el
juego va dentro del binario y funciona sin conexion, pero si la rechazan, lo
que pide Apple es algo que solo pueda hacer la app nativa: notificaciones push
("Marc te ha quitado el #1"), Game Center o haptics de verdad.

La push encaja con el juego, no seria un adorno para pasar la revision. Es el
camino natural si el M4 llega hasta aqui.

## Lo que la app hace distinto de la web

Todo sale de `VITE_NATIVE`, que solo existe en la build nativa:

- **Sin service worker**: los ficheros ya estan dentro; ahi no aporta nada.
- **Sin aviso de "hay version nueva"**: recargar no cambiaria nada, porque el
  frontend es el del binario. Las versiones las anuncia TestFlight.
- **Sin el cartel de "anadelo a la pantalla de inicio"**: ya esta instalada.

Y compartir un grupo sigue mandando el enlace **web** (`VITE_PUBLIC_URL`), no
`capacitor://localhost`, que no le serviria a nadie: quien recibe la invitacion
puede no tener la app.
