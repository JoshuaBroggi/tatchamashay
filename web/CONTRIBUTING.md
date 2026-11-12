# Contributing to Tatchamashay

Welcome! We're excited that you're interested in contributing to Tatchamashay, our family-friendly multiplayer adventure game. This guide will help you get started with contributing levels, characters, and other game content.

## 🚀 Quick Start

1. **Clone the repository** directly from GitHub
2. **Create a new branch** for your changes (`git checkout -b feature/your-feature-name`)
3. **Make your contributions** following the guidelines below
4. **Test your changes** with multiple players
5. **Commit your changes** (`git commit -am "Add: your feature description"`)
6. **Push your branch** (`git push origin feature/your-feature-name`)

### 📋 Contribution Workflow

- **Non-admin contributors**: Submit a pull request for review
- **Admin contributors**: May commit directly to main after review
- **All changes**: Require testing and meet the core requirements listed below

### 🔄 Pull Request Process

For non-admin contributors:
1. Push your feature branch to GitHub
2. Open a pull request with a clear description
3. Include the test checklist and all required information
4. Wait for review and approval
5. An admin will merge your changes

## 📋 Contribution Guidelines

### What You Can Contribute

As a parent or family member, you can contribute:

- **🌍 New Levels**: Create exciting new worlds and adventures
- **👤 New Characters**: Design unique playable characters
- **🎨 Game Assets**: Add textures, models, and visual elements
- **🎵 Audio**: Contribute sound effects and background music
- **📖 Story Content**: Add narratives and dialogue
- **🐛 Bug Fixes**: Fix issues in existing levels and characters

### What Only Engineers Should Modify

⚠️ **Please do not modify these areas unless you are an experienced software engineer:**

- **Game Engine** (`game/`, `party/`, core Phaser scenes)
- **Multiplayer Systems** (`game/multiplayer/`, PartyKit server logic)
- **Build Configuration** (`vite.config.ts`, `tsconfig.json`, `partykit.json`)
- **Type Definitions** (`game/types.ts`, `game/multiplayer/types.ts`)

## ✅ Core Requirements

All contributions must meet these essential criteria:

### 🚀 Production Readiness
- **Online Launch**: The game must launch online (not just localhost) without problems
- **Stability**: No crashes in the first 10 minutes of basic play across different browsers and devices
- **No External Tracking**: Absolutely no new external tracking, analytics, or data collection services

### 🧪 Testing Standards
- **Test Coverage**: Any new feature must include a simple test or manual test checklist
- **Multiplayer Validation**: All features must be tested with 2+ simultaneous players
- **Cross-Platform**: Must work on Chrome, Firefox, Safari, and Edge (desktop)

## 🎯 Adding New Levels

### Step 1: Choose Your Level Type

Tatchamashay supports different level types:
- **Adventure Levels**: Story-driven exploration
- **Puzzle Levels**: Brain-teasing challenges
- **Arena Levels**: Combat-focused areas

### Step 2: Create Your Level Component

Create a new file in `game/components/` following this pattern:

```typescript
// game/components/YourLevelName.tsx
import React, { useEffect } from 'react';
import { useMultiplayerContext } from '../multiplayer/MultiplayerContext';

export const YourLevelName: React.FC = () => {
  const { room } = useMultiplayerContext();

  useEffect(() => {
    // Initialize level logic here
    console.log('Your level is loading!');
  }, []);

  return (
    <div className="level-container">
      {/* Your level content */}
      <h1>Welcome to {levelName}!</h1>
      {/* Add your level elements */}
    </div>
  );
};
```

### Step 3: Add Level to Level Select

Update `game/components/LevelSelect.tsx` to include your new level:

```typescript
// Add to the levels array
const levels = [
  // ... existing levels
  {
    id: 'your-level-id',
    name: 'Your Level Name',
    description: 'A fun description of your level',
    component: YourLevelName,
    thumbnail: '/path/to/thumbnail.png'
  }
];
```

### Step 4: Test Multiplayer

- Open multiple browser tabs
- Test your level with 2+ players
- Ensure all players see the same game state
- Test edge cases (joining mid-level, disconnections)

