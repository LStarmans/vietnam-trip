# Việt Nam '27

The plan for Vietnam, 16 Jan – 19 Feb 2027.

**https://lstarmans.github.io/vietnam-trip/**

On iPhone: open the link in Safari, tap Share, then Add to Home Screen. It works offline once it's been opened.

## Changing the plan

Everything lives in `data/`:

- `trip.json` – the stops, where we're staying, and how we get from one to the next
- `checklist.json` – the to-do list
- `budget.json` – the per-person budget

Edit a file on GitHub and the app picks up the change next time it's opened.

Setting `"booked": true` on a stay in `trip.json` shows it as booked for everyone. Ticks made inside the app only save on that phone.
