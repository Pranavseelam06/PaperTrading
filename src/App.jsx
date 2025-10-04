import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, PieChart, History, Trophy, Settings, Moon, Sun, Search, Plus, Minus, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';

// State Management with Auth
const useStore = () => {
  const { currentUser, updateUserData } = useAuth();
  
  const [balance, setBalance] = useState(currentUser?.balance || 100000);
  const [holdings, setHoldings] = useState(currentUser?.holdings || {});
  const [transactions, setTransactions] = useState(currentUser?.transactions || []);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    if (currentUser) {
      setBalance(currentUser.balance);
      setHoldings(currentUser.holdings);
      setTransactions(currentUser.transactions);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      updateUserData(balance, holdings, transactions);
    }
  }, [balance, holdings, transactions]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  return { balance, setBalance, holdings, setHoldings, transactions, setTransactions, darkMode, setDarkMode };
};

const useMarketData = (symbols) => {
  const [prices, setPrices] = useState({});
  const [chartData, setChartData] = useState({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState({});
  const [lastUpdate, setLastUpdate] = useState({});

  useEffect(() => {
    const fetchCryptoPrices = async () => {
      try {
        const newPrices = {};
        const newErrors = {};
        const newTimestamps = {};
        
        const cryptoSymbols = symbols.filter(s => ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'MATIC', 'AVAX'].includes(s));
        
        if (cryptoSymbols.length > 0) {
          try {
            const coinIds = {
              'BTC': 'bitcoin',
              'ETH': 'ethereum',
              'SOL': 'solana',
              'DOGE': 'dogecoin',
              'ADA': 'cardano',
              'XRP': 'ripple',
              'MATIC': 'matic-network',
              'AVAX': 'avalanche-2'
            };
            
            const ids = cryptoSymbols.map(s => coinIds[s]).join(',');
            const response = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
            );
            
            if (response.ok) {
              const data = await response.json();
              
              cryptoSymbols.forEach(symbol => {
                const coinId = coinIds[symbol];
                if (data[coinId] && data[coinId].usd) {
                  newPrices[symbol] = {
                    price: data[coinId].usd,
                    change: data[coinId].usd_24h_change || 0,
                    type: 'crypto',
                    tradeable: true,
                    lastUpdate: new Date().toISOString()
                  };
                  newTimestamps[symbol] = new Date();
                  console.log(`✅ ${symbol}: $${data[coinId].usd.toLocaleString()} (${(data[coinId].usd_24h_change || 0).toFixed(2)}%)`);
                } else {
                  newErrors[symbol] = 'Data Unavailable';
                }
              });
            } else {
              console.error('CoinGecko API error:', response.status);
              cryptoSymbols.forEach(s => newErrors[s] = 'API Error');
            }
          } catch (err) {
            console.error('CoinGecko fetch error:', err.message);
            cryptoSymbols.forEach(s => newErrors[s] = 'Network Error');
          }
        }
        
        if (Object.keys(newPrices).length > 0) {
          setPrices(prev => ({ ...prev, ...newPrices }));
          setLastUpdate(prev => ({ ...prev, ...newTimestamps }));
          setApiError(prev => ({ ...prev, ...newErrors }));
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Fatal error:', error);
        setLoading(false);
      }
    };

    fetchCryptoPrices();
    const interval = setInterval(fetchCryptoPrices, 10000);
    
    return () => clearInterval(interval);
  }, [symbols.join(',')]);

  useEffect(() => {
    if (Object.keys(prices).length === 0) return;
    
    const now = Date.now();
    Object.entries(prices).forEach(([symbol, priceData]) => {
      if (priceData.price > 0) {
        setChartData(prev => {
          const existing = prev[symbol] || [];
          const newPoint = {
            time: new Date(now).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            }),
            price: priceData.price,
            timestamp: now
          };
          return { ...prev, [symbol]: [...existing, newPoint].slice(-100) };
        });
      }
    });
  }, [prices]);

  return { prices, chartData, loading, apiError, lastUpdate };
};

