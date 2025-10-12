import React, { useMemo, useState, useEffect } from 'react'; // ensure useMemo, useState imported
import clsx from 'clsx';
import './Flipboard.css';
import SplitFlapText from './splitflap/SplitFlapText';
import TileGraph from './TileGraph';
import RollingHeadline from './RollingHeadline';
import TradingPanel from './TradingPanel';
import { MarketProvider, useMarketStatus, useQuote } from '../hooks/useMarketFeed';
import useHistoricalData from '../hooks/useHistoricalData';
import useNewsFeed from '../hooks/useNewsFeed';
import { useAlpacaAccount, useAlpacaGetQuotes } from '../hooks/useAlpaca';
import Flippy from './Flippy';

const WATCHLIST_SYMBOLS = ['AAPL', 'GOOG', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];
const ACCOUNT_ROWS = [
  { label: 'EQUITY', field: 'portfolio_value' },
  { label: 'CASH', field: 'cash' },
  { label: 'BUY POWER', field: 'buying_power' },
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
        {Object.entries(quotes).map(([symbol, snap], index) => (
          <button
            key={symbol}
            type="button"
            className={clsx('board-row', { selected: selectedSymbol === symbol })}
            onClick={() => onSelect(symbol)}
          >
            <Flippy
              maxLen={19}
              target={`${symbol} $${snap.LatestTrade.Price.toFixed(2)} ${(((snap.LatestTrade.Price - snap.PrevDailyBar.ClosePrice) / snap.PrevDailyBar.ClosePrice) * 100).toFixed(2)}%`}
            />
          </button>
        ))}
      </div>
    </section>
  );
};

const AccountsPanel = () => {
  const { data, error } = useAlpacaAccount();
  const tone = (value) => (value >= 0 ? 'up' : 'down');

  return (
    <section className="board-section accounts" aria-label="Accounts">
      <SplitFlapText value="ACCOUNTS" padTo={18} align="center" />
      <div className="board-rows" role="list">
        {ACCOUNT_ROWS.map((row, index) => {
          const raw = data ? Number(data[row.field]) : null;
          return (
            <div className="board-row" key={row.field}>
              <SplitFlapText value={row.label} padTo={12} size="sm" baseDelay={index * 60} />
              <SplitFlapText
                value={raw === null || Number.isNaN(raw) ? '---' : `$${raw.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                padTo={16}
                size="sm"
                align="right"
                tone={raw === null || Number.isNaN(raw) ? 'neutral' : tone(raw)}
                baseDelay={index * 60}
              />
            </div>
          );
        })}
      </div>
      {error && (
        <SplitFlapText value="ALPACA OFFLINE" padTo={18} align="center" tone="warning" size="sm" />
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

const NewsPanel = ({ symbols }) => {
  const { data } = useNewsFeed(symbols, { refetchInterval: 180_000 });

  return (
    <section className="board-section news" aria-label="News">
      <SplitFlapText value="NEWS" padTo={18} align="center" />
      <div className="board-rows" role="list">
        {(data || []).slice(0, 6).map((item, index) => (
          <RollingHeadline
            key={item.id || `${item.symbol}-${index}`}
            text={`${item.symbol || ''} ${item.title || ''}`}
            width={34}
            baseDelay={index * 90}
            tone="neutral"
          />
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
            <SplitFlapText value="TRADE" padTo={12} align="center" />
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