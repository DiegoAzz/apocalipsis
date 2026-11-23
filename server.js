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

// Consultar estado de sala compartida (si tiene anfitrión con pase activo)
app.get('/api/room-status/:roomId', (req, res) => {
  const roomId = (req.params.roomId || '').trim().toLowerCase();
  if (!roomId || !rooms.has(roomId)) {
    return res.json({ exists: false, hasActiveHost: false });
  }
  const r = rooms.get(roomId);
  const now = Date.now();
  const hasActiveHost = Boolean(r.hostPassExpires && r.hostPassExpires > now);
  const remainingSeconds = hasActiveHost ? Math.max(0, Math.round((r.hostPassExpires - now) / 1000)) : 0;
  res.json({
    roomId: r.id,
    exists: true,
    hasActiveHost,
    hostName: r.hostName || 'Anfitrión',
    playerCount: r.players ? r.players.size : 0,
    preset: r.preset,
    remainingSeconds
  });
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

    // Super Administrador Vitalicio (Diego Zuniga) - Sin vencimiento
    const LIFETIME_TS = 253402300799000; // Año 9999
    passes['diego.zuniga.plazas@gmail.com'] = {
      identifier: 'diego.zuniga.plazas@gmail.com',
      isPassActive: true,
      isAdmin: true,
      code: '7914',
      altCode: 'ANDRES10',
      pin: '1580',
      activatedAt: new Date().toISOString(),
      expiresAt: LIFETIME_TS,
      durationHours: 999999,
      planName: 'Super Administrador Vitalicio',
      priceUSD: 0,
      paymentMethod: 'super_admin_master',
      reference: 'SUPER_ADMIN_DIEGO_LIFETIME'
    };

    const defaultVips = [
      { email: 'solucionesaox@gmail.com', code: '814208' }
    ];
    for (const v of defaultVips) {
      const vEmail = v.email;
      if (!passes[vEmail] || passes[vEmail].expiresAt < Date.now()) {
        passes[vEmail] = {
          identifier: vEmail,
          isPassActive: true,
          code: (passes[vEmail] && passes[vEmail].code) || v.code,
          pin: (passes[vEmail] && passes[vEmail].pin) || '1234',
          activatedAt: new Date().toISOString(),
          expiresAt: Date.now() + (24 * 3600 * 1000),
          durationHours: 24,
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
        code: '7914',
        altCode: 'ANDRES10',
        pin: '1234',
        expiresAt: 253402300799000
      },
      'solucionesaox@gmail.com': {
        identifier: 'solucionesaox@gmail.com',
        isPassActive: true,
        code: '814208',
        pin: '1234',
        expiresAt: Date.now() + 8760 * 3600 * 1000
      }
    };
  }
}

function generatePassCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendPassConfirmationEmail(toEmail, code, pin, planName, expiresAt) {
  try {
    if (!toEmail || !toEmail.includes('@')) return false;
    const transporter = getEmailTransporter();
    if (!transporter) return false;
    const sender = process.env.SMTP_FROM || `"Apocalipsis Game" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@appzplay.online'}>`;
    const expDate = new Date(expiresAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const directLink = `https://apocalipsis.appzplay.online/?code=${encodeURIComponent(code)}`;

    await transporter.sendMail({
      from: sender,
      to: toEmail,
      subject: `🎉 ¡Tu Pase de Apocalipsis (${planName}) está Activo! Código: ${code}`,
      html: `
        <div style="background:#0f172a; color:#f8fafc; padding:30px; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:540px; margin:auto; border:1px solid #334155;">
          <h1 style="color:#38bdf8; margin-top:0; font-size:26px; text-align:center;">⚡ APOCALIPSIS</h1>
          <h3 style="color:#22c55e; text-align:center; margin-bottom:20px;">⭐ ¡Pago Aprobado con Éxito!</h3>
          <p style="font-size:15px; color:#cbd5e1; line-height:1.6;">
            Gracias por tu compra. Tu <strong>${planName}</strong> ya está habilitado para destruir cualquier página web, subir fotos ilimitadas y usar el arsenal legendario (Tsar Bomba, Cohetes, Cañón de Riel).
          </p>

          <div style="background:#1e293b; border:2px dashed #f59e0b; padding:20px; text-align:center; border-radius:12px; margin:24px 0;">
            <div style="font-size:12px; color:#94a3b8; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">TU CÓDIGO DE ACCESO MULTIDISPOSITIVO:</div>
            <span style="font-size:38px; font-weight:900; letter-spacing:8px; color:#facc15; font-family:monospace;">${code}</span>
            ${pin ? `<div style="font-size:13px; color:#38bdf8; margin-top:10px;">PIN de seguridad: <strong>${pin}</strong></div>` : ''}
            <div style="font-size:12px; color:#94a3b8; margin-top:8px;">Vigente hasta: <strong>${expDate}</strong></div>
          </div>

          <div style="text-align:center; margin:25px 0;">
            <a href="${directLink}" style="display:inline-block; background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; font-weight:800; font-size:16px; padding:14px 28px; border-radius:10px; text-decoration:none; box-shadow:0 0 20px rgba(2,132,199,0.5);">
              🚀 JUGAR AHORA EN 1 CLIC
            </a>
          </div>

          <p style="font-size:12px; color:#94a3b8; text-align:center;">
            Puedes usar tu código (<strong>${code}</strong>) o tu PIN (<strong>${pin || ''}</strong>) o tu correo para entrar desde tu celular, computador o cualquier navegador sin volver a pagar.
          </p>
          <hr style="border:none; border-top:1px solid #334155; margin:20px 0;">
          <p style="font-size:11px; color:#64748b; text-align:center;">
            Apocalipsis Web Obliteration • <a href="https://apocalipsis.appzplay.online" style="color:#38bdf8; text-decoration:none;">apocalipsis.appzplay.online</a>
          </p>
        </div>
      `
    });
    console.log(`[PASS EMAIL SENT]: Correo de confirmación enviado a ${toEmail} con código [${code}]`);
    return true;
  } catch (err) {
    console.error('[PASS EMAIL ERROR]: No se pudo enviar correo a', toEmail, err.message);
    return false;
  }
}

function saveCreatorPass(identifier, passData) {
  try {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;
    const passes = getCreatorPasses();
    const durationHours = passData.durationHours || 24;
    const priceUSD = passData.priceUSD || (durationHours >= 720 ? 10.00 : durationHours >= 360 ? 5.00 : durationHours >= 168 ? 3.00 : 1.00);
    const planName = passData.planName || (durationHours >= 720 ? '1 Mes VIP (30 Días)' : durationHours >= 360 ? '15 Días' : durationHours >= 168 ? '1 Semana (7 Días)' : '1 Día (24 Horas)');
    const now = Date.now();
    const currentPass = passes[cleanId];
    const baseTime = (currentPass && currentPass.expiresAt > now) ? currentPass.expiresAt : now;
    const expiresAt = baseTime + (durationHours * 60 * 60 * 1000);
    const passCode = passData.code || (currentPass && currentPass.code) || generatePassCode();

    passes[cleanId] = {
      identifier: cleanId,
      isPassActive: true,
      code: passCode,
      activatedAt: new Date(now).toISOString(),
      expiresAt: expiresAt,
      durationHours: durationHours,
      priceUSD: priceUSD,
      planName: planName,
      pin: (passData.pin || (currentPass && currentPass.pin) || '1234').toString().trim(),
      paymentMethod: passData.paymentMethod || 'direct',
      reference: passData.reference || `PASS_${now}`
    };
    fs.writeFileSync(PASS_DB_PATH, JSON.stringify(passes, null, 2));
    console.log(`[CREATOR PASS DB]: Pase [${planName}] ACTIVADO para ${cleanId} con CÓDIGO [${passCode}] hasta ${new Date(expiresAt).toISOString()}`);
    if (cleanId.includes('@')) {
      sendPassConfirmationEmail(cleanId, passCode, passes[cleanId].pin, planName, expiresAt).catch(() => {});
    }
    return passes[cleanId];
  } catch (err) {
    console.error('[CREATOR PASS SAVE ERROR]:', err);
    return null;
  }
}

// 1. Activar Pase Creador Multidías / Multisemana
app.post('/api/pass/activate', (req, res) => {
  try {
    const { identifier, email, paymentMethod, reference, durationHours, priceUSD, planName } = req.body || {};
    const targetId = (email || identifier || 'user_guest').trim().toLowerCase();
    const effHours = parseInt(durationHours, 10) || 24;
    const pass = saveCreatorPass(targetId, {
      durationHours: effHours,
      priceUSD: priceUSD,
      planName: planName,
      paymentMethod: paymentMethod || 'checkout',
      reference: reference || `REF_${Date.now()}`
    });

    if (pass) {
      res.json({
        success: true,
        isPassActive: true,
        expiresAt: pass.expiresAt,
        planName: pass.planName,
        remainingMs: Math.max(0, pass.expiresAt - Date.now()),
        message: `¡${pass.planName} Activado! Acceso total a imágenes, URLs y arsenal.`
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

// Consultar lista de pases o buscar por correo/código para Diego (Admin)
app.get('/api/pass/admin-list', (req, res) => {
  const adminKey = req.query.adminKey || req.headers['x-admin-key'];
  if (adminKey !== '1580' && adminKey !== (process.env.ADMIN_PASSWORD || 'admin')) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  const passes = getCreatorPasses();
  const search = (req.query.search || req.query.email || '').trim().toLowerCase();

  if (search) {
    const results = {};
    for (const [key, p] of Object.entries(passes)) {
      if (key.includes(search) || (p.code && p.code.includes(search)) || (p.pin && p.pin.includes(search)) || (p.reference && p.reference.toLowerCase().includes(search))) {
        results[key] = p;
      }
    }
    return res.json({ success: true, count: Object.keys(results).length, passes: results });
  }

  res.json({ success: true, count: Object.keys(passes).length, passes });
});

// ============================================================================
// API OFICIAL TRM COLOMBIA (DÓLAR EN TIEMPO REAL - SUPERINTENDENCIA FINANCIERA)
// Fuente oficial: datos.gov.co (dataset 32sa-8pi3) + Fallbacks
// ============================================================================
let cachedTRM = {
  rate: 3461.92,
  source: 'Superintendencia Financiera de Colombia (datos.gov.co)',
  lastFetched: 0
};

async function fetchOfficialTRM() {
  const now = Date.now();
  // Cache por 10 minutos para respuestas ultrarrápidas y evitar rate-limit
  if (now - cachedTRM.lastFetched < 10 * 60 * 1000 && cachedTRM.rate > 1000) {
    return cachedTRM;
  }

  // 1. Intentar API Oficial del Gobierno de Colombia (datos.gov.co / Superfinanciera)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC', {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].valor) {
        const val = parseFloat(data[0].valor);
        if (!isNaN(val) && val > 1000) {
          cachedTRM.rate = Math.round(val * 100) / 100;
          cachedTRM.source = 'Superintendencia Financiera de Colombia (datos.gov.co)';
          cachedTRM.lastFetched = now;
          console.log(`[TRM OFICIAL ACTUALIZADA]: $${cachedTRM.rate} COP por USD (datos.gov.co)`);
          return cachedTRM;
        }
      }
    }
  } catch (e) {
    console.warn('[TRM OFICIAL]: datos.gov.co error/timeout, probando API secundaria:', e.message);
  }

  // 2. Fallback 1: Open Exchange Rates
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.COP) {
        const val = parseFloat(data.rates.COP);
        if (!isNaN(val) && val > 1000) {
          cachedTRM.rate = Math.round(val * 100) / 100;
          cachedTRM.source = 'Open Exchange Rates (USD/COP)';
          cachedTRM.lastFetched = now;
          console.log(`[TRM SECUNDARIA ACTUALIZADA]: $${cachedTRM.rate} COP por USD (open.er-api)`);
          return cachedTRM;
        }
      }
    }
  } catch (e) {
    console.warn('[TRM SECUNDARIA]: error:', e.message);
  }

  // 3. Fallback 2: ExchangeRate-API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.COP) {
        const val = parseFloat(data.rates.COP);
        if (!isNaN(val) && val > 1000) {
          cachedTRM.rate = Math.round(val * 100) / 100;
          cachedTRM.source = 'ExchangeRate-API (USD/COP)';
          cachedTRM.lastFetched = now;
          return cachedTRM;
        }
      }
    }
  } catch (e) {
    console.warn('[TRM TERCERA]: error:', e.message);
  }

  return cachedTRM;
}

