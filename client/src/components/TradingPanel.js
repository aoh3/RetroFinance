import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useAlpacaOrderPlacement } from '../hooks/useAlpaca';
import Flippy from './Flippy';
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
  const [symbolInWatchlist, setSymbolInWatchlist] = useState(false);
  // no default side; allow toggle off
  const [side, setSide] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const orderMutation = useAlpacaOrderPlacement();

  useEffect(() => {
    if (selectedSymbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  // run custom logic whenever symbol changes
  useEffect(() => {
    if (symbols.includes(symbol.toUpperCase())) {
      setSymbolInWatchlist(true);
    } else {
      setSymbolInWatchlist(false);
    }
  }, [symbol]);

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
        // limit user input to 4 characters
        setSymbol((prev) => (prev + event.key).slice(0, 4).toUpperCase());
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
    if (!side) {
      setFeedback({ type: 'error', message: 'Select Buy or Sell' });
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

  const modifyWatchlist = async () => {
    if (!symbol) {
      setFeedback({ type: 'error', message: 'Symbol required' });
      return;
    }
    const sym = symbol.toUpperCase();
    try {
      // validate symbol by fetching quote
      const resp = await fetch(`/api/market/quotes?symbols=${sym}`);
      if (!resp.ok) {
        throw new Error('Invalid symbol');
      }
      const data = await resp.json();
      if (!data[sym]) {
        throw new Error('Symbol not found');
      }
      if (!symbols.includes(sym)) {
        symbols.push(sym);
        setFeedback({ type: 'success', message: `Added ${sym} to watchlist` });
        setSymbolInWatchlist(true);
      } else {
        let index = symbols.indexOf(sym);
        if (index !== -1) {
            symbols.splice(index, 1);
        }
        setFeedback({ type: 'success', message: `Removed ${sym} from watchlist` });
        setSymbolInWatchlist(false);
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to add to watchlist' });
    }
  };

  const actionTone = side === 'buy' ? 'up' : 'down';
  const symbolList = useMemo(() => symbols || [], [symbols]);

  return (
    <div className="trading-panel" role="form" aria-label="Trading controls">
      <div className="trading-panel-row">
        <div
          className="flippy-input"
          role="textbox"
          tabIndex={0}
          aria-label="Symbol"
          onKeyDown={handleSymbolKey}
        >
          <Flippy maxLen={6} target={symbol || ''} percent={0.0} />
        </div>
        <div
          className="flippy-input"
          role="spinbutton"
          tabIndex={0}
          aria-label="Quantity"
          aria-valuenow={quantity}
          aria-valuemin={1}
          aria-valuemax={9999}
          onKeyDown={handleQuantityKey}
        >
          <Flippy maxLen={4} target={String(quantity)} percent={0.0} />
        </div>
        <div className="trading-panel-qty-controls">
          <button type="button" onClick={() => incrementQty(1)} className={clsx('static-button', 'qty-button')}>
            <span className="static-label">+</span>
          </button>
          <button type="button" onClick={() => incrementQty(-1)} className={clsx('static-button', 'qty-button')}>
            <span className="static-label">-</span>
          </button>
        </div>
      </div>

      <div className="trading-panel-row trading-panel-actions">
        <button
          type="button"
          className={clsx('static-button', 'add-watchlist-button')}
          onClick={modifyWatchlist}
        >
            <span className="static-label">
              {symbolInWatchlist ? 'REMOVE FROM WATCHLIST' : 'ADD TO WATCHLIST'}
            </span>
        </button>
        <button
          type="button"
          className={clsx('static-button', 'buy-button', { active: side === 'buy' })}
          onClick={() => setSide((prev) => (prev === 'buy' ? null : 'buy'))}
        >
          <span className="static-label">BUY</span>
        </button>
        <button
          type="button"
          className={clsx('static-button', 'sell-button', { active: side === 'sell' })}
          onClick={() => setSide((prev) => (prev === 'sell' ? null : 'sell'))}
        >
          <span className="static-label">SELL</span>
        </button>
        <button
          type="button"
          className={clsx('static-button', 'submit-button')}
          onClick={placeOrder}
          disabled={orderMutation.isPending || !side}
        >
          <span className="static-label">
            {orderMutation.isPending ? 'SENDING' : 'SUBMIT'}
          </span>
        </button>
      </div>

      {feedback && (
        <div className={clsx('trading-feedback', feedback.type)}>
          <Flippy maxLen={24} target={feedback.message.toUpperCase()} percent={0.0} />
        </div>
      )}
    </div>
  );
};

export default TradingPanel;
