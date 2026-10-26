import React, { useState } from "react";

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
}

/**
 * Accessible, zero-latency developer tooltip with optional keyboard shortcut hint.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  children,
  position = "top",
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200 shadow-lg whitespace-nowrap transition-opacity duration-150 ${
            position === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="ml-2 font-mono text-[11px] text-sky-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
