import { supabase } from '@/lib/supabase';
import {
  db, cacheRecord, cacheRecords, getCachedRecords,
  removeCachedRecord, addPendingOp, getPendingOps,
  clearPendingOp, getPendingCount, setSyncMeta, getSyncMeta,
} from '@/db/database';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================
// 类型
// ============================================================
export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  hasConflict: boolean;
}

type StatusListener = (status: SyncStatus) => void;
type ConflictListener = (info: { table: string; recordId: string; message: string }) => void;

// ============================================================
// SyncManager 单例
// ============================================================
export class SyncManager {
  private channels: RealtimeChannel[] = [];
  private statusListeners: Set<StatusListener> = new Set();
  private conflictListeners: Set<ConflictListener> = new Set();
  private _pendingCount = 0;
  private _syncing = false;
  private _lastSyncAt: string | null = null;
  private _hasConflict = false;
  private _initialized = false;

  // ============================================================
  // 初始化与销毁
  // ============================================================
  async initialize() {
    // 防止 React Strict Mode 下重复初始化
    if (this._initialized) return;
    this._initialized = true;

    // 监听网络状态
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // 初始化 pending 计数
    this._pendingCount = await getPendingCount();

    // 订阅 Realtime
    this.subscribeToRealtime();

    // 上线时立即推送积压操作
    if (navigator.onLine) {
      await this.pushPendingOps();
    }

    this.notifyListeners();
  }

  destroy() {
    if (!this._initialized) return;
    this._initialized = false;

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.channels.forEach((ch) => {
      supabase.removeChannel(ch).catch(() => {});
    });
    this.channels = [];
    this.statusListeners.clear();
    this.conflictListeners.clear();
  }

  // ============================================================
  // 网络事件
  // ============================================================
  private handleOnline = async () => {
    await this.pushPendingOps();
    this.notifyListeners();
  };

  private handleOffline = () => {
    this.notifyListeners();
  };

  // ============================================================
  // 获取当前状态
  // ============================================================
  getStatus(): SyncStatus {
    return {
      isOnline: navigator.onLine,
      pendingCount: this._pendingCount,
      syncing: this._syncing,
      lastSyncAt: this._lastSyncAt,
      hasConflict: this._hasConflict,
    };
  }

