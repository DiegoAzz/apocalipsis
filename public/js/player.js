// Player and Stickman Character Controller
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
    this.width = 24;
    this.height = 42;

    this.onGround = false;
    this.onWall = 0; // -1 left, 1 right, 0 none
    this.facing = 1; // 1 right, -1 left
    this.aimAngle = 0;
    this.aimX = 0;
    this.aimY = 0;

    // Movement attributes
    this.speed = 5.2;
    this.accel = 0.8;
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
    this.fuelRechargeRate = 45; // per sec
    this.fuelBurnRate = 32;     // per sec

    // Health & Score
    this.health = 100;
    this.maxHealth = 100;
    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;
    this.score = 0;
    this.isDead = false;
    this.respawnTimer = 0;

    // Weapons definition
    this.weapons = [
      { name: 'Pistol', key: '1', fireRate: 0.2, damage: 18, radius: 8, ammo: Infinity, maxAmmo: Infinity, auto: false },
      { name: 'SMG', key: '2', fireRate: 0.08, damage: 9, radius: 9, ammo: 45, maxAmmo: 45, auto: true },
      { name: 'Shotgun', key: '3', fireRate: 0.65, damage: 14, radius: 12, ammo: 8, maxAmmo: 8, auto: false, pellets: 6 },
      { name: 'Rocket Launcher', key: '4', fireRate: 0.9, damage: 85, radius: 48, ammo: 5, maxAmmo: 5, auto: false },
      { name: 'Railgun', key: '5', fireRate: 1.1, damage: 100, radius: 16, ammo: 4, maxAmmo: 4, auto: false },
      { name: 'Flamethrower', key: '6', fireRate: 0.05, damage: 4, radius: 14, ammo: 100, maxAmmo: 100, auto: true },
      { name: 'Too Much', key: '7', fireRate: 2.0, damage: 50, radius: 40, ammo: 2, maxAmmo: 2, auto: false },
      { name: 'The Magic Wand', key: '8', fireRate: 2.5, damage: 120, radius: 36, ammo: 2, maxAmmo: 2, auto: false },
      { name: 'PSR B0531+21', key: '9', fireRate: 3.5, damage: 90, radius: 60, ammo: 1, maxAmmo: 1, auto: false }
    ];
    this.currentWeaponIndex = 0;
    this.fireCooldown = 0;
    this.grenadeCooldown = 0;

    // Animation frames
    this.walkCycle = 0;
    this.muzzleFlash = 0;
  }

  getCurrentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  selectWeapon(index) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentWeaponIndex = index;
    }
  }

  // Update input & physics for local player
  update(dt, input, level, physics, onShoot, onGrenade) {
    if (this.isDead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn(level);
      }
      return;
    }

    // Cooldown timers
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.grenadeCooldown > 0) this.grenadeCooldown -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;

    // Aim calculations
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
        // Normal jump
        this.vy = this.jumpForce;
        this.onGround = false;
        this.canDoubleJump = true;
        window.soundManager.playJump();
      } else if (this.onWall !== 0) {
        // Wall jump
        this.vy = this.jumpForce * 0.9;
        this.vx = -this.onWall * this.speed * 1.1;
        this.onWall = 0;
        this.isFlipping = true;
        window.soundManager.playJump();
      } else if (this.canDoubleJump) {
        // Double jump somersault flip
        this.vy = this.jumpForce * 0.9;
        this.canDoubleJump = false;
        this.isFlipping = true;
        this.flipAngle = 0;
        window.soundManager.playJump();
      }
    }

    // Jetpack thrust (Hold Space or W while airborne)
    if (wantsJump && !this.onGround && this.jetpackFuel > 0) {
      this.jetpackActive = true;
      this.vy = Math.max(-6.5, this.vy - 0.85);
      this.jetpackFuel = Math.max(0, this.jetpackFuel - this.fuelBurnRate * dt);
      physics.spawnJetpackFlame(this.x, this.y, this.facing);
      window.soundManager.playJetpack();
    } else {
      this.jetpackActive = false;
      // Recharge fuel when grounded or not flying
      if (this.onGround) {
        this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + this.fuelRechargeRate * dt);
      } else {
        this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + (this.fuelRechargeRate * 0.35) * dt);
      }
    }

    // Gravity
    this.vy += this.gravity;
    // Wall slide damping
    if (this.onWall !== 0 && this.vy > 1.5) {
      this.vy = 1.5;
    }

    // Perform Collision Detection against Destructible Terrain
    this.moveWithCollision(level);

    // Somersault flip rotation update
    if (this.isFlipping) {
      this.flipAngle += this.facing * 18 * dt;
      if (Math.abs(this.flipAngle) >= Math.PI * 2) {
        this.isFlipping = false;
        this.flipAngle = 0;
      }
    }

    // Shooting handling
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

    if (w.ammo <= 0) return;
    if (w.ammo !== Infinity) w.ammo--;

    this.fireCooldown = w.fireRate;
    this.muzzleFlash = 0.08;

    const shoulderX = this.x;
    const shoulderY = this.y - 12;
    const gunLength = 26;
    const originX = shoulderX + Math.cos(this.aimAngle) * gunLength;
    const originY = shoulderY + Math.sin(this.aimAngle) * gunLength;

    // Recoil kickback
    this.vx -= Math.cos(this.aimAngle) * (w.name === 'Shotgun' ? 3.5 : 0.8);
    this.vy -= Math.sin(this.aimAngle) * (w.name === 'Shotgun' ? 2.5 : 0.4);

    // Muzzle smoke & sound
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
      // Raycast instant beam
      const maxDist = 1800;
      const endX = originX + Math.cos(this.aimAngle) * maxDist;
      const endY = originY + Math.sin(this.aimAngle) * maxDist;

      // Carve trench line
      physics.level.carveLine(originX, originY, endX, endY, 18);
      physics.spawnShockwave(originX, originY, 40, '#38bdf8');
      physics.addTrauma(0.5);

      // Spawn visual laser beam
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
        damage: 50,
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
    this.grenadeCooldown = 1.0;

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
    const hh = 20;

    // Horizontal Movement & Collision
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

    // Vertical Movement & Collision
    const newY = this.y + this.vy;
    let colV = false;

    if (this.vy > 0) {
      // Moving Down (Checking feet)
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
        // Align to ground
        while (level.isSolid(this.x, this.y + hh)) {
          this.y -= 1;
        }
      } else {
        this.onGround = false;
        this.y = newY;
      }
    } else if (this.vy < 0) {
      // Moving Up (Checking head)
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

    // Level bottom pit check (fall death)
    if (this.y > level.height + 60) {
      this.takeDamage(100, 'void', null);
    }
  }

  takeDamage(amount, weapon, attackerId) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
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

  // Render Stickman Character with Weapon and Jetpack
  render(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Somersault flip rotation
    if (this.isFlipping) {
      ctx.rotate(this.flipAngle);
    }

    // Name tag & Health bar above head
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 0, -32);

    // Mini Health Bar
    const barW = 34;
    const barH = 4;
    ctx.fillStyle = '#374151';
    ctx.fillRect(-barW / 2, -28, barW, barH);
    ctx.fillStyle = this.health > 40 ? '#22c55e' : '#ef4444';
    ctx.fillRect(-barW / 2, -28, (this.health / this.maxHealth) * barW, barH);

    // Jetpack Fuel Bar (below health)
    if (this.isLocal) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-barW / 2, -23, barW, 2.5);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-barW / 2, -23, (this.jetpackFuel / this.maxJetpackFuel) * barW, 2.5);
    }

    // Stickman Body Constants
    const headRadius = 8;
    const headY = -12;
    const neckY = -4;
    const pelvisY = 8;
    const legLength = 12;

    // Jetpack on back
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    const jpX = this.facing === 1 ? -9 : 3;
    ctx.fillRect(jpX, -3, 6, 12);
    ctx.strokeRect(jpX, -3, 6, 12);

    // Thruster nozzle
    ctx.fillStyle = '#f97316';
    ctx.fillRect(jpX + 1, 9, 4, 3);

    // DRAW STICKMAN SKELETON
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Torso Spine
    ctx.beginPath();
    ctx.moveTo(0, neckY);
    ctx.lineTo(0, pelvisY);
    ctx.stroke();

    // 2. Animated Legs
    const walkSin = Math.sin(this.walkCycle);
    let lLegFootX, lLegFootY, rLegFootX, rLegFootY;

    if (this.onGround) {
      lLegFootX = walkSin * 8;
      lLegFootY = pelvisY + legLength;
      rLegFootX = -walkSin * 8;
      rLegFootY = pelvisY + legLength;
    } else {
      // In air: legs dangling / bent
      lLegFootX = -4 * this.facing;
      lLegFootY = pelvisY + legLength - 2;
      rLegFootX = 6 * this.facing;
      rLegFootY = pelvisY + legLength;
    }

    // Left leg
    ctx.beginPath();
    ctx.moveTo(0, pelvisY);
    ctx.lineTo(lLegFootX, lLegFootY);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(0, pelvisY);
    ctx.lineTo(rLegFootX, rLegFootY);
    ctx.stroke();

    // 3. Head & Headband / Goggles
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Colored headband (identifies player color)
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, -0.4, 0.4);
    ctx.stroke();

    // 4. Arm and Weapon (Rotated towards aim)
    ctx.save();
    ctx.translate(0, neckY);
    ctx.rotate(this.aimAngle);

    // Arm line
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();

    // Weapon Sprite
    const w = this.getCurrentWeapon();
    this.renderWeaponSprite(ctx, w.name);

    // Muzzle flash
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(28, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  renderWeaponSprite(ctx, weaponName) {
    ctx.save();
    ctx.translate(12, 0);

    if (weaponName === 'Pistol') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -2, 10, 4);
      ctx.fillRect(2, 2, 3, 5);
    } else if (weaponName === 'SMG') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -3, 14, 6);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(4, 3, 3, 6); // mag
      ctx.fillRect(10, -1, 4, 2); // barrel
    } else if (weaponName === 'Shotgun') {
      ctx.fillStyle = '#78350f'; // wood stock
      ctx.fillRect(-2, -1, 6, 4);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, -3, 16, 5); // barrel
    } else if (weaponName === 'Rocket Launcher') {
      ctx.fillStyle = '#065f46';
      ctx.fillRect(-4, -5, 24, 9);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20, -3, 4, 5); // rocket tip
    } else if (weaponName === 'Railgun') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2, -4, 20, 7);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(4, -2, 12, 3); // glowing core
    } else if (weaponName === 'Flamethrower') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-2, -4, 18, 7);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 3, 6, 6); // canister
    } else if (weaponName === 'The Magic Wand') {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(0, -1, 18, 3);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(18, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -3, 16, 6);
    }

    ctx.restore();
  }
}

window.Player = Player;
