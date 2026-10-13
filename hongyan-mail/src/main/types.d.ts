declare module 'libmime' {
  const libmime: {
    decodeWords(s: string): string;
    encodeWords(s: string, enc?: string, maxLength?: number): string;
    detectMimeType(ext: string): string;
    detectExtension(mime: string): string;
  };
  export default libmime;
}

declare module 'libmime/lib/charset' {
  const charset: { decode(buf: Buffer, charset?: string): string };
  export default charset;
}
