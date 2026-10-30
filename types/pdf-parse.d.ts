declare module "pdf-parse" {
  const parsePdf: (data: Buffer | Uint8Array) => Promise<{ text: string }>;
  export default parsePdf;
}
