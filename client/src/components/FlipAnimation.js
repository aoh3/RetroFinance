import React, { useEffect, useRef, useState } from 'react';
import './FlipAnimation.css';

const normaliseValue = (input) => {
  if (input === null || input === undefined || input === '') {
    return '—';
  }

  return String(input);
};

const FlipAnimation = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(() => normaliseValue(value));
  const [isFlipping, setIsFlipping] = useState(false);
  const timeoutRef = useRef(null);

  const incomingValue = normaliseValue(value);

  useEffect(() => {
    if (incomingValue === displayValue) {
      return undefined;
    }

    setIsFlipping(true);

    timeoutRef.current = setTimeout(() => {
      setDisplayValue(incomingValue);
      setIsFlipping(false);
      timeoutRef.current = null;
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [incomingValue, displayValue]);

  return (
    <div className={`flip-container ${isFlipping ? 'flipping' : ''}`}>
      <div className="flip-card">
        <div className="flip-face flip-front">{displayValue}</div>
        <div className="flip-face flip-back">{incomingValue}</div>
      </div>
    </div>
  );
};

export default FlipAnimation;