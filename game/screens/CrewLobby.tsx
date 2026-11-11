import React, { useEffect, useRef, useState } from 'react';
import { Level } from '../types';
import { useMultiplayer } from '../multiplayer';
import { ExplorerRoleId, getExpedition, getExplorerRole, roleForCharacter } from '../expedition';
import { MenuScreen, ScreenHeader, Eyebrow } from './ui';

const MAX_CREW = 4;

interface CrewLobbyProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  explorerId: ExplorerRoleId;
  /** This player's chosen expedition; the leader's choice is shared with the crew. */
  level: Level;
  /** Called when a crew member must adopt the leader's expedition. */
  onLevelSync: (level: Level) => void;
  initialCode?: string;
  onLeave: () => void;
  onChangeExplorer: () => void;
  onChangeExpedition: () => void;
  onExpeditionStart: (level: Level) => void;
}

interface CrewSlot {
  key: string;
  role: string;
  name: string;
  status: string;
  statusClass: string;
  filled: boolean;
  isYou?: boolean;
}

// Screen 4 · Crew lobby (docs/design/2.0/screens/Lobby.dc.html)
export const CrewLobby: React.FC<CrewLobbyProps> = ({
  playerName,
  setPlayerName,
  explorerId,
  level,
  onLevelSync,
  initialCode = '',
  onLeave,
  onChangeExplorer,
  onChangeExpedition,
  onExpeditionStart,
}) => {
  const {
    isConnected,
    isConnecting,
    roomCode,
    isHost,
    hostId,
    remotePlayers,
    playerCount,
    gameStarted,
    roomLevel,
    connectionError,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    broadcastLevelChange,
  } = useMultiplayer();

  const [joinCode, setJoinCode] = useState(initialCode.toUpperCase().slice(0, 4));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastSentLevel = useRef<Level | null>(null);

  const me = getExplorerRole(explorerId);
  const inCrew = roomCode !== null;
  const reconnecting = inCrew && !isConnected && !isConnecting;
  const expedition = getExpedition(isHost || !roomLevel ? level : roomLevel);

  // Leader shares their expedition with the crew.
  useEffect(() => {
    if (!isConnected || !isHost) {
      lastSentLevel.current = null;
      return;
    }
    if (roomLevel !== level && lastSentLevel.current !== level) {
      lastSentLevel.current = level;
      broadcastLevelChange(level);
    }
  }, [isConnected, isHost, level, roomLevel, broadcastLevelChange]);

  // Crew members follow the leader's expedition.
  useEffect(() => {
    if (isConnected && !isHost && roomLevel && roomLevel !== level) {
      onLevelSync(roomLevel);
    }
  }, [isConnected, isHost, roomLevel, level, onLevelSync]);

  // Server started the expedition for the whole crew.
  useEffect(() => {
    if (gameStarted && isConnected) {
      onExpeditionStart(roomLevel ?? level);
    }
  }, [gameStarted, isConnected, roomLevel, level, onExpeditionStart]);

  // A full room refuses the join after the socket opens; drop back out of it.
  useEffect(() => {
    if (connectionError === 'Room is full') {
      leaveRoom();
      setError(`That crew is full (${MAX_CREW} of ${MAX_CREW}).`);
    }
  }, [connectionError, leaveRoom]);

  const requireName = (): string | null => {
    const name = playerName.trim();
    if (!name) {
      setError('Enter your name first.');
      return null;
    }
    try {
      localStorage.setItem('tm-player-name', name);
    } catch {
      // Name memory is a convenience only.
    }
    return name;
  };

  const handleCreate = async () => {
    const name = requireName();
    if (!name) return;
    setError(null);
    try {
      await createRoom(name, me.characterVariant);
    } catch {
      setError('Could not reach the crew server. Try again.');
    }
  };

  const handleJoin = async () => {
    const name = requireName();
    if (!name) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError('Crew codes are 4 characters.');
      return;
    }
    setError(null);
    if (inCrew) leaveRoom();
    try {
      await joinRoom(code, name, me.characterVariant);
      setJoinCode('');
    } catch {
      setError('Could not join that crew. Check the code and try again.');
    }
  };

  const handleCopyInvite = async () => {
    if (!roomCode) return;
    const link = `${window.location.origin}/lobby?code=${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copy failed. Share this link: ${link}`);
    }
  };

  const handleLeave = () => {
    if (inCrew) leaveRoom();
    onLeave();
  };

  const slots: CrewSlot[] = [
    {
      key: 'you',
      role: `${me.role}${isHost ? ' · Leader' : ''}`,
      name: inCrew ? playerName.trim() || 'You' : 'You',
      status: inCrew ? 'Ready' : 'Not in a crew yet',
      statusClass: inCrew ? 'text-ok' : 'text-ink-soft',
      filled: true,
      isYou: true,
    },
    ...Array.from(remotePlayers.values()).map(p => ({
      key: p.id,
      role: `${roleForCharacter(p.characterVariant)?.role ?? 'Explorer'}${p.id === hostId ? ' · Leader' : ''}`,
      name: p.name,
      status: 'At base camp',
      statusClass: 'text-ok',
      filled: true,
    })),
  ];
  while (slots.length < MAX_CREW) {
    slots.push({ key: `open-${slots.length}`, role: 'Open slot', name: '—', status: 'Waiting for an explorer', statusClass: 'text-ink-muted', filled: false });
  }

  const connectionLabel = isConnected
    ? <span className="text-ok">● Connected</span>
    : reconnecting
      ? <span className="text-warn">● Reconnecting…</span>
      : isConnecting
        ? <span className="text-ink-soft">Connecting…</span>
        : <span className="text-ink-muted">○ Not in a crew</span>;

  return (
    <MenuScreen>
      <ScreenHeader backLabel={inCrew ? 'Leave crew' : 'Back'} onBack={handleLeave} title="Base camp" right={connectionLabel} />

      <div className="flex flex-grow gap-9 short:gap-4">
        {/* Code, join, expedition */}
        <div className="flex w-[360px] flex-none flex-col gap-5 short:w-[46%] short:gap-2">
          {inCrew ? (
            <section className="flex flex-col gap-2.5 border border-line bg-ground-raised p-6 short:gap-1 short:px-3 short:py-2">
              <Eyebrow className="text-ink-soft">Crew code</Eyebrow>
              <span className="font-display text-[80px] font-extrabold leading-none tracking-[16px] text-gold short:text-[30px] short:tracking-[8px]" aria-live="polite">
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="h-[46px] cursor-pointer border border-gold bg-transparent font-body text-[15px] font-semibold text-ink hover:bg-ground-high short:h-9 short:text-[13px]"
              >
                {copied ? 'Invite link copied' : 'Copy invite link'}
              </button>
            </section>
          ) : (
            <section className="flex flex-col gap-2.5 border border-line bg-ground-raised p-6 short:gap-1 short:px-3 short:py-2">
              <label htmlFor="tm-name" className="tm-eyebrow text-ink-soft">Your name</label>
              <input
                id="tm-name"
                className="tm-input w-full short:h-9"
                value={playerName}
                onChange={e => setPlayerName(e.target.value.slice(0, 16))}
                placeholder="Explorer name"
                maxLength={16}
                autoComplete="nickname"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={isConnecting}
                className="h-[46px] cursor-pointer border border-gold bg-transparent font-body text-[15px] font-semibold text-ink hover:bg-ground-high disabled:cursor-wait disabled:opacity-50 short:h-9 short:text-[13px]"
              >
                {isConnecting ? 'Connecting…' : 'Start a crew'}
              </button>
            </section>
          )}

          <section className="flex flex-col gap-2.5 border border-line bg-ground-raised p-6 short:gap-1 short:px-3 short:py-2">
            <label htmlFor="tm-code" className="tm-eyebrow text-ink-soft">{inCrew ? 'Join another crew' : 'Join a crew'}</label>
            <form
              className="flex gap-2.5"
              onSubmit={e => {
                e.preventDefault();
                void handleJoin();
              }}
            >
              <input
                id="tm-code"
                className="tm-input flex-grow text-center font-display text-[26px] uppercase tracking-[10px] short:h-9 short:text-xl"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={isConnecting || joinCode.length !== 4}
                className="h-[50px] cursor-pointer border-0 bg-gold px-[22px] font-body text-[15px] font-semibold text-ground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 short:h-9"
              >
                Join
              </button>
            </form>
          </section>

          {error && (
            <p role="alert" className="m-0 border border-danger px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <section className="border border-line px-6 py-[18px] text-sm leading-normal text-ink-soft short:px-3 short:py-2 short:text-xs">
            Expedition: <span className="font-semibold text-ink">{expedition.name}</span>
            {(isHost || !inCrew) && (
              <button type="button" className="tm-link ml-2 text-[13px]" onClick={onChangeExpedition}>
                Change
              </button>
            )}
            <span className="block short:hidden">Leader picks the expedition and starts.</span>
          </section>
        </div>

        {/* Crew */}
        <ul className="m-0 grid flex-grow list-none grid-cols-2 gap-4 p-0 short:gap-2" aria-label="Crew">
          {slots.map(slot => (
            <li
              key={slot.key}
              className={`flex min-h-[120px] flex-col justify-end gap-1.5 p-6 short:min-h-[52px] short:gap-0 short:px-3 short:py-2 ${
                slot.filled ? 'border border-line-strong bg-gradient-to-b from-ground-high to-ground-raised' : 'border border-dashed border-line'
              }`}
            >
              <Eyebrow className="text-gold short:text-[10px]">{slot.role}</Eyebrow>
              <span className="truncate font-display text-[34px] font-extrabold leading-none text-ink short:text-xl">{slot.name}</span>
              <span className={`text-sm short:text-xs ${slot.statusClass}`}>
                {slot.status}
                {slot.isYou && (
                  <button type="button" className="tm-link ml-2 text-[13px] short:text-[11px]" onClick={onChangeExplorer}>
                    Change explorer
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex flex-none items-center justify-between gap-4">
        <span className="text-sm text-ink-soft short:text-xs">
          {inCrew ? `${playerCount} of ${MAX_CREW} explorers · the leader starts the expedition` : 'Start a crew or join one with a code'}
        </span>
        {inCrew && !isHost ? (
          <span className="tm-btn tm-btn-quiet w-[260px] cursor-default text-xl short:h-11 short:w-52 short:text-lg" aria-live="polite">
            Waiting for leader
          </span>
        ) : (
          <button
            type="button"
            className="tm-btn tm-btn-primary w-[260px] short:h-11 short:w-52 short:text-xl"
            disabled={!isConnected || !isHost}
            onClick={() => startGame(level)}
          >
            Start expedition
          </button>
        )}
      </footer>
    </MenuScreen>
  );
};

export default CrewLobby;
