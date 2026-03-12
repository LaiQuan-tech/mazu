import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
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
  UserPlus,
  User as UserIcon,
  BookUser,
  Plus,
  Sparkles,
  Share2,
  Copy,
  CheckCircle
} from 'lucide-react';

const LineIcon = ({ className }: { className?: string }) => (
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/330px-LINE_logo.svg.png" alt="LINE" className={className} style={{ objectFit: 'contain' }} />
);

import { BlessingEventRecord, BlessingRegistrationData, BookingData, BulletinCategory, BulletinRecord, ConsultationType, DeityRecord, DonationData, DonationType, HeroSlideRecord, LampRegistrationData, LampServiceConfig, MemberContact, ProfileData, SharedEntryData, SharedServiceType, SharedSessionConfig, SharedSessionRecord, ZodiacSign } from './types';
import { submitBooking, submitDonation, getBulletins, getSiteImages, getSiteImagePublicUrl, getDeities, getHeroSlides, getLampServiceConfigs, submitLampRegistration, getMemberContacts, getProfile, getBlessingEvents, createBlessingRegistration, createSharedSession, getSharedSession, addSharedEntry, markSharedSessionSubmitted, autoSaveContactsForMember, supabase } from './services/supabase';
import SharedFormPanel from './components/SharedFormPanel';
import AdminDashboard from './components/AdminDashboard';
import ScripturePage from './components/ScripturePage';
import MemberPortal from './components/MemberPortal';
import BirthDatePicker from './components/BirthDatePicker';

// ── 多人報名用本地型別 ──────────────────────────────────────────────────────────
const newId = () => Math.random().toString(36).slice(2, 10);

interface LampPersonEntry {
  id: string;
  serviceId: string;
  name: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  address: string;
  contactLabel?: string;
  _bKey?: number; // 通訊錄選取後遞增，強制 BirthDatePicker 重新初始化
}
interface BookingPersonEntry {
  id: string;
  name: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  address: string;
  contactLabel?: string;
  type: ConsultationType;
  _bKey?: number;
}
interface DonationPersonEntry {
  id: string;
  name: string;
  address: string;
  contactLabel?: string;
  amount: number;
  type: DonationType;
}
interface BlessingPersonEntry {
  id: string;
  name: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  gender: string;
  address: string;
  contactLabel?: string;
  _bKey?: number;
  packageId?: string; // 所選方案 ID（有多方案時）
}

// 水墨筆刷分隔線元件

