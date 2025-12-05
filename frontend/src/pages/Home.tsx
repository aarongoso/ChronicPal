import { Link } from "react-router-dom";

function Home() {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white shadow-md rounded-xl p-10 w-full max-w-xl text-center">
        <h1 className="text-3xl font-bold mb-4">ChronicPal</h1>

        <p className="text-gray-700 mb-6">
          A secure platform for managing chronic illnesses, tracking symptoms,
          and safely sharing medical records.
        </p>

        {/* When user is NOT logged in */}
        {!token && (
          <div className="flex justify-center gap-4 mt-6">
            <Link
              to="/login"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="px-6 py-2 bg-gray-300 text-black rounded-lg hover:bg-gray-400"
            >
              Register
            </Link>
          </div>
        )}

        {/* When logged in – guide users to dashboard */}
        {token && (
          <div className="flex flex-col items-center mt-6">
            {role === "admin" ? (
              <Link
                to="/admin"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-48 text-center"
              >
                Go to Admin Dashboard
              </Link>
            ) : (
              <Link
                to="/dashboard"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-48 text-center"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;