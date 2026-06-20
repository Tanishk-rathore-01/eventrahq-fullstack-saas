import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import StatCard from '../components/StatCard.jsx';
import { dashboardApi } from '../api/client.js';

export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.admin().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <main className="container section"><div className="error-box">{error}</div></main>;
  if (!data) return <main className="screen-center">Loading admin intelligence...</main>;

  return (
    <main className="container section page-stack">
      <div className="section-head wide">
        <span>Admin command center</span>
        <h1>Platform analytics, audit trail, and capacity intelligence.</h1>
      </div>

      <div className="stats-grid">
        <StatCard label="Users" value={data.stats.users} />
        <StatCard label="Events" value={data.stats.events} />
        <StatCard label="Registrations" value={data.stats.registrations} />
        <StatCard label="Revenue" value={`₹${data.stats.revenue}`} />
        <StatCard label="Occupancy" value={`${data.stats.occupancyRate}%`} />
        <StatCard label="Check-in rate" value={`${data.stats.checkInRate}%`} />
      </div>

      <section className="panel-grid admin-panels">
        <div className="surface-panel chart-panel">
          <h2>Events by category</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.categories}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,.1)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis allowDecimals={false} stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14 }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-panel">
          <h2>Recent audit logs</h2>
          {data.recentAuditLogs.map((log) => (
            <div className="list-row" key={log.id}>
              <div><strong>{log.action}</strong><span>{new Date(log.created_at).toLocaleString()}</span></div>
              <span className="status">{log.actor_id}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
