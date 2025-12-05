import React from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/Api";

// logout button that clears tokens both server side and client side
const Logout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");

      // clear all local auth info
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");

      navigate("/login");

      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Logout failed. Please try again.");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
    >
      Logout
    </button>
  );
};

export default Logout;
