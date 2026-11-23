// Projectile, Debris Particle, and Advanced Visual Effects Physics Engine
class PhysicsEngine {
  constructor(level) {
    this.level = level;
    this.projectiles = [];
    this.particles = [];
    this.shockwaves = [];
    this.trauma = 0; // Screen shake trauma (0 to 1)
    this.screenFlash = 0; // Fullscreen white flash on nuclear detonation (0 to 1)

    // Street Fighter 6 3D Super Effects & Drive Impact
    this.depth3DParticles = [];
    this.driveImpactSplatters = [];
    this.superArtBanner = null;
    this.hitStopTimer = 0;
  }

  // Street Fighter 6 Dramatic Hit-Stop Freeze
  triggerHitStop(seconds = 0.08) {
    this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
  }

  // Street Fighter 6 Critical Art / Super Art Cut-In Banner
  triggerSuperArtCutIn(title, subtitle, color = '#ec4899') {
    this.superArtBanner = {
      title,
      subtitle,
      color,
      time: 0,
      duration: 1.45,
    };
    this.triggerHitStop(0.10); // 100ms hit-stop freeze!
    this.addTrauma(0.75);
    if (window.soundManager && typeof window.soundManager.playCriticalArtCutIn === 'function') {
      window.soundManager.playCriticalArtCutIn();
    }
  }

  // Street Fighter 6 Drive Impact Ink & Neon Paint Splatters
  spawnDriveImpact(x, y, theme = 'sf6') {
    const colors = ['#ec4899', '#06b6d4', '#facc15', '#18181b', '#ffffff'];
    const numRibbons = 10;
    for (let i = 0; i < numRibbons; i++) {
      const angle = (i / numRibbons) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 60 + Math.random() * 120;
      const cpDist = dist * 0.65;
      const cpAngle = angle + (Math.random() > 0.5 ? 0.75 : -0.75);
      this.driveImpactSplatters.push({
        type: 'ribbon',
        x,
        y,
        color: colors[i % colors.length],
        width: 10 + Math.random() * 16,
        cpX: x + Math.cos(cpAngle) * cpDist,
        cpY: y + Math.sin(cpAngle) * cpDist,
        endX: x + Math.cos(angle) * dist,
        endY: y + Math.sin(angle) * dist,
        progress: 0,
        life: 1.0,
        decay: 1.5 + Math.random() * 0.8
      });
    }

    // Splatter droplets & ink spots
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 260;
      this.driveImpactSplatters.push({
        type: 'droplet',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 1.8 + Math.random() * 0.8
      });
    }

