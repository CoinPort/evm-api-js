const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// const provider = new ethers.JsonRpcProvider('http://geth:8545');
const provider = new ethers.JsonRpcProvider('https://dry-wispy-gas.quiknode.pro');
const KEYSTORE_DIR = path.join(__dirname, '/opt/keystores');

function getUTCFileName(address) {
  const now = new Date();
  const iso = now.toISOString().replace(/:/g, '-'); // đổi ":" ➝ "-" vì tên file
  return `UTC--${iso}--${address.toLowerCase()}`;
}

app.post('/create_account', async (req, res) => {
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: 'Missing password' });

  try {
    const wallet = ethers.Wallet.createRandom();
    const keystore = await wallet.encrypt(password);

    const filename = getUTCFileName(wallet.address);
    const filepath = path.join(KEYSTORE_DIR, filename);
    await fs.writeFile(filepath, keystore);

    res.json({ address: wallet.address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/send_transaction', async (req, res) => {
  const { address, password, to, value } = req.body;

  if (!address || !password || !to || !value) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const files = await fs.readdir(KEYSTORE_DIR);
    const file = files.find(f => f.endsWith(address.toLowerCase()));
    if (!file) return res.status(404).json({ error: 'Keystore not found for address' });

    const keystorePath = path.join(KEYSTORE_DIR, file);
    const keystore = await fs.readFile(keystorePath, 'utf8');

    const wallet = await ethers.Wallet.fromEncryptedJson(keystore, password);
    const connectedWallet = wallet.connect(provider);

    const tx = await connectedWallet.sendTransaction({
      to,
      value: ethers.parseEther(value),
    });

    res.json({ txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('ETH Tool API running on port 3000');
});
