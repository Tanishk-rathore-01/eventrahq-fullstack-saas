/// <reference types="vite/client" />

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color: string };
  handler(response: RazorpayResponse): void;
  modal?: { ondismiss(): void };
}
interface Window {
  Razorpay: new (options: RazorpayOptions) => { open(): void };
  BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
}
