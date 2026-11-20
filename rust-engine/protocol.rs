use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    JoinRoom {
        room: String,
        name: String,
        skin_color: String,
    },
    PlayerUpdate {
        x: f32,
        y: f32,
        vx: f32,
        vy: f32,
        aim_angle: f32,
        facing: i8,
        jetpack: bool,
        weapon_index: usize,
        health: f32,
        is_flipping: bool,
        flip_angle: f32,
    },
    PlayerShoot {
        weapon: String,
        weapon_index: usize,
        origin_x: f32,
        origin_y: f32,
        aim_angle: f32,
        aim_x: f32,
        aim_y: f32,
    },
    PlayerGrenade {
        x: f32,
        y: f32,
        vx: f32,
        vy: f32,
    },
    TerrainDamage {
        x: f32,
        y: f32,
        radius: f32,
        weapon: String,
    },
    PlayerHit {
        target_id: String,
        damage: f32,
        weapon: String,
        attacker_id: String,
    },
    ChatMessage {
        text: String,
    },
    ChangeMap {
        preset: String,
        url: String,
    },
    SpawnBot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    InitState {
        self_id: String,
        preset: String,
        url: String,
        seed: u64,
        craters: Vec<CraterRecord>,
        players: Vec<PlayerData>,
        chat_history: Vec<ChatEntry>,
    },
    PlayerJoined(PlayerData),
    PlayerLeft { id: String },
    PlayerMoved(PlayerData),
    PlayerShot(RemoteShootData),
    PlayerThrewGrenade(RemoteGrenadeData),
    TerrainDamaged {
        x: f32,
        y: f32,
        radius: f32,
        weapon: String,
    },
    PlayerHealthUpdate {
        target_id: String,
        health: f32,
        damage: f32,
        attacker_id: Option<String>,
    },
    PlayerKilled {
        target_id: String,
        target_name: String,
        attacker_id: Option<String>,
        attacker_name: String,
        weapon: String,
    },
    PlayerRespawned {
        id: String,
        x: f32,
        y: f32,
        health: f32,
    },
    BotSpawned(PlayerData),
    MapChanged {
        preset: String,
        url: String,
        seed: u64,
    },
    ChatMessage(ChatEntry),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CraterRecord {
    pub x: f32,
    pub y: f32,
    pub r: f32,
    pub w: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerData {
    pub id: String,
    pub name: String,
    pub color: String,
    pub is_bot: bool,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub aim_angle: f32,
    pub facing: i8,
    pub jetpack: bool,
    pub weapon_index: usize,
    pub health: f32,
    pub max_health: f32,
    pub kills: u32,
    pub deaths: u32,
    pub damage_dealt: f32,
    pub score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteShootData {
    pub player_id: String,
    pub weapon: String,
    pub weapon_index: usize,
    pub origin_x: f32,
    pub origin_y: f32,
    pub aim_angle: f32,
    pub aim_x: f32,
    pub aim_y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteGrenadeData {
    pub player_id: String,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatEntry {
    pub sender: String,
    pub color: String,
    pub text: String,
    pub time: u64,
}
