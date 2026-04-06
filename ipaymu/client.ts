import axios from 'axios';

export class IpaymuClient {
    private apiKey: string;
    private apiUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.ipaymu.com/'; // Replace with actual URL
    }

    async createPayment(data: any) {
        try {
            const response = await axios.post(`${this.apiUrl}createPayment`, data, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error creating payment: ${error.response.data.message}`);
        }
    }

    async createDirectPayment(data: any) {
        try {
            const response = await axios.post(`${this.apiUrl}createDirectPayment`, data, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error creating direct payment: ${error.response.data.message}`);
        }
    }
}