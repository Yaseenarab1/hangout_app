import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type Config<T> = {
  channelName: string;
  table: string;
  filter?: string;
  event?: Event;
  enabled?: boolean;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (row: T) => void;
};

export function useRealtimeChannel<T>(config: Config<T>): void {
  const {
    channelName,
    table,
    filter,
    event = '*',
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
  } = config;

  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = () => {
    if (!enabled) return;

    const ch = supabase.channel(channelName);

    ch.on(
      'postgres_changes' as any,
      {
        event,
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      },
      (payload: any) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        if (eventType === 'INSERT' && onInsert) onInsert(newRow as T);
        if (eventType === 'UPDATE' && onUpdate) onUpdate(newRow as T);
        if (eventType === 'DELETE' && onDelete) onDelete(oldRow as T);
      },
    );

    ch.subscribe((status: string) => {
      console.log(`[realtime] ${channelName}: ${status}`);
    });

    channelRef.current = ch;
  };

  const unsubscribe = () => {
    if (channelRef.current) {
      const ch = channelRef.current;
      channelRef.current = null;
      // Synchronously evict from the channels array before the async removeChannel
      // resolves, preventing supabase.channel() from returning a stale subscribed
      // channel on the next subscribe() call.
      supabase.realtime.channels = supabase.realtime.channels.filter((c) => c !== ch);
      supabase.removeChannel(ch);
    }
  };

  // Reconnect when app comes back to foreground
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        unsubscribe();
        subscribe();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter, event, enabled]);

  useEffect(() => {
    subscribe();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter, event, enabled]);
}
