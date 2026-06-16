/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { Product, Review, Order, CartItem, Artisan } from './types';
import { mockProducts, mockArtisans } from './data/mockData';

// Subcomponents
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import ProductDetailModal from './components/ProductDetailModal';
import CheckoutModal from './components/CheckoutModal';
import ArtisanDashboard from './components/ArtisanDashboard';

// Icons
import { ShoppingCart, ShoppingBag, ArrowRight, ShieldCheck, MapPin, Sparkles, Filter, X, Trash2, Heart } from 'lucide-react';

const catalogContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Firestore Synchronized States
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Cart & UI Presentation States
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeView, setActiveView] = useState<'market' | 'dashboard'>('market');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Test Connection to Firestore as required by Firebase skill
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration state.");
        }
      }
    }
    testConnection();
  }, []);

  // Sync Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      // Automatically navigate back to market if logged out from dashboard
      if (!currentUser && activeView === 'dashboard') {
        setActiveView('market');
      }
    });
    return unsubscribe;
  }, [activeView]);

  // Real-time Sync of Products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prodList: Product[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        prodList.push({
          ...d,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        } as Product);
      });
      setDbProducts(prodList);
    }, (err) => {
      console.error("Firestore Products sync error:", err);
      handleFirestoreError(err, OperationType.GET, 'products');
    });
    return unsubscribe;
  }, []);

  // Real-time Sync of Orders from Firestore (limited to what active user can see)
  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach((docSnap) => {
        orderList.push({
          ...docSnap.data(),
        } as Order);
      });
      setOrders(orderList);
    }, (err) => {
      // expected error if the rules block reading other users orders, handled gracefully:
      console.log("Firestore Orders filtered under secure rules restrictions.");
    });
    return unsubscribe;
  }, [user]);

  // Real-time Sync of Reviews
  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revList: Review[] = [];
      snapshot.forEach((docSnap) => {
        revList.push({
          ...docSnap.data(),
        } as Review);
      });
      setReviews(revList);
    }, (err) => {
      console.error("Reviews loader error under rules constraints:", err);
      handleFirestoreError(err, OperationType.GET, 'reviews');
    });
    return unsubscribe;
  }, []);

  // Union of real Firestore products & default design concepts (prevent empty layout)
  const products = [...dbProducts, ...mockProducts.filter(mp => !dbProducts.some(dp => dp.id === mp.id))];

  // Deep-linking: auto-open product detail modal if 'product' query parameter is present on load/sync
  useEffect(() => {
    if (products.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const prodId = params.get('product');
      if (prodId) {
        const found = products.find(p => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
        }
      }
    }
  }, [products]);

  // Synchronize browser URL query param with currently selected product
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedProduct) {
      params.set('product', selectedProduct.id);
    } else {
      params.delete('product');
    }
    const newQuery = params.toString() ? ('?' + params.toString()) : '';
    const newRelativePathQuery = window.location.pathname + newQuery + window.location.hash;
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [selectedProduct]);

  // Helper arrays for filters
  const categories = Array.from(new Set(products.map(p => p.category)));
  const cities = Array.from(new Set(products.map(p => p.location)));

  // Filter products based on search inputs
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    const matchesCity = selectedCity ? p.location === selectedCity : true;
    return matchesSearch && matchesCategory && matchesCity;
  });

  // Shopping Cart Handlers
  const handleAddToCart = (product: Product, quantity: number) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find(it => it.product.id === product.id);
      if (existing) {
        return prevItems.map(it => 
          it.product.id === product.id 
            ? { ...it, quantity: Math.min(product.stock, it.quantity + quantity) } 
            : it
        );
      }
      return [...prevItems, { product, quantity }];
    });
    setIsCartOpen(true); // Open drawer as micro-feedback
  };

  const handleUpdateCartQuantity = (productId: string, val: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, Math.min(item.product.stock, val)) };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(it => it.product.id !== productId));
  };

  const cartCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);
  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.product.price * it.quantity, 0);

  return (
    <div id="app_root_wrapper" className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] selection:bg-[#1A1A1A]/10 selection:text-[#1A1A1A] font-sans">
      
      {/* Dynamic Nav Header */}
      <Navbar
        user={user}
        onOpenDashboard={() => setActiveView('dashboard')}
        onOpenCart={() => setIsCartOpen(true)}
        cartCount={cartCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        categories={categories}
        cities={cities}
      />

      <AnimatePresence mode="wait">
        {activeView === 'market' ? (
          /* MARKETPLACE VIEW MODE */
          <motion.main
            key="market_layer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="pb-24"
          >
            {/* Elegant Display Hero Section */}
            <div id="hero_showcase" className="relative bg-[#F2F1EE] border-b border-[#1A1A1A]/5 pb-20 pt-24 sm:pb-24 sm:pt-28">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
                
                {/* Hero subtitle label */}
                <div className="inline-flex items-center gap-2 rounded-none bg-[#1A1A1A] text-white px-4 py-1 tracking-widest text-[9px] uppercase font-bold animate-fade-in">
                  <Sparkles className="h-3 w-3" />
                  <span>Direct-to-Creator Guild Marketplace</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif font-light tracking-tight text-[#1A1A1A] max-w-4xl mx-auto leading-tight">
                  Handcrafted Goods from <br className="hidden sm:inline"/><span className="font-serif italic font-medium">Bespoke Local Craftsmen</span>
                </h1>
                
                <p className="max-w-2xl mx-auto text-xs sm:text-xs font-serif italic text-[#1A1A1A]/70 leading-relaxed">
                  Support independent makers crafting intentional objects, slow-made ceramics, organic raw textures, and slow culinary delicacies. Fully registered under local double-signature ledger security.
                </p>

                {/* Categories Tab selector bar */}
                <div className="pt-8 flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
                  <button
                    id="filter_category_all_btn"
                    onClick={() => setSelectedCategory('')}
                    className={`rounded-none px-6 py-2.5 text-[9px] font-sans font-bold uppercase tracking-widest transition-all border ${
                      selectedCategory === '' 
                        ? 'bg-[#1A1A1A] text-[#F9F8F6] border-transparent' 
                        : 'bg-[#F9F8F6] text-[#1A1A1A] border-[#1A1A1A]/10 hover:border-[#1A1A1A]'
                    }`}
                  >
                    All Crafts
                  </button>
                  {categories.map((cat) => (
                    <button
                      id={`filter_category_btn_${cat}`}
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-none px-6 py-2.5 text-[9px] font-sans font-bold uppercase tracking-widest transition-all border ${
                        selectedCategory === cat 
                          ? 'bg-[#1A1A1A] text-[#F9F8F6] border-transparent' 
                          : 'bg-[#F9F8F6] text-[#1A1A1A] border-[#1A1A1A]/10 hover:border-[#1A1A1A]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

              </div>
            </div>

            {/* Main Products Grid stage details */}
            <div id="products_stage" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-16">
              <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-5 mb-10">
                <div>
                  <h2 className="text-2xl font-serif italic font-medium text-[#1A1A1A] tracking-tight flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#1A1A1A] stroke-[1.5]" />
                    Available Creations ({filteredProducts.length})
                  </h2>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-[#1A1A1A]/50 mt-1">Showing catalog of authentic localized listings</p>
                </div>

                {/* Quick reset active filter clear buttons */}
                {(selectedCategory || selectedCity || searchQuery) && (
                  <button
                    id="clear_filters_btn"
                    onClick={() => { setSelectedCategory(''); setSelectedCity(''); setSearchQuery(''); }}
                    className="text-[10px] font-sans uppercase tracking-widest font-bold text-[#1A1A1A] hover:underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {filteredProducts.length === 0 ? (
                <div id="empty_search_alert" className="py-20 text-center space-y-4 rounded-none border border-dashed border-[#1A1A1A]/15 p-8 bg-[#F2F1EE]/50">
                  <ShoppingBag className="h-8 w-8 mx-auto text-[#1A1A1A]/40" />
                  <p className="text-sm font-serif italic font-medium text-[#1A1A1A]">No creative matches found.</p>
                  <p className="text-xs text-[#1A1A1A]/60 max-w-xs mx-auto">Try clarifying keywords or resetting category filters to show broader local catalogs.</p>
                </div>
              ) : (
                <motion.div
                  key={`${selectedCategory}-${selectedCity}-${searchQuery}`}
                  variants={catalogContainerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8"
                >
                  {filteredProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      onSelect={setSelectedProduct}
                      reviewCount={reviews.filter(r => r.productId === prod.id).length}
                      ratingAverage={reviews.filter(r => r.productId === prod.id).length > 0
                        ? reviews.filter(r => r.productId === prod.id).reduce((s, re) => s + re.rating, 0) / reviews.filter(r => r.productId === prod.id).length
                        : 4.8
                      }
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </motion.main>
        ) : (
          /* ARTISAN SELLER STUDIOVIEW MODE */
          <motion.main
            key="dashboard_layer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {user ? (
              <ArtisanDashboard
                user={user}
                onClose={() => setActiveView('market')}
                allProducts={products}
                allOrders={orders}
                onRefreshData={() => {}}
              />
            ) : (
              <div className="py-20 text-center space-y-4">
                <p className="text-sm text-gray-500">Sign in using Google identity to view personal seller dashboards.</p>
              </div>
            )}
          </motion.main>
        )}
      </AnimatePresence>

      {/* FOOTER METRIC DETAIL LINES */}
      <footer id="global_client_footer" className="bg-[#F2F1EE] border-t border-[#1A1A1A]/10 py-12 text-[10px] font-sans uppercase tracking-widest text-[#1A1A1A]/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-850" />
            <span className="font-mono">Secure Gateway Sandbox &bull; Verified Database Registry</span>
          </div>
          <span>&copy; {new Date().getFullYear()} GuildMarket Inc. Zero-Trust Architecture.</span>
        </div>
      </footer>

      {/* DYNAMIC SHOPPING CART DRAWER PANEL */}
      <AnimatePresence>
        {isCartOpen && (
          <div id="cart_drawer_mask" className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setIsCartOpen(false)} />
            
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                id="cart_drawer_panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-screen max-w-md bg-[#F9F8F6] text-[#1A1A1A] border-l border-[#1A1A1A]/15 shadow-2xl flex flex-col"
              >
                
                {/* Cart Header */}
                <div className="flex h-20 items-center justify-between px-6 border-b border-[#1A1A1A]/10">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2 font-sans">
                    <ShoppingCart className="h-4 w-4" />
                    Shopping Basket
                  </h3>
                  <button
                    id="close_cart_drawer_btn"
                    onClick={() => setIsCartOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-none border border-[#1A1A1A]/10 bg-[#F9F8F6] text-[#1A1A1A] hover:bg-black hover:text-[#F9F8F6]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Cart Body: list styles */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                      <ShoppingBag className="h-8 w-8 text-[#1A1A1A]/30" />
                      <p className="text-xs font-serif italic text-[#1A1A1A]">Your basket is currently empty</p>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A] hover:underline"
                      >
                        Keep browsing craftsmen goods
                      </button>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div key={item.product.id} className="flex gap-4 border-b border-[#1A1A1A]/5 pb-4 text-xs">
                        {/* pic */}
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.title}
                          className="h-16 w-16 rounded-none object-cover bg-gray-50 border border-[#1A1A1A]/10 shrink-0"
                        />
                        <div className="flex-1 min-w-0 pr-1">
                          <h4 className="font-serif italic font-medium text-sm text-[#1A1A1A] truncate">{item.product.title}</h4>
                          <span className="text-[9px] uppercase tracking-widest text-[#1A1A1A]/55 mt-0.5 block">{item.product.location} Studio</span>
                          
                          {/* edit counter */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="font-serif font-medium text-[#1A1A1A]">${item.product.price}</span>
                            <div className="flex items-center border border-[#1A1A1A]/20 rounded-none bg-[#F2F1EE] overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity - 1)}
                                className="px-2 py-0.5 text-xs text-[#1A1A1A] hover:bg-black/5"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-[10px] font-bold font-mono text-[#1A1A1A]">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity + 1)}
                                className="px-2 py-0.5 text-xs text-[#1A1A1A] hover:bg-black/5"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* delete */}
                        <div className="flex flex-col items-end justify-between py-1 shrink-0">
                          <span className="font-serif font-medium text-[#1A1A1A]">${item.product.price * item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="text-[#1A1A1A]/60 hover:text-red-700 p-1 rounded-none border border-transparent hover:border-[#1A1A1A]/10 hover:bg-[#F2F1EE]"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Footer pricing and checkout trigger */}
                {cartItems.length > 0 && (
                  <div className="border-t border-[#1A1A1A]/10 p-6 space-y-4 bg-[#F2F1EE]/60">
                    <div className="flex justify-between items-center text-xs font-semibold text-[#1A1A1A]">
                      <span className="uppercase tracking-widest text-[10px]">Invoiced Subtotal</span>
                      <span className="font-serif font-medium text-xl">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    <p className="text-[9px] uppercase tracking-wider text-[#1A1A1A]/55 leading-relaxed">
                      Duty taxes and carriage will compute securely at the gateway overlay step. Compliment transport for curations over $100.
                    </p>

                    <button
                      id="cart_drawer_checkout_btn"
                      onClick={() => {
                        setIsCartOpen(false);
                        setIsCheckoutOpen(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-none bg-[#1A1A1A] h-12 text-[10px] uppercase tracking-widest font-bold text-white hover:bg-black transition-all font-sans"
                    >
                      Checkout with Verified Cards
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC PRODUCT SPEC DETAIL MODAL */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            user={user}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={handleAddToCart}
            allReviews={reviews}
            onReviewAdded={() => {}}
          />
        )}
      </AnimatePresence>

      {/* SECURE CHECKOUT PAYMENT GATEWAY MODAL OVERLAY */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <CheckoutModal
            user={user}
            cartItems={cartItems}
            onClose={() => setIsCheckoutOpen(false)}
            onClearCart={() => setCartItems([])}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