app.get('/api/currency/trm', async (req, res) => {
  try {
    const trm = await fetchOfficialTRM();
    const rate = trm.rate;
    const plans = {
      day: {
        usd: 1,
        cop: Math.round(rate * 1),
        cents: Math.round(rate * 1 * 100),
        hours: 24,
        name: '1 Día (24 Horas)'
      },
      week: {
        usd: 3,
        cop: Math.round(rate * 3),
        cents: Math.round(rate * 3 * 100),
        hours: 168,
        name: '1 Semana (7 Días)'
      },
      biweek: {
        usd: 5,
        cop: Math.round(rate * 5),
        cents: Math.round(rate * 5 * 100),
        hours: 360,
        name: '15 Días'
      },
      month: {
        usd: 10,
        cop: Math.round(rate * 10),
        cents: Math.round(rate * 10 * 100),
        hours: 720,
        name: '1 Mes VIP (30 Días)'
      }
    };
    res.json({
      success: true,
      rate: rate,
      rateFormatted: `$ ${rate.toLocaleString('es-CO', { maximumFractionDigits: 2 })} COP`,
      source: trm.source,
      updatedAt: new Date(trm.lastFetched || Date.now()).toISOString(),
      plans
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// INTEGRACIÓN OFICIAL WOMPI: PLANES VIP CON VALOR REAL EN DÓLARES / COP
// Bancolombia, Nequi, PSE, Tarjetas de Crédito / Débito
// ============================================================================

// Memoria de Intentos de Pago para asociar referencia con email y PIN de forma infalible
const paymentIntents = new Map();

// 1. Generación de Firma de Integridad Wompi y Registro de Intento de Pago
app.get('/api/wompi/signature', (req, res) => {
  try {
    const { reference, amountInCents, currency = 'COP', secret, email, pin, hours, planName } = req.query;
    if (!reference || !amountInCents) {
      return res.status(400).json({ error: 'Faltan parámetros reference o amountInCents' });
    }

    // Registrar la asociación de la transacción con el correo y PIN del cliente
    if (email && email.includes('@')) {
      const cleanRef = reference.trim();
      paymentIntents.set(cleanRef, {
        email: email.trim().toLowerCase(),
        pin: (pin || '1234').toString().trim(),
        hours: parseInt(hours || 24, 10),
        planName: planName || 'Pase VIP',
        createdAt: Date.now()
      });
      console.log(`[PAYMENT INTENT REGISTERED]: ${cleanRef} -> ${email} (PIN: ${pin || '1234'})`);
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

// 3. Webhook de Wompi (Aprobación Asíncrona con soporte dual de rutas)
const handleWompiWebhook = async (req, res) => {
  try {
    const event = req.body;
    console.log('[WOMPI WEBHOOK EVENT]:', event ? event.event : 'No event');

    if (event && event.data && event.data.transaction) {
      const trans = event.data.transaction;
      const status = trans.status;
      let customerEmail = trans.customer_email || (trans.customer_data && trans.customer_data.email);
      let customerPin = '1234';

      // Si no viene en customer_email, buscar en los paymentIntents previamente registrados
      const transRef = (trans.reference || '').trim();
      const intent = transRef ? paymentIntents.get(transRef) : null;
      if (!customerEmail && intent) {
        customerEmail = intent.email;
        customerPin = intent.pin || '1234';
      }

      // Si aún no viene, intentar extraer de la referencia si contiene un @
      if (!customerEmail && transRef && transRef.includes('@')) {
        const parts = transRef.split('_');
        customerEmail = parts.find(p => p.includes('@'));
      }

      if (status === 'APPROVED' && customerEmail) {
        const cents = trans.amount_in_cents || 346200;
        let effHours = intent ? intent.hours : 24;
        let effPrice = 1.00;
        let effPlanName = intent ? intent.planName : '1 Día (24 Horas)';

        const refUpper = transRef.toUpperCase();
        const currentRate = (cachedTRM && cachedTRM.rate > 1000) ? cachedTRM.rate : 3500;

        if (refUpper.includes('MONTH') || cents >= Math.round(currentRate * 8 * 100)) {
          effHours = 720;
          effPrice = 10.00;
          effPlanName = '1 Mes VIP (30 Días)';
        } else if (refUpper.includes('BIWEEK') || cents >= Math.round(currentRate * 4 * 100)) {
          effHours = 360;
          effPrice = 5.00;
          effPlanName = '15 Días';
        } else if (refUpper.includes('WEEK') || cents >= Math.round(currentRate * 2 * 100)) {
          effHours = 168;
          effPrice = 3.00;
          effPlanName = '1 Semana (7 Días)';
        }

        saveCreatorPass(customerEmail, {
          durationHours: effHours,
          priceUSD: effPrice,
          planName: effPlanName,
          pin: customerPin,
          paymentMethod: 'wompi_checkout',
          reference: trans.reference || `WOMPI_${Date.now()}`
        });
        console.log(`[WOMPI WEBHOOK]: ¡${effPlanName} APROBADO para ${customerEmail}!`);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[WOMPI WEBHOOK ERROR]:', err.message);
    res.status(500).json({ error: err.message });
  }
};
app.post('/api/wompi-webhook', handleWompiWebhook);
app.post('/api/wompi/webhook', handleWompiWebhook);

// 4. Verificación de Transacción Wompi desde el Frontend
app.post('/api/wompi/verify-transaction', async (req, res) => {
  try {
    const { transactionId, email, pin, durationHours, priceUSD, planName } = req.body || {};
    if (!transactionId) {
      return res.status(400).json({ error: 'Falta parámetro transactionId' });
    }

    let cleanEmail = (email || '').trim().toLowerCase();
    const cleanPin = (pin || '1234').toString().trim();
    let isApproved = false;
    let transData = {};

    // Modo prueba o consulta en vivo a API Wompi
    if (transactionId.startsWith('DEV_') || transactionId.startsWith('TEST_') || transactionId.startsWith('DIRECT_')) {
      isApproved = true;
      if (!cleanEmail) cleanEmail = 'creador@apocalipsis.online';
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
          if (!cleanEmail) {
            cleanEmail = (transData.customer_email || (transData.customer_data && transData.customer_data.email) || '').trim().toLowerCase();
          }
        }
      } catch (e) {
        console.warn('[WOMPI API CHECK]: Error consultando API Wompi:', e.message);
      }
    }

    if (!cleanEmail) {
      cleanEmail = 'cliente_wompi@apocalipsis.online';
    }

    if (isApproved) {
      let effHours = parseInt(durationHours, 10);
      let effPrice = priceUSD ? parseFloat(priceUSD) : 1.00;
      let effPlanName = planName;

      // Si no viene durationHours explícito, deducir por la referencia o monto en centavos de Wompi
      if (!effHours || isNaN(effHours)) {
        const cents = transData.amount_in_cents || 346200;
        const refUpper = (transData.reference || '').toUpperCase();
        const currentRate = (cachedTRM && cachedTRM.rate > 1000) ? cachedTRM.rate : 3500;

        if (refUpper.includes('MONTH') || cents >= Math.round(currentRate * 8 * 100)) {
          effHours = 720; effPrice = 10.00; effPlanName = '1 Mes VIP (30 Días)';
        } else if (refUpper.includes('BIWEEK') || cents >= Math.round(currentRate * 4 * 100)) {
          effHours = 360; effPrice = 5.00; effPlanName = '15 Días';
        } else if (refUpper.includes('WEEK') || cents >= Math.round(currentRate * 2 * 100)) {
          effHours = 168; effPrice = 3.00; effPlanName = '1 Semana (7 Días)';
        } else {
          effHours = 24; effPrice = 1.00; effPlanName = '1 Día (24 Horas)';
        }
      }

      if (!effPlanName) {
        effPlanName = effHours >= 720 ? '1 Mes VIP (30 Días)' : effHours >= 360 ? '15 Días' : effHours >= 168 ? '1 Semana (7 Días)' : '1 Día (24 Horas)';
      }

      const pass = saveCreatorPass(cleanEmail, {
        durationHours: effHours,
        priceUSD: effPrice,
        planName: effPlanName,
        paymentMethod: 'wompi_widget',
        pin: cleanPin,
        reference: transData.reference || `WOMPI_${Date.now()}`
      });

      // Si Wompi / Banco registró un correo diferente (ej: si el usuario cometió un error tipográfico en el juego)
      const wompiCustomerEmail = (transData.customer_email || (transData.customer_data && transData.customer_data.email) || '').trim().toLowerCase();
      if (wompiCustomerEmail && wompiCustomerEmail.includes('@') && wompiCustomerEmail !== cleanEmail) {
        saveCreatorPass(wompiCustomerEmail, {
          code: pass ? pass.code : undefined,
          durationHours: effHours,
          priceUSD: effPrice,
          planName: effPlanName,
          paymentMethod: 'wompi_widget_sync',
          pin: cleanPin,
          reference: transData.reference || `WOMPI_${Date.now()}`
        });
        console.log(`[PASS DUAL SYNC]: Pase vinculado a ambos correos (${cleanEmail} y ${wompiCustomerEmail}) con código [${pass ? pass.code : ''}]`);
      }

      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        email: cleanEmail,
        code: pass ? pass.code : generatePassCode(),
        expiresAt: pass ? pass.expiresAt : Date.now() + (effHours * 3600 * 1000),
        isAdmin: false,
        planName: effPlanName,
        durationHours: effHours,
        priceUSD: effPrice,
        message: `¡Transacción aprobada con Wompi! ${effPlanName} Activado.`
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

// 5. Canjear / Iniciar Sesión con CÓDIGO DE ACCESO (6 Dígitos)
app.post('/api/pass/redeem-code', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Debes ingresar tu código de acceso de 6 dígitos.' });

    const cleanCode = code.toString().trim().toUpperCase();
    const passes = getCreatorPasses();

    let foundPass = null;
    let foundEmail = null;

    // Super Administrador Códigos Maestros (Sin vencimiento) - SOLO para Diego Zúñiga
    if (cleanCode === '7914' || cleanCode === 'ANDRES10' || cleanCode === 'DIEGO1' || cleanCode === '1580') {
      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        isAdmin: true,
        code: cleanCode,
        email: 'diego.zuniga.plazas@gmail.com',
        planName: 'Super Administrador Vitalicio',
        expiresAt: 253402300799000,
        remainingMs: 253402300799000 - Date.now(),
        message: '👑 ¡BIENVENIDO SUPER ADMINISTRADOR! Acceso Vitalicio Permanente y Arsenal Total desbloqueados.'
      });
    }

    // Buscar en pases registrados por code, altCode o PIN (como 1580)
    for (const [key, p] of Object.entries(passes)) {
      if (p && ((p.code && p.code.toString().trim().toUpperCase() === cleanCode) ||
                (p.altCode && p.altCode.toString().trim().toUpperCase() === cleanCode) ||
                (p.pin && p.pin.toString().trim() === cleanCode))) {
        foundPass = p;
        foundEmail = key;
        break;
      }
    }

    // Si el usuario ingresó su correo electrónico
    if (!foundPass && cleanCode.includes('@')) {
      const lower = cleanCode.toLowerCase();
      if (passes[lower]) {
        foundPass = passes[lower];
        foundEmail = lower;
      } else {
        for (const [key, p] of Object.entries(passes)) {
          if (p && p.identifier && p.identifier.toLowerCase() === lower) {
            foundPass = p;
            foundEmail = key;
            break;
          }
        }
      }
    }

    // Si el usuario ingresó la referencia de Wompi
    if (!foundPass) {
      for (const [key, p] of Object.entries(passes)) {
        if (p && p.reference && (p.reference.toUpperCase() === cleanCode || cleanCode.includes(p.reference.toUpperCase()) || p.reference.toUpperCase().includes(cleanCode))) {
          foundPass = p;
          foundEmail = key;
          break;
        }
      }
    }

    if (!foundPass && (cleanCode === '814208' || cleanCode === 'SOLUCIONESAXX@GMAIL.COM' || cleanCode === 'SOLUCIONESAOX@GMAIL.COM')) {
      foundPass = passes['solucionesaxx@gmail.com'] || passes['solucionesaox@gmail.com'] || {
        identifier: 'solucionesaxx@gmail.com',
        code: '814208',
        isPassActive: true,
        expiresAt: 253402300799000,
        planName: 'Pase VIP Creador'
      };
      foundEmail = 'solucionesaxx@gmail.com';
    }

    if (!foundPass || foundPass.expiresAt <= Date.now()) {
      return res.status(404).json({
        success: false,
        message: '❌ Código de acceso, PIN o correo no encontrado o expirado. Verifica que tus datos coincidan con los ingresados al pagar.'
      });
    }

    res.json({
      success: true,
      isPassActive: true,
      isVip: true,
      isAdmin: Boolean(foundPass.isAdmin),
      code: foundPass.code || cleanCode,
      email: foundPass.identifier || foundEmail,
      expiresAt: foundPass.expiresAt,
      remainingMs: Math.max(0, foundPass.expiresAt - Date.now()),
      planName: foundPass.planName || 'Pase VIP',
      message: '⭐ ¡Pase verificado con éxito! Acceso VIP activado en este navegador.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Restaurar Pase Wompi por Correo, Código o PIN
app.post('/api/wompi/restore-purchase', (req, res) => {
  try {
    const { email, code, pin } = req.body;
    const inputVal = (code || email || '').trim().toUpperCase();
    if (!inputVal) return res.status(400).json({ error: 'Debes ingresar tu código de acceso o tu correo' });

    // Super Administrador Códigos Maestros (Sin vencimiento) - SOLO para Diego Zúñiga
    if (inputVal === '7914' || inputVal === 'ANDRES10' || inputVal === 'DIEGO1' || inputVal === '1580') {
      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        isAdmin: true,
        code: inputVal,
        email: 'diego.zuniga.plazas@gmail.com',
        planName: 'Super Administrador Vitalicio',
        expiresAt: 253402300799000,
        remainingMs: 253402300799000 - Date.now(),
        message: `👑 ¡Pase Super Administrador Vitalicio Sin Vencimiento activado para Diego Zuniga!`
      });
    }

    const passes = getCreatorPasses();

    // 1. Buscar coincidencia exacta por código, altCode o PIN
    for (const [key, p] of Object.entries(passes)) {
      if (p && ((p.code && p.code.toString().trim().toUpperCase() === inputVal) ||
                (p.altCode && p.altCode.toString().trim().toUpperCase() === inputVal) ||
                (p.pin && p.pin.toString().trim() === inputVal))) {
        if (p.expiresAt > Date.now() || p.isAdmin) {
          return res.json({
            success: true,
            isPassActive: true,
            isVip: true,
            isAdmin: Boolean(p.isAdmin),
            code: inputVal,
            email: p.identifier || key,
            expiresAt: p.expiresAt,
            message: `¡Pase Creador activado con éxito!`
          });
        }
      }
    }

    if (inputVal === '814208') {
      const dPass = passes['solucionesaox@gmail.com'];
      return res.json({
        success: true,
        isPassActive: true,
        isVip: true,
        code: inputVal,
        email: 'solucionesaox@gmail.com',
        expiresAt: dPass ? dPass.expiresAt : Date.now() + 24 * 3600 * 1000,
        message: `¡Pase Creador activado!`
      });
    }

    // 2. Si el usuario ingresó un Número de Transacción o Referencia de Wompi
    for (const [key, p] of Object.entries(passes)) {
      if (p && p.reference && (p.reference === inputVal || inputVal.includes(p.reference) || p.reference.includes(inputVal))) {
        if (p.expiresAt > Date.now()) {
          return res.json({
            success: true,
            isPassActive: true,
            isVip: true,
            code: p.code || generatePassCode(),
            email: p.identifier || key,
            expiresAt: p.expiresAt,
            message: `⭐ ¡Comprobante de Wompi verificado! Tu código de acceso es: ${p.code}`
          });
        }
      }
    }

    const cleanEmail = inputVal.toLowerCase();
    const cleanPin = (pin || code || '').toString().trim();
    const userPass = passes[cleanEmail];

    if (!userPass || userPass.expiresAt <= Date.now()) {
      return res.status(404).json({
        success: false,
        message: 'No encontramos un Pase Creador de 24 Horas activo asociado a este correo o código.'
      });
    }

    // Validación con PIN o Código
    if (userPass.pin && cleanPin) {
      if (userPass.pin !== cleanPin && userPass.code !== cleanPin) {
        return res.status(403).json({
          success: false,
          message: '❌ Código o PIN incorrecto. Para proteger tu compra, otra persona no puede acceder sin tu código.'
        });
      }
    }

    return res.json({
      success: true,
      isPassActive: true,
      isVip: true,
      email: cleanEmail,
      code: userPass.code,
      expiresAt: userPass.expiresAt,
      remainingMs: userPass.expiresAt - Date.now(),
      message: `¡Pase Creador de 24 Horas activo restaurado para ${cleanEmail}!`
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
    const cleanUser = process.env.GMAIL_USER.trim();
    const cleanPass = process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, '');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass
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

// ==========================================================================
// BUZÓN DE SOPORTE & ASISTENTE ESPECIALIZADO (Tickets a diego.zuniga.plazas@gmail.com)
// ==========================================================================
const SUPPORT_TICKETS_PATH = path.join(__dirname, 'data', 'support_tickets.json');
const SUPPORT_RECEIVER_EMAIL = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || 'diego.zuniga.plazas@gmail.com';

function getSupportTickets() {
  try {
    if (fs.existsSync(SUPPORT_TICKETS_PATH)) {
      const raw = fs.readFileSync(SUPPORT_TICKETS_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[SUPPORT TICKETS READ ERROR]:', err);
  }
  return [];
}

function saveSupportTicket(ticket) {
  try {
    const list = getSupportTickets();
    list.unshift(ticket);
    const dataDir = path.dirname(SUPPORT_TICKETS_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SUPPORT_TICKETS_PATH, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[SUPPORT TICKETS SAVE ERROR]:', err);
    return false;
  }
}

// Crear ticket y notificar a Diego por correo
app.post('/api/support/ticket', async (req, res) => {
  try {
    const { email, name, category, codeOrRef, message } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido para poder responderte.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ error: 'Por favor detalla tu mensaje (mínimo 5 caracteres).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && typeof name === 'string' ? name.trim() : '') || 'Jugador de Apocalipsis';
    const cleanCategory = (category && typeof category === 'string' ? category.trim() : 'Consulta General');
    const cleanRef = (codeOrRef && typeof codeOrRef === 'string' ? codeOrRef.trim() : '');
    const cleanMessage = message.trim();
    const ticketId = `TICK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = new Date().toISOString();
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const ticket = {
      id: ticketId,
      email: cleanEmail,
      name: cleanName,
      category: cleanCategory,
      codeOrRef: cleanRef,
      message: cleanMessage,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || '',
      createdAt: timestamp,
      status: 'pending'
    };

    saveSupportTicket(ticket);
    console.log(`[SUPPORT TICKET CREATED] Ticket ${ticketId} de ${cleanEmail} [${cleanCategory}]`);

    // Notificar al correo de Diego (y acuse de recibo al usuario)
    let emailSentToAdmin = false;
    let emailError = null;
    try {
      const transporter = getEmailTransporter();
      if (transporter) {
        const sender = process.env.SMTP_FROM || `"Apocalipsis Soporte" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@appzplay.online'}>`;
        
        // 1. Notificación a Diego
        await transporter.sendMail({
          from: sender,
          to: SUPPORT_RECEIVER_EMAIL,
          replyTo: cleanEmail,
          subject: `🚨 [Apocalipsis Soporte] Ticket #${ticketId}: ${cleanCategory.toUpperCase()} (${cleanEmail})`,
          html: `
            <div style="background:#0f172a; color:#f8fafc; padding:28px; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:600px; margin:auto; border:1px solid #334155;">
              <h2 style="color:#f59e0b; margin-top:0; font-size:22px;">⚡ NUEVO MENSAJE EN EL BUZÓN DE APOCALIPSIS</h2>
              <p style="font-size:14px; color:#cbd5e1; margin-bottom:16px;">Has recibido una solicitud directa de un usuario en el juego:</p>
              
              <div style="background:#1e293b; border-left:4px solid #38bdf8; padding:16px; border-radius:6px; margin:16px 0;">
                <p style="margin:4px 0;"><strong>Ticket ID:</strong> <span style="color:#facc15; font-family:monospace; font-weight:bold;">${ticketId}</span></p>
                <p style="margin:4px 0;"><strong>Usuario:</strong> ${cleanName}</p>
                <p style="margin:4px 0;"><strong>Correo:</strong> <a href="mailto:${cleanEmail}" style="color:#38bdf8; text-decoration:none;">${cleanEmail}</a></p>
                <p style="margin:4px 0;"><strong>Categoría:</strong> <span style="background:#334155; padding:2px 8px; border-radius:4px; font-weight:bold; color:#f8fafc;">${cleanCategory}</span></p>
                ${cleanRef ? `<p style="margin:4px 0;"><strong>Código / Referencia Wompi:</strong> <span style="color:#4ade80; font-family:monospace; font-weight:bold;">${cleanRef}</span></p>` : ''}
                <p style="margin:4px 0;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                <p style="margin:4px 0; font-size:12px; color:#94a3b8;"><strong>IP:</strong> ${clientIp}</p>
              </div>

              <div style="background:#020617; border:1px solid #1e293b; padding:18px; border-radius:8px; margin:20px 0;">
                <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Mensaje del Usuario:</div>
                <div style="white-space:pre-wrap; font-size:14px; color:#f8fafc; line-height:1.6;">${cleanMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              </div>

              <div style="text-align:center; margin-top:24px;">
                <a href="mailto:${cleanEmail}?subject=Re:%20[Apocalipsis%20Soporte]%20Ticket%20${ticketId}" style="background:#0284c7; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; display:inline-block; font-size:14px;">✉️ Responder a ${cleanEmail}</a>
              </div>
            </div>
          `
        });
        emailSentToAdmin = true;
        console.log(`[SUPPORT EMAIL DISPATCH SUCCESS] Notificado a ${SUPPORT_RECEIVER_EMAIL}`);

        // 2. Acuse de recibo al usuario
        try {
          await transporter.sendMail({
            from: sender,
            to: cleanEmail,
            subject: `🤖 Hemos recibido tu solicitud de soporte #${ticketId} - Apocalipsis VI`,
            html: `
              <div style="background:#0f172a; color:#f8fafc; padding:26px; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:520px; margin:auto; border:1px solid #334155;">
                <h2 style="color:#38bdf8; margin-top:0; font-size:22px; text-align:center;">⚡ APOCALIPSIS VI</h2>
                <h4 style="color:#22c55e; text-align:center; margin-top:4px;">¡Solicitud Recibida con Éxito!</h4>
                <p style="font-size:14px; color:#cbd5e1; line-height:1.6;">Hola <strong>${cleanName}</strong>, hemos recibido tu consulta en nuestro buzón de soporte.</p>
                
                <div style="background:#1e293b; border:1px dashed #38bdf8; padding:14px; border-radius:10px; margin:16px 0; text-align:center;">
                  <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">Número de Ticket:</div>
                  <div style="font-size:24px; font-weight:bold; color:#facc15; font-family:monospace; margin-top:4px;">${ticketId}</div>
                </div>

                <p style="font-size:13px; color:#94a3b8; line-height:1.6;">
                  Nuestro equipo revisará los detalles y te responderá a este correo en la mayor brevedad posible (menos de 24 horas hábiles).
                </p>
                <div style="background:#020617; padding:12px; border-radius:8px; margin:14px 0; font-size:12px; color:#94a3b8; border:1px solid #1e293b;">
                  <strong>Resumen de tu mensaje:</strong><br>
                  <span style="color:#cbd5e1;">"${cleanMessage.substring(0, 160)}${cleanMessage.length > 160 ? '...' : ''}"</span>
                </div>
                <hr style="border:none; border-top:1px solid #334155; margin:16px 0;">
                <p style="font-size:11px; color:#64748b; text-align:center;">
                  Apocalipsis Web Obliteration • <a href="https://apocalipsis.appzplay.online" style="color:#38bdf8; text-decoration:none;">apocalipsis.appzplay.online</a>
                </p>
              </div>
            `
          });
        } catch (ackErr) {
          console.warn('[SUPPORT USER ACK ERROR]:', ackErr.message);
        }
      }
    } catch (errEmail) {
      emailError = errEmail.message;
      console.error('[SUPPORT EMAIL DISPATCH FAILED]:', errEmail.message);
    }

    res.json({
      success: true,
      ticketId,
      emailSent: emailSentToAdmin,
      message: `¡Tu mensaje ha sido enviado al equipo de soporte con el ticket #${ticketId}! Te responderemos a ${cleanEmail} lo más pronto posible.`
    });
  } catch (err) {
    console.error('[SUPPORT TICKET API ERROR]:', err);
    res.status(500).json({ error: 'Error interno procesando el ticket.' });
  }
});

// Consultar tickets (Admin / Seguridad)
app.get('/api/support/tickets', (req, res) => {
  const adminKey = req.query.adminKey || req.headers['x-admin-key'];
  if (adminKey !== '1580' && adminKey !== (process.env.ADMIN_PASSWORD || 'admin')) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  const tickets = getSupportTickets();
  res.json({ success: true, count: tickets.length, tickets });
});

// Endpoint de diagnóstico para verificar si el envío de correo de Coolify funciona
app.get('/api/support/test-email', async (req, res) => {
  const adminKey = req.query.adminKey || req.headers['x-admin-key'];
  if (adminKey !== '1580' && adminKey !== (process.env.ADMIN_PASSWORD || 'admin')) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }

  const targetEmail = req.query.to || SUPPORT_RECEIVER_EMAIL;
  const transporter = getEmailTransporter();
  
  if (!transporter) {
    return res.status(500).json({
      success: false,
      error: 'No hay servicio de correo configurado. getEmailTransporter devolvió null.',
      variablesDetectadas: {
        GMAIL_USER: Boolean(process.env.GMAIL_USER),
        GMAIL_APP_PASSWORD: Boolean(process.env.GMAIL_APP_PASSWORD),
        SMTP_HOST: Boolean(process.env.SMTP_HOST),
        RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY)
      },
      ayuda: 'En Coolify, agrega GMAIL_USER y GMAIL_APP_PASSWORD en Environment Variables y REINICIA (Redeploy) la aplicación.'
    });
  }

  try {
    const sender = process.env.SMTP_FROM || (process.env.GMAIL_USER ? `"Apocalipsis Game" <${process.env.GMAIL_USER.trim()}>` : `"Apocalipsis Game" <no-reply@appzplay.online>`);
    const info = await transporter.sendMail({
      from: sender,
      to: targetEmail,
      subject: '⚡ ¡Prueba de Correo Exitosa! - Apocalipsis VI',
      html: `
        <div style="background:#0f172a; color:#f8fafc; padding:24px; border-radius:12px; font-family:sans-serif; max-width:500px; margin:auto; border:1px solid #38bdf8;">
          <h2 style="color:#22c55e; margin-top:0;">✅ ¡CORREOS FUNCIONANDO EN PRODUCCIÓN!</h2>
          <p style="font-size:14px; color:#cbd5e1;">Tu servidor de Coolify se conectó exitosamente a Gmail.</p>
          <p style="font-size:12px; color:#94a3b8;">A partir de este momento, todos los tickets de soporte y confirmaciones de pago Wompi se enviarán de inmediato.</p>
        </div>
      `
    });
    res.json({
      success: true,
      message: `¡Correo de prueba enviado con éxito a ${targetEmail}! Revisa tu bandeja de entrada o Spam.`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error('[TEST EMAIL ERROR]:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      codigoError: err.code || 'UNKNOWN',
      ayuda: 'Si dice Invalid login 535, verifica que la contraseña sea una Contraseña de Aplicación de 16 letras de Google y no tu contraseña personal.'
    });
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
          createdAt: rData.createdAt || Date.now(),
          hostName: rData.hostName || null,
          hostEmail: rData.hostEmail || null,
          hostPassExpires: rData.hostPassExpires || 0
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
          createdAt: r.createdAt,
          hostName: r.hostName || null,
          hostEmail: r.hostEmail || null,
          hostPassExpires: r.hostPassExpires || 0
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
      createdAt: Date.now(),
      hostName: null,
      hostEmail: null,
      hostPassExpires: 0
    });
    saveRoomsToDisk();
  }
  return rooms.get(cleanId);
}

// Clean empty ephemeral rooms periodically & monitor host pass expirations
setInterval(() => {
  const now = Date.now();
  let modified = false;
  for (const [roomId, room] of rooms.entries()) {
    // Si la sala compartida tenía un anfitrión con pase pero ya venció:
    if (roomId !== 'lobby' && room.hostPassExpires > 0 && now > room.hostPassExpires) {
      console.log(`[ROOM EXPIRED] El plan del anfitrión de la sala ${roomId} ha vencido.`);
      room.hostPassExpires = 0;
      modified = true;
      io.to(roomId).emit('room-access-denied', {
        reason: 'HOST_PLAN_EXPIRED',
        roomId: roomId,
        message: 'El plan de 24 horas del anfitrión de esta sala ha finalizado.'
      });
    }

    if (roomId !== 'lobby' && room.players.size === 0 && now - room.createdAt > 3600000 && !roomImages.has(roomId) && room.preset === 'wikipedia') {
      rooms.delete(roomId);
      modified = true;
    }
  }
  if (modified) saveRoomsToDisk();
}, 30000);

getOrCreateRoom('lobby');

io.on('connection', (socket) => {
  let currentRoomId = null;
  let playerId = socket.id;

  socket.on('join-room', ({ room, name, skinColor, hostPassExpires, hostEmail, isVip }) => {
    const targetRoomId = (room || 'lobby').trim().toLowerCase();

    // Si el socket ya estaba en otra sala previamente, salir limpiamente de la sala anterior
    if (currentRoomId && currentRoomId !== targetRoomId && rooms.has(currentRoomId)) {
      socket.leave(currentRoomId);
      const oldRoom = rooms.get(currentRoomId);
      if (oldRoom && oldRoom.players) {
        oldRoom.players.delete(playerId);
        socket.to(currentRoomId).emit('player-left', playerId);
      }
    }
    currentRoomId = targetRoomId;
    socket.join(targetRoomId);

    const roomData = getOrCreateRoom(targetRoomId);
    const now = Date.now();

    // 1. Determinar si el usuario entrante tiene Pase VIP activo
    let incomingExpires = 0;
    if (hostEmail) {
      const passes = getCreatorPasses();
      const p = passes[String(hostEmail).toLowerCase().trim()];
      if (p && p.expiresAt && p.expiresAt > now) {
        incomingExpires = p.expiresAt;
      }
    }
    if (!incomingExpires && hostPassExpires && Number(hostPassExpires) > now) {
      incomingExpires = Number(hostPassExpires);
    }
    if (!incomingExpires && isVip) {
      incomingExpires = now + (24 * 3600 * 1000);
    }

    const isLobby = targetRoomId === 'lobby';
    const hasIncomingPass = incomingExpires > now;

    // 2. Si es anfitrión con pase activo, registra o renueva el plan de la sala
    if (hasIncomingPass) {
      roomData.hostPassExpires = Math.max(roomData.hostPassExpires || 0, incomingExpires);
      if (!roomData.hostName || roomData.hostName === 'Anfitrión') {
        roomData.hostName = (name && name !== 'Operativo') ? name : (roomData.hostName || 'Anfitrión');
      }
      if (hostEmail) roomData.hostEmail = hostEmail;
      saveRoomsToDisk();
      console.log(`[ROOM HOST] Sala ${targetRoomId} respaldada por anfitrion ${roomData.hostName} hasta ${new Date(roomData.hostPassExpires).toISOString()}`);
    }

    // 3. Si es una sala compartida (?room=...) y el usuario es invitado sin pase:
    const isGuest = !hasIncomingPass;
    if (!isLobby && isGuest) {
      const roomValid = roomData.hostPassExpires && roomData.hostPassExpires > now;
      const isRecentlyCreated = roomData.createdAt && (now - roomData.createdAt < 300000); // 5 min de gracia
      if (!roomValid && !isRecentlyCreated) {
        // La sala no tiene anfitrion con pase vigente o el pase ya expiro
        socket.emit('room-access-denied', {
          reason: 'HOST_PLAN_EXPIRED',
          roomId: targetRoomId,
          message: 'Esta sala compartida no esta disponible o el plan de 24 horas del anfitrion ya finalizo.'
        });
        return;
      }
      console.log(`[GUEST ACCESS FREE] Invitado ${name} (${playerId}) se unio GRATIS a la sala ${targetRoomId} de ${roomData.hostName || 'Anfitrión'}`);
    }

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
      chatHistory: roomData.chatHistory.slice(-20),
      isSharedRoom: !isLobby,
      isGuestAccess: isGuest && !isLobby,
      hostName: roomData.hostName || 'Anfitrión',
      hostPassExpires: roomData.hostPassExpires || 0
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
