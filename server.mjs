// server.mjs
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Храним комнаты: Map<roomId, Set<WebSocket>>
const rooms = new Map();

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  // Парсим URL: /?room=abc123&peer=user456
  const url = new URL(request.url, 'http://dummy');
  const roomId = url.searchParams.get('room');
  const peerId = url.searchParams.get('peer');

  if (!roomId || !peerId) {
    ws.close(4001, 'Missing room or peer ID');
    return;
  }

  console.log(`Peer ${peerId} joined room ${roomId}`);

  // Создаём комнату, если нет
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const room = rooms.get(roomId);
  room.add(ws);

  // Рассылаем сообщения внутри комнаты
  ws.on('message', (data) => {
    console.log(`Room ${roomId}: ${data}`);
    room.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  // Удаляем при отключении
  ws.on('close', () => {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted`);
    }
  });
});

// HTTP-сервер для совместимости с Render
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});