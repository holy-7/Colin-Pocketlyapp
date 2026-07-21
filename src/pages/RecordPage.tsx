import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Input, Select, DatePicker, Popconfirm, App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import TransactionForm from '@/components/TransactionForm';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import type { Transaction, TransactionFormData, TransactionFilter, TransactionType } from '@/types';

const { RangePicker } = DatePicker;

export default function RecordPage() {
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
