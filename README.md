# Orbit — real-time chat

A full-stack one-to-one and group chat app built with MongoDB, Express, React, Node.js, and Socket.IO. Users can register or sign in with JWT authentication, find other accounts, create conversations, and exchange messages in real time.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB running locally or an accessible MongoDB connection string

## Run locally

1. Copy `.env.example` to `server/.env` and set `MONGO_URI` and a long, random `JWT_SECRET`. Orbit AI uses Ollama locally and does not require an API key or billing.
2. Install dependencies from the project root:

   ```sh
   npm install
   ```

3. Start the API and Vite development server:

   ```sh
   npm run dev
   ```

4. Visit [http://localhost:5173](http://localhost:5173), register an account, and open another browser session to create a second account and try a conversation.

Install [Ollama](https://ollama.com/download), then run `ollama run qwen2.5:1.5b` once to download the local model. Use **Ask Orbit AI** to chat privately with that model; prompts are processed on your computer and do not require a paid API.

The API listens on port `5000` by default. During development, Vite proxies API requests and Socket.IO connections to the API, so the client works if Vite selects a different frontend port. Set `VITE_API_URL` and `VITE_SOCKET_URL` in the client environment to override the default URLs.

If the API port is already in use, stop the other server before running `npm run dev` again, or set a different `PORT` in `server/.env` and update the client URLs to match.

## Production

Run `npm run build` to create the frontend bundle in `client/dist`. Configure `MONGO_URI`, `JWT_SECRET`, `PORT`, and `CLIENT_URL`, and install Ollama with the selected model on the deployment machine before running `npm start`.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/ai/chat` (JWT-protected OpenAI chat completion)
- `GET /api/users?search=...`
- `GET /api/chats`, `POST /api/chats`, `GET /api/chats/:id/messages`
- Authenticated Socket.IO event `message:send`; persisted messages are delivered as `message:new` to conversation participants.
