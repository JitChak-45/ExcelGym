import type { CareerPath } from '../../types';
import {
  generateModuleFromTheme,
  type DomainDataset,
  type ModuleSpecConfig,
} from './skillTemplates';

// Unique Indian business datasets per module across all 4 career paths
const INV_DS_1: DomainDataset = {
  roleName: 'Inventory Executive',
  entityLabel: 'Product',
  codePrefix: 'INV',
  categoryLabel: 'Category',
  qtyLabel: 'Quantity',
  rateLabel: 'Unit Price (₹)',
  categories: ['Hardware', 'Peripherals'],
  items: [
    { code: 'INV-101', name: 'Laptop', cat: 'Hardware', q1: 10, q2: 6, rate: 45000, minLvl: 12 },
    { code: 'INV-102', name: 'Mouse', cat: 'Peripherals', q1: 25, q2: 14, rate: 650, minLvl: 20 },
    { code: 'INV-103', name: 'Keyboard', cat: 'Peripherals', q1: 15, q2: 9, rate: 1250, minLvl: 18 },
    { code: 'INV-104', name: 'Monitor', cat: 'Hardware', q1: 8, q2: 5, rate: 14500, minLvl: 10 },
    { code: 'INV-105', name: 'Printer', cat: 'Hardware', q1: 5, q2: 3, rate: 16200, minLvl: 6 },
  ],
};

const INV_DS_2: DomainDataset = {
  roleName: 'Warehouse Supervisor',
  entityLabel: 'SKU Item',
  codePrefix: 'WHB',
  categoryLabel: 'Zone',
  qtyLabel: 'Cartons',
  rateLabel: 'Cost / Carton (₹)',
  categories: ['Cold Chain', 'Dry Goods'],
  items: [
    { code: 'WHB-201', name: 'Basmati Rice 25kg', cat: 'Dry Goods', q1: 64, q2: 22, rate: 2150, minLvl: 50 },
    { code: 'WHB-202', name: 'Mustard Oil 15L', cat: 'Dry Goods', q1: 38, q2: 18, rate: 2680, minLvl: 45 },
    { code: 'WHB-203', name: 'Paneer Blocks 5kg', cat: 'Cold Chain', q1: 18, q2: 12, rate: 1950, minLvl: 25 },
    { code: 'WHB-204', name: 'Butter Cartons', cat: 'Cold Chain', q1: 29, q2: 15, rate: 3100, minLvl: 20 },
    { code: 'WHB-205', name: 'Toor Dal 30kg', cat: 'Dry Goods', q1: 42, q2: 19, rate: 4200, minLvl: 40 },
  ],
};

const INV_DS_3: DomainDataset = {
  roleName: 'Inventory Analyst',
  entityLabel: 'Component',
  codePrefix: 'SPK',
  categoryLabel: 'Warehouse',
  qtyLabel: 'Stock Units',
  rateLabel: 'Unit Cost (₹)',
  categories: ['Pune Hub', 'Bhiwandi Hub'],
  items: [
    { code: 'SPK-301', name: 'Brake Pad Set', cat: 'Pune Hub', q1: 85, q2: 34, rate: 1450, minLvl: 60 },
    { code: 'SPK-302', name: 'Air Filter Box', cat: 'Bhiwandi Hub', q1: 44, q2: 26, rate: 780, minLvl: 55 },
    { code: 'SPK-303', name: 'LED Headlamp', cat: 'Pune Hub', q1: 22, q2: 11, rate: 3650, minLvl: 30 },
    { code: 'SPK-304', name: 'Clutch Cable', cat: 'Bhiwandi Hub', q1: 110, q2: 40, rate: 420, minLvl: 75 },
    { code: 'SPK-305', name: 'Alternator Belt', cat: 'Pune Hub', q1: 35, q2: 15, rate: 1190, minLvl: 40 },
  ],
};

