import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
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
  setLoading,
  isUpdatePayment = false,
  bookingId = null
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { accessToken } = useAuth(); // Use auth context
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
      const endpoint = isUpdatePayment 
        ? 'http://localhost:5000/payments/update-payment-intent'
        : 'http://localhost:5000/payments/create-payment-intent';

      const paymentData = isUpdatePayment 
        ? {
          bookingId,
          additionalAmount: amount,
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
        }
        : {
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
          };

      console.log('Sending payment data:', paymentData);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(paymentData)
      });

      const responseText = await response.text();
      
      console.log('Payment intent response:', {
        status: response.status,
        text: responseText,
        data: paymentData
      });

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Response parsing error:', parseError);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Payment intent creation failed');
      }

      const { clientSecret } = data;
      if (!clientSecret) {
        throw new Error('Missing client secret in response');
      }

      console.log('Confirming card payment...');
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
        console.error('Payment confirmation error:', result.error);
        let errorMessage = result.error.message;
        
        switch (result.error.code) {
          case 'card_declined':
            errorMessage = 'Your card was declined. Please try a different card.';
            break;
          case 'expired_card':
            errorMessage = 'Your card has expired. Please try a different card.';
            break;
          case 'incorrect_cvc':
            errorMessage = 'Incorrect CVC code. Please check and try again.';
            break;
          case 'processing_error':
            errorMessage = 'An error occurred while processing your card. Please try again.';
            break;
          default:
            errorMessage = result.error.message || 'Payment failed. Please try again.';
        }
        
        throw new Error(errorMessage);
      }

      if (result.paymentIntent.status === 'succeeded') {
        console.log('Payment succeeded:', result.paymentIntent);
        card.clear();
        setIsFormComplete(false);
        
        // Let the webhook handle the booking update
        setTimeout(() => {
          onPaymentStatusChange('succeeded');
        }, 1000); // Small delay to ensure webhook processes first
      } else {
        throw new Error('Payment was not successful. Please try again.');
      }
    } catch (err) {
      console.error('Payment processing error:', err);
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
        <h3>
          {isUpdatePayment ? 'Additional Payment Amount: ' : 'Payment Amount: '}
          ${parseFloat(amount).toFixed(2)}
        </h3>
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