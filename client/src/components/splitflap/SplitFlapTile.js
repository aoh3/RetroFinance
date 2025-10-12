import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { GLYPH_ORDER, getGlyphIndex, normaliseGlyph } from './glyphs';
import './SplitFlapTile.css';

const DEFAULT_SPEED = 90;

const schedule = (handler, ms, bucket) => {
  const id = setTimeout(handler, ms);
  bucket.push(id);
  return id;
};

const clearBucket = (bucket) => {
  while (bucket.length) {
    clearTimeout(bucket.pop());
  }
};

const SplitFlapTile = ({
  char,
  delay = 0,
  jitter = 25,
  speed = DEFAULT_SPEED,
  tone = 'neutral',
  size = 'md',
}) => {
  const targetGlyph = useMemo(() => normaliseGlyph(char), [char]);
  const timersRef = useRef([]);
  const currentIndexRef = useRef(getGlyphIndex(targetGlyph));
  const initialGlyph = GLYPH_ORDER[currentIndexRef.current];
  const [topStatic, setTopStatic] = useState(initialGlyph);
  const [bottomStatic, setBottomStatic] = useState(initialGlyph);
  const [flipTop, setFlipTop] = useState(initialGlyph);
  const [flipBottom, setFlipBottom] = useState(initialGlyph);
  const [phase, setPhase] = useState('idle');
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => () => clearBucket(timersRef.current), []);

  useEffect(() => {
    const targetIndex = getGlyphIndex(targetGlyph);
    const currentIndex = currentIndexRef.current;
    const steps = (targetIndex - currentIndex + GLYPH_ORDER.length) % GLYPH_ORDER.length;

    if (steps === 0) {
      const glyph = GLYPH_ORDER[targetIndex];
      setTopStatic(glyph);
      setBottomStatic(glyph);
      setFlipTop(glyph);
      setFlipBottom(glyph);
      setPhase('idle');
      setIsFlipping(false);
      currentIndexRef.current = targetIndex;
      return undefined;
    }

    let cancelled = false;
    let stepPointer = 0;
    let workingIndex = currentIndex;
    const timers = timersRef.current;

    const runStep = () => {
      if (cancelled) {
        return;
      }

      const nextIndex = (workingIndex + 1) % GLYPH_ORDER.length;
      const currentGlyph = GLYPH_ORDER[workingIndex];
      const upcomingGlyph = GLYPH_ORDER[nextIndex];

      setIsFlipping(true);
      setPhase('top');
      setFlipTop(currentGlyph);
      setFlipBottom(upcomingGlyph);
      setTopStatic(currentGlyph);
      setBottomStatic(currentGlyph);

      const upperDuration = Math.max(45, speed);
      const lowerDuration = Math.max(55, speed + 10);

      schedule(() => {
        if (cancelled) {
          return;
        }

        setPhase('bottom');
        setTopStatic(upcomingGlyph);

        schedule(() => {
          if (cancelled) {
            return;
          }

          setPhase('idle');
          setIsFlipping(false);
          setTopStatic(upcomingGlyph);
          setBottomStatic(upcomingGlyph);
          setFlipTop(upcomingGlyph);
          setFlipBottom(upcomingGlyph);
          workingIndex = nextIndex;
          currentIndexRef.current = nextIndex;
          stepPointer += 1;

          if (stepPointer < steps) {
            schedule(runStep, Math.max(35, speed * 0.6), timers);
          }
        }, lowerDuration, timers);
      }, upperDuration, timers);
    };

    const kickoffDelay = Math.max(0, delay + Math.random() * jitter);
    schedule(runStep, kickoffDelay, timers);

    return () => {
      cancelled = true;
      clearBucket(timers);
    };
  }, [delay, jitter, speed, targetGlyph]);

  return (
    <div
      className={clsx('splitflap-tile', `tone-${tone}`, `size-${size}`, {
        flipping: isFlipping,
        [`phase-${phase}`]: true,
      })}
    >
      <div className="splitflap-inner">
        <div className="splitflap-half splitflap-half-top">
          <span>{topStatic}</span>
        </div>
        <div className="splitflap-half splitflap-half-bottom">
          <span>{bottomStatic}</span>
        </div>
        <div className="splitflap-flip splitflap-flip-top">
          <span>{flipTop}</span>
        </div>
        <div className="splitflap-flip splitflap-flip-bottom">
          <span>{flipBottom}</span>
        </div>
      </div>
    </div>
  );
};

export default SplitFlapTile;
