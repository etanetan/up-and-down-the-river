package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/etanetan/up-and-down-the-river/backend/internal/game"
	"github.com/google/uuid"
)

const letterBytes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

func generateGameID() string {
	rand.Seed(time.Now().UnixNano())
	letters := make([]byte, 3)
	for i := range letters {
		letters[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	numbers := rand.Intn(1000) // 0-999
	return string(letters) + fmt.Sprintf("%03d", numbers)
}

// CreateGameHandler creates a new game and adds the creator.
func CreateGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName     string `json:"displayName"`
		CreatorMaxCards int    `json:"creatorMaxCards"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.DisplayName == "" {
		http.Error(w, "displayName is required", http.StatusBadRequest)
		return
	}
	//gameID := uuid.New().String()
	gameID := generateGameID()

	creator := &game.Player{
		ID:          uuid.New().String(),
		DisplayName: req.DisplayName,
	}
	game.GamesMu.Lock()
	defer game.GamesMu.Unlock()
	newGame := &game.Game{
		ID:              gameID,
		Players:         []*game.Player{creator},
		State:           "lobby",
		CreatorMaxCards: req.CreatorMaxCards,
	}
	game.Games[gameID] = newGame
	resp := map[string]string{
		"gameId":   gameID,
		"playerId": creator.ID,
		"link":     fmt.Sprintf("http://%s/games/%s", r.Host, gameID),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// JoinGameHandler allows a new player to join an existing game.
func JoinGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID      string `json:"gameId"`
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.GameID == "" || req.DisplayName == "" {
		http.Error(w, "gameId and displayName are required", http.StatusBadRequest)
		return
	}
	game.GamesMu.Lock()
	g, ok := game.Games[req.GameID]
	game.GamesMu.Unlock()
	if !ok {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	if g.State != "lobby" {
		http.Error(w, "game already started", http.StatusBadRequest)
		return
	}
	if len(g.Players) >= 6 {
		http.Error(w, "game is full", http.StatusBadRequest)
		return
	}
	newPlayer := &game.Player{
		ID:          uuid.New().String(),
		DisplayName: req.DisplayName,
	}
	game.GamesMu.Lock()
	g.Players = append(g.Players, newPlayer)
	game.GamesMu.Unlock()
	resp := map[string]string{
		"gameId":   req.GameID,
		"playerId": newPlayer.ID,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// StartGameHandler initializes the game, deals cards, and begins the bidding phase.
func StartGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID string `json:"gameId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	game.GamesMu.Lock()
	g, ok := game.Games[req.GameID]
	game.GamesMu.Unlock()
	if !ok {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	if g.State != "lobby" {
		http.Error(w, "game already started", http.StatusBadRequest)
		return
	}
	if len(g.Players) < 2 {
		http.Error(w, "need at least 2 players to start", http.StatusBadRequest)
		return
	}
	// Determine maximum cards per round.
	maxPossible := int(math.Floor(54.0 / float64(len(g.Players))))
	desired := g.CreatorMaxCards
	if desired <= 0 || desired > maxPossible {
		desired = maxPossible
	}
	g.RoundSequence = game.ComputeRoundSequence(desired)
	g.CurrentRoundIndex = 0
	// Randomly choose a dealer.
	dealerIndex := rand.Intn(len(g.Players))
	round := &game.Round{
		RoundNumber:    g.CurrentRoundIndex + 1,
		TotalCards:     g.RoundSequence[g.CurrentRoundIndex],
		DealerIndex:    dealerIndex,
		Bids:           make(map[string]int),
		BidOrder:       []string{},
		CurrentBidTurn: 0,
	}
	g.CurrentRound = round
	g.State = "bidding"
	// Deal cards.
	deck := game.CreateDeck()
	game.ShuffleDeck(deck)
	for _, p := range g.Players {
		p.Hand = []game.Card{}
		p.CurrentBid = 0
		p.TricksWon = 0
	}
	if err := game.DealCards(deck, g.Players, round.TotalCards); err != nil {
		http.Error(w, "error dealing cards: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// Set bidding order: start with the player to the left of the dealer, then dealer last.
	n := len(g.Players)
	var biddingOrder []string
	for i := 1; i < n; i++ {
		index := (dealerIndex + i) % n
		biddingOrder = append(biddingOrder, g.Players[index].ID)
	}
	biddingOrder = append(biddingOrder, g.Players[dealerIndex].ID)
	round.BidOrder = biddingOrder
	round.CurrentBidTurn = 0
	resp := map[string]interface{}{
		"message":       "Game started; bidding phase begins",
		"gameId":        g.ID,
		"currentRound":  round,
		"biddingOrder":  biddingOrder,
		"players":       g.Players,
		"roundSequence": g.RoundSequence,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// BidHandler accepts a bid from a player.
func BidHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID   string `json:"gameId"`
		PlayerID string `json:"playerId"`
		Bid      int    `json:"bid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	game.GamesMu.Lock()
	g, ok := game.Games[req.GameID]
	game.GamesMu.Unlock()
	if !ok {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	if g.State != "bidding" {
		http.Error(w, "not in bidding phase", http.StatusBadRequest)
		return
	}
	round := g.CurrentRound
	// Ensure it is the player's turn.
	currentBidderID := round.BidOrder[round.CurrentBidTurn]
	if currentBidderID != req.PlayerID {
		http.Error(w, "not your turn to bid", http.StatusBadRequest)
		return
	}
	if req.Bid < 0 || req.Bid > round.TotalCards {
		http.Error(w, "invalid bid amount", http.StatusBadRequest)
		return
	}
	// If the bidder is the dealer (last bidder) and the round has more than one card, enforce the restriction.
	isDealer := (round.BidOrder[round.CurrentBidTurn] == g.Players[round.DealerIndex].ID)
	if isDealer && round.TotalCards > 1 {
		sumBids := 0
		for _, b := range round.Bids {
			sumBids += b
		}
		if sumBids+req.Bid == round.TotalCards {
			http.Error(w, "dealer bid cannot make total bids equal total cards", http.StatusBadRequest)
			return
		}
	}
	round.Bids[req.PlayerID] = req.Bid
	for _, p := range g.Players {
		if p.ID == req.PlayerID {
			p.CurrentBid = req.Bid
			p.BidOrder = round.CurrentBidTurn
			break
		}
	}
	round.CurrentBidTurn++
	if round.CurrentBidTurn >= len(round.BidOrder) {
		g.State = "playing"
		highestBid := -1
		leaderID := ""
		leaderOrder := len(g.Players) + 1
		for pid, bid := range round.Bids {
			var order int
			for _, p := range g.Players {
				if p.ID == pid {
					order = p.BidOrder
					break
				}
			}
			if bid > highestBid || (bid == highestBid && order < leaderOrder) {
				highestBid = bid
				leaderID = pid
				leaderOrder = order
			}
		}
		leaderIndex := 0
		for i, p := range g.Players {
			if p.ID == leaderID {
				leaderIndex = i
				break
			}
		}
		round.CurrentTrick = &game.Trick{
			LeaderID: leaderID,
			Plays:    []game.Play{},
		}
		round.TrickTurnIndex = 0
		round.TrickLeader = leaderIndex
	}
	resp := map[string]interface{}{
		"message": "Bid accepted",
		"bids":    round.Bids,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// PlayHandler processes a card played by a player.
func PlayHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID   string    `json:"gameId"`
		PlayerID string    `json:"playerId"`
		Card     game.Card `json:"card"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	game.GamesMu.Lock()
	g, ok := game.Games[req.GameID]
	game.GamesMu.Unlock()
	if !ok {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}

	if g.State != "playing" {
		http.Error(w, "not in playing phase", http.StatusBadRequest)
		return
	}

	round := g.CurrentRound
	expectedPlayerID := g.Players[(round.TrickLeader+round.TrickTurnIndex)%len(g.Players)].ID
	if req.PlayerID != expectedPlayerID {
		http.Error(w, "not your turn to play", http.StatusBadRequest)
		return
	}

	player, _ := game.FindPlayer(g, req.PlayerID)
	cardIndex := -1
	for i, card := range player.Hand {
		if game.CardEquals(card, req.Card) {
			cardIndex = i
			break
		}
	}

	if cardIndex == -1 {
		http.Error(w, "player does not have that card", http.StatusBadRequest)
		return
	}

	playedCard := player.Hand[cardIndex]
	player.Hand = append(player.Hand[:cardIndex], player.Hand[cardIndex+1:]...)

	// Enforce follow-suit.
	if len(round.CurrentTrick.Plays) > 0 {
		leadCard := round.CurrentTrick.Plays[0].Card
		leadSuit := strings.ToLower(leadCard.Suit)
		hasLeadSuit := false
		for _, c := range player.Hand {
			if !c.IsJoker && strings.ToLower(c.Suit) == leadSuit {
				hasLeadSuit = true
				break
			}
		}
		if hasLeadSuit {
			if req.Card.IsJoker || strings.ToLower(req.Card.Suit) != leadSuit {
				http.Error(w, "you must follow suit", http.StatusBadRequest)
				return
			}
		}
	}

	play := game.Play{
		PlayerID: req.PlayerID,
		Card:     playedCard,
	}
	round.CurrentTrick.Plays = append(round.CurrentTrick.Plays, play)
	round.TrickTurnIndex++

	// Check if the trick is complete
	if len(round.CurrentTrick.Plays) == len(g.Players) {
		leadSuit := strings.ToLower(round.CurrentTrick.Plays[0].Card.Suit)
		winningPlay := round.CurrentTrick.Plays[0]
		for _, p := range round.CurrentTrick.Plays[1:] {
			if game.CompareCards(p.Card, winningPlay.Card, leadSuit) > 0 {
				winningPlay = p
			}
		}
		round.CurrentTrick.WinnerID = winningPlay.PlayerID

		if winner, _ := game.FindPlayer(g, winningPlay.PlayerID); winner != nil {
			winner.TricksWon++
		}

		round.Tricks = append(round.Tricks, *round.CurrentTrick)

		// 🔥 Add a "Trick is over" message
		resp := map[string]interface{}{
			"message":          "Card played",
			"currentTrick":     round.CurrentTrick,
			"tricks":           round.Tricks,
			"winningCard":      winningPlay.Card, // Send winning card to frontend
			"trickOverMessage": "Trick is over",  // New trick over message
			"playerHand":       player.Hand,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)

		// 🔥 Delay before progressing to the next trick or round
		go func() {
			time.Sleep(2000 * time.Millisecond) // Wait 2 seconds for highlight effect

			game.GamesMu.Lock()
			defer game.GamesMu.Unlock()

			// If players still have cards, continue the round.
			if len(g.Players[0].Hand) > 0 {
				var winnerIndex int
				for i, p := range g.Players {
					if p.ID == winningPlay.PlayerID {
						winnerIndex = i
						break
					}
				}
				round.TrickLeader = winnerIndex
				round.CurrentTrick = &game.Trick{
					LeaderID: winningPlay.PlayerID,
					Plays:    []game.Play{},
				}
				round.TrickTurnIndex = 0
			} else {
				// End of round. Record round results.
				var roundResults []game.PlayerRoundResult
				for _, p := range g.Players {
					bid := round.Bids[p.ID]
					roundScore := 0
					if p.TricksWon == bid {
						roundScore = 10 + bid*bid
						p.Score += roundScore
					}
					roundResults = append(roundResults, game.PlayerRoundResult{
						PlayerID:   p.ID,
						Bid:        bid,
						TricksWon:  p.TricksWon,
						RoundScore: roundScore,
					})
				}

				newRoundResult := game.RoundResult{
					RoundNumber: round.RoundNumber,
					TotalCards:  round.TotalCards,
					Results:     roundResults,
				}
				g.RoundResults = append(g.RoundResults, newRoundResult)

				// Setup next round if available.
				g.CurrentRoundIndex++
				if g.CurrentRoundIndex < len(g.RoundSequence) {
					newDealerIndex := (round.DealerIndex + 1) % len(g.Players)
					for _, p := range g.Players {
						p.TricksWon = 0
						p.Hand = []game.Card{}
					}

					newRound := &game.Round{
						RoundNumber:    g.CurrentRoundIndex + 1,
						TotalCards:     g.RoundSequence[g.CurrentRoundIndex],
						DealerIndex:    newDealerIndex,
						Bids:           make(map[string]int),
						BidOrder:       []string{},
						CurrentBidTurn: 0,
						Tricks:         []game.Trick{},
					}

					n := len(g.Players)
					for i := 1; i < n; i++ {
						index := (newDealerIndex + i) % n
						newRound.BidOrder = append(newRound.BidOrder, g.Players[index].ID)
					}
					newRound.BidOrder = append(newRound.BidOrder, g.Players[newDealerIndex].ID)

					deck := game.CreateDeck()
					game.ShuffleDeck(deck)
					if err := game.DealCards(deck, g.Players, newRound.TotalCards); err != nil {
						return
					}
					g.CurrentRound = newRound
					g.State = "bidding"
				} else {
					g.State = "finished"
					time.Sleep(2000 * time.Millisecond)
					// Optionally, attach extra info (you might add a field like FinishedAt, or compute missed bid counts)
					for _, p := range g.Players {
						missedRounds := 0
						for _, roundResult := range g.RoundResults {
								// Assuming roundResult.Results contains each player's result for that round.
								for _, res := range roundResult.Results {
										if res.PlayerID == p.ID && res.TricksWon != res.Bid {
												missedRounds++
										}
								}
						}
						// You could, for example, add this info to the Player struct or in a separate field.
						// For this example, assume you extend Player with a MissedBids field.
						p.MissedBids = missedRounds
					}
				}
			}
		}()
		return
	}

	// Normal case: trick is not yet complete
	resp := map[string]interface{}{
		"message":      "Card played",
		"currentTrick": round.CurrentTrick,
		"tricks":       round.Tricks,
		"playerHand":   player.Hand,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GetGameStateHandler returns the current game state.
func GetGameStateHandler(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "gameId required", http.StatusBadRequest)
		return
	}
	game.GamesMu.Lock()
	g, ok := game.Games[gameID]
	game.GamesMu.Unlock()
	if !ok {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}
