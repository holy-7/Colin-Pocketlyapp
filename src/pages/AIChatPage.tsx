/**
 * AIChatPage.tsx — AI 对话页面（桌面 + 移动端双布局）
 *
 * Desktop：左侧消息区 2/3 + 右侧快捷功能区 1/3
 * Mobile：全屏聊天，隐藏 BottomTabBar
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Divider, Empty, Space, Statistic, Tag, Typography } from 'antd';
import {
  DeleteOutlined,
  ArrowLeftOutlined,
  BulbOutlined,
  BarChartOutlined,
  DollarOutlined,
  AlertOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { useMembership } from '@/hooks/useMembership';
import { useMembershipStore } from '@/stores/membershipStore';
import { useChatStore, QUICK_QUESTIONS } from '@/stores/chatStore';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import MobileCard from '@/components/MobileCard';
import PremiumGate from '@/components/membership/PremiumGate';

const { Text, Title } = Typography;

// ============================================================
// Desktop Layout
// ============================================================

function DesktopChatPage() {
  const { messages, loading, streaming, send, clearHistory } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* 左侧：聊天区 */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#4ECDC4' }} />
            <Title level={4} style={{ margin: 0 }}>AI 助手</Title>
          </Space>
          <Button
            icon={<DeleteOutlined />}
            onClick={clearHistory}
            disabled={messages.length === 0}
            size="small"
          >
            清空对话
          </Button>
        </div>

        {/* 消息列表 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#fafafa',
            borderRadius: 8,
            padding: 16,
          }}
        >
          {messages.length === 0 ? (
            <Empty
              description="开始和 AI 助手聊聊你的财务吧"
              style={{ marginTop: 80 }}
            >
              <Text type="secondary">试试下方快捷问题，或直接输入你想了解的内容</Text>
            </Empty>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))
          )}
          {loading && streaming && (
            <ChatMessage
              message={{ role: 'assistant', content: streaming }}
              streaming
            />
          )}
          <div ref={bottomRef} />
        </div>

        {/* 输入区 */}
        <div style={{ marginTop: 12 }}>
          <ChatInput onSend={send} loading={loading} />
        </div>
      </div>

      {/* 右侧：快捷功能区 */}
      <div style={{ flex: 1, maxWidth: 320 }}>
        <SidebarPanel messagesCount={messages.length} onClear={clearHistory} />
      </div>
    </div>
  );
}

// ============================================================
// AI 发送包装器（移动端检查限制）
// ============================================================

function AISendGate({ onSend, loading, isMobile, showGate }: { onSend: (content: string) => void; loading: boolean; isMobile: boolean; showGate?: boolean }) {
  const membership = useMembership();
  const membershipStore = useMembershipStore();

  const handleSend = (content: string) => {
    // 桌面端直接发送
    if (!isMobile) {
      onSend(content);
      return;
    }

    // 移动端检查：premium/lifetime 直接发送
    if (membership.canUseAI) {
      membershipStore.incrementAI();
      onSend(content);
      return;
    }

    // 检查当日剩余次数
    if (!membershipStore.canUseAI()) {
      // limit reached, gate will be shown
      return;
    }

    membershipStore.incrementAI();
    onSend(content);
  };

  // 移动端且达到限制时显示 PremiumGate
  if (isMobile && !membership.canUseAI && !membershipStore.canUseAI()) {
    return (
      <PremiumGate feature="ai">
        <span />
      </PremiumGate>
    );
  }

  return <ChatInput onSend={handleSend} loading={loading} isMobile={isMobile} />;
}

// ============================================================
// Mobile Layout
// ============================================================

function MobileChatPage() {
  const { messages, loading, streaming, send, clearHistory } = useChatStore();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
        />
        <RobotOutlined style={{ fontSize: 18, color: '#4ECDC4' }} />
        <Text strong>AI 助手</Text>
        <div style={{ flex: 1 }} />
        <Button
          size="small"
          icon={<DeleteOutlined />}
          onClick={clearHistory}
          disabled={messages.length === 0}
          type="text"
        />
      </div>

      {/* 消息区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, background: '#fafafa' }}>
        {messages.length === 0 ? (
          <MobileCard title="AI 财务助手">
            <Empty description="问问我你的财务状况吧" />
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                试试下方快捷问题：
              </Text>
            </div>
          </MobileCard>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))
        )}
        {loading && streaming && (
          <ChatMessage
            message={{ role: 'assistant', content: streaming }}
            streaming
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        <AISendGate onSend={send} loading={loading} isMobile />
      </div>
    </div>
  );
}

// ============================================================
// Sidebar Panel (Desktop only)
// ============================================================

function SidebarPanel({ messagesCount, onClear }: { messagesCount: number; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 状态卡片 */}
      <Card size="small" title="AI 助手状态">
        <Space direction="vertical" size={4}>
          <Space><BulbOutlined style={{ color: '#4ECDC4' }} /><Text>就绪</Text></Space>
          <Space><BarChartOutlined /><Text>{messagesCount} 条消息</Text></Space>
        </Space>
      </Card>

      {/* 使用提示 */}
      <Card size="small" title="你可以这样问">
        <Space direction="vertical" size={4}>
          <Tag color="blue"><DollarOutlined /> 这个月花了多少钱？</Tag>
          <Tag color="green"><BarChartOutlined /> 哪个类别花钱最多？</Tag>
          <Tag color="orange"><AlertOutlined /> 预算还剩多少？</Tag>
          <Tag color="purple"><BulbOutlined /> 过去3个月趋势如何？</Tag>
        </Space>
      </Card>

      {/* 数据说明 */}
      <Card size="small" title="隐私说明">
        <Text type="secondary" style={{ fontSize: 12 }}>
          AI 助手只能访问聚合统计数据（分类汇总、百分比、趋势）。
          单笔交易明细、账户余额等敏感信息不会发送给 AI。
        </Text>
      </Card>

      {/* 清空 */}
      <Button
        onClick={onClear}
        disabled={messagesCount === 0}
        icon={<DeleteOutlined />}
        block
      >
        清空对话记录
      </Button>
    </div>
  );
}

// ============================================================
// Export
// ============================================================

export default function AIChatPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileChatPage /> : <DesktopChatPage />;
}
