// Package handlers contains the HTTP entry points for the game. Every
// mutation reads the game from Firestore inside a transaction, applies its
// changes, and writes the new state back. The server keeps no in-memory game
// state, so Cloud Run is free to scale instances horizontally and to zero.
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/etanetan/up-and-down-the-river/backend/internal/game"
	"github.com/etanetan/up-and-down-the-river/backend/internal/store"
)

const letterBytes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// trickOverDisplayDuration is how long the "X won the trick!" snapshot stays
// in Firestore before we write the next-trick state. The handler holds the
// HTTP request open for this duration so Cloud Run keeps the instance alive.
const trickOverDisplayDuration = 2 * time.Second

// Handlers wires HTTP routes to the persistent store.
type Handlers struct {
	store *store.Store
}

// New returns a Handlers with the given store.
func New(s *store.Store) *Handlers {
	return &Handlers{store: s}
}

func generateGameID() string {
	letters := make([]byte, 3)
	for i := range letters {
		letters[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	numbers := rand.Intn(1000)
	return string(letters) + fmt.Sprintf("%03d", numbers)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func notFound(w http.ResponseWriter, msg string) {
	http.Error(w, msg, http.StatusNotFound)
}

// CreateGameHandler creates a new game document.
func (h *Handlers) CreateGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName     string  `json:"displayName"`
		CreatorMaxCards int     `json:"creatorMaxCards"`
		MoneyPerMiss    float64 `json:"moneyPerMiss"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.DisplayName == "" {
		http.Error(w, "displayName is required", http.StatusBadRequest)
		return
	}

	gameID := generateGameID()
	creator := &game.Player{
		ID:          uuid.New().String(),
		DisplayName: req.DisplayName,
	}
	g := &game.Game{
		ID:              gameID,
		Players:         []*game.Player{creator},
		State:           "lobby",
		CreatorMaxCards: req.CreatorMaxCards,
		MoneyPerMiss:    req.MoneyPerMiss,
	}
	if err := h.store.Create(r.Context(), g); err != nil {
		http.Error(w, "could not create game: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"gameId":   gameID,
		"playerId": creator.ID,
	})
}

// JoinGameHandler adds a new player to an existing lobby.
func (h *Handlers) JoinGameHandler(w http.ResponseWriter, r *http.Request) {
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

	newPlayer := &game.Player{
		ID:          uuid.New().String(),
		DisplayName: req.DisplayName,
	}
	_, err := h.store.Update(r.Context(), req.GameID, func(g *game.Game) error {
		if g.State != "lobby" {
			return httpErr(http.StatusBadRequest, "game already started")
		}
		if len(g.Players) >= 6 {
			return httpErr(http.StatusBadRequest, "game is full")
		}
		g.Players = append(g.Players, newPlayer)
		return nil
	})
	if err != nil {
		respondErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"gameId":   req.GameID,
		"playerId": newPlayer.ID,
	})
}

// StartGameHandler deals cards and transitions the game to the bidding phase.
func (h *Handlers) StartGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID string `json:"gameId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.store.Update(r.Context(), req.GameID, func(g *game.Game) error {
		if g.State != "lobby" {
			return httpErr(http.StatusBadRequest, "game already started")
		}
		if len(g.Players) < 2 {
			return httpErr(http.StatusBadRequest, "need at least 2 players to start")
		}
		maxPossible := int(math.Floor(54.0 / float64(len(g.Players))))
		desired := g.CreatorMaxCards
		if desired <= 0 || desired > maxPossible {
			desired = maxPossible
		}
		g.RoundSequence = game.ComputeRoundSequence(desired)
		g.CurrentRoundIndex = 0

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

		deck := game.CreateDeck()
		game.ShuffleDeck(deck)
		for _, p := range g.Players {
			p.Hand = []game.Card{}
			p.CurrentBid = 0
			p.TricksWon = 0
		}
		if err := game.DealCards(deck, g.Players, round.TotalCards); err != nil {
			return httpErr(http.StatusInternalServerError, "error dealing cards: "+err.Error())
		}

		n := len(g.Players)
		for i := 1; i < n; i++ {
			index := (dealerIndex + i) % n
			round.BidOrder = append(round.BidOrder, g.Players[index].ID)
		}
		round.BidOrder = append(round.BidOrder, g.Players[dealerIndex].ID)
		return nil
	})
	if err != nil {
		respondErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Game started"})
}

// BidHandler records a player's bid; transitions to playing when all bids in.
func (h *Handlers) BidHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID   string `json:"gameId"`
		PlayerID string `json:"playerId"`
		Bid      int    `json:"bid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.store.Update(r.Context(), req.GameID, func(g *game.Game) error {
		if g.State != "bidding" {
			return httpErr(http.StatusBadRequest, "not in bidding phase")
		}
		round := g.CurrentRound
		if round.BidOrder[round.CurrentBidTurn] != req.PlayerID {
			return httpErr(http.StatusBadRequest, "not your turn to bid")
		}
		if req.Bid < 0 || req.Bid > round.TotalCards {
			return httpErr(http.StatusBadRequest, "invalid bid amount")
		}
		isDealer := round.BidOrder[round.CurrentBidTurn] == g.Players[round.DealerIndex].ID
		if isDealer && round.TotalCards > 1 {
			sumBids := 0
			for _, b := range round.Bids {
				sumBids += b
			}
			if sumBids+req.Bid == round.TotalCards {
				return httpErr(http.StatusBadRequest, "dealer bid cannot make total bids equal total cards")
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
		return nil
	})
	if err != nil {
		respondErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Bid accepted"})
}

// PlayHandler processes a card played by a player. If the play completes the
// trick, the handler writes the trick-over snapshot, waits 2s so clients can
// display the winner, then writes the next-trick (or game-end) snapshot.
func (h *Handlers) PlayHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID   string    `json:"gameId"`
		PlayerID string    `json:"playerId"`
		Card     game.Card `json:"card"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var trickComplete bool
	_, err := h.store.Update(r.Context(), req.GameID, func(g *game.Game) error {
		if g.State != "playing" {
			return httpErr(http.StatusBadRequest, "not in playing phase")
		}
		round := g.CurrentRound
		expectedPlayerID := g.Players[(round.TrickLeader+round.TrickTurnIndex)%len(g.Players)].ID
		if req.PlayerID != expectedPlayerID {
			return httpErr(http.StatusBadRequest, "not your turn to play")
		}
		player, _ := game.FindPlayer(g, req.PlayerID)
		cardIndex := -1
		for i, c := range player.Hand {
			if game.CardEquals(c, req.Card) {
				cardIndex = i
				break
			}
		}
		if cardIndex == -1 {
			return httpErr(http.StatusBadRequest, "player does not have that card")
		}
		playedCard := player.Hand[cardIndex]
		player.Hand = append(player.Hand[:cardIndex], player.Hand[cardIndex+1:]...)

		if len(round.CurrentTrick.Plays) > 0 {
			leadSuit := strings.ToLower(round.CurrentTrick.Plays[0].Card.Suit)
			hasLeadSuit := false
			for _, c := range player.Hand {
				if !c.IsJoker && strings.ToLower(c.Suit) == leadSuit {
					hasLeadSuit = true
					break
				}
			}
			if hasLeadSuit {
				if req.Card.IsJoker || strings.ToLower(req.Card.Suit) != leadSuit {
					return httpErr(http.StatusBadRequest, "you must follow suit")
				}
			}
		}

		round.CurrentTrick.Plays = append(round.CurrentTrick.Plays, game.Play{
			PlayerID: req.PlayerID,
			Card:     playedCard,
		})
		round.TrickTurnIndex++

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
				g.TrickOverMessage = fmt.Sprintf("%s won the trick!", winner.DisplayName)
			} else {
				g.TrickOverMessage = "Trick is over"
			}
			round.Tricks = append(round.Tricks, *round.CurrentTrick)
			trickComplete = true
		}
		return nil
	})
	if err != nil {
		respondErr(w, err)
		return
	}

	if !trickComplete {
		writeJSON(w, http.StatusOK, map[string]string{"message": "Card played"})
		return
	}

	// Hold the HTTP request open for the trick-over display so Cloud Run
	// keeps this instance alive long enough to finish the follow-up write.
	time.Sleep(trickOverDisplayDuration)

	_, err = h.store.Update(context.Background(), req.GameID, func(g *game.Game) error {
		g.TrickOverMessage = ""
		round := g.CurrentRound
		if round == nil {
			return nil
		}
		var winnerID string
		if len(round.Tricks) > 0 {
			winnerID = round.Tricks[len(round.Tricks)-1].WinnerID
		}
		if len(g.Players[0].Hand) > 0 {
			winnerIndex := 0
			for i, p := range g.Players {
				if p.ID == winnerID {
					winnerIndex = i
					break
				}
			}
			round.TrickLeader = winnerIndex
			round.CurrentTrick = &game.Trick{
				LeaderID: winnerID,
				Plays:    []game.Play{},
			}
			round.TrickTurnIndex = 0
			return nil
		}
		// End of round — record results.
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
		g.RoundResults = append(g.RoundResults, game.RoundResult{
			RoundNumber: round.RoundNumber,
			TotalCards:  round.TotalCards,
			Results:     roundResults,
		})
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
				return err
			}
			g.CurrentRound = newRound
			g.State = "bidding"
			return nil
		}
		// Game over.
		g.State = "finished"
		for _, p := range g.Players {
			missed := 0
			for _, rr := range g.RoundResults {
				for _, res := range rr.Results {
					if res.PlayerID == p.ID && res.TricksWon != res.Bid {
						missed++
					}
				}
			}
			p.MissedBids = missed
		}
		return nil
	})
	if err != nil {
		log.Printf("post-trick update failed: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Card played"})
}

