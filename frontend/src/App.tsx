import React, { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('Error: Could not connect to backend'));
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>ChronicPal Frontend</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;
