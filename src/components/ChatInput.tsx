/**
 * ChatInput.tsx — 聊天输入区
 *
 * 包含：文本输入框 + 发送按钮 + 快捷问题建议
 */

import { useState, type KeyboardEvent } from 'react';
import { Input, Button, Tag, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { QUICK_QUESTIONS } from '@/stores/chatStore';

interface Props {
  onSend: (content: string) => void;
  loading: boolean;
  /** 移动端：快捷问题横滚 */
  isMobile?: boolean;
  /** 快捷问题列表（默认6个，移动端传2个） */
  quickQuestions?: string[];
}

export default function ChatInput({ onSend, loading, isMobile, quickQuestions }: Props) {
  const [input, setInput] = useState('');
  const questions = quickQuestions ?? QUICK_QUESTIONS;

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (q: string) => {
    onSend(q);
  };

  return (
    <div style={{ padding: '0 0 8px 0' }}>
      {/* 快捷问题 */}
      <div
        style={{
          marginBottom: 8,
          overflow: isMobile ? 'auto' : 'visible',
          whiteSpace: isMobile ? 'nowrap' : 'normal',
          paddingBottom: 4,
        }}
      >
        <Space size={6} wrap={!isMobile}>
          {questions.map((q) => (
            <Tag
              key={q}
              color="blue"
              style={{
                cursor: 'pointer',
                marginBottom: 4,
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 12,
              }}
              onClick={() => handleQuickQuestion(q)}
            >
              {q}
            </Tag>
          ))}
        </Space>
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'输入问题，如"这个月花了多少钱？"...'}
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
          style={{ borderRadius: 8, resize: 'none' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!input.trim()}
          style={{
            borderRadius: 8,
            background: '#4ECDC4',
            borderColor: '#4ECDC4',
            height: 'auto',
          }}
        />
      </div>
    </div>
  );
}
