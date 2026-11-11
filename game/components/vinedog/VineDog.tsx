import React from 'react';
import { CreatureActor, CreatureProps, DemogorgonBuild } from '../demogorgon/Demogorgon';
import { buildVineDogRig } from './rig';
import { buildVineDogClips } from './animations';
import { createVineDogAudio } from './audio';

/** Builds a fresh rigged Vine Dog with all of its animation clips. */
export const createVineDog = (): DemogorgonBuild => {
    const rig = buildVineDogRig();
    const clips = buildVineDogClips(rig);
    return { rig, clips };
};

/** The vine-woven hunter from Stranger Things: Tales from '85. Same props and animations as the Demogorgon. */
export const VineDog: React.FC<CreatureProps> = props => (
    <CreatureActor {...props} create={createVineDog} createAudio={createVineDogAudio} />
);
