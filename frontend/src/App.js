import React, { useState, useEffect } from 'react';
import BidModal from './BidModal'; // Import the vertical bidding modal component
import './App.css';

// Set the backend API URL. When running locally you might use localhost,
// but here we're using the Cloud Run URL.
const API_URL = 'https://upanddownbackend-755936114859.us-central1.run.app';

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
							<span className="table-player-bid">
								({player.tricksWon || 0}/{bid})
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
	const [gameState, setGameState] = useState(null);
	const [selectedCard, setSelectedCard] = useState(null);
	const [lastTrick, setLastTrick] = useState(null);
	const [actionMessage, setActionMessage] = useState('');
	const [gameOver, setGameOver] = useState(false);

	// On component mount, check if there's a gameId in the URL.
	// If so, set the gameId and move to the join view.
	useEffect(() => {
		const path = window.location.pathname;
		const gameIdFromUrl = path.length > 1 ? path.substring(1) : null;
		if (gameIdFromUrl) {
			setGameId(gameIdFromUrl);
			setView('join');
		}
	}, []);

	// Helper to compare two card objects
	const cardMatches = (a, b) => {
		return (
			a &&
			b &&
			a.isJoker === b.isJoker &&
			a.suit === b.suit &&
			a.rank === b.rank
		);
	};

	useEffect(() => {
		const handleKeyDown = (e) => {
			// Enable keyboard shortcuts only during the game and playing phase
			if (view !== 'game' || !gameState || gameState.state !== 'playing')
				return;

			// Get the current player's hand and sort it
			const me = gameState.players.find((p) => p.id === playerId);
			if (!me || !me.hand || me.hand.length === 0) return;
			const sortedHand = sortHand(me.hand);

			// If a number key is pressed, select that card (1-indexed)
			if (e.key >= '1' && e.key <= String(sortedHand.length)) {
				const index = parseInt(e.key, 10) - 1;
				setSelectedCard(sortedHand[index]);
			}
			// Use the right arrow to move selection to the next card;
			// if no card is selected, select the first card.
			else if (e.key === 'ArrowRight') {
				if (!selectedCard) {
					setSelectedCard(sortedHand[0]);
				} else {
					const currentIndex = sortedHand.findIndex((card) =>
						cardMatches(card, selectedCard)
					);
					const newIndex = (currentIndex + 1) % sortedHand.length;
					setSelectedCard(sortedHand[newIndex]);
				}
			}
			// Use the left arrow to move selection to the previous card.
			else if (e.key === 'ArrowLeft') {
				if (!selectedCard) {
					setSelectedCard(sortedHand[sortedHand.length - 1]);
				} else {
					const currentIndex = sortedHand.findIndex((card) =>
						cardMatches(card, selectedCard)
					);
					const newIndex =
						(currentIndex - 1 + sortedHand.length) % sortedHand.length;
					setSelectedCard(sortedHand[newIndex]);
				}
			}
			// If Enter is pressed while a card is selected, play the card.
			else if (e.key === 'Enter') {
				if (selectedCard) {
					playSelectedCard();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [view, gameState, playerId, selectedCard]);

	// Create a new game by calling the backend.
	const createGame = async () => {
		const response = await fetch(`${API_URL}/games/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ displayName, creatorMaxCards }),
		});
		const data = await response.json();
		setGameId(data.gameId);
		setPlayerId(data.playerId);
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
		if (!selectedCard) return;
		await fetch(`${API_URL}/games/play`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, card: selectedCard }),
		});
		setSelectedCard(null);
	};

	// Fetch the current game state from the backend.
	const fetchGameState = async () => {
		const response = await fetch(`${API_URL}/games/state?gameId=${gameId}`);
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

	// Render a card from the player's hand. The card is clickable when it's the playing phase.
	const renderHandCard = (card, index) => {
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
				<div className="card-content">
					{card.isJoker ? formatCard(card) : formatCard(card)}
				</div>
			</div>
		);
	};

	// Render the current trick cards on the table.
	const renderCurrentTrick = (round) => {
		if (!round || !round.currentTrick) return null;
		// Use lastTrick if set (for animation/delay effect), otherwise use the current trick.
		const trickToShow = lastTrick || round.currentTrick;
		return (
			<div className="current-trick-cards">
				{trickToShow.plays.map((play, index) => {
					const player = gameState.players.find((p) => p.id === play.playerId);
					// Determine if this card is the winning card.
					const isWinning =
						trickToShow.winnerID &&
						play.playerId === trickToShow.winnerID &&
						trickToShow.plays.length === gameState.players.length;
					return (
						<div
							key={index}
							className={`played-card ${isWinning ? 'winning-card' : ''}`}
						>
							<div className="played-card-player">
								{player ? player.displayName : play.playerId}
							</div>
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
				{/* Show the vertical BidModal during bidding phase if the current player hasn't bid yet */}
				{gameState &&
					gameState.state === 'bidding' &&
					!gameState.currentRound.bids[playerId] && (
						<BidModal
							onPlaceBid={handlePlaceBid}
							isMyTurn={isMyTurnToBid()}
							maxBid={gameState.currentRound.totalCards}
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
				<input
					type="text"
					placeholder="Display Name"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>
				<input
					type="number"
					placeholder="Max Cards (e.g., 10)"
					value={creatorMaxCards}
					onChange={(e) => setCreatorMaxCards(parseInt(e.target.value, 10))}
				/>
				<div className="button-group">
					<button onClick={createGame}>Create Game</button>
					<button onClick={joinGame}>Join Game</button>
				</div>
			</div>
		);
	} else if (view === 'join') {
		return (
			<div className="App">
				<h1>Join Game</h1>
				<p>Game ID: {gameId}</p>
				<input
					type="text"
					placeholder="Display Name"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>
				<button onClick={joinGame}>Join Game</button>
			</div>
		);
	} else if (view === 'lobby') {
		return (
			<div className="App">
				<h1>Lobby</h1>
				<p>
					Share this link with friends:
					<br />
					{window.location.origin + '/' + gameId}
				</p>
				<div className="lobby-players">
					<h4>Players in Lobby:</h4>
					{gameState &&
						gameState.players.map((p) => <div key={p.id}>{p.displayName}</div>)}
				</div>
				<button onClick={startGame}>Start Game</button>
				<p>Waiting for game to start...</p>
			</div>
		);
	} else if (view === 'game') {
		return (
			<div className="App">
				<div className="scoreboard-container">
					<Scoreboard gameState={gameState} />
				</div>
				<div className="main-content">{renderGameBoard()}</div>
			</div>
		);
	}
	return <div>Invalid view</div>;
}

export default App;
