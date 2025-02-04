package game

import (
	"errors"
	"math/rand"
	"strings"
	"sync"
	"time"
)

// Initialize random seed.
func init() {
	rand.Seed(time.Now().UnixNano())
}

// Suit and Rank definitions.
type Suit string
type Rank int

const (
	Spades   Suit = "spades"
	Hearts   Suit = "hearts"
	Diamonds Suit = "diamonds"
	Clubs    Suit = "clubs"
)

const (
	Two   Rank = 2
	Three Rank = 3
	Four  Rank = 4
	Five  Rank = 5
	Six   Rank = 6
	Seven Rank = 7
	Eight Rank = 8
	Nine  Rank = 9
	Ten   Rank = 10
	Jack  Rank = 11
	Queen Rank = 12
	King  Rank = 13
	Ace   Rank = 14
)

// Card represents a playing card.
type Card struct {
	Suit      string `json:"suit"`      // e.g. "hearts", "spades", etc.
	Rank      int    `json:"rank"`      // 2–14 (Ace is high)
	IsJoker   bool   `json:"isJoker"`   // true if joker
	JokerName string `json:"jokerName"` // "J1" or "J2"
}

// Player represents a game participant.
type Player struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Hand        []Card `json:"hand"`
	CurrentBid  int    `json:"currentBid"`
	BidOrder    int    `json:"bidOrder"`
	TricksWon   int    `json:"tricksWon"`
	Score       int    `json:"score"`
	IsBot       bool   `json:"isBot"`
	MissedBids  int    `json:"missedBids"`
}

// Play represents one card played in a trick.
type Play struct {
	PlayerID string `json:"playerId"`
	Card     Card   `json:"card"`
}

// Trick represents a single trick.
type Trick struct {
	Plays    []Play `json:"plays"`
	LeaderID string `json:"leaderId"`
	WinnerID string `json:"winnerId"`
}

// Round represents one round of play.
type Round struct {
	RoundNumber    int            `json:"roundNumber"`
	TotalCards     int            `json:"totalCards"`
	DealerIndex    int            `json:"dealerIndex"`
	Bids           map[string]int `json:"bids"`
	BidOrder       []string       `json:"bidOrder"`
	CurrentBidTurn int            `json:"currentBidTurn"`
	Tricks         []Trick        `json:"tricks"`
	CurrentTrick   *Trick         `json:"currentTrick"`
	TrickTurnIndex int            `json:"trickTurnIndex"`
	TrickLeader    int            `json:"trickLeader"`
}

// RoundResult holds results for a round.
type RoundResult struct {
	RoundNumber int                  `json:"roundNumber"`
	TotalCards  int                  `json:"totalCards"`
	Results     []PlayerRoundResult  `json:"results"`
}

// PlayerRoundResult holds a player’s result for a round.
type PlayerRoundResult struct {
	PlayerID   string `json:"playerId"`
	Bid        int    `json:"bid"`
	TricksWon  int    `json:"tricksWon"`
	RoundScore int    `json:"roundScore"`
}

// Game represents the overall game state.
type Game struct {
	ID                string            `json:"id"`
	Players           []*Player         `json:"players"`
	State             string            `json:"state"` // "lobby", "bidding", "playing", "scoring", "finished"
	CurrentRound      *Round            `json:"currentRound"`
	RoundSequence     []int             `json:"roundSequence"`
	CurrentRoundIndex int               `json:"currentRoundIndex"`
	CreatorMaxCards   int               `json:"creatorMaxCards"`
	RoundResults      []RoundResult     `json:"roundResults"`
}

// Global games map and its mutex.
var (
	Games   = make(map[string]*Game)
	GamesMu sync.Mutex
)

// CreateDeck returns a standard deck (52 cards plus 2 jokers).
func CreateDeck() []Card {
	var deck []Card
	suits := []string{"hearts", "diamonds", "clubs", "spades"}
	for _, s := range suits {
		for rank := 2; rank <= 14; rank++ {
			deck = append(deck, Card{
				Suit:    s,
				Rank:    rank,
				IsJoker: false,
			})
		}
	}
	deck = append(deck, Card{Suit: "spades", IsJoker: true, JokerName: "J1"})
	deck = append(deck, Card{Suit: "spades", IsJoker: true, JokerName: "J2"})
	return deck
}

// ShuffleDeck shuffles the deck.
func ShuffleDeck(deck []Card) {
	rand.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
}

// DealCards deals cardsPerPlayer cards to each player.
func DealCards(deck []Card, players []*Player, cardsPerPlayer int) error {
	totalNeeded := cardsPerPlayer * len(players)
	if totalNeeded > len(deck) {
		return errors.New("not enough cards in the deck")
	}
	for i := 0; i < cardsPerPlayer; i++ {
		for _, p := range players {
			p.Hand = append(p.Hand, deck[0])
			deck = deck[1:]
		}
	}
	return nil
}

// IsTrump returns true if the card is trump.
func IsTrump(c Card) bool {
	return c.IsJoker || strings.ToLower(c.Suit) == "spades"
}

// CompareTrump compares two trump cards.
func CompareTrump(c1, c2 Card) int {
	if c1.IsJoker && c2.IsJoker {
		if c1.JokerName == "J1" && c2.JokerName == "J2" {
			return 1
		} else if c1.JokerName == "J2" && c2.JokerName == "J1" {
			return -1
		}
		return 0
	}
	if c1.IsJoker {
		return 1
	}
	if c2.IsJoker {
		return -1
	}
	if c1.Rank > c2.Rank {
		return 1
	} else if c1.Rank < c2.Rank {
		return -1
	}
	return 0
}

// CompareCards compares two cards given the lead suit.
func CompareCards(c1, c2 Card, leadSuit string) int {
	c1Trump := IsTrump(c1)
	c2Trump := IsTrump(c2)
	if c1Trump && c2Trump {
		return CompareTrump(c1, c2)
	} else if c1Trump {
		return 1
	} else if c2Trump {
		return -1
	} else {
		if strings.ToLower(c1.Suit) == strings.ToLower(c2.Suit) {
			if c1.Rank > c2.Rank {
				return 1
			} else if c1.Rank < c2.Rank {
				return -1
			}
			return 0
		} else if strings.ToLower(c1.Suit) == strings.ToLower(leadSuit) {
			return 1
		} else if strings.ToLower(c2.Suit) == strings.ToLower(leadSuit) {
			return -1
		}
	}
	return 0
}

// ComputeRoundSequence returns the round sequence (e.g., [1,2,3,2,1]).
func ComputeRoundSequence(max int) []int {
	var seq []int
	for i := 1; i <= max; i++ {
		seq = append(seq, i)
	}
	for i := max - 1; i >= 1; i-- {
		seq = append(seq, i)
	}
	return seq
}

// FindPlayer returns a player by ID.
func FindPlayer(g *Game, playerID string) (*Player, int) {
	for i, p := range g.Players {
		if p.ID == playerID {
			return p, i
		}
	}
	return nil, -1
}

// CardEquals checks whether two cards are equal.
func CardEquals(a, b Card) bool {
	if a.IsJoker != b.IsJoker {
		return false
	}
	if a.IsJoker {
		return a.JokerName == b.JokerName
	}
	return strings.ToLower(a.Suit) == strings.ToLower(b.Suit) && a.Rank == b.Rank
}