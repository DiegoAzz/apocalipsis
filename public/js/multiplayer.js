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
  }

  init(roomId = 'lobby', playerName = 'Operative', skinColor = '#f97316') {
    this.roomId = roomId;

    if (typeof io === 'undefined') {
      console.warn('Socket.io library not loaded, running in offline mode.');
      return;
    }

    this.socket = io({
      reconnectionAttempts: 5,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.selfId = this.socket.id;
      if (this.game.localPlayer) {
        this.game.localPlayer.id = this.selfId;
      }
      this.socket.emit('join-room', {
        room: this.roomId,
        name: playerName,
        skinColor
      });
      this.game.ui.setConnectionStatus(true, this.roomId);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.game.ui.setConnectionStatus(false, this.roomId);
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
      }

      // Load Map
      if (data.preset === 'image' && data.url) {
        this.game.loadUserImage(data.url, false);
      } else {
        this.game.loadMapPreset(data.preset, data.url, false);
      }

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
      const debris = this.game.level.carveHole(data.x, data.y, data.radius, data.weapon);
      this.game.physics.spawnDebris(debris);
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

    this.socket.on('map-changed', ({ preset, url, pageData }) => {
      if (preset === 'image' && url) {
        this.game.loadUserImage(url, false);
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
    if (this.connected && this.socket) {
      this.socket.emit('terrain-damage', { x, y, radius, weapon });
    }
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
