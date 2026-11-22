// Idle & Incremental Mechanics Manager for Apocalipsis
class IdleManager {
  constructor(game) {
    this.game = game;

    // Balances
    this.cash = 0;
    this.lifetimeCash = 0;
    this.prestigeCores = 0;
    this.prestigeMultiplier = 1.0;

    // Multipliers & Boosts
    this.boostTimer = 0; // Seconds remaining of 2x boost
    this.boostActive = false;

    // Rate Calculation ($/sec)
    this.cashEarnedWindow = 0;
    this.cashPerSecond = 0;
    this.rateCalcTimer = 0;

    // Upgrades Definition
    this.upgrades = {
      clickPower: {
        name: 'Valor por Píxel',
        icon: '💰',
        level: 1,
        baseCost: 20,
        costMult: 1.25,
        desc: 'Aumenta el dinero obtenido por cada bloque destruido.'
      },
      weaponPower: {
        name: 'Radio Devastador',
        icon: '💥',
        level: 1,
        baseCost: 60,
        costMult: 1.30,
        desc: 'Aumenta el tamaño de los cráteres de tus armas.'
      },
      drones: {
        name: 'Drones Autónomos',
        icon: '🚁',
        level: 0,
        baseCost: 150,
        costMult: 1.35,
        desc: 'Despliega drones que vuelan y disparan láseres solos.'
      },
      meteorRain: {
        name: 'Lluvia de Meteoritos',
        icon: '☄️',
        level: 0,
        baseCost: 400,
        costMult: 1.40,
        desc: 'Lluvia orbital de meteoritos cada pocos segundos.'
      },
      alliedBots: {
        name: 'Operativos Aliados',
        icon: '🤖',
        level: 0,
        baseCost: 850,
        costMult: 1.50,
        desc: 'Contrata soldados con jetpack que destruyen la web.'
      },
      orbitalNuke: {
        name: 'Nuke Orbital Pasiva',
        icon: '☢️',
        level: 0,
        baseCost: 3000,
        costMult: 1.65,
        desc: 'Detona una bomba atómica automáticamente de forma periódica.'
      }
    };

    // Autonomous Entities
    this.drones = [];
    this.meteorTimer = 0;
    this.nukeTimer = 0;
    this.floatingTexts = [];
    this.soundThrottle = 0;

    // Load save
    this.load();
    this.setupUI();
    this.checkOfflineEarnings();
  }

  // Calculate current upgrade cost
  getUpgradeCost(key) {
    const up = this.upgrades[key];
    if (!up) return Infinity;
    return Math.round(up.baseCost * Math.pow(up.costMult, up.level - (key === 'clickPower' || key === 'weaponPower' ? 1 : 0)));
  }

  // Buy upgrade
  buyUpgrade(key) {
    const cost = this.getUpgradeCost(key);
    if (this.cash >= cost) {
      this.cash -= cost;
      this.upgrades[key].level++;

      if (window.soundManager) window.soundManager.playUpgrade();

      // Trigger entity adjustments
      if (key === 'drones') {
        this.syncDrones();
      } else if (key === 'alliedBots') {
        if (this.game && this.game.spawnBot) {
          this.game.spawnBot();
        }
      }

      this.save();
      this.updateUI();
      return true;
    }
    return false;
  }

  // Sync drone count with upgrade level
  syncDrones() {
    const targetCount = this.upgrades.drones.level;
    while (this.drones.length < targetCount) {
      this.drones.push({
        id: Math.random().toString(36).substr(2, 6),
        x: this.game.localPlayer ? this.game.localPlayer.x + (Math.random() - 0.5) * 300 : 500,
        y: this.game.localPlayer ? this.game.localPlayer.y - 120 : 300,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        shootCooldown: 0.5 + Math.random() * 1.5,
        targetX: 0,
        targetY: 0,
        laserLife: 0,
        rotorAngle: 0
      });
    }
  }

