import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/firebaseClient';
import { getSurveyTargetWeek } from './utils';
import { queryKeys } from '../lib/queryClient';
import { DEFAULT_MENU } from './constants';

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

const formatDefaultMenu = (defaultMenu: any, weekStart?: string) => {
  const formatted: any = {};
  Object.entries(defaultMenu || {}).forEach(([dayKey, val]: [string, any]) => {
    const rawName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
    const menuObj = {
      en: rawName,
      ar: '',
      lunch: parseDishArray(val.lunch),
      dinner: parseDishArray(val.dinner),
      week_start: weekStart || '',
      publish_at: '',
      isDefault: true,
    };
    formatted[dayKey.toLowerCase()] = menuObj;
    formatted[rawName] = menuObj;
    formatted[dayKey.toLowerCase().slice(0, 3)] = menuObj;
    formatted[dayKey.toUpperCase()] = menuObj;
  });
  return formatted;
};

const hasDishes = (formatted: any) => {
  if (!formatted) return false;
  return Object.values(formatted).some((m: any) => (m?.lunch?.length || 0) > 0 || (m?.dinner?.length || 0) > 0);
};

const fetchWeeklyMenu = async (weekStart: string): Promise<any> => {
  try {
    if (weekStart) {
      const { data, error } = await supabase
        .from('weekly_menu')
        .select('*')
        .eq('week_start', weekStart);
      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = formatMenu(data, weekStart);
        if (hasDishes(formatted)) {
          return formatted;
        }
      }
    }

    // Fallback 1: Query the most recent published menu week with rows
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
        const formatted = formatMenu(fallbackData, latestRow.week_start);
        if (hasDishes(formatted)) {
          return formatted;
        }
      }
    }
  } catch (err) {
    console.warn('[useWeeklyMenu] Error fetching menu from Supabase, using default fallback:', err);
  }

  // Fallback 2: Default hardcoded menu so UI never disappears or renders empty
  return formatDefaultMenu(DEFAULT_MENU, weekStart);
};

/**
 * Hook to load the weekly menu.
 *
 * @param weekStart Which week's menu to load (YYYY-MM-DD of that week's Monday).
 *   Defaults to `getSurveyTargetWeek()` (the survey week).
 *   Pass `getCalendarWeekDate()` from menu-display surfaces (Menu page, Today's menu).
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
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['weeklyMenu'] });
        }
      })
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !cancelled) {
          setTimeout(() => queryClient.invalidateQueries({ queryKey: ['weeklyMenu'] }), 3000);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return menu;
};
