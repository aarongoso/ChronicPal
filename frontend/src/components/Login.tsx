import React, { useState } from "react";
import api from "../services/Api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const sanitize = (value: string) =>
    value.replace(/[<>]/g, ""); // Prevent XSS input

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/login", {
        email: sanitize(email),
        password: sanitize(password),
      });

      // Access token is returned in body
      // Refresh token stored securely in HTTP only cookie
      setMessage("Login successful.");

      // Store the access token for authenticated actions
      localStorage.setItem("accessToken", res.data.token);
    } catch {
      setMessage("Invalid login. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 w-80 shadow-lg rounded-xl"
      >
        <h2 className="text-2xl font-bold text-center mb-4">Login</h2>

        <input
          type="email"
          placeholder="Email"
          onChange={(e) => setEmail(sanitize(e.target.value))}
          className="w-full p-2 border rounded mb-3"
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(sanitize(e.target.value))}
          className="w-full p-2 border rounded mb-3"
        />

        <button className="bg-blue-600 w-full text-white p-2 rounded-lg hover:bg-blue-700">
          Login
        </button>

        {message && (
          <p className="text-center mt-4 text-sm text-gray-700">{message}</p>
        )}
      </form>
    </div>
  );
}

export default Login;