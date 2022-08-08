
import config from './config.json';
// export const baseUrl = 'test.tidebit.network';
// Make requests to CryptoCompare API
export async function makeApiRequest(path) {
	try {
		// const response = await fetch(`https://min-api.cryptocompare.com/${path}`);
		// const response = await fetch(`https://${baseUrl}/api/${path}`);
		const response = await fetch(`https://${JSON.parse(config).BASE_URL}/api/${path}`);
		// const response = await fetch(`${path}`);
		return response.json();
	} catch (error) {
		throw new Error(`CryptoCompare request error: ${error.status}`);
	}
}

// Generate a symbol ID from a pair of the coins
export function generateSymbol(exchange, fromSymbol, toSymbol) {
	const short = `${fromSymbol}/${toSymbol}`;
	return {
		short,
		full: `${exchange}:${short}`,
	};
}

export function parseFullSymbol(fullSymbol) {
	const match = fullSymbol.match(/^(\w+):(\w+)\/(\w+)$/);
	if (!match) {
		return null;
	}

	return {
		exchange: match[1],
		fromSymbol: match[2],
		toSymbol: match[3],
	};
}
