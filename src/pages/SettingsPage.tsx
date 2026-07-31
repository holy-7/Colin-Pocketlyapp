import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, InputNumber,
  Popconfirm, Tag, Space, App, ColorPicker, Badge, message as antMessage,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, CrownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/authStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import MobileHeader from '@/components/MobileHeader';
import {
  MobileSettingsSheet,
  MobileCategoryManager,
  MobileAccountList,
  MobileExportView,
} from '@/components/MobileSettings';
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
  const [activeTab, setActiveTab] = useState('categories');

  if (isMobile) {
    return <MobileProfileView />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'categories', label: '分类管理' },
          { key: 'accounts', label: '账户管理' },
          { key: 'export', label: '数据导出' },
        ]}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'categories' && <CategorySettings />}
        {activeTab === 'accounts' && <AccountSettings />}
        {activeTab === 'export' && <ExportSettings />}
      </div>
    </div>
  );
}

// ==================== 分类管理 ====================
function CategorySettings() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(400);

  useLayoutEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const calc = () => {
      const h = wrapper.clientHeight;
      if (h > 0) setTableScrollY(h - 119);
    };
    calc();
    const ro = new ResizeObserver(() => calc());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

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
    <div ref={tableWrapperRef} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card
        title="分类管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          添加分类
        </Button>}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden', padding: 24 } }}
      >
        <Table columns={columns} dataSource={categories} rowKey="id" pagination={{ pageSize: 50 }} size="middle" scroll={{ y: tableScrollY }} />

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
    </div>
  );
}

