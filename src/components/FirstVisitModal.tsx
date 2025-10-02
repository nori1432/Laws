import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import BarcodeLoginModal from './BarcodeLoginModal';

interface FirstVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FirstVisitModal: React.FC<FirstVisitModalProps> = ({ isOpen, onClose }) => {
  const { language, t, isRTL } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showBarcodeLogin, setShowBarcodeLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if this is first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedBefore');
    if (!hasVisited && !isOpen) {
      // This will be handled by the parent component
    }
  }, [isOpen]);

  const handleOldStudent = () => {
    setShowBarcodeLogin(true);
  };

  const handleNewStudent = () => {
    // Mark as visited and close modal
    localStorage.setItem('hasVisitedBefore', 'true');
    onClose();
    // Navigate to registration or landing page
    navigate('/register');
  };

  const handleBarcodeLoginSuccess = () => {
    // Mark as visited and close modal
    localStorage.setItem('hasVisitedBefore', 'true');
    setShowBarcodeLogin(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-xl shadow-luxury max-w-md w-full mx-4">
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('welcomeBack')}
              </h2>
              <p className="text-muted-foreground">
                {t('firstVisitQuestion')}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <button
                onClick={handleOldStudent}
                className="w-full py-4 px-6 bg-gradient-gold text-secondary rounded-lg font-medium hover:shadow-luxury transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-3"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{t('existingStudent')}</span>
              </button>

              <button
                onClick={handleNewStudent}
                className="w-full py-4 px-6 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-primary-foreground transition-all duration-300 flex items-center justify-center space-x-3"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>{t('newStudent')}</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                {t('chooseCorrectOption')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Login Modal */}
      <BarcodeLoginModal
        isOpen={showBarcodeLogin}
        onClose={() => setShowBarcodeLogin(false)}
        onSuccess={handleBarcodeLoginSuccess}
      />
    </>
  );
};

export default FirstVisitModal;
