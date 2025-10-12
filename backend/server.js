const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Alpaca = require('@alpacahq/alpaca-trade-api');
require('dotenv').config();

const PORT = Number(process.env.PORT || 5000);
const MAX_NEWS_PER_SYMBOL = Number(process.env.MAX_NEWS_PER_SYMBOL || 4);
const DEFAULT_HISTORY_RANGE = process.env.DEFAULT_HISTORY_RANGE || '1d';
const DEFAULT_HISTORY_INTERVAL = process.env.DEFAULT_HISTORY_INTERVAL || '5m';
const ALPACA_KEY_ID = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
let fetchClient;
const getFetch = async () => {
	if (fetchClient) {
		return fetchClient;
	}

	if (typeof fetch === 'function') {
		fetchClient = fetch.bind(globalThis);
		return fetchClient;
	}

	const { default: nodeFetch } = await import('node-fetch');
	fetchClient = nodeFetch;
	return fetchClient;
};

const callAlpacaData = async (path, params = {}) => {
	if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) {
		throw new Error('Alpaca credentials are not configured.');
	}

	const url = new URL(path, 'https://data.alpaca.markets');
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			url.searchParams.set(key, value);
		}
	});

	const fetchImpl = await getFetch();
	const response = await fetchImpl(url.toString(), {
		headers: {
			'APCA-API-KEY-ID': ALPACA_KEY_ID,
			'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Alpaca data API ${response.status}: ${text || 'Unknown error'}`);
	}

	return response.json();
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*',
	},
});

app.use(cors());
app.use(express.json());

const normaliseSymbols = (symbols) => {
	if (!symbols) {
		return [];
	}

	const input = Array.isArray(symbols) ? symbols : String(symbols).split(',');
	return [...new Set(input.map((symbol) => symbol?.toUpperCase()?.trim()).filter(Boolean))];
};

const symbolSubscriptions = new Map(); // symbol -> Set(socketId)
const socketSubscriptions = new Map(); // socketId -> Set(symbol)
const symbolState = new Map(); // symbol -> state snapshot for change calculations

const parseTimestamp = (value) => {
	if (!value) {
		return Date.now();
	}

	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? Date.now() : parsed;
};

const timeframeMap = new Map([
	['1m', '1Min'],
	['5m', '5Min'],
	['15m', '15Min'],
	['30m', '30Min'],
	['1h', '1Hour'],
	['4h', '4Hour'],
	['1d', '1Day'],
	['1wk', '1Week'],
	['1mo', '1Month'],
]);

const subtractFromNow = (range) => {
	const now = new Date();
	switch (range) {
		case '1d':
			return new Date(now.getTime() - 24 * 60 * 60 * 1000);
		case '5d':
			return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
		case '1mo':
			return new Date(now.setMonth(now.getMonth() - 1));
		case '3mo':
			return new Date(now.setMonth(now.getMonth() - 3));
		case '6mo':
			return new Date(now.setMonth(now.getMonth() - 6));
		case '1y':
			return new Date(now.setFullYear(now.getFullYear() - 1));
		default:
			return new Date(now.getTime() - 24 * 60 * 60 * 1000);
	}
};

const ensureAlpacaClient = () => {
	const keyId = process.env.ALPACA_KEY_ID;
	const secretKey = process.env.ALPACA_SECRET_KEY;
	if (!keyId || !secretKey) {
		return null;
	}

	return new Alpaca({
		keyId,
		secretKey,
		paper: process.env.ALPACA_PAPER !== 'false',
		data_stream_v2: true,
	});
};

const alpacaClient = ensureAlpacaClient();

const assertAlpacaConfigured = (res) => {
	if (!alpacaClient) {
		res.status(503).json({ message: 'Alpaca integration is not configured. Provide ALPACA_KEY_ID and ALPACA_SECRET_KEY.' });
		return false;
	}
	return true;
};

let alpacaStream = null;
let alpacaStreamConnected = false;
let alpacaStreamConnecting = null;
const activeStreamSymbols = new Set();

