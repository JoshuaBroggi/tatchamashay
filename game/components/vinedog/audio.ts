import { createCreatureAudio, DemogorgonAudio, VoiceProfile } from '../demogorgon/audio';

/**
 * The Vine Dog's voice: very deep, with a sub-bass boom under the roar like the Demodog, a
 * little darker in the formants, and the longest reverb tail of the three.
 */
export const VINE_DOG_VOICE: VoiceProfile = {
    pitch: 0.5,
    screamPitch: 0.45,
    formant: 0.62,
    sub: 1.1,
    strikeAt: 0.58,
    walkPeriod: 1,
    steps: [0, 0.25, 0.5, 0.75],
    stepLevel: 0.3,
    reverbSeconds: 3.6,
};

export const createVineDogAudio = (initialVolume = 0.8): DemogorgonAudio =>
    createCreatureAudio(VINE_DOG_VOICE, initialVolume);
