import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Menu,
  X,
  ScrollText,
  Flame,
  HeartHandshake,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Settings,
  MessageCircle,
  Lock,
  Eye,
  EyeOff,
  Megaphone,
  Pin,
  ChevronDown,
  ChevronUp,
  UserPlus
} from 'lucide-react';

const LineIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M24 10.304c0-5.232-5.383-9.488-12-9.488s-12 4.256-12 9.488c0 4.69 4.27 8.604 10.04 9.344.39.084.92.258 1.05.592.12.303.08.777.04 1.084l-.17 1.023c-.05.303-.24 1.187 1.04.647 1.27-.54 6.88-4.05 9.39-6.93 1.77-1.92 2.61-3.77 2.61-5.764zm-16.14 3.77h-1.63c-.23 0-.41-.18-.41-.41v-4.66c0-.23.18-.41.41-.41h1.63c.23 0 .41.18.41.41v4.66c0 .23-.18.41-.41.41zm3.83 0h-1.63c-.23 0-.41-.18-.41-.41v-4.66c0-.23.18-.41.41-.41h1.63c.23 0 .41.18.41.41v4.66c0 .23-.18.41-.41.41zm5.12-2.11c0 .23-.18.41-.41.41h-1.22v1.29c0 .23-.18.41-.41.41h-1.63c-.23 0-.41-.18-.41-.41v-4.66c0-.23.18-.41.41-.41h1.63c.23 0 .41.18.41.41v1.29h1.22c.23 0 .41.18.41.41v1.67zm4.27 2.11h-1.63c-.23 0-.41-.18-.41-.41v-4.66c0-.23.18-.41.41-.41h1.63c.23 0 .41.18.41.41v4.66c0 .23-.18.41-.41.41z" />
  </svg>
);

