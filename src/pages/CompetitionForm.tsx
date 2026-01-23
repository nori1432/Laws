import React, { useState } from 'react';
import { 
  Send, FileText, Download, ExternalLink, Phone, User, MapPin, 
  Calendar, Users, Award, BookOpen, GraduationCap, Heart, 
  Building2, UserCircle, Shield, ChevronDown, Sparkles, Star
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface FormData {
  participation_type: 'free' | 'kindergarten';
  kindergarten_name: string;
  supervisor_name: string;
  guardian_last_name: string;
  guardian_first_name: string;
  child_first_name: string;
  child_last_name: string;
  gender: 'male' | 'female' | '';
  birth_day: string;
  birth_month: string;
  birth_year: string;
  address: string;
  city: string;
  phone1: string;
  phone2: string;
  age_category: '3' | '4' | '5' | '';
}

const CompetitionForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    participation_type: 'free',
    kindergarten_name: '',
    supervisor_name: '',
    guardian_last_name: '',
    guardian_first_name: '',
    child_first_name: '',
    child_last_name: '',
    gender: '',
    birth_day: '',
    birth_month: '',
    birth_year: '',
    address: '',
    city: '',
    phone1: '',
    phone2: '',
    age_category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      if (name === 'participation_type') {
        setFormData(prev => ({
          ...prev,
          participation_type: checkbox.checked ? 'kindergarten' : 'free'
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.child_first_name || !formData.child_last_name) {
      toast.error('الرجاء إدخال اسم الطفل المشارك');
      return;
    }
    if (!formData.guardian_first_name || !formData.guardian_last_name) {
      toast.error('الرجاء إدخال اسم الولي');
      return;
    }
    if (!formData.phone1) {
      toast.error('الرجاء إدخال رقم الهاتف');
      return;
    }
    if (!formData.gender) {
      toast.error('الرجاء اختيار الجنس');
      return;
    }
    if (!formData.birth_day || !formData.birth_month || !formData.birth_year) {
      toast.error('الرجاء إدخال تاريخ الميلاد كاملاً');
      return;
    }
    if (!formData.age_category) {
      toast.error('الرجاء اختيار الفئة العمرية');
      return;
    }
    if (formData.participation_type === 'kindergarten' && !formData.kindergarten_name) {
      toast.error('الرجاء إدخال اسم الروضة');
      return;
    }

    setIsSubmitting(true);

    try {
      await axios.post('/api/competition/submit', formData);
      toast.success('تم إرسال التسجيل بنجاح! سيتم التواصل معكم قريباً');
      
      setFormData({
        participation_type: 'free',
        kindergarten_name: '',
        supervisor_name: '',
        guardian_last_name: '',
        guardian_first_name: '',
        child_first_name: '',
        child_last_name: '',
        gender: '',
        birth_day: '',
        birth_month: '',
        birth_year: '',
        address: '',
        city: '',
        phone1: '',
        phone2: '',
        age_category: '',
      });
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء إرسال التسجيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: '1', label: 'جانفي' },
    { value: '2', label: 'فيفري' },
    { value: '3', label: 'مارس' },
    { value: '4', label: 'أفريل' },
    { value: '5', label: 'ماي' },
    { value: '6', label: 'جوان' },
    { value: '7', label: 'جويلية' },
    { value: '8', label: 'أوت' },
    { value: '9', label: 'سبتمبر' },
    { value: '10', label: 'أكتوبر' },
    { value: '11', label: 'نوفمبر' },
    { value: '12', label: 'ديسمبر' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 3 - i);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950" dir="rtl">
      {/* Subtle Pattern Overlay */}
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
      
      {/* Golden Accent Lines */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Header Banner */}
          <div className="relative mb-12 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-amber-500/20"></div>
            <img 
              src="/header.png" 
              alt="مسابقة الطفل اللبيب"
              className="w-full h-auto object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>

          {/* Title Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-8 shadow-2xl shadow-amber-500/20">
              <Award className="w-10 h-10 text-neutral-900" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              مسابقة الطفل اللبيب
            </h1>
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 px-8 py-3 rounded-full text-lg font-bold mb-6">
              <Sparkles className="w-5 h-5" />
              <span>الطبعة الثانية</span>
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xl text-neutral-400 font-medium">
              لحفظ أحاديث الحبيب صلى الله عليه وسلم
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-8 mb-12 border border-neutral-800">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Phone className="w-5 h-5 text-amber-500" />
              <span className="text-lg font-semibold text-white">للتواصل والاستفسار</span>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {['0791 19 74 30', '0549 57 61 66', '0776 44 42 56', '0773 30 55 39'].map((phone, i) => (
                <a
                  key={i}
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="group flex items-center gap-2 bg-neutral-800 hover:bg-amber-500 px-5 py-3 rounded-xl font-medium text-neutral-300 hover:text-neutral-900 border border-neutral-700 hover:border-amber-500 transition-all duration-300"
                  dir="ltr"
                >
                  <Phone className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  {phone}
                </a>
              ))}
            </div>
          </div>

          {/* Main Form Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Form Header */}
            <div className="bg-neutral-900 p-8 border-b-4 border-amber-500">
              <div className="flex items-center justify-center gap-4">
                <FileText className="w-8 h-8 text-amber-500" />
                <h3 className="text-2xl md:text-3xl font-bold text-white">استمارة التسجيل</h3>
              </div>
              <p className="text-neutral-400 text-center mt-2">أكمل جميع الحقول المطلوبة بعناية</p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-10">
              
              {/* Participation Type */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-100 rounded-xl">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">نوع المشاركة</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`group relative flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                    formData.participation_type === 'free' 
                      ? 'bg-neutral-900 text-white border-amber-500 shadow-lg' 
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-amber-300 hover:bg-amber-50'
                  }`}>
                    <input
                      type="radio"
                      name="participation_type_radio"
                      checked={formData.participation_type === 'free'}
                      onChange={() => setFormData(prev => ({ ...prev, participation_type: 'free', kindergarten_name: '', supervisor_name: '' }))}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      formData.participation_type === 'free' ? 'border-amber-500 bg-amber-500' : 'border-neutral-300 group-hover:border-amber-400'
                    }`}>
                      {formData.participation_type === 'free' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <UserCircle className={`w-6 h-6 ${formData.participation_type === 'free' ? 'text-amber-500' : 'text-neutral-400'}`} />
                    <span className="font-semibold">مشارك حر</span>
                  </label>
                  <label className={`group relative flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                    formData.participation_type === 'kindergarten' 
                      ? 'bg-neutral-900 text-white border-amber-500 shadow-lg' 
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-amber-300 hover:bg-amber-50'
                  }`}>
                    <input
                      type="radio"
                      name="participation_type_radio"
                      checked={formData.participation_type === 'kindergarten'}
                      onChange={() => setFormData(prev => ({ ...prev, participation_type: 'kindergarten' }))}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      formData.participation_type === 'kindergarten' ? 'border-amber-500 bg-amber-500' : 'border-neutral-300 group-hover:border-amber-400'
                    }`}>
                      {formData.participation_type === 'kindergarten' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <Building2 className={`w-6 h-6 ${formData.participation_type === 'kindergarten' ? 'text-amber-500' : 'text-neutral-400'}`} />
                    <span className="font-semibold">تحت إشراف روضة</span>
                  </label>
                </div>
              </section>

              {/* Kindergarten Fields */}
              {formData.participation_type === 'kindergarten' && (
                <section className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        إسم الروضة <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="kindergarten_name"
                        value={formData.kindergarten_name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-neutral-800 placeholder-neutral-400"
                        placeholder="أدخل اسم الروضة"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        إسم المربية / المعلمة المشرفة
                      </label>
                      <input
                        type="text"
                        name="supervisor_name"
                        value={formData.supervisor_name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-neutral-800 placeholder-neutral-400"
                        placeholder="أدخل اسم المشرفة"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Guardian Information */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-neutral-100 rounded-xl">
                    <User className="w-5 h-5 text-neutral-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">معلومات الولي</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      اللقب <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="guardian_last_name"
                      value={formData.guardian_last_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400"
                      placeholder="لقب الولي"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      الإسم <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="guardian_first_name"
                      value={formData.guardian_first_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400"
                      placeholder="اسم الولي"
                    />
                  </div>
                </div>
              </section>

              {/* Child Information */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-100 rounded-xl">
                    <Heart className="w-5 h-5 text-amber-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">معلومات الطفل المشارك</h4>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        الإسم <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="child_first_name"
                        value={formData.child_first_name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400"
                        placeholder="اسم الطفل"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        اللقب <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="child_last_name"
                        value={formData.child_last_name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400"
                        placeholder="لقب الطفل"
                      />
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-3">
                      الجنس <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`group flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                        formData.gender === 'male' 
                          ? 'bg-neutral-900 text-white border-amber-500' 
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-amber-300'
                      }`}>
                        <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange} className="sr-only" />
                        <User className={`w-5 h-5 ${formData.gender === 'male' ? 'text-amber-500' : ''}`} />
                        <span className="font-semibold">ذكر</span>
                      </label>
                      <label className={`group flex items-center justify-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                        formData.gender === 'female' 
                          ? 'bg-neutral-900 text-white border-amber-500' 
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-amber-300'
                      }`}>
                        <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange} className="sr-only" />
                        <Heart className={`w-5 h-5 ${formData.gender === 'female' ? 'text-amber-500' : ''}`} />
                        <span className="font-semibold">أنثى</span>
                      </label>
                    </div>
                  </div>

                  {/* Birth Date */}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-3">
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        تاريخ الميلاد <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="relative">
                        <select 
                          name="birth_day" 
                          value={formData.birth_day} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-neutral-800 appearance-none cursor-pointer"
                        >
                          <option value="">اليوم</option>
                          {days.map(day => (<option key={day} value={day}>{day}</option>))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <select 
                          name="birth_month" 
                          value={formData.birth_month} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-neutral-800 appearance-none cursor-pointer"
                        >
                          <option value="">الشهر</option>
                          {months.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <select 
                          name="birth_year" 
                          value={formData.birth_year} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-neutral-800 appearance-none cursor-pointer"
                        >
                          <option value="">السنة</option>
                          {years.map(year => (<option key={year} value={year}>{year}</option>))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-neutral-100 rounded-xl">
                    <MapPin className="w-5 h-5 text-neutral-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">العنوان</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">العنوان</label>
                    <input 
                      type="text" 
                      name="address" 
                      value={formData.address} 
                      onChange={handleChange} 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400" 
                      placeholder="أدخل العنوان" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">المدينة</label>
                    <input 
                      type="text" 
                      name="city" 
                      value={formData.city} 
                      onChange={handleChange} 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400" 
                      placeholder="أدخل المدينة" 
                    />
                  </div>
                </div>
              </section>

              {/* Phone Numbers */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-100 rounded-xl">
                    <Phone className="w-5 h-5 text-amber-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">أرقام الهاتف</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      رقم الهاتف 1 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="tel" 
                      name="phone1" 
                      value={formData.phone1} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400" 
                      placeholder="0xxxxxxxxx" 
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      رقم الهاتف 2 <span className="text-neutral-400 text-xs">(اختياري)</span>
                    </label>
                    <input 
                      type="tel" 
                      name="phone2" 
                      value={formData.phone2} 
                      onChange={handleChange} 
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-neutral-800 placeholder-neutral-400" 
                      placeholder="0xxxxxxxxx" 
                      dir="ltr" 
                    />
                  </div>
                </div>
              </section>

              {/* Age Category */}
              <section className="bg-neutral-900 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-500 rounded-xl">
                    <GraduationCap className="w-5 h-5 text-neutral-900" />
                  </div>
                  <h4 className="text-lg font-bold text-white">
                    الفئة العمرية <span className="text-red-400">*</span>
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { value: '3', label: '3 سنوات', icon: Star },
                    { value: '4', label: '4 سنوات', icon: Award },
                    { value: '5', label: '5 سنوات', icon: Award },
                  ].map((category) => {
                    const Icon = category.icon;
                    return (
                      <label 
                        key={category.value} 
                        className={`group flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                          formData.age_category === category.value
                            ? 'bg-amber-500 text-neutral-900 border-amber-500 shadow-lg shadow-amber-500/20'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-amber-500/50 hover:bg-neutral-800/80'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="age_category" 
                          value={category.value} 
                          checked={formData.age_category === category.value} 
                          onChange={handleChange} 
                          className="sr-only" 
                        />
                        <Icon className={`w-8 h-8 ${formData.age_category === category.value ? 'text-neutral-900' : 'text-amber-500'}`} />
                        <span className="font-bold text-lg">{category.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* PDF Resources Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-neutral-100 rounded-xl">
                    <BookOpen className="w-5 h-5 text-neutral-600" />
                  </div>
                  <h4 className="text-lg font-bold text-neutral-800">المرفقات والموارد</h4>
                </div>

                {/* Resources PDF */}
                <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="bg-neutral-900 p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold text-white">الملحق رقم واحد والكتاب المرجعي</span>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href="/resources.pdf" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-800 rounded-lg hover:bg-amber-50 transition-all font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" /> فتح
                        </a>
                        <a 
                          href="/resources.pdf" 
                          download
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-neutral-900 rounded-lg hover:bg-amber-400 transition-all font-medium text-sm"
                        >
                          <Download className="w-4 h-4" /> تحميل
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <iframe 
                      src="/resources.pdf" 
                      className="w-full h-[500px] rounded-lg border border-neutral-200 bg-white" 
                      title="الملحق والكتاب المرجعي" 
                    />
                  </div>
                </div>

                {/* Terms PDF */}
                <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="bg-neutral-900 p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold text-white">شروط المسابقة</span>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href="/terms.pdf" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white text-neutral-800 rounded-lg hover:bg-amber-50 transition-all font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" /> فتح
                        </a>
                        <a 
                          href="/terms.pdf" 
                          download
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-neutral-900 rounded-lg hover:bg-amber-400 transition-all font-medium text-sm"
                        >
                          <Download className="w-4 h-4" /> تحميل
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <iframe 
                      src="/terms.pdf" 
                      className="w-full h-[500px] rounded-lg border border-neutral-200 bg-white" 
                      title="شروط المسابقة" 
                    />
                  </div>
                </div>
              </section>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 py-4 px-8 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-amber-500/25 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      إرسال التسجيل
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 text-neutral-500 text-sm">
              <Shield className="w-4 h-4" />
              <span>جميع البيانات المقدمة سرية ولن تستخدم إلا لأغراض المسابقة</span>
            </div>
            <p className="text-neutral-600 text-xs mt-3">
              © {new Date().getFullYear()} مسابقة الطفل اللبيب - جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionForm;
