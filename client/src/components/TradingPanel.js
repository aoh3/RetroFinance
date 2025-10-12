import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import SplitFlapText from './splitflap/SplitFlapText';
import { useAlpacaOrderPlacement } from '../hooks/useAlpaca';
import './TradingPanel.css';

const clampQuantity = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return 1;
  }
  return Math.min(9999, Math.floor(numeric));
};

const TradingPanel = ({
  symbols,
  selectedSymbol,
  onSymbolChange,
}) => {
  const [symbol, setSymbol] = useState(selectedSymbol || 'AAPL');
  const [quantity, setQuantity] = useState(1);
  const [side, setSide] = useState('buy');
  const [feedback, setFeedback] = useState(null);
  const orderMutation = useAlpacaOrderPlacement();

  useEffect(() => {
    if (selectedSymbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  const handleSymbolKey = useCallback(
    (event) => {
      if (event.key === 'Backspace') {
        event.preventDefault();
        setSymbol((prev) => prev.slice(0, Math.max(0, prev.length - 1)) || '');
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onSymbolChange?.(symbol.toUpperCase());
        return;
      }

      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        event.preventDefault();
        setSymbol((prev) => (prev + event.key).slice(0, 6).toUpperCase());
      }
    },
    [symbol, onSymbolChange]
  );

  const handleQuantityKey = useCallback((event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      setQuantity((prev) => clampQuantity(String(prev).slice(0, -1) || 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      setQuantity((prev) => clampQuantity(`${prev === 0 ? '' : prev}${event.key}`));
    }
  }, []);

  const incrementQty = (delta) => {
    setQuantity((prev) => clampQuantity(prev + delta));
  };

  const placeOrder = async () => {
    if (!symbol) {
      setFeedback({ type: 'error', message: 'Symbol required' });
      return;
    }

    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        qty: quantity,
        side,
      };
      const result = await orderMutation.mutateAsync(payload);
      setFeedback({ type: 'success', message: `${side.toUpperCase()} ${quantity} ${symbol}` });
      onSymbolChange?.(symbol.toUpperCase());
      return result;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Order failed' });
      return null;
    }
  };

  const actionTone = side === 'buy' ? 'up' : 'down';
  const symbolList = useMemo(() => symbols || [], [symbols]);

  return (
    <div className="trading-panel" role="form" aria-label="Trading controls">
      <div className="trading-panel-row">
        <SplitFlapText value="SYMBOL" padTo={6} size="sm" tone="neutral" />
        <div
          className="splitflap-input"
          role="textbox"
          tabIndex={0}
          aria-label="Symbol"
          onKeyDown={handleSymbolKey}
        >
          <SplitFlapText value={symbol || ''} padTo={6} size="sm" tone="neutral" stagger={35} />
        </div>
        <div className="trading-panel-symbol-options" aria-hidden={!symbolList.length}>
          {symbolList.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={clsx('symbol-chip', { active: candidate === symbol })}
              onClick={() => {
                setSymbol(candidate);
                onSymbolChange?.(candidate);
              }}
            >
              <SplitFlapText value={candidate} padTo={4} size="sm" tone="neutral" stagger={30} />
            </button>
          ))}
        </div>
      </div>

      <div className="trading-panel-row">
        <SplitFlapText value="QTY" padTo={6} size="sm" tone="neutral" />
        <div
          className="splitflap-input"
          role="spinbutton"
          tabIndex={0}
          aria-label="Quantity"
          aria-valuenow={quantity}
          aria-valuemin={1}
          aria-valuemax={9999}
          onKeyDown={handleQuantityKey}
        >
          <SplitFlapText value={String(quantity)} padTo={4} size="sm" tone="neutral" stagger={40} />
        </div>
        <div className="trading-panel-qty-controls">
          <button type="button" onClick={() => incrementQty(1)}>
            <SplitFlapText value="+" padTo={2} size="sm" tone="neutral" stagger={25} />
          </button>
          <button type="button" onClick={() => incrementQty(-1)}>
            <SplitFlapText value="-" padTo={2} size="sm" tone="neutral" stagger={25} />
          </button>
        </div>
      </div>

      <div className="trading-panel-row trading-panel-actions">
        <button
          type="button"
          className={clsx({ active: side === 'buy' })}
          onClick={() => setSide('buy')}
        >
          <SplitFlapText value="BUY" padTo={4} size="sm" tone="up" stagger={30} />
        </button>
        <button
          type="button"
          className={clsx({ active: side === 'sell' })}
          onClick={() => setSide('sell')}
        >
          <SplitFlapText value="SELL" padTo={4} size="sm" tone="down" stagger={30} />
        </button>
        <button type="button" className="submit" onClick={placeOrder} disabled={orderMutation.isPending}>
          <SplitFlapText
            value={orderMutation.isPending ? 'SENDING' : 'SUBMIT'}
            padTo={7}
            size="sm"
            tone={actionTone}
            stagger={30}
          />
        </button>
      </div>

      {feedback && (
        <div className={clsx('trading-feedback', feedback.type)}>
          <SplitFlapText
            value={feedback.message}
            padTo={24}
            size="sm"
            tone={feedback.type === 'success' ? 'up' : 'down'}
            stagger={35}
          />
        </div>
      )}
    </div>
  );
};

export default TradingPanel;
