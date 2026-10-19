// --- Constants & Config ---
const CATEGORIES = {
    expense: ['Food', 'Transport', 'Rent', 'Utilities', 'Airtime/Data', 'Entertainment', 'Healthcare', 'Education', 'Shopping', 'Other'],
    income: ['Salary', 'Business', 'Freelance', 'Investment', 'Gift', 'Other']
};

const STORAGE_KEYS = {
    transactions: 'sb_transactions',
    budgets: 'sb_budgets',
    savings: 'sb_savings',
    debts: 'sb_debts'
};

// --- State Management ---
let appData = {
    transactions: [],
    budgets: [],
    savings: [],
    debts: []
};

let charts = {};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initDateInputs();
    updateTransCategories();
    renderAll();
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    }
});

function loadData() {
    appData.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];
    appData.budgets = JSON.parse(localStorage.getItem(STORAGE_KEYS.budgets)) || [];
    appData.savings = JSON.parse(localStorage.getItem(STORAGE_KEYS.savings)) || [];
    appData.debts = JSON.parse(localStorage.getItem(STORAGE_KEYS.debts)) || [];
}

function saveData() {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(appData.transactions));
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(appData.budgets));
    localStorage.setItem(STORAGE_KEYS.savings, JSON.stringify(appData.savings));
    localStorage.setItem(STORAGE_KEYS.debts, JSON.stringify(appData.debts));
    renderAll();
}

function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) input.value = today;
    });
}

// --- Navigation ---
function navigateTo(viewId) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // Find the clicked element based on the viewId logic or event bubbling if passed directly
    // For simplicity in this structure, we assume the onclick passes the context or we find by index
    // But since we use onclick in HTML, let's just highlight based on mapping
    const navItems = document.querySelectorAll('.nav-item');
    const viewMap = ['dashboard', 'transactions', 'budget', 'savings', 'debts', 'reports', 'settings'];
    const index = viewMap.indexOf(viewId);
    if (index !== -1 && navItems[index]) {
        navItems[index].classList.add('active');
    }

    // Update View
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // Update Title
    const titles = {
        'dashboard': 'Dashboard',
        'transactions': 'Transactions',
        'budget': 'Budget Planner',
        'savings': 'Savings Goals',
        'debts': 'Debt Manager',
        'reports': 'Financial Reports',
        'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titles[viewId];

    // Mobile sidebar close
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
    }

    // Refresh specific charts if needed
    if (viewId === 'reports') renderReports();
    if (viewId === 'dashboard') updateDashboard();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// --- Rendering Logic ---
function renderAll() {
    updateDashboard();
    renderTransactions();
    renderBudgets();
    renderSavings();
    renderDebts();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

// --- Dashboard ---
function updateDashboard() {
    const period = document.getElementById('dashboard-period').value;
    const now = new Date();
    let startDate, endDate;

    if (period === 'current') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    // Filter transactions for the period
    const periodTrans = appData.transactions.filter(t => {
        const d = new Date(t.date);
        return d >= startDate && d <= endDate;
    });

    const income = periodTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expenses = periodTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // Total Balance (All time)
    const totalIncome = appData.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalExpense = appData.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const balance = totalIncome - totalExpense;

    // Total Savings
    const totalSaved = appData.savings.reduce((sum, s) => sum + parseFloat(s.current), 0);

    // Update DOM
    document.getElementById('dash-balance').innerText = formatCurrency(balance);
    document.getElementById('dash-income').innerText = formatCurrency(income);
    document.getElementById('dash-expenses').innerText = formatCurrency(expenses);
    document.getElementById('dash-savings').innerText = formatCurrency(totalSaved);

    // Recent Transactions Table
    const recentTable = document.querySelector('#recent-transactions-table tbody');
    recentTable.innerHTML = '';
    const recent = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    if (recent.length === 0) {
        recentTable.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions yet</td></tr>';
    } else {
        recent.forEach(t => {
            const row = `
                <tr>
                    <td>${t.date}</td>
                    <td>${t.description}</td>
                    <td><span class="badge badge-${t.type}">${t.category}</span></td>
                    <td class="${t.type === 'income' ? 'text-green' : 'text-red'}">
                        ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                    </td>
                </tr>
            `;
            recentTable.innerHTML += row;
        });
    }

    renderCharts(periodTrans);
}

function renderCharts(transactions) {
    // Destroy existing charts
    if (charts.main) charts.main.destroy();
    if (charts.category) charts.category.destroy();

    // Income vs Expense Chart
    const ctxMain = document.getElementById('mainChart').getContext('2d');
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);

    charts.main = new Chart(ctxMain, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                label: 'Amount (KSh)',
                data: [income, expense],
                backgroundColor: ['#10b981', '#ef4444'],
                borderRadius: 5
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Category Breakdown
    const expensesByCat = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        expensesByCat[t.category] = (expensesByCat[t.category] || 0) + parseFloat(t.amount);
    });

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    
    // Handle empty data for chart
    const catLabels = Object.keys(expensesByCat).length ? Object.keys(expensesByCat) : ['No Data'];
    const catData = Object.keys(expensesByCat).length ? Object.values(expensesByCat) : [1];
    const catColors = Object.keys(expensesByCat).length ? ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] : ['#e5e7eb'];

    charts.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData,
                backgroundColor: catColors,
                borderWidth: 0
            }]
        },
        options: { responsive: true, cutout: '70%' }
    });
}

