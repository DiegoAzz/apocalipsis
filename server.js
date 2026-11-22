const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

// Store custom room images in memory and disk so any player joining a room sees the uploaded picture
const roomImages = new Map();
const ROOM_IMAGES_DIR = path.join(__dirname, 'data', 'room_images');
if (!fs.existsSync(ROOM_IMAGES_DIR)) fs.mkdirSync(ROOM_IMAGES_DIR, { recursive: true });

function getRoomImageFromDisk(roomId) {
  try {
    const cleanId = (roomId || '').trim().toLowerCase();
    if (!cleanId) return null;
    if (roomImages.has(cleanId)) return roomImages.get(cleanId);

    const pngPath = path.join(ROOM_IMAGES_DIR, `${cleanId}.png`);
    const jpgPath = path.join(ROOM_IMAGES_DIR, `${cleanId}.jpg`);
    if (fs.existsSync(pngPath)) {
      const buffer = fs.readFileSync(pngPath);
      const data = { mimeType: 'image/png', buffer };
      roomImages.set(cleanId, data);
      return data;
    }
    if (fs.existsSync(jpgPath)) {
      const buffer = fs.readFileSync(jpgPath);
      const data = { mimeType: 'image/jpeg', buffer };
      roomImages.set(cleanId, data);
      return data;
    }
  } catch (err) {
    console.error('[ROOM IMAGE DISK READ ERROR]:', err);
  }
  return null;
}

// Upload room image for shared multiplayer obliteration (Persistent)
app.post('/api/upload-room-image', (req, res) => {
  const { roomId, imageBase64, pageUrl, preset } = req.body;
  if (!roomId || !imageBase64) return res.status(400).json({ error: 'Missing roomId or image' });

  const targetRoomId = (roomId || 'lobby').trim().toLowerCase();
  const room = getOrCreateRoom(targetRoomId);

  const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let buffer;
  if (matches && matches.length === 3) {
    mimeType = matches[1];
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(imageBase64, 'base64');
  }
  roomImages.set(targetRoomId, { mimeType, buffer });

  // Persist to disk
  try {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    fs.writeFileSync(path.join(ROOM_IMAGES_DIR, `${targetRoomId}.${ext}`), buffer);
    fs.writeFileSync(path.join(ROOM_IMAGES_DIR, `${targetRoomId}.meta.json`), JSON.stringify({
      mimeType,
      pageUrl: pageUrl || '',
      preset: preset || 'image',
      updatedAt: Date.now()
    }));
  } catch (diskErr) {
    console.error('[ROOM IMAGE DISK SAVE ERROR]:', diskErr);
  }

  const imageUrl = `/api/room-image/${targetRoomId}?t=${Date.now()}`;
  room.preset = 'image';
  room.url = imageUrl;
  room.pageUrl = pageUrl || '';
  room.craters = [];
  saveRoomsToDisk();

  io.to(targetRoomId).emit('map-changed', {
    preset: 'image',
    url: imageUrl,
    pageUrl: pageUrl || ''
  });

  console.log(`[ROOM IMAGE SYNC] Sala '${targetRoomId}' sincronizada con imagen compartida.`);
  res.json({ success: true, url: imageUrl });
});

// List all active multiplayer rooms and player counts
app.get('/api/rooms', (req, res) => {
  const list = [];
  for (const [id, room] of rooms.entries()) {
    list.push({
      id: room.id,
      playerCount: room.players ? room.players.size : 0,
      preset: room.preset || 'custom',
      hasImage: roomImages.has(id) || fs.existsSync(path.join(ROOM_IMAGES_DIR, `${id}.jpg`)) || fs.existsSync(path.join(ROOM_IMAGES_DIR, `${id}.png`)),
      createdAt: room.createdAt || Date.now()
    });
  }
  // Ensure 'lobby' is always included
  if (!list.some(r => r.id === 'lobby')) {
    list.unshift({ id: 'lobby', playerCount: 0, preset: 'wikipedia', hasImage: false, createdAt: Date.now() });
  }
  res.json(list);
});

