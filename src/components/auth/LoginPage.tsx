import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, App, Spin } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/authStore';
import VerifyCodeInput from './VerifyCodeInput';

const { Title, Text } = Typography;

type FormMode = 'signIn' | 'signUp' | 'forgotPassword' | 'verifyEmail' | 'resetPassword';

// ============================================================
// ResetPasswordResult — 密码重置结果展示
// ============================================================

function ResetPasswordResult({
  status,
  message: msg,
  onBack,
}: {
  status: 'loading' | 'success' | 'error';
  message: string;
  onBack: () => void;
}) {
  if (status === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 15 }}>
          正在重置密码...
        </Text>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
        <Title level={3} style={{ marginBottom: 8 }}>密码重置成功</Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          密码已重置为默认密码，请登录后修改
        </Text>
        <div style={{ marginTop: 24 }}>
          <Button type="primary" onClick={onBack} style={{ height: 48, fontSize: 16, padding: '0 32px' }}>
            去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 16 }} />
      <Title level={3} style={{ marginBottom: 8 }}>重置失败</Title>
      <Text type="secondary" style={{ fontSize: 15 }}>{msg}</Text>
      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={onBack} style={{ height: 48, fontSize: 16, padding: '0 32px' }}>
          返回登录
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// LoginPage — 响应式登录/注册页
// ============================================================

