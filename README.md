# TicTacToe - Strategic 3-Piece Variant

A web-based TicTacToe game with a unique twist: each player can only have 3 pieces on the board at a time. When a player places their 4th piece, their oldest piece is automatically removed. This eliminates draw possibilities and creates a fast-paced, strategic experience.

## Features

- **3-Piece Rule**: Each player can have maximum 3 pieces on the board
- **No Draws Possible**: The dynamic piece removal prevents stalemates
- **AI Opponent**: Multiple difficulty levels using MCTS and Minimax algorithms
- **Multiple Game Modes**:
  - VS Computer
  - Local Multiplayer (VS Friend)
  - Online Multiplayer (Socket.IO)
- **Turn Timer**: 10 seconds per turn with automatic random move on timeout
- **Customization**: Choose player colors and usernames
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Support**: Built-in theme switching

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Real-time Communication**: Socket.IO (for online multiplayer)
- **AI Algorithms**:
  - Monte Carlo Tree Search (MCTS)
  - Minimax with Alpha-Beta Pruning
  - Simple AI (Easy mode)

## Installation

### Prerequisites

- Node.js 18+ installed
- pnpm package manager (recommended)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd TicTacToe/tic-tac-toe
```

2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Play

### Basic Rules

1. Players take turns placing their symbol (X or O) on a 3x3 grid
2. **Unique Rule**: Each player can have maximum 3 pieces on the board
3. When placing a 4th piece, the oldest piece is automatically removed
4. First player to get 3 symbols in a row (horizontal, vertical, or diagonal) wins
5. If you run out of time (10 seconds), a random move is made for you

### Game Modes

#### VS Computer
- Play against an AI opponent
- Choose AI difficulty: Easy, Normal, Hard, or Insane
- You always play as X and go first

#### VS Friend (Local)
- Play with a friend on the same device
- Both players use the same screen
- X goes first

#### Online Multiplayer
- Play against other players over the internet
- Requires a Socket.IO server running (default: http://localhost:3009)
- Players are assigned X or O automatically
- Rematch functionality available

### AI Difficulty Levels

| Level | Description | Algorithm |
|-------|-------------|-----------|
| Easy | Makes random moves with basic awareness | Simple AI |
| Normal | Makes decent strategic decisions | MCTS (100 iterations) |
| Hard | Strong opponent with deep search | MCTS (5000 iterations) |
| Insane | Near-optimal play | MCTS (20000 iterations) |

### Turn Timer

Each player has 10 seconds to make a move. If time runs out:
- A random valid move is automatically made
- The turn passes to the opponent
- This prevents stalling and keeps the game fast-paced

## Project Structure

```
tic-tac-toe/
├── app/
│   ├── api/                    # API routes for Socket.IO server
│   ├── game/
│   │   ├── ai/                # AI implementation
│   │   │   ├── MonteCarloTS/  # MCTS algorithm
│   │   │   ├── MiniMaxAlgorithm/ # Minimax algorithm
│   │   │   └── simpleAI/      # Easy AI logic
│   │   ├── constants/         # Game constants
│   │   ├── logic/             # Core game logic
│   │   └── auth/              # Authentication utilities
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   ├── components/            # React components
│   │   ├── auth/              # Login form
│   │   ├── game/              # Game board, panels
│   │   ├── menu/              # User menu
│   │   ├── navbar/            # Sidebar navigation
│   │   └── ui/                # Reusable UI components
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main game page
├── public/                    # Static assets
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Key Components

### Game Logic (`app/game/logic/`)

- **makeMove.ts**: Handles piece placement and automatic removal of oldest piece
- **checkWinner.ts**: Determines if a player has won
- **getValidMoves.ts**: Returns all available moves
- **isValidMove.ts**: Validates move legality

### AI Implementation (`app/game/ai/`)