const INV_DS_4: DomainDataset = {
  roleName: 'Supply Chain Coordinator',
  entityLabel: 'Material',
  codePrefix: 'PKG',
  categoryLabel: 'Supplier Group',
  qtyLabel: 'Stock Qty',
  rateLabel: 'Rate (₹)',
  categories: ['Primary Pack', 'Shipping Pack'],
  items: [
    { code: 'PKG-401', name: 'Corrugated Box M', cat: 'Shipping Pack', q1: 340, q2: 140, rate: 48, minLvl: 300 },
    { code: 'PKG-402', name: 'Bubble Wrap Roll', cat: 'Shipping Pack', q1: 45, q2: 24, rate: 620, minLvl: 60 },
    { code: 'PKG-403', name: 'BOPP Packing Tape', cat: 'Primary Pack', q1: 180, q2: 75, rate: 95, minLvl: 150 },
    { code: 'PKG-404', name: 'Barcode Label Roll', cat: 'Primary Pack', q1: 62, q2: 38, rate: 310, minLvl: 80 },
    { code: 'PKG-405', name: 'Shrink Film 500m', cat: 'Shipping Pack', q1: 28, q2: 14, rate: 1450, minLvl: 35 },
  ],
};

const STORE_DS_1: DomainDataset = {
  roleName: 'Store Manager',
  entityLabel: 'Product',
  codePrefix: 'STR',
  categoryLabel: 'Section',
  qtyLabel: 'Units Sold',
  rateLabel: 'Selling Price (₹)',
  categories: ['Apparel', 'Footwear'],
  items: [
    { code: 'STR-101', name: 'Cotton Kurta', cat: 'Apparel', q1: 42, q2: 28, rate: 1299, minLvl: 35 },
    { code: 'STR-102', name: 'Denim Jeans', cat: 'Apparel', q1: 31, q2: 24, rate: 2199, minLvl: 35 },
    { code: 'STR-103', name: 'Running Shoes', cat: 'Footwear', q1: 19, q2: 14, rate: 3499, minLvl: 22 },
    { code: 'STR-104', name: 'Formal Shirt', cat: 'Apparel', q1: 54, q2: 38, rate: 1499, minLvl: 45 },
    { code: 'STR-105', name: 'Leather Sandals', cat: 'Footwear', q1: 27, q2: 20, rate: 1699, minLvl: 25 },
  ],
};

const STORE_DS_2: DomainDataset = {
  roleName: 'Retail Store Supervisor',
  entityLabel: 'Staff Member',
  codePrefix: 'STF',
  categoryLabel: 'Shift',
  qtyLabel: 'Days Present',
  rateLabel: 'Daily Wage (₹)',
  categories: ['Morning Shift', 'Evening Shift'],
  items: [
    { code: 'STF-201', name: 'Rohan Sharma', cat: 'Morning Shift', q1: 26, q2: 24, rate: 850, minLvl: 24 },
    { code: 'STF-202', name: 'Priya Nair', cat: 'Morning Shift', q1: 24, q2: 22, rate: 950, minLvl: 25 },
    { code: 'STF-203', name: 'Karan Verma', cat: 'Evening Shift', q1: 21, q2: 19, rate: 800, minLvl: 24 },
    { code: 'STF-204', name: 'Sneha Patil', cat: 'Evening Shift', q1: 27, q2: 25, rate: 1050, minLvl: 25 },
    { code: 'STF-205', name: 'Imran Shaikh', cat: 'Morning Shift', q1: 23, q2: 21, rate: 900, minLvl: 24 },
  ],
};

const STORE_DS_3: DomainDataset = {
  roleName: 'Outlet Operations Lead',
  entityLabel: 'Counter Item',
  codePrefix: 'FMC',
  categoryLabel: 'Aisle',
  qtyLabel: 'Daily Packs',
  rateLabel: 'MRP (₹)',
  categories: ['Beverages', 'Snacks'],
  items: [
    { code: 'FMC-301', name: 'Assam Tea 500g', cat: 'Beverages', q1: 72, q2: 50, rate: 285, minLvl: 60 },
    { code: 'FMC-302', name: 'Filter Coffee 250g', cat: 'Beverages', q1: 34, q2: 26, rate: 340, minLvl: 40 },
    { code: 'FMC-303', name: 'Roasted Almonds', cat: 'Snacks', q1: 28, q2: 18, rate: 520, minLvl: 30 },
    { code: 'FMC-304', name: 'Masala Oats 1kg', cat: 'Snacks', q1: 58, q2: 42, rate: 210, minLvl: 50 },
    { code: 'FMC-305', name: 'Green Tea Box', cat: 'Beverages', q1: 41, q2: 31, rate: 245, minLvl: 45 },
  ],
};

