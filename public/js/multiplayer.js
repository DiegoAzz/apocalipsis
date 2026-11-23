// Real-Time Socket.io Multiplayer Client
class MultiplayerManager {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.connected = false;
    this.remotePlayers = new Map();
    this.roomId = 'lobby';
    this.selfId = null;
    this.lastEmitTime = 0;
    this.damageBuffer = [];
    setInterval(() => this.flushTerrainDamage(), 40);
  }

  sendJoinRoom() {
    if (!this.socket) return;
    let passExpires = 0;
    let hostEmail = '';
    let isVip = false;
    try {
      passExpires = parseInt(localStorage.getItem('apocalipsis_creator_pass_expires') || '0', 10);
      const authUser = JSON.parse(localStorage.getItem('apocalipsis_auth_user') || '{}');
      if (authUser.email) hostEmail = authUser.email;
      if (authUser.isVip || (passExpires > Date.now())) isVip = true;
    } catch (e) {}

    const playerName = (this.game && this.game.localPlayer && this.game.localPlayer.name) || this.localPlayerName || 'Operativo';
    const skinColor = (this.game && this.game.localPlayer && this.game.localPlayer.color) || this.localPlayerColor || '#f97316';

    console.log(`[MULTIPLAYER] Uniendo a sala "${this.roomId}" (isVip: ${isVip}, passExpires: ${passExpires})`);

    const currentPreset = (this.game && this.game.level && this.game.level.preset) || 'tiktok';
    const currentUrl = (this.game && this.game.level && this.game.level.pageUrl) || 'https://www.tiktok.com';
    const pageData = (this.game && this.game.level && this.game.level.pageData) || null;

    this.socket.emit('join-room', {
      room: this.roomId,
      name: playerName,
      skinColor,
      hostPassExpires: passExpires,
      hostEmail: hostEmail,
      isVip: isVip,
      currentPreset: isVip ? currentPreset : null,
      currentUrl: isVip ? currentUrl : null,
      pageData: isVip ? pageData : null
    });

    if (this.game && this.game.ui) {
      this.game.ui.setConnectionStatus(true, this.roomId);
    }

    // Si el usuario es anfitrión con pase activo y ya tiene un mapa cargado, sincronizar mapa a la nueva sala:
    if (this.game && this.game.level && isVip) {
      setTimeout(() => {
        if (this.game.level.pageData) {
          this.emitChangeMap('custom', this.game.level.pageUrl, this.game.level.pageData);
        } else if (this.game.level.preset && this.game.level.preset !== 'wikipedia') {
          this.emitChangeMap(this.game.level.preset, this.game.level.pageUrl || '');
        }
      }, 150);
    }
  }

  init(roomId = 'lobby', playerName = 'Operative', skinColor = '#f97316') {
    this.roomId = (roomId || 'lobby').trim().toLowerCase();
    this.localPlayerName = playerName;
    this.localPlayerColor = skinColor;

    if (typeof io === 'undefined') {
      console.warn('Socket.io library not loaded, running in offline mode.');
      return;
    }

    if (this.socket) {
      if (this.socket.connected) {
        this.sendJoinRoom();
        return;
      }
    } else {
      this.socket = io({
        reconnectionAttempts: 10,
        timeout: 10000
      });
      this.setupSocketListeners();
    }
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      this.connected = true;
      this.selfId = this.socket.id;
      if (this.game.localPlayer) {
        this.game.localPlayer.id = this.selfId;
      }
      this.sendJoinRoom();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      if (this.game && this.game.ui) this.game.ui.setConnectionStatus(false, this.roomId);
    });

    this.socket.on('room-access-denied', (err) => {
      console.warn('[ROOM ACCESS DENIED]:', err);
      if (this.game) {
        this.game.isSoloMode = true;
        const btnMulti = document.getElementById('btn-mode-multi');
        const btnSolo = document.getElementById('btn-mode-solo');
        if (btnMulti) btnMulti.classList.remove('active');
        if (btnSolo) btnSolo.classList.add('active');
        const chatCont = document.getElementById('chat-container');
        if (chatCont) chatCont.style.display = 'none';

        if (this.game.localPlayer) {
          this.game.localPlayer.isGuestFreePass = false;
          this.game.localPlayer.loadPersistence();
        }
        if (this.game.ui) {
          this.game.ui.refreshWeaponLocks();
          this.game.ui.showToast(err.message || '🔒 La sala compartida ha finalizado porque el plan del anfitrión venció.');
        }

        if (window.WompiManager && typeof window.WompiManager.openModal === 'function') {
          window.WompiManager.openModal('Plan del Anfitrión Finalizado');
        }
      }
    });

    this.socket.on('init-state', (data) => {
      this.selfId = data.selfId;
      if (this.game.localPlayer) {
        this.game.localPlayer.id = data.selfId;
        if (data.assignedColor) {
          this.game.localPlayer.color = data.assignedColor;
          const dot = document.getElementById('color-dot');
          if (dot) dot.style.background = data.assignedColor;
        }

        // Si es un invitado disfrutando de una sala compartida con anfitrión VIP:
        if (data.isGuestAccess) {
          this.game.localPlayer.isGuestFreePass = true;
          this.game.localPlayer.unlockedWeapons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
          if (this.game.ui) {
            this.game.ui.refreshWeaponLocks();
            this.game.ui.showToast(`🎉 ¡Te uniste a la sala de ${data.hostName || 'tu amigo'}! Juegas gratis con su Pase.`);
          }
          const hudRoom = document.getElementById('hud-room-name');
          if (hudRoom) {
            hudRoom.textContent = `SALA: ${(this.roomId || '').toUpperCase()} (INVITADO GRATIS)`;
          }
        }
      }

      // Load Map
      if (data.preset === 'image' && data.url) {
        this.game.loadUserImage(data.url, false);
        if (data.pageUrl) this.game.level.pageUrl = data.pageUrl;
        if (this.game.ui) this.game.ui.setPresetDisplay('image', data.pageUrl || 'Imagen Personalizada');
      } else if (data.pageData) {
        this.game.loadParsedWebpage(data.pageData, false);
      } else {
        this.game.loadMapPreset(data.preset || 'wikipedia', data.url, false);
      }

      this.game.isGameStarted = true;
      setTimeout(() => {
        this.game.snapCameraToPlayer();
        this.game.adaptZoomForCurrentMap();
      }, 100);

      // Replay recent craters
      if (data.craters && data.craters.length) {
        for (const c of data.craters) {
          this.game.level.carveHole(c.x, c.y, c.r, c.w);
        }
      }

      // Add remote players
      this.remotePlayers.clear();
      for (const pData of data.players) {
        if (pData.id === this.selfId) continue;
        const remote = new Player(pData.id, pData.name, pData.color, false);
        Object.assign(remote, pData);
        this.remotePlayers.set(pData.id, remote);
      }

      // Add bots
      if (data.bots && data.bots.length) {
        for (const bData of data.bots) {
          this.game.addBotFromData(bData);
        }
      }

      // Sync chat
      if (data.chatHistory) {
        for (const msg of data.chatHistory) {
          this.game.ui.appendChatMessage(msg);
        }
      }
    });

    this.socket.on('player-joined', (pData) => {
      if (pData.id === this.selfId) return;
      const remote = new Player(pData.id, pData.name, pData.color, false);
      Object.assign(remote, pData);
      this.remotePlayers.set(pData.id, remote);
      this.game.ui.updatePlayerCount(this.remotePlayers.size + 1);
    });

    this.socket.on('player-left', (playerId) => {
      this.remotePlayers.delete(playerId);
      this.game.ui.updatePlayerCount(this.remotePlayers.size + 1);
    });

    this.socket.on('player-renamed', ({ id, name, oldName }) => {
      const p = this.remotePlayers.get(id);
      if (p) {
        p.name = name;
      }
      if (this.game.ui) {
        this.game.ui.appendChatMessage({
          sender: 'SISTEMA',
          color: '#38bdf8',
          text: `👤 ${oldName} ahora es ${name}`
        });
      }
    });

    this.socket.on('player-moved', (data) => {
      const p = this.remotePlayers.get(data.id);
      if (p) {
        if (data.name && data.name !== p.name) p.name = data.name;
        // Smooth target lerp
        p.targetX = data.x;
        p.targetY = data.y;
        p.vx = data.vx;
        p.vy = data.vy;
        p.aimAngle = data.aimAngle || 0;
        p.facing = data.facing || 1;
        p.jetpackActive = data.jetpack || false;
        p.currentWeaponIndex = data.weaponIndex || 0;
        p.health = data.health !== undefined ? data.health : p.health;
        if (data.color) p.color = data.color;
        p.walkCycle = data.walkCycle || 0;
        p.isFlipping = data.isFlipping || false;
        p.flipAngle = data.flipAngle || 0;
      }
    });

    this.socket.on('player-shot', (data) => {
      const p = this.remotePlayers.get(data.playerId);
      if (p) {
        p.aimAngle = data.aimAngle;
        p.currentWeaponIndex = data.weaponIndex;
        p.muzzleFlash = 0.08;
      }
      this.game.spawnRemoteShot(data);
    });

    this.socket.on('player-threw-grenade', (data) => {
      this.game.physics.addProjectile({
        type: 'grenade',
        weapon: 'grenade',
        ownerId: data.playerId,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        timer: 1.8,
        radius: 55,
        damage: 85,
        life: 5.0
      });
    });

    this.socket.on('terrain-damaged', (data) => {
      const debris = this.game.level.carveHole(data.x, data.y, data.radius || data.r, data.weapon || data.w);
      this.game.physics.spawnDebris(debris);
      this.game.ui.updateDestructionBar(this.game.level.getDestructionPercentage());
    });

    this.socket.on('terrain-damaged-batch', (batch) => {
      if (!Array.isArray(batch)) return;
      for (const data of batch) {
        const debris = this.game.level.carveHole(data.x, data.y, data.r || data.radius, data.w || data.weapon);
        this.game.physics.spawnDebris(debris);
      }
      this.game.ui.updateDestructionBar(this.game.level.getDestructionPercentage());
    });

    this.socket.on('player-health-update', ({ targetId, health, damage, attackerId }) => {
      const target = this.game.findTargetById(targetId);
      if (target) {
        target.health = health;
        if (target === this.game.localPlayer) {
          window.soundManager.playHit();
          this.game.physics.addTrauma(0.3);
        }
      }
    });

    this.socket.on('player-killed', (killData) => {
      this.game.ui.addKillFeedEntry(killData);
      const target = this.game.findTargetById(killData.targetId);
      if (target) {
        target.isDead = true;
        target.deaths++;
      }
      const attacker = this.game.findTargetById(killData.attackerId);
      if (attacker) {
        attacker.kills++;
      }
    });

    this.socket.on('player-respawned', ({ id, x, y, health }) => {
      const target = this.game.findTargetById(id);
      if (target) {
        target.isDead = false;
        target.health = health;
        target.x = x;
        target.y = y;
        target.vx = 0;
        target.vy = 0;
      }
    });

    this.socket.on('bot-spawned', (botData) => {
      this.game.addBotFromData(botData);
    });

    this.socket.on('map-changed', ({ preset, url, pageData, pageUrl }) => {
      if (preset === 'image' && url) {
        this.game.loadUserImage(url, false);
        if (pageUrl) this.game.level.pageUrl = pageUrl;
        if (this.game.ui) this.game.ui.setPresetDisplay('image', pageUrl || 'Imagen Personalizada');
      } else if (pageData) {
        this.game.loadParsedWebpage(pageData, false);
      } else {
        this.game.loadMapPreset(preset, url, false);
      }
    });

    this.socket.on('chat-message', (msg) => {
      this.game.ui.appendChatMessage(msg);
    });
  }

  // Periodic local player position broadcast (30Hz)
  emitPlayerUpdate(player) {
    if (!this.connected || !this.socket) return;
    const now = performance.now();
    if (now - this.lastEmitTime < 33) return; // ~30 fps throttle
    this.lastEmitTime = now;

    this.socket.emit('player-update', {
      name: player.name,
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.vx * 10) / 10,
      vy: Math.round(player.vy * 10) / 10,
      aimAngle: Math.round(player.aimAngle * 100) / 100,
      facing: player.facing,
      jetpack: player.jetpackActive,
      weaponIndex: player.currentWeaponIndex,
      health: player.health,
      color: player.color,
      walkCycle: Math.round(player.walkCycle * 10) / 10,
      isFlipping: player.isFlipping,
      flipAngle: Math.round(player.flipAngle * 100) / 100
    });
  }

  emitChangeName(newName) {
    if (this.connected && this.socket) {
      this.socket.emit('change-name', { name: newName });
    }
  }

  emitShoot(shootData) {
    if (this.connected && this.socket) {
      this.socket.emit('player-shoot', shootData);
    }
  }

  emitGrenade(grenadeData) {
    if (this.connected && this.socket) {
      this.socket.emit('player-grenade', grenadeData);
    }
  }

  emitTerrainDamage(x, y, radius, weapon) {
    if (!this.connected || !this.socket) return;
    this.damageBuffer.push({
      x: Math.round(x),
      y: Math.round(y),
      r: Math.round(radius),
      w: weapon
    });
    if (this.damageBuffer.length >= 8) {
      this.flushTerrainDamage();
    }
  }

  flushTerrainDamage() {
    if (!this.connected || !this.socket || this.damageBuffer.length === 0) return;
    const batch = this.damageBuffer;
    this.damageBuffer = [];
    this.socket.emit('terrain-damage-batch', batch);
  }

  emitPlayerHit(targetId, damage, weapon, attackerId) {
    if (this.connected && this.socket) {
      this.socket.emit('player-hit', { targetId, damage, weapon, attackerId });
    }
  }

  emitChat(text) {
    if (this.connected && this.socket) {
      this.socket.emit('chat-message', { text });
    }
  }

  emitSpawnBot() {
    if (this.connected && this.socket) {
      this.socket.emit('spawn-bot');
    }
  }

  emitChangeMap(preset, url, pageData) {
    if (this.connected && this.socket) {
      this.socket.emit('change-map', { preset, url, pageData });
    }
  }
}

window.MultiplayerManager = MultiplayerManager;
