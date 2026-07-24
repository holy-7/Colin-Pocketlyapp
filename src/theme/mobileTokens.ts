// ============================================================
// 移动端品牌色令牌
// 对应原型设计：黄色主色调 #FFD93D
// ============================================================

export const MOBILE_PRIMARY = '#FFD93D';
export const MOBILE_PRIMARY_LIGHT = '#FFF8E1';
export const MOBILE_PRIMARY_DARK = '#FFC107';
export const MOBILE_BG = '#F5F5F5';
export const MOBILE_CARD_BG = '#FFFFFF';
export const MOBILE_TEXT_PRIMARY = '#333333';
export const MOBILE_TEXT_SECONDARY = '#666666';
export const MOBILE_TEXT_TERTIARY = '#999999';
export const MOBILE_INCOME_COLOR = '#D4A017';
export const MOBILE_EXPENSE_COLOR = '#333333';
export const MOBILE_DANGER_COLOR = '#E74C3C';
export const MOBILE_SUCCESS_COLOR = '#27AE60';
export const MOBILE_HEADER_RADIUS = 20;
export const MOBILE_TAB_BAR_HEIGHT = 70;
export const MOBILE_CARD_RADIUS = 12;
export const MOBILE_CONTENT_PADDING = 12;

/** 格式化金额显示 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

/** 计算预算百分比 */
export function getSpentPercentage(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((spent / budget) * 100), 100);
}

/** 环形图 SVG 参数 (参考原型 .circular-chart) */
export const RING_RADIUS = 15.9155; // r=16, circumference ≈ 100
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
