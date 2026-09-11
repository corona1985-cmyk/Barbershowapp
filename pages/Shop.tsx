import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Product, CartItem } from '../types';
import { Search, ShoppingBag, Plus, Minus, Trash2, CheckCircle, Package } from 'lucide-react';
import { useTranslation } from '../i18n';
import { createClientShopOrder, getShopCatalog } from '../services/firebase';
import { showToast } from '../components/ToastHost';

const Shop: React.FC = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');
    const [checkingOut, setCheckingOut] = useState(false);

    useEffect(() => {
        const posId = DataService.getActivePosId();
        if (posId == null) return;
        getShopCatalog(posId)
            .then((catalog) => {
                setProducts(catalog.products.map((p) => ({
                    id: p.id,
                    posId: p.posId,
                    producto: p.producto,
                    precioVenta: p.precioVenta,
                    stock: p.stock,
                    photoUrl: p.photoUrl || undefined,
                    costo: 0,
                    categoria: '',
                } as Product)));
            })
            .catch(() => showToast(t('shop.checkoutFailed'), 'error'));
        setCart(DataService.getCart());
    }, [t]);

    const handleAddToCart = (product: Product) => {
        if (product.stock <= 0) return;
        const updatedCart = DataService.addToCart(product);
        setCart([...updatedCart]);
    };

    const handleUpdateQuantity = (id: number, quantity: number) => {
        const product = products.find(p => p.id === id);
        if (product && quantity > product.stock) return;
        const updatedCart = DataService.updateCartQuantity(id, quantity, 'producto');
        setCart([...updatedCart]);
    };

    const handleCheckout = async () => {
        if (cart.length === 0 || checkingOut) return;
        const activePosId = DataService.getActivePosId();
        if (activePosId == null) {
            showToast(t('shop.noShopSelected'), 'error');
            return;
        }
        setCheckingOut(true);
        try {
            const result = await createClientShopOrder(
                activePosId,
                cart.map((c) => ({ id: c.id, quantity: c.quantity }))
            );
            DataService.clearCart();
            setCart([]);
            setLastOrderId(result.saleNumber);
            setShowSuccess(true);
            showToast(t('shop.orderSuccess'), 'success');
            const catalog = await getShopCatalog(activePosId);
            setProducts(catalog.products.map((p) => ({
                id: p.id,
                posId: p.posId,
                producto: p.producto,
                precioVenta: p.precioVenta,
                stock: p.stock,
                photoUrl: p.photoUrl || undefined,
                costo: 0,
                categoria: '',
            } as Product)));
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('shop.checkoutFailed'), 'error');
        } finally {
            setCheckingOut(false);
        }
    };

    const filteredProducts = products.filter(p => p.producto.toLowerCase().includes(searchTerm.toLowerCase()));
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex flex-col lg:flex-row min-h-0 lg:h-[calc(100vh-8rem)] gap-4 md:gap-6">
            <div className="flex-1 flex flex-col min-h-[280px] lg:min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder={t('shop.searchProducts')}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        className="lg:hidden relative p-2 text-slate-600"
                        onClick={() => setShowCart(!showCart)}
                    >
                        <ShoppingBag size={24} />
                        {cart.length > 0 && (
                            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                                {cart.length}
                            </span>
                        )}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="border border-slate-200 rounded-xl p-4 flex flex-col">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-slate-800">{product.producto}</h3>
                                <Package size={18} className="text-slate-400" />
                            </div>
                            <p className="text-[#e6be23] font-bold mt-2">${product.precioVenta.toFixed(2)}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                {product.stock <= 0 ? t('shop.outOfStock') : t('shop.available', { count: product.stock })}
                            </p>
                            <button
                                type="button"
                                disabled={product.stock <= 0}
                                onClick={() => handleAddToCart(product)}
                                className="mt-auto pt-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
                            >
                                + {t('shop.myCart')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className={`lg:w-80 bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${showCart ? 'block' : 'hidden lg:block'}`}>
                <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShoppingBag size={18} /> {t('shop.myCart')}</h2>
                {cart.length === 0 ? (
                    <p className="text-slate-500 text-sm">{t('shop.emptyCart')}</p>
                ) : (
                    <div className="space-y-3">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-slate-500">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button>
                                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                                    <button type="button" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
                                    <button type="button" onClick={() => handleUpdateQuantity(item.id, 0)}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                        <div className="border-t pt-3">
                            <p className="text-sm font-semibold">{t('shop.totalToPay')}: ${cartTotal.toFixed(2)}</p>
                            <button
                                type="button"
                                disabled={checkingOut}
                                onClick={handleCheckout}
                                className="w-full mt-3 min-h-[44px] bg-[#ffd427] rounded-xl font-bold disabled:opacity-60"
                            >
                                {t('shop.placeOrder')}
                            </button>
                        </div>
                    </div>
                )}
                {showSuccess && (
                    <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle size={16} /> {t('shop.orderProcessed')} {lastOrderId}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Shop;
