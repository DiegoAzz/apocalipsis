use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::sync::broadcast;
use tower_http::{cors::CorsLayer, services::ServeDir};

mod level;
mod player;
mod protocol;
mod weapons;

use level::VoxelTerrain;
use player::Player;
use protocol::*;

// Shared Room State
struct RoomState {
    id: String,
    preset: String,
    url: String,
    seed: u64,
    craters: Vec<CraterRecord>,
    players: HashMap<String, Player>,
    chat_history: Vec<ChatEntry>,
    terrain: VoxelTerrain,
    sender: broadcast::Sender<String>,
}

struct AppState {
    rooms: Mutex<HashMap<String, Arc<Mutex<RoomState>>>>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = Arc::new(AppState {
        rooms: Mutex::new(HashMap::new()),
    });

    // Create default lobby room
    {
        let (tx, _) = broadcast::channel(256);
        let lobby = RoomState {
            id: "lobby".to_string(),
            preset: "wikipedia".to_string(),
            url: "https://en.wikipedia.org/wiki/Stick_figure".to_string(),
            seed: 42,
            craters: Vec::new(),
            players: HashMap::new(),
            chat_history: Vec::new(),
            terrain: VoxelTerrain::new(1500, 2600, 5),
            sender: tx,
        };
        state
            .rooms
            .lock()
            .unwrap()
            .insert("lobby".to_string(), Arc::new(Mutex::new(lobby)));
    }

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .nest_service("/", ServeDir::new("../destroy-clone/public"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("[DESTROY ANY WEBSITE - RUST] High-speed server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let player_id = format!("rust_{:x}", rand::random::<u32>());

    let mut current_room: Option<Arc<Mutex<RoomState>>> = None;
    let mut rx_broadcast: Option<broadcast::Receiver<String>> = None;

    // Read incoming client messages
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                match client_msg {
                    ClientMessage::JoinRoom { room, name, skin_color } => {
                        let room_id = if room.is_empty() { "lobby".to_string() } else { room.to_lowercase() };

                        let room_arc = {
                            let mut rooms = state.rooms.lock().unwrap();
                            rooms
                                .entry(room_id.clone())
                                .or_insert_with(|| {
                                    let (tx, _) = broadcast::channel(256);
                                    Arc::new(Mutex::new(RoomState {
                                        id: room_id.clone(),
                                        preset: "wikipedia".to_string(),
                                        url: "https://en.wikipedia.org/wiki/Stick_figure".to_string(),
                                        seed: rand::random::<u64>(),
                                        craters: Vec::new(),
                                        players: HashMap::new(),
                                        chat_history: Vec::new(),
                                        terrain: VoxelTerrain::new(1500, 2600, 5),
                                        sender: tx,
                                    }))
                                })
                                .clone()
                        };

                        rx_broadcast = Some(room_arc.lock().unwrap().sender.subscribe());
                        current_room = Some(room_arc.clone());

                        let new_player = Player::new(player_id.clone(), name.clone(), skin_color, false);
                        let player_data = new_player.to_data();

                        let init_data = {
                            let mut r = room_arc.lock().unwrap();
                            r.players.insert(player_id.clone(), new_player);

                            let all_players: Vec<PlayerData> = r.players.values().map(|p| p.to_data()).collect();
                            ServerMessage::InitState {
                                self_id: player_id.clone(),
                                preset: r.preset.clone(),
                                url: r.url.clone(),
                                seed: r.seed,
                                craters: r.craters.clone(),
                                players: all_players,
                                chat_history: r.chat_history.clone(),
                            }
                        };

                        // Send init state to joined player
                        let init_json = serde_json::to_string(&init_data).unwrap();
                        let _ = sender.send(Message::Text(init_json)).await;

                        // Broadcast to others in room
                        let joined_msg = serde_json::to_string(&ServerMessage::PlayerJoined(player_data)).unwrap();
                        let _ = room_arc.lock().unwrap().sender.send(joined_msg);
                    }

                    ClientMessage::TerrainDamage { x, y, radius, weapon } => {
                        if let Some(ref r_arc) = current_room {
                            let mut r = r_arc.lock().unwrap();
                            r.terrain.carve_circle(x, y, radius, true);
                            r.craters.push(CraterRecord { x, y, r: radius, w: weapon.clone() });

                            let msg = serde_json::to_string(&ServerMessage::TerrainDamaged { x, y, radius, weapon }).unwrap();
                            let _ = r.sender.send(msg);
                        }
                    }

                    ClientMessage::PlayerShoot { weapon, weapon_index, origin_x, origin_y, aim_angle, aim_x, aim_y } => {
                        if let Some(ref r_arc) = current_room {
                            let r = r_arc.lock().unwrap();
                            let shoot_msg = serde_json::to_string(&ServerMessage::PlayerShot(RemoteShootData {
                                player_id: player_id.clone(),
                                weapon,
                                weapon_index,
                                origin_x,
                                origin_y,
                                aim_angle,
                                aim_x,
                                aim_y,
                            })).unwrap();
                            let _ = r.sender.send(shoot_msg);
                        }
                    }

                    ClientMessage::PlayerGrenade { x, y, vx, vy } => {
                        if let Some(ref r_arc) = current_room {
                            let r = r_arc.lock().unwrap();
                            let msg = serde_json::to_string(&ServerMessage::PlayerThrewGrenade(RemoteGrenadeData {
                                player_id: player_id.clone(),
                                x,
                                y,
                                vx,
                                vy,
                            })).unwrap();
                            let _ = r.sender.send(msg);
                        }
                    }

                    ClientMessage::ChatMessage { text } => {
                        if let Some(ref r_arc) = current_room {
                            let mut r = r_arc.lock().unwrap();
                            let name = r.players.get(&player_id).map(|p| p.name.clone()).unwrap_or_else(|| "Operative".to_string());
                            let color = r.players.get(&player_id).map(|p| p.color.clone()).unwrap_or_else(|| "#f97316".to_string());

                            let entry = ChatEntry {
                                sender: name,
                                color,
                                text,
                                time: 0,
                            };
                            r.chat_history.push(entry.clone());
                            let msg = serde_json::to_string(&ServerMessage::ChatMessage(entry)).unwrap();
                            let _ = r.sender.send(msg);
                        }
                    }

                    _ => {}
                }
            }
        }
    }

    // On disconnect, remove player and notify room
    if let Some(r_arc) = current_room {
        let mut r = r_arc.lock().unwrap();
        r.players.remove(&player_id);
        let leave_msg = serde_json::to_string(&ServerMessage::PlayerLeft { id: player_id }).unwrap();
        let _ = r.sender.send(leave_msg);
    }
}
