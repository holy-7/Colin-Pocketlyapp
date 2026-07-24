import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Input, Select, DatePicker, Popconfirm, App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import TransactionForm from '@/components/TransactionForm';
import MonthPickerSheet from '@/components/MonthPickerSheet';
import { useResponsive } from '@/hooks/useResponsive';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { MOBILE_INCOME_COLOR } from '@/theme/mobileTokens';
import type { Transaction, TransactionFormData, TransactionFilter, TransactionType } from '@/types';

const { RangePicker } = DatePicker;

export default function RecordPage() {
  const { isMobile } = useResponsive();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const { message } = App.useApp();

  const {
    transactions, loading, totalCount,
    fetchTransactions, addTransaction, updateTransaction, deleteTransaction,
    setFilter, clearFilter,
  } = useTransactionStore();
  const { categories } = useCategoryStore();

  useEffect(() => {
    fetchTransactions(page, pageSize);
  }, [page, fetchTransactions]);

  const handleFilterChange = useCallback(
    (newFilter: Partial<TransactionFilter>) => {
      setFilter(newFilter);
      setPage(1);
      setTimeout(() => fetchTransactions(1, pageSize), 0);
    },
    [setFilter, fetchTransactions]
  );

  const handleAdd = async (data: TransactionFormData) => {
    await addTransaction(data);
    fetchTransactions(page, pageSize);
  };

  const handleEdit = async (data: TransactionFormData) => {
    if (!editingTransaction) return;
    await updateTransaction(editingTransaction.id, data);
    setEditingTransaction(null);
    fetchTransactions(page, pageSize);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteTransaction(id);
    if (ok) message.success('删除成功');
    fetchTransactions(page, pageSize);
  };

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || '未知';

  // ==================== Mobile ====================
  if (isMobile) {
    return (
      <MobileTransactionList
        categories={categories}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        editingTransaction={editingTransaction}
        setEditingTransaction={setEditingTransaction}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
      />
    );
  }

  // ==================== Desktop (unchanged) ====================

  const columns: ColumnsType<Transaction> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a, b) => a.date.localeCompare(b.date),
      render: (date: string) => dayjs(date).format('MM-DD ddd'),
    },
    {
      title: '分类',
      dataIndex: 'category_id',
      key: 'category',
      width: 100,
      render: (id: string, record) => (
        <Tag color={record.category?.color || undefined}>
          {record.category?.name || getCategoryName(id)}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'expense' ? 'red' : 'green'}>
          {type === 'expense' ? '支出' : '收入'}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (amount: number, record) => (
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          color: record.type === 'expense' ? '#E74C3C' : '#27AE60',
        }}>
          {record.type === 'expense' ? '-' : '+'}¥{amount.toFixed(2)}
        </span>
      ),
    },
    {
      title: '账户',
      dataIndex: 'account_id',
      key: 'account',
      width: 100,
      render: (_id, record) => record.account?.name || '-',
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (note: string | null) => note || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingTransaction(record);
              setFormOpen(true);
            }}
          />
          <Popconfirm
            title="确定删除这笔交易？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          placeholder="交易类型"
          allowClear
          style={{ width: 120 }}
          onChange={(val) => handleFilterChange({ type: val as TransactionType | undefined })}
          options={[
            { label: '支出', value: 'expense' },
            { label: '收入', value: 'income' },
          ]}
        />
        <Select
          placeholder="分类"
          allowClear
          style={{ width: 150 }}
          onChange={(val) => handleFilterChange({ category_id: val })}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <RangePicker
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              handleFilterChange({
                date_from: dates[0].format('YYYY-MM-DD'),
                date_to: dates[1].format('YYYY-MM-DD'),
              });
            } else {
              handleFilterChange({ date_from: undefined, date_to: undefined });
            }
          }}
        />
        <Input
          placeholder="搜索备注..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          allowClear
          onPressEnter={(e) => handleFilterChange({ keyword: (e.target as HTMLInputElement).value })}
        />
        <Button onClick={clearFilter}>重置筛选</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTransaction(null); setFormOpen(true); }}>
          记一笔
        </Button>
      </div>

      {/* 交易表格 */}
      <Table
        columns={columns}
        dataSource={transactions}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: totalCount,
          showTotal: (total) => `共 ${total} 笔交易`,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: '还没有记账，点右上角"记一笔"开始',
        }}
        scroll={{ x: 800 }}
        size="middle"
      />

      {/* 记账弹窗 */}
      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTransaction(null); }}
        onSubmit={editingTransaction ? handleEdit : handleAdd}
        initialValues={
          editingTransaction
            ? {
                account_id: editingTransaction.account_id,
                category_id: editingTransaction.category_id,
                amount: String(editingTransaction.amount),
                type: editingTransaction.type,
                date: editingTransaction.date,
                note: editingTransaction.note || '',
              }
            : undefined
        }
        title={editingTransaction ? '编辑交易' : '记一笔'}
      />
    </div>
  );
}