const getAlpacaStream = () => {
	if (!alpacaClient) {
		return null;
	}

	if (!alpacaStream) {
		alpacaStream = alpacaClient.data_stream_v2;
		alpacaStream.onConnect(() => {
			alpacaStreamConnected = true;
			syncStreamSubscriptions().catch((error) => {
				console.error('Failed to resync Alpaca stream after connect:', error);
			});
		});
		alpacaStream.onDisconnect(() => {
			alpacaStreamConnected = false;
			activeStreamSymbols.clear();
		});
		alpacaStream.onError((error) => {
			console.error('Alpaca data stream error:', error);
		});
		alpacaStream.onStockTrades((trade) => {
			handleTradeUpdate(trade);
		});
	}

	return alpacaStream;
};

const connectAlpacaStream = async () => {
	const stream = getAlpacaStream();
	if (!stream) {
		return null;
	}

	if (alpacaStreamConnected) {
		return stream;
	}

	if (!alpacaStreamConnecting) {
		alpacaStreamConnecting = stream
			.connect()
			.catch((error) => {
				console.error('Failed to connect Alpaca data stream:', error);
				symbolSubscriptions.forEach((sockets) => {
					sockets.forEach((socketId) => {
						io.to(socketId).emit('quotes:error', { message: 'Alpaca data stream connection failed.' });
					});
				});
			})
			.finally(() => {
				alpacaStreamConnecting = null;
			});
	}

	await alpacaStreamConnecting;
	return alpacaStreamConnected ? stream : null;
};

const buildQuoteFromState = (symbol) => {
	const state = symbolState.get(symbol);
	if (!state) {
		return null;
	}

	const price = state.lastPrice ?? state.open ?? null;
	const open = state.open ?? null;
	const change = price !== null && open !== null ? price - open : null;
	const changePercent = change !== null && open ? (change / open) * 100 : null;

	return {
		symbol,
		description: state.description || symbol,
		currency: 'USD',
		price,
		change,
		changePercent,
		previousClose: state.previousClose ?? null,
		open,
		high: state.high ?? price ?? null,
		low: state.low ?? price ?? null,
		volume: state.volume ?? null,
		marketState: state.marketState || 'OPEN',
		gmtTimestamp: state.lastTimestamp ?? null,
	};
};

const broadcastSymbolUpdate = (symbol) => {
	const payload = buildQuoteFromState(symbol);
	if (!payload) {
		return;
	}

	const sockets = symbolSubscriptions.get(symbol);
	if (!sockets) {
		return;
	}

	sockets.forEach((socketId) => {
		io.to(socketId).emit('quotes:update', payload);
	});
};

const ingestSnapshot = (symbol, snapshot) => {
	if (!snapshot) {
		return null;
	}

	const dailyBar = snapshot.dailyBar || {};
	const prevDailyBar = snapshot.prevDailyBar || {};
	const latestTrade = snapshot.latestTrade || {};
	const latestQuote = snapshot.latestQuote || {};

	const price = latestTrade.p ?? latestQuote.ap ?? latestQuote.bp ?? dailyBar.c ?? prevDailyBar.c ?? null;
	const open = dailyBar.o ?? prevDailyBar.c ?? price ?? null;
	const marketState = snapshot.tradingStatus?.status ? String(snapshot.tradingStatus.status).toUpperCase() : 'OPEN';

	const nextState = {
		symbol,
		lastPrice: price ?? null,
		open,
		high: dailyBar.h ?? price ?? null,
		low: dailyBar.l ?? price ?? null,
		volume: dailyBar.v ?? latestTrade.s ?? null,
		previousClose: prevDailyBar.c ?? null,
		marketState,
		lastTimestamp: parseTimestamp(latestTrade.t),
		description: snapshot.symbol || snapshot.symbolName || symbol,
	};

	const previous = symbolState.get(symbol) || {};
	symbolState.set(symbol, { ...previous, ...nextState });
	return buildQuoteFromState(symbol);
};

const fetchAlpacaSnapshots = async (symbols) => {
	if (!alpacaClient || symbols.length === 0) {
		return {};
	}

	const response = await alpacaClient.getSnapshots(symbols);
	return response || {};
};

