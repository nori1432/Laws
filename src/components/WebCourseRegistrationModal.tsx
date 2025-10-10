import React, { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, Loader2, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Cookies from 'js-cookie';

interface WebCourseRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WebCourseRegistrationModal: React.FC<WebCourseRegistrationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const WEBHOOK_URL =
    'https://discord.com/api/webhooks/1426279779077722134/ZVaogMRvsZH5zAf9CgMA1ECwHWLvbs8nzolrisl-eMqN855qgzl7QR2sE9k58ZhxRtiu';
  const COOKIE_NAME = 'webCourseSubmitted';
  const MIN_AGE = 16;

  useEffect(() => {
    // Check if user has already submitted
    const submitted = Cookies.get(COOKIE_NAME);
    if (submitted === 'true') {
      setHasSubmitted(true);
    }
  }, []);

  const content = {
    en: {
      title: 'Register for Web Development Course',
      subtitle: 'Fill in your information to reserve your spot',
      fullName: 'Full Name',
      fullNamePlaceholder: 'Enter your full name',
      phone: 'Phone Number',
      phonePlaceholder: 'Enter your phone number',
      age: 'Age',
      agePlaceholder: 'Enter your age',
      submitBtn: 'Submit Registration',
      submittingBtn: 'Submitting...',
      successTitle: 'Registration Successful!',
      successMessage: 'Thank you for registering. We will contact you soon!',
      closeBtn: 'Close',
      errorRequired: 'Please fill in all fields',
      errorMinAge: `You must be at least ${MIN_AGE} years old to register`,
      errorInvalidAge: 'Please enter a valid age',
      errorInvalidPhone: 'Please enter a valid phone number',
      errorSubmission: 'Failed to submit. Please try again.',
      alreadySubmitted: 'You have already submitted a registration',
      alreadySubmittedDesc: 'We have received your registration. Please wait for our contact.',
    },
    ar: {
      title: 'التسجيل في دورة تطوير الويب',
      subtitle: 'املأ معلوماتك لحجز مقعدك',
      fullName: 'الاسم الكامل',
      fullNamePlaceholder: 'أدخل اسمك الكامل',
      phone: 'رقم الهاتف',
      phonePlaceholder: 'أدخل رقم هاتفك',
      age: 'العمر',
      agePlaceholder: 'أدخل عمرك',
      submitBtn: 'إرسال التسجيل',
      submittingBtn: 'جاري الإرسال...',
      successTitle: 'تم التسجيل بنجاح!',
      successMessage: 'شكراً لتسجيلك. سنتواصل معك قريباً!',
      closeBtn: 'إغلاق',
      errorRequired: 'يرجى ملء جميع الحقول',
      errorMinAge: `يجب أن يكون عمرك ${MIN_AGE} سنة على الأقل للتسجيل`,
      errorInvalidAge: 'يرجى إدخال عمر صحيح',
      errorInvalidPhone: 'يرجى إدخال رقم هاتف صحيح',
      errorSubmission: 'فشل الإرسال. يرجى المحاولة مرة أخرى.',
      alreadySubmitted: 'لقد قمت بالتسجيل مسبقاً',
      alreadySubmittedDesc: 'لقد استلمنا تسجيلك. يرجى انتظار تواصلنا معك.',
    },
  };

  const t = content[language];

  const validatePhone = (phoneNumber: string): boolean => {
    // Remove all non-numeric characters
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    // Check if it's between 9 and 15 digits (international standard)
    return cleanPhone.length >= 9 && cleanPhone.length <= 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check if already submitted
    if (hasSubmitted) {
      setError(t.alreadySubmitted);
      return;
    }

    // Validation
    if (!fullName.trim() || !phone.trim() || !age.trim()) {
      setError(t.errorRequired);
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum <= 0) {
      setError(t.errorInvalidAge);
      return;
    }

    if (ageNum < MIN_AGE) {
      setError(t.errorMinAge);
      return;
    }

    if (!validatePhone(phone)) {
      setError(t.errorInvalidPhone);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare Discord webhook embed
      const embed = {
        title: '🎓 New Web Course Registration',
        color: 0x3b82f6, // Blue color
        fields: [
          {
            name: '👤 Full Name',
            value: fullName,
            inline: true,
          },
          {
            name: '📱 Phone',
            value: phone,
            inline: true,
          },
          {
            name: '🎂 Age',
            value: age,
            inline: true,
          },
          {
            name: '🌐 Language',
            value: language === 'ar' ? 'العربية' : 'English',
            inline: true,
          },
          {
            name: '📅 Registration Date',
            value: new Date().toLocaleString(),
            inline: false,
          },
        ],
        footer: {
          text: 'Laws of Success - Web Development Course',
        },
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      // Set cookie to prevent multiple submissions (expires in 30 days)
      Cookies.set(COOKIE_NAME, 'true', { expires: 30 });
      setHasSubmitted(true);
      setIsSuccess(true);

      // Reset form
      setFullName('');
      setPhone('');
      setAge('');

      // Close modal after 3 seconds
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      setError(t.errorSubmission);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-secondary-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-primary-500/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-secondary-900/80 hover:text-secondary-900 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold mb-2">{t.title}</h2>
          <p className="text-secondary-900/90">{t.subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {hasSubmitted && !isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-primary-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {t.alreadySubmitted}
              </h3>
              <p className="text-gray-400 mb-6">
                {t.alreadySubmittedDesc}
              </p>
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 px-6 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-primary-500/50 transition-all"
              >
                {t.closeBtn}
              </button>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-primary-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-2xl font-bold text-white mb-2">
                {t.successTitle}
              </h3>
              <p className="text-gray-400">{t.successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <User className="inline mr-2" size={18} />
                  {t.fullName}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  className="w-full px-4 py-3 border border-primary-500/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-accent-800 text-white placeholder-gray-500 transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Phone className="inline mr-2" size={18} />
                  {t.phone}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="w-full px-4 py-3 border border-primary-500/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-accent-800 text-white placeholder-gray-500 transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Calendar className="inline mr-2" size={18} />
                  {t.age}
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={t.agePlaceholder}
                  min={MIN_AGE}
                  className="w-full px-4 py-3 border border-primary-500/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-accent-800 text-white placeholder-gray-500 transition-all"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t.errorMinAge}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 py-4 rounded-lg font-bold text-lg hover:shadow-xl hover:shadow-primary-500/50 transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    {t.submittingBtn}
                  </>
                ) : (
                  t.submitBtn
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebCourseRegistrationModal;