  // ============================================================
  // 状态监听
  // ============================================================
  onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConflict(listener: ConflictListener) {
    this.conflictListeners.add(listener);
    return () => this.conflictListeners.delete(listener);
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => fn(status));
  }

  // ============================================================
  // 通用写操作：本地优先 → Supabase → 失败入队
  // ============================================================
  async writeOptimistic(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    payload?: unknown,
  ) {
    // Step 1: 写入本地缓存（INSERT 和 UPDATE 需要 payload）
    if (operation !== 'DELETE' && payload) {
      await cacheRecord(table, payload as { id: string; updated_at?: string });
    } else if (operation === 'DELETE') {
      await removeCachedRecord(table, recordId);
    }

    // Step 2: 尝试写 Supabase
    if (!navigator.onLine) {
      // 离线 → 入队
      await addPendingOp({ table, operation, recordId, payload });
      this._pendingCount = await getPendingCount();
      this.notifyListeners();
      return;
    }

    let success = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase.from(table) as any;
      if (operation === 'INSERT' && payload) {
        const { error } = await client.insert(payload);
        success = !error;
      } else if (operation === 'UPDATE' && payload) {
        const { id, ...rest } = payload as Record<string, unknown>;
        const { error } = await client.update(rest).eq('id', recordId);
        success = !error;
      } else if (operation === 'DELETE') {
        const { error } = await client.delete().eq('id', recordId);
        success = !error;
      }
    } catch {
      success = false;
    }

    if (!success) {
      // 网络失败 → 入队
      await addPendingOp({ table, operation, recordId, payload });
      this._pendingCount = await getPendingCount();
    }

    this.notifyListeners();
  }

  // ============================================================
  // 冲刷积压操作
  // ============================================================
  async pushPendingOps() {
    if (this._syncing) return;
    this._syncing = true;
    this.notifyListeners();

    try {
      const ops = await getPendingOps();
      if (ops.length === 0) {
        this._lastSyncAt = new Date().toISOString();
        await setSyncMeta('lastPullTimestamp', this._lastSyncAt);
        return;
      }

      for (const op of ops) {
        if (!navigator.onLine) break;

        let success = false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const client = supabase.from(op.table) as any;
          if (op.operation === 'INSERT' && op.payload) {
            const { error } = await client.insert(op.payload);
            success = !error;
          } else if (op.operation === 'UPDATE' && op.payload) {
            const { id, ...rest } = op.payload as Record<string, unknown>;
            const { error } = await client.update(rest).eq('id', op.recordId);
            success = !error;
          } else if (op.operation === 'DELETE') {
            const { error } = await client.delete().eq('id', op.recordId);
            success = !error;
          }

          if (success && op.id !== undefined) {
            await clearPendingOp(op.id);
          }
        } catch {
          // 单条失败不影响后续重试
        }
      }

      this._pendingCount = await getPendingCount();
      this._lastSyncAt = new Date().toISOString();
      await setSyncMeta('lastPullTimestamp', this._lastSyncAt);
    } finally {
      this._syncing = false;
      this.notifyListeners();
    }
  }

  // ============================================================
  // 从远端拉取变更（启动时调用）
  // ============================================================
  async pullRemoteChanges(table: string) {
    const lastPull = await getSyncMeta('lastPullTimestamp');
    let query = supabase.from(table).select('*');

    if (lastPull) {
      // 只拉取上次同步后变更的记录
      query = query.or(`created_at.gt.${lastPull},updated_at.gt.${lastPull}`);
    }

    const { data, error } = await query;
    if (error || !data) return;

    await cacheRecords(table, data as Array<{ id: string }>);
  }

  // ============================================================
  // 初始化时加载缓存到内存（供 Store 使用）
  // ============================================================
  async loadFromCache<T>(table: string): Promise<T[]> {
    return getCachedRecords<T>(table);
  }

  // ============================================================
  // Realtime 订阅
  // ============================================================
  private subscribeToRealtime() {
    const tables = ['transactions', 'categories', 'accounts', 'budgets'] as const;
    // 用随机后缀避免 Vite HMR / Strict Mode 下同名 channel 冲突
    const suffix = Math.random().toString(36).slice(2, 8);

    for (const table of tables) {
      const channel = supabase
        .channel(`${table}-changes-${suffix}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => this.handleRealtimeChange(table, payload),
        )
        .subscribe();

      this.channels.push(channel);
    }
  }

  private async handleRealtimeChange(
    table: string,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ) {
    const record = payload.new as { id: string; updated_at?: string; created_at?: string } | null;
    const oldRecord = payload.old as { id: string } | null;
    const recordId = (record?.id || oldRecord?.id) || '';

    // 检查是否有本地 pending 操作（本地优先）
    const pendingOps = await getPendingOps();
    const hasLocalPending = pendingOps.some(
      (op) => op.table === table && op.recordId === recordId,
    );

    if (hasLocalPending) {
      // 本地有未同步的变更 → 标记冲突
      this._hasConflict = true;
      this.conflictListeners.forEach((fn) =>
        fn({
          table,
          recordId,
          message: `数据冲突：${table}/${recordId} 已被另一设备修改`,
        }),
      );
      this.notifyListeners();
      return;
    }

    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      if (record) {
        await cacheRecord(table, record as { id: string; updated_at?: string });
      }
    } else if (payload.eventType === 'DELETE') {
      if (oldRecord) {
        await removeCachedRecord(table, oldRecord.id);
      }
    }

    this._lastSyncAt = new Date().toISOString();
    this.notifyListeners();
  }
}

// ============================================================
// 全局单例
// ============================================================
export const syncManager = new SyncManager();
