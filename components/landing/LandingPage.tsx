import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
    Scissors, ArrowRight, Shield, Headphones, RefreshCw, Sparkles,
    Calendar, Users, ShoppingBag, Package, BarChart3, MapPin, UserCheck, MessageCircle,
    Star, CheckCircle, Facebook, Instagram, Linkedin, Youtube, Phone, Mail, Menu, X,
    Zap, ChevronRight, UserCircle, Search, UserPlus,
} from 'lucide-react';
import { CONTACT, getTierOptions } from '../../constants/plans';
import HeroMockup from './HeroMockup';
import { navigateToLegal } from '../../utils/legal';
import { useTranslation } from '../../i18n';

export interface LandingPageProps {
    onGetStarted: () => void;
    onGoToLogin: () => void;
    onGoToBarberias?: () => void;
    onGoToClientRegister?: () => void;
    supportEmail?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({
    onGetStarted,
    onGoToLogin,
    onGoToBarberias,
    onGoToClientRegister,
    supportEmail = CONTACT.email,
}) => {
    const { t } = useTranslation();
    const isNativeMobile = Capacitor.isNativePlatform();
    const [activeNav, setActiveNav] = useState('inicio');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeTestimonial, setActiveTestimonial] = useState(1);

    const navLinksData = useMemo(() => [
        { id: 'inicio', label: t('landing.nav.home') },
        { id: 'para-clientes', label: t('landing.nav.bookAppointment') },
        { id: 'funciones', label: t('landing.nav.features') },
        { id: 'planes', label: t('landing.nav.plans') },
        { id: 'como-funciona', label: t('landing.nav.howItWorks') },
        { id: 'testimonios', label: t('landing.nav.testimonials') },
        { id: 'contacto', label: t('landing.nav.contact') },
    ], [t]);

    const clientPerks = useMemo(() => [
        t('landing.clientPerks.0'),
        t('landing.clientPerks.1'),
        t('landing.clientPerks.2'),
    ], [t]);

    const benefits = useMemo(() => [
        { icon: Sparkles, label: t('landing.benefits.0.label') },
        { icon: Shield, label: t('landing.benefits.1.label') },
        { icon: Headphones, label: t('landing.benefits.2.label') },
        { icon: RefreshCw, label: t('landing.benefits.3.label') },
    ], [t]);

    const features = useMemo(() => [
        { icon: Calendar, title: t('landing.features.0.title'), desc: t('landing.features.0.desc') },
        { icon: Users, title: t('landing.features.1.title'), desc: t('landing.features.1.desc') },
        { icon: ShoppingBag, title: t('landing.features.2.title'), desc: t('landing.features.2.desc') },
        { icon: Package, title: t('landing.features.3.title'), desc: t('landing.features.3.desc') },
        { icon: BarChart3, title: t('landing.features.4.title'), desc: t('landing.features.4.desc') },
        { icon: MapPin, title: t('landing.features.5.title'), desc: t('landing.features.5.desc') },
        { icon: UserCheck, title: t('landing.features.6.title'), desc: t('landing.features.6.desc') },
        { icon: MessageCircle, title: t('landing.features.7.title'), desc: t('landing.features.7.desc') },
    ], [t]);

    const steps = useMemo(() => [
        { num: '01', title: t('landing.steps.0.title'), desc: t('landing.steps.0.desc') },
        { num: '02', title: t('landing.steps.1.title'), desc: t('landing.steps.1.desc') },
        { num: '03', title: t('landing.steps.2.title'), desc: t('landing.steps.2.desc') },
    ], [t]);

    const testimonials = useMemo(() => [
        {
            quote: t('landing.testimonials.0.quote'),
            name: t('landing.testimonials.0.name'),
            shop: t('landing.testimonials.0.shop'),
            initials: t('landing.testimonials.0.initials'),
        },
        {
            quote: t('landing.testimonials.1.quote'),
            name: t('landing.testimonials.1.name'),
            shop: t('landing.testimonials.1.shop'),
            initials: t('landing.testimonials.1.initials'),
        },
        {
            quote: t('landing.testimonials.2.quote'),
            name: t('landing.testimonials.2.name'),
            shop: t('landing.testimonials.2.shop'),
            initials: t('landing.testimonials.2.initials'),
        },
    ], [t]);

