import React, { useEffect, useState } from 'react';
import { getToken } from '../utils/auth';
import ReactMarkdown from "react-markdown";

const AI_URL = import.meta.env.VITE_AI_API_URL ?? '';
const API_URL = import.meta.env.VITE_API_URL ?? '';


interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function AIChatPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // =========================
  // 1. LOAD MESSAGES ON OPEN
  // =========================
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/msg/messages`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        const data = await res.json();

        if (data.success) {
          setMessages(data.data);
        }
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    };

    fetchMessages();
  }, []);

  // =========================
  // 2. SEND MESSAGE
  // =========================
  const handleSend = async () => {
    if (!input.trim()) return;

    const currentInput = input;

    const userMessage: Message = {
      role: 'user',
      text: currentInput,
    };

    // optimistic UI
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // STEP 1: save user message
      await fetch(`${API_URL}/api/msg/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(userMessage),
      });

      // STEP 2: call AI
      const response = await fetch(`${AI_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          question: currentInput,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        text: data.answer,
      };

      // STEP 3: save assistant message
      await fetch(`${API_URL}/api/msg/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(assistantMessage),
      });

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.message || 'Something went wrong',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>🤖 AI Chat</h1>

      {/* Chat Box */}
      <div
        style={{
          background: 'var(--slate-200)',
          border: '2px solid #fff',
          padding: 16,
          height: '70vh',
          overflowY: 'auto',
          marginBottom: 16,
          borderRadius: 12,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              textAlign: msg.role === 'user' ? 'right' : 'left',
              margin: '10px 0',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 10,
                background: msg.role === 'user' ? '#00b4d8' : '#f1f1f1',
                color: msg.role === 'user' ? '#fff' : '#000',
                maxWidth: '70%',
                whiteSpace: 'pre-wrap',
              }}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </span>
          </div>
        ))}

        {loading && <p>Thinking...</p>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #ccc',
          }}
        />

        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            padding: '12px 18px',
            background: '#00b4d8',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}