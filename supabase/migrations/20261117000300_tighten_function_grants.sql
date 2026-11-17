-- Only submit_inquiry and track_inquiry are public. Rep functions require a signed-in rep.
revoke execute on function public.rep_set_inquiry_status(uuid, text, text) from anon;
revoke execute on function public.rep_add_inquiry_note(uuid, text) from anon;
revoke execute on function public.is_rep() from anon;
revoke execute on function public.current_rep_id() from anon;
revoke execute on function public.link_rep_account() from anon, authenticated;
alter function public.inquiry_guard() set search_path = public;
alter function public.parse_money(text) set search_path = public;
revoke execute on function public.is_rep() from public, anon;
grant execute on function public.is_rep() to authenticated;
