import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './ActivitiesDropdown.css';

const ActivitiesDropdown = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (option) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="activities-dropdown" ref={dropdownRef}>
      <button
        className="activities-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        My Activities
        <ChevronDown 
          size={16} 
          className={`chevron-icon ${isOpen ? 'rotate' : ''}`}
        />
      </button>
      
      {isOpen && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={() => handleOptionClick('listings')}
          >
            My Listings
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleOptionClick('bookings')}
          >
            My Bookings
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleOptionClick('notifications')}
          >
            Notifications
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleOptionClick('messages')}  // ✅ Added Messages Option
          >
            Messages
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivitiesDropdown;