// ============================================================
// 移动端账单汇总表
// ============================================================

interface MobileTransactionListProps {
  categories: { id: string; name: string; color?: string | null }[];
  onAdd: (data: TransactionFormData) => Promise<void>;
  onEdit: (data: TransactionFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  editingTransaction: Transaction | null;
  setEditingTransaction: (t: Transaction | null) => void;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
}

function MobileTransactionList({
  categories,
  onAdd, onEdit, onDelete,
  editingTransaction, setEditingTransaction,
  formOpen, setFormOpen,
}: MobileTransactionListProps) {
  const [billMode, setBillMode] = useState<'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // 始终加载整年数据
  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      const store = useTransactionStore.getState();
      const y = selectedDate.year();
      try {
        const data = await store.getTransactionsByDateRange(
          `${y}-01-01`, `${y}-12-31`
        );
        setTransactions(data);
      } catch {
        setTransactions([]);
      }
      setDataLoading(false);
    };
    load();
  }, [selectedDate]);

  const refreshData = async () => {
    const store = useTransactionStore.getState();
    const y = selectedDate.year();
    try {
      const data = await store.getTransactionsByDateRange(`${y}-01-01`, `${y}-12-31`);
      setTransactions(data);
    } catch { /* ignore */ }
  };

  const handleSubmit = async (data: TransactionFormData) => {
    if (editingTransaction) {
      await onEdit(data);
      setEditingTransaction(null);
    } else {
      await onAdd(data);
    }
    refreshData();
  };

  // ---- 月账单：按月汇总 ----
  type MonthRow = { month: number; income: number; expense: number };
  const monthRows: MonthRow[] = useMemo(() => {
    const now = dayjs();
    const isCurrentYear = selectedDate.year() === now.year();
    const maxMonth = isCurrentYear ? now.month() + 1 : 12;

    const map = new Map<number, { income: number; expense: number }>();
    for (let m = 1; m <= maxMonth; m++) map.set(m, { income: 0, expense: 0 });
    for (const t of transactions) {
      const m = parseInt(t.date.substring(5, 7), 10);
      const entry = map.get(m);
      if (entry) {
        if (t.type === 'income') entry.income += t.amount;
        else entry.expense += t.amount;
      }
    }
    return Array.from(map.entries()).map(([month, v]) => ({
      month, income: v.income, expense: v.expense,
    })).reverse();
  }, [transactions, selectedDate]);

  // ---- 年账单：整年汇总 ----
  const yearIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#F5F5F5',
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      {/* 白底顶栏：年份选择 + 月/年切换 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => setPickerOpen(true)}
          style={{ display: 'flex', alignItems: 'baseline', gap: 2, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: '#333', lineHeight: 1 }}>
            {selectedDate.format('YYYY')}年
          </span>
          <svg width="10" height="6" viewBox="0 0 10 6" style={{ marginLeft: 4 }}>
            <path d="M0 0l5 6 5-6z" fill="#999" />
          </svg>
        </div>

        <div
          style={{
            display: 'flex',
            border: '1.5px solid #333',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setBillMode('month')}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: billMode === 'month' ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              background: billMode === 'month' ? '#333' : '#fff',
              color: billMode === 'month' ? '#fff' : '#333',
              outline: 'none',
              borderRight: '1px solid #333',
            }}
          >
            月账单
          </button>
          <button
            onClick={() => setBillMode('year')}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: billMode === 'year' ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              background: billMode === 'year' ? '#333' : '#fff',
              color: billMode === 'year' ? '#fff' : '#333',
              outline: 'none',
            }}
          >
            年账单
          </button>
        </div>
      </div>

      {/* 黄底摘要区 */}
      <div
        style={{
          background: '#FFD93D',
          borderRadius: '0 0 20px 20px',
          padding: '16px 20px 20px',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: 2 }}>年结余</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#333', marginBottom: 12 }}>
          ¥{(yearIncome - yearExpense).toFixed(2)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
            年收入{' '}
            <span style={{ fontWeight: 600, color: '#333', fontSize: 16 }}>
              ¥{yearIncome.toFixed(2)}
            </span>
          </span>
          <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
            年支出{' '}
            <span style={{ fontWeight: 600, color: '#333', fontSize: 16 }}>
              ¥{yearExpense.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      {/* 汇总表 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 16px 12px' }}>
        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>暂无交易记录</div>
          </div>
        ) : billMode === 'month' ? (
          /* ========== 月账单汇总表 ========== */
          <div>
            {/* 表头 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '8px 4px',
                fontSize: 12,
                color: '#999',
                textAlign: 'center',
              }}
            >
              <span>月份</span>
              <span>月收入</span>
              <span>月支出</span>
              <span>月结余</span>
            </div>

            {monthRows.map((row) => {
              const balance = row.income - row.expense;
              return (
                <div
                  key={row.month}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    padding: '14px 4px',
                    background: '#fff',
                    borderRadius: 12,
                    marginBottom: 6,
                    textAlign: 'center',
                    fontSize: 14,
                    color: '#333',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{row.month}月</span>
                  <span style={{ color: '#D4A017' }}>¥{row.income.toFixed(2)}</span>
                  <span>¥{row.expense.toFixed(2)}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: balance >= 0 ? '#27AE60' : '#E74C3C',
                    }}
                  >
                    ¥{balance.toFixed(2)}
                  </span>
                </div>
              );
            })}

          </div>
        ) : (
          /* ========== 年账单汇总表 ========== */
          <div>
            {/* 表头 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '8px 4px',
                fontSize: 12,
                color: '#999',
                textAlign: 'center',
              }}
            >
              <span>年份</span>
              <span>年收入</span>
              <span>年支出</span>
              <span>年结余</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '16px 4px',
                background: '#fff',
                borderRadius: 12,
                marginBottom: 6,
                textAlign: 'center',
                fontSize: 14,
                color: '#333',
              }}
            >
              <span style={{ fontWeight: 500 }}>{selectedDate.format('YYYY')}年</span>
              <span style={{ color: '#D4A017' }}>¥{yearIncome.toFixed(2)}</span>
              <span>¥{yearExpense.toFixed(2)}</span>
              <span
                style={{
                  fontWeight: 600,
                  color: yearIncome - yearExpense >= 0 ? '#27AE60' : '#E74C3C',
                }}
              >
                ¥{(yearIncome - yearExpense).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 记账弹窗 */}
      <TransactionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleSubmit}
        initialValues={
          editingTransaction
            ? {
                account_id: editingTransaction.account_id,
                category_id: editingTransaction.category_id,
                amount: String(editingTransaction.amount),
                type: editingTransaction.type,
                date: editingTransaction.date,
                note: editingTransaction.note || '',
              }
            : undefined
        }
        title={editingTransaction ? '编辑交易' : '记一笔'}
      />

      {/* 年份选择底部弹出层（只选年份） */}
      <MonthPickerSheet
        open={pickerOpen}
        value={selectedDate}
        onChange={setSelectedDate}
        onClose={() => setPickerOpen(false)}
        yearOnly
      />
    </div>
  );
}
