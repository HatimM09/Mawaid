import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../admin/supabaseClient';
import { getWeekDate, addWeeks } from './utils';

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
    const nextWeekId = addWeeks(currentWeekId, 1);
    
    // Fetch both current and next week menus
    const { data, error } = await supabase
      .from('weekly_menu')
      .select('*')
      .in('week_start', [currentWeekId, nextWeekId]);
      
    if (!error && data) {
      // First try to get current week menu
      let currentWeekMenu = formatMenu(data);
      
      // If current week is empty, check if next week is published
      const hasCurrentWeekData = Object.keys(currentWeekMenu).length > 0;
      
      if (!hasCurrentWeekData) {
        // Check next week for published menus
        const nextWeekData = data.filter(row => row.week_start === nextWeekId);
        const publishedNextWeek = nextWeekData.filter(row => 
          !row.publish_at || new Date(row.publish_at).getTime() <= Date.now()
        );
        
        if (publishedNextWeek.length > 0) {
          // Format next week menu as current week
          const formatted: any = {};
          publishedNextWeek.forEach(row => {
            const dayKey = row.day_name.toLowerCase();
            formatted[dayKey] = {
              en: row.day_name,
              ar: row.day_ar,
              lunch: row.lunch ? row.lunch.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
              dinner: row.dinner ? row.dinner.split(',').map((s: string) => s.trim()).filter(Boolean) : []
            };
          });
          setMenu(formatted);
        } else {
          setMenu({});
        }
      } else {
        setMenu(currentWeekMenu);
      }
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