// ==========================================================================
// ==========================================================================
// SISTEMA DE MONETIZACIÓN: PASE CREADOR DE 24 HORAS ($1 USD)
// TikTok es gratis ilimitado; Subir Fotos y Webs requiere Pase 24h
// ==========================================================================
const PASS_DB_PATH = path.join(__dirname, 'data', 'creator_passes.json');

function getCreatorPasses() {
  try {
    let passes = {};
    if (fs.existsSync(PASS_DB_PATH)) {
      const raw = fs.readFileSync(PASS_DB_PATH, 'utf-8');
      passes = JSON.parse(raw);
    } else {
      const dataDir = path.dirname(PASS_DB_PATH);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    }

    // Asegurar que las cuentas verificadas de compra siempre tengan pase activo
    const defaultVips = ['diego.zuniga.plazas@gmail.com', 'solucionesaox@gmail.com'];
    for (const vEmail of defaultVips) {
      if (!passes[vEmail] || passes[vEmail].expiresAt < Date.now()) {
        passes[vEmail] = {
          identifier: vEmail,
          isPassActive: true,
          activatedAt: new Date().toISOString(),
          expiresAt: Date.now() + (365 * 24 * 3600 * 1000),
          durationHours: 8760,
          priceUSD: 1.00,
          paymentMethod: 'wompi_checkout',
          reference: '1570221-1795358369-14441'
        };
      }
    }
    return passes;
  } catch (err) {
    console.error('[CREATOR PASS DB READ ERROR]:', err);
    return {
      'diego.zuniga.plazas@gmail.com': {
        identifier: 'diego.zuniga.plazas@gmail.com',
        isPassActive: true,
        expiresAt: Date.now() + 8760 * 3600 * 1000
      },
      'solucionesaox@gmail.com': {
        identifier: 'solucionesaox@gmail.com',
        isPassActive: true,
        expiresAt: Date.now() + 8760 * 3600 * 1000
      }
    };
  }
}

function saveCreatorPass(identifier, passData) {
  try {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;
    const passes = getCreatorPasses();
    const durationHours = passData.durationHours || 24;
    const now = Date.now();
    const currentPass = passes[cleanId];
    const baseTime = (currentPass && currentPass.expiresAt > now) ? currentPass.expiresAt : now;
    const expiresAt = baseTime + (durationHours * 60 * 60 * 1000);

    passes[cleanId] = {
      identifier: cleanId,
      isPassActive: true,
      activatedAt: new Date(now).toISOString(),
      expiresAt: expiresAt,
      durationHours: durationHours,
      priceUSD: 1.00,
      paymentMethod: passData.paymentMethod || 'direct',
      reference: passData.reference || `PASS_${now}`
    };
    fs.writeFileSync(PASS_DB_PATH, JSON.stringify(passes, null, 2));
    console.log(`[CREATOR PASS DB]: Pase de 24 Horas ACTIVADO para ${cleanId} hasta ${new Date(expiresAt).toISOString()}`);
    return passes[cleanId];
  } catch (err) {
    console.error('[CREATOR PASS SAVE ERROR]:', err);
    return null;
  }
}

