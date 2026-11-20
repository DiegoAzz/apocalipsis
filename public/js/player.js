// Player and Futuristic Operative Character Controller with Spritesheet Support
const spriteSheetImg = new Image();
spriteSheetImg.src = 'assets/spritesheet.png';

// Sprite Bounding Boxes from the uploaded Futuristic Pack
const SPRITES = {
  weapons: {
    'Pistol': { x: 48, y: 72, w: 112, h: 90 },
    'SMG': { x: 176, y: 70, w: 205, h: 92 },
    'Shotgun': { x: 411, y: 72, w: 240, h: 90 },
    'Rocket Launcher': { x: 671, y: 72, w: 309, h: 90 },
    'Railgun': { x: 40, y: 185, w: 336, h: 82 },
    'Flamethrower': { x: 410, y: 186, w: 271, h: 81 },
    'Misile': { x: 714, y: 185, w: 256, h: 82 },
    'Too Much': { x: 41, y: 290, w: 218, h: 87 },
    'The Magic Wand': { x: 288, y: 296, w: 248, h: 81 },
    'PSR B0531+21': { x: 588, y: 290, w: 235, h: 87 },
    'Grenade': { x: 842, y: 290, w: 114, h: 87 }
  },
  hero: {
    idle: [
      { x: 45, y: 500, w: 66, h: 81 },
      { x: 123, y: 500, w: 76, h: 81 },
      { x: 224, y: 500, w: 67, h: 82 }
    ],
    run: [
      { x: 335, y: 500, w: 91, h: 82 },
      { x: 430, y: 500, w: 96, h: 82 },
      { x: 535, y: 500, w: 98, h: 81 }
    ],
    jump: { x: 713, y: 500, w: 58, h: 82 },
    jetpack: { x: 775, y: 480, w: 95, h: 102 },
    landing: { x: 879, y: 500, w: 92, h: 82 },
    shoot: [
      { x: 42, y: 613, w: 94, h: 99 },
      { x: 161, y: 616, w: 105, h: 96 },
      { x: 275, y: 613, w: 141, h: 99 }
    ],
    damage: { x: 500, y: 616, w: 96, h: 96 },
    fall: { x: 617, y: 656, w: 105, h: 56 }
  }
};

class Player {
  constructor(id, name, color = '#f97316', isLocal = true) {
    this.id = id;
    this.name = name || 'Operative';
    this.color = color;
    this.isLocal = isLocal;

    // Spatial & Physics state
    this.x = 400;
    this.y = 150;
    this.vx = 0;
    this.vy = 0;
    this.width = 28;
    this.height = 48;

    this.onGround = false;
    this.onWall = 0;
    this.facing = 1; // 1 right, -1 left
    this.aimAngle = 0;
    this.aimX = 0;
    this.aimY = 0;

    // Movement attributes
    this.speed = 5.5;
    this.accel = 0.85;
    this.friction = 0.82;
    this.gravity = 0.48;
    this.jumpForce = -10.5;

    // Acrobatics & Jetpack
    this.flipAngle = 0;
    this.isFlipping = false;
    this.canDoubleJump = true;
    this.jetpackActive = false;
    this.jetpackFuel = 100;
    this.maxJetpackFuel = 100;
    this.fuelRechargeRate = 45;
    this.fuelBurnRate = 32;

    // Health & Score
    this.health = 100;
    this.maxHealth = 100;
    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;
    this.score = 0;
    this.isDead = false;
    this.respawnTimer = 0;

    // All weapons are FULL-AUTO with INFINITE AMMO
    this.weapons = [
      { name: 'Pistol', key: '1', fireRate: 0.13, damage: 18, radius: 9, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'SMG', key: '2', fireRate: 0.06, damage: 10, radius: 10, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'Shotgun', key: '3', fireRate: 0.42, damage: 15, radius: 14, ammo: Infinity, maxAmmo: Infinity, auto: true, pellets: 7 },
      { name: 'Rocket Launcher', key: '4', fireRate: 0.42, damage: 85, radius: 48, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'Railgun', key: '5', fireRate: 0.55, damage: 100, radius: 18, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'Flamethrower', key: '6', fireRate: 0.04, damage: 5, radius: 15, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'Too Much', key: '7', fireRate: 0.95, damage: 55, radius: 42, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'The Magic Wand', key: '8', fireRate: 1.1, damage: 130, radius: 38, ammo: Infinity, maxAmmo: Infinity, auto: true },
      { name: 'PSR B0531+21', key: '9', fireRate: 1.4, damage: 95, radius: 62, ammo: Infinity, maxAmmo: Infinity, auto: true }
    ];
    this.currentWeaponIndex = 0;
    this.fireCooldown = 0;
    this.grenadeCooldown = 0;

    // Animation state
    this.animTimer = 0;
    this.walkCycle = 0;
    this.muzzleFlash = 0;
    this.hurtTimer = 0;
  }

  getCurrentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  selectWeapon(index) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentWeaponIndex = index;
    }
  }

  // Returns Hue shift degrees based on player color for Multiplayer
  getHueShift() {
    const colorMap = {
      '#f97316': 0,    // Orange (Default)
      '#38bdf8': 185,  // Cyan / Electric Blue
      '#3b82f6': 210,  // Cobalt Blue
      '#22c55e': 95,   // Neon Green
      '#10b981': 115,  // Emerald
      '#a855f7': 260,  // Purple
      '#8b5cf6': 240,  // Violet
      '#ec4899': 315,  // Hot Pink
      '#ef4444': 345,  // Crimson Red
      '#eab308': 45,   // Golden Yellow
      '#06b6d4': 175   // Teal
    };
    return colorMap[this.color] || 0;
  }

  update(dt, input, level, physics, onShoot, onGrenade) {
    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn(level);
      }
      return;
    }

    this.animTimer += dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.grenadeCooldown > 0) this.grenadeCooldown -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    if (input) {
      this.aimX = input.mouseX;
      this.aimY = input.mouseY;
      const shoulderX = this.x;
      const shoulderY = this.y - 12;
      this.aimAngle = Math.atan2(input.mouseY - shoulderY, input.mouseX - shoulderX);
      this.facing = input.mouseX >= this.x ? 1 : -1;
    }

    // Horizontal Acceleration
    let moveDir = 0;
    if (input && (input.keys['ArrowLeft'] || input.keys['KeyA'])) moveDir -= 1;
    if (input && (input.keys['ArrowRight'] || input.keys['KeyD'])) moveDir += 1;

    if (moveDir !== 0) {
      this.vx += moveDir * this.accel;
      this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      this.walkCycle += dt * 14;
    } else {
      this.vx *= this.friction;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Jump & Jetpack
    const wantsJump = input && (input.keys['Space'] || input.keys['KeyW'] || input.keys['ArrowUp']);
    const justPressedJump = input && input.justPressedJump;

    if (justPressedJump) {
      if (this.onGround) {
        this.vy = this.jumpForce;
        this.onGround = false;
        this.canDoubleJump = true;
        window.soundManager.playJump();
      } else if (this.onWall !== 0) {
        this.vy = this.jumpForce * 0.9;
        this.vx = -this.onWall * this.speed * 1.1;
        this.onWall = 0;
        this.isFlipping = true;
        window.soundManager.playJump();
      } else if (this.canDoubleJump) {
        this.vy = this.jumpForce * 0.9;
        this.canDoubleJump = false;
        this.isFlipping = true;
        this.flipAngle = 0;
        window.soundManager.playJump();
      }
    }

    // Jetpack thrust
    if (wantsJump && !this.onGround && this.jetpackFuel > 0) {
      this.jetpackActive = true;
      this.vy = Math.max(-6.5, this.vy - 0.85);
      this.jetpackFuel = Math.max(0, this.jetpackFuel - this.fuelBurnRate * dt);
      physics.spawnJetpackFlame(this.x, this.y, this.facing);
      window.soundManager.playJetpack();
    } else {
      this.jetpackActive = false;
      if (this.onGround) {
        this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + this.fuelRechargeRate * dt);
      } else {
        this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + (this.fuelRechargeRate * 0.35) * dt);
      }
    }

    this.vy += this.gravity;
    if (this.onWall !== 0 && this.vy > 1.5) {
      this.vy = 1.5;
    }

    this.moveWithCollision(level);

    if (this.isFlipping) {
      this.flipAngle += this.facing * 18 * dt;
      if (Math.abs(this.flipAngle) >= Math.PI * 2) {
        this.isFlipping = false;
        this.flipAngle = 0;
      }
    }

    // Continuous Auto-Fire while holding
    if (input && input.isMouseDown) {
      this.tryShoot(physics, onShoot);
    }
    if (input && input.isRightMouseDown) {
      this.tryGrenade(physics, onGrenade);
    }
  }

  tryShoot(physics, onShoot) {
    if (this.fireCooldown > 0 || this.isDead) return;
    const w = this.getCurrentWeapon();

    this.fireCooldown = w.fireRate;
    this.muzzleFlash = 0.08;

    const shoulderX = this.x;
    const shoulderY = this.y - 12;
    const gunLength = 26;
    const originX = shoulderX + Math.cos(this.aimAngle) * gunLength;
    const originY = shoulderY + Math.sin(this.aimAngle) * gunLength;

    // Recoil
    this.vx -= Math.cos(this.aimAngle) * (w.name === 'Shotgun' ? 3.5 : 0.8);
    this.vy -= Math.sin(this.aimAngle) * (w.name === 'Shotgun' ? 2.5 : 0.4);

    physics.spawnMuzzleSmoke(originX, originY, this.aimAngle);

    if (w.name === 'Pistol') {
      window.soundManager.playPistol();
      physics.addProjectile({
        type: 'bullet',
        weapon: 'pistol',
        ownerId: this.id,
        x: originX,
        y: originY,
        vx: Math.cos(this.aimAngle) * 22,
        vy: Math.sin(this.aimAngle) * 22,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'SMG') {
      window.soundManager.playSMG();
      const spread = (Math.random() - 0.5) * 0.12;
      physics.addProjectile({
        type: 'bullet',
        weapon: 'smg',
        ownerId: this.id,
        x: originX,
        y: originY,
        vx: Math.cos(this.aimAngle + spread) * 24,
        vy: Math.sin(this.aimAngle + spread) * 24,
        damage: w.damage,
        radius: w.radius,
        life: 2.0
      });
    } else if (w.name === 'Shotgun') {
      window.soundManager.playShotgun();
      for (let i = 0; i < w.pellets; i++) {
        const spread = (Math.random() - 0.5) * 0.32;
        const spd = 18 + Math.random() * 6;
        physics.addProjectile({
          type: 'bullet',
          weapon: 'shotgun',
          ownerId: this.id,
          x: originX,
          y: originY,
          vx: Math.cos(this.aimAngle + spread) * spd,
          vy: Math.sin(this.aimAngle + spread) * spd,
          damage: w.damage,
          radius: w.radius,
          life: 0.8
        });
      }
    } else if (w.name === 'Rocket Launcher') {
      window.soundManager.playRocketLaunch();
      physics.addProjectile({
        type: 'rocket',
        weapon: 'rocket',
        ownerId: this.id,
        x: originX,
        y: originY,
        vx: Math.cos(this.aimAngle) * 14,
        vy: Math.sin(this.aimAngle) * 14,
        damage: w.damage,
        radius: w.radius,
        life: 4.0
      });
    } else if (w.name === 'Railgun') {
      window.soundManager.playRailgun();
      const maxDist = 1800;
      const endX = originX + Math.cos(this.aimAngle) * maxDist;
      const endY = originY + Math.sin(this.aimAngle) * maxDist;

      physics.level.carveLine(originX, originY, endX, endY, 18);
      physics.spawnShockwave(originX, originY, 40, '#38bdf8');
      physics.addTrauma(0.5);

      physics.particles.push({
        type: 'laser',
        x1: originX,
        y1: originY,
        x2: endX,
        y2: endY,
        color: '#67e8f9',
        life: 1.0,
        decay: 0.08
      });
    } else if (w.name === 'Flamethrower') {
      window.soundManager.playFlamethrower();
      const spread = (Math.random() - 0.5) * 0.22;
      const spd = 10 + Math.random() * 4;
      physics.addProjectile({
        type: 'flame',
        weapon: 'flame',
        ownerId: this.id,
        x: originX,
        y: originY,
        vx: Math.cos(this.aimAngle + spread) * spd,
        vy: Math.sin(this.aimAngle + spread) * spd,
        damage: w.damage,
        radius: w.radius,
        life: 0.45
      });
    } else if (w.name === 'Too Much') {
      window.soundManager.playRocketLaunch();
      physics.addProjectile({
        type: 'too_much',
        weapon: 'too_much',
        ownerId: this.id,
        x: originX,
        y: originY,
        vx: Math.cos(this.aimAngle) * 6,
        vy: Math.sin(this.aimAngle) * 6 - 2,
        timer: 1.5,
        radius: 40,
        damage: 55,
        life: 5.0
      });
    } else if (w.name === 'The Magic Wand') {
      window.soundManager.playMagicWand();
      physics.addProjectile({
        type: 'magic_wand',
        weapon: 'wand',
        ownerId: this.id,
        targetX: this.aimX,
        targetY: this.aimY,
        life: 0.1
      });
    } else if (w.name === 'PSR B0531+21') {
      window.soundManager.playNeutron();
      physics.addProjectile({
        type: 'neutron',
        weapon: 'neutron',
        ownerId: this.id,
        x: this.aimX,
        y: this.aimY,
        timer: 2.0,
        rotation: 0,
        life: 2.0
      });
    }

    if (onShoot) {
      onShoot({
        weapon: w.name,
        weaponIndex: this.currentWeaponIndex,
        originX,
        originY,
        aimAngle: this.aimAngle,
        aimX: this.aimX,
        aimY: this.aimY
      });
    }
  }

  tryGrenade(physics, onGrenade) {
    if (this.grenadeCooldown > 0 || this.isDead) return;
    this.grenadeCooldown = 0.55;

    const shoulderX = this.x;
    const shoulderY = this.y - 12;
    const speed = 12;
    const vx = Math.cos(this.aimAngle) * speed;
    const vy = Math.sin(this.aimAngle) * speed - 2;

    physics.addProjectile({
      type: 'grenade',
      weapon: 'grenade',
      ownerId: this.id,
      x: shoulderX,
      y: shoulderY,
      vx,
      vy,
      timer: 1.8,
      radius: 55,
      damage: 85,
      life: 5.0
    });

    if (onGrenade) {
      onGrenade({
        x: shoulderX,
        y: shoulderY,
        vx,
        vy
      });
    }
  }

  moveWithCollision(level) {
    const hw = 10;
    const hh = 22;

    const newX = this.x + this.vx;
    const sideCheck = this.vx > 0 ? hw : -hw;

    let colH = false;
    for (let dy = -hh + 4; dy <= hh - 4; dy += 8) {
      if (level.isSolid(newX + sideCheck, this.y + dy)) {
        colH = true;
        break;
      }
    }

    if (!colH) {
      this.x = Math.max(hw, Math.min(level.width - hw, newX));
      this.onWall = 0;
    } else {
      this.onWall = this.vx > 0 ? 1 : -1;
      this.vx = 0;
    }

    const newY = this.y + this.vy;
    let colV = false;

    if (this.vy > 0) {
      for (let dx = -hw + 4; dx <= hw - 4; dx += 6) {
        if (level.isSolid(this.x + dx, newY + hh)) {
          colV = true;
          break;
        }
      }
      if (colV) {
        this.onGround = true;
        this.canDoubleJump = true;
        this.isFlipping = false;
        this.flipAngle = 0;
        this.vy = 0;
        while (level.isSolid(this.x, this.y + hh)) {
          this.y -= 1;
        }
      } else {
        this.onGround = false;
        this.y = newY;
      }
    } else if (this.vy < 0) {
      for (let dx = -hw + 4; dx <= hw - 4; dx += 6) {
        if (level.isSolid(this.x + dx, newY - hh)) {
          colV = true;
          break;
        }
      }
      if (colV) {
        this.vy = 0;
      } else {
        this.y = newY;
      }
      this.onGround = false;
    }

    if (this.y > level.height + 60) {
      this.takeDamage(100, 'void', null);
    }
  }

  takeDamage(amount, weapon, attackerId) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.25;
    window.soundManager.playHit();

    if (this.health <= 0) {
      this.isDead = true;
      this.deaths++;
      this.respawnTimer = 2.5;
      window.soundManager.playDeath();
    }
  }

  respawn(level) {
    this.isDead = false;
    this.health = this.maxHealth;
    this.x = 250 + Math.random() * (level.width - 500);
    this.y = 120;
    this.vx = 0;
    this.vy = 0;
    this.jetpackFuel = this.maxJetpackFuel;
  }

  // RENDER FUTURISTIC OPERATIVE SPRITE
  render(ctx) {
    if (this.isDead) {
      // Draw fallen/knocked down operative sprite
      this.drawHeroSprite(ctx, SPRITES.hero.fall, 0, 10, 48, 26);
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.isFlipping) {
      ctx.rotate(this.flipAngle);
    }

    // Name tag with distinct Multiplayer Player Color
    ctx.fillStyle = this.color || '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(this.name, 0, -36);
    ctx.shadowBlur = 0;

    // Mini Health Bar
    const barW = 34;
    const barH = 4;
    ctx.fillStyle = '#374151';
    ctx.fillRect(-barW / 2, -32, barW, barH);
    ctx.fillStyle = this.health > 40 ? (this.color || '#22c55e') : '#ef4444';
    ctx.fillRect(-barW / 2, -32, (this.health / this.maxHealth) * barW, barH);

    // Jetpack Fuel Bar (Local player)
    if (this.isLocal) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-barW / 2, -26, barW, 2.5);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-barW / 2, -26, (this.jetpackFuel / this.maxJetpackFuel) * barW, 2.5);
    }

    // Select Hero Sprite based on action
    let heroSprite = SPRITES.hero.idle[0];
    let drawW = 34;
    let drawH = 42;
    let offY = -22;

    if (this.hurtTimer > 0) {
      heroSprite = SPRITES.hero.damage;
    } else if (this.jetpackActive) {
      heroSprite = SPRITES.hero.jetpack;
      drawW = 40;
      drawH = 44;
      offY = -22;
    } else if (!this.onGround) {
      heroSprite = SPRITES.hero.jump;
      drawW = 30;
      drawH = 42;
    } else if (Math.abs(this.vx) > 0.5) {
      const frameIdx = Math.floor(this.walkCycle) % 3;
      heroSprite = SPRITES.hero.run[frameIdx];
      drawW = 38;
      drawH = 42;
    } else if (this.muzzleFlash > 0) {
      heroSprite = SPRITES.hero.shoot[1];
      drawW = 42;
      drawH = 42;
    } else {
      const frameIdx = Math.floor(this.animTimer * 3) % 3;
      heroSprite = SPRITES.hero.idle[frameIdx];
      drawW = 34;
      drawH = 42;
    }

    // Apply Multiplayer Color Shift (Changes Visor & Armor Lights)
    const hueDeg = this.getHueShift();
    if (hueDeg !== 0) {
      ctx.filter = `hue-rotate(${hueDeg}deg) saturate(1.2)`;
    }

    // Facing direction
    ctx.scale(this.facing, 1);

    // Draw Hero Body Sprite from Spritesheet
    if (spriteSheetImg.complete && spriteSheetImg.naturalWidth > 0) {
      ctx.drawImage(
        spriteSheetImg,
        heroSprite.x, heroSprite.y, heroSprite.w, heroSprite.h,
        -drawW / 2, offY, drawW, drawH
      );
    } else {
      // Fallback stickman
      this.renderFallbackStickman(ctx);
    }

    ctx.filter = 'none';

    // Draw Weapon Sprite in Hands
    ctx.save();
    ctx.translate(4, -4);
    const renderAimAngle = this.facing === 1 ? this.aimAngle : (Math.PI - this.aimAngle);
    ctx.rotate(renderAimAngle);

    const w = this.getCurrentWeapon();
    this.renderWeaponSprite(ctx, w.name);

    // Muzzle flash effect
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(32, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.restore();
  }

  // Draw Futuristic Weapon Sprite from Spritesheet
  renderWeaponSprite(ctx, weaponName) {
    const sp = SPRITES.weapons[weaponName] || SPRITES.weapons['Pistol'];
    if (spriteSheetImg.complete && spriteSheetImg.naturalWidth > 0 && sp) {
      const targetH = 18;
      const targetW = Math.round(targetH * (sp.w / sp.h));
      ctx.drawImage(
        spriteSheetImg,
        sp.x, sp.y, sp.w, sp.h,
        0, -targetH / 2, targetW, targetH
      );
    } else {
      // Fallback
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, -3, 16, 6);
    }
  }

  drawHeroSprite(ctx, sp, ox, oy, dw, dh) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const hueDeg = this.getHueShift();
    if (hueDeg !== 0) ctx.filter = `hue-rotate(${hueDeg}deg) saturate(1.2)`;
    ctx.scale(this.facing, 1);
    if (spriteSheetImg.complete && spriteSheetImg.naturalWidth > 0) {
      ctx.drawImage(spriteSheetImg, sp.x, sp.y, sp.w, sp.h, ox - dw / 2, oy, dw, dh);
    }
    ctx.restore();
  }

  renderFallbackStickman(ctx) {
    ctx.strokeStyle = this.color || '#f97316';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 10);
    ctx.stroke();
  }
}

window.Player = Player;
window.SPRITES = SPRITES;
window.spriteSheetImg = spriteSheetImg;
