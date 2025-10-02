import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
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

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.VALIDATE_BARCODE}`, {
        barcode: barcode.trim()
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
    setBarcode('');
    setStudentInfo(null);
    setShowSetupForm(false);
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setError('');
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

          {!showSetupForm ? (
            /* Barcode Input Form */
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

              <button
                type="submit"
                className="w-full py-3 px-4 bg-gradient-gold text-secondary rounded-lg font-medium hover:shadow-luxury transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !barcode.trim()}
              >
                {isLoading ? t('validating') : t('validateBarcode')}
              </button>
            </form>
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