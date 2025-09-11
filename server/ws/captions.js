import * as WS from 'ws'; // works with CJS & ESM builds of ws
const WebSocketServer = WS.WebSocketServer || WS.Server; // support both shapes
const WebSocket = WS.WebSocket || WS; // default export is the WebSocket ctor in CJS

if (!WebSocketServer) {
  throw new Error(
    "Failed to load WebSocketServer from 'ws'. Make sure 'ws' is installed in the server package."
  );
}

export function attachCaptionWS(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws/captions')) return; // skip other upgrades
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws.send(JSON.stringify({ type: 'hello', ok: true }));
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'partial', text: `mock caption ${i}` }));
        if (i >= 10) {
          ws.send(JSON.stringify({ type: 'final', text: `final caption ${i}` }));
        }
      }
    }, 1200);

    ws.on('close', () => clearInterval(timer));
    ws.on('error', () => clearInterval(timer));
  });
}
