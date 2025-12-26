

// import io from 'socket.io-client';

// const ENDPOINT = 'http://localhost:4000'; 
// export const socket = io(ENDPOINT);

import { io } from 'socket.io-client';

// Use your actual backend Render URL here (without a trailing slash)
const PRODUCTION_URL = 'https://electron-chat-application-3.onrender.com';
const LOCAL_URL = 'http://localhost:4000';

const ENDPOINT = process.env.NODE_ENV === 'production' 
  ? PRODUCTION_URL 
  : LOCAL_URL;

export const socket = io(ENDPOINT, {
  transports: ['websocket', 'polling'], // Allow fallback to polling if websocket fails
  secure: true,
   upgrade: false,                        // Ensure secure connection for production
});
