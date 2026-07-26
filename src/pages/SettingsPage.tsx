import { useState } from 'react';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, InputNumber,
  Popconfirm, Tag, Space, App, ColorPicker,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, RightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useResponsive } from '@/hooks/useResponsive';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import MobileHeader from '@/components/MobileHeader';
import { getCategoryIcon } from '@/utils/categoryIcons';
import {
  fetchAllTransactionsForExport,
  exportToExcel,
  exportToPDF,
  exportToCSV,
  exportToJSON,
} from '@/services/exportService';
import type { ExportRow } from '@/services/exportService';
import type { Category, Account } from '@/types';

export default function SettingsPage() {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return <MobileProfileView />;
  }

  return (
    <Tabs
      defaultActiveKey="categories"
      items={[
        { key: 'categories', label: '分类管理', children: <CategorySettings /> },
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
      render: (_color: string, record: Category) => (
        getCategoryIcon(record.name, record.color || '#999', 20) || <span style={{ color: record.color || '#999', fontSize: 18 }}>●</span>
      ),
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
        destroyOnHidden
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
        onCancel={() => { setModalOpen(false); setEditing(null); }} destroyOnHidden>
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
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'xlsx' | 'pdf' | 'csv' | 'json') => {
    setExporting(type);
    try {
      const rows: ExportRow[] = await fetchAllTransactionsForExport();
      switch (type) {
        case 'xlsx': exportToExcel(rows); message.success('Excel 导出成功'); break;
        case 'pdf': exportToPDF(rows); message.success('PDF 导出成功'); break;
        case 'csv': exportToCSV(rows); message.success('CSV 导出成功'); break;
        case 'json': exportToJSON(rows); message.success('JSON 导出成功'); break;
      }
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card title="数据导出">
      <p style={{ color: '#666', marginBottom: 24 }}>
        导出所有交易明细，支持 Excel (.xlsx)、PDF、CSV 和 JSON 四种格式。
      </p>
      <Space size={16} wrap>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => handleExport('xlsx')}
          size="large"
          loading={exporting === 'xlsx'}
          style={{ background: '#FFD93D', borderColor: '#FFD93D', color: '#333', fontWeight: 600 }}
        >
          导出 Excel (.xlsx)
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => handleExport('pdf')}
          size="large"
          loading={exporting === 'pdf'}
        >
          导出 PDF
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => handleExport('csv')}
          size="large"
          loading={exporting === 'csv'}
        >
          导出 CSV
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => handleExport('json')}
          size="large"
          loading={exporting === 'json'}
        >
          导出 JSON
        </Button>
      </Space>
    </Card>
  );
}

// ============================================================
// 移动端个人中心（"我的"）
// ============================================================

