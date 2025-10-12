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

    const primeFromRest = async () => {
      if (!uniqueSymbols.length) {
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('symbols', symbolsKey);
        const response = await fetch(`/api/market/quotes?${params.toString()}`);
        if (!response.ok) {
          throw new Error('REST quote prime failed');
        }
        const payload = await response.json();
        setQuotes((prev) => {
          const next = { ...prev };
          (payload || []).forEach((quote) => {
            if (!quote?.symbol) {
              return;
            }
            next[quote.symbol] = {
              ...(next[quote.symbol] || {}),
              ...quote,
              lastUpdate: Date.now(),
            };
          });
          return next;
        });
        if (payload?.length) {
          setStatus('live');
        }
      } catch (error) {
        console.error('Failed to prime quotes from REST API:', error);
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