const BANK_DS_1: DomainDataset = {
  roleName: 'Banking Assistant',
  entityLabel: 'Customer Account',
  codePrefix: 'BNK',
  categoryLabel: 'Account Type',
  qtyLabel: 'Transactions',
  rateLabel: 'Avg Ticket (₹)',
  categories: ['Savings', 'Current'],
  items: [
    { code: 'BNK-101', name: 'Rajeshwari Textiles', cat: 'Current', q1: 48, q2: 35, rate: 18500, minLvl: 40 },
    { code: 'BNK-102', name: 'Ananya Deshmukh', cat: 'Savings', q1: 16, q2: 12, rate: 4200, minLvl: 20 },
    { code: 'BNK-103', name: 'Mehta Agro Traders', cat: 'Current', q1: 62, q2: 44, rate: 24000, minLvl: 50 },
    { code: 'BNK-104', name: 'Vikram Kulkarni', cat: 'Savings', q1: 12, q2: 10, rate: 6500, minLvl: 15 },
    { code: 'BNK-105', name: 'Sunrise Pharma', cat: 'Current', q1: 39, q2: 29, rate: 15200, minLvl: 45 },
  ],
};

const BANK_DS_2: DomainDataset = {
  roleName: 'Finance Executive',
  entityLabel: 'Branch Portfolio',
  codePrefix: 'FIN',
  categoryLabel: 'Zone',
  qtyLabel: 'Active Loans',
  rateLabel: 'Avg EMI (₹)',
  categories: ['Metro Branch', 'Semi-Urban'],
  items: [
    { code: 'FIN-201', name: 'Andheri West Branch', cat: 'Metro Branch', q1: 94, q2: 76, rate: 14800, minLvl: 85 },
    { code: 'FIN-202', name: 'Nashik Road Branch', cat: 'Semi-Urban', q1: 52, q2: 41, rate: 9600, minLvl: 60 },
    { code: 'FIN-203', name: 'Indiranagar Branch', cat: 'Metro Branch', q1: 112, q2: 88, rate: 16500, minLvl: 100 },
    { code: 'FIN-204', name: 'Surat Ring Branch', cat: 'Semi-Urban', q1: 68, q2: 54, rate: 11200, minLvl: 65 },
    { code: 'FIN-205', name: 'Salt Lake Branch', cat: 'Metro Branch', q1: 79, q2: 63, rate: 13400, minLvl: 85 },
  ],
};

const BANK_DS_3: DomainDataset = {
  roleName: 'Accounts & Treasury Officer',
  entityLabel: 'Ledger Account',
  codePrefix: 'TRZ',
  categoryLabel: 'Payment Mode',
  qtyLabel: 'Settlements',
  rateLabel: 'Avg Value (₹)',
  categories: ['NEFT/RTGS', 'UPI Corporate'],
  items: [
    { code: 'TRZ-301', name: 'Vendor Clearing A/C', cat: 'NEFT/RTGS', q1: 34, q2: 26, rate: 32000, minLvl: 30 },
    { code: 'TRZ-302', name: 'Retail POS Pool', cat: 'UPI Corporate', q1: 145, q2: 118, rate: 1850, minLvl: 120 },
    { code: 'TRZ-303', name: 'Payroll Escrow', cat: 'NEFT/RTGS', q1: 22, q2: 20, rate: 48000, minLvl: 25 },
    { code: 'TRZ-304', name: 'Utility Auto-Debit', cat: 'UPI Corporate', q1: 64, q2: 52, rate: 3400, minLvl: 70 },
    { code: 'TRZ-305', name: 'GST Tax Remittance', cat: 'NEFT/RTGS', q1: 18, q2: 14, rate: 55000, minLvl: 20 },
  ],
};

