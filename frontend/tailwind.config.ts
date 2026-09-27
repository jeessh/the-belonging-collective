import type { Config } from "tailwindcss";

/**
 * Design tokens, from the Figma "Final" page (file 0wXuDItlg03uwYoVqRvDZQ,
 * Components frame 393:6562). `components/ui/*` is built on these; new
 * screens should reach for them rather than raw hex.
 *
 * The first block (`paper` … `pop`) is the pre-redesign palette. It stays
 * until every screen that uses it has been rebuilt — don't use it for new
 * work, and don't repoint it at the new colours, which would restyle those
 * screens by accident.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy — see above.
        paper: "#EEEBF5",
        card: "#FFFFFF",
        ink: "#201B33",
        muted: "#6B6580",
        edge: "#E2DEF0",
        accent: "#5B5BD6",
        attend: "#2FA36B",
        pop: "#FF7A4D",

        // Text and icons.
        fg: {
          DEFAULT: "#1A1A1A",
          muted: "#6D6D6D",
          icon: "#2E2E2E",
          "icon-muted": "#838383",
        },
        // Surfaces.
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F1F1F1",
        },
        // Hairlines. `card` is the 2px card outline; `active` the toggle's.
        line: {
          DEFAULT: "#BABABA",
          active: "#CBCBCB",
          card: "#DCDCDC",
        },
        // The cyan. Buttons are `primary` fill + `primary-border`; the view
        // toggle's selected segment is the paler `soft`; `strong` is the solid
        // fill (the guest toast's CTA) and `active` the option toggle's thumb.
        primary: {
          DEFAULT: "#94EAFF",
          border: "#00CDFF",
          soft: "#E5FAFF",
          strong: "#38D0F5",
          active: "#6FDAF4",
        },
        // Tag pills, fill + text per kind. Paired so the text always sits on
        // its own fill; never mix a `-bg` with another kind's `-fg`.
        tag: {
          "free-bg": "#D0F9B9",
          "free-fg": "#265B08",
          "paid-bg": "#C7DAFF",
          "paid-fg": "#004BDE",
          "dropin-bg": "#FFEAA9",
          "dropin-fg": "#6E5400",
          "signup-bg": "#FFE5F8",
          "signup-fg": "#7D005B",
          "inperson-bg": "#F5E1FF",
          "inperson-fg": "#610591",
          "virtual-bg": "#FFDFE3",
          "virtual-fg": "#7F000E",
        },
        // Toast borders; the fills reuse tag/primary tokens (see ui/Toast).
        toast: {
          success: "#286A02",
          info: "#00CDFF",
          alert: "#FD9BA6",
        },
        // The "Yes, delete" fill.
        danger: {
          DEFAULT: "#FFD0D5",
          border: "#FD9BA6",
        },
      },
      borderRadius: {
        control: "8px", // buttons, tags, inputs, images
        field: "18px", // the floating-label text field
        card: "24px", // cards, modals
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 24px 60px -20px rgba(32,27,51,0.35)",
        lift: "0 40px 90px -24px rgba(32,27,51,0.5)",
        toast:
          "0 16px 17px rgba(0,0,0,0.10), 0 62px 31px rgba(0,0,0,0.09), 0 141px 42px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
