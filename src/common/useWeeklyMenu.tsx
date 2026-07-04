import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../admin/supabaseClient';
import { getWeekDate } from './utils';

let hookInstance = 0
export const useWeeklyMenu = () => {
  const [menu, setMenu] = useState<any>({});
  const instanceRef = useRef(++hookInstance)

  const formatMenu = (rows: any[]) => {
    const weekId = getWeekDate();
    const filtered = rows.filter(row => {
      if (row.week_start !== weekId) return false;
      if (row.publish_at && new Date(row.publish_at).getTime() > Date.now()) return false;
      return true;
    });
    const formatted: any = {};
    filtered.forEach(row => {
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

  const load = useCallback(async () => {
    const currentWeekId = getWeekDate();
    
    // Only fetch current week's menu — users should always see the current week
    const { data, error } = await supabase
      .from('weekly_menu')
      .select('*')
      .eq('week_start', currentWeekId);
      
    if (!error && data) {
      const currentWeekMenu = formatMenu(data);
      setMenu(currentWeekMenu);
    } else {
      setMenu({});
    }
  }, []);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription — auto-refresh when admin publishes/updates menu
  useEffect(() => {
    const channel = supabase
      .channel(`weekly-menu-changes-${instanceRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_menu' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return menu;
};