const MIS_DS_1: DomainDataset = {
  roleName: 'MIS Executive',
  entityLabel: 'Employee',
  codePrefix: 'EMP',
  categoryLabel: 'Department',
  qtyLabel: 'Tasks Closed',
  rateLabel: 'Monthly Pay (₹)',
  categories: ['Operations', 'Sales'],
  items: [
    { code: 'EMP-101', name: 'Deepak Nair', cat: 'Operations', q1: 58, q2: 46, rate: 34000, minLvl: 50 },
    { code: 'EMP-102', name: 'Kavita Iyer', cat: 'Sales', q1: 42, q2: 38, rate: 38500, minLvl: 45 },
    { code: 'EMP-103', name: 'Arjun Malhotra', cat: 'Operations', q1: 67, q2: 55, rate: 36000, minLvl: 60 },
    { code: 'EMP-104', name: 'Pooja Banerjee', cat: 'Sales', q1: 35, q2: 30, rate: 32000, minLvl: 40 },
    { code: 'EMP-105', name: 'Siddharth Rao', cat: 'Operations', q1: 74, q2: 61, rate: 41000, minLvl: 65 },
  ],
};

const MIS_DS_2: DomainDataset = {
  roleName: 'Office Administrator',
  entityLabel: 'Regional Office',
  codePrefix: 'OFC',
  categoryLabel: 'Region',
  qtyLabel: 'Staff Strength',
  rateLabel: 'Monthly Cost / Seat (₹)',
  categories: ['West Zone', 'South Zone'],
  items: [
    { code: 'OFC-201', name: 'Mumbai HQ', cat: 'West Zone', q1: 46, q2: 42, rate: 12500, minLvl: 40 },
    { code: 'OFC-202', name: 'Pune Operations', cat: 'West Zone', q1: 32, q2: 28, rate: 8800, minLvl: 35 },
    { code: 'OFC-203', name: 'Bengaluru Tech Desk', cat: 'South Zone', q1: 54, q2: 48, rate: 11400, minLvl: 50 },
    { code: 'OFC-204', name: 'Chennai Support', cat: 'South Zone', q1: 28, q2: 25, rate: 7900, minLvl: 30 },
    { code: 'OFC-205', name: 'Ahmedabad Sales', cat: 'West Zone', q1: 22, q2: 19, rate: 7200, minLvl: 25 },
  ],
};

const MIS_DS_3: DomainDataset = {
  roleName: 'MIS Reporting Analyst',
  entityLabel: 'Client Account',
  codePrefix: 'CLN',
  categoryLabel: 'Plan Tier',
  qtyLabel: 'Tickets Resolved',
  rateLabel: 'Billing Rate (₹)',
  categories: ['Enterprise', 'SMB'],
  items: [
    { code: 'CLN-301', name: 'Bharat Logistics', cat: 'Enterprise', q1: 92, q2: 78, rate: 2400, minLvl: 85 },
    { code: 'CLN-302', name: 'Shakti Foods', cat: 'SMB', q1: 38, q2: 31, rate: 1450, minLvl: 45 },
    { code: 'CLN-303', name: 'Deccan Motors', cat: 'Enterprise', q1: 108, q2: 91, rate: 2800, minLvl: 100 },
    { code: 'CLN-304', name: 'Narmada Textiles', cat: 'SMB', q1: 47, q2: 40, rate: 1600, minLvl: 45 },
    { code: 'CLN-305', name: 'Kaveri Healthcare', cat: 'Enterprise', q1: 76, q2: 65, rate: 2650, minLvl: 80 },
  ],
};

