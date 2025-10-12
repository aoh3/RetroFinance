import React, { useMemo } from 'react';
import clsx from 'clsx';
import SplitFlapTile from './SplitFlapTile';
import { normaliseGlyph } from './glyphs';
import './SplitFlapText.css';

const normaliseText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\s+/g, ' ')
    .toUpperCase();
};

const pad = (text, length, align) => {
  if (!length || text.length >= length) {
    return text;
  }

  if (align === 'right') {
    return text.padStart(length, ' ');
  }

  if (align === 'center') {
    const padding = length - text.length;
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
  }

  return text.padEnd(length, ' ');
};

const SplitFlapText = ({
  value,
  padTo,
  align = 'left',
  tone = 'neutral',
  size = 'md',
  baseDelay = 0,
  stagger = 55,
  jitter = 35,
  speed,
  className,
  role = 'text',
  ariaLabel,
}) => {
  const prepared = useMemo(() => {
    const text = pad(normaliseText(value), padTo, align);
    return Array.from(text).map((char) => normaliseGlyph(char));
  }, [value, padTo, align]);

  return (
    <div className={clsx('splitflap-string', className)} role={role} aria-label={ariaLabel}>
      {prepared.map((char, index) => (
        <SplitFlapTile
          key={`tile-${index}`}
          char={char}
          delay={baseDelay + index * stagger}
          jitter={jitter}
          speed={speed}
          tone={tone}
          size={size}
        />
      ))}
    </div>
  );
};

export default SplitFlapText;
