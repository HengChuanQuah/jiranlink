# JiranLink

A neighbour services marketplace for Sime Darby Property townships, built as a hackathon prototype.
Residents describe what they need in their own words (English, Malay, Chinese or Manglish). JiranLink
finds verified neighbours, starting in their own building, then their taman, then the township, then
2, 5 and 10 km out.

Not an official Sime Darby Property product. Every person, business, review and promotion in it is sample data.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + production build in dist/
npm run build:artifact # one self-contained HTML page in dist-artifact/
```

Live test build: https://hengchuanquah.github.io/jiranlink/

### Publish to GitHub Pages

```bash
npm run build:pages    # builds into dist-pages/ for https://<user>.github.io/jiranlink/
```

Push the contents of `dist-pages/` to the `gh-pages` branch, then in the repo go to
Settings > Pages and choose "Deploy from a branch", `gh-pages`, `/ (root)`.
The public build contains no API keys.

Optional keys go in `.env` (copy `.env.example`). They can also be typed into Admin > Settings during a demo.

| Variable | What it does |
| --- | --- |
| `VITE_GOOGLE_MAPS_KEY` | Uses Google Maps. Without it, the app uses OpenStreetMap, and falls back to township outlines if tiles can't load. |
| `VITE_AI_PROVIDER` | `gemini` (default choice) or `claude`. Leave unset for keywords only. |
| `VITE_AI_MODEL` | Defaults to `gemini-2.5-flash` or `claude-haiku-5-5`. |
| `VITE_AI_KEY` | API key for that provider. |

A key in a browser app is visible to anyone who opens it. That's acceptable for a demo on your own laptop.
For a real pilot, move `src/ai/adapter.ts` behind a small server endpoint and keep the key there.

## Demo script (about 4 minutes)

1. **Aisyah, Elmina Green.** Search `nak order kek birthday anak`. Kak Ani, in the same precinct, comes first.
   Book a slot; the AI has already drafted the message.
2. **Switch to Kak Ani** (top-right persona button). Accept at a price.
3. **Back to Aisyah.** Choose *Pay now*, pay with the demo FPX, tap *Job done*. Kak Ani taps *Job done*,
   the held money is released, and Aisyah leaves a review labelled "Booked via JiranLink".
4. **Priya, Quarza Residence (condo).** Search `walk my dog`: the provider in her own building is first.
   Book Faizal for aircond (he only accepts pay after). Confirming creates a visitor pass for the
   guardhouse, because Faizal lives outside her gated building.
5. **Mr Tan, Taman Melawati.** Search `cuci rumah`: the top-rated KL East cleaner shows as one
   "Highly rated, a bit further" card without pushing nearer neighbours down.
6. **Township team.** Approve a pending resident, hide a reported provider, see promotion taps.

## How it decides

- **Ranking.** Rings in order: building, precinct, township, 2 km, 5 km, 10 km. It stops widening once
  5 acceptable providers are found. "Acceptable" means a Bayesian score of at least 3.5
  (prior 4.0 worth 3 reviews). Providers with fewer than 3 reviews are exempt from the floor.
- **Newcomers.** Under 10 reviews and under 90 days old: a "New neighbour" badge and one rotating slot
  in position 2.
- **Exception card.** At most one provider further out, shown separately, when they're at least
  0.5 stars better with 10 or more reviews.
- **Online services** skip proximity and are listed separately.
- **AI helper.** Keywords first. If the top score is at least 0.7 and leads by 0.2, it shows results
  straight away. If two or three categories are close, it shows them as chips. Below 0.4 it asks one
  tap-to-answer question. It never interviews. The LLM is only called when keywords aren't confident.
- **Reviews.** "Booked via JiranLink" reviews count fully. "Past customer" reviews come from a provider's
  invite code, count at half weight, at most 5 count, and only from the same township, one per home,
  never from the provider's own unit.
- **Accounts.** One phone number per home and at most 4 members per unit. A management-office invite code
  verifies instantly; otherwise the township team approves. No IC numbers are collected.
- **Payments.** Providers choose pay before (held until both tap done), pay after, and/or a deposit.
  An unpaid pay-after job blocks new bookings until it's settled.

All thresholds are in `src/data/seed.ts` (`DEFAULT_CONFIG`) and editable in Admin > Settings.

## Testing

```bash
npm test               # 31 unit tests: ranking, ratings, slots, booking and payment rules, trust rules, AI routing
npm run eval:ai        # AI helper on the 107 phrases it was tuned on
SET=heldout npm run eval:ai   # 40 phrases it was NOT tuned on: the honest number
npm run build && npx vite preview --port 4173 &
npm run test:e2e       # 24-step browser walkthrough plus light/dark, phone/desktop screenshots
```

AI helper, keywords only, on the held-out set: 57.5% picked straight away and correct, 2.5% picked wrong
(95.8% precision on automatic picks), 32.5% needed one question. The 100% on the tuning set is not a real
accuracy figure. The LLM fallback exists to close this gap; run the held-out set with `AI_PROVIDER` and
`AI_KEY` set to measure it.

## What's simulated

Payments (FPX, DuitNow, card), phone OTP (code `123456`), the visitor pass QR, the social-bio ownership
check, and the address search (a fixed list of pilot places instead of Google Places). Township and
precinct boundaries are approximate drawings; only the Elmina centre point is taken from a public source.
Data lives in the browser's local storage; Profile > Reset demo starts over.

## Path to a pilot

- Move state to Supabase (Postgres + PostGIS): `zones` as polygons, `ST_Contains` for ring 0 to 2 and
  `ST_DWithin` for the km rings. The functions in `src/lib/search.ts` map one to one onto a query.
- Real OTP (Supabase Auth or Twilio Verify), invite codes issued per unit by the management office.
- Payment gateway with escrow-style holds (for example Billplz or a Stripe Connect equivalent in Malaysia).
- Gate pass hand-off to the guardhouse system already used in the precinct.

## Layout

```
src/data      types, seed data, zones, categories with multilingual keywords
src/lib       business rules (domain.ts), ranking (search.ts), slots, ratings, store, router
src/ai        keyword scorer, time hints, LLM adapter (Gemini or Claude), routing logic
src/pages     resident, provider, shared and admin screens
tests         unit tests and the browser walkthrough
scripts       AI evaluation sets and the artifact packager
```
