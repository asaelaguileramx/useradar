SQL checks were run as DO blocks that raise their summary at the end (rolling back all test data):
- submissions for all three intents; lot required only for existing_lot; acknowledgement and
  disclosure required; positive, well-formed amounts; phone validation and normalization;
  honeypot; 3-per-10-minute rate limit per phone
- tracking by token; unknown token returns nothing; anon cannot read tables or change status
- intent immutable; new types limited to NEW/CONTACTED/QUALIFIED/DISQUALIFIED/CLOSED
- rep reads all leads and filters by intent; status changes recorded in inquiry_status_history
  with actor, contacted/qualified stamps, audit_log rows, notes; CLOSED is final;
  signed-in non-reps see nothing
Result: 35 passed, 0 failed.
