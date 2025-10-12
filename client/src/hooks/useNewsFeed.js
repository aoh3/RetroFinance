import { useQuery } from '@tanstack/react-query';

const fetchNews = async ({ queryKey }) => {
  const [_key, symbolsKey] = queryKey;
  const response = await fetch(`/api/market/news?symbols=${encodeURIComponent(symbolsKey)}`);

  if (!response.ok) {
    throw new Error('Unable to retrieve news');
  }

  return response.json();
};

const useNewsFeed = (symbols, options = {}) => {
  const unique = Array.from(new Set((symbols || []).map((symbol) => symbol?.toUpperCase()?.trim()).filter(Boolean)));
  const symbolsKey = unique.join(',');
  const { refetchInterval = 120_000 } = options;

  return useQuery({
    queryKey: ['news', symbolsKey],
    queryFn: fetchNews,
    enabled: unique.length > 0,
    refetchInterval,
    refetchOnWindowFocus: false,
  });
};

export default useNewsFeed;
