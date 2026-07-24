import type { ReactNode } from 'react';
import { MOBILE_CARD_BG, MOBILE_CARD_RADIUS, MOBILE_TEXT_PRIMARY } from '@/theme/mobileTokens';

interface MobileCardProps {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * 可复用的移动端白色圆角卡片容器
 * 对应原型 .discover-card / .rank-section / .bill-item
 */
export default function MobileCard({ title, extra, children, style, onClick }: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: MOBILE_CARD_BG,
        borderRadius: MOBILE_CARD_RADIUS,
        padding: 14,
        marginBottom: 12,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: MOBILE_TEXT_PRIMARY,
            marginBottom: 12,
          }}
        >
          <span>{title}</span>
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}