- **handleAI_Move.ts**: Main AI move handler with delay for UX
- **getAI_Move.ts**: Routes to appropriate AI algorithm based on difficulty
- **MonteCarloTS/**: MCTS implementation for medium+ difficulty
- **MiniMaxAlgorithm/**: Minimax with alpha-beta pruning
- **simpleAI/**: Basic heuristic-based AI for easy mode

### Components (`components/`)

- **GameBoard**: Main 3x3 grid with piece indicators
- **LoginForm**: User login with game mode selection
- **PlayersPanel**: Displays current players, turn info, and game status
- **AppSidebar**: Navigation and settings sidebar

## Game State

The game state includes:
- `board`: Array representing the 3x3 grid
- `currentPlayer`: Whose turn it is (X or O)
- `winner`: Winner if game is complete
- `players`: Player configurations (username, color, symbol)
- `moves`: Track of moves for each player (for oldest piece removal)
- `nextToRemove`: Which piece will be removed next for each player
- `turnTimeRemaining`: Time left for current turn
- `gameStatus`: WAITING, ACTIVE, or COMPLETED

## Online Multiplayer

For online multiplayer, a Socket.IO server is required:

1. The server runs on port 3009 by default
2. Configure `NEXT_PUBLIC_SOCKET_URL` in `.env` if different
3. Server endpoints:
   - `/api/socket` - Server status check
   - Socket.IO events: login, move, reset, requestRematch, acceptRematch, declineRematch

## Development

### Available Scripts

```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm test         # Run tests
```

### Adding New Features

1. Game logic modifications in `app/game/logic/`
2. AI changes in `app/game/ai/`
3. UI components in `components/`
4. Type definitions in `app/types/types.ts`

### Color Customization

Player colors are defined in `app/game/constants/constants.ts`:
- Blue, Green, Yellow, Orange, Red, Pink, Purple, Gray
- Tailwind CSS classes mapped in `COLOR_VARIANTS`

## Deployment

### Railway Deployment (Recommended)

Deploy to Railway - supports both Next.js frontend and Socket.IO backend in a single deployment!

#### Quick Deploy:

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project (follow prompts)
railway init

# 4. Set environment variables
railway variables set NEXT_PUBLIC_SOCKET_URL=https://your-app.railway.app
railway variables set NODE_ENV=production

# 5. Deploy
railway up
```

Or deploy via GitHub:
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project → Deploy from GitHub repo
4. Add environment variables in Railway Dashboard

#### Environment Variables (Railway Dashboard):

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-app-name.railway.app` |

Railway automatically sets `PORT` environment variable.

#### Custom Domain (Optional):

1. Go to Railway Dashboard → Settings → Domains
2. Add your custom domain
3. Railway auto-generates SSL certificate
4. Update `NEXT_PUBLIC_SOCKET_URL` with your custom domain

---

### Mobile App Deployment (Capacitor)

#### Prerequisites:
- For iOS: macOS with Xcode installed
- For Android: Android Studio installed

#### Build Steps:

```bash
# Install dependencies
pnpm install

# Build Next.js app
pnpm build

# Sync to native platforms
pnpm cap:sync

# Build for iOS (opens Xcode)
pnpm cap:ios

# Build for Android (opens Android Studio)
pnpm cap:android
```

#### Configure Production URL:

Update `capacitor.config.ts` with your production URL:

```typescript
const config: CapacitorConfig = {
  appId: 'com.tictactoe.app',
  appName: 'TicTacToe',
  webDir: 'out',
  server: {
    hostname: 'your-app.railway.app', // Your production URL
    androidScheme: 'https'
  }
};
```

#### App Store Distribution:

- **iOS**: Use Xcode to archive and upload to App Store Connect
- **Android**: Build AAB/APK in Android Studio and upload to Google Play Console

---

### Docker Deployment

```bash
# Build Docker image
docker build -t tictactoe .

# Run container
docker run -p 3000:3000 tictactoe
```

### Vercel (Frontend Only)

For web-only deployment without Socket.IO:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Note**: For online multiplayer on Vercel, you'll need a separate Socket.IO server (like Railway or Heroku).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Credits

Built with Next.js, React, TypeScript, and Socket.IO.
AI algorithms implemented using Monte Carlo Tree Search and Minimax approaches.
