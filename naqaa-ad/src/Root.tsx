import React from 'react';
import {Composition} from 'remotion';
import {NaqaaAd, TOTAL} from './NaqaaAd';

export const Root: React.FC = () => (
  <Composition id="NaqaaAd" component={NaqaaAd} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
);
