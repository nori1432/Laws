/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark and Golden Theme
        primary: {
          DEFAULT: '#D4AF37', // Gold
          50: '#F9F6E8',
          100: '#F3E8C6',
          200: '#E8D4A2',
          300: '#E0C97D',
          400: '#D4AF37',
          500: '#B8941F',
          600: '#9C7A1A',
          700: '#7D6114',
          800: '#5E480F',
          900: '#3F2F0A',
        },
        secondary: {
          DEFAULT: '#1A1A1A', // Dark Gray
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#CCCCCC',
          300: '#B3B3B3',
          400: '#999999',
          500: '#808080',
          600: '#666666',
          700: '#4D4D4D',
          800: '#333333',
          900: '#1A1A1A',
        },
        accent: {
          DEFAULT: '#2D2D2D', // Darker Gray
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
        background: {
          DEFAULT: '#0F0F0F', // Very Dark
          secondary: '#1A1A1A',
          tertiary: '#2D2D2D',
        },
        foreground: '#FFFFFF',
        muted: {
          DEFAULT: '#404040',
          foreground: '#A0A0A0',
        },
        card: {
          DEFAULT: '#1A1A1A',
          foreground: '#FFFFFF',
        },
        border: '#404040',
        input: '#2D2D2D',
        ring: '#D4AF37',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #B8941F 100%)',
        'gradient-luxury': 'linear-gradient(135deg, #0F0F0F 0%, #2D2D2D 50%, #1A1A1A 100%)',
      },
      boxShadow: {
        'luxury': '0 20px 40px rgba(212, 175, 55, 0.1)',
        'dark': '0 10px 30px rgba(0, 0, 0, 0.3)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}
