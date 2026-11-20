// Intelligent AI Bot Stickman Controller
class BotController {
  constructor(botData, level, physics) {
    this.player = new Player(botData.id, botData.name, botData.color, false);
    this.player.isBot = true;
    this.player.x = botData.x || 300 + Math.random() * 800;
    this.player.y = botData.y || 200;
    this.player.selectWeapon(Math.floor(Math.random() * 6));

    this.level = level;
    this.physics = physics;

    this.stateTimer = 0;
    this.aiState = 'wander'; // 'wander', 'hunt', 'flee'
    this.target = null;
    this.jumpCooldown = 0;
    this.weaponSwapTimer = 5 + Math.random() * 8;
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

    if (this.weaponSwapTimer <= 0) {
      this.player.selectWeapon(Math.floor(Math.random() * 6));
      this.weaponSwapTimer = 8 + Math.random() * 10;
    }

    // 1. Find Closest Target
    let closest = null;
    let minDist = 700;

    for (const p of allPlayers) {
      if (p.id === this.player.id || p.isDead || p.health <= 0) continue;
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    this.target = closest;

    // 2. Synthesize Input
    const fakeInput = {
      keys: {},
      justPressedJump: false,
      mouseX: this.player.x + this.player.facing * 100,
      mouseY: this.player.y,
      isMouseDown: false,
      isRightMouseDown: false
    };

    if (this.target) {
      const dx = this.target.x - this.player.x;
      const dy = this.target.y - this.player.y;
      fakeInput.mouseX = this.target.x + (Math.random() - 0.5) * 20;
      fakeInput.mouseY = this.target.y + (Math.random() - 0.5) * 20;

      // Move towards target horizontally
      if (Math.abs(dx) > 120) {
        if (dx > 0) fakeInput.keys['KeyD'] = true;
        else fakeInput.keys['KeyA'] = true;
      }

      // If target is above or there is a gap / obstacle, jump & jetpack!
      if (dy < -40 || this.player.onWall !== 0) {
        if (this.jumpCooldown <= 0) {
          fakeInput.justPressedJump = true;
          this.jumpCooldown = 0.8;
        }
        fakeInput.keys['Space'] = true;
      }

      // Check shoot opportunity
      const dist = Math.hypot(dx, dy);
      if (dist < 550) {
        fakeInput.isMouseDown = true;
        // Occasionally throw grenade if target is at mid-range
        if (dist > 150 && dist < 350 && Math.random() < 0.03) {
          fakeInput.isRightMouseDown = true;
        }
      }
    } else {
      // Wander around website
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.wanderDir = Math.random() > 0.5 ? 1 : -1;
        this.stateTimer = 2 + Math.random() * 3;
      }

      if (this.wanderDir > 0) fakeInput.keys['KeyD'] = true;
      else fakeInput.keys['KeyA'] = true;

      // Obstacle jump
      if (this.player.onWall !== 0 && this.jumpCooldown <= 0) {
        fakeInput.justPressedJump = true;
        fakeInput.keys['Space'] = true;
        this.jumpCooldown = 0.9;
      }
    }

    // 3. Update Player Physics
    this.player.update(dt, fakeInput, this.level, this.physics, onShoot, onGrenade);
  }

  render(ctx) {
    this.player.render(ctx);
  }
}

window.BotController = BotController;
