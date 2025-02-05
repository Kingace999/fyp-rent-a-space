import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentForm from './PaymentForm';
import './Payments.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

export default function Payments({
  amount,
  listing,
  startDate,
  endDate,
  startTime,
  endTime,
  onPaymentStatusChange
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elementKey, setElementKey] = useState(0);

  const handlePaymentComplete = async (status, error = null) => {
    try {
      if (status === 'succeeded') {
        // Payment succeeded - booking will be created by webhook
        onPaymentStatusChange('succeeded');
      } else {
        // Force remount of Elements component on failure
        setElementKey(prev => prev + 1);
        onPaymentStatusChange('failed', null, error);
      }
    } catch (err) {
      onPaymentStatusChange('failed', null, err.message);
    }
  };

  return (
    <div className="payments-container">
      {error && <div className="payment-error">{error}</div>}
      {loading && <div className="payment-loading">Processing payment...</div>}
      <Elements stripe={stripePromise} key={elementKey}>
        <PaymentForm
          amount={parseFloat(amount) || 0}
          listing={listing}
          startDate={startDate}
          endDate={endDate}
          startTime={startTime}
          endTime={endTime}
          onPaymentStatusChange={handlePaymentComplete}
          setError={setError}
          setLoading={setLoading}
        />
      </Elements>
    </div>
  );
}