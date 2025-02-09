import React, { useState, useEffect } from 'react';
import './BidModal.css';

/**
 * BidModal Component
 *
 * A compact, vertical bidding modal that allows users to adjust their bid using
 * up/down arrows and keyboard input.
 *
 * Props:
 * - onPlaceBid: Function to call when the bid is placed.
 * - isMyTurn: Boolean indicating whether it's the player's turn to bid.
 * - maxBid: Maximum bid allowed (should be equal to the number of cards the player has).
 */
function BidModal({ onPlaceBid, isMyTurn, maxBid }) {
	const [bid, setBid] = useState(0);

	// Increase bid (caps at maxBid)
	const incrementBid = () => {
		if (isMyTurn) setBid((prev) => Math.min(prev + 1, maxBid));
	};

	// Decrease bid (ensures it never goes below 0)
	const decrementBid = () => {
		if (isMyTurn) setBid((prev) => Math.max(prev - 1, 0));
	};

	// Handle placing the bid
	const handlePlaceBid = () => {
		if (isMyTurn) onPlaceBid(bid);
	};

	// Handle keyboard input (including Enter to submit bid)
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!isMyTurn) return;

			if (e.key === 'ArrowUp') {
				incrementBid();
			} else if (e.key === 'ArrowDown') {
				decrementBid();
			} else if (e.key >= '0' && e.key <= '9') {
				const newBid = parseInt(e.key);
				setBid((prev) => {
					const updatedBid = prev === 0 ? newBid : parseInt(`${prev}${newBid}`);
					return Math.min(updatedBid, maxBid); // Ensure it doesn't exceed maxBid
				});
			} else if (e.key === 'Backspace') {
				setBid((prev) => Math.floor(prev / 10)); // Remove last digit
			} else if (e.key === 'Enter' || e.key === 'Return') {
				handlePlaceBid(); // Submit bid when Enter is pressed
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isMyTurn, bid, maxBid]); // Ensure it updates dynamically

	return (
		<div className="bid-modal">
			<button
				className="arrow-button"
				onClick={incrementBid}
				disabled={!isMyTurn}
			>
				▲
			</button>
			<div className="bid-number">{bid}</div>
			<button
				className="arrow-button"
				onClick={decrementBid}
				disabled={!isMyTurn}
			>
				▼
			</button>
			<button
				className="place-bid-button"
				onClick={handlePlaceBid}
				disabled={!isMyTurn}
			>
				Bid
			</button>
		</div>
	);
}

export default BidModal;
