import { Building2, CalendarDays, CircleAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

export default function Admin() {
  const [data,setData]=useState<{stats:Record<string,number>;recentAuditLogs:Array<Record<string,unknown>>}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{void apiClient.admin().then(setData).catch((e:Error)=>setError(e.message));},[]);
  if(error)return <main className="container section"><div className="error-box">{error}</div></main>;
  if(!data)return <main className="screen-center">Loading platform intelligence…</main>;
  const cards=[[Users,'Users',data.stats.users],[Building2,'Organizations',data.stats.organizations],[CalendarDays,'Events',data.stats.events],[CircleAlert,'Failed jobs',data.stats.failedJobs]] as const;
  return <main className="container section page-stack"><div className="section-head"><span>Platform administration</span><h1>Security and operating health.</h1></div>
    <div className="stats-grid four">{cards.map(([Icon,label,value])=><div className="stat-card" key={label}><Icon/><span>{label}</span><strong>{value??0}</strong></div>)}</div>
    <section className="surface-panel"><h2>Recent immutable audit activity</h2>{data.recentAuditLogs.map((log)=><div className="list-row" key={String(log.id)}><div><strong>{String(log.action)}</strong><span>{new Date(String(log.created_at)).toLocaleString()}</span></div><span className="status">{String(log.resource_type??'system')}</span></div>)}</section>
  </main>;
}
