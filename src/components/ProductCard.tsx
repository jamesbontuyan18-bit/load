import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Phone, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  ShieldAlert, 
  Bell, 
  BellRing 
} from 'lucide-react';
import { Product, formatPHP } from '../types';
import { isProductAlertActive } from '../services/alertService';

interface ProductCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  onOpenPriceAlert: (product: Product) => void;
  refreshTrigger?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onOpenPriceAlert,
  refreshTrigger = 0
}) => {
  const [isAlertSubscribed, setIsAlertSubscribed] = useState(false);

  useEffect(() => {
    setIsAlertSubscribed(isProductAlertActive(product.id));
  }, [product.id, refreshTrigger]);

  const getNetworkBadge = () => {
    switch (product.network) {
      case 'Globe':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'TM':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Smart':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TNT':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'DITO':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`relative bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-amber-300 ${
      !product.isActive ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200/90'
    }`}>
      <div>
        {/* Network & Quick Price Alert Bell header */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getNetworkBadge()}`}>
              {product.network}
            </span>
            {product.validity && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {product.validity}
              </span>
            )}
          </div>

          {/* Quick Bell Icon Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPriceAlert(product);
            }}
            title={isAlertSubscribed ? "Price alert active for this package" : "Notify me of price drops"}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isAlertSubscribed
                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                : 'bg-slate-50 text-slate-400 hover:text-amber-700 hover:bg-amber-50 border-slate-200'
            }`}
          >
            {isAlertSubscribed ? (
              <BellRing className="w-3.5 h-3.5 text-amber-700" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Product Title */}
        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight mb-1">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">
          {product.description}
        </p>
      </div>

      {/* Pricing & Order Actions */}
      <div className="pt-3 border-t border-slate-100 mt-2">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Selling Price</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {formatPHP(product.sellingPrice)}
              </span>
              {product.sellingPrice !== product.faceValue && (
                <span className="text-[11px] text-slate-400 line-through">
                  ₱{product.faceValue}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Instant
          </span>
        </div>

        {/* Buy Promo Button */}
        <button
          disabled={!product.isActive}
          onClick={() => onSelectProduct(product)}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
            product.isActive
              ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 hover:shadow-amber-400/20 active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {product.isActive ? (
            <>
              <span>Buy Promo</span>
              <ArrowRight className="w-4 h-4 text-slate-900" />
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4" />
              <span>Unavailable</span>
            </>
          )}
        </button>

        {/* Notify Me of Price Drops Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPriceAlert(product);
          }}
          className={`w-full mt-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
            isAlertSubscribed
              ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold hover:bg-amber-100'
              : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-900 border-slate-200 hover:border-amber-200'
          }`}
        >
          {isAlertSubscribed ? (
            <>
              <BellRing className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
              <span>Price Alert Active (Email Set)</span>
            </>
          ) : (
            <>
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              <span>Notify me of price drops</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
