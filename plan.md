# Friend-Group Focused Game Improvement Plan

## Goal

Transform "Up and Down the River" into a rock-solid, bug-free card game for friend groups with account tracking, game history, and reliable gameplay. **Priority:** perfect functionality over fancy features.

---

## Phase 1: Critical Infrastructure (Week 1-2)

### 1.1 Add Database Persistence ⚠️ CRITICAL

**Problem:** All games lost on server restart (Cloud Run scales to zero)  
**Solution:** Add PostgreSQL database

**Backend files to create:**

```
backend/internal/database/
├── postgres.go # DB connection
├── migrations/
│   ├── 001_games.sql
│   ├── 002_users.sql
│   └── 003_game_history.sql
└── repository.go # Database operations
```

**Backend files to modify:**

- backend/internal/game/game.go - Add DB save/load methods
- backend/internal/handlers/handlers.go - Load from DB instead of memory
- backend/cmd/server/main.go - Add DB connection

**What changes:**

- Games persist across restarts
- Can pause and resume games
- Game history automatically saved

### 1.2 Fix MoneyPerMiss Feature ⚠️ CRITICAL BUG

**Problem:** Frontend sends money value but backend ignores it

**Backend changes:**

```go
// internal/game/game.go - Add to Game struct
type Game struct {
    // ... existing fields ...
    MoneyPerMiss float64 `json:"moneyPerMiss"`
}
```

**Files to modify:**

- backend/internal/handlers/handlers.go - Lines 29-57 (CreateGameHandler)
- backend/internal/game/game.go - Add MoneyPerMiss field
- Store in database when created

### 1.3 Add WebSockets for Real-Time Updates ⚠️ HIGH PRIORITY

**Problem:** Polling every 2 seconds = slow, inefficient, battery drain

**Backend files to create:**

```
backend/internal/websocket/
├── hub.go # Manage connections
├── client.go # Individual connections
└── events.go # Game event broadcasting
```

**Frontend changes:**

- Create `frontend/src/services/websocket.js`
- Remove polling interval (App.js line 506-510)
- Update state on WebSocket messages

**Benefits:**

- Instant updates when cards played
- Better mobile battery life
- Players see each other's actions immediately

---

## Phase 2: Bug Fixes & Validation (Week 2-3)

### 2.1 Fix Game Validation Bugs

**Bug A: Validate Max Cards vs Player Count**

**Problem:** 6 players × 10 cards = 60 cards (deck only has 54)  
**Fix in backend/internal/handlers/handlers.go:**

```go
func validatePlayerCount(maxCards int, playerCount int) error {
    cardsNeeded := maxCards * playerCount
    deckSize := 52 + 2 // 52 cards + 2 jokers
    if cardsNeeded > deckSize {
        return fmt.Errorf("too many players for %d max cards", maxCards)
    }
    return nil
}
```

**Bug B: Fix 1-Card Round Dealer Constraint**

- Fix in backend/internal/handlers/handlers.go Line 222-233:
- Remove `&& round.TotalCards > 1` condition
- Dealer constraint should apply to ALL rounds

**Bug C: Race Condition in Trick Completion**

- Fix in backend/internal/handlers/handlers.go Lines 397-496:
  - Proper mutex locking around goroutine state updates
  - Broadcast via WebSocket instead of sleep delay

### 2.2 Add Input Validation & Security

**Create `backend/internal/validation/validation.go`:**

- Sanitize display names (max 50 chars, no HTML)
- Validate max cards (1-13)
- Validate money per miss (0-1000)
- Rate limiting on game creation

**Add to handlers:**

```go
if err := validation.ValidateDisplayName(displayName); err != nil {
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
}
```

---

## Phase 3: User Accounts & Auth (Week 3-4)

### 3.1 Simple Email/Password Authentication

**Backend files to create:**

```
backend/internal/auth/
├── auth.go # Login/register logic
├── jwt.go # JWT tokens
├── password.go # bcrypt hashing
└── middleware.go # Auth middleware
```

**Database tables:**

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link games to users
ALTER TABLE games ADD COLUMN created_by UUID REFERENCES users(id);
```

**Frontend changes:**

```
frontend/src/components/auth/
├── Login.jsx
├── Register.jsx
└── AuthContext.jsx
```

**Features:**

- Users can register with email/password
- Login to get JWT token
- Token stored in localStorage
- Optional: "Play as Guest" for quick games

### 3.2 Track Stats Per User

**Database table:**

```sql
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    perfect_bids INTEGER DEFAULT 0, -- Bid exactly = tricks won
    updated_at TIMESTAMP DEFAULT NOW()
);
```

- Update stats when game ends (backend/internal/game/game.go)

---

## Phase 4: Game History & Friend Features (Week 4-5)

### 4.1 Game History

**Database tables:**

```sql
CREATE TABLE game_history (
    id UUID PRIMARY KEY,
    game_id VARCHAR(50),
    created_by UUID REFERENCES users(id),
    max_cards INTEGER,
    money_per_miss DECIMAL(10,2),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    winner_id UUID REFERENCES users(id)
);

