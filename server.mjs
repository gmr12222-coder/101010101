// server.mjs
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Храним комнаты: Map<roomId, Set<WebSocket>>
const rooms = new Map();

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  const url = new URL(request.url, 'http://dummy');
  const roomId = url.searchParams.get('room');
  const peerId = url.searchParams.get('peer');

  if (!roomId || !peerId) {
    ws.close(4001, 'Missing room or peer ID');
    return;
  }

  // Проверяем: существует ли комната?
  const roomExists = rooms.has(roomId);

  // Только "host" может создать комнату, и только если её нет
  if (!roomExists) {
    if (peerId === 'host') {
      // Создаём комнату
      rooms.set(roomId, new Set());
      console.log(`Room ${roomId} created by host`);
    } else {
      // Зритель пытается подключиться к несуществующей комнате
      ws.close(4002, 'Room does not exist');
      return;
    }
  }

  const room = rooms.get(roomId);
  room.add(ws);

  console.log(`Peer ${peerId} joined room ${roomId}`);

  ws.on('message', (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      return;
    }

    // Дополнительно: можно добавить создание комнаты через сообщение,
    // но в текущей логике достаточно peerId="host"
    room.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  ws.on('close', () => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (no participants)`);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

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
