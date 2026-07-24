import type { ReactNode } from 'react';
import { MOBILE_PRIMARY, MOBILE_HEADER_RADIUS } from '@/theme/mobileTokens';

interface MobileHeaderProps {
  children?: ReactNode;
  style?: React.CSSProperties;
}

/**
 * 可复用的移动端黄色圆角头部组件
 * 对应原型 .home-header / .charts-header / .record-header / .discover-header / .profile-header
 */
export default function MobileHeader({ children, style }: MobileHeaderProps) {
  return (
    <div
      style={{
        background: MOBILE_PRIMARY,
        borderRadius: `0 0 ${MOBILE_HEADER_RADIUS}px ${MOBILE_HEADER_RADIUS}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
