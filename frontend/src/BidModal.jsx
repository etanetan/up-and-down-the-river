import React, { useState } from 'react';
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
 */
function BidModal({ onPlaceBid, isMyTurn }) {
	// Local state for the bid value.
	const [bid, setBid] = useState(0);
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

	return (
		<div className="bid-modal">
			<h2 className="bid-header">Bid</h2>
			{/* Up arrow button increases bid */}
			<button
				className="arrow-button up-arrow"
				onClick={incrementBid}
				disabled={!isMyTurn}
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
				disabled={!isMyTurn}
			/>
			{/* Down arrow button decreases bid */}
			<button
				className="arrow-button down-arrow"
				onClick={decrementBid}
				disabled={!isMyTurn}
			>
				▼
			</button>
			{/* Place Bid button */}
			<button
				className="place-bid-button"
				onClick={handlePlaceBid}
				disabled={!isMyTurn}
			>
				Place Bid
			</button>
		</div>
	);
}

export default BidModal;
