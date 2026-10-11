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

The API listens on port `5000` by default. During development, Vite proxies API requests and Socket.IO connections to the API, so the client works if Vite selects a different frontend port. In production, set the client's `VITE_API_URL` to the public API base URL (including `/api`, for example `https://your-api-host.example/api`). The client derives the Socket.IO host from this URL; set `VITE_SOCKET_URL` only when Socket.IO is hosted on a different origin. Production builds no longer fall back to localhost.

If the API port is already in use, stop the other server before running `npm run dev` again, or set a different `PORT` in `server/.env` and update the client URLs to match.

## Production

Deploy the client and API as separate services; a browser cannot reach an API at `localhost` on your development machine. This repository includes a Render blueprint (`render.yaml`) for the Express/Socket.IO API. Create a Render Blueprint from the repository, provide a hosted MongoDB connection string for `MONGO_URI`, and deploy the `orbit-chat-api` service. The blueprint generates `JWT_SECRET` and allows the current Vercel origin.

After the API deploys, copy its public HTTPS base URL (for example `https://orbit-chat-api.onrender.com`) into the Vercel project's `VITE_API_URL` environment variable with `/api` appended. Set the Vercel project root to `client`, use `npm run build` as the build command and `dist` as the output directory, then redeploy. The client derives the Socket.IO host from this API URL. Redeploy the client whenever its `VITE_API_URL` changes because Vite embeds it in the build.

For a different frontend hostname, set the API's `CLIENT_URL` to the exact frontend origin without a path; separate multiple allowed origins with commas. The API host must be publicly reachable over HTTPS. Orbit AI additionally needs Ollama and the selected model available to that host; a local Ollama installation on your computer is not reachable by a separately hosted API, so AI replies remain unavailable on this API deployment unless Ollama is hosted and reachable.

Run `npm run build` from the project root to create the frontend bundle in `client/dist`.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/ai/chat` (JWT-protected local Ollama chat)
- `GET /api/users?search=...`
- `GET /api/chats`, `POST /api/chats`, `GET /api/chats/:id/messages`
- Authenticated Socket.IO event `message:send`; persisted messages are delivered as `message:new` to conversation participants.
