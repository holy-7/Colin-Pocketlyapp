/**
 * ChatMessage.tsx — 聊天消息气泡
 *
 * 支持：用户消息（右对齐蓝色）+ AI 消息（左对齐白色）+ 流式内容 + Markdown 简单渲染
 */

import { Typography } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { ChatMessage as ChatMessageType } from '@/services/aiService';

const { Paragraph } = Typography;

interface Props {
  message: ChatMessageType;
  streaming?: boolean; // 正在流式接收
}

/** 简单 Markdown 转 React（支持 **bold** 和表格） */
function renderContent(text: string): React.ReactNode {
  if (!text) return null;

  // 处理粗体
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // 处理换行
    if (part.includes('\n')) {
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </span>
      ));
    }
    return part;
  });
}

export default function ChatMessage({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (message.isToolIntermediate) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 10,
        marginBottom: 16,
        alignItems: 'flex-start',
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isUser ? '#4ECDC4' : '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? (
          <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
        ) : (
          <RobotOutlined style={{ color: '#666', fontSize: 14 }} />
        )}
      </div>

      {/* 气泡 */}
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 16px',
          borderRadius: 12,
          borderTopRightRadius: isUser ? 4 : 12,
          borderTopLeftRadius: isUser ? 12 : 4,
          background: isUser ? '#4ECDC4' : '#f5f5f5',
          color: isUser ? '#fff' : '#333',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <Paragraph
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {renderContent(message.content)}
          {streaming && <span className="cursor-blink">▍</span>}
        </Paragraph>
      </div>
    </div>
  );
}
