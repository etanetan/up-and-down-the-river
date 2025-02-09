import React, { useState, useEffect } from 'react';
import BidModal from './BidModal'; // Import the vertical bidding modal component
import './App.css';

const API_URL = 'https://upanddownbackend-755936114859.us-central1.run.app';

// ---------------------------
// Helper Functions
// ---------------------------

const normalizeId = (id) => (id || '').trim().toLowerCase();

const formatCard = (card) => {
	if (card.rank > 14) {
		// Joker: rank 16 is Joker 1, rank 15 is Joker 2.
		const jokerName = card.rank === 16 ? 'J1' : 'J2';
		return (
			<span style={{ color: 'black', fontSize: '24px', fontWeight: 'bold' }}>
				{jokerName}
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
// Custom Hook: useWindowWidth
// ---------------------------
function useWindowWidth() {
	const [width, setWidth] = useState(window.innerWidth);
	useEffect(() => {
		const handleResize = () => setWidth(window.innerWidth);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);
	return width;
}

// ---------------------------
// Components
// ---------------------------

function TablePlayers({ players, currentRound, currentPlayerId }) {
	const numPlayers = players.length;
	const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
	const offset = 90 - (360 / numPlayers) * currentIndex;
	const playersWithAngle = players.map((player, i) => {
		const angle = (360 / numPlayers) * i + offset;
		return { ...player, angle };
	});
	return (
		<div className="table-players">
			{playersWithAngle.map((player) => {
				const angleRad = (player.angle * Math.PI) / 180;
				const radiusX = 220;
				const radiusY = 160;
				const x = radiusX * Math.cos(angleRad);
				const y = radiusY * Math.sin(angleRad);
				const left = 50 + (x / 400) * 100;
				const top = 50 + (y / 300) * 100;
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
							{player.displayName}{' '}
							<span className="table-player-bid">
								({player.tricksWon || 0}/{bid})
							</span>
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

// ---------------------------
// Main App Component
// ---------------------------
function App() {
	const [view, setView] = useState('home');
	const [gameId, setGameId] = useState('');
	const [playerId, setPlayerId] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [creatorMaxCards, setCreatorMaxCards] = useState(10);
	const [gameState, setGameState] = useState(null);
	const [selectedCard, setSelectedCard] = useState(null);
	const [lastTrick, setLastTrick] = useState(null);
	const [gameOver, setGameOver] = useState(false);
	const [showMobileScoreboard, setShowMobileScoreboard] = useState(false);

	// Use the custom hook once
	const windowWidth = useWindowWidth();

	useEffect(() => {
		const path = window.location.pathname;
		const gameIdFromUrl = path.length > 1 ? path.substring(1) : null;
		if (gameIdFromUrl) {
			setGameId(gameIdFromUrl);
			setView('join');
		}
	}, []);

	const cardMatches = (a, b) => {
		return a && b && a.suit === b.suit && a.rank === b.rank;
	};

	const isMyTurnToBid = () => {
		if (!gameState || !gameState.currentRound) return false;
		const round = gameState.currentRound;
		return (
			normalizeId(round.bidOrder[round.currentBidTurn]) ===
			normalizeId(playerId)
		);
	};

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (view !== 'game' || !gameState || gameState.state !== 'playing')
				return;
			const me = gameState.players.find(
				(p) => normalizeId(p.id) === normalizeId(playerId)
			);
			if (!me || !me.hand || me.hand.length === 0) return;
			const sortedHand = sortHand(me.hand);
			if (e.key >= '1' && e.key <= String(sortedHand.length)) {
				const index = parseInt(e.key, 10) - 1;
				setSelectedCard(sortedHand[index]);
			} else if (e.key === 'ArrowRight') {
				if (!selectedCard) {
					setSelectedCard(sortedHand[0]);
				} else {
					const currentIndex = sortedHand.findIndex((card) =>
						cardMatches(card, selectedCard)
					);
					const newIndex = (currentIndex + 1) % sortedHand.length;
					setSelectedCard(sortedHand[newIndex]);
				}
			} else if (e.key === 'ArrowLeft') {
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
			} else if (e.key === 'Enter') {
				if (selectedCard) {
					playSelectedCard();
				}
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [view, gameState, playerId, selectedCard]);

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

	const handlePlaceBid = async (bidValue) => {
		await fetch(`${API_URL}/games/bid`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId, playerId, bid: parseInt(bidValue, 10) }),
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
		} else {
			if (
				data.currentRound &&
				data.currentRound.currentTrick &&
				data.currentRound.currentTrick.plays.length === data.players.length &&
				data.currentRound.currentTrick.winnerID
			) {
				setTimeout(() => {
					setGameState(data);
					setLastTrick(null);
				}, 2000);
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
	};

	const computeTurnMessage = () => {
		if (!gameState || !gameState.currentRound) return '';
		const round = gameState.currentRound;
		if (round.currentTrick && round.currentTrick.winnerID) {
			if (normalizeId(round.currentTrick.winnerID) === normalizeId(playerId)) {
				return 'YOU won the trick!';
			} else {
				const winner = gameState.players.find(
					(p) => normalizeId(p.id) === normalizeId(round.currentTrick.winnerID)
				);
				return winner ? `${winner.displayName} won the trick!` : '';
			}
		}
		if (gameState.state === 'bidding') {
			const currentBidderId = round.bidOrder[round.currentBidTurn];
			if (normalizeId(currentBidderId) === normalizeId(playerId)) {
				return 'YOUR TURN to bid';
			} else {
				const currentBidder = gameState.players.find(
					(p) => normalizeId(p.id) === normalizeId(currentBidderId)
				);
				return currentBidder
					? `Waiting for ${currentBidder.displayName} to bid`
					: '';
			}
		} else if (gameState.state === 'playing') {
			if (
				round.currentTrick &&
				round.currentTrick.plays.length < gameState.players.length
			) {
				const currentPlayerIndex =
					(round.trickLeader + round.trickTurnIndex) % gameState.players.length;
				const currentPlayer = gameState.players[currentPlayerIndex];
				if (normalizeId(currentPlayer.id) === normalizeId(playerId)) {
					return 'YOUR TURN to play a card';
				} else {
					return currentPlayer
						? `Waiting for ${currentPlayer.displayName} to play a card`
						: '';
				}
			}
		}
		return '';
	};

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

	const renderMobileScoreboardToggle = () => (
		<div
			className="mobile-scoreboard-toggle"
			onClick={() => setShowMobileScoreboard(true)}
		>
			Score
		</div>
	);

	const renderMobileScoreboard = () => (
		<div className="mobile-scoreboard">
			<button
				className="mobile-scoreboard-close"
				onClick={() => setShowMobileScoreboard(false)}
			>
				Close
			</button>
			<Scoreboard gameState={gameState} />
		</div>
	);

	const renderHandCard = (card, index) => {
		return (
			<div
				key={index}
				className={`hand-card ${
					selectedCard && cardMatches(selectedCard, card) ? 'selected' : ''
				}`}
				draggable="true"
				onDragStart={(e) => {
					setSelectedCard(card);
					e.dataTransfer.setData('text/plain', JSON.stringify(card));
					e.dataTransfer.effectAllowed = 'move';
				}}
				onDragEnd={() => {}}
				onClick={() => {
					if (gameState && gameState.state === 'playing') {
						setSelectedCard(
							selectedCard && cardMatches(selectedCard, card) ? null : card
						);
					}
				}}
			>
				<div className="card-content">{formatCard(card)}</div>
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
							<div className="played-card-content">{formatCard(play.card)}</div>
						</div>
					);
				})}
			</div>
		);
	};

	const renderGameBoard = () => {
		if (!gameState) return <div>Loading game state...</div>;
		const me = gameState.players.find(
			(p) => normalizeId(p.id) === normalizeId(playerId)
		);
		const round = gameState.currentRound;
		const sortedHand = me && me.hand ? sortHand(me.hand) : [];
		const turnMessage = computeTurnMessage();
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
						<p>{turnMessage}</p>
					</div>
				</div>
				{windowWidth < 768 && (
					<div className="mobile-scoreboard-container">
						{renderMobileScoreboardToggle()}
					</div>
				)}
				{showMobileScoreboard && renderMobileScoreboard()}
				<div
					className="table-container"
					onDragOver={(e) => {
						e.preventDefault();
						e.dataTransfer.dropEffect = 'move';
					}}
					onDrop={(e) => {
						e.preventDefault();
						if (selectedCard && gameState.state === 'playing') {
							playSelectedCard();
						}
					}}
				>
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
				{gameState &&
					gameState.state === 'bidding' &&
					!gameState.currentRound.bids[playerId] &&
					(windowWidth < 768 ? (
						<div className="bid-modal-container">
							<BidModal
								onPlaceBid={handlePlaceBid}
								isMyTurn={isMyTurnToBid()}
								maxBid={gameState.currentRound.totalCards}
							/>
						</div>
					) : (
						<BidModal
							onPlaceBid={handlePlaceBid}
							isMyTurn={isMyTurnToBid()}
							maxBid={gameState.currentRound.totalCards}
						/>
					))}
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
												(c) => c.rank <= 14 && c.suit.toLowerCase() === leadSuit
											);
											if (hasLeadSuit) {
												if (selectedCard.suit.toLowerCase() !== leadSuit) {
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
