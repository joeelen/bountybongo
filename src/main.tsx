import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auto-bootstrap persistent guest player ID if not logged in so users can play immediately
if (!localStorage.getItem('dev_user_id')) {
  let guestId = localStorage.getItem('device_player_id');
  if (!guestId) {
    guestId = 'player_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('device_player_id', guestId);
  }
  localStorage.setItem('dev_user_id', guestId);
}

const { fetch: originalFetch } = window;
window.fetch = async (input, init) => {
  try {
    const devUserId = localStorage.getItem('dev_user_id');
    if (devUserId) {
      if (input instanceof Request) {
        try {
          input.headers.set('x-dev-user-id', devUserId);
          return originalFetch(input, init);
        } catch (err) {
          // If Request headers are read-only (immutable), clone the Request object with the header
          const headersInit: Record<string, string> = {};
          input.headers.forEach((value, key) => {
            headersInit[key] = value;
          });
          headersInit['x-dev-user-id'] = devUserId;
          const newRequest = new Request(input, { headers: headersInit });
          return originalFetch(newRequest, init);
        }
      } else {
        const newInit = init ? { ...init } : {};
        const headers = new Headers(newInit.headers);
        if (!headers.has('x-dev-user-id')) {
          headers.set('x-dev-user-id', devUserId);
        }
        newInit.headers = headers;
        return originalFetch(input, newInit);
      }
    }
  } catch (error) {
    console.error('Fetch interceptor error:', error);
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

