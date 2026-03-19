import React, { useState, useEffect } from 'react';
import { Users, CreditCard, FileText, HardDrive, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [signups, setSignups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, signupsRes] = await Promise.all([
          fetch('/api/admin/stats').then(r => r.json()),
          fetch('/api/admin/signups').then(r => r.json()),
        ]);
        
        setStats(statsRes);
        setSignups(signupsRes);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-8">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!stats) return <div className="p-8">No data available</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card icon={Users} label="Total Users" value={stats.summary.totalUsers} color="blue" />
        <Card icon={CreditCard} label="Paid Users" value={stats.summary.paidUsers} color="green" />
        <Card icon={Users} label="Free Users" value={stats.summary.freeUsers} color="gray" />
        <Card icon={FileText} label="Total Notes" value={stats.summary.totalNotes} color="purple" />
      </div>

      {/* Storage Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-6 h-6 text-orange-600" />
          <h2 className="text-xl font-semibold">Storage Usage</h2>
        </div>
        <p className="text-3xl font-bold">{stats.summary.totalStorageMB} MB</p>
        <p className="text-gray-500">Total storage used by all notes</p>
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Users by Subscription Tier</h2>
        <div className="space-y-2">
          {stats.tierBreakdown.map(tier => (
            <div key={tier.subscription_tier || 'free'} className="flex justify-between">
              <span>{tier.subscription_tier || 'Free'}</span>
              <span className="font-semibold">{tier.count} users</span>
            </div>
          ))}
        </div>
      </div>

      {/* Signup Trends */}
      {signups && signups.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold">Signups (Last 7 Days)</h2>
          </div>
          <div className="space-y-2">
            {signups.map(day => (
              <div key={day.date} className="flex justify-between">
                <span>{day.date}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-blue-200 h-2 rounded" style={{width: `${Math.min(day.count * 20, 100)}px`}}></div>
                  <span className="font-semibold">{day.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Users */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Top Users by Notes Created</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Tier</th>
                <th className="px-4 py-2 text-right">Notes</th>
                <th className="px-4 py-2 text-right">Storage (MB)</th>
              </tr>
            </thead>
            <tbody>
              {stats.topUsers.slice(0, 20).map(user => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2">{user.subscription_tier || 'Free'}</td>
                  <td className="px-4 py-2 text-right">{user.note_count}</td>
                  <td className="px-4 py-2 text-right">{(user.storage_bytes / 1024 / 1024).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    gray: 'text-gray-600 bg-gray-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <div className={`rounded-lg shadow p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-8 h-8 opacity-50" />
      </div>
    </div>
  );
}
