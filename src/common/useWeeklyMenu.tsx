import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/firebaseClient';
import { getSurveyTargetWeek } from './utils';
import { queryKeys } from '../lib/queryClient';

const formatMenu = (rows: any[], weekId: string) => {
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

const fetchWeeklyMenu = async (weekStart: string): Promise<any> => {
  const { data, error } = await supabase
    .from('weekly_menu')
    .select('*')
    .eq('week_start', weekStart);
  if (error) throw error;
  return formatMenu(data || [], weekStart);
};

/**
 * Hook to load the weekly menu.
 *
 * @param weekStart Which week's menu to load (YYYY-MM-DD of that week's Monday).
 *   Defaults to `getWeekDate()` (the survey week — NEXT week during the
 *   Saturday 8PM–Monday 11AM survey window). Pass `getCalendarWeekDate()`
 *   from menu-display surfaces (Menu page, Today's menu & feedback) so the
 *   CURRENT week's menu keeps showing even after next week is published.
 */
export const useWeeklyMenu = (weekStart = getSurveyTargetWeek()) => {
  const queryClient = useQueryClient();

  const queryKey = queryKeys.weeklyMenu(weekStart);

  const { data: menu = {} } = useQuery({
    queryKey,
    queryFn: () => fetchWeeklyMenu(weekStart),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });

  // Realtime subscription — auto-refresh when admin publishes/updates menu
  useEffect(() => {
    let cancelled = false;
    const channelName = `weekly-menu-changes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
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
