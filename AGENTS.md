# AI Agent Guidelines for Tatchamashay

This document outlines specific rules and guidelines for AI assistants working on the Tatchamashay multiplayer game codebase. Following these guidelines ensures consistent, safe, and high-quality contributions to this real-time multiplayer 3D game.

## 🎯 Core Principles

### 1. Multiplayer-First Mindset
**Always prioritize multiplayer functionality and synchronization.**

- Every game state change must be properly synchronized across all players
- Never implement features that could create race conditions or desynchronization
- Test all changes with multiple browser instances/tabs
- Consider network latency, packet loss, and connection drops

### 2. Type Safety
**Maintain strict TypeScript typing throughout the codebase.**

- Use existing type definitions from `game/multiplayer/types.ts`
- Add new types for any multiplayer messages or game state
- Never use `any` types in multiplayer-related code
- Validate all network message structures

### 3. State Authority Rules
**Respect the multiplayer authority hierarchy.**

- Host player has authority over game start, level changes, and certain state resets
- Server (PartyKit) has final authority over game state validation
- Clients should never directly modify shared state without server validation
- Implement proper conflict resolution for competing player actions

## 🚫 Critical Restrictions

### Never Do These Things

1. **Don't break multiplayer synchronization**
   ```typescript
   // ❌ BAD: Direct state modification without broadcasting
   this.players[0].score += 10;

   // ✅ GOOD: Broadcast state change through proper channels
   this.broadcastScoreUpdate(playerId, newScore);
   ```

2. **Don't add blocking operations in game loop**
   ```typescript
   // ❌ BAD: Synchronous API calls in render loop
   const result = await fetch('/api/data'); // Blocks rendering

   // ✅ GOOD: Use non-blocking patterns or move to initialization
   useEffect(() => {
     fetchData().then(setData);
   }, []);
   ```

3. **Don't ignore network failures**
   ```typescript
   // ❌ BAD: Fire-and-forget network calls
   socket.send(message);

   // ✅ GOOD: Handle connection failures and retries
   try {
     await socket.send(message);
   } catch (error) {
     handleNetworkError(error);
   }
   ```

4. **Don't modify shared state without validation**
   ```typescript
   // ❌ BAD: Trusting client input directly
   player.position = clientMessage.position;

   // ✅ GOOD: Validate and sanitize input
   player.position = validatePosition(clientMessage.position);
   ```

## ✅ Required Patterns

### Multiplayer Message Handling

Always use the established message types and validation:

```typescript
// ✅ GOOD: Proper message type checking
if (isValidClientMessage(message)) {
  switch (message.type) {
    case 'position':
      handlePositionUpdate(message);
      break;
    case 'attack':
      handleAttack(message.playerId);
      break;
  }
}
```

### State Synchronization

Always broadcast state changes immediately:

```typescript
// ✅ GOOD: Immediate broadcasting
const updatePlayerPosition = (playerId: string, position: Vector3) => {
  players.get(playerId).position = position;
  room.broadcast({
    type: 'position',
    playerId,
    ...position
  });
};
```

### Error Handling

Always handle network and validation errors gracefully:

```typescript
// ✅ GOOD: Comprehensive error handling
try {
  const validatedData = validateGameAction(actionData);
  await processGameAction(validatedData);
  broadcastStateUpdate(validatedData);
} catch (error) {
  console.error('Game action failed:', error);
  sendErrorToClient(error.message);
}
```

## 🧪 Testing Requirements

### Multiplayer Testing Protocol

1. **Always test with multiple clients**
   ```bash
   # Open multiple browser tabs/windows
   # Test: Room creation, joining, leaving
   # Test: State synchronization across all clients
   # Test: Network disconnection/reconnection
   ```

2. **Test edge cases**
   - Host disconnection and reconnection
   - Player joining mid-game
   - Simultaneous actions on same objects
   - Network latency simulation

3. **Performance testing**
   - Monitor frame rates with 4 players
   - Test memory usage during extended play
   - Verify smooth interpolation at various latencies

## 📁 File Organization Rules

### Component Structure
```
game/components/
├── FeatureName.tsx          # Main component
├── FeatureName.test.tsx     # Unit tests
└── FeatureName.types.ts     # Component-specific types
```

### Multiplayer Code Placement
- **Client-side multiplayer logic**: `game/multiplayer/`
- **Server-side game logic**: `party/game.ts`
- **Shared types**: `game/multiplayer/types.ts`
- **React context**: `game/multiplayer/MultiplayerContext.tsx`

## 🔄 Code Review Checklist

Before submitting changes, verify:

- [ ] Multiplayer synchronization works with 2+ players
- [ ] No TypeScript errors or warnings
- [ ] Proper error handling for network failures
- [ ] State changes are properly broadcast
- [ ] No race conditions in concurrent operations
- [ ] Performance impact tested with multiple players
- [ ] Backward compatibility maintained

## 🚨 Red Flags

**Stop and ask for human review if:**

- You're unsure about multiplayer synchronization implications
- The change affects shared game state
- Network message formats are being modified
- New player actions are being added
- Game balance or rules are being changed
- Performance might be impacted for multiple players

## 🛠️ Development Tools

### Required Tools
- **Multiple browser tabs/windows** for testing multiplayer
- **Browser developer tools** for network monitoring
- **TypeScript compiler** for type checking
- **React DevTools** for component debugging

### Debugging Multiplayer Issues
1. Use browser network tab to monitor WebSocket messages
2. Log all incoming/outgoing messages in PartyKit server
3. Test with slow network conditions (Chrome DevTools)
4. Monitor for desynchronization between clients

## 📚 Key Concepts to Understand

### State Authority
- **Host**: Controls game start, level changes
- **Server**: Validates all state changes, prevents cheating
- **Clients**: Send requests, receive authoritative state updates

### Interpolation vs. Prediction
- **Interpolation**: Smooth rendering of known past positions
- **Prediction**: Client-side prediction of future positions
- **Reconciliation**: Correcting prediction errors with server truth

### Conflict Resolution
- **First-come-first-served**: First valid action wins
- **Host authority**: Host decisions override others
- **Server validation**: Invalid actions are rejected

## 🎮 Game-Specific Rules

### Player Actions
- **Movement**: Always interpolated, never snapped
- **Attacks**: Have cooldowns, validate on server
- **Item collection**: First player to interact claims item
- **Level transitions**: Only host can initiate

### Game State
- **Room state**: Managed by PartyKit server
- **Player state**: Synchronized via broadcast messages
- **Game objects**: Server maintains authoritative state
- **Score/progress**: Calculated server-side to prevent cheating

Remember: This is a real-time multiplayer game where synchronization is critical. Always err on the side of caution and ask for clarification when unsure about multiplayer implications.
