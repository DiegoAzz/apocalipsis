// Main Game Orchestrator, Camera, Input, and UI Integration
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.level = new LevelEngine(1500, 2600, 5);
    this.physics = new PhysicsEngine(this.level);

    const savedName = (typeof localStorage !== 'undefined' && localStorage.getItem('destroy_player_name')) || 'Operativo';
    this.localPlayer = new Player('local', savedName, '#f97316', true);
    this.bots = [];
    this.multiplayer = new MultiplayerManager(this);

    // Online Multiplayer is DEFAULT: shared real-time battlefield!
    this.isSoloMode = false;

    // Camera State
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetX: 0,
      targetY: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      camStartX: 0,
      camStartY: 0
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
    this.timeScale = 1.0;
    this.isLiveMode = false;
    this.ui = new UIManager(this);

    this.init();
  }

  toggleLiveMode() {
    this.isLiveMode = !this.isLiveMode;
    this.timeScale = this.isLiveMode ? 0.35 : 1.0;

    const btnLive = document.getElementById('btn-toggle-live');
    const badge = document.getElementById('live-overlay-badge');

    if (btnLive) {
      if (this.isLiveMode) {
        btnLive.classList.add('active');
        btnLive.textContent = '🔴 LIVE (0.35x)';
      } else {
        btnLive.classList.remove('active');
        btnLive.textContent = '🔴 Modo Live';
      }
    }

    if (badge) {
      if (this.isLiveMode) badge.classList.add('active');
      else badge.classList.remove('active');
    }

    if (this.ui) {
      this.ui.appendChatMessage({
        sender: 'SISTEMA',
        color: this.isLiveMode ? '#ef4444' : '#22c55e',
        text: this.isLiveMode ? '🔴 ¡Modo Live activado! Cámara lenta cinematográfica (0.35x)' : '⚡ Modo normal restaurado (1.0x)'
      });
    }
  }

  snapCameraToPlayer() {
    if (!this.localPlayer) return;
    this.camera.x = this.localPlayer.x;
    this.camera.y = this.localPlayer.y;
    this.camera.targetX = this.localPlayer.x;
    this.camera.targetY = this.localPlayer.y;
    this.camera.isPanning = false;
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupInputListeners();

    // Default Level: Authentic Facebook or Wikipedia
    this.loadMapPreset('wikipedia', 'https://en.wikipedia.org/wiki/Stick_figure', false);
    this.snapCameraToPlayer();

    // Draw authentic futuristic weapon sprites on all bottom slots
    this.drawWeaponIcons();
    if (window.spriteSheetImg) {
      if (!window.spriteSheetImg.complete) {
        window.spriteSheetImg.addEventListener('load', () => this.drawWeaponIcons());
      }
    }

    // Auto-connect to Online Multiplayer (room parameter or default 'lobby')
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || 'lobby';
    const soloParam = urlParams.get('solo');

    if (soloParam === '1' || soloParam === 'true') {
      this.isSoloMode = true;
      const btnMulti = document.getElementById('btn-mode-multi');
      const btnSolo = document.getElementById('btn-mode-solo');
      if (btnMulti) btnMulti.classList.remove('active');
      if (btnSolo) btnSolo.classList.add('active');
      const chatCont = document.getElementById('chat-container');
      if (chatCont) chatCont.style.display = 'none';
    } else {
      this.isSoloMode = false;
      const btnMulti = document.getElementById('btn-mode-multi');
      const btnSolo = document.getElementById('btn-mode-solo');
      if (btnMulti) btnMulti.classList.add('active');
      if (btnSolo) btnSolo.classList.remove('active');
      const chatCont = document.getElementById('chat-container');
      if (chatCont && window.innerWidth > 900) chatCont.style.display = 'flex';

      // Connect to online room in real time with the custom player nickname!
      this.multiplayer.init(roomParam, this.localPlayer.name, this.localPlayer.color);
    }

    // Touch & Mobile Screen Detection
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 900;
    if (hasTouch) {
      document.body.classList.add('touch-active');
      this.setupMobileTouchControls();
    }
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupMobileTouchControls() {
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyBase = document.getElementById('touch-joystick-base');
    const joyKnob = document.getElementById('touch-joystick-knob');
    const btnJump = document.getElementById('touch-btn-jump');
    const btnGrenade = document.getElementById('touch-btn-grenade');

    let joyTouchId = null;

    if (joyZone && joyBase && joyKnob) {
      const handleJoyMove = (touch) => {
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const rawDx = touch.clientX - centerX;
        const rawDy = touch.clientY - centerY;
        const dist = Math.hypot(rawDx, rawDy);
        const maxDist = 36;
        const angle = Math.atan2(rawDy, rawDx);
        const clampedDist = Math.min(dist, maxDist);

        const dx = Math.cos(angle) * clampedDist;
        const dy = Math.sin(angle) * clampedDist;

        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        // Horizontal movement
        if (dx < -10) {
          this.input.keys['KeyA'] = true;
          this.input.keys['KeyD'] = false;
        } else if (dx > 10) {
          this.input.keys['KeyD'] = true;
          this.input.keys['KeyA'] = false;
        } else {
          this.input.keys['KeyA'] = false;
          this.input.keys['KeyD'] = false;
        }

        // Upward movement (Jump / Jetpack)
        if (dy < -14) {
          if (!this.input.keys['Space']) {
            this.input.justPressedJump = true;
          }
          this.input.keys['Space'] = true;
        } else {
          this.input.keys['Space'] = false;
        }
      };

      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundManager.ensureContext();
        if (joyTouchId === null) {
          const touch = e.changedTouches[0];
          joyTouchId = touch.identifier;
          handleJoyMove(touch);
        }
      }, { passive: false });

      joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyTouchId) {
            handleJoyMove(e.changedTouches[i]);
            break;
          }
        }
      }, { passive: false });

      const handleJoyEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joyTouchId) {
            joyTouchId = null;
            joyKnob.style.transform = 'translate(0px, 0px)';
            this.input.keys['KeyA'] = false;
            this.input.keys['KeyD'] = false;
            this.input.keys['Space'] = false;
            break;
          }
        }
      };

      joyZone.addEventListener('touchend', handleJoyEnd);
      joyZone.addEventListener('touchcancel', handleJoyEnd);
    }

    // Touch Action Buttons
    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundManager.ensureContext();
        this.input.justPressedJump = true;
        this.input.keys['Space'] = true;
      }, { passive: false });

      btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.input.keys['Space'] = false;
      }, { passive: false });
    }

    if (btnGrenade) {
      btnGrenade.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundManager.ensureContext();
        this.localPlayer.tryGrenade(this.physics);
      }, { passive: false });
    }

    // Direct Canvas Touch to Aim & Shoot Continuously
    let shootTouchId = null;
    this.canvas.addEventListener('touchstart', (e) => {
      window.soundManager.ensureContext();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > 140 && shootTouchId === null) {
          shootTouchId = touch.identifier;
          this.updateTouchAim(touch);
          this.input.isMouseDown = true;
          break;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === shootTouchId) {
          this.updateTouchAim(touch);
          break;
        }
      }
    }, { passive: true });

    const handleShootEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === shootTouchId) {
          shootTouchId = null;
          this.input.isMouseDown = false;
          break;
        }
      }
    };
    this.canvas.addEventListener('touchend', handleShootEnd);
    this.canvas.addEventListener('touchcancel', handleShootEnd);
  }

  updateTouchAim(touch) {
    this.input.screenMouseX = touch.clientX;
    this.input.screenMouseY = touch.clientY;
    this.input.mouseX = (touch.clientX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
    this.input.mouseY = (touch.clientY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
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

      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        this.input.isMouseDown = false;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        this.input.isRightMouseDown = false;
      }
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        if (!this.input.keys[e.code]) {
          this.input.justPressedJump = true;
        }
      }

      this.input.keys[e.code] = true;

      // Shoot keys: KeyF or KeyJ in addition to Mouse Click
      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        window.soundManager.ensureContext();
        this.input.isMouseDown = true;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        window.soundManager.ensureContext();
        this.input.isRightMouseDown = true;
      }

      if (e.code === 'KeyC') {
        this.snapCameraToPlayer();
      }

      if (e.code === 'KeyL') {
        this.toggleLiveMode();
      }

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
      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        this.input.isMouseDown = false;
      }
      if (e.code === 'KeyG' || e.code === 'KeyK') {
        this.input.isRightMouseDown = false;
      }
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        this.input.justPressedJump = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.input.screenMouseX = e.clientX;
      this.input.screenMouseY = e.clientY;
      this.input.mouseX = (e.clientX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
      this.input.mouseY = (e.clientY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

      // Middle mouse button / Wheel drag camera pan (Hand grab tool)
      if (this.camera.isPanning) {
        const dx = (e.clientX - this.camera.panStartX) / this.camera.zoom;
        const dy = (e.clientY - this.camera.panStartY) / this.camera.zoom;
        this.camera.x = this.camera.camStartX - dx;
        this.camera.y = this.camera.camStartY - dy;
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousedown', (e) => {
      window.soundManager.ensureContext();
      if (e.button === 1) {
        // Middle click / Wheel press activates pan hand tool
        e.preventDefault();
        this.camera.isPanning = true;
        this.camera.panStartX = e.clientX;
        this.camera.panStartY = e.clientY;
        this.camera.camStartX = this.camera.x;
        this.camera.camStartY = this.camera.y;
        this.canvas.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        this.input.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.input.isRightMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        this.camera.isPanning = false;
        this.canvas.style.cursor = 'crosshair';
      } else if (e.button === 0) {
        this.input.isMouseDown = false;
      } else if (e.button === 2) {
        this.input.isRightMouseDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse scroll wheel: Zoom with Ctrl/Alt/Shift, or cycle weapons
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.altKey || e.shiftKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.camera.zoom = Math.max(0.4, Math.min(2.5, this.camera.zoom * factor));
        return;
      }
      const dir = e.deltaY > 0 ? 1 : -1;
      let newIdx = this.localPlayer.currentWeaponIndex + dir;
      if (newIdx < 0) newIdx = this.localPlayer.weapons.length - 1;
      if (newIdx >= this.localPlayer.weapons.length) newIdx = 0;
      this.localPlayer.selectWeapon(newIdx);
      this.ui.updateActiveWeapon(newIdx);
    }, { passive: false });
  }

  loadMapPreset(preset, url = '', notifyServer = true) {
    const lowerUrl = (url || preset).toLowerCase();

    if (lowerUrl.includes('amazon')) {
      this.level.generateAmazon();
    } else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
      this.level.generateFacebook();
    } else if (preset === 'wikipedia' || lowerUrl.includes('wikipedia')) {
      this.level.generateWikipedia();
    } else if (preset === 'google' || lowerUrl.includes('google')) {
      this.level.generateGoogle();
    } else {
      this.level.generateCustom(url || preset);
    }

    this.localPlayer.respawn(this.level);
    this.snapCameraToPlayer();

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap(preset, url);
    }

    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay(preset, this.level.pageUrl);
  }

  async loadParsedWebpage(pageData, notifyServer = true) {
    const lowerUrl = (pageData.url || '').toLowerCase();
    if (lowerUrl.includes('amazon')) {
      this.level.generateAmazon();
    } else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.com')) {
      this.level.generateFacebook();
    } else {
      await this.level.renderFetchedPage(pageData);
    }

    this.localPlayer.respawn(this.level);
    this.snapCameraToPlayer();

    if (notifyServer && !this.isSoloMode) {
      this.multiplayer.emitChangeMap('custom', pageData.url, pageData);
    }

    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('custom', pageData.url);
  }

  async loadUserImage(imageSource) {
    await this.level.loadImageAsLevel(imageSource);
    this.localPlayer.respawn(this.level);

    // Auto-fit camera zoom so the image looks natural, proportional and NOT gigantic!
    const screenW = this.canvas.width || window.innerWidth;
    const screenH = this.canvas.height || window.innerHeight;
    const fitZoomX = (screenW * 0.94) / this.level.width;
    const fitZoomY = (screenH * 0.88) / this.level.height;

    if (this.level.height > this.level.width * 1.3) {
      // Mobile vertical screenshot
      if (screenW <= 900) {
        // On phone: zoom so the mobile screenshot exactly fits the phone screen width!
        this.camera.zoom = Math.min(1.0, Math.max(0.35, fitZoomX));
      } else {
        // On PC: zoom so the mobile screenshot fits nicely vertically in view
        this.camera.zoom = Math.min(1.0, Math.max(0.35, fitZoomY));
      }
    } else {
      // Desktop screenshot or photo
      this.camera.zoom = Math.min(1.0, Math.max(0.35, Math.min(fitZoomX, fitZoomY)));
    }

    this.snapCameraToPlayer();
    if (this.ui) this.ui.victoryShown = false;
    this.ui.updateDestructionBar(0);
    this.ui.setPresetDisplay('image', 'Imagen Personalizada');
  }

  // Draw Pixel-Art Icons on bottom weapon slots using uploaded Futuristic Spritesheet
  drawWeaponIcons() {
    const weaponMap = [
      { id: 'icon-0', name: 'Pistol' },
      { id: 'icon-1', name: 'SMG' },
      { id: 'icon-2', name: 'Shotgun' },
      { id: 'icon-3', name: 'Rocket Launcher' },
      { id: 'icon-4', name: 'Railgun' },
      { id: 'icon-5', name: 'Flamethrower' },
      { id: 'icon-6', name: 'Too Much' },
      { id: 'icon-7', name: 'The Magic Wand' },
      { id: 'icon-8', name: 'PSR B0531+21' },
      { id: 'icon-alt', name: 'Grenade' }
    ];

    weaponMap.forEach(({ id, name }) => {
      this.drawIcon(id, (ctx, c) => {
        const sp = window.SPRITES && window.SPRITES.weapons[name];
        if (window.spriteSheetImg && window.spriteSheetImg.complete && window.spriteSheetImg.naturalWidth > 0 && sp) {
          const pad = 2;
          const availW = c.width - pad * 2;
          const availH = c.height - pad * 2;
          const scale = Math.min(availW / sp.w, availH / sp.h);
          const dw = Math.round(sp.w * scale);
          const dh = Math.round(sp.h * scale);
          const dx = Math.round((c.width - dw) / 2);
          const dy = Math.round((c.height - dh) / 2);
          ctx.drawImage(window.spriteSheetImg, sp.x, sp.y, sp.w, sp.h, dx, dy, dw, dh);
        } else {
          // Fallback vector shape
          ctx.fillStyle = '#64748b';
          ctx.fillRect(8, 12, 32, 8);
        }
      });
    });
  }

  drawIcon(canvasId, drawFn) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFn(ctx, c);
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

    this.physics.spawnMuzzleSmoke(originX, originY, angle);

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
      this.physics.particles.push({
        type: 'laser',
        x1: originX,
        y1: originY,
        x2: endX,
        y2: endY,
        color: '#38bdf8',
        life: 1.0,
        decay: 0.08
      });
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
    const rawDt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    const dt = rawDt * this.timeScale;

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
          if (t) t.takeDamage(damage, weapon, attackerId, this.physics);
        }
      }
    );

    // 5. Update Camera (Always centered smoothly on player)
    if (!this.camera.isPanning) {
      this.camera.targetX = this.localPlayer.x;
      this.camera.targetY = this.localPlayer.y;

      const lerpSpeed = 0.22;
      this.camera.x += (this.camera.targetX - this.camera.x) * lerpSpeed;
      this.camera.y += (this.camera.targetY - this.camera.y) * lerpSpeed;
    }

    const pad = 250;
    this.camera.x = Math.max(-pad, Math.min(this.level.width + pad, this.camera.x));
    this.camera.y = Math.max(-pad, Math.min(this.level.height + pad, this.camera.y));

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
    // Hide minimap completely on mobile, tablets or narrow screens (< 860px) so it doesn't obstruct gameplay
    if (this.canvas.width < 860 || window.innerWidth < 860 || document.body.classList.contains('touch-active')) {
      return;
    }

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
    this.mobileChatToggle = document.getElementById('btn-mobile-chat-toggle');
    this.mobileChatClose = document.getElementById('btn-close-chat');
    this.chatContainer = document.getElementById('chat-container');
    this.unreadBadge = document.getElementById('chat-unread-badge');
    this.btnSendChat = document.getElementById('btn-send-chat');
    this.unreadCount = 0;
    this.scoreboard = document.getElementById('scoreboard-modal');
    this.urlInput = document.getElementById('webpage-url-input');
    this.helpModal = document.getElementById('help-modal');
    this.victoryShown = false;

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
        } else if (lower.includes('amazon')) {
          this.game.loadMapPreset('amazon', val, true);
        } else if (lower.includes('facebook') || lower.includes('fb.com')) {
          this.game.loadMapPreset('facebook', val, true);
        } else if (lower.includes('wikipedia')) {
          this.game.loadMapPreset('wikipedia', val, true);
        } else if (lower.includes('google')) {
          this.game.loadMapPreset('google', val, true);
        } else {
          // Attempt authentic live screenshot capture of the actual webpage first
          try {
            await this.game.loadUserImage(`/api/screenshot-url?url=${encodeURIComponent(val)}`);
            this.game.level.pageUrl = val;
            this.setPresetDisplay('custom', val);
          } catch (e) {
            const res = await fetch(`/api/parse-url?url=${encodeURIComponent(val)}`);
            const pageData = await res.json();
            await this.game.loadParsedWebpage(pageData, true);
          }
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
            const dataUrl = ev.target.result;
            await this.game.loadUserImage(dataUrl);

            // Sync image to multiplayer room so all friends joining receive the picture!
            try {
              let currentRoom = this.game.multiplayer.roomId || 'lobby';
              if (this.game.isSoloMode || !currentRoom || currentRoom === 'solo') {
                currentRoom = 'sala_' + Math.random().toString(36).substring(2, 7);
                this.game.isSoloMode = false;
                this.game.multiplayer.init(currentRoom, this.game.localPlayer.name, this.game.localPlayer.color);
              }

              const res = await fetch('/api/upload-room-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: currentRoom, imageBase64: dataUrl })
              });
              const resData = await res.json();
              console.log('[ROOM IMAGE SYNCED]:', resData);
              this.setPresetDisplay('image', 'Imagen Personalizada');
            } catch (err) {
              console.error('Failed to sync room image:', err);
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Share Room Modal Events
    const shareBtn = document.getElementById('btn-share-room');
    const shareModal = document.getElementById('share-modal');
    const closeShare = document.getElementById('btn-close-share');
    const copyShareUrlBtn = document.getElementById('btn-copy-share-url');
    const shareRoomInput = document.getElementById('share-room-input');
    const shareRoomCode = document.getElementById('share-room-code');
    const whatsappBtn = document.getElementById('btn-whatsapp-share');

    if (shareBtn && shareModal) {
      shareBtn.addEventListener('click', () => {
        let currentRoom = this.game.multiplayer.roomId;
        if (this.game.isSoloMode || !currentRoom || currentRoom === 'solo') {
          currentRoom = 'sala_' + Math.random().toString(36).substring(2, 7);
          this.game.isSoloMode = false;
          const btnMulti = document.getElementById('btn-mode-multi');
          const btnSolo = document.getElementById('btn-mode-solo');
          if (btnMulti) btnMulti.classList.add('active');
          if (btnSolo) btnSolo.classList.remove('active');
          const chatCont = document.getElementById('chat-container');
          if (chatCont) chatCont.style.display = 'flex';
          // Color shift on multiplayer enter
          if (this.game.localPlayer.color === '#f97316') {
            this.game.localPlayer.color = '#38bdf8';
            const dot = document.getElementById('color-dot');
            if (dot) dot.style.background = '#38bdf8';
          }
          this.game.multiplayer.init(currentRoom, this.game.localPlayer.name, this.game.localPlayer.color);
        }

        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
        if (shareRoomInput) shareRoomInput.value = shareUrl;
        if (shareRoomCode) shareRoomCode.textContent = currentRoom.toUpperCase();

        if (whatsappBtn) {
          whatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent('¡Entra a destruir esta web conmigo en tiempo real! ' + shareUrl)}`;
        }

        shareModal.style.display = 'flex';

        // Auto copy
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            if (copyShareUrlBtn) copyShareUrlBtn.textContent = '✅ ¡Copiado!';
            setTimeout(() => { if (copyShareUrlBtn) copyShareUrlBtn.textContent = '📋 Copiar Enlace'; }, 3000);
          }).catch(() => {});
        }
      });
    }

    if (closeShare && shareModal) {
      closeShare.addEventListener('click', () => { shareModal.style.display = 'none'; });
    }

    if (copyShareUrlBtn && shareRoomInput) {
      copyShareUrlBtn.addEventListener('click', () => {
        shareRoomInput.select();
        shareRoomInput.setSelectionRange(0, 99999);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareRoomInput.value);
        } else {
          document.execCommand('copy');
        }
        copyShareUrlBtn.textContent = '✅ ¡Copiado con Éxito!';
        setTimeout(() => { copyShareUrlBtn.textContent = '📋 Copiar Enlace'; }, 3000);
      });
    }

    // Mobile Navigation Drawer Toggle
    const menuToggle = document.getElementById('btn-menu-toggle');
    const navDrawer = document.getElementById('nav-drawer');
    if (menuToggle && navDrawer) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navDrawer.classList.toggle('open');
      });
      navDrawer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          navDrawer.classList.remove('open');
        }
      });
      document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !navDrawer.contains(e.target)) {
          navDrawer.classList.remove('open');
        }
      });
    }

    // Operative Visor/Armor Color Switcher
    const colorBtn = document.getElementById('btn-color-picker');
    const colorDot = document.getElementById('color-dot');
    const OPERATIVE_PALETTE = [
      { name: 'Naranja Futuro', hex: '#f97316' },
      { name: 'Cian Neón', hex: '#38bdf8' },
      { name: 'Verde Ácido', hex: '#22c55e' },
      { name: 'Púrpura Cyber', hex: '#a855f7' },
      { name: 'Rosa Láser', hex: '#ec4899' },
      { name: 'Amarillo Solar', hex: '#eab308' },
      { name: 'Rojo Carmesí', hex: '#ef4444' },
      { name: 'Azul Eléctrico', hex: '#3b82f6' }
    ];
    let currentColorIndex = 0;

    if (colorBtn) {
      colorBtn.addEventListener('click', () => {
        currentColorIndex = (currentColorIndex + 1) % OPERATIVE_PALETTE.length;
        const chosen = OPERATIVE_PALETTE[currentColorIndex];
        this.game.localPlayer.color = chosen.hex;
        if (colorDot) colorDot.style.background = chosen.hex;
        if (!this.game.isSoloMode && this.game.multiplayer) {
          this.game.multiplayer.emitPlayerUpdate(this.game.localPlayer);
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
        // Dynamic Visor & Light color shift when entering multiplayer!
        if (this.game.localPlayer.color === '#f97316') {
          this.game.localPlayer.color = '#38bdf8';
          if (colorDot) colorDot.style.background = '#38bdf8';
        }
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

    // Custom Player Nickname
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
      const savedName = localStorage.getItem('destroy_player_name');
      if (savedName) {
        this.game.localPlayer.name = savedName;
        nameInput.value = savedName;
      }
      const handleNameChange = (val) => {
        const clean = val.replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 15);
        if (clean) {
          this.game.localPlayer.name = clean;
          localStorage.setItem('destroy_player_name', clean);
          if (!this.game.isSoloMode && this.game.multiplayer) {
            this.game.multiplayer.emitChangeName(clean);
            this.game.multiplayer.emitPlayerUpdate(this.game.localPlayer);
          }
        }
      };

      nameInput.addEventListener('input', (e) => handleNameChange(e.target.value));
      nameInput.addEventListener('change', (e) => handleNameChange(e.target.value));
    }

    // Centering Camera Button
    const btnCenter = document.getElementById('btn-center-camera');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        this.game.snapCameraToPlayer();
      });
    }

    // Mobile Chat Toggle Button
    if (this.mobileChatToggle && this.chatContainer) {
      this.mobileChatToggle.addEventListener('click', () => {
        this.chatContainer.classList.toggle('open-mobile');
        if (this.chatContainer.classList.contains('open-mobile')) {
          this.unreadCount = 0;
          if (this.unreadBadge) {
            this.unreadBadge.textContent = '0';
            this.unreadBadge.classList.remove('has-unread');
          }
          if (this.chatInput) this.chatInput.focus();
        }
      });
    }

    if (this.mobileChatClose && this.chatContainer) {
      this.mobileChatClose.addEventListener('click', () => {
        this.chatContainer.classList.remove('open-mobile');
      });
    }

    if (this.btnSendChat) {
      this.btnSendChat.addEventListener('click', () => {
        this.sendChat();
      });
    }

    // Live Mode Slow-Mo Button
    const btnLive = document.getElementById('btn-toggle-live');
    if (btnLive) {
      btnLive.addEventListener('click', () => {
        this.game.toggleLiveMode();
      });
    }

    // 3D Victory Modal Buttons
    const btnVictoryAnother = document.getElementById('btn-victory-another');
    const btnVictoryRestart = document.getElementById('btn-victory-restart');
    const victoryModal = document.getElementById('victory-modal');

    if (btnVictoryAnother && victoryModal) {
      btnVictoryAnother.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        this.victoryShown = false;
        if (this.urlInput) {
          this.urlInput.focus();
          this.urlInput.select();
        }
      });
    }

    if (btnVictoryRestart && victoryModal) {
      btnVictoryRestart.addEventListener('click', () => {
        victoryModal.style.display = 'none';
        this.victoryShown = false;
        this.game.loadMapPreset(this.game.level.presetName || 'wikipedia', this.game.level.pageUrl, true);
      });
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

    // 3D Obliteration Victory Celebration
    if (percent >= 99.0 && !this.victoryShown) {
      this.victoryShown = true;
      const vModal = document.getElementById('victory-modal');
      if (vModal) {
        vModal.style.display = 'flex';
        const vPct = document.getElementById('vstat-percent');
        const vScore = document.getElementById('vstat-score');
        const vPlayer = document.getElementById('vstat-player');
        if (vPct) vPct.textContent = `${percent.toFixed(1)}%`;
        if (vScore) vScore.textContent = (Math.round((this.game.localPlayer.kills * 1000) + (percent * 150))).toLocaleString();
        if (vPlayer) {
          vPlayer.textContent = this.game.localPlayer.name;
          vPlayer.style.color = this.game.localPlayer.color;
        }
        this.game.physics.spawnVictoryConfetti(this.game.localPlayer.x, this.game.localPlayer.y - 120);
      }
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

    // Mobile unread counter badge
    if (!this.chatContainer || !this.chatContainer.classList.contains('open-mobile')) {
      if (window.innerWidth <= 900) {
        this.unreadCount = (this.unreadCount || 0) + 1;
        if (this.unreadBadge) {
          this.unreadBadge.textContent = this.unreadCount;
          this.unreadBadge.classList.add('has-unread');
        }
      }
    }
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
