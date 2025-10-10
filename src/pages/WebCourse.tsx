import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Code, Laptop, Rocket, Calendar, DollarSign, Target, CheckCircle, Sparkles, Zap, Brain, Database, Layout, Globe } from 'lucide-react';
import WebCourseRegistrationModal from '../components/WebCourseRegistrationModal';

const WebCourse: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const content = {
    en: {
      title: 'Web Development Course',
      subtitle: 'Master Web Development from Zero to Launch with Modern Learning',
      intro: 'Want to confidently enter the world of web development?',
      introDesc: 'The opportunity is now in your hands with a comprehensive course that combines practical application and professional guidance step by step.',
      courseTitle: 'Web Development Course from Laws of Success',
      courseDesc: 'Learn how to design and program websites yourself — from scratch to launching your first website online!',
      contentTitle: 'Course Curriculum',
      programTitle: 'Detailed Program',
      sessions: '20 structured practical sessions from basics to professionalism',
      support: 'Free online support and follow-up sessions throughout the course',
      project: 'Final project where you apply everything you learned: Launch your first website',
      price: 'Investment',
      priceAmount: '16,000 DZD only for the entire course',
      pricePerSession: '(approximately 800 DZD per session)',
      target: 'Who is this course for?',
      targetDesc: 'The course is suitable for beginners, students, and anyone seeking to enter the digital field and build a successful career path in programming and web development.',
      minAge: 'Minimum Age: 16 years',
      registerBtn: 'Register Now',
      features: 'Why Choose Our Course?',
      feature1: 'Modern Learning',
      feature1Desc: 'Learn with the latest tools and AI assistance',
      feature2: 'Hands-on Projects',
      feature2Desc: 'Build real-world applications from day one',
      feature3: 'Latest Technologies',
      feature3Desc: 'Master the technologies used in 2025',
      feature4: 'Career Ready',
      feature4Desc: 'Launch your tech career with confidence',
      specialTitle: 'What Makes This Course Special?',
      specialDesc: 'Learn web development the modern way',
      special1: 'Smart Tools',
      special1Desc: 'Learn to work efficiently with modern development tools and AI assistance',
      special2: '2025 Technologies',
      special2Desc: 'Master the latest frameworks and tools used by professional developers',
      special3: 'Practical Approach',
      special3Desc: 'Focus on building real projects and solving real problems',
      phase1: 'Phase 1: Web Foundations',
      phase1Desc: 'Introduction to Web, HTML Basics & Structure',
      phase2: 'Phase 2: Frontend Development',
      phase2Desc: 'CSS, JavaScript, Responsive Design & UI/UX',
      phase3: 'Phase 3: Modern Frameworks',
      phase3Desc: 'React, Vue, or Angular - Build Dynamic Applications',
      phase4: 'Phase 4: Backend & Deployment',
      phase4Desc: 'Node.js, Databases, APIs & Launch Your Site',
    },
    ar: {
      title: 'دورة تطوير الويب',
      subtitle: 'احترف تطوير الويب من الصفر وحتى الإطلاق بتعلم حديث',
      intro: 'هل ترغب في دخول عالم تطوير الويب بثقة؟',
      introDesc: 'الفرصة الآن بين يديك مع دورة متكاملة تجمع بين الجانب التطبيقي والتوجيه المهني خطوة بخطوة.',
      courseTitle: 'دورة تطوير الويب من Laws of Success',
      courseDesc: 'تعلّم كيف تصمّم وتبرمج مواقع إلكترونية بنفسك — من الصفر وحتى إطلاق موقعك الأول على الإنترنت!',
      contentTitle: 'محتوى الدورة',
      programTitle: 'البرنامج التفصيلي',
      sessions: '20 جلسة تطبيقية منظمة من الأساسيات إلى الاحتراف',
      support: 'جلسات دعم ومتابعة أونلاين مجانًا طيلة فترة الدورة',
      project: 'مشروع نهائي تطبّق فيه كل ما تعلمته: إطلاق موقعك الأول',
      price: 'الاستثمار',
      priceAmount: '16,000 دج فقط لكامل الدورة',
      pricePerSession: '(أي حوالي 800 دج للحصة)',
      target: 'الدورة مناسبة لـ',
      targetDesc: 'المبتدئين، الطلبة، وأي شخص يسعى لدخول المجال الرقمي وبناء مسار مهني ناجح في البرمجة وتطوير المواقع.',
      minAge: 'الحد الأدنى للعمر: 16 سنة',
      registerBtn: 'سجّل الآن',
      features: 'لماذا تختار دورتنا؟',
      feature1: 'تعلّم حديث',
      feature1Desc: 'تعلم بأحدث الأدوات ومساعدة الذكاء الاصطناعي',
      feature2: 'مشاريع عملية',
      feature2Desc: 'ابنِ تطبيقات حقيقية من اليوم الأول',
      feature3: 'تقنيات حديثة',
      feature3Desc: 'احترف التقنيات المستخدمة في 2025',
      feature4: 'جاهز للعمل',
      feature4Desc: 'ابدأ مسيرتك المهنية في التقنية بثقة',
      specialTitle: 'ما الذي يميز هذه الدورة؟',
      specialDesc: 'تعلم تطوير الويب بالطريقة الحديثة',
      special1: 'أدوات ذكية',
      special1Desc: 'تعلم العمل بكفاءة مع أدوات التطوير الحديثة ومساعدة الذكاء الاصطناعي',
      special2: 'تقنيات 2025',
      special2Desc: 'احترف أحدث الأطر والأدوات المستخدمة من قبل المطورين المحترفين',
      special3: 'نهج عملي',
      special3Desc: 'التركيز على بناء مشاريع حقيقية وحل مشاكل واقعية',
      phase1: 'المرحلة 1: أساسيات الويب',
      phase1Desc: 'مقدمة في الويب، أساسيات HTML وهيكلة الصفحات',
      phase2: 'المرحلة 2: تطوير الواجهة الأمامية',
      phase2Desc: 'CSS، JavaScript، التصميم المتجاوب وتجربة المستخدم',
      phase3: 'المرحلة 3: الأطر الحديثة',
      phase3Desc: 'React، Vue أو Angular - بناء تطبيقات ديناميكية',
      phase4: 'المرحلة 4: الخلفية والنشر',
      phase4Desc: 'Node.js، قواعد البيانات، APIs وإطلاق موقعك',
    },
  };

  const t = content[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-accent-900 to-secondary-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-primary-600/20"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-600 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-secondary-900 shadow-xl">
              <Code size={40} />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary-400 via-primary-300 to-primary-500 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-4">
              {t.subtitle}
            </p>
            <div className="flex items-center justify-center gap-2 text-primary-400 mb-8">
              <Sparkles size={20} />
              <span className="text-lg font-semibold">{t.specialDesc}</span>
              <Sparkles size={20} />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 px-8 py-4 rounded-full text-lg font-bold hover:shadow-2xl hover:shadow-primary-500/50 transform hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
            >
              <Rocket size={24} />
              {t.registerBtn}
            </button>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-2xl shadow-2xl p-8 md:p-12 border border-primary-500/20">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Rocket className="text-primary-400" size={32} />
                <span>{t.intro}</span>
              </h2>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                {t.introDesc}
              </p>
              <div className={`${isRTL ? 'border-r-4 pr-6 pl-4' : 'border-l-4 pl-6 pr-4'} border-primary-500 bg-primary-500/10 py-4 ${isRTL ? 'rounded-l-lg' : 'rounded-r-lg'}`}>
                <h3 className="text-xl md:text-2xl font-bold text-primary-400 mb-3">
                  {t.courseTitle}
                </h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  {t.courseDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Special Features - AI Integration */}
      <section className="py-12 md:py-16 bg-gradient-to-br from-primary-900/20 to-transparent">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white">
            {t.specialTitle}
          </h2>
          <p className="text-center text-primary-400 mb-12 text-lg flex items-center justify-center gap-2">
            <Brain size={24} />
            {t.specialDesc}
            <Sparkles size={24} />
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Brain, title: t.special1, desc: t.special1Desc, gradient: 'from-primary-500 to-primary-600' },
              { icon: Zap, title: t.special2, desc: t.special2Desc, gradient: 'from-primary-600 to-primary-700' },
              { icon: Sparkles, title: t.special3, desc: t.special3Desc, gradient: 'from-primary-400 to-primary-500' },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-xl p-6 shadow-xl hover:shadow-2xl hover:shadow-primary-500/20 transform hover:-translate-y-2 transition-all duration-300 border border-primary-500/30"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-gradient-to-r ${feature.gradient} text-secondary-900 shadow-lg`}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold mb-2 text-primary-400">
                  {feature.title}
                </h3>
                <p className="text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">
            {t.features}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Brain, title: t.feature1, desc: t.feature1Desc },
              { icon: Laptop, title: t.feature2, desc: t.feature2Desc },
              { icon: Zap, title: t.feature3, desc: t.feature3Desc },
              { icon: Target, title: t.feature4, desc: t.feature4Desc },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-xl p-6 shadow-lg hover:shadow-2xl hover:shadow-primary-500/20 transform hover:-translate-y-2 transition-all duration-300 border border-primary-500/20"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900">
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Program - 4 Phases */}
      <section className="py-12 md:py-16 bg-gradient-to-br from-primary-900/10 to-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-white flex items-center justify-center gap-3">
              <Calendar className="text-primary-400" size={36} />
              {t.programTitle}
            </h2>
            <p className="text-center text-gray-400 mb-12 text-lg">
              {t.sessions}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { 
                  icon: Globe, 
                  title: t.phase1, 
                  desc: t.phase1Desc,
                  items: language === 'ar' ? [
                    'مقدمة في تطوير الويب والإنترنت',
                    'أساسيات HTML وهيكلة الصفحات',
                    'العناصر والوسوم الأساسية',
                    'النماذج والجداول',
                    'أدوات التعلم الحديثة'
                  ] : [
                    'Introduction to Web Development & Internet',
                    'HTML Basics and Page Structure',
                    'Essential Elements and Tags',
                    'Forms and Tables',
                    'Modern Learning Tools'
                  ]
                },
                { 
                  icon: Layout, 
                  title: t.phase2, 
                  desc: t.phase2Desc,
                  items: language === 'ar' ? [
                    'CSS للتنسيق والتصميم',
                    'JavaScript الأساسي والتفاعل',
                    'التصميم المتجاوب (Responsive Design)',
                    'Bootstrap وأطر التصميم',
                    'أدوات المطورين الحديثة'
                  ] : [
                    'CSS Styling and Design',
                    'JavaScript Fundamentals & Interactivity',
                    'Responsive Design Principles',
                    'Bootstrap and Design Frameworks',
                    'Modern Developer Tools'
                  ]
                },
                { 
                  icon: Zap, 
                  title: t.phase3, 
                  desc: t.phase3Desc,
                  items: language === 'ar' ? [
                    'مقدمة في React أو Vue',
                    'المكونات والحالة (Components & State)',
                    'إدارة البيانات والواجهة',
                    'بناء تطبيق ديناميكي كامل',
                    'تسريع التطوير بالأدوات الذكية'
                  ] : [
                    'Introduction to React or Vue',
                    'Components & State Management',
                    'Data Management and UI',
                    'Building Complete Dynamic Apps',
                    'Accelerate Development with Smart Tools'
                  ]
                },
                { 
                  icon: Database, 
                  title: t.phase4, 
                  desc: t.phase4Desc,
                  items: language === 'ar' ? [
                    'مقدمة في Node.js والخوادم',
                    'قواعد البيانات الأساسية',
                    'بناء APIs ونقاط النهاية',
                    'ربط الواجهة الأمامية بالخلفية',
                    'نشر المشروع على الإنترنت'
                  ] : [
                    'Introduction to Node.js and Servers',
                    'Database Fundamentals',
                    'Building APIs and Endpoints',
                    'Connecting Frontend to Backend',
                    'Deploy Your Project Online'
                  ]
                },
              ].map((phase, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-2xl p-8 shadow-xl border border-primary-500/30 hover:border-primary-500/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 flex-shrink-0 shadow-lg">
                      <phase.icon size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-primary-400 mb-2">
                        {phase.title}
                      </h3>
                      <p className="text-gray-300">{phase.desc}</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {phase.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-300">
                        <CheckCircle className="text-primary-500 flex-shrink-0 mt-1" size={20} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Course Content Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white flex items-center justify-center gap-3">
              <CheckCircle className="text-primary-400" size={36} />
              {t.contentTitle}
            </h2>
            <div className="space-y-6">
              {[
                { icon: CheckCircle, text: t.sessions },
                { icon: CheckCircle, text: t.support },
                { icon: CheckCircle, text: t.project },
              ].map((item, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-xl p-6 shadow-lg border border-primary-500/20 flex items-start gap-4 hover:shadow-xl hover:border-primary-500/40 transition-all duration-300"
                >
                  <item.icon className="text-primary-500 flex-shrink-0 mt-1" size={28} />
                  <p className="text-lg text-gray-300 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-primary-600 to-primary-500">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-secondary-900">
            <DollarSign className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t.price}</h2>
            <div className="bg-secondary-900/20 backdrop-blur-lg rounded-2xl p-8 md:p-12 border-2 border-secondary-900/30 shadow-2xl">
              <p className="text-4xl md:text-5xl font-bold mb-3">{t.priceAmount}</p>
              <p className="text-xl md:text-2xl opacity-90">{t.pricePerSession}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-accent-800 to-secondary-800 rounded-2xl shadow-2xl p-8 md:p-12 border border-primary-500/20">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Target className="text-primary-400" size={32} />
                {t.target}
              </h2>
              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                {t.targetDesc}
              </p>
              <div className="inline-block bg-primary-500/20 border-2 border-primary-500 rounded-lg px-6 py-3">
                <p className="text-lg font-semibold text-primary-400">
                  {t.minAge}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary-900/20 to-transparent">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center gap-2 text-primary-400 mb-6">
            <Sparkles size={24} />
            <span className="text-sm font-semibold uppercase tracking-wider">
              {language === 'ar' ? 'تعلم حديث وعملي' : 'Modern & Practical Learning'}
            </span>
            <Sparkles size={24} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            {language === 'ar' ? 'ابدأ رحلتك اليوم!' : 'Start Your Journey Today!'}
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {language === 'ar'
              ? 'لا تفوت فرصة تعلم تطوير الويب من الصفر حتى الاحتراف بأحدث الأدوات والتقنيات'
              : "Don't miss the opportunity to learn web development from scratch to professionalism with the latest tools and technologies"}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-secondary-900 px-12 py-5 rounded-full text-xl font-bold hover:shadow-2xl hover:shadow-primary-500/50 transform hover:scale-105 transition-all duration-300 inline-flex items-center gap-3"
          >
            <Rocket size={28} />
            {t.registerBtn}
          </button>
        </div>
      </section>

      {/* Registration Modal */}
      <WebCourseRegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default WebCourse;
