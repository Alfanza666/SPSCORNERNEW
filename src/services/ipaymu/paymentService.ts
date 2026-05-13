import axios from 'axios';

class PaymentService {
    private apiUrl = 'https://sandbox.ipaymu.com/api/v1'; // Change to production URL as needed
    private apiKey = 'YOUR_API_KEY'; // Replace with your actual API key

    async createPayment(amount: number, orderId: string, callbackUrl: string) {
        const payload = {
            amount,
            order_id: orderId,
            callback_url: callbackUrl,
            // Add other necessary fields depending on Ipaymu's API requirements
        };
        const response = await axios.post(`${this.apiUrl}/payment`, payload, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        return response.data;
    }

    async verifyPayment(orderId: string) {
        const response = await axios.get(`${this.apiUrl}/payment/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        return response.data;
    }
}

export default new PaymentService();