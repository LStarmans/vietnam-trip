-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It makes one small table the app uses to share ticks, bookings, saved picks and budget edits.

create table if not exists trip_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table trip_state enable row level security;

-- Anyone with the app link can read and update the shared trip state.
create policy "read trip state" on trip_state for select using (true);
create policy "add trip state" on trip_state for insert with check (true);
create policy "change trip state" on trip_state for update using (true) with check (true);

create or replace function touch_trip_state() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trip_state_touch on trip_state;
create trigger trip_state_touch before update on trip_state
  for each row execute function touch_trip_state();
