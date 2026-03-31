// src/chat-main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWorkspace } from './components/chat/ChatWorkspace';

let chatRoot: ReturnType<typeof createRoot> | null = null;

function mountChat() {
  const container = document.getElementById('chat-root');
  if (!container) {
    console.error('[OpenChat] Chat root element not found');
    return;
  }

  // Prevent double-mount: reuse existing root
  if (chatRoot) {
    return;
  }

  chatRoot = createRoot(container);
  chatRoot.render(
    <React.StrictMode>
      <ChatWorkspace />
    </React.StrictMode>
  );

  console.log('[OpenChat] React chat mounted successfully');
}

export { mountChat };
