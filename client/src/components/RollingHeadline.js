import React, { useEffect, useMemo, useState } from 'react';
import SplitFlapText from './splitflap/SplitFlapText';

const padHeadline = (value) => {
  if (!value) {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
};

const RollingHeadline = ({
  text,
  width = 36,
  interval = 2500,
  tone = 'neutral',
  baseDelay = 0,
}) => {
  const [offset, setOffset] = useState(0);
  const prepared = useMemo(() => {
    const clean = padHeadline(text);
    const padding = ' '.repeat(Math.max(6, Math.ceil(width / 3)));
    const loopText = `${clean}${padding}`;
    return {
      source: loopText,
      length: loopText.length,
    };
  }, [text, width]);

  useEffect(() => {
    const { length } = prepared;
    if (!length) {
      return undefined;
    }

    const timer = setInterval(() => {
      setOffset((prev) => (prev + 1) % length);
    }, interval);

    return () => clearInterval(timer);
  }, [prepared, interval]);

  if (!prepared.length) {
    return <SplitFlapText value={' '.repeat(width)} padTo={width} tone={tone} baseDelay={baseDelay} size="sm" />;
  }

  const { source, length } = prepared;
  const windowText = `${source}${source}`.slice(offset, offset + width);

  return (
    <SplitFlapText
      value={windowText}
      padTo={width}
      tone={tone}
      baseDelay={baseDelay}
      stagger={45}
      jitter={40}
      size="sm"
      role="listitem"
    />
  );
};

export default RollingHeadline;
