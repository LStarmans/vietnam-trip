# Việt Nam '27

The plan for Vietnam, 16 Jan – 19 Feb 2027.

**https://lstarmans.github.io/vietnam-trip/**

On iPhone: open the link in Safari, tap Share, then Add to Home Screen. It works offline once it's been opened.

## Changing the plan

Everything lives in `data/`:

- `trip.json` – the stops, where we're staying, and how we get from one to the next
- `checklist.json` – the to-do list and who's on the trip. Set someone's `"trip"` to `"month"` or `"two-weeks"` and their list only shows what applies to them
- `budget.json` – the per-person budget
- `guide.json` – the Guide tab: a day-by-day plan and the best things to do, eat and drink at each stop, plus phrases

Edit a file on GitHub and the app picks up the change next time it's opened.

Setting `"booked": true` on a stay in `trip.json` shows it as booked for everyone.

## Group sync

Bookings, everyone's to-do ticks, saved Guide picks and budget edits can be shared across the group through a free Supabase project. Until it's set up, they save on each phone.

1. Make a free project at supabase.com.
2. In the project, open **SQL Editor**, paste in `supabase.sql` and run it.
3. In **Project Settings → API**, copy the **Project URL** and the **publishable / anon key**.
4. Put them in `data/sync.json`:

```json
{ "url": "https://your-project.supabase.co", "anonKey": "your-key" }
```

The anon key is meant to be public, but anyone with the app link can change the shared ticks. The Wallet tab is never synced; it stays on each phone.

## Previewing a trip day

Add `?today=2027-01-21` to the link to see the app as it'll look on that day of the trip.
