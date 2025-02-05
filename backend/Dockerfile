# Use an official Golang image as the build environment.
FROM golang:1.20 AS builder

# Set the working directory inside the container.
WORKDIR /app

# Copy go.mod and go.sum first so we can cache dependencies.
COPY go.mod go.sum ./
RUN go mod download

# Copy the entire backend folder into the container.
# Adjust the copy command if your Dockerfile is at project root.
COPY . .

# Change working directory to your server directory.
WORKDIR /app/backend/cmd/server

# Build the Go binary.
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Use a minimal base image for the final container.
FROM alpine:latest
RUN apk --no-cache add ca-certificates

# Set working directory and copy the binary from the builder.
WORKDIR /root/
COPY --from=builder /app/backend/cmd/server/server .

# Expose port 8080 (or the port your app listens on).
EXPOSE 8080

# Run the binary.
CMD ["./server"]
