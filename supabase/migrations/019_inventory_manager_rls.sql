-- Add RLS policies for inventory_manager role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory' AND policyname = 'Inventory managers can CRUD inventory') THEN
    CREATE POLICY "Inventory managers can CRUD inventory" ON public.inventory FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_categories' AND policyname = 'Inventory managers can CRUD categories') THEN
    CREATE POLICY "Inventory managers can CRUD categories" ON public.inventory_categories FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_log' AND policyname = 'Inventory managers can CRUD inventory log') THEN
    CREATE POLICY "Inventory managers can CRUD inventory log" ON public.inventory_log FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;
END $$;
