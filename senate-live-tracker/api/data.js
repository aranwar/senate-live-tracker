const STATES = [
  "Maine", "Ohio", "Texas", "Nebraska", "Alaska", "Iowa", "Kansas",
  "Michigan", "Florida", "South Carolina", "New Hampshire",
  "Minnesota", "North Carolina", "Georgia"
];

const RACES = {
  Maine: ["Collins", "Jackson"],
  Ohio: ["Husted", "Brown"],
  Texas: ["Paxton", "Talarico"],
  Nebraska: ["Ricketts", "Osborn"],
  Alaska: ["Sullivan", "Peltola"],
  Iowa: ["Hinson", "Turek"],
  Kansas: ["Marshall", "Hamilton"],
  Michigan: ["Rogers", "El-Sayed"],
  Florida: ["Moody", "Nixon"],
  "South Carolina": ["Graham Nordone", "Andrews"],
  "New Hampshire": ["Sununu", "Pappas"],
  Minnesota: ["Tafoya", "Flanagan"],
  "North Carolina": ["Whatley", "Cooper"],
  Georgia: ["Collins", "Ossoff"]
};

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPolls() {
  const url = "https://www.realclearpolling.com/latest-polls/senate";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`RCP returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const text = stripHtml(html);
  const results = [];

  for (const state of STATES) {
    const candidates = RACES[state];
    const raceMarker = `2026 ${state} Senate`;

    let start = text.indexOf(raceMarker);

    if (start === -1 && state === "Ohio") {
      start = text.indexOf("2026 Ohio Senate Special Election");
    }

    if (start === -1 && state === "Florida") {
      start = text.indexOf("2026 Florida Senate Special Election");
    }

    if (start === -1) continue;

    const section = text.slice(start, start + 500);

    const pollMatch = section.match(/Poll\s*([^]*?)Results/i);
    const spreadMatch = section.match(/Spread\s*([A-Za-z .'-]+(?:\s*\+\d+(?:\.\d+)?)?|Tie)/i);

    const candidateResults = [];

    for (const candidate of candidates) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`${escaped}\\s+(\\d+(?:\\.\\d+)?)`, "i");
      const match = section.match(regex);

      candidateResults.push({
        name: candidate,
        value: match ? Number(match[1]) : null
      });
    }

    results.push({
      state,
      pollster: pollMatch ? pollMatch[1].trim() : null,
      candidates: candidateResults,
      spread: spreadMatch ? spreadMatch[1].trim() : null,
      source: url
    });
  }

  return results;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getPolymarket() {
  const url =
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1000";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polymarket returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const markets = Array.isArray(data) ? data : data.markets || [];
  const results = [];

  for (const state of STATES) {
    const matches = markets.filter((market) => {
      const question = String(
        market.question || market.title || market.slug || ""
      ).toLowerCase();

      return (
        question.includes(state.toLowerCase()) &&
        question.includes("senate")
      );
    });

    const candidates = [];

    for (const market of matches) {
      const outcomes = parseMaybeJson(market.outcomes) || [];
      const prices = parseMaybeJson(market.outcomePrices) || [];

      if (Array.isArray(outcomes) && Array.isArray(prices)) {
        for (let i = 0; i < outcomes.length; i++) {
          candidates.push({
            market: market.question || market.title || "",
            outcome: outcomes[i],
            price:
              prices[i] !== undefined && prices[i] !== null
                ? Number(prices[i])
                : null
          });
        }
      }
    }

    results.push({
      state,
      candidates,
      matchedMarkets: matches.length,
      source: "https://polymarket.com"
    });
  }

  return results;
}

module.exports = async function handler(req, res) {
  try {
    const [pollResult, marketResult] = await Promise.allSettled([
      getPolls(),
      getPolymarket()
    ]);

    res.status(200).json({
      updated: new Date().toISOString(),

      polls:
        pollResult.status === "fulfilled"
          ? pollResult.value
          : [],

      markets:
        marketResult.status === "fulfilled"
          ? marketResult.value
          : [],

      errors: {
        polls:
          pollResult.status === "rejected"
            ? pollResult.reason.message
            : null,

        markets:
          marketResult.status === "rejected"
            ? marketResult.reason.message
            : null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};
