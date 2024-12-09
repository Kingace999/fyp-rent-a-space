import React, { useEffect, useState } from 'react';
import axios from 'axios';

const App = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000') // Backend endpoint
      .then(response => setMessage(response.data.message)) // Ensure we access "message" from backend JSON
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  return <h1>{message}</h1>; // Display the message from backend
};

export default App; // new check to e