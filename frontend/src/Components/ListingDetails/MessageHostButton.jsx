import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Add this import
import './MessageHostButton.css';

const MessageHostButton = ({ listingId, listingTitle, hostId }) => {
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const navigate = useNavigate();
  const { accessToken, isAuthenticated } = useAuth(); // Add this line

  const handleMessageHost = async () => {
    setIsMessageLoading(true);
    try {
      // Use isAuthenticated instead of checking token directly
      if (!isAuthenticated) {
        navigate('/login', { 
          state: { 
            from: window.location.pathname,
            message: 'Please log in to message the host' 
          }
        });
        return;
      }

      // First, initiate the conversation
      const initiateResponse = await axios.post(
        'http://localhost:5000/messages/initiate-listing',
        { listingId },
        {
          headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
        }
      );

      const { receiverId, existingConversation, hostName } = initiateResponse.data;

      // Only send first message if it's a new conversation
      if (!existingConversation) {
        await axios.post(
          'http://localhost:5000/messages',
          {
            receiverId,
            content: `Hi, I'm interested in your listing: ${listingTitle}`,
            listingId
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
          }
        );
      }

      // Navigate to messages page with replace option
      navigate('/messages', { 
        state: { 
          receiverId, 
          listingTitle,
          listingId,
          hostName,
          isNewConversation: !existingConversation 
        },
        replace: true // Add this to prevent history stacking
      });

    } catch (error) {
      console.error('Error initiating conversation:', error);
      if (error.response?.status === 401) {
        navigate('/login', { 
          state: { 
            from: window.location.pathname,
            message: 'Your session has expired. Please log in again.' 
          }
        });
      } else if (error.response?.status === 400 && error.response?.data?.message === 'Cannot message your own listing') {
        alert("You cannot message your own listing");
      } else {
        alert("Failed to start conversation. Please try again.");
      }
    } finally {
      setIsMessageLoading(false);
    }
  };

  return (
    <button 
      className={`message-host-button ${isMessageLoading ? 'loading' : ''}`}
      onClick={handleMessageHost}
      disabled={isMessageLoading}
    >
      {isMessageLoading ? (
        <>
          <Loader size={16} className="spinning" />
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

export default MessageHostButton;