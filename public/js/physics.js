// Projectile, Debris Particle, and Explosion Physics Engine
class PhysicsEngine {
  constructor(level) {
    this.level = level;
    this.projectiles = [];
    this.particles = [];
    this.shockwaves = [];
    this.trauma = 0; // Screen shake trauma (0 to 1)
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  getShakeOffset() {
    if (this.trauma <= 0.001) return { x: 0, y: 0, rot: 0 };
    const shake = this.trauma * this.trauma;
    const maxOffset = 18;
    const maxRot = 0.03;
    const ox = (Math.random() * 2 - 1) * maxOffset * shake;
    const oy = (Math.random() * 2 - 1) * maxOffset * shake;
    const rot = (Math.random() * 2 - 1) * maxRot * shake;
    return { x: ox, y: oy, rot };
  }

  spawnDebris(debrisList) {
    if (!debrisList || !debrisList.length) return;
    for (const d of debrisList) {
      this.particles.push({
        type: 'debris',
        x: d.x,
        y: d.y,
        vx: d.vx,
        vy: d.vy,
        color: d.color || '#444444',
        size: d.size || 3,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.015
      });
    }
  }

  spawnShockwave(x, y, maxRadius = 50, color = 'rgba(249, 115, 22, 0.7)') {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      color,
      life: 1.0,
      decay: 0.04
    });
  }

  spawnMuzzleSmoke(x, y, angle) {
    for (let i = 0; i < 4; i++) {
      const spread = (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        type: 'smoke',
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        color: 'rgba(200, 200, 200, 0.6)',
        size: 3 + Math.random() * 4,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.03
      });
    }
  }

  spawnJetpackFlame(x, y, facing) {
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      this.particles.push({
        type: 'flame',
        x: x + (Math.random() - 0.5) * 6,
        y: y + 22,
        vx: (Math.random() - 0.5) * 1.5 - facing * 0.5,
        vy: 3 + Math.random() * 3,
        color: Math.random() > 0.4 ? '#f97316' : '#fde047',
        size: 3 + Math.random() * 3,
        life: 1.0,
        decay: 0.08
      });
    }
  }

  addProjectile(proj) {
    this.projectiles.push(proj);
  }

  // Update all projectiles, particles, and physics
  update(dt, targets = [], onTerrainDamage, onTargetHit) {
    // Decay trauma
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.25;
      sw.life -= sw.decay;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Particles (Debris & Smoke)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'debris') {
        p.vy += 0.35; // gravity
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off solid terrain
        if (this.level.isSolid(p.x, p.y)) {
          p.vy = -p.vy * 0.45;
          p.vx = p.vx * 0.7;
          p.y -= 2;
        }
      } else {
        // Smoke / flame
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.15;
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Grenade physics
      if (p.type === 'grenade') {
        p.timer -= dt;
        p.vy += 0.45; // gravity
        p.vx *= 0.985; // drag

        const nextX = p.x + p.vx;
        const nextY = p.y + p.vy;

        if (this.level.isSolid(nextX, p.y)) {
          p.vx = -p.vx * 0.6;
        } else {
          p.x = nextX;
        }

        if (this.level.isSolid(p.x, nextY)) {
          p.vy = -p.vy * 0.6;
          p.vx *= 0.8;
        } else {
          p.y = nextY;
        }

        // Check enemy direct hit or timer expiration
        let enemyHit = false;
        for (const t of targets) {
          if (t.id === p.ownerId || t.health <= 0) continue;
          if (Math.hypot(t.x - p.x, t.y - p.y) < 24) {
            enemyHit = true;
            break;
          }
        }

        if (p.timer <= 0 || enemyHit) {
          // Detonate!
          this.detonateExplosion(p.x, p.y, p.radius || 52, p.damage || 85, p.ownerId, 'grenade', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
          continue;
        }
        continue;
      }

      // Parachute Bomb (Too Much)
      if (p.type === 'too_much') {
        p.vy = Math.min(2.5, p.vy + 0.08); // slow fall with parachute
        p.x += p.vx;
        p.y += p.vy;

        // When close to ground or after timer, split into 8 cluster bombs
        p.timer -= dt;
        if (p.timer <= 0 || this.level.isSolid(p.x, p.y + 15)) {
          for (let k = 0; k < 8; k++) {
            const angle = (k / 8) * Math.PI * 2;
            const speed = 4 + Math.random() * 3;
            this.projectiles.push({
              type: 'grenade',
              x: p.x,
              y: p.y - 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 2,
              timer: 0.4 + Math.random() * 0.5,
              radius: 40,
              damage: 50,
              ownerId: p.ownerId
            });
          }
          this.detonateExplosion(p.x, p.y, 35, 40, p.ownerId, 'too_much', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
          continue;
        }
        continue;
      }

      // Magic Wand Pillar of Light
      if (p.type === 'magic_wand') {
        p.life -= dt;
        // Carve full vertical pillar
        const x = p.targetX;
        for (let py = 0; py < this.level.height; py += 30) {
          const debris = this.level.carveHole(x, py, 32, 'wand');
          this.spawnDebris(debris);
        }
        this.spawnShockwave(x, p.targetY, 120, 'rgba(168, 85, 247, 0.9)');
        this.addTrauma(0.6);
        window.soundManager.playExplosion();

        if (onTerrainDamage) {
          for (let py = 0; py < this.level.height; py += 30) {
            onTerrainDamage(x, py, 32, 'wand');
          }
        }

        // Damage all targets in column
        for (const t of targets) {
          if (t.health <= 0) continue;
          if (Math.abs(t.x - x) < 45) {
            if (onTargetHit) onTargetHit(t.id, 120, 'wand', p.ownerId);
          }
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Neutron Star (Pulsar Jets)
      if (p.type === 'neutron') {
        p.timer -= dt;
        p.rotation = (p.rotation || 0) + 0.18;

        // Emit twin pulsar laser jets
        for (const dir of [0, Math.PI]) {
          const beamAngle = p.rotation + dir;
          const bx2 = p.x + Math.cos(beamAngle) * 350;
          const by2 = p.y + Math.sin(beamAngle) * 350;
          this.level.carveLine(p.x, p.y, bx2, by2, 12);
          if (onTerrainDamage) onTerrainDamage(p.x, p.y, 16, 'neutron');

          // Damage targets along beam
          for (const t of targets) {
            if (t.health <= 0) continue;
            const dist = Math.hypot(t.x - p.x, t.y - p.y);
            if (dist < 350) {
              const angDiff = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) - beamAngle);
              if (angDiff < 0.12 && onTargetHit) {
                onTargetHit(t.id, 25 * dt * 60, 'neutron', p.ownerId);
              }
            }
          }
        }

        if (p.timer <= 0) {
          this.detonateExplosion(p.x, p.y, 60, 90, p.ownerId, 'neutron', onTerrainDamage, onTargetHit, targets);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Standard bullet / shotgun pellet / rocket / flame
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.type === 'rocket') {
        p.vy += 0.08;
        // Emit smoke & flame trail
        this.particles.push({
          type: 'smoke',
          x: p.x - p.vx * 0.5,
          y: p.y - p.vy * 0.5,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          color: 'rgba(220, 220, 220, 0.7)',
          size: 4 + Math.random() * 3,
          life: 0.6,
          decay: 0.03
        });
      }

      // Step movement with raycast checking for solid hit
      const speed = Math.hypot(p.vx, p.vy);
      const steps = Math.max(1, Math.ceil(speed / 4));
      const stepX = p.vx / steps;
      const stepY = p.vy / steps;

      let hit = false;

      for (let s = 0; s < steps; s++) {
        p.x += stepX;
        p.y += stepY;

        // Check Target Hit
        for (const t of targets) {
          if (t.id === p.ownerId || t.health <= 0) continue;
          const hitRadius = p.type === 'flame' ? 22 : 18;
          if (Math.hypot(t.x - p.x, t.y - (p.y - 10)) < hitRadius) {
            hit = true;
            if (p.type === 'rocket') {
              this.detonateExplosion(p.x, p.y, 48, p.damage, p.ownerId, 'rocket', onTerrainDamage, onTargetHit, targets);
            } else {
              if (onTargetHit) onTargetHit(t.id, p.damage, p.weapon, p.ownerId);
              const debris = this.level.carveHole(p.x, p.y, p.radius || 8, p.weapon);
              this.spawnDebris(debris);
              if (onTerrainDamage) onTerrainDamage(p.x, p.y, p.radius || 8, p.weapon);
            }
            break;
          }
        }

        if (hit) break;

        // Check Terrain Hit
        if (this.level.isSolid(p.x, p.y)) {
          hit = true;
          if (p.type === 'rocket') {
            this.detonateExplosion(p.x, p.y, 48, p.damage, p.ownerId, 'rocket', onTerrainDamage, onTargetHit, targets);
          } else {
            const r = p.radius || (p.type === 'flame' ? 14 : 9);
            const debris = this.level.carveHole(p.x, p.y, r, p.weapon);
            this.spawnDebris(debris);
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

  detonateExplosion(x, y, radius, damage, attackerId, weapon, onTerrainDamage, onTargetHit, targets = []) {
    // 1. Carve terrain crater
    const debris = this.level.carveHole(x, y, radius, weapon);
    this.spawnDebris(debris);

    // 2. Visual shockwave & camera trauma
    this.spawnShockwave(x, y, radius * 1.5, weapon === 'neutron' ? '#38bdf8' : '#f97316');
    this.addTrauma(Math.min(0.8, radius / 55));
    window.soundManager.playExplosion();

    // 3. Notify server of terrain damage
    if (onTerrainDamage) {
      onTerrainDamage(x, y, radius, weapon);
    }

    // 4. Damage all targets within blast radius
    for (const t of targets) {
      if (t.health <= 0) continue;
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist < radius * 1.2) {
        const falloff = 1 - (dist / (radius * 1.2));
        const dmg = Math.round(damage * Math.max(0.3, falloff));
        if (onTargetHit) {
          onTargetHit(t.id, dmg, weapon, attackerId);
        }
      }
    }
  }

  // Render all active projectiles, particles, and shockwaves
  render(ctx) {
    // Render Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * sw.life;
      ctx.globalAlpha = sw.life;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      if (p.type === 'grenade') {
        // Render bouncing grenade
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flashing pin / fuse
        ctx.fillStyle = (Math.sin(Date.now() * 0.02) > 0) ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'too_much') {
        // Parachute Bomb
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Parachute canopy
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
        // Pulsar Star
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.type === 'rocket') {
        // Rocket missile
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);

        ctx.fillStyle = '#64748b';
        ctx.fillRect(-10, -3, 14, 6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(4, -3);
        ctx.lineTo(10, 0);
        ctx.lineTo(4, 3);
        ctx.fill();
      } else if (p.type === 'flame') {
        ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#eab308';
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard bullet tracer
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.35, p.y - p.vy * 0.35);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

window.PhysicsEngine = PhysicsEngine;
