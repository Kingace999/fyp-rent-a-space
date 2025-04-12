import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, MoreVertical, Send, Check, CheckCheck, Loader } from 'lucide-react';
import Header from '../Headers/Header';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Add this import
import './Messages.css';

const BACKEND_URL = process.env.REACT_APP_API_URL;


const EmptyState = ({ type }) => (
  <div className="empty-state">
    <div className="empty-state-content">
      {type === 'no-conversation' ? (
        <>
          <h3>No Conversation Selected</h3>
          <p>Choose a conversation from the list or start a new one</p>
        </>
      ) : (
        <>
          <h3>No Messages Yet</h3>
          <p>You haven't started any conversations</p>
        </>
      )}
      <button className="new-conversation-btn">Start New Conversation</button>
    </div>
  </div>
);

const MessageStatus = ({ status }) => {
  switch (status) {
    case 'sent':
      return <Check size={16} className="message-status" />;
    case 'delivered':
      return <CheckCheck size={16} className="message-status" />;
    case 'sending':
      return <Loader size={16} className="message-status spinning" />;
    default:
      return null;
  }
};

const TypingIndicator = () => (
  <div className="typing-indicator">
    <span></span>
    <span></span>
    <span></span>
  </div>
);

const Messages = () => {
  const location = useLocation();
  const { accessToken, currentUser } = useAuth(); // Add this line
  const [initialized, setInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listingContext, setListingContext] = useState(null);
  const [messageQueue, setMessageQueue] = useState([]);
  
  // Add refs for the messages
  const messagesListRef = useRef(null);
  const isInitialLoad = useRef(true);
  const pendingMessageContent = useRef('');

  const getProfileImageUrl = (imageUrl) => {
    if (!imageUrl) return "/api/placeholder/128/128";
    return `${BACKEND_URL}${imageUrl}`;
  };

  // Force scroll to bottom on initial load
  const scrollToBottom = () => {
    if (messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchConversations();
      setInitialized(true);
    };
    init();
  }, []);

  // Special handling for initial message load
  useEffect(() => {
    if (!isLoading && messages.length > 0 && isInitialLoad.current) {
      scrollToBottom();
      isInitialLoad.current = false;
    }
  }, [isLoading, messages]);

  // Process message queue if there are pending messages
  useEffect(() => {
    const processMessageQueue = async () => {
      if (messageQueue.length > 0 && selectedConversation) {
        const messageContent = messageQueue[0];
        
        try {
          await axios.post(`${process.env.REACT_APP_API_URL}/messages`, {

            receiverId: selectedConversation.other_user_id,
            content: messageContent,
            listingId: location.state?.listingId
          }, {
            headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
          });

          // Remove this message from queue
          setMessageQueue(prev => prev.slice(1));
          
          // Update conversations but don't refetch messages to avoid scroll jump
          fetchConversations();
          
          // Add message to the local state without fetching from server
          const newMessage = {
            id: Date.now().toString(),
            content: messageContent,
            sender_id: currentUser?.id, // Use currentUser from context
            created_at: new Date().toISOString(),
            is_read: false
          };
          
          setMessages(prev => [...prev.filter(msg => !msg.id.toString().startsWith('temp-')), newMessage]);
          
        } catch (err) {
          console.error('Error sending message:', err);
          setError('Failed to send message');
          // Remove failed message from queue
          setMessageQueue(prev => prev.slice(1));
        }
      }
    };

    processMessageQueue();
  }, [messageQueue, selectedConversation, accessToken, currentUser]);

  useEffect(() => {
    if (!initialized || !location.state?.receiverId) return;

    const currentState = { ...location.state };
    window.history.replaceState({}, document.title);

    const handleInitialConversation = async () => {
      const existingConversation = conversations.find(
        conv => conv.other_user_id === parseInt(currentState.receiverId)
      );

      if (existingConversation) {
        handleSelectConversation(existingConversation);
      } else {
        const newConversation = {
          other_user_id: parseInt(currentState.receiverId),
          other_user_name: currentState.hostName || 'Host',
          other_user_image: null,
          listing_title: currentState.listingTitle,
          is_read: true
        };
        setSelectedConversation(newConversation);
      }

      if (currentState.listingTitle) {
        setListingContext({ title: currentState.listingTitle });
      }
    };

    handleInitialConversation();
  }, [initialized, location.state]);

  useEffect(() => {
    if (selectedConversation) {
      isInitialLoad.current = true;
      fetchMessages(selectedConversation.other_user_id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/messages/conversations`, {

        headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
      });
      setConversations(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to load conversations');
    }
  };

  const fetchMessages = async (receiverId) => {
    if (!receiverId) return;
    
    try {
      setIsLoading(true);
      
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/messages/conversation/${receiverId}`, {

        headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
      });
      
      setMessages(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const message = currentMessage.trim();
    
    if (message && selectedConversation) {
      // Store message content in case we need it
      pendingMessageContent.current = message;
      
      // Clear input field
      setCurrentMessage('');
      
      // Add temporary message to UI immediately
      const tempMessage = {
        id: 'temp-' + Date.now(),
        content: message,
        sender_id: currentUser?.id, // Use currentUser from context
        created_at: new Date().toISOString(),
        is_read: false
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Scroll to bottom immediately
      setTimeout(scrollToBottom, 0);
      
      // Add to message queue for processing
      setMessageQueue(prev => [...prev, message]);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    if (!conversation.is_read) {
      try {
        await axios.put(`${process.env.REACT_APP_API_URL}/messages/${conversation.id}/read`, {}, {

          headers: { Authorization: `Bearer ${accessToken}` } // Use accessToken from context
        });
        fetchConversations();
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }
  };

  return (
    <div className="messages-page">
      <Header />
      <div className="messages-container">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <div className="messages-layout">
          <div className="conversations-panel">
            <div className="conversations-header">
              <h2>Messages</h2>
              <button className="icon-button">
                <MoreVertical size={20} />
              </button>
            </div>
            <div className="search-messages">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="conversations-list">
              {isLoading && conversations.length === 0 ? (
                <div className="loading">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <EmptyState type="no-messages" />
              ) : (
                conversations
                  .filter(conv => 
                    conv.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    conv.content?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((conversation) => (
                    <div 
                      key={conversation.id} 
                      className={`conversation-item ${!conversation.is_read ? 'unread' : ''} ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                      onClick={() => handleSelectConversation(conversation)}
                    >
                      <img 
                        src={getProfileImageUrl(conversation.other_user_image)}
                        alt={conversation.other_user_name} 
                        className="avatar"
                      />
                      <div className="conversation-content">
                        <div className="conversation-header">
                          <h3>{conversation.other_user_name}</h3>
                          <span className="timestamp">
                           {new Date(conversation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {conversation.listing_title && (
                          <p className="conversation-listing">Re: {conversation.listing_title}</p>
                        )}
                        <p className="last-message">{conversation.content}</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="messages-panel">
            {!selectedConversation ? (
              <EmptyState type="no-conversation" />
            ) : (
              <>
                <div className="messages-header">
                  <div className="chat-info">
                    <img 
                      src={getProfileImageUrl(selectedConversation.other_user_image)}
                      alt={selectedConversation.other_user_name} 
                      className="avatar"
                    />
                    <div className="chat-info-text">
                      <h3>{selectedConversation.other_user_name}</h3>
                      {listingContext && (
                        <p className="listing-context">Re: {listingContext.title}</p>
                      )}
                    </div>
                  </div>
                  <button className="icon-button">
                    <MoreVertical size={20} />
                  </button>
                </div>
                <div className="messages-list" ref={messagesListRef}>
                  {isLoading ? (
                    <div className="loading">Loading messages...</div>
                  ) : (
                    <>
                      {messages.map((message) => {
                        const isSentByMe = currentUser && message.sender_id === currentUser.id;
                        const isTemp = message.id.toString().startsWith('temp-');
                        
                        return (
                          <div 
                            key={message.id} 
                            className={`message ${isSentByMe ? 'sent' : 'received'}`}
                          >
                            {!isSentByMe && (
                              <img 
                                src={getProfileImageUrl(message.sender_image)}
                                alt="Sender" 
                                className="message-avatar"
                              />
                            )}
                            <div className="message-content">
                              <p>{message.content}</p>
                              <div className="message-footer">
                                <span className="message-time">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isSentByMe && (
                                  <MessageStatus status={
                                    isTemp ? 'sending' : message.is_read ? 'delivered' : 'sent'
                                  } />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {isTyping && <TypingIndicator />}
                    </>
                  )}
                </div>
                <form className="message-input-container" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="send-button" 
                    disabled={!currentMessage.trim() || messageQueue.length > 0}
                  >
                    <Send size={20} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;