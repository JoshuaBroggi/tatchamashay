import { createCreatureAudio, DemogorgonAudio, VoiceProfile } from '../demogorgon/audio';

/**
 * The Demodog's voice: the Demogorgon's engine pitched far down, with a sub-bass chest boom
 * under every roar and a longer, cavernous tail. Four paws, so four footfalls per stride.
 */
export const DEMODOG_VOICE: VoiceProfile = {
    pitch: 0.55,
    screamPitch: 0.5,
    formant: 0.68,
    sub: 1,
    strikeAt: 0.58,
    walkPeriod: 1,
    steps: [0, 0.25, 0.5, 0.75],
    stepLevel: 0.35,
    reverbSeconds: 3.2,
};

export const createDemodogAudio = (initialVolume = 0.8): DemogorgonAudio =>
    createCreatureAudio(DEMODOG_VOICE, initialVolume);