// GetGameStateHandler returns the current game state for one-shot reads.
// Frontend uses Firestore onSnapshot for live updates; this remains for the
// initial fetch / URL restore path.
func (h *Handlers) GetGameStateHandler(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "gameId required", http.StatusBadRequest)
		return
	}
	g, err := h.store.Get(r.Context(), gameID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "game not found")
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, g)
}

// ResetGameHandler restarts the same lobby with fresh scores.
func (h *Handlers) ResetGameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameID string `json:"gameId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	g, err := h.store.Update(r.Context(), req.GameID, func(g *game.Game) error {
		g.RoundResults = []game.RoundResult{}
		g.CurrentRoundIndex = 0
		for _, p := range g.Players {
			p.Hand = []game.Card{}
			p.Score = 0
			p.TricksWon = 0
			p.CurrentBid = 0
			p.MissedBids = 0
		}
		maxPossible := int(math.Floor(54.0 / float64(len(g.Players))))
		desired := g.CreatorMaxCards
		if desired <= 0 || desired > maxPossible {
			desired = maxPossible
		}
		g.RoundSequence = game.ComputeRoundSequence(desired)
		g.State = "bidding"

		var dealerIndex int
		if g.CurrentRound != nil {
			dealerIndex = (g.CurrentRound.DealerIndex + 1) % len(g.Players)
		} else {
			dealerIndex = rand.Intn(len(g.Players))
		}
		newRound := &game.Round{
			RoundNumber:    1,
			TotalCards:     g.RoundSequence[0],
			DealerIndex:    dealerIndex,
			Bids:           make(map[string]int),
			BidOrder:       []string{},
			CurrentBidTurn: 0,
		}
		n := len(g.Players)
		for i := 1; i < n; i++ {
			index := (dealerIndex + i) % n
			newRound.BidOrder = append(newRound.BidOrder, g.Players[index].ID)
		}
		newRound.BidOrder = append(newRound.BidOrder, g.Players[dealerIndex].ID)
		g.CurrentRound = newRound

		deck := game.CreateDeck()
		game.ShuffleDeck(deck)
		for _, p := range g.Players {
			p.Hand = []game.Card{}
		}
		if err := game.DealCards(deck, g.Players, newRound.TotalCards); err != nil {
			return httpErr(http.StatusInternalServerError, "error dealing cards: "+err.Error())
		}
		return nil
	})
	if err != nil {
		respondErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, g)
}

// httpError carries an HTTP status alongside the error message. Mutate
// callbacks return one of these to fail the transaction with a clean status.
type httpError struct {
	Status  int
	Message string
}

func (e *httpError) Error() string { return e.Message }

func httpErr(status int, msg string) error {
	return &httpError{Status: status, Message: msg}
}

func respondErr(w http.ResponseWriter, err error) {
	var he *httpError
	if errors.As(err, &he) {
		http.Error(w, he.Message, he.Status)
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "game not found")
		return
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
}
