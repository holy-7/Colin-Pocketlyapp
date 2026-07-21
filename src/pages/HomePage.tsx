import { useState, useEffect, useCallback } from 'react';
import { Button, Card, List, Tag, Empty, Statistic, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import TransactionForm from '@/components/TransactionForm';
import BudgetProgress from '@/components/BudgetProgress';
import { useTransactionStore } from '@/stores/transactionStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import type { TransactionFormData, Transaction } from '@/types';

export default function HomePage() {
  const [formOpen, setFormOpen] = useState(false);
  const { transactions, fetchTransactions, addTransaction, totalCount } = useTransactionStore();
  const { fetchBudgets, getTotalBudget } = useBudgetStore();
  const { categories } = useCategoryStore();
  const loading = useTransactionStore((s) => s.loading);

  useEffect(() => {
    fetchTransactions(1, 50);
    fetchBudgets();
  }, [fetchTransactions, fetchBudgets]);

  // 今日交易
  const todayStr = dayjs().format('YYYY-MM-DD');
  const todayTransactions = transactions.filter((t) => t.date === todayStr);

  // 本月支出
  const monthStr = dayjs().format('YYYY-MM');
  const thisMonthExpenses = transactions
    .filter((t) => t.type === 'expense' && t.date.startsWith(monthStr))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBudget = getTotalBudget();

  const handleAdd = useCallback(
    async (data: TransactionFormData) => {
      await addTransaction(data);
    },
    [addTransaction]
  );

  // 获取分类信息
  const getCategoryInfo = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  return (
    <div>
      {/* 概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="今日已记" value={todayTransactions.length} suffix="笔" />
          </Card>
        </Col>
        <Col span={6}>
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
        <Col span={6}>
          <Card>
            <Statistic
              title="交易总数"
              value={totalCount}
              suffix="笔"
            />
          </Card>
        </Col>
        <Col span={6}>
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

      {/* 预算进度 */}
      {totalBudget > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <BudgetProgress totalBudget={totalBudget} spent={thisMonthExpenses} />
        </Card>
      )}

      {/* 快捷记账按钮 + 今日列表 */}
      <Card
        title="今日记账"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
            记一笔
          </Button>
        }
      >
        {todayTransactions.length === 0 ? (
          <Empty
            description="今天还没有记账"
            style={{ padding: '40px 0' }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
              点此记第一笔
            </Button>
          </Empty>
        ) : (
          <List
            loading={loading}
            dataSource={todayTransactions}
            renderItem={(item: Transaction) => {
              const cat = getCategoryInfo(item.category_id);
              return (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <span
                        style={{
                          display: 'inline-block',
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: cat?.color || '#ddd',
                          color: '#fff',
                          textAlign: 'center',
                          lineHeight: '36px',
                          fontSize: 18,
                        }}
                      >
                        {item.type === 'expense' ? '💸' : '💰'}
                      </span>
                    }
                    title={
                      <span>
                        <Tag color={cat?.color || undefined}>{cat?.name || '未分类'}</Tag>
                        {item.note || '无备注'}
                      </span>
                    }
                    description={`${item.date} · ${item.account?.name || ''}`}
                  />
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: item.type === 'expense' ? '#E74C3C' : '#27AE60',
                    }}
                  >
                    {item.type === 'expense' ? '-' : '+'}¥{item.amount.toFixed(2)}
                  </span>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleAdd}
      />
    </div>
  );
}
