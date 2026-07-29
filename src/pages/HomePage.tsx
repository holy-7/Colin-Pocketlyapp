import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag, Empty, Statistic, Row, Col, Modal, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import TransactionForm from '@/components/TransactionForm';
import BudgetProgress from '@/components/BudgetProgress';
import MobileHeader from '@/components/MobileHeader';
import MonthPickerSheet from '@/components/MonthPickerSheet';
import { useResponsive } from '@/hooks/useResponsive';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { useTransactionStore } from '@/stores/transactionStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import {
  MOBILE_TEXT_PRIMARY,
  MOBILE_TEXT_TERTIARY,
  MOBILE_INCOME_COLOR,
  MOBILE_EXPENSE_COLOR,
  MOBILE_PRIMARY,
  MOBILE_DANGER_COLOR,
  MOBILE_CARD_BG,
  MOBILE_CARD_RADIUS,
} from '@/theme/mobileTokens';
import type { TransactionFormData, Transaction } from '@/types';

export default function HomePage() {
  const { isMobile } = useResponsive();
  const [formOpen, setFormOpen] = useState(false);
  const {
    transactions,
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    totalCount,
  } = useTransactionStore();
  const { fetchBudgets, getTotalBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const loading = useTransactionStore((s) => s.loading);

  useEffect(() => {
    fetchTransactions(1, 200);
    fetchBudgets();
  }, [fetchTransactions, fetchBudgets]);

  const handleAdd = useCallback(
    async (data: TransactionFormData) => {
      await addTransaction(data);
    },
    [addTransaction]
  );

  const handleUpdate = useCallback(
    async (id: string, data: TransactionFormData) => {
      await updateTransaction(id, data);
    },
    [updateTransaction]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      return deleteTransaction(id);
    },
    [deleteTransaction]
  );

  const getCategoryInfo = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  // ==================== Mobile ====================
  if (isMobile) {
    return (
      <MobileHomePage
        transactions={transactions}
        categories={categories}
        loading={loading}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    );
  }

  // ==================== Desktop (scroll fix) ====================

  const todayStr = dayjs().format('YYYY-MM-DD');
  const todayTransactions = useMemo(
    () => transactions.filter((t) => t.date === todayStr),
    [transactions, todayStr]
  );

  const monthStr = dayjs().format('YYYY-MM');
  const thisMonthExpenses = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense' && t.date.startsWith(monthStr))
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions, monthStr]
  );

  const totalBudget = getTotalBudget();

  // ResizeObserver → 动态 scroll.y
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(400);

  useLayoutEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const calc = () => {
      const h = wrapper.clientHeight;
      if (h > 0) setTableScrollY(h - 119); // 55px 表头 + 64px 分页栏
    };
    calc();
    const ro = new ResizeObserver(() => calc());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  const todayColumns: ColumnsType<Transaction> = [
    {
      title: '分类',
      dataIndex: 'category_id',
      key: 'category',
      width: 100,
      render: (id: string) => {
        const cat = getCategoryInfo(id);
        return <Tag color={cat?.color || undefined}>{cat?.name || '未知'}</Tag>;
      },
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
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* 统计卡片 + 预算 — 固定在顶部 */}
      <div style={{ flexShrink: 0 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title="今日已记" value={todayTransactions.length} suffix="笔" />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="本月支出"
                value={thisMonthExpenses}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#E74C3C' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title="交易总数" value={totalCount} suffix="笔" />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic
                title="本月预算"
                value={totalBudget || 0}
                precision={2}
                prefix="¥"
                valueStyle={{ color: totalBudget > 0 ? '#4ECDC4' : '#999' }}
              />
            </Card>
          </Col>
        </Row>

        {totalBudget > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <BudgetProgress totalBudget={totalBudget} spent={thisMonthExpenses} />
          </Card>
        )}
      </div>

      {/* 今日记账 — 占剩余空间，内部滚动（表头 sticky + 分页固定） */}
      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Card
          title="今日记账"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
              记一笔
            </Button>
          }
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden', padding: 24 } }}
        >
          {todayTransactions.length === 0 ? (
            <Empty description="今天还没有记账" style={{ padding: '40px 0' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
                点此记第一笔
              </Button>
            </Empty>
          ) : (
            <Table
              columns={todayColumns}
              dataSource={todayTransactions}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 笔`,
                showSizeChanger: false,
              }}
              scroll={{ x: 600, y: tableScrollY }}
              size="middle"
            />
          )}
        </Card>
      </div>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleAdd}
      />
    </div>
  );
}

// ============================================================
// 移动端 HomePage（明细）
// ============================================================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

interface MobileHomePageProps {
  transactions: Transaction[];
  categories: { id: string; name: string; color?: string | null }[];
  loading: boolean;
  onAdd: (data: TransactionFormData) => Promise<void>;
  onUpdate: (id: string, data: TransactionFormData) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
}

function MobileHomePage({ transactions, categories, loading, onAdd, onUpdate, onDelete }: MobileHomePageProps) {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [swipeState, setSwipeState] = useState<{ swipedId: string | null; translateX: number }>({
    swipedId: null,
    translateX: 0,
  });
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isSwiping: false,
    direction: null as 'horizontal' | 'vertical' | null,
  });
  const dragXRef = useRef(0); // 拖拽中实时位移，避免 handleMouseUp 闭包过期
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const monthStr = selectedMonth.format('YYYY-MM');
  const yearStr = selectedMonth.format('YYYY年');

  // 本月交易
  const monthTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(monthStr))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, monthStr]
  );

  // 本月收支合计
  const monthIncome = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  // 按日期分组
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of monthTransactions) {
      const list = map.get(t.date) || [];
      list.push(t);
      map.set(t.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthTransactions]);

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name || '未分类';

  const getCategoryColor = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.color || '#FFD93D';

  const ACTION_WIDTH = 140;

  // —— 触摸事件处理 ——
  const handleTouchStart = useCallback((e: React.TouchEvent, txId: string) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isSwiping: false,
      direction: null,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent, txId: string) => {
      const touch = e.touches[0];
      const { startX, startY, isSwiping, direction } = touchRef.current;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isSwiping) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          touchRef.current.direction = 'horizontal';
          touchRef.current.isSwiping = true;
          // 关闭其他已打开项
          if (swipeState.swipedId && swipeState.swipedId !== txId) {
            setSwipeState({ swipedId: null, translateX: 0 });
          }
        } else {
          touchRef.current.direction = 'vertical';
          touchRef.current.isSwiping = true;
          return;
        }
      }

      if (direction !== 'horizontal') return;

      const clamped = Math.max(-ACTION_WIDTH, Math.min(0, deltaX));
      setSwipeState({ swipedId: txId, translateX: clamped });

      if (Math.abs(deltaX) > 5) {
        e.preventDefault();
      }
    },
    [swipeState.swipedId],
  );

  const handleTouchEnd = useCallback((_e: React.TouchEvent, txId: string) => {
    const { startTime, direction, isSwiping } = touchRef.current;
    const endX = swipeState.translateX;
    const elapsed = Date.now() - startTime;
    const velocity = elapsed > 0 ? Math.abs(endX) / elapsed : 0;

    if (direction !== 'horizontal' || !isSwiping) return;

    const finalX = endX < -ACTION_WIDTH / 2 || velocity > 0.3 ? -ACTION_WIDTH : 0;

    setSwipeState({
      swipedId: finalX < 0 ? txId : null,
      translateX: finalX,
    });

    touchRef.current.isSwiping = false;
    touchRef.current.direction = null;
  }, [swipeState.translateX]);

  // —— 鼠标事件处理（桌面端左键拖拽） ——
  const handleMouseDown = useCallback((e: React.MouseEvent, txId: string) => {
    if (e.button !== 0) return; // 只响应左键
    e.preventDefault(); // 阻止文本选中
    const clientX = e.clientX;
    const clientY = e.clientY;

    touchRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      isSwiping: false,
      direction: null,
    };

    // 关闭其他已打开项
    if (swipeState.swipedId && swipeState.swipedId !== txId) {
      setSwipeState({ swipedId: null, translateX: 0 });
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - touchRef.current.startX;
      const deltaY = ev.clientY - touchRef.current.startY;
      const { isSwiping, direction } = touchRef.current;

      if (!isSwiping) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          touchRef.current.direction = 'horizontal';
          touchRef.current.isSwiping = true;
        } else {
          touchRef.current.direction = 'vertical';
          touchRef.current.isSwiping = true;
          return;
        }
      }

      if (direction !== 'horizontal') return;

      const clamped = Math.max(-ACTION_WIDTH, Math.min(0, deltaX));
      dragXRef.current = clamped;
      setSwipeState({ swipedId: txId, translateX: clamped });
      ev.preventDefault();
    };

    const handleMouseUp = () => {
      const { startTime, direction, isSwiping } = touchRef.current;
      const endX = dragXRef.current;
      const elapsed = Date.now() - startTime;
      const velocity = elapsed > 0 ? Math.abs(endX) / elapsed : 0;

      const finalX =
        direction === 'horizontal' && isSwiping && (endX < -ACTION_WIDTH / 2 || velocity > 0.3)
          ? -ACTION_WIDTH
          : 0;

      setSwipeState({
        swipedId: finalX < 0 ? txId : null,
        translateX: finalX,
      });

      touchRef.current.isSwiping = false;
      touchRef.current.direction = null;
      dragXRef.current = 0;

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [swipeState.swipedId]);

  // —— 操作回调 ——
  const handleEditClick = useCallback((tx: Transaction) => {
    setSwipeState({ swipedId: null, translateX: 0 });
    setEditingTransaction(tx);
    setFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (tx: Transaction) => {
      setSwipeState({ swipedId: null, translateX: 0 });
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除这笔${tx.type === 'expense' ? '支出' : '收入'}记录吗？`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          await onDelete(tx.id);
        },
      });
    },
    [onDelete],
  );

  // —— 副作用：滚动、点击外部、换月时关闭滑动 ——
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (swipeState.swipedId) {
        setSwipeState({ swipedId: null, translateX: 0 });
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [swipeState.swipedId]);

  useEffect(() => {
    if (!swipeState.swipedId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-swipe-item]')) {
        setSwipeState({ swipedId: null, translateX: 0 });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [swipeState.swipedId]);

  useEffect(() => {
    setSwipeState({ swipedId: null, translateX: 0 });
  }, [selectedMonth]);

  // —— 表单提交 ——
  const handleFormSubmit = async (data: TransactionFormData) => {
    if (editingTransaction) {
      await onUpdate(editingTransaction.id, data);
    } else {
      await onAdd(data);
    }
  };

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
      <MobileHeader style={{ padding: '8px 16px 16px' }}>
        {/* 顶部：Logo + 标题 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 0',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#333',
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c.79 0 1.5-.71 1.5-1.5S8.79 9 8 9s-1.5.71-1.5 1.5S7.21 12 8 12zm8 0c.79 0 1.5-.71 1.5-1.5S16.79 9 16 9s-1.5.71-1.5 1.5.71 1.5 1.5 1.5zm-4 5.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>Colin记账</span>
        </div>

        {/* 月度概览 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '6px 8px',
            marginTop: 12,
            alignItems: 'end',
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{yearStr}</span>
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>收入</span>
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', paddingRight: 10 }}>支出</span>

          {/* 月份选择器 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span style={{ fontSize: 38, fontWeight: 700, color: '#333', lineHeight: 1, letterSpacing: -1 }}>
                {selectedMonth.format('MM')}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#333', marginLeft: 2 }}>月</span>
              <span
                onClick={() => setMonthPickerOpen(true)}
                style={{ cursor: 'pointer', padding: '4px 2px', display: 'flex', alignItems: 'flex-end' }}
              >
                <svg width="10" height="6" viewBox="0 0 10 6">
                  <path d="M0 0l5 6 5-6z" fill="#999" />
                </svg>
              </span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 300, color: 'rgba(0,0,0,0.15)' }}>|</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: MOBILE_INCOME_COLOR, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
            {monthIncome.toFixed(2)}
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: MOBILE_EXPENSE_COLOR, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', paddingRight: 10 }}>
            {monthExpense.toFixed(2)}
          </span>
        </div>

        {/* 快捷入口 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            background: '#fff',
            borderRadius: 16,
            padding: '16px 10px',
            marginTop: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <QuickAction
            label="账单"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            }
            onClick={() => navigate('/transactions')}
          />
          <QuickAction
            label="预算"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            }
            onClick={() => navigate('/discover')}
          />
          <QuickAction
            label="统计"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            }
            onClick={() => navigate('/report')}
          />
          <QuickAction
            label="设置"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
            onClick={() => navigate('/settings')}
          />
        </div>
      </MobileHeader>

      {/* 账单列表 */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '12px 16px 80px 12px' }}>
        {loading && monthTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: MOBILE_TEXT_TERTIARY }}>加载中...</div>
        ) : groupedByDate.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: MOBILE_TEXT_TERTIARY }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 14 }}>{selectedMonth.format('M月')}暂无记账记录</div>
            <button
              onClick={() => setFormOpen(true)}
              style={{
                marginTop: 16,
                border: 'none',
                background: '#FFD93D',
                padding: '8px 24px',
                borderRadius: 20,
                fontSize: 14,
                cursor: 'pointer',
                color: '#333',
                fontWeight: 500,
              }}
            >
              记一笔
            </button>
          </div>
        ) : (
          groupedByDate.map(([date, txs]) => {
            const d = dayjs(date);
            const dayIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

            return (
              <div key={date} style={{ marginBottom: 12 }}>
                {/* 日期头部 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 4px',
                    fontSize: 13,
                    color: MOBILE_TEXT_TERTIARY,
                  }}
                >
                  <span style={{ fontWeight: 500, color: MOBILE_TEXT_PRIMARY }}>
                    {d.format('MM月DD日')} 星期{WEEKDAYS[d.day()]}
                  </span>
                  <span style={{ fontSize: 12, color: MOBILE_TEXT_TERTIARY }}>
                    收 ¥{dayIncome.toFixed(2)} · 支 ¥{dayExpense.toFixed(2)}
                  </span>
                </div>

                {/* 交易卡片 */}
                {txs.map((tx) => {
                  const catName = getCategoryName(tx.category_id);
                  const catColor = getCategoryColor(tx.category_id);
                  const isSwiped = swipeState.swipedId === tx.id;
                  const offset = isSwiped ? swipeState.translateX : 0;
                  return (
                    <SwipeableTransactionItem
                      key={tx.id}
                      transaction={tx}
                      catName={catName}
                      catColor={catColor}
                      isSwiped={isSwiped}
                      translateX={offset}
                      onTouchStart={(e) => handleTouchStart(e, tx.id)}
                      onTouchMove={(e) => handleTouchMove(e, tx.id)}
                      onTouchEnd={(e) => handleTouchEnd(e, tx.id)}
                      onMouseDown={(e) => handleMouseDown(e, tx.id)}
                      onMouseMove={() => {}}
                      onMouseUp={() => {}}
                      onEdit={() => handleEditClick(tx)}
                      onDelete={() => handleDeleteClick(tx)}
                    />
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* 快速记账弹窗（移动端简化） */}
      <TransactionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleFormSubmit}
        initialValues={
          editingTransaction
            ? {
                account_id: editingTransaction.account_id,
                category_id: editingTransaction.category_id,
                amount: String(editingTransaction.amount),
                type: editingTransaction.type,
                date: editingTransaction.date,
                note: editingTransaction.note || '',
                tag_ids: editingTransaction.tags?.map((t) => t.id) || [],
              }
            : undefined
        }
        title={editingTransaction ? '编辑账单' : '记一笔'}
      />

      {/* 月份选择底部弹出层 */}
      <MonthPickerSheet
        open={monthPickerOpen}
        value={selectedMonth}
        onChange={setSelectedMonth}
        onClose={() => setMonthPickerOpen(false)}
      />
    </div>
  );
}

// ============================================================
// 可滑动交易卡片组件
// ============================================================

interface SwipeableTransactionItemProps {
  transaction: Transaction;
  catName: string;
  catColor: string;
  isSwiped: boolean;
  translateX: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SwipeableTransactionItem({
  transaction: tx,
  catName,
  catColor,
  isSwiped,
  translateX,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onEdit,
  onDelete,
}: SwipeableTransactionItemProps) {
  return (
    <div
      data-swipe-item
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: MOBILE_CARD_RADIUS,
        marginBottom: 8,
        background: '#fff',
      }}
    >
      {/* 操作按钮（藏在卡片背后） */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'row',
          borderRadius: `0 ${MOBILE_CARD_RADIUS}px ${MOBILE_CARD_RADIUS}px 0`,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={onEdit}
          style={{
            width: 70,
            height: '100%',
            border: 'none',
            background: MOBILE_PRIMARY,
            color: '#333',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
          }}
        >
          编辑
        </button>
        <button
          onClick={onDelete}
          style={{
            width: 70,
            height: '100%',
            border: 'none',
            background: MOBILE_DANGER_COLOR,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
          }}
        >
          删除
        </button>
      </div>

      {/* 滑动卡片层 */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: 12,
          background: MOBILE_CARD_BG,
          borderRadius: MOBILE_CARD_RADIUS,
          transform: `translateX(${isSwiped ? translateX : 0}px)`,
          transition: isSwiped ? 'none' : 'transform 0.25s ease',
          zIndex: 2,
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* 分类头像 */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: catColor ? `${catColor}20` : '#FFF8E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            marginRight: 12,
            color: catColor || '#F5A623',
            flexShrink: 0,
          }}
        >
          {getCategoryIcon(catName, catColor || '#F5A623', 22) || catName.charAt(0)}
        </div>

        {/* 分类名 + 备注 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              color: MOBILE_TEXT_PRIMARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {catName}
          </div>
          {tx.note && (
            <div
              style={{
                fontSize: 12,
                color: MOBILE_TEXT_TERTIARY,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tx.note}
            </div>
          )}
        </div>

        {/* 金额 */}
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            color: tx.type === 'expense' ? MOBILE_EXPENSE_COLOR : MOBILE_INCOME_COLOR,
            flexShrink: 0,
            marginLeft: 8,
          }}
        >
          {tx.type === 'expense' ? '-' : '+'}¥{tx.amount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 快捷入口图标组件
// ============================================================

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function QuickAction({ label, icon, onClick }: QuickActionProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        flex: 1,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          background: '#FFF8E1',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5A623',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 11, color: '#666' }}>{label}</span>
    </div>
  );
}
