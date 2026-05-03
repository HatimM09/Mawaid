import { useEffect, useState } from 'react';
import { supabase } from '../admin/supabaseClient';

export const useWeeklyMenu = () => {
  const [menu, setMenu] = useState<any>(null);

  const formatMenu = (rows: any[]) => {
    const formatted: any = {};
    rows.forEach(row => {
      const dayKey = row.day_name.toLowerCase();
      formatted[dayKey] = {
        en: row.day_name,
        ar: row.day_ar,
        lunch: row.lunch ? row.lunch.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        dinner: row.dinner ? row.dinner.split(',').map((s: string) => s.trim()).filter(Boolean) : []
      };
    });
    return formatted;
  };

  const load = async () => {
    const { data, error } = await supabase
      .from('weekly_menu')
      .select('*');
    if (!error && data) {
      setMenu(formatMenu(data));
    }
  };

  // Initial load
  useEffect(() => {
    load();
  }, []);

  // Realtime updates
  useEffect(() => {
    // Generate a unique channel name to avoid "callbacks after subscribe" conflicts
    // when this hook is used in multiple components simultaneously.
    const channelName = `weekly_menu_updates_${Math.random().toString(36).slice(2, 11)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_menu' },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return menu;
};
