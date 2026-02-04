// Client-side decryption - mirrors SecurityService.decrypt

export function decryptMessage(ciphertext: string): string {
  // TODO: implement real decryption with Web Crypto API
  if (ciphertext.startsWith('[ENCRYPTED]')) {
    return ciphertext.slice(11);
  }
  return ciphertext;
}
