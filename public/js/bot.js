// Intelligent Demolition AI Bot Stickman Controller
// Equipped with full arsenal and automated site obliteration directives
class BotController {
  constructor(botData, level, physics) {
    this.player = new Player(botData.id, botData.name, botData.color, false);
    this.player.isBot = true;
    this.player.x = botData.x || 300 + Math.random() * 800;
    this.player.y = botData.y || 200;

    // Grant demolition bot access to full arsenal
    this.player.unlockAllWeaponsVip();

    // Pool of visible, fluid and kinetic demolition weapons:
    // 1: SMG, 2: Shotgun, 3: Rocket Launcher, 4: Railgun, 5: Flamethrower
    // We intentionally exclude screen-blinding weapons (Nuke, Black Hole, Giant Banners)
    // so recordings clearly show stickmen running and carving satisfying holes in the website!
    this.demolitionWeapons = [1, 2, 3, 4, 5];
    this.currentDemoWeaponIdx = Math.floor(Math.random() * this.demolitionWeapons.length);
    this.player.selectWeapon(this.demolitionWeapons[this.currentDemoWeaponIdx]);

    this.level = level;
    this.physics = physics;

    this.stateTimer = 0;
    this.aiState = 'demolish'; // 'demolish', 'hunt', 'reposition'
    this.target = null;
    this.terrainTarget = null;
    this.terrainScanTimer = 0;
    this.jumpCooldown = 0;
    this.weaponSwapTimer = 3.0 + Math.random() * 4.0;
    this.wanderDir = Math.random() > 0.5 ? 1 : -1;
    this.burstTimer = 0;
    this.isFiringBurst = true;
  }

  // Scan level terrain to find un-destroyed website blocks to obliterate
  findDenseTerrainTarget() {
    if (!this.level) return null;
    const lvl = this.level;
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);

