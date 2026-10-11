// Shared Tailwind CDN config. Palette is RedSun's own (no stock Tailwind hues);
// swap these when the brand palette arrives.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FBF6EF', 2: '#F4EADF', 3: '#EADCCB', card: '#FFFDF9' },
        ink: { DEFAULT: '#1D1412', 2: '#4A3530', muted: '#6E5247' },
        terra: { DEFAULT: '#A3401E', 700: '#84321A', 300: '#D9876A', 100: '#F6E2D8' },
        oxblood: { DEFAULT: '#6E1A12', 900: '#3F0E09' },
        sun: { DEFAULT: '#D9962B', 600: '#B57A1B', 200: '#F3D9A8', 100: '#FAEFD9' },
        clay: { DEFAULT: '#E3D3C4', 2: '#CDB8A5' },
        palm: { DEFAULT: '#22403A', 600: '#2F5A50', 200: '#C9D8D1', 100: '#E4ECE7' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
