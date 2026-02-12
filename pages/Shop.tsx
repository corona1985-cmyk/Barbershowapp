import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Product, CartItem, Sale } from '../types';
import { Search, ShoppingBag, Plus, Minus, Trash2, CheckCircle, Package } from 'lucide-react';

const Shop: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');

    useEffect(() => {
        DataService.getProducts().then(setProducts);
        setCart(DataService.getCart());
    }, []);

    const handleAddToCart = (product: Product) => {
        if (product.stock <= 0) return;
        const updatedCart = DataService.addToCart(product);
        setCart([...updatedCart]); // Trigger re-render
    };

    const handleUpdateQuantity = (id: number, quantity: number) => {
        const product = products.find(p => p.id === id);
        if (product && quantity > product.stock) return;
        
        const updatedCart = DataService.updateCartQuantity(id, quantity);
        setCart([...updatedCart]);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        const [settings, clients, sales] = await Promise.all([
            DataService.getSettings(),
            DataService.getClients(),
            DataService.getSales(),
        ]);
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxRate = settings.taxRate;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;
        const currentUser = DataService.getCurrentUser();
        const client = currentUser ? clients.find(c => c.nombre === currentUser.name) : null;
        const newId = sales.length > 0 ? Math.max(...sales.map(s => s.id)) + 1 : 1;
        const saleNumber = `ORD${String(newId).padStart(4, '0')}`;
        const newSale: Sale = {
            id: newId,
            posId: DataService.getActivePosId() || 0,
            numeroVenta: saleNumber,
            clienteId: client?.id ?? null,
            items: cart.map(c => ({ ...c, type: 'producto' as const })),
            metodoPago: 'online',
            subtotal,
            iva: tax,
            total,
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            notas: 'Pedido Online - Pendiente de recojo',
            estado: 'completada'
        };
        const updatedProducts = [...products];
        cart.forEach(item => {
            const prodIndex = updatedProducts.findIndex(p => p.id === item.id);
            if (prodIndex >= 0) updatedProducts[prodIndex].stock -= item.quantity;
        });
        if (client) {
            const pointsEarned = DataService.calculatePoints(total, 'product');
            client.puntos = (client.puntos || 0) + pointsEarned;
            await DataService.updateClient(client);
        }
        await DataService.setProducts(updatedProducts);
        await DataService.setSales([...sales, newSale]);
        DataService.clearCart();
        setProducts(updatedProducts);
        setCart([]);
        setLastOrderId(saleNumber);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    const filteredProducts = products.filter(p => p.producto.toLowerCase().includes(searchTerm.toLowerCase()));
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-theme(spacing.32))] gap-6">
            {/* Product Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar productos..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        className="lg:hidden relative p-2 text-slate-600"
                        onClick={() => setShowCart(!showCart)}
                    >
                        <ShoppingBag size={24} />
                        {cart.length > 0 && (
                            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                                {cart.reduce((a, b) => a + b.quantity, 0)}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all flex flex-col group hover:border-[#ffd427]">
                                <div className="h-40 bg-slate-100 flex items-center justify-center">
                                    <Package size={48} className="text-slate-300 group-hover:text-[#ffd427] transition-colors" />
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-slate-800 mb-1">{product.producto}</h3>
                                    <p className="text-sm text-slate-500 mb-2">{product.categoria}</p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-xl font-bold text-[#e6be23]">${product.precioVenta.toFixed(2)}</span>
                                        <button 
                                            onClick={() => handleAddToCart(product)}
                                            disabled={product.stock <= 0}
                                            className={`p-2 rounded-lg flex items-center justify-center ${product.stock > 0 ? 'bg-[#ffd427] text-slate-900 hover:bg-[#e6be23]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs">
                                        {product.stock > 0 ? (
                                            <span className="text-green-600 font-medium">{product.stock} disponibles</span>
                                        ) : (
                                            <span className="text-red-500 font-medium">Agotado</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cart Sidebar (Desktop: Fixed Right, Mobile: Drawer/Modal) */}
            <div className={`
                fixed inset-y-0 right-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 z-50 lg:relative lg:transform-none lg:w-96 lg:shadow-sm lg:border lg:border-slate-200 lg:rounded-xl lg:flex lg:flex-col
                ${showCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-slate-800 flex items-center">
                        <ShoppingBag className="mr-2" size={20} /> Mi Carrito
                    </h2>
                    <button onClick={() => setShowCart(false)} className="lg:hidden text-slate-400">
                        <Trash2 size={20} /> 
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ShoppingBag size={48} className="mb-4 opacity-50" />
                            <p>Tu carrito está vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <div className="w-16 h-16 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                                    <Package size={24} className="text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-slate-800 truncate">{item.name}</h4>
                                    <div className="text-[#e6be23] font-bold mt-1">${(item.price * item.quantity).toFixed(2)}</div>
                                    <div className="flex items-center mt-2">
                                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">-</button>
                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">+</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-600">Total a Pagar</span>
                        <span className="text-2xl font-bold text-slate-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className={`w-full py-3 rounded-xl font-bold text-slate-900 shadow-lg transition-all ${
                            cart.length > 0 
                            ? 'bg-[#ffd427] hover:bg-[#e6be23] hover:shadow-yellow-500/30' 
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                    >
                        Realizar Pedido
                    </button>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Pedido Realizado!</h3>
                        <p className="text-slate-500 mb-6 text-center">
                            Tu orden ha sido procesada.<br/>
                            <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded mt-2 inline-block">#{lastOrderId}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shop;