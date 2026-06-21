import { Camera, CheckCircle2, Keyboard, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client.js';

export default function CheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  function stopCamera(): void {
    scanningRef.current=false; streamRef.current?.getTracks().forEach((track)=>track.stop()); streamRef.current=null;
  }
  useEffect(() => stopCamera, []);

  async function submit(value = token): Promise<void> {
    if (!value.trim()) return;
    setMessage(''); setSuccess(false);
    try {
      const result = await apiClient.checkIn(value.trim());
      setSuccess(true); setMessage(result.checkIn.already_checked_in ? 'Ticket was already checked in.' : 'Attendee checked in successfully.');
      setToken(''); stopCamera();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Check-in failed.'); }
  }

  async function startCamera(): Promise<void> {
    setMessage('');
    if (!window.BarcodeDetector) { setMessage('This browser does not support QR camera scanning. Use manual code entry.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current=stream; if (!videoRef.current) return; videoRef.current.srcObject=stream; await videoRef.current.play();
      const detector = new window.BarcodeDetector({ formats:['qr_code'] }); scanningRef.current=true;
      const scan = async (): Promise<void> => {
        if (!scanningRef.current || !videoRef.current) return;
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) { await submit(codes[0].rawValue); return; }
        requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch { setMessage('Camera permission was denied or no camera is available.'); stopCamera(); }
  }

  return <main className="container section narrow page-stack">
    <div className="section-head"><span>Door operations</span><h1>Fast, verified check-in.</h1><p>Scanning is idempotent, so retrying the same ticket cannot create duplicate attendance.</p></div>
    {message&&<div className={success?'success-box':'error-box'}>{success&&<CheckCircle2/>}{message}</div>}
    <section className="scanner-panel"><div className="video-frame"><video ref={videoRef} muted playsInline/><ScanLine className="scan-guide"/></div>
      <button className="primary-btn full" onClick={() => void startCamera()}><Camera/>Start QR scanner</button>
    </section>
    <form className="form-card" onSubmit={(event)=>{event.preventDefault();void submit();}}><h2><Keyboard/>Manual fallback</h2><label>Ticket code<textarea value={token} onChange={(e)=>setToken(e.target.value)} placeholder="Paste the code encoded in the ticket QR" required/></label><button className="secondary-btn">Verify and check in</button></form>
  </main>;
}
