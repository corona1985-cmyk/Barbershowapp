import React, { useState, useEffect } from 'react';
import { DataService, generateUniqueId } from '../services/data';
import { Product, Service, Client, SaleItem, Sale, AppointmentForSale } from '../types';
import { Search, Plus, Minus, Trash2, User, CreditCard, Banknote, Smartphone, CheckCircle, Package, Scissors, ShoppingCart, FileText, Loader2, Printer, MessageCircle } from 'lucide-react';
import Invoice from '../components/Invoice';
import { handlePrint } from '../utils/print';
import { useTranslation } from '../i18n';

interface SalesProps {
    salesFromAppointment?: AppointmentForSale | null;
    onClearSalesFromAppointment?: () => void;
}

const Sales: React.FC<SalesProps> = ({ salesFromAppointment = null, onClearSalesFromAppointment }) => {
    const { t, formatTime } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'products' | 'services'>('services');
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    
    // Config
    const [taxRate, setTaxRate] = useState(0);
    const [storeName, setStoreName] = useState('BarberShow');
    const [currencySymbol, setCurrencySymbol] = useState('$');

    // Última venta completada (para factura / imprimir / WhatsApp)
    const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
    const [lastSaleClientName, setLastSaleClientName] = useState<string | null>(null);
    const [lastSaleClientPhone, setLastSaleClientPhone] = useState<string | null>(null);

    // Cart State
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastSaleId, setLastSaleId] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (salesFromAppointment) {
            setCart(salesFromAppointment.items);
            setSelectedClient(salesFromAppointment.clienteId);
        }
    }, [salesFromAppointment]);

    const loadData = async () => {
        setLoadingCatalog(true);
        try {
            const role = DataService.getCurrentUserRole();
            const barberId = role === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
            const [productsData, servicesData, clientsData, settingsData] = await Promise.all([
                DataService.getProducts(barberId),
                DataService.getServices(),
                DataService.getClients(),
                DataService.getSettings(),
            ]);
            let serv = servicesData;
            if (role === 'barbero' && barberId != null) {
                serv = servicesData.filter((s) => s.barberId === barberId);
            }
            setProducts(productsData);
            setServices(serv);
            setClients(clientsData);
            setTaxRate(settingsData.taxRate);
            setStoreName(settingsData.storeName || 'BarberShow');
            setCurrencySymbol(settingsData.currencySymbol || '$');
        } finally {
            setLoadingCatalog(false);
        }
    };

    const addToCart = (item: Product | Service, type: 'producto' | 'servicio') => {
        if (type === 'producto') {
            const product = item as Product;
            if (product.stock <= 0) return;
        }

        const existingItem = cart.find(i => i.id === item.id && i.type === type);

        if (existingItem && type === 'servicio') {
            alert(t('sales.serviceAlreadyInCart'));
            return;
        }
        if (existingItem && type === 'producto') {
            alert(t('sales.productAlreadyInCart'));
            return;
        }

        setCart([...cart, {
            id: item.id,
            name: type === 'producto' ? (item as Product).producto : (item as Service).name,
            price: type === 'producto' ? (item as Product).precioVenta : (item as Service).price,
            quantity: 1,
            type
        }]);
    };

    const updateQuantity = (id: number, type: 'producto' | 'servicio', delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id && item.type === type) {
                const newQuantity = Math.max(1, item.quantity + delta);
                if (type === 'producto') {
                    const product = products.find(p => p.id === id);
                    if (product && newQuantity > product.stock) return item;
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeFromCart = (id: number, type: 'producto' | 'servicio') => {
        setCart(cart.filter(item => !(item.id === id && item.type === type)));
    };

    const calculateTotal = () => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * taxRate;
        return { subtotal, tax, total: subtotal + tax };
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        const activePosId = DataService.getActivePosId();
        if (activePosId == null) {
            alert(t('sales.noActiveLocation'));
            return;
        }
        try {
            const updatedProducts = [...products];
            for (const item of cart) {
                if (item.type === 'producto') {
                    const prod = updatedProducts.find(p => p.id === item.id);
                    if (prod && prod.stock < item.quantity) {
                        alert(t('sales.insufficientStock', { name: item.name, stock: prod.stock }));
                        return;
                    }
                }
            }
            const { subtotal, tax, total } = calculateTotal();
            const newId = generateUniqueId();
            const saleNumber = `V${String(newId).padStart(6, '0')}`;
            const clienteId = salesFromAppointment ? salesFromAppointment.clienteId : selectedClient;
            const newSale: Sale = {
                id: newId,
                posId: activePosId,
                numeroVenta: saleNumber,
                clienteId,
                barberoId: salesFromAppointment?.barberoId ?? DataService.getCurrentBarberId() ?? undefined,
                items: [...cart],
                metodoPago: paymentMethod,
                subtotal,
                iva: tax,
                total,
                fecha: new Date().toISOString().split('T')[0],
                hora: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
                notas: '',
                estado: 'completada'
            };
            for (const item of cart) {
                if (item.type === 'producto') {
                    const prod = updatedProducts.find(p => p.id === item.id);
                    if (prod) {
                        prod.stock -= item.quantity;
                        await DataService.updateProduct(prod);
                    }
                }
            }
            if (clienteId) {
                const client = clients.find(c => c.id === clienteId);
                if (client) {
                    let pointsEarned = 0;
                    cart.forEach(item => {
                        if (item.type === 'servicio') pointsEarned += 20;
                        else pointsEarned += Math.floor(item.price * item.quantity);
                    });
                    client.puntos = (client.puntos || 0) + pointsEarned;
                    await DataService.updateClient(client);
                }
            }
            await DataService.addSale(newSale);
            setProducts(updatedProducts);
            setLastSaleId(saleNumber);
            setLastCompletedSale(newSale);
            const client = clienteId ? clients.find(c => c.id === clienteId) : null;
            setLastSaleClientName(client?.nombre ?? null);
            setLastSaleClientPhone(client?.telefono ?? null);
            setShowSuccess(true);
            setCart([]);
            setSelectedClient(null);
            setPaymentMethod('efectivo');
            onClearSalesFromAppointment?.();
        } catch (err) {
            alert(err instanceof Error ? err.message : t('sales.checkoutFailed'));
        }
    };

    const filteredProducts = products.filter(p => p.producto.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const { subtotal, tax, total } = calculateTotal();

    return (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 min-h-0 lg:h-[calc(100vh-8rem)]">
            {/* Left Column: Catalog */}
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[280px] lg:min-h-0">
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="text" 
                                placeholder={t('sales.searchPlaceholder')}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setActiveTab('services')}
                            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg font-medium transition-colors ${activeTab === 'services' ? 'bg-[#ffd427] text-slate-900 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Scissors size={18} />
                            <span>{t('sales.services')}</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('products')}
                            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg font-medium transition-colors ${activeTab === 'products' ? 'bg-[#ffd427] text-slate-900 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Package size={18} />
                            <span>{t('sales.products')}</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {loadingCatalog ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-medium">{t('sales.loadingCatalog')}</p>
                        </div>
                    ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {activeTab === 'services' ? (
                            filteredServices.map(service => (
                                <div 
                                    key={service.id} 
                                    onClick={() => addToCart(service, 'servicio')}
                                    className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-[#ffd427] hover:shadow-md transition-all group"
                                >
                                    <h3 className="font-semibold text-slate-800 group-hover:text-amber-700 mb-1">{service.name}</h3>
                                    <p className="text-slate-500 text-sm mb-2">{t('sales.minutesShort', { duration: service.duration })}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg text-slate-900">${service.price.toFixed(2)}</span>
                                        <div className="w-8 h-8 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 group-hover:bg-[#ffd427] group-hover:text-slate-900 transition-colors">
                                            <Plus size={16} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            filteredProducts.map(product => (
                                <div 
                                    key={product.id} 
                                    onClick={() => addToCart(product, 'producto')}
                                    className={`bg-white p-4 rounded-xl border border-slate-200 transition-all ${product.stock > 0 ? 'cursor-pointer hover:border-[#ffd427] hover:shadow-md group' : 'opacity-60 cursor-not-allowed'}`}
                                >
                                    <h3 className="font-semibold text-slate-800 group-hover:text-amber-700 mb-1">{product.producto}</h3>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.stock > 5 ? 'bg-green-100 text-green-700' : product.stock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                            {product.stock > 0 ? t('sales.stock', { count: product.stock }) : t('sales.outOfStock')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg text-slate-900">${product.precioVenta.toFixed(2)}</span>
                                        {product.stock > 0 && (
                                            <div className="w-8 h-8 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 group-hover:bg-[#ffd427] group-hover:text-slate-900 transition-colors">
                                                <Plus size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    )}
                </div>
            </div>

            {/* Right Column: Cart - en escritorio más ancho para que Factura de cita y servicios se vean bien */}
            <div className="w-full lg:w-[420px] flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[320px] lg:min-h-0 lg:h-full">
                <div className="p-4 border-b border-slate-200">
                    {salesFromAppointment && (
                        <div className="mb-4 p-3 lg:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1 mb-2">
                                <FileText size={16} /> {t('sales.appointmentInvoice')}
                            </h3>
                            <dl className="text-sm space-y-1 text-amber-800">
                                <div><span className="font-medium">{t('sales.clientLabel')}</span> {salesFromAppointment.clienteNombre}</div>
                                <div><span className="font-medium">{t('sales.dateLabel')}</span> {salesFromAppointment.fecha} <span className="font-medium">{t('sales.timeLabel')}</span> {salesFromAppointment.hora}</div>
                                <div className="pt-1.5 mt-1 border-t border-amber-200">
                                    <span className="font-medium block mb-1.5">{t('sales.servicesLabel')}</span>
                                    <div className="mt-1 lg:mt-2 min-h-[80px] lg:min-h-[140px]">
                                        {/* En computadora: tabla con buen espacio; en cel: lista compacta */}
                                        <div className="hidden lg:block rounded-md border border-amber-200/60 bg-white/60 overflow-visible">
                                            <table className="w-full text-sm lg:text-base">
                                                <thead>
                                                    <tr className="text-left text-amber-900 border-b-2 border-amber-200/80 bg-amber-100/50">
                                                        <th className="py-2.5 px-3 font-semibold">{t('sales.serviceColumn')}</th>
                                                        <th className="py-2.5 px-3 font-semibold text-right w-24">{t('sales.priceColumn')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-amber-900">
                                                    {(cart.length > 0 ? cart : salesFromAppointment.items).map((item, i) => (
                                                        <tr key={`${item.id}-${item.type}-${i}`} className="border-b border-amber-100 last:border-0 hover:bg-amber-50/50">
                                                            <td className="py-2.5 px-3 font-medium">{item.name}</td>
                                                            <td className="py-2.5 px-3 text-right font-semibold">${(item.price * item.quantity).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <ul className="lg:hidden space-y-0.5 text-amber-900">
                                            {(cart.length > 0 ? cart : salesFromAppointment.items).map((item, i) => (
                                                <li key={`${item.id}-${item.type}-${i}`} className="break-words">{item.name} — ${(item.price * item.quantity).toFixed(2)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="pt-1.5 border-t border-amber-200"><span className="font-medium">{t('sales.totalLabel')}</span> ${(cart.length > 0 ? total : salesFromAppointment.total).toFixed(2)}</div>
                            </dl>
                        </div>
                    )}
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <ShoppingCart className="mr-2" />
                        {t('sales.currentSale')}
                    </h2>
                    
                    {salesFromAppointment ? (
                        <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <User className="text-amber-700 flex-shrink-0" size={18} />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-amber-800">{t('sales.clientLocked')}</p>
                                <p className="font-semibold text-slate-800 truncate">{salesFromAppointment.clienteNombre}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                            <select 
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427] appearance-none"
                                value={selectedClient || ''}
                                onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">{t('sales.walkInClient')}</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-w-0 min-h-[200px]">
                    {salesFromAppointment && cart.length > 0 && (
                        <p className="text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                            {t('sales.removeItemHint')} <Trash2 size={14} className="inline text-red-500 align-middle mx-0.5" />
                        </p>
                    )}
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[120px]">
                            <ShoppingCart size={48} className="mb-2 opacity-50" />
                            <p>{t('sales.emptyCart')}</p>
                        </div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={`${item.id}-${item.type}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <h4 className="font-medium text-slate-800">{item.name}</h4>
                                    <p className="text-sm text-slate-500">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.type, -1)}
                                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-l-lg"
                                            title={t('sales.less')}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.type, 1)}
                                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-r-lg"
                                            title={t('sales.more')}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
<button 
                                            onClick={() => removeFromCart(item.id, item.type)}
                                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200"
                                            title={t('sales.removeItem')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-slate-600">
                            <span>{t('sales.subtotal')}</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>{t('sales.tax', { rate: (taxRate * 100).toFixed(0) })}</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-slate-200">
                            <span>{t('sales.total')}</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { id: 'efectivo', icon: Banknote, label: t('sales.cash') },
                            { id: 'tarjeta', icon: CreditCard, label: t('sales.card') },
                            { id: 'transferencia', icon: Smartphone, label: t('sales.transfer') }
                        ].map(method => (
                            <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id)}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                    paymentMethod === method.id 
                                    ? 'bg-[#ffd427] text-slate-900 border-[#ffd427] font-medium' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <method.icon size={20} className="mb-1" />
                                <span className="text-xs font-medium">{method.label}</span>
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className={`w-full py-3 rounded-lg font-bold shadow-md transition-all ${
                            cart.length === 0 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 hover:shadow-lg'
                        }`}
                    >
                        {t('sales.charge', { amount: total.toFixed(2) })}
                    </button>
                </div>
            </div>

            {/* Success Modal: factura, imprimir y WhatsApp */}
            {showSuccess && lastCompletedSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] w-full max-w-lg">
                        <div className="p-6 flex flex-col items-center border-b border-slate-100">
                            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">{t('sales.successTitle')}</h3>
                            <p className="text-slate-500 text-sm font-mono">{t('sales.ref')} {lastSaleId}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div id="invoice-print-area">
                                <Invoice
                                    sale={lastCompletedSale}
                                    storeName={storeName}
                                    currencySymbol={currencySymbol}
                                    clientName={lastSaleClientName}
                                    forPrint={false}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => handlePrint({
                                    name: t('sales.invoiceName'),
                                    shareText: [
                                        t('sales.invoiceShareTitle', { store: storeName }),
                                        `${t('sales.ref')} ${lastCompletedSale.numeroVenta}`,
                                        `${t('sales.dateLabel')} ${lastCompletedSale.fecha} ${lastCompletedSale.hora}`,
                                        lastSaleClientName ? `${t('sales.clientLabel')} ${lastSaleClientName}` : null,
                                        '',
                                        ...lastCompletedSale.items.map(i => `• ${i.name} x${i.quantity} – ${currencySymbol}${(i.price * i.quantity).toFixed(2)}`),
                                        '',
                                        `${t('sales.totalLabel')} ${currencySymbol}${lastCompletedSale.total.toFixed(2)}`,
                                        t('sales.thanksMessage'),
                                    ].filter(Boolean).join('\n'),
                                })}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors no-print"
                            >
                                <Printer size={20} />
                                {t('sales.printInvoice')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const lines = [
                                        `*${t('sales.invoiceShareTitle', { store: storeName })}*`,
                                        `${t('sales.ref')} ${lastCompletedSale.numeroVenta}`,
                                        `${t('sales.dateLabel')} ${lastCompletedSale.fecha} ${lastCompletedSale.hora}`,
                                        lastSaleClientName ? `${t('sales.clientLabel')} ${lastSaleClientName}` : null,
                                        '',
                                        ...lastCompletedSale.items.map(i => `• ${i.name} x${i.quantity} – ${currencySymbol}${(i.price * i.quantity).toFixed(2)}`),
                                        '',
                                        `*${t('sales.totalLabel')} ${currencySymbol}${lastCompletedSale.total.toFixed(2)}*`,
                                        t('sales.thanksMessage'),
                                    ].filter(Boolean);
                                    const text = lines.join('\n');
                                    const phone = String(lastSaleClientPhone ?? '').replace(/\s+/g, '').replace(/^\+/, '') || '';
                                    const url = phone
                                        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                                        : `https://wa.me/?text=${encodeURIComponent(text)}`;
                                    window.open(url, '_blank');
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors no-print"
                            >
                                <MessageCircle size={20} />
                                {lastSaleClientPhone ? t('sales.sendWhatsApp') : t('sales.openWhatsApp')}
                            </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowSuccess(false); setLastCompletedSale(null); setLastSaleClientName(null); setLastSaleClientPhone(null); }}
                                className="w-full py-2.5 text-slate-600 hover:text-slate-800 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 no-print"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;