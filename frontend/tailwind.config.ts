import type { Config } from "tailwindcss";

/**
 * Design tokens ported 1:1 from the original design prototype (:root).
 * The "light aurora" system: paper/ink neutrals, blue→violet→pink accents,
 * three typefaces (Bricolage Grotesque / Hanken Grotesk / JetBrains Mono).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        tint: "var(--tint)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
        },
        muted: "var(--muted)",
        line: "var(--line)",
        blue: "var(--blue)",
        violet: "var(--violet)",
        pink: "var(--pink)",
        mint: "var(--mint)",
        red: "var(--red)",
        amber: "var(--amber)",
        dark: {
          DEFAULT: "var(--dark)",
          2: "var(--dark-2)",
        },
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Hanken Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "14px",
        lg: "22px",
        xl: "30px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(11,12,16,.05), 0 4px 14px rgba(11,12,16,.05)",
        md: "0 2px 6px rgba(11,12,16,.06), 0 16px 40px rgba(11,12,16,.10)",
        ink: "0 8px 24px rgba(11,12,16,.22)",
      },
      maxWidth: {
        wrap: "1180px",
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(.2,.8,.25,1)",
      },
      keyframes: {
        drift: {
          from: { transform: "translate(0,0) scale(1)" },
          to: { transform: "translate(60px,50px) scale(1.12)" },
        },
        pop: {
          from: { opacity: "0", transform: "translateY(26px) scale(.98)" },
          to: { opacity: "1", transform: "none" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "none" },
        },
        shake: {
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        pulse: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.14)" },
        },
      },
      animation: {
        "drift-a": "drift 16s ease-in-out infinite alternate",
        "drift-b": "drift 20s ease-in-out infinite alternate-reverse",
        "drift-c": "drift 24s ease-in-out infinite alternate",
        pop: "pop .8s cubic-bezier(.2,.8,.25,1) both",
        slideIn: "slideIn .45s cubic-bezier(.2,.8,.25,1)",
        shake: "shake .45s cubic-bezier(.2,.8,.25,1)",
        "pulse-node": "pulse 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
