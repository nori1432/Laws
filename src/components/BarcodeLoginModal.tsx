import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, X } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanningRef = useRef<boolean>(false);

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraSupported(false);
          setCameraError('Camera not supported in this browser');
          return;
        }

        // Check permissions
        if (navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('Camera permission status:', permission.state);
        }
      } catch (err) {
        console.log('Permission check error:', err);
      }
    };

    checkCameraSupport();
  }, []);

  // Start camera - Ultra simplified approach
  const startCamera = async () => {
    console.log('🚀 Starting camera...');
    
    try {
      // Reset states
      setCameraError('');
      setCameraLoading(true);
      setVideoPlaying(false);
      
      // Show camera container immediately
      setShowCamera(true);
      
      // Clean up any existing streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Get camera stream
      console.log('📷 Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: 640,
          height: 480
        }
      });

      streamRef.current = stream;
      console.log('✅ Got stream:', stream.active);

      // Wait a moment for DOM
      await new Promise(resolve => setTimeout(resolve, 200));

      if (videoRef.current) {
        const video = videoRef.current;
        
        // Set video source
        video.srcObject = stream;
        
        // Force play
        try {
          await video.play();
          console.log('✅ Video playing');
          setVideoPlaying(true);
          setCameraLoading(false);
          
          // Start scanning
          scanningRef.current = true;
          startBarcodeScanning();
          
        } catch (playErr) {
          console.error('Play error:', playErr);
          // Try alternative approach
          video.muted = true;
          video.playsInline = true;
          await video.play();
          setVideoPlaying(true);
          setCameraLoading(false);
          scanningRef.current = true;
          startBarcodeScanning();
        }
      } else {
        throw new Error('Video element not found');
      }
      
    } catch (err: any) {
      console.error('❌ Camera failed:', err);
      setCameraError(`Camera error: ${err.message}`);
      setCameraLoading(false);
      setShowCamera(false);
    }
  };

  // Separate function for barcode scanning
  const startBarcodeScanning = async () => {
    console.log('🔍 Starting barcode scanning...');
    
    // Initialize ZXing code reader
    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserMultiFormatReader();
    }
    
    const scan = async () => {
      if (!scanningRef.current || !videoRef.current || !codeReaderRef.current) {
        return;
      }

      try {
        const result = await codeReaderRef.current.decodeFromVideoElement(videoRef.current);
        if (result && scanningRef.current) {
          const barcode = result.getText();
          console.log('📊 Barcode detected:', barcode);
          
          // Stop scanning and process barcode
          scanningRef.current = false;
            setScannedBarcode(barcode);
            setBarcode(barcode); // Show in input
            stopCamera();
            // Auto-submit barcode
            handleBarcodeSubmitWithValue(barcode);
          return;
        }
      } catch (err) {
        if (!(err instanceof NotFoundException)) {
          console.error('🚫 Scan error:', err);
        }
      }

      // Continue scanning
      if (scanningRef.current) {
        setTimeout(scan, 100);
      }
    };

    // Start scanning with a small delay
    setTimeout(scan, 500);
  };

  // Stop camera
  const stopCamera = () => {
    console.log('Stopping camera...');
    scanningRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (err) {
        console.log('Error resetting code reader:', err);
      }
    }
    
    setShowCamera(false);
    setVideoPlaying(false);
    setCameraError('');
    setCameraLoading(false);
  };

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
      <div className="bg-card rounded-xl shadow-luxury max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden shadow-lg border-2 border-gray-300">
                  {/* Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay={true}
                    playsInline={true}
                    muted={true}
                    controls={false}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      backgroundColor: '#000000',
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onLoadedMetadata={() => {
                      console.log('📺 Video metadata loaded');
                      setVideoPlaying(true);
                      setCameraLoading(false);
                    }}
                    onCanPlay={() => {
                      console.log('🎬 Video can play');
                    }}
                    onError={(e) => {
                      console.error('❌ Video element error:', e);
                      setCameraError('Video playback failed');
                    }}
                  />
                  
                  {/* Loading Overlay */}
                  {cameraLoading && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
                      <div className="text-center text-white">
                        <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm font-medium">Loading Camera...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Scanning Frame */}
                  {!cameraLoading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="border-4 border-green-400 bg-green-400/10 rounded-lg w-[300px] h-[200px] shadow-2xl">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-green-400 text-xs font-bold bg-black/60 px-2 py-1 rounded">
                            SCAN AREA
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg z-30"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  {/* Status Bar */}
                  <div className="absolute top-3 left-3 bg-black/80 text-white px-3 py-1 rounded-full text-xs font-medium z-30">
                    {cameraLoading ? '🔄 Starting...' : videoPlaying ? '📹 Live' : '⏳ Loading...'}
                  </div>
                  
                  {/* Instructions */}
                  <div className="absolute bottom-3 left-0 right-0 text-center z-30">
                    <div className="inline-block bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
                      📱 Hold barcode steady in the green frame
                    </div>
                  </div>
                    {/* Scanned Barcode Display */}
                    {scannedBarcode && (
                      <div className="absolute bottom-16 left-0 right-0 text-center z-30">
                        <div className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold animate-pulse">
                          {t('barcodeDetected')}: {scannedBarcode}
                        </div>
                      </div>
                    )}
                </div>
              )}

                {/* Show input and scan button only if camera is not active */}
                {!showCamera && !cameraLoading && (
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
                        className="py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
                        disabled={isLoading || cameraLoading || !cameraSupported}
                        title={!cameraSupported ? "Camera not supported" : "Click to start camera barcode scanner"}
                      >
                        <Camera className="w-5 h-5" />
                        <span>
                          {!cameraSupported ? 'Not Available' : cameraLoading ? 'Starting...' : 'Scan'}
                        </span>
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

