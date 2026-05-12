package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/firestore"

	"github.com/etanetan/up-and-down-the-river/backend/internal/handlers"
	"github.com/etanetan/up-and-down-the-river/backend/internal/store"
)

// projectID is read from GCP_PROJECT / GOOGLE_CLOUD_PROJECT on Cloud Run
// (the latter is set automatically). For local dev, set it in the shell.
func projectID() string {
	if v := os.Getenv("GCP_PROJECT"); v != "" {
		return v
	}
	if v := os.Getenv("GOOGLE_CLOUD_PROJECT"); v != "" {
		return v
	}
	return "up-and-down-the-river-449922"
}

// withCORS wraps an http.HandlerFunc with permissive CORS headers.
func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		h(w, r)
	}
}

func main() {
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, projectID())
	if err != nil {
		log.Fatalf("firestore.NewClient: %v", err)
	}
	defer client.Close()

	s := store.New(client)
	h := handlers.New(s)

	http.HandleFunc("/games/create", withCORS(h.CreateGameHandler))
	http.HandleFunc("/games/join", withCORS(h.JoinGameHandler))
	http.HandleFunc("/games/start", withCORS(h.StartGameHandler))
	http.HandleFunc("/games/bid", withCORS(h.BidHandler))
	http.HandleFunc("/games/play", withCORS(h.PlayHandler))
	http.HandleFunc("/games/state", withCORS(h.GetGameStateHandler))
	http.HandleFunc("/games/reset", withCORS(h.ResetGameHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server started on :%s (project %s)", port, projectID())
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
