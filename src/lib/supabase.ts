import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Supabase 项目配置（通过 VITE_ 环境变量注入，见 .env / .env.example）
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
