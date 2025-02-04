package main

import (
	"log"
	"net/http"

	"github.com/etanetan/up-and-down-the-river/backend/internal/handlers"
)

// withCORS is a middleware that adds CORS headers.
func withCORS(h http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
        // If it's an OPTIONS request, we can stop here.
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusOK)
            return
        }
        h(w, r)
    }
}

func main() {
    // Wrap each handler with the CORS middleware.
    http.HandleFunc("/games/create", withCORS(handlers.CreateGameHandler))
    http.HandleFunc("/games/join", withCORS(handlers.JoinGameHandler))
    http.HandleFunc("/games/start", withCORS(handlers.StartGameHandler))
    http.HandleFunc("/games/bid", withCORS(handlers.BidHandler))
    http.HandleFunc("/games/play", withCORS(handlers.PlayHandler))
    http.HandleFunc("/games/state", withCORS(handlers.GetGameStateHandler))
		http.HandleFunc("/games/reset", withCORS(handlers.ResetGameHandler))

    log.Println("Server started on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
