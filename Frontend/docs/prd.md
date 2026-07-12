Requirements Document

1. Application Overview
   Application Name: Petrol Pump Management System

Description: A comprehensive web application for managing petrol pump operations including fuel purchasing and storage, sales transactions, customer and employee management, cash handling, expense tracking, and financial reporting with role-based access control.

2. Users and Usage Scenarios
   Target Users:

Admin: System administrator with full access
Manager: Operations manager with reporting and monitoring capabilities
Pump Operator: Frontline staff handling fuel dispensing and sales
Core Usage Scenarios:

Recording fuel purchases and managing tank inventory
Processing fuel sales transactions for cash and credit customers
Managing employee information and shift-based cash collections
Tracking expenses and calculating profit/loss
Generating business reports and monitoring dashboard metrics
Managing customer credit accounts and payment records 3. Page Structure and Functionality
3.1 Page Hierarchy
├── Login Page
├── Dashboard (Home)
├── Fuel Management
│ ├── Fuel Purchase
│ ├── Fuel Storage & Tanks
│ └── Fuel Types
├── Employee Management
├── Customer Management
├── Fuel Sales
├── Accounts & Cash
│ ├── Accounts Payable
│ ├── Cash Collection
│ └── Cash Storage
├── Profit & Loss
│ ├── Profit Calculation
│ └── Loss Management
├── Expense Management
└── Reports
├── Sales Reports
├── Fuel Stock Report
├── Profit Report
├── Loss Report
├── Expense Report
├── Credit Report
└── Summary Reports
3.2 Login Page
Functionality:

User enters username and password
System verifies credentials and user role
Redirect to Dashboard upon successful login
Display error message for invalid credentials
3.3 Dashboard
Functionality:

Display Daily Summary: Today Sales, Today Profit, Today Expenses, Net Profit, Transactions Count
Show Fuel Status: Total Fuel Stock, Tank Levels, Low Fuel Alerts
Present Credit Summary: Credit Customers count, Credit Sales amount, Outstanding Credit
Display Historical Records charts: Daily Sales, Daily Expenses, Daily Profit
Show Overall Summary: Total Sales, Total Profit, Total Expenses, Total Fuel Sold, Total Credit Given, Outstanding Credit
Real-time data updates
3.4 Fuel Management
3.4.1 Fuel Purchase
Functionality:

Record new fuel purchase with fields: Purchase ID (auto-generated), Supplier Name, Fuel Type, Quantity (liters), Price Per Liter, Total Amount (calculated), Tank (assignment), Date, Payment Status, Notes
View purchase history list
Edit existing purchase records
Delete purchase records
Filter purchases by date range, supplier, fuel type
Automatically update tank stock levels upon purchase confirmation
3.4.2 Fuel Storage & Tanks
Functionality:

Manage tank records with fields: Tank ID, Tank Name, Fuel Type, Capacity (liters), Current Stock (liters), Minimum Level (liters), Status (Active/Inactive/Maintenance)
Add new tank
Edit tank information
Delete unused tanks
View current stock levels for all tanks
Display low fuel alerts when Current Stock falls below Minimum Level
Calculate fuel consumption based on sales and purchases
3.4.3 Fuel Types
Functionality:

Manage fuel types: Petrol, Diesel, Gas (optional)
Add new fuel type
Edit fuel type name
Delete fuel type (only if not assigned to any tank or transaction)
Assign fuel types to tanks
Track stock separately for each fuel type
3.5 Employee Management
Functionality:

Manage employee records with fields: Employee ID (auto-generated), Full Name, Phone, ID Number, Position, Salary, Hire Date, Status (Active/Inactive/Suspended)
Add new employee
Edit employee information
Delete employee record
Assign roles: Admin, Manager, Pump Operator
Change employee status
View employee list with filters
Access Control:

Admin and Manager can perform all operations
Pump Operator cannot access this module
3.6 Customer Management
Functionality:

Manage customer records with fields: Customer ID (auto-generated), Full Name, Phone, ID Number, Credit Balance, Status (Active/Inactive/Blocked)
Add new customer
Edit customer information
View customer list
Record customer payments
View customer balance history
Generate customer statement
Monitor overdue customers
Access Control:

Manager and Admin can change customer status
Pump Operator can only view customer credit status
3.7 Fuel Sales
Functionality:

Record sales transaction with fields: Transaction ID (auto-generated), Pump Number, Fuel Type, Customer Type (Credit/Cash), Customer Name (optional for credit), Liters, Price Per Liter, Total Amount (calculated as Liters × Price Per Liter), Payment Method, Transaction Type, Employee (linked), Date & Time (auto-captured)
View sales transaction history
Filter transactions by date, fuel type, customer type, employee
For credit sales: automatically update customer credit balance
Automatically deduct fuel from tank stock
Link every sale to logged-in employee
Access Control:

Admin and Manager can manage fuel prices
Pump Operator cannot modify prices
All roles can record sales transactions
3.8 Accounts & Cash Management
3.8.1 Accounts Payable
Functionality:

Track supplier debts from fuel purchases
Record supplier payments with fields: Payment ID, Supplier Name, Payment Amount, Payment Date, Payment Method, Notes
View payment history
Calculate Remaining Balance = Total Purchases − Total Payments
Generate supplier statement
3.8.2 Cash Collection
Functionality:

Employee records daily cash collection with fields: Collection ID, Employee Name, Shift (Morning/Evening/Night), Cash Amount, Date, Status (Pending/Confirmed/Rejected)
Submit cash handover request
Manager reviews and confirms or rejects handover
View handover history
Display notifications for new handovers, pending confirmations, confirmed/rejected transactions
3.8.3 Cash Storage
Functionality:

Manage cash storage locations: Bank Account, Sarafi, Office Safe, Treasury
Record cash deposits and withdrawals
Track stored cash balance for each location
View storage history
Monitor total cash balance across all locations
3.9 Profit & Loss Management
3.9.1 Profit Calculation
Functionality:

Calculate Daily/Weekly/Monthly Profit
Calculate Fuel-wise Profit (per fuel type)
Calculate Net Profit = Sales − Fuel Cost − Expenses
Display profit breakdown by period
Generate profit charts
3.9.2 Loss Management
Functionality:

Record losses with fields: Loss ID, Loss Type (Fuel Leakage/Pump Damage/Fuel Price Difference/Other), Amount, Date, Description
Calculate Total Loss = Leakage + Damage + Price Difference + Other Losses
View loss history
Generate Daily/Weekly/Monthly Loss Reports
3.10 Expense Management
Functionality:

Record expenses with fields: Expense ID (auto-generated), Expense Type (Electricity/Salaries/Rent/Internet/Maintenance/Transport/Other), Amount (must be greater than zero), Date, Description
Add new expense
Edit expense record
Delete expense record
View expense history
Filter expenses by type and date range
Calculate total expenses by category and period
Access Control:

Only Admin and Manager can add/edit/delete expenses
3.11 Reports
Functionality:

Generate reports with options: Screen View, Print View, PDF Export, A4 Printing
Available report types:
Daily Sales Report
Weekly Sales Report
Monthly Sales Report
Fuel Stock Report
Profit Report
Loss Report
Expense Report
Credit Report
Customer Statement
Supplier Statement
Daily Summary Report
Monthly Summary Report
Each report includes: Report Information (title, date range, generated date), Summary Section (key metrics), Details Table (transaction/record details), Signature Section (for printed reports)
Apply filters: date range, fuel type, customer, employee, expense type
Display charts for visual data representation
Responsive table layout
Automatic calculation of totals and subtotals
Real-time data refresh
Access Control:

