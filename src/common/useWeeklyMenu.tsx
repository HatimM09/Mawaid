import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/firebaseClient';
import { getWeekDate } from './utils';
import { queryKeys } from '../lib/queryClient';

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

const fetchWeeklyMenu = async (): Promise<any> => {
  const currentWeekId = getWeekDate();
  const { data, error } = await supabase
    .from('weekly_menu')
    .select('*')
    .eq('week_start', currentWeekId);
  if (error) throw error;
  return formatMenu(data || []);
};

export const useWeeklyMenu = () => {
  const queryClient = useQueryClient();
  const instanceRef = useRef(Date.now());

  const queryKey = queryKeys.weeklyMenu(getWeekDate());

  const { data: menu = {} } = useQuery({
    queryKey,
    queryFn: fetchWeeklyMenu,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });

  // Realtime subscription — auto-refresh when admin publishes/updates menu
  useEffect(() => {
    let cancelled = false;
    const channel = supabase
      .channel(`weekly-menu-changes-${instanceRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_menu' }, () => {
        if (!cancelled) queryClient.invalidateQueries({ queryKey });
      })
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !cancelled) {
          setTimeout(() => queryClient.invalidateQueries({ queryKey }), 3000);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey]);

  return menu;
};
