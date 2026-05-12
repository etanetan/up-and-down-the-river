import React, { useState, useEffect } from 'react';
import './BidModal.css';

/**
 * BidModal Component
 *
 * This component renders a vertical bidding modal. It includes:
 * - An "up" arrow to increment the bid.
 * - A numeric input displaying the current bid, which starts at 0.
 *   - When the input is focused for the first time, it clears the default 0.
 * - A "down" arrow to decrement the bid (the value will never go below 0).
 * - A "Place Bid" button that submits the bid.
 *
 * Props:
 * - onPlaceBid: Callback function to call when the bid is placed.
 * - isMyTurn: Boolean indicating whether it is the local player's turn to bid.
 * - hasBid: Boolean indicating whether the player has already placed their bid.
 * - currentBid: The bid value if already placed.
 * - forbiddenBid: The bid value that cannot be made (for dealer constraint), or null.
 */
function BidModal({ onPlaceBid, isMyTurn, hasBid, currentBid, forbiddenBid }) {
	// Local state for the bid value.
	const [bid, setBid] = useState(currentBid !== undefined ? currentBid : 0);
	// Flag to check if the input has been cleared at least once.
	const [inputCleared, setInputCleared] = useState(false);

	// Increments the bid value by 1.
	const incrementBid = () => {
		setBid((prev) => prev + 1);
		setInputCleared(true);
	};

	// Decrements the bid value by 1 but not below 0.
	const decrementBid = () => {
		setBid((prev) => Math.max(prev - 1, 0));
		setInputCleared(true);
	};

	// Handles changes in the input field.
	const handleInputChange = (e) => {
		const value = e.target.value;
		if (value === '') {
			setBid(0);
		} else {
			const parsed = parseInt(value, 10);
			if (!isNaN(parsed)) {
				setBid(Math.max(parsed, 0));
			}
		}
	};

	// When the input is focused for the first time, clear the default value.
	const handleInputFocus = () => {
		if (!inputCleared) {
			setBid(0);
			setInputCleared(true);
		}
	};

	// Calls the onPlaceBid prop with the current bid value.
	const handlePlaceBid = () => {
		onPlaceBid(bid);
	};

	// Keyboard shortcuts for bidding
	useEffect(() => {
		if (!isMyTurn || hasBid) return;

		const handleKeyDown = (e) => {
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				setBid((prev) => prev + 1);
				setInputCleared(true);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				setBid((prev) => Math.max(prev - 1, 0));
				setInputCleared(true);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				onPlaceBid(bid);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isMyTurn, hasBid, bid, onPlaceBid]);

	return (
		<div className={`bid-modal ${!isMyTurn && !hasBid ? 'disabled' : ''}`}>
			{isMyTurn && !hasBid && (
				<div className="bid-turn-indicator">YOUR TURN</div>
			)}
			{forbiddenBid !== null &&
				forbiddenBid !== undefined &&
				isMyTurn &&
				!hasBid && (
					<div
						style={{
							color: '#ff4444',
							fontSize: '14px',
							fontWeight: 'bold',
							marginBottom: '10px',
							textAlign: 'center',
						}}
					>
						You cannot bid {forbiddenBid}
					</div>
				)}
			<h2 className="bid-header">{hasBid ? 'Your Bid' : 'Place Bid'}</h2>
			{/* Up arrow button increases bid */}
			<button
				className="arrow-button up-arrow"
				onClick={incrementBid}
				disabled={!isMyTurn || hasBid}
			>
				▲
			</button>
			{/* Numeric input for bid; clears default 0 on focus */}
			<input
				type="number"
				className="bid-input"
				value={bid}
				onChange={handleInputChange}
				onFocus={handleInputFocus}
				min="0"
				disabled={!isMyTurn || hasBid}
				readOnly={hasBid}
			/>
			{/* Down arrow button decreases bid */}
			<button
				className="arrow-button down-arrow"
				onClick={decrementBid}
				disabled={!isMyTurn || hasBid}
			>
				▼
			</button>
			{/* Place Bid button */}
			{!hasBid && (
				<button
					className="place-bid-button"
					onClick={handlePlaceBid}
					disabled={!isMyTurn}
				>
					Place Bid
				</button>
			)}
		</div>
	);
}

export default BidModal;
