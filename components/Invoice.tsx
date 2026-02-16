import React from 'react';
import { Sale } from '../types';

export interface InvoiceProps {
    sale: Sale;
    storeName: string;
    currencySymbol: string;
    clientName?: string | null;
    /** Si es true, se usa para vista de impresión (sin bordes decorativos) */
    forPrint?: boolean;
}

const Invoice: React.FC<InvoiceProps> = ({ sale, storeName, currencySymbol, clientName, forPrint }) => {
    const metodoPagoLabel: Record<string, string> = {
        efectivo: 'Efectivo',
        tarjeta: 'Tarjeta',
        transferencia: 'Transferencia',
    };

    return (
        <div
            className={`bg-white text-slate-800 ${forPrint ? 'p-6 max-w-md mx-auto' : 'p-6 rounded-xl border border-slate-200 shadow-sm max-w-md'}`}
            id="invoice-content"
        >
            <header className="border-b border-slate-200 pb-4 mb-4">
                <h1 className="text-xl font-bold text-slate-900">{storeName}</h1>
                <p className="text-sm text-slate-500 mt-1">Factura / Comprobante de venta</p>
            </header>

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <span className="text-slate-500">Nº venta:</span>
                <span className="font-semibold">{sale.numeroVenta}</span>
                <span className="text-slate-500">Fecha:</span>
                <span>{sale.fecha}</span>
                <span className="text-slate-500">Hora:</span>
                <span>{sale.hora}</span>
                <span className="text-slate-500">Método de pago:</span>
                <span>{metodoPagoLabel[sale.metodoPago] ?? sale.metodoPago}</span>
                {clientName && (
                    <>
                        <span className="text-slate-500">Cliente:</span>
                        <span>{clientName}</span>
                    </>
                )}
            </div>

            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-2 font-semibold text-slate-700">Concepto</th>
                        <th className="text-right py-2 font-semibold text-slate-700 w-16">Cant.</th>
                        <th className="text-right py-2 font-semibold text-slate-700 w-20">Precio</th>
                        <th className="text-right py-2 font-semibold text-slate-700 w-24">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, idx) => (
                        <tr key={`${item.id}-${item.type}-${idx}`} className="border-b border-slate-100">
                            <td className="py-2">{item.name}</td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right">{currencySymbol}{item.price.toFixed(2)}</td>
                            <td className="text-right font-medium">{currencySymbol}{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span>{currencySymbol}{sale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-600">IVA</span>
                    <span>{currencySymbol}{sale.iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2">
                    <span>Total</span>
                    <span>{currencySymbol}{sale.total.toFixed(2)}</span>
                </div>
            </div>

            <footer className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                Gracias por su preferencia · {storeName}
            </footer>
        </div>
    );
};

export default Invoice;
