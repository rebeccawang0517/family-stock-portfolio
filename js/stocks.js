        import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
        
        const { auth, db, provider } = window.firebaseApp;
        let currentUser = null;
        let stocks = [];
        let transactions = [];

        const TAIWAN_STOCKS = {
            '0050': '元大台灣50','0056': '元大高股息','00679B': '元大美債20年','00687B': '國泰20年美債','00697B': '元大美債7-10','00720B': '元大投資級公司債',
            '2882': '國泰金','2881': '富邦金','2891': '中信金','2886': '兆豐金','2884': '玉山金','2885': '元大金','2892': '第一金','2887': '台新金','2883': '開發金','5880': '合庫金','2880': '華南金','2888': '新光金','2890': '永豐金','5876': '上海商銀','2801': '彰銀','2809': '京城銀',
            '2330': '台積電','2317': '鴻海','2454': '聯發科','2308': '台達電','3711': '日月光投控','2382': '廣達','2303': '聯電','2357': '華碩','2301': '光寶科','2395': '研華','2408': '南亞科','3008': '大立光','2409': '友達','2345': '智邦','2327': '國巨','3034': '聯詠','6669': '緯穎','6415': '矽力-KY','3017': '奇鋐','2376': '技嘉','2474': '可成','4904': '遠傳','4938': '和碩','2324': '仁寶','2356': '英業達','3231': '緯創','6770': '力積電','2371': '大同','2353': '宏碁','2377': '微星','3443': '創意','3661': '世芯-KY','6781': 'AES-KY','3529': '力旺','6533': '晶心科','2344': '華邦電','2337': '旺宏','2352': '佳世達','2354': '鴻準','2360': '致茂','2379': '瑞昱','2439': '美律','2449': '京元電子','2458': '義隆','6121': '新普','6176': '瑞儀','6239': '力成','6271': '同欣電','8046': '南電','2347': '聯強','2493': '揚博','3702': '大聯大','4943': '康控-KY','6116': '彩晶','6213': '聯茂','8131': '福懋科',
            '2412': '中華電','3045': '台灣大','1301': '台塑','1303': '南亞','1326': '台化','6505': '台塑化','1101': '台泥','1102': '亞泥','2002': '中鋼','2207': '和泰車','2105': '正新','2912': '統一超','1216': '統一','9904': '寶成','9910': '豐泰','2615': '萬海','2609': '陽明','2603': '長榮','5871': '中租-KY','9921': '巨大','2049': '上銀','1590': '亞德客-KY','2204': '中華','1476': '儒鴻','1477': '聚陽','2201': '裕隆','2227': '裕日車','2542': '興富發','5522': '遠雄','2535': '達欣工','9945': '潤泰新','2547': '日勝生',
            '1519': '華城','1503': '士電','1504': '東元','1513': '中興電','1516': '川飛','1537': '廣隆','2101': '南港','2102': '泰豐','1528': '恩德','1532': '勤美','1527': '鑽全','1538': '正峰新'
        };

        const US_STOCKS = {
            'AAPL': 'Apple','MSFT': 'Microsoft','GOOGL': 'Alphabet (Google)','GOOG': 'Alphabet (Google)','AMZN': 'Amazon','META': 'Meta (Facebook)','NVDA': 'NVIDIA','TSM': '台積電 ADR','TSLA': 'Tesla','NFLX': 'Netflix','AMD': 'AMD','INTC': 'Intel','CRM': 'Salesforce','ORCL': 'Oracle','ADBE': 'Adobe','AVGO': 'Broadcom','QCOM': 'Qualcomm','TXN': 'Texas Instruments','AMAT': 'Applied Materials','ASML': 'ASML','MU': 'Micron','LRCX': 'Lam Research','KLAC': 'KLA','SNPS': 'Synopsys','CDNS': 'Cadence','MRVL': 'Marvell','NXPI': 'NXP','ADI': 'Analog Devices',
            'JPM': 'JPMorgan Chase','BAC': 'Bank of America','WFC': 'Wells Fargo','C': 'Citigroup','GS': 'Goldman Sachs','MS': 'Morgan Stanley','BLK': 'BlackRock','SCHW': 'Charles Schwab','AXP': 'American Express','V': 'Visa','MA': 'Mastercard','PYPL': 'PayPal','SQ': 'Block (Square)',
            'JNJ': 'Johnson & Johnson','UNH': 'UnitedHealth','PFE': 'Pfizer','ABBV': 'AbbVie','TMO': 'Thermo Fisher','ABT': 'Abbott','MRK': 'Merck','LLY': 'Eli Lilly','DHR': 'Danaher','AMGN': 'Amgen','GILD': 'Gilead','BMY': 'Bristol Myers','ISRG': 'Intuitive Surgical','REGN': 'Regeneron',
            'BA': 'Boeing','CAT': 'Caterpillar','GE': 'General Electric','MMM': '3M','HON': 'Honeywell','UPS': 'UPS','LMT': 'Lockheed Martin','RTX': 'Raytheon','DE': 'Deere','XOM': 'Exxon Mobil','CVX': 'Chevron','COP': 'ConocoPhillips','SLB': 'Schlumberger','EOG': 'EOG Resources','PSX': 'Phillips 66','MPC': 'Marathon Petroleum','VLO': 'Valero','VST': 'Vistra','CEG': 'Constellation Energy','NEE': 'NextEra Energy','DUK': 'Duke Energy','SO': 'Southern Company','D': 'Dominion Energy','AEP': 'American Electric','EXC': 'Exelon',
            'WMT': 'Walmart','HD': 'Home Depot','COST': 'Costco','MCD': "McDonald's",'NKE': 'Nike','SBUX': 'Starbucks','TGT': 'Target','LOW': "Lowe's",'PG': 'Procter & Gamble','KO': 'Coca-Cola','PEP': 'PepsiCo','PM': 'Philip Morris','MO': 'Altria','CL': 'Colgate-Palmolive',
            'T': 'AT&T','VZ': 'Verizon','TMUS': 'T-Mobile','DIS': 'Disney','CMCSA': 'Comcast','CHTR': 'Charter',
            'SPY': 'SPDR S&P 500 ETF','QQQ': 'Nasdaq 100 ETF','VOO': 'Vanguard S&P 500','VTI': 'Vanguard Total Market','IVV': 'iShares S&P 500','VTV': 'Vanguard Value','VUG': 'Vanguard Growth','VO': 'Vanguard Mid-Cap','VB': 'Vanguard Small-Cap','SCHD': 'Schwab US Dividend','JEPI': 'JPMorgan Equity Premium','JEPQ': 'JPMorgan Nasdaq Premium','GLD': 'SPDR Gold Shares','SLV': 'iShares Silver','TLT': 'iShares 20+ Year Treasury','AGG': 'iShares Core Aggregate Bond','BND': 'Vanguard Total Bond','VNQ': 'Vanguard Real Estate','EEM': 'iShares MSCI Emerging','VWO': 'Vanguard FTSE Emerging',
            'BRK.B': 'Berkshire Hathaway','ONDS': 'Ondas Holdings','PLTR': 'Palantir Technologies','NBIS': 'Nebius Group','CAVA': 'CAVA Group'
        };

        function escHtml(str) {
            const d = document.createElement('div');
            d.textContent = str || '';
            return d.innerHTML;
        }
        function getDisplayName(companyName, symbol) {
            const name = companyName || symbol;
            return name.length > 20 ? symbol : name;
        }

        let filteredStocks = [];
        let autoRefreshInterval = null;

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const authDoc = await getDoc(doc(db, "config", "auth"));
                let allowedEmails = [];
                if (authDoc.exists() && authDoc.data().allowedemail) {
                    allowedEmails = authDoc.data().allowedemail;
                }
                if (allowedEmails.includes(user.email)) {
                    currentUser = user;
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('mainApp').classList.remove('hidden');
                    document.getElementById('userEmail').textContent = user.email;
                    // 並行載入所有資料
                    await Promise.all([loadStocks(), loadTransactions(), fetchExchangeRate(), typeof cfLoad==='function'?cfLoad():Promise.resolve()]);
                    // 資料就緒，渲染資產總覽
                    if(typeof dbRender==='function') dbRender();
                    if (document.getElementById('autoRefresh').checked) {
                        toggleAutoRefresh(true);
                    }
                } else {
                    alert('抱歉，您的 Email (' + user.email + ') 不在允許名單內，請使用允許的帳號登入。');
                    signOut(auth);
                }
            }
        });

        async function fetchStockInfo(symbol, region, retryCount = 0) {
            const maxRetries = 3;
            try {
                let apiSymbol = symbol;
                if (region === '台股') {
                    if (symbol.startsWith('00') && symbol.includes('B')) {
                        apiSymbol = symbol + '.TWO';
                    } else {
                        apiSymbol = symbol + '.TW';
                    }
                }
                const corsProxies = ['https://corsproxy.io/?','https://api.allorigins.win/raw?url=','https://api.codetabs.com/v1/proxy?quest='];
                const corsProxy = corsProxies[retryCount % corsProxies.length];
                const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${apiSymbol}`;
                const url = corsProxy + encodeURIComponent(apiUrl);
                const fetchWithTimeout = (url, timeout = 15000) => {
                    return Promise.race([
                        fetch(url, { method: 'GET' }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
                    ]);
                };
                const response = await fetchWithTimeout(url, 15000);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    const result = data.chart.result[0];
                    const meta = result.meta;
                    const price = meta.regularMarketPrice || meta.chartPreviousClose || meta.previousClose;
                    const previousClose = meta.chartPreviousClose || meta.previousClose;
                    let changePercent = 0;
                    if (previousClose && price && previousClose !== 0) {
                        changePercent = ((price - previousClose) / previousClose) * 100;
                    }
                    if (!price || price <= 0) throw new Error(`${symbol} 價格無效: ${price}`);
                    let companyName = symbol;
                    if (region === '台股') {
                        if (TAIWAN_STOCKS[symbol]) companyName = TAIWAN_STOCKS[symbol];
                    } else {
                        if (US_STOCKS[symbol]) companyName = US_STOCKS[symbol];
                        else companyName = meta.longName || meta.shortName || symbol;
                    }
                    return { price: Math.abs(price), companyName, changePercent };
                }
                throw new Error(`${symbol} 無法從 API 獲取數據`);
            } catch (error) {
                if (retryCount < maxRetries) {
                    const waitTime = (retryCount + 1) * 2000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return fetchStockInfo(symbol, region, retryCount + 1);
                }
                return null;
            }
        }

        async function fetchExchangeRate(retryCount = 0) {
            const maxRetries = 3;
            try {
                const corsProxy = 'https://api.allorigins.win/raw?url=';
                const apiUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/USDTWD=X';
                const url = corsProxy + encodeURIComponent(apiUrl);
                const response = await fetch(url, { method: 'GET', timeout: 10000 });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    const rate = data.chart.result[0].meta.regularMarketPrice || data.chart.result[0].meta.previousClose;
                    if (rate) {
                        document.getElementById('usdRate').value = Math.abs(rate).toFixed(2);
                        updateStats();
                        return true;
                    }
                }
                throw new Error('無法獲取匯率數據');
            } catch (error) {
                if (retryCount < maxRetries) {
                    const waitTime = (retryCount + 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return fetchExchangeRate(retryCount + 1);
                }
                return false;
            }
        }

        function getCompanyNameQuick(symbol, region) {
            if (region === '台股') return TAIWAN_STOCKS[symbol] || symbol;
            else return US_STOCKS[symbol] || symbol;
        }

        window.fetchCompanyName = async function() {
            const symbolInput = document.getElementById('newSymbol');
            const regionSelect = document.getElementById('newRegion');
            const companyInput = document.getElementById('newCompany');
            let symbol = symbolInput.value.toUpperCase().trim();
            if (!symbol) return;
            if (/^\d/.test(symbol)) regionSelect.value = '台股';
            else if (/^[A-Z]/.test(symbol)) regionSelect.value = '美股';
            const region = regionSelect.value;
            companyInput.value = '正在獲取...';
            const info = await fetchStockInfo(symbol, region);
            if (info) companyInput.value = info.companyName;
            else { companyInput.value = ''; alert(`❌ 無法獲取 ${symbol} 的資訊\n\n可能原因：\n1. 股票代號不正確\n2. 該股票已下市\n3. 網路連線問題\n\n系統已自動重試 3 次，請檢查代號後再試。`); }
        };

        window.calculateFromFields = function() {
            const costPriceInput = document.getElementById('newCostPrice');
            const sharesInput = document.getElementById('newShares');
            const costInput = document.getElementById('newCost');
            const costPrice = parseFloat(costPriceInput.value) || 0;
            const shares = parseFloat(sharesInput.value) || 0;
            const cost = parseFloat(costInput.value) || 0;
            if (costPrice && shares && !cost) costInput.value = (costPrice * shares).toFixed(2);
            else if (costPrice && cost && !shares) sharesInput.value = Math.floor(cost / costPrice);
            else if (shares && cost && !costPrice) costPriceInput.value = (cost / shares).toFixed(2);
            else if (costPrice && shares && cost) costInput.value = (costPrice * shares).toFixed(2);
        };
        window.calculateCost = window.calculateFromFields;
        window.calculateCostPrice = window.calculateFromFields;

        async function updateStockPrice(stockId, symbol, region) {
            const info = await fetchStockInfo(symbol, region);
            if (info && info.price) {
                const stockRef = doc(db, 'stocks', stockId);
                await updateDoc(stockRef, { currentPrice: info.price, changePercent: info.changePercent || 0, lastPriceUpdate: new Date().toISOString() });
            }
        }

        window.updateAllPricesAndRate = async function() {
            const button = event.target;
            button.disabled = true;
            button.innerHTML = '🔄 更新中...<span class="loading-spinner"></span>';
            try {
                await fetchExchangeRate();
                const uniqueStocksMap = new Map();
                stocks.forEach(stock => {
                    const key = `${stock.symbol}_${stock.region}`;
                    if (!uniqueStocksMap.has(key)) uniqueStocksMap.set(key, { symbol: stock.symbol, region: stock.region, relatedStocks: [] });
                    uniqueStocksMap.get(key).relatedStocks.push(stock.id);
                });
                const updatePromises = Array.from(uniqueStocksMap.entries()).map(async ([key, stockInfo]) => {
                    try {
                        const info = await fetchStockInfo(stockInfo.symbol, stockInfo.region);
                        if (info && info.price) {
                            await Promise.all(stockInfo.relatedStocks.map(stockId => {
                                const stockRef = doc(db, 'stocks', stockId);
                                return updateDoc(stockRef, { currentPrice: info.price, changePercent: info.changePercent || 0, lastPriceUpdate: new Date().toISOString() });
                            }));
                            return { success: true };
                        }
                        return { success: false };
                    } catch (error) { return { success: false }; }
                });
                await Promise.all(updatePromises);
            } catch (error) {
                alert('更新失敗：' + error.message);
            } finally {
                button.disabled = false;
                button.innerHTML = '🔄 更新';
                updateLastUpdateTime();
            }
        };

        window.toggleAutoRefresh = function(enabled) {
            if (enabled) {
                const now = new Date();
                const nextHour = new Date(now);
                nextHour.setHours(now.getHours() + 1, 0, 0, 0);
                const msUntilNextHour = nextHour - now;
                setTimeout(() => {
                    updateAllPricesAndRate();
                    autoRefreshInterval = setInterval(() => { updateAllPricesAndRate(); }, 3600000);
                }, msUntilNextHour);
            } else {
                if (autoRefreshInterval) { clearInterval(autoRefreshInterval); autoRefreshInterval = null; }
            }
        };

        function updateLastUpdateTime() {
            const now = new Date();
            document.getElementById('lastUpdate').textContent = `最後更新: ${now.toLocaleTimeString('zh-TW')}`;
        }

        window.applyFilters = function() {
            const regionFilter = document.getElementById('filterRegion').value;
            const holderFilter = document.getElementById('filterHolder').value;
            const platformFilter = document.getElementById('filterPlatform').value;
            filteredStocks = stocks.filter(stock => {
                const stockRegion = (stock.region || '').trim();
                const stockHolder = (stock.holder || '').trim();
                const stockPlatform = (stock.platform || '').trim();
                if (regionFilter && stockRegion !== regionFilter) return false;
                if (holderFilter && stockHolder !== holderFilter) return false;
                if (platformFilter && stockPlatform !== platformFilter) return false;
                return true;
            });
            renderStocks();
            updateStats();
        };

        window.clearFilters = function() {
            document.getElementById('filterRegion').value = '';
            document.getElementById('filterHolder').value = '';
            document.getElementById('filterPlatform').value = '';
            filteredStocks = [...stocks];
            renderStocks();
            updateStats();
        };

        window.loginWithGoogle = async () => {
            try { await signInWithPopup(auth, provider); } catch (error) { alert('登入失敗：' + error.message); }
        };

        window.logout = async () => {
            if (confirm('確定要登出嗎？')) {
                if (autoRefreshInterval) clearInterval(autoRefreshInterval);
                await auth.signOut();
            }
        };

        async function loadStocks() {
            const stocksRef = collection(db, 'stocks');
            onSnapshot(stocksRef, (snapshot) => {
                stocks = [];
                snapshot.forEach((doc) => { stocks.push({ id: doc.id, ...doc.data() }); });
                filteredStocks = [...stocks];
                renderStocks();
                updateStats();
            });
        }

        // ===== 分頁切換（3個Tab） =====
        window.switchTab = function(tabName) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(btn => { btn.classList.remove('active'); btn.classList.add('text-slate-400'); });
            if (tabName === 'overview') {
                document.getElementById('overviewTab').classList.add('active');
                document.getElementById('tabOverview').classList.add('active');
                document.getElementById('tabOverview').classList.remove('text-slate-400');
            } else if (tabName === 'detail') {
                document.getElementById('detailTab').classList.add('active');
                document.getElementById('tabDetail').classList.add('active');
                document.getElementById('tabDetail').classList.remove('text-slate-400');
            } else if (tabName === 'transactions') {
                document.getElementById('transactionsTab').classList.add('active');
                document.getElementById('tabTransactions').classList.add('active');
                document.getElementById('tabTransactions').classList.remove('text-slate-400');
                loadTransactions();
            } else if (tabName === 'cashflow') {
                document.getElementById('cashflowTab').classList.add('active');
                document.getElementById('tabCashflow').classList.add('active');
                document.getElementById('tabCashflow').classList.remove('text-slate-400');
                cfLoad();
            } else if (tabName === 'dashboard') {
                document.getElementById('dashboardTab').classList.add('active');
                document.getElementById('tabDashboard').classList.add('active');
                document.getElementById('tabDashboard').classList.remove('text-slate-400');
                dbRender();
            }
        };

        // ===== 補登表單收合 =====
        window.toggleImportForm = function() {
            const section = document.getElementById('importFormSection');
            const icon = document.getElementById('toggleImportIcon');
            if (section.classList.contains('hidden')) {
                section.classList.remove('hidden');
                icon.style.transform = 'rotate(180deg)';
            } else {
                section.classList.add('hidden');
                icon.style.transform = '';
            }
        };

        function getMergedStockStats() {
            const displayStocks = filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks;
            const merged = {};
            displayStocks.forEach(stock => {
                const key = `${stock.symbol}_${stock.region}`;
                if (!merged[key]) merged[key] = { symbol: stock.symbol, region: stock.region, companyName: stock.companyName, totalShares: 0, totalCost: 0, currentPrice: stock.currentPrice, changePercent: stock.changePercent || 0 };
                merged[key].totalShares += parseFloat(stock.shares) || 0;
                merged[key].totalCost += parseFloat(stock.investmentCost) || 0;
                if (stock.currentPrice) merged[key].currentPrice = stock.currentPrice;
                if (stock.changePercent !== undefined) merged[key].changePercent = stock.changePercent;
            });
            return Object.values(merged);
        }

        function renderSummaryTable() {
            const tbody = document.getElementById('summaryTableBody');
            tbody.innerHTML = '';
            const mergedStocks = getMergedStockStats();
            const usdRate = parseFloat(document.getElementById('usdRate').value) || 31.5;
            let totalPortfolioValueTWD = 0;
            mergedStocks.forEach(stock => {
                const currentValue = (parseFloat(stock.currentPrice) || 0) * stock.totalShares;
                totalPortfolioValueTWD += stock.region === '美股' ? currentValue * usdRate : currentValue;
            });
            mergedStocks.sort((a, b) => {
                const aVal = (parseFloat(a.currentPrice) || 0) * a.totalShares;
                const bVal = (parseFloat(b.currentPrice) || 0) * b.totalShares;
                const aValTWD = a.region === '美股' ? aVal * usdRate : aVal;
                const bValTWD = b.region === '美股' ? bVal * usdRate : bVal;
                return bValTWD - aValTWD;
            });
            mergedStocks.forEach(stock => {
                const avgCost = stock.totalShares > 0 ? stock.totalCost / stock.totalShares : 0;
                const currentPrice = Math.abs(parseFloat(stock.currentPrice) || 0);
                const currentValue = currentPrice * stock.totalShares;
                const valueTWD = stock.region === '美股' ? currentValue * usdRate : currentValue;
                const percentage = totalPortfolioValueTWD > 0 ? (valueTWD / totalPortfolioValueTWD * 100) : 0;
                const returnRate = avgCost > 0 ? ((currentPrice - avgCost) / avgCost * 100) : 0;
                let returnColor = 'text-slate-400', returnSymbol = '', priceColor = 'text-slate-100';
                if (returnRate > 0) { returnColor = 'text-green-400'; returnSymbol = '+'; priceColor = 'text-green-400'; }
                else if (returnRate < 0) { returnColor = 'text-red-400'; priceColor = 'text-red-400'; }
                const isBondETF = stock.symbol && stock.symbol.includes('B') && stock.symbol.startsWith('00');
                const currencySymbol = stock.region === '美股' ? 'USD' : 'TWD';
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-700 hover:bg-slate-800 transition-colors';
                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-slate-100 font-medium">${escHtml(stock.region)}</td>
                    <td class="px-4 py-3 text-center text-blue-400 font-mono font-bold">${escHtml(stock.symbol)}</td>
                    <td class="px-4 py-3 text-center">${isBondETF ? `<span class="text-slate-200">${escHtml(getDisplayName(stock.companyName, stock.symbol))}</span>` : `<button class="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-medium transition-colors summary-analysis-btn" data-symbol="${escHtml(stock.symbol)}" data-region="${escHtml(stock.region)}" data-company="${escHtml(stock.companyName || stock.symbol)}" data-cost="${stock.totalCost}" data-shares="${stock.totalShares}">${escHtml(getDisplayName(stock.companyName, stock.symbol))}</button>`}</td>
                    <td class="px-4 py-3 text-center text-slate-100 font-mono">${stock.totalShares.toLocaleString()}</td>
                    <td class="px-4 py-3 text-center text-slate-100 font-mono text-xs">${avgCost.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center text-slate-100 font-mono text-xs">${stock.totalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="px-4 py-3 text-center ${priceColor} font-mono font-semibold">${currentPrice.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center ${returnColor} font-mono font-bold">${returnSymbol}${returnRate.toFixed(2)}%</td>
                    <td class="px-4 py-3 text-center text-slate-100 font-mono text-xs"><div>${currencySymbol} ${currentValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div></td>
                    <td class="px-4 py-3 text-center text-green-400 font-mono font-bold">TWD ${valueTWD.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-2"><div class="w-24 bg-slate-700 rounded-full h-2.5"><div class="bg-gradient-to-r from-blue-500 to-green-500 h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div></div><span class="text-blue-400 font-bold font-mono min-w-[60px] text-right">${percentage.toFixed(1)}%</span></div></td>
                `;
                tbody.appendChild(tr);
            });
            document.querySelectorAll('.summary-analysis-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    openAnalysisModal(this.dataset.symbol, this.dataset.region, this.dataset.company, parseFloat(this.dataset.cost), parseFloat(this.dataset.shares));
                });
            });
            renderCharts(mergedStocks, usdRate, totalPortfolioValueTWD);
        }

        // ===== Chart.js 圖表 =====
        let chartInstances = {};
        function destroyChart(id) {
            if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
        }
        function renderCharts(mergedStocks, usdRate, totalValueTWD) {
            if (typeof Chart === 'undefined' || !mergedStocks.length) return;
            const COLORS = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#0ea5e9'];

            // — 1. 持股佔比圓餅圖 —
            const top8 = mergedStocks.slice(0, 8);
            const otherVal = mergedStocks.slice(8).reduce((s, st) => {
                const v = (parseFloat(st.currentPrice) || 0) * st.totalShares;
                return s + (st.region === '美股' ? v * usdRate : v);
            }, 0);
            const pieLabels = top8.map(s => s.companyName || s.symbol);
            const pieData = top8.map(s => {
                const v = (parseFloat(s.currentPrice) || 0) * s.totalShares;
                return Math.round(s.region === '美股' ? v * usdRate : v);
            });
            if (otherVal > 0) { pieLabels.push('其他'); pieData.push(Math.round(otherVal)); }
            destroyChart('chartAllocation');
            const ctx1 = document.getElementById('chartAllocation');
            if (ctx1) {
                chartInstances['chartAllocation'] = new Chart(ctx1, {
                    type: 'doughnut',
                    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: COLORS, borderColor: '#1a1916', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: {
                        legend: { position: 'right', labels: { color: '#ccc9bf', font: { size: 11 }, padding: 8, boxWidth: 12 } },
                        tooltip: { callbacks: { label: (c) => `${c.label}: TWD ${c.parsed.toLocaleString()} (${totalValueTWD > 0 ? (c.parsed / totalValueTWD * 100).toFixed(1) : 0}%)` } }
                    }}
                });
            }

            // — 2. 持有人資產分布 —
            const holderMap = {};
            (filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks).forEach(s => {
                const v = (parseFloat(s.currentPrice) || 0) * (parseFloat(s.shares) || 0);
                const vTWD = s.region === '美股' ? v * usdRate : v;
                holderMap[s.holder] = (holderMap[s.holder] || 0) + vTWD;
            });
            destroyChart('chartHolder');
            const ctx2 = document.getElementById('chartHolder');
            if (ctx2) {
                chartInstances['chartHolder'] = new Chart(ctx2, {
                    type: 'doughnut',
                    data: { labels: Object.keys(holderMap), datasets: [{ data: Object.values(holderMap).map(Math.round), backgroundColor: ['#2563eb','#10b981','#f59e0b','#8b5cf6'], borderColor: '#1a1916', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: {
                        legend: { position: 'right', labels: { color: '#ccc9bf', font: { size: 12 }, padding: 10, boxWidth: 14 } },
                        tooltip: { callbacks: { label: (c) => `${c.label}: TWD ${c.parsed.toLocaleString()}` } }
                    }}
                });
            }

            // — 3. 台股 vs 美股 —
            let twVal = 0, usVal = 0;
            mergedStocks.forEach(s => {
                const v = (parseFloat(s.currentPrice) || 0) * s.totalShares;
                if (s.region === '美股') usVal += v * usdRate; else twVal += v;
            });
            destroyChart('chartRegion');
            const ctx3 = document.getElementById('chartRegion');
            if (ctx3) {
                chartInstances['chartRegion'] = new Chart(ctx3, {
                    type: 'doughnut',
                    data: { labels: ['台股', '美股'], datasets: [{ data: [Math.round(twVal), Math.round(usVal)], backgroundColor: ['#2563eb', '#10b981'], borderColor: '#1a1916', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: {
                        legend: { position: 'right', labels: { color: '#ccc9bf', font: { size: 13 }, padding: 12, boxWidth: 14 } },
                        tooltip: { callbacks: { label: (c) => { const tot = twVal + usVal; return `${c.label}: TWD ${c.parsed.toLocaleString()} (${tot > 0 ? (c.parsed / tot * 100).toFixed(1) : 0}%)`; } } }
                    }}
                });
            }

            // — 4. 報酬率排行（橫條圖）—
            const returnData = mergedStocks.map(s => {
                const avg = s.totalShares > 0 ? s.totalCost / s.totalShares : 0;
                const cur = parseFloat(s.currentPrice) || 0;
                return { name: s.companyName || s.symbol, ret: avg > 0 ? ((cur - avg) / avg * 100) : 0 };
            }).sort((a, b) => b.ret - a.ret);
            destroyChart('chartReturn');
            const ctx4 = document.getElementById('chartReturn');
            if (ctx4) {
                chartInstances['chartReturn'] = new Chart(ctx4, {
                    type: 'bar',
                    data: {
                        labels: returnData.map(d => d.name.length > 8 ? d.name.slice(0, 8) + '..' : d.name),
                        datasets: [{ label: '報酬率 %', data: returnData.map(d => parseFloat(d.ret.toFixed(2))),
                            backgroundColor: returnData.map(d => d.ret >= 0 ? 'rgba(74,173,110,0.7)' : 'rgba(217,83,79,0.7)'),
                            borderColor: returnData.map(d => d.ret >= 0 ? '#4aad6e' : '#d9534f'), borderWidth: 1, borderRadius: 3
                        }]
                    },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => `${c.parsed.x >= 0 ? '+' : ''}${c.parsed.x}%` } }
                    }, scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#9a9890', callback: (v) => v + '%' } },
                        y: { grid: { display: false }, ticks: { color: '#ccc9bf', font: { size: 11 } } }
                    }}
                });
            }
        }

        function renderStocks() {
            const tbody = document.getElementById('stockTableBody');
            const addRow = tbody.querySelector('tr');
            tbody.innerHTML = '';
            tbody.appendChild(addRow);
            const displayStocks = filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks;
            displayStocks.forEach(stock => {
                stock.shares = parseFloat(stock.shares) || 0;
                stock.investmentCost = parseFloat(stock.investmentCost) || 0;
                stock.currentPrice = Math.abs(parseFloat(stock.currentPrice) || 0);
                stock.companyName = stock.companyName || '';
                const calc = calculateFields(stock);
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-700 hover:bg-slate-750';
                const lastUpdate = stock.lastPriceUpdate ? new Date(stock.lastPriceUpdate).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未更新';
                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-slate-300">${escHtml(stock.region || '')}</td>
                    <td class="px-3 py-3 text-center text-slate-200 font-medium">${escHtml(getDisplayName(stock.companyName, stock.symbol))}</td>
                    <td class="px-3 py-3 text-center text-slate-100 font-mono font-semibold">${escHtml(stock.symbol)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono">${stock.shares.toLocaleString()}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono text-xs">${calc.costPrice.toFixed(2)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono text-xs">${stock.investmentCost.toLocaleString()}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono text-xs" title="最後更新: ${escHtml(lastUpdate)}">${Math.abs(stock.currentPrice).toFixed(2)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono text-xs">${calc.currentValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="px-3 py-3 text-center font-mono font-semibold ${calc.returnRate >= 0 ? 'text-green-400' : 'text-red-400'}">${calc.returnRate >= 0 ? '+' : ''}${calc.returnRate.toFixed(2)}%</td>
                    <td class="px-3 py-3 text-center text-slate-300">${escHtml(stock.holder)}</td>
                    <td class="px-3 py-3 text-center text-slate-300">${escHtml(stock.platform)}</td>
                    <td class="px-3 py-3 text-center no-print">
                        <div class="flex gap-2 justify-center flex-wrap">
                            <button onclick="openBuyModal('${escHtml(stock.id)}', '${escHtml(stock.symbol)}', '${escHtml(stock.companyName || stock.symbol)}', ${stock.shares}, ${calc.costPrice})" style="display:inline-flex;align-items:center;gap:4px;background:#2d5a1b;color:#7ed957;border:1px solid #4a8a2a;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.04em" title="買入">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L9 8H1L5 1Z" fill="#7ed957"/></svg>BUY
                            </button>
                            <button onclick="openSellModal('${escHtml(stock.id)}', '${escHtml(stock.symbol)}', '${escHtml(stock.companyName || stock.symbol)}', ${stock.shares})" style="display:inline-flex;align-items:center;gap:4px;background:#5a1b1b;color:#f05a7e;border:1px solid #8a2a3a;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.04em" title="賣出">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 9L9 2H1L5 9Z" fill="#f05a7e"/></svg>SELL
                            </button>
                            <button onclick="deleteStock('${stock.id}')" class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900 hover:bg-opacity-20 transition-colors text-sm">✕</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            renderSummaryTable();
        }

        function calculateFields(stock) {
            const usdRate = parseFloat(document.getElementById('usdRate').value) || 31.5;
            const shares = parseFloat(stock.shares) || 0;
            const investmentCost = parseFloat(stock.investmentCost) || 0;
            const currentPrice = Math.abs(parseFloat(stock.currentPrice) || 0);
            const costPrice = shares > 0 ? investmentCost / shares : 0;
            const currentValue = currentPrice * shares;
            const returnRate = investmentCost > 0 ? ((currentValue - investmentCost) / investmentCost) * 100 : 0;
            const currentValueTWD = stock.region === '美股' ? currentValue * usdRate : currentValue;
            const investmentCostTWD = stock.region === '美股' ? investmentCost * usdRate : investmentCost;
            return { costPrice, currentPrice, currentValue, currentValueTWD, investmentCostTWD, returnRate };
        }

        window.updateStats = function() {
            const usdRate = parseFloat(document.getElementById('usdRate').value) || 31.5;
            let totalCost = 0, totalValue = 0;
            const displayStocks = filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks;
            displayStocks.forEach(stock => {
                const calc = calculateFields(stock);
                totalCost += calc.investmentCostTWD;
                totalValue += calc.currentValueTWD;
            });
            const profit = totalValue - totalCost;
            const returnRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
            document.getElementById('totalCost').textContent = 'TWD ' + totalCost.toLocaleString(undefined, {maximumFractionDigits: 0});
            document.getElementById('totalValue').textContent = 'TWD ' + totalValue.toLocaleString(undefined, {maximumFractionDigits: 0});
            document.getElementById('totalProfit').textContent = 'TWD ' + profit.toLocaleString(undefined, {maximumFractionDigits: 0});
            document.getElementById('totalProfit').className = 'text-2xl font-bold ' + (profit >= 0 ? 'text-green-400' : 'text-red-400');
            document.getElementById('totalReturn').textContent = (returnRate >= 0 ? '+' : '') + returnRate.toFixed(2) + '%';
            document.getElementById('totalReturn').className = 'text-2xl font-bold ' + (returnRate >= 0 ? 'text-green-400' : 'text-red-400');

            // 年度報酬率 — 動態年份，基準值可從 Firebase config 讀取
            const thisYear = new Date().getFullYear();
            const lastYear = thisYear - 1;
            const BASE_VALUES = { 2025: 8819244 }; // 每年底市值基準，可擴充
            const baseValue = BASE_VALUES[lastYear] || 0;

            // 更新 HTML 標題
            const thisYearLbl = document.getElementById('thisYearLabel');
            if (thisYearLbl) thisYearLbl.textContent = thisYear + ' 年報酬率';
            const thisYearBaseEl = document.getElementById('thisYearBase');
            if (thisYearBaseEl) thisYearBaseEl.textContent = baseValue > 0 ? `基準：${lastYear}年底 TWD ${baseValue.toLocaleString()}` : '尚未設定基準值';
            const lastYearTitleEl = document.getElementById('lastYearTitle');
            if (lastYearTitleEl) lastYearTitleEl.textContent = lastYear + ' 年報酬率（已實現損益）';

            let thisYearNetInflow = 0, lastYearRealizedProfit = 0, lastYearBuyCost = 0;
            transactions.forEach(tx => {
                const txYear = new Date(tx.date).getFullYear();
                const amountTWD = tx.region === '美股' ? (tx.amount || 0) * usdRate : (tx.amount || 0);
                if (txYear === thisYear) {
                    if (tx.type === '買入') thisYearNetInflow += amountTWD;
                    else if (tx.type === '賣出') thisYearNetInflow -= amountTWD;
                }
                if (txYear === lastYear) {
                    if (tx.type === '賣出' && tx.realizedProfit !== undefined) {
                        lastYearRealizedProfit += tx.region === '美股' ? tx.realizedProfit * usdRate : tx.realizedProfit;
                    }
                    if (tx.type === '買入') lastYearBuyCost += amountTWD;
                }
            });
            if (baseValue > 0) {
                const thisYearGain = totalValue - baseValue - thisYearNetInflow;
                const thisYearReturnRate = (thisYearGain / baseValue) * 100;
                const thisYearColor = thisYearReturnRate >= 0 ? 'text-green-400' : 'text-red-400';
                const thisYearSign = thisYearReturnRate >= 0 ? '+' : '';
                document.getElementById('thisYearReturn').textContent = thisYearSign + thisYearReturnRate.toFixed(2) + '%';
                document.getElementById('thisYearReturn').className = 'text-2xl font-bold ' + thisYearColor;
                document.getElementById('thisYearDetail').textContent = `目前市值 ${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})} ｜ 今年淨投入 ${thisYearNetInflow.toLocaleString(undefined,{maximumFractionDigits:0})} ｜ 獲利 ${thisYearGain.toLocaleString(undefined,{maximumFractionDigits:0})}`;
            } else {
                document.getElementById('thisYearReturn').textContent = '—';
                document.getElementById('thisYearReturn').className = 'text-2xl font-bold text-slate-500';
                document.getElementById('thisYearDetail').textContent = `尚未設定 ${lastYear} 年底基準市值`;
            }
            if (lastYearBuyCost > 0) {
                const lastYearReturnRate = (lastYearRealizedProfit / lastYearBuyCost) * 100;
                const lastYearColor = lastYearReturnRate >= 0 ? 'text-green-400' : 'text-red-400';
                document.getElementById('lastYearReturn').textContent = (lastYearReturnRate >= 0 ? '+' : '') + lastYearReturnRate.toFixed(2) + '%';
                document.getElementById('lastYearReturn').className = 'text-2xl font-bold ' + lastYearColor;
                document.getElementById('lastYearDetail').textContent = `已實現損益 TWD ${lastYearRealizedProfit.toLocaleString(undefined,{maximumFractionDigits:0})} ｜ 買入成本 TWD ${lastYearBuyCost.toLocaleString(undefined,{maximumFractionDigits:0})}`;
            } else {
                document.getElementById('lastYearReturn').textContent = '無交易記錄';
                document.getElementById('lastYearReturn').className = 'text-2xl font-bold text-slate-500';
                document.getElementById('lastYearDetail').textContent = `${lastYear}年無買入交易記錄`;
            }
        };

        window.addStock = async () => {
            const region = document.getElementById('newRegion').value;
            const companyName = document.getElementById('newCompany').value;
            const symbol = document.getElementById('newSymbol').value.toUpperCase().trim();
            const shares = parseFloat(document.getElementById('newShares').value);
            const costPrice = parseFloat(document.getElementById('newCostPrice').value);
            const investmentCost = parseFloat(document.getElementById('newCost').value);
            const holder = document.getElementById('newHolder').value;
            const platform = document.getElementById('newPlatform').value;
            if (!symbol || !shares || !holder) { alert('請填寫股票代號、股數和持有人'); return; }
            if (!costPrice && !investmentCost) { alert('請填寫成本價或投資成本'); return; }
            let finalCostPrice = costPrice, finalInvestmentCost = investmentCost;
            if (!finalCostPrice && finalInvestmentCost) finalCostPrice = finalInvestmentCost / shares;
            else if (finalCostPrice && !finalInvestmentCost) finalInvestmentCost = finalCostPrice * shares;
            const addButton = event.target;
            const originalText = addButton.innerHTML;
            addButton.disabled = true; addButton.innerHTML = '⏳ 獲取股價中...';
            const info = await fetchStockInfo(symbol, region);
            if (!info || !info.price) {
                addButton.disabled = false; addButton.innerHTML = originalText;
                alert(`❌ 無法獲取 ${symbol} 的股價\n\n系統已自動重試 3 次，請檢查後再試。`); return;
            }
            const finalCompanyName = companyName || info.companyName;
            try {
                addButton.innerHTML = '⏳ 儲存中...';
                await addDoc(collection(db, 'stocks'), { region, companyName: finalCompanyName, symbol, shares, investmentCost: finalInvestmentCost, currentPrice: Math.abs(info.price), changePercent: info.changePercent || 0, holder, platform, createdAt: new Date().toISOString(), createdBy: currentUser.email, lastPriceUpdate: new Date().toISOString() });
                document.getElementById('newCompany').value = ''; document.getElementById('newSymbol').value = ''; document.getElementById('newShares').value = ''; document.getElementById('newCostPrice').value = ''; document.getElementById('newCost').value = ''; document.getElementById('newHolder').value = '';
                addButton.disabled = false; addButton.innerHTML = originalText;
                alert(`✅ 新增成功！\n\n${finalCompanyName} (${symbol})\n股數: ${shares}\n現價: ${Math.abs(info.price).toFixed(2)}`);
            } catch (error) {
                addButton.disabled = false; addButton.innerHTML = originalText;
                alert('❌ 新增失敗：' + error.message);
            }
        };

        let sortConfig = { key: null, direction: 'asc' };
        window.sortTable = function(key) {
            if (sortConfig.key === key) sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            else { sortConfig.key = key; sortConfig.direction = 'asc'; }
            document.querySelectorAll('.sort-indicator').forEach(el => { el.textContent = '↕'; el.classList.remove('text-blue-400'); });
            const indicator = document.getElementById(`sort-${key}`);
            if (indicator) { indicator.textContent = sortConfig.direction === 'asc' ? '↑' : '↓'; indicator.classList.add('text-blue-400'); }
            const displayStocks = filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks;
            const sortedStocks = [...displayStocks].sort((a, b) => {
                let aVal, bVal;
                switch(key) {
                    case 'costPrice': aVal = a.shares > 0 ? a.investmentCost / a.shares : 0; bVal = b.shares > 0 ? b.investmentCost / b.shares : 0; break;
                    case 'currentValue': aVal = (parseFloat(a.currentPrice) || 0) * (parseFloat(a.shares) || 0); bVal = (parseFloat(b.currentPrice) || 0) * (parseFloat(b.shares) || 0); break;
                    case 'returnRate': const aCost = a.shares > 0 ? a.investmentCost / a.shares : 0; const bCost = b.shares > 0 ? b.investmentCost / b.shares : 0; aVal = aCost > 0 ? ((parseFloat(a.currentPrice) - aCost) / aCost) * 100 : 0; bVal = bCost > 0 ? ((parseFloat(b.currentPrice) - bCost) / bCost) * 100 : 0; break;
                    case 'shares': case 'investmentCost': case 'currentPrice': aVal = parseFloat(a[key]) || 0; bVal = parseFloat(b[key]) || 0; break;
                    default: aVal = (a[key] || '').toString().toLowerCase(); bVal = (b[key] || '').toString().toLowerCase();
                }
                if (typeof aVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                else { if (sortConfig.direction === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0; else return aVal > bVal ? -1 : aVal < bVal ? 1 : 0; }
            });
            if (filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value) filteredStocks = sortedStocks;
            else stocks = sortedStocks;
            renderStocks();
        };

        window.deleteStock = async (id) => {
            if (!confirm('確定要刪除嗎？')) return;
            try { await deleteDoc(doc(db, 'stocks', id)); } catch (error) { alert('刪除失敗：' + error.message); }
        };

        window.updateStockPrice = updateStockPrice;

        window.exportToExcel = () => {
            const displayStocks = filteredStocks.length > 0 || document.getElementById('filterRegion').value || document.getElementById('filterHolder').value || document.getElementById('filterPlatform').value ? filteredStocks : stocks;
            const data = displayStocks.map(stock => {
                const calc = calculateFields(stock);
                return { 地區: stock.region, 公司名稱: stock.companyName || stock.symbol, 股票代號: stock.symbol, 股數: stock.shares, 成本股價: calc.costPrice.toFixed(2), 投資成本: stock.investmentCost, 現價: Math.abs(stock.currentPrice).toFixed(2), 現值: calc.currentValue.toFixed(2), 報酬率: calc.returnRate.toFixed(2) + '%', 持有人: stock.holder, 持有平台: stock.platform, 最後更新: stock.lastPriceUpdate || '' };
            });
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '投資組合');
            XLSX.writeFile(wb, `投資組合_${new Date().toISOString().split('T')[0]}.xlsx`);
        };

        window.openMobileForm = function() { document.getElementById('mobileFormOverlay').style.display = 'flex'; document.body.style.overflow = 'hidden'; };
        window.closeMobileForm = function(event) {
            if (!event || event.target.id === 'mobileFormOverlay') {
                document.getElementById('mobileFormOverlay').style.display = 'none';
                document.body.style.overflow = '';
                clearMobileForm();
            }
        };
        function clearMobileForm() {
            document.getElementById('mobileSymbol').value = ''; document.getElementById('mobileCompany').value = ''; document.getElementById('mobileShares').value = ''; document.getElementById('mobileCostPrice').value = ''; document.getElementById('mobileCost').value = ''; document.getElementById('mobileHolder').value = '';
        }
        window.fetchCompanyNameMobile = async function() {
            const symbolInput = document.getElementById('mobileSymbol');
            const regionSelect = document.getElementById('mobileRegion');
            const companyInput = document.getElementById('mobileCompany');
            let symbol = symbolInput.value.toUpperCase().trim();
            if (!symbol) return;
            if (/^\d/.test(symbol)) regionSelect.value = '台股';
            else if (/^[A-Z]/.test(symbol)) regionSelect.value = '美股';
            const region = regionSelect.value;
            companyInput.value = '正在獲取...';
            const info = await fetchStockInfo(symbol, region);
            if (info) companyInput.value = info.companyName;
            else { companyInput.value = ''; alert(`❌ 無法獲取 ${symbol} 的資訊\n\n系統已自動重試 3 次。`); }
        };
        window.calculateCostMobile = function() {
            const costPriceInput = document.getElementById('mobileCostPrice');
            const sharesInput = document.getElementById('mobileShares');
            const costInput = document.getElementById('mobileCost');
            const costPrice = parseFloat(costPriceInput.value) || 0;
            const shares = parseFloat(sharesInput.value) || 0;
            const cost = parseFloat(costInput.value) || 0;
            if (costPrice && shares && !cost) costInput.value = (costPrice * shares).toFixed(2);
            else if (costPrice && cost && !shares) sharesInput.value = Math.floor(cost / costPrice);
            else if (shares && cost && !costPrice) costPriceInput.value = (cost / shares).toFixed(2);
            else if (costPrice && shares && cost) costInput.value = (costPrice * shares).toFixed(2);
        };
        window.calculateCostPriceMobile = window.calculateCostMobile;
        window.addStockMobile = async function() {
            const region = document.getElementById('mobileRegion').value;
            const companyName = document.getElementById('mobileCompany').value;
            const symbol = document.getElementById('mobileSymbol').value.toUpperCase().trim();
            const shares = parseFloat(document.getElementById('mobileShares').value);
            const costPrice = parseFloat(document.getElementById('mobileCostPrice').value);
            const investmentCost = parseFloat(document.getElementById('mobileCost').value);
            const holder = document.getElementById('mobileHolder').value;
            const platform = document.getElementById('mobilePlatform').value;
            if (!symbol || !shares || !holder) { alert('請填寫股票代號、股數和持有人'); return; }
            if (!costPrice && !investmentCost) { alert('請填寫成本價或投資成本'); return; }
            let finalCostPrice = costPrice, finalInvestmentCost = investmentCost;
            if (!finalCostPrice && finalInvestmentCost) finalCostPrice = finalInvestmentCost / shares;
            else if (finalCostPrice && !finalInvestmentCost) finalInvestmentCost = finalCostPrice * shares;
            const addButton = event.target;
            const originalText = addButton.innerHTML;
            addButton.disabled = true; addButton.innerHTML = '⏳ 獲取股價中...';
            const info = await fetchStockInfo(symbol, region);
            if (!info || !info.price) { addButton.disabled = false; addButton.innerHTML = originalText; alert(`❌ 無法獲取 ${symbol} 的股價\n\n系統已自動重試 3 次\n請檢查股票代號後再試`); return; }
            const finalCompanyName = companyName || info.companyName;
            try {
                addButton.innerHTML = '⏳ 儲存中...';
                await addDoc(collection(db, 'stocks'), { region, companyName: finalCompanyName, symbol, shares, investmentCost: finalInvestmentCost, currentPrice: Math.abs(info.price), changePercent: info.changePercent || 0, holder, platform, createdAt: new Date().toISOString(), createdBy: currentUser.email, lastPriceUpdate: new Date().toISOString() });
                closeMobileForm();
                addButton.disabled = false; addButton.innerHTML = originalText;
                alert(`✅ 新增成功！\n\n${finalCompanyName} (${symbol})\n股數: ${shares}\n現價: ${Math.abs(info.price).toFixed(2)}`);
            } catch (error) { addButton.disabled = false; addButton.innerHTML = originalText; alert('❌ 新增失敗：' + error.message); }
        };

        // ===== 分析模態框 =====
        window.openAnalysisModal = async function(symbol, region, companyName, investmentCost, shares) {
            const modal = document.getElementById('analysisModal');
            const content = document.getElementById('analysisContent');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            content.innerHTML = `<div class="p-6"><div class="flex items-center justify-between mb-6"><h2 class="text-2xl font-bold text-slate-100">${companyName} (${symbol})</h2><button onclick="closeAnalysisModal()" class="text-slate-400 hover:text-slate-200 text-3xl">&times;</button></div><div class="text-center py-12"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div><p class="text-slate-400">正在獲取分析數據...</p></div></div>`;
            try {
                const [data3y, data5y, data10y] = await Promise.all([fetchAnalysisData(symbol, region, '3y'), fetchAnalysisData(symbol, region, '5y'), fetchAnalysisData(symbol, region, '10y')]);
                displayAnalysisResults(symbol, region, companyName, investmentCost, shares, { '3y': data3y, '5y': data5y, '10y': data10y });
            } catch (error) {
                content.innerHTML = `<div class="p-6"><div class="flex items-center justify-between mb-6"><h2 class="text-2xl font-bold text-slate-100">${companyName} (${symbol})</h2><button onclick="closeAnalysisModal()" class="text-slate-400 hover:text-slate-200 text-3xl">&times;</button></div><div class="text-center py-12"><p class="text-red-400 text-lg">❌ 無法獲取分析數據</p><p class="text-slate-400 mt-2">${error.message}</p></div></div>`;
            }
        };
        window.closeAnalysisModal = function() { document.getElementById('analysisModal').style.display = 'none'; document.body.style.overflow = ''; };

        async function fetchAnalysisData(symbol, region, range) {
            let apiSymbol = symbol;
            if (region === '台股') { if (symbol.startsWith('00') && symbol.includes('B')) apiSymbol = symbol + '.TWO'; else apiSymbol = symbol + '.TW'; }
            const corsProxy = 'https://api.allorigins.win/raw?url=';
            const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${apiSymbol}?interval=1d&range=${range}`;
            const response = await fetch(corsProxy + encodeURIComponent(apiUrl));
            const data = await response.json();
            if (!data.chart || !data.chart.result || !data.chart.result[0]) throw new Error('無法獲取數據');
            const result = data.chart.result[0];
            const closes = result.indicators.quote[0].close.filter(v => v !== null);
            const returns = [];
            for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i-1]) / closes[i-1]);
            const avgDailyReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const annualizedReturn = Math.pow(1 + avgDailyReturn, 252) - 1;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / returns.length;
            const annualizedStdDev = Math.sqrt(variance) * Math.sqrt(252);
            const riskFreeRate = region === '美股' ? 0.045 : 0.015;
            const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedStdDev;
            let maxDrawdown = 0, peak = closes[0];
            for (let price of closes) { if (price > peak) peak = price; const drawdown = (peak - price) / peak; if (drawdown > maxDrawdown) maxDrawdown = drawdown; }
            const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];
            return { totalReturn, annualizedReturn, annualizedStdDev, sharpeRatio, maxDrawdown, tradingDays: closes.length, riskFreeRate };
        }

        function displayAnalysisResults(symbol, region, companyName, investmentCost, shares, dataByPeriod) {
            const content = document.getElementById('analysisContent');
            const getSharpeGrade = (sharpe) => {
                if (sharpe < 0) return { grade: '很差', color: 'text-red-400', icon: '🔴' };
                if (sharpe < 1) return { grade: '普通', color: 'text-yellow-400', icon: '🟡' };
                if (sharpe < 2) return { grade: '良好', color: 'text-green-400', icon: '🟢' };
                if (sharpe < 3) return { grade: '優秀', color: 'text-blue-400', icon: '🔵' };
                return { grade: '卓越', color: 'text-purple-400', icon: '🟣' };
            };
            content.innerHTML = `<div class="p-6">
                <div class="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-500">
                    <div><h2 class="text-3xl font-bold text-slate-100 mb-1">${companyName}</h2><p class="text-slate-400"><span class="font-mono text-blue-400">${symbol}</span><span class="mx-2">|</span><span>${region}</span></p></div>
                    <button onclick="closeAnalysisModal()" class="text-slate-400 hover:text-slate-200 text-3xl leading-none">&times;</button>
                </div>
                <div class="mb-6">
                    <h3 class="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2"><span>📊</span><span>夏普值分析（Sharpe Ratio）</span></h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${['3y', '5y', '10y'].map(period => {
                            const data = dataByPeriod[period];
                            if (!data) return '<div class="bg-slate-700 rounded-lg p-4 text-center text-slate-500">數據不足</div>';
                            const g = getSharpeGrade(data.sharpeRatio);
                            return `<div class="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 border-2 ${g.color.replace('text-', 'border-')}">
                                <div class="text-center mb-3">
                                    <div class="text-sm text-slate-400 mb-1">${period === '3y' ? '3 年' : period === '5y' ? '5 年' : '10 年'}期</div>
                                    <div class="text-4xl font-bold ${g.color} mb-1">${data.sharpeRatio.toFixed(3)}</div>
                                    <div class="text-sm ${g.color} font-semibold flex items-center justify-center gap-1"><span>${g.icon}</span><span>${g.grade}</span></div>
                                </div>
                                <div class="space-y-1 text-xs text-slate-300 border-t border-slate-600 pt-3">
                                    <div class="flex justify-between"><span>年化報酬</span><span class="${data.annualizedReturn >= 0 ? 'text-green-400' : 'text-red-400'} font-bold">${(data.annualizedReturn * 100).toFixed(2)}%</span></div>
                                    <div class="flex justify-between"><span>年化波動</span><span class="text-yellow-400">${(data.annualizedStdDev * 100).toFixed(2)}%</span></div>
                                    <div class="flex justify-between"><span>最大回撤</span><span class="text-red-400">${(data.maxDrawdown * 100).toFixed(2)}%</span></div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-slate-700 rounded-lg p-4"><h4 class="font-bold text-slate-100 mb-3 flex items-center gap-2"><span>📈</span><span>報酬率比較</span></h4><div class="space-y-3">${['3y','5y','10y'].map(p => { const d = dataByPeriod[p]; if (!d) return ''; return `<div><div class="flex justify-between text-sm mb-1"><span class="text-slate-400">${p==='3y'?'3 年':p==='5y'?'5 年':'10 年'}</span><span class="${d.totalReturn>=0?'text-green-400':'text-red-400'} font-bold">${d.totalReturn>=0?'+':''}${(d.totalReturn*100).toFixed(2)}%</span></div><div class="flex justify-between text-xs text-slate-400"><span>年化</span><span class="${d.annualizedReturn>=0?'text-green-400':'text-red-400'}">${(d.annualizedReturn*100).toFixed(2)}%</span></div></div>`; }).join('')}</div></div>
                    <div class="bg-slate-700 rounded-lg p-4"><h4 class="font-bold text-slate-100 mb-3 flex items-center gap-2"><span>⚠️</span><span>風險指標比較</span></h4><div class="space-y-3">${['3y','5y','10y'].map(p => { const d = dataByPeriod[p]; if (!d) return ''; return `<div><div class="flex justify-between text-sm mb-1"><span class="text-slate-400">${p==='3y'?'3 年':p==='5y'?'5 年':'10 年'}</span><span class="text-yellow-400 font-bold">${(d.annualizedStdDev*100).toFixed(2)}%</span></div><div class="flex justify-between text-xs text-slate-400"><span>最大回撤</span><span class="text-red-400">${(d.maxDrawdown*100).toFixed(2)}%</span></div></div>`; }).join('')}</div></div>
                </div>
                <div class="mt-6 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4"><h4 class="font-bold text-blue-300 mb-2 flex items-center gap-2"><span>💡</span><span>關於夏普值</span></h4><div class="text-sm text-slate-300 space-y-1"><p><strong>夏普值</strong> = (年化報酬率 - 無風險利率) / 年化波動率</p><p>數值越高，代表每承擔一單位風險所獲得的超額報酬越多。</p><p class="text-xs text-slate-400 mt-2">註：本分析基於歷史數據，過去表現不代表未來結果。投資前請審慎評估。</p></div></div>
            </div>`;
        }

        // ===== 新增股票 Modal =====
        let currentBuyStockId = null, currentSellStockId = null;

        window.openAddStockModal = function() {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('addStockForm').reset();
            document.getElementById('newDate').value = today;
            document.getElementById('newCompany').value = '';
            document.getElementById('newTotalCost').value = '';
            document.getElementById('addStockModal').style.display = 'flex';
        };
        window.closeAddStockModal = function() { document.getElementById('addStockModal').style.display = 'none'; };
        window.calculateNewCost = function() {
            const shares = parseFloat(document.getElementById('newShares').value) || 0;
            const price = parseFloat(document.getElementById('newCostPrice').value) || 0;
            const fee = parseFloat(document.getElementById('newFee').value) || 0;
            document.getElementById('newTotalCost').value = (shares * price + fee).toFixed(2);
        };
        window.fetchNewCompanyName = async function() {
            const symbolInput = document.getElementById('newSymbol');
            const regionSelect = document.getElementById('newRegion');
            const companyInput = document.getElementById('newCompany');
            let symbol = symbolInput.value.toUpperCase().trim();
            if (!symbol) return;
            const region = regionSelect.value;
            const quickName = getCompanyNameQuick(symbol, region);
            companyInput.value = quickName !== symbol ? quickName : '查詢中...';
            try {
                const info = await fetchStockInfo(symbol, region);
                if (info && info.companyName && info.companyName !== symbol) companyInput.value = info.companyName;
            } catch (error) { if (companyInput.value === '查詢中...') companyInput.value = quickName; }
        };
        window.confirmAddStock = async function(event) {
            const date = document.getElementById('newDate').value;
            const region = document.getElementById('newRegion').value;
            const symbol = document.getElementById('newSymbol').value.toUpperCase().trim();
            const companyName = document.getElementById('newCompany').value.trim() || symbol;
            const shares = parseFloat(document.getElementById('newShares').value);
            const costPrice = parseFloat(document.getElementById('newCostPrice').value);
            const fee = parseFloat(document.getElementById('newFee').value) || 0;
            const holder = document.getElementById('newHolder').value;
            const platform = document.getElementById('newPlatform').value;
            if (!date || !region || !symbol || !shares || !costPrice || !holder || !platform) { alert('請填寫所有必填欄位（標記 * 的欄位）'); return; }
            const btn = event ? event.target : document.querySelector('button[onclick*="confirmAddStock"]');
            if (!btn) return;
            const originalText = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '⏳ 處理中...';
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('操作超時（30秒）')), 30000));
            const addStockPromise = (async () => {
                const totalCost = shares * costPrice + fee;
                let currentPrice = costPrice, changePercent = 0;
                try {
                    const info = await Promise.race([fetchStockInfo(symbol, region), new Promise((_, reject) => setTimeout(() => reject(new Error('Overall timeout')), 20000))]);
                    if (info && info.price) { currentPrice = Math.abs(info.price); changePercent = info.changePercent || 0; }
                } catch (priceError) { console.warn('使用成本價代替:', priceError.message); }
                await addDoc(collection(db, 'transactions'), { date: new Date(date + 'T12:00:00').toISOString(), type: '買入', symbol, companyName, shares, price: costPrice, fee, tax: 0, amount: totalCost, holder, platform, region, createdBy: currentUser.email, createdAt: new Date().toISOString() });
                const existingStock = stocks.find(s => s.symbol === symbol && s.holder === holder && s.platform === platform && s.region === region);
                if (existingStock) {
                    await updateDoc(doc(db, 'stocks', existingStock.id), { shares: parseFloat(existingStock.shares) + shares, investmentCost: parseFloat(existingStock.investmentCost) + totalCost, currentPrice, changePercent, lastModified: new Date().toISOString(), modifiedBy: currentUser.email, lastPriceUpdate: new Date().toISOString() });
                } else {
                    await addDoc(collection(db, 'stocks'), { region, companyName, symbol, shares, investmentCost: totalCost, currentPrice, changePercent, holder, platform, createdAt: new Date().toISOString(), createdBy: currentUser.email, lastPriceUpdate: new Date().toISOString() });
                }
                alert(`✅ 新增成功！\n\n股票：${symbol} - ${companyName}\n股數：${shares}\n價格：${costPrice}\n手續費：${fee}\n總成本：${totalCost.toFixed(2)}\n\n已自動記錄到交易明細`);
                closeAddStockModal();
                await loadStocks();
            })();
            try {
                await Promise.race([addStockPromise, timeoutPromise]);
                btn.disabled = false; btn.innerHTML = originalText;
            } catch (error) {
                btn.disabled = false; btn.innerHTML = originalText;
                alert('❌ 新增失敗：' + error.message + '\n\n請檢查網路連線或稍後再試');
            }
        };

        // ===== 買入 Modal =====
        window.openBuyModal = function(stockId, symbol, companyName, currentShares, currentCostPrice) {
            currentBuyStockId = stockId;
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('buyDate').value = today;
            document.getElementById('buyStockInfo').textContent = `${symbol} - ${companyName}`;
            document.getElementById('buyCurrentShares').textContent = currentShares.toLocaleString();
            document.getElementById('buyCurrentCost').textContent = currentCostPrice.toFixed(2);
            document.getElementById('buyShares').value = ''; document.getElementById('buyPrice').value = ''; document.getElementById('buyFee').value = '0';
            document.getElementById('buyModal').style.display = 'flex';
        };
        window.closeBuyModal = function() { document.getElementById('buyModal').style.display = 'none'; currentBuyStockId = null; };
        window.confirmBuy = async function() {
            if (!currentBuyStockId) return;
            const buyDate = document.getElementById('buyDate').value;
            const buyShares = parseFloat(document.getElementById('buyShares').value);
            const buyPrice = parseFloat(document.getElementById('buyPrice').value);
            const buyFee = parseFloat(document.getElementById('buyFee').value) || 0;
            if (!buyDate) { alert('請選擇買入日期'); return; }
            if (!buyShares || buyShares <= 0) { alert('請輸入有效的買入股數'); return; }
            if (!buyPrice || buyPrice <= 0) { alert('請輸入有效的買入價格'); return; }
            try {
                const stock = stocks.find(s => s.id === currentBuyStockId);
                if (!stock) { alert('找不到該股票'); return; }
                const oldShares = parseFloat(stock.shares) || 0;
                const oldTotalCost = parseFloat(stock.investmentCost) || 0;
                const buyAmount = buyShares * buyPrice + buyFee;
                await updateDoc(doc(db, 'stocks', currentBuyStockId), { shares: oldShares + buyShares, investmentCost: oldTotalCost + buyAmount, lastModified: new Date().toISOString(), modifiedBy: currentUser.email });
                await addDoc(collection(db, 'transactions'), { date: new Date(buyDate + 'T12:00:00').toISOString(), type: '買入', symbol: stock.symbol, companyName: stock.companyName, shares: buyShares, price: buyPrice, fee: buyFee, tax: 0, amount: buyAmount, holder: stock.holder, platform: stock.platform, region: stock.region, createdBy: currentUser.email, createdAt: new Date().toISOString() });
                alert(`買入成功！\n股數：${buyShares}\n價格：${buyPrice}\n手續費：${buyFee}\n總金額：${buyAmount.toFixed(2)}`);
                closeBuyModal();
                await loadStocks();
            } catch (error) { alert('買入失敗：' + error.message); }
        };

        // ===== 賣出 Modal =====
        window.openSellModal = function(stockId, symbol, companyName, currentShares) {
            currentSellStockId = stockId;
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('sellDate').value = today;
            document.getElementById('sellStockInfo').textContent = `${symbol} - ${companyName}`;
            document.getElementById('sellCurrentShares').textContent = currentShares.toLocaleString();
            document.getElementById('sellShares').value = ''; document.getElementById('sellPrice').value = ''; document.getElementById('sellFee').value = '0'; document.getElementById('sellTax').value = '0';
            document.getElementById('sellModal').style.display = 'flex';
        };
        window.closeSellModal = function() { document.getElementById('sellModal').style.display = 'none'; currentSellStockId = null; };
        window.confirmSell = async function() {
            if (!currentSellStockId) return;
            const sellDate = document.getElementById('sellDate').value;
            const sellShares = parseFloat(document.getElementById('sellShares').value);
            const sellPrice = parseFloat(document.getElementById('sellPrice').value);
            const sellFee = parseFloat(document.getElementById('sellFee').value) || 0;
            const sellTax = parseFloat(document.getElementById('sellTax').value) || 0;
            if (!sellDate) { alert('請選擇賣出日期'); return; }
            if (!sellShares || sellShares <= 0) { alert('請輸入有效的賣出股數'); return; }
            if (!sellPrice || sellPrice <= 0) { alert('請輸入有效的賣出價格'); return; }
            try {
                const stock = stocks.find(s => s.id === currentSellStockId);
                if (!stock) { alert('找不到該股票'); return; }
                const currentShares = parseFloat(stock.shares) || 0;
                if (sellShares > currentShares) { alert(`賣出股數不能超過持有股數 (${currentShares.toLocaleString()})`); return; }
                const avgCost = currentShares > 0 ? stock.investmentCost / currentShares : 0;
                const sellAmount = sellShares * sellPrice - sellFee - sellTax;
                const realizedProfit = sellAmount - (sellShares * avgCost);
                const remainingShares = currentShares - sellShares;
                if (remainingShares > 0) await updateDoc(doc(db, 'stocks', currentSellStockId), { shares: remainingShares, investmentCost: remainingShares * avgCost, lastModified: new Date().toISOString(), modifiedBy: currentUser.email });
                else await deleteDoc(doc(db, 'stocks', currentSellStockId));
                await addDoc(collection(db, 'transactions'), { date: new Date(sellDate + 'T12:00:00').toISOString(), type: '賣出', symbol: stock.symbol, companyName: stock.companyName, shares: sellShares, price: sellPrice, fee: sellFee, tax: sellTax, amount: sellAmount, realizedProfit, holder: stock.holder, platform: stock.platform, region: stock.region, createdBy: currentUser.email, createdAt: new Date().toISOString() });
                const profitText = realizedProfit >= 0 ? `+${realizedProfit.toFixed(2)}` : realizedProfit.toFixed(2);
                alert(`賣出成功！\n股數：${sellShares}\n價格：${sellPrice}\n手續費：${sellFee}\n交易稅：${sellTax}\n成交金額：${sellAmount.toFixed(2)}\n已實現損益：${profitText}`);
                closeSellModal();
                await loadStocks();
            } catch (error) { alert('賣出失敗：' + error.message); }
        };

        // ===== 交易記錄功能 =====
        async function loadTransactions() {
            try {
                const querySnapshot = await getDocs(collection(db, 'transactions'));
                transactions = [];
                querySnapshot.forEach((doc) => { transactions.push({ id: doc.id, ...doc.data() }); });
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                window._cfTransactions = transactions;
                populateYearFilter();
                renderTransactions();
            } catch (error) { console.error('載入交易記錄失敗:', error); }
        }

        function populateYearFilter() {
            const years = new Set();
            transactions.forEach(tx => { years.add(new Date(tx.date).getFullYear()); });
            const yearFilter = document.getElementById('filterYear');
            yearFilter.innerHTML = '<option value="">全部年度</option>';
            Array.from(years).sort((a, b) => b - a).forEach(year => {
                const option = document.createElement('option');
                option.value = year; option.textContent = `${year} 年`;
                yearFilter.appendChild(option);
            });
        }

        function renderTransactions() {
            const tbody = document.getElementById('transactionsTableBody');
            tbody.innerHTML = '';
            const yearFilter = document.getElementById('filterYear').value;
            const typeFilter = document.getElementById('filterTransactionType').value;
            const filteredTransactions = transactions.filter(tx => {
                if (yearFilter && new Date(tx.date).getFullYear().toString() !== yearFilter) return false;
                if (typeFilter && tx.type !== typeFilter) return false;
                return true;
            });
            const currentYear = new Date().getFullYear();
            let yearProfit = 0, yearTransactionCount = 0;
            const usdRateForProfit = parseFloat(document.getElementById('usdRate').value) || 31.5;
            transactions.forEach(tx => {
                const txYear = new Date(tx.date).getFullYear();
                if (txYear === currentYear) {
                    yearTransactionCount++;
                    if (tx.type === '賣出' && tx.realizedProfit) {
                        yearProfit += tx.region === '美股' ? tx.realizedProfit * usdRateForProfit : tx.realizedProfit;
                    }
                }
            });
            document.getElementById('yearProfit').textContent = `TWD ${yearProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
            document.getElementById('yearProfit').className = `text-2xl font-bold ${yearProfit >= 0 ? 'text-green-400' : 'text-red-400'}`;
            document.getElementById('yearTransactions').textContent = `${yearTransactionCount} 筆`;
            if (filteredTransactions.length === 0) { tbody.innerHTML = '<tr><td colspan="13" class="px-4 py-8 text-center text-slate-500">暫無交易記錄</td></tr>'; return; }
            filteredTransactions.forEach(tx => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-700 hover:bg-slate-800 transition-colors';
                const date = new Date(tx.date).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                const typeColor = tx.type === '買入' ? 'text-blue-400' : 'text-green-400';
                const typeBadge = tx.type === '買入'
                    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#2d5a1b;color:#7ed957;border:1px solid #4a8a2a;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;letter-spacing:.04em"><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1L9 8H1L5 1Z" fill="#7ed957"/></svg>BUY</span>`
                    : `<span style="display:inline-flex;align-items:center;gap:3px;background:#5a1b1b;color:#f05a7e;border:1px solid #8a2a3a;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;letter-spacing:.04em"><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 9L9 2H1L5 9Z" fill="#f05a7e"/></svg>SELL</span>`;
                const profitCell = tx.type === '賣出' && tx.realizedProfit !== undefined
                    ? (() => {
                        const usdRate = parseFloat(document.getElementById('usdRate').value) || 31.5;
                        const profit = tx.realizedProfit;
                        const profitColor = profit >= 0 ? 'text-green-400' : 'text-red-400';
                        const sign = profit >= 0 ? '+' : '';
                        if (tx.region === '美股') {
                            const profitTWD = profit * usdRate;
                            return `<td class="px-3 py-3 text-center font-mono font-bold ${profitColor}"><div>${sign}USD ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}</div><div class="text-xs text-slate-400">${sign}TWD ${profitTWD.toLocaleString(undefined, {maximumFractionDigits: 0})}</div></td>`;
                        } else {
                            return `<td class="px-3 py-3 text-center font-mono font-bold ${profitColor}"><div>${sign}TWD ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}</div></td>`;
                        }
                    })()
                    : '<td class="px-3 py-3 text-center text-slate-500">-</td>';
                tr.innerHTML = `
                    <td class="px-3 py-3 text-center text-slate-300 text-xs">${date}</td>
                    <td class="px-3 py-3 text-center ${typeColor} font-bold">${typeBadge}</td>
                    <td class="px-3 py-3 text-center text-slate-100 font-mono font-semibold">${escHtml(tx.symbol)}</td>
                    <td class="px-3 py-3 text-center text-slate-300">${escHtml(tx.companyName || tx.symbol)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono">${tx.shares.toLocaleString()}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono">${tx.price.toFixed(2)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono">${(tx.fee || 0).toFixed(2)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono">${(tx.tax || 0).toFixed(2)}</td>
                    <td class="px-3 py-3 text-center text-slate-300 font-mono font-semibold">${tx.amount.toFixed(2)}</td>
                    ${profitCell}
                    <td class="px-3 py-3 text-center text-slate-300">${tx.holder}</td>
                    <td class="px-3 py-3 text-center text-slate-300">${tx.platform}</td>
                    <td class="px-3 py-3 text-center no-print">
                        <div class="flex gap-2 justify-center flex-wrap">
                            <button onclick="openEditTransactionModal('${tx.id}')" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:transparent;border:1px solid rgba(255,255,255,.15);border-radius:6px;cursor:pointer;padding:0" title="編輯">
                              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="11" y="1" width="6" height="3" rx="1" transform="rotate(45 11 1)" fill="#e05252"/>
                                <rect x="9.5" y="2.5" width="6" height="9" rx="0.5" transform="rotate(45 9.5 2.5)" fill="#f5a623"/>
                                <rect x="9.5" y="2.5" width="2" height="9" rx="0.5" transform="rotate(45 9.5 2.5)" fill="#f7c26b"/>
                                <path d="M3 14.5L4.5 17L2 18L3 14.5Z" fill="#7a7a7a"/>
                                <path d="M3 14.5L5.5 12L8 14.5L5.5 17L3 14.5Z" fill="#f5a623"/>
                                <line x1="2" y1="18.5" x2="8" y2="18.5" stroke="#ccc9bf" stroke-width="1" stroke-linecap="round"/>
                              </svg>
                            </button>
                            <button onclick="deleteTransaction('${tx.id}')" class="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900 hover:bg-opacity-20 transition-colors text-sm">✕</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        window.applyTransactionFilters = function() { renderTransactions(); };
        window.clearTransactionFilters = function() { document.getElementById('filterYear').value = ''; document.getElementById('filterTransactionType').value = ''; renderTransactions(); };

        // ===== 補登交易功能 =====
        window.updateImportTypeFields = function() {
            const type = document.getElementById('importType').value;
            const taxField = document.getElementById('importTaxField');
            const profitField = document.getElementById('importProfitField');
            if (type === '賣出') { taxField.classList.remove('hidden'); profitField.classList.remove('hidden'); }
            else { taxField.classList.add('hidden'); profitField.classList.add('hidden'); }
        };

        window.importTransaction = async function() {
            const date = document.getElementById('importDate').value;
            const type = document.getElementById('importType').value;
            const symbol = document.getElementById('importSymbol').value.toUpperCase().trim();
            const companyName = document.getElementById('importCompany').value.trim() || symbol;
            const shares = parseFloat(document.getElementById('importShares').value);
            const price = parseFloat(document.getElementById('importPrice').value);
            const fee = parseFloat(document.getElementById('importFee').value) || 0;
            const tax = parseFloat(document.getElementById('importTax').value) || 0;
            const holder = document.getElementById('importHolder').value;
            const platform = document.getElementById('importPlatform').value;
            const region = document.getElementById('importRegion').value;
            if (!date || !type || !symbol || !shares || !price || !holder || !platform || !region) { alert('請填寫所有必填欄位（標記 * 的欄位）'); return; }
            try {
                const amount = type === '買入' ? shares * price + fee : shares * price - fee - tax;
                const transaction = { date: new Date(date + 'T12:00:00').toISOString(), type, symbol, companyName, shares, price, fee, tax, amount, holder, platform, region, createdBy: currentUser.email, importedAt: new Date().toISOString(), isHistoricalImport: true };
                if (type === '賣出') {
                    const profitInput = document.getElementById('importProfit').value;
                    if (profitInput) transaction.realizedProfit = parseFloat(profitInput);
                }
                await addDoc(collection(db, 'transactions'), transaction);
                alert(`✅ 交易記錄新增成功！\n\n類型：${type}\n股票：${symbol} - ${companyName}\n股數：${shares}\n價格：${price}\n日期：${date}`);
                document.getElementById('importForm').reset();
                // 新增後自動收合補登表單
                const section = document.getElementById('importFormSection');
                const icon = document.getElementById('toggleImportIcon');
                if (section && !section.classList.contains('hidden')) {
                    section.classList.add('hidden');
                    if (icon) icon.style.transform = '';
                }
                await loadTransactions();
            } catch (error) { alert('❌ 新增失敗：' + error.message); }
        };

        window.fetchImportCompanyName = async function() {
            const symbolInput = document.getElementById('importSymbol');
            const regionSelect = document.getElementById('importRegion');
            const companyInput = document.getElementById('importCompany');
            let symbol = symbolInput.value.toUpperCase().trim();
            if (!symbol) return;
            const region = regionSelect.value;
            const quickName = getCompanyNameQuick(symbol, region);
            companyInput.value = quickName !== symbol ? quickName : '查詢中...';
            try {
                const info = await fetchStockInfo(symbol, region);
                if (info && info.companyName && info.companyName !== symbol) companyInput.value = info.companyName;
            } catch (error) { if (companyInput.value === '查詢中...') companyInput.value = quickName; }
        };

        // ===== 編輯交易記錄 =====
        window.openEditTransactionModal = function(txId) {
            const tx = transactions.find(t => t.id === txId);
            if (!tx) return;
            document.getElementById('editTxId').value = txId;
            document.getElementById('editTxDate').value = new Date(tx.date).toISOString().split('T')[0];
            document.getElementById('editTxType').value = tx.type;
            document.getElementById('editTxRegion').value = tx.region;
            document.getElementById('editTxSymbol').value = tx.symbol;
            document.getElementById('editTxCompany').value = tx.companyName || tx.symbol;
            document.getElementById('editTxShares').value = tx.shares;
            document.getElementById('editTxPrice').value = tx.price;
            document.getElementById('editTxFee').value = tx.fee || 0;
            document.getElementById('editTxTax').value = tx.tax || 0;
            document.getElementById('editTxHolder').value = tx.holder;
            document.getElementById('editTxPlatform').value = tx.platform;
            if (tx.type === '賣出' && tx.realizedProfit !== undefined) document.getElementById('editTxProfit').value = tx.realizedProfit;
            updateEditTypeFields();
            document.getElementById('editTransactionModal').style.display = 'flex';
        };
        window.closeEditTransactionModal = function() { document.getElementById('editTransactionModal').style.display = 'none'; };
        window.updateEditTypeFields = function() {
            const type = document.getElementById('editTxType').value;
            if (type === '賣出') { document.getElementById('editTxTaxField').classList.remove('hidden'); document.getElementById('editTxProfitField').classList.remove('hidden'); }
            else { document.getElementById('editTxTaxField').classList.add('hidden'); document.getElementById('editTxProfitField').classList.add('hidden'); }
        };
        window.saveEditTransaction = async function() {
            const txId = document.getElementById('editTxId').value;
            const date = document.getElementById('editTxDate').value;
            const type = document.getElementById('editTxType').value;
            const shares = parseFloat(document.getElementById('editTxShares').value);
            const price = parseFloat(document.getElementById('editTxPrice').value);
            const fee = parseFloat(document.getElementById('editTxFee').value) || 0;
            const tax = parseFloat(document.getElementById('editTxTax').value) || 0;
            const holder = document.getElementById('editTxHolder').value;
            const platform = document.getElementById('editTxPlatform').value;
            if (!date || !shares || !price || !holder || !platform) { alert('請填寫所有必填欄位'); return; }
            try {
                const amount = type === '買入' ? shares * price + fee : shares * price - fee - tax;
                const updateData = { date: new Date(date + 'T12:00:00').toISOString(), type, shares, price, fee, tax, amount, holder, platform, modifiedAt: new Date().toISOString(), modifiedBy: currentUser.email };
                if (type === '賣出') { const profitInput = document.getElementById('editTxProfit').value; if (profitInput) updateData.realizedProfit = parseFloat(profitInput); }
                else updateData.realizedProfit = null;
                await updateDoc(doc(db, 'transactions', txId), updateData);
                alert('✅ 交易記錄已更新！');
                closeEditTransactionModal();
                await loadTransactions();
            } catch (error) { alert('❌ 更新失敗：' + error.message); }
        };

        window.deleteTransaction = async function(txId) {
            const tx = transactions.find(t => t.id === txId);
            if (!tx) return;
            const confirmMsg = `確定要刪除這筆交易記錄嗎？\n\n日期：${new Date(tx.date).toLocaleDateString('zh-TW')}\n類型：${tx.type}\n股票：${tx.symbol} - ${tx.companyName || tx.symbol}\n股數：${tx.shares}\n價格：${tx.price}`;
            if (!confirm(confirmMsg)) return;
            try { await deleteDoc(doc(db, 'transactions', txId)); alert('✅ 交易記錄已刪除！'); await loadTransactions(); }
            catch (error) { alert('❌ 刪除失敗：' + error.message); }
        };
