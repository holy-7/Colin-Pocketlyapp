import { useState, useEffect } from 'react';

// 断点定义：<768px mobile, 768-1024 tablet, >1024 desktop
const MOBILE_MAX = 767;
const TABLET_MAX = 1024;

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

function getResponsiveState(): ResponsiveState {
  const width = window.innerWidth;
  return {
    width,
    isMobile: width <= MOBILE_MAX,
    isTablet: width > MOBILE_MAX && width <= TABLET_MAX,
    isDesktop: width > TABLET_MAX,
  };
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(getResponsiveState);

  useEffect(() => {
    const handleResize = () => setState(getResponsiveState());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
