import api from "../services/Api";

function Logout() {
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout"); // Refresh token is invalidated
      window.location.reload(); // Reset UI
    } catch {
      alert("Logout failed.");
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
}

export default Logout;