// ==================== 账户管理 ====================
function AccountSettings() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccountStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(400);

  useLayoutEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const calc = () => {
      const h = wrapper.clientHeight;
      if (h > 0) setTableScrollY(h - 119);
    };
    calc();
    const ro = new ResizeObserver(() => calc());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

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
    <div ref={tableWrapperRef} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card
        title="账户管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          添加账户
        </Button>}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden', padding: 24 } }}
      >
        <Table columns={columns} dataSource={accounts} rowKey="id" pagination={{ pageSize: 10 }} size="middle" scroll={{ y: tableScrollY }} />

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
    </div>
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
  const navigate = useNavigate();
  const { categories } = useCategoryStore();
  const { accounts } = useAccountStore();
  const { totalCount, getDistinctDateCount } = useTransactionStore();
  const { profile, user, signOut } = useAuthStore();
  const displayName = profile?.display_name || user?.email?.split('@')[0] || '用户';
  const isFree = profile?.membership_tier === 'free';
  const isPremium = profile?.membership_tier === 'premium' || profile?.membership_tier === 'lifetime';
  const [activeView, setActiveView] = useState<'menu' | 'categories' | 'accounts' | 'export' | 'accountInfo'>('menu');
  const [uniqueDays, setUniqueDays] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 统计天数
  useEffect(() => {
    getDistinctDateCount().then(setUniqueDays);
  }, [getDistinctDateCount]);

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

  if (activeView === 'accountInfo') {
    return <MobileAccountInfoView onBack={() => setActiveView('menu')} />;
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
          <Badge
            count={
              isFree ? (
                <span
                  onClick={() => navigate('/membership')}
                  style={{
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  升级
                </span>
              ) : null
            }
            offset={[-4, 4]}
          >
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
          </Badge>
          <div style={{ flex: 1 }}>
            <Space>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>{displayName}</span>
              {isPremium && <CrownOutlined style={{ color: '#FFD700', fontSize: 16 }} />}
            </Space>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>
              {user?.email || 'Colin记账 V1.0.0'}
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
            label="账号信息"
            subtitle={user?.email || ''}
            onClick={() => setActiveView('accountInfo')}
          />
          <MobileMenuItem
            label="会员中心"
            subtitle={isPremium ? (profile?.membership_tier === 'lifetime' ? '终身会员' : '高级会员') : '免费版'}
            onClick={() => navigate('/membership')}
          />
        </div>

        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
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

        {/* 账号操作 */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
          <MobileMenuItem
            label="修改密码"
            subtitle="验证原密码后设置新密码"
            onClick={() => setShowChangePassword(true)}
          />
          <MobileMenuItem
            label="退出登录"
            subtitle=""
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
            last
          />
        </div>

        {/* 关于 */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
          <MobileMenuItem
            label="关于Colin记账"
            subtitle="V1.0.0"
            onClick={() => {}}
            last
          />
        </div>
      </div>

      {/* 修改密码弹窗 */}
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

// ============================================================
// 账号信息子视图
// ============================================================
function MobileAccountInfoView({ onBack }: { onBack: () => void }) {
  const { user, profile, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({ display_name: displayName || undefined });
    setSaving(false);
    if (error) antMessage.error(error);
    else {
      antMessage.success('已更新');
      setEditing(false);
    }
  };

  return (
    <MobileSettingsSheet title="账号信息" onBack={onBack}>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>邮箱</div>
          <div style={{ fontSize: 15, color: '#333' }}>{user?.email || '-'}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>昵称</div>
          {editing ? (
            <Space>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="输入昵称"
                style={{ width: 200 }}
              />
              <Button size="small" type="primary" loading={saving} onClick={handleSave}>保存</Button>
              <Button size="small" onClick={() => { setEditing(false); setDisplayName(profile?.display_name || ''); }}>取消</Button>
            </Space>
          ) : (
            <Space>
              <span style={{ fontSize: 15, color: '#333' }}>{profile?.display_name || '未设置'}</span>
              <Button size="small" type="link" onClick={() => setEditing(true)}>编辑</Button>
            </Space>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>会员等级</div>
          <Space>
            <span style={{ fontSize: 15, color: '#333' }}>
              {profile?.membership_tier === 'lifetime' ? '终身会员' :
               profile?.membership_tier === 'premium' ? '高级会员' : '免费版'}
            </span>
            {profile?.membership_tier === 'premium' && profile?.premium_expires_at && (
              <span style={{ fontSize: 12, color: '#999' }}>
                到期: {new Date(profile.premium_expires_at).toLocaleDateString('zh-CN')}
              </span>
            )}
          </Space>
        </div>
      </div>
    </MobileSettingsSheet>
  );
}

// ============================================================
// 修改密码弹窗
// ============================================================

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (newPwd.length < 8) { setError('新密码至少 8 位'); return; }
    if (newPwd !== confirmPwd) { setError('两次输入的密码不一致'); return; }
    setSubmitting(true);
    const { error: err } = await useAuthStore.getState().changePassword(oldPwd, newPwd);
    setSubmitting(false);
    if (err) { setError(err); return; }
    antMessage.success('密码已修改，请重新登录');
    onClose();
    // 退出登录并跳转到登录页
    await useAuthStore.getState().signOut();
    navigate('/login', { replace: true });
  };

  const handleClose = () => {
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    setError('');
    onClose();
  };

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="原密码">
          <Input.Password
            placeholder="请输入原密码"
            value={oldPwd}
            onChange={(e) => { setOldPwd(e.target.value); setError(''); }}
          />
        </Form.Item>
        <Form.Item label="新密码">
          <Input.Password
            placeholder="新密码（至少8位）"
            value={newPwd}
            onChange={(e) => { setNewPwd(e.target.value); setError(''); }}
          />
        </Form.Item>
        <Form.Item label="确认新密码">
          <Input.Password
            placeholder="再次输入新密码"
            value={confirmPwd}
            onChange={(e) => { setConfirmPwd(e.target.value); setError(''); }}
            onPressEnter={handleSubmit}
          />
        </Form.Item>
        {error && (
          <div style={{ color: '#ff4d4f', marginBottom: 16, fontSize: 14 }}>{error}</div>
        )}
        <Button
          type="primary"
          block
          loading={submitting}
          disabled={!oldPwd || !newPwd || !confirmPwd}
          onClick={handleSubmit}
          style={{ height: 44 }}
        >
          确认修改
        </Button>
      </Form>
    </Modal>
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
        <span style={{ fontSize: 12, color: '#ccc' }}>›</span>
      </div>
    </div>
  );
}

