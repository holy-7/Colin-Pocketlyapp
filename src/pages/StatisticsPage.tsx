import { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin, Empty, Statistic, Progress } from 'antd';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useBudgetStore } from '@/stores/budgetStore';
import type { Transaction, CategorySummary, DailyTrend } from '@/types';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#E74C3C', '#3498DB', '#95A5A6', '#2ECC71', '#1ABC9C'];

export default function StatisticsPage() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [categoryData, setCategoryData] = useState<CategorySummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyTrend[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);

  const { getTransactionsByMonth } = useTransactionStore();
  const { categories } = useCategoryStore();
  const { getTotalBudget } = useBudgetStore();

  useEffect(() => {
    loadMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const loadMonthData = async () => {
    setLoading(true);
    const year = selectedMonth.year();
    const month = selectedMonth.month() + 1;
    const data = await getTransactionsByMonth(year, month);
    computeStats(data);
    setLoading(false);
  };

  const computeStats = (transactions: Transaction[]) => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    const incomes = transactions.filter((t) => t.type === 'income');

    const totalExp = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalInc = incomes.reduce((sum, t) => sum + t.amount, 0);
    setTotalExpense(totalExp);
    setTotalIncome(totalInc);

    // 分类汇总
    const catMap = new Map<string, { name: string; color: string | null; amount: number }>();
    for (const t of expenses) {
      const cat = t.category || categories.find((c) => c.id === t.category_id);
      const name = cat?.name || '未分类';
      const color = cat?.color || '#95A5A6';
      const existing = catMap.get(t.category_id);
      if (existing) {
        existing.amount += t.amount;
      } else {
        catMap.set(t.category_id, { name, color, amount: t.amount });
      }
    }

    const summaries: CategorySummary[] = Array.from(catMap.entries()).map(([id, v]) => ({
      category_id: id,
      category_name: v.name,
      category_color: v.color,
      amount: v.amount,
      percentage: totalExp > 0 ? (v.amount / totalExp) * 100 : 0,
    }));
    summaries.sort((a, b) => b.amount - a.amount);
    setCategoryData(summaries);

    // 日趋势
    const daysInMonth = selectedMonth.daysInMonth();
    const prefix = selectedMonth.format('YYYY-MM-');
    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap.set(prefix + String(d).padStart(2, '0'), { income: 0, expense: 0 });
    }
    for (const t of transactions) {
      const entry = dailyMap.get(t.date);
      if (entry) {
        if (t.type === 'income') entry.income += t.amount;
        else entry.expense += t.amount;
      }
    }

    const trends: DailyTrend[] = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date: date.slice(8),
      income: v.income,
      expense: v.expense,
    }));
    setDailyData(trends);
  };

  const totalBudget = getTotalBudget();
  const budgetPercent = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={(d) => setSelectedMonth(d || dayjs())}
          allowClear={false}
        />
        <span style={{ color: '#999' }}>
          {selectedMonth.format('YYYY年MM月')} 财务概览
        </span>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="本月支出" value={totalExpense} precision={2} prefix="¥" valueStyle={{ color: '#E74C3C' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月收入" value={totalIncome} precision={2} prefix="¥" valueStyle={{ color: '#27AE60' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="结余" value={totalIncome - totalExpense} precision={2} prefix="¥"
              valueStyle={{ color: totalIncome - totalExpense >= 0 ? '#27AE60' : '#E74C3C' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 4, color: '#999', fontSize: 14 }}>预算使用</div>
              {totalBudget > 0 ? (
                <Progress
                  type="circle"
                  percent={Math.min(budgetPercent, 100)}
                  size={80}
                  status={budgetPercent > 100 ? 'exception' : 'active'}
                  strokeColor={budgetPercent > 100 ? '#E74C3C' : '#4ECDC4'}
                  format={() => `${budgetPercent}%`}
                />
              ) : (
                <span style={{ color: '#999' }}>未设置预算</span>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 饼图 */}
        <Col span={12}>
          <Card title="支出分类占比">
            {categoryData.length === 0 ? (
              <Empty description="本月无支出记录" style={{ padding: '40px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="amount"
                    nameKey="category_name"
                    label={({ category_name, percentage }) =>
                      `${category_name} ${percentage.toFixed(1)}%`
                    }
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={entry.category_id}
                        fill={entry.category_color || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* 趋势图 */}
        <Col span={12}>
          <Card title="日收支趋势">
            {dailyData.length === 0 ? (
              <Empty description="本月无记录" style={{ padding: '40px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="expense" stroke="#E74C3C" name="支出" strokeWidth={2} />
                  <Line type="monotone" dataKey="income" stroke="#27AE60" name="收入" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
