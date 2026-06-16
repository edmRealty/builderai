declare module "qrcode" {
  export type QRCodeToDataURLOptions = Record<string, unknown>;

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}