    // Search in an expanding arc around the bot
    const sampleRadii = [60, 120, 200, 320, 480];
    const angles = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.2, 2.6, 3.14];

    let bestTarget = null;
    let maxDensity = 0;

    for (const r of sampleRadii) {
      for (const a of angles) {
        // Bias aiming forward and downward/upward toward website content
        const testAngle = this.wanderDir > 0 ? a : (Math.PI - a);
        const tx = Math.floor(px + Math.cos(testAngle) * r);
        const ty = Math.floor(py + Math.sin(testAngle) * r);

        if (tx >= 20 && tx < lvl.width - 20 && ty >= 30 && ty < lvl.height - 30) {
          if (lvl.isSolid(tx, ty)) {
            // Count surrounding solid density in 5x5 sample
            let solidCount = 0;
            for (let ox = -15; ox <= 15; ox += 10) {
              for (let oy = -15; oy <= 15; oy += 10) {
                if (lvl.isSolid(tx + ox, ty + oy)) solidCount++;
              }
            }
            if (solidCount > maxDensity) {
              maxDensity = solidCount;
              bestTarget = { x: tx, y: ty, density: solidCount };
            }
          }
        }
      }
      if (bestTarget && maxDensity >= 4) break;
    }

    // If nothing found nearby, pick a general solid sector in the level
    if (!bestTarget) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const rx = Math.floor(80 + Math.random() * (lvl.width - 160));
        const ry = Math.floor(60 + Math.random() * (lvl.height - 120));
        if (lvl.isSolid(rx, ry)) {
          bestTarget = { x: rx, y: ry, density: 1 };
          break;
        }
      }
    }

    return bestTarget;
  }

  update(dt, allPlayers, onShoot, onGrenade) {
    if (this.player.isDead) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0) {
        this.player.respawn(this.level);
      }
      return;
    }

    this.jumpCooldown -= dt;
    this.weaponSwapTimer -= dt;
    this.terrainScanTimer -= dt;
    this.burstTimer -= dt;

    // 1. Dynamic Weapon Variation across Demolition Arsenal
    if (this.weaponSwapTimer <= 0) {
      this.currentDemoWeaponIdx = (this.currentDemoWeaponIdx + 1) % this.demolitionWeapons.length;
      const nextWeapon = this.demolitionWeapons[this.currentDemoWeaponIdx];
      this.player.selectWeapon(nextWeapon);
      // Give varied swap intervals: 2.5s for fast guns, 4s for heavy rockets/nukes
      this.weaponSwapTimer = 2.5 + Math.random() * 3.5;
    }

    // 2. Scan for Website Terrain to Destroy
    if (this.terrainScanTimer <= 0 || !this.terrainTarget) {
      this.terrainTarget = this.findDenseTerrainTarget();
      this.terrainScanTimer = 0.8 + Math.random() * 0.8;
    }

    // 3. Check for nearby opponent player (PvP duel option)
    let closestPlayer = null;
    let minDist = 500;
    for (const p of allPlayers) {
      if (p.id === this.player.id || p.isDead || p.health <= 0) continue;
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < minDist) {
        minDist = d;
        closestPlayer = p;
      }
    }

    // 4. Synthesize AI Input
    const fakeInput = {
      keys: {},
      justPressedJump: false,
      mouseX: this.player.x + this.player.facing * 120,
      mouseY: this.player.y,
      isMouseDown: false,
      isRightMouseDown: false
    };

    // Prioritize demolishing website terrain, dueling if player gets close
    const activeTarget = closestPlayer && Math.random() < 0.35 ? closestPlayer : this.terrainTarget;

    if (activeTarget) {
      const dx = activeTarget.x - this.player.x;
      const dy = activeTarget.y - this.player.y;
      const dist = Math.hypot(dx, dy);

      // Aim directly at target with slight organic jitter
      fakeInput.mouseX = activeTarget.x + (Math.random() - 0.5) * 16;
      fakeInput.mouseY = activeTarget.y + (Math.random() - 0.5) * 16;

      // Move toward target horizontally if too far
      if (Math.abs(dx) > 140) {
        if (dx > 0) {
          fakeInput.keys['KeyD'] = true;
          this.wanderDir = 1;
        } else {
          fakeInput.keys['KeyA'] = true;
          this.wanderDir = -1;
        }
      } else {
        // Patrol around the target to blast from different angles
        if (this.wanderDir > 0) fakeInput.keys['KeyD'] = true;
        else fakeInput.keys['KeyA'] = true;
      }

      // Vertical Maneuvers & Aerial Jetpack Demolition
      const lvlHeight = (this.level && this.level.height) || 900;
      const isNearBottom = this.player.y > lvlHeight - 160;

      // Jetpack up if target is higher, if facing a wall, or near bottom void
      if (dy < -30 || this.player.onWall !== 0 || isNearBottom) {
        if (this.jumpCooldown <= 0) {
          fakeInput.justPressedJump = true;
          this.jumpCooldown = 0.5;
        }
        fakeInput.keys['Space'] = true; // Engage jetpack hover
      }

      // Trigger firing barrage at terrain
      if (dist < 750) {
        // Continuous rapid demolition firing
        fakeInput.isMouseDown = true;

        // Occasional Grenades (every few seconds)
        if (Math.random() < 0.04 && dist > 100) {
          fakeInput.isRightMouseDown = true;
        }
      }
    } else {
      // Free Patrol & Demolition Sweep across the entire website
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.wanderDir = Math.random() > 0.5 ? 1 : -1;
        this.stateTimer = 2.5 + Math.random() * 3.5;
      }

      if (this.wanderDir > 0) fakeInput.keys['KeyD'] = true;
      else fakeInput.keys['KeyA'] = true;

      // Aim weapon forward and downward to sweep terrain
      fakeInput.mouseX = this.player.x + this.wanderDir * 200;
      fakeInput.mouseY = this.player.y + 40;
      fakeInput.isMouseDown = true;

      // Jetpack obstacle avoidance & pit recovery
      if ((this.player.onWall !== 0 || this.player.y > 700) && this.jumpCooldown <= 0) {
        fakeInput.justPressedJump = true;
        fakeInput.keys['Space'] = true;
        this.jumpCooldown = 0.6;
      }
    }

    // 5. Update Player Physics & Deliver Firing Callbacks
    this.player.update(dt, fakeInput, this.level, this.physics, onShoot, onGrenade);
  }

  render(ctx) {
    this.player.render(ctx);
  }
}

window.BotController = BotController;