const INVENTORY_MODULE_SPECS: ModuleSpecConfig[] = [
  { id: 'inv_m01', order: 1, title: 'Excel Fundamentals', description: 'Navigate cells, enter stock data accurately, write basic formulas, and auto-fill serial numbers.', estimatedMinutes: 25, theme: 'fundamentals', dataset: INV_DS_1 },
  { id: 'inv_m02', order: 2, title: 'Data Entry and Formatting', description: 'Clean imported warehouse lists with TRIM, format ₹ currency, parse SKU codes, and validate entries.', estimatedMinutes: 25, theme: 'formatting', dataset: INV_DS_2 },
  { id: 'inv_m03', order: 3, title: 'Basic Formulas', description: 'Master multiplication, GST locking ($), percentage shares, and line-level inventory totals.', estimatedMinutes: 30, theme: 'basic_formulas', dataset: INV_DS_1 },
  { id: 'inv_m04', order: 4, title: 'Stock In and Stock Out', description: 'Track opening stock, received shipments, dispatched units, and live closing inventory balances.', estimatedMinutes: 30, theme: 'stock_and_sales_ops', dataset: INV_DS_2 },
  { id: 'inv_m05', order: 5, title: 'Inventory Calculations', description: 'Compute inventory valuation, warehouse share %, margin analysis, and reorder quantities.', estimatedMinutes: 35, theme: 'percentages_and_rates', dataset: INV_DS_3 },
  { id: 'inv_m06', order: 6, title: 'IF, SUMIF and COUNTIF', description: 'Automate low-stock alerts, reorder triggers, zone totals, and multi-condition stock counts.', estimatedMinutes: 35, theme: 'logical_if_sumif', dataset: INV_DS_3 },
  { id: 'inv_m07', order: 7, title: 'VLOOKUP and XLOOKUP', description: 'Pull unit prices, supplier rates, and SKU categories from master catalogs without manual search.', estimatedMinutes: 40, theme: 'lookups', dataset: INV_DS_4 },
  { id: 'inv_m08', order: 8, title: 'Sorting and Filtering', description: 'Rank top-value SKUs, isolate low-stock zones with AutoFilter, and freeze header rows.', estimatedMinutes: 25, theme: 'sorting_filtering', dataset: INV_DS_4 },
  { id: 'inv_m09', order: 9, title: 'Conditional Formatting', description: 'Standardize SKU codes, flag out-of-spec stock entries, and highlight exception rows cleanly.', estimatedMinutes: 30, theme: 'data_cleaning_validation', dataset: INV_DS_1 },
  { id: 'inv_m10', order: 10, title: 'PivotTables and Inventory Reports', description: 'Build category-wise warehouse valuation summaries and dynamic executive stock mix tables.', estimatedMinutes: 40, theme: 'pivot_summary', dataset: INV_DS_2 },
  { id: 'inv_m11', order: 11, title: 'Stock Reconciliation', description: 'Compare book stock against physical counts, measure absolute shrinkage (ABS), and quantify ₹ loss.', estimatedMinutes: 40, theme: 'reconciliation_loans', dataset: INV_DS_3 },
  { id: 'inv_m12', order: 12, title: 'Advanced Inventory Management Projects', description: 'Construct multi-sheet inventory dashboards combining valuation, reorder budgets, and top SKUs.', estimatedMinutes: 45, theme: 'capstone_dashboard', dataset: INV_DS_4 },
];

