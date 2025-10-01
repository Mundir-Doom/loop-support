# Loop Support System

A full-stack support ticket system with React frontend and FastAPI backend, featuring Telegram integration for real-time notifications.

## Features

- 🎨 Modern React frontend with Tailwind CSS
- 🚀 FastAPI backend with SQLAlchemy ORM
- 📱 Telegram bot integration for support notifications
- 💬 Real-time chat interface
- 🎫 Ticket management system
- 🔄 Agent assignment and claiming
- 📊 Support analytics

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL/SQLite
- **Database**: PostgreSQL (Railway) / SQLite (local)
- **Notifications**: Telegram Bot API
- **Deployment**: Railway

## Quick Start

### Local Development

1. **Backend Setup**:
   ```bash
   cd Support_Page_Design/backend
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e .
   uvicorn app.main:app --reload
   ```

2. **Frontend Setup**:
   ```bash
   cd Support_Page_Design
   npm install
   npm run dev
   ```

3. **Environment Variables**:
   Create `.env` file in `Support_Page_Design/backend/`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   SUPPORT_GROUP_CHAT_ID=your_group_id
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

### Railway Deployment

1. **Connect Repository**: Deploy from this GitHub repository to Railway
2. **Environment Variables**: Set in Railway dashboard:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPPORT_GROUP_CHAT_ID`
   - `DATABASE_URL` (auto-provided by Railway)
3. **Frontend URL**: Railway will provide the deployment URL

## API Endpoints

- `POST /api/session` - Create visitor session
- `GET /api/session/{session_id}` - Get conversation
- `POST /api/session/{session_id}/messages` - Send message
- `POST /api/telegram/webhook` - Telegram webhook
- `GET /api/health` - Health check

## Telegram Setup

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Add bot to your support group
3. Get group chat ID
4. Set webhook: `POST /api/setup/telegram-webhook`

## Development

### Project Structure
```
├── Support_Page_Design/
│   ├── src/                    # React frontend
│   ├── backend/               # FastAPI backend
│   └── build/                 # Built frontend
├── railway.json              # Railway configuration
├── nixpacks.toml            # Build configuration
└── Procfile                 # Process configuration
```

### Database Models
- `SupportSession` - Visitor sessions
- `SupportTicket` - Support tickets
- `SupportMessage` - Chat messages
- `SupportAgent` - Support agents

## License

MIT License
