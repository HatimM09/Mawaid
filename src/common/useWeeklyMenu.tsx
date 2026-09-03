import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/firebaseClient';
import { getSurveyTargetWeek } from './utils';
import { queryKeys } from '../lib/queryClient';

const parseDishArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((s: any) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[\n\r,;•|]+/)
      .map((s: string) => s.trim().replace(/^["']+|["']+$/g, ''))
      .filter(Boolean);
  }
  return [];
};

const formatMenu = (rows: any[], weekId?: string) => {
  const filtered = weekId ? rows.filter(row => row && row.week_start === weekId) : rows;
  const targetRows = filtered.length > 0 ? filtered : rows;
  const formatted: any = {};
  targetRows.forEach(row => {
    if (!row || !row.day_name) return;
    const rawName = String(row.day_name).trim();
    const dayKey = rawName.toLowerCase();
    const menuObj = {
      en: rawName,
      ar: row.day_ar || '',
      lunch: parseDishArray(row.lunch),
      dinner: parseDishArray(row.dinner),
      week_start: row.week_start,
      publish_at: row.publish_at,
    };
    formatted[dayKey] = menuObj;
    formatted[rawName] = menuObj;
    formatted[dayKey.slice(0, 3)] = menuObj;
    formatted[dayKey.toUpperCase()] = menuObj;
  });
  return formatted;
};

const fetchWeeklyMenu = async (weekStart: string): Promise<any> => {
  if (weekStart) {
    const { data, error } = await supabase
      .from('weekly_menu')
      .select('*')
      .eq('week_start', weekStart);
    if (error) throw error;

    if (data && data.length > 0) {
      return formatMenu(data, weekStart);
    }
  }

  // Fallback: If no rows found for the requested target week, query the most recent published menu week
  const { data: latestRow } = await supabase
    .from('weekly_menu')
    .select('week_start')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRow?.week_start) {
    const { data: fallbackData } = await supabase
      .from('weekly_menu')
      .select('*')
      .eq('week_start', latestRow.week_start);

    if (fallbackData && fallbackData.length > 0) {
      return formatMenu(fallbackData, latestRow.week_start);
    }
  }

  return {};
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
