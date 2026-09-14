import React from "react";
import * as I from "lucide-react";
import { useSession } from "../context/SessionContext";

export function ErrorNotice() {
  const { session } = useSession();
  return session.error ? (
    <div
      style={{
        background: "var(--amber-light, #fef3c7)",
        border: "1px solid #fde68a",
        color: "#92400e",
        padding: "12px 16px",
        borderRadius: 12,
        marginTop: 14,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <I.AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span>{session.error}</span>
    </div>
  ) : null;
}

export default ErrorNotice;
