import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Table, Button, Modal, Form, Select, InputNumber,
  Popconfirm, Tag, Progress, Alert, Empty, Spin, Statistic,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, WalletOutlined,
  RiseOutlined, FallOutlined, FireOutlined, ThunderboltOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import BudgetProgress from '@/components/BudgetProgress';
import MobileHeader from '@/components/MobileHeader';
import MobileCard from '@/components/MobileCard';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import { useResponsive } from '@/hooks/useResponsive';
import { useBudgetStore } from '@/stores/budgetStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useChatStore } from '@/stores/chatStore';
import {
  MOBILE_PRIMARY, MOBILE_CARD_BG, MOBILE_TEXT_PRIMARY,
  MOBILE_TEXT_TERTIARY, RING_RADIUS, RING_CIRCUMFERENCE,
  getSpentPercentage,
} from '@/theme/mobileTokens';
import type { Budget, Transaction } from '@/types';

// ============================================================
// 常量
// ============================================================
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE',
  '#E74C3C', '#3498DB', '#95A5A6', '#2ECC71', '#1ABC9C',
];

// ============================================================
// DiscoverPage
// ============================================================

export default function DiscoverPage() {
  const { isMobile } = useResponsive();
  const [desktopChatOpen, setDesktopChatOpen] = useState(false);
  const { messages, loading, streaming, send, clearHistory } = useChatStore();

  if (isMobile) {
    return <MobileDiscoverView />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<span>🤖</span>} onClick={() => setDesktopChatOpen(true)}>
          AI 助手
        </Button>
      </div>
      <BudgetSection />
      <div style={{ marginTop: 32 }}>
        <InsightsSection />
      </div>

      {/* AI 助手弹窗（桌面端） */}
      <Modal
        title="🤖 AI 财务助手"
        open={desktopChatOpen}
        onCancel={() => setDesktopChatOpen(false)}
        width={680}
        footer={null}
        destroyOnHidden={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
          <div style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                问我这个月的财务状况吧
              </div>
            ) : (
              messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
            )}
            {loading && streaming && (
              <ChatMessage message={{ role: 'assistant', content: streaming }} streaming />
            )}
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <ChatInput onSend={send} loading={loading} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// 移动端发现页
// ============================================================

