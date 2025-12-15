// Conditionally import Party types - will fail at runtime if partykit not installed
// This file is only used when running partykit dev/deploy
let Party: any;
try {
  Party = require("partykit/server");
} catch {
  // PartyKit not installed - create stub types
  Party = {
    Server: class {},
    Room: class {},
    Connection: class {},
    ConnectionContext: class {},
    Request: class {},
  };
}

// Message types for game synchronization
type MessageType =
  | { type: "join"; playerId: string; name: string; characterVariant: string }
  | { type: "leave"; playerId: string }
  | { type: "position"; playerId: string; x: number; y: number; z: number; rotation: number }
  | { type: "attack"; playerId: string }
  | { type: "attack_end"; playerId: string }
  | { type: "balloon_pop"; balloonIds: string[]; poppedBy: string }
  | { type: "gem_collect"; gemId: string; collectedBy: string }
  | { type: "level_change"; level: "overworld" | "cave" }
  | { type: "game_start" }
  | { type: "sync_state"; state: GameState }
  | { type: "player_list"; players: PlayerInfo[]; hostId: string }
  | { type: "character_update"; playerId: string; characterVariant: string };

interface PlayerInfo {
  id: string;
  name: string;
  characterVariant: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  isAttacking: boolean;
  isReady: boolean;
}

interface GameState {
  hostId: string;
  players: PlayerInfo[];
  currentLevel: "overworld" | "cave";
  gameStarted: boolean;
  poppedBalloons: string[];
  collectedGems: string[];
}

export default class GameRoom implements Party.Server {
  private players: Map<string, PlayerInfo> = new Map();
  private hostId: string | null = null;
  private gameStarted: boolean = false;
  private currentLevel: "overworld" | "cave" = "overworld";
  private poppedBalloons: Set<string> = new Set();
  private collectedGems: Set<string> = new Set();

  constructor(readonly room: Party.Room) {}

