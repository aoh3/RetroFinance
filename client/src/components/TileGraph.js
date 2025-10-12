import React, { useMemo } from 'react';
import './TileGraph.css';
import Flippy from './Flippy';

const DEFAULT_ROWS = 6;
const DEFAULT_COLUMNS = 32;

const buildMatrix = (series, rows, columns) => {
  if (!Array.isArray(series) || series.length === 0) {
    return Array.from({ length: rows }, () => Array(columns).fill(' '));
  }

  const capped = series.slice(-columns);
  const prices = capped.map((point) => point.close ?? point.price ?? point.value).filter((price) => typeof price === 'number');
  if (prices.length === 0) {
    return Array.from({ length: rows }, () => Array(columns).fill(' '));
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const heights = capped.map((point) => {
    const price = point.close ?? point.price ?? point.value ?? min;
    const ratio = (price - min) / span;
    return Math.max(1, Math.round(ratio * rows));
  });

  return Array.from({ length: rows }, (_, rowIndex) => {
    const threshold = rows - rowIndex;
    return heights.map((height) => (height >= threshold ? '=' : ' '));
  });
};

const TileGraph = ({ data, rows = DEFAULT_ROWS, columns = DEFAULT_COLUMNS, baseDelay = 0 }) => {
  const matrix = useMemo(() => buildMatrix(data, rows, columns), [data, rows, columns]);

  return (
    <div className="tile-graph" role="img" aria-label="Price history split-flap graph">
      {matrix.map((row, rowIndex) => (
        <div className="tile-graph-row" key={`graph-row-${rowIndex}`}>
          {row.map((char, columnIndex) => (
            <Flippy maxLen={1} target={"#"} percent={0.0} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default TileGraph;
