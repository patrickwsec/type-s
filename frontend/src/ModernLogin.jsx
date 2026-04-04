import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Input, Spinner } from "./components/ui";
import { Lock, User, Eye, EyeOff } from "lucide-react";

function ModernLogin() {
  const navigate = useNavigate();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkUserExists();
  }, []);

  const checkUserExists = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/check-account`, {
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Error checking user existence:", await response.text());
        return;
      }

      const data = await response.json();
      if (!data.exists) {
        setIsRegisterMode(true);
      }
    } catch (error) {
      console.error("Error checking user existence:", error);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (response.ok) {
        // Save username to localStorage
        localStorage.setItem("username", username);
        navigate("/");
      } else {
        const data = await response.json();
        setError(data.detail || "Login failed");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (response.ok) {
        // After successful registration, automatically log in
        await handleLogin();
      } else {
        const data = await response.json();
        setError(data.detail || "Registration failed");
      }
    } catch (error) {
      console.error("Error during registration:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegisterMode) {
      handleRegister();
    } else {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4">
            <Lock className="h-5 w-5 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1.5 tracking-tight">
            TYPE [S]
          </h1>
          <p className="text-gray-500 text-sm">
            {isRegisterMode 
              ? "Create your admin account" 
              : "Sign in to continue"
            }
          </p>
        </div>

        {/* Login/Register Card */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 bg-white/[0.04] border-white/[0.08] text-gray-200 rounded-lg focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/30 placeholder-gray-600 text-sm"
                    placeholder="Enter username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 bg-white/[0.04] border-white/[0.08] text-gray-200 rounded-lg focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/30 placeholder-gray-600 text-sm"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors p-1 rounded-md hover:bg-white/[0.06]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isRegisterMode && (
                  <p className="mt-2 text-xs text-gray-500 bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-lg">
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-11 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-[0_4px_12px_rgba(139,92,246,0.25)] text-sm"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>{isRegisterMode ? "Creating..." : "Signing in..."}</span>
                </>
              ) : (
                <span>{isRegisterMode ? "Create Account" : "Sign In"}</span>
              )}
            </Button>

            {/* Mode Switch */}
            {!isRegisterMode && (
              <div className="text-center pt-4 border-t border-white/[0.04]">
                <p className="text-sm text-gray-500">
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => setIsRegisterMode(true)}
                    className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                  >
                    Register
                  </button>
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-[11px] text-gray-600">
            TYPE [S] — Attack Surface Management
          </p>
        </div>
      </div>
    </div>
  );
}

export default ModernLogin;
