import React from 'react';
import { CreatureActor, CreatureProps, DemogorgonBuild } from '../demogorgon/Demogorgon';
import { buildDemodogRig } from './rig';
import { buildDemodogClips } from './animations';
import { createDemodogAudio } from './audio';

/** Builds a fresh rigged Demodog with all of its animation clips. */
export const createDemodog = (): DemogorgonBuild => {
    const rig = buildDemodogRig();
    const clips = buildDemodogClips(rig);
    return { rig, clips };
};

/** The four-legged Upside Down hunter. Same props and animations as the Demogorgon. */
export const Demodog: React.FC<CreatureProps> = props => (
    <CreatureActor {...props} create={createDemodog} createAudio={createDemodogAudio} />
);
