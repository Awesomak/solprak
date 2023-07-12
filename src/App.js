import { useState, useEffect } from "react";
import {
  burnToken,
  closeAccount,
  sendSolana,
  getKeyPair,
  getBalance,
  LAMPORTS_PER_SOL,
  getTokenAccounts,
} from "./utils/solana";
import Badge from "./Badge";
import TokenItem from "./TokenItem";
import "./App.css";

function App() {
  const [status, setStatus] = useState("");
  const [privatKey, setPrivatKey] = useState("");
  const [inputData, setInputData] = useState("");
  const [solBalance, setSolBalance] = useState(0);
  const [solToAddress, setSolToAddress] = useState("");
  const [solAmount, setSolAmount] = useState("");
  const [tokens, setTokens] = useState([]);

  const handlePrivatKeyChange = (e) => {
    setInputData(e.target.value);
  };

  const handleSolToAddress = (e) => {
    setSolToAddress(e.target.value);
  };

  const handleSolAmount = (e) => {
    setSolAmount(e.target.value);
  };

  const handleContinueClick = () => {
    setPrivatKey(getKeyPair(inputData));
  };

  const handleSendSolanaClick = async () => {
    if (!solToAddress || !solAmount) return;
    setStatus("Sending...");
    await sendSolana(privatKey, solToAddress, solAmount);
    setStatus("");
    updateBalance();
    setSolAmount("");
    setSolToAddress("");
  };

  const handleBurnAll = async () => {
    setStatus("Burning tokens");
    await burnToken(privatKey);
    setStatus("Closing accounts");
    await closeAccount(privatKey);
    setStatus("");
    updateBalance();
  };

  const updateBalance = async () => {
    let balance = await getBalance(privatKey);
    setSolBalance((balance / LAMPORTS_PER_SOL).toFixed(6));
  };

  const getTokens = async () => {
    await getTokenAccounts(privatKey).then((tokensData) =>
      setTokens(
        tokensData.filter((e) => e.type === "token_address" && e.amount)
      )
    );
    updateBalance();
  };

  useEffect(() => {
    if (privatKey) {
      updateBalance();
      getTokens();
    }
  }, [privatKey]);

  return (
    <div className="App">
      {!privatKey ? (
        <div>
          <label htmlFor="key">Please enter you privat key:</label>
          <input id="key" value={inputData} onChange={handlePrivatKeyChange} />
          <button onClick={handleContinueClick}>Continue</button>
        </div>
      ) : (
        <div>
          <h3>You sol balance is : {solBalance}</h3>
          <button onClick={handleBurnAll}>
            Burn all token accounts and NFT
          </button>
          <div>
            <h3>Send solana to:</h3>
            <input value={solToAddress} onChange={handleSolToAddress} />
            <h2>Solana amount:</h2>
            <input value={solAmount} onChange={handleSolAmount} />
            <button onClick={handleSendSolanaClick}>Send solana</button>
          </div>
          {tokens.map((token) => (
            <TokenItem
              icon={token.icon}
              symbol={token.symbol}
              tokenAddress={token.address}
              accountAddress={token.accountAddress}
              amount={token.amount}
              decimal={token.decimals}
              keypair={privatKey}
              getTokens={getTokens}
            />
          ))}
        </div>
      )}
      {status && <Badge text={status} />}
    </div>
  );
}

export default App;
