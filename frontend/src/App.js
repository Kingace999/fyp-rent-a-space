import React, { useEffect, useState } from 'react'; 
import axios from 'axios';
import LoginSignup from './Components/LoginSignup/LoginSignup';
import './App.css';
import logo from './logo.svg';

const App = () => {
  const [message, setMessage] = useState('');

  // Fetch the message from backend (keeps the connection)
  useEffect(() => {
    axios
      .get('http://localhost:5000') // Backend endpoint
      .then(response => setMessage(response.data.message)) // Store message from backend
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  return (
    <div>
      <LoginSignup/>
    </div>
  );
};

export default App;
