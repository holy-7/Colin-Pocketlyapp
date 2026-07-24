import { useState, useEffect, useRef } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, App,
} from 'antd';
import type { InputRef } from 'antd';
import dayjs from 'dayjs';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { useResponsive } from '@/hooks/useResponsive';
import type { TransactionFormData, TransactionType } from '@/types';
import { AMOUNT_REGEX } from '@/types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  initialValues?: Partial<TransactionFormData>;
  title?: string;
}

export default function TransactionForm({
  open,
  onClose,
  onSubmit,
  initialValues,
  title = '记一笔',
}: TransactionFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const amountRef = useRef<InputRef>(null);
  const categories = useCategoryStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  const transactionType: TransactionType = Form.useWatch('type', form) || 'expense';
  const { isMobile } = useResponsive();

  const filteredCategories = categories.filter((c) => c.type === transactionType);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          date: initialValues.date ? dayjs(initialValues.date) : dayjs(),
        });
      } else {
        form.setFieldsValue({
          type: 'expense',
          date: dayjs(),
        });
      }
      // 自动聚焦金额输入
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [open, form, initialValues]);

  const handleFinish = async (values: Record<string, unknown>) => {
    const amountStr = String(values.amount || '');
    if (!AMOUNT_REGEX.test(amountStr)) {
      message.error('金额格式错误，仅支持数字和小数点，最大 99999999.99');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        account_id: values.account_id as string,
        category_id: values.category_id as string,
        amount: amountStr,
        type: values.type as TransactionType,
        date: (values.date as dayjs.Dayjs).format('YYYY-MM-DD'),
        note: (values.note as string) || '',
        tag_ids: [],
      });
      message.success('记账成功');
      onClose();
    } catch {
      message.error('记账失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
      width={isMobile ? '100%' : 480}
      style={isMobile ? { maxWidth: '100vw', margin: 0, top: 0 } : undefined}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ type: 'expense', date: dayjs() }}
      >
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '💰 支出', value: 'expense' },
              { label: '💵 收入', value: 'income' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label="金额"
          rules={[
            { required: true, message: '请输入金额' },
            { pattern: AMOUNT_REGEX, message: '仅支持数字和小数点，最大 99999999.99' },
          ]}
        >
          <Input
            ref={amountRef}
            prefix="¥"
            placeholder="0.00"
            maxLength={12}
            style={{ fontSize: 24, fontWeight: 700 }}
          />
        </Form.Item>

        <Form.Item name="category_id" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select
            placeholder="选择分类"
            options={filteredCategories.map((c) => ({
              label: (
                <span>
                  <span style={{ color: c.color || '#999', marginRight: 6 }}>●</span>
                  {c.name}
                </span>
              ),
              value: c.id,
            }))}
          />
        </Form.Item>

        <Form.Item name="account_id" label="账户" rules={[{ required: true, message: '请选择账户' }]}>
          <Select
            placeholder="选择账户"
            options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          />
        </Form.Item>

        <Form.Item name="date" label="日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="note" label="备注">
          <Input.TextArea placeholder="添加备注..." rows={2} maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
