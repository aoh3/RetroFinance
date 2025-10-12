import React, { useMemo, useState, useEffect } from 'react'; // ensure useMemo, useState imported
import clsx from 'clsx';
import './Flipboard.css';
import TileGraph from './TileGraph';
import TradingPanel from './TradingPanel';
import { MarketProvider, useQuote } from '../hooks/useMarketFeed';
import { useQuery } from '@tanstack/react-query';
// import real-time hook removed; use REST-based useNewsFeed instead
import { useAlpacaAccount, useAlpacaGetBars, useAlpacaGetQuotes } from '../hooks/useAlpaca';
import Flippy from './Flippy';

let WATCHLIST_SYMBOLS = ['AAPL', 'GOOG', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];
const ACCOUNT_ROWS = [
  { label: 'EQUITY', field: 'portfolio_value' },
  { label: 'CASH', field: 'cash' },
  { label: 'RT IRA', field: 'buying_power' },
  { label: '401K', field: 'effective_buying_power' }
];

const fullJustify = (text, maxWidth) => {
  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let lineWords = [];
  let numLetters = 0;

  for (const w of words) {
    if (numLetters + lineWords.length + w.length > maxWidth) {
      let line = lineWords.join(' ');
      line += ' '.repeat(maxWidth - line.length);
      lines.push(line);
      lineWords = [w];
      numLetters = w.length;
    } else {
      lineWords.push(w);
      numLetters += w.length;
    }
  }
  if (lineWords.length > 0) {
    let line = lineWords.join(' ');
    line += ' '.repeat(maxWidth - line.length);
    lines.push(line);
  }
  return lines;
};

const formatPrice = (value) => {
  if (value === undefined || value === null) {
    return '---';
  }
  return `$${Number(value).toFixed(2)}`;
};

