import React, { useState } from 'react';
import { MessageCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './MessageButton.css';

const MessageButton = ({ booking }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleMessageClick = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }

      // First, initiate the conversation
      const initiateResponse = await axios.post(
        'http://localhost:5000/messages/initiate-booking',
        { bookingId: booking.id },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const { receiverId, existingConversation } = initiateResponse.data;

      // Only send first message if it's a new conversation
      if (!existingConversation) {
        await axios.post(
          'http://localhost:5000/messages',
          {
            receiverId,
            content: `Hi, I'd like to discuss my booking for: ${booking.title}`,
            bookingId: booking.id,
            listingId: booking.listing_id
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      }

      // Navigate to messages page with the conversation selected
      navigate('/messages', { 
        state: { 
          receiverId,
          bookingId: booking.id,
          listingId: booking.listing_id,
          listingTitle: booking.title
        }
      });

    } catch (error) {
      console.error('Error initiating conversation:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        alert("Failed to start conversation. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      className={`message-button ${isLoading ? 'loading' : ''}`}
      onClick={handleMessageClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader className="spinning" size={16} />
          Starting Chat...
        </>
      ) : (
        <>
          <MessageCircle size={16} />
          Message Host
        </>
      )}
    </button>
  );
};

export default MessageButton;