#!/usr/bin/env node
/**
 * Minimal WebSocket relay for Loop cross-device demos.
 *
 * Usage:
 *   node scripts/relay-server.mjs
 *   node scripts/relay-server.mjs 9000
 *
 * Clients connect to ws://HOST:PORT/ROOM_CODE
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const port = Number(process.argv[2] ?? 8787);
const rooms = new Map();

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Loop relay server — connect via WebSocket at /ROOM_CODE\n");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const room = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!room) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, room);
  });
});

wss.on("connection", (ws, room) => {
  let peers = rooms.get(room);
  if (!peers) {
    peers = new Set();
    rooms.set(room, peers);
  }
  peers.add(ws);

  ws.on("message", (data) => {
    const text = Buffer.isBuffer(data)
      ? data.toString("utf8")
      : typeof data === "string"
        ? data
        : String(data);
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        peer.send(text);
      }
    }
  });

  ws.on("close", () => {
    peers.delete(ws);
    if (peers.size === 0) {
      rooms.delete(room);
    }
  });
});

server.listen(port, () => {
  console.log(`Loop relay listening on ws://0.0.0.0:${port}/ROOM_CODE`);
});
