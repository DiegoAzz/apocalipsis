const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Store custom room images in memory so any player joining a room sees the uploaded picture
const roomImages = new Map();

// Upload room image for shared multiplayer obliteration
app.post('/api/upload-room-image', (req, res) => {
  const { roomId, imageBase64 } = req.body;
  if (!roomId || !imageBase64) return res.status(400).json({ error: 'Missing roomId or image' });

  const targetRoomId = (roomId || 'lobby').trim().toLowerCase();
  const room = getOrCreateRoom(targetRoomId);

  const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    roomImages.set(targetRoomId, { mimeType, buffer });
  } else {
    roomImages.set(targetRoomId, { mimeType: 'image/jpeg', buffer: Buffer.from(imageBase64, 'base64') });
  }

  const imageUrl = `/api/room-image/${targetRoomId}?t=${Date.now()}`;
  room.preset = 'image';
  room.url = imageUrl;
  room.craters = [];

  io.to(targetRoomId).emit('map-changed', {
    preset: 'image',
    url: imageUrl
  });

  res.json({ success: true, url: imageUrl });
});

// Serve room custom image
app.get('/api/room-image/:roomId', (req, res) => {
  const targetRoomId = (req.params.roomId || 'lobby').trim().toLowerCase();
  const data = roomImages.get(targetRoomId);
  if (!data) return res.status(404).send('No image for this room');

  res.set('Content-Type', data.mimeType || 'image/jpeg');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(data.buffer);
});

// Proxy image endpoint to prevent canvas cross-origin taint
app.get('/api/proxy-image', async (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl) return res.status(400).send('Missing url');
  try {
    const response = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!response.ok) throw new Error('Fetch failed');
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Failed to fetch image');
  }
});

