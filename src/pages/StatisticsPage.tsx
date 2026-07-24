import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Spin, Empty, Progress, Button, Select } from 'antd';
import { LeftOutlined, RightOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(weekOfYear);
import { useResponsive } from '@/hooks/useResponsive';
import { useTransactionStore } from '@/stores/transactionStore';
import MobileHeader from '@/components/MobileHeader';
import type { Transaction, CategorySummary, DailyTrend, TransactionType } from '@/types';

// ============================================================
// 常量
// ============================================================
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE',
  '#E74C3C', '#3498DB', '#95A5A6', '#2ECC71', '#1ABC9C',
];

const EXPENSE_COLOR = '#E74C3C';
const INCOME_COLOR = '#27AE60';
const PROGRESS_YELLOW = '#FAAD14';

/** 判断闰年 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// ============================================================
// 周期计算辅助函数
// ============================================================

interface PeriodRange {
  from: string;
  to: string;
  label: string;
  daysInPeriod: number;
}

/** 获取某个日期的周一-周日范围 */
function getWeekRange(date: dayjs.Dayjs): PeriodRange {
  const monday = date.day(1).startOf('day');
  const sunday = date.day(7).endOf('day');
  const weekNum = monday.week();
  return {
    from: monday.format('YYYY-MM-DD'),
    to: sunday.format('YYYY-MM-DD'),
    label: `第${weekNum}周`,
    daysInPeriod: 7,
  };
}

/** 获取某个日期的月份范围 */
function getMonthRange(date: dayjs.Dayjs): PeriodRange {
  const start = date.startOf('month');
  const end = date.endOf('month');
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
    label: start.format('M月'),
    daysInPeriod: start.daysInMonth(),
  };
}

/** 获取某年的范围 */
function getYearRange(year: number): PeriodRange {
  const start = dayjs().year(year).startOf('year');
  const end = dayjs().year(year).endOf('year');
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
    label: `${year}年`,
    daysInPeriod: isLeapYear(year) ? 366 : 365,
  };
}

/** 根据模式+偏移量获取当前周期范围 */
function getCurrentPeriod(mode: 'week' | 'month' | 'year', offset: number): PeriodRange {
  const now = dayjs();
  if (mode === 'week') {
    return getWeekRange(now.add(offset, 'week'));
  } else if (mode === 'month') {
    return getMonthRange(now.add(offset, 'month'));
  } else {
    return getYearRange(now.year() + offset);
  }
}

/** 获取上一期范围 */
function getPrevPeriod(current: PeriodRange, mode: 'week' | 'month' | 'year'): PeriodRange {
  const from = dayjs(current.from);
  if (mode === 'week') return getWeekRange(from.subtract(1, 'week'));
  if (mode === 'month') return getMonthRange(from.subtract(1, 'month'));
  return getYearRange(from.year() - 1);
}

interface PeriodOption {
  label: string;
  offset: number;
  isCurrent: boolean;
}

/** 生成周期选项列表 */
function getPeriodOptions(mode: 'week' | 'month' | 'year'): PeriodOption[] {
  const options: PeriodOption[] = [];
  const now = dayjs();

  if (mode === 'week') {
    // 前4周 → 本周 → 后4周
    for (let i = -4; i <= 4; i++) {
      const date = now.add(i, 'week');
      const monday = date.day(1);
      const weekNum = monday.week();
      let label: string;
      if (i === 0) label = '本周';
      else if (i === -1) label = '上周';
      else if (i === 1) label = '下周';
      else label = `第${weekNum}周`;
      options.push({ label, offset: i, isCurrent: i === 0 });
    }
  } else if (mode === 'month') {
    const currentMonth = now.month(); // 0=1月, 11=12月
    for (let m = 0; m < 12; m++) {
      const offset = m - currentMonth;
      const date = now.add(offset, 'month');
      let label: string;
      if (offset === 0) label = '本月';
      else label = date.format('M月');
      options.push({ label, offset, isCurrent: offset === 0 });
    }
  } else {
    for (let i = -3; i <= 3; i++) {
      const year = now.year() + i;
      let label: string;
      if (i === 0) label = '今年';
      else label = `${year}年`;
      options.push({ label, offset: i, isCurrent: i === 0 });
    }
  }

  return options;
}

