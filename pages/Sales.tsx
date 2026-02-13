import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Product, Service, Client, SaleItem, Sale, AppointmentForSale } from '../types';
import { Search, Plus, Minus, Trash2, User, CreditCard, Banknote, Smartphone, CheckCircle, Package, Scissors, ShoppingCart, FileText, Loader2 } from 'lucide-react';

interface SalesProps {
    salesFromAppointment?: AppointmentForSale | null;
    onClearSalesFromAppointment?: () => void;
}

const Sales: React.FC<SalesProps> = ({ salesFromAppointment = null, onClearSalesFromAppointment }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'products' | 'services'>('services');
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    
    // Config
    const [taxRate, setTaxRate] = useState(0.16);
    
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
            const [productsData, servicesData, clientsData, settingsData] = await Promise.all([
                DataService.getProducts(),
                DataService.getServices(),
                DataService.getClients(),
                DataService.getSettings(),
            ]);
            setProducts(productsData);
            setServices(servicesData);
            setClients(clientsData);
            setTaxRate(settingsData.taxRate);
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
        
        if (existingItem) {
            if (type === 'producto') {
                const product = products.find(p => p.id === item.id);
                if (product && existingItem.quantity >= product.stock) {
                    alert('Stock insuficiente');
                    return;
                }
            }
            setCart(cart.map(i => 
                (i.id === item.id && i.type === type) 
                ? { ...i, quantity: i.quantity + 1 } 
                : i
            ));
        } else {
            setCart([...cart, {
                id: item.id,
                name: type === 'producto' ? (item as Product).producto : (item as Service).name,
                price: type === 'producto' ? (item as Product).precioVenta : (item as Service).price,
                quantity: 1,
                type
            }]);
        }
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
            alert('No hay sede activa. Selecciona una sede antes de registrar la venta.');
            return;
        }
        try {
            const { subtotal, tax, total } = calculateTotal();
            const sales = await DataService.getSales();
            const newId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
            const saleNumber = `V${String(newId).padStart(4, '0')}`;
            const newSale: Sale = {
                id: newId,
                posId: activePosId,
                numeroVenta: saleNumber,
                clienteId: selectedClient,
                barberoId: salesFromAppointment?.barberoId ?? DataService.getCurrentBarberId() ?? undefined,
                items: [...cart],
                metodoPago: paymentMethod,
                subtotal,
                iva: tax,
                total,
                fecha: new Date().toISOString().split('T')[0],
                hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                notas: '',
                estado: 'completada'
            };
            const updatedProducts = [...products];
            cart.forEach(item => {
                if (item.type === 'producto') {
                    const prodIndex = updatedProducts.findIndex(p => p.id === item.id);
                    if (prodIndex >= 0) updatedProducts[prodIndex].stock -= item.quantity;
                }
            });
            if (selectedClient) {
                const client = clients.find(c => c.id === selectedClient);
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
            await DataService.setProducts(updatedProducts);
            await DataService.setSales([...sales, newSale]);
            setProducts(updatedProducts);
            setLastSaleId(saleNumber);
            setShowSuccess(true);
            setCart([]);
            setSelectedClient(null);
            setPaymentMethod('efectivo');
            onClearSalesFromAppointment?.();
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'No se pudo completar la venta. Intenta de nuevo.');
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
                                placeholder="Buscar servicios o productos..."
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
                            <span>Servicios</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('products')}
                            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg font-medium transition-colors ${activeTab === 'products' ? 'bg-[#ffd427] text-slate-900 shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Package size={18} />
                            <span>Productos</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {loadingCatalog ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-medium">Cargando servicios y productos...</p>
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
                                    <p className="text-slate-500 text-sm mb-2">{service.duration} mins</p>
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
                                            {product.stock > 0 ? `Stock: ${product.stock}` : 'Sin Stock'}
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

            {/* Right Column: Cart */}
            <div className="w-full lg:w-96 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[320px] lg:min-h-0 lg:h-full">
                <div className="p-4 border-b border-slate-200">
                    {salesFromAppointment && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1 mb-2">
                                <FileText size={16} /> Factura de cita
                            </h3>
                            <dl className="text-sm space-y-1 text-amber-800">
                                <div><span className="font-medium">Cliente:</span> {salesFromAppointment.clienteNombre}</div>
                                <div><span className="font-medium">Fecha:</span> {salesFromAppointment.fecha}</div>
                                <div><span className="font-medium">Hora del corte:</span> {salesFromAppointment.hora}</div>
                                <div className="pt-1 border-t border-amber-200 mt-1"><span className="font-medium">Total:</span> ${(cart.length > 0 ? total : salesFromAppointment.total).toFixed(2)}</div>
                            </dl>
                        </div>
                    )}
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <ShoppingCart className="mr-2" />
                        Venta Actual
                    </h2>
                    
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427] appearance-none"
                            value={selectedClient || ''}
                            onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">Cliente Ocasional</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ShoppingCart size={48} className="mb-2 opacity-50" />
                            <p>El carrito está vacío</p>
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
                                            className="p-1 hover:bg-slate-100 text-slate-600 rounded-l-lg"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.type, 1)}
                                            className="p-1 hover:bg-slate-100 text-slate-600 rounded-r-lg"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => removeFromCart(item.id, item.type)}
                                        className="text-red-400 hover:text-red-600"
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
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Impuesto ({(taxRate * 100).toFixed(0)}%)</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-slate-200">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { id: 'efectivo', icon: Banknote, label: 'Efectivo' },
                            { id: 'tarjeta', icon: CreditCard, label: 'Tarjeta' },
                            { id: 'transferencia', icon: Smartphone, label: 'Transf.' }
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
                        Cobrar ${total.toFixed(2)}
                    </button>
                </div>
            </div>

            {/* Success Modal Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Venta Exitosa!</h3>
                        <p className="text-slate-500 mb-6 text-center">
                            Transacción completada.
                            <br/>
                            <span className="font-mono text-xs">Ref: {lastSaleId}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;