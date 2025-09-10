import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    identifier: '', // Can be email or phone
    password: ''
  });
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Prepare login data based on method
      const loginData = loginMethod === 'email' 
        ? { email: formData.identifier, password: formData.password }
        : { phone: formData.identifier, password: formData.password };
      
      await login(loginData);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-luxury flex items-center justify-center py-8 px-4 relative overflow-hidden">
      <div className="w-full max-w-md">
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
              {t('welcomeBackLogin')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('loginSubtitle')}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Login Method Toggle */}
              <div className="flex justify-center mb-4">
                <div className="bg-muted p-1 rounded-lg flex">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      loginMethod === 'email'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('emailLabelLogin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('phone')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      loginMethod === 'phone'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('phoneLabelLogin')}
                  </button>
                </div>
              </div>

              {/* Identifier Field (Email or Phone) */}
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-foreground mb-2">
                  {loginMethod === 'email' ? t('emailLabelLogin') : t('phoneLabelLogin')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type={loginMethod === 'email' ? 'email' : 'tel'}
                    autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
                    required
                    value={formData.identifier}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-4 py-4 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm"
                    placeholder={loginMethod === 'email' ? t('emailPlaceholderLogin') : t('phonePlaceholderLogin')}
                  />
                </div>
              </div>

              {/* Password Field */}
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
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-12 py-4 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm"
                    placeholder={t('passwordPlaceholderLogin')}
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
                  {t('signingIn')}
                </div>
              ) : (
                t('signIn')
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm">
              {t('noAccount')}{' '}
              <Link
                to="/register"
                className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
              >
                {t('createAccountLogin')}
              </Link>
            </p>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default Login;
