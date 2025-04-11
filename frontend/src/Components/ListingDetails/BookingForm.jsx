import React, { useState, useMemo, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import "react-datepicker/dist/react-datepicker.css";
import './BookingForm.css';
import Payments from '../Payments/Payments';
import ReactDOM from 'react-dom';
import { useAuth } from '../../context/AuthContext';


const BookingForm = ({ listing, onSubmit }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [existingBookings, setExistingBookings] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  

  const { accessToken } = useAuth();

  const fetchExistingBookings = async () => {
    try {
      const response = await fetch(`http://localhost:5000/bookings/listing/${listing.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch existing bookings');
      }
      const bookings = await response.json();
      setExistingBookings(bookings);
    } catch (error) {
      console.error('Error fetching existing bookings:', error);
    }
  };
  

  // Fetch existing bookings for this listing
  useEffect(() => {
    if (listing?.id && accessToken) {
      fetchExistingBookings();
    }
  }, [listing?.id, accessToken]);

  // Calculate total based on selected dates/times
  const calculateTotal = useMemo(() => {
    if (!listing?.price) return 0;

    if (listing.price_type === 'day') {
      if (!startDate || !endDate) return 0;
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return listing.price * diffDays;
    } else { // hourly
      if (!startTime || !endTime) return 0;
      const diffTime = Math.abs(endTime - startTime);
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return listing.price * diffHours;
    }
  }, [listing?.price, listing?.price_type, startDate, endDate, startTime, endTime]);

  const validateDates = () => {
    if (!startDate) return { isValid: false, message: 'Please select a start date' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      return { isValid: false, message: 'Start date cannot be in the past' };
    }

    if (listing.price_type === 'day' && !endDate) {
      return { isValid: false, message: 'Please select an end date' };
    }

    if (endDate && endDate < startDate) {
      return { isValid: false, message: 'End date must be after start date' };
    }

    if (endDate && endDate - startDate > 30 * 24 * 60 * 60 * 1000) {
      return { isValid: false, message: 'Maximum booking duration is 30 days' };
    }

    return { isValid: true, message: '' };
  };

  const validateTimes = () => {
    if (!startTime) return { isValid: false, message: 'Please select a start time' };
    if (!endTime) return { isValid: false, message: 'Please select an end time' };

    if (endTime <= startTime) {
      return { isValid: false, message: 'End time must be after start time' };
    }

    if (endTime - startTime > 8 * 60 * 60 * 1000) {
      return { isValid: false, message: 'Maximum booking duration is 8 hours' };
    }

    return { isValid: true, message: '' };
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return new Date();
    try {
      // Split time string and ensure we get numbers
      const [hoursStr, minutesStr] = timeStr.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      // Create new date and set the time
      const date = new Date();
      date.setHours(hours);
      date.setMinutes(minutes);
      date.setSeconds(0);
      date.setMilliseconds(0);
      

      return date;
    } catch (error) {
      console.error('Error parsing time:', error);
      return new Date();
    }
  };

  const availableStartTime = parseTime(listing?.available_start_time);
  const availableEndTime = parseTime(listing?.available_end_time);

  // Check if a date and time slot is already booked or in the past
  const isDateBooked = (date) => {
    if (!date) return false;
    
    // Check if date is in the past
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Return true (not available) if date is in the past
    if (selectedDate < currentDate) {
      return true;
    }
    
    // Original check for existing bookings
    if (listing.price_type === 'day') {
      return existingBookings.some(booking => {
        const bookingStart = new Date(booking.booking_start);
        const bookingEnd = new Date(booking.booking_end);
        
        const bookingStartDay = new Date(bookingStart);
        bookingStartDay.setHours(0, 0, 0, 0);
        const bookingEndDay = new Date(bookingEnd);
        bookingEndDay.setHours(23, 59, 59, 999);
        
        return selectedDate >= bookingStartDay && selectedDate <= bookingEndDay;
      });
    } else {
      // For hourly bookings, check if all available hours are booked
      const availStartHour = availableStartTime.getHours();
      const availEndHour = availableEndTime.getHours();
      const totalAvailableHours = availEndHour - availStartHour;
      
      // Get all bookings for this date
      const dateBookings = existingBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_start);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === selectedDate.getTime();
      });
      
      if (dateBookings.length === 0) return false;
      
      // Calculate total booked hours
      let bookedRanges = dateBookings.map(booking => {
        const start = new Date(booking.booking_start);
        const end = new Date(booking.booking_end);
        return {
          start: start.getHours(),
          end: end.getHours()
        };
      });
      
      // Merge overlapping time ranges
      bookedRanges.sort((a, b) => a.start - b.start);
      let mergedRanges = [bookedRanges[0]];
      
      for (let i = 1; i < bookedRanges.length; i++) {
        let current = bookedRanges[i];
        let previous = mergedRanges[mergedRanges.length - 1];
        
        if (current.start <= previous.end) {
          previous.end = Math.max(previous.end, current.end);
        } else {
          mergedRanges.push(current);
        }
      }
      
      // Calculate total booked hours
      const totalBookedHours = mergedRanges.reduce((total, range) => {
        return total + (range.end - range.start);
      }, 0);
      
      // Return true if all available hours are booked
      return totalBookedHours >= totalAvailableHours;
    }
  };

  const filterTime = (time) => {
    if (!startDate || !time) return false;
    
    // Create the time to check in local timezone
    const timeToCheck = new Date(startDate);
    timeToCheck.setHours(time.getHours(), time.getMinutes(), 0, 0);
    
    // Check if within available hours
    const startLimit = new Date(startDate);
    startLimit.setHours(availableStartTime.getHours(), availableStartTime.getMinutes(), 0, 0);
    
    const endLimit = new Date(startDate);
    endLimit.setHours(availableEndTime.getHours(), availableEndTime.getMinutes(), 0, 0);
    
    
    
    if (timeToCheck < startLimit || timeToCheck >= endLimit) {

      return false;
    }
  
    // Check against existing bookings
    const isBooked = existingBookings.some(booking => {
      const bookingStart = new Date(booking.booking_start);
      const bookingEnd = new Date(booking.booking_end);
      
      // Check if dates match
      const sameDate = bookingStart.toDateString() === timeToCheck.toDateString();
      
      if (sameDate) {
        // Check if time slot is within a booking
        const isWithinBooking = timeToCheck >= bookingStart && timeToCheck < bookingEnd;
        
        return isWithinBooking;
      }
      
      return false;
    });
  
    return !isBooked;
  };
  
  const filterEndTime = (time) => {
    if (!startTime || !time) return false;
    
    // Create date objects for comparison
    const proposedEndTime = new Date(startDate);
    proposedEndTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    
    const selectedStartDateTime = new Date(startDate);
    selectedStartDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    
    // Must be after start time
    if (proposedEndTime <= selectedStartDateTime) {
      return false;
    }
    
    // Must be within available hours
    const endLimit = new Date(startDate);
    endLimit.setHours(availableEndTime.getHours(), availableEndTime.getMinutes(), 0, 0);
    
    if (proposedEndTime > endLimit) {
      return false;
    }
    
    // Check for booking conflicts
    const hasConflict = existingBookings.some(booking => {
      const bookingStart = new Date(booking.booking_start);
      const bookingEnd = new Date(booking.booking_end);
      
      // Check if dates match
      const sameDate = bookingStart.toDateString() === startDate.toDateString();
      
      if (sameDate) {
        const overlaps = (
          (selectedStartDateTime < bookingEnd && proposedEndTime > bookingStart) ||
          (selectedStartDateTime >= bookingStart && selectedStartDateTime < bookingEnd) ||
          (proposedEndTime > bookingStart && proposedEndTime <= bookingEnd)
        );
        
        return overlaps;
      }
      
      return false;
    });
  
    return !hasConflict;
  };

  const handleTimeChange = (time, isStartTime) => {
    setValidationMessage(''); // Clear validation message on new selection
    
    if (isStartTime) {
      // Create a new date object based on the selected start date
      const newStartTime = new Date(startDate);
      newStartTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      // Check if the new start time would overlap with any existing bookings
      const isAvailable = filterTime(time);
      if (!isAvailable) {
        setValidationMessage('This time slot is not available');
        return;
      }
      
      setStartTime(newStartTime);
      setEndTime(null); // Reset end time when start time changes
    } else {
      // Create a new date object based on the selected start date
      const newEndTime = new Date(startDate);
      newEndTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      // Check if the new end time would create a valid time range
      const isAvailable = filterEndTime(time);
      if (!isAvailable) {
        setValidationMessage('This time slot is not available');
        return;
      }
      
      setEndTime(newEndTime);
    }
  };

  const handleSubmit = async () => {
    setValidationMessage('');
    setBookingError(null);
    setPaymentError(null);
  
    const validation = listing.price_type === 'day' 
      ? validateDates()
      : { ...validateDates(), ...validateTimes() };
  
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }
  
    // Instead of creating booking here, just show payment form
    setShowPayment(true);
  };










  if (!listing) {
    return <div className="booking-form-loading">Loading booking form...</div>;
  }

  const minDate = listing.start_date ? new Date(listing.start_date) : new Date();
  const maxDate = listing.end_date ? new Date(listing.end_date) : undefined;

  const getDurationText = () => {
    if (listing.price_type === 'day' && startDate && endDate) {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (listing.price_type === 'hour' && startTime && endTime) {
      const diffTime = Math.abs(endTime - startTime);
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    return '';
  };

  return (
    <div className="booking-card" data-mode={listing.price_type}>
      <div className="booking-form">
        {listing.price_type === 'day' ? (
          <div className="date-range-selection">
            <div className="date-picker-container">
              <h4 className="date-picker-title">Check-in Date</h4>
              <DatePicker
                selected={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  setValidationMessage('');
                }}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                minDate={minDate}
                maxDate={maxDate}
                dateFormat="MMMM d, yyyy"
                placeholderText="Select start date"
                className={`date-picker-input ${validationMessage && !startDate ? 'invalid' : ''}`}
                filterDate={date => !isDateBooked(date)}
                inline
              />
            </div>
   
            <div className="date-picker-container">
              <h4 className="date-picker-title">Check-out Date</h4>
              <DatePicker
                selected={endDate}
                onChange={(date) => {
                  setEndDate(date);
                  setValidationMessage('');
                }}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || minDate}
                maxDate={maxDate}
                dateFormat="MMMM d, yyyy"
                placeholderText="Select end date"
                className={`date-picker-input ${validationMessage && !endDate ? 'invalid' : ''}`}
                filterDate={date => !isDateBooked(date)}
                inline
              />
            </div>
          </div>
        ) : (
          <div className="single-date-selection">
            <div className="date-picker-container">
              <h4 className="date-picker-title">Select Date</h4>
              <DatePicker
                selected={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  setValidationMessage('');
                  setStartTime(null);
                  setEndTime(null);
                }}
                minDate={minDate}
                maxDate={maxDate}
                dateFormat="MMMM d, yyyy"
                placeholderText="Select a date"
                className={`date-picker-input ${validationMessage && !startDate ? 'invalid' : ''}`}
                filterDate={date => !isDateBooked(date)}
                inline
              />
            </div>
   
            {startDate && (
              <div className="time-selection-container">
                <div className="time-picker-wrapper">
                  <h4 className="time-picker-title">Start Time</h4>
                  <DatePicker
                    selected={startTime}
                    onChange={(time) => handleTimeChange(time, true)}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={60}
                    timeCaption="Time"
                    dateFormat="h:mm aa"
                    timeFormat="h:mm aa"
                    placeholderText="Select start time"
                    className={`time-picker-input ${validationMessage && !startTime ? 'invalid' : ''}`}
                    filterTime={filterTime}
                    minTime={availableStartTime}
                    maxTime={availableEndTime}
                  />
                </div>
   
                <div className="time-picker-wrapper">
                  <h4 className="time-picker-title">End Time</h4>
                  <DatePicker
                    selected={endTime}
                    onChange={(time) => handleTimeChange(time, false)}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={60}
                    timeCaption="Time"
                    dateFormat="h:mm aa"
                    timeFormat="h:mm aa"
                    placeholderText="Select end time"
                    className={`time-picker-input ${validationMessage && !endTime ? 'invalid' : ''}`}
                    filterTime={filterEndTime}
                    minTime={startTime}
                    maxTime={availableEndTime}
                    disabled={!startTime}
                  />
                </div>
              </div>
            )}
          </div>
        )}
   
        <div className="booking-summary">
          <h4 className="summary-title">Booking Summary</h4>
          <div className="summary-details">
            <div className="summary-date">
              <Calendar className="summary-icon" />
              {listing.price_type === 'day' ? (
                <span>
                  {startDate && endDate
                    ? `${startDate.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                      })} - ${endDate.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                      })}`
                    : 'Select dates'}
                </span>
              ) : (
                <span>
                  {startDate
                    ? startDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Select a date'}
                </span>
              )}
            </div>
   
            {listing.price_type === 'hour' && (
              <div className="summary-time">
                <Clock className="summary-icon" />
                <span>
                  {startTime && endTime
                    ? `${startTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                      })} - ${endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                      })}`
                    : 'Select time range'}
                </span>
              </div>
            )}
   
            <div className="summary-price">
              <p className="price-details">
                <span className="base-price">${listing.price}/{listing.price_type}</span>
                {getDurationText() && (
                  <span className="duration">× {getDurationText()}</span>
                )}
              </p>
              <p className="total-price">
                Total: ${calculateTotal.toFixed(2)}
              </p>
              <p className="price-type">
                {listing.price_type === 'hour' ? 'Per hour' : 'Per day'}
              </p>
            </div>
          </div>
   
          {validationMessage && (
            <div className="validation-message">
              <AlertCircle className="message-icon" />
              <p>{validationMessage}</p>
            </div>
          )}
   
          {bookingError && (
            <div className="booking-error">
              <AlertCircle className="message-icon" />
              <p>{bookingError}</p>
            </div>
          )}
   
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (listing.price_type === 'day'
                ? !startDate || !endDate
                : !startDate || !startTime || !endTime)
            }
            className="booking-submit-button"
          >
            {isSubmitting ? (
              <span className="loading-spinner"></span>
            ) : (
              'Book Now'
            )}
          </button>
        </div>
      </div>
   
      {showPayment && ReactDOM.createPortal(
  <div className="payment-overlay" onClick={() => setShowPayment(false)}>
    <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
      <Payments 
        amount={Number(calculateTotal) || 0}
        listing={listing}
        startDate={startDate}
        endDate={endDate}
        startTime={startTime}
        endTime={endTime}
        onPaymentStatusChange={(status, error) => {
          if (status === 'succeeded') {
            setBookingSuccess(true);
            setShowPayment(false);
            // Refresh the existing bookings list
            if (listing?.id) {
              fetchExistingBookings();
            }
          } else if (status === 'failed') {
            const errorMessage = error || 'Payment failed. Please try again.';
            setPaymentError(errorMessage);
            setShowPayment(false);
            setTimeout(() => {
              setPaymentError(null);
              setShowPayment(true);
            }, 3000);
          }
        }}
      />
    </div>
  </div>,
  document.body
)}
      {paymentError && !showPayment && (
  <div className="payment-error-overlay">
    <div className="payment-error-modal">
      <AlertCircle className="error-icon" />
      <p>{paymentError}</p>
    </div>
  </div>
)}
   
      {bookingSuccess && (
        <div className="booking-success-overlay">
          <div className="booking-success-modal">
            <CheckCircle2 className="success-icon" />
            <h3>Booking Successful!</h3>
            <div className="success-details">
              <p>Your booking has been confirmed for:</p>
              {listing.price_type === 'day' ? (
                <p className="date-time">
                  {startDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })} - {endDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              ) : (
                <>
                  <p className="date-time">
                    {startDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="date-time">
                    {startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: 'numeric',
                      hour12: true,
                    })} - {endTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: 'numeric',
                      hour12: true,
                    })}
                  </p>
                </>
              )}
              <p className="success-total">
                Total Amount: ${calculateTotal.toFixed(2)}
              </p>
            </div>
            <button 
              onClick={() => {
                setBookingSuccess(false);
                setStartDate(null);
                setEndDate(null);
                setStartTime(null);
                setEndTime(null);
              }}
              className="success-close-button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
);
};

export default BookingForm;