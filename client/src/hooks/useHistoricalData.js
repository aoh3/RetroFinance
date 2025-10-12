import { useQuery } from '@tanstack/react-query';

const fetchHistory = async ({ queryKey }) => {
  const [_key, symbol, params] = queryKey;
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/market/history/${symbol}?${query}`);

  if (!response.ok) {
    throw new Error('Unable to retrieve price history');
  }

  return response.json();
};

const useHistoricalData = (symbol, options = {}) => {
  const { range = '1d', interval = '5m' } = options;
  return useQuery({
    queryKey: ['history', symbol, { range, interval }],
    queryFn: fetchHistory,
    enabled: Boolean(symbol),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
};

export default useHistoricalData;
