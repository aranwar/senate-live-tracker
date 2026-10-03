const STATES = [
  "Maine",
  "Ohio",
  "Texas",
  "Nebraska",
  "Alaska",
  "Iowa",
  "Kansas",
  "Michigan",
  "Florida",
  "South Carolina",
  "New Hampshire",
  "Minnesota",
  "North Carolina",
  "Georgia"
];

function parseArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function stateSlug(state) {
  return state
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitCandidateTitle(title) {
  const text = String(title || "").trim();

  const match = text.match(/^(.*?)\s*\(([DRI])\)\s*$/i);

  if (match) {
    return {
      name: match[1].trim(),
      party: match[2].toUpperCase()
    };
  }

  return {
    name: text,
    party: ""
  };
}

async function getStateMarket(state) {
  const slug = `${stateSlug(state)}-senate-election-winner`;

  const apiUrl =
    `https://gamma-api.polymarket.com/events/slug/${slug}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const event = await response.json();

  const markets = Array.isArray(event.markets)
    ? event.markets
    : [];

  const candidates = [];

  for (const market of markets) {
    if (market.active !== true) continue;
    if (market.closed === true) continue;

    const title = String(market.groupItemTitle || "").trim();

    // Ignore unused placeholder markets.
    if (!title) continue;
    if (/^Person\s+[A-Z]$/i.test(title)) continue;

    const outcomes = parseArray(market.outcomes);
    const prices = parseArray(market.outcomePrices);

    const yesIndex = outcomes.findIndex(
      outcome => String(outcome).toLowerCase() === "yes"
    );

    if (yesIndex < 0) continue;
    if (prices[yesIndex] == null) continue;

    const price = Number(prices[yesIndex]);

    if (!Number.isFinite(price)) continue;

    const parsed = splitCandidateTitle(title);

    candidates.push({
      name: parsed.name,
      party: parsed.party,
      price: price,
      question: market.question || "",
      updatedAt: market.updatedAt || null
    });
  }

  candidates.sort((a, b) => b.price - a.price);

  return {
    state,
    candidates,
    matchedMarkets: candidates.length,
    source: `https://polymarket.com/event/${slug}`
  };
}

async function getPolymarket() {
  return Promise.all(
    STATES.map(async state => {
      try {
        return await getStateMarket(state);
      } catch (error) {
        return {
          state,
          candidates: [],
          matchedMarkets: 0,
          error: error.message
        };
      }
    })
  );
}

module.exports = async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=30, stale-while-revalidate=30"
  );

  try {
    const markets = await getPolymarket();

    res.status(200).json({
      updated: new Date().toISOString(),

      // Polling source will be added separately.
      polls: [],

      markets,

      errors: {
        polls: "Polling source temporarily unavailable",
        markets: null
      }
    });
  } catch (error) {
    res.status(500).json({
      updated: new Date().toISOString(),
      polls: [],
      markets: [],
      errors: {
        polls: "Polling source temporarily unavailable",
        markets: error.message
      }
    });
  }
};
