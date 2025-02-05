import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './PaymentForm.css';

export default function PaymentForm({ 
  amount,
  listing,
  startDate,
  endDate,
  startTime,
  endTime,
  onPaymentStatusChange,
  setError,
  setLoading
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isFormComplete, setIsFormComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset card element when form is remounted
  useEffect(() => {
    if (elements) {
      const card = elements.getElement(CardElement);
      if (card) {
        card.clear();
      }
    }
  }, [elements]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || isProcessing) return;
    
    const card = elements.getElement(CardElement);
    if (!card) {
      setError('Card element not found');
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setError(null);

    try {
      // Create payment intent with booking details
      const response = await fetch('http://localhost:5000/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'usd',
          listing_id: listing.id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate ? endDate.toISOString().split('T')[0] : startDate.toISOString().split('T')[0],
          startTime: startTime?.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          }),
          endTime: endTime?.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          }),
          priceType: listing.price_type
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: card,
          billing_details: {
            name: 'Test User',
            email: 'test@example.com',
            address: {
              line1: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          }
        }
      });

      if (result.error) {
        let errorMessage = result.error.message;
        if (result.error.code === 'card_declined') {
          errorMessage = 'Your card was declined. Please try a different card.';
        } else if (result.error.code === 'expired_card') {
          errorMessage = 'Your card has expired. Please try a different card.';
        }
        throw new Error(errorMessage);
      }

      if (result.paymentIntent.status === 'succeeded') {
        card.clear();
        setIsFormComplete(false);
        onPaymentStatusChange('succeeded');
      } else {
        throw new Error('Payment failed. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      onPaymentStatusChange('failed', err.message);
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const handleCardChange = (event) => {
    setIsFormComplete(event.complete);
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <div className="payment-details">
        <h3>Payment Amount: ${parseFloat(amount).toFixed(2)}</h3>
      </div>
      <div className="form-row">
        <label htmlFor="card-element">Credit or debit card</label>
        <CardElement
          id="card-element"
          onChange={handleCardChange}
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      <button 
        type="submit" 
        disabled={!stripe || !isFormComplete || isProcessing}
        className="payment-button"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}