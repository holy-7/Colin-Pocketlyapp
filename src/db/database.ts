import Dexie, { type Table } from 'dexie';
import type { Transaction, Category, Account, Budget } from '@/types';

// ============================================================
// 本地缓存记录（缓存所有从 Supabase 拉取的数据）
// ============================================================
export interface LocalRecord {
  id: string;            // 与 Supabase 相同的 ID
  table: string;         // 'transactions' | 'categories' | 'accounts' | 'budgets'
  userId?: string;       // 所属用户 ID（用于缓存隔离和清除）
  data: unknown;         // 完整的行数据
  updatedAt: string;     // ISO 时间戳（来自 Supabase updated_at 或 created_at）
  syncStatus: 'synced' | 'pending' | 'conflict';
}

// ============================================================
// 离线操作队列
// ============================================================
export interface PendingOperation {
  id?: number;           // 自增 ID
  table: string;         // 'transactions' | 'categories' | 'accounts' | 'budgets'
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;      // 目标记录 ID（INSERT 时预生成）
  payload: unknown;      // 操作数据
  timestamp: number;     // 本地时间戳（用于排序重放）
}

// ============================================================
// 同步元数据
// ============================================================
export interface SyncMeta {
  key: string;           // e.g. 'lastPullTimestamp'
  value: string;
}

// ============================================================
// Dexie 数据库类
// ============================================================
export class ColinDB extends Dexie {
  localRecords!: Table<LocalRecord, string>;
  pendingOps!: Table<PendingOperation, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('ColinDB');
    this.version(2).stores({
      localRecords: '[table+id], table, userId, syncStatus, updatedAt',
      pendingOps: '++id, table, timestamp',
      syncMeta: 'key',
    });
  }
}

export const db = new ColinDB();

// ============================================================
// 类型化的本地缓存操作辅助函数
// ============================================================

function recordKey(table: string, id: string): string {
  return `${table}:${id}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheRecord(table: string, record: any, userId?: string) {
  const timestamp = record.updated_at || record.created_at || new Date().toISOString();
  await db.localRecords.put({
    id: recordKey(table, record.id),
    table,
    userId: userId || record.user_id,
    data: record,
    updatedAt: timestamp,
    syncStatus: 'synced',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheRecords(table: string, records: any[], userId?: string) {
  const rows = records.map((r: any) => ({
    id: recordKey(table, r.id),
    table,
    userId: userId || r.user_id,
    data: r,
    updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
    syncStatus: 'synced' as const,
  }));
  await db.localRecords.bulkPut(rows);
}

export async function getCachedRecords<T>(table: string, userId?: string): Promise<T[]> {
  let records = await db.localRecords
    .where('[table+id]')
    .between([table, ''], [table, '￿'])
    .toArray();

  // 按 userId 过滤（兼容旧数据：userId 为 undefined/null 的记录保留，但不同 userId 的记录排除）
  if (userId) {
    records = records.filter((r) => r.userId === undefined || r.userId === null || r.userId === userId);
  }

  return records.map((r) => r.data as T);
}

export async function getCachedRecord<T>(table: string, id: string): Promise<T | null> {
  const record = await db.localRecords.get(recordKey(table, id));
  return record ? (record.data as T) : null;
}

export async function removeCachedRecord(table: string, id: string) {
  await db.localRecords.delete(recordKey(table, id));
}

export async function addPendingOp(op: Omit<PendingOperation, 'id' | 'timestamp'>) {
  await db.pendingOps.add({ ...op, timestamp: Date.now() });
}

export async function getPendingOps(): Promise<PendingOperation[]> {
  return db.pendingOps.orderBy('timestamp').toArray();
}

export async function clearPendingOp(id: number) {
  await db.pendingOps.delete(id);
}

export async function getPendingCount(): Promise<number> {
  return db.pendingOps.count();
}

export async function setSyncMeta(key: string, value: string) {
  await db.syncMeta.put({ key, value });
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const meta = await db.syncMeta.get(key);
  return meta ? meta.value : null;
}

// ============================================================
// 清除所有本地缓存（登出时调用）
// ============================================================
export async function clearAllCache() {
  await db.localRecords.clear();
  await db.pendingOps.clear();
  await db.syncMeta.clear();
}
