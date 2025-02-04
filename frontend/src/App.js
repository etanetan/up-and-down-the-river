import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = 'http://localhost:8080'; // Your backend URL

// Helper function to format a card.
const formatCard = (card) => {
	if (card.isJoker) {
		// Render joker with same style as other cards.
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

// Helper to sort cards by suit (order: diamonds, clubs, hearts, spades) then by rank ascending.
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

// Scoreboard component.
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
					{/* Pending round row: shows bids (in parentheses) if current round is in progress */}
					{gameState.currentRound && (
						<tr className="pending-round">
							<td>{gameState.currentRound.totalCards}</td>
							{gameState.players.map((player) => {
								const bid = gameState.currentRound.bids[player.id];
								return (
									<td key={player.id}>
										{bid !== undefined ? `(${bid})` : '-'}
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
	const [view, setView] = useState('home');
	const [gameId, setGameId] = useState('');
	const [playerId, setPlayerId] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [creatorMaxCards, setCreatorMaxCards] = useState(10);
	const [gameState, setGameState] = useState(null);
	const [bid, setBid] = useState(0);
	const [selectedCard, setSelectedCard] = useState(null);
	// New state to hold the trick once complete so it remains visible.
	const [lastTrick, setLastTrick] = useState(null);
	const [actionMessage, setActionMessage] = useState('');

	// On mount, check for gameId in URL.
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const gameIdFromUrl = urlParams.get('gameId');
		if (gameIdFromUrl) {
			setGameId(gameIdFromUrl);
			setView('join');
		}
	}, []);

	// Create a new game.
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
		// When a trick is complete, hold the display for 2 seconds before fetching new state.
		setTimeout(() => {
			fetchGameState();
		}, 2000);
	};

	// Modified fetchGameState: if current trick is complete, hold it in lastTrick.
	const fetchGameState = async () => {
		const response = await fetch(`${API_URL}/games/state?gameId=${gameId}`);
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Error fetching game state:', errorText);
			return;
		}
		const data = await response.json();

		// If there is a current round and the trick is complete, hold it.
		if (
			data.currentRound &&
			data.currentRound.currentTrick &&
			data.currentRound.currentTrick.plays.length === data.players.length &&
			data.currentRound.currentTrick.winnerID
		) {
			// If we haven't already stored it, store it.
			if (!lastTrick) {
				setLastTrick(data.currentRound.currentTrick);
				// Delay updating game state for 2 seconds.
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
			data.state === 'scoring' ||
			data.state === 'finished'
		) {
			setView('game');
		}
		updateTurnMessages(data);
	};

	// Update turn messages based on game state.
	const updateTurnMessages = (data) => {
		if (!data || !data.currentRound) {
			setActionMessage('');
			return;
		}
		if (data.state === 'bidding') {
			const round = data.currentRound;
			const currentBidderId = round.bidOrder[round.currentBidTurn];
			const currentBidder = data.players.find((p) => p.id === currentBidderId);
			if (currentBidderId === playerId) {
				setActionMessage('YOUR TURN to bid');
			} else {
				setActionMessage(`Waiting for ${currentBidder.displayName} to bid`);
			}
		} else if (data.state === 'playing') {
			const round = data.currentRound;
			// If trick complete, show winning message.
			if (
				round.currentTrick.plays.length === data.players.length &&
				round.currentTrick.winnerID
			) {
				const winner = data.players.find(
					(p) => p.id === round.currentTrick.winnerID
				);
				setActionMessage(`${winner.displayName} won the trick!`);
			} else {
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
			}
		}
	};

	useEffect(() => {
		const interval = setInterval(() => {
			if (gameId) fetchGameState();
		}, 2000);
		return () => clearInterval(interval);
	}, [gameId]);

	// Helper to check if it's my turn to bid.
	const isMyTurnToBid = () => {
		if (!gameState || !gameState.currentRound) return false;
		const round = gameState.currentRound;
		return round.bidOrder[round.currentBidTurn] === playerId;
	};

	// Render a card from the player's hand.
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
				onClick={() =>
					setSelectedCard(
						selectedCard &&
							selectedCard.isJoker === card.isJoker &&
							selectedCard.suit === card.suit &&
							selectedCard.rank === card.rank
							? null
							: card
					)
				}
			>
				<div className="card-content">
					{card.isJoker ? formatCard(card) : formatCard(card)}
				</div>
			</div>
		);
	};

	// Render the played cards for the current trick.
	// If lastTrick is held, use that instead.
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

	// Render the main game board.
	const renderGameBoard = () => {
		if (!gameState) return <div>Loading game state...</div>;
		const me = gameState.players.find((p) => p.id === playerId);
		const round = gameState.currentRound;
		const dealer = round ? gameState.players[round.dealerIndex] : null;
		const sortedHand = me && me.hand ? sortHand(me.hand) : [];
		return (
			<div className="game-board">
				<div className="top-section">
					{dealer && (
						<div className="dealer-info">
							<strong>Dealer: {dealer.displayName}</strong>
						</div>
					)}
					<div className="players-info">
						{gameState.players.map((p) => (
							<div key={p.id} className="player-info">
								<strong>{p.displayName}</strong> – Tricks Won: {p.tricksWon}
							</div>
						))}
					</div>
					<div className="current-trick">
						<h4>Cards played this round:</h4>
						{round &&
						round.currentTrick &&
						round.currentTrick.plays.length > 0 ? (
							renderCurrentTrick(round)
						) : (
							<p>No cards played yet this round.</p>
						)}
					</div>
					<div className="action-message">
						<p>{actionMessage}</p>
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
				{gameState.state === 'bidding' && (
					<div className="bid-selector">
						<h4>Bidding</h4>
						<input
							type="number"
							value={bid}
							onChange={(e) => setBid(e.target.value)}
							placeholder="Your bid"
							disabled={!isMyTurnToBid()}
						/>
						<button onClick={placeBid} disabled={!isMyTurnToBid()}>
							Place Bid
						</button>
					</div>
				)}
				{me && me.hand && (
					<div className="hand-container">{sortedHand.map(renderHandCard)}</div>
				)}
				{selectedCard && (
					<div className="play-card-section">
						<button
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
												if (leadSuit === 'spades') {
													if (
														!selectedCard.isJoker &&
														selectedCard.suit.toLowerCase() !== 'spades'
													) {
														return false;
													}
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
							PLAY SELECTED CARD
						</button>
					</div>
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
					{window.location.origin + '/?gameId=' + gameId}
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
