import { Progress, Alert } from 'antd';

interface BudgetProgressProps {
  totalBudget: number;
  spent: number;
}

export default function BudgetProgress({ totalBudget, spent }: BudgetProgressProps) {
  if (totalBudget <= 0) return null;

  const percent = Math.round((spent / totalBudget) * 100);
  const overBudget = spent > totalBudget;
  const exceeded20pct = percent >= 120;

  // 超出 120% 用红色，超出预算用黄色，正常用主题色
  const strokeColor = exceeded20pct ? '#E74C3C' : overBudget ? '#F39C12' : '#4ECDC4';

  return (
    <div style={{ marginBottom: 16 }}>
      {overBudget && (
        <Alert
          message={`本月已超预算 ¥${(spent - totalBudget).toFixed(2)}`}
          type={exceeded20pct ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 12 }}
          banner
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>本月预算</span>
        <span>
          <strong>¥{spent.toFixed(2)}</strong> / ¥{totalBudget.toFixed(2)}
        </span>
      </div>
      <Progress
        percent={Math.min(percent, 100)}
        strokeColor={strokeColor}
        status={overBudget ? 'exception' : 'active'}
        format={() => `${percent}%`}
      />
    </div>
  );
}