const App: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScripture, setShowScripture] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isScrolled, setIsScrolled] = useState(false);
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
  const HERO_FALLBACK = 'https://images.unsplash.com/photo-1542045938-4e8c18731c39?q=80&w=2070&auto=format&fit=crop';
  const [heroSlides, setHeroSlides] = useState<HeroSlideRecord[]>([]);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const heroIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [aboutImageUrl, setAboutImageUrl] = useState('/picture/Introduction 1.jpg');
  const [deities, setDeities] = useState<DeityRecord[]>([]);
  const [lampConfigs, setLampConfigs] = useState<LampServiceConfig[]>([]);
  // ── 點燈多人 ──
  const [lampPersons, setLampPersons] = useState<LampPersonEntry[]>([{ id: newId(), serviceId: '', name: '', birthDate: '', zodiac: undefined, address: '' }]);
  const [lampNotes, setLampNotes] = useState('');
  const [lampStatus, setLampStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [member, setMember] = useState<User | null>(null);
  const [memberProfile, setMemberProfile] = useState<ProfileData | null>(null);
  const [showMemberPortal, setShowMemberPortal] = useState(false);
  const [memberContacts, setMemberContacts] = useState<MemberContact[]>([]);
  const [showContactPicker, setShowContactPicker] = useState<{ form: 'lamp' | 'booking' | 'donation' | 'blessing'; personId: string } | null>(null);
  // ── 祈福活動 ──
  const [blessingEvents, setBlessingEvents] = useState<BlessingEventRecord[]>([]);
  const [blessingModal, setBlessingModal] = useState<BlessingEventRecord | null>(null);
  const [blessingPersons, setBlessingPersons] = useState<BlessingPersonEntry[]>([{ id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: '' }]);
  const [blessingNotes, setBlessingNotes] = useState('');
  const [blessingStatus, setBlessingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // ── 共享報名表 ──
  const [sharedSession,      setSharedSession]      = useState<SharedSessionRecord | null>(null);
  const [isCreator,          setIsCreator]           = useState(false);
  const [showShareModal,     setShowShareModal]      = useState(false);
  const [creatingShare,      setCreatingShare]       = useState(false);
  const [sharedSubmitStatus, setSharedSubmitStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [urlCopied,          setUrlCopied]           = useState(false);

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

  // ── 問事多人 ──
  const [bookingPersons, setBookingPersons] = useState<BookingPersonEntry[]>([{ id: newId(), name: '', birthDate: '', zodiac: undefined, address: '', type: ConsultationType.CAREER }]);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // ── 捐獻多人 ──
  const [donationPersons, setDonationPersons] = useState<DonationPersonEntry[]>([{ id: newId(), name: '', address: '', amount: 0, type: DonationType.GENERAL }]);
  const [donationNotes, setDonationNotes] = useState('');

  const startHeroInterval = (totalSlides: number) => {
    if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    if (totalSlides <= 1) return;
    heroIntervalRef.current = setInterval(() => {
      setHeroSlideIndex(prev => (prev + 1) % totalSlides);
    }, 5000);
  };

  const loadMemberContacts = async () => {
    try {
      const contacts = await getMemberContacts();
      setMemberContacts(contacts);
    } catch {
      setMemberContacts([]);
    }
  };

  const loadMemberProfile = async () => {
    try {
      const p = await getProfile();
      setMemberProfile(p);
    } catch {
      setMemberProfile(null);
    }
  };

  const handleOpenContactPicker = (form: 'lamp' | 'booking' | 'donation' | 'blessing', personId: string) => {
    if (!member) { setShowMemberPortal(true); return; }
    const hasProfile = !!(memberProfile && memberProfile.name);
    if (!hasProfile && memberContacts.length === 0) { alert('請先至會員中心填寫個人資料或新增聯絡人'); return; }
    setShowContactPicker({ form, personId });
  };

  useEffect(() => {
    getBulletins().then(setBulletins).catch(console.error);
    getDeities().then(all => setDeities(all.filter(d => d.isVisible !== false))).catch(console.error);
    getLampServiceConfigs(true).then(setLampConfigs).catch(console.error);
    getBlessingEvents(true).then(setBlessingEvents).catch(console.error);
    getSiteImages().then(images => {
      for (const img of images) {
        if (img.sectionKey === 'about') setAboutImageUrl(getSiteImagePublicUrl(img.storagePath));
      }
    }).catch(console.error);
    getHeroSlides().then(slides => {
      setHeroSlides(slides);
      startHeroInterval(slides.length);
    }).catch(console.error);

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setMember(u);
      if (u) { loadMemberContacts(); loadMemberProfile(); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setMember(session?.user ?? null);
      if (session?.user) { loadMemberContacts(); loadMemberProfile(); }
      else { setMemberContacts([]); setMemberProfile(null); }
    });

    // ── 共享報名表 URL 偵測 ──
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (shareId) {
      getSharedSession(shareId).then(session => {
        if (!session) return;
        setSharedSession(session);
        if (localStorage.getItem(`shared_creator_${shareId}`) === 'true') setIsCreator(true);
        setTimeout(() => scrollToSection(
          session.serviceType === 'lamp'     ? 'lamps'    :
          session.serviceType === 'blessing' ? 'blessing' : 'booking'
        ), 600);
      });
    }

    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
      subscription.unsubscribe();
    };
  }, []);

  const filteredBulletins = bulletinFilter === 'all'
    ? bulletins
    : bulletins.filter(b => b.category === bulletinFilter);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // ── 點燈送出（批次） ──
  const handleLampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = lampPersons.find(p => !p.serviceId || !p.name.trim());
    if (invalid) { alert('請填寫所有人員的服務項目與姓名。'); return; }
    setLampStatus('loading');
    try {
      await Promise.all(lampPersons.map(p => submitLampRegistration({
        serviceId: p.serviceId, name: p.name, phone: memberProfile?.phone ?? '', birthDate: p.birthDate, zodiac: p.zodiac, address: p.address || undefined, contactLabel: p.contactLabel, notes: lampNotes,
      })));
      autoSaveContactsForMember(lampPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
      setLampStatus('success');
      setLampPersons([{ id: newId(), serviceId: '', name: '', birthDate: '', zodiac: undefined, address: '' }]);
      setLampNotes('');
    } catch {
      setLampStatus('error');
    }
  };

  // ── 問事送出（批次） ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) { alert('請選擇希望預約日期。'); return; }
    const date = new Date(bookingDate);
    if (date.getDay() !== 6) { alert('請選擇週六的日期。'); return; }
    if (bookingTime !== 'evening') { alert('目前僅開放晚上時段預約。'); return; }
    setBookingStatus('loading');
    try {
      await Promise.all(bookingPersons.map(p => submitBooking({
        name: p.name, phone: memberProfile?.phone ?? '', birthDate: p.birthDate, zodiac: p.zodiac, address: p.address || undefined, contactLabel: p.contactLabel,
        bookingDate, bookingTime, type: p.type, notes: bookingNotes,
      })));
      autoSaveContactsForMember(bookingPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
      setBookingStatus('success');
      setBookingPersons([{ id: newId(), name: '', birthDate: '', zodiac: undefined, address: '', type: ConsultationType.CAREER }]);
      setBookingDate(''); setBookingTime(''); setBookingNotes('');
    } catch (error) {
      console.error(error);
      setBookingStatus('error');
    }
  };

  // ── 捐獻送出（批次） ──
  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = donationPersons.find(p => !p.name.trim() || p.amount <= 0);
    if (invalid) { alert('請填寫所有人員的姓名與捐款金額。'); return; }
    setDonationStatus('loading');
    try {
      await Promise.all(donationPersons.map(p => submitDonation({
        name: p.name, phone: memberProfile?.phone ?? '', address: p.address || undefined, contactLabel: p.contactLabel, amount: p.amount, type: p.type, notes: donationNotes,
      })));
      setDonationStatus('success');
      setDonationPersons([{ id: newId(), name: '', address: '', amount: 0, type: DonationType.GENERAL }]);
      setDonationNotes('');
    } catch {
      setDonationStatus('error');
    }
  };

  // ── 祈福送出 ──
  const handleBlessingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blessingModal) return;
    const invalid = blessingPersons.find(p => !p.name.trim());
    if (invalid) { alert('請填寫所有人員的姓名'); return; }
    const hasPackages = blessingModal.packages && blessingModal.packages.length > 0;
    if (hasPackages && blessingPersons.some(p => !p.packageId)) {
      alert('請為每位報名者選擇護持方案');
      return;
    }
    setBlessingStatus('loading');
    try {
      await Promise.all(blessingPersons.map(p => {
        const pkg = hasPackages ? blessingModal.packages.find(pk => pk.id === p.packageId) : undefined;
        return createBlessingRegistration({
          eventId: blessingModal.id,
          name: p.name.trim(),
          phone: memberProfile?.phone ?? '',
          birthDate: p.birthDate || undefined,
          zodiac: p.zodiac,
          gender: p.gender || undefined,
          address: p.address || undefined,
          notes: blessingNotes || undefined,
          packageName: pkg?.name,
          packageFee:  pkg?.fee,
        } as BlessingRegistrationData);
      }));
      autoSaveContactsForMember(blessingPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
      setBlessingStatus('success');
      setBlessingPersons([{ id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: '' }]);
      setBlessingNotes('');
    } catch {
      setBlessingStatus('error');
    }
  };

  const openBlessingModal = (event: BlessingEventRecord) => {
    setBlessingModal(event);
    setBlessingPersons([{ id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: '' }]);
    setBlessingNotes('');
    setBlessingStatus('idle');
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  // ── 共享報名表 handlers ──
  const handleCreateSharedSession = async (type: SharedServiceType) => {
    setCreatingShare(true);
    try {
      let config: SharedSessionConfig = {};
      if (type === 'blessing' && blessingModal)
        config = { eventId: blessingModal.id, eventTitle: blessingModal.title, fee: blessingModal.fee };
      else if (type === 'booking')
        config = { bookingDate, bookingTime };

      const session = await createSharedSession({ serviceType: type, config });
      setSharedSession(session);
      setIsCreator(true);
      localStorage.setItem(`shared_creator_${session.id}`, 'true');
      const url = new URL(window.location.href);
      url.searchParams.set('share', session.id);
      window.history.pushState({}, '', url.toString());
      setShowShareModal(true);
    } catch { alert('建立共享報名表失敗'); }
    finally { setCreatingShare(false); }
  };

  const handleAddSharedEntries = async (entries: Omit<SharedEntryData, 'sessionId'>[]) => {
    if (!sharedSession) return;
    await Promise.all(entries.map(e => addSharedEntry({ sessionId: sharedSession.id, ...e })));
    const updated = await getSharedSession(sharedSession.id);
    if (updated) setSharedSession(updated);
  };

  const handleSubmitSharedSession = async () => {
    if (!sharedSession || sharedSession.entries.length === 0) return;
    setSharedSubmitStatus('loading');
    try {
      const entries = sharedSession.entries;
      if (sharedSession.serviceType === 'lamp') {
        await Promise.all(entries.map(e => submitLampRegistration({
          serviceId:    e.serviceId ?? '',
          name:         e.name,
          phone:        e.phone ?? memberProfile?.phone ?? '',
          birthDate:    e.birthDate ?? '',
          zodiac:       e.zodiac as ZodiacSign | undefined,
          address:      e.address,
          contactLabel: e.contactLabel,
          notes:        e.notes,
        })));
      } else if (sharedSession.serviceType === 'blessing' && sharedSession.config.eventId) {
        const evt = blessingEvents.find(ev => ev.id === sharedSession.config.eventId);
        await Promise.all(entries.map(e => {
          const pkg = evt?.packages.find(p => p.id === e.packageId);
          return createBlessingRegistration({
            eventId:     sharedSession.config.eventId!,
            name:        e.name,
            phone:       e.phone ?? memberProfile?.phone ?? '',
            birthDate:   e.birthDate,
            zodiac:      e.zodiac as ZodiacSign | undefined,
            gender:      e.gender,
            address:     e.address,
            notes:       e.notes,
            packageName: pkg?.name,
            packageFee:  pkg?.fee,
          });
        }));
      } else if (sharedSession.serviceType === 'booking') {
        await Promise.all(entries.map(e => submitBooking({
          name:        e.name,
          phone:       e.phone ?? memberProfile?.phone ?? '',
          birthDate:   e.birthDate ?? '',
          zodiac:      e.zodiac as ZodiacSign | undefined,
          address:     e.address,
          contactLabel: e.contactLabel,
          bookingDate: sharedSession.config.bookingDate ?? '',
          bookingTime: sharedSession.config.bookingTime ?? '',
          type:        (e.bookingType as any) ?? '',
          notes:       e.notes,
        } as BookingData)));
      }
      await markSharedSessionSubmitted(sharedSession.id);
      localStorage.removeItem(`shared_creator_${sharedSession.id}`);
      setSharedSubmitStatus('success');
      const updated = await getSharedSession(sharedSession.id);
      if (updated) setSharedSession(updated);
    } catch {
      setSharedSubmitStatus('error');
    }
  };

  const sharedSessionUrl = sharedSession
    ? `${window.location.origin}${window.location.pathname}?share=${sharedSession.id}`
    : '';

  if (showAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
  }

  if (showScripture) {
    return <ScripturePage onBack={() => setShowScripture(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col text-temple-dark selection:bg-temple-red selection:text-white">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#F0E9CE]/98 backdrop-blur-md shadow-md border-b border-[#C49820]/50'
          : 'bg-[#F0E9CE]/92 backdrop-blur-sm border-b border-[#C49820]/20'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'h-16' : 'h-20'}`}>
            <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => scrollToSection('home')}>
              <img src="/logo.png" alt="台北古亭和聖壇 Logo" className={`object-contain transition-all duration-300 ${isScrolled ? 'w-10 h-10' : 'w-14 h-14'}`} referrerPolicy="no-referrer" />
              <div className="hidden sm:block">
                <h1 className={`text-temple-dark font-bold tracking-widest font-serif transition-all duration-300 ${isScrolled ? 'text-base' : 'text-lg'}`}>台北古亭和聖壇</h1>
                <p className="text-[10px] tracking-widest text-temple-red/70 uppercase hidden lg:block">He Sheng Altar</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1">
              {['home', 'about', 'deities', 'lamps', 'blessing', 'booking', 'donation'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item)}
                  className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 font-serif whitespace-nowrap
                    ${activeSection === item
                      ? 'bg-temple-gold/15 text-temple-red font-semibold'
                      : 'text-[#3D2800] hover:bg-[#C49820]/10 hover:text-temple-red'}`}
                >
                  {{
                    'home': '首頁',
                    'bulletin': '公佈欄',
                    'about': '緣起',
                    'deities': '神明',
                    'services': '服務',
                    'lamps': '點燈',
                    'blessing': '祈福',
                    'booking': '問事',
                    'donation': '捐獻',
                    'contact': '聯絡'
                  }[item]}
                  {activeSection === item && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-temple-gold rounded-full" />
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowScripture(true)}
                className="relative px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 font-serif whitespace-nowrap text-temple-red/80 hover:bg-temple-red/10 hover:text-temple-red border border-temple-red/30"
              >
                聖母經
              </button>
              <div className="w-px h-6 bg-[#3D2800]/20 mx-1" />
              <button
                onClick={() => setShowMemberPortal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-temple-red text-white shadow-md hover:bg-[#5C1A04] hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                <UserIcon className="w-4 h-4" />
                {member ? '會員中心' : '登入 / 註冊'}
              </button>
            </div>

            <div className="-mr-2 flex lg:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-full text-temple-red hover:text-temple-dark hover:bg-[#C49820]/10 transition-colors"
              >
                {isMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-[#F0E9CE]/98 backdrop-blur-md border-t border-[#C49820]/30 px-4 pt-2 pb-4 space-y-1">
            {['home', 'about', 'deities', 'lamps', 'blessing', 'booking', 'donation'].map((item) => (
              <button
                key={item}
                onClick={() => scrollToSection(item)}
                className={`block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200
                  ${activeSection === item
                    ? 'bg-temple-gold/15 text-temple-red font-semibold'
                    : 'text-[#3D2800] hover:bg-[#C49820]/10 hover:text-temple-red'}`}
              >
                {{
                  'home': '首頁',
                  'bulletin': '公佈欄',
                  'about': '和聖壇緣起',
                  'deities': '神明',
                  'services': '宮廟服務',
                  'lamps': '點燈',
                  'blessing': '祈福',
                  'booking': '問事',
                  'donation': '捐獻護持',
                  'contact': '聯絡我們'
                }[item]}
              </button>
            ))}
            <button
              onClick={() => { setShowScripture(true); setIsMenuOpen(false); }}
              className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 text-temple-red border border-temple-red/30 hover:bg-temple-red/10"
            >
              ✦ 聖母經
            </button>
            <button
              onClick={() => { setShowMemberPortal(true); setIsMenuOpen(false); }}
              className="w-full px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 text-temple-red border border-temple-gold/50 hover:bg-temple-gold/10 flex items-center gap-2"
            >
              <UserIcon className="w-5 h-5" />
              {member ? '會員中心' : '會員登入'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Slideshow Background */}
        <div className="absolute inset-0 z-0">
          {heroSlides.length > 0 ? (
            heroSlides.map((slide, index) => (
              <img
                key={slide.id}
                src={getSiteImagePublicUrl(slide.imagePath)}
                alt={`投影片 ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${index === heroSlideIndex ? 'opacity-100' : 'opacity-0'}`}
                referrerPolicy="no-referrer"
              />
            ))
          ) : (
            <img
              src={HERO_FALLBACK}
              alt="Temple Background"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
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
              className="px-8 py-4 bg-temple-gold hover:bg-[#E09860] text-white font-bold rounded-full shadow-[0_0_20px_rgba(212,133,74,0.4)] transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              <Calendar className="w-5 h-5" />
              立即預約問事
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

        {/* Dot Indicators */}
        {heroSlides.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setHeroSlideIndex(i);
                  startHeroInterval(heroSlides.length);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${i === heroSlideIndex ? 'bg-temple-gold w-6' : 'bg-white/50 w-2 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}

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
            <div className="flex items-center justify-center gap-3 mt-3 mb-2">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
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
                          bulletin.category === '點燈公告' ? 'bg-orange-100 text-orange-700' :
                          bulletin.category === '祈福公告' ? 'bg-purple-100 text-purple-700' :
                          bulletin.category === '問事公告' ? 'bg-blue-100 text-blue-700' :
                          bulletin.category === '捐獻公告' ? 'bg-yellow-100 text-yellow-700' :
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
                      {bulletin.linkedService && (() => {
                        const svcLabel:  Record<string, string> = { lamp: '點燈', blessing: '祈福', booking: '問事', donation: '捐獻' };
                        const svcAnchor: Record<string, string> = { lamp: 'lamps', blessing: 'blessing', booking: 'booking', donation: 'donation' };
                        return (
                          <button
                            onClick={e => { e.stopPropagation(); scrollToSection(svcAnchor[bulletin.linkedService!] ?? bulletin.linkedService!); }}
                            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-temple-red text-white rounded-lg font-medium hover:bg-[#5C1A04] transition-colors shadow-sm"
                          >
                            前往{svcLabel[bulletin.linkedService!] ?? ''}登記 →
                          </button>
                        );
                      })()}
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
                <span className="w-8 h-1 bg-temple-gold mr-3"></span>
                關於和聖壇
              </h2>
              <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
                虔誠信仰，世代傳承
              </h3>
              <div className="flex items-center gap-3 mt-2 mb-6">
                <span className="w-8 h-px bg-temple-gold/70" />
                <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
                <span className="w-20 h-px bg-temple-gold/70" />
              </div>
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
              <span className="w-8 h-1 bg-temple-gold mr-3"></span>
              神明介紹
              <span className="w-8 h-1 bg-temple-gold ml-3"></span>
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark font-serif">供奉神明</h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-2">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
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
          <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-2">
            <span className="w-8 h-1 bg-temple-gold"></span>
            宮廟服務
            <span className="w-8 h-1 bg-temple-gold"></span>
          </h2>
          <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
            祈福保平安，點燈開智慧
          </h3>
          <div className="flex items-center justify-center gap-3 mt-3 mb-12">
            <span className="w-12 h-px bg-temple-gold/70" />
            <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
            <span className="w-12 h-px bg-temple-gold/70" />
          </div>

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
              <button onClick={() => scrollToSection('lamps')} className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                立即登記 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Service 2 */}
            <div className="group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100">
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">祈福法會</h4>
              <p className="text-gray-600 mb-6">
                舉辦各式祈福法會，為信眾消災解厄、增福添壽，並提供個人與闔家平安祈福登記。
              </p>
              <button onClick={() => scrollToSection('blessing')} className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                立即報名 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Service 3 */}
            <div className="group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-temple-gold text-white text-xs px-2 py-1 font-bold rounded-bl-lg">
                熱門服務
              </div>
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <HeartHandshake className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">問事服務</h4>
              <p className="text-gray-600 mb-6">
                事業、感情、家運遇有瓶頸，誠心向神明請示。本壇提供一對一專人解籤與問事服務。
              </p>
              <a href="#booking" className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                線上預約 <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </section>

{/* Lamps Section */}
      <section id="lamps" className="py-20 bg-temple-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-14">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 inline-block border-b-2 border-temple-gold pb-1">
              點燈服務
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
              祈福點燈，光明護佑
            </h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-500 max-w-xl mx-auto">
              為本人或家人點燃平安燈，祈求諸事順遂、光明護佑。歡迎線上登記，廟方人員將與您確認細節。
            </p>
          </div>

          {/* Service Cards */}
          {lampConfigs.length > 0 ? (
            <div className={`grid gap-6 mb-16 ${lampConfigs.length <= 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : lampConfigs.length === 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              {lampConfigs.map(cfg => (
                <div key={cfg.id} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  {cfg.imageUrl
                    ? <img src={cfg.imageUrl} alt={cfg.name} className="w-20 h-20 object-cover rounded-2xl border border-gray-100 mb-4 shadow-sm" />
                    : <div className="w-14 h-14 bg-temple-red/10 rounded-full flex items-center justify-center mb-4">
                        <Flame className="w-7 h-7 text-temple-red" />
                      </div>
                  }
                  <h4 className="text-xl font-bold text-temple-dark font-serif mb-2">{cfg.name}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{cfg.description}</p>
                  <div className="mt-auto">
                    <span className="text-2xl font-bold text-temple-red">NT$ {cfg.fee.toLocaleString()}</span>
                    <span className="text-gray-400 text-sm ml-1">/ 年</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 mb-16 py-8">
              <Flame className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>點燈服務資訊載入中...</p>
            </div>
          )}

          {/* Registration Form */}
          <div className="max-w-2xl mx-auto">
            {sharedSession?.serviceType === 'lamp' && (
              <SharedFormPanel
                session={sharedSession} isCreator={isCreator}
                lampConfigs={lampConfigs} blessingEvent={null}
                memberProfile={memberProfile}
                onAddEntries={handleAddSharedEntries}
                onSubmitAll={handleSubmitSharedSession}
                onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
                submitStatus={sharedSubmitStatus}
              />
            )}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-temple-red px-8 py-5">
                <h4 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                  <Flame className="w-5 h-5 text-temple-gold" />
                  線上登記點燈
                </h4>
                <p className="text-red-100 text-sm mt-1">填妥資料後送出，廟方人員將主動聯繫確認。</p>
              </div>
              <div className="p-8">
                {lampStatus === 'success' ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h5 className="text-xl font-bold text-gray-800 mb-2">登記成功！</h5>
                    <p className="text-gray-500 mb-6">感謝您的登記，廟方人員將盡快與您聯繫確認。</p>
                    <button
                      onClick={() => setLampStatus('idle')}
                      className="px-6 py-2.5 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors text-sm font-medium"
                    >
                      再登記一筆
                    </button>
                  </div>
                ) : !member ? (
                  <div className="text-center py-10">
                    <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-600 font-medium mb-1">請先登入會員</p>
                    <p className="text-gray-400 text-sm mb-5">登入後即可登記點燈服務</p>
                    <button type="button" onClick={() => setShowMemberPortal(true)}
                      className="px-6 py-2.5 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors text-sm font-medium">
                      登入 / 註冊
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLampSubmit} className="space-y-4">
                    {/* 人員卡片列表 */}
                    {lampPersons.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位燈主</span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleOpenContactPicker('lamp', p.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                              <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                            </button>
                            {lampPersons.length > 1 && (
                              <button type="button" onClick={() => setLampPersons(prev => prev.filter(x => x.id !== p.id))}
                                className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* 燈別 */}
                        <select required value={p.serviceId}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, serviceId: e.target.value } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                          <option value="">請選擇服務項目 *</option>
                          {lampConfigs.map(cfg => (
                            <option key={cfg.id} value={cfg.id}>{cfg.name}　NT$ {cfg.fee.toLocaleString()} / 年</option>
                          ))}
                        </select>
                        {/* 姓名 */}
                        <input required type="text" placeholder="信眾大名 *"
                          value={p.name}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`lamp-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        {/* 生肖（自動帶入，可手動修改） */}
                        <select value={p.zodiac || ''}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, zodiac: (e.target.value as ZodiacSign) || undefined } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                          <option value="">生肖（自動帶入，可手動修改）</option>
                          {Object.values(ZodiacSign).map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <input required type="text" placeholder="現居地址 *"
                          value={p.address}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                      </div>
                    ))}

                    {/* 新增人員 */}
                    <button type="button"
                      onClick={() => setLampPersons(prev => [...prev, { id: newId(), serviceId: '', name: '', birthDate: '', zodiac: undefined, address: '' }])}
                      className="w-full py-2.5 border-2 border-dashed border-temple-gold/40 text-temple-red/70 rounded-xl text-sm hover:border-temple-gold hover:text-temple-red hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1.5">
                      <X className="w-4 h-4 rotate-45" /> 新增人員
                    </button>

                    {/* 備註（共用） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼</label>
                      <input value={lampNotes} onChange={e => setLampNotes(e.target.value)}
                        placeholder="完成匯款後請填寫帳號後五碼，以利核對"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                    </div>

                    {lampStatus === 'error' && (
                      <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        登記失敗，請稍後再試或直接與廟方聯繫。
                      </div>
                    )}

                    <button type="submit" disabled={lampStatus === 'loading'}
                      className="w-full py-3.5 bg-temple-red text-white font-bold rounded-lg hover:bg-[#5C1A04] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                      <Flame className="w-4 h-4" />
                      {lampStatus === 'loading' ? '送出中...' : `送出登記（共 ${lampPersons.length} 人）`}
                    </button>
                    {!sharedSession && (
                      <button type="button" onClick={() => handleCreateSharedSession('lamp')}
                        disabled={creatingShare}
                        className="w-full py-2.5 mt-2 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

{/* Booking Section */}
      <section id="booking" className="py-20 bg-temple-red relative text-white">
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#D4854A 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-temple-gold font-serif text-lg font-bold tracking-widest mb-2">
              線上服務
            </h2>
            <h3 className="text-4xl font-bold mb-2 font-serif">
              預約問事表單
            </h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/60" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/60" />
            </div>
            <p className="text-red-100 max-w-2xl mx-auto">
              請填寫下方資料，我們將儘速為您安排問事時間。<br />
              <span className="text-temple-gold font-bold">※ 目前僅開放每週六晚上 (19:00 - 21:00) 時段預約。</span>
            </p>
          </div>

          {sharedSession?.serviceType === 'booking' && (
            <SharedFormPanel
              session={sharedSession} isCreator={isCreator}
              lampConfigs={lampConfigs} blessingEvent={null}
              memberProfile={memberProfile}
              onAddEntries={handleAddSharedEntries}
              onSubmitAll={handleSubmitSharedSession}
              onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
              submitStatus={sharedSubmitStatus}
            />
          )}
          <div className="bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12">
              {bookingStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">預約成功！</h4>
                  <p className="text-gray-600 mb-8">
                    感謝您的預約。廟方人員將於收到資料後，<br />透過電話與您確認最終問事時間。
                  </p>
                  <button
                    onClick={() => setBookingStatus('idle')}
                    className="px-6 py-3 bg-temple-red text-white rounded-md hover:bg-[#5C1A04] transition-colors"
                  >
                    再預約一筆
                  </button>
                </div>
              ) : !member ? (
                <div className="text-center py-10">
                  <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 font-medium mb-1">請先登入會員</p>
                  <p className="text-gray-400 text-sm mb-5">登入後即可預約問事服務</p>
                  <button type="button" onClick={() => setShowMemberPortal(true)}
                    className="px-6 py-2.5 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors text-sm font-medium">
                    登入 / 註冊
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 人員卡片列表 */}
                  {bookingPersons.map((p, idx) => (
                    <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位問事者</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleOpenContactPicker('booking', p.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                            <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                          </button>
                          {bookingPersons.length > 1 && (
                            <button type="button" onClick={() => setBookingPersons(prev => prev.filter(x => x.id !== p.id))}
                              className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 姓名 / 生日 / 生肖 / 問事項目 */}
                      <div className="space-y-2">
                        <input required type="text" placeholder="信眾大名 *"
                          value={p.name}
                          onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-gold outline-none" />
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`booking-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {/* 生肖（自動帶入，可手動修改） */}
                          <select value={p.zodiac || ''}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, zodiac: (e.target.value as ZodiacSign) || undefined } : x))}
                            className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-gold outline-none bg-white">
                            <option value="">生肖（自動帶入）</option>
                            {Object.values(ZodiacSign).map(z => <option key={z} value={z}>{z}</option>)}
                          </select>
                          <select required value={p.type}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, type: e.target.value as ConsultationType } : x))}
                            className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-gold outline-none bg-white">
                            {Object.values(ConsultationType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <input required type="text" placeholder="現居地址 *"
                          value={p.address}
                          onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-gold outline-none" />
                      </div>
                    </div>
                  ))}

                  {/* 新增人員 */}
                  <button type="button"
                    onClick={() => setBookingPersons(prev => [...prev, { id: newId(), name: '', birthDate: '', zodiac: undefined, address: '', type: ConsultationType.CAREER }])}
                    className="w-full py-2.5 border-2 border-dashed border-temple-gold/50 rounded-xl text-temple-red text-sm font-medium hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1.5">
                    <X className="w-4 h-4 rotate-45" /> 新增人員
                  </button>

                  {/* 共用：日期、時段 */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">希望預約日期 (限週六) *</label>
                      <input type="date" required value={bookingDate}
                        onChange={e => {
                          const d = new Date(e.target.value);
                          if (e.target.value && d.getDay() !== 6) { alert('抱歉，目前僅開放每週六預約問事。'); return; }
                          setBookingDate(e.target.value);
                        }}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none" />
                      <p className="text-xs text-gray-400 mt-1">請選擇週六日期</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">希望時段 (限晚上) *</label>
                      <select required value={bookingTime} onChange={e => setBookingTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none bg-white">
                        <option value="">請選擇時段</option>
                        <option value="evening">晚上 (19:00 - 21:00)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">詳細說明 (選填)</label>
                    <textarea rows={3} value={bookingNotes} onChange={e => setBookingNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                      placeholder="請簡述您想請示的問題..." />
                  </div>

                  {bookingStatus === 'error' && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span>預約提交失敗，請檢查網路或稍後再試。</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button type="submit" disabled={bookingStatus === 'loading'}
                      className={`w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all
                        ${bookingStatus === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-temple-gold text-temple-red hover:bg-amber-400 hover:shadow-xl transform hover:-translate-y-1'}`}>
                      {bookingStatus === 'loading' ? <span>處理中...</span> : (
                        <><Flame className="w-5 h-5 fill-current" />確認送出預約（共 {bookingPersons.length} 人）</>
                      )}
                    </button>
                    <p className="text-center text-gray-500 text-sm mt-4">* 提交後即代表同意本宮隱私權政策</p>
                    {!sharedSession && (
                      <>
                        <button type="button" onClick={() => handleCreateSharedSession('booking')}
                          disabled={creatingShare || !bookingDate || bookingTime !== 'evening'}
                          className="w-full py-2.5 mt-3 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                          <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                        </button>
                        {(!bookingDate || bookingTime !== 'evening') && (
                          <p className="text-center text-xs text-gray-400 mt-1.5">
                            ※ 請先選擇日期與時段，才能建立揪團報名表
                          </p>
                        )}
                      </>
                    )}
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
            <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
              隨喜捐獻 / 護持項目
            </h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
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
                    className="px-6 py-3 bg-temple-red text-white rounded-md hover:bg-[#5C1A04] transition-colors"
                  >
                    返回
                  </button>
                </div>
              ) : !member ? (
                <div className="text-center py-10">
                  <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 font-medium mb-1">請先登入會員</p>
                  <p className="text-gray-400 text-sm mb-5">登入後即可進行捐獻護持</p>
                  <button type="button" onClick={() => setShowMemberPortal(true)}
                    className="px-6 py-2.5 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors text-sm font-medium">
                    登入 / 註冊
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDonationSubmit} className="space-y-4">
                  {donationPersons.map((p, idx) => (
                    <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位大德</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleOpenContactPicker('donation', p.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                            <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                          </button>
                          {donationPersons.length > 1 && (
                            <button type="button"
                              onClick={() => setDonationPersons(prev => prev.filter(x => x.id !== p.id))}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          required
                          type="text"
                          placeholder="大德姓名 *"
                          value={p.name}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none text-sm"
                        />
                        <input
                          required
                          type="number"
                          placeholder="捐款金額 (NTD) *"
                          min="1"
                          value={p.amount || ''}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, amount: Number(e.target.value) } : x))}
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none text-sm"
                        />
                        <select
                          required
                          value={p.type}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, type: e.target.value as DonationType } : x))}
                          className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none bg-white text-sm"
                        >
                          {Object.values(DonationType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          type="text"
                          placeholder="聯絡地址（可選）"
                          value={p.address}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="sm:col-span-3 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <button type="button"
                    onClick={() => setDonationPersons(prev => [...prev, { id: newId(), name: '', address: '', amount: 0, type: DonationType.GENERAL }])}
                    className="w-full py-2 border-2 border-dashed border-temple-gold/50 rounded-xl text-temple-red text-sm font-medium hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1">
                    <X className="w-4 h-4 rotate-45" /> 新增人員
                  </button>

                  <div>
                    <label htmlFor="don_notes" className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼（選填）</label>
                    <input
                      id="don_notes"
                      value={donationNotes}
                      onChange={e => setDonationNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-gold focus:border-transparent transition-all outline-none"
                      placeholder="完成匯款後請填寫帳號後五碼，以利核對"
                    />
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
                          : 'bg-temple-red text-white hover:bg-[#5C1A04] hover:shadow-xl transform hover:-translate-y-1'}`}
                    >
                      {donationStatus === 'loading' ? (
                        <span>處理中...</span>
                      ) : (
                        <>
                          <HeartHandshake className="w-5 h-5" />
                          確認捐獻護持（共 {donationPersons.length} 人）
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

      {/* ── 祈福 Section ── */}
      <section id="blessing" className="py-20 bg-white relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2">神明庇佑</h2>
            <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">祈福活動</h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="text-temple-gold text-lg">✦</span>
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-500 max-w-xl mx-auto">
              法會、進香、祭典等各式祈福活動，誠摯邀請善男信女共同參與，祈求神明護佑平安吉祥。
            </p>
          </div>

          {blessingEvents.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">目前暫無祈福活動，請關注最新公告。</div>
          ) : (
            <div className="space-y-5">
              {blessingEvents.map(ev => {
                const now = new Date();
                const deadlinePassed = ev.registrationDeadline ? new Date(ev.registrationDeadline) < now : false;
                const daysLeft = ev.registrationDeadline
                  ? Math.ceil((new Date(ev.registrationDeadline).getTime() - now.getTime()) / 86400000)
                  : null;
                return (
                  <div key={ev.id} className="bg-white rounded-2xl border border-temple-gold/30 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex flex-wrap items-start gap-4">
                        {ev.imageUrl
                          ? <img src={ev.imageUrl} alt={ev.title} className="w-16 h-16 object-cover rounded-xl border border-gray-100 shrink-0 shadow-sm" />
                          : <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-2xl">🙏</span>
                            </div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h4 className="text-xl font-bold text-temple-dark font-serif">{ev.title}</h4>
                            <span className="text-xs bg-temple-red/10 text-temple-red px-2.5 py-1 rounded-full font-medium">{ev.eventType}</span>
                            {deadlinePassed && <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">報名已截止</span>}
                            {!deadlinePassed && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">剩 {daysLeft} 天截止</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mb-3">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-temple-gold" />
                              {ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} ～ ${ev.endDate}`}
                            </span>
                            {ev.packages && ev.packages.length > 0 ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-temple-gold">$</span>
                                {ev.packages.length} 個方案・起 NT${Math.min(...ev.packages.map(p => p.fee)).toLocaleString()}
                              </span>
                            ) : ev.fee > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span className="text-temple-gold">$</span>費用 NT${ev.fee.toLocaleString()}
                              </span>
                            )}
                            {ev.registrationDeadline && !deadlinePassed && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-temple-gold" />
                                報名截至 {new Date(ev.registrationDeadline).toLocaleDateString('zh-TW')}
                              </span>
                            )}
                          </div>
                          {ev.description && <p className="text-sm text-gray-500 leading-relaxed">{ev.description}</p>}
                        </div>
                        <button
                          onClick={() => openBlessingModal(ev)}
                          disabled={deadlinePassed}
                          className="shrink-0 px-5 py-2.5 bg-temple-red text-white text-sm font-semibold rounded-xl hover:bg-temple-red/90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {deadlinePassed ? '已截止' : '我要報名'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 共享報名 Panel（祈福）── */}
        {sharedSession?.serviceType === 'blessing' && (
          <div className="max-w-2xl mx-auto px-4 mt-6">
            <SharedFormPanel
              session={sharedSession} isCreator={isCreator}
              lampConfigs={lampConfigs}
              blessingEvent={blessingEvents.find(ev => ev.id === sharedSession.config.eventId) ?? null}
              memberProfile={memberProfile}
              onAddEntries={handleAddSharedEntries}
              onSubmitAll={handleSubmitSharedSession}
              onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
              submitStatus={sharedSubmitStatus}
            />
          </div>
        )}

        {/* ── 祈福報名 Modal ── */}
        {blessingModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setBlessingModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg font-serif">{blessingModal.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{blessingModal.startDate === blessingModal.endDate ? blessingModal.startDate : `${blessingModal.startDate} ～ ${blessingModal.endDate}`}</p>
                </div>
                <button onClick={() => setBlessingModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
              </div>

              <div className="px-6 py-5">
                {blessingStatus === 'success' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">報名成功！</h4>
                    <p className="text-gray-500 text-sm mb-2">感謝您的報名，廟方將與您確認相關細節。</p>
                    <p className="text-gray-400 text-xs mb-6">共 {blessingPersons.length} 人</p>
                    <button onClick={() => setBlessingModal(null)} className="px-6 py-2.5 bg-temple-red text-white rounded-xl text-sm font-semibold hover:bg-temple-red/90 transition-colors">關閉</button>
                  </div>
                ) : (
                  <form onSubmit={handleBlessingSubmit} className="space-y-4">
                    {/* 人員卡片列表 */}
                    {blessingPersons.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-600">
                            第 {idx + 1} 位報名者{p.contactLabel ? <span className="ml-1.5 text-xs text-temple-red font-normal bg-temple-red/10 px-1.5 py-0.5 rounded-full">{p.contactLabel}</span> : null}
                          </span>
                          <div className="flex items-center gap-2">
                            {member && (
                              <button type="button" onClick={() => handleOpenContactPicker('blessing', p.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                                <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                              </button>
                            )}
                            {blessingPersons.length > 1 && (
                              <button type="button" onClick={() => setBlessingPersons(prev => prev.filter(x => x.id !== p.id))}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">姓名 *</label>
                            <input required value={p.name} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="姓名" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">性別</label>
                            <select value={p.gender} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, gender: e.target.value } : x))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                              <option value="">不指定</option>
                              {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                        </div>
                        {/* 護持方案（有多方案時才顯示） */}
                        {blessingModal.packages && blessingModal.packages.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">護持方案 *</label>
                            <select required value={p.packageId || ''} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, packageId: e.target.value } : x))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                              <option value="">請選擇方案</option>
                              {blessingModal.packages.map(pkg => (
                                <option key={pkg.id} value={pkg.id}>
                                  {pkg.name}　NT${pkg.fee.toLocaleString()}{pkg.description ? `　${pkg.description}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`blessing-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        {/* 生肖（自動帶入，可手動修改） */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">生肖（自動帶入，可手動修改）</label>
                          <select value={p.zodiac || ''} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, zodiac: e.target.value as ZodiacSign || undefined } : x))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red bg-white">
                            <option value="">請選擇</option>
                            {Object.values(ZodiacSign).map(z => <option key={z} value={z}>{z}年</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />居住地址</label>
                          <input value={p.address} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="居住地址" />
                        </div>
                      </div>
                    ))}

                    {/* 新增報名者 */}
                    <button type="button"
                      onClick={() => setBlessingPersons(prev => [...prev, { id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: '' }])}
                      className="w-full py-2.5 border-2 border-dashed border-temple-gold/40 rounded-xl text-sm text-temple-red hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> 新增報名者
                    </button>

                    {/* 備註（共用） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼</label>
                      <input value={blessingNotes} onChange={e => setBlessingNotes(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="如有匯款請填寫帳號後五碼" />
                    </div>

                    {blessingStatus === 'error' && (
                      <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />送出失敗，請稍後再試。</p>
                    )}
                    <button type="submit" disabled={blessingStatus === 'loading'}
                      className="w-full py-3 bg-temple-red text-white font-semibold rounded-xl hover:bg-temple-red/90 transition-colors disabled:opacity-60">
                      {blessingStatus === 'loading' ? '送出中…' : `確認報名（共 ${blessingPersons.length} 人）`}
                    </button>
                    {!sharedSession && (
                      <button type="button" onClick={() => handleCreateSharedSession('blessing')}
                        disabled={creatingShare}
                        className="w-full py-2.5 mt-2 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-temple-dark text-white border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <img src="/logo.png" alt="台北古亭和聖壇 Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                <span className="text-xl font-bold font-serif tracking-widest">台北古亭和聖壇</span>
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
            <p>&copy; {new Date().getFullYear()} 台北古亭和聖壇. All rights reserved. 網站設計：和聖壇管理委員會</p>
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
        title="加入 LINE 問事"
        className="fixed bottom-8 right-8 z-[60] bg-[#06C755] w-16 h-16 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center"
      >
        <LineIcon className="w-10 h-10" />
      </a>

      {/* Member Portal */}
      {showMemberPortal && (
        <MemberPortal onClose={() => {
          setShowMemberPortal(false);
          if (member) loadMemberContacts();
        }} />
      )}

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowContactPicker(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-temple-red px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold font-serif flex items-center gap-2">
                <BookUser className="w-4 h-4" /> 選擇聯絡人
              </h3>
              <button onClick={() => setShowContactPicker(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {/* 本人（個人資料） */}
              {memberProfile && memberProfile.name && (() => {
                const applyProfile = () => {
                  const { form, personId } = showContactPicker!;
                  const addr = memberProfile.address || '';
                  const lbl = '本人';
                  if (form === 'lamp') {
                    setLampPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  } else if (form === 'booking') {
                    setBookingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  } else if (form === 'donation') {
                    setDonationPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, address: addr, contactLabel: lbl } : x));
                  } else if (form === 'blessing') {
                    setBlessingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, gender: memberProfile.gender || '', address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  }
                  setShowContactPicker(null);
                };
                return (
                  <button
                    key="__self__"
                    type="button"
                    onClick={applyProfile}
                    className="w-full text-left px-4 py-3 rounded-lg border border-temple-gold/40 bg-temple-gold/5 hover:bg-temple-gold/10 hover:border-temple-gold/60 transition-all flex items-center gap-3"
                  >
                    <span className="text-xs bg-temple-red text-white px-2 py-0.5 rounded-full font-medium shrink-0">本人</span>
                    <div>
                      <p className="font-medium text-gray-800">{memberProfile.name}</p>
                      <p className="text-xs text-gray-500">
                        {memberProfile.phone}{memberProfile.birthDate ? ` · ${memberProfile.birthDate}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })()}
              {/* 分隔線（有本人且有其他聯絡人時顯示） */}
              {memberProfile && memberProfile.name && memberContacts.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-300">親友</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              {/* 通訊錄聯絡人 */}
              {memberContacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    const { form, personId } = showContactPicker!;
                    const addr = contact.address || '';
                    const lbl = contact.label;
                    if (form === 'lamp') {
                      setLampPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    } else if (form === 'booking') {
                      setBookingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    } else if (form === 'donation') {
                      setDonationPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, address: addr, contactLabel: lbl } : x));
                    } else if (form === 'blessing') {
                      setBlessingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, gender: contact.gender || '', address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    }
                    setShowContactPicker(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-100 hover:bg-temple-bg hover:border-temple-gold/30 transition-all flex items-center gap-3"
                >
                  <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full font-medium shrink-0">{contact.label}</span>
                  <div>
                    <p className="font-medium text-gray-800">{contact.name}</p>
                    <p className="text-xs text-gray-500">{contact.phone}{contact.birthDate ? ` · ${contact.birthDate}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {/* ── 共享報名表連結 Modal ── */}
      {showShareModal && sharedSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-temple-dark">共享報名表已建立！</h3>
              <p className="text-sm text-gray-500 mt-1">將連結傳給親友，他們可加入報名資料</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="flex-1 text-xs text-gray-600 break-all">{sharedSessionUrl}</span>
              <button onClick={() => {
                navigator.clipboard.writeText(sharedSessionUrl);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-temple-red text-white text-xs rounded-lg hover:bg-temple-red/90 transition-colors">
                {urlCopied ? <><CheckCircle className="w-3.5 h-3.5" />已複製</> : <><Copy className="w-3.5 h-3.5" />複製</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">連結 7 天後自動失效</p>
            <button onClick={() => setShowShareModal(false)}
              className="w-full mt-4 py-2.5 bg-temple-red text-white rounded-xl font-medium text-sm hover:bg-temple-red/90 transition-colors">
              開始收集資料
            </button>
          </div>
        </div>
      )}

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
                  className="flex-1 px-4 py-3 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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