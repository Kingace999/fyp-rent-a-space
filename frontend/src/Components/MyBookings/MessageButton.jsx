import React, { useState } from 'react';
import { MessageCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
import './MessageButton.css';

const MessageButton = ({ booking }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, accessToken } = useAuth(); // Use auth context

  const handleMessageClick = async () => {
    setIsLoading(true);
    try {
      // Check authentication using the auth context
      if (!isAuthenticated || !accessToken) {
        navigate('/');
        return;
      }

      // First, initiate the conversation
      const initiateResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/messages/initiate-booking`,
      
        { bookingId: booking.id },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const { receiverId, existingConversation } = initiateResponse.data;

      // Only send first message if it's a new conversation
      if (!existingConversation) {
        await axios.post(
          `${process.env.REACT_APP_API_URL}/messages`,
        
          {
            receiverId,
            content: `Hi, I'd like to discuss my booking for: ${booking.title}`,
            bookingId: booking.id,
            listingId: booking.listing_id
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` }
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
        navigate('/');
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
      style={{ marginLeft: 0 }} // Add inline style to ensure no margin
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