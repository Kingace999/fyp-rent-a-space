import React, { useState } from 'react';
import './LoginSignup.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import user_icon from '../Assests/person.png';
import password_icon from '../Assests/password.png';
import email_icon from '../Assests/email.png';

const LoginSignup = () => {
  const [action, setAction] = useState('Login'); // Tracks whether Login or Sign Up
  const [name, setName] = useState(''); // Tracks user name for Sign Up
  const [email, setEmail] = useState(''); // Tracks email input
  const [password, setPassword] = useState(''); // Tracks password input
  const [message, setMessage] = useState(''); // Feedback message for user
  const [errors, setErrors] = useState({}); // Form validation errors
  
  const { login, signup, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from location state or default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  // Form validation
  // Form validation
const validateForm = () => {
  const newErrors = {};
  
  if (action === 'Sign Up' && !name.trim()) {
    newErrors.name = 'Name is required';
  }
  
  if (!email.trim()) {
    newErrors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    newErrors.email = 'Email is invalid';
  }
  
  if (!password) {
    newErrors.password = 'Password is required';
  } else if (action === 'Sign Up') {
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(password)) {
      newErrors.password = 'Password must contain at least one special character';
    }
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

  const handleSubmit = async () => {
    setMessage('');
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      if (action === 'Sign Up') {
        await signup(name, email, password);
        setMessage('Account created successfully!');
        navigate(from, { replace: true });
      } else {
        await login(email, password);
        setMessage('Login successful!');
        navigate(from, { replace: true });
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'An error occurred');
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
            {errors.name && <span className="error">{errors.name}</span>}
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
          {errors.email && <span className="error">{errors.email}</span>}
        </div>
        <div className="input">
          <img src={password_icon} alt="Password Icon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>
      </div>
      {message && <div className="message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      {action === "Login" && (
        <div className="forgot-password">
          Lost Password? <span>Click Here!</span>
        </div>
      )}
      <div className="submit-container">
        <div className="button-row">
          <div
            className={action === "Login" ? "submit gray" : "submit"}
            onClick={() => {
              setAction("Sign Up");
              setMessage('');
              setErrors({});
            }}
          >
            Sign Up
          </div>
          <div
            className={action === "Sign Up" ? "submit gray" : "submit"}
            onClick={() => {
              setAction("Login");
              setMessage('');
              setErrors({});
            }}
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