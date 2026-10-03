# Senate Live Tracker

A small web dashboard for 14 selected 2026 U.S. Senate races.

- **Latest Polls**: reads the public RealClearPolling Senate latest-polls page and attempts to extract the latest matching head-to-head poll for each selected state.
- **Polymarket**: reads public active market metadata from Polymarket's Gamma API and shows matching candidate YES prices.
- Refreshes every 60 seconds.

## Deploy on Vercel
Import this GitHub repository into Vercel and deploy with the default settings. No local Python is required.

## Notes
This is a personal dashboard, not an election forecast. Polymarket prices are market prices. Poll parsing is best-effort because RealClearPolling does not expose a documented public polling API here; if its page markup/text changes, the parser may need updating.
