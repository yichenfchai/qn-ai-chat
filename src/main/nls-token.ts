/**
 * NLS Token 生成
 */
import * as crypto from 'crypto';

export function generateNLSToken(accessKeyId: string, accessKeySecret: string): string {
  const expireTime = Math.floor(Date.now() / 1000) + 3600;
  const tokenContent = JSON.stringify({ expireTime, accessKeyId });
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(tokenContent)
    .digest('base64');
  const safeSignature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return Buffer.from(JSON.stringify({ token: tokenContent, signature: safeSignature })).toString('base64');
}
