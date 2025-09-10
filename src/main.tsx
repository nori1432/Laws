// @ts-nocheck
/* eslint-disable */
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './ignoreErrors.js'; // Import the error disabler

// Remove StrictMode to reduce warnings
createRoot(document.getElementById('root')).render(<App />);
