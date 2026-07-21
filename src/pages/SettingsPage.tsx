import { useState } from 'react';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, InputNumber,
  Popconfirm, Tag, Space, App, ColorPicker,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useCategoryStore } from '@/stores/categoryStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useAccountStore } from '@/stores/accountStore';
import { supabase } from '@/lib/supabase';
import type { Category, Budget, Account } from '@/types';

// 导出用行类型
interface TransactionExportRow {
  date: string;
  type: string;
  amount: number;
  note: string | null;
  account: { name: string } | null;
  category: { name: string } | null;
}

export default function SettingsPage() {
  return (
    <Tabs
      defaultActiveKey="categories"
      items={[
        { key: 'categories', label: '分类管理', children: <CategorySettings /> },
        { key: 'budget', label: '预算设置', children: <BudgetSettings /> },
        { key: 'accounts', label: '账户管理', children: <AccountSettings /> },
        { key: 'export', label: '数据导出', children: <ExportSettings /> },
      ]}
    />
  );
}

// ==================== 分类管理 ====================
function CategorySettings() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateCategory(editing.id, values);
      message.success('分类已更新');
    } else {
      await addCategory(values);
      message.success('分类已添加');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCategory(id);
    if (result.success) message.success(result.message);
    else message.warning(result.message);
  };

  const columns: ColumnsType<Category> = [
    {
      title: '颜色',
      dataIndex: 'color',
      width: 60,
      render: (color: string) => <span style={{ color, fontSize: 18 }}>●</span>,
    },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: (t: string) => <Tag color={t === 'expense' ? 'red' : 'green'}>{t === 'expense' ? '支出' : '收入'}</Tag>,
    },
    {
      title: '系统预置', dataIndex: 'is_default', key: 'is_default', width: 100,
      render: (v: boolean) => v ? <Tag>预置</Tag> : <Tag color="blue">自定义</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm
            title={record.is_default ? '系统预置分类不可删除' : '确定删除此分类？'}
            onConfirm={() => handleDelete(record.id)}
            okText="删除" cancelText="取消"
            disabled={record.is_default}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={record.is_default} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="分类管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
        添加分类
      </Button>}
    >
      <Table columns={columns} dataSource={categories} rowKey="id" pagination={false} size="middle" />

      <Modal
        title={editing ? '编辑分类' : '添加分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'expense' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="如：聚餐、地铁" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' },
            ]} />
          </Form.Item>
          <Form.Item name="icon" label="图标（Ant Design 图标名）">
            <Input placeholder="如：CoffeeOutlined" />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <ColorPicker format="hex" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// ==================== 预算设置 ====================
function BudgetSettings() {
  const { budgets, setBudget, deleteBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await setBudget({
      category_id: values.category_id || undefined,
      amount: values.amount,
    });
    message.success('预算已保存');
    setModalOpen(false);
  };

  const columns: ColumnsType<Budget> = [
    {
      title: '预算范围', key: 'scope',
      render: (_, r) => r.category_id ? (r.category?.name || '未知分类') : '总预算',
    },
    {
      title: '金额', dataIndex: 'amount', key: 'amount',
      render: (v: number) => <strong>¥{v.toFixed(2)}</strong>,
    },
    { title: '周期', dataIndex: 'period', key: 'period', render: () => '每月' },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Popconfirm title="删除此预算？" onConfirm={async () => { await deleteBudget(record.id); message.success('已删除'); }}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="预算设置"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
        设置预算
      </Button>}
    >
      <Table columns={columns} dataSource={budgets} rowKey="id" pagination={false} size="middle"
        locale={{ emptyText: '尚未设置预算，点击右上角按钮添加' }} />

      <Modal title="设置预算" open={modalOpen} onOk={handleSubmit}
        onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="分类（留空为总预算）">
            <Select
              allowClear
              placeholder="全部分类"
              options={categories.filter((c) => c.type === 'expense').map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="amount" label="月度预算金额" rules={[{ required: true, message: '请输入预算金额' }]}>
            <InputNumber
              prefix="¥"
              min={0}
              max={99999999}
              precision={2}
              style={{ width: '100%' }}
              placeholder="0.00"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// ==================== 账户管理 ====================
function AccountSettings() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccountStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateAccount(editing.id, values);
      message.success('账户已更新');
    } else {
      await addAccount(values);
      message.success('账户已添加');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const columns: ColumnsType<Account> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '余额', dataIndex: 'balance', key: 'balance',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title="确定删除此账户？" onConfirm={async () => {
            const ok = await deleteAccount(record.id);
            if (ok) message.success('已删除');
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="账户管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
        添加账户
      </Button>}
    >
      <Table columns={columns} dataSource={accounts} rowKey="id" pagination={false} size="middle" />

      <Modal title={editing ? '编辑账户' : '添加账户'} open={modalOpen} onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="账户名称" rules={[{ required: true }]}>
            <Input placeholder="如：招商银行卡" />
          </Form.Item>
          <Form.Item name="type" label="账户类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '现金', value: '现金' },
              { label: '银行卡', value: '银行卡' },
              { label: '信用卡', value: '信用卡' },
              { label: '支付宝', value: '支付宝' },
              { label: '微信', value: '微信' },
            ]} />
          </Form.Item>
          <Form.Item name="balance" label="当前余额">
            <InputNumber prefix="¥" precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// ==================== 数据导出 ====================
function ExportSettings() {
  const { message } = App.useApp();

  const exportCSV = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, account:accounts(name), category:categories(name)')
      .order('date', { ascending: false });

    if (error) {
      message.error('导出失败');
      return;
    }

    // BOM 解决中文乱码
    const BOM = '﻿';
    const headers = ['日期', '类型', '分类', '金额', '账户', '备注'];
    const rows = (data as unknown as TransactionExportRow[]).map((t) => [
      t.date,
      t.type === 'expense' ? '支出' : '收入',
      t.category?.name || '',
      t.amount,
      t.account?.name || '',
      t.note || '',
    ]);

    const csv = BOM + [headers, ...rows].map((row) => row.join(',')).join('\n');
    downloadFile(csv, `colin-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    message.success('CSV 导出成功');
  };

  const exportJSON = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, account:accounts(name), category:categories(name)')
      .order('date', { ascending: false });

    if (error) {
      message.error('导出失败');
      return;
    }

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `colin-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    message.success('JSON 导出成功');
  };

  return (
    <Card title="数据导出">
      <p style={{ color: '#666', marginBottom: 24 }}>
        导出所有交易记录。CSV 格式可用 Excel 打开，JSON 格式可用于备份恢复。
      </p>
      <Space size={16}>
        <Button type="primary" icon={<DownloadOutlined />} onClick={exportCSV} size="large">
          导出 CSV
        </Button>
        <Button icon={<DownloadOutlined />} onClick={exportJSON} size="large">
          导出 JSON
        </Button>
      </Space>
    </Card>
  );
}

// 工具函数：触发文件下载
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