CREATE TABLE game_participants (
    game_history_id UUID REFERENCES game_history(id),
    user_id UUID REFERENCES users(id),
    display_name VARCHAR(100),
    final_score INTEGER,
    final_position INTEGER,
    money_lost DECIMAL(10,2),
    PRIMARY KEY (game_history_id, user_id)
);
```

**Frontend component:**

```
frontend/src/components/history/
├── GameHistory.jsx # List of past games
└── GameDetails.jsx # Detailed game view
```

### 4.2 Friends System (Simple)

**Database table:**

```sql
CREATE TABLE friendships (
    user_id UUID REFERENCES users(id),
    friend_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id)
);
```

**Features:**

- Search users by username
- Send friend request (auto-accepted for simplicity)
- See friends list
- Invite friends to games
- Filter game history to show only games with friends

**Frontend:**

```
frontend/src/components/friends/
├── FriendsList.jsx
├── AddFriend.jsx
└── InviteToGame.jsx
```

---

## Phase 5: UX Improvements (Week 5-6)

### 5.1 Better Game UI

**Changes to `frontend/src/App.js`:**

- Add Round Progress Indicator:

```jsx
<div className="round-info">
	Round {currentRoundNumber} of {totalRounds} • Trump: ♠ Spades
</div>
```

- Show Card Count in Hand:

```jsx
<div className="hand-info">{sortedHand.length} cards remaining</div>
```

- Better Trick Winner Display:

  - Keep last trick winner visible
  - Show trick history (last 3 tricks)

- Error Toast Notifications:

  - frontend/src/components/Toast.jsx
  - Display backend errors
  - Show "Connection lost" warnings
  - Confirm actions ("Bid placed!")

- Loading States:
  - Show spinner when waiting for game to load
  - "Waiting for players" with animated dots
  - Card play animation

### 5.2 Game Management Features

**Add to backend/internal/handlers/handlers.go:**

- Pause/Resume Game:

  - `POST /games/pause`
  - `POST /games/resume`
  - Only host can pause
  - Game frozen, players can't act
  - Resume when ready

- Kick Player (Host only):

  - `POST /games/kick-player`
  - Remove disruptive player
  - Redistribute their cards or mark as "left"

- Password Protection:

```go
type Game struct {
    Password string `json:"-"` // Not sent to clients
}
```

    - Optional password when creating game
    - Required when joining

### 5.3 Mobile Optimizations

**Changes to frontend/src/App.css:**

- Better responsive breakpoints
- Larger touch targets (cards, buttons)
- Simplified UI for small screens
- No scoreboard sidebar on mobile (always modal)
- Add vibration feedback (mobile):

```js
if (navigator.vibrate) {
	navigator.vibrate(50); // When card played
}
```

---

## Phase 6: Polish & Testing (Week 6-7)

### 6.1 Error Handling & Resilience

**Auto-Reconnection:**

```js
// WebSocket reconnection with exponential backoff
websocket.onclose = () => {
	setTimeout(() => reconnect(), delay);
	delay = Math.min(delay * 2, 30000);
};
```

**Offline Detection:**

```jsx
{
	!isOnline && (
		<div className="offline-banner">No connection. Reconnecting...</div>
	);
}
```

**Game State Recovery:**

- If player refreshes, automatically rejoin game
- Recover from corrupted localStorage

### 6.2 Tutorial & Help

**Create frontend/src/components/Tutorial.jsx:**

- Game rules explanation
- How to bid
- How trump works (Spades + Jokers)
- Scoring explanation
- "Got it" button to dismiss

**Add /help route with:**

- FAQ
- Common issues
- Rules reference

### 6.3 Testing

**Unit Tests:**

- backend/internal/game/game_test.go
- backend/internal/handlers/handlers_test.go
  - Test bidding logic
  - Test card play validation
  - Test scoring calculations

**Frontend Tests:**

```
frontend/src/__tests__/
  ├── GameBoard.test.jsx
  ├── BidModal.test.jsx
  └── integration/fullGame.test.jsx
```

---

## Phase 7: Deployment & Monitoring (Week 7)

### 7.1 Environment Configuration

**Create `.env.example`:**

```
DATABASE_URL=postgresql://user:pass@localhost:5432/upanddown
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
PORT=8080
```

**Frontend env:**

```
REACT_APP_API_URL=https://api.yourgame.com
REACT_APP_WS_URL=wss://api.yourgame.com/ws
```

- Remove hardcoded URLs from App.js line 7

### 7.2 Database Setup

- Use PostgreSQL (Heroku, Railway, or Supabase):
  - Free tier: Supabase (500MB) or Railway (512MB)
  - Paid: Heroku Postgres ($9/mo for 10M rows)
- Run migrations on deploy:
  ```
  cd backend && go run cmd/migrate/main.go
  ```

### 7.3 Monitoring & Logging

- Add structured logging:

```go
import "go.uber.org/zap"

