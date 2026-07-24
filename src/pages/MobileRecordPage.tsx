import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import MobileHeader from '@/components/MobileHeader';
import DatePickerSheet from '@/components/DatePickerSheet';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import type { TransactionFormData, TransactionType, Category } from '@/types';

const KEYBOARD_ROWS = [
  ['7', '8', '9', 'date'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '-'],
  ['.', '0', 'delete', 'confirm'],
];

export default function MobileRecordPage() {
  const navigate = useNavigate();
  const { addTransaction } = useTransactionStore();
  const { categories } = useCategoryStore();
  const { accounts } = useAccountStore();

  const [recordType, setRecordType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === recordType),
    [categories, recordType]
  );

  const handleSelectCategory = useCallback((cat: Category) => {
    setSelectedCategory(cat);
    setAmount('0');
    setNote('');
    setShowKeyboard(true);
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'confirm') {
      // 提交记账
      handleSubmit();
      return;
    }

    if (key === 'delete') {
      setAmount((prev) => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
      return;
    }

    if (key === 'date') {
      setShowDatePicker(true);
      return;
    }

    if (key === '+' || key === '-') {
      // 占位功能，暂不处理
      return;
    }

    // 数字或小数点
    setAmount((prev) => {
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }
      // 数字键
      if (prev === '0') return key;
      if (prev.length >= 9) return prev; // 最多9位
      return prev + key;
    });
  }, [selectedCategory, amount, recordType, accounts]);

  const handleSubmit = useCallback(async () => {
    const numAmount = parseFloat(amount);
    if (numAmount <= 0 || isNaN(numAmount) || !selectedCategory) return;

    const defaultAccount = accounts[0];
    if (!defaultAccount) return;

    const formData: TransactionFormData = {
      type: recordType,
      category_id: selectedCategory.id,
      amount: amount,
      account_id: defaultAccount.id,
      date: selectedDate.format('YYYY-MM-DD'),
      note,
      tag_ids: [],
    };

    await addTransaction(formData);
    navigate('/');
  }, [amount, selectedCategory, recordType, accounts, addTransaction, navigate, note, selectedDate]);

  const hideKeyboard = () => setShowKeyboard(false);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#F5F5F5',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 黄色头部：支出/收入切换 + 取消 */}
      <MobileHeader
        style={{
          padding: '12px 16px',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => {
            setRecordType('expense');
            setSelectedCategory(null);
            hideKeyboard();
          }}
          style={{
            padding: '8px 24px',
            fontSize: 16,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: recordType === 'expense' ? '#333' : 'rgba(0,0,0,0.5)',
            borderBottom: recordType === 'expense' ? '2px solid #333' : '2px solid transparent',
            fontWeight: recordType === 'expense' ? 600 : 400,
          }}
        >
          支出
        </button>
        <button
          onClick={() => {
            setRecordType('income');
            setSelectedCategory(null);
            hideKeyboard();
          }}
          style={{
            padding: '8px 24px',
            fontSize: 16,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: recordType === 'income' ? '#333' : 'rgba(0,0,0,0.5)',
            borderBottom: recordType === 'income' ? '2px solid #333' : '2px solid transparent',
            fontWeight: recordType === 'income' ? 600 : 400,
          }}
        >
          收入
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            right: 16,
            fontSize: 14,
            color: '#333',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </MobileHeader>

      {/* 分类图标网格 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '16px 16px 16px 12px' }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无分类，请先在设置中添加
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px 8px',
            }}
          >
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: selectedCategory?.id === cat.id ? '#FFD93D' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    transition: 'all 0.2s',
                    color: selectedCategory?.id === cat.id ? '#333' : cat.color || '#666',
                  }}
                >
                  {cat.name.charAt(0)}
                </div>
                <span style={{ fontSize: 12, color: '#666' }}>{cat.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 自定义数字键盘 */}
      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #eee',
          transform: showKeyboard ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          flexShrink: 0,
        }}
      >
        {showKeyboard && (
          <>
            {/* 键盘头部 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <span style={{ fontSize: 14, color: '#666' }}>
                {selectedCategory?.name || ''}
              </span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#333' }}>
                {amount}
              </span>
            </div>

            {/* 备注输入 */}
            <div style={{ padding: '0 16px 8px' }}>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="添加备注..."
                maxLength={200}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#333',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                }}
              />
            </div>

            {/* 键盘按键 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {KEYBOARD_ROWS.flat().map((key) => {
                const isConfirm = key === 'confirm';
                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    style={{
                      border: 'none',
                      background: isConfirm ? '#FFD93D' : '#fff',
                      borderRight: '1px solid #f0f0f0',
                      borderBottom: '1px solid #f0f0f0',
                      padding: '16px 0',
                      fontSize: 18,
                      color: '#333',
                      cursor: 'pointer',
                      fontWeight: isConfirm ? 600 : 400,
                      outline: 'none',
                    }}
                  >
                    {key === 'delete' ? '⌫' : key === 'date' ? '📅' : key === 'confirm' ? '完成' : key}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 日期选择底部弹出层 */}
      <DatePickerSheet
        open={showDatePicker}
        value={selectedDate}
        onChange={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />
    </div>
  );
}