// Real Webpage Screenshot Renderer (Captures exact authentic visual look of ANY URL)
app.get('/api/screenshot-url', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1280`;
    const response = await fetch(screenshotUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', 'image/jpeg');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    console.error('[SCREENSHOT API ERROR]:', err.message);
    res.status(500).send('Failed to capture screenshot');
  }
});

function cleanHtmlEntity(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

// Real Webpage Parser: Fetches HTML and converts into structured layout blocks
app.get('/api/parse-url', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  let domain = 'website.com';
  try {
    const parsedUrl = new URL(targetUrl);
    domain = parsedUrl.hostname.replace('www.', '');
  } catch (e) {
    domain = targetUrl;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? cleanHtmlEntity(titleMatch[1]) : domain;

    // Extract Meta Description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? cleanHtmlEntity(descMatch[1]) : `Explore the latest news and content on ${domain}.`;

    // Extract Headings (H1, H2, H3)
    const headings = [];
    const hRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match;
    while ((match = hRegex.exec(html)) !== null && headings.length < 12) {
      const cleanText = cleanHtmlEntity(match[2]);
      if (cleanText.length > 3 && cleanText.length < 120 && !/^[\s.,:;_-]+$/.test(cleanText)) {
        headings.push({ level: parseInt(match[1]), text: cleanText });
      }
    }

    // Extract Paragraphs (<p>)
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(html)) !== null && paragraphs.length < 16) {
      const cleanText = cleanHtmlEntity(match[1]);
      if (cleanText.length > 30 && cleanText.length < 400 && !/^[\s.,:;_-]+$/.test(cleanText)) {
        paragraphs.push(cleanText);
      }
    }

    // Extract Images (convert relative to absolute)
    const images = [];
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    while ((match = imgRegex.exec(html)) !== null && images.length < 6) {
      let src = match[1];
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) src = new URL(src, targetUrl).href;
      else if (!src.startsWith('http')) src = new URL(src, targetUrl).href;

      if (!src.includes('.svg') && !src.includes('tracker') && !src.includes('pixel')) {
        images.push(src);
      }
    }

    // Fallback if page was mostly JS/SPA
    if (headings.length === 0) {
      headings.push({ level: 1, text: title || domain });
      headings.push({ level: 2, text: `Overview of ${domain}` });
      headings.push({ level: 2, text: `Features & Services` });
    }
    if (paragraphs.length === 0) {
      paragraphs.push(description);
      paragraphs.push(`Welcome to ${domain}. All content, banners, headings and text on this website have been compiled into physical pixel-art colliders.`);
      paragraphs.push(`Use your arsenal of 10 weapons to tear down the page layout, carve craters through the text, and fight other players in multiplayer!`);
    }

    res.json({
      success: true,
      url: targetUrl,
      domain,
      title,
      description,
      headings,
      paragraphs,
      images
    });

  } catch (err) {
    // Return structured fallback for blocked/SPA sites
    console.warn(`[PARSE URL] Could not fetch ${targetUrl}: ${err.message}, generating fallback.`);
    res.json({
      success: true,
      url: targetUrl,
      domain,
      title: `${domain.toUpperCase()} - Official Webpage`,
      description: `Welcome to ${domain}. Fully destructible web arena prepared.`,
      headings: [
        { level: 1, text: `${domain.toUpperCase()}` },
        { level: 2, text: 'Top Headlines & Featured News' },
        { level: 2, text: 'Global Network & Architecture' },
        { level: 3, text: 'Interactive Destructible Playground' }
      ],
      paragraphs: [
        `This is a real-time recreation of ${domain}. Every single element, paragraph, box, and column is fully destructible.`,
        `Equip your Rocket Launcher, Railgun, or Shotgun to obliterate headers, blast holes through articles, and engage in high-speed jetpack battles with other operatives.`,
        `Track total obliteration progress with the live percentage meter at the top of the screen. Happy destroying!`
      ],
      images: []
    });
  }
});

// In-memory rooms state
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      preset: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Stick_figure',
      craters: [],
      players: new Map(),
      bots: new Map(),
      chatHistory: [],
      seed: Math.floor(Math.random() * 1000000),
      createdAt: Date.now()
    });
  }
  return rooms.get(roomId);
}

// Clean empty rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (roomId !== 'lobby' && room.players.size === 0 && now - room.createdAt > 300000) {
      rooms.delete(roomId);
    }
  }
}, 60000);

getOrCreateRoom('lobby');

io.on('connection', (socket) => {
  let currentRoomId = null;
  let playerId = socket.id;

  socket.on('join-room', ({ room, name, skinColor }) => {
    const targetRoomId = (room || 'lobby').trim().toLowerCase();
    currentRoomId = targetRoomId;
    socket.join(targetRoomId);

    const roomData = getOrCreateRoom(targetRoomId);

    // Dynamic Futuristic Operative Colors for Multiplayer
    const MULTIPLAYER_COLORS = [
      '#38bdf8', // Neon Cyan / Electric Blue
      '#22c55e', // Acid Neon Green
      '#a855f7', // Cyber Purple
      '#ec4899', // Hot Pink
      '#eab308', // Solar Yellow
      '#ef4444', // Crimson Red
      '#06b6d4', // Teal
      '#f97316'  // Futuristic Orange
    ];

    // Guarantee each player entering multiplayer has a distinct visor/suit light color
    const usedColors = new Set(Array.from(roomData.players.values()).map(p => p.color));
    let assignedColor = skinColor;
    if (!assignedColor || (roomData.players.size > 0 && assignedColor === '#f97316') || usedColors.has(assignedColor)) {
      assignedColor = MULTIPLAYER_COLORS.find(c => !usedColors.has(c)) || MULTIPLAYER_COLORS[roomData.players.size % MULTIPLAYER_COLORS.length];
    }

    const newPlayer = {
      id: playerId,
      name: (name || 'Operative').slice(0, 16),
      color: assignedColor,
      x: 300 + Math.random() * 600,
      y: 150,
      vx: 0,
      vy: 0,
      angle: 0,
      facing: 1,
      jetpack: false,
      weaponIndex: 0,
      health: 100,
      maxHealth: 100,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      score: 0
    };

    roomData.players.set(playerId, newPlayer);

    socket.emit('init-state', {
      selfId: playerId,
      assignedColor: assignedColor,
      preset: roomData.preset,
      url: roomData.url,
      seed: roomData.seed,
      craters: roomData.craters.slice(-500),
      players: Array.from(roomData.players.values()),
      bots: Array.from(roomData.bots.values()),
      chatHistory: roomData.chatHistory.slice(-20)
    });

    socket.to(targetRoomId).emit('player-joined', newPlayer);

    const joinMsg = {
      sender: 'SYSTEM',
      color: '#fbbf24',
      text: `${newPlayer.name} joined the fray!`,
      time: Date.now()
    };
    roomData.chatHistory.push(joinMsg);
    io.to(targetRoomId).emit('chat-message', joinMsg);
  });

  socket.on('change-name', ({ name }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player && name) {
      const cleanName = String(name).trim().slice(0, 16) || 'Operativo';
      const oldName = player.name;
      player.name = cleanName;
      // Broadcast to ALL players in this room so both PC and Mobile update in real-time
      io.to(currentRoomId).emit('player-renamed', {
        id: playerId,
        name: cleanName,
        oldName
      });
    }
  });

  socket.on('player-update', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player) {
      if (data.name && data.name !== player.name) {
        player.name = String(data.name).trim().slice(0, 16);
      }
      Object.assign(player, data, { id: playerId });
      socket.to(currentRoomId).emit('player-moved', player);
    }
  });

  socket.on('player-shoot', (shootData) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('player-shot', {
      ...shootData,
      playerId
    });
  });

  socket.on('player-grenade', (grenadeData) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('player-threw-grenade', {
      ...grenadeData,
      playerId
    });
  });

  socket.on('terrain-damage', (damageData) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.craters.push({
      x: Math.round(damageData.x),
      y: Math.round(damageData.y),
      r: Math.round(damageData.radius),
      w: damageData.weapon
    });
    if (room.craters.length > 3000) {
      room.craters.splice(0, 500);
    }

    socket.to(currentRoomId).emit('terrain-damaged', damageData);
  });

  socket.on('player-hit', ({ targetId, damage, weapon, attackerId }) => {
    // Mode: Cooperative Website Destruction - No damage between players!
    return;
  });

  socket.on('player-respawn', ({ x, y }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const p = room.players.get(playerId);
    if (p) {
      p.health = p.maxHealth || 100;
      p.x = x || 300 + Math.random() * 600;
      p.y = 150;
      io.to(currentRoomId).emit('player-respawned', {
        id: playerId,
        x: p.x,
        y: p.y,
        health: p.health
      });
    }
  });

  socket.on('spawn-bot', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const botId = 'bot_' + Math.random().toString(36).substring(2, 8);
    const botNames = ['PixelBot', 'Glitch99', 'TurboRecon', 'CyberGhost', 'Destructor', 'ByteBlade', 'HexaGun'];
    const botColors = ['#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

    const newBot = {
      id: botId,
      name: botNames[Math.floor(Math.random() * botNames.length)] + '#' + Math.floor(Math.random() * 90 + 10),
      color: botColors[Math.floor(Math.random() * botColors.length)],
      isBot: true,
      x: 200 + Math.random() * 800,
      y: 200,
      vx: 0,
      vy: 0,
      angle: 0,
      facing: 1,
      jetpack: false,
      weaponIndex: Math.floor(Math.random() * 5),
      health: 100,
      maxHealth: 100,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      score: 0
    };

    room.bots.set(botId, newBot);
    io.to(currentRoomId).emit('bot-spawned', newBot);
  });

  socket.on('chat-message', ({ text }) => {
    if (!currentRoomId || !text) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    const cleanText = text.trim().slice(0, 140);
    if (!cleanText) return;

    const chatMsg = {
      sender: player.name,
      color: player.color,
      text: cleanText,
      time: Date.now()
    };

    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 50) room.chatHistory.shift();

    io.to(currentRoomId).emit('chat-message', chatMsg);
  });

  socket.on('change-map', ({ preset, url, pageData }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.preset = preset || 'wikipedia';
    room.url = url || '';
    room.craters = [];
    room.seed = Math.floor(Math.random() * 1000000);

    for (const player of room.players.values()) {
      player.health = 100;
      player.x = 300 + Math.random() * 600;
      player.y = 150;
    }
    for (const bot of room.bots.values()) {
      bot.health = 100;
      bot.x = 200 + Math.random() * 800;
      bot.y = 180;
    }

    io.to(currentRoomId).emit('map-changed', {
      preset: room.preset,
      url: room.url,
      seed: room.seed,
      pageData
    });
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      const player = room.players.get(playerId);
      if (player) {
        room.players.delete(playerId);
        socket.to(currentRoomId).emit('player-left', playerId);

        const leaveMsg = {
          sender: 'SYSTEM',
          color: '#9ca3af',
          text: `${player.name} left the arena.`,
          time: Date.now()
        };
        room.chatHistory.push(leaveMsg);
        io.to(currentRoomId).emit('chat-message', leaveMsg);
      }
    }
  });
});

app.get('/api/rooms', (req, res) => {
  const result = [];
  for (const [id, r] of rooms.entries()) {
    result.push({
      id,
      preset: r.preset,
      playerCount: r.players.size,
      botCount: r.bots.size
    });
  }
  res.json(result);
});

server.listen(PORT, () => {
  console.log(`[DESTROY ANY WEBSITE] Server running at http://localhost:${PORT}`);
});