function MobileDiscoverView() {
  const navigate = useNavigate();
  const { budgets, fetchBudgets, getTotalBudget, setBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const { getTransactionsByDateRange } = useTransactionStore();
  const [totalSpent, setTotalSpent] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [budgetForm] = Form.useForm();
  const { messages, loading, streaming, send, clearHistory } = useChatStore();

  const now = dayjs();
  const monthStr = now.format('M');
  const monthStart = now.startOf('month').format('YYYY-MM-DD');
  const monthEnd = now.endOf('month').format('YYYY-MM-DD');

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  useEffect(() => {
    (async () => {
      const txs = await getTransactionsByDateRange(monthStart, monthEnd);
      const expenses = txs.filter((t) => t.type === 'expense');
      const incomes = txs.filter((t) => t.type === 'income');
      setTotalSpent(expenses.reduce((s, t) => s + t.amount, 0));
      setMonthIncome(incomes.reduce((s, t) => s + t.amount, 0));
    })();
  }, [monthStart, monthEnd, getTransactionsByDateRange]);

  const totalBudget = getTotalBudget();
  const balance = monthIncome - totalSpent;
  const budgetRemaining = totalBudget - totalSpent;
  const budgetPct = getSpentPercentage(totalSpent, totalBudget);
  const remainingPct = totalBudget > 0 ? Math.max(100 - budgetPct, 0) : 100;

  const strokeOffset = RING_CIRCUMFERENCE * (1 - budgetPct / 100);

  const handleBudgetSubmit = async (values: { category_id?: string; amount: number }) => {
    await setBudget({
      category_id: values.category_id || undefined,
      amount: values.amount,
    });
    setBudgetModalOpen(false);
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');

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
      {/* 黄色头部 */}
      <MobileHeader
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 600, color: '#333' }}>发现</span>
      </MobileHeader>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 80px 12px' }}>
        {/* 账单摘要卡片 */}
        <MobileCard
          title="账单"
          extra={
            <RightOutlined
              style={{ fontSize: 12, color: '#999' }}
              onClick={() => navigate('/transactions')}
            />
          }
          onClick={() => navigate('/report')}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginRight: 20 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#333' }}>{monthStr}</span>
              <span style={{ fontSize: 14, color: '#666' }}>月</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>收入</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
                ¥{monthIncome.toFixed(2)}
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>支出</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
                ¥{totalSpent.toFixed(2)}
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>结余</span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: balance >= 0 ? '#333' : '#E74C3C',
                }}
              >
                ¥{balance.toFixed(2)}
              </span>
            </div>
          </div>
        </MobileCard>

        {/* 预算环形图卡片 */}
        <MobileCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>{monthStr}月总预算</span>
            <button
              onClick={() => {
                setBudgetModalOpen(true);
              }}
              style={{
                background: '#FFD93D',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                color: '#333',
                cursor: 'pointer',
              }}
            >
              + 设置预算
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 10 }}>
            {/* 环形SVG */}
            <div style={{ position: 'relative', width: 90, height: 90 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <path
                  fill="none"
                  stroke="#f0f0f0"
                  strokeWidth="3"
                  d={`M18 2.0845 a ${RING_RADIUS} ${RING_RADIUS} 0 0 1 0 ${RING_CIRCUMFERENCE / Math.PI} a ${RING_RADIUS} ${RING_RADIUS} 0 0 1 0 -${RING_CIRCUMFERENCE / Math.PI}`}
                />
                <path
                  fill="none"
                  stroke="#FFD93D"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${budgetPct}, 100`}
                  d={`M18 2.0845 a ${RING_RADIUS} ${RING_RADIUS} 0 0 1 0 ${RING_CIRCUMFERENCE / Math.PI} a ${RING_RADIUS} ${RING_RADIUS} 0 0 1 0 -${RING_CIRCUMFERENCE / Math.PI}`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}
              >
                <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: '#333' }}>
                  {remainingPct}%
                </span>
                <span style={{ fontSize: 11, color: '#999' }}>剩余</span>
              </div>
            </div>

            {/* 预算详情 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#999' }}>
                <span>剩余预算</span>
                <span style={{ color: budgetRemaining >= 0 ? '#333' : '#E74C3C' }}>
                  ¥{budgetRemaining.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#999' }}>
                <span>本月预算</span>
                <span>¥{totalBudget.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#999' }}>
                <span>本月支出</span>
                <span>¥{totalSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </MobileCard>

        {/* 功能入口 */}
        <MobileCard title="常用功能">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px 8px',
            }}
          >
            <FunctionItem
              label="预算管理"
              icon="💳"
              onClick={() => navigate('/budgets')}
            />
            <FunctionItem
              label="分类管理"
              icon="🏷️"
              onClick={() => navigate('/settings?tab=categories')}
            />
            <FunctionItem
              label="账户管理"
              icon="🏦"
              onClick={() => navigate('/settings?tab=accounts')}
            />
            <FunctionItem
              label="数据导出"
              icon="📤"
              onClick={() => navigate('/settings?tab=export')}
            />
            <FunctionItem
              label="AI助手"
              icon="🤖"
              onClick={() => setChatOpen(true)}
            />
            <FunctionItem
              label="消费分析"
              icon="📈"
              onClick={() => navigate('/report')}
            />
            <FunctionItem
              label="账单明细"
              icon="📋"
              onClick={() => navigate('/transactions')}
            />
            <FunctionItem
              label="更多功能"
              icon="⋯"
              onClick={() => {}}
            />
          </div>
        </MobileCard>
      </div>

      {/* AI 助手全屏（移动端） */}
      {chatOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: '#fff',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid #f0f0f0',
          }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>🤖 AI 财务助手</span>
            <Button type="text" onClick={() => setChatOpen(false)}>✕</Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                问我这个月的财务状况吧
              </div>
            ) : (
              messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
            )}
            {loading && streaming && (
              <ChatMessage message={{ role: 'assistant', content: streaming }} streaming />
            )}
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 12px' }}>
            <ChatInput onSend={send} loading={loading} isMobile={true} quickQuestions={['这个月花了多少钱？', '预算还剩多少？']} />
          </div>
        </div>
      )}

      {/* 预算设置弹窗 */}
      <Modal
        title="设置预算"
        open={budgetModalOpen}
        onOk={() => budgetForm.submit()}
        onCancel={() => setBudgetModalOpen(false)}
        destroyOnHidden
      >
        <Form
          form={budgetForm}
          layout="vertical"
          onFinish={handleBudgetSubmit}
        >
          <Form.Item name="category_id" label="分类（留空为总预算）">
            <Select
              allowClear
              placeholder="全部分类"
              options={expenseCategories.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="月度预算金额"
            rules={[{ required: true, message: '请输入预算金额' }]}
          >
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
    </div>
  );
}

// ============================================================
// 移动端功能入口图标
// ============================================================

function FunctionItem({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#FFF8E1',
          color: '#F5A623',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
    </div>
  );
}

// ============================================================
// 区域一：预算管理
// ============================================================

function BudgetSection() {
  const { budgets, fetchBudgets, setBudget, deleteBudget, getTotalBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const { getTransactionsByDateRange } = useTransactionStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [totalSpent, setTotalSpent] = useState(0);

  // 本月日期范围
  const now = dayjs();
  const monthStart = now.startOf('month').format('YYYY-MM-DD');
  const monthEnd = now.endOf('month').format('YYYY-MM-DD');

  // ============================================================
  // 数据加载
  // ============================================================
  const loadSpending = useCallback(async () => {
    const txs = await getTransactionsByDateRange(monthStart, monthEnd);
    const expenses = txs.filter((t) => t.type === 'expense');

    // 按分类汇总
    const catMap: Record<string, number> = {};
    for (const t of expenses) {
      catMap[t.category_id] = (catMap[t.category_id] || 0) + t.amount;
    }
    setSpentByCategory(catMap);
    setTotalSpent(expenses.reduce((s, t) => s + t.amount, 0));
  }, [monthStart, monthEnd, getTransactionsByDateRange]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  useEffect(() => {
    loadSpending();
  }, [loadSpending]);

  // ============================================================
  // 计算
  // ============================================================
  const totalBudget = getTotalBudget();
  const remaining = totalBudget - totalSpent;

  // 分类预算表格数据
  const categoryBudgetRows = budgets
    .filter((b) => b.category_id !== null)
    .map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      const spent = spentByCategory[b.category_id || ''] || 0;
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return {
        key: b.id,
        budget: b,
        categoryName: cat?.name || '未知分类',
        categoryColor: cat?.color || '#999',
        amount: b.amount,
        spent,
        percent: pct,
      };
    });

  // ============================================================
  // 操作
  // ============================================================
  const handleSubmit = async () => {
    const values = await form.validateFields();
    await setBudget({
      category_id: values.category_id || undefined,
      amount: values.amount,
    });
    setModalOpen(false);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    await deleteBudget(id);
  };

  const openBudgetModal = () => {
    form.resetFields();
    setModalOpen(true);
  };

  // 表格列定义
  const columns: ColumnsType<typeof categoryBudgetRows[number]> = [
    {
      title: '分类', dataIndex: 'categoryName', key: 'categoryName',
      render: (name: string, record) => (
        <span>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: record.categoryColor, marginRight: 8,
          }} />
          {name}
        </span>
      ),
    },
    {
      title: '预算', dataIndex: 'amount', key: 'amount',
      render: (v: number) => <strong>¥{v.toFixed(2)}</strong>,
    },
    {
      title: '已花', dataIndex: 'spent', key: 'spent',
      render: (v: number) => <span style={{ color: '#E74C3C' }}>¥{v.toFixed(2)}</span>,
    },
    {
      title: '进度', key: 'progress', width: 180,
      render: (_: unknown, record) => (
        <Progress
          percent={Math.min(record.percent, 100)}
          size="small"
          strokeColor={record.percent > 100 ? '#E74C3C' : record.percent > 80 ? '#F39C12' : '#4ECDC4'}
          format={() => `${record.percent}%`}
          status={record.percent > 100 ? 'exception' : 'active'}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_: unknown, record) => (
        <Popconfirm title="删除此预算？" onConfirm={() => handleDelete(record.budget.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ============================================================
  // 渲染
  // ============================================================
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <>
      <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
        <WalletOutlined style={{ marginRight: 8 }} />
        预算管理
      </div>

      {/* 概览卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="月度总预算"
              value={totalBudget}
              precision={2}
              prefix="¥"
              valueStyle={{ color: totalBudget > 0 ? '#4ECDC4' : '#999' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="本月已支出"
              value={totalSpent}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#E74C3C' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="剩余可花"
              value={totalBudget > 0 ? remaining : 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: remaining >= 0 ? '#27AE60' : '#E74C3C' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 总预算进度条 */}
      {totalBudget > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <BudgetProgress totalBudget={totalBudget} spent={totalSpent} />
        </Card>
      )}

      {/* 分类预算表格 */}
      <Card
        title="分类预算"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openBudgetModal}>
            设置预算
          </Button>
        }
      >
        {categoryBudgetRows.length === 0 ? (
          <Empty description="尚未设置分类预算" style={{ padding: '20px 0' }} />
        ) : (
          <Table
            columns={columns}
            dataSource={categoryBudgetRows}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      {/* 预算设置弹窗 */}
      <Modal
        title="设置预算"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="分类（留空为总预算）">
            <Select
              allowClear
              placeholder="全部分类"
              options={expenseCategories.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="月度预算金额"
            rules={[{ required: true, message: '请输入预算金额' }]}
          >
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
    </>
  );
}

// ============================================================
// 区域二：消费洞察
// ============================================================

function InsightsSection() {
  const { budgets } = useBudgetStore();
  const { categories } = useCategoryStore();
  const { getTransactionsByDateRange } = useTransactionStore();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  const now = dayjs();
  const thisMonth = {
    from: now.startOf('month').format('YYYY-MM-DD'),
    to: now.endOf('month').format('YYYY-MM-DD'),
    days: now.daysInMonth(),
  };
  const lastMonth = {
    from: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    to: now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    days: now.subtract(1, 'month').daysInMonth(),
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    const [thisTxs, lastTxs] = await Promise.all([
      getTransactionsByDateRange(thisMonth.from, thisMonth.to),
      getTransactionsByDateRange(lastMonth.from, lastMonth.to),
    ]);

    const thisExpenses = thisTxs.filter((t) => t.type === 'expense');
    const lastExpenses = lastTxs.filter((t) => t.type === 'expense');

    // Top 3 分类
    const topCategories = getTopCategories(thisExpenses, lastExpenses, categories);

    // 日均
    const thisDailyAvg = thisExpenses.reduce((s, t) => s + t.amount, 0) / thisMonth.days;
    const lastDailyAvg = lastExpenses.reduce((s, t) => s + t.amount, 0) / lastMonth.days;

    // 高消费日
    const topDays = getTopDays(thisExpenses);

    // 超支分类
    const overBudgetCats = getOverBudgetCategories(thisExpenses, budgets, categories);

    setInsights({ topCategories, thisDailyAvg, lastDailyAvg, topDays, overBudgetCats });
    setLoading(false);
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const hasData = insights && expenseCategories.length > 0;

  return (
    <>
      <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        消费洞察
        <span style={{ fontSize: 13, color: '#999', fontWeight: 400, marginLeft: 8 }}>
          {now.format('YYYY年M月')}
        </span>
      </div>

      <Spin spinning={loading}>
        {!hasData ? (
          <Empty description="暂无消费数据" style={{ padding: '40px 0' }} />
        ) : (
          <>
            {/* 超支提醒 */}
            {insights.overBudgetCats.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {insights.overBudgetCats.map((cat) => (
                  <Alert
                    key={cat.categoryId}
                    message={
                      <span>
                        <strong>{cat.categoryName}</strong> 已超预算：
                        预算 ¥{cat.budget.toFixed(2)}，已花 ¥{cat.spent.toFixed(2)}，
                        超出 {(cat.spent - cat.budget).toFixed(2)}（{Math.round((cat.spent / cat.budget - 1) * 100)}%）
                      </span>
                    }
                    type={cat.spent / cat.budget > 1.2 ? 'error' : 'warning'}
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </div>
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              {/* 消费排行榜 */}
              <Col xs={24} md={12}>
                <Card title={<span><RiseOutlined style={{ marginRight: 6, color: '#E74C3C' }} />消费排行 Top 3</span>}>
                  {insights.topCategories.length === 0 ? (
                    <Empty description="本月暂无支出" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {insights.topCategories.map((cat, idx) => (
                        <div key={cat.categoryId}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Tag color={COLORS[idx % COLORS.length]}>{idx + 1}</Tag>
                              <span style={{ fontWeight: 500 }}>{cat.categoryName}</span>
                            </span>
                            <span style={{ fontWeight: 600, color: '#E74C3C' }}>
                              ¥{cat.amount.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
                            <span>占比 {cat.percentage.toFixed(1)}%</span>
                            {cat.lastAmount !== null && (
                              <CompareText
                                current={cat.amount}
                                previous={cat.lastAmount}
                                isExpense
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>

              {/* 日均 + 高消费日 */}
              <Col xs={24} md={12}>
                <Card title={<span><FireOutlined style={{ marginRight: 6, color: '#F39C12' }} />消费趋势</span>}>
                  {/* 日均对比 */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>日均支出</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: '#E74C3C' }}>
                        ¥{insights.thisDailyAvg.toFixed(2)}
                      </span>
                      {insights.lastDailyAvg > 0 && (
                        <CompareText
                          current={insights.thisDailyAvg}
                          previous={insights.lastDailyAvg}
                          isExpense
                        />
                      )}
                    </div>
                  </div>

                  {/* 高消费日 */}
                  <div>
                    <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>高消费日</div>
                    {insights.topDays.length === 0 ? (
                      <span style={{ fontSize: 13, color: '#999' }}>暂无数据</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.topDays.map((d, idx) => (
                          <div key={d.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Tag color={idx === 0 ? 'red' : idx === 1 ? 'orange' : 'gold'}>
                                {idx + 1}
                              </Tag>
                              <span>{d.date}</span>
                            </span>
                            <span style={{ fontWeight: 600, color: '#E74C3C' }}>
                              ¥{d.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </>
  );
}

// ============================================================
// 辅助类型与函数
// ============================================================

interface TopCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  lastAmount: number | null;
}

interface OverBudgetCat {
  categoryId: string;
  categoryName: string;
  budget: number;
  spent: number;
}

interface TopDay {
  date: string;
  amount: number;
}

interface InsightsData {
  topCategories: TopCategory[];
  thisDailyAvg: number;
  lastDailyAvg: number;
  topDays: TopDay[];
  overBudgetCats: OverBudgetCat[];
}

/** Top 3 支出分类 + 上月对比 */
function getTopCategories(
  thisExpenses: Transaction[],
  lastExpenses: Transaction[],
  categories: { id: string; name: string }[],
): TopCategory[] {
  const totalThis = thisExpenses.reduce((s, t) => s + t.amount, 0);

  // 本月分类汇总
  const thisMap = new Map<string, number>();
  for (const t of thisExpenses) {
    thisMap.set(t.category_id, (thisMap.get(t.category_id) || 0) + t.amount);
  }

  // 上月分类汇总
  const lastMap = new Map<string, number>();
  for (const t of lastExpenses) {
    lastMap.set(t.category_id, (lastMap.get(t.category_id) || 0) + t.amount);
  }

  // 取 top 3
  const sorted = Array.from(thisMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return sorted.map(([catId, amount]) => {
    const cat = categories.find((c) => c.id === catId);
    return {
      categoryId: catId,
      categoryName: cat?.name || '未分类',
      amount,
      percentage: totalThis > 0 ? (amount / totalThis) * 100 : 0,
      lastAmount: lastMap.has(catId) ? lastMap.get(catId)! : null,
    };
  });
}

/** 超支分类检测 */
function getOverBudgetCategories(
  expenses: Transaction[],
  budgets: Budget[],
  categories: { id: string; name: string }[],
): OverBudgetCat[] {
  const catSpent = new Map<string, number>();
  for (const t of expenses) {
    catSpent.set(t.category_id, (catSpent.get(t.category_id) || 0) + t.amount);
  }

  const results: OverBudgetCat[] = [];
  for (const b of budgets) {
    if (!b.category_id) continue; // 跳过总预算
    const spent = catSpent.get(b.category_id) || 0;
    if (spent > b.amount && b.amount > 0) {
      const cat = categories.find((c) => c.id === b.category_id);
      results.push({
        categoryId: b.category_id,
        categoryName: cat?.name || '未知分类',
        budget: b.amount,
        spent,
      });
    }
  }
  return results.sort((a, b) => b.spent / b.budget - a.spent / a.budget);
}

/** 高消费日 Top 3 */
function getTopDays(expenses: Transaction[]): TopDay[] {
  const dayMap = new Map<string, number>();
  for (const t of expenses) {
    dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount);
  }
  return Array.from(dayMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([date, amount]) => ({ date, amount }));
}

// ============================================================
// 子组件
// ============================================================

interface CompareTextProps {
  current: number;
  previous: number;
  isExpense: boolean;
}

/** 环比变化文本 */
function CompareText({ current, previous, isExpense }: CompareTextProps) {
  if (previous === 0) {
    return <span>上月无数据</span>;
  }

  const diff = current - previous;
  const pct = Math.abs((diff / previous) * 100);
  const isUp = diff > 0;

  if (diff === 0) return <span>持平</span>;

  const bad = isExpense ? isUp : !isUp;
  const color = bad ? '#E74C3C' : '#27AE60';
  const Arrow = isUp ? RiseOutlined : FallOutlined;

  return (
    <span style={{ color }}>
      <Arrow style={{ fontSize: 11 }} /> {pct.toFixed(1)}% 较上月
    </span>
  );
}
