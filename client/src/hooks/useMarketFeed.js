import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const MarketContext = createContext(null);

let socketInstance;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io('/', {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socketInstance;
};

const normaliseSymbols = (symbols) => {
  if (!symbols) {
    return [];
  }

  const list = Array.isArray(symbols) ? symbols : String(symbols).split(',');
  return [...new Set(list.map((symbol) => symbol?.toUpperCase()?.trim()).filter(Boolean))];
};

export const MarketProvider = ({ symbols, children }) => {
  const [quotes, setQuotes] = useState({});
  const [status, setStatus] = useState('idle');
  const uniqueSymbols = useMemo(() => normaliseSymbols(symbols), [symbols]);
  const symbolsKey = uniqueSymbols.join(',');

  useEffect(() => {
    const socket = getSocket();

    const handleUpdate = (quote) => {
      setQuotes((prev) => ({
        ...prev,
        [quote.symbol]: {
          ...(prev[quote.symbol] || {}),
          ...quote,
          lastUpdate: Date.now(),
        },
      }));
      setStatus('live');
    };

    const handleError = () => {
      setStatus('error');
    };

    const primeFromRest = async (attempts = 3, backoff = 300) => {
      if (!uniqueSymbols.length) {
        return;
      }

      const params = new URLSearchParams();
      params.set('symbols', symbolsKey);

      for (let i = 0; i < attempts; i += 1) {
        try {
          const response = await fetch(`/api/market/quotes?${params.toString()}`);
          if (!response.ok) {
            throw new Error(`REST prime HTTP ${response.status}`);
          }
          const payload = await response.json();
          if (payload?.length) {
            setQuotes((prev) => {
              const next = { ...prev };
              payload.forEach((quote) => {
                if (!quote?.symbol) return;
                next[quote.symbol] = {
                  ...(next[quote.symbol] || {}),
                  ...quote,
                  lastUpdate: Date.now(),
                };
              });
              return next;
            });
            setStatus('live');
            return;
          }

          // empty payload: retry after backoff
          if (i < attempts - 1) {
            // exponential backoff
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, backoff * Math.pow(2, i)));
            continue;
          }

          // if we've exhausted attempts and still empty, leave gracefully
          console.warn('primeFromRest: empty snapshot after retries');
          return;
        } catch (error) {
          console.error('primeFromRest failed (attempt', i + 1, '):', error);
          if (i < attempts - 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, backoff * Math.pow(2, i)));
            continue;
          }
          return;
        }
      }
    };

    socket.on('quotes:update', handleUpdate);
    socket.on('quotes:error', handleError);

    if (!uniqueSymbols.length) {
      setStatus('idle');
      if (socket.connected) {
        socket.disconnect();
      }
      return () => {
        socket.off('quotes:update', handleUpdate);
        socket.off('quotes:error', handleError);
      };
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('subscribe:quotes', { symbols: uniqueSymbols });
    setStatus('connecting');
    primeFromRest();

    return () => {
      socket.off('quotes:update', handleUpdate);
      socket.off('quotes:error', handleError);
      socket.emit('unsubscribe:quotes', { symbols: uniqueSymbols });
    };
  }, [symbolsKey, uniqueSymbols]);

  const value = useMemo(() => ({ quotes, status }), [quotes, status]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export const useMarketContext = () => {
  const ctx = useContext(MarketContext);
  if (!ctx) {
    throw new Error('useMarketContext must be used within MarketProvider');
  }
  return ctx;
};

export const useQuoteMap = () => useMarketContext().quotes;

export const useQuotes = (symbols) => {
  const { quotes } = useMarketContext();
  const unique = useMemo(() => normaliseSymbols(symbols), [symbols]);

  return useMemo(() => {
    if (unique.length === 0) {
      return [];
    }

    return unique.map((symbol) => quotes[symbol] || { symbol });
  }, [unique, quotes]);
};

export const useQuote = (symbol) => {
  const { quotes } = useMarketContext();
  const normalised = useMemo(() => normaliseSymbols(symbol)[0] || null, [symbol]);
  return normalised ? quotes[normalised] || { symbol: normalised } : null;
};

export const useMarketStatus = () => useMarketContext().status;
