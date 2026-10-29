import React from 'react';
import { ServePromo, TOTAL } from './Main';
import { Composition } from 'remotion';
import { PhoneHero, PHONE_HERO_DURATION } from './serve/PhoneHero';
import { ColdOpen, COLD_OPEN_DURATION } from './serve/ColdOpen';
import { Wordmark, WORDMARK_DURATION } from './serve/Wordmark';
import { LiveFrame, liveDuration } from './serve/LiveFrame';
import { LIVE } from './serve/live';
import { Cascade, CASCADE_DURATION } from './serve/Cascade';
import { AutoClip, AUTO_CLIP_DURATION } from './serve/AutoClip';
import { WhoElse, WHO_ELSE_DURATION } from './serve/WhoElse';
import { Models, MODELS_DURATION } from './serve/Models';
import { Safety, SAFETY_DURATION } from './serve/Safety';
import { LiveNumbers, LIVE_NUMBERS_DURATION } from './serve/LiveNumbers';
import { Outro, OUTRO_DURATION } from './serve/Outro';

const Live: React.FC = () => <LiveFrame segs={LIVE} />;

// each shot as its own composition for stills while it is built; the film is ServePromo (Main.tsx)
export const Root: React.FC = () => (
  <>
    <Composition id="ServePromo" component={ServePromo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} defaultProps={{ bgm: true }} />
    <Composition id="ColdOpen" component={ColdOpen} durationInFrames={COLD_OPEN_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="Wordmark" component={Wordmark} durationInFrames={WORDMARK_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="PhoneHero" component={PhoneHero} durationInFrames={PHONE_HERO_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="Live" component={Live} durationInFrames={liveDuration(LIVE)} fps={30} width={1920} height={1080} />
    <Composition id="Cascade" component={Cascade} durationInFrames={CASCADE_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="AutoClip" component={AutoClip} durationInFrames={AUTO_CLIP_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="WhoElse" component={WhoElse} durationInFrames={WHO_ELSE_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="Models" component={Models} durationInFrames={MODELS_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="Safety" component={Safety} durationInFrames={SAFETY_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="LiveNumbers" component={LiveNumbers} durationInFrames={LIVE_NUMBERS_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="Outro" component={Outro} durationInFrames={OUTRO_DURATION} fps={30} width={1920} height={1080} />
  </>
);