import { BookingData, BulletinCategory, BulletinRecord, ConsultationType, DeityRecord, DonationData, DonationType, RegistrationData } from './types';
import { submitBooking, submitDonation, getBulletins, submitRegistration, getSiteImages, getSiteImagePublicUrl, getDeities, supabase } from './services/supabase';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [donationStatus, setDonationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [bulletinFilter, setBulletinFilter] = useState<string>('all');
  const [expandedBulletin, setExpandedBulletin] = useState<string | null>(null);
  const [registerBulletin, setRegisterBulletin] = useState<BulletinRecord | null>(null);
  const [regForm, setRegForm] = useState<RegistrationData>({ bulletinId: '', name: '', phone: '', numPeople: 1, notes: '' });
  const [regStatus, setRegStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [heroImageUrl, setHeroImageUrl] = useState('https://images.unsplash.com/photo-1542045938-4e8c18731c39?q=80&w=2070&auto=format&fit=crop');
  const [aboutImageUrl, setAboutImageUrl] = useState('/picture/Introduction 1.jpg');
  const [deities, setDeities] = useState<DeityRecord[]>([]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) {
        setLoginError('帳號或密碼錯誤，請再試一次。');
      } else {
        setShowAdmin(true);
        setShowLoginModal(false);
        setLoginEmail('');
        setLoginPassword('');
      }
    } catch {
      setLoginError('登入失敗，請稍後再試。');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    setShowPassword(false);
  };

  const [formData, setFormData] = useState<BookingData>({
    name: '',
    phone: '',
    birthDate: '',
    bookingDate: '',
    bookingTime: '',
    type: ConsultationType.CAREER,
    notes: ''
  });

  const [donationData, setDonationData] = useState<DonationData>({
    name: '',
    phone: '',
    amount: 0,
    type: DonationType.GENERAL,
    notes: ''
  });

  useEffect(() => {
    getBulletins().then(setBulletins).catch(console.error);
    getDeities().then(setDeities).catch(console.error);
    getSiteImages().then(images => {
      for (const img of images) {
        const url = getSiteImagePublicUrl(img.storagePath);
        if (img.sectionKey === 'hero') setHeroImageUrl(url);
        if (img.sectionKey === 'about') setAboutImageUrl(url);
      }
    }).catch(console.error);
  }, []);

  const filteredBulletins = bulletinFilter === 'all'
    ? bulletins
    : bulletins.filter(b => b.category === bulletinFilter);

  const openRegisterModal = (bulletin: BulletinRecord) => {
    setRegisterBulletin(bulletin);
    setRegForm({ bulletinId: bulletin.id, name: '', phone: '', numPeople: 1, notes: '' });
    setRegStatus('idle');
  };

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.phone.trim()) return;
    setRegStatus('loading');
    try {
      await submitRegistration(regForm);
      setRegStatus('success');
    } catch {
      setRegStatus('error');
    }
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'bookingDate' && value) {
      const date = new Date(value);
      const day = date.getDay(); // 0 is Sunday, 6 is Saturday
      if (day !== 6) {
        alert('抱歉，目前僅開放每週六預約諮詢。');
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDonationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDonationData(prev => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value
    }));
  };

  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (donationData.amount <= 0) {
      alert('請輸入有效的捐款金額。');
      return;
    }
    setDonationStatus('loading');
    try {
      await submitDonation(donationData);
      setDonationStatus('success');
      setDonationData({
        name: '',
        phone: '',
        amount: 0,
        type: DonationType.GENERAL,
        notes: ''
      });
    } catch (error) {
      setDonationStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    const date = new Date(formData.bookingDate);
    if (date.getDay() !== 6) {
      alert('請選擇週六的日期。');
      return;
    }

    if (formData.bookingTime !== 'evening') {
      alert('目前僅開放晚上時段預約。');
      return;
    }

    setBookingStatus('loading');

    try {
      await submitBooking(formData);
      setBookingStatus('success');
      // Reset form after success
      setFormData({
        name: '',
        phone: '',
        birthDate: '',
        bookingDate: '',
        bookingTime: '',
        type: ConsultationType.CAREER,
        notes: ''
      });
    } catch (error) {
      console.error(error);
      setBookingStatus('error');
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  if (showAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col text-temple-dark selection:bg-temple-red selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-temple-red text-temple-bg shadow-lg border-b-4 border-temple-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection('home')}>
              <div className="bg-white p-0.5 rounded-full border-2 border-temple-gold/50 shadow-md">
                <img src="/logo.png" alt="和聖壇 Logo" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl font-bold tracking-widest font-serif">和聖壇</h1>
                <p className="text-xs tracking-widest text-temple-gold opacity-90 uppercase">He Sheng Altar</p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-baseline space-x-8">
                {['home', 'bulletin', 'about', 'deities', 'services', 'booking', 'donation', 'contact'].map((item) => (
                  <button
                    key={item}
                    onClick={() => scrollToSection(item)}
                    className={`px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 font-serif
                      ${activeSection === item
                        ? 'text-temple-gold border-b-2 border-temple-gold'
                        : 'text-white hover:text-temple-gold'}`}
                  >
                    {{
                      'home': '首頁',
                      'bulletin': '公佈欄',
                      'about': '和聖壇緣起',
                      'deities': '神明介紹',
                      'services': '宮廟服務',
                      'booking': '預約諮詢',
                      'donation': '捐獻護持',
                      'contact': '聯絡我們'
                    }[item]}
                  </button>
                ))}
              </div>
              <a
                href="https://lin.ee/lj0gLqR"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#06C755] text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-[#05b34c] transition-colors shadow-lg"
              >
                <LineIcon className="w-4 h-4" />
                LINE 諮詢
              </a>
            </div>

            <div className="-mr-2 flex md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-temple-gold hover:text-white focus:outline-none"
              >
                {isMenuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-temple-red border-t border-temple-gold/30">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {['home', 'bulletin', 'about', 'deities', 'services', 'booking', 'donation', 'contact'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item)}
                  className="block w-full text-left px-3 py-4 rounded-md text-base font-medium text-white hover:text-temple-gold hover:bg-red-800"
                >
                  {{
                    'home': '首頁',
                    'bulletin': '公佈欄',
                    'about': '和聖壇緣起',
                    'deities': '神明介紹',
                    'services': '宮廟服務',
                    'booking': '預約諮詢',
                    'donation': '捐獻護持',
                    'contact': '聯絡我們'
                  }[item]}
                </button>
              ))}
              <div className="px-3 py-4">
                <a
                  href="https://lin.ee/lj0gLqR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#06C755] text-white px-4 py-3 rounded-lg text-center font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <LineIcon className="w-5 h-5" />
                  加入 LINE 官方帳號
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image Placeholder */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroImageUrl}
            alt="Temple Background"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-temple-red/70 to-temple-dark/80 mix-blend-multiply" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="mb-6 inline-block">
            <span className="bg-temple-gold/20 text-temple-gold border border-temple-gold px-4 py-1 rounded-full text-sm tracking-widest backdrop-blur-sm">
              護國佑民 • 慈悲濟世
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 font-serif drop-shadow-lg leading-tight">
            和聖壇 <br />
            <span className="text-temple-gold">靈感護佑</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-10 font-light tracking-wide max-w-2xl mx-auto">
            誠心祈求，自有感應。和聖壇提供線上預約服務，<br />為信眾指點迷津，解惑安神。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => scrollToSection('booking')}
              className="px-8 py-4 bg-temple-gold hover:bg-yellow-400 text-temple-red font-bold rounded-md shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              <Calendar className="w-5 h-5" />
              立即預約諮詢
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="px-8 py-4 bg-transparent border-2 border-white text-white hover:bg-white/10 font-bold rounded-md transition-all flex items-center justify-center gap-2 text-lg"
            >
              <ScrollText className="w-5 h-5" />
              了解服務項目
            </button>
          </div>
        </div>

        {/* Decorative Divider */}
        <div className="absolute bottom-0 w-full h-16 bg-temple-bg" style={{ clipPath: 'polygon(50% 100%, 100% 0, 100% 100%, 0 100%, 0 0)' }}></div>
      </section>

      {/* Bulletin Section (公佈欄) */}
      <section id="bulletin" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <Megaphone className="w-6 h-6 text-temple-red" />
              <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest">最新消息</h2>
            </div>
            <h3 className="text-4xl font-bold text-temple-dark font-serif">公佈欄</h3>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {['all', ...Object.values(BulletinCategory)].map((cat) => (
              <button
                key={cat}
                onClick={() => setBulletinFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  bulletinFilter === cat
                    ? 'bg-temple-red text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>

          {/* Bulletin List */}
          {filteredBulletins.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">目前沒有公告</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {filteredBulletins.map((bulletin) => (
                <div
                  key={bulletin.id}
                  className={`bg-temple-bg rounded-xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${
                    bulletin.isPinned ? 'border-temple-gold' : 'border-temple-red/30'
                  }`}
                >
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedBulletin(expandedBulletin === bulletin.id ? null : bulletin.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {bulletin.isPinned && (
                          <span className="inline-flex items-center gap-1 bg-temple-gold/20 text-temple-gold px-2 py-0.5 rounded-full text-xs font-bold">
                            <Pin className="w-3 h-3" /> 置頂
                          </span>
                        )}
                        <span className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                          bulletin.category === '活動公告' ? 'bg-blue-100 text-blue-700' :
                          bulletin.category === '法會通知' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {bulletin.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {new Date(bulletin.createdAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-temple-dark font-serif">{bulletin.title}</h4>
                    </div>
                    <div className="ml-4 text-gray-400 flex-shrink-0">
                      {expandedBulletin === bulletin.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                  {expandedBulletin === bulletin.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{bulletin.content}</div>
                      {bulletin.allowRegistration && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openRegisterModal(bulletin); }}
                          className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-temple-red text-white rounded-lg font-medium hover:bg-red-800 transition-colors shadow-sm"
                        >
                          <UserPlus className="w-4 h-4" /> 我要報名
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-temple-bg relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-full h-full border-4 border-temple-gold rounded-lg z-0"></div>
              <img
                src={aboutImageUrl}
                alt="和聖壇介紹"
                className="relative z-10 rounded-lg shadow-2xl w-full h-[500px] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center">
                <span className="w-8 h-1 bg-temple-red mr-3"></span>
                關於和聖壇
              </h2>
              <h3 className="text-4xl font-bold text-temple-dark mb-6 font-serif">
                虔誠信仰，世代傳承
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                和聖壇供奉神明，自建廟以來，香火鼎盛，神威顯赫。神明慈悲為懷，聞聲救苦，庇佑子民平安順遂。
              </p>
              <p className="text-gray-600 mb-8 leading-relaxed text-lg">
                本壇秉持正信正念，弘揚濟世精神。除了傳統祭祀儀式，更結合現代化服務，提供信眾心靈寄託與人生方向的指引。
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-temple-gold">
                  <span className="text-4xl font-bold text-temple-red font-serif block mb-2">1986</span>
                  <span className="text-gray-500">建壇年份</span>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-temple-gold">
                  <span className="text-4xl font-bold text-temple-red font-serif block mb-2">10萬+</span>
                  <span className="text-gray-500">年度信眾</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deities Section */}
      <section id="deities" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center">
              <span className="w-8 h-1 bg-temple-red mr-3"></span>
              神明介紹
              <span className="w-8 h-1 bg-temple-red ml-3"></span>
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark font-serif">供奉神明</h3>
          </div>
          {deities.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {deities.map((deity) => (
                <div key={deity.id} className="bg-temple-bg rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-temple-gold/20 group">
                  <div className="h-48 bg-gradient-to-br from-temple-red/10 to-temple-gold/10 flex items-center justify-center overflow-hidden">
                    {deity.imagePath ? (
                      <img src={getSiteImagePublicUrl(deity.imagePath)} alt={deity.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="text-center">
                        <Flame className="w-16 h-16 text-temple-gold/60 mx-auto mb-2" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 text-center">
                    <h4 className="text-xl font-bold text-temple-dark font-serif mb-1">{deity.name}</h4>
                    {deity.title && <p className="text-temple-red text-sm font-medium mb-3">{deity.title}</p>}
                    <p className="text-gray-600 text-sm leading-relaxed">{deity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400">載入中...</p>
          )}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 inline-block border-b-2 border-temple-gold pb-1">
            宮廟服務
          </h2>
          <h3 className="text-4xl font-bold text-temple-dark mb-16 font-serif">
            祈福保平安，點燈開智慧
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100">
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">光明燈 / 安太歲</h4>
              <p className="text-gray-600 mb-6">
                農曆新年期間，提供安太歲、點光明燈、文昌燈、財利燈服務，祈求流年順遂，元辰光彩。
              </p>
              <a href="#booking" className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                立即登記 <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </div>

            {/* Service 2 */}
            <div className="group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100">
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <ScrollText className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">收驚 / 祭改</h4>
              <p className="text-gray-600 mb-6">
                孩童受驚、成人運勢不順、車關血光等，皆可透過傳統科儀進行收驚祭改，化解厄運。
              </p>
              <a href="#booking" className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                預約時段 <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </div>

            {/* Service 3 */}
            <div className="group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-temple-gold text-white text-xs px-2 py-1 font-bold rounded-bl-lg">
                熱門服務
              </div>
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <HeartHandshake className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">問事諮詢</h4>
              <p className="text-gray-600 mb-6">
                事業、感情、家運遇有瓶頸，誠心向神明請示。本壇提供一對一專人解籤與諮詢服務。
              </p>
              <a href="#booking" className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                線上預約 <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Section */}
      <section id="booking" className="py-20 bg-temple-red relative text-white">
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-temple-gold font-serif text-lg font-bold tracking-widest mb-2">
              線上服務
            </h2>
            <h3 className="text-4xl font-bold mb-4 font-serif">
              預約諮詢表單
            </h3>
            <p className="text-red-100 max-w-2xl mx-auto">
              請填寫下方資料，我們將儘速為您安排諮詢時間。<br />
              <span className="text-temple-gold font-bold">※ 目前僅開放每週六晚上 (19:00 - 21:00) 時段預約。</span>
            </p>
          </div>

          <div className="bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12">
              {bookingStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">預約成功！</h4>
                  <p className="text-gray-600 mb-8">
                    感謝您的預約。廟方人員將於收到資料後，<br />透過電話與您確認最終諮詢時間。
                  </p>
                  <button
                    onClick={() => setBookingStatus('idle')}
                    className="px-6 py-3 bg-temple-red text-white rounded-md hover:bg-red-800 transition-colors"
                  >
                    再預約一筆
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">信眾大名 *</label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="請輸入姓名"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="0912-345-678"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">農曆出生年月日 *</label>
                      <input
                        type="text"
                        name="birthDate"
                        id="birthDate"
                        required
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="例如：農曆75年8月15日"
                      />
                    </div>
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">諮詢項目 *</label>
                      <select
                        name="type"
                        id="type"
                        required
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none bg-white"
                      >
                        {Object.values(ConsultationType).map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="bookingDate" className="block text-sm font-medium text-gray-700 mb-1">希望預約日期 (限週六) *</label>
                      <input
                        type="date"
                        name="bookingDate"
                        id="bookingDate"
                        required
                        value={formData.bookingDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">請選擇週六日期</p>
                    </div>
                    <div>
                      <label htmlFor="bookingTime" className="block text-sm font-medium text-gray-700 mb-1">希望時段 (限晚上) *</label>
                      <select
                        name="bookingTime"
                        id="bookingTime"
                        required
                        value={formData.bookingTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none bg-white"
                      >
                        <option value="">請選擇時段</option>
                        <option value="evening">晚上 (19:00 - 21:00)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">詳細說明 (選填)</label>
                    <textarea
                      name="notes"
                      id="notes"
                      rows={3}
                      value={formData.notes}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                      placeholder="請簡述您想請示的問題..."
                    ></textarea>
                  </div>

                  {bookingStatus === 'error' && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span>預約提交失敗，請檢查網路或稍後再試。</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={bookingStatus === 'loading'}
                      className={`w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all
                        ${bookingStatus === 'loading'
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-temple-gold text-temple-red hover:bg-yellow-400 hover:shadow-xl transform hover:-translate-y-1'}`}
                    >
                      {bookingStatus === 'loading' ? (
                        <span>處理中...</span>
                      ) : (
                        <>
                          <Flame className="w-5 h-5 fill-current" />
                          確認送出預約
                        </>
                      )}
                    </button>
                    <p className="text-center text-gray-500 text-sm mt-4">
                      * 提交後即代表同意本宮隱私權政策
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Donation Section */}
      <section id="donation" className="py-20 bg-temple-bg relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2">
              功德無量
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark mb-4 font-serif">
              隨喜捐獻 / 護持項目
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              您的每一分心意，都是支持和聖壇持續弘揚神恩、服務大眾的力量。
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-temple-gold/20 overflow-hidden">
            <div className="p-8 md:p-12">
              {donationStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">感謝您的護持！</h4>
                  <p className="text-gray-600 mb-8">
                    功德無量。我們已收到您的捐款意向，<br />廟方人員將會與您聯繫後續事宜。
                  </p>
                  <button
                    onClick={() => setDonationStatus('idle')}
                    className="px-6 py-3 bg-temple-red text-white rounded-md hover:bg-red-800 transition-colors"
                  >
                    返回
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDonationSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="don_name" className="block text-sm font-medium text-gray-700 mb-1">大德姓名 *</label>
                      <input
                        type="text"
                        name="name"
                        id="don_name"
                        required
                        value={donationData.name}
                        onChange={handleDonationChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="請輸入姓名"
                      />
                    </div>
                    <div>
                      <label htmlFor="don_phone" className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                      <input
                        type="tel"
                        name="phone"
                        id="don_phone"
                        required
                        value={donationData.phone}
                        onChange={handleDonationChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="0912-345-678"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="don_amount" className="block text-sm font-medium text-gray-700 mb-1">捐款金額 (NTD) *</label>
                      <input
                        type="number"
                        name="amount"
                        id="don_amount"
                        required
                        min="1"
                        value={donationData.amount || ''}
                        onChange={handleDonationChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                        placeholder="請輸入金額"
                      />
                    </div>
                    <div>
                      <label htmlFor="don_type" className="block text-sm font-medium text-gray-700 mb-1">指定項目 *</label>
                      <select
                        name="type"
                        id="don_type"
                        required
                        value={donationData.type}
                        onChange={handleDonationChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none bg-white"
                      >
                        {Object.values(DonationType).map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="don_notes" className="block text-sm font-medium text-gray-700 mb-1">備註說明 (選填)</label>
                    <textarea
                      name="notes"
                      id="don_notes"
                      rows={3}
                      value={donationData.notes}
                      onChange={handleDonationChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                      placeholder="如有特定祈福對象或說明請填寫..."
                    ></textarea>
                  </div>

                  {donationStatus === 'error' && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span>提交失敗，請檢查網路或稍後再試。</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={donationStatus === 'loading'}
                      className={`w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all
                        ${donationStatus === 'loading'
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-temple-red text-white hover:bg-red-800 hover:shadow-xl transform hover:-translate-y-1'}`}
                    >
                      {donationStatus === 'loading' ? (
                        <span>處理中...</span>
                      ) : (
                        <>
                          <HeartHandshake className="w-5 h-5" />
                          確認捐獻護持
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-temple-dark text-white border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-white p-0.5 rounded-full border border-temple-gold/30">
                  <img src="/logo.png" alt="和聖壇 Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                </div>
                <span className="text-xl font-bold font-serif tracking-widest">和聖壇</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                神明慈悲為懷，庇佑十方善信。<br />
                歡迎各界善男信女蒞臨參香指導，共沐神恩。
              </p>
              <div className="flex space-x-4">
                <a
                  href="https://lin.ee/lj0gLqR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center hover:scale-110 transition-transform text-white"
                >
                  <span className="sr-only">LINE</span>
                  <LineIcon className="h-5 w-5" />
                </a>
                <a href="https://www.facebook.com/100064534546570" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-temple-gold hover:text-temple-red transition-colors">
                  <span className="sr-only">Facebook</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                </a>
                <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-temple-gold hover:text-temple-red transition-colors">
                  <span className="sr-only">Instagram</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772 4.902 4.902 0 011.772-1.153c.636-.247 1.363-.416 2.427-.465C9.673 2.013 10.03 2 12.484 2h.05m0 5.238a5.238 5.238 0 110 10.476 5.238 5.238 0 010-10.476zm0 2.162a3.077 3.077 0 100 6.154 3.077 3.077 0 000-6.154zM20.24 6.388a1.44 1.44 0 10-2.88 0 1.44 1.44 0 002.88 0z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold font-serif text-temple-gold mb-6">聯絡資訊</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-gray-400">
                  <MapPin className="w-5 h-5 mt-1 text-temple-red" />
                  <span>100臺北市中正區晉江街72巷9號</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-400">
                  <Phone className="w-5 h-5 text-temple-red" />
                  <span>(02) 2345-6789</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-400">
                  <Clock className="w-5 h-5 text-temple-red" />
                  <span>每日 06:00 - 21:00</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold font-serif text-temple-gold mb-6">交通指引</h4>
              <a
                href="https://www.google.com/maps/search/100臺北市中正區晉江街72巷9號"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-52 rounded-lg overflow-hidden border border-gray-700 hover:opacity-90 transition-opacity"
              >
                <iframe
                  title="和聖壇地圖"
                  src="https://maps.google.com/maps?q=100臺北市中正區晉江街72巷9號&output=embed&hl=zh-TW"
                  width="100%"
                  height="100%"
                  style={{ border: 0, pointerEvents: 'none' }}
                  allowFullScreen
                  loading="lazy"
                />
              </a>
              <p className="text-sm text-gray-500 mt-3">
                📍 點擊地圖可在 Google Maps 中開啟導航
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} 和聖壇. All rights reserved. 網站設計：信徒志工團</p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="mt-4 md:mt-0 flex items-center hover:text-temple-gold transition-colors"
            >
              <Settings className="w-4 h-4 mr-1" /> 管理員登入
            </button>
          </div>
        </div>
      </footer>

      {/* Floating LINE Button */}
      <a
        href="https://lin.ee/lj0gLqR"
        target="_blank"
        rel="noopener noreferrer"
        title="加入 LINE 諮詢"
        className="fixed bottom-8 right-8 z-[60] bg-[#06C755] text-white w-16 h-16 rounded-full shadow-2xl hover:scale-110 transition-transform flex flex-col items-center justify-center gap-0.5"
      >
        <LineIcon className="w-7 h-7" />
        <span className="text-[11px] font-bold tracking-wider leading-none">LINE</span>
      </a>

      {/* Registration Modal (活動報名) */}
      {registerBulletin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRegisterBulletin(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-temple-red px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white text-lg font-bold font-serif tracking-wide">活動報名</h2>
              </div>
              <button onClick={() => setRegisterBulletin(null)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="bg-temple-bg rounded-lg p-3 mb-5">
                <p className="text-sm text-gray-500">報名活動</p>
                <p className="font-bold text-temple-dark font-serif">{registerBulletin.title}</p>
              </div>

              {regStatus === 'success' ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">報名成功！</h3>
                  <p className="text-gray-500 mb-6">我們已收到您的報名資訊，感謝您的參與。</p>
                  <button onClick={() => setRegisterBulletin(null)}
                    className="px-6 py-2.5 bg-temple-red text-white rounded-lg font-medium hover:bg-red-800 transition-colors">
                    關閉
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                    <input type="text" required value={regForm.name}
                      onChange={e => setRegForm({...regForm, name: e.target.value})}
                      placeholder="請輸入姓名"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                    <input type="tel" required value={regForm.phone}
                      onChange={e => setRegForm({...regForm, phone: e.target.value})}
                      placeholder="請輸入聯絡電話"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">報名人數</label>
                    <input type="number" min={1} max={99} value={regForm.numPeople}
                      onChange={e => setRegForm({...regForm, numPeople: Number(e.target.value) || 1})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <textarea value={regForm.notes || ''} rows={2}
                      onChange={e => setRegForm({...regForm, notes: e.target.value})}
                      placeholder="其他需要告知的事項..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent resize-none" />
                  </div>

                  {regStatus === 'error' && (
                    <p className="text-red-500 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> 報名失敗，請稍後再試。
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setRegisterBulletin(null)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                      取消
                    </button>
                    <button type="submit" disabled={regStatus === 'loading'}
                      className="flex-1 px-4 py-3 bg-temple-red text-white rounded-lg hover:bg-red-800 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                      {regStatus === 'loading' ? '報名中...' : <><UserPlus className="w-4 h-4" /> 確認報名</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCloseLoginModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-temple-red px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-white text-lg font-bold font-serif tracking-wide">管理員登入</h2>
              </div>
              <button
                onClick={handleCloseLoginModal}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdminLogin} className="px-6 py-6">
              <p className="text-gray-500 text-sm mb-5">請輸入管理員帳號與密碼以進入後台管理系統。</p>

              <div className="mb-3">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginError(''); }}
                  placeholder="管理員電子郵件"
                  autoFocus
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent"
                />
              </div>

              <div className="relative mb-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                  placeholder="密碼"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {loginError && (
                <p className="text-red-500 text-sm mb-4 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {loginError}
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleCloseLoginModal}
                  disabled={loginLoading}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 px-4 py-3 bg-temple-red text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>登入中...</span>
                  ) : (
                    <><Lock className="w-4 h-4" /> 登入後台</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;