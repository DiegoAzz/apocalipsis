// Main Game Orchestrator, Camera, Input, and UI Integration
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.level = new LevelEngine(1500, 2600, 5);
    this.physics = new PhysicsEngine(this.level);

    this.localPlayer = new Player('local', 'Operative', '#f97316', true);
    this.bots = [];
    this.multiplayer = new MultiplayerManager(this);

    // Solo Mode is DEFAULT: No bots or random players unless requested!
    this.isSoloMode = true;

    // Camera State
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetX: 0,
      targetY: 0
    };

    // Input State
    this.input = {
      keys: {},
      justPressedJump: false,
      mouseX: 0,
      mouseY: 0,
      screenMouseX: 0,
      screenMouseY: 0,
      isMouseDown: false,
      isRightMouseDown: false
    };

    this.lastTime = performance.now();
    this.ui = new UIManager(this);

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupInputListeners();

    // Default Level: Authentic Facebook or Wikipedia
    this.loadMapPreset('wikipedia', 'https://en.wikipedia.org/wiki/Stick_figure', false);

    // Draw authentic pixel-art icons on all bottom weapon slots
    this.drawWeaponIcons();

    // Start Game Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      // Ignore input if typing in chat or url bar
      if (document.activeElement === document.getElementById('chat-input') ||
          document.activeElement === document.getElementById('webpage-url-input')) {
        if (e.code === 'Enter' && document.activeElement === document.getElementById('chat-input')) {
          this.ui.sendChat();
        }
        return;
      }

      if (e.code === 'Enter') {
        this.ui.focusChat();
        e.preventDefault();
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        this.ui.showScoreboard(true);
        return;
      }

      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        if (!this.input.keys[e.code]) {
          this.input.justPressedJump = true;
        }
      }

      this.input.keys[e.code] = true;

      // Weapon Hotkeys 1-9
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 9) {
        this.localPlayer.selectWeapon(keyNum - 1);
        this.ui.updateActiveWeapon(keyNum - 1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        this.ui.showScoreboard(false);
      }
      this.input.keys[e.code] = false;
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        this.input.justPressedJump = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.input.screenMouseX = e.clientX;
      this.input.screenMouseY = e.clientY;
      this.input.mouseX = (e.clientX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
      this.input.mouseY = (e.clientY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
    });

    window.addEventListener('mousedown', (e) => {
      window.soundManager.ensureContext();
      if (e.button === 0) {
        this.input.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.input.isRightMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.isMouseDown = false;
      } else if (e.button === 2) {
        this.input.isRightMouseDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse scroll wheel weapon cycle
    window.addEventListener('wheel', (e) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      let newIdx = this.localPlayer.currentWeaponIndex + dir;
      if (newIdx < 0) newIdx = this.localPlayer.weapons.length - 1;
      if (newIdx >= this.localPlayer.weapons.length) newIdx = 0;
      this.localPlayer.selectWeapon(newIdx);
      this.ui.updateActiveWeapon(newIdx);
    });
  }

  loadMapPreset(preset, url = '', notifyServer = true) {
    const lowerUrl = (url || preset).toLowerCase();

    if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
      this.level.generateFacebook();
    } else if (preset === 'wikipedia' || lowerUrl.includes('wikipedia')) {
      this.level.generateWikipedia();
    } else if (preset === 'google' || lowerUrl.includes('google')) {
      this.level.generateGoogle();
    } else {
      this.level.generateCustom(url || preset);
    }

    this.localPlayer.respawn(this.level);

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap(preset, url);
    }

    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay(preset, this.level.pageUrl);
  }

  async loadParsedWebpage(pageData, notifyServer = true) {
    const lowerUrl = (pageData.url || '').toLowerCase();
    if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
      this.level.generateFacebook();
    } else {
      await this.level.renderFetchedPage(pageData);
    }

    this.localPlayer.respawn(this.level);

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap('custom', pageData.url, pageData);
    }

    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('custom', pageData.url);
  }

  async loadUserImage(imageSource) {
    await this.level.loadImageAsLevel(imageSource);
    this.localPlayer.respawn(this.level);
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('image', 'Imagen Personalizada');
  }

  // Draw Pixel-Art Icons on bottom weapon slots
  drawWeaponIcons() {
    // 0: Pistol
    this.drawIcon('icon-0', (ctx) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10, 10, 24, 7);
      ctx.fillRect(14, 17, 8, 10);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(28, 12, 6, 3);
    });

    // 1: SMG
    this.drawIcon('icon-1', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, 9, 30, 8);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(18, 17, 6, 12); // mag
      ctx.fillRect(36, 11, 4, 4); // barrel
    });

    // 2: Shotgun
    this.drawIcon('icon-2', (ctx) => {
      ctx.fillStyle = '#78350f'; // wood stock
      ctx.fillRect(6, 14, 12, 7);
      ctx.fillStyle = '#334155'; // twin barrel
      ctx.fillRect(18, 11, 24, 6);
    });

    // 3: Rocket Launcher
    this.drawIcon('icon-3', (ctx) => {
      ctx.fillStyle = '#065f46';
      ctx.fillRect(6, 9, 32, 12);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(38, 9);
      ctx.lineTo(44, 15);
      ctx.lineTo(38, 21);
      ctx.fill();
    });

    // 4: Railgun
    this.drawIcon('icon-4', (ctx) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 10, 32, 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(14, 13, 18, 4); // glow coil
    });

    // 5: Flamethrower
    this.drawIcon('icon-5', (ctx) => {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(8, 10, 24, 10);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(12, 20, 10, 8); // gas canister
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(38, 15, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6: Too Much (Cluster Parachute)
    this.drawIcon('icon-6', (ctx) => {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(24, 22, 6, 0, Math.PI * 2);
      ctx.fill();
      // parachute
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(24, 10, 12, Math.PI, 0);
      ctx.stroke();
    });

    // 7: The Magic Wand
    this.drawIcon('icon-7', (ctx) => {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(10, 18, 24, 3);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(36, 19, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8: PSR B0531+21 (Neutron Star)
    this.drawIcon('icon-8', (ctx) => {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(24, 16, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 8);
      ctx.lineTo(38, 24);
      ctx.stroke();
    });

    // Alt: Grenade
    this.drawIcon('icon-alt', (ctx) => {
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(24, 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(22, 7, 4, 4);
    });
  }

  drawIcon(canvasId, drawFn) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFn(ctx);
  }

  spawnBot() {
    const botData = {
      id: 'bot_' + Math.random().toString(36).substring(2, 7),
      name: 'Bot#' + Math.floor(Math.random() * 90 + 10),
      color: ['#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'][Math.floor(Math.random() * 5)],
      x: 300 + Math.random() * 800,
      y: 200
    };
    const bot = new BotController(botData, this.level, this.physics);
    this.bots.push(bot);
  }

  clearBots() {
    this.bots = [];
  }

  findTargetById(id) {
    if (this.localPlayer.id === id) return this.localPlayer;
    if (this.multiplayer.remotePlayers.has(id)) return this.multiplayer.remotePlayers.get(id);
    for (const b of this.bots) {
      if (b.player.id === id) return b.player;
    }
    return null;
  }

  getAllTargets() {
    const list = [this.localPlayer];
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        list.push(rp);
      }
    }
    for (const b of this.bots) {
      list.push(b.player);
    }
    return list;
  }

  spawnRemoteShot(data) {
    const w = this.localPlayer.weapons[data.weaponIndex] || this.localPlayer.weapons[0];
    const angle = data.aimAngle;
    const originX = data.originX;
    const originY = data.originY;

    if (w.name === 'Pistol') {
      window.soundManager.playPistol();
      this.physics.addProjectile({
        type: 'bullet',
        weapon: 'pistol',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * 22,
        vy: Math.sin(angle) * 22,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'SMG') {
      window.soundManager.playSMG();
      const spread = (Math.random() - 0.5) * 0.12;
      this.physics.addProjectile({
        type: 'bullet',
        weapon: 'smg',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle + spread) * 24,
        vy: Math.sin(angle + spread) * 24,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'Shotgun') {
      window.soundManager.playShotgun();
      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.32;
        const spd = 18 + Math.random() * 6;
        this.physics.addProjectile({
          type: 'bullet',
          weapon: 'shotgun',
          ownerId: data.playerId,
          x: originX,
          y: originY,
          vx: Math.cos(angle + spread) * spd,
          vy: Math.sin(angle + spread) * spd,
          damage: w.damage,
          radius: w.radius,
          life: 0.8
        });
      }
    } else if (w.name === 'Rocket Launcher') {
      window.soundManager.playRocketLaunch();
      this.physics.addProjectile({
        type: 'rocket',
        weapon: 'rocket',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle) * 14,
        vy: Math.sin(angle) * 14,
        damage: w.damage,
        radius: w.radius,
        life: 4.0
      });
    } else if (w.name === 'Railgun') {
      window.soundManager.playRailgun();
      const maxDist = 1800;
      const endX = originX + Math.cos(angle) * maxDist;
      const endY = originY + Math.sin(angle) * maxDist;
      this.level.carveLine(originX, originY, endX, endY, 18);
      this.physics.spawnShockwave(originX, originY, 40, '#38bdf8');
    } else if (w.name === 'Flamethrower') {
      window.soundManager.playFlamethrower();
      const spread = (Math.random() - 0.5) * 0.22;
      const spd = 10 + Math.random() * 4;
      this.physics.addProjectile({
        type: 'flame',
        weapon: 'flame',
        ownerId: data.playerId,
        x: originX,
        y: originY,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        damage: w.damage,
        radius: w.radius,
        life: 0.45
      });
    }
  }

  gameLoop(timestamp) {
    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    const targets = this.getAllTargets();

    // 1. Update Local Player
    this.localPlayer.update(
      dt,
      this.input,
      this.level,
      this.physics,
      (shootData) => {
        if (!this.isSoloMode) this.multiplayer.emitShoot(shootData);
      },
      (grenadeData) => {
        if (!this.isSoloMode) this.multiplayer.emitGrenade(grenadeData);
      }
    );

    this.input.justPressedJump = false;

    if (!this.isSoloMode) {
      this.multiplayer.emitPlayerUpdate(this.localPlayer);
    }

    // 2. Interpolate Remote Players (Only in Online mode)
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        if (rp.targetX !== undefined) {
          rp.x += (rp.targetX - rp.x) * 0.28;
          rp.y += (rp.targetY - rp.y) * 0.28;
        }
        if (rp.jetpackActive) {
          this.physics.spawnJetpackFlame(rp.x, rp.y, rp.facing);
        }
      }
    }

    // 3. Update Bots (if any spawned)
    for (const bot of this.bots) {
      bot.update(
        dt,
        targets,
        (shootData) => {
          if (!this.isSoloMode) this.multiplayer.emitShoot({ ...shootData, playerId: bot.player.id });
        },
        (grenadeData) => {
          if (!this.isSoloMode) this.multiplayer.emitGrenade({ ...grenadeData, playerId: bot.player.id });
        }
      );
    }

    // 4. Update Physics
    this.physics.update(
      dt,
      targets,
      (x, y, radius, weapon) => {
        if (!this.isSoloMode) this.multiplayer.emitTerrainDamage(x, y, radius, weapon);
        this.ui.updateDestructionBar(this.level.getDestructionPercentage());
      },
      (targetId, damage, weapon, attackerId) => {
        if (!this.isSoloMode) {
          this.multiplayer.emitPlayerHit(targetId, damage, weapon, attackerId);
        } else {
          const t = this.findTargetById(targetId);
          if (t) t.takeDamage(damage, weapon, attackerId);
        }
      }
    );

    // 5. Update Camera
    this.camera.targetX = this.localPlayer.x;
    this.camera.targetY = this.localPlayer.y;

    const lerpSpeed = 0.12;
    this.camera.x += (this.camera.targetX - this.camera.x) * lerpSpeed;
    this.camera.y += (this.camera.targetY - this.camera.y) * lerpSpeed;

    const halfW = (this.canvas.width / 2) / this.camera.zoom;
    const halfH = (this.canvas.height / 2) / this.camera.zoom;
    this.camera.x = Math.max(halfW, Math.min(this.level.width - halfW, this.camera.x));
    this.camera.y = Math.max(halfH, Math.min(this.level.height - halfH, this.camera.y));

    // Update UI HUD
    this.ui.updateHUD(this.localPlayer);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const shake = this.physics.getShakeOffset();

    ctx.save();
    ctx.translate(this.canvas.width / 2 + shake.x, this.canvas.height / 2 + shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.rotate(shake.rot);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Level Canvas (Webpage with dithered craters)
    ctx.drawImage(this.level.canvas, 0, 0);

    // 2. Draw Physics (Debris, Shockwaves, Projectiles)
    this.physics.render(ctx);

    // 3. Draw Remote Players (Only if online)
    if (!this.isSoloMode) {
      for (const rp of this.multiplayer.remotePlayers.values()) {
        rp.render(ctx);
      }
    }

    // 4. Draw Bots
    for (const bot of this.bots) {
      bot.render(ctx);
    }

    // 5. Draw Local Player
    this.localPlayer.render(ctx);

    ctx.restore();

    // 6. Draw Minimap & HUD Crosshair
    this.renderMinimap(ctx);
    this.renderCrosshair(ctx);
  }

  renderMinimap(ctx) {
    const mw = 160;
    const mh = Math.floor(mw * (this.level.height / this.level.width));
    const mx = this.canvas.width - mw - 20;
    const my = 80;

    ctx.save();
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    ctx.drawImage(this.level.canvas, mx, my, mw, mh);

    const scaleX = mw / this.level.width;
    const scaleY = mh / this.level.height;
    const camW = (this.canvas.width / this.camera.zoom) * scaleX;
    const camH = (this.canvas.height / this.camera.zoom) * scaleY;
    const camX = mx + (this.camera.x * scaleX) - camW / 2;
    const camY = my + (this.camera.y * scaleY) - camH / 2;

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX, camY, camW, camH);

    // Local Player dot
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(mx + this.localPlayer.x * scaleX, my + this.localPlayer.y * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderCrosshair(ctx) {
    const x = this.input.screenMouseX;
    const y = this.input.screenMouseY;

    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 14);
    ctx.stroke();

    ctx.restore();
  }
}

// UI Manager
class UIManager {
  constructor(game) {
    this.game = game;

    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpText = document.getElementById('hud-hp-text');
    this.fuelBar = document.getElementById('hud-fuel-bar');
    this.fuelText = document.getElementById('hud-fuel-text');
    this.wnameText = document.getElementById('wname-text');
    this.wnameAmmo = document.getElementById('wname-ammo');
    this.destructionBar = document.getElementById('destruction-bar-fill');
    this.destructionText = document.getElementById('destruction-percent-text');
    this.killFeed = document.getElementById('kill-feed');
    this.chatLog = document.getElementById('chat-log');
    this.chatInput = document.getElementById('chat-input');
    this.scoreboard = document.getElementById('scoreboard-modal');
    this.urlInput = document.getElementById('webpage-url-input');
    this.helpModal = document.getElementById('help-modal');

    this.setupUIEvents();
  }

  setupUIEvents() {
    // Presets
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.getAttribute('data-preset');
        this.game.loadMapPreset(preset, '', true);
      });
    });

    // Destroy button
    const destroyBtn = document.getElementById('btn-destroy-url');
    const handleUrlSubmit = async () => {
      const val = this.urlInput.value.trim();
      if (!val) return;

      const btn = document.getElementById('btn-destroy-url');
      if (btn) btn.innerHTML = '<span>⏳ CARGANDO...</span>';

      try {
        const lower = val.toLowerCase();
        // Check image file extension
        if (lower.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/)) {
          await this.game.loadUserImage(val);
        } else if (lower.includes('facebook') || lower.includes('fb.com')) {
          this.game.loadMapPreset('facebook', val, true);
        } else {
          const res = await fetch(`/api/parse-url?url=${encodeURIComponent(val)}`);
          const pageData = await res.json();
          await this.game.loadParsedWebpage(pageData, true);
        }
      } catch (err) {
        console.error('Failed to parse URL:', err);
        this.game.loadMapPreset('custom', val, true);
      } finally {
        if (btn) btn.innerHTML = '<span>⚡ DESTRUIR</span>';
      }
    };

    if (destroyBtn) {
      destroyBtn.addEventListener('click', handleUrlSubmit);
    }

    if (this.urlInput) {
      this.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUrlSubmit();
      });
    }

    // Image Upload Button & Input
    const uploadBtn = document.getElementById('btn-upload-image');
    const fileInput = document.getElementById('image-upload-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            await this.game.loadUserImage(ev.target.result);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Solo Mode vs Online Toggle
    const btnSolo = document.getElementById('btn-mode-solo');
    const btnMulti = document.getElementById('btn-mode-multi');
    if (btnSolo && btnMulti) {
      btnSolo.addEventListener('click', () => {
        this.game.isSoloMode = true;
        btnSolo.classList.add('active');
        btnMulti.classList.remove('active');
        document.getElementById('chat-container').style.display = 'none';
        this.game.clearBots();
      });

      btnMulti.addEventListener('click', () => {
        this.game.isSoloMode = false;
        btnMulti.classList.add('active');
        btnSolo.classList.remove('active');
        document.getElementById('chat-container').style.display = 'flex';
        // Connect to online room
        this.game.multiplayer.init('lobby', this.game.localPlayer.name, this.game.localPlayer.color);
      });
    }

    // Add Bot & Clear Bots
    const botBtn = document.getElementById('btn-add-bot');
    if (botBtn) {
      botBtn.addEventListener('click', () => this.game.spawnBot());
    }

    const clearBtn = document.getElementById('btn-clear-bots');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.game.clearBots());
    }

    // Mute button
    const muteBtn = document.getElementById('btn-toggle-sound');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = window.soundManager.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🔊 Sonido';
      });
    }

    // Help Modal
    const helpBtn = document.getElementById('btn-help');
    const closeHelp = document.getElementById('btn-close-help');
    const startPlay = document.getElementById('btn-start-playing');
    if (helpBtn && this.helpModal) {
      helpBtn.addEventListener('click', () => { this.helpModal.style.display = 'flex'; });
    }
    if (closeHelp && this.helpModal) {
      closeHelp.addEventListener('click', () => { this.helpModal.style.display = 'none'; });
    }
    if (startPlay && this.helpModal) {
      startPlay.addEventListener('click', () => { this.helpModal.style.display = 'none'; });
    }

    // Hotbar click selection
    document.querySelectorAll('.slot').forEach((slot) => {
      slot.addEventListener('click', () => {
        const slotVal = slot.getAttribute('data-slot');
        if (slotVal === 'alt') {
          // Trigger grenade
          this.game.localPlayer.tryGrenade(this.game.physics);
        } else {
          const idx = parseInt(slotVal);
          this.game.localPlayer.selectWeapon(idx);
          this.updateActiveWeapon(idx);
        }
      });
    });
  }

  updateHUD(player) {
    if (this.hpBar) {
      const pct = Math.max(0, (player.health / player.maxHealth) * 100);
      this.hpBar.style.width = `${pct}%`;
      this.hpText.textContent = `${Math.ceil(player.health)} HP`;
    }
    if (this.fuelBar) {
      const fpct = Math.max(0, (player.jetpackFuel / player.maxJetpackFuel) * 100);
      this.fuelBar.style.width = `${fpct}%`;
      this.fuelText.textContent = `${Math.ceil(player.jetpackFuel)}% JET`;
    }
    const w = player.getCurrentWeapon();
    if (this.wnameText) this.wnameText.textContent = w.name;
    if (this.wnameAmmo) {
      this.wnameAmmo.textContent = w.ammo === Infinity ? '∞' : `${w.ammo} / ${w.maxAmmo}`;
    }
  }

  updateActiveWeapon(index) {
    document.querySelectorAll('.slot').forEach((slot) => {
      const idx = parseInt(slot.getAttribute('data-slot'));
      if (idx === index) slot.classList.add('active');
      else if (slot.getAttribute('data-slot') !== 'alt') slot.classList.remove('active');
    });
    const w = this.game.localPlayer.weapons[index];
    if (w && this.wnameText) {
      this.wnameText.textContent = w.name;
    }
  }

  updateDestructionBar(percent) {
    if (this.destructionBar) {
      this.destructionBar.style.width = `${percent.toFixed(1)}%`;
    }
    if (this.destructionText) {
      this.destructionText.textContent = `${percent.toFixed(1)}% DESTRUIDO`;
    }
  }

  setPresetDisplay(preset, url) {
    if (this.urlInput) {
      this.urlInput.value = url || preset;
    }
  }

  setConnectionStatus(connected, room) {
    const el = document.getElementById('room-badge');
    if (el) {
      el.textContent = connected ? `SALA: ${room.toUpperCase()}` : 'SOLO';
      el.style.borderColor = connected ? '#22c55e' : '#ef4444';
    }
  }

  updatePlayerCount(count) {
    const el = document.getElementById('player-count-badge');
    if (el) el.textContent = `JUGADORES: ${count}`;
  }

  addKillFeedEntry(killData) {
    if (!this.killFeed) return;
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.innerHTML = `<strong>${killData.attackerName}</strong> [${killData.weapon}] <strong>${killData.targetName}</strong>`;
    this.killFeed.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 400);
    }, 4000);
  }

  focusChat() {
    if (this.chatInput) this.chatInput.focus();
  }

  sendChat() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (text) {
      this.game.multiplayer.emitChat(text);
      this.chatInput.value = '';
    }
    this.chatInput.blur();
  }

  appendChatMessage(msg) {
    if (!this.chatLog) return;
    const div = document.createElement('div');
    div.className = 'chat-entry';
    div.innerHTML = `<span style="color: ${msg.color || '#f97316'}; font-weight: bold;">${msg.sender}:</span> <span>${msg.text}</span>`;
    this.chatLog.appendChild(div);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  showScoreboard(show) {
    if (!this.scoreboard) return;
    if (show) {
      const list = this.game.getAllTargets();
      const tbody = document.getElementById('scoreboard-rows');
      if (tbody) {
        tbody.innerHTML = list
          .sort((a, b) => b.kills - a.kills)
          .map((p) => `<tr>
            <td style="color: ${p.color}; font-weight: bold;">${p.name}</td>
            <td>${p.kills}</td>
            <td>${p.deaths}</td>
            <td>${p.damageDealt || 0}</td>
            <td>${p.score || 0}</td>
          </tr>`)
          .join('');
      }
      this.scoreboard.style.display = 'block';
    } else {
      this.scoreboard.style.display = 'none';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
