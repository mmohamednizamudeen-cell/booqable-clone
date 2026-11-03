# Rental platform

Rental software for rental businesses: inventory with date-based availability,
bookings from pickup to return, and a hosted booking page. A clean-room
rebuild of the core rental loop of an existing product; planning lives in
`replica/`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000/design shows the design system
```

## Where things are

| path | what |
| --- | --- |
| `replica/recon.md`, `replica/features.csv` | what is being built, feature matrix |
| `replica/architecture.md`, `replica/schema.sql` | stack, schema (tested), API, build order |
| `replica/design/` | tokens, component specs, design system screenshots |
| `src/components/ui/` | the primitives |
| `src/app/design/` | every component in every state |
| `scripts/build-tokens.mjs` | regenerates `replica/design/tokens.css` from `tokens.json` |

After changing `replica/design/tokens.json`:

```bash
node scripts/build-tokens.mjs
python3 ~/.claude/skills/replica-design/contrast.py replica/design/tokens.json
```
