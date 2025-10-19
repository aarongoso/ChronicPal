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
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-blue-100 to-blue-300 text-center">
      <h1 className="text-4xl font-bold text-blue-900 mb-4">
        ChronicPal Frontend
      </h1>
      <p className="text-lg text-gray-800">{status}</p>
    </div>
  );
}

export default App;