const STORE_MODULE_SPECS: ModuleSpecConfig[] = [
  { id: 'str_m01', order: 1, title: 'Excel Fundamentals', description: 'Learn cell navigation, clean product entry, SUM totals, and drag-fill for retail store sheets.', estimatedMinutes: 25, theme: 'fundamentals', dataset: STORE_DS_1 },
  { id: 'str_m02', order: 2, title: 'Store Data Management', description: 'Format ₹ MRP prices, standardize product codes, clean POS exports, and validate barcodes.', estimatedMinutes: 25, theme: 'formatting', dataset: STORE_DS_3 },
  { id: 'str_m03', order: 3, title: 'Sales and Revenue Calculations', description: 'Compute line revenue, GST billing, bulk discounts, and product-level gross profit margins.', estimatedMinutes: 30, theme: 'basic_formulas', dataset: STORE_DS_1 },
  { id: 'str_m04', order: 4, title: 'Daily Sales Reports', description: 'Track opening counter stock, daily replenishment, units sold, and daily store revenue closures.', estimatedMinutes: 30, theme: 'stock_and_sales_ops', dataset: STORE_DS_3 },
  { id: 'str_m05', order: 5, title: 'Employee Attendance', description: 'Calculate shift attendance rates, target days met, and department attendance summaries.', estimatedMinutes: 30, theme: 'percentages_and_rates', dataset: STORE_DS_2 },
  { id: 'str_m06', order: 6, title: 'Payroll Calculations', description: 'Compute gross wages, attendance-linked incentives, overtime adjustments, and net staff payouts.', estimatedMinutes: 35, theme: 'reconciliation_loans', dataset: STORE_DS_2 },
  { id: 'str_m07', order: 7, title: 'IF and Conditional Formulas', description: 'Flag target achievers, compute staff incentives, and summarize sales by store section.', estimatedMinutes: 35, theme: 'logical_if_sumif', dataset: STORE_DS_1 },
  { id: 'str_m08', order: 8, title: 'Lookup Functions', description: 'Fetch item MRPs, supplier info, and staff wage rates automatically using VLOOKUP and XLOOKUP.', estimatedMinutes: 40, theme: 'lookups', dataset: STORE_DS_3 },
  { id: 'str_m09', order: 9, title: 'Data Validation', description: 'Audit invoice numbers, clean cashier data entries, and build automated quality checks.', estimatedMinutes: 30, theme: 'data_cleaning_validation', dataset: STORE_DS_2 },
  { id: 'str_m10', order: 10, title: 'Sorting and Filtering', description: 'Rank best-selling items, filter slow-moving sections, and isolate target misses.', estimatedMinutes: 25, theme: 'sorting_filtering', dataset: STORE_DS_1 },
  { id: 'str_m11', order: 11, title: 'PivotTables', description: 'Aggregate section-wise revenue, shift staffing costs, and monthly store contribution mix.', estimatedMinutes: 40, theme: 'pivot_summary', dataset: STORE_DS_3 },
  { id: 'str_m12', order: 12, title: 'Store Performance Dashboard', description: 'Build a multi-sheet store KPI dashboard linking live sales, profit margins, and top sellers.', estimatedMinutes: 45, theme: 'capstone_dashboard', dataset: STORE_DS_1 },
];

const BANKING_MODULE_SPECS: ModuleSpecConfig[] = [
  { id: 'bnk_m01', order: 1, title: 'Excel Fundamentals', description: 'Master clean account number entry, basic arithmetic, SUM/AVERAGE, and error fixing.', estimatedMinutes: 25, theme: 'fundamentals', dataset: BANK_DS_1 },
  { id: 'bnk_m02', order: 2, title: 'Customer Data Management', description: 'Clean KYC customer lists, verify account ID lengths (LEN), and parse branch codes.', estimatedMinutes: 25, theme: 'formatting', dataset: BANK_DS_1 },
  { id: 'bnk_m03', order: 3, title: 'Transaction Records', description: 'Track daily deposits, withdrawals, net settlement flows, and opening-to-closing movements.', estimatedMinutes: 30, theme: 'stock_and_sales_ops', dataset: BANK_DS_3 },
  { id: 'bnk_m04', order: 4, title: 'Basic Financial Calculations', description: 'Calculate fee revenue, GST on banking charges, weighted totals, and branch averages.', estimatedMinutes: 30, theme: 'basic_formulas', dataset: BANK_DS_2 },
  { id: 'bnk_m05', order: 5, title: 'Percentage and Interest Calculations', description: 'Compute portfolio shares, month-on-month deposit growth, simple interest, and yield margins.', estimatedMinutes: 35, theme: 'percentages_and_rates', dataset: BANK_DS_2 },
  { id: 'bnk_m06', order: 6, title: 'IF and Conditional Logic', description: 'Flag high-value alerts, minimum balance compliance, and multi-rule credit checks.', estimatedMinutes: 35, theme: 'logical_if_sumif', dataset: BANK_DS_1 },
  { id: 'bnk_m07', order: 7, title: 'SUMIF and SUMIFS', description: 'Summarize transaction volumes by payment mode (NEFT/UPI), branch zone, and account type.', estimatedMinutes: 35, theme: 'pivot_summary', dataset: BANK_DS_3 },
  { id: 'bnk_m08', order: 8, title: 'VLOOKUP and XLOOKUP', description: 'Match customer account details, interest rate slabs, and cross-sheet settlement codes.', estimatedMinutes: 40, theme: 'lookups', dataset: BANK_DS_1 },
  { id: 'bnk_m09', order: 9, title: 'Loan and EMI Calculations', description: 'Calculate bank-accurate monthly EMIs with PMT, total interest burden, and loan eligibility.', estimatedMinutes: 40, theme: 'reconciliation_loans', dataset: BANK_DS_2 },
  { id: 'bnk_m10', order: 10, title: 'Bank Statement Analysis', description: 'Sort high-value debits, filter by transaction channel, and locate peak cash outflows.', estimatedMinutes: 30, theme: 'sorting_filtering', dataset: BANK_DS_3 },
  { id: 'bnk_m11', order: 11, title: 'Transaction Reconciliation', description: 'Audit book ledger vs bank statement variances, apply tolerance checks, and verify settlements.', estimatedMinutes: 40, theme: 'data_cleaning_validation', dataset: BANK_DS_3 },
  { id: 'bnk_m12', order: 12, title: 'Financial Reporting and Dashboards', description: 'Assemble executive branch performance dashboards with live KPI formulas and top branches.', estimatedMinutes: 45, theme: 'capstone_dashboard', dataset: BANK_DS_2 },
];