export default function LoginPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [mode, setMode] = useState<FormMode>('signIn');
  const [form] = Form.useForm();
  const [verifyEmailValue, setVerifyEmailValue] = useState('');
  const {
    signIn, signUp, sendPasswordReset, verifyEmail, resendVerificationCode,
    resetToDefaultPassword, loading,
  } = useAuthStore();
  const user = useAuthStore((s) => s.user);

  // 检测已登录但未验证邮箱的用户（关闭App后回来）
  useEffect(() => {
    if (user && !user.email_confirmed_at) {
      setMode('verifyEmail');
      setVerifyEmailValue(user.email || '');
    }
  }, [user]);

  const resetTriggered = useRef(false);
  const [resetStatus, setResetStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [resetMessage, setResetMessage] = useState('');

  // 检测 URL 中的密码重置参数（hash 或 search）→ 自动重置密码（仅执行一次）
  useEffect(() => {
    if (resetTriggered.current) return;

    // 尝试从 hash 或 search 中提取 recovery 参数
    const getRecoveryParams = (): { tokenHash: string; errorCode: string } | null => {
      // 优先从 hash 中取（正常路径：/#/login?token_hash=...&type=recovery）
      const hash = window.location.hash;
      const hashQuery = hash.indexOf('?');
      if (hashQuery !== -1) {
        const p = new URLSearchParams(hash.substring(hashQuery));
        if (p.get('type') === 'recovery') {
          return { tokenHash: p.get('token_hash') || '', errorCode: p.get('error_code') || '' };
        }
      }
      // 兜底：从 search 中取（# 被截掉的情况：/?token_hash=...&type=recovery）
      const search = window.location.search;
      if (search) {
        const p = new URLSearchParams(search);
        if (p.get('type') === 'recovery') {
          return { tokenHash: p.get('token_hash') || '', errorCode: p.get('error_code') || '' };
        }
      }
      return null;
    };

    const recoveryParams = getRecoveryParams();
    if (!recoveryParams) return;

    const { tokenHash, errorCode } = recoveryParams;

    resetTriggered.current = true;
    setMode('resetPassword');

    if (errorCode) {
      setResetStatus('error');
      setResetMessage('链接已过期或无效，请重新发送');
      return;
    }
    if (!tokenHash) {
      setResetStatus('error');
      setResetMessage('链接无效，请重新发送');
      return;
    }

    setResetStatus('loading');
    resetToDefaultPassword(tokenHash).then((r) => {
      if (r?.error) {
        setResetStatus('error');
        setResetMessage(r.error);
      } else {
        setResetStatus('success');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values: { email: string; password: string; displayName?: string }) => {
    let result: { error?: string; needVerification?: boolean };

    if (mode === 'signIn') {
      result = await signIn(values.email, values.password);
    } else if (mode === 'signUp') {
      result = await signUp(values.email, values.password, values.displayName);
    } else {
      result = await sendPasswordReset(values.email);
    }

    if (result?.error) {
      if (mode === 'signIn') {
        message.error('账户或者密码错误，请重新登录！');
      } else {
        message.error(result.error);
      }
    } else if (result?.needVerification) {
      // 邮箱未验证 → 切换到验证码界面
      setVerifyEmailValue(values.email);
      setMode('verifyEmail');
      form.resetFields();
    } else {
      if (mode === 'forgotPassword') {
        message.success('密码重置邮件已发送，请查收邮箱');
        setMode('signIn');
        form.resetFields();
      } else if (mode === 'signUp') {
        message.success('验证码已发送至您的邮箱');
        setVerifyEmailValue(values.email);
        setMode('verifyEmail');
        form.resetFields();
      } else {
        message.success('登录成功！');
        navigate('/', { replace: true });
      }
    }
  };

  // 验证码提交
  const handleVerifyCode = async (code: string) => {
    const result = await verifyEmail(verifyEmailValue, code);
    if (result?.error) {
      message.error(result.error);
      throw new Error(result.error);
    }
    message.success('验证成功！正在准备默认数据...');
    navigate('/', { replace: true });
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    const result = await resendVerificationCode(verifyEmailValue);
    if (result?.error) {
      message.error(result.error);
      throw new Error(result.error);
    }
    message.success('验证码已重新发送');
  };

  const toggleMode = (newMode: FormMode) => {
    setMode(newMode);
    form.resetFields();
  };

  // --- 表单内容 ---
  const formContent = mode === 'verifyEmail' ? (
    <VerifyCodeInput
      email={verifyEmailValue}
      onSubmit={handleVerifyCode}
      onResend={handleResendCode}
      onBack={() => { setMode('signIn'); form.resetFields(); }}
      loading={loading}
    />
  ) : mode === 'resetPassword' ? (
    <ResetPasswordResult
      status={resetStatus}
      message={resetMessage}
      onBack={() => { setMode('signIn'); form.resetFields(); }}
    />
  ) : (
    <>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ marginBottom: 8, color: '#333', fontSize: 28 }}>
          {mode === 'signIn' ? '欢迎回来' : mode === 'signUp' ? '创建账号' : '重置密码'}
        </Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          {mode === 'signIn'
            ? '登录你的 Colin记账 账号'
            : mode === 'signUp'
              ? '注册后即可开始记账之旅'
              : '输入邮箱，我们将发送重置链接'}
        </Text>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
        {mode === 'signUp' && (
          <Form.Item
            name="displayName"
            rules={[{ required: false, message: '请输入昵称' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="昵称（选填）" style={{ height: 48 }} />
          </Form.Item>
        )}

        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" style={{ height: 48 }} />
        </Form.Item>

        {mode !== 'forgotPassword' && (
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} style={{ height: 48 }} />
          </Form.Item>
        )}

        <Form.Item style={{ marginBottom: 8 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 48, fontSize: 16 }}>
            {mode === 'signIn' ? '登 录' : mode === 'signUp' ? '注 册' : '发送重置邮件'}
          </Button>
        </Form.Item>
      </Form>

      {/* 底部切换链接 */}
      <div style={{ textAlign: 'center', fontSize: 15 }}>
        {mode === 'signIn' && (
          <>
            <a onClick={() => toggleMode('forgotPassword')}>忘记密码？</a>
            <Text type="secondary" style={{ margin: '0 8px' }}>|</Text>
            <Text type="secondary">还没有账号？</Text>{' '}
            <a onClick={() => toggleMode('signUp')}>立即注册</a>
          </>
        )}
        {mode === 'signUp' && (
          <>
            <Text type="secondary">已有账号？</Text>{' '}
            <a onClick={() => toggleMode('signIn')}>立即登录</a>
          </>
        )}
        {mode === 'forgotPassword' && (
          <a onClick={() => toggleMode('signIn')}>返回登录</a>
        )}
      </div>
    </>
  );

  // --- Desktop 布局 ---
  if (!isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f5f5f5',
        }}
      >
        <Card
          style={{ width: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          styles={{ body: { padding: '32px 40px' } }}
        >
          {formContent}
        </Card>
      </div>
    );
  }

  // --- Mobile 布局 ---
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #FFD93D 0%, #FFD93D 28%, #FFF8E1 45%, #f5f5f5 48%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: '0 16px 24px',
      }}
    >
      {/* Logo 区域 */}
      <div style={{ textAlign: 'center', marginBottom: -64 }}>
        <img
          src="./logo.svg"
          alt="Colin记账"
          style={{
            height: 300,
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))',
          }}
        />
      </div>

      <Card
        className="login-card-enter"
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.08)',
          borderTop: '3px solid #FFD93D',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: '48px 32px' } }}
      >
        {formContent}
      </Card>

      {/* 隐私声明 */}
      <Text
        type="secondary"
        style={{ textAlign: 'center', marginTop: 20, fontSize: 13, display: 'block' }}
      >
        🔒 你的数据加密存储在 Supabase，仅你本人可见
      </Text>
    </div>
  );
}