  // Handle destruction event from LevelGenerator
  onCellsDestroyed(cellCount, x, y) {
    if (!cellCount || cellCount <= 0) return;

    // Calculation: (Cell Count) * (Click Power Level * 1.2) * (Prestige Multiplier) * (Boost)
    const baseVal = this.upgrades.clickPower.level * 1.25;
    const boost = this.boostActive ? 2.0 : 1.0;
    const earned = Math.max(1, Math.round(cellCount * baseVal * this.prestigeMultiplier * boost));

    this.cash += earned;
    this.lifetimeCash += earned;
    this.cashEarnedWindow += earned;

    // Floating Cash Text (clamped to prevent lag)
    if (this.floatingTexts.length < 35) {
      this.floatingTexts.push({
        text: `+$${earned.toLocaleString()}`,
        x: x + (Math.random() - 0.5) * 40,
        y: y - 10,
        vy: -1.8 - Math.random() * 1.5,
        life: 1.0,
        color: this.boostActive ? '#fbbf24' : '#22c55e'
      });
    }

    // Audio chime throttled to 80ms
    if (this.soundThrottle <= 0 && window.soundManager) {
      window.soundManager.playCoin();
      this.soundThrottle = 0.08;
    }

    this.updateUI();
  }

  // Active Ad Boost (x2 for 5 minutes)
  triggerAdBoost() {
    // Integration hook for Poki / CrazyGames rewarded ads
    const applyBoost = () => {
      this.boostTimer = 300; // 5 minutes
      this.boostActive = true;
      if (window.soundManager) window.soundManager.playUpgrade();
      this.showNotification('⚡ BOOST 2X ACTIVADO: ¡Ganancias dobles durante 5 minutos!');
      this.updateUI();
    };

    if (typeof window.PokiSDK !== 'undefined' && window.PokiSDK.rewardedBreak) {
      window.PokiSDK.rewardedBreak().then((success) => {
        if (success) applyBoost();
      });
    } else if (typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
      window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adFinished: () => applyBoost(),
        adError: () => applyBoost() // fallback gracefully
      });
    } else {
      // Direct simulation for local/direct players
      applyBoost();
    }
  }

  // Atomic Prestige: Reset map, award plutonium cores, grant permanent multiplier
  triggerPrestige() {
    const percent = this.game.level ? this.game.level.getDestructionPercent() : 0;
    if (percent < 45.0) {
      alert('¡Necesitas destruir al menos el 45% de la página web para realizar el Prestigio Atómico!');
      return;
    }

    const earnedCores = Math.max(1, Math.floor(percent / 10));
    if (confirm(`⚛️ PRESTIGIO ATÓMICO ⚛️\n\n¿Deseas reiniciar la web actual a cambio de ${earnedCores} Núcleos de Plutonio (+${earnedCores * 50}% de multiplicador permanente)?`)) {
      this.prestigeCores += earnedCores;
      this.prestigeMultiplier = 1.0 + (this.prestigeCores * 0.5);

      // Reset cash and non-prestige upgrades
      this.cash = 0;
      this.upgrades.clickPower.level = 1;
      this.upgrades.weaponPower.level = 1;
      this.upgrades.drones.level = 0;
      this.upgrades.meteorRain.level = 0;
      this.upgrades.alliedBots.level = 0;
      this.upgrades.orbitalNuke.level = 0;
      this.drones = [];

      // Respawn map
      if (this.game.loadMapPreset) {
        this.game.loadMapPreset(this.game.level.presetName || 'google', this.game.level.pageUrl, true);
      }

      this.save();
      this.updateUI();
      this.showNotification(`⚛️ ¡Prestigio completado! Multiplicador permanente ahora es x${this.prestigeMultiplier.toFixed(1)}`);
    }
  }

  // Update loop
  update(dt) {
    // Si la misión no ha comenzado (intro visible), no soltar bombas ni meteoros pasivos
    if (!this.game || !this.game.isGameStarted) return;

    if (this.soundThrottle > 0) this.soundThrottle -= dt;

    // 1. Boost Timer
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.boostActive = true;
      if (this.boostTimer <= 0) {
        this.boostActive = false;
        this.showNotification('El Boost 2x ha terminado.');
      }
    }

    // 2. Calculate $/second rate every 1.0s
    this.rateCalcTimer += dt;
    if (this.rateCalcTimer >= 1.0) {
      this.cashPerSecond = this.cashEarnedWindow / this.rateCalcTimer;
      this.cashEarnedWindow = 0;
      this.rateCalcTimer = 0;
      this.updateRateDisplay();
    }

    // 3. Drones, Meteors and Passive Nukes are strictly disabled from auto-destroying terrain
    // so the page is NEVER destroyed automatically without player action.
    this.drones = [];

    // 6. Floating Texts Update
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= dt * 1.4;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // Autonomous Drone Loop
  updateDrones(dt) {
    const level = this.game.level;
    for (const d of this.drones) {
      d.rotorAngle += dt * 35;
      d.shootCooldown -= dt;
      if (d.laserLife > 0) d.laserLife -= dt;

      // Hover / patrol movement
      d.x += d.vx;
      d.y += d.vy;

      // Boundary bounce
      if (d.x < 150) { d.x = 150; d.vx = Math.abs(d.vx); }
      if (d.x > level.width - 150) { d.x = level.width - 150; d.vx = -Math.abs(d.vx); }
      if (d.y < 80) { d.y = 80; d.vy = Math.abs(d.vy); }
      if (d.y > 600) { d.y = 600; d.vy = -Math.abs(d.vy); }

      // Fire autonomous laser at nearby solid terrain
      if (d.shootCooldown <= 0) {
        d.shootCooldown = Math.max(0.6, 1.8 - this.upgrades.drones.level * 0.15);
        // Find solid cell below drone
        const scanDist = 450;
        let targetFound = false;
        for (let rad = 30; rad < scanDist; rad += 25) {
          const sampleAngle = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const sx = Math.floor(d.x + Math.cos(sampleAngle) * rad);
          const sy = Math.floor(d.y + Math.sin(sampleAngle) * rad);
          if (sx >= 0 && sx < level.width && sy >= 0 && sy < level.height && level.isSolid(sx, sy)) {
            d.targetX = sx;
            d.targetY = sy;
            d.laserLife = 0.15;
            targetFound = true;
            break;
          }
        }

        if (targetFound) {
          const r = 16 + this.upgrades.weaponPower.level * 2;
          const debris = level.carveHole(d.targetX, d.targetY, r, 'laser');
          if (this.game.physics) {
            this.game.physics.spawnDebris(debris);
            this.game.physics.spawnSparks(d.targetX, d.targetY, 6, '#38bdf8', 3, 8);
          }
        }
      }
    }
  }

  // Trigger Passive Meteorite from Orbit
  triggerPassiveMeteor() {
    if (!this.game || !this.game.level || !this.game.physics) return;
    const lvl = this.game.level;
    const targetX = 200 + Math.random() * (lvl.width - 400);
    const targetY = 150 + Math.random() * (lvl.height - 300);

    // Launch heavy meteorite projectile downwards
    this.game.physics.addProjectile({
      type: 'rocket',
      weapon: 'meteor',
      ownerId: 'orbital_meteor',
      x: targetX - 250,
      y: -50,
      vx: 8.5,
      vy: 11.0,
      damage: 150,
      radius: 45 + this.upgrades.weaponPower.level * 3,
      life: 4.0
    });
  }

  // Trigger Passive Orbital Nuke
  triggerPassiveNuke() {
    if (!this.game || !this.game.level || !this.game.physics) return;
    const lvl = this.game.level;
    const targetX = 300 + Math.random() * (lvl.width - 600);
    const targetY = 250 + Math.random() * (lvl.height - 500);

    this.showNotification('☢️ ¡ALERTA! BOMBARDERO ORBITAL DESPLEGANDO NUKE PASIVA');
    this.game.physics.addProjectile({
      type: 'nuke',
      weapon: 'nuke',
      ownerId: 'orbital_nuke',
      x: targetX,
      y: -80,
      vx: 0,
      vy: 8.0,
      radius: 180 + this.upgrades.weaponPower.level * 5,
      damage: 500,
      life: 5.0
    });
  }

  // Render Drones, Lasers & Floating Cash on World Canvas
  render(ctx) {
    // 1. Render Drones
    for (const d of this.drones) {
      ctx.save();
      ctx.translate(d.x, d.y);

      // Laser Beam to target
      if (d.laserLife > 0) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(d.targetX - d.x, d.targetY - d.y);
        ctx.stroke();
        ctx.restore();
      }

      // Drone Body (Futuristic Quadcopter)
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-14, -8, 28, 16, 4);
      ctx.fill();
      ctx.stroke();

      // Glowing Cyan Visor
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fillRect(-6, -2, 12, 4);

      // Rotors
      const rotorDist = 18;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      [-rotorDist, rotorDist].forEach((rx) => {
        ctx.fillRect(rx - 8, -12, 16, 2);
        ctx.beginPath();
        ctx.arc(rx, -11, 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();
      });

      ctx.restore();
    }

    // 2. Render Floating Cash Numbers
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.font = '900 16px Arial, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 5;
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // Setup DOM Elements & Listeners
  setupUI() {
    const btnToggleStore = document.getElementById('btn-idle-store-toggle');
    const storeDrawer = document.getElementById('idle-store-drawer');
    const btnCloseStore = document.getElementById('btn-close-idle-store');
    const btnBoost = document.getElementById('btn-idle-boost');
    const btnPrestige = document.getElementById('btn-idle-prestige');

    if (btnToggleStore && storeDrawer) {
      btnToggleStore.addEventListener('click', () => {
        storeDrawer.classList.toggle('open');
        this.renderStoreItems();
      });
    }

    if (btnCloseStore && storeDrawer) {
      btnCloseStore.addEventListener('click', () => {
        storeDrawer.classList.remove('open');
      });
    }

    if (btnBoost) {
      btnBoost.addEventListener('click', () => this.triggerAdBoost());
    }

    if (btnPrestige) {
      btnPrestige.addEventListener('click', () => this.triggerPrestige());
    }

    this.renderStoreItems();
    this.updateUI();
  }

  // Render the Store Items list inside drawer
  renderStoreItems() {
    const listEl = document.getElementById('idle-store-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    Object.keys(this.upgrades).forEach((key) => {
      const up = this.upgrades[key];
      const cost = this.getUpgradeCost(key);
      const canAfford = this.cash >= cost;

      const itemEl = document.createElement('div');
      itemEl.className = `idle-upgrade-card ${canAfford ? 'affordable' : 'locked'}`;
      itemEl.innerHTML = `
        <div class="upgrade-left">
          <span class="upgrade-icon">${up.icon}</span>
          <div class="upgrade-info">
            <div class="upgrade-title">${up.name} <span class="upgrade-lvl">Nv. ${up.level}</span></div>
            <div class="upgrade-desc">${up.desc}</div>
          </div>
        </div>
        <button class="btn btn-buy-upgrade ${canAfford ? 'btn-success' : 'btn-disabled'}" data-upgrade="${key}">
          <span>$${cost.toLocaleString()}</span>
        </button>
      `;

      itemEl.querySelector('.btn-buy-upgrade').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.buyUpgrade(key)) {
          this.renderStoreItems();
        }
      });

      listEl.appendChild(itemEl);
    });

    // Update Prestige Core display
    const coreEl = document.getElementById('idle-cores-text');
    if (coreEl) {
      coreEl.textContent = `⚛️ Núcleos de Plutonio: ${this.prestigeCores} (x${this.prestigeMultiplier.toFixed(1)} Mult Permanente)`;
    }
  }

  // Update HUD text displays
  updateUI() {
    const cashEl = document.getElementById('idle-cash-display');
    if (cashEl) {
      cashEl.textContent = `$ ${Math.floor(this.cash).toLocaleString()}`;
    }

    const boostBtn = document.getElementById('btn-idle-boost');
    if (boostBtn) {
      if (this.boostActive) {
        boostBtn.classList.add('active');
        const mins = Math.floor(this.boostTimer / 60);
        const secs = Math.floor(this.boostTimer % 60);
        boostBtn.innerHTML = `<span>⚡ 2X ACTIVO (${mins}:${secs < 10 ? '0' : ''}${secs})</span>`;
      } else {
        boostBtn.classList.remove('active');
        boostBtn.innerHTML = `<span>⚡ BOOST 2X (ANUNCIO)</span>`;
      }
    }

    // Refresh store buttons affordability
    document.querySelectorAll('.idle-upgrade-card').forEach((card) => {
      const btn = card.querySelector('.btn-buy-upgrade');
      if (!btn) return;
      const key = btn.getAttribute('data-upgrade');
      const cost = this.getUpgradeCost(key);
      if (this.cash >= cost) {
        card.classList.add('affordable');
        card.classList.remove('locked');
        btn.classList.add('btn-success');
        btn.classList.remove('btn-disabled');
      } else {
        card.classList.remove('affordable');
        card.classList.add('locked');
        btn.classList.remove('btn-success');
        btn.classList.add('btn-disabled');
      }
    });
  }

  updateRateDisplay() {
    const rateEl = document.getElementById('idle-rate-display');
    if (rateEl) {
      rateEl.textContent = `+ $${Math.round(this.cashPerSecond).toLocaleString()} / seg`;
    }
  }

  showNotification(msg) {
    if (this.game && this.game.ui && this.game.ui.appendChatMessage) {
      this.game.ui.appendChatMessage({
        sender: 'SISTEMA APOCALIPSIS',
        text: msg,
        color: '#f59e0b'
      });
    }
  }

  // Offline earnings calculation
  checkOfflineEarnings() {
    const lastTime = parseInt(localStorage.getItem('apocalipsis_idle_last_time') || '0', 10);
    const now = Date.now();
    if (lastTime > 0 && this.upgrades.drones.level > 0) {
      const elapsedSeconds = Math.min(86400, Math.floor((now - lastTime) / 1000));
      if (elapsedSeconds > 30) {
        // Base passive estimate: 12 * drones * prestigeMult
        const earned = Math.round(elapsedSeconds * this.upgrades.drones.level * 4 * this.prestigeMultiplier);
        if (earned > 0) {
          this.cash += earned;
          this.lifetimeCash += earned;
          setTimeout(() => {
            alert(`💤 ¡BIENVENIDO DE VUELTA!\nTus drones y defensas automáticas generaron:\n\n💰 $${earned.toLocaleString()} mientras estuviste fuera.`);
            this.updateUI();
          }, 800);
        }
      }
    }
  }

  // Save state to LocalStorage
  save() {
    const data = {
      cash: this.cash,
      lifetimeCash: this.lifetimeCash,
      prestigeCores: this.prestigeCores,
      upgrades: {
        clickPower: this.upgrades.clickPower.level,
        weaponPower: this.upgrades.weaponPower.level,
        drones: this.upgrades.drones.level,
        meteorRain: this.upgrades.meteorRain.level,
        alliedBots: this.upgrades.alliedBots.level,
        orbitalNuke: this.upgrades.orbitalNuke.level
      },
      lastTime: Date.now()
    };
    try {
      localStorage.setItem('apocalipsis_idle_save', JSON.stringify(data));
      localStorage.setItem('apocalipsis_idle_last_time', Date.now().toString());
    } catch (e) {}
  }

  // Load state from LocalStorage
  load() {
    try {
      const raw = localStorage.getItem('apocalipsis_idle_save');
      if (raw) {
        const d = JSON.parse(raw);
        if (d.cash) this.cash = d.cash;
        if (d.lifetimeCash) this.lifetimeCash = d.lifetimeCash;
        if (d.prestigeCores) {
          this.prestigeCores = d.prestigeCores;
          this.prestigeMultiplier = 1.0 + (this.prestigeCores * 0.5);
        }
        if (d.upgrades) {
          Object.keys(d.upgrades).forEach((k) => {
            if (this.upgrades[k]) {
              this.upgrades[k].level = d.upgrades[k];
            }
          });
        }
      }
    } catch (e) {}
    this.syncDrones();
  }
}

window.IdleManager = IdleManager;
