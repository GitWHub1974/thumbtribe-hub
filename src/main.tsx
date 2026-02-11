import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Debug: check env vars
console.log("ENV CHECK:", {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "SET" : "MISSING",
  MODE: import.meta.env.MODE,
  ALL_KEYS: Object.keys(import.meta.env),
});

createRoot(document.getElementById("root")!).render(<App />);
