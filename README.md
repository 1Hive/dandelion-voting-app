# dissent-app
The dissent app enables organizations to restrict actions to only those who have not expressed approval in recent votes.

#### 🚨 Security Review Status: Contracts frozen for audit as of commit [e5b06df5c6bf3c289ce1abc02b7faa1efb0b65f4]
(https://github.com/1Hive/dandelion-voting-app/tree/e5b06df5c6bf3c289ce1abc02b7faa1efb0b65f4/contracts)

The code in this repo has not been audited.

### Running tests

Running tests requires slightly alternative calls to what is usually expected to ensure we use the projects package versions rather than any globally installed ones.

Install packages:
```
npm install
```

Run a test chain in a separate terminal:
```
npx aragon devchain
``` 

Run tests:
```
npx truffle test --network rpc
```
