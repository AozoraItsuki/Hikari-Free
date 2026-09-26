import { hkNet } from '../../utils/network.js';
import config from '#config';
class BuatQris {
  constructor({
    accountId = config.payment.buatQris.accountId,
    secretToken = config.payment.buatQris.secretToken,
    baseUrl = config.payment.buatQris.url,
  }) {
    this.accountId = accountId;
    this.secretToken = secretToken;
    this.client = {
      async post(path, data) {
        return hkNet.post(baseUrl + path, data, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      },
    };
  }
  async request(action, params = {}) {
    const body = new URLSearchParams({
      action,
      account_id: this.accountId,
      secret_token: this.secretToken,
      ...params,
    });
    const response = await this.client.post('', body);
    return {
      status: response.status,
      data: response.data,
    };
  }
  async createQris({ amount, description, qrisMethod = 'qris_two', feeBy = 'buyer' }) {
    return this.request('api_create_qris', {
      amount: String(amount),
      description,
      qris_method: qrisMethod,
      fee_by: feeBy,
    });
  }
  async checkStatus(transactionId) {
    return this.request('api_check_status', {
      transaction_id: String(transactionId),
    });
  }
  async withdraw({ amount, bankName, bankAccount, bankHolder }) {
    return this.request('api_withdraw', {
      amount: String(amount),
      bank_name: bankName,
      bank_account: bankAccount,
      bank_holder: bankHolder,
    });
  }
  async withdrawStatus(withdrawalId) {
    return this.request('api_withdraw_status', {
      withdrawal_id: String(withdrawalId),
    });
  }
}
export default BuatQris;
