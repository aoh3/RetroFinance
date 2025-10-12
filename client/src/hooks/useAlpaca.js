import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const getJson = async (path, options) => {
  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }
  return response.json();
};

export const useAlpacaAccount = () =>
  useQuery({
    queryKey: ['alpaca', 'account'],
    queryFn: () => getJson('/api/alpaca/account'),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useAlpacaPositions = () =>
  useQuery({
    queryKey: ['alpaca', 'positions'],
    queryFn: () => getJson('/api/alpaca/positions'),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

export const useAlpacaOrders = (params = {}) =>
  useQuery({
    queryKey: ['alpaca', 'orders', params],
    queryFn: () =>
      getJson(`/api/alpaca/orders?status=${encodeURIComponent(params.status || 'all')}&limit=${encodeURIComponent(params.limit || 25)}`),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

export const useAlpacaOrderPlacement = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      getJson('/api/alpaca/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['alpaca', 'account'] });
      client.invalidateQueries({ queryKey: ['alpaca', 'positions'] });
      client.invalidateQueries({ queryKey: ['alpaca', 'orders'] });
    },
  });
};

export const useAlpacaGetQuotes = (symbols = []) =>
  useQuery({
    queryKey: ['alpaca', 'quotes', symbols],
    queryFn: async () => {
      const data = await getJson(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
      return data;
    },
    enabled: symbols.length > 0,
  });
