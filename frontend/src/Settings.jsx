import React, { useState } from "react";
import { Card, Button, Input } from "./components/ui";
import {
  Key,
  ShieldCheck,
  Save,
  Check,
  AlertTriangle,
} from "lucide-react";

function Settings() {
  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ text: "", type: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  const username = localStorage.getItem("username") || "user";

  const handlePasswordChange = async () => {
    setPasswordMsg({ text: "", type: "" });
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ text: "All fields are required.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ text: "New password must be at least 8 characters.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (res.ok) {
        setPasswordMsg({ text: "Password changed successfully.", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        setPasswordMsg({ text: err.detail || "Failed to change password.", type: "error" });
      }
    } catch {
      setPasswordMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Account settings</p>
        </div>

        {/* Account */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gray-400" />
            Account
          </h2>
          <Card className="p-5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Username</span>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{username}</p>
          </Card>
        </section>

        {/* Password */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Key className="h-4 w-4 text-gray-400" />
            Change Password
          </h2>
          <Card className="p-5 space-y-4">
            {[
              { label: "Current Password", value: currentPassword, set: setCurrentPassword },
              { label: "New Password", value: newPassword, set: setNewPassword },
              { label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
                <Input type="password" value={value} onChange={(e) => set(e.target.value)} placeholder="••••••••" />
              </div>
            ))}

            {passwordMsg.text && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
                  passwordMsg.type === "success"
                    ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/[0.08] text-red-400 border-red-500/20"
                }`}
              >
                {passwordMsg.type === "success" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {passwordMsg.text}
              </div>
            )}

            <Button onClick={handlePasswordChange} loading={changingPassword}>
              <Save className="h-4 w-4" />
              {changingPassword ? "Saving…" : "Update Password"}
            </Button>
          </Card>
        </section>
      </div>
    </div>
  );
}

export default Settings;
