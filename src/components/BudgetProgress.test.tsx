import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetProgress from './BudgetProgress';

describe('BudgetProgress 组件', () => {
  it('边界：totalBudget 为 0 时返回 null（不渲染任何内容）', () => {
    const { container } = render(<BudgetProgress totalBudget={0} spent={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('边界：totalBudget 为负数时返回 null', () => {
    const { container } = render(<BudgetProgress totalBudget={-100} spent={50} />);
    expect(container.firstChild).toBeNull();
  });

  it('正常：显示预算金额和已花费金额', () => {
    render(<BudgetProgress totalBudget={1000} spent={500} />);
    expect(screen.getByText(/¥500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/¥1000\.00/)).toBeInTheDocument();
  });

  it('正常：显示百分比', () => {
    render(<BudgetProgress totalBudget={1000} spent={500} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('正常：预算未超支时不显示 Alert', () => {
    render(<BudgetProgress totalBudget={1000} spent={500} />);
    expect(screen.queryByText(/超预算/)).not.toBeInTheDocument();
  });

  it('正常：超支时显示 Alert 警告', () => {
    render(<BudgetProgress totalBudget={1000} spent={1200} />);
    expect(screen.getByText(/超预算/)).toBeInTheDocument();
  });

  it('正常：spent 为 0 时显示 0%', () => {
    render(<BudgetProgress totalBudget={1000} spent={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('正常：刚好用完预算（spent === totalBudget）', () => {
    render(<BudgetProgress totalBudget={1000} spent={1000} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    // 刚好等于不算超支
    expect(screen.queryByText(/超预算/)).not.toBeInTheDocument();
  });
});
