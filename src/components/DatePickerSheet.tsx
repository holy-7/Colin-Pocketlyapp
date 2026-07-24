import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import dayjs from 'dayjs';
import {
  MOBILE_PRIMARY,
  MOBILE_TEXT_PRIMARY,
  MOBILE_TEXT_TERTIARY,
} from '@/theme/mobileTokens';

interface DatePickerSheetProps {
  open: boolean;
  value: dayjs.Dayjs;
  onChange: (newValue: dayjs.Dayjs) => void;
  onClose: () => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // 显示 5 行高
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220px

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function generateYears(): number[] {
  const years: number[] = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) years.push(y);
  return years;
}

function generateMonths(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function generateDays(year: number, month: number): number[] {
  const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

function scrollToItem(ref: { current: HTMLDivElement | null }, index: number) {
  if (ref.current) {
    ref.current.scrollTop = index * ITEM_HEIGHT;
  }
}

export default function DatePickerSheet({ open, value, onChange, onClose }: DatePickerSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [pendingYear, setPendingYear] = useState(value.year());
  const [pendingMonth, setPendingMonth] = useState(value.month() + 1);
  const [pendingDay, setPendingDay] = useState(value.date());

  const yearRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);

  // 打开时初始化
  useEffect(() => {
    if (open) {
      const y = value.year();
      const m = value.month() + 1;
      const d = value.date();
      setPendingYear(y);
      setPendingMonth(m);
      setPendingDay(d);
      setVisible(true);
      requestAnimationFrame(() => {
        setAnimating(true);
        // 滚动到对应位置
        requestAnimationFrame(() => {
          scrollToItem(yearRef, y - MIN_YEAR);
          scrollToItem(monthRef, m - 1);
          const maxDay = dayjs(`${y}-${String(m).padStart(2, '0')}-01`).daysInMonth();
          scrollToItem(dayRef, Math.min(d, maxDay) - 1);
        });
      });
    } else {
      setAnimating(false);
    }
  }, [open, value]);

  const handleTransitionEnd = useCallback(() => {
    if (!open && !animating) {
      setVisible(false);
    }
  }, [open, animating]);

  const handleClose = useCallback(() => {
    setAnimating(false);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    const maxDay = dayjs(`${pendingYear}-${String(pendingMonth).padStart(2, '0')}-01`).daysInMonth();
    const safeDay = Math.min(pendingDay, maxDay);
    const newValue = dayjs(
      `${pendingYear}-${String(pendingMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
    );
    onChange(newValue);
    setAnimating(false);
    setTimeout(() => onClose(), 300);
  }, [pendingYear, pendingMonth, pendingDay, onChange, onClose]);

  const years = generateYears();
  const months = generateMonths();
  const days = generateDays(pendingYear, pendingMonth);

  // 确保 pendingDay 不超出当月天数
  const safePendingDay = Math.min(pendingDay, days.length);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      {/* 遮罩层 */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          opacity: animating ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* 隐藏 WebKit 滚动条 */}
      <style>{`
        .date-picker-column::-webkit-scrollbar { display: none; }
      `}</style>

      {/* 底部面板 */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 24px',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* 标题 */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            color: MOBILE_TEXT_PRIMARY,
            marginBottom: 16,
          }}
        >
          选择日期
        </div>

        {/* 三列选择器 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 20,
            position: 'relative',
          }}
        >
          {/* 高亮指示条（居中） */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: ITEM_HEIGHT,
              transform: 'translateY(-50%)',
              background: `${MOBILE_PRIMARY}30`,
              borderRadius: 8,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* 年列 */}
          <ColumnPicker
            ref={yearRef}
            items={years}
            selectedValue={pendingYear}
            suffix="年"
            itemCount={years.length}
            onSelect={(val) => setPendingYear(val)}
          />

          {/* 月列 */}
          <ColumnPicker
            ref={monthRef}
            items={months}
            selectedValue={pendingMonth}
            suffix="月"
            itemCount={12}
            onSelect={(val) => setPendingMonth(val)}
          />

          {/* 日列 */}
          <ColumnPicker
            ref={dayRef}
            items={days}
            selectedValue={safePendingDay}
            suffix="日"
            itemCount={days.length}
            onSelect={(val) => setPendingDay(val)}
          />
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              background: '#F5F5F5',
              color: MOBILE_TEXT_PRIMARY,
              outline: 'none',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: MOBILE_PRIMARY,
              color: MOBILE_TEXT_PRIMARY,
              outline: 'none',
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 单列选择器（自包含滚动 + 吸附逻辑，桌面/移动端通用）
// ============================================================

const SPACER_HEIGHT = (VISIBLE_ITEMS - 1) / 2 * ITEM_HEIGHT; // 88px

interface ColumnPickerProps {
  items: number[];
  selectedValue: number;
  suffix: string;
  itemCount: number;
  onSelect: (value: number) => void;
}

const ColumnPicker = forwardRef<HTMLDivElement, ColumnPickerProps>(function ColumnPicker(
  { items, selectedValue, suffix, itemCount, onSelect },
  ref
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 保存最新回调避免闭包过期
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 从 scrollTop 计算当前选中值
  const getValueFromScroll = useCallback(
    (el: HTMLDivElement) => {
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(itemCount - 1, index));
      return items[clamped];
    },
    [items, itemCount]
  );

  // 滚动处理：实时更新选中值 + 停止后吸附
  const handleScroll = useCallback(() => {
    const el = (ref as React.RefObject<HTMLDivElement>).current;
    if (!el) return;

    const val = getValueFromScroll(el);
    if (val !== undefined) {
      onSelectRef.current(val);
    }

    // 滚动停止 150ms 后吸附
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const el2 = (ref as React.RefObject<HTMLDivElement>).current;
      if (!el2) return;
      const idx = Math.round(el2.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(itemCount - 1, idx));
      const targetTop = clamped * ITEM_HEIGHT;
      // 仅在偏差 > 2px 时吸附（避免不必要的跳动）
      if (Math.abs(el2.scrollTop - targetTop) > 2) {
        el2.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }, 150);
  }, [getValueFromScroll, ref]);

  // 点击某项直接跳转
  const handleClick = useCallback(
    (item: number, index: number) => {
      const el = (ref as React.RefObject<HTMLDivElement>).current;
      if (!el) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSelectRef.current(item);
      el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
    },
    [ref]
  );

  // 打开时滚动到初始位置
  useEffect(() => {
    const el = (ref as React.RefObject<HTMLDivElement>).current;
    if (!el) return;
    const idx = items.indexOf(selectedValue);
    if (idx >= 0) {
      el.scrollTop = idx * ITEM_HEIGHT;
    }
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative', zIndex: 2 }}>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="date-picker-column"
        style={{
          height: COLUMN_HEIGHT,
          overflowY: 'scroll',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* 顶部占位：让首项能滚到高亮条中央 */}
        <div style={{ height: SPACER_HEIGHT, flexShrink: 0 }} />

        {items.map((item, index) => {
          const isSelected = item === selectedValue;
          return (
            <div
              key={item}
              onClick={() => handleClick(item, index)}
              style={{
                height: ITEM_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSelected ? 20 : 16,
                fontWeight: isSelected ? 700 : 400,
                color: isSelected ? MOBILE_TEXT_PRIMARY : MOBILE_TEXT_TERTIARY,
                cursor: 'pointer',
                transition: 'color 0.15s, font-weight 0.15s, font-size 0.15s',
                userSelect: 'none',
                flexShrink: 0,
              }}
            >
              {item}{suffix}
            </div>
          );
        })}

        {/* 底部占位：让末项能滚到高亮条中央 */}
        <div style={{ height: SPACER_HEIGHT, flexShrink: 0 }} />
      </div>
    </div>
  );
});
