class MockSmsProvider {
  async send(phone, code) {
    console.log(`[mock-sms] ${phone} -> ${code}`);
    return { provider: 'mock', devCode: code };
  }
}

class AliyunSmsProvider {
  constructor(env) {
    if (
      !env.ALIYUN_ACCESS_KEY_ID ||
      !env.ALIYUN_ACCESS_KEY_SECRET ||
      !env.ALIYUN_SIGN_NAME ||
      !env.ALIYUN_TEMPLATE_CODE
    ) {
      throw new Error('阿里云短信配置不完整，需要 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_SIGN_NAME、ALIYUN_TEMPLATE_CODE');
    }
    const Dysmsapi = require('@alicloud/dysmsapi20170525').default;
    const OpenApi = require('@alicloud/openapi-client').default;
    this.Dysmsapi = Dysmsapi;
    this.client = new Dysmsapi(
      new OpenApi.Config({
        accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
        endpoint: 'dysmsapi.aliyuncs.com'
      })
    );
    this.signName = env.ALIYUN_SIGN_NAME;
    this.templateCode = env.ALIYUN_TEMPLATE_CODE;
    this.paramName = env.ALIYUN_TEMPLATE_PARAM || 'code';
  }

  async send(phone, code) {
    const request = new this.Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: this.signName,
      templateCode: this.templateCode,
      templateParam: JSON.stringify({ [this.paramName]: code })
    });
    await this.client.sendSms(request);
    return { provider: 'aliyun' };
  }
}

function createSmsProvider(env) {
  if (env.SMS_PROVIDER === 'aliyun') {
    return new AliyunSmsProvider(env);
  }
  return new MockSmsProvider();
}

module.exports = { createSmsProvider };
