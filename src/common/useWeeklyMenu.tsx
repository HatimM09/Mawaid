import { useEffect, useState } from 'react';
import { supabase } from '../admin/supabaseClient';

export const useWeeklyMenu = () => {
  const [menu, setMenu] = useState<any>(null);

  // Initial load
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('weekly_menu')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) setMenu(data.menu_json);
    };
    load();
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('public:weekly_menu')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'weekly_menu' },
        (payload) => {
          setMenu((payload.new as any).menu_json);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return menu;
};
