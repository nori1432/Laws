import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, X } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

interface BarcodeLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentInfo {
  id: number;
  name: string;
  date_of_birth: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
}

const BarcodeLoginModal: React.FC<BarcodeLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { language, t, isRTL } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';

  const [barcode, setBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera for barcode scanning
  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied. Please allow camera access and try again.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCameraError('');
  };

  // Detect barcode from video stream using BarcodeDetector API
  const detectBarcode = async () => {
    if (!videoRef.current || !showCamera) return;

    try {
      // Check if BarcodeDetector is supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code']
        });
        
        const barcodes = await barcodeDetector.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const detectedBarcode = barcodes[0].rawValue;
          setBarcode(detectedBarcode);
          stopCamera();
          // Automatically submit the barcode
          handleBarcodeSubmitWithValue(detectedBarcode);
        }
      } else {
        // Fallback: Manual capture
        setCameraError('Barcode detection not supported on this browser. Please enter manually.');
      }
    } catch (err) {
      console.error('Barcode detection error:', err);
    }
  };

  // Continuous barcode detection
  useEffect(() => {
    if (showCamera) {
      const interval = setInterval(detectBarcode, 500); // Check every 500ms
      return () => clearInterval(interval);
    }
  }, [showCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleBarcodeSubmitWithValue = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.VALIDATE_BARCODE}`, {
        barcode: barcodeValue.trim()
      });

      setStudentInfo(response.data.student);
      setShowSetupForm(true);
      // Pre-fill phone if available
      if (response.data.student.parent_phone) {
        setPhone(response.data.student.parent_phone);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || t('invalidBarcode'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleBarcodeSubmitWithValue(barcode);
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !password.trim()) {
      setError(t('allFieldsRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // ✅ Call barcode-setup-login to UPDATE existing user with phone + password
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.BARCODE_SETUP_LOGIN}`, {
        barcode: barcode.trim(),
        phone: phone.trim(),
        password: password.trim()
      });

      // Get JWT token and user data from response
      const { access_token, user } = response.data;

      // Save token to localStorage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // ✅ Manually update auth context (don't call login() - we already have the token)
      // The auth context will be updated when the page loads
      
      // Close modal and trigger success callback
      onSuccess();

    } catch (error: any) {
      console.error('Barcode setup error:', error);
      const errorMessage = error.response?.data?.error || t('setupFailed');
      setError(errorMessage);
      
      // Log detailed error for debugging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    stopCamera(); // Stop camera if active
    setBarcode('');
    setStudentInfo(null);
    setShowSetupForm(false);
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setCameraError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-luxury max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-4h4m-4-6h4m0 0v6m0-6V4m0 6H8m4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {showSetupForm ? t('completeSetup') : t('barcodeLogin')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {showSetupForm ? t('setupInstructions') : t('enterBarcode')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-yellow-600 dark:text-yellow-400 text-sm">{cameraError}</p>
            </div>
          )}

          {!showSetupForm ? (
            /* Barcode Input Form */
            <div className="space-y-4">
              {/* Camera View */}
              {showCamera && (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border-2 border-primary"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-primary bg-primary/10 rounded-lg w-3/4 h-1/2"></div>
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <p className="text-center mt-2 text-sm text-muted-foreground">
                    Position barcode within the frame
                  </p>
                </div>
              )}

              {!showCamera && (
                <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('barcode')}
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="block w-full px-3 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg font-mono"
                      placeholder="123456789"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 bg-gradient-gold text-secondary rounded-lg font-medium hover:shadow-luxury transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLoading || !barcode.trim()}
                    >
                      {isLoading ? t('validating') : t('validateBarcode')}
                    </button>

                    <button
                      type="button"
                      onClick={startCamera}
                      className="py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all duration-300 flex items-center gap-2"
                      disabled={isLoading}
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Setup Form */
            <div className="space-y-4">
              {/* Student Info Display */}
              {studentInfo && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {t('studentInfo')}
                  </h3>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p><strong>{t('studentNameLabel')}:</strong> {studentInfo.name}</p>
                    <p><strong>{t('dateOfBirthLabel')}:</strong> {new Date(studentInfo.date_of_birth).toLocaleDateString()}</p>
                    {studentInfo.parent_name && (
                      <p><strong>{t('parent')}:</strong> {studentInfo.parent_name}</p>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('phoneNumberLabel')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full px-3 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="+213XXXXXXXXX"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('createPasswordPlaceholder')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('confirmPasswordLabel')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-gold text-secondary rounded-lg font-medium hover:shadow-luxury transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !phone.trim() || !password.trim() || !confirmPassword.trim()}
                >
                  {isLoading ? t('settingUp') : t('completeSetup')}
                </button>
              </form>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={resetModal}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              {t('closeModal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeLoginModal;