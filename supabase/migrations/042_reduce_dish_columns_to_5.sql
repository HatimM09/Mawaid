-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Reduce dish columns to 5 (042)
--
-- Drops l_dish_6..14 and d_dish_6..14 from survey_day_responses.
-- Any existing data in those columns is discarded (dishes beyond 5
-- are no longer supported). Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Only run if the column still exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'survey_day_responses'
      AND column_name  = 'l_dish_6'
  ) THEN
    ALTER TABLE survey_day_responses
      DROP COLUMN IF EXISTS l_dish_6,
      DROP COLUMN IF EXISTS l_dish_7,
      DROP COLUMN IF EXISTS l_dish_8,
      DROP COLUMN IF EXISTS l_dish_9,
      DROP COLUMN IF EXISTS l_dish_10,
      DROP COLUMN IF EXISTS l_dish_11,
      DROP COLUMN IF EXISTS l_dish_12,
      DROP COLUMN IF EXISTS l_dish_13,
      DROP COLUMN IF EXISTS l_dish_14,
      DROP COLUMN IF EXISTS d_dish_6,
      DROP COLUMN IF EXISTS d_dish_7,
      DROP COLUMN IF EXISTS d_dish_8,
      DROP COLUMN IF EXISTS d_dish_9,
      DROP COLUMN IF EXISTS d_dish_10,
      DROP COLUMN IF EXISTS d_dish_11,
      DROP COLUMN IF EXISTS d_dish_12,
      DROP COLUMN IF EXISTS d_dish_13,
      DROP COLUMN IF EXISTS d_dish_14;
  END IF;
END $$;

-- Also update the erase_survey_slot RPC to only null 5 dish columns
DROP FUNCTION IF EXISTS erase_survey_slot(uuid, date, text, text);
CREATE OR REPLACE FUNCTION erase_survey_slot(
  p_user_id UUID,
  p_week_id DATE,
  p_day     TEXT,
  p_meal    TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_sql TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  v_prefix := CASE WHEN p_meal = 'dinner' THEN 'd' ELSE 'l' END;
  v_sql := format('
    UPDATE survey_day_responses SET
      %1$s_status = NULL,
      %1$s_dish_1 = NULL, %1$s_dish_2 = NULL, %1$s_dish_3 = NULL,
      %1$s_dish_4 = NULL, %1$s_dish_5 = NULL,
      updated_at = now()
    WHERE user_id = $1 AND week_id = $2 AND day = $3',
    v_prefix
  );
  EXECUTE v_sql USING p_user_id, p_week_id, p_day;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION erase_survey_slot(UUID, DATE, TEXT, TEXT) TO authenticated;
