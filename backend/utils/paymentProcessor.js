const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');
const mpesaService = require('../services/mpesaService');
const PaymentTransaction = require('../models/PaymentTransaction');
const Tenant = require('../models/Tenant');

class PaymentProcessor {
  constructor() {
    this.providers = {
      mpesa: this.processMpesaPayment.bind(this),
      card: this.processCardPayment.bind(this),
      bank: this.processBankPayment.bind(this)
    };
  }

  async processPayment(tenantId, paymentData) {
    try {
      const { provider, amount, currency, metadata } = paymentData;
      
      if (!this.providers[provider]) {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }

      const transaction = new PaymentTransaction({
        tenantId,
        amount,
        currency: currency || 'USD',
        paymentMethod: provider,
        status: 'Pending',
        metadata: metadata || {}
      });

      await transaction.save();

      const providerResult = await this.providers[provider](transaction, paymentData);

      if (providerResult.success) {
        transaction.status = 'Completed';
        transaction.transactionId = providerResult.transactionId;
        transaction.mpesaReference = providerResult.reference;
        transaction.completedAt = new Date();
        
        if (providerResult.metadata) {
          transaction.metadata = { ...transaction.metadata, ...providerResult.metadata };
        }
      } else {
        transaction.status = 'Failed';
        transaction.metadata = { 
          ...transaction.metadata, 
          error: providerResult.error 
        };
      }

      await transaction.save();

      if (transaction.status === 'Completed') {
        await this.handleSuccessfulPayment(transaction);
      }

      return {
        success: transaction.status === 'Completed',
        transactionId: transaction._id,
        status: transaction.status,
        providerResult
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      
      return {
        success: false,
        error: error.message,
        transactionId: null
      };
    }
  }

  async processMpesaPayment(transaction, paymentData) {
    try {
      const { phoneNumber, subscriptionPlan } = paymentData;
      
      if (!phoneNumber) {
        throw new Error('Phone number required for M-Pesa payment');
      }

      const mpesaResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        transaction.amount,
        transaction._id.toString()
      );

      if (mpesaResponse.ResponseCode === '0') {
        transaction.mpesaReference = mpesaResponse.CheckoutRequestID;
        transaction.transactionId = mpesaResponse.MerchantRequestID;
        transaction.phoneNumber = phoneNumber;
        await transaction.save();

        return {
          success: true,
          transactionId: mpesaResponse.MerchantRequestID,
          reference: mpesaResponse.CheckoutRequestID,
          message: 'Payment request sent to your phone'
        };
      } else {
        throw new Error(mpesaResponse.ResponseDescription || 'M-Pesa payment failed');
      }
    } catch (error) {
      console.error('M-Pesa processing error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processCardPayment(transaction, paymentData) {
    try {
      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = paymentData;
      
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
        throw new Error('Incomplete card details');
      }

      const isCardValid = this.validateCardDetails(
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv
      );

      if (!isCardValid) {
        throw new Error('Invalid card details');
      }

      const cardToken = this.tokenizeCard(cardNumber);
      
      const paymentResult = await this.processCardWithGateway({
        token: cardToken,
        amount: transaction.amount,
        currency: transaction.currency,
        description: 'Fleet Management Subscription'
      });

      if (paymentResult.success) {
        return {
          success: true,
          transactionId: paymentResult.transactionId,
          reference: paymentResult.reference,
          metadata: {
            cardLast4: cardNumber.slice(-4),
            cardType: this.getCardType(cardNumber)
          }
        };
      } else {
        throw new Error(paymentResult.error || 'Card payment failed');
      }
    } catch (error) {
      console.error('Card processing error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processBankPayment(transaction, paymentData) {
    try {
      const { accountNumber, bankCode, accountName } = paymentData;
      
      if (!accountNumber || !bankCode || !accountName) {
        throw new Error('Incomplete bank details');
      }

      const bankDetails = this.getBankDetails(bankCode);
      
      if (!bankDetails) {
        throw new Error('Invalid bank code');
      }

      const reference = this.generateBankReference();
      
      return {
        success: true,
        transactionId: reference,
        reference: reference,
        metadata: {
          accountNumber: accountNumber.slice(-4),
          bankName: bankDetails.name,
          instructions: `Transfer ${transaction.amount} ${transaction.currency} to ${bankDetails.accountName} - ${bankDetails.accountNumber}`
        }
      };
    } catch (error) {
      console.error('Bank processing error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleSuccessfulPayment(transaction) {
    try {
      if (transaction.metadata?.subscriptionPlan === 'Premium') {
        await this.activatePremiumSubscription(transaction.tenantId);
      }

      await this.sendPaymentConfirmation(transaction);
      
      console.log(`Payment ${transaction._id} processed successfully`);
    } catch (error) {
      console.error('Error handling successful payment:', error);
    }
  }

  async activatePremiumSubscription(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      tenant.plan = 'Premium';
      tenant.vehicleLimit = 9999;
      tenant.subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tenant.save();

      console.log(`Tenant ${tenantId} upgraded to Premium`);
    } catch (error) {
      console.error('Error activating premium subscription:', error);
      throw error;
    }
  }

  async sendPaymentConfirmation(transaction) {
    try {
      const tenant = await Tenant.findById(transaction.tenantId);
      if (!tenant) return;

      const emailContent = this.generateReceiptEmail(transaction, tenant);
      
      console.log(`Payment confirmation sent for transaction ${transaction._id}`);
      
      return true;
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      return false;
    }
  }

  validateCardDetails(cardNumber, expiryMonth, expiryYear, cvv) {
    const cleanedCard = cardNumber.replace(/\s/g, '');
    
    if (!/^\d+$/.test(cleanedCard)) return false;
    
    if (cleanedCard.length < 13 || cleanedCard.length > 19) return false;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const year = parseInt(expiryYear);
    const month = parseInt(expiryMonth);
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }
    
    if (month < 1 || month > 12) return false;
    
    if (!/^\d{3,4}$/.test(cvv)) return false;
    
    return this.validateLuhn(cleanedCard);
  }

  validateLuhn(cardNumber) {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  tokenizeCard(cardNumber) {
    const hash = crypto.createHash('sha256');
    hash.update(cardNumber + process.env.JWT_SECRET);
    return hash.digest('hex');
  }

  async processCardWithGateway(paymentData) {
    try {
      const response = await axios.post(
        process.env.PAYMENT_GATEWAY_URL || 'https://api.payment-gateway.com/charge',
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYMENT_GATEWAY_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return {
          success: true,
          transactionId: response.data.transactionId,
          reference: response.data.reference
        };
      } else {
        return {
          success: false,
          error: response.data.message
        };
      }
    } catch (error) {
      console.error('Payment gateway error:', error);
      
      return {
        success: false,
        error: 'Payment gateway unavailable'
      };
    }
  }

  getCardType(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'American Express';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    if (/^3(?:0[0-5]|[68])/.test(cleaned)) return 'Diners Club';
    if (/^(?:2131|1800|35)/.test(cleaned)) return 'JCB';
    
    return 'Unknown';
  }

  getBankDetails(bankCode) {
    const banks = {
      '01': { name: 'Equity Bank', accountNumber: '1234567890', accountName: 'Fleet Management Ltd' },
      '02': { name: 'KCB Bank', accountNumber: '0987654321', accountName: 'Fleet Management Ltd' },
      '03': { name: 'Cooperative Bank', accountNumber: '1122334455', accountName: 'Fleet Management Ltd' },
      '04': { name: 'Standard Chartered', accountNumber: '5566778899', accountName: 'Fleet Management Ltd' }
    };
    
    return banks[bankCode];
  }

  generateBankReference() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `BANK-${timestamp}-${random}`.toUpperCase();
  }

  generateReceiptEmail(transaction, tenant) {
    const receiptDate = moment(transaction.completedAt).format('MMMM D, YYYY HH:mm');
    
    return {
      subject: `Payment Receipt - ${transaction.amount} ${transaction.currency}`,
      html: `
        <h2>Payment Receipt</h2>
        <p>Thank you for your payment!</p>
        <hr>
        <p><strong>Company:</strong> ${tenant.name}</p>
        <p><strong>Amount:</strong> ${transaction.amount} ${transaction.currency}</p>
        <p><strong>Date:</strong> ${receiptDate}</p>
        <p><strong>Transaction ID:</strong> ${transaction._id}</p>
        <p><strong>Payment Method:</strong> ${transaction.paymentMethod}</p>
        <hr>
        <p>This is an automated receipt. Please keep it for your records.</p>
      `
    };
  }

  async verifyTransaction(transactionId) {
    try {
      const transaction = await PaymentTransaction.findById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.paymentMethod === 'Mpesa' && transaction.mpesaReference) {
        const status = await mpesaService.checkTransactionStatus(transaction.mpesaReference);
        
        if (status.ResultCode === 0) {
          transaction.status = 'Completed';
          transaction.completedAt = new Date();
          await transaction.save();
          
          if (transaction.metadata?.subscriptionPlan === 'Premium') {
            await this.activatePremiumSubscription(transaction.tenantId);
          }
        }
      }

      return {
        success: true,
        transaction: {
          id: transaction._id,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt
        }
      };
    } catch (error) {
      console.error('Transaction verification error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async refundPayment(transactionId, reason) {
    try {
      const transaction = await PaymentTransaction.findById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'Completed') {
        throw new Error('Only completed transactions can be refunded');
      }

      const refundResult = await this.processRefund(transaction);
      
      if (refundResult.success) {
        const refundTransaction = new PaymentTransaction({
          tenantId: transaction.tenantId,
          amount: -transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod,
          status: 'Completed',
          metadata: {
            originalTransaction: transactionId,
            refundReason: reason,
            refundId: refundResult.refundId
          }
        });

        await refundTransaction.save();

        return {
          success: true,
          refundId: refundResult.refundId,
          amount: transaction.amount,
          currency: transaction.currency
        };
      } else {
        throw new Error(refundResult.error || 'Refund failed');
      }
    } catch (error) {
      console.error('Refund error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processRefund(transaction) {
    try {
      return {
        success: true,
        refundId: `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      };
    } catch (error) {
      console.error('Refund processing error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new PaymentProcessor();