import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Phone, User, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    student_name: '',
    birthDay: '',
    birthMonth: '',
    birthYear: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const validatePhone = (phone: string) => {
    const phoneRegex = /^0(5|6|7)\d{8}$/;
    return phoneRegex.test(phone);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email is now optional, but if provided, validate format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalidEmailFormat');
    }
    
    if (!formData.password) newErrors.password = t('passwordRequired');
    if (!formData.confirmPassword) newErrors.confirmPassword = t('confirmPasswordRequired');
    if (!formData.full_name) newErrors.full_name = t('parentNameRequired');
    else if (!/^[a-zA-Z\s]+$/.test(formData.full_name.trim())) newErrors.full_name = t('nameMustContainLetters');
    
    if (!formData.phone) newErrors.phone = t('phoneRequired');
    if (!formData.student_name) newErrors.student_name = t('studentNameRequired');
    else if (!/^[a-zA-Z\s]+$/.test(formData.student_name.trim())) newErrors.student_name = t('nameMustContainLetters');
    
    if (!formData.birthDay || !formData.birthMonth || !formData.birthYear) {
      newErrors.date_of_birth = t('dateOfBirthRequired');
    } else {
      // Validate date is valid
      const day = parseInt(formData.birthDay);
      const month = parseInt(formData.birthMonth);
      const year = parseInt(formData.birthYear);
      const date = new Date(year, month - 1, day);
      
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        newErrors.date_of_birth = t('validDateRequired');
      } else if (date > new Date()) {
        newErrors.date_of_birth = t('dateCannotBeFuture');
      }
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = t('passwordMinLength');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordsDoNotMatch');
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = t('phoneFormatError');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const dateOfBirth = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;
      const registerData = {
        ...formData,
        date_of_birth: dateOfBirth
      };
      const { confirmPassword, birthDay, birthMonth, birthYear, ...finalData } = registerData;
      await register(finalData);
      setShowSuccessModal(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-luxury flex items-center justify-center py-8 px-4 relative overflow-hidden">
      <div className="w-full max-w-2xl mx-auto">
        {/* Main Card */}
        <div className="bg-card border border-border rounded-2xl shadow-luxury p-6 md:p-8 backdrop-blur-sm relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-luxury">
              <img
                src="/logo.png"
                alt="Laws of Success Academy"
                className="w-12 h-12 rounded-lg"
              />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-gold bg-clip-text text-transparent mb-3">
              {t('joinAcademy')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('createAccountSubtitle')}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="md:col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  {t('emailAddressOptional')} <span className="text-muted-foreground">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.email ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('emailPlaceholderOptional')}
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  {t('passwordLabelLogin')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-12 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.password ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('createPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-primary transition-colors duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                  {t('confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-12 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.confirmPassword ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('confirmPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-primary transition-colors duration-200"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-2">
                  {t('parentGuardianName')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.full_name ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('parentGuardianPlaceholder')}
                  />
                </div>
                {errors.full_name && <p className="mt-1 text-sm text-destructive">{errors.full_name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                  {t('phoneNumberLabel')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.phone ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('phonePlaceholderLogin')}
                  />
                </div>
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
              </div>

              {/* Student Name */}
              <div>
                <label htmlFor="student_name" className="block text-sm font-medium text-foreground mb-2">
                  {t('studentNameLabel')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="student_name"
                    name="student_name"
                    type="text"
                    required
                    value={formData.student_name}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-4 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                      errors.student_name ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder={t('studentNamePlaceholder')}
                  />
                </div>
                {errors.student_name && <p className="mt-1 text-sm text-destructive">{errors.student_name}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('dateOfBirthLabel')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Day */}
                  <div className="relative">
                    <select
                      value={formData.birthDay}
                      onChange={(e) => setFormData({ ...formData, birthDay: e.target.value })}
                      className={`block w-full pl-4 pr-8 py-4 bg-input border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm appearance-none ${
                        errors.date_of_birth ? 'border-destructive' : 'border-border'
                      }`}
                    >
                      <option value="">{t('dayLabel')}</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day.toString()}>{day}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Month */}
                  <div className="relative">
                    <select
                      value={formData.birthMonth}
                      onChange={(e) => setFormData({ ...formData, birthMonth: e.target.value })}
                      className={`block w-full pl-4 pr-8 py-4 bg-input border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm appearance-none ${
                        errors.date_of_birth ? 'border-destructive' : 'border-border'
                      }`}
                    >
                      <option value="">{t('monthLabel')}</option>
                      {[
                        t('january'), t('february'), t('march'), t('april'), t('may'), t('june'),
                        t('july'), t('august'), t('september'), t('october'), t('november'), t('december')
                      ].map((month, index) => (
                        <option key={month} value={(index + 1).toString().padStart(2, '0')}>{month}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Year */}
                  <div className="relative">
                    <select
                      value={formData.birthYear}
                      onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                      className={`block w-full pl-4 pr-8 py-4 bg-input border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm appearance-none ${
                        errors.date_of_birth ? 'border-destructive' : 'border-border'
                      }`}
                    >
                      <option value="">{t('yearLabel')}</option>
                      {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                {errors.date_of_birth && <p className="mt-1 text-sm text-destructive">{errors.date_of_birth}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-gold text-primary-foreground py-4 px-6 rounded-xl font-semibold text-sm shadow-luxury hover:shadow-dark transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('creatingAccount')}
                </div>
              ) : (
                t('createAccountRegister')
              )}
            </button>

            {/* Links */}
            <div className="text-center">
              <span className="text-muted-foreground text-sm">{t('alreadyHaveAccount')} </span>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
              >
                {t('signInHere')}
              </Link>
            </div>
          </form>
        </div>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-2xl shadow-luxury p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{t('registrationSuccessfulModal')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('verificationEmailSent')}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/verify-email')}
                    className="w-full bg-gradient-gold text-primary-foreground py-3 px-4 rounded-xl font-medium shadow-luxury hover:shadow-dark transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {t('goToEmailVerification')}
                  </button>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full bg-muted text-muted-foreground py-3 px-4 rounded-xl font-medium hover:bg-muted/80 transition-all duration-200"
                  >
                    {t('closeModal')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default Register;
