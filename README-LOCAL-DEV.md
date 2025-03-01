# Local Development Guide

This guide explains how to run the Up and Down the River game locally for development.

## Prerequisites

- Go 1.16+ installed
- Node.js 14+ and npm installed

## Running the Backend

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Run the Go server:

   ```bash
   go run cmd/server/main.go
   ```

   This will start the backend server on port 8080.

## Running the Frontend

1. Open a new terminal window/tab and navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies (if you haven't already):

   ```bash
   npm install
   ```

3. Start the React development server:

   ```bash
   npm start
   ```

   This will start the React app on port 3000 and should automatically open it in your browser.

## How It Works

- The frontend uses environment variables to determine which API URL to use:

  - In development (when running `npm start`), it uses `http://localhost:8080` (defined in `.env.development`)
  - In production (when built with `npm run build`), it uses the Google Cloud URL (defined in `.env.production`)

- When you push changes to GitHub, the production build will automatically use the production API URL.

## Testing Your Changes

1. Make changes to the backend code
2. Restart the Go server to apply changes
3. Test in your browser at http://localhost:3000

## Troubleshooting

- If you see CORS errors in the browser console, make sure the backend server is running and properly configured for CORS.
- If API calls fail, check that you're using the correct port (8080) for the backend.
- If the React app doesn't reflect your changes, try clearing your browser cache or using incognito mode.
