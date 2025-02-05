# Use an official Golang image as the build stage.
FROM golang:1.20 AS builder

# Set the working directory inside the container.
WORKDIR /app

# Copy go.mod and go.sum first to leverage caching.
COPY go.mod go.sum ./
RUN go mod download

# Copy the entire backend folder (which is the build context).
COPY . .

# Change working directory to where main.go is located.
WORKDIR /app/cmd/server

# Build the Go binary.
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Use a minimal image for the final container.
FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /app/cmd/server/server .

# Expose the port your app listens on.
EXPOSE 8080

# Run the binary.
CMD ["./server"]
