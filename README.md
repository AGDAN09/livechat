# Live Chat App

React (Vite) + TailwindCSS + komponen gaya ShadCN UI di frontend, Express + Socket.IO di backend.
Tanpa database: 100 pesan terakhir disimpan in-memory dan hilang saat server restart.

## Fitur
- Chat realtime via Socket.IO
- Indikator "sedang mengetik"
- Status "dibaca" per pengguna (Terkirim / Dibaca A, B)
- Daftar pengguna online, notifikasi masuk/keluar, auto-reconnect

## Menjalankan (lokal)
```bash
# terminal 1
cd server && cp .env.example .env && npm install && npm run dev
# terminal 2
cd client && cp .env.example .env && npm install && npm run dev
```
Buka http://localhost:5173 di dua tab dengan nama berbeda.

## Struktur
```
server/src/index.js          Express + Socket.IO (join, message:send, typing, message:read)
client/src/hooks/useChat.js  Seluruh logika socket
client/src/components/       JoinScreen, ChatRoom, MessageBubble, UserList, ui/*
```

## Deploy
- Backend (Railway / VPS): root `server`, start `npm start`. Set `CLIENT_ORIGIN` ke URL frontend (boleh dipisah koma).
- Frontend (Vercel): root `client`, build `npm run build`, output `dist`. Set `VITE_SOCKET_URL` ke URL backend.
- VPS: jalankan backend dengan PM2 di belakang Nginx (aktifkan header Upgrade untuk WebSocket).
- Untuk lebih dari satu instance server, tambahkan adapter Redis untuk Socket.IO.

## Komponen ShadCN asli
`components.json` sudah disiapkan, contoh: `npx shadcn@latest add dialog`.