// ============================================================
// 组件
// ============================================================

export default function StatisticsPage() {
  const { isMobile } = useResponsive();
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [periodMode, setPeriodMode] = useState<'week' | 'month' | 'year'>('month');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categoryData, setCategoryData] = useState<CategorySummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyTrend[]>([]);
  const [stats, setStats] = useState({ totalAmount: 0, dailyAverage: 0 });
  const [prevStats, setPrevStats] = useState<{ totalAmount: number; dailyAverage: number } | null>(null);
  const [chartKey, setChartKey] = useState(0);

  const periodScrollRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const { getTransactionsByDateRange } = useTransactionStore();

  // 周期选项
  const periodOptions = getPeriodOptions(periodMode);
  const currentPeriod = getCurrentPeriod(periodMode, periodOffset);

  // ============================================================
  // 数据加载
  // ============================================================
  const loadData = useCallback(async () => {
    setLoading(true);
    const prevPeriod = getPrevPeriod(currentPeriod, periodMode);

    const [currentTxs, prevTxs] = await Promise.all([
      getTransactionsByDateRange(currentPeriod.from, currentPeriod.to),
      getTransactionsByDateRange(prevPeriod.from, prevPeriod.to),
    ]);

    const currStats = computeStats(currentTxs, transactionType, currentPeriod.daysInPeriod);
    const prev = computeStats(prevTxs, transactionType, prevPeriod.daysInPeriod);

    setStats({ totalAmount: currStats.totalAmount, dailyAverage: currStats.dailyAverage });
    setCategoryData(currStats.categoryData);
    setDailyData(currStats.dailyData);
    setPrevStats(prevTxs.length > 0 ? { totalAmount: prev.totalAmount, dailyAverage: prev.dailyAverage } : null);
    setChartKey((k) => k + 1);
    setLoading(false);
  }, [transactionType, periodMode, periodOffset, currentPeriod.from, currentPeriod.to, getTransactionsByDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换模式时重置偏移
  useEffect(() => {
    setPeriodOffset(0);
  }, [periodMode]);

  // 自动滚动激活项到可视区
  useEffect(() => {
    if (activeItemRef.current && periodScrollRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [periodOffset, periodMode]);

  // ============================================================
  // 渲染
  // ============================================================
  const isExpense = transactionType === 'expense';
  const typeColor = isExpense ? EXPENSE_COLOR : INCOME_COLOR;
  const typeName = isExpense ? '支出' : '收入';

  // ==================== Mobile ====================
  if (isMobile) {
    return (
      <MobileStatsView
        transactionType={transactionType}
        setTransactionType={setTransactionType}
        periodMode={periodMode}
        setPeriodMode={setPeriodMode}
        periodOffset={periodOffset}
        setPeriodOffset={setPeriodOffset}
        loading={loading}
        categoryData={categoryData}
        dailyData={dailyData}
        stats={stats}
        prevStats={prevStats}
        chartKey={chartKey}
        currentPeriod={currentPeriod}
        periodOptions={periodOptions}
        typeName={typeName}
        isExpense={isExpense}
      />
    );
  }

  // ==================== Desktop (unchanged) ====================
  return (
    <Spin spinning={loading}>
      {/* ======== 顶部导航区 ======== */}
      <div style={{ marginBottom: 20 }}>
        {/* 收支切换 */}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <Select
            size="large"
            value={transactionType}
            onChange={(val) => {
              setTransactionType(val);
              setPeriodOffset(0);
            }}
            style={{ width: 140 }}
            options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' },
            ]}
          />
        </div>

        {/* 周期 Tab — 三均分满宽方框 */}
        <div style={{ marginBottom: 12, display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
          {(['week', 'month', 'year'] as const).map((mode, idx) => {
            const labels = { week: '周', month: '月', year: '年' };
            const isActive = periodMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: `1px solid ${isActive ? '#1677FF' : '#e8e8e8'}`,
                  borderLeft: idx > 0 ? 'none' : `1px solid ${isActive ? '#1677FF' : '#e8e8e8'}`,
                  background: isActive ? '#1677FF' : '#fff',
                  color: isActive ? '#fff' : '#333',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 15,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* 时间筛选栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined />}
            onClick={() => setPeriodOffset((o) => o - 1)}
          />
          <div
            ref={periodScrollRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'flex',
              gap: 0,
            }}
            className="stats-period-scroll"
          >
            {periodOptions.map((opt) => (
              <button
                key={opt.offset}
                ref={opt.offset === periodOffset ? activeItemRef : undefined}
                onClick={() => setPeriodOffset(opt.offset)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  border: 'none',
                  borderBottom: opt.offset === periodOffset ? '3px solid #1677FF' : '3px solid transparent',
                  background: 'transparent',
                  color: opt.offset === periodOffset ? '#1677FF' : '#666',
                  fontWeight: opt.offset === periodOffset ? 600 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  outline: 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            type="text"
            size="small"
            icon={<RightOutlined />}
            onClick={() => setPeriodOffset((o) => o + 1)}
          />
        </div>
      </div>

      {/* ======== 数据概览区 ======== */}
      {dailyData.length === 0 && categoryData.length === 0 ? (
        <Empty description={`${currentPeriod.label}暂无${typeName}记录`} style={{ padding: '60px 0' }} />
      ) : (
        <>
          {/* KPI 卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={12}>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>
                  {periodMode === 'week' ? '本周' : periodMode === 'month' ? '本月' : '本年'}
                  {typeName}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: typeColor, marginBottom: 4 }}>
                  ¥{stats.totalAmount.toFixed(2)}
                </div>
                {prevStats && (
                  <CompareBadge
                    current={stats.totalAmount}
                    previous={prevStats.totalAmount}
                    isExpense={isExpense}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>日均{typeName}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: typeColor, marginBottom: 4 }}>
                  ¥{stats.dailyAverage.toFixed(2)}
                </div>
                {prevStats && (
                  <CompareBadge
                    current={stats.dailyAverage}
                    previous={prevStats.dailyAverage}
                    isExpense={isExpense}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* 折线趋势图 */}
          <Card style={{ marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart key={chartKey} data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, typeName]}
                  labelFormatter={(label) => `${currentPeriod.from.slice(0, 7)}-${label}`}
                />
                <Line
                  type="monotone"
                  dataKey={isExpense ? 'expense' : 'income'}
                  stroke={typeColor}
                  strokeWidth={2}
                  dot={{ r: 4, fill: typeColor }}
                  activeDot={{ r: 6 }}
                  name={typeName}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* ======== 分类排行区 ======== */}
          <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
            {typeName}排行
          </div>
          <Card>
            {categoryData.length === 0 ? (
              <Empty description={`暂无${typeName}分类数据`} style={{ padding: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {categoryData.map((item, index) => (
                  <div key={item.category_id}>
                    {/* 主行：图标+名称 / 百分比 / 金额 */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      {/* 左侧：图标 + 名称 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: item.category_color || COLORS[index % COLORS.length],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {item.category_name.charAt(0)}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.category_name}
                        </span>
                      </div>
                      {/* 中间：百分比 */}
                      <span style={{ fontSize: 14, color: '#999', margin: '0 16px', whiteSpace: 'nowrap' }}>
                        {item.percentage.toFixed(1)}%
                      </span>
                      {/* 右侧：金额 */}
                      <span style={{ fontSize: 16, fontWeight: 600, color: typeColor, whiteSpace: 'nowrap' }}>
                        ¥{item.amount.toFixed(2)}
                      </span>
                    </div>
                    {/* 进度条 */}
                    <Progress
                      percent={item.percentage}
                      showInfo={false}
                      strokeColor={PROGRESS_YELLOW}
                      trailColor="#f5f5f5"
                      size="small"
                      strokeLinecap="round"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </Spin>
  );
}

// ============================================================
// 子组件
// ============================================================

interface CompareBadgeProps {
  current: number;
  previous: number;
  isExpense: boolean;
}

/** 较上期变化徽标 */
function CompareBadge({ current, previous, isExpense }: CompareBadgeProps) {
  if (previous === 0) {
    return <span style={{ fontSize: 12, color: '#999' }}>上期无数据</span>;
  }

  const diff = current - previous;
  const pct = Math.abs((diff / previous) * 100);
  const isUp = diff > 0;
  const isZero = diff === 0;

  if (isZero) {
    return <span style={{ fontSize: 12, color: '#999' }}>持平</span>;
  }

  // 支出：涨=坏(红)，跌=好(绿)；收入：涨=好(绿)，跌=坏(红)
  const bad = isExpense ? isUp : !isUp;
  const color = bad ? '#E74C3C' : '#27AE60';
  const Arrow = isUp ? ArrowUpOutlined : ArrowDownOutlined;

  return (
    <span style={{ fontSize: 12, color }}>
      <Arrow style={{ fontSize: 11 }} /> {pct.toFixed(1)}% 较上期
    </span>
  );
}

// ============================================================
// 移动端统计视图
// ============================================================

interface MobileStatsViewProps {
  transactionType: TransactionType;
  setTransactionType: (t: TransactionType) => void;
  periodMode: 'week' | 'month' | 'year';
  setPeriodMode: (m: 'week' | 'month' | 'year') => void;
  periodOffset: number;
  setPeriodOffset: (o: number) => void;
  loading: boolean;
  categoryData: CategorySummary[];
  dailyData: DailyTrend[];
  stats: { totalAmount: number; dailyAverage: number };
  prevStats: { totalAmount: number; dailyAverage: number } | null;
  chartKey: number;
  currentPeriod: PeriodRange;
  periodOptions: PeriodOption[];
  typeName: string;
  isExpense: boolean;
}

function MobileStatsView({
  transactionType, setTransactionType,
  periodMode, setPeriodMode,
  periodOffset, setPeriodOffset,
  loading, categoryData, dailyData,
  stats, chartKey, currentPeriod, periodOptions, typeName, isExpense,
}: MobileStatsViewProps) {
  const periodScrollRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // 自动滚动激活项到可视区
  useEffect(() => {
    if (activeItemRef.current && periodScrollRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [periodOffset, periodMode]);

  // 年模式下只显示今年
  const visiblePeriodOptions = periodMode === 'year'
    ? periodOptions.filter((o) => o.offset === 0)
    : periodOptions;

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
      <MobileHeader style={{ padding: '12px 16px 16px' }}>
        {/* 类型标题 */}
        <div
          onClick={() => setTransactionType(isExpense ? 'income' : 'expense')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginBottom: 16,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: '#333' }}>{typeName}</span>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>

        {/* 周/月/年 切换 */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {(['week', 'month', 'year'] as const).map((mode) => {
            const labels = { week: '周', month: '月', year: '年' };
            const active = periodMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? '#333' : 'transparent',
                  color: active ? '#FFD93D' : '#333',
                  borderRadius: active ? 8 : 0,
                  fontWeight: active ? 600 : 400,
                  outline: 'none',
                }}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </MobileHeader>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', touchAction: 'pan-y', padding: '12px 16px 80px 12px' }}>
        {/* 周期选择 — 左右滑动切换，无滚动条 */}
        <div
          ref={periodScrollRef}
          className="stats-period-scroll"
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            padding: '12px 4px',
            gap: 0,
            touchAction: 'pan-x',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none' as const,
          }}
        >
          {visiblePeriodOptions.map((opt) => (
            <button
              key={opt.offset}
              ref={opt.offset === periodOffset ? activeItemRef : undefined}
              onClick={() => setPeriodOffset(opt.offset)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                border: 'none',
                borderBottom: opt.offset === periodOffset ? '3px solid #FFD93D' : '3px solid transparent',
                background: 'transparent',
                color: opt.offset === periodOffset ? '#333' : '#999',
                fontWeight: opt.offset === periodOffset ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                touchAction: 'manipulation',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 汇总行 */}
        <div style={{ display: 'flex', gap: 24, padding: '4px 4px 12px', fontSize: 13, color: '#666' }}>
          <span>
            总{typeName}：<b>¥{stats.totalAmount.toFixed(2)}</b>
          </span>
          <span>
            平均值：<b>¥{stats.dailyAverage.toFixed(2)}</b>
          </span>
        </div>

        {/* 加载态 / 空态 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>加载中...</div>
        ) : dailyData.length === 0 && categoryData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 14 }}>{currentPeriod.label}暂无{typeName}记录</div>
          </div>
        ) : (
          <>
            {/* 折线图 */}
            <div style={{ height: 180, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={chartKey} data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toFixed(2)}`, typeName]}
                  />
                  <Line
                    type="linear"
                    dataKey={isExpense ? 'expense' : 'income'}
                    stroke="#FFD93D"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#FFD93D' }}
                    activeDot={{ r: 5 }}
                    name={typeName}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 分类排行榜 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 14 }}>
                {typeName}排行榜
              </h3>
              {categoryData.map((item) => (
                <div key={item.category_id} style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
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
                      marginRight: 10,
                      color: item.category_color || '#F5A623',
                    }}
                  >
                    {item.category_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: '#333' }}>{item.category_name}</span>
                      <span style={{ fontSize: 12, color: '#999' }}>{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(item.percentage, 100)}%`,
                          background: '#FFD93D',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: '#333',
                      marginLeft: 10,
                      minWidth: 40,
                      textAlign: 'right',
                    }}
                  >
                    ¥{item.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 数据计算
// ============================================================

interface StatsResult {
  totalAmount: number;
  dailyAverage: number;
  categoryData: CategorySummary[];
  dailyData: DailyTrend[];
}

function computeStats(transactions: Transaction[], type: TransactionType, daysInPeriod: number): StatsResult {
  const filtered = transactions.filter((t) => t.type === type);
  const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0);
  const dailyAverage = daysInPeriod > 0 ? totalAmount / daysInPeriod : 0;

  // 分类汇总
  const catMap = new Map<string, { name: string; color: string | null; amount: number }>();
  for (const t of filtered) {
    const cat = t.category;
    const name = cat?.name || '未分类';
    const color = cat?.color || null;
    const existing = catMap.get(t.category_id);
    if (existing) {
      existing.amount += t.amount;
    } else {
      catMap.set(t.category_id, { name, color, amount: t.amount });
    }
  }

  const categoryData: CategorySummary[] = Array.from(catMap.entries())
    .map(([id, v]) => ({
      category_id: id,
      category_name: v.name,
      category_color: v.color,
      amount: v.amount,
      percentage: totalAmount > 0 ? (v.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 日趋势
  const dailyData: DailyTrend[] = [];
  if (filtered.length > 0) {
    // 从周期起始日构造日期序列
    const fromDate = filtered.reduce((min, t) => (t.date < min ? t.date : min), filtered[0].date);
    const toDate = filtered.reduce((max, t) => (t.date > max ? t.date : max), filtered[0].date);
    const start = dayjs(fromDate);
    const end = dayjs(toDate);
    const dayCount = end.diff(start, 'day') + 1;

    const dailyMap = new Map<string, { income: number; expense: number }>();
    // 如果过滤后数据覆盖范围不足，至少覆盖这个周期
    const fillStart = start;
    const fillCount = Math.max(dayCount, Math.min(daysInPeriod, 31));
    for (let i = 0; i < fillCount; i++) {
      const d = fillStart.add(i, 'day').format('YYYY-MM-DD');
      dailyMap.set(d, { income: 0, expense: 0 });
    }
    for (const t of filtered) {
      const entry = dailyMap.get(t.date);
      if (entry) {
        if (t.type === 'income') entry.income += t.amount;
        else entry.expense += t.amount;
      } else {
        dailyMap.set(t.date, { income: t.type === 'income' ? t.amount : 0, expense: t.type === 'expense' ? t.amount : 0 });
      }
    }

    for (const [date, v] of dailyMap.entries()) {
      dailyData.push({
        date: date.slice(5), // MM-DD
        income: v.income,
        expense: v.expense,
      });
    }
    dailyData.sort((a, b) => a.date.localeCompare(b.date));
  }

  return { totalAmount, dailyAverage, categoryData, dailyData };
}
