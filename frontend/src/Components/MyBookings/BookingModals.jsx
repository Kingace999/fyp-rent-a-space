import React, { useState } from 'react';  // Added useState import
import * as Dialog from '@radix-ui/react-dialog';
import { Calendar, MapPin, DollarSign, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import './BookingsModal.css';

export const BookingDetails = ({ booking, onClose }) => {
  if (!booking) return null;

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bookings-modal-overlay" />
        <Dialog.Content className="bookings-modal-content">
          <div className="bookings-modal-header">
            <Dialog.Title className="bookings-modal-title">Booking Details</Dialog.Title>
            <Dialog.Close asChild>
              <button className="bookings-modal-close" aria-label="Close">
                <X className="icon-close" />
              </button>
            </Dialog.Close>
          </div>

          <div className="bookings-modal-body">
            <div className="booking-details">
              <h3 className="booking-title">{booking.title}</h3>
              <div className="booking-info">
                <MapPin className="icon-location" />
                <span>{booking.location}</span>
              </div>
              <div className="booking-info">
                <Calendar className="icon-calendar" />
                <div>
                  <div>Start: {format(new Date(booking.booking_start), 'PPP p')}</div>
                  <div>End: {format(new Date(booking.booking_end), 'PPP p')}</div>
                </div>
              </div>
              <div className="booking-info">
                <DollarSign className="icon-dollar" />
                <span>{booking.total_price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
              </div>
              <div className="booking-status">
                <span className={`status-badge ${booking.status}`}>
                  {booking.status === 'pending_cancellation' 
                    ? 'Cancellation in Progress'
                    : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="cancellation-policy">
              <h4>Cancellation Policy</h4>
              <ul>
                <li>100% refund if cancelled 7 days or more before the booking</li>
                <li>50% refund if cancelled 3-7 days before the booking</li>
                <li>No refund for cancellations less than 3 days before</li>
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const CancelBookingDialog = ({ booking, onConfirm, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);  // Added state

  const calculateRefundInfo = () => {
    if (!booking || booking.status === 'pending_cancellation') 
      return { percentage: 0, amount: 0 };
    if (!booking) return { percentage: 0, amount: 0 };
    
    const hoursUntilBooking = Math.ceil(
      (new Date(booking.booking_start) - new Date()) / (1000 * 60 * 60)
    );
    
    let refundPercentage = 0;
    if (hoursUntilBooking >= 168) {
      refundPercentage = 100;
    } else if (hoursUntilBooking >= 72) {
      refundPercentage = 50;
    }
    
    const refundAmount = (booking.net_paid * refundPercentage) / 100;
    return { percentage: refundPercentage, amount: refundAmount };
  };

  const refundInfo = calculateRefundInfo();

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bookings-modal-overlay" />
        <Dialog.Content className="bookings-modal-content">
          <div className="bookings-modal-header">
            <Dialog.Title className="bookings-modal-title">Cancel Booking</Dialog.Title>
            <Dialog.Close asChild>
              <button className="bookings-modal-close" aria-label="Close">
                <X className="icon-close" />
              </button>
            </Dialog.Close>
          </div>

          <div className="bookings-modal-body">
            <div className="cancel-warning">
              <AlertTriangle className="icon-warning" />
              <p>Are you sure you want to cancel this booking?</p>
            </div>

            <div className="refund-summary">
              <h4>Refund Summary</h4>
              <div className="refund-details">
                <p>Total Paid: {(booking?.net_paid).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                <p>Refund Percentage: {refundInfo.percentage}%</p>
                <p className="refund-amount">
                  Refund Amount: {refundInfo.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
            </div>

            <div className="cancellation-policy">
              <h4>Cancellation Policy</h4>
              <ul>
                <li>100% refund if cancelled 7 days or more before the booking</li>
                <li>50% refund if cancelled 3-7 days before the booking</li>
                <li>No refund for cancellations less than 3 days before</li>
              </ul>
            </div>

            <div className="cancel-actions">
              <Dialog.Close asChild>
                <button className="keep-booking-btn">Keep Booking</button>
              </Dialog.Close>
              <button 
                onClick={handleConfirm} 
                className="confirm-cancel-btn"
                disabled={refundInfo.percentage === 0 || isProcessing}
              >
                {isProcessing 
                  ? 'Processing Cancellation...' 
                  : refundInfo.percentage > 0 
                    ? `Cancel and Refund ${refundInfo.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
                    : 'Cancel Without Refund'
                }
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};