const primeSocketWithSnapshot = async (socket, symbols) => {
	if (!symbols.length) {
		return;
	}

	if (!alpacaClient) {
		socket.emit('quotes:error', { message: 'Alpaca integration is not configured on the server.' });
		return;
	}

	try {
		const snapshots = await fetchAlpacaSnapshots(symbols);
		symbols.forEach((symbol) => {
			const snapshot = snapshots[symbol] || snapshots[symbol.toUpperCase()];
			const payload = ingestSnapshot(symbol, snapshot);
			if (payload) {
				socket.emit('quotes:update', payload);
			}
		});
	} catch (error) {
		console.error('Snapshot fetch failed:', error);
		socket.emit('quotes:error', { message: 'Failed to retrieve Alpaca snapshot.' });
	}
};

const handleTradeUpdate = (trade) => {
	const symbol = trade?.S || trade?.symbol;
	if (!symbol) {
		return;
	}

	const price = trade.p ?? trade.price ?? null;
	if (price === null) {
		return;
	}

	const size = trade.s ?? trade.size ?? 0;
	const timestamp = parseTimestamp(trade.t);

	const previous = symbolState.get(symbol) || {};
	const open = previous.open ?? price;
	const nextState = {
		...previous,
		symbol,
		open,
		lastPrice: price,
		high: previous.high ? Math.max(previous.high, price) : price,
		low: previous.low ? Math.min(previous.low, price) : price,
		volume: (previous.volume ?? 0) + size,
		lastTimestamp: timestamp,
	};

	symbolState.set(symbol, nextState);
	broadcastSymbolUpdate(symbol);
};

const syncStreamSubscriptions = async () => {
	if (!alpacaClient) {
		return;
	}

	const currentSymbols = [...symbolSubscriptions.keys()];
	if (currentSymbols.length === 0) {
		if (alpacaStreamConnected && alpacaStream) {
			try {
				await alpacaStream.disconnect();
			} catch (error) {
				console.error('Failed to disconnect Alpaca stream:', error);
			}
			alpacaStreamConnected = false;
		}
		activeStreamSymbols.clear();
		return;
	}

	const stream = await connectAlpacaStream();
	if (!stream) {
		return;
	}

	const toSubscribe = currentSymbols.filter((symbol) => !activeStreamSymbols.has(symbol));
	const toUnsubscribe = [...activeStreamSymbols].filter((symbol) => !symbolSubscriptions.has(symbol));

	if (toSubscribe.length) {
		try {
			await stream.subscribeForTrades(toSubscribe);
			toSubscribe.forEach((symbol) => activeStreamSymbols.add(symbol));
		} catch (error) {
			console.error('Failed to subscribe to Alpaca trades:', error);
		}
	}

	if (toUnsubscribe.length) {
		try {
			await stream.unsubscribeFromTrades(toUnsubscribe);
		} catch (error) {
			console.error('Failed to unsubscribe from Alpaca trades:', error);
		}
		toUnsubscribe.forEach((symbol) => activeStreamSymbols.delete(symbol));
	}
};

