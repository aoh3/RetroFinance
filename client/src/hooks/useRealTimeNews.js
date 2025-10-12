import { useState, useEffect } from 'react';

/**
 * Hook to subscribe to Alpaca real-time news via WebSocket.
 * Returns the latest up to N news articles (default 5).
 */
const useRealTimeNews = (symbols = [], maxItems = 5) => {
  const [news, setNews] = useState([]);

  useEffect(() => {
    const unique = Array.from(
      new Set(symbols.map((s) => s?.toUpperCase()?.trim()).filter(Boolean))
    );
    if (!unique.length) return;

    // Alpaca news stream URL (beta endpoint)
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const streamUrl = `${protocol}://stream.data.alpaca.markets/v1beta1/news`;
    const ws = new WebSocket(streamUrl);

    ws.onopen = () => {
      // authenticate (if needed) then subscribe
      const authMsg = {
        action: 'auth',
        key: process.env.REACT_APP_ALPACA_KEY_ID,
        secret: process.env.REACT_APP_ALPACA_SECRET_KEY,
      };
      ws.send(JSON.stringify(authMsg));
      const subMsg = {
        action: 'subscribe',
        symbol: unique,
      };
      ws.send(JSON.stringify(subMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // push newest to front and cap
        setNews((prev) => {
          const next = [msg, ...prev];
          return next.slice(0, maxItems);
        });
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = (err) => {
      console.error('Realtime news websocket error', err);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbols.join(',')]);

  return news;
};

export default useRealTimeNews;
