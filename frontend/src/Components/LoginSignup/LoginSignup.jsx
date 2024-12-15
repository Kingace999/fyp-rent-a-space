import React, { useState } from 'react';
import './LoginSignup.css';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import axios from 'axios'; // Import axios for API calls

import user_icon from '../Assests/person.png';
import password_icon from '../Assests/password.png';
import email_icon from '../Assests/email.png';

const LoginSignup = () => {
  const [action, setAction] = useState('Login'); // Tracks whether Login or Sign Up
  const [name, setName] = useState(''); // Tracks user name for Sign Up
  const [email, setEmail] = useState(''); // Tracks email input
  const [password, setPassword] = useState(''); // Tracks password input
  const [message, setMessage] = useState(''); // Feedback message for user (e.g., success/error)
  const [loading, setLoading] = useState(false); // Tracks loading state during API calls

  const navigate = useNavigate(); // Initialize useNavigate for navigation

  const handleSubmit = async () => {
    setLoading(true); // Start loading
    setMessage(''); // Clear previous messages

    try {
      if (action === 'Sign Up') {
        // Call the signup API
        const response = await axios.post('http://localhost:5000/auth/signup', {
          name,
          email,
          password,
        });
        setMessage(response.data.message); // Show success message
        navigate('/dashboard'); // Redirect to Dashboard on success
      } else if (action === 'Login') {
        // Call the login API
        const response = await axios.post('http://localhost:5000/auth/login', {
          email,
          password,
        });
        setMessage(`Welcome, ${response.data.user.name}`); // Show welcome message
        navigate('/dashboard'); // Redirect to Dashboard on success
      }
    } catch (error) {
      // Handle error and show appropriate message
      setMessage(error.response?.data?.message || 'An error occurred.');
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div className='container'>
      <div className="header">
        <div className="text">{action}</div>
        <div className="underline"></div>
      </div>
      <div className="inputs">
        {/* Show Name input only for Sign Up */}
        {action === "Sign Up" && (
          <div className="input">
            <img src={user_icon} alt="User Icon" />
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="input">
          <img src={email_icon} alt="Email Icon" />
          <input
            type="email"
            placeholder="Email Id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="input">
          <img src={password_icon} alt="Password Icon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      {/* Feedback message */}
      {message && <div className="message">{message}</div>}
      {/* Forgot password for Login */}
      {action === "Login" && (
        <div className="forgot-password">
          Lost Password? <span>Click Here!</span>
        </div>
      )}
      <div className="submit-container">
        <div className="button-row">
          <div
            className={action === "Login" ? "submit gray" : "submit"}
            onClick={() => setAction("Sign Up")}
          >
            Sign Up
          </div>
          <div
            className={action === "Sign Up" ? "submit gray" : "submit"}
            onClick={() => setAction("Login")}
          >
            Login
          </div>
        </div>
        <div className="submit" onClick={handleSubmit}>
          {loading ? 'Loading...' : 'Submit'}
        </div>
      </div>
    </div>
  );
};

export default LoginSignup;
