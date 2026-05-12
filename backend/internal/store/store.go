// Package store persists Game documents to Firestore. The server keeps no
// in-memory game state — every mutation is a transactional read-modify-write
// against the games/{gameId} document. This lets multiple Cloud Run
// instances safely share state and survives cold starts / redeploys.
package store

import (
	"context"
	"errors"
	"fmt"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/etanetan/up-and-down-the-river/backend/internal/game"
)

const gamesCollection = "games"

// ErrNotFound is returned when a game doc doesn't exist.
var ErrNotFound = errors.New("game not found")

// Store is the persistence facade for game state.
type Store struct {
	client *firestore.Client
}

// New constructs a Store using the provided Firestore client. The caller owns
// the client lifecycle.
func New(client *firestore.Client) *Store {
	return &Store{client: client}
}

// Create inserts a new game. Fails if the ID already exists.
func (s *Store) Create(ctx context.Context, g *game.Game) error {
	_, err := s.client.Collection(gamesCollection).Doc(g.ID).Create(ctx, g)
	if err != nil {
		return fmt.Errorf("firestore create: %w", err)
	}
	return nil
}

// Get loads a game by ID.
func (s *Store) Get(ctx context.Context, gameID string) (*game.Game, error) {
	snap, err := s.client.Collection(gamesCollection).Doc(gameID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("firestore get: %w", err)
	}
	var g game.Game
	if err := snap.DataTo(&g); err != nil {
		return nil, fmt.Errorf("firestore decode: %w", err)
	}
	normalizeGame(&g)
	return &g, nil
}

// normalizeGame ensures slice fields are non-nil so the JSON encoder
// emits [] instead of null — which keeps the wire shape consistent with
// what the frontend's Firestore listener already sees.
func normalizeGame(g *game.Game) {
	if g == nil {
		return
	}
	if g.RoundSequence == nil {
		g.RoundSequence = []int{}
	}
	if g.RoundResults == nil {
		g.RoundResults = []game.RoundResult{}
	}
	for _, p := range g.Players {
		if p.Hand == nil {
			p.Hand = []game.Card{}
		}
	}
	if g.CurrentRound != nil {
		r := g.CurrentRound
		if r.Bids == nil {
			r.Bids = map[string]int{}
		}
		if r.BidOrder == nil {
			r.BidOrder = []string{}
		}
		if r.Tricks == nil {
			r.Tricks = []game.Trick{}
		}
		if r.CurrentTrick != nil && r.CurrentTrick.Plays == nil {
			r.CurrentTrick.Plays = []game.Play{}
		}
	}
}

// Update transactionally loads a game, calls mutate, and writes the result.
// mutate is given a pointer it may freely modify; if it returns an error the
// transaction aborts and the doc is unchanged.
func (s *Store) Update(ctx context.Context, gameID string, mutate func(*game.Game) error) (*game.Game, error) {
	docRef := s.client.Collection(gamesCollection).Doc(gameID)
	var result *game.Game
	err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(docRef)
		if err != nil {
			if status.Code(err) == codes.NotFound {
				return ErrNotFound
			}
			return err
		}
		var g game.Game
		if err := snap.DataTo(&g); err != nil {
			return err
		}
		if err := mutate(&g); err != nil {
			return err
		}
		if err := tx.Set(docRef, &g); err != nil {
			return err
		}
		result = &g
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// CleanupIterator returns an iterator over all games (used only by ad-hoc
// scripts). Kept here to centralise Firestore knowledge.
func (s *Store) CleanupIterator(ctx context.Context) *firestore.DocumentIterator {
	return s.client.Collection(gamesCollection).Documents(ctx)
}

// Ensure iterator is used so unused-import lint doesn't fire if the
// CleanupIterator helper is ever removed.
var _ = iterator.Done
