import React, { useMemo, useState, useEffect } from 'react'; // ensure useMemo, useState imported
import clsx from 'clsx';
import './Flipboard.css';
import SplitFlapText from './splitflap/SplitFlapText';
import TileGraph from './TileGraph';
import RollingHeadline from './RollingHeadline';
import TradingPanel from './TradingPanel';
import { MarketProvider, useQuote } from '../hooks/useMarketFeed';
import useHistoricalData from '../hooks/useHistoricalData';
import { useQuery } from '@tanstack/react-query';
// import real-time hook removed; use REST-based useNewsFeed instead
import { useAlpacaAccount, useAlpacaGetQuotes } from '../hooks/useAlpaca';
import Flippy from './Flippy';

const WATCHLIST_SYMBOLS = ['AAPL', 'GOOG', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];
const ACCOUNT_ROWS = [
  { label: 'EQUITY', field: 'portfolio_value' },
  { label: 'CASH', field: 'cash' },
  { label: 'RT IRA', field: 'buying_power' },
  { label: '401K', field: 'effective_buying_power' }
];

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

const toneForChange = (value) => {
  if (value === undefined || value === null) {
    return 'neutral';
  }

  if (value > 0) {
    return 'up';
  }

  if (value < 0) {
    return 'down';
  }

  return 'neutral';
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
        {Object.entries(displayQuotes).map(([symbol, snap]) => (
          <button
            key={symbol}
            type="button"
            className={clsx('board-row', { selected: selectedSymbol === symbol })}
            onClick={() => onSelect(symbol)}
          >
            {/* Symbol column */}
            <Flippy maxLen={symbol.length} target={symbol} />
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
              <Flippy maxLen={row.label.length} target={row.label} />
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
  const { data } = useHistoricalData(symbol, { range: '1d', interval: '5m' });
  const quote = useQuote(symbol);

  const series = useMemo(() => {
    if (!data?.bars || data.bars.length === 0) {
      return [];
    }

    return data.bars
      .map((bar) => {
        const rawTime = bar.t || bar.time || bar.Timestamp || bar.start || bar.end;
        const time = rawTime ? new Date(rawTime).getTime() : Date.now();
        return {
          time,
          close: Number(bar.c ?? bar.close ?? bar.end_price ?? bar.Close ?? null),
        };
      })
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.close))
      .sort((a, b) => a.time - b.time);
  }, [data]);

  return (
    <section className="board-section graph" aria-label="Price history">
      <div className="graph-header">
        <SplitFlapText value={`${symbol || '-----'} BALANCE`} padTo={20} size="sm" />
        <SplitFlapText
          value={formatPrice(quote?.price)}
          padTo={12}
          size="sm"
          align="right"
          tone={toneForChange(quote?.change)}
        />
      </div>
      <TileGraph data={series} />
      <div className="graph-footer">
        <SplitFlapText
          value={formatPercent(quote?.changePercent)}
          padTo={10}
          size="sm"
          tone={toneForChange(quote?.changePercent)}
        />
        <SplitFlapText
          value={`VOL ${quote?.volume ? quote.volume.toLocaleString() : '---'}`}
          padTo={16}
          size="sm"
          align="right"
        />
      </div>
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

  return (
    <section className="board-section news" aria-label="News">
  <Flippy maxLen={12} target="    NEWS    " />
      <div className="board-rows" role="list">
        {items.map((item, index) => (
          <Flippy maxLen={4} target={item.symbol || '----'} key={index} />
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