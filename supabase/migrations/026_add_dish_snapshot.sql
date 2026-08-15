-- Add a per-slot dish-name snapshot to survey_submissions_flat.
--
-- Responses are stored positionally (mon_l_dish_1 … dish_6), so dish names
-- are normally resolved from the CURRENT menu — which mislabels responses the
-- moment the admin edits the menu after a member submits. Every writer now
-- stores the dish list it saved against in `dish_snapshot` (keyed by slot,
-- e.g. { "mon_l": ["Dish A", "Dish B"], "tue_d": [...] }) and every reader
-- resolves names from the snapshot, falling back to the current menu.

ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS dish_snapshot JSONB DEFAULT '{}'::jsonb;
