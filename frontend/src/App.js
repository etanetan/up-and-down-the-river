import React, { useState, useEffect } from 'react';
import BidModal from './BidModal'; // Import the vertical bidding modal component
import './App.css';

// Set the backend API URL. When running locally you might use localhost,
// but here we're using the Cloud Run URL.
//const API_URL = 'https://upanddownbackend-755936114859.us-central1.run.app';
const API_URL = 'http://localhost:8080';
// ---------------------------
// Helper Functions
// ---------------------------

// formatCard: Formats a card object into a styled JSX element.
// If the card is a Joker, display the joker name in bold; otherwise, display the rank and suit.
const formatCard = (card) => {
	if (card.isJoker) {
		return (
			<span style={{ color: 'black', fontSize: '24px', fontWeight: 'bold' }}>
				{card.jokerName}
			</span>
		);
	}
	let rankText;
	// Determine the text to show based on the card's rank.
	switch (card.rank) {
		case 11:
			rankText = 'J';
			break;
		case 12:
			rankText = 'Q';
			break;
		case 13:
			rankText = 'K';
			break;
		case 14:
			rankText = 'A';
			break;
		default:
			rankText = card.rank;
	}
	let suitSymbol;
	let suitColor = 'black';
	// Determine the suit symbol and color.
	switch (card.suit.toLowerCase()) {
		case 'hearts':
			suitSymbol = '♥';
			suitColor = 'red';
			break;
		case 'diamonds':
			suitSymbol = '♦';
			suitColor = 'red';
			break;
		case 'spades':
			suitSymbol = '♠';
			suitColor = 'black';
			break;
		case 'clubs':
			suitSymbol = '♣';
			suitColor = 'black';
			break;
		default:
			suitSymbol = card.suit;
	}
	return (
		<span style={{ color: suitColor, fontSize: '24px', fontWeight: 'bold' }}>
			{rankText} {suitSymbol}
		</span>
	);
};

// sortHand: Takes an array of card objects and returns a new array sorted by suit
// (using the order: diamonds, clubs, hearts, spades) and then by rank in ascending order.
const sortHand = (hand) => {
	const suitOrder = { diamonds: 1, clubs: 2, hearts: 3, spades: 4 };
	return hand.slice().sort((a, b) => {
		const suitA = suitOrder[a.suit.toLowerCase()] || 99;
		const suitB = suitOrder[b.suit.toLowerCase()] || 99;
		if (suitA === suitB) {
			return a.rank - b.rank;
		}
		return suitA - suitB;
	});
};

// ---------------------------
// Components
// ---------------------------

// TablePlayers: Displays the players around the table with their display name and bid/tricks info.
// It calculates a rotation angle so that the current player's information appears at the bottom.
function TablePlayers({ players, currentRound, currentPlayerId }) {
	const numPlayers = players.length;
	// Find the index of the current player so we can rotate the layout accordingly.
	const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
	// Compute the offset to set the current player's angle to 90° (bottom center).
	const offset = 90 - (360 / numPlayers) * currentIndex;
	// Map over players to compute each player's angle.
	const playersWithAngle = players.map((player, i) => {
		const angle = (360 / numPlayers) * i + offset;
		return { ...player, angle };
	});
	return (
		<div className="table-players">
			{playersWithAngle.map((player) => {
				// Convert the angle from degrees to radians for the trigonometric functions.
				const angleRad = (player.angle * Math.PI) / 180;
				// Set radii for positioning the players further from the table's center.
				const radiusX = 220; // Horizontal radius
				const radiusY = 160; // Vertical radius
				const x = radiusX * Math.cos(angleRad);
				const y = radiusY * Math.sin(angleRad);
				// Convert the x and y coordinates to percentages relative to the table container.
				const left = 50 + (x / 400) * 100;
				const top = 50 + (y / 300) * 100;
				// Determine the bid for display. If no bid exists, display a hyphen.
				const bid =
					currentRound &&
					currentRound.bids &&
					currentRound.bids[player.id] !== undefined
						? currentRound.bids[player.id]
						: '-';

				// Check if player went over their bid (bust)
				const tricksWon = player.tricksWon || 0;
				const isBust = bid !== '-' && tricksWon > bid;

				return (
					<div
						key={player.id}
						className="table-player"
						style={{ left: `${left}%`, top: `${top}%` }}
					>
						{/* Display the player's name and a combined view of tricks won and their bid.
                Format: "PlayerName (tricksWon/bid)" */}
						<div className="table-player-info">
							{player.displayName}{' '}
							<span
								className="table-player-bid"
								style={{ color: isBust ? '#ff4444' : 'inherit' }}
							>
								({tricksWon}/{bid})
							</span>
						</div>
						{/* Display a dealer chip ("D") if this player is the dealer */}
						{currentRound &&
							currentRound.dealerIndex !== undefined &&
							players[currentRound.dealerIndex] &&
							player.id === players[currentRound.dealerIndex].id && (
								<div className="dealer-chip">D</div>
							)}
					</div>
				);
			})}
		</div>
	);
}

