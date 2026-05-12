import React, { useState, useEffect, useRef, useCallback } from 'react';
import BidModal from './BidModal'; // Import the vertical bidding modal component
import './App.css';

// Set the backend API URL. When running locally you might use localhost,
// but here we're using the Cloud Run URL.
//const API_URL = 'https://upanddownbackend-755936114859.us-central1.run.app';
const API_URL = 'http://localhost:8080';

// Pure helper used by both the final-game scoreboard and the in-game tracker.
const moneyLostForPlayer = (gameState, playerId) => {
	if (!gameState || !gameState.moneyPerMiss) return 0;
	let total = 0;
	(gameState.roundResults || []).forEach((round) => {
		const result = round.results.find((r) => r.playerId === playerId);
		if (result) {
			total += Math.abs(result.tricksWon - result.bid) * gameState.moneyPerMiss;
		}
	});
	return total;
};
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
	// actionMessage: a message for the UI (e.g., whose turn it is or who won the trick)
	const [view, setView] = useState('home');
	const [gameId, setGameId] = useState('');
	const [playerId, setPlayerId] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [creatorMaxCards, setCreatorMaxCards] = useState(10);
	const [moneyPerMiss, setMoneyPerMiss] = useState(0);
	const [gameState, setGameState] = useState(null);
	const [selectedCard, setSelectedCard] = useState(null);
	const [actionMessage, setActionMessage] = useState('');
	const [isDragging, setIsDragging] = useState(false);
	const [draggedCard, setDraggedCard] = useState(null);
	const [isCardPlayLocked, setIsCardPlayLocked] = useState(false);
	const [scoreboardModalOpen, setScoreboardModalOpen] = useState(false);
	const [pendingPlay, setPendingPlay] = useState(null);
	const [canShare] = useState(
		() => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);
	const [shareToast, setShareToast] = useState('');
	const shareToastTimer = useRef(null);
	const [isMobile, setIsMobile] = useState(false);
	const [homeTab, setHomeTab] = useState('create');
	const [joinCodeInput, setJoinCodeInput] = useState('');

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(max-width: 768px)');
		const handler = (e) => setIsMobile(e.matches);
		setIsMobile(mq.matches);
		if (mq.addEventListener) {
			mq.addEventListener('change', handler);
			return () => mq.removeEventListener('change', handler);
		}
		mq.addListener(handler);
		return () => mq.removeListener(handler);
	}, []);

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
		// eslint-disable-next-line react-hooks/exhaustive-deps
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

	// Optimistically render the card on the table the instant the click /
	// drop registers; the SSE push will confirm, and the effect below will
	// clear pendingPlay once the server state catches up. If the server
	// rejects the play, we revert by refetching state.
	const playCard = async (card) => {
		if (!card || isCardPlayLocked) return;
		setIsCardPlayLocked(true);
		setPendingPlay({ playerId, card });
		setSelectedCard(null);
		try {
			const resp = await fetch(`${API_URL}/games/play`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameId, playerId, card }),
			});
			if (!resp.ok) {
				setPendingPlay(null);
				fetchGameState();
			}
		} catch (err) {
			setPendingPlay(null);
			fetchGameState();
		}
		setTimeout(() => {
			setIsCardPlayLocked(false);
		}, 1000);
	};

	const playSelectedCard = () => playCard(selectedCard);

	// Clear pendingPlay once the server-confirmed state contains our card.
	useEffect(() => {
		if (!pendingPlay || !gameState?.currentRound?.currentTrick) return;
		const cardsEqual = (a, b) => {
			if (a.isJoker !== b.isJoker) return false;
			if (a.isJoker) return a.jokerName === b.jokerName;
			return (
				a.suit?.toLowerCase() === b.suit?.toLowerCase() && a.rank === b.rank
			);
		};
		const seen = gameState.currentRound.currentTrick.plays?.some(
			(p) => p.playerId === pendingPlay.playerId && cardsEqual(p.card, pendingPlay.card)
		);
		// Also clear if the trick has been reset (next trick begun) — server moved on.
		if (seen || gameState.currentRound.currentTrick.plays?.length === 0) {
			setPendingPlay(null);
		}
	}, [gameState, pendingPlay]);

	// Apply a freshly received game state to local state. Shared between the
	// SSE stream, REST polling fallback, and the initial fetch on URL restore.
	const applyGameState = useCallback(
		(data) => {
			if (!data) return;
			setGameState(data);
			if (
				data.state === 'bidding' ||
				data.state === 'playing' ||
				data.state === 'scoring'
			) {
				setView('game');
			}
			updateTurnMessages(data);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[playerId]
	);

	// One-shot REST fetch (used on initial URL restore and as a polling fallback
	// when SSE is unavailable).
	const fetchGameState = async (gameIdToFetch = gameId) => {
		if (!gameIdToFetch) return;
		try {
			const response = await fetch(
				`${API_URL}/games/state?gameId=${gameIdToFetch}`
			);
			if (!response.ok) {
				const errorText = await response.text();
				console.error('Error fetching game state:', errorText);
				return;
			}
			const data = await response.json();
			applyGameState(data);
		} catch (err) {
			console.error('Error fetching game state:', err);
		}
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

	// Show a transient toast (used for share/copy confirmations).
	const flashToast = (message) => {
		setShareToast(message);
		if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
		shareToastTimer.current = setTimeout(() => setShareToast(''), 1800);
	};

	// copyToClipboard: copies text and flashes a toast.
	const copyToClipboard = async (text) => {
		try {
			await navigator.clipboard.writeText(text);
			flashToast('Link copied');
		} catch (err) {
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			document.body.appendChild(textArea);
			textArea.select();
			let ok = false;
			try {
				ok = document.execCommand('copy');
			} catch (e) {
				/* ignore */
			}
			document.body.removeChild(textArea);
			flashToast(ok ? 'Link copied' : 'Copy failed');
		}
	};

	// shareLink: opens the native share sheet when supported, otherwise copies.
	const shareLink = async (url) => {
		if (canShare) {
			try {
				await navigator.share({
					title: 'Up and Down the River',
					text: 'Join my game',
					url,
				});
				return;
			} catch (err) {
				// user cancelled or share failed; fall through to copy
			}
		}
		copyToClipboard(url);
	};

	// Stream game-state updates from the backend via Server-Sent Events. The
	// backend pushes a new snapshot on every mutation, so this replaces the
	// previous 2-second polling loop. On error we retry with exponential
	// backoff and fall back to REST polling so the game still works if the
	// stream is blocked.
	useEffect(() => {
		if (!gameId) return;
		let es = null;
		let pollTimer = null;
		let retryTimer = null;
		let retries = 0;
		let stopped = false;

		const startPolling = () => {
			if (pollTimer) return;
			pollTimer = setInterval(() => {
				if (!stopped) fetchGameState(gameId);
			}, 2000);
		};
		const stopPolling = () => {
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		};
		const connect = () => {
			if (stopped) return;
			try {
				es = new EventSource(`${API_URL}/games/events?gameId=${gameId}`);
			} catch (err) {
				console.error('SSE construction failed:', err);
				startPolling();
				return;
			}
			es.onopen = () => {
				retries = 0;
				stopPolling();
			};
			es.onmessage = (e) => {
				try {
					const data = JSON.parse(e.data);
					applyGameState(data);
				} catch (err) {
					console.error('SSE parse error:', err);
				}
			};
			es.onerror = () => {
				if (es) {
					es.close();
					es = null;
				}
				if (stopped) return;
				retries += 1;
				// After repeated failures, fall back to polling so play continues
				if (retries >= 3) startPolling();
				const delay = Math.min(1000 * 2 ** Math.min(retries, 5), 15000);
				retryTimer = setTimeout(connect, delay);
			};
		};

		connect();
		return () => {
			stopped = true;
			if (es) es.close();
			if (retryTimer) clearTimeout(retryTimer);
			stopPolling();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
		// Overlay the optimistic pending play if the server hasn't confirmed it yet.
		let plays = round.currentTrick.plays || [];
		if (pendingPlay) {
			const alreadyIn = plays.some(
				(p) =>
					p.playerId === pendingPlay.playerId &&
					p.card?.isJoker === pendingPlay.card.isJoker &&
					(pendingPlay.card.isJoker
						? p.card?.jokerName === pendingPlay.card.jokerName
						: p.card?.rank === pendingPlay.card.rank &&
						  p.card?.suit?.toLowerCase() ===
								pendingPlay.card.suit?.toLowerCase())
			);
			if (!alreadyIn) {
				plays = [
					...plays,
					{ playerId: pendingPlay.playerId, card: pendingPlay.card },
				];
			}
		}
		const trickToShow = { ...round.currentTrick, plays };

		const numPlayers = gameState.players.length;
		const currentIndex = gameState.players.findIndex((p) => p.id === playerId);
		const offset = 90 - (360 / numPlayers) * currentIndex;

		return (
			<div className="current-trick-cards">
				{trickToShow.plays.map((play, index) => {
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
		// Hide the optimistically played card from the local hand until the
		// server-confirmed state arrives.
		const optimisticHand =
			me && me.hand
				? pendingPlay
					? me.hand.filter(
							(c) =>
								!(
									c.isJoker === pendingPlay.card.isJoker &&
									(pendingPlay.card.isJoker
										? c.jokerName === pendingPlay.card.jokerName
										: c.rank === pendingPlay.card.rank &&
										  c.suit?.toLowerCase() ===
												pendingPlay.card.suit?.toLowerCase())
								)
					  )
					: me.hand
				: [];
		const sortedHand = sortHand(optimisticHand);
		return (
			<div className="game-board">
				{/* If the game is finished, display game over summary */}
				{gameState.state === 'finished' && (() => {
					const winnerScore = Math.max(
						...gameState.players.map((p) => p.score)
					);
					const showMoney = (gameState.moneyPerMiss || 0) > 0;
					return (
						<div className="game-over-summary">
							<h1>GAME OVER</h1>
							<h2>Final Scores</h2>
							<table className="final-score-table">
								<thead>
									<tr>
										<th>Player</th>
										<th>Score</th>
										<th>Missed Bids</th>
										{showMoney && <th>$ Lost</th>}
									</tr>
								</thead>
								<tbody>
									{[...gameState.players]
										.sort((a, b) => b.score - a.score)
										.map((p) => {
											const isWinner = p.score === winnerScore;
											return (
												<tr key={p.id}>
													<td>{p.displayName}</td>
													<td>{p.score}</td>
													<td>{p.missedBids || 0}</td>
													{showMoney && (
														<td style={{ color: isWinner ? '#fff' : '#ff6b6b' }}>
															{isWinner
																? ''
																: `$${moneyLostForPlayer(gameState, p.id).toFixed(2)}`}
														</td>
													)}
												</tr>
											);
										})}
								</tbody>
							</table>
							<button className="play-again-button" onClick={resetGame}>
								Play Again
							</button>
						</div>
					);
				})()}
				<div className="top-section">
					{/* Action message ("YOUR TURN to bid", "Alice won the trick!", etc.).
					    Always mounted so the layout doesn't jump when the text appears/disappears. */}
					<div className="action-message">
						<span>
							{gameState.state === 'finished'
								? ''
								: actionMessage || ' '}
						</span>
					</div>
					{/* Bid-status strip with over/under/even tint. Same height during all
					    phases — invisible placeholder outside bidding/playing so the layout
					    is stable. */}
					{(() => {
						const inRound =
							(gameState.state === 'bidding' ||
								gameState.state === 'playing') &&
							gameState.currentRound;
						let totalBids = 0;
						if (inRound) {
							for (const bid of Object.values(
								gameState.currentRound.bids
							)) {
								totalBids += bid;
							}
						}
						const totalCards = inRound
							? gameState.currentRound.totalCards
							: 0;
						const difference = totalBids - totalCards;
						let statusText = '';
						let statusTint = '';
						if (inRound) {
							if (difference > 0) {
								statusText = `${totalBids} bids, ${totalCards} available, ${difference} over`;
								statusTint = 'over';
							} else if (difference < 0) {
								statusText = `${totalBids} bids, ${totalCards} available, ${Math.abs(
									difference
								)} under`;
								statusTint = 'under';
							} else {
								statusText = `${totalBids} bids, ${totalCards} available, even`;
								statusTint = 'even';
							}
						}
						return (
							<div
								className={`bid-status ${statusTint}${
									!inRound ? ' bid-status-empty' : ''
								}`}
								aria-hidden={!inRound}
							>
								{statusText || ' '}
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
								onDrop={(e) => {
									e.preventDefault();
									if (draggedCard && !isCardPlayLocked) {
										const card = draggedCard;
										setIsDragging(false);
										setDraggedCard(null);
										playCard(card);
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
		const codeNormalized = joinCodeInput.trim().toUpperCase();
		const canJoinByCode = displayName.trim() && codeNormalized.length >= 4;
		return (
			<div className="App home-view">
				<div className="card-shell">
					<h1 className="brand-title">Up and Down the River</h1>
					<p className="brand-subtitle">Bid. Play. Win the trick.</p>
					<div className="tab-toggle" role="tablist">
						<button
							role="tab"
							aria-selected={homeTab === 'create'}
							className={`tab-button ${homeTab === 'create' ? 'active' : ''}`}
							onClick={() => setHomeTab('create')}
						>
							Create
						</button>
						<button
							role="tab"
							aria-selected={homeTab === 'join'}
							className={`tab-button ${homeTab === 'join' ? 'active' : ''}`}
							onClick={() => setHomeTab('join')}
						>
							Join
						</button>
					</div>
					<div className="form-stack">
						<div className="form-field">
							<label htmlFor="displayName">Your name</label>
							<input
								id="displayName"
								type="text"
								placeholder="e.g. Alex"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								autoComplete="off"
							/>
						</div>
						{homeTab === 'create' ? (
							<>
								<div className="form-field">
									<label htmlFor="maxCards">Max cards per round</label>
									<input
										id="maxCards"
										type="number"
										inputMode="numeric"
										placeholder="10"
										value={creatorMaxCards}
										onChange={(e) =>
											setCreatorMaxCards(parseInt(e.target.value, 10) || 0)
										}
									/>
								</div>
								<div className="form-field">
									<label htmlFor="moneyPerMiss">$ per missed trick</label>
									<input
										id="moneyPerMiss"
										type="number"
										inputMode="decimal"
										placeholder="0.00"
										value={moneyPerMiss}
										onChange={(e) =>
											setMoneyPerMiss(parseFloat(e.target.value) || 0)
										}
										step="0.01"
									/>
									<small className="field-hint">
										Set to 0 to play without stakes
									</small>
								</div>
								<button
									className="primary-button"
									onClick={createGame}
									disabled={!displayName.trim()}
								>
									Create Game
								</button>
							</>
						) : (
							<>
								<div className="form-field">
									<label htmlFor="joinCode">Game code</label>
									<input
										id="joinCode"
										type="text"
										inputMode="text"
										placeholder="ABC123"
										value={joinCodeInput}
										onChange={(e) =>
											setJoinCodeInput(e.target.value.toUpperCase())
										}
										maxLength={8}
										autoCapitalize="characters"
										autoComplete="off"
										onKeyDown={(e) => {
											if (e.key === 'Enter' && canJoinByCode) {
												setGameId(codeNormalized);
												setView('join');
											}
										}}
									/>
								</div>
								<button
									className="primary-button"
									onClick={() => {
										setGameId(codeNormalized);
										setView('join');
									}}
									disabled={!canJoinByCode}
								>
									Continue
								</button>
							</>
						)}
					</div>
				</div>
				{shareToast && <div className="toast">{shareToast}</div>}
			</div>
		);
	} else if (view === 'join') {
		return (
			<div className="App join-view">
				<div className="card-shell">
					<h1 className="brand-title">Join Game</h1>
					<p className="join-code-display">{gameId}</p>
					<div className="form-stack">
						<div className="form-field">
							<label htmlFor="joinDisplayName">Your name</label>
							<input
								id="joinDisplayName"
								type="text"
								placeholder="e.g. Alex"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && displayName && gameId) {
										joinGame();
									}
								}}
								autoComplete="off"
							/>
						</div>
						<button
							className="primary-button"
							onClick={joinGame}
							disabled={!displayName.trim()}
						>
							Join Game
						</button>
						<button className="link-button" onClick={goHome}>
							← Back
						</button>
					</div>
				</div>
				{shareToast && <div className="toast">{shareToast}</div>}
			</div>
		);
	} else if (view === 'lobby') {
		const shareUrl = window.location.origin + '/' + gameId;
		const isHost =
			gameState && gameState.players.length > 0 && gameState.players[0].id === playerId;
		return (
			<div className="App lobby-view">
				<button className="top-right-button" onClick={goHome}>
					New Game
				</button>
				<div className="card-shell lobby-shell">
					<h1 className="brand-title">Game Lobby</h1>
					<div className="game-code-row">
						<span className="game-code-label">Code</span>
						<span className="game-code-value">{gameId}</span>
					</div>
					<div className="share-link-section">
						<div className="share-link-row">
							<div className="share-link-box" title="Share this link with friends">
								{shareUrl}
							</div>
							<div className="share-link-buttons">
								<button
									className="share-button copy"
									onClick={() => copyToClipboard(shareUrl)}
									title="Copy link"
									aria-label="Copy link"
								>
									Copy
								</button>
								{canShare && (
									<button
										className="share-button share"
										onClick={() => shareLink(shareUrl)}
										title="Share link"
										aria-label="Share link"
									>
										Share
									</button>
								)}
							</div>
						</div>
					</div>
					<div className="lobby-players-section">
						<h3>Players ({gameState?.players.length || 0})</h3>
						<div className="lobby-players-list">
							{gameState &&
								gameState.players.map((p, index) => (
									<div key={p.id} className="lobby-player-item">
										<span className="player-number">{index + 1}</span>
										<span className="player-name">
											{p.displayName}
											{p.id === playerId && (
												<span className="you-tag"> (you)</span>
											)}
										</span>
									</div>
								))}
						</div>
					</div>
					{isHost ? (
						<button
							onClick={startGame}
							className="primary-button start-game-button"
							disabled={!gameState || gameState.players.length < 2}
						>
							Start Game
						</button>
					) : (
						<p className="waiting-message">Waiting for host to start the game…</p>
					)}
				</div>
				{shareToast && <div className="toast">{shareToast}</div>}
			</div>
		);
	} else if (view === 'game') {
		const numPlayers = gameState ? gameState.players.length : 0;
		const useModalScoreboard = numPlayers >= 5 || isMobile;
		const myMoneyLost =
			gameState && (gameState.moneyPerMiss || 0) > 0
				? moneyLostForPlayer(gameState, playerId)
				: 0;
		const showMoneyTracker =
			gameState &&
			(gameState.moneyPerMiss || 0) > 0 &&
			gameState.state !== 'finished';
		return (
			<div className="App">
				{gameState && !useModalScoreboard && (
					<div className="scoreboard-container">
						<Scoreboard gameState={gameState} />
					</div>
				)}
				{gameState && useModalScoreboard && (
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
				{showMoneyTracker && (
					<div
						className="money-tracker"
						title="Money lost this game"
					>
						<span className="money-tracker-label">$ Lost</span>
						<span className="money-tracker-value">
							${myMoneyLost.toFixed(2)}
						</span>
					</div>
				)}
				<div
					className={`main-content ${
						useModalScoreboard ? 'full-width' : ''
					}`}
				>
					{renderGameBoard()}
				</div>
				{shareToast && <div className="toast">{shareToast}</div>}
			</div>
		);
	}
	return <div>Invalid view</div>;
}

export default App;