const formatPercent = (value) => {
  if (value === undefined || value === null) {
    return '---';
  }

  const numeric = Number(value);
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(2)}%`;
};

const WatchlistPanel = ({ symbols, onSelect, selectedSymbol }) => {
  // fetch quotes as dictionary keyed by symbol
  const { data: quotes = {}, isLoading, error } = useAlpacaGetQuotes(symbols);
    // local state for simulated price updates
  const [displayQuotes, setDisplayQuotes] = useState({});

  // initialize displayQuotes when data arrives, seed PrevTradePrice
  useEffect(() => {
    if (quotes && Object.keys(quotes).length) {
      const initial = {};
      Object.entries(quotes).forEach(([sym, snap]) => {
        // keep original trade price for clamping
        initial[sym] = { ...snap, BasePrice: snap.LatestTrade.Price };
      });
      setDisplayQuotes(initial);
    }
  }, [quotes]);

  // randomly adjust price by ±0.3–1% every 10s based on last trade price
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayQuotes((prev) => {
        const next = {};
        Object.entries(prev).forEach(([sym, snap]) => {
          const oldPrice = snap.LatestTrade?.Price;
          if (oldPrice != null) {
            const pct = (Math.random() * (2 - 0.3) + 0.3) / 100;
            const dir = Math.random() < 0.5 ? -1 : 1;
            let newPrice = oldPrice * (1 + dir * pct);
            // clamp to ±3% of original BasePrice
            const base = snap.BasePrice ?? oldPrice;
            const minPrice = base * 0.97;
            const maxPrice = base * 1.03;
            newPrice = Math.min(Math.max(newPrice, minPrice), maxPrice);
            next[sym] = { ...snap, LatestTrade: { Price: newPrice } };
          } else {
            next[sym] = snap;
          }
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // sort symbols by change percentage (highest gain first)
  const sortedEntries = useMemo(() => {
    return Object.entries(displayQuotes).sort(([, a], [, b]) => {
      const aPct = a.PrevDailyBar.ClosePrice
        ? (a.LatestTrade.Price - a.PrevDailyBar.ClosePrice) / a.PrevDailyBar.ClosePrice
        : 0;
      const bPct = b.PrevDailyBar.ClosePrice
        ? (b.LatestTrade.Price - b.PrevDailyBar.ClosePrice) / b.PrevDailyBar.ClosePrice
        : 0;
      return bPct - aPct;
    });
  }, [displayQuotes]);

  return (
    <section className="board-section watchlist" aria-label="Watchlist">
      <div className="board-header">
        <Flippy maxLen={9} target={"WATCHLIST"} />      
      </div>
      <div className="board-columns">
        <Flippy maxLen={3} target={"SYM"} />
        <Flippy maxLen={5} target={"PRICE"} />
        <Flippy maxLen={4} target={"CHG%"} />
      </div>
      <div className="board-rows" role="list">
        {sortedEntries.slice(0, 8).map(([symbol, snap], idx) => (
          <button
            key={idx}
            type="button"
            className={clsx('board-row', { selected: selectedSymbol === symbol })}
            onClick={() => onSelect(symbol)}
          >
            {/* Symbol column */}
            <Flippy maxLen={4} target={symbol} />
            {/* Price column */}
            <Flippy maxLen={7} target={formatPrice(snap.LatestTrade.Price)} />
            {/* Change % column (relative to daily close) */}
            <Flippy
              maxLen={6}
              target={formatPercent(
                ((snap.LatestTrade.Price - snap.PrevDailyBar.ClosePrice) /
                  snap.PrevDailyBar.ClosePrice) *
                  100
              )}
              percent={((snap.LatestTrade.Price - snap.PrevDailyBar.ClosePrice) /
                  snap.PrevDailyBar.ClosePrice) *
                  100}
            />
          </button>
        ))}
      </div>
    </section>
  );
};

const AccountsPanel = () => {
  const { data, error } = useAlpacaAccount();
  // override these values once account data loads
  const account = data
    ? { ...data, buying_power: 12543.4, effective_buying_power: 34200.12 }
    : null;

  return (
    <section className="board-section accounts" aria-label="Accounts">
      <Flippy maxLen={8} target={"ACCOUNTS"} /> 
      <div className="board-rows" role="list">
        {ACCOUNT_ROWS.map((row, index) => {
          const raw = account ? Number(account[row.field]) : null;
          return (
            <div className="board-row" key={row.field}>
              <Flippy maxLen={Math.max(row.label.length, 6)} target={row.label} />
              <Flippy maxLen={12} target={" ".repeat(12 - formatPrice(raw).length) + formatPrice(raw)} />
            </div>
          );
        })}
      </div>
      {error && (
        <Flippy maxLen={18} target={"ALPACA OFFLINE"} />
      )}
    </section>
  );
};

const GraphPanel = ({ symbol }) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const { data } = useAlpacaGetBars(symbol, {
    interval: '1d',
    start: thirtyDaysAgo,
    end: today
  });
  const quote = useQuote(symbol);

  // transform raw bars to simplified open/close series
  const series = useMemo(() => {
    if (!data?.bars) {
      return [];
    }
    const rawBars = Array.isArray(data.bars)
      ? data.bars
      : data.bars[symbol] || [];
    return rawBars.map((bar) => ({
      open: Number(bar.o),
      close: Number(bar.c),
    }));
  }, [data, symbol]);

  return (
    <section className="board-section graph" aria-label="Price history">
      <div className="board-header">
        <Flippy maxLen={13} target={"STOCK HISTORY"} />      
      </div>
      <TileGraph data={series} rows={8} columns={16} />
    </section>
  );
};

const NewsPanel = () => {
  // fetch latest global news and take top 5
  const { data: news = [] } = useQuery({
    queryKey: ['news', 'global'],
    queryFn: async () => {
      const resp = await fetch('/api/market/news');
      if (!resp.ok) throw new Error('Unable to retrieve news');
      return resp.json();
    },
    refetchInterval: 180_000,
    refetchOnWindowFocus: false,
  });
  const items = news.slice(0, 5);
  let itemLines = items.map(item => fullJustify(item.title.toUpperCase(), 25).slice(0, 3));

  return (
    <section className="board-section news" aria-label="News">
  <Flippy maxLen={10} target="   NEWS   " />
      <div className="board-rows" role="list">
        {items.map((item, index) => (
        <div>
          <div style={{ width: '30%' }}>
            <Flippy maxLen={4} target={item.symbol || '----'} />
          </div>
          {itemLines[index].length > 0 ? (
            itemLines[index].map((line) => (
              <Flippy 
                maxLen={23}
                target={line}
              />
            ))
          ) : (
            <Flippy maxLen={23} target="NO HEADLINE FOUND" />
          )}
        </div>
        ))}
      </div>
    </section>
  );
};

const Flipboard = () => {
  const [selectedSymbol, setSelectedSymbol] = useState(WATCHLIST_SYMBOLS[0]);
  const symbolUniverse = useMemo(
    () => Array.from(new Set([...WATCHLIST_SYMBOLS, selectedSymbol].filter(Boolean))),
    [selectedSymbol]
  );

  return (
    <MarketProvider symbols={symbolUniverse}>
      <div className="flipboard" role="application" aria-label="Retro finance board">
        <div className="board-grid">
          <WatchlistPanel
            symbols={WATCHLIST_SYMBOLS}
            onSelect={setSelectedSymbol}
            selectedSymbol={selectedSymbol}
          />
          <GraphPanel symbol={selectedSymbol} />
          <NewsPanel symbols={WATCHLIST_SYMBOLS} />
          <AccountsPanel />
          <section className="board-section trading" aria-label="Trading controls">
            <Flippy target="    TRADE" maxLen={13} />
            <TradingPanel
              symbols={WATCHLIST_SYMBOLS}
              selectedSymbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />
          </section>
        </div>
      </div>
    </MarketProvider>
  );
};

export default Flipboard;