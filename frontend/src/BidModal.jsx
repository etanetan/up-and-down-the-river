import React, { useState } from 'react';
import './BidModal.css';

/**
 * BidModal Component
 *
 * A compact, vertical bidding modal that allows users to adjust their bid using
 * up/down arrows. The bid number is displayed directly without an input box.
 *
 * Props:
 * - onPlaceBid: Function to call when the bid is placed.
 * - isMyTurn: Boolean indicating whether it's the player's turn to bid.
 */
function BidModal({ onPlaceBid, isMyTurn }) {
	const [bid, setBid] = useState(0);

	// Increase bid (increments by 1)
	const incrementBid = () => setBid((prev) => prev + 1);

	// Decrease bid (ensures it never goes below 0)
	const decrementBid = () => setBid((prev) => Math.max(prev - 1, 0));

	// Handle placing the bid
	const handlePlaceBid = () => {
		onPlaceBid(bid);
	};

	return (
		<div className="bid-modal">
			<button
				className="arrow-button up-arrow"
				onClick={incrementBid}
				disabled={!isMyTurn}
			>
				▲
			</button>
			<div className="bid-number">{bid}</div>{' '}
			{/* This replaces the input box */}
			<button
				className="arrow-button down-arrow"
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
