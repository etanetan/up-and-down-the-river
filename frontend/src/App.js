import React, { useState, useEffect } from 'react';
import './App.css';

//const API_URL = 'http://localhost:8080'; // Your backend URL
const API_URL = 'https://upanddownbackend-755936114859.us-central1.run.app'

// Helper function to format a card.
const formatCard = (card) => {
	if (card.isJoker) {
		return (
			<span style={{ color: 'black', fontSize: '24px', fontWeight: 'bold' }}>
				{card.jokerName}
			</span>
		);
	}
	let rankText;
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

// Helper to sort cards by suit then by rank ascending.
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

/* 
  TablePlayers:
  - Computes a rotation offset so that the current player (identified by currentPlayerId)
    appears at the bottom (90°).
  - The radii have been increased so that players’ names appear further from the table.
*/
function TablePlayers({ players, currentRound, currentPlayerId }) {
	const numPlayers = players.length;
	// Determine the index of the current player in the players array.
	const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
	// Compute rotation offset so that current player's angle becomes 90° (bottom).
	const offset = 90 - (360 / numPlayers) * currentIndex;
	// Map each player to an angle.
	const playersWithAngle = players.map((player, i) => {
		const angle = (360 / numPlayers) * i + offset;
		return { ...player, angle };
	});
	return (
		<div className="table-players">
			{playersWithAngle.map((player) => {
				// Convert the angle to radians.
				const angleRad = (player.angle * Math.PI) / 180;
				// Increase radii so players are further from the table.
				const radiusX = 220; // horizontal radius (increased)
				const radiusY = 160; // vertical radius (increased)
				const x = radiusX * Math.cos(angleRad);
				const y = radiusY * Math.sin(angleRad);
				// Convert coordinates to percentages relative to the table oval container.
				const left = 50 + (x / 400) * 100;
				const top = 50 + (y / 300) * 100;
				// If a player has not bid, show "(-)"
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
						<div className="table-player-info">
							<strong>{player.tricksWon || 0}</strong> {player.displayName}{' '}
							<span className="table-player-bid">({bid})</span>
						</div>
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

// Scoreboard component with a simple header.
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

function App() {
	// Views: "home", "join", "lobby", "game"
	// When the game is finished, a game-over overlay appears.
	const [view, setView] = useState('home');
	const [gameId, setGameId] = useState('');
	const [playerId, setPlayerId] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [creatorMaxCards, setCreatorMaxCards] = useState(10);
	const [gameState, setGameState] = useState(null);
	const [bid, setBid] = useState(0);
	const [selectedCard, setSelectedCard] = useState(null);
	const [lastTrick, setLastTrick] = useState(null);
	const [actionMessage, setActionMessage] = useState('');
	const [gameOver, setGameOver] = useState(false);

	useEffect(() => {
		// Get the pathname and remove any leading slash.
		const path = window.location.pathname;
		const gameIdFromUrl = path.length > 1 ? path.substring(1) : null;
		if (gameIdFromUrl) {
			setGameId(gameIdFromUrl);
			setView('join');
		}
	}, []);

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

	const startGame = async () => {
		await fetch(`${API_URL}/games/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId }),
		});
		fetchGameState();
	};

	const placeBid = async () => {
		await fetch(`${API_URL}/games/bid`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, bid: parseInt(bid, 10) }),
		});
		// Clear the bid so the bid selector disappears for you immediately
		setBid(0);
		fetchGameState();
	};

	const playSelectedCard = async () => {
		if (!selectedCard) return;
		await fetch(`${API_URL}/games/play`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, card: selectedCard }),
		});
		setSelectedCard(null);
	};

	const fetchGameState = async () => {
		const response = await fetch(`${API_URL}/games/state?gameId=${gameId}`);
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Error fetching game state:', errorText);
			return;
		}
		const data = await response.json();
		if (data.state === 'finished') {
			setGameState(data);
			setGameOver(true);
		} else {
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
					}, 2000);
				}
			} else {
				setGameState(data);
			}
			if (
				data.state === 'bidding' ||
				data.state === 'playing' ||
				data.state === 'scoring'
			) {
				setView('game');
			}
		}
		updateTurnMessages(data);
	};

	const updateTurnMessages = (data) => {
		if (!data || !data.currentRound) {
			setActionMessage('');
			return;
		}
		if (data.state === 'bidding') {
			const round = data.currentRound;
			const currentBidderId = round.bidOrder[round.currentBidTurn];
			if (currentBidderId === playerId) {
				setActionMessage('YOUR TURN to bid');
			} else {
				// Even when it's not your turn, show the waiting message on every client.
				const currentBidder = data.players.find(
					(p) => p.id === currentBidderId
				);
				if (currentBidder) {
					setActionMessage(`Waiting for ${currentBidder.displayName} to bid`);
				} else {
					setActionMessage('');
				}
			}
		} else if (data.state === 'playing') {
			const round = data.currentRound;
			// Calculate the current player whose turn it is to play a card.
			if (round.currentTrick.plays.length < data.players.length) {
				const currentPlayerIndex =
					(round.trickLeader + round.trickTurnIndex) % data.players.length;
				const currentPlayer = data.players[currentPlayerIndex];
				console.log(
					'Playing phase:',
					'currentPlayer.id =',
					currentPlayer.id,
					'local playerId =',
					playerId
				);
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

	// Reset game state by calling the backend reset endpoint,
	// then resetting local state so it’s as if the game was just created.
	const resetGame = async () => {
		await fetch(`${API_URL}/games/reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId }),
		});
		setTimeout(() => {
			fetchGameState();
		}, 500);
	};

	useEffect(() => {
		const interval = setInterval(() => {
			if (gameId) fetchGameState();
		}, 2000);
		return () => clearInterval(interval);
	}, [gameId]);

	const isMyTurnToBid = () => {
		if (!gameState || !gameState.currentRound) return false;
		const round = gameState.currentRound;
		return round.bidOrder[round.currentBidTurn] === playerId;
	};

	// Render a card from the player's hand (clickable only when game state is 'playing').
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

	const renderCurrentTrick = (round) => {
		if (!round || !round.currentTrick) return null;
		const trickToShow = lastTrick || round.currentTrick;
		return (
			<div className="current-trick-cards">
				{trickToShow.plays.map((play, index) => {
					const player = gameState.players.find((p) => p.id === play.playerId);
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

	const renderGameBoard = () => {
		if (!gameState) return <div>Loading game state...</div>;
		const me = gameState.players.find((p) => p.id === playerId);
		const round = gameState.currentRound;
		const sortedHand = me && me.hand ? sortHand(me.hand) : [];
		return (
			<div className="game-board">
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
					<div className="action-message">
						<p>{gameState.state === 'finished' ? '' : actionMessage}</p>
					</div>
				</div>
				{/* Centered oval table with played cards and players inside */}
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
				{gameState.state === 'bidding' &&
					!gameState.currentRound.bids[playerId] && (
						<div className="bid-selector">
							<h4>Bidding</h4>
							<input
								type="number"
								value={bid}
								onChange={(e) => setBid(e.target.value)}
								placeholder="Your bid"
								disabled={gameState.state !== 'bidding'}
							/>
							<button onClick={placeBid} disabled={!isMyTurnToBid()}>
								Place Bid
							</button>
						</div>
					)}
				{/* Play Card section moved above the hand container */}
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
