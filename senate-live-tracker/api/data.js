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

function parseMaybeJson(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  return [];
}

function partyFromText(text) {
  const s = String(text || "");

  if (/\(D\)/i.test(s) || /\bDemocrat/i.test(s)) return "D";
  if (/\(R\)/i.test(s) || /\bRepublican/i.test(s)) return "R";
  if (/\(I\)/i.test(s) || /\bIndependent/i.test(s)) return "I";

  return "";
}

function candidateFromQuestion(question) {
  let q = String(question || "").trim();

  q = q
    .replace(/^Will\s+/i, "")
    .replace(/\s+win\s+the\s+.+$/i, "")
    .replace(/\s+win\s+.+$/i, "")
    .replace(/\?$/, "")
    .trim();

  return q;
}

async function getPolymarketEvent(state) {
  const slug =
    state
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-senate-election-winner";

  const url =
    "https://gamma-api.polymarket.com/events/slug/" +
    encodeURIComponent(slug);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Polymarket ${state} returned HTTP ${response.status}`
    );
  }

  const data = await response.json();

  const event = Array.isArray(data)
    ? data[0]
    : Array.isArray(data.events)
      ? data.events[0]
      : data;

  if (!event) {
    return {
      state,
      candidates: [],
      matchedMarkets: 0,
      source: `https://polymarket.com/event/${slug}`
    };
  }

  const markets = Array.isArray(event.markets)
    ? event.markets
    : [];

  const candidates = [];

  for (const market of markets) {
    if (market.closed === true) continue;

    const question = String(
      market.question ||
      market.title ||
      ""
    );

    const outcomes = parseMaybeJson(market.outcomes);
    const prices = parseMaybeJson(market.outcomePrices);

    let yesIndex = outcomes.findIndex(
      x => String(x).toLowerCase() === "yes"
    );

    if (yesIndex === -1 && outcomes.length === 2) {
      yesIndex = 0;
    }

    if (yesIndex === -1) continue;

    const rawPrice = Number(prices[yesIndex]);

    if (!Number.isFinite(rawPrice)) continue;

    let name = candidateFromQuestion(question);

    const marketSlug = String(market.slug || "");

    if (/democrats?/i.test(question + " " + marketSlug)) {
      name = "Democratic nominee";
    }

    if (/republicans?/i.test(question + " " + marketSlug)) {
      name = "Republican nominee";
    }

    const party = partyFromText(
      question + " " + marketSlug + " " + name
    );

    candidates.push({
      name,
      party,
      price: rawPrice,
      percent: Math.round(rawPrice * 1000) / 10,
      question
    });
  }

  return {
    state,
    candidates,
    matchedMarkets: markets.length,
    source: `https://polymarket.com/event/${slug}`
  };
}

async function getPolymarket() {
  const results = await Promise.all(
    STATES.map(async state => {
      try {
        return await getPolymarketEvent(state);
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

  return results;
}

async function getPolls() {
  /*
    RealClearPolling currently blocks the Vercel server with HTTP 403.
    Keep the API shape intact while we replace the polling source.
  */
  return [];
}

module.exports = async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=30, stale-while-revalidate=60"
  );

  try {
    const markets = await getPolymarket();

    res.status(200).json({
      updated: new Date().toISOString(),
      polls: await getPolls(),
      markets,
      errors: {
        polls: "RCP blocks server requests with HTTP 403",
        markets: null
      }
    });
  } catch (error) {
    res.status(500).json({
      updated: new Date().toISOString(),
      polls: [],
      markets: [],
      errors: {
        polls: null,
        markets: error.message
      }
    });
  }
};
