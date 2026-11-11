import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GroupProps, useFrame } from '@react-three/fiber';
import { buildDemogorgonRig, DemogorgonRig } from './rig';
import { buildDemogorgonClips, CLIP_NAMES, DemogorgonAnimation, ONE_SHOT } from './animations';
import { createDemogorgonAudio } from './audio';

export type { DemogorgonAnimation } from './animations';

export interface DemogorgonBuild {
    rig: DemogorgonRig;
    clips: THREE.AnimationClip[];
}

/** Builds a fresh rigged Demogorgon with all of its animation clips. */
export const createDemogorgon = (): DemogorgonBuild => {
    const rig = buildDemogorgonRig();
    const clips = buildDemogorgonClips(rig);
    return { rig, clips };
};

interface DemogorgonProps extends Omit<GroupProps, 'ref'> {
    animation?: DemogorgonAnimation;
    /** Standing height in world units. Defaults to the 2.5 m the model is authored at. */
    height?: number;
    timeScale?: number;
    /** Plays the creature's voice: growls, screams, clicks and footfalls synced to the animation. */
    sound?: boolean;
    /** Master volume for the voice, 0 to 1. */
    volume?: number;
    /** Fired when a one-shot animation (attack, roar) reaches its end. */
    onAnimationFinished?: (animation: DemogorgonAnimation) => void;
    /** Hands the built rig and clips to the parent (used by the preview for GLB export). */
    onBuilt?: (build: DemogorgonBuild) => void;
}

const FADE_SECONDS = 0.25;

export const Demogorgon: React.FC<DemogorgonProps> = ({
    animation = 'idle',
    height,
    timeScale = 1,
    sound = false,
    volume = 0.8,
    onAnimationFinished,
    onBuilt,
    ...groupProps
}) => {
    const build = useMemo(createDemogorgon, []);
    const mixer = useMemo(() => new THREE.AnimationMixer(build.rig.root), [build]);
    const actions = useMemo(() => {
        const map = {} as Record<DemogorgonAnimation, THREE.AnimationAction>;
        (Object.keys(CLIP_NAMES) as DemogorgonAnimation[]).forEach(key => {
            const clip = build.clips.find(c => c.name === CLIP_NAMES[key])!;
            const action = mixer.clipAction(clip);
            if (ONE_SHOT[key]) {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
            } else {
                action.setLoop(THREE.LoopRepeat, Infinity);
            }
            map[key] = action;
        });
        return map;
    }, [build, mixer]);

    const audio = useMemo(() => createDemogorgonAudio(volume), []); // eslint-disable-line react-hooks/exhaustive-deps
    const currentRef = useRef<THREE.AnimationAction | null>(null);
    const finishedCallbackRef = useRef(onAnimationFinished);
    finishedCallbackRef.current = onAnimationFinished;

    useEffect(() => {
        onBuilt?.(build);
    }, [build, onBuilt]);

    useEffect(() => {
        audio.setVolume(volume);
    }, [audio, volume]);

    useEffect(() => {
        if (sound) audio.play(animation);
        else audio.stop();
    }, [audio, sound, animation]);

    useEffect(() => () => audio.dispose(), [audio]);

    useEffect(() => {
        const next = actions[animation];
        const prev = currentRef.current;
        if (prev === next && !ONE_SHOT[animation]) return;
        next.reset().fadeIn(prev ? FADE_SECONDS : 0).play();
        if (prev && prev !== next) prev.fadeOut(FADE_SECONDS);
        currentRef.current = next;
    }, [animation, actions]);

    useEffect(() => {
        const onFinished = (e: { action: THREE.AnimationAction }) => {
            const key = (Object.keys(actions) as DemogorgonAnimation[]).find(k => actions[k] === e.action);
            if (key) finishedCallbackRef.current?.(key);
        };
        mixer.addEventListener('finished', onFinished as any);
        return () => mixer.removeEventListener('finished', onFinished as any);
    }, [mixer, actions]);

    useEffect(
        () => () => {
            mixer.stopAllAction();
            build.rig.dispose();
        },
        [mixer, build],
    );

    useFrame((_state, delta) => {
        mixer.update(Math.min(delta, 0.1) * timeScale);
    });

    const scale = height ? height / build.rig.height : 1;
    return (
        <group {...groupProps} scale={scale}>
            <primitive object={build.rig.root} />
        </group>
    );
};
