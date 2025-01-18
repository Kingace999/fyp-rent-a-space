import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Calendar, MapPin, DollarSign, X } from 'lucide-react';
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
                <span className={`status-badge ${new Date(booking.booking_end) < new Date() ? 'completed' : 'active'}`}>
                  {new Date(booking.booking_end) < new Date() ? 'Completed' : 'Active'}
                </span>
              </div>
            </div>

            <div className="cancellation-policy">
              <h4>Cancellation Policy</h4>
              <ul>
                <li>Full refund if cancelled 48 hours before</li>
                <li>50% refund if cancelled 24 hours before</li>
                <li>No refund for last-minute cancellations</li>
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const CancelBookingDialog = ({ onConfirm, onClose }) => {
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
            <p className="cancel-confirmation">Are you sure you want to cancel this booking?</p>
            <div className="cancellation-policy">
              <h4>Cancellation Policy</h4>
              <ul>
                <li>Full refund if cancelled 48 hours before</li>
                <li>50% refund if cancelled 24 hours before</li>
                <li>No refund for last-minute cancellations</li>
              </ul>
            </div>
            <div className="cancel-actions">
              <Dialog.Close asChild>
                <button className="keep-booking-btn">Keep Booking</button>
              </Dialog.Close>
              <button onClick={onConfirm} className="confirm-cancel-btn">
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};