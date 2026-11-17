-- When someone signs in for the first time, link them to a pre-approved rep record by email.
-- Only emails already in public."user" with role REP or ADMIN become reps.
create or replace function public.link_rep_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public."user" set auth_user_id = new.id
   where lower(email) = lower(new.email) and auth_user_id is null and role in ('REP','ADMIN');
  return new;
end $$;
drop trigger if exists on_auth_user_created_link_rep on auth.users;
create trigger on_auth_user_created_link_rep after insert on auth.users for each row execute function public.link_rep_account();
revoke all on function public.link_rep_account() from public;
