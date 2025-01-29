import base58 from "bs58";

export function decodeTransact(data) {
  const output = data ? base58.encode(Buffer.from(data, "base64")) : "";
  return output;
}

export function tOutPut(data) {
  const dataTx = data ? data?.transaction?.transaction : null;
  const signature = decodeTransact(dataTx?.signature);
  const message = dataTx?.transaction?.message;
  const header = message?.header;
  const accountKeys = message?.accountKeys.map((t) => {
    return decodeTransact(t);
  });
  const recentBlockhash = decodeTransact(message?.recentBlockhash);
  const instructions = message?.instructions;
  const meta = dataTx?.meta;
  return {
    signature,
    message: {
      header,
      accountKeys,
      recentBlockhash,
      instructions,
    },
    meta,
  };
}

export function getSolChange(preBalances, postBalances) {}