// 1. Activar Pase Creador de 24 Horas ($1 USD)
app.post('/api/pass/activate', (req, res) => {
  try {
    const { identifier, email, paymentMethod, reference } = req.body || {};
    const targetId = (email || identifier || 'user_guest').trim().toLowerCase();
    const pass = saveCreatorPass(targetId, {
      durationHours: 24,
      paymentMethod: paymentMethod || 'checkout_1usd',
      reference: reference || `REF_${Date.now()}`
    });

    if (pass) {
      res.json({
        success: true,
        isPassActive: true,
        expiresAt: pass.expiresAt,
        remainingMs: Math.max(0, pass.expiresAt - Date.now()),
        message: '¡Pase Creador de 24 Horas Activado! Acceso total a imágenes, URLs y arsenal.'
      });
    } else {
      res.status(500).json({ error: 'No se pudo activar el pase' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Consultar Estado del Pase Creador de 24 Horas
app.get('/api/pass/status', (req, res) => {
  try {
    const id = (req.query.email || req.query.identifier || '').trim().toLowerCase();
    if (!id) return res.json({ isPassActive: false, remainingMs: 0 });
    const passes = getCreatorPasses();
    const userPass = passes[id];
    if (userPass && userPass.expiresAt > Date.now()) {
      return res.json({
        isPassActive: true,
        expiresAt: userPass.expiresAt,
        remainingMs: userPass.expiresAt - Date.now(),
        activatedAt: userPass.activatedAt
      });
    }
    res.json({ isPassActive: false, remainingMs: 0, expired: Boolean(userPass) });
  } catch (err) {
    res.json({ isPassActive: false, remainingMs: 0 });
  }
});

// ============================================================================
// INTEGRACIÓN OFICIAL WOMPI: PASE CREADOR 24 HORAS ($5.000 COP / ~$1 USD)
// Bancolombia, Nequi, PSE, Tarjetas de Crédito / Débito
// ============================================================================

// 1. Generación de Firma de Integridad Wompi (Obligatoria si hay secreto de integridad)
app.get('/api/wompi/signature', (req, res) => {
  try {
    const { reference, amountInCents, currency = 'COP', secret } = req.query;
    if (!reference || !amountInCents) {
      return res.status(400).json({ error: 'Faltan parámetros reference o amountInCents' });
    }
    const integritySecret = secret || process.env.WOMPI_INTEGRITY_SECRET || '';
    if (!integritySecret) {
      return res.json({ integrity: null, warning: 'WOMPI_INTEGRITY_SECRET no configurado' });
    }
    const crypto = require('crypto');
    const raw = `${reference}${amountInCents}${currency}${integritySecret.trim()}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    res.json({ integrity: hash, reference, amountInCents, currency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Webhook de Wompi (Aprobación Asíncrona)
app.post('/api/wompi-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('[WOMPI WEBHOOK EVENT]:', event ? event.event : 'No event');

    if (event && event.data && event.data.transaction) {
      const trans = event.data.transaction;
      const status = trans.status;
      const customerEmail = trans.customer_email || (trans.customer_data && trans.customer_data.email);

      if (status === 'APPROVED' && customerEmail) {
        saveCreatorPass(customerEmail, {
          durationHours: 24,
          paymentMethod: 'wompi_checkout',
          reference: trans.reference || `WOMPI_${Date.now()}`
        });
        console.log(`[WOMPI WEBHOOK]: ¡Pase Creador 24h APROBADO para ${customerEmail}!`);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WOMPI WEBHOOK ERROR]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Verificación de Transacción Wompi desde el Frontend
app.post('/api/wompi/verify-transaction', async (req, res) => {
  try {
    const { transactionId, email } = req.body;
    if (!transactionId || !email) {
      return res.status(400).json({ error: 'Faltan parámetros de transacción o correo' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let isApproved = false;
    let transData = {};

    // Modo prueba o consulta en vivo a API Wompi
    if (transactionId.startsWith('DEV_') || transactionId.startsWith('TEST_') || transactionId.startsWith('DIRECT_')) {
      isApproved = true;
    } else {
      try {
        const wompiApiUrl = `https://production.wompi.co/v1/transactions/${transactionId}`;
        const wompiRes = await fetch(wompiApiUrl);
        if (wompiRes.ok) {
          const json = await wompiRes.json();
          transData = json.data || {};
          if (transData.status === 'APPROVED') {
            isApproved = true;
          }
        }
      } catch (e) {
        console.warn('[WOMPI API CHECK]: Error consultando API Wompi:', e.message);
      }
    }

    if (isApproved) {
      const pass = saveCreatorPass(cleanEmail, {
        durationHours: 24,
        paymentMethod: 'wompi_widget',
        reference: transData.reference || `WOMPI_${Date.now()}`
      });

      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        email: cleanEmail,
        expiresAt: pass ? pass.expiresAt : Date.now() + 24 * 3600 * 1000,
        message: '¡Transacción aprobada con Wompi! Pase Creador de 24 Horas Activado.'
      });
    }

    res.status(400).json({
      success: false,
      message: 'La transacción aún no ha sido aprobada por Wompi.'
    });
  } catch (err) {
    console.error('[WOMPI VERIFY ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Restaurar Pase 24h Wompi por Correo
app.post('/api/wompi/restore-purchase', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Debes ingresar un correo electrónico' });

    const cleanEmail = email.trim().toLowerCase();
    const passes = getCreatorPasses();
    const userPass = passes[cleanEmail];

    if (userPass && userPass.expiresAt > Date.now()) {
      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        email: cleanEmail,
        expiresAt: userPass.expiresAt,
        remainingMs: userPass.expiresAt - Date.now(),
        message: `¡Pase Creador de 24 Horas activo restaurado para ${cleanEmail}!`
      });
    }

    res.status(404).json({
      success: false,
      message: 'No encontramos un Pase Creador de 24 Horas activo asociado a este correo.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Estado Wompi por Correo
app.get('/api/wompi/status', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.json({ isVip: false, isPassActive: false });
  const passes = getCreatorPasses();
  const pass = passes[email];
  const active = Boolean(pass && pass.expiresAt > Date.now());
  res.json({ isVip: active, isPassActive: active, expiresAt: pass ? pass.expiresAt : 0 });
});

// ============================================================================
// INICIO DE SESIÓN CON CÓDIGO DE SEGURIDAD (OTP) POR CORREO
// ============================================================================
const AUTH_CODES_FILE = path.join(__dirname, 'data', 'auth_codes.json');

function getAuthCodes() {
  try {
    if (fs.existsSync(AUTH_CODES_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_CODES_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveAuthCodes(codes) {
  try {
    fs.writeFileSync(AUTH_CODES_FILE, JSON.stringify(codes, null, 2));
  } catch (e) {}
}

// Configuración de Envío de Correos SMTP / Gmail / Resend
function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  // Gmail App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }

  // Resend SMTP
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
      }
    });
  }

  return null;
}

// Paso 1: Enviar Código de 6 Dígitos
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    const codes = getAuthCodes();
    codes[cleanEmail] = { code, expiresAt };
    saveAuthCodes(codes);

    console.log(`[AUTH CODE GENERATED] Código para ${cleanEmail}: ${code}`);

    const transporter = getEmailTransporter();
    let emailSent = false;
    let emailError = null;

    if (transporter) {
      try {
        const sender = process.env.SMTP_FROM || `"Apocalipsis Game" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@appzplay.online'}>`;
        await transporter.sendMail({
          from: sender,
          to: cleanEmail,
          subject: `🔐 Tu código de acceso a Apocalipsis: ${code}`,
          html: `
            <div style="background:#0f172a; color:#f8fafc; padding:30px; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:520px; margin:auto; border:1px solid #334155;">
              <h2 style="color:#38bdf8; margin-top:0; font-size:24px; text-align:center;">⚡ APOCALIPSIS</h2>
              <p style="font-size:15px; color:#cbd5e1; line-height:1.6;">Has solicitado un código de verificación de un solo uso (OTP) para acceder al juego y restaurar tu <strong>Arsenal VIP de Wompi</strong>:</p>
              <div style="background:#1e293b; border:2px dashed #38bdf8; padding:18px; text-align:center; border-radius:10px; margin:24px 0;">
                <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#facc15; font-family:monospace;">${code}</span>
              </div>
              <p style="font-size:13px; color:#94a3b8; text-align:center;">Este código es válido durante los próximos <strong>15 minutos</strong>.<br>Si tú no solicitaste este código, puedes ignorar este correo de forma segura.</p>
              <hr style="border:none; border-top:1px solid #334155; margin:20px 0;">
              <p style="font-size:11px; color:#64748b; text-align:center;">Apocalipsis Web Obliteration • <a href="https://apocalipsis.appzplay.online" style="color:#38bdf8; text-decoration:none;">apocalipsis.appzplay.online</a></p>
            </div>
          `
        });
        emailSent = true;
        console.log(`[EMAIL DISPATCH SUCCESS] Correo con código enviado a ${cleanEmail}`);
      } catch (err) {
        console.error('[EMAIL DISPATCH FAILED]:', err);
        emailError = err.message;
      }
    } else {
      console.log(`[EMAIL NOTICE] No hay servidor SMTP configurado en variables de entorno (SMTP_HOST, GMAIL_USER o RESEND_API_KEY).`);
    }

    res.json({
      success: true,
      email: cleanEmail,
      emailSent: emailSent,
      devCode: emailSent ? undefined : code,
      emailError: emailError || undefined,
      message: emailSent
        ? `Código enviado con éxito a tu bandeja de entrada.`
        : `Servidor sin SMTP configurado todavía. Tu código de acceso directo es: ${code}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paso 2: Verificar Código de 6 Dígitos e Iniciar Sesión
app.post('/api/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Faltan parámetros de correo o código.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const codes = getAuthCodes();
    const record = codes[cleanEmail];

    if (!record || record.code !== cleanCode) {
      return res.status(401).json({ success: false, error: 'Código de verificación incorrecto.' });
    }

    if (Date.now() > record.expiresAt) {
      return res.status(410).json({ success: false, error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    delete codes[cleanEmail];
    saveAuthCodes(codes);

    const users = getVipUsers();
    let userRecord = users[cleanEmail];
    if (!userRecord) {
      userRecord = {
        email: cleanEmail,
        isVip: false,
        unlockedWeapons: [0, 1],
        lastLogin: new Date().toISOString()
      };
      users[cleanEmail] = userRecord;
      saveVipUsers(users);
    } else {
      userRecord.lastLogin = new Date().toISOString();
      saveVipUsers(users);
    }

    // Verificar si tiene Pase Creador de 24 Horas activo en Wompi
    const passes = getCreatorPasses();
    const pass = passes[cleanEmail];
    const isPassActive = Boolean(pass && pass.expiresAt > Date.now());
    const isVip = Boolean(userRecord.isVip || isPassActive);

    console.log(`[AUTH LOGIN SUCCESS] Sesión iniciada para ${cleanEmail} (VIP/Pase: ${isVip})`);

    res.json({
      success: true,
      email: cleanEmail,
      isVip: isVip,
      isPassActive: isPassActive,
      expiresAt: pass ? pass.expiresAt : (isVip ? Date.now() + 24 * 3600 * 1000 : null),
      unlockedWeapons: isVip ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'G'] : (userRecord.unlockedWeapons || [0, 1]),
      message: `¡Bienvenido! Sesión iniciada para ${cleanEmail}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve room custom image (From Memory or Disk)
app.get('/api/room-image/:roomId', (req, res) => {
  const targetRoomId = (req.params.roomId || 'lobby').trim().toLowerCase();
  const data = getRoomImageFromDisk(targetRoomId);
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
    // 1. Proveedor de Vanguardia: Microlink Headless Chromium (Captura SPAs, JS, WordPress, .com.co en PNG HD)
    try {
      const microUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1440&viewport.height=900`;
      const microRes = await fetch(microUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000)
      });
      if (microRes.ok) {
        const buf = Buffer.from(await microRes.arrayBuffer());
        if (buf.length > 8000) {
          const contentType = (buf[0] === 0x89) ? 'image/png' : 'image/jpeg';
          res.set('Content-Type', contentType);
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Cache-Control', 'public, max-age=3600');
          return res.send(buf);
        }
      }
    } catch (mErr) {
      console.warn('[MICROLINK]:', mErr.message, 'Probando thum.io...');
    }

    // 2. Proveedor Secundario: Google PageSpeed Insights (Headless Chromium Oficial de Google)
    try {
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&screenshot=true&strategy=desktop`;
      const psiRes = await fetch(psiUrl, { signal: AbortSignal.timeout(9000) });
      if (psiRes.ok) {
        const psiData = await psiRes.json();
        const b64Data = psiData?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
        if (b64Data && b64Data.startsWith('data:image/')) {
          const parts = b64Data.split(',');
          const imgBuffer = Buffer.from(parts[1], 'base64');
          if (imgBuffer.length > 5000) {
            res.set('Content-Type', 'image/jpeg');
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Cache-Control', 'public, max-age=3600');
            return res.send(imgBuffer);
          }
        }
      }
    } catch (gErr) {
      console.warn('[PAGESPEED SCREENSHOT]:', gErr.message, 'Probando thum.io...');
    }

    // 3. Proveedor Terciario: thum.io (Ultra rápido con parámetros noanimate y wait)
    try {
      const thumUrl = `https://image.thum.io/get/width/1440/noanimate/wait/2/${targetUrl}`;
      const thumRes = await fetch(thumUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (thumRes.ok) {
        const buf = Buffer.from(await thumRes.arrayBuffer());
        if (buf.length > 5000) {
          const contentType = (buf[0] === 0x89) ? 'image/png' : 'image/jpeg';
          res.set('Content-Type', contentType);
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Cache-Control', 'public, max-age=3600');
          return res.send(buf);
        }
      }
    } catch (thumErr) {
      console.warn('[THUM.IO]:', thumErr.message, 'Probando mshots...');
    }

    // 4. Proveedor Cuaternario: WordPress mshots
    const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=1440`;
    let buffer = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(screenshotUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length > 9500) {
          buffer = buf;
          break;
        }
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (!buffer) {
      throw new Error('Screenshot still generating on fallback provider');
    }

    const contentType = (buffer[0] === 0x89) ? 'image/png' : 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    console.warn('[SCREENSHOT API]:', err.message, 'Falling back to HTML parser.');
    res.status(502).send('Screenshot unavailable');
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

// ==========================================================================
// PERSISTENCIA TOTAL DE SALAS & ESTADO MULTIJUGADOR EN DISCO
// ==========================================================================
const rooms = new Map();
const ROOMS_DB_PATH = path.join(__dirname, 'data', 'rooms.json');

function loadRoomsFromDisk() {
  try {
    if (fs.existsSync(ROOMS_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(ROOMS_DB_PATH, 'utf8'));
      for (const [id, rData] of Object.entries(data)) {
        rooms.set(id, {
          id,
          preset: rData.preset || 'wikipedia',
          url: rData.url || 'https://en.wikipedia.org/wiki/Stick_figure',
          pageUrl: rData.pageUrl || '',
          pageData: rData.pageData || null,
          craters: rData.craters || [],
          players: new Map(),
          bots: new Map(),
          chatHistory: rData.chatHistory || [],
          seed: rData.seed || Math.floor(Math.random() * 1000000),
          createdAt: rData.createdAt || Date.now()
        });
      }
      console.log(`[ROOMS PERSISTENCE]: Se cargaron ${rooms.size} salas persistentes de disco.`);
    }
  } catch (err) {
    console.error('[ROOMS LOAD ERROR]:', err);
  }
}

let saveRoomsTimeout = null;
function saveRoomsToDisk() {
  if (saveRoomsTimeout) return;
  saveRoomsTimeout = setTimeout(() => {
    saveRoomsTimeout = null;
    try {
      const out = {};
      for (const [id, r] of rooms.entries()) {
        out[id] = {
          preset: r.preset,
          url: r.url,
          pageUrl: r.pageUrl || '',
          pageData: r.pageData || null,
          craters: r.craters ? r.craters.slice(-2000) : [],
          chatHistory: r.chatHistory ? r.chatHistory.slice(-50) : [],
          seed: r.seed,
          createdAt: r.createdAt
        };
      }
      const dataDir = path.dirname(ROOMS_DB_PATH);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(ROOMS_DB_PATH, JSON.stringify(out, null, 2));
    } catch (err) {
      console.error('[ROOMS SAVE ERROR]:', err);
    }
  }, 1000);
}

loadRoomsFromDisk();

function getOrCreateRoom(roomId) {
  const cleanId = (roomId || 'lobby').trim().toLowerCase();
  if (!rooms.has(cleanId)) {
    let preset = 'wikipedia';
    let url = 'https://en.wikipedia.org/wiki/Stick_figure';
    let pageUrl = '';
    let pageData = null;

    // Check if custom image or meta exists on disk for this room
    const metaPath = path.join(ROOM_IMAGES_DIR, `${cleanId}.meta.json`);
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        preset = meta.preset || 'image';
        url = `/api/room-image/${cleanId}`;
        pageUrl = meta.pageUrl || '';
      } catch (e) {}
    } else if (fs.existsSync(path.join(ROOM_IMAGES_DIR, `${cleanId}.png`)) || fs.existsSync(path.join(ROOM_IMAGES_DIR, `${cleanId}.jpg`))) {
      preset = 'image';
      url = `/api/room-image/${cleanId}`;
    }

    rooms.set(cleanId, {
      id: cleanId,
      preset,
      url,
      pageUrl,
      pageData,
      craters: [],
      players: new Map(),
      bots: new Map(),
      chatHistory: [],
      seed: Math.floor(Math.random() * 1000000),
      createdAt: Date.now()
    });
    saveRoomsToDisk();
  }
  return rooms.get(cleanId);
}

// Clean empty ephemeral rooms periodically (keeping custom and persistent ones)
setInterval(() => {
  const now = Date.now();
  let modified = false;
  for (const [roomId, room] of rooms.entries()) {
    if (roomId !== 'lobby' && room.players.size === 0 && now - room.createdAt > 3600000 && !roomImages.has(roomId) && room.preset === 'wikipedia') {
      rooms.delete(roomId);
      modified = true;
    }
  }
  if (modified) saveRoomsToDisk();
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
      pageUrl: roomData.pageUrl || roomData.url,
      pageData: roomData.pageData || null,
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
      r: Math.round(damageData.radius || damageData.r),
      w: damageData.weapon || damageData.w
    });
    if (room.craters.length > 3000) {
      room.craters.splice(0, 500);
    }

    socket.to(currentRoomId).emit('terrain-damaged', damageData);
    saveRoomsToDisk();
  });

  socket.on('terrain-damage-batch', (batch) => {
    if (!currentRoomId || !Array.isArray(batch)) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    for (const damageData of batch) {
      room.craters.push({
        x: Math.round(damageData.x),
        y: Math.round(damageData.y),
        r: Math.round(damageData.r || damageData.radius),
        w: damageData.w || damageData.weapon
      });
    }
    if (room.craters.length > 3000) {
      room.craters.splice(0, 500);
    }

    socket.to(currentRoomId).emit('terrain-damaged-batch', batch);
    saveRoomsToDisk();
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
      weaponIndex: [1, 2, 3, 5][Math.floor(Math.random() * 4)],
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
    room.pageUrl = (pageData && pageData.url) || url || '';
    room.pageData = pageData || null;
    room.craters = [];
    room.seed = Math.floor(Math.random() * 1000000);
    saveRoomsToDisk();

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
      pageUrl: room.pageUrl,
      seed: room.seed,
      pageData
    });
    console.log(`[MAP SYNC]: Sala '${currentRoomId}' cambió mapa a '${room.preset}' (${room.url})`);
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
