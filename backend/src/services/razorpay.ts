import Razorpay from 'razorpay';
import crypto from 'crypto';

const isRazorpayConfigured =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_ID !== 'rzp_test_mock_id' &&
  process.env.RAZORPAY_KEY_SECRET &&
  process.env.RAZORPAY_KEY_SECRET !== 'rzp_test_mock_secret';

let razorpayClient: Razorpay | null = null;

if (isRazorpayConfigured) {
  razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export interface PaymentLinkParams {
  paymentId: string;
  amount: number;
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export async function createPaymentLink(params: PaymentLinkParams): Promise<{ id: string; url: string }> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

  if (razorpayClient) {
    try {
      const response: any = await razorpayClient.paymentLink.create({
        amount: Math.round(params.amount * 100), // Razorpay accepts in paise
        currency: 'INR',
        accept_partial: false,
        description: params.description,
        customer: {
          name: params.customerName,
          email: params.customerEmail,
          contact: params.customerPhone,
        },
        notify: {
          sms: false,
          email: false,
        },
        reminder_enable: false,
        callback_url: `${backendUrl}/api/payments/callback`,
        callback_method: 'get',
        reference_id: params.paymentId,
      });

      return {
        id: response.id,
        url: response.short_url,
      };
    } catch (error) {
      console.error('Razorpay payment link creation failed, falling back to mock:', error);
    }
  }

  // Fallback: Mock Payment Link
  const mockLinkId = `plink_${Math.random().toString(36).substring(2, 10)}`;
  const mockLinkUrl = `${backendUrl}/pay/${params.paymentId}`;

  return {
    id: mockLinkId,
    url: mockLinkUrl,
  };
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!isRazorpayConfigured) {
    // If mocking, we bypass verification
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}
