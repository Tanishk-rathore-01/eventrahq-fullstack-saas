import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';

export default function Invitation() {
  const { token='' }=useParams(); const [message,setMessage]=useState('Accepting invitation…'); const [success,setSuccess]=useState(false);
  useEffect(()=>{void apiClient.acceptInvite(token).then(()=>{setSuccess(true);setMessage('Invitation accepted. Your workspace access is ready.');}).catch((e:Error)=>setMessage(e.message));},[token]);
  return <main className="container section narrow"><div className={success?'success-box':'notice-box'}><h1>{success?'Welcome to the team':'Workspace invitation'}</h1><p>{message}</p>{success&&<Link className="primary-btn" to="/dashboard">Open workspace</Link>}</div></main>;
}
