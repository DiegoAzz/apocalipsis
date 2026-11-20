// Stickman Player Physics and Combat State
use crate::level::VoxelTerrain;
use crate::protocol::PlayerData;

#[derive(Debug, Clone)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub color: String,
    pub is_bot: bool,

    // Position & Velocity
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,

    pub facing: i8,
    pub aim_angle: f32,
    pub on_ground: bool,
    pub on_wall: i8, // -1, 0, 1

    // Jetpack & Acrobatics
    pub jetpack_active: bool,
    pub jetpack_fuel: f32,
    pub max_fuel: f32,
    pub is_flipping: bool,
    pub flip_angle: f32,

    // Weapon & Health
    pub weapon_index: usize,
    pub health: f32,
    pub max_health: f32,
    pub is_dead: bool,
    pub respawn_timer: f32,

    // Scoring
    pub kills: u32,
    pub deaths: u32,
    pub damage_dealt: f32,
    pub score: u32,
}

impl Player {
    pub fn new(id: String, name: String, color: String, is_bot: bool) -> Self {
        Self {
            id,
            name,
            color,
            is_bot,
            x: 400.0,
            y: 150.0,
            vx: 0.0,
            vy: 0.0,
            facing: 1,
            aim_angle: 0.0,
            on_ground: false,
            on_wall: 0,
            jetpack_active: false,
            jetpack_fuel: 100.0,
            max_fuel: 100.0,
            is_flipping: false,
            flip_angle: 0.0,
            weapon_index: 0,
            health: 100.0,
            max_health: 100.0,
            is_dead: false,
            respawn_timer: 0.0,
            kills: 0,
            deaths: 0,
            damage_dealt: 0.0,
            score: 0,
        }
    }

    pub fn update_physics(&mut self, dt: f32, terrain: &VoxelTerrain) {
        if self.is_dead {
            self.respawn_timer -= dt;
            if self.respawn_timer <= 0.0 {
                self.respawn(terrain);
            }
            return;
        }

        // Gravity
        self.vy += 0.48;

        // Jetpack thrust & fuel
        if self.jetpack_active && self.jetpack_fuel > 0.0 {
            self.vy = (self.vy - 0.85).max(-6.5);
            self.jetpack_fuel = (self.jetpack_fuel - 32.0 * dt).max(0.0);
        } else if self.on_ground {
            self.jetpack_fuel = (self.jetpack_fuel + 45.0 * dt).min(self.max_fuel);
        }

        // Collision bounds check
        let hw = 10.0;
        let hh = 20.0;

        let next_x = self.x + self.vx;
        let side = if self.vx > 0.0 { hw } else { -hw };

        if terrain.is_solid(next_x + side, self.y) {
            self.on_wall = if self.vx > 0.0 { 1 } else { -1 };
            self.vx = 0.0;
        } else {
            self.x = next_x.clamp(hw, terrain.width as f32 - hw);
            self.on_wall = 0;
        }

        let next_y = self.y + self.vy;
        if self.vy > 0.0 {
            if terrain.is_solid(self.x, next_y + hh) {
                self.on_ground = true;
                self.vy = 0.0;
            } else {
                self.on_ground = false;
                self.y = next_y;
            }
        } else if self.vy < 0.0 {
            if terrain.is_solid(self.x, next_y - hh) {
                self.vy = 0.0;
            } else {
                self.y = next_y;
            }
            self.on_ground = false;
        }
    }

    pub fn respawn(&mut self, terrain: &VoxelTerrain) {
        self.is_dead = false;
        self.health = self.max_health;
        self.x = 350.0 + (rand::random::<f32>() * (terrain.width as f32 - 700.0)).max(0.0);
        self.y = 140.0;
        self.vx = 0.0;
        self.vy = 0.0;
        self.jetpack_fuel = self.max_fuel;
    }

    pub fn to_data(&self) -> PlayerData {
        PlayerData {
            id: self.id.clone(),
            name: self.name.clone(),
            color: self.color.clone(),
            is_bot: self.is_bot,
            x: self.x,
            y: self.y,
            vx: self.vx,
            vy: self.vy,
            aim_angle: self.aim_angle,
            facing: self.facing,
            jetpack: self.jetpack_active,
            weapon_index: self.weapon_index,
            health: self.health,
            max_health: self.max_health,
            kills: self.kills,
            deaths: self.deaths,
            damage_dealt: self.damage_dealt,
            score: self.score,
        }
    }
}