// Scoreboard: Displays a table of scores for each player.
function Scoreboard({ gameState }) {
	if (!gameState) return null;
	const maxScore = Math.max(...gameState.players.map((p) => p.score));
	return (
		<div className="scoreboard">
			<h3>Scores</h3>
			<table className="round-table">
				<thead>
					<tr>
						<th>Cards</th>
						{gameState.players.map((player) => (
							<th key={player.id}>{player.displayName}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{gameState.roundResults &&
						gameState.roundResults.map((round) => (
							<tr key={round.roundNumber}>
								<td>{round.totalCards}</td>
								{gameState.players.map((player) => {
									const result = round.results.find(
										(r) => r.playerId === player.id
									);
									if (result) {
										const hit = result.tricksWon === result.bid;
										return (
											<td
												key={player.id}
												style={{ color: hit ? 'green' : 'red' }}
											>
												{result.roundScore} ({result.bid})
											</td>
										);
									} else {
										return <td key={player.id}>-</td>;
									}
								})}
							</tr>
						))}
					{/* Show pending round bids if game state is not finished */}
					{gameState.currentRound && gameState.state !== 'finished' && (
						<tr className="pending-round">
							<td>{gameState.currentRound.totalCards}</td>
							{gameState.players.map((player) => {
								const bid = gameState.currentRound.bids[player.id];
								return (
									<td key={player.id}>
										{bid !== undefined ? `(${bid})` : '(-)'}
									</td>
								);
							})}
						</tr>
					)}
					<tr className="total-row">
						<td>Total</td>
						{gameState.players.map((player) => (
							<td
								key={player.id}
								style={
									player.score === maxScore ? { backgroundColor: '#ddf' } : {}
								}
							>
								{player.score}
							</td>
						))}
					</tr>
					{/* Money lost row - only show if moneyPerMiss > 0 */}
					{gameState.moneyPerMiss > 0 && (
						<tr className="money-row">
							<td>$ Lost</td>
							{gameState.players.map((player) => {
								let moneyLost = 0;
								gameState.roundResults?.forEach((round) => {
									const result = round.results.find(
										(r) => r.playerId === player.id
									);
									if (result) {
										const missed = Math.abs(result.tricksWon - result.bid);
										moneyLost += missed * gameState.moneyPerMiss;
									}
								});
								return (
									<td key={player.id} style={{ color: 'red' }}>
										${moneyLost.toFixed(2)}
									</td>
								);
							})}
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}

// ---------------------------
// Main App Component
// ---------------------------

function App() {
	// Maintain various pieces of state:
	// view: current view ("home", "join", "lobby", or "game")
	// gameId, playerId, displayName: identifiers and name information
	// creatorMaxCards: maximum number of cards (set by game creator)
	// gameState: the current game state fetched from the backend
	// selectedCard: currently selected card (if any)
	// lastTrick: holds the most recent trick (used for animations or delayed updates)
	// actionMessage: a message for the UI (e.g., whose turn it is or who won the trick)
	// gameOver: flag for game completion
	const [view, setView] = useState('home');
	const [gameId, setGameId] = useState('');
	const [playerId, setPlayerId] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [creatorMaxCards, setCreatorMaxCards] = useState(10);
	const [moneyPerMiss, setMoneyPerMiss] = useState(0);
	const [gameState, setGameState] = useState(null);
	const [selectedCard, setSelectedCard] = useState(null);
	const [lastTrick, setLastTrick] = useState(null);
	const [actionMessage, setActionMessage] = useState('');
	const [gameOver, setGameOver] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [draggedCard, setDraggedCard] = useState(null);
	const [isCardPlayLocked, setIsCardPlayLocked] = useState(false);
	const [scoreboardModalOpen, setScoreboardModalOpen] = useState(false);

	// On component mount, check if there's a gameId in the URL.
	// Only restore from localStorage if there's a matching gameId in the URL.
	useEffect(() => {
		const path = window.location.pathname;
		const gameIdFromUrl = path.length > 1 ? path.substring(1) : null;

		if (gameIdFromUrl) {
			// If we have a gameId in the URL, try to restore session
			const savedGameId = localStorage.getItem('gameId');
			const savedPlayerId = localStorage.getItem('playerId');
			const savedDisplayName = localStorage.getItem('displayName');

			if (savedGameId === gameIdFromUrl && savedPlayerId && savedDisplayName) {
				// Restore session for THIS game
				setGameId(savedGameId);
				setPlayerId(savedPlayerId);
				setDisplayName(savedDisplayName);
				setView('lobby');
				fetchGameState(savedGameId);
			} else {
				// Clear any saved session for a different game
				localStorage.removeItem('gameId');
				localStorage.removeItem('playerId');
				localStorage.removeItem('displayName');
				setGameId(gameIdFromUrl);
				setView('join');
			}
		} else {
			// No URL gameId - always show home and clear any old session data
			localStorage.removeItem('gameId');
			localStorage.removeItem('playerId');
			localStorage.removeItem('displayName');
			setGameId('');
			setPlayerId('');
			setView('home');
		}
	}, []);

	// Create a new game by calling the backend.
	const createGame = async () => {
		const response = await fetch(`${API_URL}/games/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ displayName, creatorMaxCards, moneyPerMiss }),
		});
		const data = await response.json();
		setGameId(data.gameId);
		setPlayerId(data.playerId);

		// Save to localStorage
		localStorage.setItem('gameId', data.gameId);
		localStorage.setItem('playerId', data.playerId);
		localStorage.setItem('displayName', displayName);

		setView('lobby');
	};

	// Join an existing game.
	const joinGame = async () => {
		if (!gameId || !displayName) {
			console.error('Game ID or display name is missing.');
			return;
		}
		const response = await fetch(`${API_URL}/games/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, displayName }),
		});
		const data = await response.json();
		setPlayerId(data.playerId);

		// Save to localStorage
		localStorage.setItem('gameId', gameId);
		localStorage.setItem('playerId', data.playerId);
		localStorage.setItem('displayName', displayName);

		setView('lobby');
	};

	// Start the game by transitioning to the bidding phase.
	const startGame = async () => {
		await fetch(`${API_URL}/games/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId }),
		});
		fetchGameState();
	};

	// Handle placing a bid from the BidModal.
	const handlePlaceBid = async (bidValue) => {
		await fetch(`${API_URL}/games/bid`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, bid: parseInt(bidValue, 10) }),
		});
		fetchGameState();
	};

	// Play a selected card.
	const playSelectedCard = async () => {
		if (!selectedCard || isCardPlayLocked) return;

		// Lock card plays for 1 second
		setIsCardPlayLocked(true);

		await fetch(`${API_URL}/games/play`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, card: selectedCard }),
		});
		setSelectedCard(null);

		// Unlock after 1 second
		setTimeout(() => {
			setIsCardPlayLocked(false);
		}, 1000);
	};

	// Fetch the current game state from the backend.
	const fetchGameState = async (gameIdToFetch = gameId) => {
		if (!gameIdToFetch) return;
		const response = await fetch(
			`${API_URL}/games/state?gameId=${gameIdToFetch}`
		);
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Error fetching game state:', errorText);
			return;
		}
		const data = await response.json();
		// If the game state indicates that the game is finished, update gameOver flag.
		if (data.state === 'finished') {
			setGameState(data);
			setGameOver(true);
		} else {
			// If a trick is complete (all players played and a winner is set),
			// temporarily hold the trick state before updating gameState.
			if (
				data.currentRound &&
				data.currentRound.currentTrick &&
				data.currentRound.currentTrick.plays.length === data.players.length &&
				data.currentRound.currentTrick.winnerID
			) {
				if (!lastTrick) {
					setLastTrick(data.currentRound.currentTrick);
					setTimeout(() => {
						setGameState(data);
						setLastTrick(null);
					}, 2000); // Delay to allow UI to display the trick-over message
				}
			} else {
				setGameState(data);
			}
			// If the game state is one of these, set the view to 'game'.
			if (
				data.state === 'bidding' ||
				data.state === 'playing' ||
				data.state === 'scoring'
			) {
				setView('game');
			}
		}
		// Update the action message (e.g., whose turn it is) based on the game state.
		updateTurnMessages(data);
	};

	// updateTurnMessages: Updates the UI message that tells the user what is happening.
	// It prioritizes the trickOverMessage if present, then displays appropriate messages for bidding or playing.
	const updateTurnMessages = (data) => {
		if (!data || !data.currentRound) {
			setActionMessage('');
			return;
		}

		// If the backend sent a trickOverMessage (e.g., "Alice won the trick!"), display it immediately.
		if (data.trickOverMessage) {
			setActionMessage(data.trickOverMessage);
			return;
		}

		// Handle bidding phase: show "YOUR TURN to bid" or "Waiting for [player] to bid".
		if (data.state === 'bidding') {
			const round = data.currentRound;
			const currentBidderId = round.bidOrder[round.currentBidTurn];
			if (currentBidderId === playerId) {
				setActionMessage('YOUR TURN to bid');
			} else {
				const currentBidder = data.players.find(
					(p) => p.id === currentBidderId
				);
				if (currentBidder) {
					setActionMessage(`Waiting for ${currentBidder.displayName} to bid`);
				} else {
					setActionMessage('');
				}
			}
		}
		// Handle playing phase: show whose turn it is to play a card.
		else if (data.state === 'playing') {
			const round = data.currentRound;
			if (
				round.currentTrick &&
				round.currentTrick.plays.length < data.players.length
			) {
				const currentPlayerIndex =
					(round.trickLeader + round.trickTurnIndex) % data.players.length;
				const currentPlayer = data.players[currentPlayerIndex];
				if (currentPlayer.id === playerId) {
					setActionMessage('YOUR TURN to play a card');
				} else {
					setActionMessage(
						`Waiting for ${currentPlayer.displayName} to play a card`
					);
				}
			} else {
				setActionMessage('');
			}
		} else {
			setActionMessage('');
		}
	};

	// resetGame: Calls the backend to reset the game state and then refreshes the local state.
	const resetGame = async () => {
		await fetch(`${API_URL}/games/reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId }),
		});
		// Short delay before refetching the state to ensure backend update.
		setTimeout(() => {
			fetchGameState();
		}, 500);
	};

	// goHome: Clear session and return to home screen
	const goHome = () => {
		localStorage.removeItem('gameId');
		localStorage.removeItem('playerId');
		localStorage.removeItem('displayName');
		setGameId('');
		setPlayerId('');
		setDisplayName('');
		setGameState(null);
		setView('home');
		// Clear URL
		window.history.pushState({}, '', '/');
	};

	// copyToClipboard: Copies text to clipboard
	const copyToClipboard = async (text) => {
		try {
			await navigator.clipboard.writeText(text);
			// You could add a toast notification here if desired
		} catch (err) {
			console.error('Failed to copy text: ', err);
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
			} catch (err) {
				console.error('Fallback copy failed: ', err);
			}
			document.body.removeChild(textArea);
		}
	};

	// Poll the backend for the game state every 2 seconds.
	useEffect(() => {
		const interval = setInterval(() => {
			if (gameId) fetchGameState();
		}, 2000);
		return () => clearInterval(interval);
	}, [gameId]);

	// isMyTurnToBid: Checks if the local player is the current bidder.
	const isMyTurnToBid = () => {
		if (!gameState || !gameState.currentRound) return false;
		const round = gameState.currentRound;
		return round.bidOrder[round.currentBidTurn] === playerId;
	};

	// getForbiddenBid: Returns the bid value that the dealer cannot make (would make total = totalCards)
	// Returns null if not applicable (not dealer's turn, round has 1 card, or forbidden bid is negative)
	const getForbiddenBid = () => {
		if (!gameState || !gameState.currentRound || gameState.state !== 'bidding')
			return null;
		const round = gameState.currentRound;

		// Only applies to rounds with more than 1 card
		if (round.totalCards <= 1) return null;

		// Check if it's the dealer's turn (last bidder)
		const isDealerTurn = round.currentBidTurn === round.bidOrder.length - 1;
		if (!isDealerTurn) return null;

		// Check if current player is the dealer
		const dealerId = gameState.players[round.dealerIndex]?.id;
		if (dealerId !== playerId) return null;

		// Calculate sum of existing bids
		let sumBids = 0;
		for (const bid of Object.values(round.bids)) {
			sumBids += bid;
		}

		// Calculate forbidden bid (the bid that would make total = totalCards)
		const forbiddenBid = round.totalCards - sumBids;

		// Only show if forbidden bid is positive (0 or negative means it's already impossible)
		return forbiddenBid > 0 ? forbiddenBid : null;
	};

	// Check if card can be played
	const canPlayCard = (card) => {
		if (!gameState || gameState.state !== 'playing' || isCardPlayLocked)
			return false;

		const me = gameState.players.find((p) => p.id === playerId);
		if (!me) return false;

		const round = gameState.currentRound;
		if (!round || !round.currentTrick) return false;

		// Check if it's my turn
		const currentPlayerIndex =
			(round.trickLeader + round.trickTurnIndex) % gameState.players.length;
		const currentPlayer = gameState.players[currentPlayerIndex];
		if (currentPlayer.id !== playerId) return false;

		// Check if card follows suit
		if (round.currentTrick.plays.length > 0) {
			const leadSuit = round.currentTrick.plays[0].card.suit.toLowerCase();
			const hasLeadSuit = me.hand.some(
				(c) =>
					(!c.isJoker && c.suit.toLowerCase() === leadSuit) ||
					(leadSuit === 'spades' && c.isJoker)
			);
			if (hasLeadSuit) {
				if (
					leadSuit === 'spades' &&
					!card.isJoker &&
					card.suit.toLowerCase() !== 'spades'
				) {
					return false;
				} else if (card.suit.toLowerCase() !== leadSuit) {
					return false;
				}
			}
		}
		return true;
	};

	// Render a card from the player's hand. The card is clickable when it's the playing phase.
	const renderHandCard = (card, index) => {
		// Get rank and suit info for compact display
		let rankText, suitSymbol, suitColor;

		if (card.isJoker) {
			rankText = card.jokerName;
			suitSymbol = '';
			suitColor = 'black';
		} else {
			// Determine rank text
			switch (card.rank) {
				case 11:
					rankText = 'J';
					break;
				case 12:
					rankText = 'Q';
					break;
				case 13:
					rankText = 'K';
					break;
				case 14:
					rankText = 'A';
					break;
				default:
					rankText = card.rank;
			}

			// Determine suit symbol and color
			switch (card.suit.toLowerCase()) {
				case 'hearts':
					suitSymbol = '♥';
					suitColor = 'red';
					break;
				case 'diamonds':
					suitSymbol = '♦';
					suitColor = 'red';
					break;
				case 'spades':
					suitSymbol = '♠';
					suitColor = 'black';
					break;
				case 'clubs':
					suitSymbol = '♣';
					suitColor = 'black';
					break;
				default:
					suitSymbol = card.suit;
			}
		}

		const isCardPlayable = canPlayCard(card);

		return (
			<div
				key={index}
				className={`hand-card ${
					selectedCard &&
					selectedCard.isJoker === card.isJoker &&
					selectedCard.suit === card.suit &&
					selectedCard.rank === card.rank
						? 'selected'
						: ''
				}`}
				draggable={isCardPlayable}
				onDragStart={(e) => {
					if (isCardPlayable) {
						setIsDragging(true);
						setDraggedCard(card);
						e.dataTransfer.effectAllowed = 'move';
					}
				}}
				onDragEnd={() => {
					setIsDragging(false);
					setDraggedCard(null);
				}}
				onClick={() => {
					if (gameState && gameState.state === 'playing') {
						// Toggle selection: if already selected, unselect; otherwise, select this card.
						setSelectedCard(
							selectedCard &&
								selectedCard.isJoker === card.isJoker &&
								selectedCard.suit === card.suit &&
								selectedCard.rank === card.rank
								? null
								: card
						);
					}
				}}
			>
				<div className="card-rank" style={{ color: suitColor }}>
					{rankText}
				</div>
				<div className="card-suit" style={{ color: suitColor }}>
					{suitSymbol}
				</div>
			</div>
		);
	};

	// Render the current trick cards on the table.
	const renderCurrentTrick = (round) => {
		if (!round || !round.currentTrick) return null;
		// Use lastTrick if set (for animation/delay effect), otherwise use the current trick.
		const trickToShow = lastTrick || round.currentTrick;

		const numPlayers = gameState.players.length;
		const currentIndex = gameState.players.findIndex((p) => p.id === playerId);
		const offset = 90 - (360 / numPlayers) * currentIndex;

		return (
			<div className="current-trick-cards">
				{trickToShow.plays.map((play, index) => {
					const player = gameState.players.find((p) => p.id === play.playerId);
					const playerIndex = gameState.players.findIndex(
						(p) => p.id === play.playerId
					);

					// Determine if this card is the winning card.
					const isWinning =
						trickToShow.winnerID &&
						play.playerId === trickToShow.winnerID &&
						trickToShow.plays.length === gameState.players.length;

					// Calculate position based on player's position around the table
					const angle = (360 / numPlayers) * playerIndex + offset;
					const angleRad = (angle * Math.PI) / 180;
					// Position cards closer to center than player names
					const radiusX = 140;
					const radiusY = 100;
					const x = radiusX * Math.cos(angleRad);
					const y = radiusY * Math.sin(angleRad);
					const left = 50 + (x / 400) * 100;
					const top = 50 + (y / 300) * 100;

					return (
						<div
							key={index}
							className={`played-card ${isWinning ? 'winning-card' : ''}`}
							style={{
								position: 'absolute',
								left: `${left}%`,
								top: `${top}%`,
								transform: 'translate(-50%, -50%)',
							}}
						>
							<div className="played-card-content">
								{play.card.isJoker
									? formatCard(play.card)
									: formatCard(play.card)}
							</div>
						</div>
					);
				})}
			</div>
		);
	};

	// Render the main game board.
	const renderGameBoard = () => {
		if (!gameState) return <div>Loading game state...</div>;
		// 'me' represents the local player.
		const me = gameState.players.find((p) => p.id === playerId);
		const round = gameState.currentRound;
		// Sort the player's hand for display.
		const sortedHand = me && me.hand ? sortHand(me.hand) : [];
		return (
			<div className="game-board">
				{/* If the game is finished, display game over summary */}
				{gameState.state === 'finished' && (
					<div className="game-over-summary">
						<h1>GAME OVER</h1>
						<h2>Final Scores</h2>
						<table className="final-score-table">
							<thead>
								<tr>
									<th>Player</th>
									<th>Score</th>
									<th>Missed Bids</th>
								</tr>
							</thead>
							<tbody>
								{[...gameState.players]
									.sort((a, b) => b.score - a.score)
									.map((p) => (
										<tr key={p.id}>
											<td>{p.displayName}</td>
											<td>{p.score}</td>
											<td>{p.missedBids || 0}</td>
										</tr>
									))}
							</tbody>
						</table>
						<button className="play-again-button" onClick={resetGame}>
							Play Again
						</button>
					</div>
				)}
				<div className="top-section">
					{/* Display the current action message (e.g., whose turn it is, or trick win message) */}
					<div className="action-message">
						<p>{gameState.state === 'finished' ? '' : actionMessage}</p>
					</div>
					{/* Display bid status during bidding and playing phases */}
					{(gameState.state === 'bidding' || gameState.state === 'playing') &&
						gameState.currentRound &&
						(() => {
							// Calculate sum of all bids (not count of players who bid)
							let totalBids = 0;
							for (const bid of Object.values(gameState.currentRound.bids)) {
								totalBids += bid;
							}
							const totalCards = gameState.currentRound.totalCards;
							const difference = totalBids - totalCards;
							let statusText;
							let statusColor;

							if (difference > 0) {
								statusText = `${totalBids} bids, ${totalCards} available, ${difference} over`;
								statusColor = '#ff4444';
							} else if (difference < 0) {
								statusText = `${totalBids} bids, ${totalCards} available, ${Math.abs(
									difference
								)} under`;
								statusColor = '#4CAF50';
							} else {
								statusText = `${totalBids} bids, ${totalCards} available, even`;
								statusColor = '#FFA500';
							}

							return (
								<div
									className="bid-status"
									style={{
										fontSize: '16px',
										fontWeight: 'bold',
										color: statusColor,
									}}
								>
									{statusText}
								</div>
							);
						})()}
				</div>
				{/* Table container holds the central oval table with trick cards and players */}
				<div className="table-container">
					<div className="table-oval">
						{round &&
							round.currentTrick &&
							round.currentTrick.plays.length > 0 &&
							renderCurrentTrick(round)}
						{round && (
							<TablePlayers
								players={gameState.players}
								currentRound={round}
								currentPlayerId={playerId}
							/>
						)}
						{/* Drop zone for dragging cards */}
						{isDragging && (
							<div
								className="card-drop-zone"
								onDragOver={(e) => {
									e.preventDefault();
									e.dataTransfer.dropEffect = 'move';
								}}
								onDrop={async (e) => {
									e.preventDefault();
									if (draggedCard && !isCardPlayLocked) {
										// Lock card plays for 1 second
										setIsCardPlayLocked(true);

										await fetch(`${API_URL}/games/play`, {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({
												gameId,
												playerId,
												card: draggedCard,
											}),
										});
										setSelectedCard(null);
										setIsDragging(false);
										setDraggedCard(null);

										// Unlock after 1 second
										setTimeout(() => {
											setIsCardPlayLocked(false);
										}, 1000);
									}
								}}
							>
								<div className="drop-zone-text">PLAY CARD</div>
							</div>
						)}
					</div>
				</div>
				<div className="game-controls">
					{gameState.state === 'lobby' && (
						<div className="lobby-section">
							<button onClick={startGame}>Start Game</button>
							<p>Waiting for players...</p>
						</div>
					)}
				</div>
				{/* Show the vertical BidModal during bidding phase */}
				{gameState && gameState.state === 'bidding' && (
					<BidModal
						onPlaceBid={handlePlaceBid}
						isMyTurn={isMyTurnToBid()}
						hasBid={gameState.currentRound.bids[playerId] !== undefined}
						currentBid={gameState.currentRound.bids[playerId]}
						forbiddenBid={getForbiddenBid()}
					/>
				)}
				{/* When a card is selected in the playing phase, show the Play Card button */}
				{selectedCard && (
					<div className="play-card-section">
						<button
							className="play-card-button"
							onClick={playSelectedCard}
							disabled={
								!(
									gameState.state === 'playing' &&
									(() => {
										if (gameState.currentRound.currentTrick.plays.length > 0) {
											const leadSuit =
												gameState.currentRound.currentTrick.plays[0].card.suit.toLowerCase();
											const hasLeadSuit = me.hand.some(
												(c) =>
													(!c.isJoker && c.suit.toLowerCase() === leadSuit) ||
													(leadSuit === 'spades' && c.isJoker)
											);
											if (hasLeadSuit) {
												if (
													leadSuit === 'spades' &&
													!selectedCard.isJoker &&
													selectedCard.suit.toLowerCase() !== 'spades'
												) {
													return false;
												} else if (
													selectedCard.suit.toLowerCase() !== leadSuit
												) {
													return false;
												}
											}
										}
										return true;
									})()
								)
							}
						>
							Play Card
						</button>
					</div>
				)}
				{me && me.hand && (
					<div className="hand-container">{sortedHand.map(renderHandCard)}</div>
				)}
			</div>
		);
	};

	// Render different views based on the current state: home, join, lobby, or game.
	if (view === 'home') {
		return (
			<div className="App">
				<h1>Up and Down the River</h1>
				<div className="game-setup-form">
					<div className="form-field">
						<label htmlFor="displayName">Your Name:</label>
						<input
							id="displayName"
							type="text"
							placeholder="Enter your name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
					</div>
					<div className="form-field">
						<label htmlFor="maxCards">Max Cards:</label>
						<input
							id="maxCards"
							type="number"
							placeholder="e.g., 10"
							value={creatorMaxCards}
							onChange={(e) => setCreatorMaxCards(parseInt(e.target.value, 10))}
						/>
					</div>
					<div className="form-field">
						<label htmlFor="moneyPerMiss">$ Per Missed Trick:</label>
						<input
							id="moneyPerMiss"
							type="number"
							placeholder="0.00"
							value={moneyPerMiss}
							onChange={(e) => setMoneyPerMiss(parseFloat(e.target.value) || 0)}
							step="0.01"
						/>
						<small
							style={{
								color: '#ccc',
								fontSize: '12px',
								marginTop: '2px',
								display: 'block',
							}}
						>
							Set to 0 to play without stakes
						</small>
					</div>
					<div className="button-group">
						<button onClick={createGame}>Create Game</button>
						<button onClick={joinGame}>Join Game</button>
					</div>
				</div>
			</div>
		);
	} else if (view === 'join') {
		return (
			<div className="App">
				<h1>Join Game</h1>
				<div className="game-setup-form">
					<div className="form-field">
						<label>Game ID:</label>
						<p
							style={{
								color: '#fff',
								fontSize: '18px',
								fontWeight: 'bold',
								margin: '5px 0 15px',
							}}
						>
							{gameId}
						</p>
					</div>
					<div className="form-field">
						<label htmlFor="joinDisplayName">Your Name:</label>
						<input
							id="joinDisplayName"
							type="text"
							placeholder="Enter your name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && displayName && gameId) {
									joinGame();
								}
							}}
						/>
					</div>
					<div className="button-group">
						<button onClick={joinGame}>Join Game</button>
					</div>
				</div>
			</div>
		);
	} else if (view === 'lobby') {
		return (
			<div className="App">
				<h1>Game Lobby</h1>
				<button
					onClick={goHome}
					style={{
						position: 'absolute',
						top: '20px',
						right: '20px',
						padding: '8px 16px',
						backgroundColor: '#666',
						color: '#fff',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '14px',
					}}
				>
					New Game
				</button>
				<div className="lobby-container">
					<div className="share-link-section">
						<p
							style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}
						>
							Share this link with friends:
						</p>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
							}}
						>
							<div className="share-link-box">
								{window.location.origin + '/' + gameId}
							</div>
							<button
								onClick={() =>
									copyToClipboard(window.location.origin + '/' + gameId)
								}
								style={{
									padding: '8px 12px',
									backgroundColor: '#4CAF50',
									color: '#fff',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px',
									whiteSpace: 'nowrap',
								}}
								title="Copy link to clipboard"
							>
								📋 Copy
							</button>
						</div>
					</div>
					<div className="lobby-players-section">
						<h3>Players in Lobby ({gameState?.players.length || 0})</h3>
						<div className="lobby-players-list">
							{gameState &&
								gameState.players.map((p, index) => (
									<div key={p.id} className="lobby-player-item">
										<span className="player-number">{index + 1}</span>
										<span className="player-name">{p.displayName}</span>
									</div>
								))}
						</div>
					</div>
					<div className="button-group">
						{gameState &&
							gameState.players.length > 0 &&
							gameState.players[0].id === playerId && (
								<button onClick={startGame} className="start-game-button">
									Start Game
								</button>
							)}
					</div>
					{gameState &&
					gameState.players.length > 0 &&
					gameState.players[0].id === playerId ? (
						<p className="waiting-message">Click Start Game when ready</p>
					) : (
						<p className="waiting-message">Waiting for host to start game...</p>
					)}
				</div>
			</div>
		);
	} else if (view === 'game') {
		return (
			<div className="App">
				{gameState && gameState.players.length < 5 && (
					<div className="scoreboard-container">
						<Scoreboard gameState={gameState} />
					</div>
				)}
				{gameState && gameState.players.length >= 5 && (
					<>
						<button
							className="scoreboard-toggle-button"
							onClick={() => setScoreboardModalOpen(!scoreboardModalOpen)}
						>
							📊 Scoreboard
						</button>
						{scoreboardModalOpen && (
							<div
								className="scoreboard-modal-overlay"
								onClick={() => setScoreboardModalOpen(false)}
							>
								<div
									className="scoreboard-modal-content"
									onClick={(e) => e.stopPropagation()}
								>
									<button
										className="scoreboard-close-button"
										onClick={() => setScoreboardModalOpen(false)}
									>
										✕
									</button>
									<Scoreboard gameState={gameState} />
								</div>
							</div>
						)}
					</>
				)}
				<div
					className={`main-content ${
						gameState && gameState.players.length >= 5 ? 'full-width' : ''
					}`}
				>
					{renderGameBoard()}
				</div>
			</div>
		);
	}
	return <div>Invalid view</div>;
}

export default App;
