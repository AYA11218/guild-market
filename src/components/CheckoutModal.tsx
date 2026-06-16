/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, CreditCard, Shield, Lock, CheckCircle, ArrowRight, User, MapPin, Loader2, Sparkles, Building, Smartphone, Globe, QrCode, Coins } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CartItem, Order, OrderItem } from '../types';

interface CheckoutModalProps {
  user: FirebaseUser | null;
  cartItems: CartItem[];
  onClose: () => void;
  onClearCart: () => void;
}

type CheckoutStep = 'CART' | 'PAYMENT' | 'OTP' | 'PROCESSING' | 'SUCCESS';

export default function CheckoutModal({
  user,
  cartItems,
  onClose,
  onClearCart,
}: CheckoutModalProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('CART');
  
  // Payment Type Selector Integration
  const [paymentCategory, setPaymentCategory] = useState<'GLOBAL' | 'LOCAL'>('GLOBAL');
  const [globalMethod, setGlobalMethod] = useState<'CARD' | 'PAYPAL'>('CARD');
  const [localMethod, setLocalMethod] = useState<'PIX' | 'IDEAL' | 'UPI' | 'MOBILE_MONEY' | 'SEPA'>('PIX');

  // Input States for New Payment Methods
  const [paypalEmail, setPaypalEmail] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [idealBank, setIdealBank] = useState('ING Bank');
  const [upiId, setUpiId] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileCarrier, setMobileCarrier] = useState('M-Pesa');
  const [sepaIban, setSepaIban] = useState('');

  // Card Details States
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Processing state helpers
  const [processingStatus, setProcessingStatus] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Subtotals
  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const taxRate = 0.085; // 8.5%
  const shippingFee = subtotal > 100 ? 0 : 9.99; // Free shipping over $100
  const tax = subtotal * taxRate;
  const grandTotal = subtotal + tax + shippingFee;

  // Auto-detect brand based on card prefix matches
  const detectCardBrand = (num: string): string => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(clean)) return 'Mastercard';
    if (/^3[47]/.test(clean)) return 'American Express';
    if (/^6(?:011|5)/.test(clean)) return 'Discover';
    return 'Generic Card';
  };

  const cardBrand = detectCardBrand(cardNumber);

  // Formatting helpers
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  // Step transitions
  const handleProceedToPayment = () => {
    if (!user) return;
    setCurrentStep('PAYMENT');
  };

  const handleValidatePaymentDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress) {
      setPaymentError("Please fill out your delivery/shipping destination.");
      return;
    }

    if (paymentCategory === 'GLOBAL') {
      if (globalMethod === 'CARD') {
        if (!cardNumber || !cardName || !cardExpiry || !cardCvc) {
          setPaymentError("Please fill out all billing and credit card details.");
          return;
        }
        if (cardNumber.replace(/\s/g, '').length < 13) {
          setPaymentError("Invalid credit card credentials number sequence.");
          return;
        }
        if (cardCvc.length < 3) {
          setPaymentError("Invalid security verification CVC.");
          return;
        }
      } else if (globalMethod === 'PAYPAL') {
        if (!paypalEmail || !paypalEmail.includes('@')) {
          setPaymentError("Please provide a valid registered PayPal email address.");
          return;
        }
      }
    } else {
      if (localMethod === 'PIX') {
        if (!pixKey) {
          setPaymentError("Please enter a valid PIX transfer identifier key (CPF, Email, or Telephone).");
          return;
        }
      } else if (localMethod === 'IDEAL') {
        if (!cardName) {
          setPaymentError("Please enter your registered bank account holder name.");
          return;
        }
      } else if (localMethod === 'UPI') {
        if (!upiId || !upiId.includes('@')) {
          setPaymentError("Please enter a valid unified UPI Virtual Private Address (VPA).");
          return;
        }
      } else if (localMethod === 'MOBILE_MONEY') {
        if (!mobilePhone || mobilePhone.length < 6) {
          setPaymentError("Please enter a valid subscriber mobile number.");
          return;
        }
      } else if (localMethod === 'SEPA') {
        if (!sepaIban || sepaIban.length < 10) {
          setPaymentError("Please provide a valid IBAN identifier for SEPA Direct Debit.");
          return;
        }
      }
    }

    setPaymentError(null);
    setCurrentStep('OTP'); // trigger 3D Secure verification step
  };

  // Orchestrate 3D Secure validation and order saving
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== '1234') {
      setPaymentError("3D Secure Authentication Failed! Code is incorrect. (Use '1234' for sandbox authorization)");
      return;
    }

    setPaymentError(null);
    setCurrentStep('PROCESSING');

    // Simulated Gateway Processing latency steps
    const messages = [
      "Establishing Secure SSL Handshake...",
      "Resolving Credit Liquidity Protocols...",
      "Executing Gateway Authorization...",
      "Finalizing Firestore Core Invariant Assets..."
    ];

    for (let i = 0; i < messages.length; i++) {
      setProcessingStatus(messages[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Creating actual Order document and transaction
    const orderId = `order_${Date.now()}`;
    const transactionId = `txn_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const orderItems: OrderItem[] = cartItems.map(item => ({
      productId: item.product.id,
      title: item.product.title,
      price: item.product.price,
      quantity: item.quantity,
      artisanId: item.product.artisanId
    }));

    // Card Brand or payment type identifier
    let computedBrand = 'Generic Card';
    let computedLast4 = 'N/A';
    let paymentMethodTp = '';
    let paymentMethodDet = '';

    if (paymentCategory === 'GLOBAL') {
      if (globalMethod === 'CARD') {
        computedBrand = detectCardBrand(cardNumber);
        computedLast4 = cardNumber.replace(/\s/g, '').slice(-4);
        paymentMethodTp = 'GLOBAL_CARD';
        paymentMethodDet = `Secured credit card ending in •••• ${computedLast4}`;
      } else {
        computedBrand = 'PayPal';
        computedLast4 = paypalEmail.length > 4 ? paypalEmail.slice(-4) : 'PAYPAL';
        paymentMethodTp = 'GLOBAL_PAYPAL';
        paymentMethodDet = `PayPal Sandbox: ${paypalEmail}`;
      }
    } else {
      if (localMethod === 'PIX') {
        computedBrand = 'PIX Brazil';
        computedLast4 = pixKey.length > 4 ? pixKey.slice(-4) : 'PIX';
        paymentMethodTp = 'LOCAL_PIX';
        paymentMethodDet = `PIX Transfer Key: ${pixKey}`;
      } else if (localMethod === 'IDEAL') {
        computedBrand = 'iDEAL NL';
        computedLast4 = 'iDL';
        paymentMethodTp = 'LOCAL_IDEAL';
        paymentMethodDet = `iDEAL Transfer via ${idealBank} (Holder: ${cardName})`;
      } else if (localMethod === 'UPI') {
        computedBrand = 'UPI India';
        computedLast4 = upiId.length > 4 ? upiId.slice(-4) : 'UPI';
        paymentMethodTp = 'LOCAL_UPI';
        paymentMethodDet = `UPI Identifier VPA: ${upiId}`;
      } else if (localMethod === 'MOBILE_MONEY') {
        computedBrand = 'Mobile Money';
        computedLast4 = mobilePhone.length > 4 ? mobilePhone.slice(-4) : 'WLT';
        paymentMethodTp = 'LOCAL_MOBILE_MONEY';
        paymentMethodDet = `${mobileCarrier} Pay wallet: ${mobilePhone}`;
      } else if (localMethod === 'SEPA') {
        computedBrand = 'SEPA Direct';
        computedLast4 = sepaIban.length > 4 ? sepaIban.slice(-4) : 'SEPA';
        paymentMethodTp = 'LOCAL_SEPA';
        paymentMethodDet = `SEPA Direct IBAN: •••• ${computedLast4}`;
      }
    }

    const newOrder: Order = {
      id: orderId,
      buyerId: user!.uid,
      buyerEmail: user!.email || '',
      buyerName: user!.displayName || 'Verified Buyer',
      items: orderItems,
      totalAmount: Number(grandTotal.toFixed(2)),
      paymentStatus: 'succeeded',
      shippingAddress: shippingAddress.trim(),
      cardBrand: computedBrand,
      last4: computedLast4,
      transactionId,
      createdAt: serverTimestamp(),
      paymentMethodType: paymentMethodTp,
      paymentMethodDetails: paymentMethodDet,
    };

    const orderCollectionPath = 'orders';
    const batch = writeBatch(db);

    try {
      // 1. Save order to orders collection
      const orderRef = doc(db, 'orders', orderId);
      batch.set(orderRef, newOrder);

      // 2. Deplete product stocks dynamically
      for (const item of cartItems) {
        const productRef = doc(db, 'products', item.product.id);
        const nextStock = Math.max(0, item.product.stock - item.quantity);
        batch.update(productRef, { stock: nextStock, updatedAt: serverTimestamp() });
      }

      // Commit Batch atomically
      await batch.commit();

      setCompletedOrder(newOrder);
      onClearCart(); // empty real basket
      setCurrentStep('SUCCESS');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, orderCollectionPath);
      } catch (err: any) {
        setPaymentError("Database writes rejected under secure rule constraints. Transaction revoked.");
        setCurrentStep('PAYMENT');
      }
    }
  };

  return (
    <div id="checkout_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div id="checkout_panel" className="relative w-full max-w-4xl rounded-none border border-[#1A1A1A]/15 bg-[#F9F8F6] text-[#1A1A1A] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
        
        {/* Left Hand: Shopping Basket Items (Shown if not on success page) */}
        {currentStep !== 'SUCCESS' && (
          <div className="w-full md:w-5/12 bg-[#F2F1EE] p-6 md:p-8 flex flex-col justify-between border-r border-[#1A1A1A]/10 overflow-y-auto max-h-[40vh] md:max-h-full">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
                <h3 className="text-xs font-sans font-bold uppercase tracking-widest text-[#1A1A1A]">Acquisitions</h3>
                <span className="text-[10px] font-mono text-[#1A1A1A]/50 font-semibold">{cartItems.length} items</span>
              </div>

              {/* Basket list scroll */}
              <div className="mt-4 space-y-4 max-h-[180px] md:max-h-[300px] overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={item.product.id} className="flex gap-3 text-xs border-b border-[#1A1A1A]/5 pb-3">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.title}
                      className="h-12 w-12 rounded-none object-cover bg-white border border-[#1A1A1A]/10 shrink-0"
                    />
                    <div className="flex-1 overflow-hidden">
                      <p className="font-serif italic text-sm text-[#1A1A1A] truncate">{item.product.title}</p>
                      <p className="text-[9px] uppercase tracking-wider text-[#1A1A1A]/50 mt-0.5 font-sans">qty: {item.quantity}</p>
                    </div>
                    <span className="font-serif font-medium text-sm text-[#1A1A1A]">${item.product.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoiced Prices and totals block */}
            <div className="mt-6 pt-4 border-t border-[#1A1A1A]/10 space-y-2.5 text-xs">
              <div className="flex justify-between text-[#1A1A1A]/60">
                <span className="uppercase tracking-wider text-[10px]">Subtotal</span>
                <span className="font-serif">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#1A1A1A]/60">
                <span className="uppercase tracking-wider text-[10px]">Estimated Duty/Tax (8.5%)</span>
                <span className="font-serif">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#1A1A1A]/60">
                <span className="uppercase tracking-wider text-[10px]">Shipping & Transport</span>
                <span className="font-serif font-medium">
                  {shippingFee === 0 ? <span className="text-emerald-850 font-bold uppercase tracking-widest text-[10px]">COMPLIMENTARY</span> : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#1A1A1A]/10 pt-4 text-sm font-bold text-[#1A1A1A]">
                <span className="uppercase tracking-widest text-[11px]">Total Charge</span>
                <span className="font-serif text-xl tracking-tight font-medium">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Right Hand: Interactive step processes */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[60vh] md:max-h-full bg-[#F9F8F6]">
          
          {/* Close control button - sharp */}
          <button
            id="close_checkout_btn"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] text-[#1A1A1A] hover:bg-black hover:text-[#F9F8F6] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* STEP 1: CART CHECKOUT DECISION GATE */}
          {currentStep === 'CART' && (
            <div className="space-y-6">
              <div>
                <span className="text-[9px] font-sans text-amber-905 font-bold uppercase tracking-widest block">SECURED PIPELINE</span>
                <h3 className="text-3xl font-serif italic tracking-tight font-medium text-[#1A1A1A] mt-1">Acquire & Transact</h3>
                <p className="text-xs font-serif text-[#1A1A1A]/60 italic mt-1">Reviewing your bespoke handcraft curation. Authenticating security keyways.</p>
              </div>

              {user ? (
                <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-5 flex gap-3 text-xs leading-relaxed text-[#1A1A1A]">
                  <Shield className="h-5 w-5 text-[#1A1A1A] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block text-[10.5px]">Identified Account Registry</span>
                    <p className="mt-1 font-serif text-xs text-[#1A1A1A]/80 italic">Securely logged in under <b>{user.email}</b>. All item deliveries will file to this record.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-none border border-red-500/20 bg-red-50/50 p-5 flex gap-3 text-xs leading-relaxed text-red-950">
                  <Lock className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block text-[10.5px]">Account Registry Required</span>
                    <p className="mt-1 font-serif text-xs italic">Please sign in via Google Identity at the top navigation row to proceed with certified safe transactions.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] text-[#1A1A1A]/50 font-bold uppercase">
                  <Lock className="h-3.5 w-3.5" />
                  <span>256-Bit Advanced Encryption Active</span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#1A1A1A]/10 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-none border border-[#1A1A1A]/15 px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-colors"
                >
                  Adjust Curation
                </button>
                <button
                  id="checkout_cart_proceed_btn"
                  onClick={handleProceedToPayment}
                  disabled={!user || cartItems.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-none bg-[#1A1A1A] px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-white hover:bg-black transition-all disabled:opacity-50"
                >
                  Proceed to Payment
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PAYMENT METHOD INTEGRATION CHOICE */}
          {currentStep === 'PAYMENT' && (
            <form onSubmit={handleValidatePaymentDetails} className="space-y-5">
              <div>
                <span className="text-[9px] font-sans text-[#1A1A1A]/50 font-semibold uppercase tracking-widest block">PAYMENT CHANNELS</span>
                <h3 className="text-2xl font-serif italic tracking-tight font-medium text-[#1A1A1A] mt-0.5">Choose Financial Service</h3>
              </div>

              {/* High Contrast Tabs for Category Selection */}
              <div className="flex border-b border-[#1A1A1A]/10">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentCategory('GLOBAL');
                    setPaymentError(null);
                  }}
                  className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${
                    paymentCategory === 'GLOBAL'
                      ? 'border-[#1A1A1A] text-[#1A1A1A] font-extrabold'
                      : 'border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70'
                  }`}
                >
                  Global Cards & Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentCategory('LOCAL');
                    setPaymentError(null);
                  }}
                  className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${
                    paymentCategory === 'LOCAL'
                      ? 'border-[#1A1A1A] text-[#1A1A1A] font-extrabold'
                      : 'border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70'
                  }`}
                >
                  Regional & Local Schemes
                </button>
              </div>

              {/* Sub-Methods selection pills */}
              {paymentCategory === 'GLOBAL' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalMethod('CARD');
                      setPaymentError(null);
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border text-[10px] uppercase font-bold tracking-wider transition-all rounded-none ${
                      globalMethod === 'CARD'
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-sm'
                        : 'border-[#1A1A1A]/15 bg-transparent text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Credit/Debit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalMethod('PAYPAL');
                      setPaymentError(null);
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border text-[10px] uppercase font-bold tracking-wider transition-all rounded-none ${
                      globalMethod === 'PAYPAL'
                        ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-sm'
                        : 'border-[#1A1A1A]/15 bg-transparent text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5'
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    PayPal Secure
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'PIX', label: 'PIX Brasil', icon: QrCode },
                    { id: 'IDEAL', label: 'iDEAL NL', icon: Building },
                    { id: 'UPI', label: 'UPI India', icon: QrCode },
                    { id: 'SEPA', label: 'SEPA Debit', icon: Coins },
                    { id: 'MOBILE_MONEY', label: 'Mobile Wallet', icon: Smartphone }
                  ].map((m) => {
                    const IconComp = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setLocalMethod(m.id as any);
                          setPaymentError(null);
                        }}
                        className={`flex flex-col items-center justify-center p-2 border aspect-video transition-all rounded-none ${
                          localMethod === m.id
                            ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                            : 'border-[#1A1A1A]/10 bg-[#F2F1EE]/40 text-[#1A1A1A]/60 hover:border-[#1A1A1A]/20'
                        }`}
                      >
                        <IconComp className="h-4 w-4 mb-1" />
                        <span className="text-[8px] font-sans font-bold tracking-wider uppercase text-center mt-0.5">{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* CARD DETAILS VISUALIZATION & WRAPPER */}
              {paymentCategory === 'GLOBAL' && globalMethod === 'CARD' && (
                <div className="space-y-4">
                  {/* Physical credit card visualization - Editorial Sleek Slate Card */}
                  <div className="relative h-44 w-full rounded-none border border-[#1A1A1A]/30 bg-[#1A1A1A] p-6 flex flex-col justify-between text-[#F9F8F6] shadow-sm overflow-hidden animate-fade-in">
                    <div className="absolute top-0 right-0 h-40 w-40 bg-[#F9F8F6]/5 rounded-full -mr-10 -mt-10" />
                    <div className="flex justify-between items-center z-10">
                      <div className="flex h-9 w-12 flex-col justify-between rounded-none bg-[#F9F8F6]/10 px-2 py-1.5 border border-[#F9F8F6]/10">
                        <div className="h-2.5 w-4 bg-[#F9F8F6]/30 rounded-sm" />
                      </div>
                      <span className="text-[9px] font-mono font-bold tracking-widest text-[#F9F8F6]/70">{cardBrand.toUpperCase()}</span>
                    </div>

                    <div className="z-10">
                      <span className="text-sm font-mono tracking-widest block text-[#F9F8F6]/90">
                        {cardNumber || '•••• •••• •••• ••••'}
                      </span>
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <span className="text-[7px] tracking-widest text-[#F9F8F6]/40 font-mono block uppercase">CARD PATRON</span>
                          <span className="text-[10px] font-sans uppercase tracking-wider block truncate max-w-[200px]">{cardName || 'YOUR FULL NAME'}</span>
                        </div>
                        <div>
                          <span className="text-[7px] tracking-widest text-[#F9F8F6]/40 font-mono block uppercase">EXPIRY</span>
                          <span className="text-[10px] font-mono block">{cardExpiry || 'MM/YY'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input forms styled with Underlines for Editorial Look */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Card Number</label>
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="4000 1234 5678 9010"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        placeholder="Jordan Miller"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] uppercase tracking-wider"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Expiration Date</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Security Code (CVC)</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="***"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-widest"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PAYPAL FIELDS */}
              {paymentCategory === 'GLOBAL' && globalMethod === 'PAYPAL' && (
                <div className="space-y-4 animate-fade-in">
                  {/* PayPal Visual Badge */}
                  <div className="relative h-28 w-full rounded-none border border-blue-900/10 bg-blue-50/50 p-5 flex flex-col justify-between text-[#1A1A1A] overflow-hidden">
                    <div className="flex justify-between items-center z-10">
                      <span className="text-xs font-mono font-bold tracking-widest text-blue-900 uppercase">PayPal Sandbox Vault</span>
                      <Shield className="h-4 w-4 text-blue-800" />
                    </div>
                    <p className="text-[10px] text-blue-950 italic font-serif z-10 leading-relaxed max-w-md">
                      Secure payment and auto-checkout with 1-click subscription management integrated.
                    </p>
                  </div>

                  <div>
                    <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">PayPal Account Email</label>
                    <input
                      type="email"
                      placeholder="patron@sandbox.paypal.com"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"
                    />
                  </div>
                </div>
              )}

              {/* LOCAL METHODS */}
              {paymentCategory === 'LOCAL' && (
                <div className="space-y-4 animate-fade-in">
                  {/* PIX BRASIL */}
                  {localMethod === 'PIX' && (
                    <div className="space-y-4 font-sans">
                      <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-4 flex gap-3 text-xs text-[#1A1A1A]">
                        <QrCode className="h-5 w-5 text-emerald-800 shrink-0" />
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[10px]">PIX Instant Bank Settlement</span>
                          <p className="mt-1 font-serif text-[11px] italic text-[#1A1A1A]/70">
                            Zero fees, immediate execution. Backed by Banco Central do Brasil.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">PIX key (CPF, CNPJ, Email or Phone)</label>
                        <input
                          type="text"
                          placeholder="client-identifier@pix.com"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-wider"
                        />
                      </div>
                    </div>
                  )}

                  {/* iDEAL NETHERLANDS */}
                  {localMethod === 'IDEAL' && (
                    <div className="space-y-4">
                      <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-4 flex gap-3 text-xs text-[#1A1A1A]">
                        <Building className="h-5 w-5 text-indigo-900 shrink-0" />
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[10px]">E-Commerce Banking Protocols</span>
                          <p className="mt-1 font-serif text-[11px] italic text-[#1A1A1A]/70">
                            Authorized directly via your registered Dutch online credentials dashboard.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            placeholder="A. van de Berg"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] uppercase tracking-wider"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Select Bank Issuer</label>
                          <select
                            value={idealBank}
                            onChange={(e) => setIdealBank(e.target.value)}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 bg-transparent pb-1.5 text-xs outline-none focus:border-[#1A1A1A]"
                          >
                            <option value="ING Bank">ING Bank</option>
                            <option value="Rabobank">Rabobank</option>
                            <option value="ABN AMRO">ABN AMRO</option>
                            <option value="Triodos Bank">Triodos Bank</option>
                            <option value="Bunq">Bunq</option>
                            <option value="SNS Bank">SNS Bank</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UPI INDIA */}
                  {localMethod === 'UPI' && (
                    <div className="space-y-4">
                      <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-4 flex gap-3 text-xs text-[#1A1A1A]">
                        <QrCode className="h-5 w-5 text-blue-900 shrink-0" />
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[10px]">Unified Payments Interface</span>
                          <p className="mt-1 font-serif text-[11px] italic text-[#1A1A1A]/70">
                            Direct, instant bank transfer from your mobile UPI client under NPCI protocols.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">UPI Address (VPA)</label>
                        <input
                          type="text"
                          placeholder="patron@okaxis"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-wide"
                        />
                      </div>
                    </div>
                  )}

                  {/* SEPA DIRECT DEBIT */}
                  {localMethod === 'SEPA' && (
                    <div className="space-y-4">
                      <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-4 flex gap-3 text-xs text-[#1A1A1A]">
                        <Coins className="h-5 w-5 text-emerald-950 shrink-0" />
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[10px]">SEPA Direct Debit Mandate</span>
                          <p className="mt-1 font-serif text-[11px] italic text-[#1A1A1A]/70">
                            Secure Eurozone debit infrastructure. Certified against IBAN spoofing protection.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            placeholder="Jean Dupont"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] uppercase tracking-wider"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">IBAN Number</label>
                          <input
                            type="text"
                            placeholder="DE89 3704 0044 0532 0130 00"
                            value={sepaIban}
                            onChange={(e) => setSepaIban(e.target.value.toUpperCase())}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono tracking-widest"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MOBILE MONEY AFRICA */}
                  {localMethod === 'MOBILE_MONEY' && (
                    <div className="space-y-4">
                      <div className="rounded-none border border-[#1A1A1A]/10 bg-[#F2F1EE] p-4 flex gap-3 text-xs text-[#1A1A1A]">
                        <Smartphone className="h-5 w-5 text-amber-800 shrink-0" />
                        <div>
                          <span className="font-bold uppercase tracking-wider block text-[10px]">Mobile Wallets & Microcredit</span>
                          <p className="mt-1 font-serif text-[11px] italic text-[#1A1A1A]/70">
                            Authorized immediately by receiving prompt requests on your registered SIM device.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Provider Wallet</label>
                          <select
                            value={mobileCarrier}
                            onChange={(e) => setMobileCarrier(e.target.value)}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 bg-transparent pb-1.5 text-xs outline-none focus:border-[#1A1A1A]"
                          >
                            <option value="M-Pesa">M-Pesa (Safaricom)</option>
                            <option value="MTN Mobile Money">MTN MoMo</option>
                            <option value="Airtel Money">Airtel Money</option>
                            <option value="Orange Money">Orange Money</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Mobile Phone Number</label>
                          <input
                            type="tel"
                            placeholder="+254 712 345678"
                            value={mobilePhone}
                            onChange={(e) => setMobilePhone(e.target.value)}
                            className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shipping Destination common field */}
              <div className="space-y-2.5">
                <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block">Shipping Destination</label>
                <div className="relative">
                  <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1A1A1A]/50" />
                  <input
                    type="text"
                    required
                    placeholder="1234 Artisan Grove Way, Seattle WA 98101"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pl-6 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] tracking-wide"
                  />
                </div>
              </div>

              {paymentError && (
                <p className="text-[10px] font-bold text-red-700 bg-red-50/70 px-4 py-2 rounded-none border border-red-200/50 flex items-center gap-1.5 uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5" />
                  {paymentError}
                </p>
              )}

              <div className="pt-4 border-t border-[#1A1A1A]/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('CART')}
                  className="rounded-none border border-[#1A1A1A]/15 px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5"
                >
                  Back
                </button>
                <button
                  type="submit"
                  id="checkout_validate_card_btn"
                  className="inline-flex items-center gap-1.5 rounded-none bg-[#1A1A1A] px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-white hover:bg-black transition-all"
                >
                  Request Verification OTP
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: 3D SECURE INTERCEPT OVERLAY (OTP) */}
          {currentStep === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none border border-[#1A1A1A]/20 bg-[#F2F1EE] text-[#1A1A1A]">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif italic tracking-tight font-medium text-[#1A1A1A]">3D Secure Verification</h3>
                <p className="text-xs font-serif text-[#1A1A1A]/60 italic max-w-sm mx-auto">
                  To authenticate safe credit ownership, a simulated authorization passkey has been routed.
                </p>
              </div>

              <div className="rounded-none bg-[#F2F1EE] border border-[#1A1A1A]/10 p-4 text-center text-[10px] uppercase tracking-widest text-[#1A1A1A]/80">
                <span>Passkey sequence is <b>1234</b>. Input code to proceed.</span>
              </div>

              <div className="max-w-[160px] mx-auto text-center">
                <label className="text-[9px] font-sans text-[#1A1A1A]/50 uppercase tracking-widest block mb-1">Enter OTP passcode</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="1234"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="text-center w-full rounded-none border-b border-[#1A1A1A]/20 py-2 text-xl font-bold outline-none focus:border-[#1A1A1A] font-mono tracking-[0.4em]"
                />
              </div>

              {paymentError && (
                <p className="text-[10px] font-bold text-red-700 text-center uppercase tracking-wider">{paymentError}</p>
              )}

              <div className="pt-6 border-t border-[#1A1A1A]/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('PAYMENT')}
                  className="rounded-none border border-[#1A1A1A]/15 px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="checkout_otp_submit_btn"
                  className="rounded-none bg-[#1A1A1A] text-white hover:bg-black px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold shadow-none transition-all"
                >
                  Authorize Bill
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: NETWORK GATEWAY PROCESSING SPINNER */}
          {currentStep === 'PROCESSING' && (
            <div className="text-center py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 text-[#1A1A1A] animate-spin" />
              <div className="space-y-1">
                <h4 className="text-xs font-sans font-bold uppercase tracking-widest text-[#1A1A1A]">Vault Authorization</h4>
                <p className="text-[10px] text-[#1A1A1A]/60 font-mono tracking-wider mt-2 bg-[#F2F1EE] px-4 py-1.5 border border-[#1A1A1A]/5">{processingStatus}</p>
              </div>
            </div>
          )}

          {/* STEP 5: BEAUTIFUL PRINTER FRIENDLY RECEIPT */}
          {currentStep === 'SUCCESS' && completedOrder && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none bg-emerald-50 text-emerald-800 border border-emerald-250/20">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-serif italic tracking-tight font-medium text-[#1A1A1A]">Transaction Complete</h3>
                <p className="text-xs font-serif text-[#1A1A1A]/60 italic">Your handcrafted acquisitions are secured. Invoice records have compiled below.</p>
              </div>

              {/* Physical Receipt styling - exquisite vintage receipt */}
              <div className="rounded-none border border-dashed border-[#1A1A1A]/20 bg-[#F2F1EE]/60 p-6 space-y-4 font-mono text-[11px] text-[#1A1A1A]">
                <div className="flex justify-between border-b border-[#1A1A1A]/10 pb-3 text-xs font-bold font-sans tracking-wide">
                  <span className="uppercase tracking-wider">GUILD INVOICE ASSOC.</span>
                  <span>{completedOrder.transactionId}</span>
                </div>

                <div className="space-y-1 text-[#1A1A1A]/80">
                  <div className="flex justify-between">
                    <span>RECORD ID:</span>
                    <span className="font-semibold text-right">{completedOrder.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE RECORD:</span>
                    <span className="font-semibold">{new Date(completedOrder.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PATRON EMAIL:</span>
                    <span className="font-semibold truncate max-w-[200px]">{completedOrder.buyerEmail}</span>
                  </div>
                  <div className="flex justify-between text-left">
                    <span>PAY METHOD:</span>
                    <span className="font-semibold uppercase text-right">{completedOrder.paymentMethodType?.replace('LOCAL_', '').replace('GLOBAL_', '').replace('_', ' ') || 'GLOBAL CARD'}</span>
                  </div>
                  <div className="flex justify-between text-left">
                    <span>PAY DETAILS:</span>
                    <span className="font-semibold text-right truncate max-w-[210px]">{completedOrder.paymentMethodDetails || `${completedOrder.cardBrand} ••• ${completedOrder.last4}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SHIPPING COORD:</span>
                    <span className="font-semibold truncate max-w-[170px]">{completedOrder.shippingAddress}</span>
                  </div>
                </div>

                <div className="border-t border-[#1A1A1A]/10 pt-3 space-y-2">
                  <span className="font-bold font-sans tracking-wide block text-[10px] uppercase">CURATIONS ACCOUNTED:</span>
                  {completedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[#1A1A1A]/70">
                      <span>{it.title.slice(0, 32)} x{it.quantity}</span>
                      <span>${it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#1A1A1A]/10 pt-3 text-right text-xs font-bold font-sans">
                  <div className="uppercase tracking-widest text-[#1A1A1A]">TOTAL CHARGE SECURED: ${completedOrder.totalAmount}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center text-[9px] text-emerald-800 font-bold uppercase tracking-widest font-sans">
                <Sparkles className="h-3 w-3" />
                <span>double-signature firestore registry active</span>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-none bg-[#1A1A1A] px-8 py-3 text-[9px] uppercase tracking-widest font-bold text-white hover:bg-black transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
