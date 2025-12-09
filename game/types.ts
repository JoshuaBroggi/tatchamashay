
import * as THREE from 'three';

export type Controls = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type GameProps = {
  isPlaying: boolean;
  controlsRef: React.MutableRefObject<Controls>;
  onScoreUpdate: (cb: (prev: number) => number) => void;
};
