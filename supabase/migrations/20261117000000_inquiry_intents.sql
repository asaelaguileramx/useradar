-- Sprint 06: three customer intents on the existing inquiry model.
-- Reuses inquiry, inquiry_status_history, inquiry_note, inquiry_acknowledgement and "user".
-- Backward compatible: nothing is dropped; existing columns, enums and deal stages are unchanged.

-- 1. New enum values (append only)
alter type public.inquiry_status add value if not exists 'CLOSED';
alter type public.acknowledgement_type add value if not exists 'WHOLESALE_ELIGIBILITY';
