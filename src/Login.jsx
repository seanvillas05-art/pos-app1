import { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    // Example hardcoded users
    const users = {
      admin: { username: "admin", password: "admin123", role: "Administrator" },
      cashier: { username: "cashier", password: "cashier123", role: "Cashier" }
    };

    if (
      username === users.admin.username &&
      password === users.admin.password
    ) {
      onLogin(users.admin);
    } else if (
      username === users.cashier.username &&
      password === users.cashier.password
    ) {
      onLogin(users.cashier);
    } else {
      alert("Invalid login");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-lg w-80"
      >
        <h2 className="text-xl font-bold mb-4 text-center">Login</h2>
        <input
          type="text"
          placeholder="Username"
          className="w-full border p-2 mb-3 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border p-2 mb-3 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-blue-500 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
