import React, { useState } from 'react';
import './LoginSignup.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  const navigate = useNavigate();

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');

    try {
      if (action === 'Sign Up') {
        const response = await axios.post('http://localhost:5000/auth/signup', {
          name,
          email,
          password,
        });

        setMessage(response.data.message); // Show success message
        const { token, user } = response.data;

        // Store token in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        navigate('/dashboard'); // Redirect to Dashboard
      } else if (action === 'Login') {
        const response = await axios.post('http://localhost:5000/auth/login', {
          email,
          password,
        });

        setMessage(`Welcome, ${response.data.user.name}`);
        const { token, user } = response.data;

        // Store token in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        navigate('/dashboard'); // Redirect to Dashboard
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div className="text">{action}</div>
        <div className="underline"></div>
      </div>
      <div className="inputs">
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
      {message && <div className="message">{message}</div>}
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
