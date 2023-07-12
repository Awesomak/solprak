import React, { useState } from "react";
import { sendSplToken } from "./utils/solana";

const TokenItem = ({
  icon,
  symbol,
  tokenAddress,
  accountAddress,
  amount,
  decimal,
  keypair,
  getTokens,
  setStatus,
}) => {
  const [solToAddress, setSolToAddress] = useState("");
  const [solAmount, setSolAmount] = useState("");

  const handleSolToAddress = (e) => {
    setSolToAddress(e.target.value);
  };

  const handleSolAmount = (e) => {
    setSolAmount(e.target.value);
  };

  const handleTokenTransfer = async () => {
    if (!solToAddress || !solAmount) return;
    if (+solAmount > amount) return;
    setStatus(`Sending ${amount} ${symbol}`);
    await sendSplToken(
      keypair,
      solToAddress,
      tokenAddress,
      accountAddress,
      solAmount,
      decimal
    );
    setStatus("");
    getTokens();
  };
  return (
    <div>
      <h3>Token: {symbol}</h3>
      <img src={icon} alt="token" />
      <p>Token amount: {amount}</p>
      <h3>Send to:</h3>
      <input value={solToAddress} onChange={handleSolToAddress} />
      <h4>Token amount:</h4>
      <input value={solAmount} onChange={handleSolAmount} />
      <button onClick={handleTokenTransfer}>Send</button>
    </div>
  );
};

export default TokenItem;