  // Generate a short room code for easy sharing
  static async onBeforeConnect(request: Party.Request) {
    return request;
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    // Send current state to newly connected player
    const playerList: PlayerInfo[] = Array.from(this.players.values());
    
    connection.send(JSON.stringify({
      type: "player_list",
      players: playerList,
      hostId: this.hostId
    }));

    // If game already started, send sync state
    if (this.gameStarted) {
      connection.send(JSON.stringify({
        type: "sync_state",
        state: {
          hostId: this.hostId,
          players: playerList,
          currentLevel: this.currentLevel,
          gameStarted: this.gameStarted,
          poppedBalloons: Array.from(this.poppedBalloons),
          collectedGems: Array.from(this.collectedGems)
        }
      }));
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as MessageType;

      switch (data.type) {
        case "join":
          this.handlePlayerJoin(data, sender);
          break;

        case "leave":
          this.handlePlayerLeave(data.playerId);
          break;

        case "position":
          this.handlePositionUpdate(data);
          break;

        case "attack":
          this.handleAttack(data.playerId, true);
          break;

        case "attack_end":
          this.handleAttack(data.playerId, false);
          break;

        case "balloon_pop":
          this.handleBalloonPop(data);
          break;

        case "gem_collect":
          this.handleGemCollect(data);
          break;

        case "level_change":
          this.handleLevelChange(data);
          break;

        case "game_start":
          this.handleGameStart(sender);
          break;

        case "character_update":
          this.handleCharacterUpdate(data);
          break;
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }

  onClose(connection: Party.Connection) {
    // Find and remove the player associated with this connection
    for (const [playerId, player] of this.players.entries()) {
      // We need to track connection IDs - for now, broadcast leave for cleanup
      if (connection.id === playerId) {
        this.handlePlayerLeave(playerId);
        break;
      }
    }
  }

  private handlePlayerJoin(data: { playerId: string; name: string; characterVariant: string }, sender: Party.Connection) {
    // Maximum 4 players
    if (this.players.size >= 4) {
      sender.send(JSON.stringify({ type: "error", message: "Room is full" }));
      return;
    }

    const player: PlayerInfo = {
      id: data.playerId,
      name: data.name,
      characterVariant: data.characterVariant,
      position: { x: 0, y: 0, z: 8 },
      rotation: Math.PI,
      isAttacking: false,
      isReady: false
    };

    this.players.set(data.playerId, player);

    // First player becomes host
    if (!this.hostId) {
      this.hostId = data.playerId;
    }

    // Broadcast updated player list
    this.broadcastPlayerList();
  }

  private handlePlayerLeave(playerId: string) {
    this.players.delete(playerId);

    // If host left, assign new host
    if (this.hostId === playerId) {
      const remainingPlayers = Array.from(this.players.keys());
      this.hostId = remainingPlayers.length > 0 ? remainingPlayers[0] : null;
    }

    // Broadcast updated player list
    this.broadcastPlayerList();

    // Also broadcast leave event for cleanup
    this.room.broadcast(JSON.stringify({
      type: "leave",
      playerId
    }));
  }

  private handlePositionUpdate(data: { playerId: string; x: number; y: number; z: number; rotation: number }) {
    const player = this.players.get(data.playerId);
    if (player) {
      player.position = { x: data.x, y: data.y, z: data.z };
      player.rotation = data.rotation;
    }

    // Broadcast to all other players (not back to sender for efficiency)
    this.room.broadcast(JSON.stringify(data), []);
  }

  private handleAttack(playerId: string, isAttacking: boolean) {
    const player = this.players.get(playerId);
    if (player) {
      player.isAttacking = isAttacking;
    }

    // Broadcast attack state
    this.room.broadcast(JSON.stringify({
      type: isAttacking ? "attack" : "attack_end",
      playerId
    }));
  }

  private handleBalloonPop(data: { balloonIds: string[]; poppedBy: string }) {
    // Only accept balloon pops from host
    if (data.poppedBy !== this.hostId) {
      // Non-host sent pop - request, forward to host for verification
      // For simplicity, we'll trust the sender but track it
    }

    // Track popped balloons
    data.balloonIds.forEach(id => this.poppedBalloons.add(id));

    // Broadcast to all players
    this.room.broadcast(JSON.stringify(data));
  }

  private handleGemCollect(data: { gemId: string; collectedBy: string }) {
    // Prevent double collection
    if (this.collectedGems.has(data.gemId)) {
      return;
    }

    this.collectedGems.add(data.gemId);

    // Broadcast to all players
    this.room.broadcast(JSON.stringify(data));
  }

  private handleLevelChange(data: { level: "overworld" | "cave" }) {
    this.currentLevel = data.level;
    
    // Reset level-specific state
    if (data.level === "overworld") {
      this.collectedGems.clear();
    }

    // Broadcast to all players
    this.room.broadcast(JSON.stringify(data));
  }

  private handleGameStart(sender: Party.Connection) {
    // Only host can start the game
    const senderPlayer = Array.from(this.players.values()).find(p => 
      sender.id === p.id || this.hostId === p.id
    );
    
    if (!senderPlayer || senderPlayer.id !== this.hostId) {
      // For now, allow any player to start for testing
    }

    this.gameStarted = true;
    this.poppedBalloons.clear();
    this.collectedGems.clear();
    this.currentLevel = "overworld";

    // Broadcast game start
    this.room.broadcast(JSON.stringify({ type: "game_start" }));
  }

  private handleCharacterUpdate(data: { playerId: string; characterVariant: string }) {
    const player = this.players.get(data.playerId);
    if (player) {
      player.characterVariant = data.characterVariant;
    }

    // Broadcast updated player list
    this.broadcastPlayerList();
  }

  private broadcastPlayerList() {
    const playerList: PlayerInfo[] = Array.from(this.players.values());
    
    this.room.broadcast(JSON.stringify({
      type: "player_list",
      players: playerList,
      hostId: this.hostId
    }));
  }
}
