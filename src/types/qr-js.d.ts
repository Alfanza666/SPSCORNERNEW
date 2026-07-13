declare module 'qr.js' {
  interface QrOptions {
    typeNumber?: number;
    errorCorrectLevel?: number;
  }

  interface QrResult {
    modules: boolean[][];
  }

  interface QrFactory {
    (value: string, options?: QrOptions): QrResult;
    ErrorCorrectLevel: {
      L: number;
      M: number;
      Q: number;
      H: number;
    };
  }

  const createQr: QrFactory;
  export default createQr;
}
