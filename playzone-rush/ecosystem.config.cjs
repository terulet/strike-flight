/**
 * Configuracion de pm2 para el Mac Mini.
 *
 * El puerto vive aqui y no en el historial del shell a proposito: el 8787 ya
 * lo ocupa otra aplicacion en esa maquina (factura-limpia), y un "pm2 restart"
 * o un "pm2 resurrect" despues de reiniciar tiene que volver a levantar esto
 * en el 8788 sin que nadie se acuerde de escribir la variable.
 *
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'playzone',
      script: 'server/bin/start.mjs',
      cwd: __dirname,
      env: {
        PLAYZONE_PORT: '8788',
      },
      // El servidor guarda el error antes de morir, asi que reiniciar es
      // seguro: no se pierde el motivo de la caida.
      autorestart: true,
      max_restarts: 20,
      // Si revienta nada mas arrancar (build a medias, base de datos rota),
      // mejor parar que entrar en un bucle de reinicios.
      min_uptime: '20s',
    },
  ],
};