const MIS_MODULE_SPECS: ModuleSpecConfig[] = [
  { id: 'mis_m01', order: 1, title: 'Excel Fundamentals', description: 'Build speed with cell references, auto-fill sequences, SUM/AVERAGE, and multi-sheet links.', estimatedMinutes: 25, theme: 'fundamentals', dataset: MIS_DS_1 },
  { id: 'mis_m02', order: 2, title: 'Data Entry', description: 'Structure clean employee and office databases with consistent IDs, dates, and numeric fields.', estimatedMinutes: 25, theme: 'stock_and_sales_ops', dataset: MIS_DS_2 },
  { id: 'mis_m03', order: 3, title: 'Data Formatting', description: 'Apply executive formatting, Indian Rupee (₹) displays, dynamic dates, and clean alignment.', estimatedMinutes: 25, theme: 'formatting', dataset: MIS_DS_2 },
  { id: 'mis_m04', order: 4, title: 'Basic Formulas', description: 'Calculate payroll totals, office seat costs, GST billing, and team productivity averages.', estimatedMinutes: 30, theme: 'basic_formulas', dataset: MIS_DS_1 },
  { id: 'mis_m05', order: 5, title: 'Logical Functions', description: 'Automate SLA pass/fail flags, incentive eligibility, and department rollups with IF/SUMIF/COUNTIF.', estimatedMinutes: 35, theme: 'logical_if_sumif', dataset: MIS_DS_1 },
  { id: 'mis_m06', order: 6, title: 'Lookup Functions', description: 'Connect employee rosters, client billing rates, and regional tables with VLOOKUP & XLOOKUP.', estimatedMinutes: 40, theme: 'lookups', dataset: MIS_DS_3 },
  { id: 'mis_m07', order: 7, title: 'Data Cleaning', description: 'Strip whitespace with TRIM, standardize IDs with UPPER/LEFT/RIGHT, and audit lengths with LEN.', estimatedMinutes: 35, theme: 'data_cleaning_validation', dataset: MIS_DS_3 },
  { id: 'mis_m08', order: 8, title: 'Sorting and Filtering', description: 'Rank regional productivity, filter by department or plan tier, and surface exception rows.', estimatedMinutes: 25, theme: 'sorting_filtering', dataset: MIS_DS_2 },
  { id: 'mis_m09', order: 9, title: 'Data Validation', description: 'Build audit checks, reconciliation tolerances, and error-proof payroll/billing verifications.', estimatedMinutes: 35, theme: 'reconciliation_loans', dataset: MIS_DS_1 },
  { id: 'mis_m10', order: 10, title: 'PivotTables', description: 'Construct multi-department MIS rollups, client tier revenue tables, and headcount summaries.', estimatedMinutes: 40, theme: 'pivot_summary', dataset: MIS_DS_3 },
  { id: 'mis_m11', order: 11, title: 'Charts and Graphs', description: 'Prepare clean percentage contribution tables, growth trends, and visual-ready KPI summaries.', estimatedMinutes: 35, theme: 'percentages_and_rates', dataset: MIS_DS_2 },
  { id: 'mis_m12', order: 12, title: 'MIS Reporting and Dashboard Creation', description: 'Deliver a complete executive MIS dashboard linked dynamically to live operational sheets.', estimatedMinutes: 45, theme: 'capstone_dashboard', dataset: MIS_DS_3 },
];