    const clientSteps = useMemo(() => [
        { step: '1', title: t('landing.clientSteps.0.title'), desc: t('landing.clientSteps.0.desc') },
        { step: '2', title: t('landing.clientSteps.1.title'), desc: t('landing.clientSteps.1.desc') },
        { step: '3', title: t('landing.clientSteps.2.title'), desc: t('landing.clientSteps.2.desc') },
    ], [t]);

    const tierOptions = useMemo(() => getTierOptions(t), [t]);

    const footerProductLinks = useMemo(() => [
        { id: 'funciones', label: t('landing.nav.features') },
        { id: 'planes', label: t('landing.nav.plans') },
        { id: 'como-funciona', label: t('landing.nav.howItWorks') },
        { id: 'testimonios', label: t('landing.nav.testimonials') },
    ], [t]);

    const waHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(t('landing.contact.waMessage'))}`;
    const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(t('landing.contact.emailSubject'))}`;

    useEffect(() => {
        const sections = navLinksData.map((l) => document.getElementById(l.id)).filter(Boolean);
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActiveNav(entry.target.id);
                });
            },
            { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
        );
        sections.forEach((s) => observer.observe(s!));
        return () => observer.disconnect();
    }, [navLinksData]);

    const scrollTo = (id: string) => {
        setMobileMenuOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleGoToBarberias = () => {
        setMobileMenuOpen(false);
        onGoToBarberias?.();
    };

    const container = 'max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12';
    const navLinks = isNativeMobile ? navLinksData.filter((l) => l.id !== 'planes') : navLinksData;

    return (
        <div className="min-h-screen bg-[#12121c] text-white scroll-smooth text-[17px] lg:text-[18px]">
            {/* Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#12121c]/90 backdrop-blur-md border-b border-white/5 safe-area-top">
                <div className={container}>
                    <div className="flex items-center justify-between h-18 lg:h-20">
                        <button type="button" onClick={() => scrollTo('inicio')} className="flex items-center gap-3 group">
                            <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center shadow-lg shadow-[#ffd427]/20">
                                <Scissors size={24} className="text-slate-900" />
                            </div>
                            <div className="text-left hidden sm:block">
                                <span className="font-bold text-white text-xl leading-tight block">BarberShow</span>
                                <span className="text-xs text-slate-500 uppercase tracking-wider">{t('landing.brandTagline')}</span>
                            </div>
                        </button>

                        <nav className="hidden lg:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <button
                                    key={link.id}
                                    type="button"
                                    onClick={() => scrollTo(link.id)}
                                    className={`relative px-4 py-2.5 text-base font-medium transition-colors ${
                                        activeNav === link.id ? 'text-white' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {link.label}
                                    {activeNav === link.id && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#ffd427] rounded-full" />
                                    )}
                                </button>
                            ))}
                        </nav>

                        <div className="flex items-center gap-2">
                            {!isNativeMobile && (
                            <button
                                type="button"
                                onClick={onGetStarted}
                                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base rounded-xl transition-colors"
                            >
                                {t('landing.startFree')} <ArrowRight size={18} />
                            </button>
                            )}
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 border border-white/25 hover:border-white/50 text-white font-semibold text-base rounded-xl transition-colors"
                            >
                                {t('common.login')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
                                aria-label={t('common.openMenu')}
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-white/5 bg-[#12121c] px-4 py-4 space-y-1">
                        {navLinks.map((link) => (
                            <button
                                key={link.id}
                                type="button"
                                onClick={() => scrollTo(link.id)}
                                className="block w-full text-left px-3 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg text-sm"
                            >
                                {link.label}
                            </button>
                        ))}
                        {onGoToBarberias && (
                            <button
                                type="button"
                                onClick={handleGoToBarberias}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 border border-[#ffd427]/40 text-[#ffd427] font-semibold text-sm rounded-xl hover:bg-[#ffd427]/10"
                            >
                                <Calendar size={16} /> {t('landing.searchAndBook')}
                            </button>
                        )}
                        {!isNativeMobile && (
                        <button
                            type="button"
                            onClick={onGetStarted}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 bg-[#ffd427] text-slate-900 font-semibold text-sm rounded-xl"
                        >
                            {t('landing.startFree')} <ArrowRight size={16} />
                        </button>
                        )}
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 border border-white/25 text-white font-semibold text-sm rounded-xl"
                        >
                            {t('common.login')}
                        </button>
                    </div>
                )}
            </header>

            {/* Hero */}
            <section id="inicio" className="relative pt-28 lg:pt-36 pb-20 lg:pb-28 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]" aria-hidden>
                    <Scissors className="absolute top-32 right-20 w-32 h-32 rotate-12" strokeWidth={0.5} />
                    <Scissors className="absolute bottom-20 left-10 w-24 h-24 -rotate-45" strokeWidth={0.5} />
                </div>
                <div className={container}>
                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
                        <div className="relative z-10">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-sm font-semibold uppercase tracking-wider mb-6">
                                {t('landing.hero.badge')}
                            </span>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6">
                                {t('landing.hero.titlePrefix')}{' '}
                                <span className="text-[#ffd427]">{t('landing.hero.titleHighlight')}</span>
                            </h1>
                            <p className="text-slate-400 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl">
                                {t('landing.hero.description')}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                {!isNativeMobile && (
                                <>
                                <button
                                    type="button"
                                    onClick={onGetStarted}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors shadow-lg shadow-[#ffd427]/20"
                                >
                                    {t('landing.hero.createShop')} <ArrowRight size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollTo('planes')}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base border border-white/25 hover:border-white/50 text-white font-medium rounded-xl transition-colors"
                                >
                                    {t('landing.hero.viewPlans')}
                                </button>
                                </>
                                )}
                                {isNativeMobile && onGoToBarberias && (
                                <button
                                    type="button"
                                    onClick={handleGoToBarberias}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors"
                                >
                                    <Search size={18} /> {t('landing.searchAndBook')}
                                </button>
                                )}
                            </div>
                            {onGoToBarberias && (
                                <div className="mt-8 pt-6 border-t border-white/10">
                                    <p className="text-slate-500 text-base mb-3 flex items-center gap-2">
                                        <UserCircle size={20} className="text-[#ffd427] flex-shrink-0" />
                                        {t('landing.hero.notBarber')}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleGoToBarberias}
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base border border-[#ffd427]/50 hover:bg-[#ffd427]/10 text-[#ffd427] font-semibold rounded-xl transition-colors"
                                    >
                                        <Search size={18} /> {t('landing.searchAndBookAppointment')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative z-10 pt-8 lg:pt-0 pb-12 lg:pb-0">
                            <HeroMockup />
                        </div>
                    </div>
                </div>
            </section>

            {/* Para clientes — agendar en barberías registradas */}
            {onGoToBarberias && (
                <section id="para-clientes" className="py-16 lg:py-20 bg-[#16162a]/40 border-y border-white/5">
                    <div className={container}>
                        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                            <div>
                                <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-sm font-semibold uppercase tracking-wider mb-5">
                                    {t('landing.clients.badge')}
                                </span>
                                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                                    {t('landing.clients.titlePrefix')}{' '}
                                    <span className="text-[#ffd427]">{t('landing.clients.titleHighlight')}</span>
                                </h2>
                                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                                    {t('landing.clients.description')}
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {clientPerks.map((perk) => (
                                        <li key={perk} className="flex items-start gap-3 text-slate-300 text-base">
                                            <CheckCircle size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <span>{perk}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleGoToBarberias}
                                        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors"
                                    >
                                        <Calendar size={20} /> {t('landing.clients.viewShops')}
                                    </button>
                                    {onGoToClientRegister && (
                                        <button
                                            type="button"
                                            onClick={onGoToClientRegister}
                                            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base bg-white/10 hover:bg-white/15 border border-[#ffd427]/40 hover:border-[#ffd427]/70 text-white font-semibold rounded-xl transition-colors"
                                        >
                                            <UserPlus size={20} /> {t('landing.clients.createFreeAccount')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onGoToLogin}
                                        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base border border-white/25 hover:border-white/50 text-white font-medium rounded-xl transition-colors"
                                    >
                                        {t('landing.clients.alreadyHaveAccount')}
                                    </button>
                                </div>
                            </div>
                            <div className="relative rounded-2xl bg-[#1a1a28] border border-white/10 p-8 lg:p-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-xl bg-[#ffd427]/15 flex items-center justify-center">
                                        <UserCircle size={32} className="text-[#ffd427]" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{t('landing.clients.bookingCard.title')}</p>
                                        <p className="text-slate-500 text-sm">{t('landing.clients.bookingCard.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {clientSteps.map((item) => (
                                        <div key={item.step} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                            <span className="w-8 h-8 rounded-lg bg-[#ffd427]/20 text-[#ffd427] font-bold flex items-center justify-center flex-shrink-0 text-sm">
                                                {item.step}
                                            </span>
                                            <div>
                                                <p className="font-semibold text-white">{item.title}</p>
                                                <p className="text-slate-400 text-sm mt-0.5">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Quick benefits */}
            <section className="border-y border-white/5 bg-[#16162a]/50">
                <div className={`${container} py-10`}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
                        {benefits.map((b) => (
                            <div key={b.label} className="flex items-center gap-4 justify-center lg:justify-start">
                                <div className="w-12 h-12 rounded-lg bg-[#ffd427]/10 flex items-center justify-center flex-shrink-0">
                                    <b.icon size={24} className="text-[#ffd427]" />
                                </div>
                                <span className="text-base font-medium text-slate-300">{b.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="funciones" className="py-20 lg:py-28">
                <div className={container}>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                            {t('landing.featuresSection.title')}
                        </h2>
                        <p className="text-slate-400 text-lg max-w-3xl mx-auto">
                            {t('landing.featuresSection.subtitle')}
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="group p-8 rounded-2xl bg-[#1a1a28] border border-white/5 hover:border-[#ffd427]/30 transition-colors"
                            >
                                <div className="w-14 h-14 rounded-xl bg-[#ffd427]/10 flex items-center justify-center mb-5 group-hover:bg-[#ffd427]/20 transition-colors">
                                    <f.icon size={28} className="text-[#ffd427]" strokeWidth={1.5} />
                                </div>
                                <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                                <p className="text-base text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="como-funciona" className="py-20 bg-[#16162a]/30 border-y border-white/5">
                <div className={container}>
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-sm font-semibold uppercase tracking-wider mb-4">
                            {t('landing.howItWorks.badge')}
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.howItWorks.title')}</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-10">
                        {steps.map((step, i) => (
                            <div key={step.num} className="relative text-center md:text-left">
                                {i < steps.length - 1 && (
                                    <ChevronRight className="hidden md:block absolute top-8 -right-4 w-10 h-10 text-[#ffd427]/30" />
                                )}
                                <div className="text-5xl font-black text-[#ffd427]/20 mb-4">{step.num}</div>
                                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                                <p className="text-slate-400 text-base">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing — solo web (Guideline 3.1.1) */}
            {!isNativeMobile && (
            <section id="planes" className="py-20 lg:py-28">
                <div className={container}>
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-sm font-semibold uppercase tracking-wider mb-4">
                            {t('landing.pricing.badge')}
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
                            {t('landing.pricing.title')}
                        </h2>
                        <p className="text-slate-400 text-lg">{t('landing.pricing.subtitle')}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-7">
                        {tierOptions.map((plan) => {
                            const isPopular = plan.value === 'barberia';
                            return (
                                <div
                                    key={plan.value}
                                    className={`relative flex flex-col rounded-2xl p-7 ${
                                        isPopular
                                            ? 'bg-[#1a1a28] border-2 border-[#ffd427] shadow-xl shadow-[#ffd427]/10'
                                            : 'bg-[#1a1a28] border border-white/5'
                                    }`}
                                >
                                    {isPopular && (
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#ffd427] text-slate-900 text-sm font-bold uppercase rounded-full">
                                            {t('landing.pricing.mostPopular')}
                                        </span>
                                    )}
                                    <div className="mb-4">
                                        <h3 className="font-bold text-xl">{plan.label}</h3>
                                        <div className="mt-2 flex items-baseline gap-1">
                                            <span className="text-4xl font-black text-[#ffd427]">
                                                {plan.price === 0 ? t('landing.pricing.free') : `$${plan.price.toFixed(2)}`}
                                            </span>
                                            {plan.price > 0 && <span className="text-slate-500 text-base">{t('landing.pricing.perMonth')}</span>}
                                        </div>
                                        {plan.price > 0 && (
                                            <p className="text-sm text-emerald-400 mt-1 font-medium">
                                                {t('landing.pricing.annualDiscount', { price: (plan.price * 0.6).toFixed(2) })}
                                            </p>
                                        )}
                                        <p className="text-slate-400 text-base mt-2">{plan.description}</p>
                                    </div>
                                    <ul className="space-y-3 flex-1 mb-6">
                                        {plan.benefits.slice(0, isPopular ? 6 : 4).map((b, i) => (
                                            <li key={i} className="flex items-start gap-2 text-base text-slate-300">
                                                <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <span>{b}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={onGetStarted}
                                        className={`w-full py-3.5 rounded-xl font-semibold text-base transition-colors ${
                                            isPopular
                                                ? 'bg-[#ffd427] hover:bg-amber-400 text-slate-900'
                                                : plan.price === 0
                                                  ? 'border border-white/25 hover:border-white/50 text-white'
                                                  : 'border border-[#ffd427]/50 hover:bg-[#ffd427]/10 text-[#ffd427]'
                                        }`}
                                    >
                                        {plan.price === 0 ? t('landing.pricing.startFree') : t('landing.pricing.choosePlan')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
            )}

            {/* Testimonials */}
            <section id="testimonios" className="py-20 lg:py-28 bg-[#16162a]/30 border-y border-white/5">
                <div className={container}>
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-sm font-semibold uppercase tracking-wider mb-4">
                            {t('landing.testimonials.badge')}
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.testimonials.title')}</h2>
                    </div>
                    <div className="hidden md:grid md:grid-cols-3 gap-7">
                        {testimonials.map((item) => (
                            <div key={item.name} className="p-8 rounded-2xl bg-[#1a1a28] border border-white/5">
                                <div className="flex gap-1 mb-4">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} size={18} className="text-[#ffd427] fill-[#ffd427]" />
                                    ))}
                                </div>
                                <p className="text-slate-300 text-base leading-relaxed mb-6">&ldquo;{item.quote}&rdquo;</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#ffd427] font-bold text-base">
                                        {item.initials}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-base">{item.name}</p>
                                        <p className="text-slate-500 text-sm">{item.shop}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="md:hidden">
                        <div className="p-6 rounded-2xl bg-[#1a1a28] border border-white/5">
                            <div className="flex gap-0.5 mb-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} size={16} className="text-[#ffd427] fill-[#ffd427]" />
                                ))}
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                &ldquo;{testimonials[activeTestimonial].quote}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#ffd427] font-bold text-sm">
                                    {testimonials[activeTestimonial].initials}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{testimonials[activeTestimonial].name}</p>
                                    <p className="text-slate-500 text-xs">{testimonials[activeTestimonial].shop}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center gap-2 mt-6">
                            {testimonials.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setActiveTestimonial(i)}
                                    className={`w-2 h-2 rounded-full transition-colors ${
                                        activeTestimonial === i ? 'bg-[#ffd427]' : 'bg-white/20'
                                    }`}
                                    aria-label={t('landing.testimonials.ariaLabel', { n: i + 1 })}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="hidden md:flex justify-center gap-2 mt-8">
                        {testimonials.map((_, i) => (
                            <span
                                key={i}
                                className={`w-2 h-2 rounded-full ${i === 1 ? 'bg-[#ffd427]' : 'bg-white/20'}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 lg:py-24">
                <div className={container}>
                    <div className="relative rounded-3xl bg-gradient-to-br from-[#1a1a28] to-[#12121c] border border-white/10 p-10 lg:p-14 overflow-hidden">
                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #ffd427 0%, transparent 50%)' }} aria-hidden />
                        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6 text-center lg:text-left flex-col lg:flex-row">
                                <div className="w-20 h-20 bg-[#ffd427] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ffd427]/30">
                                    <Scissors size={40} className="text-slate-900" />
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
                                        {t('landing.cta.title')}
                                    </h2>
                                    <p className="text-slate-400 text-lg">
                                        {t('landing.cta.subtitle')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
                                {!isNativeMobile && (
                                <button
                                    type="button"
                                    onClick={onGetStarted}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors whitespace-nowrap"
                                >
                                    {t('landing.cta.createShopNow')}
                                </button>
                                )}
                                {onGoToBarberias ? (
                                    <button
                                        type="button"
                                        onClick={handleGoToBarberias}
                                        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base border border-[#ffd427]/50 hover:bg-[#ffd427]/10 text-[#ffd427] font-semibold rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        <Calendar size={18} /> {t('landing.searchAndBook')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => scrollTo('para-clientes')}
                                        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base border border-white/25 hover:border-white/50 text-white font-medium rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        {t('landing.cta.viewDemo')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer id="contacto" className="border-t border-white/5 bg-[#0d0d14] pt-16 pb-8 safe-area-bottom">
                <div className={container}>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
                        <div className="col-span-2 md:col-span-3 lg:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center">
                                    <Scissors size={24} className="text-slate-900" />
                                </div>
                                <span className="font-bold text-xl">BarberShow</span>
                            </div>
                            <p className="text-slate-500 text-base leading-relaxed mb-4">
                                {t('landing.footer.description')}
                            </p>
                            <div className="flex gap-3">
                                {[
                                    { icon: Facebook, label: 'Facebook' },
                                    { icon: Instagram, label: 'Instagram' },
                                    { icon: Linkedin, label: 'LinkedIn' },
                                    { icon: Youtube, label: 'YouTube' },
                                ].map((s) => (
                                    <a
                                        key={s.label}
                                        href="#"
                                        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#ffd427]/20 flex items-center justify-center text-slate-400 hover:text-[#ffd427] transition-colors"
                                        aria-label={s.label}
                                    >
                                        <s.icon size={18} />
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-4">{t('landing.footer.product')}</h4>
                            <ul className="space-y-2 text-base text-slate-500">
                                {onGoToBarberias && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={handleGoToBarberias}
                                            className="hover:text-[#ffd427] transition-colors"
                                        >
                                            {t('landing.footer.bookAppointment')}
                                        </button>
                                    </li>
                                )}
                                {footerProductLinks.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => scrollTo(item.id)}
                                            className="hover:text-[#ffd427] transition-colors"
                                        >
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-4">{t('landing.footer.company')}</h4>
                            <ul className="space-y-2 text-base text-slate-500">
                                <li><button type="button" onClick={() => scrollTo('contacto')} className="hover:text-[#ffd427] transition-colors">{t('landing.footer.aboutUs')}</button></li>
                                <li><button type="button" onClick={() => scrollTo('contacto')} className="hover:text-[#ffd427] transition-colors">{t('landing.footer.contact')}</button></li>
                                <li><a href={waHref} target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd427] transition-colors">{t('landing.footer.support')}</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-4">{t('landing.footer.legal')}</h4>
                            <ul className="space-y-2 text-base text-slate-500">
                                <li><button type="button" onClick={() => navigateToLegal('terminos')} className="hover:text-[#ffd427] transition-colors">{t('landing.footer.terms')}</button></li>
                                <li><button type="button" onClick={() => navigateToLegal('privacidad')} className="hover:text-[#ffd427] transition-colors">{t('landing.footer.privacy')}</button></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-4">{t('landing.footer.contact')}</h4>
                            <ul className="space-y-3 text-base">
                                <li>
                                    <a href={`tel:+${CONTACT.whatsapp}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                                        <Phone size={16} className="text-emerald-500" />
                                        {CONTACT.phoneDisplay}
                                    </a>
                                </li>
                                <li>
                                    <a href={emailHref} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                                        <Mail size={16} className="text-emerald-500" />
                                        {supportEmail}
                                    </a>
                                </li>
                                <li>
                                    <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-400 hover:text-[#ffd427] transition-colors">
                                        <MessageCircle size={16} className="text-emerald-500" />
                                        {t('landing.footer.whatsapp')}
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-slate-600 text-sm">{t('landing.footer.copyright')}</p>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="text-slate-500 hover:text-[#ffd427] text-sm font-medium flex items-center gap-1.5 transition-colors"
                        >
                            <Zap size={14} /> {t('landing.footer.loginLink')}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
