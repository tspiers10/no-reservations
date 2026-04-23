-- Restaurant submissions: community-suggested restaurants pending founder review
CREATE TABLE restaurant_submissions (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_id          uuid         NOT NULL REFERENCES cities(id),
  name             text         NOT NULL CHECK (char_length(name) <= 100),
  address          text         NOT NULL,
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  cuisine_type     text         CHECK (char_length(cuisine_type) <= 50),
  walk_in_status   walk_in_status NOT NULL,
  note             text         CHECK (char_length(note) <= 140),
  status           text         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  submitted_at     timestamptz  NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- RLS: users can only see their own submissions; inserts require an authenticated user
ALTER TABLE restaurant_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own submissions"
  ON restaurant_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "auth users can submit"
  ON restaurant_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for the admin review queue (pending submissions ordered by age)
CREATE INDEX restaurant_submissions_status_idx
  ON restaurant_submissions (status, submitted_at ASC);
