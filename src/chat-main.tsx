// src/chat-main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWorkspace } from './components/chat/ChatWorkspace';

function mountChat() {
  const container = document.getElementById('chat-root');
  if (!container) {
    console.error('[OpenChat] Chat root element not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ChatWorkspace />
    </React.StrictMode>
  );

  console.log('[OpenChat] React chat mounted successfully');
}

export { mountChat };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountChat);
} else {
  mountChat();
}
