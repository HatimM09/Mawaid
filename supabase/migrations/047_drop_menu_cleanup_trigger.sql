-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Drop Destructive Menu Auto-Cleanup Trigger (047)
-- Prevents menus from being deleted when a new week is uploaded.
-- Both current week and upcoming survey weeks must coexist.
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop the destructive trigger that deleted previous week's menu
DROP TRIGGER IF EXISTS trg_prune_old_weekly_menu ON weekly_menu;

-- 2. Replace the trigger function with a safe no-op function
CREATE OR REPLACE FUNCTION public.trg_auto_prune_old_weekly_menus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Safe no-op: never auto-delete menus
  RETURN NEW;
END;
$$;

-- 3. Replace cleanup_old_weekly_menus with a safe version that never deletes automatically
CREATE OR REPLACE FUNCTION public.cleanup_old_weekly_menus(p_target_week DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'disabled',
    'message', 'Auto-cleanup is disabled to preserve menu history and multi-week access.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_weekly_menus(DATE) TO authenticated, service_role;
