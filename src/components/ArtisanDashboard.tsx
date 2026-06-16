/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Store, Plus, Trash2, Edit3, DollarSign, Package, BarChart2, ShieldCheck, ArrowLeft, Image, MapPin, Sparkles, AlertTriangle, X, Printer } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Artisan, Product, Order } from '../types';

interface ArtisanDashboardProps {
  user: FirebaseUser;
  onClose: () => void;
  allProducts: Product[];
  allOrders: Order[];
  onRefreshData: () => void;
}

export default function ArtisanDashboard({
  user,
  onClose,
  allProducts,
  allOrders,
  onRefreshData,
}: ArtisanDashboardProps) {
  // Artisan Profile State
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Setup Profile Form
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [artisanCategory, setArtisanCategory] = useState('Pottery');
  const [profileImage, setProfileImage] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200');

  // Product CRUD Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Printing state for receipt generation
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Product Form States
  const [productTitle, setProductTitle] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('35');
  const [productStock, setProductStock] = useState('10');
  const [productCategory, setProductCategory] = useState('Pottery');
  const [productImageUrl, setProductImageUrl] = useState('https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600');
  const [productLocation, setProductLocation] = useState('');

  // Status Alerts
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [productErrorMessage, setProductErrorMessage] = useState<string | null>(null);

  const categories = ["Pottery", "Textiles", "Woodwork", "Jewelry", "Skincare", "Culinary", "Candle Making", "Weaving"];

  // Fetch or setup Artisan Profile
  const fetchArtisanProfile = async () => {
    setIsLoadingProfile(true);
    try {
      // Look up profile by doc ID matching actual user UID, as governed by firestore rules
      const docRef = doc(db, 'artisans', user.uid);
      const docSnap = await getDocs(query(collection(db, 'artisans'), where('id', '==', user.uid)));
      
      if (!docSnap.empty) {
        const artData = docSnap.docs[0].data() as Artisan;
        setArtisan(artData);
        // Pre-fill forms
        setBusinessName(artData.businessName);
        setBio(artData.bio);
        setCity(artData.city);
        setArtisanCategory(artData.category);
        setProfileImage(artData.profileImage);
      } else {
        setArtisan(null);
        // fill with user variables
        setBusinessName(user.displayName || '');
        setCity('Seattle');
      }
    } catch (error) {
      console.error("Error loading artisan profile details:", error);
      handleFirestoreError(error, OperationType.GET, 'artisans');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchArtisanProfile();
  }, [user.uid]);

  // Synchronous page printing reset handler
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingOrder(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrintReceipt = (order: Order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Load calculations
  const sellerProducts = allProducts.filter(p => p.ownerId === user.uid);
  const sellerOrders = allOrders.filter(o => o.items.some(item => item.artisanId === user.uid));

  // Compute metrics
  const totalEarnings = sellerOrders.reduce((sum, order) => {
    // Sum only the items that belong to *this* artisan in the order
    const artisanItemsTotal = order.items
      .filter(it => it.artisanId === user.uid)
      .reduce((acc, it) => acc + (it.price * it.quantity), 0);
    return sum + artisanItemsTotal;
  }, 0);

  const totalUnitsSold = sellerOrders.reduce((sum, order) => {
    const artisanUnits = order.items
      .filter(it => it.artisanId === user.uid)
      .reduce((acc, it) => acc + it.quantity, 0);
    return sum + artisanUnits;
  }, 0);

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const artisanPath = `artisans`;
    const finalProfile: Artisan = {
      id: user.uid,
      businessName: businessName.trim(),
      bio: bio.trim(),
      city: city.trim(),
      category: artisanCategory,
      profileImage: profileImage.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      ownerId: user.uid,
      createdAt: artisan ? artisan.createdAt : serverTimestamp()
    };

    try {
      // Save profile with doc ID precisely equal to user UID
      await setDoc(doc(db, 'artisans', user.uid), finalProfile);
      setArtisan(finalProfile);
      setProfileMessage({ type: 'success', text: 'Brand profile verified and saved successfully!' });
      onRefreshData();
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, artisanPath);
      } catch (err: any) {
        setProfileMessage({ type: 'error', text: 'Authentication restrictions holds. Ensure your email is verified.' });
      }
    }
  };

  // Product Actions: Add or Edit
  const openProductForm = (product: Product | null) => {
    if (product) {
      setEditingProduct(product);
      setProductTitle(product.title);
      setProductDesc(product.description);
      setProductPrice(String(product.price));
      setProductStock(String(product.stock));
      setProductCategory(product.category);
      setProductImageUrl(product.imageUrl);
      setProductLocation(product.location);
    } else {
      setEditingProduct(null);
      setProductTitle('');
      setProductDesc('');
      setProductPrice('35');
      setProductStock('10');
      setProductCategory(artisan?.category || 'Pottery');
      setProductImageUrl('https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600');
      setProductLocation(artisan?.city || 'Seattle');
    }
    setProductErrorMessage(null);
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductErrorMessage(null);

    if (Number(productPrice) <= 0 || Number(productStock) < 0) {
      setProductErrorMessage("Price and stock ranges must be valid positive values.");
      return;
    }

    const productPath = 'products';
    const isNew = !editingProduct;
    const prodId = isNew ? `prod_${Date.now()}` : editingProduct.id;

    const currentProductData = {
      id: prodId,
      artisanId: user.uid,
      title: productTitle.trim(),
      description: productDesc.trim(),
      price: Number(productPrice),
      stock: Math.round(Number(productStock)),
      category: productCategory,
      imageUrl: productImageUrl.trim(),
      location: productLocation.trim(),
      ownerId: user.uid,
      createdAt: isNew ? serverTimestamp() : editingProduct.createdAt,
      updatedAt: serverTimestamp(),
    };

    try {
      const productRef = doc(db, 'products', prodId);
      if (isNew) {
        await setDoc(productRef, currentProductData);
      } else {
        await updateDoc(productRef, {
          title: productTitle.trim(),
          description: productDesc.trim(),
          price: Number(productPrice),
          stock: Math.round(Number(productStock)),
          category: productCategory,
          imageUrl: productImageUrl.trim(),
          location: productLocation.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      setIsProductModalOpen(false);
      onRefreshData();
    } catch (error) {
      try {
        handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, productPath);
      } catch (err: any) {
        setProductErrorMessage("Security Rules Denied! Verify and write strictly bounded, authentic variables only.");
      }
    }
  };

  // Product Delete
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to retract this handcrafted listing?")) return;

    const productPath = 'products';
    try {
      await deleteDoc(doc(db, 'products', productId));
      onRefreshData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, productPath);
    }
  };

  return (
    <>
      <div id="seller_dashboard_view" className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] py-12 print:hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1A1A1A]/10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-none bg-[#F9F8F6] text-[#1A1A1A] shadow-none border border-[#1A1A1A]/10 hover:bg-[#1A1A1A] hover:text-[#F9F8F6] transition-colors"
              aria-label="Back to main market"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-2xl font-serif italic font-medium text-[#1A1A1A] tracking-tight flex items-center gap-2">
                <Store className="h-5 w-5 text-[#1A1A1A]" />
                Artisan Studio Dashboard
              </h2>
              <p className="text-[10px] font-sans uppercase tracking-widest text-[#1A1A1A]/50 mt-0.5">Design your brand and manage local goods list</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 border border-emerald-150 rounded-none uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>AUTHENTICATED CLIENT SSL ACTIVE</span>
          </div>
        </div>

        {isLoadingProfile ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
            <BarChart2 className="h-7 w-7 text-[#1A1A1A]/60 animate-pulse" />
            <span className="text-[10px] font-sans uppercase tracking-widest text-[#1A1A1A]/50">Authenticating profile ledger...</span>
          </div>
        ) : !artisan ? (
          /* UNREGISTERED WRITER CARD: USER MUST DEFINE BRAND PROFILE FIRST */
          <div id="profile_setup_prompt" className="max-w-xl mx-auto my-12 bg-[#F2F1EE] rounded-none border border-[#1A1A1A]/15 p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-2">
              <Store className="h-10 w-10 mx-auto text-[#1A1A1A]" />
              <h3 className="text-xl font-serif italic font-medium text-[#1A1A1A]">Set Up Your Artisan Brand</h3>
              <p className="text-xs font-serif text-[#1A1A1A]/60 italic">Creating your profile registers you as a verified Guild seller item.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
              <div>
                <label className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Business Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clay & Oak Goods"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-wider text-xs outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">City Studio Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Seattle"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-wider text-xs outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Craft Category</label>
                  <select
                    value={artisanCategory}
                    onChange={(e) => setArtisanCategory(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-widest text-xs outline-none focus:border-[#1A1A1A] cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c} className="bg-[#F2F1EE] text-[#1A1A1A]">{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Artist Bio Story (Tell who you are)</label>
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  placeholder="Tell our patrons about your handcrafted passion, organic materials, or special care rules..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent font-serif italic text-xs leading-relaxed outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="text-[9px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Brand Picture URL (Unsplash or direct image link)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={profileImage}
                  onChange={(e) => setProfileImage(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs outline-none focus:border-[#1A1A1A]"
                />
              </div>

              {profileMessage && (
                <div className={`p-4 rounded-none text-xs font-semibold uppercase tracking-wider ${profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-850 border border-emerald-150' : 'bg-red-50 text-red-800 border border-red-150'}`}>
                  {profileMessage.text}
                </div>
              )}

              <button
                type="submit"
                id="create_artisan_profile_btn"
                className="w-full rounded-none bg-[#1A1A1A] hover:bg-black py-3 text-[10px] uppercase tracking-widest font-bold text-white shadow-none transition-colors"
              >
                Register Brand Profile
              </button>
            </form>
          </div>
        ) : (
          /* VERIFIED ARTISAN PROFILE MANAGEMENT CONSOLE */
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMN 1: Profile stats & bio customizer */}
            <div className="space-y-6">
              
              {/* Stats bento layout */}
              <div className="bg-[#F2F1EE] rounded-none border border-[#1A1A1A]/10 p-6 shadow-none space-y-4">
                <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest font-sans border-b border-[#1A1A1A]/5 pb-2">Performance Ledgers</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9F8F6] p-4 rounded-none border border-[#1A1A1A]/10">
                    <DollarSign className="h-4 w-4 text-[#1A1A1A]" />
                    <span className="text-[8px] font-sans font-bold text-[#1A1A1A]/50 block mt-2 tracking-wider">EARNED CAPITAL</span>
                    <span className="text-lg font-serif font-medium text-[#1A1A1A]">${totalEarnings.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-[#F9F8F6] p-4 rounded-none border border-[#1A1A1A]/10">
                    <Package className="h-4 w-4 text-[#1A1A1A]" />
                    <span className="text-[8px] font-sans font-bold text-[#1A1A1A]/50 block mt-2 tracking-wider">UNITS DELIVERED</span>
                    <span className="text-lg font-serif font-medium text-[#1A1A1A]">{totalUnitsSold} qty</span>
                  </div>
                </div>

                <div className="flex gap-2 text-[10px] text-[#1A1A1A]/65 leading-relaxed border-t border-[#1A1A1A]/10 pt-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-850 shrink-0" />
                  <span>Payments deposited securely in zero-trust ledger assets.</span>
                </div>
              </div>

              {/* Brand Editing panel */}
              <div className="bg-[#F2F1EE] rounded-none border border-[#1A1A1A]/10 p-6 shadow-none space-y-4">
                <div className="flex justify-between items-center border-b border-[#1A1A1A]/10 pb-3">
                  <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest font-sans">Brand settings</h3>
                  <span className="text-[8px] rounded-none bg-[#1A1A1A] text-white tracking-widest font-bold px-2 py-0.5">EDITABLE</span>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div>
                    <label className="text-[9px] font-bold font-sans text-[#1A1A1A]/50 uppercase block mb-1">Business Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Brand Name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-wider text-xs outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold font-sans text-[#1A1A1A]/50 uppercase block mb-1">City</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Seattle"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-wider text-xs outline-none focus:border-[#1A1A1A]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold font-sans text-[#1A1A1A]/50 uppercase block mb-1">Category</label>
                      <select
                        value={artisanCategory}
                        onChange={(e) => setArtisanCategory(e.target.value)}
                        className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent uppercase tracking-widest text-xs outline-none focus:border-[#1A1A1A] cursor-pointer"
                      >
                        {categories.map(c => <option key={c} value={c} className="bg-[#F2F1EE] text-[#1A1A1A]">{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold font-sans text-[#1A1A1A]/50 uppercase block mb-1">Brand Picture URL</label>
                    <input
                      type="url"
                      placeholder="Brand logo picture URL"
                      value={profileImage}
                      onChange={(e) => setProfileImage(e.target.value)}
                      className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold font-sans text-[#1A1A1A]/50 uppercase block mb-1">Artist Bio Story</label>
                    <textarea
                      required
                      rows={3}
                      maxLength={1000}
                      placeholder="Artisan bio details..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent font-serif italic text-xs leading-relaxed outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  {profileMessage && (
                    <div className="text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-850 border border-emerald-150 font-semibold px-3 py-2 rounded-none text-center">
                      {profileMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full rounded-none bg-[#1A1A1A] text-white font-bold py-2.5 text-[9px] uppercase tracking-widest hover:bg-black transition-colors"
                  >
                    Update Brand Profile
                  </button>
                </form>
              </div>

            </div>

            {/* COLUMN 2 & 3: Active products and order list */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Product Listings Panel */}
              <div className="bg-[#F2F1EE] rounded-none border border-[#1A1A1A]/10 p-6 shadow-none">
                <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-4">
                  <div>
                    <h3 className="text-xl font-serif italic font-medium text-[#1A1A1A] tracking-tight">Handcrafted Listings ({sellerProducts.length})</h3>
                    <p className="text-[10px] text-[#1A1A1A]/50 font-sans uppercase tracking-wider mt-0.5">Public styles shown on the craft marketplace</p>
                  </div>
                  <button
                    id="add_new_product_btn"
                    onClick={() => openProductForm(null)}
                    className="inline-flex items-center gap-1.5 rounded-none bg-[#1A1A1A] hover:bg-black font-semibold px-5 py-2.5 text-[9px] uppercase tracking-widest text-white shadow-none transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    List Style
                  </button>
                </div>

                {/* Seller product list */}
                {sellerProducts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#1A1A1A]/50 italic font-serif">
                    <Package className="h-8 w-8 mx-auto text-[#1A1A1A]/30 block mb-2" />
                    No products posted under your store profile yet.
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-[#1A1A1A]/10">
                    {sellerProducts.map(prod => (
                      <div key={prod.id} className="flex gap-4 py-3.5 items-center justify-between">
                        <div className="flex gap-3 items-center">
                          <img
                            src={prod.imageUrl}
                            alt={prod.title}
                            className="h-11 w-11 rounded-none object-cover bg-gray-50 border border-[#1A1A1A]/10"
                          />
                          <div>
                            <span className="font-serif italic font-medium text-[#1A1A1A] text-sm line-clamp-1">{prod.title}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-[#1A1A1A] bg-[#F9F8F6] px-1.5 py-0.5 border border-[#1A1A1A]/5 font-sans font-bold">${prod.price}</span>
                              <span className={`text-[9px] font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 border ${prod.stock === 0 ? 'bg-red-50 border-red-200/50 text-red-700' : 'bg-[#F9F8F6] border-[#1A1A1A]/5 text-[#1A1A1A]/60'}`}>
                                Stock: {prod.stock}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            id={`edit_listing_btn_${prod.id}`}
                            onClick={() => openProductForm(prod)}
                            className="h-8 w-8 flex items-center justify-center rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] text-[#1A1A1A]/70 hover:bg-black hover:text-[#F9F8F6] hover:border-black transition-colors"
                            aria-label="Edit item"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            id={`delete_listing_btn_${prod.id}`}
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-none border border-red-200/50 bg-red-50 text-red-700 hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors"
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incoming Customer Orders Panel */}
              <div className="bg-[#F2F1EE] rounded-none border border-[#1A1A1A]/10 p-6 shadow-none">
                <div className="border-b border-[#1A1A1A]/10 pb-3">
                  <h3 className="text-xl font-serif italic font-medium text-[#1A1A1A] tracking-tight">Incoming Patron Orders ({sellerOrders.length})</h3>
                  <p className="text-[10px] text-[#1A1A1A]/50 font-sans uppercase tracking-wider mt-0.5">Orders placed by customers for your creations</p>
                </div>

                {sellerOrders.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#1A1A1A]/50 italic font-serif">
                    <DollarSign className="h-8 w-8 mx-auto text-[#1A1A1A]/30 block mb-2" />
                    No orders have been received yet. Shared app URL to bring in sales!
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-[#1A1A1A]/10">
                    {sellerOrders.map(order => (
                      <div key={order.id} className="py-4 text-xs space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="font-serif italic text-sm font-medium text-[#1A1A1A] block">{order.buyerName}</span>
                            <span className="text-[9px] text-[#1A1A1A]/50 font-mono">Invoice: {order.id} | TXN: {order.transactionId}</span>
                          </div>
                          <span className="font-serif font-semibold text-emerald-850">
                            Deposited ${order.items
                              .filter(it => it.artisanId === user.uid)
                              .reduce((total, it) => total + (it.price * it.quantity), 0)
                              .toFixed(2)}
                          </span>
                        </div>

                        <div className="pl-4 border-l border-[#1A1A1A]/20 space-y-1 py-1 text-[11px] text-[#1A1A1A]/70 font-mono">
                          {order.items
                            .filter(it => it.artisanId === user.uid)
                            .map((it, idx) => (
                              <div key={idx}>
                                {it.title} x{it.quantity} - ${it.price * it.quantity}
                              </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-[#1A1A1A]/5 mt-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A1A]/70">
                            <MapPin className="h-3.5 w-3.5 text-[#1A1A1A]/50" />
                            <span>Deliver to: <b>{order.shippingAddress}</b></span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(order)}
                            className="flex items-center gap-1.5 self-start sm:self-auto rounded-none border border-[#1A1A1A]/15 bg-[#F9F8F6] px-3 py-1 text-[9px] uppercase tracking-wider font-semibold text-[#1A1A1A] hover:bg-black hover:text-[#F9F8F6] hover:border-black transition-all shadow-none"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* FORM MODAL: LIST OR EDIT PRODUCT DETAILS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-xl rounded-none border border-[#1A1A1A]/15 bg-[#F9F8F6] text-[#1A1A1A] p-6 md:p-8 overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setIsProductModalOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] text-[#1A1A1A] hover:bg-black hover:text-[#F9F8F6] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <span className="text-[9px] font-sans font-bold text-[#1A1A1A]/50 uppercase block tracking-widest">SECURED LISTING</span>
              <h4 className="text-3xl font-serif italic font-medium text-[#1A1A1A] mt-1">
                {editingProduct ? 'Edit Craft Listing' : 'List Handcrafted Style'}
              </h4>
            </div>

            <form onSubmit={handleProductSubmit} className="mt-6 space-y-4 text-xs font-sans">
              <div>
                <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cedar-Fired Espresso Cup"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Price ($ USD)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    placeholder="35"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs font-mono tracking-wider outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Available Stock Qty</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={1000}
                    placeholder="10"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs font-mono tracking-wider outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Category</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full bg-transparent rounded-none border-b border-[#1A1A1A]/20 pb-1.5 text-xs outline-none focus:border-[#1A1A1A] cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c} className="bg-[#F9F8F6] text-[#1A1A1A]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Source City Studio</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Seattle"
                    value={productLocation}
                    onChange={(e) => setProductLocation(e.target.value)}
                    className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Detailed Description STORY</label>
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  placeholder="Tell our buyers about the crafting process, organic materials utilized, or special care rules..."
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent font-serif italic text-xs leading-relaxed outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#1A1A1A]/50 block mb-1">Display Image URL (Unsplash or direct image link)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={productImageUrl}
                  onChange={(e) => setProductImageUrl(e.target.value)}
                  className="w-full rounded-none border-b border-[#1A1A1A]/20 pb-1.5 bg-transparent text-xs outline-none focus:border-[#1A1A1A]"
                />
              </div>

              {productErrorMessage && (
                <div className="p-3 bg-red-50 text-red-900 border border-red-150 rounded-none leading-relaxed font-bold flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{productErrorMessage}</span>
                </div>
              )}

              <div className="pt-4 border-t border-[#1A1A1A]/10 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-none border border-[#1A1A1A]/15 px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#1A1A1A] hover:bg-[#1A1A1A]/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-none bg-[#1A1A1A] hover:bg-black px-6 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-white transition-colors"
                >
                  {editingProduct ? 'Save Changes' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>

    {/* EXCLUSIVE TRANSACTION PRINT RECEIPT - ONLY VISIBLE DURING BROWSER printing */}
    {printingOrder && (
      <div className="hidden print:block bg-white text-black p-12 font-mono text-[11px] leading-relaxed max-w-2xl mx-auto border-4 border-black" style={{ color: '#000', backgroundColor: '#fff' }}>
        <div className="text-center border-b-2 border-black pb-8">
          <h1 className="text-2xl font-serif italic font-medium uppercase tracking-wider text-black">GuildMarket Official Receipt</h1>
          <p className="text-[10px] uppercase tracking-widest mt-1 text-gray-650 font-sans">Verified Decentralized Artisan Ledger &bull; Transaction Asset</p>
        </div>

        <div className="my-8 space-y-4">
          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-4 text-xs font-sans">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Transaction Reference</span>
              <span className="font-mono block font-bold">{printingOrder.id}</span>
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mt-2">Network Verification TXN ID</span>
              <span className="font-mono block text-[10px] break-all">{printingOrder.transactionId || 'N/A'}</span>
            </div>
            <div className="text-right">
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Execution Date</span>
              <span className="font-mono block">
                {printingOrder.createdAt?.seconds 
                  ? new Date(printingOrder.createdAt.seconds * 1000).toLocaleString('en-US', { timeZoneName: 'short' })
                  : new Date().toLocaleString()
                }
              </span>
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mt-2">Settlement Status</span>
              <span className="font-sans block text-xs font-extrabold uppercase text-emerald-800 tracking-wider">SUCCEEDED</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-4 font-sans text-xs">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Buyer Credentials</span>
              <span className="block font-medium">{printingOrder.buyerName}</span>
              <span className="block font-mono text-[10px] text-gray-600">{printingOrder.buyerEmail}</span>
            </div>
            <div className="text-right">
              <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Financial Settlement Provider</span>
              <span className="block font-bold uppercase">{printingOrder.paymentMethodType?.replace('LOCAL_', '').replace('GLOBAL_', '').replace('_', ' ') || 'GLOBAL CREDIT CARD'}</span>
              <span className="block text-gray-600 font-mono text-[10px] truncate max-w-[250px]">{printingOrder.paymentMethodDetails || `${printingOrder.cardBrand} Ending in •••• ${printingOrder.last4}`}</span>
            </div>
          </div>

          <div className="border-b border-black/10 pb-4 font-sans text-xs">
            <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Shipping Designation Coordinates</span>
            <span className="block text-xs font-serif italic text-gray-950 font-medium">{printingOrder.shippingAddress}</span>
          </div>
        </div>

        <table className="w-full text-left border-collapse border-b-2 border-black font-sans text-xs">
          <thead>
            <tr className="border-b-2 border-black/30 text-[9px] uppercase tracking-widest text-gray-600">
              <th className="py-2">Item Description</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total Price</th>
            </tr>
          </thead>
          <tbody>
            {printingOrder.items.map((it, idx) => (
              <tr key={idx} className="border-b border-black/5 text-xs text-gray-900">
                <td className="py-3">
                  <span className="font-semibold block">{it.title}</span>
                  <span className="text-[9px] font-mono text-gray-500">Artisan ID: {it.artisanId || 'Shared Guild'}</span>
                </td>
                <td className="py-3 text-center font-mono">{it.quantity}</td>
                <td className="py-3 text-right font-mono">${Number(it.price).toFixed(2)}</td>
                <td className="py-3 text-right font-mono font-semibold">${(it.price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-6 flex justify-end font-sans">
          <div className="w-64 space-y-1.5 text-xs text-right">
            <div className="flex justify-between text-gray-650">
              <span className="uppercase text-[9px] tracking-wider text-gray-500">Cart Subtotal:</span>
              <span className="font-mono">${printingOrder.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-650">
              <span className="uppercase text-[9px] tracking-wider text-gray-500">Shipping Fees:</span>
              <span className="font-mono">$0.00</span>
            </div>
            <div className="flex justify-between text-gray-650">
              <span className="uppercase text-[9px] tracking-wider text-gray-500">Assessed Duties:</span>
              <span className="font-mono">$0.00</span>
            </div>
            <div className="flex justify-between border-t border-black pt-2 font-bold text-sm text-black">
              <span className="uppercase text-[10px] tracking-widest">Total Settled:</span>
              <span className="font-mono text-base">${printingOrder.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center border-t border-black/20 pt-8 font-sans">
          <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-relaxed">
            This receipt forms a formal ledger representation of completed local order processing.
            <br />
            All funds have settled under corresponding legal framework. Thank you for supporting custom local artistry.
          </p>
          <div className="mt-6 flex justify-center items-center gap-2 text-[8px] text-gray-400 font-mono">
            <span>GUILDMARKET PROTOCOLS</span>
            <span>&bull;</span>
            <span>VERIFIED ORIGINAL</span>
          </div>
        </div>
      </div>
    )}
  </>
);
}
