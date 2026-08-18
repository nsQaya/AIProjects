# Market data automation

DefterX keeps the exchange catalogue separate from user-defined investment instruments. A user instrument may link to one `market_symbols` row through `market_symbol_id`; custom assets can remain unlinked and continue to use manual prices.

## Sources

- US symbol catalogue: Nasdaq Trader `nasdaqlisted.txt` and `otherlisted.txt`.
- BIST equity and ETF catalogue: KAP company and exchange-traded-fund directories.
- Daily close, adjusted close and split events: Yahoo Finance chart/spark responses.

Yahoo Finance is behind the provider adapter in `market-data.provider.ts`. Yahoo does not publish a supported Finance developer API and its data terms can change, so no Yahoo response shape leaks into the application contracts or database ownership model. A licensed provider can replace the adapter without changing user instruments.

## Scheduling and queues

- Every 15 minutes: existing recurring jobs run and market data is bootstrapped if no fresh catalogue/run exists.
- Sunday 03:05 UTC: the full BIST/US catalogue is refreshed.
- Weekdays 22:30 UTC: all active catalogue symbols are queued for that day's closing price; linked symbols are checked for splits.

The planner divides symbols into batches of 20 and Cloudflare Queues processes at most two batches concurrently. `market_data_sync_batches` makes at-least-once queue delivery idempotent. A missing price is not inserted as a fake market observation; date lookup returns `0`, `available=false` and `source=MISSING`.

## Splits

Each Yahoo split event is unique by symbol, date and ratio. Application is additionally unique per user instrument. Purchases before the split have quantity multiplied and unit price divided by the ratio. Pre-split sales receive the same nominal-unit conversion so the remaining position stays arithmetically correct. Cost and proceeds are preserved, and replaying a queue message cannot apply the split twice.
