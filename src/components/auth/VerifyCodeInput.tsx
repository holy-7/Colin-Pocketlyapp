import { useState, useEffect, useCallback } from 'react';
import { Input, Button, Typography, theme } from 'antd';
import { MailOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

// ============================================================
// VerifyCodeInput — 6 位邮箱验证码输入组件
// ============================================================

interface VerifyCodeInputProps {
  email: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
}

export default function VerifyCodeInput({
  email,
  onSubmit,
  onResend,
  onBack,
  loading,
}: VerifyCodeInputProps) {
  const { token } = theme.useToken();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // 重发冷却倒计时
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = useCallback(async () => {
    if (code.length !== 6) return;
    setError('');
    try {
      await onSubmit(code);
    } catch {
      setError('验证失败，请重试');
    }
  }, [code, onSubmit]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await onResend();
      setResendCooldown(60);
    } catch {
      setError('重新发送失败，请稍后再试');
    } finally {
      setResending(false);
    }
  }, [onResend, resendCooldown, resending]);

  // 6 位数字填满时自动提交
  const handleChange = useCallback((value: string) => {
    setCode(value);
    setError('');
    if (value.length === 6) {
      setTimeout(() => {
        onSubmit(value).catch(() => {
          setError('验证失败，请重试');
        });
      }, 300);
    }
  }, [onSubmit]);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* 邮箱图标 + 提示 */}
      <div style={{ marginBottom: 24 }}>
        <MailOutlined
          style={{
            fontSize: 48,
            color: token.colorPrimary,
            marginBottom: 16,
          }}
        />
        <Title level={3} style={{ marginBottom: 8 }}>
          输入验证码
        </Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          验证码已发送至{' '}
          <Text strong style={{ color: token.colorText }}>{email}</Text>
        </Text>
      </div>

      {/* 6 位 OTP 输入 */}
      <div style={{ marginBottom: 24 }}>
        <Input.OTP
          length={6}
          size="large"
          value={code}
          onChange={handleChange}
          disabled={loading}
          style={{ justifyContent: 'center' }}
          inputStyle={{
            width: 44,
            height: 52,
            fontSize: 22,
            borderRadius: 8,
          }}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <Text
          type="danger"
          style={{ display: 'block', marginBottom: 16, fontSize: 14 }}
        >
          {error}
        </Text>
      )}

      {/* 提交按钮（手动提交备用） */}
      <Button
        type="primary"
        block
        size="large"
        loading={loading}
        disabled={code.length !== 6}
        onClick={handleSubmit}
        style={{ height: 48, fontSize: 16, marginBottom: 16 }}
      >
        验证
      </Button>

      {/* 重新发送 + 返回修改 */}
      <div style={{ fontSize: 15 }}>
        <Text type="secondary">没收到邮件？</Text>{' '}
        {resendCooldown > 0 ? (
          <Text type="secondary">{resendCooldown}s 后可重发</Text>
        ) : (
          <a
            onClick={handleResend}
            style={{ opacity: resending ? 0.6 : 1 }}
          >
            {resending ? '发送中...' : '重新发送'}
          </a>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <a onClick={onBack}>返回修改邮箱</a>
      </div>
    </div>
  );
}
