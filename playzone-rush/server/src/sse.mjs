/**
 * Server-Sent Events: la forma mas barata de tener "tiempo real" sin websockets
 * ni dependencias. Un GET que se queda abierto y por el que empujamos la foto
 * del grupo cada vez que cambia algo.
 */
export function createHub() {
  /** groupId -> Set<res> */
  const rooms = new Map();
  let heartbeat = null;

  function subscribe(groupId, res) {
    let room = rooms.get(groupId);
    if (!room) {
      room = new Set();
      rooms.set(groupId, room);
    }
    room.add(res);
    res.on('close', () => {
      room.delete(res);
      if (room.size === 0) rooms.delete(groupId);
    });
    if (heartbeat === null) startHeartbeat();
  }

  function publish(groupId, payload) {
    const room = rooms.get(groupId);
    if (!room || room.size === 0) return 0;
    const frame = `event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`;
    let sent = 0;
    for (const res of room) {
      try {
        res.write(frame);
        sent++;
      } catch {
        room.delete(res);
      }
    }
    return sent;
  }

  function startHeartbeat() {
    // Un comentario cada 25 s evita que proxies y moviles corten la conexion.
    heartbeat = setInterval(() => {
      for (const room of rooms.values()) {
        for (const res of room) {
          try {
            res.write(': ping\n\n');
          } catch {
            room.delete(res);
          }
        }
      }
    }, 25_000);
    heartbeat.unref?.();
  }

  function close() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    for (const room of rooms.values()) {
      for (const res of room) {
        try {
          res.end();
        } catch {
          /* da igual, ya se estaba cerrando */
        }
      }
    }
    rooms.clear();
  }

  return { subscribe, publish, close, get size() {
    let total = 0;
    for (const room of rooms.values()) total += room.size;
    return total;
  } };
}
