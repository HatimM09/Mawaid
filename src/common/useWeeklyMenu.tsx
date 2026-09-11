import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/firebaseClient';
import { getSurveyTargetWeek, parseDishArray, DAYS } from './utils';
import { queryKeys } from '../lib/queryClient';
import { DEFAULT_MENU } from './constants';

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

  // Guarantee every day in DAYS has an entry so accessing menu[day].lunch never crashes
  DAYS.forEach(d => {
    const dk = d.toLowerCase();
    if (!formatted[dk]) {
      const capName = d.charAt(0).toUpperCase() + d.slice(1);
      const emptyObj = {
        en: capName,
        ar: '',
        lunch: [],
        dinner: [],
        week_start: weekId || '',
        publish_at: '',
      };
      formatted[dk] = emptyObj;
      formatted[capName] = emptyObj;
      formatted[dk.slice(0, 3)] = emptyObj;
      formatted[dk.toUpperCase()] = emptyObj;
    }
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

    // Fallback 1: Only use latest published menu when NO explicit week was requested.
    // For an explicit week_start (e.g., W2 in fortnight) we must NOT return W1's menu mis-labeled as W2 — return empty/default for that week instead.
    if (!weekStart) {
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
 *   Pass an array [W1,W2] for 2-week cadence to load both weeks merged.
 */
export const useWeeklyMenu = (weekStart: string | string[] = getSurveyTargetWeek()) => {
  const queryClient = useQueryClient();
  const isMulti = Array.isArray(weekStart)

  const primaryKey = isMulti ? (weekStart as string[])[0] : (weekStart as string)
  const queryKey = queryKeys.weeklyMenu(isMulti ? (weekStart as string[]).join(',') : primaryKey)

  const fetchFn = async () => {
    if (isMulti) {
      const weeks = weekStart as string[]
      const results = await Promise.all(weeks.map(w => fetchWeeklyMenu(w)))
      // Merge into map keyed by weekId
      const merged: any = { __multi: true, __weeks: weeks }
      for (let i = 0; i < weeks.length; i++) {
        merged[weeks[i]] = results[i]
        // also expose convenience: if we request dual, default still accessible
      }
      // also keep flat combined for backwards compat (primary week)
      Object.assign(merged, results[0])
      merged.__byWeek = {}
      weeks.forEach((w, i) => { merged.__byWeek[w] = results[i] })
      return merged
    }
    return fetchWeeklyMenu(primaryKey)
  }

  const { data: menu = {} } = useQuery({
    queryKey,
    queryFn: fetchFn,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    let cancelled = false;
    // Use unique channel per hook instance to avoid "cannot add postgres_changes after subscribe()" when multiple components mount (SurveyPage + Profile + Admin)
    const channelName = `weekly-menu-changes-${primaryKey}-${Math.random().toString(36).slice(2, 7)}`;
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
  }, [queryClient, primaryKey]);

  return menu;
};

// Helper to resolve menu for a specific (weekId, day) even in multi mode
export const getMenuForWeekDay = (weeklyMenu: any, weekId: string, day: string) => {
  if (!weeklyMenu) return { lunch: [], dinner: [] }
  if (weeklyMenu.__byWeek && weeklyMenu.__byWeek[weekId]) {
    const w = weeklyMenu.__byWeek[weekId]
    return w?.[day] || w?.[day.toLowerCase()] || w?.[day.substring(0,3).toLowerCase()] || { lunch: [], dinner: [] }
  }
  return weeklyMenu?.[day] || weeklyMenu?.[day.toLowerCase()] || weeklyMenu?.[day.substring(0,3).toLowerCase()] || { lunch: [], dinner: [] }
}
