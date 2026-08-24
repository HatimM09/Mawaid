-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Auto-cleanup Old Weekly Menu Rows (046)
-- Deletes previous weeks' menu rows whenever a new weekly menu
-- is published or when survey target week advances.
-- ═══════════════════════════════════════════════════════════════

-- 1. Stored procedure for manual or scheduled cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_weekly_menus(p_target_week DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff DATE;
  v_deleted INT := 0;
BEGIN
  IF p_target_week IS NOT NULL THEN
    v_cutoff := p_target_week;
  ELSE
    -- Default cutoff: current week Monday
    v_cutoff := CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INT % 7) + 1;
    IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
      v_cutoff := CURRENT_DATE - 6;
    END IF;
  END IF;

  DELETE FROM weekly_menu
  WHERE week_start < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'deleted_menu_rows', v_deleted,
    'cutoff_week_start', v_cutoff
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_weekly_menus(DATE) TO authenticated, service_role;

-- 2. Trigger function: auto-delete previous week menus on publish of newer week
CREATE OR REPLACE FUNCTION public.trg_auto_prune_old_weekly_menus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a new menu is upserted for week_start, prune any menus strictly older than NEW.week_start
  IF NEW.week_start IS NOT NULL THEN
    DELETE FROM weekly_menu
    WHERE week_start < NEW.week_start;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_old_weekly_menu ON weekly_menu;
CREATE TRIGGER trg_prune_old_weekly_menu
  AFTER INSERT OR UPDATE OF week_start ON weekly_menu
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_prune_old_weekly_menus();

-- Run cleanup on current database state
SELECT public.cleanup_old_weekly_menus();