// --- Transactions ---
function updateTransCategories() {
    const type = document.getElementById('trans-type').value;
    const catSelect = document.getElementById('trans-category');
    catSelect.innerHTML = '';
    
    const cats = type === 'transfer' ? ['Bank Transfer', 'M-Pesa to Bank', 'Cash Deposit'] : CATEGORIES[type] || [];
    
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c;
        catSelect.appendChild(opt);
    });
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const transaction = {
        id: id || Date.now().toString(),
        type: document.getElementById('trans-type').value,
        amount: document.getElementById('trans-amount').value,
        category: document.getElementById('trans-category').value,
        date: document.getElementById('trans-date').value,
        method: document.getElementById('trans-method').value,
        description: document.getElementById('trans-desc').value,
        notes: document.getElementById('trans-notes').value
    };

    if (id) {
        const index = appData.transactions.findIndex(t => t.id === id);
        if (index !== -1) appData.transactions[index] = transaction;
    } else {
        appData.transactions.push(transaction);
    }

    saveData();
    closeModal('transactionModal');
    showToast('Transaction Saved');
    e.target.reset();
    initDateInputs();
}

function renderTransactions() {
    const search = document.getElementById('search-trans').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    const filterCat = document.getElementById('filter-category').value;

    // Populate Filter Categories if empty
    const catFilter = document.getElementById('filter-category');
    if (catFilter.options.length <= 1) {
        const allCats = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])];
        allCats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c;
            catFilter.appendChild(opt);
        });
    }

    let filtered = appData.transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(search);
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesCat = filterCat === 'all' || t.category === filterCat;
        return matchesSearch && matchesType && matchesCat;
    });

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#all-transactions-table tbody');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No records found</td></tr>';
        return;
    }

    filtered.forEach(t => {
        const row = `
            <tr>
                <td>${t.date}</td>
                <td><span class="badge badge-${t.type}">${t.type.toUpperCase()}</span></td>
                <td>${t.category}</td>
                <td>${t.method}</td>
                <td>${t.description}</td>
                <td class="${t.type === 'income' ? 'text-green' : 'text-red'}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editTransaction('${t.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function editTransaction(id) {
    const t = appData.transactions.find(x => x.id === id);
    if (!t) return;

    document.getElementById('trans-id').value = t.id;
    document.getElementById('trans-type').value = t.type;
    updateTransCategories(); // Refresh categories based on type
    document.getElementById('trans-category').value = t.category;
    document.getElementById('trans-amount').value = t.amount;
    document.getElementById('trans-date').value = t.date;
    document.getElementById('trans-method').value = t.method;
    document.getElementById('trans-desc').value = t.description;
    document.getElementById('trans-notes').value = t.notes || '';

    openModal('transactionModal');
}

function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        saveData();
        showToast('Transaction Deleted');
    }
}

// --- Budget ---
function handleBudgetSubmit(e) {
    e.preventDefault();
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    // Check if exists
    const existingIndex = appData.budgets.findIndex(b => b.category === category);
    if (existingIndex >= 0) {
        appData.budgets[existingIndex].limit = amount;
    } else {
        appData.budgets.push({ category, limit: amount });
    }

    saveData();
    closeModal('budgetModal');
    showToast('Budget Updated');
    e.target.reset();
}

function renderBudgets() {
    // Populate Budget Modal Categories
    const select = document.getElementById('budget-category');
    if (select.options.length === 0) {
        CATEGORIES.expense.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c;
            select.appendChild(opt);
        });
    }

    const grid = document.getElementById('budget-grid');
    grid.innerHTML = '';

    if (appData.budgets.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No budgets set. Click "Set Budget Limit" to start.</div>';
        return;
    }

    // Calculate current month spending per category
    const now = new Date();
    const currentMonthTrans = appData.transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    appData.budgets.forEach(b => {
        const spent = currentMonthTrans
            .filter(t => t.category === b.category)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const remaining = b.limit - spent;
        const percent = Math.min((spent / b.limit) * 100, 100);
        
        let barClass = '';
        if (percent > 80) { barClass = 'warning'; }
        if (percent >= 100) { barClass = 'danger'; }

        const card = `
            <div class="card">
                <div class="flex-between">
                    <h4>${b.category}</h4>
                    <span style="font-weight: 600; color: ${percent >= 100 ? 'var(--danger-color)' : (percent > 80 ? 'var(--warning-color)' : 'var(--secondary-color)')}">${Math.round(percent)}%</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${barClass}" style="width: ${percent}%"></div>
                </div>
                <div class="flex-between mt-4" style="font-size: 13px; color: var(--text-gray);">
                    <span>Spent: ${formatCurrency(spent)}</span>
                    <span>Limit: ${formatCurrency(b.limit)}</span>
                </div>
                <div style="margin-top: 5px; font-size: 12px; text-align: right; color: ${remaining < 0 ? 'var(--danger-color)' : 'var(--text-gray)'}">
                    Remaining: ${formatCurrency(remaining)}
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

// --- Savings ---
function handleSavingsSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('saving-id').value;
    const saving = {
        id: id || Date.now().toString(),
        name: document.getElementById('saving-name').value,
        target: parseFloat(document.getElementById('saving-target').value),
        current: parseFloat(document.getElementById('saving-current').value),
        date: document.getElementById('saving-date').value
    };

    if (id) {
        const index = appData.savings.findIndex(s => s.id === id);
        if (index !== -1) appData.savings[index] = saving;
    } else {
        appData.savings.push(saving);
    }

    saveData();
    closeModal('savingsModal');
    showToast('Goal Saved');
    e.target.reset();
}

function renderSavings() {
    const grid = document.getElementById('savings-grid');
    grid.innerHTML = '';

    if (appData.savings.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No savings goals yet.</div>';
        return;
    }

    appData.savings.forEach(s => {
        const percent = Math.min((s.current / s.target) * 100, 100);
        const remaining = s.target - s.current;
        
        // Calculate monthly required
        const targetDate = new Date(s.date);
        const now = new Date();
        const diffTime = targetDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const monthsLeft = Math.max(1, diffDays / 30);
        const monthlyReq = remaining > 0 ? remaining / monthsLeft : 0;

        const card = `
            <div class="card">
                <div class="flex-between">
                    <h4>${s.name}</h4>
                    <button class="btn btn-sm btn-secondary" onclick="editSaving('${s.id}')"><i class="fas fa-edit"></i></button>
                </div>
                <div class="stat-value text-blue" style="font-size: 20px; margin: 10px 0;">
                    ${formatCurrency(s.current)} <span style="font-size: 14px; color: var(--text-gray);">/ ${formatCurrency(s.target)}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="mt-4" style="font-size: 13px; color: var(--text-gray);">
                    <div>Target Date: ${s.date}</div>
                    <div>Remaining: ${formatCurrency(remaining)}</div>
                    <div style="margin-top: 5px; color: var(--primary-color); font-weight: 500;">
                        Save ${formatCurrency(monthlyReq)}/mo to reach goal
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

function editSaving(id) {
    const s = appData.savings.find(x => x.id === id);
    if (!s) return;
    document.getElementById('saving-id').value = s.id;
    document.getElementById('saving-name').value = s.name;
    document.getElementById('saving-target').value = s.target;
    document.getElementById('saving-current').value = s.current;
    document.getElementById('saving-date').value = s.date;
    openModal('savingsModal');
}

// --- Debts ---
function handleDebtSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('debt-id').value;
    const debt = {
        id: id || Date.now().toString(),
        person: document.getElementById('debt-person').value,
        type: document.getElementById('debt-type').value,
        total: parseFloat(document.getElementById('debt-total').value),
        paid: parseFloat(document.getElementById('debt-paid').value),
        date: document.getElementById('debt-date').value
    };

    if (id) {
        const index = appData.debts.findIndex(d => d.id === id);
        if (index !== -1) appData.debts[index] = debt;
    } else {
        appData.debts.push(debt);
    }

    saveData();
    closeModal('debtModal');
    showToast('Debt Record Saved');
    e.target.reset();
}

function renderDebts() {
    const tbody = document.querySelector('#debts-table tbody');
    tbody.innerHTML = '';

    if (appData.debts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No debt records</td></tr>';
        return;
    }

    appData.debts.forEach(d => {
        const balance = d.total - d.paid;
        const status = balance <= 0 ? 'Cleared' : 'Active';
        const statusClass = balance <= 0 ? 'badge-income' : 'badge-expense';
        const typeLabel = d.type === 'owed' ? 'I Owe' : 'Owes Me';

        const row = `
            <tr>
                <td>${d.person}</td>
                <td>${typeLabel}</td>
                <td>${formatCurrency(d.total)}</td>
                <td>${formatCurrency(d.paid)}</td>
                <td style="font-weight: 600;">${formatCurrency(balance)}</td>
                <td>${d.date}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editDebt('${d.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDebt('${d.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function editDebt(id) {
    const d = appData.debts.find(x => x.id === id);
    if (!d) return;
    document.getElementById('debt-id').value = d.id;
    document.getElementById('debt-person').value = d.person;
    document.getElementById('debt-type').value = d.type;
    document.getElementById('debt-total').value = d.total;
    document.getElementById('debt-paid').value = d.paid;
    document.getElementById('debt-date').value = d.date;
    openModal('debtModal');
}

function deleteDebt(id) {
    if (confirm('Delete this debt record?')) {
        appData.debts = appData.debts.filter(d => d.id !== id);
        saveData();
    }
}

// --- Reports ---
function renderReports() {
    // Destroy existing
    if (charts.trend) charts.trend.destroy();
    if (charts.budgetPerf) charts.budgetPerf.destroy();

    // 1. Monthly Trend (Last 6 Months)
    const months = [];
    const incomeData = [];
    const expenseData = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        months.push(monthKey);

        const mIncome = appData.transactions
            .filter(t => t.type === 'income' && new Date(t.date).getMonth() === d.getMonth() && new Date(t.date).getFullYear() === d.getFullYear())
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const mExpense = appData.transactions
            .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === d.getMonth() && new Date(t.date).getFullYear() === d.getFullYear())
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        incomeData.push(mIncome);
        expenseData.push(mExpense);
    }

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    charts.trend = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: incomeData, borderColor: '#10b981', tension: 0.4 },
                { label: 'Expenses', data: expenseData, borderColor: '#ef4444', tension: 0.4 }
            ]
        },
        options: { responsive: true }
    });

    // 2. Budget Performance
    const budgetLabels = appData.budgets.map(b => b.category);
    const budgetLimits = appData.budgets.map(b => b.limit);
    
    // Calculate current month spending for these categories
    const now = new Date();
    const currentSpending = appData.budgets.map(b => {
        return appData.transactions
            .filter(t => t.type === 'expense' && t.category === b.category && new Date(t.date).getMonth() === now.getMonth())
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    });

    const ctxPerf = document.getElementById('budgetPerformanceChart').getContext('2d');
    charts.budgetPerf = new Chart(ctxPerf, {
        type: 'bar',
        data: {
            labels: budgetLabels,
            datasets: [
                { label: 'Limit', data: budgetLimits, backgroundColor: '#e5e7eb' },
                { label: 'Spent', data: currentSpending, backgroundColor: '#3b82f6' }
            ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // 3. Stats
    const totalExp = appData.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalInc = appData.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // Avg Daily (Simple: Total Exp / Days since first transaction or 30)
    const days = 30; // Simplified for demo
    document.getElementById('report-avg-daily').innerText = formatCurrency(totalExp / days);

    // Top Category
    const catTotals = {};
    appData.transactions.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
    });
    const topCat = Object.keys(catTotals).length ? Object.keys(catTotals).reduce((a, b) => catTotals[a] > catTotals[b] ? a : b) : '-';
    document.getElementById('report-top-cat').innerText = topCat;

    // Savings Rate
    const rate = totalInc > 0 ? ((totalInc - totalExp) / totalInc * 100).toFixed(1) : 0;
    document.getElementById('report-savings-rate').innerText = rate + '%';
}

// --- Settings & Utilities ---
function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartbudget_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions && data.budgets) {
                appData = data;
                saveData();
                showToast('Data Imported Successfully');
            } else {
                alert('Invalid file format');
            }
        } catch (err) {
            alert('Error reading file');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('WARNING: This will delete ALL your financial data. Are you sure?')) {
        localStorage.clear();
        location.reload();
    }
}

function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Type,Category,Amount,Method,Description\n";
    
    appData.transactions.forEach(t => {
        const row = `${t.date},${t.type},${t.category},${t.amount},${t.method},"${t.description.replace(/"/g, '""')}"`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "smartbudget_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- UI Helpers ---
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    // Clear hidden IDs and reset form
    const form = document.querySelector(`#${id} form`);
    if (form) {
        const hiddenInput = form.querySelector('input[type="hidden"]');
        if (hiddenInput) hiddenInput.value = '';
        form.reset();
        initDateInputs();
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}