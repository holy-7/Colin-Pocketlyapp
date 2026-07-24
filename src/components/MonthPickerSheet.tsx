import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  MOBILE_PRIMARY,
  MOBILE_TEXT_PRIMARY,
  MOBILE_TEXT_TERTIARY,
} from '@/theme/mobileTokens';

interface MonthPickerSheetProps {
  open: boolean;
  value: dayjs.Dayjs;
  onChange: (newValue: dayjs.Dayjs) => void;
  onClose: () => void;
  yearOnly?: boolean;
}

export default function MonthPickerSheet({ open, value, onChange, onClose, yearOnly = false }: MonthPickerSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [pendingYear, setPendingYear] = useState(value.year());
  const [pendingMonth, setPendingMonth] = useState(value.month() + 1);

  // 打开时初始化状态
  useEffect(() => {
    if (open) {
      setPendingYear(value.year());
      setPendingMonth(value.month() + 1);
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
    }
  }, [open, value]);

  // 动画结束后移出 DOM
  const handleTransitionEnd = useCallback(() => {
    if (!open && !animating) {
      setVisible(false);
    }
  }, [open, animating]);

  const handleClose = useCallback(() => {
    setAnimating(false);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleMonthClick = useCallback(
    (month: number) => {
      const newValue = yearOnly
        ? dayjs(`${pendingYear}-01-01`)
        : dayjs(`${pendingYear}-${String(month).padStart(2, '0')}-01`);
      onChange(newValue);
      setAnimating(false);
      setTimeout(() => onClose(), 300);
    },
    [pendingYear, onChange, onClose, yearOnly]
  );

  const handleConfirm = useCallback(() => {
    const newValue = yearOnly
      ? dayjs(`${pendingYear}-01-01`)
      : dayjs(`${pendingYear}-${String(pendingMonth).padStart(2, '0')}-01`);
    onChange(newValue);
    setAnimating(false);
    setTimeout(() => onClose(), 300);
  }, [pendingYear, pendingMonth, onChange, onClose, yearOnly]);

  const prevYear = () => setPendingYear((y) => Math.max(2000, y - 1));
  const nextYear = () => setPendingYear((y) => Math.min(2100, y + 1));

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
          padding: '20px 20px 32px',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* 年份选择行 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginBottom: yearOnly ? 32 : 20,
          }}
        >
          <span
            onClick={prevYear}
            style={{ cursor: 'pointer', fontSize: 16, color: MOBILE_TEXT_PRIMARY, padding: '4px 8px', userSelect: 'none' }}
          >
            ◀
          </span>
          <span style={{ fontSize: 18, fontWeight: 600, color: MOBILE_TEXT_PRIMARY }}>
            {pendingYear}年
          </span>
          <span
            onClick={nextYear}
            style={{ cursor: 'pointer', fontSize: 16, color: MOBILE_TEXT_PRIMARY, padding: '4px 8px', userSelect: 'none' }}
          >
            ▶
          </span>
        </div>

        {/* 月份网格（年选模式隐藏） */}
        {!yearOnly && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const isSelected = m === pendingMonth;
              return (
                <button
                  key={m}
                  onClick={() => handleMonthClick(m)}
                  style={{
                    padding: '14px 0',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: isSelected ? 600 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center' as const,
                    background: isSelected ? MOBILE_PRIMARY : '#F5F5F5',
                    color: MOBILE_TEXT_PRIMARY,
                    outline: 'none',
                  }}
                >
                  {m}月
                </button>
              );
            })}
          </div>
        )}

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