## 👥 Adding New Characters

### Step 1: Prepare Character Assets

Place your 3D model files in `public/models/`:
- Use `.glb` or `.gltf` format
- Keep file sizes reasonable (< 5MB)
- Test the model in the character select screen

### Step 2: Add Character Definition

Update `game/components/CharacterSelect.tsx`:

```typescript
// Add to the characters array
const characters = [
  // ... existing characters
  {
    id: 'your-character-id',
    name: 'Character Name',
    modelPath: '/models/your-character-model.glb',
    description: 'Fun description of your character',
    abilities: ['ability1', 'ability2'], // Optional special abilities
    thumbnail: '/path/to/thumbnail.png'
  }
];
```

### Step 3: Character Balancing

Consider:
- **Movement Speed**: How fast does the character move?
- **Special Abilities**: What unique powers does the character have?
- **Visual Appeal**: Is the character fun to look at and control?

## 🎨 Asset Guidelines

### Models
- **Format**: GLTF/GLB preferred
- **Size**: Keep under 5MB per model
- **Optimization**: Use mesh compression when possible
- **Animation**: Include idle/walk animations if available

### Textures
- **Format**: PNG or JPG
- **Resolution**: 512x512 to 2048x2048
- **Compression**: Balance quality and file size

### Audio
- **Format**: MP3, WAV, or OGG
- **Length**: Keep sound effects under 5 seconds
- **Quality**: 128kbps minimum for music, higher for SFX

## 🧪 Testing Requirements

Before submitting your contribution:

1. **Stability Testing**
   - **Crash-Free Play**: No crashes in first 10 minutes of basic gameplay
   - **Online Deployment**: Must work when deployed online (not just localhost)
   - **Memory Leaks**: Monitor for memory leaks during extended play

2. **Multiplayer Testing**
   - Test with at least 2 players simultaneously
   - Verify synchronization across all clients
   - Test joining games in progress
   - Test disconnections and reconnections

3. **Cross-Browser Testing**
   - Chrome, Firefox, Safari, and Edge (desktop required)
   - Mobile testing encouraged but not required

4. **Performance Testing**
   - Monitor frame rates (target: 30+ FPS)
   - Check memory usage stability
   - Test on lower-end devices when possible

5. **Feature Testing**
   - **Test Checklist Required**: Every new feature must include a test checklist
   - **Manual Testing**: Document step-by-step testing procedures
   - **Edge Cases**: Test unusual scenarios and error conditions

## 📝 Pull Request & Contribution Guidelines

**Note**: Non-admin contributors must submit pull requests for all changes. Admin contributors may commit directly to main after following the same testing and review standards.

### Title Format
```
[type] Brief description of changes

Types:
- [level] for new levels
- [character] for new characters
- [asset] for new assets
- [fix] for bug fixes
```

### Pull Request Description Template
```markdown
## What does this PR add?

[Brief description of your contribution]

## How to test

[Detailed steps to test the new feature, including edge cases]

## Test Checklist

[ ] Feature launches online without issues
[ ] No crashes in 10+ minutes of basic play
[ ] Tested with 2+ simultaneous players
[ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
[ ] Performance impact assessed (FPS, memory usage)
[ ] No external tracking or analytics added
[ ] All assets properly attributed

## Screenshots/Media

[Include screenshots, videos, or links demonstrating the feature]

## Additional Notes

[Any special testing considerations or known limitations]

---
*Non-admin contributors: Wait for admin review and approval before your PR is merged.
Admin contributors: You may commit directly to main after ensuring all checklist items are met.*
```

## 🤝 Getting Help

- **Questions?** Open a GitHub Discussion
- **Bugs?** Create an issue with detailed steps to reproduce
- **Ideas?** Start a discussion to gather feedback

## 🙏 Attribution

Please include proper attribution for any assets you contribute that aren't your original work. This helps us maintain legal compliance and give credit where due.

---

Thank you for contributing to Tatchamashay! Your creativity helps make this game special for families everywhere. 🎮👨‍👩‍👧‍👦