io.on('connection', (socket) => {
	console.log(`Socket connected: ${socket.id}`);

	const updateSubscriptions = async (symbols) => {
		const normalised = normaliseSymbols(symbols);
		const previous = socketSubscriptions.get(socket.id) || new Set();

		// Remove stale subscriptions
		previous.forEach((symbol) => {
			if (!normalised.includes(symbol)) {
				const subscribers = symbolSubscriptions.get(symbol);
				if (subscribers) {
					subscribers.delete(socket.id);
					if (subscribers.size === 0) {
						symbolSubscriptions.delete(symbol);
					}
				}
			}
		});

		if (!normalised.length) {
			socketSubscriptions.set(socket.id, new Set());
			await syncStreamSubscriptions();
			return;
		}

		if (!alpacaClient) {
			socket.emit('quotes:error', { message: 'Alpaca integration is not configured on the server.' });
			return;
		}

		const nextSet = new Set(normalised);
		normalised.forEach((symbol) => {
			if (!symbolSubscriptions.has(symbol)) {
				symbolSubscriptions.set(symbol, new Set());
			}
			symbolSubscriptions.get(symbol).add(socket.id);
		});

		socketSubscriptions.set(socket.id, nextSet);
		await syncStreamSubscriptions();
		await primeSocketWithSnapshot(socket, normalised);
	};

	socket.on('subscribe:quotes', (payload) => {
		updateSubscriptions(payload?.symbols ?? payload).catch((error) => {
			console.error('Failed to subscribe socket to symbols:', error);
			socket.emit('quotes:error', { message: 'Subscription failure.' });
		});
	});

	socket.on('unsubscribe:quotes', (payload) => {
		const targetSymbols = normaliseSymbols(payload?.symbols ?? payload);
		const existing = socketSubscriptions.get(socket.id);
		if (!existing || targetSymbols.length === 0) {
			return;
		}

		targetSymbols.forEach((symbol) => {
			existing.delete(symbol);
			const subscribers = symbolSubscriptions.get(symbol);
			if (subscribers) {
				subscribers.delete(socket.id);
				if (subscribers.size === 0) {
					symbolSubscriptions.delete(symbol);
				}
			}
		});

		if (existing.size === 0) {
			socketSubscriptions.delete(socket.id);
		}

		syncStreamSubscriptions().catch((error) => {
			console.error('Failed to synchronise Alpaca stream during unsubscribe:', error);
		});
	});

	socket.on('disconnect', () => {
		const subscribed = socketSubscriptions.get(socket.id);
		if (subscribed) {
			subscribed.forEach((symbol) => {
				const subscribers = symbolSubscriptions.get(symbol);
				if (subscribers) {
					subscribers.delete(socket.id);
					if (subscribers.size === 0) {
						symbolSubscriptions.delete(symbol);
					}
				}
			});
			socketSubscriptions.delete(socket.id);
			syncStreamSubscriptions().catch((error) => {
				console.error('Failed to synchronise Alpaca stream after disconnect:', error);
			});
		}
		console.log(`Socket disconnected: ${socket.id}`);
	});
});

const fetchHistorical = async (symbol, { range, interval }) => {
	const requestedRange = range || DEFAULT_HISTORY_RANGE;
	const requestedInterval = interval || DEFAULT_HISTORY_INTERVAL;
	const timeframe = timeframeMap.get(requestedInterval) || '5Min';
	const start = subtractFromNow(requestedRange).toISOString();

	const data = await callAlpacaData(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, {
		timeframe,
		start,
		limit: 600,
	});

	return {
		symbol: symbol.toUpperCase(),
		timeframe,
		range: requestedRange,
		bars: data.bars || [],
	};
};

const fetchNews = async (symbols) => {
	if (!symbols.length) {
		return [];
	}

	try {
		const payload = await callAlpacaData('/v1beta1/news', {
			symbols: symbols.join(','),
			limit: MAX_NEWS_PER_SYMBOL * symbols.length,
		});

		return (payload?.news || payload || [])
			.slice(0, MAX_NEWS_PER_SYMBOL * symbols.length)
			.map((item) => ({
				id: item.id || `${item.symbols?.[0] || 'NEWS'}-${item.created_at}`,
				title: item.headline || item.title,
				symbol: item.symbols?.[0] || symbols[0],
				summary: item.summary || null,
				publisher: item.source || item.author || null,
				link: item.url || null,
				publishedAt: item.created_at || item.updated_at || null,
			}))
			.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
	} catch (error) {
		console.error('Failed to fetch Alpaca news:', error);
		return [];
	}
};

app.get('/api/market/quotes', async (req, res) => {
	const symbols = normaliseSymbols(req.query.symbols);
	if (symbols.length === 0) {
		return res.status(400).json({ message: 'Query parameter "symbols" is required.' });
	}

	if (!assertAlpacaConfigured(res)) {
		return;
	}

	try {
		const snapshots = await fetchAlpacaSnapshots(symbols);
		const payload = symbols
			.map((symbol) => {
				const snapshot = snapshots[symbol] || snapshots[symbol.toUpperCase()];
				return ingestSnapshot(symbol, snapshot);
			})
			.filter(Boolean);

		if (!payload.length) {
			console.warn('No snapshots returned from Alpaca for symbols:', symbols, 'raw snapshots keys:', Object.keys(snapshots || {}));
		}
		res.json(payload);
	} catch (error) {
		console.error('Error retrieving Alpaca quotes:', error);
		res.status(502).json({ message: 'Failed to retrieve quotes from Alpaca.' });
	}
});