function MobileProfileView() {
  const { categories } = useCategoryStore();
  const { accounts } = useAccountStore();
  const { totalCount, transactions } = useTransactionStore();
  const [activeView, setActiveView] = useState<'menu' | 'categories' | 'accounts' | 'export'>('menu');

  // 统计天数
  const uniqueDays = new Set(transactions.map((t) => t.date)).size;

  if (activeView === 'categories') {
    return (
      <MobileSettingsSheet title="分类管理" onBack={() => setActiveView('menu')}>
        <MobileCategoryManager categories={categories} />
      </MobileSettingsSheet>
    );
  }

  if (activeView === 'accounts') {
    return (
      <MobileSettingsSheet title="账户管理" onBack={() => setActiveView('menu')}>
        <MobileAccountList accounts={accounts} />
      </MobileSettingsSheet>
    );
  }

  if (activeView === 'export') {
    return (
      <MobileSettingsSheet title="数据导出" onBack={() => setActiveView('menu')}>
        <MobileExportView />
      </MobileSettingsSheet>
    );
  }

  // 主菜单
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
      {/* 黄色个人头部 */}
      <MobileHeader style={{ padding: '20px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="#F5A623" width="30" height="30">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>小鲸记账</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>
              Colin记账 V1.0.0
            </div>
          </div>
        </div>

        {/* 统计行 */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{uniqueDays}</span>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>记账天数</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{totalCount}</span>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>记账笔数</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{accounts.length}</span>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>账户数</span>
          </div>
        </div>
      </MobileHeader>

      {/* 菜单列表 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 80px 12px' }}>
        {/* 功能菜单 */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
          <MobileMenuItem
            label="分类管理"
            subtitle={`${categories.length}个分类`}
            onClick={() => setActiveView('categories')}
          />
          <MobileMenuItem
            label="账户管理"
            subtitle={`${accounts.length}个账户`}
            onClick={() => setActiveView('accounts')}
          />
          <MobileMenuItem
            label="数据导出"
            subtitle="Excel / PDF / CSV / JSON"
            onClick={() => setActiveView('export')}
          />
        </div>

        {/* 关于 */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
          <MobileMenuItem
            label="关于小鲸记账"
            subtitle="V1.0.0"
            onClick={() => {}}
            last
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 移动端子页面容器
// ============================================================

function MobileSettingsSheet({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
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
      <MobileHeader
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <svg viewBox="0 0 1024 1024" width={20} height={20} fill="#333">
            <path d="M20.650667 509.5424l283.306666 281.873067a62.532267 62.532267 0 0 0 88.200534 0c24.3712-24.234667 24.3712-63.488 0-87.790934L215.381333 527.735467h746.1888a62.293333 62.293333 0 0 0 62.395734-62.088534c0-34.338133-27.886933-62.122667-62.395734-62.122666H215.4496l176.776533-175.8208a61.952 61.952 0 0 0 0-87.825067 62.395733 62.395733 0 0 0-44.168533-18.2272c-15.9744 0-31.914667 6.075733-44.100267 18.2272l-283.306666 281.9072a61.781333 61.781333 0 0 0 0 87.7568z" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#333' }}>{title}</span>
      </MobileHeader>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 80px 12px' }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// 菜单项
// ============================================================

function MobileMenuItem({
  label,
  subtitle,
  onClick,
  last,
}: {
  label: string;
  subtitle?: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid #f5f5f5',
        fontSize: 14,
        color: '#333',
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {subtitle && <span style={{ fontSize: 12, color: '#999' }}>{subtitle}</span>}
        <RightOutlined style={{ fontSize: 12, color: '#ccc' }} />
      </div>
    </div>
  );
}

// ============================================================
// 移动端分类管理（含增删改）
// ============================================================

function MobileCategoryManager({ categories }: { categories: Category[] }) {
  const { addCategory, updateCategory, deleteCategory } = useCategoryStore();
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

  const isSystemPreset = (cat: Category) => cat.is_default;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 添加按钮 */}
        <button
          onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
          style={{
            border: '2px dashed #FFD93D',
            background: '#FFFDE7',
            padding: '14px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            color: '#F5A623',
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          ＋ 添加分类
        </button>

        {/* 分类卡片列表 */}
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 12,
              background: '#fff',
              borderRadius: 12,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: cat.color ? `${cat.color}20` : '#FFF8E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: cat.color || '#F5A623',
                flexShrink: 0,
              }}
            >
              {getCategoryIcon(cat.name, cat.color || '#F5A623', 22) || cat.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{cat.name}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: cat.type === 'expense' ? '#FFF0F0' : '#F0FFF4',
                  color: cat.type === 'expense' ? '#E74C3C' : '#27AE60',
                  marginRight: 6,
                }}>
                  {cat.type === 'expense' ? '支出' : '收入'}
                </span>
                {isSystemPreset(cat) ? '系统预置' : '自定义'}
              </div>
            </div>
            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => { setEditing(cat); form.setFieldsValue(cat); setModalOpen(true); }}
                style={{
                  border: 'none',
                  background: '#f5f5f5',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✎
              </button>
              <Popconfirm
                title={isSystemPreset(cat) ? '系统预置分类不可删除' : '确定删除此分类？'}
                onConfirm={() => handleDelete(cat.id)}
                okText="删除" cancelText="取消"
                disabled={isSystemPreset(cat)}
              >
                <button
                  disabled={isSystemPreset(cat)}
                  style={{
                    border: 'none',
                    background: '#FFF0F0',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: isSystemPreset(cat) ? 'not-allowed' : 'pointer',
                    color: isSystemPreset(cat) ? '#ccc' : '#E74C3C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isSystemPreset(cat) ? 0.4 : 1,
                  }}
                >
                  ✕
                </button>
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editing ? '编辑分类' : '添加分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnHidden
        okText="保存"
        cancelText="取消"
        centered
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
          <Form.Item name="color" label="颜色">
            <ColorPicker format="hex" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ============================================================
// 移动端账户列表
// ============================================================

function MobileAccountList({ accounts }: { accounts: Account[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {accounts.map((acct) => (
        <div
          key={acct.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 12,
            background: '#fff',
            borderRadius: 12,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#FFF8E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: '#F5A623',
            }}
          >
            {acct.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{acct.name}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{acct.type}</div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
            ¥{acct.balance.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 移动端数据导出
// ============================================================

function MobileExportView() {
  const { message } = App.useApp();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: 'xlsx' | 'pdf' | 'csv' | 'json') => {
    setExporting(type);
    try {
      const rows: ExportRow[] = await fetchAllTransactionsForExport();
      switch (type) {
        case 'xlsx': exportToExcel(rows); message.success('Excel 导出成功'); break;
        case 'pdf': exportToPDF(rows); message.success('PDF 导出成功'); break;
        case 'csv': exportToCSV(rows); message.success('CSV 导出成功'); break;
        case 'json': exportToJSON(rows); message.success('JSON 导出成功'); break;
      }
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  const btnStyle = (isPrimary?: boolean): React.CSSProperties => ({
    border: 'none',
    background: isPrimary ? '#FFD93D' : '#fff',
    padding: '14px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    cursor: exporting ? 'wait' : 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
        导出所有交易明细。支持 Excel (.xlsx)、PDF、CSV 和 JSON 四种格式。
      </p>
      <button onClick={() => handleExport('xlsx')} style={btnStyle(true)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'xlsx' ? '导出中…' : '导出 Excel (.xlsx)'}
      </button>
      <button onClick={() => handleExport('pdf')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'pdf' ? '导出中…' : '导出 PDF'}
      </button>
      <button onClick={() => handleExport('csv')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'csv' ? '导出中…' : '导出 CSV'}
      </button>
      <button onClick={() => handleExport('json')} style={btnStyle(false)} disabled={!!exporting}>
        <DownloadOutlined />
        {exporting === 'json' ? '导出中…' : '导出 JSON'}
      </button>
    </div>
  );
}

// 工具函数已迁移至 src/services/exportService.ts
