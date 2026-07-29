import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Typography } from 'antd';
import { CrownOutlined, CloseOutlined } from '@ant-design/icons';
import { useMembership } from '@/hooks/useMembership';
import { useResponsive } from '@/hooks/useResponsive';

const { Text, Title } = Typography;

// ============================================================
// PremiumGate — 功能锁组件
// 检查通过 → 渲染 children
// 未通过 → 显示升级提示卡片
// ============================================================

interface PremiumGateProps {
  feature: 'account' | 'category' | 'budget' | 'ai' | 'export';
  format?: string;  // 导出格式（仅 feature='export' 时使用）
  children: ReactNode;
  onClose?: () => void;
}

export default function PremiumGate({ feature, format, children, onClose }: PremiumGateProps) {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const membership = useMembership();

  // 桌面端直接放行
  if (!isMobile) return <>{children}</>;

  // 检查功能是否可用
  let allowed = true;
  if (feature === 'account') allowed = membership.canAddAccount;
  if (feature === 'category') allowed = membership.canAddCategory;
  if (feature === 'budget') allowed = membership.canAddBudget;
  if (feature === 'ai') allowed = membership.canUseAI;
  if (feature === 'export' && format) allowed = membership.canExport(format);

  if (allowed) return <>{children}</>;

  // 显示升级提示
  return (
    <Card
      style={{
        textAlign: 'center',
        borderRadius: 12,
        background: 'linear-gradient(135deg, #FFF9E6, #FFF3CC)',
        border: '1px solid #FFD93D',
      }}
    >
      {onClose && (
        <CloseOutlined
          onClick={onClose}
          style={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: '#999', cursor: 'pointer' }}
        />
      )}
      <CrownOutlined style={{ fontSize: 40, color: '#FFD700', marginBottom: 12 }} />
      <Title level={5} style={{ marginBottom: 4 }}>功能受限</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {membership.getLimitMessage(feature)}
      </Text>
      <Button
        type="primary"
        icon={<CrownOutlined />}
        onClick={() => navigate('/membership')}
        style={{
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          border: 'none',
          fontWeight: 600,
        }}
      >
        升级会员
      </Button>
    </Card>
  );
}