export default function PaperTradingApp() {
  const { currentUser, logout } = useAuth();
  const store = useStore();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [tradeAmount, setTradeAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const allSymbols = useMemo(() => {
    const holdingSymbols = Object.keys(store.holdings);
    const defaultSymbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP'];
    return [...new Set([...holdingSymbols, ...defaultSymbols, selectedSymbol])];
  }, [store.holdings, selectedSymbol]);

  const { prices, chartData, loading, apiError, lastUpdate } = useMarketData(allSymbols);

  const portfolioValue = useMemo(() => {
    return Object.entries(store.holdings).reduce((total, [symbol, holding]) => {
      return total + (holding.quantity * (prices[symbol]?.price || 0));
    }, 0);
  }, [store.holdings, prices]);

  const totalValue = store.balance + portfolioValue;

  const canTrade = (symbol) => {
    const priceData = prices[symbol];
    if (!priceData) return false;
    return priceData.tradeable === true;
  };

  const executeTrade = (type) => {
    const quantity = parseFloat(tradeAmount);
    if (!quantity || quantity <= 0) return;
    
    const price = prices[selectedSymbol]?.price;
    if (!price) return;
    
    if (!canTrade(selectedSymbol)) {
      alert('Trading is currently unavailable for this symbol.');
      return;
    }
    
    const cost = quantity * price;

    if (type === 'buy') {
      if (cost > store.balance) {
        alert('Insufficient balance!');
        return;
      }
      store.setBalance(store.balance - cost);
      store.setHoldings(prev => ({
        ...prev,
        [selectedSymbol]: {
          quantity: (prev[selectedSymbol]?.quantity || 0) + quantity,
          avgCost: prev[selectedSymbol] ? ((prev[selectedSymbol].avgCost * prev[selectedSymbol].quantity) + cost) / (prev[selectedSymbol].quantity + quantity) : price
        }
      }));
      store.setTransactions(prev => [{ id: Date.now(), type: 'BUY', symbol: selectedSymbol, quantity, price, total: cost, timestamp: new Date().toISOString() }, ...prev]);
    } else {
      const holding = store.holdings[selectedSymbol];
      if (!holding || holding.quantity < quantity) {
        alert('Insufficient holdings!');
        return;
      }
      store.setBalance(store.balance + cost);
      if (holding.quantity === quantity) {
        const newHoldings = { ...store.holdings };
        delete newHoldings[selectedSymbol];
        store.setHoldings(newHoldings);
      } else {
        store.setHoldings(prev => ({
          ...prev,
          [selectedSymbol]: { ...prev[selectedSymbol], quantity: prev[selectedSymbol].quantity - quantity }
        }));
      }
      store.setTransactions(prev => [{ id: Date.now(), type: 'SELL', symbol: selectedSymbol, quantity, price, total: cost, timestamp: new Date().toISOString() }, ...prev]);
    }
    setTradeAmount('');
  };

  const leaderboardData = useMemo(() => [
    { rank: 1, name: 'You', value: totalValue, change: ((totalValue - 100000) / 100000) * 100 },
    { rank: 2, name: 'TraderPro', value: 125430, change: 25.43 },
    { rank: 3, name: 'CryptoKing', value: 118920, change: 18.92 },
    { rank: 4, name: 'StockMaster', value: 112500, change: 12.50 },
    { rank: 5, name: 'InvestorAce', value: 108750, change: 8.75 }
  ].sort((a, b) => b.value - a.value).map((item, idx) => ({ ...item, rank: idx + 1 })), [totalValue]);

  const bgClass = store.darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = store.darkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = store.darkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = store.darkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = store.darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgClass} ${textPrimary} transition-colors duration-300`}>
      <div className={`fixed left-0 top-0 h-full w-64 ${cardBg} border-r ${borderColor} p-6 flex flex-col`}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-500" />
            CryptoTrade
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>Welcome, {currentUser?.username}!</p>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', icon: PieChart, label: 'Dashboard' },
            { id: 'trade', icon: TrendingUp, label: 'Trade' },
            { id: 'history', icon: History, label: 'History' },
            { id: 'leaderboard', icon: Trophy, label: 'Leaderboard' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map(item => (
            <button key={item.id} onClick={() => setCurrentView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === item.id ? 'bg-blue-600 text-white shadow-lg' : `${textSecondary} hover:bg-gray-700`}`}>
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => store.setDarkMode(!store.darkMode)} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${textSecondary} hover:bg-gray-700 transition-all mb-2`}>
          {store.darkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span>Toggle Theme</span>
        </button>
        <button onClick={logout} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900 transition-all`}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>

      <div className="ml-64 p-8 pb-20">
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={textSecondary}>Cash Balance</p>
                  <DollarSign className="text-green-500" size={24} />
                </div>
                <p className="text-3xl font-bold">${store.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={textSecondary}>Portfolio Value</p>
                  <PieChart className="text-blue-500" size={24} />
                </div>
                <p className="text-3xl font-bold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={textSecondary}>Total Value</p>
                  {totalValue >= 100000 ? <TrendingUp className="text-green-500" size={24} /> : <TrendingDown className="text-red-500" size={24} />}
                </div>
                <p className="text-3xl font-bold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className={`text-sm mt-1 ${totalValue >= 100000 ? 'text-green-500' : 'text-red-500'}`}>{((totalValue - 100000) / 100000 * 100).toFixed(2)}% all-time</p>
              </div>
            </div>

            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedSymbol} Price Chart</h2>
                  <p className={`text-sm ${textSecondary}`}>
                    {lastUpdate && lastUpdate[selectedSymbol] ? `Last updated: ${lastUpdate[selectedSymbol].toLocaleTimeString()}` : 'Waiting for data...'}
                  </p>
                  {apiError && apiError[selectedSymbol] && (
                    <p className="text-sm text-red-500 mt-1">⚠️ {apiError[selectedSymbol]}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {prices[selectedSymbol]?.type === 'crypto' && (
                    <span className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded-full text-sm font-bold">🟢 Live</span>
                  )}
                  <div className="text-right">
                    <p className="text-2xl font-bold">{prices[selectedSymbol]?.price > 0 ? `$${prices[selectedSymbol].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</p>
                    <p className={`text-sm ${(prices[selectedSymbol]?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(prices[selectedSymbol]?.change || 0) >= 0 ? '+' : ''}{(prices[selectedSymbol]?.change || 0).toFixed(2)}%</p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData[selectedSymbol] || []}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={store.darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="time" stroke={store.darkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={store.darkMode ? '#9ca3af' : '#6b7280'} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: store.darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${store.darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Current Holdings</h2>
                {lastUpdate && Object.keys(lastUpdate).length > 0 && (
                  <p className={`text-xs ${textSecondary}`}>Last updated: {new Date(Math.max(...Object.values(lastUpdate).map(d => d.getTime()))).toLocaleTimeString()}</p>
                )}
              </div>
              {Object.keys(store.holdings).length === 0 ? (
                <p className={textSecondary}>No holdings yet. Start trading!</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left py-3 ${textSecondary}`}>Symbol</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Quantity</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Avg Cost</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Current Price</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Value</th>
                      <th className={`text-right py-3 ${textSecondary}`}>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(store.holdings).map(([symbol, holding]) => {
                      const currentPrice = prices[symbol]?.price || 0;
                      const currentValue = holding.quantity * currentPrice;
                      const totalCost = holding.quantity * holding.avgCost;
                      const pnl = currentValue - totalCost;
                      const pnlPercent = (pnl / totalCost) * 100;
                      return (
                        <tr key={symbol} className={`border-b ${borderColor} hover:bg-gray-700 transition-colors`}>
                          <td className="py-4">
                            <button onClick={() => setSelectedSymbol(symbol)} className="font-bold text-blue-500 hover:text-blue-400">{symbol}</button>
                          </td>
                          <td className="text-right">{holding.quantity.toFixed(6)}</td>
                          <td className="text-right">${holding.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right font-bold">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className={`text-right font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-sm ml-2">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {currentView === 'trade' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Trade</h1>
            <div className="grid grid-cols-2 gap-6">
              <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                <h2 className="text-xl font-bold mb-4">Select Asset</h2>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value.toUpperCase())} placeholder="Search..." className={`w-full pl-10 pr-4 py-3 rounded-lg border ${borderColor} ${cardBg} focus:ring-2 focus:ring-blue-500 outline-none`} />
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'MATIC', 'AVAX', 'DOT', 'LINK'].filter(s => s.includes(searchQuery)).map(symbol => (
                    <button key={symbol} onClick={() => setSelectedSymbol(symbol)} className={`w-full p-4 rounded-lg border ${borderColor} flex items-center justify-between transition-all ${selectedSymbol === symbol ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>
                      <div className="text-left">
                        <p className="font-bold">{symbol}</p>
                        <p className={`text-sm ${selectedSymbol === symbol ? 'text-blue-100' : textSecondary}`}>Cryptocurrency</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{prices[symbol]?.price > 0 ? `$${prices[symbol].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</p>
                        <p className={`text-sm ${(prices[symbol]?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(prices[symbol]?.change || 0) >= 0 ? '+' : ''}{(prices[symbol]?.change || 0).toFixed(2)}%</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                  <h2 className="text-xl font-bold mb-4">Place Order</h2>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm ${textSecondary} mb-2`}>Symbol</label>
                      <div className={`p-4 rounded-lg border ${borderColor} bg-gray-700`}>
                        <p className="text-2xl font-bold">{selectedSymbol}</p>
                        <p className="text-sm text-gray-400">{prices[selectedSymbol]?.price > 0 ? `$${prices[selectedSymbol].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm ${textSecondary} mb-2`}>Quantity</label>
                      <input type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} placeholder="0.00" step="0.000001" className={`w-full px-4 py-3 rounded-lg border ${borderColor} ${cardBg} focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold`} />
                    </div>
                    <div className={`p-4 rounded-lg border ${borderColor} bg-gray-700`}>
                      <div className="flex justify-between mb-2">
                        <span className={textSecondary}>Total Cost</span>
                        <span className="font-bold text-xl">${((parseFloat(tradeAmount) || 0) * (prices[selectedSymbol]?.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={textSecondary}>Available</span>
                        <span className="font-bold">${store.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => executeTrade('buy')} disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || !canTrade(selectedSymbol)} className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-all text-white shadow-lg">
                        <Plus size={20} />Buy
                      </button>
                      <button onClick={() => executeTrade('sell')} disabled={!tradeAmount || parseFloat(tradeAmount) <= 0 || !canTrade(selectedSymbol)} className="flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-all text-white shadow-lg">
                        <Minus size={20} />Sell
                      </button>
                    </div>
                    {!canTrade(selectedSymbol) && (
                      <div className="p-3 bg-yellow-900 border border-yellow-600 rounded-lg text-sm">
                        <p className="font-bold">⚠️ Trading Unavailable</p>
                        <p className="text-yellow-200 text-xs">Unable to trade this asset at the moment.</p>
                      </div>
                    )}
                    {apiError && apiError[selectedSymbol] && (
                      <div className="p-3 bg-yellow-900 border border-yellow-600 rounded-lg text-sm">
                        <p className="font-bold">⚠️ {apiError[selectedSymbol]}</p>
                        <p className="text-yellow-200 text-xs">Unable to fetch current price data.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
                  <h3 className="font-bold mb-4">Your Position</h3>
                  {store.holdings[selectedSymbol] ? (
                    <div className={`p-4 rounded-lg border ${borderColor} bg-gray-700`}>
                      <div className="flex justify-between"><span className={textSecondary}>Quantity</span><span className="font-bold">{store.holdings[selectedSymbol].quantity.toFixed(6)}</span></div>
                      <div className="flex justify-between"><span className={textSecondary}>Avg Cost</span><span className="font-bold">${store.holdings[selectedSymbol].avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className={textSecondary}>Value</span><span className="font-bold">{prices[selectedSymbol]?.price > 0 ? `${(store.holdings[selectedSymbol].quantity * prices[selectedSymbol].price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span></div>
                    </div>
                  ) : (
                    <p className={textSecondary}>No position in {selectedSymbol}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'history' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Transaction History</h1>
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              {store.transactions.length === 0 ? (
                <p className={textSecondary}>No transactions yet</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left py-3 ${textSecondary}`}>Date</th>
                      <th className={`text-left py-3 ${textSecondary}`}>Type</th>
                      <th className={`text-left py-3 ${textSecondary}`}>Symbol</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Qty</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Price</th>
                      <th className={`text-right py-3 ${textSecondary}`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.transactions.map(tx => (
                      <tr key={tx.id} className={`border-b ${borderColor} hover:bg-gray-700 transition-colors`}>
                        <td className="py-4">{new Date(tx.timestamp).toLocaleString()}</td>
                        <td><span className={`px-3 py-1 rounded-full text-sm font-bold ${tx.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'}`}>{tx.type}</span></td>
                        <td className="font-bold text-blue-500">{tx.symbol}</td>
                        <td className="text-right">{tx.quantity.toFixed(6)}</td>
                        <td className="text-right">${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right font-bold">${tx.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {currentView === 'leaderboard' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              <div className="space-y-4">
                {leaderboardData.map((entry) => (
                  <div key={entry.rank} className={`flex items-center justify-between p-4 rounded-lg border ${borderColor} transition-all ${entry.name === 'You' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${entry.rank === 1 ? 'bg-yellow-500 text-black' : entry.rank === 2 ? 'bg-gray-400 text-black' : entry.rank === 3 ? 'bg-orange-600 text-white' : 'bg-gray-600'}`}>
                        {entry.rank === 1 ? '🏆' : entry.rank}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{entry.name}</p>
                        <p className={`text-sm ${entry.name === 'You' ? 'text-blue-100' : textSecondary}`}>Portfolio Value</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className={`text-sm font-bold ${entry.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>{entry.change >= 0 ? '+' : ''}{entry.change.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor}`}>
              <p className={`text-sm ${textSecondary} text-center`}>Keep trading to improve your ranking! 📈</p>
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              <h2 className="text-xl font-bold mb-4">Account Settings</h2>
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-lg border ${borderColor}`}>
                  <div>
                    <p className="font-bold">Dark Mode</p>
                    <p className={`text-sm ${textSecondary}`}>Toggle theme</p>
                  </div>
                  <button onClick={() => store.setDarkMode(!store.darkMode)} className={`w-16 h-8 rounded-full transition-all relative ${store.darkMode ? 'bg-blue-600' : 'bg-gray-600'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all ${store.darkMode ? 'left-9' : 'left-1'}`} />
                  </button>
                </div>
                <div className={`flex items-center justify-between p-4 rounded-lg border ${borderColor}`}>
                  <div>
                    <p className="font-bold">Reset Account</p>
                    <p className={`text-sm ${textSecondary}`}>Reset to $100,000</p>
                  </div>
                  <button onClick={() => { if (window.confirm('Reset account?')) { store.setBalance(100000); store.setHoldings({}); store.setTransactions([]); } }} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-all">
                    Reset
                  </button>
                </div>
                <div className={`p-4 rounded-lg border ${borderColor} bg-gray-700`}>
                  <p className="font-bold mb-2">Statistics</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className={textSecondary}>Total Trades</p><p className="font-bold text-lg">{store.transactions.length}</p></div>
                    <div><p className={textSecondary}>Holdings</p><p className="font-bold text-lg">{Object.keys(store.holdings).length}</p></div>
                    <div><p className={textSecondary}>Total P&L</p><p className={`font-bold text-lg ${totalValue >= 100000 ? 'text-green-500' : 'text-red-500'}`}>{totalValue >= 100000 ? '+' : ''}${(totalValue - 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div><p className={textSecondary}>Win Rate</p><p className="font-bold text-lg">{store.transactions.length > 0 ? `${((store.transactions.filter(tx => tx.type === 'SELL').length / store.transactions.length) * 100).toFixed(1)}%` : '0%'}</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} shadow-lg`}>
              <h2 className="text-xl font-bold mb-4">About</h2>
              <div className="space-y-2 text-sm">
                <p className={textSecondary}><strong>CryptoTrade</strong> - Crypto-only virtual trading platform</p>
                <p className={textSecondary}>✅ Live prices from CoinGecko (updates every 10s)</p>
                <p className={textSecondary}>🌐 24/7 trading - crypto never sleeps!</p>
                <p className={textSecondary}>💾 Data stored locally in browser</p>
                <div className={`pt-4 mt-4 border-t ${borderColor}`}>
                  <p className={`text-xs ${textSecondary}`}>v2.1.0 • Crypto Only • Real API Data</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`fixed bottom-0 left-64 right-0 ${cardBg} border-t ${borderColor} px-8 py-3 flex items-center gap-6 overflow-x-auto`}>
        {lastUpdate && Object.keys(lastUpdate).length > 0 && (
          <div className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold mr-4">
            <span>🕐</span>
            <span>Updated: {new Date(Math.max(...Object.values(lastUpdate).map(d => d.getTime()))).toLocaleTimeString()}</span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded-lg text-sm font-bold mr-4">
          <span>🟢</span>
          <span>24/7 Trading</span>
        </div>
        {['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP'].map(symbol => (
          <button key={symbol} onClick={() => { setSelectedSymbol(symbol); setCurrentView('trade'); }} className="flex items-center gap-2 hover:bg-gray-700 px-3 py-1 rounded transition-all whitespace-nowrap">
            <span className="font-bold">{symbol}</span>
            <span className="text-sm">{prices[symbol]?.price > 0 ? `${prices[symbol].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span>
            {prices[symbol]?.price > 0 && (
              <span className={`text-xs ${(prices[symbol]?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(prices[symbol]?.change || 0) >= 0 ? '▲' : '▼'} {Math.abs(prices[symbol]?.change || 0).toFixed(2)}%</span>
            )}
            {apiError && apiError[symbol] && <span className="text-xs text-yellow-500">⚠️</span>}
          </button>
        ))}
      </div>
    </div>
  );
}