logger.Info("game created",
    zap.String("gameId", gameId),
    zap.Int("players", len(players)),
)
```

- Error tracking: Add Sentry (free tier):

```js
Sentry.init({
	dsn: 'your-dsn',
	environment: 'production',
});
```

- Health check endpoint:
  - `GET /health`
  - Returns: `{"status": "ok", "db": "connected"}`

---

## File Structure Overview

### New Backend Files

```
backend/
└── internal/
    ├── auth/
    │   ├── auth.go
    │   ├── jwt.go
    │   ├── password.go
    │   └── middleware.go
    ├── database/
    │   ├── postgres.go
    │   ├── repository.go
    │   └── migrations/
    │       ├── 001_games.sql
    │       ├── 002_users.sql
    │       ├── 003_game_history.sql
    │       └── 004_friends.sql
    ├── websocket/
    │   ├── hub.go
    │   ├── client.go
    │   └── events.go
    └── validation/
        └── validation.go
└── cmd/
    └── migrate/
        └── main.go
```

### New Frontend Files

```
frontend/
└── src/
    ├── components/
    │   ├── auth/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── AuthContext.jsx
    │   ├── history/
    │   │   ├── GameHistory.jsx
    │   │   └── GameDetails.jsx
    │   ├── friends/
    │   │   ├── FriendsList.jsx
    │   │   ├── AddFriend.jsx
    │   │   └── InviteToGame.jsx
    │   ├── Toast.jsx
    │   └── Tutorial.jsx
    ├── services/
    │   ├── websocket.js
    │   └── api.js
    └── hooks/
        ├── useAuth.js
        └── useWebSocket.js
└── .env.example
```

### Modified Files

- backend/cmd/server/main.go - Add DB, WebSocket, auth routes
- backend/internal/game/game.go - Add MoneyPerMiss, DB methods
- backend/internal/handlers/handlers.go - Fix bugs, add validation
- frontend/src/App.js - Remove polling, add WebSocket, improve UI
- frontend/src/App.css - Mobile improvements

---

## Implementation Priority

**MUST HAVE (Weeks 1-3)**

- ✅ Database persistence
- ✅ Fix MoneyPerMiss bug
- ✅ WebSockets
- ✅ Input validation
- ✅ Bug fixes (max cards, dealer constraint, race conditions)
- ✅ User accounts (basic)

**SHOULD HAVE (Weeks 4-5)**

- ✅ Game history
- ✅ Friends system
- ✅ Better UI (round progress, error messages)
- ✅ Game management (pause, kick, password)

**NICE TO HAVE (Weeks 6-7)**

- ✅ Auto-reconnection
- ✅ Tutorial/help
- ✅ Mobile optimizations
- ✅ Testing
- ✅ Monitoring

---

## Success Criteria

- ✅ Friend group can play reliably:
  - No games lost to server restarts
  - All features work correctly (bidding, card play, scoring)
  - Money tracking works if enabled
- ✅ Users have accounts:
  - Login/register works
  - Stats tracked across games
  - Game history saved
- ✅ Friends can find each other:
  - Add friends by username
  - See friends list
  - Invite friends to games
  - Filter history by friends
- ✅ Mobile works well:
  - No battery drain from polling
  - Cards easy to tap
  - UI doesn't break on small screens
- ✅ No critical bugs:
  - All game rules enforced correctly
  - No crashes or data loss
  - Errors shown to users clearly

---

## Cost Estimate (Monthly)

**Minimal Setup (good for friend groups):**

- Supabase (PostgreSQL): Free (500MB)
- Cloud Run (backend): $0-5 (minimal traffic)
- Firebase Hosting (frontend): Free
- **Total:** ~$5/month

**Production Setup:**

- Railway PostgreSQL: $5-10
- Cloud Run: $10-20
- CDN: Free (CloudFlare)
- Monitoring (Sentry): Free tier
- **Total:** ~$15-30/month

---

## Timeline: 7 Weeks Total

- **Weeks 1-2:** Database + WebSockets + Critical bugs
- **Weeks 3-4:** User accounts + Game history
- **Weeks 4-5:** Friends system + UX improvements
- **Weeks 6-7:** Polish + Testing + Deployment

**Team size:** 1-2 developers working part-time can complete in 7 weeks

---

This plan prioritizes reliability and friend-group features over worldwide scaling. Everything is focused on making the game work perfectly for 2-8 friends playing together regularly.
