const {
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
} = require("@solana/web3.js");
const bs58 = require("bs58");
const {
  createBurnCheckedInstruction,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require("@solana/spl-token");

const connection = new Connection(
  "https://autumn-newest-isle.solana-mainnet.discover.quiknode.pro/7b4a44326b5e1a27ba2ddebd0abbbb3ac6c40f1e/",
  "confirmed"
);

function sliceIntoChunks(arr, chunkSize = 10) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

export const getTokenAccounts = async (keypair) => {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    keypair.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const data = tokenAccounts.value.map((e) => {
    return fetch(
      `https://public-api.solscan.io/token/meta?tokenAddress=${e.account.data.parsed.info.mint}`,
      {
        headers: {
          token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE2ODkxNDM2MDMwNDMsImVtYWlsIjoiYXdlc29tZWJlc3QyQGdtYWlsLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImlhdCI6MTY4OTE0MzYwM30.INuvCCky7kAOHwNXoWP5BhLAJChsQUA9BvRwTxFkhOc",
        },
      }
    )
      .then((res) => res.json())
      .then((d) => ({
        ...d,
        accountAddress: e.pubkey.toString(),
        amount: e.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: e.account.data.parsed.info.tokenAmount.decimals,
      }));
  });
  const result = await Promise.all(data);
  console.log(result, tokenAccounts);
  return result;
};

export const sendSolana = async (fromKeypair, toKeypair, solAmount) => {
  let transaction = new Transaction();

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toKeypair,
      lamports: solAmount * LAMPORTS_PER_SOL,
    })
  );

  const some = await sendAndConfirmTransaction(connection, transaction, [
    fromKeypair,
  ]);

  return some;
};

export const getKeyPair = (privatKey) => {
  return Keypair.fromSecretKey(bs58.decode(privatKey));
};

export const burnToken = async (keypair) => {
  const balance = await connection.getBalance(keypair.publicKey);

  if (!balance) {
    return;
  }

  // Step 1 - Fetch Associated Token Account Address
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    keypair.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const filters = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: keypair.publicKey.toString(), //our search criteria, a base58 encoded string
      },
    },
  ];

  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: filters,
  });

  const instructions1 = await Promise.all(
    tokenAccounts.value.map(async (inst) => {
      const tokenAmount = await connection.getTokenAccountBalance(inst.pubkey);
      const tokenAddress = accounts.find((e) => {
        return e.pubkey.toString() === inst.pubkey.toString();
      });

      if (!tokenAddress || !tokenAmount.value.amount) return null;

      // Step 2 - Create Burn Instructions
      const burnIx = createBurnCheckedInstruction(
        inst.pubkey,
        new PublicKey(tokenAddress.account.data.parsed.info.mint),
        keypair.publicKey,
        parseInt(tokenAmount.value.amount),
        parseInt(tokenAmount.value.decimals)
      );

      return burnIx;
    })
  ).catch();

  const instructions = sliceIntoChunks(
    instructions1.filter((e) => {
      return e !== null;
    })
  );

  const result = await Promise.all(
    instructions.map(async (instruction) => {
      // Step 3 - Fetch Blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");

      // Step 4 - Assemble Transaction
      const messageV0 = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: blockhash,
        instructions: instruction,
      }).compileToV0Message();
      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([keypair]);

      const txid = await connection.sendTransaction(transaction);
      const confirmation = await connection.confirmTransaction({
        signature: txid,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
      });

      return confirmation;
    })
  ).catch();

  return result;
};

export const closeAccount = async (keypair) => {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    keypair.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const account = sliceIntoChunks(
    tokenAccounts.value.filter(
      (account) => account.account.data.parsed.info.tokenAmount.uiAmount === 0
    )
  );

  const result = await Promise.all(
    account.map(async (acc) => {
      const txn = new Transaction();
      acc.forEach((e) => {
        txn.add(
          createCloseAccountInstruction(
            e.pubkey,
            keypair.publicKey,
            keypair.publicKey
          )
        );
      });

      return await sendAndConfirmTransaction(connection, txn, [keypair]);
    })
  ).catch();

  return result;
};

export const getBalance = async (keypair) => {
  return await connection.getBalance(keypair.publicKey);
};

export const burnAllAndCloseAccounts = (keypair) => {
  return burnToken(keypair);
};

export const sendSplToken = async (
  keypair,
  toAddress,
  tokenAddress,
  accountAddress,
  amount,
  decimal
) => {
  let destinationAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    new PublicKey(tokenAddress),
    new PublicKey(toAddress)
  );

  const tx = new Transaction();

  tx.add(
    createTransferInstruction(
      new PublicKey(accountAddress),
      destinationAccount.address,
      keypair.publicKey,
      +amount * Math.pow(10, decimal)
    )
  );

  const latestBlockHash = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latestBlockHash.blockhash;
  const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
  return signature;
};

export { LAMPORTS_PER_SOL };
