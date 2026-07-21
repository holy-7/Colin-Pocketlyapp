import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Supabase 项目配置
const SUPABASE_URL = 'https://hawungoiwtnbjmqqenpi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XWpshR1WXwisy4unHXlq2g_RQ8FQi_X';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// 初始化：检查连接
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('categories').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
