import React, { useState } from 'react';
import { User, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface MissingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingData: {
    needsParent: boolean;
    needsPhone: boolean;
    needsDateOfBirth: boolean;
    needsParentPhone: boolean;
  };
  onComplete: () => void;
}

const MissingInfoModal: React.FC<MissingInfoModalProps> = ({
  isOpen,
  onClose,
  missingData,
  onComplete
}) => {
  const [formData, setFormData] = useState({
    parent_name: '',
    parent_phone: '',
    student_phone: '',
    birthDay: '',
    birthMonth: '',
    birthYear: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const validatePhone = (phone: string) => {
    const phoneRegex = /^0(5|6|7)\d{8}$/;
    return phoneRegex.test(phone);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (missingData.needsParent && !formData.parent_name) {
      newErrors.parent_name = 'Parent name is required';
    } else if (missingData.needsParent && !/^[a-zA-Z\s]+$/.test(formData.parent_name.trim())) {
      newErrors.parent_name = 'Name must contain only letters';
    }

    if (missingData.needsParentPhone && !formData.parent_phone) {
      newErrors.parent_phone = 'Parent phone is required';
    } else if (missingData.needsParentPhone && !validatePhone(formData.parent_phone)) {
      newErrors.parent_phone = 'Invalid phone format';
    }

    if (missingData.needsPhone && !formData.student_phone) {
      newErrors.student_phone = 'Student phone is required';
    } else if (missingData.needsPhone && !validatePhone(formData.student_phone)) {
      newErrors.student_phone = 'Invalid phone format';
    }

    if (missingData.needsDateOfBirth) {
      if (!formData.birthDay || !formData.birthMonth || !formData.birthYear) {
        newErrors.date_of_birth = 'Date of birth is required';
      } else {
        const day = parseInt(formData.birthDay);
        const month = parseInt(formData.birthMonth);
        const year = parseInt(formData.birthYear);
        const date = new Date(year, month - 1, day);
        
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          newErrors.date_of_birth = 'Please enter a valid date';
        } else if (date > new Date()) {
          newErrors.date_of_birth = 'Date cannot be in the future';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

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
      const submitData: any = {};

      if (missingData.needsParent) {
        submitData.parent_name = formData.parent_name;
      }

      if (missingData.needsParentPhone) {
        submitData.parent_phone = formData.parent_phone;
      }

      if (missingData.needsPhone) {
        submitData.student_phone = formData.student_phone;
      }

      if (missingData.needsDateOfBirth) {
        submitData.date_of_birth = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;
      }

      await axios.post('/api/auth/complete-profile', submitData);
      
      toast.success('Profile completed successfully!');
      onComplete();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to complete profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl shadow-luxury p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-foreground mb-2">Complete Your Profile</h3>
          <p className="text-muted-foreground text-sm">
            Please provide the following missing information to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {missingData.needsParent && (
            <div>
              <label htmlFor="parent_name" className="block text-sm font-medium text-foreground mb-2">
                Parent/Guardian Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="parent_name"
                  name="parent_name"
                  type="text"
                  required
                  value={formData.parent_name}
                  onChange={handleChange}
                  className={`block w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                    errors.parent_name ? 'border-destructive' : 'border-border'
                  }`}
                  placeholder="Enter parent name"
                />
              </div>
              {errors.parent_name && <p className="mt-1 text-sm text-destructive">{errors.parent_name}</p>}
            </div>
          )}

          {missingData.needsParentPhone && (
            <div>
              <label htmlFor="parent_phone" className="block text-sm font-medium text-foreground mb-2">
                Parent Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="parent_phone"
                  name="parent_phone"
                  type="tel"
                  required
                  value={formData.parent_phone}
                  onChange={handleChange}
                  className={`block w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                    errors.parent_phone ? 'border-destructive' : 'border-border'
                  }`}
                  placeholder="05xxxxxxxx"
                />
              </div>
              {errors.parent_phone && <p className="mt-1 text-sm text-destructive">{errors.parent_phone}</p>}
            </div>
          )}

          {missingData.needsPhone && (
            <div>
              <label htmlFor="student_phone" className="block text-sm font-medium text-foreground mb-2">
                Student Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="student_phone"
                  name="student_phone"
                  type="tel"
                  required
                  value={formData.student_phone}
                  onChange={handleChange}
                  className={`block w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm ${
                    errors.student_phone ? 'border-destructive' : 'border-border'
                  }`}
                  placeholder="05xxxxxxxx"
                />
              </div>
              {errors.student_phone && <p className="mt-1 text-sm text-destructive">{errors.student_phone}</p>}
            </div>
          )}

          {missingData.needsDateOfBirth && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date of Birth
              </label>
              <div className="grid grid-cols-3 gap-3">
                <select
                  name="birthDay"
                  value={formData.birthDay}
                  onChange={handleChange}
                  required
                  className="px-3 py-3 bg-input border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm"
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day.toString().padStart(2, '0')}>
                      {day}
                    </option>
                  ))}
                </select>
                
                <select
                  name="birthMonth"
                  value={formData.birthMonth}
                  onChange={handleChange}
                  required
                  className="px-3 py-3 bg-input border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm"
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month.toString().padStart(2, '0')}>
                      {month}
                    </option>
                  ))}
                </select>
                
                <select
                  name="birthYear"
                  value={formData.birthYear}
                  onChange={handleChange}
                  required
                  className="px-3 py-3 bg-input border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm"
                >
                  <option value="">Year</option>
                  {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {errors.date_of_birth && <p className="mt-1 text-sm text-destructive">{errors.date_of_birth}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-gold text-primary-foreground py-3 px-4 rounded-xl font-medium shadow-luxury hover:shadow-dark transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Completing...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MissingInfoModal;