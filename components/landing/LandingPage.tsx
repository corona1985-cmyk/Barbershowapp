import React, { useState, useEffect } from 'react';
import {
    Scissors, ArrowRight, Shield, Headphones, RefreshCw, Sparkles,
    Calendar, Users, ShoppingBag, Package, BarChart3, MapPin, UserCheck, MessageCircle,
    Star, CheckCircle, Facebook, Instagram, Linkedin, Youtube, Phone, Mail, Menu, X,
    Zap, ChevronRight,
} from 'lucide-react';
import { TIER_OPTIONS, CONTACT } from '../../constants/plans';
import HeroMockup from './HeroMockup';

const NAV_LINKS = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'funciones', label: 'Funciones' },
    { id: 'planes', label: 'Planes' },
    { id: 'como-funciona', label: 'Cómo funciona' },
    { id: 'testimonios', label: 'Testimonios' },
    { id: 'contacto', label: 'Contacto' },
];

const BENEFITS = [
    { icon: Sparkles, label: 'Fácil de usar' },
    { icon: Shield, label: 'Seguro y confiable' },
    { icon: Headphones, label: 'Soporte 24/7' },
    { icon: RefreshCw, label: 'Actualizaciones constantes' },
];

const FEATURES = [
    { icon: Calendar, title: 'Agenda Inteligente', desc: 'Programa citas por barbero, evita conflictos y envía recordatorios.' },
    { icon: Users, title: 'Clientes', desc: 'Historial, preferencias y fidelización en un solo lugar.' },
    { icon: ShoppingBag, title: 'Ventas (POS)', desc: 'Cobra servicios y productos desde el mostrador.' },
    { icon: Package, title: 'Inventario', desc: 'Control de stock y alertas de productos bajos.' },
    { icon: BarChart3, title: 'Reportes', desc: 'Ventas, citas y rendimiento por barbero o sede.' },
    { icon: MapPin, title: 'Multi-Sucursal', desc: 'Administra varias ubicaciones desde un panel central.' },
    { icon: UserCheck, title: 'Barberos', desc: 'Alta de equipo, roles y agenda individual.' },
    { icon: MessageCircle, title: 'WhatsApp', desc: 'Recordatorios y comunicación directa con tus clientes.' },
];

const STEPS = [
    { num: '01', title: 'Crea tu barbería', desc: 'Regístrate en minutos y configura tu negocio.' },
    { num: '02', title: 'Configura servicios', desc: 'Agrega barberos, servicios y horarios de atención.' },
    { num: '03', title: 'Empieza a crecer', desc: 'Gestiona citas, ventas y clientes desde un solo lugar.' },
];

const TESTIMONIALS = [
    {
        quote: 'Desde que uso BarberShow, mis citas están organizadas y los clientes llegan a tiempo. Increíble.',
        name: 'Juan Pérez',
        shop: 'Barbería Clásica',
        initials: 'JP',
    },
    {
        quote: 'El POS integrado me ahorra horas. Vendo productos y servicios sin salir de la app.',
        name: 'Carlos Méndez',
        shop: 'Urban Cuts',
        initials: 'CM',
    },
    {
        quote: 'Con 3 barberos y 2 sedes, necesitaba algo robusto. BarberShow cumple y supera expectativas.',
        name: 'Miguel Torres',
        shop: 'MT Barbería',
        initials: 'MT',
    },
];

export interface LandingPageProps {
    onGetStarted: () => void;
    onGoToLogin: () => void;
    onGoToBarberias?: () => void;
    supportEmail?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({
    onGetStarted,
    onGoToLogin,
    onGoToBarberias,
    supportEmail = CONTACT.email,
}) => {
    const [activeNav, setActiveNav] = useState('inicio');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeTestimonial, setActiveTestimonial] = useState(1);

