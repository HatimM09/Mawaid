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

  // Realtime updates removed as requested

  return menu;
};