    if (window.soundManager && typeof window.soundManager.playSuperDriveImpact === 'function') {
      window.soundManager.playSuperDriveImpact();
    }
  }

  // 3D Perspective Debris popping OUT OF THE SCREEN towards the camera
  spawn3DDepthDebris(x, y, count = 28, themeColor = null) {
    const defaultColors = ['#f97316', '#ef4444', '#facc15', '#ec4899', '#06b6d4', '#e2e8f0', '#3b82f6'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 280;
      this.depth3DParticles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        z: 320 + Math.random() * 120, // starts deep in the world
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        vz: -(220 + Math.random() * 380), // flies rapidly towards camera z=0
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        vRotX: (Math.random() - 0.5) * 8,
        vRotY: (Math.random() - 0.5) * 8,
        vRotZ: (Math.random() - 0.5) * 7,
        size: 7 + Math.random() * 12,
        color: themeColor || defaultColors[Math.floor(Math.random() * defaultColors.length)],
        life: 1.3,
        maxLife: 1.3
      });
    }
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  getShakeOffset() {
    if (this.trauma <= 0.001) return { x: 0, y: 0, rot: 0 };
    const shake = this.trauma * this.trauma;
    const maxOffset = 22;
    const maxRot = 0.04;
    const ox = (Math.random() * 2 - 1) * maxOffset * shake;
    const oy = (Math.random() * 2 - 1) * maxOffset * shake;
    const rot = (Math.random() * 2 - 1) * maxRot * shake;
    return { x: ox, y: oy, rot };
  }

  // Brass bullet casings ejected with physical spin and bounce (GTA 6 / Movie style)
  spawnShellCasing(x, y, facing) {
    this.particles.push({
      type: 'casing',
      x,
      y,
      vx: -facing * (2.8 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.5,
      vy: -(3.8 + Math.random() * 2.5),
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 28,
      color: '#eab308',
      life: 1.0,
      decay: 0.007
    });
  }

  // Debris chunks blasted out of carved terrain
  spawnDebris(debrisList) {
    if (!debrisList || !debrisList.length) return;
    for (const d of debrisList) {
      this.particles.push({
        type: 'debris',
        x: d.x,
        y: d.y,
        vx: d.vx * (1.2 + Math.random() * 0.8),
        vy: d.vy * (1.2 + Math.random() * 0.8),
        color: d.color || '#3f3f46',
        size: d.size || Math.floor(Math.random() * 3 + 2),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.015
      });
    }
  }

  // Glowing sparks that bounce off terrain
  spawnSparks(x, y, count = 12, color = '#fef08a', minSpd = 4, maxSpd = 12, baseAngle = null, spread = Math.PI * 2) {
    for (let i = 0; i < count; i++) {
      const angle = (baseAngle !== null) ? (baseAngle + (Math.random() - 0.5) * spread) : (Math.random() * Math.PI * 2);
      const spd = minSpd + Math.random() * (maxSpd - minSpd);
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 1.5 + Math.random() * 1.5,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.035
      });
    }
  }

  // Double glowing shockwave ring
  spawnShockwave(x, y, maxRadius = 50, color = 'rgba(249, 115, 22, 0.85)') {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      color,
      life: 1.0,
      decay: 0.035
    });
    // Inner high-energy ring
    this.shockwaves.push({
      x,
      y,
      radius: 2,
      maxRadius: maxRadius * 0.7,
      color: '#ffffff',
      life: 1.0,
      decay: 0.05
    });
  }

  // Fireball burst with smoke clouds
  spawnExplosionBurst(x, y, radius = 40, color = '#f97316') {
    // 1. Fiery core puffs
    const fireCount = Math.floor(radius / 4);
    for (let i = 0; i < fireCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.6;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        type: 'fire',
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        color: ['#ffffff', '#fde047', '#f97316', '#ef4444'][Math.floor(Math.random() * 4)],
        size: 6 + Math.random() * (radius * 0.35),
        maxSize: 12 + Math.random() * (radius * 0.5),
        life: 1.0,
        decay: 0.03 + Math.random() * 0.025
      });
    }

    // 2. Thick expanding smoke puffs
    const smokeCount = Math.floor(radius / 5);
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.particles.push({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * radius * 0.4,
        y: y + (Math.random() - 0.5) * radius * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: Math.random() > 0.5 ? 'rgba(75, 85, 99, 0.7)' : 'rgba(31, 41, 55, 0.8)',
        size: 8 + Math.random() * 8,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.015
      });
    }

    // 3. Shrapnel sparks
    this.spawnSparks(x, y, 22, '#fde047', 6, 18);
  }

  // Gun muzzle smoke & sparks
  spawnMuzzleSmoke(x, y, angle) {
    // Muzzle sparks
    this.spawnSparks(x, y, 6, '#fef08a', 4, 12, angle, 0.45);

    // Muzzle smoke puffs
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        type: 'smoke',
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        color: 'rgba(212, 212, 216, 0.6)',
        size: 3 + Math.random() * 4,
        life: 1.0,
        decay: 0.045 + Math.random() * 0.03
      });
    }
  }

  // Jetpack twin fire exhaust
  spawnJetpackFlame(x, y, facing) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        type: 'flame',
        x: x + (Math.random() - 0.5) * 6 - facing * 4,
        y: y + 20,
        vx: (Math.random() - 0.5) * 1.5 - facing * 0.8,
        vy: 4 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#f97316' : '#fde047',
        size: 3 + Math.random() * 4,
        life: 1.0,
        decay: 0.09
      });
    }
  }

  // Hit impact blood / spark splatter
  spawnHitSparks(x, y, color = '#ef4444') {
    this.spawnSparks(x, y, 10, color, 3, 9);
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        type: 'hit_spark',
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        color: '#dc2626',
        size: 2.5 + Math.random() * 2,
        life: 1.0,
        decay: 0.04
      });
    }
  }

  // 3D Victory Celebration Confetti & Spark Storm
  spawnVictoryConfetti(x, y, count = 120) {
    const colors = ['#f59e0b', '#ec4899', '#38bdf8', '#10b981', '#a855f7', '#ef4444', '#fbbf24', '#ffffff'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'confetti',
        x: x + (Math.random() - 0.5) * 360,
        y: y + (Math.random() - 0.5) * 180,
        vx: (Math.random() - 0.5) * 16,
        vy: -(Math.random() * 18 + 6),
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.003
      });
    }
  }

  addProjectile(proj) {
    this.projectiles.push(proj);
  }

  // Update all projectiles, particles, and physics
  update(dt, targets = [], onTerrainDamage, onTargetHit) {
    // 0. Street Fighter 6 Hit-Stop Freeze Frame
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      if (this.superArtBanner) {
        this.superArtBanner.time += dt;
      }
      return; // Freeze world motion during hit-stop for maximum punch!
    }

    if (this.superArtBanner) {
      this.superArtBanner.time += dt;
      if (this.superArtBanner.time >= this.superArtBanner.duration) {
        this.superArtBanner = null;
      }
    }

    // Decay trauma & screen flash
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 2.2);
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.28;
      sw.life -= sw.decay;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update SF6 3D Depth Particles (debris flying out towards player screen)
    for (let i = this.depth3DParticles.length - 1; i >= 0; i--) {
      const p = this.depth3DParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt; // vz is negative, flying toward camera z <= 10
      p.rotX += p.vRotX * dt;
      p.rotY += p.vRotY * dt;
      p.rotZ += p.vRotZ * dt;
      p.life -= dt;
      if (p.life <= 0 || p.z <= 8) {
        this.depth3DParticles.splice(i, 1);
      }
    }

    // Update SF6 Drive Impact Splatters
    for (let i = this.driveImpactSplatters.length - 1; i >= 0; i--) {
      const s = this.driveImpactSplatters[i];
      s.life -= dt * s.decay;
      s.progress += dt * 3.5;
      if (s.life <= 0) {
        this.driveImpactSplatters.splice(i, 1);
      }
    }

    // Enforce strict limits for buttery smooth 60 FPS with zero latency
    if (this.depth3DParticles.length > 50) {
      this.depth3DParticles.splice(0, this.depth3DParticles.length - 50);
    }
    if (this.driveImpactSplatters.length > 30) {
      this.driveImpactSplatters.splice(0, this.driveImpactSplatters.length - 30);
    }
    if (this.particles.length > 160) {
      this.particles.splice(0, this.particles.length - 160);
    }
    if (this.projectiles.length > 60) {
      this.projectiles.splice(0, this.projectiles.length - 60);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'debris') {
        p.vy += 0.42; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot * dt;

        // Bounce off solid terrain
        if (this.level.isSolid(p.x, p.y)) {
          p.vy = -p.vy * 0.45;
          p.vx = p.vx * 0.65;
          p.y -= 2;
        }
      } else if (p.type === 'spark') {
        p.vy += 0.32; // slight gravity
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off solid terrain
        if (this.level.isSolid(p.x, p.y)) {
          p.vy = -p.vy * 0.6;
          p.vx = p.vx * 0.7;
        }
      } else if (p.type === 'fire') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        if (p.size < p.maxSize) p.size += 0.4;
      } else if (p.type === 'casing') {
        p.vy += 0.45; // gravity
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot * dt;

        // Bounce off solid terrain
        if (this.level.isSolid(p.x, p.y)) {
          p.vy = -p.vy * 0.52;
          p.vx *= 0.75;
          p.vrot *= 0.6;
          p.y -= 1;
        }
      } else if (p.type === 'confetti') {
        p.vy += 0.25; // light float gravity
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot * dt;
      } else if (p.type === 'hit_spark') {
        p.vy += 0.38;
        p.x += p.vx;
        p.y += p.vy;
      } else {
        // Smoke / flame
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.18;
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Grenade physics with physical spin
      if (p.type === 'grenade') {
        p.timer -= dt;
        p.vy += 0.48; // gravity
        p.vx *= 0.985;
        p.rotation = (p.rotation || 0) + p.vx * 0.08;

        const nextX = p.x + p.vx;
        const nextY = p.y + p.vy;

        if (this.level.isSolid(nextX, p.y)) {
          p.vx = -p.vx * 0.65;
          this.spawnSparks(p.x, p.y, 3, '#fde047', 2, 5);
        } else {
          p.x = nextX;
        }

        if (this.level.isSolid(p.x, nextY)) {
          p.vy = -p.vy * 0.65;
          p.vx *= 0.82;
          this.spawnSparks(p.x, p.y, 3, '#fde047', 2, 5);
        } else {
          p.y = nextY;
        }

        // Direct hit on enemy operative
        let enemyHit = false;
        for (const t of targets) {
          if (t.id === p.ownerId || t.health <= 0) continue;
          if (Math.hypot(t.x - p.x, t.y - p.y) < 24) {
            enemyHit = true;
            break;
          }
        }

        if (p.timer <= 0 || enemyHit) {
          this.detonateExplosion(p.x, p.y, p.radius || 54, p.damage || 90, p.ownerId, 'grenade', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
          continue;
        }
        continue;
      }

      // Parachute Bomb (Too Much)
      if (p.type === 'too_much') {
        p.vy = Math.min(2.5, p.vy + 0.08);
        p.x += p.vx;
        p.y += p.vy;

        p.timer -= dt;
        if (p.timer <= 0 || this.level.isSolid(p.x, p.y + 15)) {
          // Split into 8 cluster grenades
          for (let k = 0; k < 8; k++) {
            const angle = (k / 8) * Math.PI * 2;
            const speed = 4 + Math.random() * 3.5;
            this.projectiles.push({
              type: 'grenade',
              x: p.x,
              y: p.y - 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 2.5,
              timer: 0.35 + Math.random() * 0.5,
              radius: 42,
              damage: 55,
              ownerId: p.ownerId
            });
          }
          this.detonateExplosion(p.x, p.y, 40, 45, p.ownerId, 'too_much', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
          continue;
        }
        continue;
      }

      // Magic Wand Pillar of Light
      if (p.type === 'magic_wand') {
        p.life -= dt;
        const x = p.targetX;
        for (let py = 0; py < this.level.height; py += 28) {
          const debris = this.level.carveHole(x, py, 32, 'wand');
          this.spawnDebris(debris);
        }
        this.spawnShockwave(x, p.targetY, 130, '#a855f7');
        this.spawnSparks(x, p.targetY, 30, '#e879f9', 6, 20);
        this.addTrauma(0.65);
        window.soundManager.playExplosion();

        if (onTerrainDamage) {
          for (let py = 0; py < this.level.height; py += 28) {
            onTerrainDamage(x, py, 32, 'wand');
          }
        }

        // Damage column
        for (const t of targets) {
          if (t.health <= 0) continue;
          if (Math.abs(t.x - x) < 48) {
            if (onTargetHit) onTargetHit(t.id, 125, 'wand', p.ownerId);
            this.spawnHitSparks(t.x, t.y, '#e879f9');
          }
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Neutron Star (Pulsar Jets)
      if (p.type === 'neutron') {
        p.timer -= dt;
        p.rotation = (p.rotation || 0) + 0.22;

        for (const dir of [0, Math.PI]) {
          const beamAngle = p.rotation + dir;
          const bx2 = p.x + Math.cos(beamAngle) * 360;
          const by2 = p.y + Math.sin(beamAngle) * 360;
          this.level.carveLine(p.x, p.y, bx2, by2, 14);

          // Plasma sparks along beam
          if (Math.random() < 0.4) {
            this.spawnSparks(p.x + Math.cos(beamAngle) * (Math.random() * 300), p.y + Math.sin(beamAngle) * (Math.random() * 300), 2, '#38bdf8', 2, 6);
          }

          for (const t of targets) {
            if (t.health <= 0) continue;
            const dist = Math.hypot(t.x - p.x, t.y - p.y);
            if (dist < 360) {
              const angDiff = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) - beamAngle);
              if (angDiff < 0.14 && onTargetHit) {
                onTargetHit(t.id, 28 * dt * 60, 'neutron', p.ownerId);
                this.spawnHitSparks(t.x, t.y, '#38bdf8');
              }
            }
          }
        }

        if (p.timer <= 0) {
          this.detonateExplosion(p.x, p.y, 65, 95, p.ownerId, 'neutron', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Standard bullets, rockets, flames
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Rocket missile exhaust trail
      if (p.type === 'rocket') {
        p.vy += 0.08;
        // Flame exhaust
        this.particles.push({
          type: 'flame',
          x: p.x - p.vx * 0.4,
          y: p.y - p.vy * 0.4,
          vx: (Math.random() - 0.5) * 1.0,
          vy: (Math.random() - 0.5) * 1.0,
          color: Math.random() > 0.3 ? '#f97316' : '#fef08a',
          size: 4 + Math.random() * 3,
          life: 0.3,
          decay: 0.08
        });
        // Smoke trail
        this.particles.push({
          type: 'smoke',
          x: p.x - p.vx * 0.8,
          y: p.y - p.vy * 0.8,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          color: 'rgba(212, 212, 216, 0.7)',
          size: 5 + Math.random() * 4,
          life: 0.7,
          decay: 0.03
        });
      }

      // ☢️ Tsar Bomba / Nuke heavy missile exhaust trail
      if (p.type === 'nuke') {
        p.vy += 0.04;
        // Heavy flame exhaust
        this.particles.push({
          type: 'flame',
          x: p.x - p.vx * 0.4,
          y: p.y - p.vy * 0.4,
          vx: (Math.random() - 0.5) * 1.6,
          vy: (Math.random() - 0.5) * 1.6,
          color: Math.random() > 0.4 ? '#ef4444' : '#fde047',
          size: 8 + Math.random() * 6,
          life: 0.45,
          decay: 0.05
        });
        // Dense dark smoke trail
        this.particles.push({
          type: 'smoke',
          x: p.x - p.vx * 0.85,
          y: p.y - p.vy * 0.85,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          color: 'rgba(51, 65, 85, 0.85)',
          size: 10 + Math.random() * 8,
          life: 1.2,
          decay: 0.02
        });
      }

      // Step raycast movement
      const speed = Math.hypot(p.vx, p.vy);
      const steps = Math.max(1, Math.ceil(speed / 4));
      const stepX = p.vx / steps;
      const stepY = p.vy / steps;

      let hit = false;

      for (let s = 0; s < steps; s++) {
        p.x += stepX;
        p.y += stepY;

        // Target hit check
        for (const t of targets) {
          if (t.id === p.ownerId || t.health <= 0) continue;
          const hitRadius = p.type === 'flame' ? 24 : 18;
          if (Math.hypot(t.x - p.x, t.y - (t.y - 12)) < hitRadius || Math.hypot(t.x - p.x, t.y - p.y) < hitRadius) {
            hit = true;
            this.spawnHitSparks(p.x, p.y);
            if (p.type === 'rocket') {
              this.detonateExplosion(p.x, p.y, 50, p.damage, p.ownerId, 'rocket', onTerrainDamage, onTargetHit, targets);
            } else if (p.type === 'nuke') {
              this.detonateNuke(p.x, p.y, p.radius || 175, p.damage, p.ownerId, onTerrainDamage, onTargetHit, targets);
            } else {
              if (onTargetHit) onTargetHit(t.id, p.damage, p.weapon, p.ownerId);
              const debris = this.level.carveHole(p.x, p.y, p.radius || 9, p.weapon);
              this.spawnDebris(debris);
              this.spawnSparks(p.x, p.y, 6, '#fde047', 3, 8);
              if (onTerrainDamage) onTerrainDamage(p.x, p.y, p.radius || 9, p.weapon);
            }
            break;
          }
        }

        if (hit) break;

        // Terrain hit check
        if (this.level.isSolid(p.x, p.y)) {
          hit = true;
          if (p.type === 'rocket') {
            this.detonateExplosion(p.x, p.y, 50, p.damage, p.ownerId, 'rocket', onTerrainDamage, onTargetHit, targets);
          } else if (p.type === 'nuke') {
            this.detonateNuke(p.x, p.y, p.radius || 175, p.damage, p.ownerId, onTerrainDamage, onTargetHit, targets);
          } else {
            const r = p.radius || (p.type === 'flame' ? 14 : 9);
            const debris = this.level.carveHole(p.x, p.y, r, p.weapon);
            this.spawnDebris(debris);
            this.spawnSparks(p.x, p.y, 8, '#fde047', 4, 10);
            if (onTerrainDamage) onTerrainDamage(p.x, p.y, r, p.weapon);
          }
          break;
        }
      }

      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ☢️ Hongo Atómico Pixelado y Detonación Nuclear Épica
  spawnMushroomCloud(x, y, radius = 175) {
    // 1. Columna de fuego y humo ascendente optimizada (Tallo del hongo)
    const stemParticles = 24;
    for (let i = 0; i < stemParticles; i++) {
      const angle = (Math.random() - 0.5) * 0.7 - Math.PI / 2;
      const speed = 2 + Math.random() * 8;
      const pColor = ['#ffffff', '#fde047', '#f97316', '#ef4444', '#71717a'][Math.floor(Math.random() * 5)];
      this.particles.push({
        type: 'fire',
        x: x + (Math.random() - 0.5) * (radius * 0.35),
        y: y - Math.random() * (radius * 0.3),
        vx: Math.cos(angle) * speed * 0.6,
        vy: -2 - Math.random() * 9,
        color: pColor,
        size: 20 + Math.random() * 30,
        maxSize: 45 + Math.random() * 35,
        life: 1.6,
        decay: 0.018
      });
    }

    // 2. Sombrero del Hongo que se expande hacia los lados
    const capParticles = 36;
    for (let i = 0; i < capParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      const dist = Math.random() * (radius * 0.55);
      const pColor = ['#fde047', '#f97316', '#ef4444', '#475569', '#1e293b'][Math.floor(Math.random() * 5)];
      this.particles.push({
        type: 'smoke',
        x: x + Math.cos(angle) * dist,
        y: y - (radius * 0.8) + Math.sin(angle) * (dist * 0.45),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * (speed * 0.4) - 1.5,
        color: pColor,
        size: 26 + Math.random() * 34,
        life: 2.0,
        decay: 0.015
      });
    }

    // 3. Chispas de alta velocidad y fragmentos brillantes
    this.spawnSparks(x, y, 16, '#fde047', 8, 22);
    this.spawnSparks(x, y, 12, '#ffffff', 10, 24);
  }

  detonateNuke(x, y, radius, damage, attackerId, onTerrainDamage, onTargetHit, targets = []) {
    // Street Fighter 6 Critical Art Cut-in, Drive Impact Neon Splatters & 3D Depth Debris (Only for human players)
    if (!attackerId || !attackerId.startsWith('bot_')) {
      this.triggerSuperArtCutIn('CRITICAL ART', '☢️ TSAR BOMBA: ANIQUILACIÓN TOTAL', '#ef4444');
      this.screenFlash = 1.0;
    }
    this.spawnDriveImpact(x, y, 'sf6');
    this.spawn3DDepthDebris(x, y, 48, '#ef4444');

    // 1. Sacudida de cámara y sonido
    this.addTrauma(0.8);
    window.soundManager.playNukeExplosion();

    // 2. Cráter gigante en el terreno de la web
    const debris = this.level.carveHole(x, y, radius, 'nuke');
    this.spawnDebris(debris);

    // 3. Generación del Hongo Atómico y Ondas Expansivas Múltiples
    this.spawnMushroomCloud(x, y, radius);
    this.spawnShockwave(x, y, radius * 2.2, '#fde047');
    this.spawnShockwave(x, y, radius * 1.5, '#ef4444');
    this.spawnShockwave(x, y, radius * 0.9, '#ffffff');

    // 4. Notificar daño masivo al servidor
    if (onTerrainDamage) {
      onTerrainDamage(x, y, radius, 'nuke');
    }

    // 5. Daño devastador a todos los objetivos en el área
    for (const t of targets) {
      if (t.health <= 0) continue;
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist < radius * 1.8) {
        const falloff = 1 - (dist / (radius * 1.8));
        const dmg = Math.round(damage * Math.max(0.4, falloff));
        if (onTargetHit) {
          onTargetHit(t.id, dmg, 'nuke', attackerId);
        }
        this.spawnHitSparks(t.x, t.y);
      }
    }
  }

  detonateExplosion(x, y, radius, damage, attackerId, weapon, onTerrainDamage, onTargetHit, targets = []) {
    // Street Fighter 6 Drive Impact & 3D Depth Debris
    if (weapon === 'neutron') {
      if (!attackerId || !attackerId.startsWith('bot_')) {
        this.triggerSuperArtCutIn('SUPER ART', '🌌 SINGULARIDAD DE NEUTRONES', '#38bdf8');
      }
      this.spawnDriveImpact(x, y, 'sf6');
      this.spawn3DDepthDebris(x, y, 36, '#38bdf8');
    } else if (radius >= 40) {
      this.spawnDriveImpact(x, y, 'sf6');
      this.spawn3DDepthDebris(x, y, 22, '#f97316');
    }

    // 1. Carve terrain crater
    const debris = this.level.carveHole(x, y, radius, weapon);
    this.spawnDebris(debris);

    // 2. Layered Visual Fireball & Shockwaves
    this.spawnExplosionBurst(x, y, radius, weapon === 'neutron' ? '#38bdf8' : '#f97316');
    this.spawnShockwave(x, y, radius * 1.6, weapon === 'neutron' ? '#38bdf8' : '#f97316');
    this.addTrauma(Math.min(0.85, radius / 45));
    window.soundManager.playExplosion();

    // 3. Notify server of terrain damage
    if (onTerrainDamage) {
      onTerrainDamage(x, y, radius, weapon);
    }

    // 4. Damage all targets within blast radius
    for (const t of targets) {
      if (t.health <= 0) continue;
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist < radius * 1.25) {
        const falloff = 1 - (dist / (radius * 1.25));
        const dmg = Math.round(damage * Math.max(0.3, falloff));
        if (onTargetHit) {
          onTargetHit(t.id, dmg, weapon, attackerId);
        }
        this.spawnHitSparks(t.x, t.y);
      }
    }
  }

  // Render all active projectiles, particles, and shockwaves
  render(ctx) {
    // 1. Render Shockwaves with neon glow
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3.5 * sw.life;
      ctx.globalAlpha = sw.life;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 1.5 Render Street Fighter 6 Drive Impact Ink & Neon Splatters
    for (const s of this.driveImpactSplatters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life));
      if (s.type === 'ribbon') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * s.life;
        ctx.lineCap = 'round';
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.cpX, s.cpY, s.endX, s.endY);
        ctx.stroke();
      } else if (s.type === 'droplet') {
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Render Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));

      if (p.type === 'debris') {
        // Rotating square voxel chunks
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 'casing') {
        // Brass bullet cartridge spinning
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-2.5, -1.2, 5, 2.4);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-2.5, -1.2, 1.2, 2.4);
      } else if (p.type === 'confetti') {
        // Shimmering confetti piece
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.type === 'spark' || p.type === 'hit_spark') {
        // Glowing incandescent streak in velocity direction (high performance)
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.4, p.y - p.vy * 1.4);
        ctx.stroke();
      } else if (p.type === 'fire') {
        // Multi-layered hot fireball
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'laser') {
        // Railgun intense beam
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * p.life;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();

        // Inner pure white beam
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * p.life;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else {
        // Smoke or flame puff
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Render Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      if (p.type === 'grenade') {
        // Rotating Grenade with flashing LED
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);

        const sp = window.SPRITES && window.SPRITES.weapons && window.SPRITES.weapons['Grenade'];
        if (window.spriteSheetImg && window.spriteSheetImg.complete && sp) {
          ctx.drawImage(window.spriteSheetImg, sp.x, sp.y, sp.w, sp.h, -9, -9, 18, 18);
        } else {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Flashing fuse LED
        const blink = Math.sin(Date.now() * 0.02) > 0;
        ctx.fillStyle = blink ? '#ef4444' : '#ffffff';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = blink ? 8 : 2;
        ctx.beginPath();
        ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'too_much') {
        // Parachute Bomb
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 18, 16, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 16, p.y - 18);
        ctx.lineTo(p.x, p.y);
        ctx.moveTo(p.x + 16, p.y - 18);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.type === 'neutron') {
        // Pulsar Star with Accretion Glow
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.type === 'rocket') {
        // Rocket missile oriented in flight direction
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);

        const sp = window.SPRITES && window.SPRITES.weapons && window.SPRITES.weapons['Rocket Launcher'];
        if (window.spriteSheetImg && window.spriteSheetImg.complete && sp) {
          ctx.drawImage(window.spriteSheetImg, sp.x, sp.y, sp.w, sp.h, -16, -6, 32, 12);
        } else {
          ctx.fillStyle = '#475569';
          ctx.fillRect(-12, -4, 18, 8);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(6, -4);
          ctx.lineTo(14, 0);
          ctx.lineTo(6, 4);
          ctx.fill();
        }

        // Blazing Thruster Jet
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-16, -3);
        ctx.lineTo(-24 - Math.random() * 8, 0);
        ctx.lineTo(-16, 3);
        ctx.fill();
      } else if (p.type === 'nuke') {
        // ☢️ Heavy Atomic Warhead oriented in flight direction
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);

        // Dark missile body with yellow caution hazard stripes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-20, -7, 34, 14);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-4, -7, 8, 14);

        // Pointed atomic warhead tip (Red & White)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(14, -7);
        ctx.lineTo(26, 0);
        ctx.lineTo(14, 7);
        ctx.fill();

        // Heavy fins
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-22, -11, 5, 22);

        // Massive Rocket Plume & Core Glow
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(-22, -5);
        ctx.lineTo(-38 - Math.random() * 12, 0);
        ctx.lineTo(-22, 5);
        ctx.fill();
      } else if (p.type === 'flame') {
        // Expanding flame tongue
        const flameColor = Math.random() > 0.4 ? '#f97316' : '#fde047';
        ctx.fillStyle = flameColor;
        ctx.shadowColor = flameColor;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Glowing Bullet Tracer
        ctx.strokeStyle = '#fef08a';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.45, p.y - p.vy * 0.45);
        ctx.stroke();

        // Bullet core head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

window.PhysicsEngine = PhysicsEngine;
