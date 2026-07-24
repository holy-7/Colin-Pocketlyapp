import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Form, Select, InputNumber } from 'antd';
import dayjs from 'dayjs';
import MobileHeader from '@/components/MobileHeader';
import { useBudgetStore } from '@/stores/budgetStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import {
  MOBILE_PRIMARY,
  MOBILE_CARD_BG,
  MOBILE_CARD_RADIUS,
  MOBILE_TEXT_PRIMARY,
  MOBILE_TEXT_TERTIARY,
  MOBILE_DANGER_COLOR,
} from '@/theme/mobileTokens';
import type { Budget } from '@/types';

// ============================================================
// 常量
// ============================================================
const ACTION_WIDTH = 140; // 编辑(70) + 删除(70)

// ============================================================
// MobileBudgetPage
// ============================================================
export default function MobileBudgetPage() {
  const navigate = useNavigate();
  const { budgets, fetchBudgets, setBudget, updateBudget, deleteBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const { getTransactionsByDateRange } = useTransactionStore();

  // 表单
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form] = Form.useForm();

  // 本月交易（用于计算分类支出）
  const [monthTxs, setMonthTxs] = useState<{ category_id: string; type: string; amount: number }[]>([]);
  const now = dayjs();
  const monthStart = now.startOf('month').format('YYYY-MM-DD');
  const monthEnd = now.endOf('month').format('YYYY-MM-DD');

  // 滑动状态
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
  const dragXRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 初始化数据
  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  useEffect(() => {
    (async () => {
      const txs = await getTransactionsByDateRange(monthStart, monthEnd);
      setMonthTxs(txs.map((t) => ({
        category_id: t.category_id,
        type: t.type,
        amount: t.amount,
      })));
    })();
  }, [monthStart, monthEnd, getTransactionsByDateRange]);

  // 按分类汇总本月支出
  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category_id] = (map[t.category_id] || 0) + t.amount;
    });
    return map;
  }, [monthTxs]);

  // 关闭滑动项（滚动 / 点击外部时）
  const closeSwipe = useCallback(() => {
    setSwipeState({ swipedId: null, translateX: 0 });
  }, []);

  // 滚动时关闭已打开的滑动项
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', closeSwipe, { passive: true });
    return () => el.removeEventListener('scroll', closeSwipe);
  }, [closeSwipe]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (swipeState.swipedId === null) return;
      const target = e.target as HTMLElement;
      if (!target.closest('[data-swipe-item]')) {
        closeSwipe();
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [swipeState.swipedId, closeSwipe]);

  // ============================================================
  // 触屏事件
  // ============================================================
  const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
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
    (e: React.TouchEvent, id: string) => {
      const touch = e.touches[0];
      const { startX, startY, isSwiping, direction } = touchRef.current;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isSwiping) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          touchRef.current.direction = 'horizontal';
          touchRef.current.isSwiping = true;
          if (swipeState.swipedId && swipeState.swipedId !== id) {
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
      setSwipeState({ swipedId: id, translateX: clamped });
      if (Math.abs(deltaX) > 5) e.preventDefault();
    },
    [swipeState.swipedId],
  );

  const handleTouchEnd = useCallback((_e: React.TouchEvent, id: string) => {
    const { startTime, direction, isSwiping } = touchRef.current;
    const endX = swipeState.translateX;
    const elapsed = Date.now() - startTime;
    const velocity = elapsed > 0 ? Math.abs(endX) / elapsed : 0;

    if (direction !== 'horizontal' || !isSwiping) return;

    const finalX = endX < -ACTION_WIDTH / 2 || velocity > 0.3 ? -ACTION_WIDTH : 0;
    setSwipeState({ swipedId: finalX < 0 ? id : null, translateX: finalX });
    touchRef.current.isSwiping = false;
    touchRef.current.direction = null;
  }, [swipeState.translateX]);

  // ============================================================
  // 鼠标事件
  // ============================================================
  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const clientX = e.clientX;
    const clientY = e.clientY;
    touchRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      isSwiping: false,
      direction: null,
    };
    if (swipeState.swipedId && swipeState.swipedId !== id) {
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
      setSwipeState({ swipedId: id, translateX: clamped });
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
      setSwipeState({ swipedId: finalX < 0 ? id : null, translateX: finalX });
      touchRef.current.isSwiping = false;
      touchRef.current.direction = null;
      dragXRef.current = 0;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [swipeState.swipedId]);

  // ============================================================
  // 弹窗操作
  // ============================================================
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories],
  );

  const getCategoryName = useCallback(
    (categoryId: string | null) => {
      if (!categoryId) return '总预算';
      const cat = categories.find((c) => c.id === categoryId);
      return cat?.name || '未知分类';
    },
    [categories],
  );

  const handleAdd = useCallback(() => {
    setEditingBudget(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback((budget: Budget) => {
    setEditingBudget(budget);
    form.setFieldsValue({
      category_id: budget.category_id || undefined,
      amount: budget.amount,
    });
    setModalOpen(true);
    closeSwipe();
  }, [form, closeSwipe]);

  const handleDelete = useCallback((budget: Budget) => {
    closeSwipe();
    if (window.confirm(`确定删除"${getCategoryName(budget.category_id)}"的预算吗？`)) {
      deleteBudget(budget.id);
    }
  }, [deleteBudget, getCategoryName, closeSwipe]);

  const handleSubmit = useCallback(async (values: { category_id?: string; amount: number }) => {
    if (editingBudget) {
      // 编辑模式：仅更新金额
      await updateBudget(editingBudget.id, values.amount);
    } else {
      // 新增模式
      await setBudget({
        category_id: values.category_id || undefined,
        amount: values.amount,
      });
    }
    setModalOpen(false);
  }, [editingBudget, updateBudget, setBudget]);

  // ============================================================
  // 渲染
  // ============================================================
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
      <MobileHeader
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            left: 16,
            border: 'none',
            background: 'none',
            fontSize: 20,
            color: '#333',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ←
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#333', margin: '0 auto' }}>
          预算管理
        </span>
      </MobileHeader>

      {/* 预算列表 */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          padding: '12px 16px 100px 12px',
        }}
      >
        {budgets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 14 }}>
            暂未设置预算
          </div>
        ) : (
          budgets.map((budget) => {
            const catId = budget.category_id;
            const spent = catId ? (spendingByCategory[catId] || 0) : 0;
            const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
            const isOver = spent > budget.amount;
            const isSwiped = swipeState.swipedId === budget.id;

            return (
              <div
                key={budget.id}
                data-swipe-item
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: MOBILE_CARD_RADIUS,
                  marginBottom: 8,
                  background: '#fff',
                }}
              >
                {/* 背后操作按钮 */}
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
                    onClick={() => handleEdit(budget)}
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
                    onClick={() => handleDelete(budget)}
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
                  onTouchStart={(e) => handleTouchStart(e, budget.id)}
                  onTouchMove={(e) => handleTouchMove(e, budget.id)}
                  onTouchEnd={(e) => handleTouchEnd(e, budget.id)}
                  onMouseDown={(e) => handleMouseDown(e, budget.id)}
                  style={{
                    position: 'relative',
                    padding: 14,
                    background: MOBILE_CARD_BG,
                    borderRadius: MOBILE_CARD_RADIUS,
                    transform: `translateX(${isSwiped ? swipeState.translateX : 0}px)`,
                    transition: isSwiped ? 'none' : 'transform 0.25s ease',
                    zIndex: 2,
                    touchAction: 'pan-y',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    {/* 分类名 */}
                    <span style={{ fontSize: 15, fontWeight: 500, color: MOBILE_TEXT_PRIMARY, flex: 1 }}>
                      {getCategoryName(budget.category_id)}
                    </span>
                    {/* 百分比 */}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isOver ? MOBILE_DANGER_COLOR : MOBILE_TEXT_PRIMARY,
                      }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>

                  {/* 金额信息 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: MOBILE_TEXT_TERTIARY }}>
                      预算 ¥{budget.amount.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 12, color: MOBILE_TEXT_TERTIARY }}>
                      已花 ¥{spent.toFixed(2)}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div
                    style={{
                      height: 5,
                      background: '#f0f0f0',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isOver ? MOBILE_DANGER_COLOR : MOBILE_PRIMARY,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* 超预算警告 */}
                  {isOver && (
                    <div style={{ marginTop: 6, fontSize: 11, color: MOBILE_DANGER_COLOR }}>
                      ⚠ 已超预算 ¥{(spent - budget.amount).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部添加按钮 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px 24px',
          background: 'linear-gradient(transparent, #F5F5F5 30%)',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        <button
          onClick={handleAdd}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: MOBILE_PRIMARY,
            color: '#333',
          }}
        >
          + 添加预算
        </button>
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingBudget ? '编辑预算' : '设置预算'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="category_id" label="分类（留空为总预算）">
            <Select
              allowClear
              placeholder="全部分类"
              disabled={!!editingBudget}
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
