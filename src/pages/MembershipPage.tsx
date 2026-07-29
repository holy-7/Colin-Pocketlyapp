import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Modal, App } from 'antd';
import { CrownOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/authStore';
import MobileHeader from '@/components/MobileHeader';
import type { MembershipTier } from '@/types';

// ============================================================
// MembershipPage — 移动端会员中心
// ============================================================

const PLANS = [
  {
    key: 'monthly' as const,
    title: '月度会员',
    price: '¥9.9',
    period: '/月',
    tier: 'premium' as MembershipTier,
    badge: '',
  },
  {
    key: 'yearly' as const,
    title: '年度会员',
    price: '¥68',
    period: '/年',
    tier: 'premium' as MembershipTier,
    badge: '推荐',
  },
  {
    key: 'lifetime' as const,
    title: '终身会员',
    price: '¥168',
    period: '永久',
    tier: 'lifetime' as MembershipTier,
    badge: '最值',
  },
];

const FEATURES = [
  { label: '记账笔数', free: '无限制', premium: '无限制' },
  { label: '账户数量', free: '最多 3 个', premium: '无限制' },
  { label: '自定义分类', free: '最多 5 个', premium: '无限制' },
  { label: '预算', free: '最多 3 个', premium: '无限制' },
  { label: 'AI 查询', free: '每天 3 次', premium: '无限制' },
  { label: '数据导出', free: '仅 CSV', premium: '全部格式' },
  { label: '桌面端', free: '全部功能', premium: '全部功能' },
];

export default function MembershipPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const profile = useAuthStore((s) => s.profile);
  const upgradeMembership = useAuthStore((s) => s.upgradeMembership);
  const [activating, setActivating] = useState(false);
  const currentTier = profile?.membership_tier ?? 'free';
  const isCurrentPremium = currentTier === 'premium' || currentTier === 'lifetime';

  // 桌面端重定向
  if (!isMobile) {
    navigate('/', { replace: true });
    return null;
  }

  const handleActivate = (plan: typeof PLANS[number]) => {
    Modal.confirm({
      title: `确认开通 ${plan.title}`,
      content: `将模拟购买 ${plan.title}（${plan.price}${plan.period}），点击确认立即生效。`,
      okText: '确认开通',
      cancelText: '取消',
      onOk: async () => {
        setActivating(true);
        const { error } = await upgradeMembership(plan.tier, plan.key);
        setActivating(false);
        if (error) {
          message.error(error);
        } else {
          message.success(`已成功开通${plan.title}！`);
        }
      },
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F5F5F5', overflow: 'hidden' }}>
      <MobileHeader style={{ padding: '20px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate(-1)} style={{ fontSize: 20, cursor: 'pointer', lineHeight: 1, color: '#333' }}>←</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>会员中心</span>
        </div>
      </MobileHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 80px' }}>
        {/* 当前等级卡片 */}
        <Card
          style={{
            borderRadius: 16,
            background: isCurrentPremium
              ? 'linear-gradient(135deg, #FFF9E6, #FFD93D)'
              : 'linear-gradient(135deg, #f5f5f5, #e8e8e8)',
            border: isCurrentPremium ? '1px solid #FFD93D' : '1px solid #e8e8e8',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <CrownOutlined style={{ fontSize: 36, color: isCurrentPremium ? '#FFD700' : '#bbb', marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>
            {currentTier === 'lifetime' ? '终身会员' : currentTier === 'premium' ? '高级会员' : '免费版'}
          </div>
          {currentTier === 'premium' && profile?.premium_expires_at && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              到期时间：{new Date(profile.premium_expires_at).toLocaleDateString('zh-CN')}
            </div>
          )}
          {currentTier === 'lifetime' && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>永久有效</div>
          )}
        </Card>

        {/* 方案卡片 */}
        {!isCurrentPremium && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 12 }}>选择方案</div>
            {PLANS.map((plan) => (
              <Card
                key={plan.key}
                style={{
                  borderRadius: 16,
                  marginBottom: 12,
                  border: plan.badge ? '2px solid #FFD93D' : '1px solid #e8e8e8',
                  position: 'relative',
                }}
              >
                {plan.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 16,
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: '0 0 8px 8px',
                    }}
                  >
                    {plan.badge}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>{plan.title}</div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: '#FF6B00' }}>{plan.price}</span>
                      <span style={{ fontSize: 13, color: '#999' }}>{plan.period}</span>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    loading={activating}
                    onClick={() => handleActivate(plan)}
                    style={{
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      border: 'none',
                      fontWeight: 600,
                      borderRadius: 20,
                    }}
                  >
                    立即开通
                  </Button>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* 功能对比表 */}
        <div style={{ fontSize: 15, fontWeight: 600, color: '#333', margin: '16px 0 12px' }}>功能对比</div>
        <Card style={{ borderRadius: 16 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < FEATURES.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}
            >
              <span style={{ fontSize: 14, color: '#333' }}>{f.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 12, color: '#999' }}>{f.free}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#FF6B00', fontWeight: 500 }}>
                  <CheckCircleOutlined style={{ color: '#FFD700' }} />
                  {f.premium}
                </span>
              </div>
            </div>
          ))}
        </Card>

        {/* 底部提示 */}
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#bbb' }}>
          当前为 Mock 模拟购买，点击即生效
        </div>
      </div>
    </div>
  );
}
