

# Tatchamashay - Multiplayer 3D Adventure Game

A real-time multiplayer 3D adventure game built with React, Three.js, and PartyKit. Players can explore different levels, collect gems, pop balloons, and battle in a shared world with up to 4 concurrent players.

## 🎮 Game Features

- **Real-time Multiplayer**: Up to 4 players can join the same room
- **3D Environments**: Multiple levels including overworld and cave systems
- **Character Customization**: Choose from different character variants
- **Interactive Gameplay**: Collect gems, pop balloons, and engage in combat
- **Room-based Gameplay**: Create or join rooms with unique 4-character codes
- **Cross-platform**: Works on desktop and mobile browsers

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tatchamashay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Start the PartyKit multiplayer server
   npm run dev:party

   # Terminal 2: Start the React development server
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` (or the port shown in terminal)

## 🏗️ Project Structure

```
tatchamashay/
├── game/                          # Main game logic
│   ├── components/                # React components
│   │   ├── CaveLevel.tsx         # Cave level component
│   │   ├── CharacterSelect.tsx   # Character selection UI
│   │   ├── Door.tsx              # Door component
│   │   ├── LevelSelect.tsx       # Level selection UI
│   │   ├── LoadingScreen.tsx     # Loading screen component
│   │   ├── OverWorld.tsx         # Main overworld component
│   │   └── RemotePlayer.tsx      # Remote player rendering
│   ├── multiplayer/              # Multiplayer functionality
│   │   ├── MultiplayerContext.tsx # React context for multiplayer state
│   │   ├── types.ts              # TypeScript types for multiplayer
│   │   └── useMultiplayerEvents.ts # Multiplayer event hooks
│   ├── scenes/                   # Phaser.js game scenes
│   │   ├── GameScene.ts          # Main game scene
│   │   ├── MainMenu.ts           # Main menu scene
│   │   ├── Preloader.ts          # Asset preloader scene
│   │   └── UIScene.ts            # UI overlay scene
│   └── types.ts                  # Game type definitions
├── party/                        # PartyKit server logic
│   └── game.ts                   # Multiplayer game room server
├── public/                       # Static assets
│   ├── models/                   # 3D models (GLB format)
│   └── textures/                 # Texture assets
└── dist/                         # Built application
```

## 🤝 Contributing

We welcome contributions! This is a multiplayer game with complex real-time synchronization, so please follow these guidelines:

### Development Workflow

1. **Fork and Clone**: Fork the repository and create a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Code Standards**:
   - Use TypeScript for all new code
   - Follow existing naming conventions
   - Add proper TypeScript types for multiplayer messages
   - Test multiplayer functionality with multiple browser tabs/windows

3. **Multiplayer Considerations**:
   - **State Synchronization**: All game state changes must be broadcast to other players
   - **Authority**: The host player has authority over certain game events
   - **Interpolation**: Player movements should be interpolated for smooth rendering
   - **Conflict Resolution**: Handle cases where multiple players interact with the same object

4. **Testing Multiplayer Features**:
   - Open multiple browser tabs to simulate different players
   - Test room creation, joining, and leaving
   - Verify state synchronization across all clients
   - Test edge cases like network disconnections

### Adding New Features

#### New Game Objects
- Add 3D models to `public/models/`
- Create React components in `game/components/`
- Implement multiplayer synchronization in `party/game.ts`
- Update TypeScript types in `game/multiplayer/types.ts`

#### New Levels
- Create level components in `game/components/`
- Add level-specific logic to the PartyKit server
- Update level selection UI
- Ensure proper state reset when changing levels

#### Character Variants
- Add new 3D models to `public/models/`
- Update character selection UI
- Add variant to TypeScript types
- Ensure proper network synchronization

### Code Review Process

1. **Create Pull Request**: Push your feature branch and create a PR
2. **Description**: Include detailed description of changes and multiplayer implications
3. **Testing**: Describe how you tested multiplayer functionality
4. **Review**: At least one maintainer must review and approve

### Key Multiplayer Concepts

- **Room Codes**: 4-character alphanumeric codes for joining games
- **Host Authority**: First player in room becomes host, controls game start
- **State Broadcasting**: All game state changes are sent to PartyKit server
- **Interpolation**: Client-side prediction and interpolation for smooth movement
- **Conflict Prevention**: Server validates and prevents invalid state changes

## 📦 Deployment

### PartyKit Server
```bash
npm run deploy:party
```

### Frontend
```bash
npm run build
npm run preview
```

## 🔧 Available Scripts

- `npm run dev` - Start React development server
- `npm run dev:party` - Start PartyKit development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run deploy:party` - Deploy PartyKit server

## 🎯 Game Mechanics

### Core Gameplay
- **Movement**: WASD or arrow keys
- **Interaction**: Spacebar for actions (attacking, interacting)
- **Objectives**: Collect gems, pop balloons, complete levels

### Multiplayer Rules
- Maximum 4 players per room
- Host controls game start
- All players share the same world state
- Competitive and cooperative elements

## 📚 Resources

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - 3D rendering
- [PartyKit Documentation](https://docs.partykit.io) - Multiplayer infrastructure
- [Three.js Documentation](https://threejs.org/docs/) - 3D graphics

## 🤖 AI Agent Guidelines

See [AGENTS.md](AGENTS.md) for specific guidelines for AI assistants working on this codebase.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.
