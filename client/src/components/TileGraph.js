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
  if (data.length > columns) {
    data = data.slice(-columns);
  }

  // example data entry:
  // {
    // "c": 226.79,
    // "h": 232.42,
    // "l": 225.95,
    // "n": 1031749,
    // "o": 232.185,
    // "t": "2025-09-10T04:00:00Z",
    // "v": 83440810,
    // "vw": 227.773239
  // }

  const mat = Array.from({ length: rows }, () => Array(columns).fill('_'));
  let minPrice = Infinity;
  let maxPrice = 0;
  for (let i = 0; i < data.length; i++) {
    const dayData = data[i];
    let openingPrice = dayData.open;
    let closingPrice = dayData.close;
    minPrice = Math.min(minPrice, openingPrice, closingPrice);
    maxPrice = Math.max(maxPrice, openingPrice, closingPrice);
  }
  function getRow(price) {
    const range = maxPrice - minPrice;
    const relativePosition = (price - minPrice) / range;
    return Math.floor((1 - relativePosition) * (rows - 1));
  }
  for (let i = 0; i < data.length; i++) {
    const dayData = data[i];
    let openRow = getRow(dayData.open);
    let closeRow = getRow(dayData.close);
    if (openRow > closeRow) {
      for (let r = closeRow; r <= openRow; r++) {
        mat[r][i] = '^';
      }
    } else if (openRow < closeRow) {
      for (let r = openRow; r <= closeRow; r++) {
        mat[r][i] = '*';
      }
    } else {
      mat[openRow][i] = '#';
    }
  }
  let off = columns - data.length;

  return (
    <div className="tile-graph" role="img" aria-label="Price history split-flap graph">
      {matrix.map((row, rowIndex) => (
        <div className="tile-graph-row" key={`graph-row-${rowIndex}`}>
          {row.map((char, columnIndex) => (
            <Flippy maxLen={1} target={columnIndex < off ? "_" : mat[rowIndex][columnIndex - off]} percent={0.0} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default TileGraph;