Admin: access all reports
Manager: access all reports
Pump Operator: no access to reports module 4. Business Rules and Logic
4.1 Fuel Stock Management
When fuel purchase is recorded, increase tank stock by purchased quantity
When fuel sale is recorded, decrease tank stock by sold quantity
Generate low fuel alert when tank Current Stock < Minimum Level
Prevent sales if tank stock is insufficient
4.2 Credit Customer Balance
When credit sale is recorded, increase customer Credit Balance by Total Amount
When customer payment is recorded, decrease customer Credit Balance by Payment Amount
Block customer if Credit Balance exceeds predefined limit (configurable by Admin)
Prevent credit sales to blocked customers
4.3 Cash Handover Workflow
Employee submits cash handover with status = Pending
Manager receives notification of new handover
Manager reviews and changes status to Confirmed or Rejected
Employee receives notification of handover status change
Confirmed cash is added to designated Cash Storage location
4.4 Profit Calculation
Sales Revenue = Sum of all sales Total Amount for period
Fuel Cost = Sum of all fuel purchases Total Amount for period
Total Expenses = Sum of all expenses Amount for period
Net Profit = Sales Revenue − Fuel Cost − Total Expenses
Fuel-wise Profit = (Sales Revenue for fuel type) − (Fuel Cost for fuel type)
4.5 Role-Based Access
Admin: full access to all modules and operations
Manager: access to Dashboard, Reports, Sales, Customer Management, Cash Collection approval, Expense Management; cannot manage Employees or System Settings
Pump Operator: access to Dashboard (view only), Fuel Sales (record only), Customer Management (view credit status only); cannot access Reports, Expense Management, Employee Management, System Settings
4.6 Fuel Price Management
Only Admin and Manager can set or modify fuel prices
Pump Operator uses current fuel price for sales transactions
Price changes do not affect historical transactions
4.7 Employee-Sales Linkage
Every sales transaction must be linked to the logged-in employee
Employee ID is automatically captured during transaction recording
Sales history can be filtered by employee
4.8 Supplier Payment Tracking
Remaining Balance = Total Purchases from Supplier − Total Payments to Supplier
Payment Status for each purchase: Paid, Partially Paid, Unpaid
Update Payment Status automatically when payment is recorded 5. Exceptions and Boundary Cases
Scenario Handling
Insufficient tank stock for sale Display error message, prevent transaction
Customer credit limit exceeded Display warning, block credit sale if customer status is Blocked
Invalid login credentials Display error message, do not grant access
Fuel type assigned to tank or transaction Prevent deletion, display error message
Employee with active sales records Prevent deletion, display error message
Negative or zero expense amount Display validation error, prevent submission
Cash handover already confirmed Prevent editing or deletion
Unauthorized access to restricted module Redirect to Dashboard, display access denied message
Tank capacity exceeded during purchase Display warning, allow override by Admin/Manager
Duplicate customer ID or phone number Display error message, prevent duplicate entry
Report generation with no data Display message indicating no data available for selected filters
Offline mode Display limited functionality message, allow basic sales recording with sync upon reconnection 6. Acceptance Criteria
Admin logs in and accesses Dashboard displaying real-time sales, profit, and fuel stock summary
Admin adds a new fuel tank with capacity, fuel type, and minimum level; tank appears in Fuel Storage list
Manager records a fuel purchase from supplier, assigns to tank; tank stock increases automatically
Pump Operator records a cash fuel sale; transaction is saved, tank stock decreases, and sale appears in sales history
Pump Operator records a credit fuel sale for registered customer; customer credit balance increases automatically
Customer makes a payment; Manager records payment, customer credit balance decreases
Employee submits daily cash handover; Manager receives notification, reviews, and confirms handover; cash is added to designated storage location
Manager generates Monthly Sales Report with filters; report displays summary, details table, and charts; Manager exports report as PDF 7. Features Not Included in This Release
Multi-language support
SMS or email notifications to customers
Integration with external payment gateways
Barcode or QR code scanning for transactions
Mobile application (native iOS/Android)
Advanced analytics and predictive forecasting
Automated fuel ordering based on stock levels
Integration with government fuel regulatory systems
Customer loyalty program or rewards system
Multi-location or franchise management
Biometric authentication for employees
Video surveillance integration
Fuel quality testing and tracking
Vehicle registration and tracking for fleet customers
Automated backup and disaster recovery
API for third-party integrations
