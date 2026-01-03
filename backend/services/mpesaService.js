const axios = require('axios');
const moment = require('moment');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortCode = process.env.MPESA_SHORTCODE;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
    this.authToken = null;
    this.tokenExpiry = null;
  }

  async getAuthToken() {
    if (this.authToken && this.tokenExpiry > Date.now()) {
      return this.authToken;
    }

    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      this.authToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      
      return this.authToken;
    } catch (error) {
      console.error('M-Pesa auth error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  async initiateSTKPush(phoneNumber, amount, reference) {
    const token = await this.getAuthToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(
      `${this.shortCode}${this.passkey}${timestamp}`
    ).toString('base64');

    const requestData = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: this.shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: `${this.callbackURL}/api/payments/callback`,
      AccountReference: reference,
      TransactionDesc: 'Fleet Management Premium Subscription'
    };

    try {
      const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        return response.data;
      } else {
        throw new Error(response.data.ResponseDescription || 'STK Push failed');
      }
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  async checkTransactionStatus(checkoutRequestID) {
    const token = await this.getAuthToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(
      `${this.shortCode}${this.passkey}${timestamp}`
    ).toString('base64');

    const requestData = {
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID
    };

    try {
      const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Transaction status error:', error.response?.data || error.message);
      throw new Error('Failed to check transaction status');
    }
  }

  async validatePayment(callbackData) {
    if (callbackData.Body.stkCallback.ResultCode === 0) {
      const items = callbackData.Body.stkCallback.CallbackMetadata.Item;
      const receipt = items.find(item => item.Name === 'MpesaReceiptNumber');
      const amount = items.find(item => item.Name === 'Amount');
      const phone = items.find(item => item.Name === 'PhoneNumber');

      return {
        success: true,
        receiptNumber: receipt ? receipt.Value : null,
        amount: amount ? amount.Value : null,
        phoneNumber: phone ? phone.Value : null,
        timestamp: new Date()
      };
    }

    return {
      success: false,
      errorCode: callbackData.Body.stkCallback.ResultCode,
      errorMessage: callbackData.Body.stkCallback.ResultDesc
    };
  }
}

module.exports = new MpesaService();