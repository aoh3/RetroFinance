import { useEffect, useMemo, useState } from 'react';

const DEFAULT_INTERVAL_MS = 10000;

const normaliseSymbols = (symbols) => {
  if (!symbols) {
    return [];
  }

  return [...new Set(symbols)]
    .map((symbol) => symbol?.toUpperCase()?.trim())
    .filter(Boolean);
};

const useStockData = (symbols, refreshMs = DEFAULT_INTERVAL_MS) => {
  const [quotes, setQuotes] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const preparedSymbols = useMemo(() => normaliseSymbols(symbols), [symbols]);
  const queryKey = preparedSymbols.join(',');

  useEffect(() => {
    if (preparedSymbols.length === 0) {
      setQuotes({});
      setStatus('idle');
      setError(null);
      return () => undefined;
    }

  let isMounted = true;
  let retryTimeout;

    const fetchQuotes = async () => {
      try {
        const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(queryKey)}`);

        if (!response.ok) {
          throw new Error(`Quote request failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('Quote response payload is not an array.');
        }

        if (isMounted) {
          const nextQuotes = {};
          payload.forEach((quote) => {
            if (quote?.symbol) {
              nextQuotes[quote.symbol] = quote;
            }
          });
          setQuotes(nextQuotes);
          setStatus('success');
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching quotes:', err);
        if (isMounted) {
          setError(err);
          setStatus('error');
          retryTimeout = setTimeout(fetchQuotes, 5000);
        }
      }
    };

    setStatus((prev) => (prev === 'success' ? prev : 'loading'));
    fetchQuotes();
    const intervalId = setInterval(fetchQuotes, refreshMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [preparedSymbols, queryKey, refreshMs]);

  return { quotes, status, error };
};

export default useStockData;