    const waHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent('Hola, tengo una consulta sobre BarberShow.')}`;
    const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Consulta BarberShow')}`;

    useEffect(() => {
        const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean);
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
    }, []);

    const scrollTo = (id: string) => {
        setMobileMenuOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#12121c] text-white scroll-smooth">
            {/* Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#12121c]/90 backdrop-blur-md border-b border-white/5 safe-area-top">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 lg:h-18">
                        <button type="button" onClick={() => scrollTo('inicio')} className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-[#ffd427] rounded-xl flex items-center justify-center shadow-lg shadow-[#ffd427]/20">
                                <Scissors size={20} className="text-slate-900" />
                            </div>
                            <div className="text-left hidden sm:block">
                                <span className="font-bold text-white text-lg leading-tight block">BarberShow</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Sistema para barberías</span>
                            </div>
                        </button>

                        <nav className="hidden lg:flex items-center gap-1">
                            {NAV_LINKS.map((link) => (
                                <button
                                    key={link.id}
                                    type="button"
                                    onClick={() => scrollTo(link.id)}
                                    className={`relative px-3 py-2 text-sm font-medium transition-colors ${
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
                            <button
                                type="button"
                                onClick={onGetStarted}
                                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-xl transition-colors"
                            >
                                Comenzar Gratis <ArrowRight size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
                                aria-label="Menú"
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-white/5 bg-[#12121c] px-4 py-4 space-y-1">
                        {NAV_LINKS.map((link) => (
                            <button
                                key={link.id}
                                type="button"
                                onClick={() => scrollTo(link.id)}
                                className="block w-full text-left px-3 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg text-sm"
                            >
                                {link.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={onGetStarted}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 bg-[#ffd427] text-slate-900 font-semibold text-sm rounded-xl"
                        >
                            Comenzar Gratis <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </header>

            {/* Hero */}
            <section id="inicio" className="relative pt-24 lg:pt-32 pb-16 lg:pb-24 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]" aria-hidden>
                    <Scissors className="absolute top-32 right-20 w-32 h-32 rotate-12" strokeWidth={0.5} />
                    <Scissors className="absolute bottom-20 left-10 w-24 h-24 -rotate-45" strokeWidth={0.5} />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        <div className="relative z-10">
                            <span className="inline-block px-3 py-1 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-xs font-semibold uppercase tracking-wider mb-6">
                                La plataforma todo en uno
                            </span>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-bold leading-tight mb-6">
                                Administra tu barbería{' '}
                                <span className="text-[#ffd427]">como un profesional</span>
                            </h1>
                            <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                                Agenda citas, gestiona clientes, procesa ventas, administra tu equipo y haz crecer tu negocio desde una sola plataforma.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={onGetStarted}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors shadow-lg shadow-[#ffd427]/20"
                                >
                                    Crear mi barbería <ArrowRight size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollTo('planes')}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-white/25 hover:border-white/50 text-white font-medium rounded-xl transition-colors"
                                >
                                    Ver planes
                                </button>
                            </div>
                        </div>
                        <div className="relative z-10 pt-8 lg:pt-0 pb-12 lg:pb-0">
                            <HeroMockup />
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick benefits */}
            <section className="border-y border-white/5 bg-[#16162a]/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                        {BENEFITS.map((b) => (
                            <div key={b.label} className="flex items-center gap-3 justify-center lg:justify-start">
                                <div className="w-10 h-10 rounded-lg bg-[#ffd427]/10 flex items-center justify-center flex-shrink-0">
                                    <b.icon size={20} className="text-[#ffd427]" />
                                </div>
                                <span className="text-sm font-medium text-slate-300">{b.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="funciones" className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                            Todo lo que necesitas para hacer crecer tu negocio
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                            Herramientas diseñadas específicamente para barberías modernas.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="group p-6 rounded-2xl bg-[#1a1a28] border border-white/5 hover:border-[#ffd427]/30 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-xl bg-[#ffd427]/10 flex items-center justify-center mb-4 group-hover:bg-[#ffd427]/20 transition-colors">
                                    <f.icon size={24} className="text-[#ffd427]" strokeWidth={1.5} />
                                </div>
                                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="como-funciona" className="py-20 bg-[#16162a]/30 border-y border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <span className="inline-block px-3 py-1 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-xs font-semibold uppercase tracking-wider mb-4">
                            Cómo funciona
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold">Empieza en 3 simples pasos</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {STEPS.map((step, i) => (
                            <div key={step.num} className="relative text-center md:text-left">
                                {i < STEPS.length - 1 && (
                                    <ChevronRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-[#ffd427]/30" />
                                )}
                                <div className="text-4xl font-black text-[#ffd427]/20 mb-3">{step.num}</div>
                                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                                <p className="text-slate-400 text-sm">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="planes" className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <span className="inline-block px-3 py-1 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-xs font-semibold uppercase tracking-wider mb-4">
                            Planes y precios
                        </span>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
                            Elige el plan que mejor se adapte a tu barbería
                        </h2>
                        <p className="text-slate-400">Sin contratos, cancela cuando quieras.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        {TIER_OPTIONS.map((plan) => {
                            const isPopular = plan.value === 'barberia';
                            return (
                                <div
                                    key={plan.value}
                                    className={`relative flex flex-col rounded-2xl p-6 ${
                                        isPopular
                                            ? 'bg-[#1a1a28] border-2 border-[#ffd427] shadow-xl shadow-[#ffd427]/10'
                                            : 'bg-[#1a1a28] border border-white/5'
                                    }`}
                                >
                                    {isPopular && (
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#ffd427] text-slate-900 text-xs font-bold uppercase rounded-full">
                                            Más popular
                                        </span>
                                    )}
                                    <div className="mb-4">
                                        <h3 className="font-bold text-lg">{plan.label}</h3>
                                        <div className="mt-2 flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-[#ffd427]">
                                                {plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}
                                            </span>
                                            {plan.price > 0 && <span className="text-slate-500 text-sm">/mes</span>}
                                        </div>
                                        {plan.price > 0 && (
                                            <p className="text-xs text-emerald-400 mt-1 font-medium">
                                                Anual −40% → ${(plan.price * 0.6).toFixed(2)}/mes
                                            </p>
                                        )}
                                        <p className="text-slate-400 text-sm mt-2">{plan.description}</p>
                                    </div>
                                    <ul className="space-y-2.5 flex-1 mb-6">
                                        {plan.benefits.slice(0, isPopular ? 6 : 4).map((b, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <span>{b}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={onGetStarted}
                                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                                            isPopular
                                                ? 'bg-[#ffd427] hover:bg-amber-400 text-slate-900'
                                                : plan.price === 0
                                                  ? 'border border-white/25 hover:border-white/50 text-white'
                                                  : 'border border-[#ffd427]/50 hover:bg-[#ffd427]/10 text-[#ffd427]'
                                        }`}
                                    >
                                        {plan.price === 0 ? 'Empezar Gratis' : 'Elegir Plan'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonios" className="py-20 lg:py-28 bg-[#16162a]/30 border-y border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <span className="inline-block px-3 py-1 rounded-full bg-[#ffd427]/10 border border-[#ffd427]/30 text-[#ffd427] text-xs font-semibold uppercase tracking-wider mb-4">
                            Lo que dicen nuestros clientes
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold">Barberos que confían en BarberShow</h2>
                    </div>
                    <div className="hidden md:grid md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map((t) => (
                            <div key={t.name} className="p-6 rounded-2xl bg-[#1a1a28] border border-white/5">
                                <div className="flex gap-0.5 mb-4">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} size={16} className="text-[#ffd427] fill-[#ffd427]" />
                                    ))}
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#ffd427] font-bold text-sm">
                                        {t.initials}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{t.name}</p>
                                        <p className="text-slate-500 text-xs">{t.shop}</p>
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
                                &ldquo;{TESTIMONIALS[activeTestimonial].quote}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#ffd427] font-bold text-sm">
                                    {TESTIMONIALS[activeTestimonial].initials}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{TESTIMONIALS[activeTestimonial].name}</p>
                                    <p className="text-slate-500 text-xs">{TESTIMONIALS[activeTestimonial].shop}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center gap-2 mt-6">
                            {TESTIMONIALS.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setActiveTestimonial(i)}
                                    className={`w-2 h-2 rounded-full transition-colors ${
                                        activeTestimonial === i ? 'bg-[#ffd427]' : 'bg-white/20'
                                    }`}
                                    aria-label={`Testimonio ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="hidden md:flex justify-center gap-2 mt-8">
                        {TESTIMONIALS.map((_, i) => (
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative rounded-3xl bg-gradient-to-br from-[#1a1a28] to-[#12121c] border border-white/10 p-8 lg:p-12 overflow-hidden">
                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #ffd427 0%, transparent 50%)' }} aria-hidden />
                        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6 text-center lg:text-left flex-col lg:flex-row">
                                <div className="w-16 h-16 bg-[#ffd427] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ffd427]/30">
                                    <Scissors size={32} className="text-slate-900" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                                        ¿Listo para llevar tu barbería al siguiente nivel?
                                    </h2>
                                    <p className="text-slate-400">
                                        Miles de barberos ya administran su negocio con BarberShow.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={onGetStarted}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Crear mi barbería ahora
                                </button>
                                <button
                                    type="button"
                                    onClick={onGoToBarberias ?? onGetStarted}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-white/25 hover:border-white/50 text-white font-medium rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Ver demostración
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer id="contacto" className="border-t border-white/5 bg-[#0d0d14] pt-16 pb-8 safe-area-bottom">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
                        <div className="col-span-2 md:col-span-3 lg:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-[#ffd427] rounded-xl flex items-center justify-center">
                                    <Scissors size={20} className="text-slate-900" />
                                </div>
                                <span className="font-bold text-lg">BarberShow</span>
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                La plataforma todo en uno para administrar tu barbería como un profesional.
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
                            <h4 className="font-semibold text-sm mb-4">Producto</h4>
                            <ul className="space-y-2 text-sm text-slate-500">
                                {['Funciones', 'Planes', 'Cómo funciona', 'Testimonios'].map((item) => (
                                    <li key={item}>
                                        <button
                                            type="button"
                                            onClick={() => scrollTo(item === 'Funciones' ? 'funciones' : item === 'Planes' ? 'planes' : item === 'Cómo funciona' ? 'como-funciona' : 'testimonios')}
                                            className="hover:text-[#ffd427] transition-colors"
                                        >
                                            {item}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
                            <ul className="space-y-2 text-sm text-slate-500">
                                <li><button type="button" onClick={() => scrollTo('contacto')} className="hover:text-[#ffd427] transition-colors">Acerca de nosotros</button></li>
                                <li><button type="button" onClick={() => scrollTo('contacto')} className="hover:text-[#ffd427] transition-colors">Contacto</button></li>
                                <li><a href={waHref} target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd427] transition-colors">Soporte</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm text-slate-500">
                                <li><span className="cursor-default">Términos y condiciones</span></li>
                                <li><span className="cursor-default">Política de privacidad</span></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm mb-4">Contacto</h4>
                            <ul className="space-y-3 text-sm">
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
                                        WhatsApp
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-slate-600 text-sm">© 2024 BarberShow. Todos los derechos reservados.</p>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="text-slate-500 hover:text-[#ffd427] text-sm font-medium flex items-center gap-1.5 transition-colors"
                        >
                            <Zap size={14} /> Ya tengo cuenta — Iniciar sesión
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
