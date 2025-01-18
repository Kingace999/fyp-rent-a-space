import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import DatePicker from 'react-datepicker';
import { Calendar, Clock, X, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import "react-datepicker/dist/react-datepicker.css";
import './UpdateBookingButton.css';

// Booking modification rules
const BOOKING_RULES = {
  MIN_NOTICE_EXTENSION: 48, // hours
  MIN_NOTICE_SHORTEN: 72, // hours
  MAX_EXTENSION_MULTIPLIER: 2,
  MODIFICATION_FEE_PERCENTAGE: 10,
  MIN_STAY_DURATION: 2 // days
};

const UpdateBookingButton = ({ booking, listing, onUpdate }) => {
  const [startDate, setStartDate] = useState(new Date(booking.booking_start));
  const [endDate, setEndDate] = useState(new Date(booking.booking_end));
  const [startTime, setStartTime] = useState(new Date(booking.booking_start));
  const [endTime, setEndTime] = useState(new Date(booking.booking_end));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingBookings, setExistingBookings] = useState([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [priceAdjustment, setPriceAdjustment] = useState(null);

  // Store original booking dates for comparison
  const originalStartDate = useMemo(() => new Date(booking.booking_start), [booking.booking_start]);
  const originalEndDate = useMemo(() => new Date(booking.booking_end), [booking.booking_end]);
  
  // Determine if hourly based on listing price type
  const isHourly = listing?.price_type === 'hour';

  useEffect(() => {
    const fetchExistingBookings = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/bookings/listing/${booking.listing_id}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setExistingBookings(response.data.filter(b => b.id !== booking.id));
      } catch (error) {
        console.error('Error fetching existing bookings:', error);
      }
    };

    if (open && booking?.listing_id) {
      fetchExistingBookings();
    }
  }, [open, booking?.listing_id, booking.id]);

  // Parse available times from listing
  const parseTime = (timeStr) => {
    if (!timeStr) return new Date();
    try {
      const [hoursStr, minutesStr] = timeStr.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
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

  const validateDateModification = (newStartDate, newEndDate) => {
    const now = new Date();
    const originalDuration = (originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24);
    const newDuration = (newEndDate - newStartDate) / (1000 * 60 * 60 * 24);
    const hoursUntilStart = (originalStartDate - now) / (1000 * 60 * 60);
    const isExtension = newEndDate > originalEndDate;

    if (isExtension && hoursUntilStart < BOOKING_RULES.MIN_NOTICE_EXTENSION) {
      return {
        isValid: false,
        message: `Changes must be made at least ${BOOKING_RULES.MIN_NOTICE_EXTENSION} hours before the booking start`
      };
    }

    if (!isExtension && hoursUntilStart < BOOKING_RULES.MIN_NOTICE_SHORTEN) {
      return {
        isValid: false,
        message: `Shortening a booking requires ${BOOKING_RULES.MIN_NOTICE_SHORTEN} hours notice`
      };
    }

    if (newDuration > originalDuration * BOOKING_RULES.MAX_EXTENSION_MULTIPLIER) {
      return {
        isValid: false,
        message: `Cannot extend booking more than ${BOOKING_RULES.MAX_EXTENSION_MULTIPLIER}x the original duration`
      };
    }

    if (newDuration < BOOKING_RULES.MIN_STAY_DURATION) {
      return {
        isValid: false,
        message: `Minimum stay duration is ${BOOKING_RULES.MIN_STAY_DURATION} days`
      };
    }

    return { isValid: true };
  };

  const calculatePriceAdjustment = (newStartDate, newEndDate) => {
    let originalDuration, newDuration;
    
    if (isHourly) {
      // For hourly bookings, use the time objects instead of dates
      const originalDurationMs = originalEndDate - originalStartDate;
      const newDurationMs = (newEndDate && newStartDate) ? newEndDate - newStartDate : 0;
      
      originalDuration = Math.ceil(originalDurationMs / (1000 * 60 * 60)); // Convert to hours
      newDuration = Math.ceil(newDurationMs / (1000 * 60 * 60));
    } else {
      originalDuration = Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24));
      newDuration = Math.ceil((newEndDate - newStartDate) / (1000 * 60 * 60 * 24));
    }
  
    const originalPrice = originalDuration * listing.price;
    const newPrice = newDuration * listing.price;
    const priceDifference = newPrice - originalPrice;
  
    let modificationFee = 0;
    if (newDuration < originalDuration) {
      modificationFee = (Math.abs(priceDifference) * BOOKING_RULES.MODIFICATION_FEE_PERCENTAGE) / 100;
    }
  
    return {
      originalPrice,
      newPrice,
      priceDifference,
      modificationFee,
      totalAdjustment: priceDifference + modificationFee
    };
  };

  const validateDates = () => {
    if (!startDate) return { isValid: false, message: 'Please select a start date' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      return { isValid: false, message: 'Start date cannot be in the past' };
    }

    if (!isHourly && !endDate) {
      return { isValid: false, message: 'Please select an end date' };
    }

    if (endDate && endDate < startDate) {
      return { isValid: false, message: 'End date must be after start date' };
    }

    const modificationValidation = validateDateModification(startDate, endDate);
    if (!modificationValidation.isValid) {
      return modificationValidation;
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

  // Calculate total based on selected dates/times
  const calculateTotal = useMemo(() => {
    if (!listing?.price) return 0;

    if (!isHourly) {
      if (!startDate || !endDate) return 0;
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return listing.price * diffDays;
    } else {
      if (!startTime || !endTime) return 0;
      const diffTime = Math.abs(endTime - startTime);
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return listing.price * diffHours;
    }
  }, [listing?.price, isHourly, startDate, endDate, startTime, endTime]);

  const isDateBooked = (date) => {
    if (!date) return false;
    
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Don't mark original booking dates as booked
    const originalStartDay = new Date(originalStartDate);
    originalStartDay.setHours(0, 0, 0, 0);
    const originalEndDay = new Date(originalEndDate);
    originalEndDay.setHours(0, 0, 0, 0);
    
    if (selectedDate >= originalStartDay && selectedDate <= originalEndDay) {
      return false;
    }
    
    if (!isHourly) {
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
      const availStartHour = availableStartTime.getHours();
      const availEndHour = availableEndTime.getHours();
      const totalAvailableHours = availEndHour - availStartHour;
      
      const dateBookings = existingBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_start);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === selectedDate.getTime();
      });
      
      if (dateBookings.length === 0) return false;
      
      let bookedRanges = dateBookings.map(booking => {
        const start = new Date(booking.booking_start);
        const end = new Date(booking.booking_end);
        return {
          start: start.getHours(),
          end: end.getHours()
        };
      });
      
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
      
      const totalBookedHours = mergedRanges.reduce((total, range) => {
        return total + (range.end - range.start);
      }, 0);
      
      return totalBookedHours >= totalAvailableHours;
    }
  };

  const filterTime = (time) => {
    if (!startDate || !time) return false;
    
    const timeToCheck = new Date(startDate);
    timeToCheck.setHours(time.getHours(), time.getMinutes(), 0, 0);
    
    const startLimit = new Date(startDate);
    startLimit.setHours(availableStartTime.getHours(), availableStartTime.getMinutes(), 0, 0);
    
    const endLimit = new Date(startDate);
    endLimit.setHours(availableEndTime.getHours(), availableEndTime.getMinutes(), 0, 0);
    
    if (timeToCheck < startLimit || timeToCheck >= endLimit) {
      return false;
    }
  
    return !existingBookings.some(booking => {
      const bookingStart = new Date(booking.booking_start);
      const bookingEnd = new Date(booking.booking_end);
      
      const sameDate = bookingStart.toDateString() === timeToCheck.toDateString();
      
      if (sameDate) {
        return timeToCheck >= bookingStart && timeToCheck < bookingEnd;
      }
      
      return false;
    });
  };

  const filterEndTime = (time) => {
    if (!startTime || !time) return false;
    
    const proposedEndTime = new Date(startDate);
    proposedEndTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
    
    const selectedStartDateTime = new Date(startDate);
    selectedStartDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    
    if (proposedEndTime <= selectedStartDateTime) {
      return false;
    }
    
    const endLimit = new Date(startDate);
    endLimit.setHours(availableEndTime.getHours(), availableEndTime.getMinutes(), 0, 0);
    
    if (proposedEndTime > endLimit) {
      return false;
    }
    
    return !existingBookings.some(booking => {
      const bookingStart = new Date(booking.booking_start);
      const bookingEnd = new Date(booking.booking_end);
      
      const sameDate = bookingStart.toDateString() === startDate.toDateString();
      
      if (sameDate) {
        return (
          (selectedStartDateTime < bookingEnd && proposedEndTime > bookingStart) ||
          (selectedStartDateTime >= bookingStart && selectedStartDateTime < bookingEnd) ||
          (proposedEndTime > bookingStart && proposedEndTime <= bookingEnd)
        );
      }
      
      return false;
    });
  };

  const handleTimeChange = (time, isStartTime) => {
    setValidationMessage('');
    
    let newStartTime = startTime;
    let newEndTime = endTime;
  
    if (isStartTime) {
      newStartTime = new Date(startDate);
      newStartTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      const isAvailable = filterTime(time);
      if (!isAvailable) {
        setValidationMessage('This time slot is not available');
        return;
      }
      
      setStartTime(newStartTime);
      if (!endTime || endTime <= newStartTime) {
        newEndTime = new Date(newStartTime.getTime() + 3600000);
        if (newEndTime.getHours() < availableEndTime.getHours()) {
          setEndTime(newEndTime);
        } else {
          newEndTime = new Date(startDate);
          newEndTime.setHours(availableEndTime.getHours(), availableEndTime.getMinutes(), 0, 0);
          setEndTime(newEndTime);
        }
      }
    } else {
      newEndTime = new Date(startDate);
      newEndTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      const isAvailable = filterEndTime(time);
      if (!isAvailable) {
        setValidationMessage('This time slot is not available');
        return;
      }
      
      setEndTime(newEndTime);
    }
  
    // Calculate price adjustment whenever we have valid start and end times
    if (newStartTime && newEndTime && newEndTime > newStartTime) {
      const adjustment = calculatePriceAdjustment(newStartTime, newEndTime);
      setPriceAdjustment(adjustment);
    } else {
      setPriceAdjustment(null); // Clear price adjustment if times are invalid
    }
  };

  const handleDateChange = (date, isStart) => {
    setValidationMessage('');
    
    if (isStart) {
      setStartDate(date);
      if (endDate && date > endDate) {
        setEndDate(date);
      }
    } else {
      setEndDate(date);
    }

    // Calculate price adjustment
    if (date && (isStart ? endDate : startDate)) {
      const newStartDate = isStart ? date : startDate;
      const newEndDate = isStart ? endDate : date;
      const adjustment = calculatePriceAdjustment(newStartDate, newEndDate);
      setPriceAdjustment(adjustment);
    }
  };

  const getDayClassName = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const originalStartStr = originalStartDate.toISOString().split('T')[0];
    const originalEndStr = originalEndDate.toISOString().split('T')[0];
    const currentStartStr = startDate?.toISOString().split('T')[0];
    const currentEndStr = endDate?.toISOString().split('T')[0];

    if (dateStr >= originalStartStr && dateStr <= originalEndStr) {
      if (dateStr === originalStartStr) return 'react-datepicker__day--original-range-start';
      if (dateStr === originalEndStr) return 'react-datepicker__day--original-range-end';
      return 'react-datepicker__day--original-range';
    }

    if (startDate && endDate && dateStr >= currentStartStr && dateStr <= currentEndStr) {
      if (dateStr === currentStartStr) return 'react-datepicker__day--new-range-start';
      if (dateStr === currentEndStr) return 'react-datepicker__day--new-range-end';
      return 'react-datepicker__day--new-range';
    }

    return '';
  };

  const getDurationText = () => {
    if (!isHourly && startDate && endDate) {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (isHourly && startTime && endTime) {
      const diffTime = Math.abs(endTime - startTime);
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    return '';
  };

  const handleUpdate = async () => {
    setError('');
    setValidationMessage('');

    const validation = isHourly 
      ? { ...validateDates(), ...validateTimes() }
      : validateDates();

    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }

    setLoading(true);

    try {
      const bookingData = {
        booking_start: isHourly ? startTime.toISOString() : startDate.toISOString(),
        booking_end: isHourly ? endTime.toISOString() : endDate.toISOString(),
        total: calculateTotal,
        price_adjustment: priceAdjustment?.totalAdjustment || 0
      };

      const response = await axios.put(
        `http://localhost:5000/bookings/${booking.id}`,
        bookingData,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      onUpdate(response.data);
      setBookingSuccess(true);
      
      setTimeout(() => {
        setBookingSuccess(false);
        setOpen(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="update-booking-btn">
          <Calendar className="update-booking-icon" />
          Update Booking
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent">
          {bookingSuccess ? (
            <div className="booking-success-modal">
              <CheckCircle2 className="success-icon" />
              <h3>Booking Updated!</h3>
              <div className="success-details">
                <p>Your booking has been updated to:</p>
                {!isHourly ? (
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
                  {priceAdjustment?.totalAdjustment !== 0 && (
                    <span className={priceAdjustment?.totalAdjustment > 0 ? 'price-increase' : 'price-decrease'}>
                      ({priceAdjustment?.totalAdjustment > 0 ? '+' : '-'}$
                      {Math.abs(priceAdjustment?.totalAdjustment).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="update-booking-header">
                <Dialog.Title className="update-booking-title">
                  Update Booking
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="update-booking-close" aria-label="Close">
                    <X />
                  </button>
                </Dialog.Close>
              </div>

              <div className="update-booking-body">
                {!isHourly ? (
                  <div className="date-range-selection">
                    <div className="date-picker-container">
                      <h4 className="date-picker-title">Check-in Date</h4>
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => handleDateChange(date, true)}
                        selectsStart
                        startDate={startDate}
                        endDate={endDate}
                        minDate={listing?.start_date ? new Date(listing.start_date) : new Date()}
                        maxDate={listing?.end_date ? new Date(listing.end_date) : undefined}
                        dateFormat="MMMM d, yyyy"
                        className="date-picker-input"
                        filterDate={date => !isDateBooked(date)}
                        dayClassName={getDayClassName}
                        inline
                      />
                    </div>

                    <div className="date-picker-container">
                      <h4 className="date-picker-title">Check-out Date</h4>
                      <DatePicker
                        selected={endDate}
                        onChange={(date) => handleDateChange(date, false)}
                        selectsEnd
                        startDate={startDate}
                        endDate={endDate}
                        minDate={startDate}
                        maxDate={listing?.end_date ? new Date(listing.end_date) : undefined}
                        dateFormat="MMMM d, yyyy"
                        className="date-picker-input"
                        filterDate={date => !isDateBooked(date)}
                        dayClassName={getDayClassName}
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
                          setEndDate(date);
                          setStartTime(null);
                          setEndTime(null);
                          setValidationMessage('');
                        }}
                        minDate={listing?.start_date ? new Date(listing.start_date) : new Date()}
                        maxDate={listing?.end_date ? new Date(listing.end_date) : undefined}
                        dateFormat="MMMM d, yyyy"
                        className="date-picker-input"
                        filterDate={date => !isDateBooked(date)}
                        inline
                      />
                    </div>

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
                          className={`time-picker-input ${validationMessage && !startTime ? 'invalid' : ''}`}
                          placeholderText="Select start time"
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
                          className={`time-picker-input ${validationMessage && !endTime ? 'invalid' : ''}`}
                          placeholderText="Select end time"
                          filterTime={filterEndTime}
                          minTime={startTime}
                          maxTime={availableEndTime}
                          disabled={!startTime}
                        />
                      </div>
                    </div>
                  </div>
                )}


<div className="booking-summary">
  <h4 className="summary-title">Booking Summary</h4>
  
  <div className="booking-comparison">
    {/* Current Booking */}
    <div className="booking-details current-booking">
      <h5 className="booking-details-title">Current Booking</h5>
      <div className="summary-details">
        <div className="summary-date">
          <Calendar className="summary-icon" />
          {!isHourly ? (
            <span>
              {originalStartDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })} - {originalEndDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
            </span>
          ) : (
            <>
              <span>
                {originalStartDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                <br />
                {originalStartDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })} - {originalEndDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true,
                })}
              </span>
            </>
          )}
        </div>

        <div className="summary-price">
          <p className="price-details">
            <span className="base-price">${listing?.price}/{listing?.price_type}</span>
            <span className="duration">
              × {isHourly 
                ? `${Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60))} hours`
                : `${Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24))} days`
              }
            </span>
          </p>
          <p className="total-price">
            Total: ${(listing?.price * (isHourly 
              ? Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60))
              : Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24))
            )).toFixed(2)}
          </p>
        </div>
      </div>
    </div>

    {/* New Booking */}
    <div className="booking-details new-booking">
      <h5 className="booking-details-title">New Booking</h5>
      <div className="summary-details">
        <div className="summary-date">
          <Calendar className="summary-icon" />
          {!isHourly ? (
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
            <>
              <span>
                {startDate
                  ? `${startDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                    ${startTime && endTime
                      ? `\n${startTime.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: 'numeric',
                          hour12: true,
                        })} - ${endTime.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: 'numeric',
                          hour12: true,
                        })}`
                      : ''
                    }`
                  : 'Select date and time'}
              </span>
            </>
          )}
        </div>

        <div className="summary-price">
          <p className="price-details">
            <span className="base-price">${listing?.price}/{listing?.price_type}</span>
            {getDurationText() && (
              <span className="duration">× {getDurationText()}</span>
            )}
          </p>
          <p className="total-price">
            Total: ${calculateTotal.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  </div>

  {/* Price Adjustment Section */}
  {priceAdjustment && (
    <div className="price-adjustment">
      <h5 className="price-adjustment-title">Booking Change Summary</h5>
      <div className="price-breakdown">
        <div className="price-row total">
          <span>Price Difference:</span>
          <span className={priceAdjustment.priceDifference >= 0 ? 'price-increase' : 'price-decrease'}>
            {priceAdjustment.priceDifference >= 0 ? '+' : '-'}$
            {Math.abs(priceAdjustment.priceDifference).toFixed(2)}
          </span>
        </div>
        
        {priceAdjustment.modificationFee > 0 && (
          <div className="price-row modification-fee">
            <span>Modification Fee ({BOOKING_RULES.MODIFICATION_FEE_PERCENTAGE}%):</span>
            <span>${priceAdjustment.modificationFee.toFixed(2)}</span>
          </div>
        )}

        <div className="price-row final-adjustment">
          <span>{priceAdjustment.totalAdjustment >= 0 ? 'Additional Payment:' : 'Refund Amount:'}</span>
          <span className={priceAdjustment.totalAdjustment >= 0 ? 'price-increase' : 'price-decrease'}>
            ${Math.abs(priceAdjustment.totalAdjustment).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )}

                  {validationMessage && (
                    <div className="validation-message">
                      <AlertCircle className="message-icon" />
                      <p>{validationMessage}</p>
                    </div>
                  )}

                  {error && (
                    <div className="booking-error">
                      <AlertCircle className="message-icon" />
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleUpdate}
                    disabled={loading || (isHourly ? !startTime || !endTime : !startDate || !endDate)}
                    className="booking-submit-button"
                  >
                    {loading ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      'Update Booking'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default UpdateBookingButton;