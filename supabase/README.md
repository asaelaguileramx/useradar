# RADAR database (Supabase project `radar-co-preview`)

Migrations in `migrations/` were applied in order on 2026-11-17. Earlier sprint migrations
(001_init … add_vehicle_data_status) live only in the database history.

Public (no sign-in): `submit_inquiry(jsonb)`, `track_inquiry(uuid)`.
Reps (signed in and listed in `public."user"` with role REP or ADMIN): table reads through RLS,
`rep_set_inquiry_status`, `rep_add_inquiry_note`.

## Add a rep
```sql
insert into public."user" (name, email, role) values ('Name', 'rep@example.com', 'REP');
```
The account links automatically the first time that email signs in at `/rep`.
If the person already signed in before being added:
```sql
update public."user" u set auth_user_id = a.id from auth.users a
 where lower(a.email) = lower(u.email) and u.auth_user_id is null;
```

## Tests
`tests/` describes the SQL checks run on 2026-11-17 (35 checks, all passing, run inside
rolled-back transactions).
