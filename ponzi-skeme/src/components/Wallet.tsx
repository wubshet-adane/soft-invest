import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Deposit, Withdrawal, Transaction } from '../lib/supabase';
import { Upload, Download, Plus, Minus, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState('');
  const [depositScreenshot, setDepositScreenshot] = useState<File | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [adminBankAccounts, setAdminBankAccounts] = useState<{
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    branch_name: string | null;
  }[]>([]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchAdminBankAccounts = async () => {
    try {
      const { data, error } = await supabase.from('admin_bank_accounts').select('*');
      if (error) throw error;
      setAdminBankAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchWalletData = async () => {
    if (!user) return;

    try {
      const { data: depositsData } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      await fetchAdminBankAccounts();

      setDeposits(depositsData || []);
      setWithdrawals(withdrawalsData || []);
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !depositAmount || parseFloat(depositAmount) <= 0) return;
    setDepositLoading(true);
    try {
      let screenshotUrl = null;
      if (depositScreenshot) {
        screenshotUrl = `screenshot_${Date.now()}.jpg`;
      }
      const { error } = await supabase.from('deposits').insert({
        user_id: user.id,
        amount: parseFloat(depositAmount),
        screenshot_url: screenshotUrl,
      });
      if (error) throw error;
      setDepositAmount('');
      setDepositScreenshot(null);
      setShowDepositModal(false);
      await fetchWalletData();
      alert('Deposit request submitted successfully! It will be reviewed by an admin.');
    } catch (error) {
      console.error('Error submitting deposit:', error);
      alert('Failed to submit deposit request. Please try again.');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return;

    const amount = parseFloat(withdrawAmount);
    if (amount > user.wallet_balance) {
      alert('Insufficient balance');
      return;
    }

    const hasPending = withdrawals.some(w => w.status === 'pending');
    if (hasPending) {
      alert('You already have a pending withdrawal request. Please wait until it is processed.');
      return;
    }

    setWithdrawLoading(true);

    try {
      const { error } = await supabase.from('withdrawals').insert({
        user_id: user.id,
        amount: amount,
      });
      if (error) throw error;
      setWithdrawAmount('');
      setShowWithdrawModal(false);
      await fetchWalletData();
      alert('Withdrawal request submitted successfully! It will be processed by an admin.');
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      alert('Failed to submit withdrawal request. Please try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit': return <Plus className="h-4 w-4 text-green-600" />;
      case 'withdrawal': return <Minus className="h-4 w-4 text-red-600" />;
      case 'package_purchase': return <Download className="h-4 w-4 text-blue-600" />;
      case 'task_reward': return <Plus className="h-4 w-4 text-purple-600" />;
      case 'referral_bonus': return <Plus className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
          <p className="text-gray-600">Manage your deposits, withdrawals, and transactions</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Withdraw
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Current Balance</h3>
        <p className="text-3xl font-bold">${user?.wallet_balance?.toFixed(2) || '0.00'}</p>
        <button
          onClick={() => navigate('/wallet/bank-info')}
          className="mt-4 bg-white text-blue-700 px-4 py-2 rounded-md hover:bg-gray-100"
        >
           My Bank Info
        </button>
      </div>

      {/* ... the rest of the component remains unchanged ... */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deposits */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Deposits</h3>
          </div>
          <div className="p-6">
            {deposits.length > 0 ? (
              <div className="space-y-4">
                {deposits.slice(0, 5).map((deposit) => (
                  <div key={deposit.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">${deposit.amount.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(deposit.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    {getStatusBadge(deposit.status)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No deposits yet</p>
            )}
          </div>
        </div>

        {/* Recent Withdrawals */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Withdrawals</h3>
          </div>
          <div className="p-6">
            {withdrawals.length > 0 ? (
              <div className="space-y-4">
                {withdrawals.slice(0, 5).map((withdrawal) => (
                  <div key={withdrawal.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">${withdrawal.amount.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(withdrawal.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    {getStatusBadge(withdrawal.status)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No withdrawals yet</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="p-6">
            {transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getTransactionIcon(transaction.type)}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {transaction.type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(transaction.created_at), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        transaction.type === 'withdrawal' || transaction.type === 'package_purchase' 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {transaction.type === 'withdrawal' || transaction.type === 'package_purchase' ? '-' : '+'}
                        ${transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

     {/* Deposit Modal */}
{showDepositModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Make a Deposit</h3>
      </div>

      {/* Admin Bank Accounts Section */}
      <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-48 overflow-auto">
        <h4 className="text-md font-semibold mb-2 text-gray-700">Bank Accounts for Deposit</h4>
        {adminBankAccounts.length > 0 ? (
          <ul className="space-y-2 text-gray-800 text-sm">
            {adminBankAccounts.map((account) => (
              <li key={account.id} className="border-b border-gray-300 pb-2 last:border-b-0 bg-green-500">
                <p><strong>Bank:</strong> {account.bank_name}</p>
                <p><strong>Name:</strong> {account.account_holder}</p>
                <p><strong>Account Number:</strong> {account.account_number}</p>
                {account.branch_name && <p><strong>Branch:</strong> {account.branch_name}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 bg-blue-900">No bank account information available.</p>
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user || !depositAmount || parseFloat(depositAmount) <= 0 || !depositScreenshot) {
            alert("Please fill in all fields and upload a screenshot.");
            return;
          }

          setDepositLoading(true);
          try {
            // Step 1: Upload screenshot to Supabase Storage
            const filename = `screenshot_${Date.now()}.${depositScreenshot.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage
              .from('screenshots')
              .upload(filename, depositScreenshot);

            if (uploadError) throw uploadError;

            // Step 2: Insert deposit record
            const { error: insertError } = await supabase.from('deposits').insert({
              user_id: user.id,
              amount: parseFloat(depositAmount),
              screenshot_url: filename,
            });

            if (insertError) throw insertError;

            // Reset form
            setDepositAmount('');
            setDepositScreenshot(null);
            setShowDepositModal(false);
            await fetchWalletData();
            alert('Deposit request submitted successfully! It will be reviewed by an admin.');
          } catch (error) {
            console.error('Error submitting deposit:', error);
            alert('Failed to submit deposit request. Please try again.');
          } finally {
            setDepositLoading(false);
          }
        }}
        className="p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deposit Amount ($)
          </label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-blue-900"
            placeholder="Enter amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Screenshot <span className="text-red-600">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setDepositScreenshot(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-blue-900"
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-md">
          <p className="text-sm text-blue-800">
            Please make your payment and upload a screenshot. Your deposit will be reviewed and approved by an admin.
          </p>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setShowDepositModal(false)}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={depositLoading}
            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {depositLoading ? 'Submitting...' : 'Submit Deposit'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Request Withdrawal</h3>
            </div>
            <form onSubmit={handleWithdraw} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Withdrawal Amount ($)
                </label>
                <input
                  type="number"
                  min="1"
                  max={user?.wallet_balance || 0}
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-blue-900"
                  placeholder="Enter amount"
                  required
                />
              </div>

              <div className="bg-yellow-50 p-4 rounded-md">
                <p className="text-sm text-yellow-800">
                  Available balance: ${user?.wallet_balance?.toFixed(2)}
                  <br />
                  Your withdrawal request will be processed by an admin.
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {withdrawLoading ? 'Submitting...' : 'Submit Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