app.get('/api/market/trending', async (req, res) => {
	if (!assertAlpacaConfigured(res)) {
		return;
	}

	const limit = Number(req.query.limit || 10);
	try {
		const payload = await callAlpacaData('/v1beta1/news', {
			limit: Math.max(limit * 3, limit),
		});

		const seen = new Set();
		const trending = [];
		for (const item of payload?.news || payload || []) {
			for (const symbol of item.symbols || []) {
				if (typeof symbol === 'string') {
					const upper = symbol.toUpperCase();
					if (!seen.has(upper)) {
						seen.add(upper);
						trending.push(upper);
						if (trending.length >= limit) {
							break;
						}
					}
				}
			}
			if (trending.length >= limit) {
				break;
			}
		}

		res.json(trending);
	} catch (error) {
		console.error('Failed to derive trending symbols from Alpaca news:', error);
		res.status(502).json({ message: 'Failed to derive trending symbols from Alpaca.' });
	}
});

app.get('/api/market/history/:symbol', async (req, res) => {
	const { symbol } = req.params;
	if (!symbol) {
		return res.status(400).json({ message: 'Symbol parameter is required.' });
	}

	try {
		const history = await fetchHistorical(symbol.toUpperCase(), req.query);
		res.json(history);
	} catch (error) {
		console.error('Failed to fetch historical data:', error);
		res.status(502).json({ message: 'Failed to retrieve historical data.' });
	}
});

app.get('/api/market/news', async (req, res) => {
	const symbols = normaliseSymbols(req.query.symbols);
	if (symbols.length === 0) {
		return res.status(400).json({ message: 'Query parameter "symbols" is required.' });
	}

	try {
		const news = await fetchNews(symbols);
		res.json(news);
	} catch (error) {
		console.error('Failed to fetch news:', error);
		res.status(502).json({ message: 'Failed to fetch news from Alpaca.' });
	}
});

app.get('/api/alpaca/account', async (_req, res) => {
	if (!assertAlpacaConfigured(res)) {
		return;
	}

	try {
		const account = await alpacaClient.getAccount();
		res.json(account);
	} catch (error) {
		console.error('Failed to fetch Alpaca account:', error);
		res.status(502).json({ message: 'Failed to fetch Alpaca account data.' });
	}
});

app.get('/api/alpaca/positions', async (_req, res) => {
	if (!assertAlpacaConfigured(res)) {
		return;
	}

	try {
		const positions = await alpacaClient.getPositions();
		res.json(positions);
	} catch (error) {
		console.error('Failed to fetch Alpaca positions:', error);
		res.status(502).json({ message: 'Failed to fetch Alpaca position data.' });
	}
});

app.get('/api/alpaca/orders', async (req, res) => {
	if (!assertAlpacaConfigured(res)) {
		return;
	}

	const { status = 'all', limit = 25 } = req.query;
	try {
		const orders = await alpacaClient.getOrders({ status, limit: Number(limit) });
		res.json(orders);
	} catch (error) {
		console.error('Failed to fetch Alpaca orders:', error);
		res.status(502).json({ message: 'Failed to fetch Alpaca order data.' });
	}
});

app.post('/api/alpaca/orders', async (req, res) => {
	if (!assertAlpacaConfigured(res)) {
		return;
	}

	const { symbol, qty, side, type = 'market', timeInForce = 'day' } = req.body || {};
	if (!symbol || !qty || !side) {
		return res.status(400).json({ message: 'symbol, qty, and side are required to place an order.' });
	}

	try {
		const order = await alpacaClient.createOrder({
			symbol: symbol.toUpperCase(),
			qty: Number(qty),
			side: side.toLowerCase(),
			type,
			time_in_force: timeInForce,
		});
		res.status(201).json(order);
	} catch (error) {
		console.error('Failed to place Alpaca order:', error);
		res.status(502).json({ message: 'Failed to place Alpaca order.', details: error.message });
	}
});

app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

server.listen(PORT, () => {
	console.log(`RetroFinance backend listening on port ${PORT}`);
});