export const CAREER_PATHS: CareerPath[] = [
  {
    id: 'inventory',
    title: 'Inventory Management',
    shortTitle: 'Inventory',
    subtitle: 'Warehouse, stock control, reorder planning & reconciliation',
    description:
      'Master stock in/out registers, low-stock alerts, reorder budgeting, supplier rate lookups, valuation reports, and monthly physical stock reconciliation.',
    coverImage: '/src/assets/images/career_inventory_management_1795091308543.jpg',
    jobRoles: ['Inventory Executive', 'Warehouse Supervisor', 'Supply Chain Coordinator', 'Stock Auditor'],
    practicalSkills: [
      'Opening & closing stock calculation',
      'Low-stock alerts & reorder quantities',
      'Supplier master lookups (VLOOKUP/XLOOKUP)',
      'Inventory valuation & shrinkage reconciliation',
    ],
    modules: INVENTORY_MODULE_SPECS.map((cfg) => generateModuleFromTheme('inventory', cfg)),
  },
  {
    id: 'store',
    title: 'Store Management',
    shortTitle: 'Store Ops',
    subtitle: 'Daily retail sales, attendance, payroll & outlet dashboards',
    description:
      'Build real retail operations trackers: daily sales closures, staff shift attendance, payroll payouts, target vs achievement reports, and store profit dashboards.',
    coverImage: '/src/assets/images/career_store_management_1795091323898.jpg',
    jobRoles: ['Store Manager', 'Assistant Store Manager', 'Retail Operations Executive', 'Floor Supervisor'],
    practicalSkills: [
      'Daily & monthly sales tracking',
      'Staff attendance & payroll calculation',
      'Target vs achievement & incentives',
      'Profit margin & store performance dashboards',
    ],
    modules: STORE_MODULE_SPECS.map((cfg) => generateModuleFromTheme('store', cfg)),
  },
  {
    id: 'banking',
    title: 'Banking and Finance',
    shortTitle: 'Banking & Finance',
    subtitle: 'Account ledgers, interest, loan EMI & statement reconciliation',
    description:
      'Develop job-ready financial spreadsheet skills: customer account registers, running balances, simple & compound interest, PMT loan EMIs, and bank statement reconciliation.',
    coverImage: '/src/assets/images/career_banking_finance_1795091308014.jpg',
    jobRoles: ['Banking Assistant', 'Finance Executive', 'Accounts Officer', 'Loan Operations Analyst'],
    practicalSkills: [
      'Running account balances & ledgers',
      'Simple, compound interest & loan EMI (PMT)',
      'Conditional SUMIFS & payment mode summaries',
      'Statement reconciliation & branch dashboards',
    ],
    modules: BANKING_MODULE_SPECS.map((cfg) => generateModuleFromTheme('banking', cfg)),
  },
  {
    id: 'mis',
    title: 'Office Administration / MIS Executive',
    shortTitle: 'MIS Executive',
    subtitle: 'Employee databases, data cleaning, reporting & dashboards',
    description:
      'Become the go-to Excel specialist in any office: clean messy exports, connect multi-sheet rosters with XLOOKUP, automate SLA flags, and deliver management dashboards.',
    coverImage: '/src/assets/images/career_mis_executive_1795091308890.jpg',
    jobRoles: ['MIS Executive', 'Office Administrator', 'Operations Analyst', 'Data Coordinator'],
    practicalSkills: [
      'Employee rosters, attendance & payroll',
      'Data cleaning (TRIM, LEFT, RIGHT, LEN)',
      'Cross-sheet lookups & pivot-style rollups',
      'Executive MIS KPI dashboards',
    ],
    modules: MIS_MODULE_SPECS.map((cfg) => generateModuleFromTheme('mis', cfg)),
  },
];
