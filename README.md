# Options Tracker

Web app to track options trading activity. Log trades manually or import from CSV (Fidelity / Robinhood presets ready for your column names).

## Setup

```bash
cd options-tracker
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Dashboard** – Summary and recent trades
- **Trades** – List all trades, net cost, add manually
- **Add trade** – Ticker, call/put, strike, expiry, action, quantity, price, date, notes
- **Import CSV** – Upload brokerage CSV, map columns (Fidelity/Robinhood presets: add exact column names in `src/lib/broker-presets.ts` when you have them), preview, import

## Data

- SQLite DB: `prisma/dev.db`
- Run `npx prisma studio` to inspect data.

## GitHub

To push this project to GitHub:

1. Create a new repository on [GitHub](https://github.com/new) (no need to add a README or .gitignore—this repo already has them).
2. Add the remote and push:

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/options-tracker.git
   git push -u origin master
   ```

   If your default branch is `main`, use `git push -u origin master:main` to push `master` to `main`.
