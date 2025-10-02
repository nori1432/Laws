import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';

interface ProfileCompletionModalProps {
  open: boolean;
  onComplete: () => void;
  userData: any;
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  open,
  onComplete,
  userData
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Student data is in users table (user = student)
  // Parent data will be created if not exists
  const [formData, setFormData] = useState({
    user_full_name: userData?.user?.full_name || userData?.user?.students?.[0]?.name || '',
    user_email: userData?.user?.email || '',
    user_phone: userData?.user?.phone || '',
    user_gender: userData?.user?.gender || '',
    student_date_of_birth: userData?.user?.students?.[0]?.date_of_birth || '',
    parent_full_name: userData?.user?.parent_info?.full_name || '',
    parent_phone: userData?.user?.parent_info?.phone || '',
    parent_email: userData?.user?.parent_info?.email || ''
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        user_full_name: userData?.user?.full_name || userData?.user?.students?.[0]?.name || '',
        user_email: userData?.user?.email || '',
        user_phone: userData?.user?.phone || '',
        user_gender: userData?.user?.gender || '',
        student_date_of_birth: userData?.user?.students?.[0]?.date_of_birth || '',
        parent_full_name: userData?.user?.parent_info?.full_name || '',
        parent_phone: userData?.user?.parent_info?.phone || '',
        parent_email: userData?.user?.parent_info?.email || ''
      });
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        '/api/auth/profile/complete',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.profile_complete) {
        onComplete();
      } else {
        setError('Please fill all required fields / يرجى ملء جميع الحقول المطلوبة');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Update failed / فشل التحديث');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-orange-500 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold">
              Complete Your Profile / أكمل ملفك الشخصي
            </h2>
            <p className="text-sm text-orange-100 mt-1">
              Please fill all required fields to access the dashboard / يرجى إكمال جميع الحقول المطلوبة للوصول إلى لوحة التحكم
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* User Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
              Your Information / معلوماتك الشخصية
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name / الاسم الكامل *
              </label>
              <input
                type="text"
                name="user_full_name"
                value={formData.user_full_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter your full name / أدخل اسمك الكامل"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address (Optional) / البريد الإلكتروني (اختياري)
              </label>
              <input
                type="email"
                name="user_email"
                value={formData.user_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="example@email.com (اختياري / Optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number / رقم الهاتف *
              </label>
              <input
                type="tel"
                name="user_phone"
                value={formData.user_phone}
                onChange={handleChange}
                required
                pattern="0[567]\d{8}"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="05XXXXXXXX / 06XXXXXXXX / 07XXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gender / الجنس *
              </label>
              <select
                name="user_gender"
                value={formData.user_gender}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select / اختر</option>
                <option value="male">Male / ذكر</option>
                <option value="female">Female / أنثى</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date of Birth / تاريخ الميلاد *
              </label>
              <input
                type="date"
                name="student_date_of_birth"
                value={formData.student_date_of_birth}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Parent Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
              Parent Information / معلومات ولي الأمر
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent's Full Name / اسم ولي الأمر *
              </label>
              <input
                type="text"
                name="parent_full_name"
                value={formData.parent_full_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter parent's full name / أدخل اسم ولي الأمر"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent's Phone / هاتف ولي الأمر *
              </label>
              <input
                type="tel"
                name="parent_phone"
                value={formData.parent_phone}
                onChange={handleChange}
                required
                pattern="0[567]\d{8}"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="05XXXXXXXX / 06XXXXXXXX / 07XXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent's Email (Optional) / البريد الإلكتروني لولي الأمر (اختياري)
              </label>
              <input
                type="email"
                name="parent_email"
                value={formData.parent_email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="parent@email.com"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving / جاري الحفظ...
                </span>
              ) : (
                <>
                  Save and Continue / حفظ والمتابعة
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;
